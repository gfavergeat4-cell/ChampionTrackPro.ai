/* Cloud Functions â€“ Sync ICS (CRON + callable)
 * - Lit teams/{teamId}.icsUrl
 * - Parse ICS (node-ical), expansion rÃ©currences + EXDATE
 * - Upsert vers teams/{teamId}/events/{eventId}
 * - Champs: cancelled, lastSeenAt, updatedAt, hash (sha256 du payload utile)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const ical = require("node-ical");
const fetch = require("node-fetch"); // v2 CJS
const crypto = require("crypto");
const cors = require("cors")({ origin: true });

try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

// ── Input validation helper ──────────────────────────────────────────────────
function validateString(val, name, maxLen = 200) {
  if (typeof val !== 'string' || val.trim().length === 0)
    throw new functions.https.HttpsError('invalid-argument', `${name} must be a non-empty string`);
  if (val.length > maxLen)
    throw new functions.https.HttpsError('invalid-argument', `${name} exceeds max length of ${maxLen}`);
  return val.trim();
}

const REGION = "us-central1";   // adapte si besoin
const CRON   = "every 15 minutes";
const EXPANSION_DAYS = 180;     // 6 mois

function makeHash(ev) {
  const json = JSON.stringify({
    title: ev.title || "",
    description: ev.description || "",
    location: ev.location || "",
    start: ev.start && ev.start.toISOString ? ev.start.toISOString() : (ev.start || ""),
    end: ev.end && ev.end.toISOString ? ev.end.toISOString() : (ev.end || ""),
    status: ev.status || "",
    allDay: !!ev.allDay,
    cancelled: !!ev.cancelled,
  });
  return crypto.createHash("sha256").update(json).digest("hex");
}

function eventDocId(uid, start) {
  const key = (uid || "NOUID") + "_" + (+start);
  return crypto.createHash("sha1").update(key).digest("hex");
}

function deriveEventFields(title, description, start, end, uid) {
  const combined = ((title || "") + " " + (description || "")).toLowerCase();
  const isGame = /\b(game|match|vs\.?|@)\b/.test(combined);
  const sessionType = isGame ? "game"
    : /\b(practice|training|workout|drill|conditioning|scrimmage)\b/.test(combined) ? "practice"
    : "training";
  const durationMs = (end && start) ? (new Date(end).getTime() - new Date(start).getTime()) : 0;
  return {
    date: new Date(start).toISOString().split("T")[0],
    sessionType,
    isGame,
    durationMinutes: Math.max(0, Math.round(durationMs / 60000)),
    calendarEventId: uid || null,
  };
}

function cleanTitle(rawTitle, rawDescription) {
  if (!rawTitle) {
    return rawDescription && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : "Training";
  }

  const t = String(rawTitle).trim();
  const lower = t.toLowerCase();

  if (lower === "busy" || lower === "occupÃ©" || lower === "occupied" || lower === "blocked") {
    if (rawDescription && rawDescription.trim().length > 0) {
      return rawDescription.trim();
    }
    return "Training";
  }

  return t;
}

function expandEvents(parsed, windowStart, windowEnd) {
  const out = [];

  for (const k in parsed) {
    const item = parsed[k];
    if (!item || item.type !== "VEVENT") continue;

    const base = {
      uid: item.uid || null,
      title: cleanTitle(item.summary || "", item.description || ""),
      description: item.description || "",
      location: item.location || "",
      status: (item.status || "CONFIRMED").toUpperCase(),
      source: "ics",
    };

    const isAllDay =
      (item.datetype && item.datetype === "date") ||
      (item.start && typeof item.start.toISOString !== "function");

    const durationMs = item.duration
      ? item.duration.asSeconds() * 1000
      : (item.end && item.start ? (new Date(item.end) - new Date(item.start)) : 0);

    if (item.rrule) {
      const ex = new Set();
      if (item.exdate) {
        Object.values(item.exdate).forEach(d => ex.add(+new Date(d)));
      }
      const dates = item.rrule.between(windowStart, windowEnd, true);
      dates.forEach(function(dt) {
        const start = new Date(dt);
        if (ex.has(+start)) return;
        const end = new Date(+start + (durationMs || 0));
        out.push({
          ...base,
          start: start,
          end: end,
          allDay: !!isAllDay,
          cancelled: base.status === "CANCELLED",
        });
      });
    } else if (item.recurrences) {
      for (const rk in item.recurrences) {
        const inst = item.recurrences[rk];
        if (inst && inst.exdate) continue;
        const start = new Date(inst.start);
        const end = new Date(inst.end);
        if (start >= windowStart && start <= windowEnd) {
          out.push({
            ...base,
            start: start,
            end: end,
            allDay: !!isAllDay,
            cancelled: base.status === "CANCELLED",
          });
        }
      }
    } else {
      if (!item.start || !item.end) continue;
      const start = new Date(item.start);
      const end = new Date(item.end);
      if (start >= windowStart && start <= windowEnd) {
        out.push({
          ...base,
          start: start,
          end: end,
          allDay: !!isAllDay,
          cancelled: base.status === "CANCELLED",
        });
      }
    }
  }

  return out;
}

// ─── FIX 2B: SSRF protection ─────────────────────────────────────────────────
function isUrlSafe(urlString) {
  let url;
  try { url = new URL(urlString); } catch { return false; }
  if (url.protocol !== "https:") return false;
  const hostname = url.hostname;
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,       // GCP metadata endpoint
    /^::1$/,
    /\.internal$/i,
    /\.local$/i,
  ];
  if (privatePatterns.some(p => p.test(hostname))) return false;
  return true;
}

// ─── FIX 3: Unified status writer (all sync paths use this) ──────────────────
async function updateTeamSyncStatus(teamId, status, error = null, counts = null) {
  const update = {
    calendarLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    calendarLastSyncStatus: status,  // "syncing" | "ok" | "error"
    calendarSyncError: error,
  };
  if (counts) {
    update.calendarLastSyncCounts = counts;
    // counts = { created, updated, deleted, cancelled }
  }
  await db.collection("teams").doc(teamId).set(update, { merge: true });
}

// ─── FIX 4: Questionnaire auto-link resolution ───────────────────────────────
async function resolveQuestionnaireId(teamData, sport, sessionType) {
  // 1. Team has multiple questionnaires — pick best for this sessionType
  const questionnaireIds = teamData.questionnaireIds?.length > 0
    ? teamData.questionnaireIds
    : teamData.questionnaireId ? [teamData.questionnaireId] : [];

  if (questionnaireIds.length > 0) {
    const fetchedQs = [];
    for (const qid of questionnaireIds) {
      const qSnap = await db.collection("questionnaires").doc(qid).get();
      if (qSnap.exists) fetchedQs.push({ id: qid, ...qSnap.data() });
    }
    const exact = fetchedQs.find(q => q.sessionType === sessionType);
    const any = fetchedQs.find(q => q.sessionType === "any");
    const picked = exact || any || fetchedQs[0] || null;
    if (picked) return picked.id;
  }

  const sportStr = sport || "Basketball";

  // 2. Sport + sessionType specific default
  const specificSnap = await db.collection("questionnaires")
    .where("sport", "==", sportStr)
    .where("sessionType", "==", sessionType)
    .where("isDefault", "==", true)
    .where("isArchived", "==", false)
    .limit(1)
    .get();
  if (!specificSnap.empty) return specificSnap.docs[0].id;

  // 3. Sport + "any" fallback
  const anySnap = await db.collection("questionnaires")
    .where("sport", "==", sportStr)
    .where("sessionType", "==", "any")
    .where("isDefault", "==", true)
    .where("isArchived", "==", false)
    .limit(1)
    .get();
  if (!anySnap.empty) return anySnap.docs[0].id;

  // 4. Generic "any" fallback
  const genericSnap = await db.collection("questionnaires")
    .where("sport", "==", "Generic")
    .where("sessionType", "==", "any")
    .where("isDefault", "==", true)
    .limit(1)
    .get();
  if (!genericSnap.empty) return genericSnap.docs[0].id;

  return null;
}

async function syncTeam(teamId) {
  const tRef = db.collection("teams").doc(teamId);
  const tSnap = await tRef.get();
  if (!tSnap.exists) throw new Error("Team " + teamId + " introuvable");
  const t = tSnap.data() || {};

  // FIX 5D: legacy calendarUrl fallback
  const icsUrl = t.icsUrl || t.calendarUrl;
  if (!icsUrl) return { seen: 0, created: 0, updated: 0, cancelled: 0, deleted: 0, note: "no icsUrl" };

  // FIX 3: mark as syncing before any work
  await updateTeamSyncStatus(teamId, "syncing");

  try {
    // FIX 2B: SSRF protection — reject non-public or non-HTTPS URLs
    if (!isUrlSafe(icsUrl)) {
      await updateTeamSyncStatus(teamId, "error", "Invalid calendar URL: must be a public HTTPS address");
      return { seen: 0, created: 0, updated: 0, cancelled: 0, deleted: 0, note: "url_blocked" };
    }

    // FIX 5A: fetch with 30-second timeout
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 30000);
    let res;
    try {
      res = await fetch(icsUrl, { signal: controller.signal });
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Calendar URL timed out after 30 seconds");
      }
      throw err;
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!res.ok) throw new Error("Fetch ICS HTTP " + res.status);
    const icsText = await res.text();
    const parsed = ical.sync.parseICS(icsText);

    const windowStart = new Date();
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + EXPANSION_DAYS);

    const instances = expandEvents(parsed, windowStart, windowEnd);

    // FIX 5B: hard cap — prevent timeout on oversized public feeds
    if (instances.length > 500) {
      throw new Error(
        `Calendar contains ${instances.length} events — max 500 allowed. Use a more specific calendar feed.`
      );
    }

    // FIX 1A: build set of incoming doc IDs for orphan detection
    const incomingDocIds = new Set();
    for (const ev of instances) {
      incomingDocIds.add(eventDocId(ev.uid, ev.start));
    }

    // FIX 5E: timezone fallback — prefer explicit team field, then UTC
    const displayTz = t.timeZone || t.timezone || "UTC";

    // FIX 4: questionnaire ID cache — one set of Firestore reads per unique sessionType
    const questionnaireIdCache = new Map();
    async function getQuestionnaireForSession(sessionType) {
      if (questionnaireIdCache.has(sessionType)) return questionnaireIdCache.get(sessionType);
      const qid = await resolveQuestionnaireId(t, t.sport, sessionType);
      questionnaireIdCache.set(sessionType, qid);
      return qid;
    }

    let seen = 0, created = 0, updated = 0, cancelled = 0, deleted = 0;
    const evCol = tRef.collection("trainings");
    const batch = db.batch();

    for (const ev of instances) {
      seen++;
      const id = eventDocId(ev.uid, ev.start);
      const ref = evCol.doc(id);

      const startTimestamp = admin.firestore.Timestamp.fromDate(ev.start);
      const endTimestamp = admin.firestore.Timestamp.fromDate(ev.end);
      const startUtcMillis = ev.start.getTime();
      const endUtcMillis = ev.end.getTime();

      const cleanedTitle = cleanTitle(ev.title, ev.description || "");
      const derived = deriveEventFields(cleanedTitle, ev.description || "", ev.start, ev.end, ev.uid);

      // FIX 4: auto-link questionnaire (cached)
      const questionnaireId = await getQuestionnaireForSession(derived.sessionType);

      const payload = {
        teamId: teamId,
        title: cleanedTitle,
        summary: cleanedTitle,
        description: ev.description || "",
        location: ev.location || "",
        startUtc: startTimestamp,
        endUtc: endTimestamp,
        startUTC: startUtcMillis,
        endUTC: endUtcMillis,
        allDay: !!ev.allDay,
        uid: ev.uid || null,
        status: ev.status || "CONFIRMED",
        source: "ics",
        syncedFromCalendar: true,  // FIX 1B: marks doc as calendar-owned
        cancelled: !!ev.cancelled,
        hash: makeHash(ev),
        timeZone: displayTz,
        displayTz: displayTz,
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        questionnaireNotified: false,
        date: derived.date,
        sessionType: derived.sessionType,
        isGame: derived.isGame,
        durationMinutes: derived.durationMinutes,
        calendarEventId: derived.calendarEventId,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        questionnaireId: questionnaireId || null,  // FIX 4
      };

      const cur = await ref.get();
      if (!cur.exists) {
        batch.set(ref, { ...payload, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        if (payload.cancelled) cancelled++;
        else created++;
      } else {
        const prev = cur.data() || {};
        if (prev.hash !== payload.hash || prev.cancelled !== payload.cancelled) {
          batch.set(ref, payload, { merge: true });
          if (payload.cancelled && !prev.cancelled) cancelled++;
          else updated++;
        } else {
          // Unchanged event — only refresh sync marker fields
          batch.set(ref, {
            lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
            syncedFromCalendar: true,
          }, { merge: true });
        }
      }
    }

    await batch.commit();

    // FIX 1C: phantom deletion — delete docs that came from sync but are no longer in feed
    const existingSnap = await evCol.where("syncedFromCalendar", "==", true).get();
    const toDelete = [];
    existingSnap.forEach(doc => {
      if (!incomingDocIds.has(doc.id)) toDelete.push(doc.ref);
    });
    for (let i = 0; i < toDelete.length; i += 499) {
      const chunk = toDelete.slice(i, i + 499);
      const delBatch = db.batch();
      chunk.forEach(ref => delBatch.delete(ref));
      await delBatch.commit();
    }
    deleted = toDelete.length;
    if (deleted > 0) console.log(`[sync] ${teamId} — deleted ${deleted} phantom sessions`);

    // FIX 3: write unified success status
    const counts = { created, updated, deleted, cancelled };
    await updateTeamSyncStatus(teamId, "ok", null, counts);

    return { seen, created, updated, cancelled, deleted };

  } catch (err) {
    // FIX 3: write unified error status before re-throwing
    await updateTeamSyncStatus(teamId, "error", err.message || "Unknown error");
    throw err;
  }
}

// Callable function (preferred method with automatic CORS)
exports.syncIcsNow = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '256MB'
  })
  .https.onCall(async (data, context) => {
    // Auth required
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    const teamId = data && data.teamId ? data.teamId : null;
    if (!teamId) {
      throw new functions.https.HttpsError("invalid-argument", "teamId requis");
    }

    // FIX VULN-05: verify caller is coach or admin of this team
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "User not found");
    }
    const userRole = (userDoc.data() || {}).role;
    if (userRole !== "admin" && userRole !== "coach") {
      throw new functions.https.HttpsError("permission-denied", "Coach or admin role required");
    }
    if (userRole === "coach") {
      const memberDoc = await db.collection("teams").doc(teamId).collection("members").doc(context.auth.uid).get();
      if (!memberDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this team");
      }
    }

    try {
      const result = await syncTeam(teamId);
      return result;
    } catch (error) {
      console.error("[SYNC_ICS] Error:", error);
      throw new functions.https.HttpsError("internal", error.message || "Internal error during sync");
    }
  });

// FIX 2A: syncIcsNowHttp removed — it had no auth check.
// Use the auth-gated syncIcsNow callable instead.

// FIX 3+5C: renamed syncIcsEvery10min → syncCalendarCron; parallel team processing
exports.syncCalendarCron = functions
  .region(REGION)
  .pubsub.schedule(CRON) // every 15 minutes
  .onRun(async () => {
    const snap = await db.collection("teams").where("calendarActive", "==", true).get();
    // FIX 5D: filter teams that have either field set
    const teamIds = snap.docs
      .filter(d => { const td = d.data(); return td.icsUrl || td.calendarUrl; })
      .map(d => d.id);

    // FIX 5C: process up to 10 teams concurrently; syncTeam handles status internally
    const CONCURRENCY = 10;
    for (let i = 0; i < teamIds.length; i += CONCURRENCY) {
      const chunk = teamIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(teamId => syncTeam(teamId).catch(err => {
          console.error(`[cron] Team ${teamId} failed:`, err.message);
        }))
      );
    }
    console.log(`[cron] ICS sync complete for ${teamIds.length} teams`);
    return null;
  });

// FIX 3: own status writes removed — syncTeam handles all status fields internally
exports.syncCalendarOnSave = functions
  .region(REGION)
  .firestore.document("teams/{teamId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? (change.before.data() || {}) : {};
    const after = change.after.exists ? (change.after.data() || {}) : null;
    if (!after) return null; // team deleted

    const newUrl = after.calendarUrl || after.icsUrl || null;
    const oldUrl = before.calendarUrl || before.icsUrl || null;
    if (!newUrl || newUrl === oldUrl) return null; // no URL change
    if (after.calendarActive !== true) return null; // auto-sync disabled

    const { teamId } = context.params;
    try {
      const result = await syncTeam(teamId); // syncTeam writes all status fields
      console.log("[SYNC_ON_SAVE]", teamId, "synced:", result);
    } catch (e) {
      console.error("[SYNC_ON_SAVE] Error for team", teamId, e.message);
    }
    return null;
  });

async function importTeamCalendarCore(teamId, icsUrl) {
  if (!teamId || !icsUrl) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "teamId and icsUrl are required"
    );
  }

  let normalizedUrl = icsUrl.trim();
  try {
    new URL(normalizedUrl);
  } catch (e) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid ICS URL format"
    );
  }

  if (normalizedUrl.includes("calendar.google.com") && !normalizedUrl.includes("/public/basic.ics")) {
    const match = normalizedUrl.match(/calendar\.google\.com\/calendar\/ical\/([^\/\?]+)/);
    if (match && match[1]) {
      const calendarId = match[1];
      normalizedUrl = `https://calendar.google.com/calendar/ical/${calendarId}/public/basic.ics`;
      console.log("[IMPORT_ICS] Normalized Google Calendar URL:", normalizedUrl);
    }
  }

  // Verify team exists
  const teamRef = db.collection("teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Team not found");
  }
  const team = teamSnap.data() || {};

  console.log("[IMPORT_ICS] Downloading ICS from:", normalizedUrl);
  const response = await fetch(normalizedUrl, {
    method: "GET",
    headers: {
      Accept: "text/calendar, text/plain, */*",
      "User-Agent": "ChampionTrackPro-CloudFunction/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const icsText = await response.text();
  if (!icsText || !icsText.includes("BEGIN:VCALENDAR")) {
    throw new Error("Invalid ICS content: missing BEGIN:VCALENDAR");
  }

  const teamTimeZone =
    team.timeZone ||
    team.tzid ||
    (team.settings && team.settings.timeZone) ||
    "Europe/Paris";

  const parsed = ical.sync.parseICS(icsText);
  const windowStart = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + EXPANSION_DAYS);

  const instances = expandEvents(parsed, windowStart, windowEnd);
  console.log("[IMPORT_ICS] Expanded", instances.length, "event instances");

  const trainingsCol = teamRef.collection("trainings");
  let seen = 0;
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let batch = db.batch();
  const batchSize = 500;
  let batchCount = 0;

  const existingDocs = new Map();
  const existingSnap = await trainingsCol.get();
  existingSnap.docs.forEach((doc) => {
    existingDocs.set(doc.id, true);
  });

  for (const ev of instances) {
    seen++;
    const eventId = eventDocId(ev.uid, ev.start);
    const trainingRef = trainingsCol.doc(eventId);

    const startTimestamp = admin.firestore.Timestamp.fromDate(ev.start);
    const endTimestamp = admin.firestore.Timestamp.fromDate(ev.end);
    const startUtcMillis = ev.start.getTime();
    const endUtcMillis = ev.end.getTime();

    const trainingData = {
      teamId,
      title: ev.title || "Training",
      summary: ev.title || "Training",
      description: ev.description || "",
      location: ev.location || "",
      startUtc: startTimestamp,
      endUtc: endTimestamp,
      startUTC: startUtcMillis,
      endUTC: endUtcMillis,
      timeZone: teamTimeZone,
      displayTz: teamTimeZone,
      uid: ev.uid || null,
      status: ev.status || "CONFIRMED",
      source: "ics",
      cancelled: !!ev.cancelled,
      questionnaireNotified: false,
      hash: makeHash(ev),
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const exists = existingDocs.has(eventId);
    if (exists) {
      batch.update(trainingRef, trainingData);
      updated++;
    } else {
      batch.set(
        trainingRef,
        {
          ...trainingData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: false }
      );
      created++;
      existingDocs.set(eventId, true);
    }

    if (ev.cancelled) cancelled++;

    batchCount++;
    if (batchCount >= batchSize) {
      await batch.commit();
      batchCount = 0;
      batch = db.batch();
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  await teamRef.update({
    icsUrl: normalizedUrl,
    calendarImported: true,
    calendarImportedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastCalendarImport: {
      at: admin.firestore.FieldValue.serverTimestamp(),
      seen,
      created,
      updated,
      cancelled,
      source: "url",
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    seen,
    created,
    updated,
    cancelled,
    message: `Calendar imported successfully: ${created} created, ${updated} updated`,
  };
}

// NOTE: Deploying these functions (HTTP, callable, Pub/Sub) requires the Firebase project
// to run on the Blaze plan because Cloud Build + Artifact Registry must be enabled.
// On the free Spark plan they will work in local emulators but cannot be deployed.
exports.importTeamCalendarFromUrlCallable = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required");
    }

    const { teamId, icsUrl } = data || {};

    // FIX VULN-05: verify caller is coach or admin of this team
    const userDoc = await db.collection("users").doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("permission-denied", "User not found");
    }
    const userRole = (userDoc.data() || {}).role;
    if (userRole !== "admin" && userRole !== "coach") {
      throw new functions.https.HttpsError("permission-denied", "Coach or admin role required");
    }
    if (userRole === "coach" && teamId) {
      const memberDoc = await db.collection("teams").doc(teamId).collection("members").doc(context.auth.uid).get();
      if (!memberDoc.exists) {
        throw new functions.https.HttpsError("permission-denied", "Not a member of this team");
      }
    }

    try {
      return await importTeamCalendarCore(teamId, icsUrl);
    } catch (error) {
      console.error("[IMPORT_ICS][CALLABLE] Error:", error);
      throw error;
    }
  });

exports.importTeamCalendarFromUrl = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: "256MB",
  })
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (err) {
          res.status(400).json({ error: "Invalid JSON body" });
          return;
        }
      }

      const { teamId, icsUrl } = body || {};

      const authHeader = req.headers.authorization || "";
      if (!authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing Authorization header" });
        return;
      }

      const idToken = authHeader.replace("Bearer ", "").trim();
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch (err) {
        console.error("[IMPORT_ICS][HTTP] Invalid token:", err);
        res.status(401).json({ error: "Invalid auth token" });
        return;
      }

      try {
        const result = await importTeamCalendarCore(teamId, icsUrl);
        res.status(200).json(result);
      } catch (error) {
        console.error("[IMPORT_ICS][HTTP] Error:", error);
        if (error instanceof functions.https.HttpsError) {
          const statusMap = {
            "invalid-argument": 400,
            "unauthenticated": 401,
            "not-found": 404,
            "permission-denied": 403,
          };
          const status = statusMap[error.code] || 500;
          res.status(status).json({ error: error.message });
        } else {
          res.status(500).json({ error: error.message || "Internal error" });
        }
      }
    });
  });

/**
 * Cloud Function callable pour crÃ©er un membership athlÃ¨te
 * Utilise l'Admin SDK pour contourner les rÃ¨gles Firestore si nÃ©cessaire
 */
exports.createMembership = functions.region(REGION).https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required");
  }

  const uid = context.auth.uid;
  const { teamId, email, name, role: requestedRole } = data || {};
  validateString(teamId, 'teamId', 128);
  if (requestedRole !== 'coach' && requestedRole !== 'athlete') {
    throw new functions.https.HttpsError('invalid-argument', 'role must be exactly "coach" or "athlete"');
  }
  const memberRole = requestedRole;

  return db.runTransaction(async (tx) => {
    const teamRef = db.doc(`teams/${teamId}`);
    const teamSnap = await tx.get(teamRef);

    if (!teamSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Team not found");
    }

    const memberRef = teamRef.collection("members").doc(uid);
    const userRef = db.doc(`users/${uid}`);
    const displayName = (name && String(name).trim()) || (email ? email.split("@")[0] : uid);

    // 1) CrÃ©er/mettre Ã  jour le membership
    tx.set(
      memberRef,
      {
        uid,
        name: displayName,
        email: email || "",
        role: memberRole,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2) Mettre Ã  jour l'utilisateur
    tx.set(
      userRef,
      {
        teamId,
        role: memberRole,
        email: email || "",
        displayName: displayName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 3) IncrÃ©menter le compteur de membres
    const current = (teamSnap.data()?.members ?? 0);
    tx.update(teamRef, { members: current + 1 });

    return { ok: true };
  });
});

/**
 * Cloud Function planifiÃ©e : envoie une notification "questionnaire disponible"
 * immÃ©diatement Ã  la fin du training (pas de dÃ©lai artificiel).
 * S'exÃ©cute toutes les 1 minute et vÃ©rifie les trainings terminÃ©s dans les 2 derniÃ¨res minutes.
 */
exports.sendQuestionnaireAvailableNotifications = functions
  .region(REGION)
  .pubsub.schedule("every 1 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();

    // FenÃªtre : trainings qui viennent de se terminer (0 Ã  2 min aprÃ¨s endUtc) â€” pas de dÃ©lai 30 min
    const minEnd = admin.firestore.Timestamp.fromMillis(nowMs - 2 * 60 * 1000);
    const maxEnd = now;

    console.log("[NOTIF][CRON] Checking trainings ended between", minEnd.toDate(), "and", maxEnd.toDate());

    // Les trainings sont dans teams/{teamId}/trainings
    // On doit itÃ©rer sur toutes les Ã©quipes ou utiliser une collection group query
    // Pour l'instant, on itÃ¨re sur les Ã©quipes qui ont des trainings
    const teamsSnap = await db.collection("teams").get();
    
    let allTrainings = [];
    
    // Parcourir toutes les Ã©quipes et chercher les trainings
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const trainingsSnap = await db
        .collection("teams")
        .doc(teamId)
        .collection("trainings")
        .where("endUtc", ">=", minEnd)
        .where("endUtc", "<=", maxEnd)
        .where("questionnaireNotified", "==", false)
        .get();
      
      trainingsSnap.docs.forEach(doc => {
        allTrainings.push({
          doc: doc,
          teamId: teamId,
          data: doc.data()
        });
      });
    }
    
    const snap = {
      size: allTrainings.length,
      docs: allTrainings.map(t => t.doc)
    };

    console.log("[NOTIF][CRON] Found", snap.size, "trainings to notify");

    const batch = db.batch();
    let notificationsSent = 0;

    for (let i = 0; i < snap.docs.length; i++) {
      const docSnap = snap.docs[i];
      const trainingInfo = allTrainings[i];
      const training = docSnap.data();
      const trainingId = docSnap.id;
      const teamId = trainingInfo.teamId;
      const title = training.title || training.summary || "Training session";
      const endTime = training.endUtc?.toDate?.() ?? null;
      
      if (!teamId) {
        console.warn("[NOTIF][CRON] Training", trainingId, "has no teamId");
        continue;
      }

      // RÃ©cupÃ©rer les membres de l'Ã©quipe (athlÃ¨tes)
      const membersSnap = await db
        .collection("teams")
        .doc(teamId)
        .collection("members")
        .where("role", "==", "athlete")
        .get();

      if (membersSnap.empty) {
        console.log("[NOTIF][CRON] No athletes found for team", teamId);
        batch.update(docSnap.ref, {
          questionnaireNotified: true,
          questionnaireNotifiedAt: now,
        });
        continue;
      }

      // FIX 4: deep link URL direct vers questionnaire
      const clickAction = `https://champion-track-pro.vercel.app/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`;
      console.log("[FCM] clickAction:", clickAction);
      const notifTitle = "ChampionTrackPro ⚡";
      const notifBody = "Tell us — how did that session hit you?";
      const REMINDER_HOURS = 3;
      const dueAtReminder = admin.firestore.Timestamp.fromMillis(nowMs + REMINDER_HOURS * 60 * 60 * 1000);

      // Envoyer une notification Ã  chaque athlÃ¨te + planifier rappel 2h si non rÃ©pondu
      // DEBT-04: batch-fetch all user docs in one round-trip instead of O(N) sequential reads
      const memberUids = membersSnap.docs.map((m) => m.id);
      const userRefs = memberUids.map((uid) => db.collection("users").doc(uid));
      const userDocs = await db.getAll(...userRefs);
      const userDataMap = new Map();
      userDocs.forEach((d) => { if (d.exists) userDataMap.set(d.id, d.data() || {}); });

      for (const memberDoc of membersSnap.docs) {
        const uid = memberDoc.id;
        if (!userDataMap.has(uid)) {
          console.warn("[NOTIF][CRON] User", uid, "not found");
          continue;
        }

        const userData = userDataMap.get(uid);
        const tokens = userData.fcmWebTokens || [];

        if (tokens.length === 0) {
          console.log("[NOTIF][CRON] No FCM tokens for user", uid);
          continue;
        }

        const message = {
          tokens,
          notification: {
            title: notifTitle,
            body: notifBody,
          },
          data: {
            trainingId,
            teamId,
            url: clickAction,
            tag: `questionnaire-${trainingId}`,
          },
          android: {
            priority: "high",
            notification: {
              priority: "high",
              defaultSound: true,
              channelId: "ctpro-questionnaire",
              color: "#00D4FF",
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default", badge: 1 } },
          },
          webpush: {
            headers: { Urgency: "high" },
            fcmOptions: { link: clickAction },
            notification: {
              icon: "https://champion-track-pro.vercel.app/icons/icon-192-v2.png",
              badge: "https://champion-track-pro.vercel.app/icons/badge-72.png",
              tag: `questionnaire-${trainingId}`,
              renotify: false,
              requireInteraction: false,
              silent: false,
              data: { url: clickAction, trainingId, teamId },
              actions: [{ action: "open_questionnaire", title: "Tell us →" }],
            },
          },
        };

        try {
          const resp = await admin.messaging().sendEachForMulticast(message);
          console.log(
            `[NOTIF][FCM] training ${trainingId}, user ${uid}, success ${resp.successCount}, failure ${resp.failureCount}`
          );
          
          // FIX 5: Nettoyer tous les tokens en échec via arrayRemove
          if (resp.failureCount > 0) {
            const failedTokens = resp.responses
              .map((r, i) => !r.success ? tokens[i] : null)
              .filter(Boolean);
            if (failedTokens.length > 0) {
              await db.collection("users").doc(uid).update({
                fcmWebTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens),
              });
              console.log(`[FCM] Removed ${failedTokens.length} invalid tokens for ${uid}`);
            }
          }
          
          notificationsSent += resp.successCount;

          // Planifier rappel 2h plus tard si questionnaire non rempli (idempotent)
          const reminderId = `${teamId}_${trainingId}_${uid}`;
          const reminderRef = db.collection("pendingQuestionnaireReminders").doc(reminderId);
          await reminderRef.set({
            userId: uid,
            teamId,
            trainingId,
            dueAt: dueAtReminder,
            secondReminderDueAt: admin.firestore.Timestamp.fromMillis(nowMs + 6 * 60 * 60 * 1000),
            status: "pending",
            notificationTitle: notifTitle,
            notificationBody: notifBody,
            clickAction,
            createdAt: now,
          }, { merge: true });
        } catch (err) {
          console.error("[NOTIF][FCM] Error sending notification", err);
        }
      }

      // Marquer le training comme notifiÃ©
      const trainingRef = db
        .collection("teams")
        .doc(teamId)
        .collection("trainings")
        .doc(trainingId);
      
      batch.update(trainingRef, {
        questionnaireNotified: true,
        questionnaireNotifiedAt: now,
      });
    }

    await batch.commit();
    console.log("[NOTIF][CRON] Sent", notificationsSent, "notifications total");
    return null;
  });

/**
 * Envoie les rappels "questionnaire disponible" 2h aprÃ¨s la notification initiale,
 * uniquement si le questionnaire n'est pas encore complÃ©tÃ©.
 * S'exÃ©cute toutes les 5 minutes.
 */
exports.sendQuestionnaireReminders = functions
  .region(REGION)
  .pubsub.schedule("every 5 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    console.log("[REMINDER] Running at", new Date().toISOString());
    const now = admin.firestore.Timestamp.now();
    const remindersSnap = await db
      .collection("pendingQuestionnaireReminders")
      .where("status", "==", "pending")
      .where("dueAt", "<=", now)
      .get();
    console.log("[REMINDER] Pending reminders found:", remindersSnap.docs.length);

    
    // DEBT-04: batch-fetch all user docs in one round-trip instead of O(N) sequential reads
    const reminderUserIds = [...new Set(remindersSnap.docs.map((d) => (d.data() || {}).userId).filter(Boolean))];
    const reminderUserRefs = reminderUserIds.map((uid) => db.collection("users").doc(uid));
    const reminderUserDocs = reminderUserRefs.length > 0 ? await db.getAll(...reminderUserRefs) : [];
    const userDataMap = new Map();
    reminderUserDocs.forEach((d) => { if (d.exists) userDataMap.set(d.id, d.data() || {}); });

    for (const docSnap of remindersSnap.docs) {
      const d = docSnap.data() || {};
      const { userId, teamId, trainingId, notificationTitle, notificationBody, clickAction } = d;
      const reminderRef = docSnap.ref;

      try {
        // VÃ©rifier si le questionnaire est dÃ©jÃ  complÃ©tÃ© (Ã©viter rappel en double)
        const responseRef = db
          .collection("teams").doc(teamId)
          .collection("trainings").doc(trainingId)
          .collection("responses").doc(userId);
        const responseSnap = await responseRef.get();
        if (responseSnap.exists && (responseSnap.data()?.status === "completed")) {
          await reminderRef.update({ status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
          continue;
        }

        if (!userDataMap.has(userId)) {
          await reminderRef.update({ status: "skipped", reason: "user_not_found" });
          continue;
        }
        const tokens = userDataMap.get(userId).fcmWebTokens || [];
        if (tokens.length === 0) {
          await reminderRef.update({ status: "skipped", reason: "no_tokens" });
          continue;
        }

        // FIX 4: deep link URL + new copywriting for reminder
        const reminderUrl = `https://champion-track-pro.vercel.app/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`;
        const message = {
          tokens,
          notification: {
            title: "Still got 60 seconds? ⏱",
            body: "Your coach needs your data to make tomorrow better for everyone.",
          },
          data: {
            trainingId,
            teamId,
            url: reminderUrl,
            tag: `questionnaire-${trainingId}`,
          },
          android: {
            priority: "high",
            notification: {
              priority: "high",
              defaultSound: true,
              channelId: "ctpro-questionnaire",
              color: "#00D4FF",
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default", badge: 1 } },
          },
          webpush: {
            headers: { Urgency: "high" },
            fcmOptions: { link: reminderUrl },
            notification: {
              icon: "https://champion-track-pro.vercel.app/icons/icon-192-v2.png",
              badge: "https://champion-track-pro.vercel.app/icons/badge-72.png",
              tag: `questionnaire-${trainingId}`,
              renotify: false,
              requireInteraction: false,
              silent: false,
              data: { url: reminderUrl, trainingId, teamId },
              actions: [{ action: "open_questionnaire", title: "Tell us →" }],
            },
          },
        };
        const reminderResp = await admin.messaging().sendEachForMulticast(message);
        // FIX 5: Nettoyer tous les tokens en échec via arrayRemove
        if (reminderResp.failureCount > 0) {
          const failedTokens = reminderResp.responses
            .map((r, i) => !r.success ? tokens[i] : null)
            .filter(Boolean);
          if (failedTokens.length > 0) {
            await db.collection("users").doc(userId).update({
              fcmWebTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens),
            });
            console.log(`[FCM] Removed ${failedTokens.length} invalid tokens for ${userId}`);
          }
        }
        await reminderRef.update({ status: "reminded", remindedAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (err) {
        console.error("[NOTIF][REMINDER] Error for", docSnap.id, err);
      }
    }
    return null;
  });

exports.sendQuestionnaireSecondReminder = functions
  .region(REGION)
  .pubsub.schedule("every 5 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    console.log("[FINAL_REMINDER] Running at", new Date().toISOString());
    const now = admin.firestore.Timestamp.now();
    const snap = await db
      .collection("pendingQuestionnaireReminders")
      .where("status", "==", "reminded")
      .where("secondReminderDueAt", "<=", now)
      .get();
    console.log("[FINAL_REMINDER] Eligible docs:", snap.docs.length);

    const userIds = [...new Set(snap.docs.map((d) => (d.data() || {}).userId).filter(Boolean))];
    const userRefs = userIds.map((uid) => db.collection("users").doc(uid));
    const userDocs = userRefs.length > 0 ? await db.getAll(...userRefs) : [];
    const userMap = new Map();
    userDocs.forEach((d) => { if (d.exists) userMap.set(d.id, d.data() || {}); });

    for (const docSnap of snap.docs) {
      const d = docSnap.data() || {};
      if (d.secondReminderSent === true) continue;
      const { userId, teamId, trainingId } = d;
      try {
        const responseSnap = await db
          .collection("teams").doc(teamId)
          .collection("trainings").doc(trainingId)
          .collection("responses").doc(userId)
          .get();
        if (responseSnap.exists && responseSnap.data() && responseSnap.data().status === "completed") {
          await docSnap.ref.update({ secondReminderSent: true, secondReminderSkipped: "completed" });
          continue;
        }
        if (!userMap.has(userId)) {
          await docSnap.ref.update({ secondReminderSent: true, secondReminderSkipped: "user_not_found" });
          continue;
        }
        const tokens = userMap.get(userId).fcmWebTokens || [];
        if (tokens.length === 0) {
          await docSnap.ref.update({ secondReminderSent: true, secondReminderSkipped: "no_tokens" });
          continue;
        }
        const finalUrl = "https://champion-track-pro.vercel.app/?screen=questionnaire&trainingId=" + trainingId + "&teamId=" + teamId;
        const message = {
          tokens,
          notification: {
            title: "Final reminder 🔒",
            body: "Don't let your session go untracked.",
          },
          data: {
            trainingId,
            teamId,
            url: finalUrl,
            tag: "questionnaire-" + trainingId,
          },
          android: {
            priority: "high",
            notification: {
              priority: "high",
              defaultSound: true,
              channelId: "ctpro-questionnaire",
              color: "#00D4FF",
            },
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default", badge: 1 } },
          },
          webpush: {
            headers: { Urgency: "high" },
            fcmOptions: { link: finalUrl },
            notification: {
              icon: "https://champion-track-pro.vercel.app/icons/icon-192-v2.png",
              badge: "https://champion-track-pro.vercel.app/icons/badge-72.png",
              tag: "questionnaire-" + trainingId,
              renotify: false,
              requireInteraction: false,
              silent: false,
              data: { url: finalUrl, trainingId, teamId },
              actions: [{ action: "open_questionnaire", title: "Tell us →" }],
            },
          },
        };
        const resp = await admin.messaging().sendEachForMulticast(message);
        if (resp.failureCount > 0) {
          const failedTokens = resp.responses
            .map((r, i) => (!r.success ? tokens[i] : null))
            .filter(Boolean);
          if (failedTokens.length > 0) {
            await db.collection("users").doc(userId).update({
              fcmWebTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens),
            });
            console.log("[FCM] Removed " + failedTokens.length + " invalid tokens for " + userId);
          }
        }
        await docSnap.ref.update({
          secondReminderSent: true,
          secondRemindedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error("[FINAL_REMINDER] Error for", docSnap.id, err);
      }
    }
    return null;
  });
exports.sendTestNotification = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Login required");
    }

    const uid = context.auth.uid;
    const { teamId, trainingId } = data;

    // Récupère les tokens FCM de l'utilisateur
    const userDoc = await db.collection("users").doc(uid).get();
    const tokens = (userDoc.data() || {}).fcmWebTokens || [];

    if (!tokens.length) {
      throw new functions.https.HttpsError("not-found", "no_token");
    }

    // Récupère le training test
    const trainingDoc = await db
      .collection("teams").doc(teamId)
      .collection("trainings").doc(trainingId)
      .get();

    if (!trainingDoc.exists) {
      throw new functions.https.HttpsError("not-found", "training_not_found");
    }

    // FIX 4: deep link URL format
    const clickAction = `https://champion-track-pro.vercel.app/?screen=questionnaire&trainingId=${trainingId}&teamId=${teamId}`;

    const message = {
      tokens,
      notification: {
        title: "🧪 Test Notification",
        body: "Tap to open your test questionnaire",
      },
      data: {
        trainingId,
        teamId,
        url: clickAction,
        tag: `questionnaire-${trainingId}`,
      },
      android: {
        priority: "high",
        notification: { priority: "high", defaultSound: true, channelId: "ctpro-questionnaire" },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default" } },
      },
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: { link: clickAction },
        notification: {
          icon: "https://champion-track-pro.vercel.app/icons/icon-192-v2.png",
          badge: "https://champion-track-pro.vercel.app/icons/badge-72.png",
          tag: `questionnaire-${trainingId}`,
          requireInteraction: false,
          silent: false,
          data: { url: clickAction, trainingId, teamId },
          actions: [{ action: "open_questionnaire", title: "Tell us →" }],
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // FIX 5: Nettoyer tous les tokens en échec via arrayRemove
    if (response.failureCount > 0) {
      const failedTokens = response.responses
        .map((r, i) => !r.success ? tokens[i] : null)
        .filter(Boolean);
      if (failedTokens.length > 0) {
        await db.collection("users").doc(uid).update({
          fcmWebTokens: admin.firestore.FieldValue.arrayRemove(...failedTokens),
        });
        console.log(`[FCM] Removed ${failedTokens.length} invalid tokens for ${uid}`);
      }
    }

    // Marque le training comme notifié
    await db
      .collection("teams").doc(teamId)
      .collection("trainings").doc(trainingId)
      .update({ questionnaireNotified: true });

    console.log(`[TEST NOTIF] Sent to ${response.successCount}/${tokens.length} tokens for uid=${uid}`);
    return { success: true, sent: response.successCount };
  });

/**
 * PHASE 5 — AI Data Lake
 * Triggered on user deletion: anonymizes all athlete responses and writes
 * to ai_training_dataset collection (Admin SDK only — client access: false).
 *
 * Logic:
 * 1. Query all teams/{teamId}/trainings/{trainingId}/responses/{uid}
 * 2. Strip uid, teamId, name, email - keep only wellness metrics
 * 3. Inject sport, position, ageAtLog (computed from birthYear if available)
 * 4. Write to ai_training_dataset via batch
 * 5. Hard-delete original response documents
 */
exports.anonymizePlayerDataForAI = functions
  .region(REGION)
  .auth.user().onDelete(async (user) => {
    const uid = user.uid;
    console.log("[AI_LAKE] User deleted, anonymizing data for uid:", uid);

    try {
      // Fetch user profile before it disappears (already deleted from Auth, but Firestore may still have it)
      let userProfile = {};
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
          userProfile = userDoc.data() || {};
        }
      } catch (e) {
        console.warn("[AI_LAKE] Could not fetch user profile:", e.message);
      }

      const position = userProfile.position || userProfile.poste || null;
      const birthYear = userProfile.birthYear || null;
      const sport = "basketball";

      // Find all teams (brute force — no index on uid across teams)
      const teamsSnap = await db.collection("teams").get();
      let totalAnonymized = 0;
      let totalDeleted = 0;

      for (const teamDoc of teamsSnap.docs) {
        const teamId = teamDoc.id;

        // Check if user was a member of this team
        const memberSnap = await db
          .collection("teams").doc(teamId)
          .collection("members").doc(uid)
          .get();

        if (!memberSnap.exists) continue;

        // Query all trainings in this team
        const trainingsSnap = await db
          .collection("teams").doc(teamId)
          .collection("trainings")
          .get();

        const batch = db.batch();
        let batchCount = 0;

        for (const trainingDoc of trainingsSnap.docs) {
          const trainingId = trainingDoc.id;
          const responseRef = db
            .collection("teams").doc(teamId)
            .collection("trainings").doc(trainingId)
            .collection("responses").doc(uid);

          const responseSnap = await responseRef.get();
          if (!responseSnap.exists) continue;

          const responseData = responseSnap.data() || {};
          if (responseData.isTest) {
            // Skip test responses
            batch.delete(responseRef);
            batchCount++;
            continue;
          }

          // Compute ageAtLog from birthYear and submittedAt
          let ageAtLog = null;
          if (birthYear && responseData.submittedAt) {
            const submittedYear = new Date(responseData.submittedAt.seconds * 1000).getFullYear();
            ageAtLog = submittedYear - birthYear;
          }

          // Build anonymized record (strip all PII)
          const anonymized = {
            // Context
            sport,
            position,
            ageAtLog,
            sessionType: responseData.sessionType || "conditioning",
            submittedAt: responseData.submittedAt || null,
            // V2 metrics (if present)
            ...(responseData.metrics ? { metrics: responseData.metrics } : {}),
            readinessScore: responseData.readinessScore || null,
            workloadAU: responseData.workloadAU || null,
            // Friction data (if present)
            ...(responseData.hasFriction ? {
              hasFriction: true,
              frictionType: responseData.frictionType || null,
              frictionFrequency: responseData.frictionFrequency || null,
              frictionImpact: responseData.frictionImpact || null,
              frictionDistraction: responseData.frictionDistraction || null,
            } : { hasFriction: false }),
            // V1 legacy fields (kept for historical analysis)
            ...(responseData.values ? { legacyValues: responseData.values } : {}),
            // Metadata (no PII)
            anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          // Write to ai_training_dataset
          const aiRef = db.collection("ai_training_dataset").doc();
          batch.set(aiRef, anonymized);

          // Hard-delete original response
          batch.delete(responseRef);

          batchCount++;
          totalAnonymized++;
          totalDeleted++;

          // Commit batch every 400 ops
          if (batchCount >= 400) {
            await batch.commit();
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        // Remove member doc
        await db.collection("teams").doc(teamId).collection("members").doc(uid).delete();
        console.log(`[AI_LAKE] Team ${teamId}: anonymized ${totalAnonymized}, deleted ${totalDeleted}`);
      }

      // Delete user Firestore doc
      try {
        await db.collection("users").doc(uid).delete();
        console.log("[AI_LAKE] User Firestore doc deleted for uid:", uid);
      } catch (e) {
        console.warn("[AI_LAKE] Could not delete user Firestore doc:", e.message);
      }

      console.log(`[AI_LAKE] Complete — anonymized ${totalAnonymized} responses for uid: ${uid}`);
      return null;
    } catch (err) {
      console.error("[AI_LAKE] Error anonymizing data for uid:", uid, err);
      return null;
    }
  });

/**
 * DEC-05 — lookupTeamByCode
 * Replaces direct client-side Firestore query on teams collection.
 * Returns only { teamId, teamName, role } — never the full team document.
 * Rate limit: 10 calls per 60s per uid (or per "anonymous" key if unauthenticated).
 */
const _rateLimitMap = new Map(); // in-memory, resets on cold start

exports.lookupTeamByCode = functions
  .region(REGION)
  .https.onCall(async (data, context) => {
    const { code } = data || {};
    const rawCode = validateString(code, 'code', 12);
    if (!/^[A-Z0-9a-z\-]{4,12}$/i.test(rawCode)) {
      throw new functions.https.HttpsError('invalid-argument', 'code must be 4-12 alphanumeric characters (with optional dash)');
    }

    const normalizedCode = rawCode.toUpperCase();

    // Rate limiting: 10 calls per 60s per caller key
    const callerKey = context.auth?.uid || "anonymous";
    const now = Date.now();
    const window = 60000; // 60s
    const maxCalls = 10;

    const entry = _rateLimitMap.get(callerKey) || { count: 0, windowStart: now };
    if (now - entry.windowStart > window) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    _rateLimitMap.set(callerKey, entry);

    if (entry.count > maxCalls) {
      throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Try again in a minute.");
    }

    const teamsRef = db.collection("teams");

    // 1. Try coachCode field
    const coachSnap = await teamsRef.where("coachCode", "==", normalizedCode).limit(1).get();
    if (!coachSnap.empty) {
      const teamDoc = coachSnap.docs[0];
      return { teamId: teamDoc.id, teamName: teamDoc.data().name || "", role: "coach" };
    }

    // 2. Try codes.athlete field
    const athleteSnap = await teamsRef.where("codes.athlete", "==", normalizedCode).limit(1).get();
    if (!athleteSnap.empty) {
      const teamDoc = athleteSnap.docs[0];
      return { teamId: teamDoc.id, teamName: teamDoc.data().name || "", role: "athlete" };
    }

    // 3. Try codes.coach field (legacy)
    const coachLegacySnap = await teamsRef.where("codes.coach", "==", normalizedCode).limit(1).get();
    if (!coachLegacySnap.empty) {
      const teamDoc = coachLegacySnap.docs[0];
      return { teamId: teamDoc.id, teamName: teamDoc.data().name || "", role: "coach" };
    }

    // 4. Try joinCodeAthlete field (JoinTeam.js legacy)
    const joinSnap = await teamsRef.where("joinCodeAthlete", "==", normalizedCode).limit(1).get();
    if (!joinSnap.empty) {
      const teamDoc = joinSnap.docs[0];
      return { teamId: teamDoc.id, teamName: teamDoc.data().name || "", role: "athlete" };
    }

    // 5. Try inviteCode with -C / -A suffix (new format: XK7B2P-C or XK7B2P-A)
    const suffixMatch = normalizedCode.match(/^(.+)-([CA])$/);
    if (suffixMatch) {
      const baseCode = suffixMatch[1];
      const suffix = suffixMatch[2];
      const role = suffix === "C" ? "coach" : "athlete";
      const inviteSnap = await teamsRef.where("inviteCode", "==", baseCode).limit(1).get();
      if (!inviteSnap.empty) {
        const teamDoc = inviteSnap.docs[0];
        return { teamId: teamDoc.id, teamName: teamDoc.data().name || "", role };
      }
    }

    throw new functions.https.HttpsError("not-found", "Invalid code. Check the code provided by your team.");
  });

/**
 * DEBT-03 — cleanupOldReminders
 * Weekly cleanup of pendingQuestionnaireReminders where status != "pending"
 * and dueAt < 30 days ago. Deletes in batches of 500.
 */
exports.cleanupOldReminders = functions
  .region(REGION)
  .pubsub.schedule("every 168 hours")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const cutoff = admin.firestore.Timestamp.fromMillis(now - thirtyDaysMs);

    console.log("[CLEANUP] Running reminder cleanup, cutoff:", new Date(now - thirtyDaysMs).toISOString());

    // Query only by dueAt to avoid compound inequality (status != + dueAt <)
    const snap = await db
      .collection("pendingQuestionnaireReminders")
      .where("dueAt", "<", cutoff)
      .limit(500)
      .get();

    if (snap.empty) {
      console.log("[CLEANUP] No old reminders to delete");
      return null;
    }

    // Filter client-side: skip docs still pending (edge case — shouldn't exist after 30d)
    const toDelete = snap.docs.filter((d) => d.data().status !== "pending");

    if (toDelete.length === 0) {
      console.log("[CLEANUP] All old docs still pending — skipping");
      return null;
    }

    const batch = db.batch();
    toDelete.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[CLEANUP] Deleted ${toDelete.length} old reminders`);
    return null;
  });

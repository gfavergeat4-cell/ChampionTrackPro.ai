// Sync ICS -> sessions. Événements simples + récurrents (RRULE DAILY/WEEKLY,
// INTERVAL, BYDAY, UNTIL, COUNT, EXDATE). TZID respecté via VTIMEZONE.
// Zéro dépendance externe.
import { createClient } from "jsr:@supabase/supabase-js@2";

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function parseIcsDate(v: string): Date | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?Z?$/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return isNaN(dt.getTime()) ? null : dt;
}

// ── Timezone support (parsed from VTIMEZONE blocks) ─────────────────
interface TzRule { offsetMin: number; month: number; wday: number; weekNum: number; atH: number; atM: number; }
interface TzDef { standard: TzRule | null; daylight: TzRule | null; }

const WDAYS: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseOffset(s: string): number {
  const sign = s.startsWith("-") ? -1 : 1;
  return sign * (parseInt(s.slice(1, 3), 10) * 60 + parseInt(s.slice(3, 5), 10));
}

function parseTzBlocks(text: string): Map<string, TzDef> {
  const map = new Map<string, TzDef>();
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  for (const raw of unfolded.split("BEGIN:VTIMEZONE").slice(1)) {
    const block = raw.split("END:VTIMEZONE")[0];
    const tzidM = block.match(/^TZID:(.*)$/m);
    if (!tzidM) continue;
    const tzid = tzidM[1].trim();
    const def: TzDef = { standard: null, daylight: null };
    for (const kind of ["STANDARD", "DAYLIGHT"] as const) {
      const sub = block.match(new RegExp(`BEGIN:${kind}([\\s\\S]*?)END:${kind}`));
      if (!sub) continue;
      const b = sub[1];
      const offsetTo = b.match(/^TZOFFSETTO:(.*)$/m)?.[1]?.trim();
      if (!offsetTo) continue;
      const dtm = b.match(/^DTSTART:.*?T(\d{2})(\d{2})/m);
      const atH = dtm ? parseInt(dtm[1], 10) : 0;
      const atM = dtm ? parseInt(dtm[2], 10) : 0;
      let month = 1, wday = 0, weekNum = 1;
      const rrule = b.match(/^RRULE:(.*)$/m)?.[1]?.trim();
      if (rrule) {
        const pp: Record<string, string> = {};
        for (const p of rrule.split(";")) { const [k, v] = p.split("="); if (k) pp[k] = v; }
        if (pp.BYMONTH) month = parseInt(pp.BYMONTH, 10);
        if (pp.BYDAY) {
          const bdm = pp.BYDAY.match(/(-?\d)?(\w{2})/);
          if (bdm) { weekNum = bdm[1] ? parseInt(bdm[1], 10) : 1; wday = WDAYS[bdm[2]] ?? 0; }
        }
      }
      const rule: TzRule = { offsetMin: parseOffset(offsetTo), month, wday, weekNum, atH, atM };
      if (kind === "STANDARD") def.standard = rule; else def.daylight = rule;
    }
    map.set(tzid, def);
  }
  return map;
}

function nthWeekdayInMonth(year: number, month: number, wday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1));
    let day = 1 + ((wday - first.getUTCDay() + 7) % 7);
    return day + (n - 1) * 7;
  }
  const last = new Date(Date.UTC(year, month, 0));
  let day = last.getUTCDate() - ((last.getUTCDay() - wday + 7) % 7);
  if (n < -1) day += (n + 1) * 7;
  return day;
}

function getOffsetMin(localAsUtc: Date, tz: TzDef): number {
  if (!tz.daylight || !tz.standard) return (tz.standard || tz.daylight)!.offsetMin;
  const year = localAsUtc.getUTCFullYear();
  const dstDay = nthWeekdayInMonth(year, tz.daylight.month, tz.daylight.wday, tz.daylight.weekNum);
  const stdDay = nthWeekdayInMonth(year, tz.standard.month, tz.standard.wday, tz.standard.weekNum);
  const dstTrans = Date.UTC(year, tz.daylight.month - 1, dstDay, tz.daylight.atH, tz.daylight.atM);
  const stdTrans = Date.UTC(year, tz.standard.month - 1, stdDay, tz.standard.atH, tz.standard.atM);
  const t = localAsUtc.getTime();
  if (dstTrans < stdTrans) return (t >= dstTrans && t < stdTrans) ? tz.daylight.offsetMin : tz.standard.offsetMin;
  return (t >= dstTrans || t < stdTrans) ? tz.daylight.offsetMin : tz.standard.offsetMin;
}

function localToUtc(d: Date, tz: TzDef | null): Date {
  if (!tz) return d;
  return new Date(d.getTime() - getOffsetMin(d, tz) * 60000);
}

// ── Session type ────────────────────────────────────────────────
function deriveSessionType(title: string, desc: string): string {
  const c = `${title} ${desc}`.toLowerCase();
  if (/\b(game|match|vs\.?|@)\b/.test(c)) return "game";
  if (/\bscrimmage\b/.test(c)) return "scrimmage";
  if (/\b(conditioning|lift|weights|strength)\b/.test(c)) return "conditioning";
  return "practice";
}

const DAY = 86400000;
const DAYMAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expandRrule(rrule: string, dtstart: Date, wStart: number, wEnd: number): Date[] {
  const p: Record<string, string> = {};
  for (const part of rrule.split(";")) { const [k, v] = part.split("="); if (k) p[k] = v; }
  const freq = p.FREQ;
  const interval = Math.max(1, parseInt(p.INTERVAL ?? "1", 10));
  const until = p.UNTIL ? parseIcsDate(p.UNTIL) : null;
  const count = p.COUNT ? parseInt(p.COUNT, 10) : null;
  const out: Date[] = [];

  if (freq === "DAILY") {
    let d = new Date(dtstart), n = 0;
    while (n < 2000) {
      if (until && d.getTime() > until.getTime()) break;
      if (count && n >= count) break;
      if (d.getTime() > wEnd) break;
      if (d.getTime() >= wStart) out.push(new Date(d));
      n++;
      d = new Date(d.getTime() + interval * DAY);
    }
  } else if (freq === "WEEKLY") {
    const days = p.BYDAY
      ? p.BYDAY.split(",").map((b) => DAYMAP[b.slice(-2)]).filter((x) => x !== undefined)
      : [dtstart.getUTCDay()];
    const anchorWeek = Math.floor((dtstart.getTime() - 4 * DAY) / (7 * DAY)); // semaines ancrées lundi
    let d = new Date(dtstart), n = 0, guard = 0;
    while (guard++ < 40000) {
      if (until && d.getTime() > until.getTime()) break;
      if (count && n >= count) break;
      if (d.getTime() > wEnd) break;
      const w = Math.floor((d.getTime() - 4 * DAY) / (7 * DAY));
      if (days.includes(d.getUTCDay()) && (w - anchorWeek) % interval === 0) {
        n++;
        if (d.getTime() >= wStart) out.push(new Date(d));
      }
      d = new Date(d.getTime() + DAY);
    }
  } else {
    // MONTHLY/YEARLY : cadence simple depuis dtstart
    let d = new Date(dtstart), n = 0;
    while (n < 500) {
      if (until && d.getTime() > until.getTime()) break;
      if (count && n >= count) break;
      if (d.getTime() > wEnd) break;
      if (d.getTime() >= wStart) out.push(new Date(d));
      n++;
      const nd = new Date(d);
      if (freq === "MONTHLY") nd.setUTCMonth(nd.getUTCMonth() + interval);
      else nd.setUTCFullYear(nd.getUTCFullYear() + interval);
      d = nd;
    }
  }
  return out;
}

function parseIcs(text: string, wStart: number, wEnd: number) {
  const out: any[] = [];
  const tzMap = parseTzBlocks(text);

  // Calendar-level fallback timezone (Google X-WR-TIMEZONE)
  const calTzId = text.match(/^X-WR-TIMEZONE:(.*)$/m)?.[1]?.trim();
  const calTz = calTzId ? tzMap.get(calTzId) ?? null : null;

  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  for (const raw of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = raw.split("END:VEVENT")[0];

    // Extract value + optional TZID from a property
    const getP = (key: string): { value: string; tzid: string | null } => {
      const mm = body.match(new RegExp(`^${key}(?:;([^:\\n]*))?:(.*)$`, "m"));
      if (!mm) return { value: "", tzid: null };
      const params = mm[1] || "";
      const tzm = params.match(/TZID=([^;]+)/);
      return { value: mm[2].trim(), tzid: tzm ? tzm[1] : null };
    };
    const get = (key: string) => getP(key).value;

    const uid = get("UID");
    const sp = getP("DTSTART");
    const ep = getP("DTEND");
    const startLocal = parseIcsDate(sp.value);
    let endLocal = parseIcsDate(ep.value);
    const title = get("SUMMARY") || "Training";
    const desc = get("DESCRIPTION");
    const cancelled = get("STATUS") === "CANCELLED";
    if (!startLocal) continue;
    if (!endLocal || endLocal.getTime() <= startLocal.getTime()) endLocal = new Date(startLocal.getTime() + 3600000);
    const durationMs = endLocal.getTime() - startLocal.getTime();

    // Resolve timezone: explicit TZID > calendar-level > null (UTC)
    const isUtc = sp.value.endsWith("Z");
    const tz = isUtc ? null : (sp.tzid ? tzMap.get(sp.tzid) ?? calTz : calTz);

    const rruleLine = body.match(/^RRULE:(.*)$/m)?.[1];
    if (rruleLine) {
      // EXDATE in local time (same tz as DTSTART)
      const ex = new Set<number>();
      for (const exm of body.matchAll(/^EXDATE(?:;[^:\n]*)?:(.*)$/gm)) {
        for (const v of exm[1].split(",")) {
          const d = parseIcsDate(v.trim());
          if (d) ex.add(d.getTime()); // compare in local space
        }
      }
      // Expand in local time, then convert each occurrence to UTC
      for (const dLocal of expandRrule(rruleLine, startLocal, wStart, wEnd)) {
        if (ex.has(dLocal.getTime())) continue;
        const dUtc = localToUtc(dLocal, tz);
        const endUtc = localToUtc(new Date(dLocal.getTime() + durationMs), tz);
        out.push({ uid: `${uid}_${dLocal.getTime()}`, start: dUtc, end: endUtc, title, desc, cancelled });
      }
      continue;
    }
    // Single event: convert to UTC, check window
    const startUtc = localToUtc(startLocal, tz);
    const endUtc = localToUtc(endLocal, tz);
    if (startUtc.getTime() < wStart || startUtc.getTime() > wEnd) continue;
    out.push({ uid, start: startUtc, end: endUtc, title, desc, cancelled });
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const reqUrl = new URL(req.url);
  const dryRun = reqUrl.searchParams.get("dry_run") === "1";

  const { data: teams, error: dbErr } = await supa.from("teams")
    .select("id, name, ics_url").not("ics_url", "is", null);

  if (dbErr) return Response.json({ ok: false, error: dbErr.message });

  if (dryRun) {
    return Response.json({
      ok: true, dry_run: true, teams_found: teams?.length ?? 0,
      teams: (teams ?? []).map((t) => ({
        id: t.id, name: t.name,
        url_host: t.ics_url ? new URL(t.ics_url).host : null,
        url_length: t.ics_url?.length,
      })),
    });
  }

  let total = 0, errors = 0, fetched = 0;
  const wStart = Date.now() - 30 * DAY;
  const wEnd = Date.now() + 180 * DAY;
  const diag: Record<string, unknown>[] = [];

  for (const t of teams ?? []) {
    const td: Record<string, unknown> = { team_id: t.id };
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(t.ics_url, { signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }
      td.http_status = res.status;
      td.content_type = res.headers.get("content-type") ?? "unknown";
      if (!res.ok) { errors++; td.error = `http_${res.status}`; diag.push(td); continue; }
      const text = await res.text();
      fetched += text.length;
      td.bytes = text.length;
      td.is_ics = text.trimStart().startsWith("BEGIN:VCALENDAR");

      const veventCount = (text.match(/BEGIN:VEVENT/g) ?? []).length;
      td.vevent_count = veventCount;

      const events = parseIcs(text, wStart, wEnd);
      td.events_in_window = events.length;
      console.log("[ICS] team", t.id, "bytes:", text.length, "vevents:", veventCount, "in window:", events.length);

      // Batch upsert (tranches de 200 pour rester sous les limites Postgres)
      const BATCH = 200;
      const rows = events.map((ev) => ({
        team_id: t.id,
        title: ev.title,
        session_type: deriveSessionType(ev.title, ev.desc),
        start_utc: ev.start.toISOString(),
        end_utc: ev.end.toISOString(),
        ics_uid: ev.uid || null,
        cancelled: ev.cancelled,
      }));
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const { error, count } = await supa.from("sessions")
          .upsert(chunk, { onConflict: "team_id,ics_uid,start_utc", count: "exact" });
        if (error) { console.error("[ICS] upsert batch:", error.message); errors++; }
        else total += count ?? chunk.length;
      }
    } catch (e) {
      console.error("[ICS] team", t.id, String(e));
      td.error = String(e);
      errors++;
    }
    diag.push(td);
  }
  return Response.json({ ok: true, upserted: total, errors, ics_bytes: fetched, teams_found: teams?.length ?? 0, diag });
});

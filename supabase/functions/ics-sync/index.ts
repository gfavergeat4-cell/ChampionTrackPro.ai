// Sync ICS -> sessions. Événements simples + récurrents (RRULE DAILY/WEEKLY,
// INTERVAL, BYDAY, UNTIL, COUNT, EXDATE). Zéro dépendance externe.
// Limitation connue : TZID traité comme UTC (fix propre prévu avec E2).
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
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  for (const raw of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = raw.split("END:VEVENT")[0];
    const get = (key: string) => {
      const mm = body.match(new RegExp(`^${key}(?:;[^:\\n]*)?:(.*)$`, "m"));
      return mm ? mm[1].trim() : "";
    };
    const uid = get("UID");
    const start = parseIcsDate(get("DTSTART"));
    let end = parseIcsDate(get("DTEND"));
    const title = get("SUMMARY") || "Training";
    const desc = get("DESCRIPTION");
    const cancelled = get("STATUS") === "CANCELLED";
    if (!start) continue;
    if (!end || end.getTime() <= start.getTime()) end = new Date(start.getTime() + 3600000);
    const durationMs = end.getTime() - start.getTime();

    const rruleLine = body.match(/^RRULE:(.*)$/m)?.[1];
    if (rruleLine) {
      const ex = new Set<number>();
      for (const exm of body.matchAll(/^EXDATE(?:;[^:\n]*)?:(.*)$/gm)) {
        for (const v of exm[1].split(",")) {
          const d = parseIcsDate(v.trim());
          if (d) ex.add(d.getTime());
        }
      }
      for (const d of expandRrule(rruleLine, start, wStart, wEnd)) {
        if (ex.has(d.getTime())) continue;
        out.push({ uid: `${uid}_${d.getTime()}`, start: d, end: new Date(d.getTime() + durationMs), title, desc, cancelled });
      }
      continue;
    }
    if (start.getTime() < wStart || start.getTime() > wEnd) continue;
    out.push({ uid, start, end, title, desc, cancelled });
  }
  return out;
}

Deno.serve(async () => {
  const { data: teams } = await supa.from("teams")
    .select("id, ics_url").not("ics_url", "is", null);
  let total = 0, errors = 0, fetched = 0;
  const wStart = Date.now() - 30 * DAY;
  const wEnd = Date.now() + 180 * DAY;

  for (const t of teams ?? []) {
    try {
      const res = await fetch(t.ics_url);
      if (!res.ok) { console.error("[ICS] fetch", t.id, res.status); errors++; continue; }
      const text = await res.text();
      fetched += text.length;
      const events = parseIcs(text, wStart, wEnd);
      console.log("[ICS] team", t.id, "bytes:", text.length, "events retenus:", events.length);
      for (const ev of events) {
        const { error } = await supa.from("sessions").upsert({
          team_id: t.id,
          title: ev.title,
          session_type: deriveSessionType(ev.title, ev.desc),
          start_utc: ev.start.toISOString(),
          end_utc: ev.end.toISOString(),
          ics_uid: ev.uid || null,
          cancelled: ev.cancelled,
        }, { onConflict: "team_id,ics_uid,start_utc" });
        if (error) { console.error("[ICS] upsert:", error.message); errors++; }
        else total++;
      }
    } catch (e) {
      console.error("[ICS] team", t.id, String(e));
      errors++;
    }
  }
  return Response.json({ ok: true, upserted: total, errors, ics_bytes: fetched });
});

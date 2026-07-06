// ÉTAPE M5 — Transforme le dump Firestore et charge dans Postgres.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node transform-load.mjs
// Vérifications d'intégrité en fin de script (comptes source vs cible).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dump = JSON.parse(readFileSync("export/firestore-dump.json", "utf8"));
const ts = (v) => v?._seconds ? new Date(v._seconds * 1000).toISOString() : (v ?? null);

// 1 organisation racine pour l'existant
const { data: org } = await supa.from("organizations")
  .insert({ name: "ChampionTrackPro (migration)" }).select().single();

const teamMap = {};
for (const t of dump.teams) {
  const { data } = await supa.from("teams").insert({
    organization_id: org.id, name: t.name ?? t.id, sport: t.sport ?? "basketball",
    ics_url: t.icsUrl ?? null, invite_code: t.code ?? null,
  }).select().single();
  teamMap[t.id] = data.id;
}
// NOTE users : créer les comptes via supabase.auth.admin.createUser (email),
// puis mapper uid Firebase -> uuid Supabase ici :
const userMap = {}; // { firebaseUid: supabaseUuid } — à remplir à l'exécution

for (const m of dump.members) {
  const uid = userMap[m.id]; if (!uid) continue;
  await supa.from("memberships").insert({
    team_id: teamMap[m.teamId], user_id: uid, role: m.role ?? "athlete",
    pseudonym: null, // généré post-migration : P-01..P-n par équipe
  });
}
const sessMap = {};
for (const tr of dump.trainings) {
  const { data } = await supa.from("sessions").insert({
    team_id: teamMap[tr.teamId], title: tr.title ?? tr.summary ?? null,
    session_type: tr.sessionType ?? "practice",
    start_utc: ts(tr.startUtc) ?? ts(tr.start), end_utc: ts(tr.endUtc) ?? ts(tr.end),
    ics_uid: tr.uid ?? null, cancelled: !!tr.cancelled,
  }).select().single();
  sessMap[`${tr.teamId}/${tr.id}`] = data.id;
}
let loaded = 0;
for (const r of dump.responses) {
  const uid = userMap[r.id]; const sid = sessMap[`${r.teamId}/${r.trainingId}`];
  if (!uid || !sid) continue;
  await supa.from("responses").insert({
    team_id: teamMap[r.teamId], session_id: sid, user_id: uid,
    questionnaire_id: r.questionnaireId ?? null,
    metrics: r.metrics ?? {}, has_friction: !!r.hasFriction,
    friction_type: r.frictionType ?? null, worry_level: r.worryLevel ?? null,
    worry_flag: !!r.worryFlag, is_test: !!r.isTest, submitted_at: ts(r.submittedAt),
  });
  loaded++;
}
// Intégrité (M8 : run parallèle — comparer avant de couper Firestore)
console.log({ src: dump.responses.length, loaded });

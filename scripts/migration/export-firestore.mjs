// ÉTAPE M4 — Export Firestore -> JSON (volume actuel faible : trivial)
// Usage: GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json node export-firestore.mjs
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync, mkdirSync } from "node:fs";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
mkdirSync("export", { recursive: true });

const dump = { users: [], teams: [], members: [], trainings: [], responses: [], questionnaires: [] };

for (const u of (await db.collection("users").get()).docs)
  dump.users.push({ id: u.id, ...u.data() });
for (const q of (await db.collection("questionnaires").get()).docs)
  dump.questionnaires.push({ id: q.id, ...q.data() });

for (const t of (await db.collection("teams").get()).docs) {
  dump.teams.push({ id: t.id, ...t.data() });
  for (const m of (await t.ref.collection("members").get()).docs)
    dump.members.push({ teamId: t.id, id: m.id, ...m.data() });
  for (const tr of (await t.ref.collection("trainings").get()).docs) {
    dump.trainings.push({ teamId: t.id, id: tr.id, ...tr.data() });
    for (const r of (await tr.ref.collection("responses").get()).docs)
      dump.responses.push({ teamId: t.id, trainingId: tr.id, id: r.id, ...r.data() });
  }
}
writeFileSync("export/firestore-dump.json", JSON.stringify(dump, null, 2));
console.log(Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])));

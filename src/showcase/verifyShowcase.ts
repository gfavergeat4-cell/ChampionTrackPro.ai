// verifyShowcase.ts — Contrôle de cohérence du jeu de démonstration.
//
// Pourquoi ce fichier existe : les données du showcase sont écrites à la main,
// et une capture vidéo diffusée publiquement ne doit pas contenir une
// incohérence (un badge qui ne correspond pas à l'écart affiché, une courbe
// qui sort du cadre, un pourcentage faux). Ces 21 assertions vérifient que
// ce qui est AFFICHÉ correspond à ce qui est CALCULÉ.
//
// Lancer :
//   npx esbuild src/showcase/verifyShowcase.ts --bundle --platform=node \
//     --format=cjs --outfile=tmp_verify.js && node tmp_verify.js
//
// À relancer après toute modification de showcaseData.ts.

import { ROSTER, TEAM, FOCUS, FOCUS_SERIES, FOCUS_BASELINE, BAND } from "./showcaseData";
import { statusFromDeviation } from "./showcaseTheme";

let fail = 0;
const ok = (c: boolean, m: string) => {
  console.log((c ? "  OK   " : "  FAIL ") + m);
  if (!c) fail++;
};

// 1. Seuils de statut — bornes exactes de la bande DAR (±10)
ok(statusFromDeviation(0) === "READY", "dev 0 -> READY (dans sa bande)");
ok(statusFromDeviation(-10) === "READY", "dev -10 -> READY (bord de bande inclus)");
ok(statusFromDeviation(-10.1) === "WATCH", "dev -10.1 -> WATCH (sorti par le bas)");
ok(statusFromDeviation(-19.9) === "WATCH", "dev -19.9 -> WATCH");
ok(statusFromDeviation(-20) === "RECOVER", "dev -20 -> RECOVER");
ok(statusFromDeviation(+30) === "READY", "dev +30 -> READY (au-dessus reste READY)");

// 2. Cohérence du roster
ok(ROSTER.length === 12, `roster = 12 (${ROSTER.length})`);
ok(new Set(ROSTER.map((a) => a.name)).size === 12, "aucun doublon de nom");
const onePager = ["A. Carter", "T. Williams", "M. Johnson", "S. Davis", "R. Thompson"];
ok(onePager.every((n) => ROSTER.some((a) => a.name === n)),
   "les 5 noms des one-pagers sont presents");
ok(ROSTER.every((a) => a.status === statusFromDeviation(a.deviation)),
   "statut affiche == statut recalcule, pour tous");
ok(ROSTER.every((a) => a.score >= 0 && a.score <= 100), "scores dans 0-100");

// 3. Distribution crédible devant un coach
const c: Record<string, number> = { READY: 0, WATCH: 0, RECOVER: 0 };
ROSTER.forEach((a) => { c[a.status]++; });
console.log(`  info  distribution READY=${c.READY} WATCH=${c.WATCH} RECOVER=${c.RECOVER}`);
ok(c.READY + c.WATCH + c.RECOVER === 12, "somme des statuts = 12");
ok(c.READY > c.WATCH + c.RECOVER, "majorite dans sa norme (un roster tout en alerte serait faux)");
ok(TEAM.readyPct === Math.round((c.READY / 12) * 100), `readyPct coherent (${TEAM.readyPct}%)`);

// 4. Scène 3 — la courbe doit raconter la même chose que les chiffres
ok(FOCUS_SERIES.length === FOCUS_BASELINE.length, "serie et baseline de meme longueur");
ok(FOCUS_SERIES[FOCUS_SERIES.length - 1] === FOCUS.score, "dernier point == score du jour");
const lastDev = FOCUS_SERIES[FOCUS_SERIES.length - 1] - FOCUS_BASELINE[FOCUS_BASELINE.length - 1];
ok(Math.abs(lastDev - FOCUS.deviation) <= 1,
   `ecart trace (${lastDev}) == ecart annonce (${FOCUS.deviation})`);
ok(statusFromDeviation(lastDev) === "RECOVER", "le point du jour est bien sous la bande");
ok(FOCUS.axesDev.phy < FOCUS.axesDev.men - 10,
   "divergence lisible : le physique decroche nettement plus que le mental");

// 5. Bornes du graphe — rien ne doit sortir du viewBox
const Y_MIN = 35, Y_MAX = 100;
const all = [
  ...FOCUS_SERIES,
  ...FOCUS_BASELINE.map((b) => b + BAND),
  ...FOCUS_BASELINE.map((b) => b - BAND),
];
ok(Math.min(...all) >= Y_MIN && Math.max(...all) <= Y_MAX,
   `courbe+bande dans [${Y_MIN},${Y_MAX}] (min=${Math.min(...all)} max=${Math.max(...all)})`);

console.log(fail === 0 ? "\nTOUT PASSE" : `\n${fail} ECHEC(S)`);
if (typeof process !== "undefined") process.exit(fail === 0 ? 0 : 1);

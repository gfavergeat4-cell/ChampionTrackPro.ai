import { ROSTER, TEAM, FOCUS, FOCUS_SERIES, FOCUS_BASELINE, BAND } from "./src/showcase/showcaseData";
import { statusFromDeviation } from "./src/showcase/showcaseTheme";

let fail = 0;
const ok = (c: boolean, m: string) => { console.log((c ? "  OK   " : "  FAIL ") + m); if (!c) fail++; };

// 1. Seuils de statut : bornes exactes de la bande DAR
ok(statusFromDeviation(0) === "READY",     "dev 0 -> READY (dans sa bande)");
ok(statusFromDeviation(-10) === "READY",   "dev -10 -> READY (bord de bande inclus)");
ok(statusFromDeviation(-10.1) === "WATCH", "dev -10.1 -> WATCH (sorti par le bas)");
ok(statusFromDeviation(-19.9) === "WATCH", "dev -19.9 -> WATCH");
ok(statusFromDeviation(-20) === "RECOVER", "dev -20 -> RECOVER");
ok(statusFromDeviation(+30) === "READY",   "dev +30 -> READY (au-dessus reste READY)");

// 2. Cohérence du roster
ok(ROSTER.length === 12, `roster = 12 (${ROSTER.length})`);
ok(new Set(ROSTER.map(a => a.name)).size === 12, "aucun doublon de nom");
const onePager = ["A. Carter","T. Williams","M. Johnson","S. Davis","R. Thompson"];
ok(onePager.every(n => ROSTER.some(a => a.name === n)), "les 5 noms des one-pagers sont présents");
ok(ROSTER.every(a => a.status === statusFromDeviation(a.deviation)), "statut == statut recalculé pour tous");
ok(ROSTER.every(a => a.score >= 0 && a.score <= 100), "scores dans 0-100");

// 3. Distribution crédible
const c = { READY:0, WATCH:0, RECOVER:0 } as any;
ROSTER.forEach(a => c[a.status]++);
console.log(`  info  distribution READY=${c.READY} WATCH=${c.WATCH} RECOVER=${c.RECOVER}`);
ok(c.READY + c.WATCH + c.RECOVER === 12, "somme des statuts = 12");
ok(c.READY > c.WATCH + c.RECOVER, "majorite dans sa norme (credible)");
ok(TEAM.readyPct === Math.round(c.READY / 12 * 100), `readyPct coherent (${TEAM.readyPct}%)`);

// 4. Scene 3 : series et baseline alignees
ok(FOCUS_SERIES.length === FOCUS_BASELINE.length, "serie et baseline de meme longueur");
ok(FOCUS_SERIES[FOCUS_SERIES.length-1] === FOCUS.score, "dernier point == score du jour");
const lastDev = FOCUS_SERIES[FOCUS_SERIES.length-1] - FOCUS_BASELINE[FOCUS_BASELINE.length-1];
ok(Math.abs(lastDev - FOCUS.deviation) <= 1, `ecart trace (${lastDev}) == ecart annonce (${FOCUS.deviation})`);
ok(statusFromDeviation(lastDev) === "RECOVER", "le point du jour est bien hors bande, sous la bande");
// La divergence est le sujet de la scene : physique doit decrocher plus que mental
ok(FOCUS.axesDev.phy < FOCUS.axesDev.men - 10, "divergence lisible : physique bien sous le mental");

// 5. Bornes du graphe : tout doit tenir dans le viewBox
const Y_MIN=35, Y_MAX=100;
const all = [...FOCUS_SERIES, ...FOCUS_BASELINE.map(b=>b+BAND), ...FOCUS_BASELINE.map(b=>b-BAND)];
ok(Math.min(...all) >= Y_MIN && Math.max(...all) <= Y_MAX,
   `courbe+bande dans [${Y_MIN},${Y_MAX}] (min=${Math.min(...all)} max=${Math.max(...all)})`);

console.log(fail === 0 ? "\nTOUT PASSE" : `\n${fail} ECHEC(S)`);
process.exit(fail === 0 ? 0 : 1);

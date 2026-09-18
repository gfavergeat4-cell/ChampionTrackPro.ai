// showcaseData.ts — Jeu de démonstration FIGÉ.
//
// Aucune requête réseau, aucun appel Supabase, aucun aléatoire : le mode
// showcase doit rendre EXACTEMENT la même image à chaque relecture, sinon
// deux prises de capture vidéo ne se raccordent pas au montage.
//
// Les cinq premiers noms sont ceux déjà montrés aux coachs dans les
// one-pagers (A. Carter, T. Williams, M. Johnson, S. Davis, R. Thompson) :
// un coach qui a reçu le PDF puis voit la vidéo doit reconnaître le même
// produit. Les sept suivants complètent un roster crédible de 12.

import { statusFromDeviation, type ScStatus } from "./showcaseTheme";

export interface ScAthlete {
  id: string;
  name: string;
  pos: string;
  /** Score de forme du jour, 0-100. */
  score: number;
  /** Écart à SA baseline personnelle, en points. C'est lui qui fait le statut. */
  deviation: number;
  status: ScStatus;
  /** Sous-scores par axe et leur écart individuel à la baseline. */
  axes: { phy: number; tec: number; men: number };
  axesDev: { phy: number; tec: number; men: number };
}

function mk(
  id: string, name: string, pos: string, score: number, deviation: number,
  axes: { phy: number; tec: number; men: number },
  axesDev: { phy: number; tec: number; men: number },
): ScAthlete {
  return { id, name, pos, score, deviation, status: statusFromDeviation(deviation), axes, axesDev };
}

// Distribution volontairement réaliste : la majorité dans sa norme, deux
// sorties de bande, une seule franchement basse. Un roster où tout le monde
// est en alerte ne serait pas crédible devant un coach.
export const ROSTER: ScAthlete[] = [
  mk("a1",  "A. Carter",    "G",  92, +11, { phy: 90, tec: 93, men: 94 }, { phy: +9,  tec: +12, men: +13 }),
  mk("a2",  "T. Williams",  "F",  68,  -4, { phy: 64, tec: 71, men: 70 }, { phy: -8,  tec: -2,  men: -1 }),
  mk("a3",  "M. Johnson",   "C",  54, -23, { phy: 47, tec: 58, men: 61 }, { phy: -31, tec: -18, men: -12 }),
  mk("a4",  "S. Davis",     "G",  81,  +3, { phy: 83, tec: 80, men: 79 }, { phy: +5,  tec: +2,  men: +1 }),
  mk("a5",  "R. Thompson",  "F",  63, -14, { phy: 58, tec: 66, men: 67 }, { phy: -19, tec: -11, men: -9 }),
  mk("a6",  "J. Brooks",    "G",  88,  +6, { phy: 87, tec: 89, men: 90 }, { phy: +4,  tec: +7,  men: +8 }),
  mk("a7",  "D. Reyes",     "F",  76,  -2, { phy: 74, tec: 78, men: 77 }, { phy: -4,  tec: -1,  men: 0 }),
  mk("a8",  "K. Mitchell",  "C",  71,  -7, { phy: 68, tec: 73, men: 74 }, { phy: -11, tec: -5,  men: -3 }),
  mk("a9",  "A. Okafor",    "F",  85,  +2, { phy: 86, tec: 84, men: 85 }, { phy: +3,  tec: +1,  men: +2 }),
  mk("a10", "L. Barrett",   "G",  79,  -1, { phy: 77, tec: 81, men: 80 }, { phy: -3,  tec: 0,   men: +1 }),
  mk("a11", "C. Nguyen",    "G",  66, -12, { phy: 61, tec: 69, men: 70 }, { phy: -17, tec: -9,  men: -7 }),
  mk("a12", "E. Vance",     "C",  83,  +4, { phy: 84, tec: 82, men: 83 }, { phy: +6,  tec: +3,  men: +2 }),
];

export const TEAM = {
  name: "Team Session",
  date: "Thursday, March 6",
  /** Part du roster dans sa bande habituelle ou au-dessus. */
  readyPct: Math.round((ROSTER.filter((a) => a.status === "READY").length / ROSTER.length) * 100),
  responded: 12,
  total: 12,
};

// ── Scène 3 : le joueur qu'on ouvre en détail ──────────────────────────
// M. Johnson : le seul RECOVER. Son intérêt narratif est la DIVERGENCE —
// son physique décroche (-31) bien plus que son mental (-12). C'est
// exactement ce qu'une moyenne d'équipe écrase et qu'une baseline
// individuelle fait apparaître.
export const FOCUS = ROSTER[2];

/** 21 jours de score, du plus ancien au plus récent. Dernier point = aujourd'hui. */
export const FOCUS_SERIES: number[] = [
  78, 81, 77, 80, 76, 82, 79, 83, 78, 80, 77,
  81, 79, 76, 74, 72, 69, 71, 66, 61, 54,
];

/** Baseline personnelle (EMA 28 j) alignée sur la série ci-dessus. */
export const FOCUS_BASELINE: number[] = [
  79, 79, 79, 79, 79, 79, 79, 80, 80, 80, 79,
  79, 79, 79, 79, 78, 78, 78, 77, 77, 77,
];

/** Demi-largeur de la bande habituelle, en points. Méthode DAR : ±10. */
export const BAND = 10;

// ── Scène 1 : le check-in tel que l'athlète le remplit ─────────────────
export interface ScQuestion {
  key: string;
  label: string;
  hint: string;
  left: string;
  right: string;
  /** Valeur vers laquelle le curseur s'anime pendant la démo. */
  target: number;
}

export const SESSION = {
  title: "Practice — Team Session",
  time: "4:00 PM – 6:00 PM",
};

// Formulations reprises du questionnaire NCAA en base (migration 012) :
// on mesure un RESSENTI, pas une performance. Chaque item est un état.
export const QUESTIONS: ScQuestion[] = [
  {
    key: "rpe",
    label: "How hard was this session?",
    hint: "Your overall effort, from your own point of view.",
    left: "Very easy", right: "Maximal", target: 78,
  },
  {
    key: "legs",
    label: "How do your legs feel right now?",
    hint: "Heaviness, spring, ability to push off.",
    left: "Heavy", right: "Fresh", target: 34,
  },
  {
    key: "focus",
    label: "How sharp did you feel?",
    hint: "Reading the game, reacting, staying with the plan.",
    left: "Foggy", right: "Locked in", target: 61,
  },
];

// showcaseTheme.ts — Palette et typographie du MATÉRIEL DE VENTE.
//
// Pourquoi un thème séparé des tokens de l'app :
// le mode showcase existe pour produire des captures qui ressemblent
// exactement à ce que les coachs ont DÉJÀ vu dans leur one-pager
// (Thune/UAA, Rozier/FDU, Shelton/Puget Sound, Stark/DYC). Les valeurs
// ci-dessous sont relevées dans ces fichiers, pas inventées :
//   MARKETING/VENTE/*/OnePager_*.html  ->  --bg:#070C18, #00D4FF, #00FF9D,
//                                          #4499FF, Bebas Neue + DM Sans.
//
// Ce fichier ne doit JAMAIS être importé par un écran de production :
// l'app tourne sur `src/theme/tokens.ts` (Courtlight). Les deux palettes
// coexistent volontairement tant que l'arbitrage marque n'est pas fait.

export const SC = {
  // Fonds
  bg: "#070C18",
  bgDeep: "#040812",
  card: "#0D1424",
  cardAlt: "#111A2C",
  ring: "rgba(0, 212, 255, 0.12)",
  ringStrong: "rgba(0, 212, 255, 0.28)",

  // Texte
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.72)",
  textMuted: "rgba(154,167,189,0.62)",

  // Accents de marque (one-pagers)
  cyan: "#00D4FF",
  green: "#00FF9D",
  blue: "#4499FF",
  amber: "#FFB800",

  // Typographie du matériel de vente
  display: "'Bebas Neue', Impact, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
} as const;

// ── Statuts ────────────────────────────────────────────────────────────
//
// Décision fondateur (28/08/2026) : l'app n'affiche pas d'impératif adressé
// au coach. PUSH/MONITOR/PROTECT disent au coach QUOI FAIRE ; ils entrent en
// conflit avec l'article 4 de CONSTITUTION.md et avec le positionnement
// « le coach décide, toujours ». On décrit l'ÉTAT DE L'ATHLÈTE ; le coach en
// tire l'action.
//
// Le seuil de bande (±10 points) est celui de la méthode DAR (Morin), déjà
// implémenté dans v_axis_zones (migration 014). On ne réinvente pas de seuil :
// on découpe le côté BAS de la bande en deux par magnitude, ce qui rend les
// trois libellés sémantiquement vrais :
//   READY   : dans sa bande habituelle, ou au-dessus  (dev >= -10)
//   WATCH   : sorti de sa bande par le bas            (-20 < dev < -10)
//   RECOVER : nettement sous sa bande                 (dev <= -20)
export type ScStatus = "READY" | "WATCH" | "RECOVER";

export const STATUS: Record<ScStatus, { label: string; color: string; note: string }> = {
  READY:   { label: "READY",   color: SC.green, note: "in or above his usual range" },
  WATCH:   { label: "WATCH",   color: SC.amber, note: "below his usual range" },
  RECOVER: { label: "RECOVER", color: SC.blue,  note: "clearly below his usual range" },
};

/** Déduit le statut de l'écart à la baseline PERSONNELLE (en points). */
export function statusFromDeviation(dev: number): ScStatus {
  if (dev <= -20) return "RECOVER";
  if (dev < -10) return "WATCH";
  return "READY";
}

/** Charge Bebas Neue + DM Sans. Isolé au showcase, jamais chargé en prod. */
const FONT_ID = "ctp-showcase-fonts";
export function injectShowcaseFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_ID)) return;
  const l = document.createElement("link");
  l.id = FONT_ID;
  l.rel = "stylesheet";
  l.href =
    "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap";
  document.head.appendChild(l);
}

/** Interpolation d'easing utilisée par toutes les scènes. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

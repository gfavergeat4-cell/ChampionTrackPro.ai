// LogoSlider.tsx — Le curseur EST l'emblème ChampionTrackPro.
//
// L'emblème du logo est une pilule horizontale traversée par une sphère de
// verre : c'est déjà, visuellement, le pouce d'un slider posé sur son rail
// (doc 10 §1.2). Ce composant le reproduit à l'identique, dégradés et
// proportions relevés sur `VISUEL/logo_ctp_embleme.svg` et `logo-191-v2.png` :
//   - rail  : hauteur 64/500 -> 12 px ici
//   - orbe  : 1,81 x la hauteur du rail -> 22 px ici
//   - dégradé du rail : valeurs RELEVÉES sur le PNG (doc 10 §1.3), pas les
//     stops simplifiés du SVG. Le creux #1466C9 vers 76 % est ce qui donne
//     sa densité a l'emblème.
//   - orbe  : cœur #FFFFFD, halo #B8FFFF -> #94FAFC, bord #4FB4F2
//
// Le rail est TOUJOURS entièrement coloré, quelle que soit la position : c'est
// ce qui préserve la lecture « emblème » plutôt que « barre de progression ».
// Web uniquement (les écrans athlète sont des écrans web/PWA).
import React from "react";

const STYLE_ID = "ctp-logo-slider-style";

const CSS = `
/* Dégradé du rail — valeurs relevées pixel par pixel sur logo-191-v2.png
   (doc 10 §1.3), et NON les stops du SVG qui sont une simplification.
   La différence est le creux #1466C9 vers 76 % : c'est ce bleu profond,
   entre le cyan et l'indigo, qui donne sa densité à l'emblème. */
:root {
  --ctp-rail: linear-gradient(90deg,
    #82E9EE 0%, #86ECEE 5%, #62D4EE 18%, #51BFE2 31%,
    #4AA9ED 63%, #1466C9 76%, #2E53D7 88%, #3552EB 95%, #334EE3 100%);
  /* Reflet zénithal : le SVG pose un voile blanc 0.55 -> 0 sur la moitié
     haute de la pilule (rect #pillTop). Reproduit en surcouche. */
  --ctp-sheen: linear-gradient(180deg,
    rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.10) 42%, rgba(255,255,255,0) 60%);
  /* Orbe : cœur blanc pur, halo #B8FFFF -> #94FAFC, bord #4FB4F2 (doc 10 §1.3) */
  --ctp-orb: radial-gradient(circle at 40% 34%,
    #FFFFFD 0%, #FDFFFD 10%, #DFF9FF 22%, #B8FFFF 36%,
    #94FAFC 52%, #6FD3F7 68%, #4FB4F2 84%, #3E9BE8 100%);
}

.ctp-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 12px;
  background: var(--ctp-sheen), var(--ctp-rail);
  border-radius: 9999px;
  outline: none;
  cursor: pointer;
  /* Trois lueurs, reprises des halos du SVG : disque cyan #57C8FF a 0.55,
     ellipse bleue #1E4BFF a 0.45 posée sous la pilule, et le liseré interne. */
  box-shadow:
    0 0 16px rgba(87, 200, 255, 0.30),
    0 4px 18px rgba(30, 75, 255, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    inset 0 -1px 0 rgba(0, 0, 0, 0.20);
  transition: box-shadow 220ms ease-out, filter 220ms ease-out;
}
.ctp-slider::-webkit-slider-runnable-track { height: 12px; border-radius: 9999px; background: transparent; }
.ctp-slider::-moz-range-track {
  height: 12px; border-radius: 9999px;
  background: var(--ctp-sheen), var(--ctp-rail);
}

.ctp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;   /* 1,81 x la hauteur du rail — ratio relevé sur le PNG */
  height: 22px;
  margin-top: -5px;
  border-radius: 50%;
  border: none;
  background: var(--ctp-orb);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.35),
    0 0 14px 3px rgba(148, 250, 252, 0.60),
    0 0 26px 8px rgba(87, 200, 255, 0.35),
    0 2px 5px rgba(0, 20, 60, 0.55);
  cursor: grab;
  transition: transform 200ms cubic-bezier(0.34, 1.3, 0.44, 1), box-shadow 180ms ease-out;
}
.ctp-slider::-moz-range-thumb {
  width: 22px; height: 22px; border-radius: 50%; border: none;
  background: var(--ctp-orb);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.35),
    0 0 14px 3px rgba(148, 250, 252, 0.60),
    0 0 26px 8px rgba(87, 200, 255, 0.35),
    0 2px 5px rgba(0, 20, 60, 0.55);
  cursor: grab;
  transition: transform 200ms cubic-bezier(0.34, 1.3, 0.44, 1), box-shadow 180ms ease-out;
}

.ctp-slider:hover::-webkit-slider-thumb { transform: scale(1.09); }
.ctp-slider:hover::-moz-range-thumb     { transform: scale(1.09); }
.ctp-slider:hover { box-shadow:
    0 0 22px rgba(87, 200, 255, 0.40),
    0 4px 22px rgba(30, 75, 255, 0.34),
    inset 0 1px 0 rgba(255,255,255,0.5),
    inset 0 -1px 0 rgba(0,0,0,0.2); }

.ctp-slider:active::-webkit-slider-thumb {
  transform: scale(1.2);
  cursor: grabbing;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.55),
    0 0 20px 6px rgba(184, 255, 255, 0.75),
    0 0 38px 12px rgba(87, 200, 255, 0.45),
    0 2px 6px rgba(0, 20, 60, 0.6);
}
.ctp-slider:active::-moz-range-thumb {
  transform: scale(1.2);
  cursor: grabbing;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.55),
    0 0 20px 6px rgba(184, 255, 255, 0.75),
    0 0 38px 12px rgba(87, 200, 255, 0.45),
    0 2px 6px rgba(0, 20, 60, 0.6);
}
.ctp-slider:focus-visible { box-shadow: 0 0 0 3px rgba(148, 250, 252, 0.45), 0 0 22px rgba(87,200,255,0.4); }

/* Non touché. L'emblème garde SES couleurs — un composant de marque ne doit
   jamais avoir l'air cassé. Le signal « pas encore répondu » passe par un
   anneau blanc qui pulse autour de l'orbe, pas par une désaturation du rail.
   DAR §E : pas de position de départ affirmée, donc pas de biais de centralité. */
.ctp-slider.ctp-untouched {
  opacity: 0.82;
  box-shadow:
    0 0 10px rgba(87, 200, 255, 0.18),
    0 3px 12px rgba(30, 75, 255, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ctp-slider.ctp-untouched::-webkit-slider-thumb {
  background: var(--ctp-orb);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.75),
    0 0 12px 3px rgba(148, 250, 252, 0.35),
    0 2px 5px rgba(0, 20, 60, 0.5);
  animation: ctp-thumb-await 2.2s ease-in-out infinite;
}
.ctp-slider.ctp-untouched::-moz-range-thumb {
  background: var(--ctp-orb);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.75),
    0 0 12px 3px rgba(148, 250, 252, 0.35),
    0 2px 5px rgba(0, 20, 60, 0.5);
}
@keyframes ctp-thumb-await {
  0%, 100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.75), 0 0 10px 2px rgba(148,250,252,0.30), 0 2px 5px rgba(0,20,60,0.5); }
  50%      { box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 22px 7px rgba(148,250,252,0.55), 0 2px 5px rgba(0,20,60,0.5); }
}

@media (prefers-reduced-motion: reduce) {
  .ctp-slider, .ctp-slider::-webkit-slider-thumb, .ctp-slider::-moz-range-thumb {
    transition: none; animation: none;
  }
}
`;

function useInjectedStyle() {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

const IconMinus = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
       stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M18 12H6" />
  </svg>
);

const IconPlus = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
       stroke="#9AA3B2" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M12 6v12M18 12H6" />
  </svg>
);

export interface LogoSliderProps {
  value: number;
  onChange: (v: number) => void;
  /** false tant que l'athlète n'a pas touché le curseur (état atténué). */
  touched?: boolean;
  min?: number;
  max?: number;
  ariaLabel?: string;
}

export default function LogoSlider({
  value, onChange, touched = true, min = 1, max = 100, ariaLabel,
}: LogoSliderProps) {
  useInjectedStyle();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <IconMinus />
      <input
        type="range"
        className={`ctp-slider${touched ? "" : " ctp-untouched"}`}
        min={min}
        max={max}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ flex: 1 }}
      />
      <IconPlus />
    </div>
  );
}

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

/* Non touché : l'emblème est éteint. Le rail perd sa saturation, l'orbe
   respire en attendant le geste. DAR §E : un curseur déjà positionné au
   centre fabrique des réponses médianes. */
.ctp-slider.ctp-untouched {
  filter: saturate(0.28) brightness(0.62);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15);
}
.ctp-slider.ctp-untouched::-webkit-slider-thumb {
  background: radial-gradient(circle at 40% 34%, #F2F7FA 0%, #C3D2DC 42%, #8A9BAA 74%, #6E8395 100%);
  box-shadow: 0 0 10px 2px rgba(170, 200, 220, 0.30), 0 2px 4px rgba(0,0,0,0.45);
  animation: ctp-thumb-breathe 2.6s ease-in-out infinite;
}
.ctp-slider.ctp-untouched::-moz-range-thumb {
  background: radial-gradient(circle at 40% 34%, #F2F7FA 0%, #C3D2DC 42%, #8A9BAA 74%, #6E8395 100%);
  box-shadow: 0 0 10px 2px rgba(170, 200, 220, 0.30), 0 2px 4px rgba(0,0,0,0.45);
}
@keyframes ctp-thumb-breathe {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(170, 200, 220, 0.25), 0 2px 4px rgba(0,0,0,0.45); }
  50%      { box-shadow: 0 0 16px 5px rgba(170, 200, 220, 0.50), 0 2px 4px rgba(0,0,0,0.45); }
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

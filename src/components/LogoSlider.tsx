// LogoSlider.tsx — Le curseur EST l'emblème ChampionTrackPro.
//
// L'emblème du logo est une pilule horizontale traversée par une sphère de
// verre : c'est déjà, visuellement, le pouce d'un slider posé sur son rail
// (doc 10 §1.2). Ce composant le reproduit à l'identique, dégradés et
// proportions relevés sur `VISUEL/logo_ctp_embleme.svg` et `logo-191-v2.png` :
//   - rail  : hauteur 64/500 -> 12 px ici
//   - orbe  : 1,81 x la hauteur du rail -> 22 px ici
//   - dégradé du rail : #8CEFE0 -> #4FC9F2 (35%) -> #3D8BF7 (72%) -> #2E5BF6
//   - orbe  : radial blanc -> #DFF6FF -> #8ED9FF -> #4FB4F2 -> #3E9BE8
//
// Le rail est TOUJOURS entièrement coloré, quelle que soit la position : c'est
// ce qui préserve la lecture « emblème » plutôt que « barre de progression ».
// Web uniquement (les écrans athlète sont des écrans web/PWA).
import React from "react";

const STYLE_ID = "ctp-logo-slider-style";

const CSS = `
.ctp-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 12px;
  background: linear-gradient(90deg, #8CEFE0 0%, #4FC9F2 35%, #3D8BF7 72%, #2E5BF6 100%);
  border-radius: 9999px;
  outline: none;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(79, 201, 242, 0.28), inset 0 1px 0 rgba(255,255,255,0.35);
  transition: box-shadow 200ms ease-out;
}
.ctp-slider::-webkit-slider-runnable-track {
  height: 12px;
  border-radius: 9999px;
  background: transparent;
}
.ctp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  margin-top: -5px;
  border-radius: 50%;
  border: none;
  background: radial-gradient(circle at 42% 36%,
              #FFFFFF 0%, #DFF6FF 28%, #8ED9FF 55%, #4FB4F2 85%, #3E9BE8 100%);
  box-shadow: 0 0 12px 3px rgba(141, 217, 255, 0.55), 0 1px 3px rgba(0,0,0,0.45);
  cursor: grab;
  transition: transform 180ms cubic-bezier(0.34, 1.3, 0.44, 1), box-shadow 150ms ease-out;
}
.ctp-slider::-moz-range-track {
  height: 12px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #8CEFE0 0%, #4FC9F2 35%, #3D8BF7 72%, #2E5BF6 100%);
}
.ctp-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: radial-gradient(circle at 42% 36%,
              #FFFFFF 0%, #DFF6FF 28%, #8ED9FF 55%, #4FB4F2 85%, #3E9BE8 100%);
  box-shadow: 0 0 12px 3px rgba(141, 217, 255, 0.55), 0 1px 3px rgba(0,0,0,0.45);
  cursor: grab;
  transition: transform 180ms cubic-bezier(0.34, 1.3, 0.44, 1), box-shadow 150ms ease-out;
}
.ctp-slider:hover::-webkit-slider-thumb { transform: scale(1.08); }
.ctp-slider:hover::-moz-range-thumb     { transform: scale(1.08); }
.ctp-slider:active::-webkit-slider-thumb {
  transform: scale(1.18);
  cursor: grabbing;
  box-shadow: 0 0 20px 6px rgba(141, 217, 255, 0.75), 0 1px 4px rgba(0,0,0,0.5);
}
.ctp-slider:active::-moz-range-thumb {
  transform: scale(1.18);
  cursor: grabbing;
  box-shadow: 0 0 20px 6px rgba(141, 217, 255, 0.75), 0 1px 4px rgba(0,0,0,0.5);
}
.ctp-slider:focus-visible { box-shadow: 0 0 0 3px rgba(0, 224, 255, 0.35); }

/* Curseur non encore touché : rail atténué, orbe en attente.
   DAR §E : une position initiale affirmée induit un biais de centralité. */
.ctp-slider.ctp-untouched {
  filter: saturate(0.35) brightness(0.75);
  box-shadow: none;
}
.ctp-slider.ctp-untouched::-webkit-slider-thumb {
  background: radial-gradient(circle at 42% 36%, #E8F4FA 0%, #9FB4C4 60%, #6E8395 100%);
  box-shadow: 0 0 8px 2px rgba(160, 190, 210, 0.35);
  animation: ctp-thumb-breathe 2.4s ease-in-out infinite;
}
.ctp-slider.ctp-untouched::-moz-range-thumb {
  background: radial-gradient(circle at 42% 36%, #E8F4FA 0%, #9FB4C4 60%, #6E8395 100%);
  box-shadow: 0 0 8px 2px rgba(160, 190, 210, 0.35);
}
@keyframes ctp-thumb-breathe {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(160, 190, 210, 0.30); }
  50%      { box-shadow: 0 0 14px 4px rgba(160, 190, 210, 0.55); }
}

@media (prefers-reduced-motion: reduce) {
  .ctp-slider, .ctp-slider::-webkit-slider-thumb, .ctp-slider::-moz-range-thumb {
    transition: none;
    animation: none;
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

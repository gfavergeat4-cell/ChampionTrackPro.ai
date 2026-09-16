// exportFrames.tsx — Étape 1 sur 2 de l'export des images.
//
// Écrit un fichier HTML autonome par image, plus un manifeste. Un second
// script (hors de ce dépôt, avec un Chromium headless) lit le manifeste et
// rasterise chaque page en PNG.
//
// Découpage en deux étapes volontaire : le moteur de rendu n'a pas à être une
// dépendance du projet. Ce script-ci ne dépend que de React.
//
//   npx esbuild src/showcase/exportFrames.tsx --bundle --platform=node \
//     --format=cjs --loader:.tsx=tsx --outfile=tmp_export.js
//   node tmp_export.js <dossier_de_sortie>

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "fs";
import * as path from "path";

import { freezeTimeline } from "./useTimeline";
import { LOGO_SLIDER_CSS } from "../components/LogoSlider";
import Scene1Questionnaire from "./Scene1Questionnaire";
import Scene2MorningBrief from "./Scene2MorningBrief";
import Scene3Baseline from "./Scene3Baseline";
import { SC } from "./showcaseTheme";
import { FRAMES, PHONE, DESK, type Frame } from "./frames";

const STATUS_BAR = `
<div class="sb">
  <span>9:41</span>
  <span class="sb-i">
    <svg width="17" height="11" viewBox="0 0 17 11">
      <rect x="0" y="8" width="2.9" height="3" rx="0.9" fill="#fff"/>
      <rect x="4.4" y="5.6" width="2.9" height="5.4" rx="0.9" fill="#fff"/>
      <rect x="8.8" y="3.2" width="2.9" height="7.8" rx="0.9" fill="#fff"/>
      <rect x="13.2" y="0.8" width="2.9" height="10.2" rx="0.9" fill="#fff"/>
    </svg>
    <svg width="16" height="11" viewBox="0 0 16 11">
      <path d="M8 9.6 L10.1 7.3 A3 3 0 0 0 5.9 7.3 Z" fill="#fff"/>
      <path d="M2.6 4.2 A7.6 7.6 0 0 1 13.4 4.2" stroke="#fff" stroke-width="1.5" fill="none"/>
      <path d="M4.8 6.4 A4.6 4.6 0 0 1 11.2 6.4" stroke="#fff" stroke-width="1.5" fill="none"/>
    </svg>
    <svg width="26" height="12" viewBox="0 0 26 12">
      <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="#fff" stroke-opacity="0.4" fill="none"/>
      <rect x="2.2" y="2.2" width="17" height="7.6" rx="1.8" fill="#fff"/>
    </svg>
  </span>
</div>
<div class="home-ind"></div>`;

function pageFor(f: Frame): string {
  freezeTimeline(f.t);
  const dim = f.desktop ? DESK : PHONE;
  const el =
    f.scene === 1 ? <Scene1Questionnaire playKey={0} /> :
    f.scene === 2 ? <Scene2MorningBrief playKey={0} variant={f.desktop ? "desktop" : "mobile"} /> :
    <Scene3Baseline playKey={0} />;
  const inner = renderToStaticMarkup(el);
  freezeTimeline(null);

  // Coins droits : ces PNG sont destinés à être compositées dans un mockup de
  // téléphone 3D, qui apporte lui-même son masque d'écran. Un coin arrondi
  // pré-appliqué produirait un double arrondi.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:${SC.bg};}
#f{position:relative;width:${dim.w}px;height:${dim.h}px;overflow:hidden;background:${SC.bg};
   font-family:'DM Sans',system-ui,sans-serif;}
${LOGO_SLIDER_CSS}
.sb{position:absolute;top:0;left:0;right:0;height:44px;display:flex;align-items:center;
    justify-content:space-between;padding:0 26px;color:#fff;font-size:14px;font-weight:600;
    font-family:'DM Sans',system-ui,sans-serif;z-index:10}
.sb-i{display:flex;align-items:center;gap:5px}
.home-ind{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;
    border-radius:3px;background:rgba(255,255,255,.3);z-index:10}
</style></head><body><div id="f">${inner}${f.desktop ? "" : STATUS_BAR}</div></body></html>`;
}

const outDir = path.resolve(process.argv[2] ?? "./frames_out");
fs.mkdirSync(outDir, { recursive: true });

const manifest = FRAMES.map((f) => {
  const dim = f.desktop ? DESK : PHONE;
  const html = `${f.file}.html`;
  fs.writeFileSync(path.join(outDir, html), pageFor(f), "utf8");
  return { ...f, html, w: dim.w, h: dim.h };
});

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);
console.log(`${manifest.length} pages écrites dans ${outDir}`);

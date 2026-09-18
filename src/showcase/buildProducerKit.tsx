// buildProducerKit.tsx — Génère le dossier de production de la vidéo.
//
// Pourquoi ce script existe : le producteur ne doit RIEN redessiner. Les
// images du dossier sont le rendu réel des composants de l'app, obtenu en
// figeant l'horloge d'animation à des instants choisis et en rendant les
// scènes en HTML statique. Aucune maquette, aucune interprétation.
//
// Lancer :
//   npx esbuild src/showcase/buildProducerKit.tsx --bundle --platform=node \
//     --format=cjs --loader:.tsx=tsx --outfile=tmp_kit.js && node tmp_kit.js
//
// Sortie : MARKETING/CONTENT/DOSSIER_PRODUCTION_VIDEO.html (autonome).

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
import { ROSTER, FOCUS } from "./showcaseData";
import { FRAMES, PHONE, DESK, type Frame } from "./frames";


function renderFrame(f: Frame): string {
  freezeTimeline(f.t);
  const dim = f.desktop ? DESK : PHONE;
  const el =
    f.scene === 1 ? <Scene1Questionnaire playKey={0} /> :
    f.scene === 2 ? <Scene2MorningBrief playKey={0} variant={f.desktop ? "desktop" : "mobile"} /> :
    <Scene3Baseline playKey={0} />;

  const inner = renderToStaticMarkup(el);
  freezeTimeline(null);

  const statusBar = f.desktop ? "" : `
    <div class="sb">
      <span class="sb-t">9:41</span>
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

  return `<div class="frame ${f.desktop ? "desk" : "phone"}" style="width:${dim.w}px;height:${dim.h}px">
    ${inner}${statusBar}
  </div>`;
}

const shot = (f: Frame, scale: number) => {
  const dim = f.desktop ? DESK : PHONE;
  return `
  <figure class="shot">
    <div class="stage" style="width:${dim.w * scale}px;height:${dim.h * scale}px">
      <div class="scaler" style="transform:scale(${scale})">${renderFrame(f)}</div>
    </div>
    <figcaption>
      <span class="tag">${f.id.toUpperCase()}</span>
      <strong>${f.title}</strong>
      <span class="ms">t = ${(f.t / 1000).toFixed(1)} s</span>
      <p>${f.note}</p>
    </figcaption>
  </figure>`;
};

const byId = (id: string) => FRAMES.find((f) => f.id === id)!;
const row = (ids: string[], scale = 0.42) =>
  `<div class="row">${ids.map((i) => shot(byId(i), scale)).join("")}</div>`;

// ── Document ───────────────────────────────────────────────────────────
const HTML = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>ChampionTrackPro — Dossier de production vidéo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
${LOGO_SLIDER_CSS}
* { box-sizing: border-box; }
body { margin:0; background:#0A0E17; color:#E8EDF5; font-family:'DM Sans',system-ui,sans-serif;
       font-size:15px; line-height:1.62; }
.wrap { max-width:1080px; margin:0 auto; padding:0 40px 120px; }
h1,h2,h3 { font-family:'Bebas Neue',Impact,sans-serif; letter-spacing:1.2px; color:#fff; font-weight:400; }
h1 { font-size:62px; line-height:1.02; margin:0 0 10px; }
h2 { font-size:34px; margin:64px 0 6px; padding-top:26px; border-top:1px solid rgba(0,212,255,.18); }
h3 { font-size:23px; margin:36px 0 10px; color:${SC.cyan}; }
p { margin:11px 0; color:#C3CCDA; }
strong { color:#fff; }
a { color:${SC.cyan}; }
.lead { font-size:17.5px; color:#9FB0C6; max-width:760px; }
.cover { padding:80px 0 34px; border-bottom:1px solid rgba(0,212,255,.18); }
.kicker { font-size:12px; letter-spacing:3.4px; color:${SC.cyan}; margin-bottom:16px; }
.meta { font-size:13px; color:#71809A; margin-top:22px; }
.row { display:flex; flex-wrap:wrap; gap:26px; margin:24px 0 8px; align-items:flex-start; }
.shot { margin:0; flex:0 0 auto; max-width:100%; }
.stage { position:relative; overflow:hidden; border-radius:12px; }
.scaler { position:absolute; top:0; left:0; transform-origin:top left; }
.frame { position:relative; overflow:hidden; background:${SC.bg};
         font-family:'DM Sans',system-ui,sans-serif; }
.frame.phone { border-radius:42px; }
.frame.desk  { border-radius:9px; }
.sb { position:absolute; top:0; left:0; right:0; height:44px; display:flex; align-items:center;
      justify-content:space-between; padding:0 26px; color:#fff; font-size:14px; font-weight:600; }
.sb-i { display:flex; align-items:center; gap:5px; }
.home-ind { position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
            width:134px; height:5px; border-radius:3px; background:rgba(255,255,255,.3); }
figcaption { margin-top:13px; max-width:330px; font-size:13.2px; color:#93A3B8; line-height:1.5; }
figcaption strong { display:inline; font-size:14px; }
figcaption p { margin:6px 0 0; font-size:12.6px; color:#7D8DA4; }
.tag { display:inline-block; font-family:'Bebas Neue'; font-size:13px; letter-spacing:1.4px;
       background:${SC.cyan}1f; color:${SC.cyan}; padding:1px 8px; border-radius:5px; margin-right:7px; }
.ms { color:#5E6C82; font-size:11.6px; margin-left:7px; }
table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; }
th,td { text-align:left; padding:11px 13px; border-bottom:1px solid rgba(255,255,255,.08); vertical-align:top; }
th { font-family:'Bebas Neue'; font-size:15px; letter-spacing:1.1px; color:${SC.cyan};
     border-bottom-color:rgba(0,212,255,.3); }
td { color:#B9C4D4; }
.act { border-left:2px solid ${SC.cyan}; padding:2px 0 2px 22px; margin:34px 0; }
.act .time { font-family:'Bebas Neue'; font-size:15px; letter-spacing:1.6px; color:${SC.cyan}; }
.act h3 { margin:2px 0 8px; color:#fff; font-size:26px; }
.cap { background:#0F1726; border-left:3px solid ${SC.green}; padding:13px 17px; margin:14px 0;
       border-radius:0 9px 9px 0; }
.cap .lbl { font-size:10.5px; letter-spacing:2px; color:${SC.green}; }
.cap .txt { font-family:'Bebas Neue'; font-size:25px; letter-spacing:1.1px; color:#fff; margin-top:5px; }
.warn { background:#1C1214; border-left:3px solid #FF5C5C; padding:15px 19px; margin:20px 0;
        border-radius:0 9px 9px 0; }
.warn .lbl { font-family:'Bebas Neue'; font-size:16px; letter-spacing:1.4px; color:#FF7B7B; }
.ok { background:#0D1A16; border-left:3px solid ${SC.green}; padding:15px 19px; margin:20px 0;
      border-radius:0 9px 9px 0; }
.ok .lbl { font-family:'Bebas Neue'; font-size:16px; letter-spacing:1.4px; color:${SC.green}; }
blockquote { margin:16px 0; padding:13px 19px; background:#0E1523; border-left:3px solid #3A4A66;
             border-radius:0 8px 8px 0; color:#A9B7CA; font-style:italic; font-size:14.2px; }
blockquote cite { display:block; margin-top:7px; font-style:normal; font-size:12px; color:#66748C; }
pre { background:#080C14; border:1px solid rgba(0,212,255,.17); border-radius:10px; padding:20px;
      overflow-x:auto; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12.4px;
      line-height:1.62; color:#B7C6D9; white-space:pre-wrap; }
code { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; color:${SC.cyan};
       background:rgba(0,212,255,.09); padding:1px 5px; border-radius:4px; }
pre code { background:none; padding:0; color:inherit; font-size:inherit; }
ul,ol { color:#B9C4D4; padding-left:22px; } li { margin:7px 0; }
.tocwrap { background:#0E1523; border-radius:12px; padding:8px 26px 20px; margin:30px 0 0; }
@media print { body{background:#fff;} .wrap{padding:0;} }
</style></head><body><div class="wrap">

<div class="cover">
  <div class="kicker">DOSSIER DE PRODUCTION · CONFIDENTIEL</div>
  <h1>Vidéo produit<br>ChampionTrackPro</h1>
  <p class="lead">Walkthrough 35 secondes destiné aux head coaches NCAA. Tous les écrans
  de ce dossier sont le rendu réel de l'application, généré depuis le code source.
  <strong>Rien ne doit être redessiné, réinterprété ou reconstitué.</strong></p>
  <div class="meta">Version 1.0 · 28 août 2026 · Direction artistique : ChampionTrackPro ·
  Écrans générés automatiquement depuis <code>src/showcase/</code></div>
</div>

<div class="tocwrap">
<h3>Sommaire</h3>
<ol>
  <li>Les règles non négociables</li>
  <li>Ce que le producteur reçoit</li>
  <li>Le storyboard — 35 secondes</li>
  <li>La méthode DAR — pourquoi l'acte 4 est le plan qui vend</li>
  <li>Traitement visuel et sonore</li>
  <li>Prompt prêt à l'emploi</li>
  <li>Gemini et Veo — usage réel</li>
  <li>Livrables attendus</li>
</ol>
</div>

<h2>1 · Les règles non négociables</h2>

<div class="warn">
  <div class="lbl">TROIS INTERDITS ABSOLUS</div>
  <p style="margin-top:9px"><strong>1. Ne jamais régénérer le contenu d'un écran.</strong>
  Les enregistrements fournis sont composités <em>dans</em> un téléphone 3D. Le texte à
  l'écran doit rester net et exact à chaque image. Un modèle génératif qui redessine
  l'interface produit du faux texte — et un coach qui voit du faux texte dans une démo
  de logiciel comprend en une seconde que le produit n'existe pas.</p>
  <p><strong>2. Ne jamais faire tourner le téléphone à 360°.</strong> C'est le réflexe de
  tous les templates de mockup. L'écran devient illisible la moitié du temps, ce qui
  détruit exactement ce qu'on veut montrer.</p>
  <p><strong>3. Ne jamais écrire une promesse médicale ou de performance.</strong> Détail
  ci-dessous — c'est une contrainte juridique, pas une préférence de ton.</p>
</div>

<h3>Formulations interdites</h3>
<table>
<tr><th>Interdit</th><th>Pourquoi</th><th>À la place</th></tr>
<tr><td>« prevent injuries », « avoid injury », « know before they break »</td>
    <td>Prédiction de blessure. Le produit ne l'a jamais promise et ne peut pas la tenir.</td>
    <td>« see what you're missing »</td></tr>
<tr><td>« tells you who to rest », « the app decides »</td>
    <td>Décision automatique. Le positionnement du produit est l'inverse : le coach décide, toujours.</td>
    <td>« you decide, with the full picture »</td></tr>
<tr><td>« improve performance by X% »</td>
    <td>Promesse de résultat sportif non démontrée.</td>
    <td>« stop guessing »</td></tr>
</table>

<p><strong>Langue : anglais uniquement.</strong> La cible est des entraîneurs universitaires
américains. Aucun texte français à l'écran.</p>

<h2>2 · Ce que le producteur reçoit</h2>
<p class="lead">Quatre enregistrements d'écran, un logo. Les images ci-dessous montrent
exactement ce que contient chaque enregistrement, image par image.</p>

<h3>Enregistrement 1A — Check-in athlète · 9:16 · ~9 s</h3>
<p>Le parcours complet d'un athlète après l'entraînement. Le curseur bleu est
<strong>l'emblème de la marque</strong> : c'est le logo transformé en outil. Il mérite un
plan serré à lui seul (acte 2).</p>
${row(["1a", "1b", "1c"], 0.4)}
${row(["1d", "1e"], 0.4)}

<h3>Enregistrement 2A et 2B — Morning Brief · 9:16 et 16:9 · ~6 s</h3>
<p>L'écran que le staff ouvre le matin. La jauge se remplit, puis les douze athlètes
tombent en cascade.</p>
${row(["2a", "2b"], 0.4)}
${row(["2c"], 0.52)}

<h3>Enregistrement 3A — Détail joueur · 9:16 · ~7 s</h3>
<p>Le plan le plus important de la vidéo. Voir la section 4 pour ce qu'il faut en
comprendre avant de le monter.</p>
${row(["3a", "3b", "3c"], 0.4)}

<table>
<tr><th>Fichier</th><th>Format</th><th>Durée</th><th>Utilisé à</th></tr>
<tr><td><code>CTP_1A_checkin_9x16.mp4</code></td><td>9:16</td><td>~9 s</td><td>Acte 2</td></tr>
<tr><td><code>CTP_2A_brief_9x16.mp4</code></td><td>9:16</td><td>~6 s</td><td>Acte 3 (master)</td></tr>
<tr><td><code>CTP_2B_brief_16x9.mp4</code></td><td>16:9</td><td>~6 s</td><td>Acte 3 (déclinaison paysage)</td></tr>
<tr><td><code>CTP_3A_baseline_9x16.mp4</code></td><td>9:16</td><td>~7 s</td><td>Acte 4</td></tr>
<tr><td><code>CTP_logo.png</code></td><td>—</td><td>fixe</td><td>Acte 5</td></tr>
</table>

<p>Deux plans supplémentaires sont des <strong>recadrages en post</strong> de prises
existantes, à ne pas demander séparément : un plan serré sur le curseur en mouvement
(depuis 1A) et un plan serré sur la courbe au moment où le point passe sous la bande
(depuis 3A).</p>

<h2>3 · Le storyboard — 35 secondes</h2>

<div class="act">
  <div class="time">0:00 — 0:06 · ACTE 1</div>
  <h3>Le problème</h3>
  <p><strong>Aucune capture d'application.</strong> Noir. Typographie seule, en deux temps,
  centrée, Bebas Neue blanc.</p>
  <div class="cap"><div class="lbl">TEXTE À L'ÉCRAN</div>
    <div class="txt">"YOU ASKED HIM IF HE WAS GOOD."</div>
    <div class="txt" style="opacity:.75">"HE SAID YEAH."</div></div>
  <p>Silence complet, puis un seul coup grave à 0:05.</p>
  <p><em>Pourquoi ouvrir sans produit :</em> le coach doit se reconnaître avant qu'on lui
  vende quoi que ce soit. C'est la seule seconde où il décide de continuer à regarder.</p>
</div>

<div class="act">
  <div class="time">0:06 — 0:15 · ACTE 2</div>
  <h3>L'entrée</h3>
  <p>Le téléphone entre en 3/4. Orbite lente de la gauche vers la face,
  <strong>15° maximum</strong>. Écran : enregistrement 1A.</p>
  <p>À 0:11, coupe sur un plan serré du curseur en mouvement, 2 secondes.</p>
  <div class="cap"><div class="lbl">LÉGENDE, TIERS INFÉRIEUR</div>
    <div class="txt">"60 SECONDS AFTER PRACTICE. ON THEIR OWN PHONE."</div></div>
</div>

<div class="act">
  <div class="time">0:15 — 0:25 · ACTE 3</div>
  <h3>La révélation</h3>
  <p>Coupe franche. Le téléphone pivote et s'éloigne, le Morning Brief entre.
  Écran : enregistrement 2A. <strong>Ne pas couper avant la fin de la cascade du
  roster</strong> — c'est ce plan qui produit la sensation « tout est là ».</p>
  <div class="cap"><div class="lbl">LÉGENDE, PREMIER TEMPS · SUR LE PLAN MOBILE</div>
    <div class="txt">"EVERY MORNING. BEFORE YOU WALK IN."</div></div>
  <p>Puis, à 0:21, <strong>bascule sur l'enregistrement 2B (desktop 16:9), inséré en
  letterbox dans le cadre vertical.</strong> Le plan s'élargit, les douze athlètes
  apparaissent d'un coup.</p>
  <div class="cap"><div class="lbl">LÉGENDE, SECOND TEMPS · SUR LE PLAN DESKTOP</div>
    <div class="txt">"YOUR WHOLE ROSTER. ONE SCREEN."</div></div>
  <div class="warn"><div class="lbl">POURQUOI CETTE BASCULE EST OBLIGATOIRE</div>
  <p style="margin-top:8px">Douze athlètes ne tiennent pas sur un écran de téléphone :
  la liste déborde, avec un dégradé de bas d'écran qui signale la suite. Poser
  « YOUR WHOLE ROSTER. ONE SCREEN. » sur le plan mobile ferait mentir l'image.
  Sur le plan desktop, les douze sont visibles simultanément — la phrase devient vraie.
  <strong>Ne jamais associer cette légende au plan mobile.</strong> Bénéfice secondaire :
  le coach voit que l'outil existe aussi sur l'ordinateur de son bureau.</p></div>
</div>

<div class="act">
  <div class="time">0:25 — 0:33 · ACTE 4</div>
  <h3>La preuve</h3>
  <p>Push-in lent, <strong>20 % maximum</strong>, sur l'enregistrement 3A. La courbe se
  trace, la bande grisée apparaît, le point du jour tombe sous la bande. Tenir le plan.</p>
  <div class="cap"><div class="lbl">LÉGENDE, EN DEUX TEMPS</div>
    <div class="txt">"COMPARED TO HIS OWN NORMAL."</div>
    <div class="txt">"NOT A TEAM AVERAGE."</div></div>
  <p><strong>Si le montage doit sacrifier une seconde, il la prend ailleurs.</strong>
  Section 4 pour comprendre pourquoi.</p>
</div>

<div class="act">
  <div class="time">0:33 — 0:38 · ACTE 5</div>
  <h3>Clôture</h3>
  <p>Logo sur fond sombre. Le curseur-emblème trace une ligne qui devient le trait sous
  le logo.</p>
  <div class="cap"><div class="lbl">TEXTE</div>
    <div class="txt">CHAMPIONTRACKPRO</div>
    <div class="txt" style="opacity:.75">"STOP GUESSING."</div>
    <div class="txt" style="font-size:17px;opacity:.6">champtrackpro.com</div></div>
</div>

<h2>4 · La méthode DAR</h2>
<p class="lead">Cette section n'est pas du contexte optionnel. Elle explique pourquoi
l'acte 4 existe, et pourquoi le monter comme un simple « écran de statistiques »
détruirait l'argument de vente du produit.</p>

<p>L'application repose sur le modèle <strong>DAR — Dépense Adaptative de Réserve</strong>,
de Stéphane Morin (<em>Penser l'entraînement — De la charge à l'effort</em>). Trois
principes gouvernent l'affichage, et chacun contredit un réflexe habituel de montage.</p>

<h3>Principe 1 — Chaque athlète est comparé à lui-même, jamais aux autres</h3>
<blockquote>« Toute tentative de normalisation interindividuelle constitue une erreur
méthodologique. Comparer les ressentis de deux athlètes, établir des moyennes de groupe,
déterminer des seuils standardisés, revient à effacer ce qui fait la richesse même du
ressenti. »<cite>Morin, modèle DAR, partie 3</cite></blockquote>
<p>La bande grisée de l'acte 4 est <strong>la zone de variations habituelles de ce joueur
précis</strong>, ±10 points autour de sa propre moyenne mobile sur 28 jours. Un joueur dont
la norme est à 40 et qui déclare 52 est au-dessus de ses habitudes. Un autre à 78 qui
déclare 80 est dans les siennes. <strong>Le même chiffre brut n'a pas le même sens d'un
joueur à l'autre.</strong></p>
<div class="ok"><div class="lbl">CE QUE ÇA IMPOSE AU MONTAGE</div>
<p style="margin-top:8px">La légende « NOT A TEAM AVERAGE » n'est pas un slogan : c'est
la description exacte du produit. Elle doit rester à l'écran assez longtemps pour être
lue. Ne jamais la remplacer par une formule plus courte type « personalized ».</p></div>

<h3>Principe 2 — On lit la couleur ET la courbe</h3>
<blockquote>« La couleur seule, isolée de cette double lecture, ne suffit jamais à
interpréter correctement la situation. Un vert n'est pas toujours synonyme de stabilité
attendue, un jaune n'est pas toujours le signe d'une surcharge. »<cite>Morin, modèle DAR</cite></blockquote>
<p>D'où la présence simultanée, sur l'écran de détail : la pastille de couleur,
l'écart chiffré, <strong>et</strong> la courbe sur 21 jours. Trois informations, pas une.</p>
<div class="ok"><div class="lbl">CE QUE ÇA IMPOSE AU MONTAGE</div>
<p style="margin-top:8px">Ne pas recadrer l'acte 4 sur le seul badge de couleur, ni sur
le seul chiffre. La courbe doit être visible dans le plan. C'est elle qui prouve que
l'outil regarde une <em>trajectoire</em>, pas un instantané.</p></div>

<h3>Principe 3 — Trois marqueurs, jamais un score unique</h3>
<blockquote>« Chaque série possède sa propre tendance, sa zone de variations habituelles
(±10) et ses zones d'écart. C'est cette articulation, et non une moyenne arithmétique,
qui fonde une régulation fine. »<cite>Morin, modèle DAR</cite></blockquote>
<p>Physique, technique, mental sont suivis séparément. C'est ce qui rend lisible le cas
montré dans l'acte 4 : <strong>${FOCUS.name} est à ${FOCUS.axesDev.phy} points de sa norme
sur le physique, mais seulement ${FOCUS.axesDev.men} sur le mental.</strong> Un score
composite unique aurait effacé cette divergence.</p>
<p>Morin décrit un cas encore plus parlant, le motif « mental seul » :</p>
<blockquote>« Traduit une dépense perçue élevée qui ne vient pas directement de
l'entraînement mais du contexte (vie personnelle, sommeil, stress, relationnel). Ici,
l'intervention pertinente est extra-sportive, et non une simple modulation de la charge
physique ou technique. »<cite>Morin, modèle DAR, partie 3 §8</cite></blockquote>
<p>C'est le signal qu'aucun GPS ni aucun capteur ne verra jamais. En NCAA, c'est souvent
la charge académique. <strong>C'est l'argument de différenciation central du produit.</strong></p>

<h3>Ce que la jauge de l'acte 3 mesure exactement</h3>
<p>La jauge du Morning Brief affiche la <strong>part de l'effectif dans sa bande habituelle
ou au-dessus</strong>. Ce n'est pas la moyenne des scores de l'équipe — cette moyenne serait
précisément l'erreur méthodologique décrite au principe 1.</p>
<div class="warn"><div class="lbl">NE JAMAIS SOUS-TITRER LA JAUGE « TEAM SCORE »</div>
<p style="margin-top:8px">Ni « team average », ni « squad rating », ni aucune formulation
qui suggérerait une note d'équipe. Si une légende est ajoutée sur ce plan, elle doit
dire « in their range » — le libellé déjà présent à l'écran.</p></div>

<h2>5 · Traitement visuel et sonore</h2>
<table>
<tr><th>Paramètre</th><th>Choix</th><th>Raison</th></tr>
<tr><td>Fond de scène</td><td>Noir profond <code>#04060C</code>, dégradé radial très léger</td>
    <td>Le cyan de l'app doit être la seule source de lumière saturée</td></tr>
<tr><td>Éclairage</td><td>Source froide en haut à gauche, rebond cyan à droite</td>
    <td>Cohérent avec le halo présent dans les écrans</td></tr>
<tr><td>Mouvement caméra</td><td>Orbite ≤ 15°, push-in ≤ 20 %, vitesse constante</td>
    <td>Une caméra rapide donne un air de template ; la lenteur donne un air premium</td></tr>
<tr><td>Transitions</td><td>Coupe franche. Jamais de fondu enchaîné</td>
    <td>Le fondu affaiblit ; on veut de la décision</td></tr>
<tr><td>Typographie légendes</td><td>Bebas Neue, capitales, blanc pur, tiers inférieur, ~7 % de la hauteur</td>
    <td>Même police que le matériel de vente déjà envoyé aux coachs</td></tr>
<tr><td>Apparition légendes</td><td>Fondu 200 ms + montée de 8 px</td>
    <td>Discret, ne concurrence pas l'écran</td></tr>
<tr><td>Son</td><td>Tension retenue, un coup grave par acte. Pas d'EDM</td>
    <td>Le public est un staff technique, pas une audience lifestyle</td></tr>
<tr><td>Voix off</td><td>Aucune</td>
    <td>La majorité des vues sont muettes ; la typographie porte seule</td></tr>
<tr><td>Format master</td><td>9:16, déclinaisons 1:1 et 16:9</td>
    <td>Les coachs consultent LinkedIn et Instagram au téléphone</td></tr>
</table>

<h2>6 · Prompt prêt à l'emploi</h2>
<p>À copier tel quel dans l'outil de montage assisté. Rédigé en anglais — les outils y
répondent mieux — et contenant les interdits de la section 1.</p>
<pre><code>Create a 35-second premium product walkthrough video for a sports technology app.

FOOTAGE PROVIDED: 4 real screen recordings + 1 logo PNG. The screen recordings must be
composited INTO a 3D phone mockup. Do NOT regenerate, redraw or alter the screen
content - the on-screen text must stay pixel-accurate and fully legible at all times.
This is the single most important constraint.

FILES:
  CTP_1A_checkin_9x16.mp4    athlete filling a post-practice check-in, sliders move
  CTP_2A_brief_9x16.mp4      coach dashboard, gauge fills, roster cascades in
  CTP_2B_brief_16x9.mp4      same dashboard, desktop widescreen
  CTP_3A_baseline_9x16.mp4   single player detail, line chart draws
  CTP_logo.png               logo

STRUCTURE:

0:00-0:06  BLACK. Text only, two beats, centered, Bebas Neue, white:
           "YOU ASKED HIM IF HE WAS GOOD."  then  "HE SAID YEAH."
           No product visible. Silence, one deep hit at 0:05.

0:06-0:15  3D phone enters at a 3/4 angle. Slow camera orbit, left to front, maximum
           15 degrees. Screen plays CTP_1A. At 0:11, cut to a tight crop on the moving
           slider for 2 seconds.
           Lower-third caption: "60 SECONDS AFTER PRACTICE. ON THEIR OWN PHONE."

0:15-0:21  Hard cut. Phone rotates away, dashboard enters. Screen plays CTP_2A.
           Let the roster cascade finish completely before cutting.
           Caption: "EVERY MORNING. BEFORE YOU WALK IN."

0:21-0:25  Widen to CTP_2B (desktop 16:9) letterboxed inside the vertical frame.
           All twelve athletes visible at once.
           Caption: "YOUR WHOLE ROSTER. ONE SCREEN."
           This caption MUST sit on the desktop shot, never on the mobile one -
           on mobile the roster overflows and the claim would be false.

0:25-0:33  Slow push-in, maximum 20 percent, onto CTP_3A. The chart draws and a point
           drops below a shaded band. Hold on it.
           Caption in two beats: "COMPARED TO HIS OWN NORMAL." then "NOT A TEAM AVERAGE."

0:33-0:38  Logo on dark background. Caption: "STOP GUESSING." Then: champtrackpro.com

LOOK: near-black background #04060C. Cyan #00D4FF and green #00FF9D are the only
saturated colors and must come from the screen itself. Cool key light upper-left, soft
cyan bounce right. Slow deliberate camera moves only. Hard cuts, never cross-dissolves.
Captions in Bebas Neue, uppercase, pure white, lower third.

SOUND: restrained tension, no EDM, one low hit per section. No voice-over.

NEVER rotate the phone a full 360 degrees. Never obscure the screen.

FORBIDDEN COPY - do not generate any text claiming the product predicts or prevents
injury, decides who should rest, or improves athletic performance by any amount. This
is a decision-support tool; the coach always decides. Never label the dashboard gauge
as a "team score" or "team average".

DELIVER: 9:16 master, plus 1:1 and 16:9 versions.</code></pre>

<h2>7 · Gemini et Veo — usage réel</h2>
<div class="warn"><div class="lbl">GEMINI N'ASSEMBLERA PAS CETTE VIDÉO</div>
<p style="margin-top:8px">Veo 3, le modèle vidéo accessible via Gemini et Google AI
Studio, génère des plans isolés à partir d'un texte ou d'une image. Il ne fait pas de
montage multi-plans, et surtout il <strong>réécrit</strong> le contenu d'un écran qu'on lui
fournit : l'interface se déforme en une à deux secondes. C'est exactement le problème
que ce dossier cherche à éviter.</p></div>

<h3>Les trois usages qui fonctionnent</h3>
<p><strong>Usage 1 — Plan d'ambiance pour l'acte 1.</strong> Le seul moment de la vidéo sans
interface, donc le seul où un modèle génératif ne peut rien casser.</p>
<pre><code>Empty college basketball gym, late evening, lights half off. A single ball rolls
slowly to a stop on the hardwood. Cold blue light from high windows. Slow dolly in,
shallow depth of field, cinematic, no people, no text. 8 seconds.</code></pre>

<p><strong>Usage 2 — Textures de transition.</strong></p>
<pre><code>Abstract dark surface with faint cyan light streaks moving slowly from left to right,
deep black background, subtle grain, no text, no objects. 4 seconds.</code></pre>

<p><strong>Usage 3 — Et c'est le plus utile : Gemini comme relecteur critique.</strong>
Gemini 2.5 Pro lit les images et la vidéo. On lui soumet le montage final.</p>
<pre><code>You are a senior creative director reviewing a product ad before it ships.
I'm attaching the 35-second cut and the storyboard.

Tell me, without softening anything:
1. Which shot is the weakest, and why.
2. At exactly what second a viewer would scroll away.
3. Whether the on-screen UI text stays legible at phone size throughout.
4. Any copy that promises a medical outcome, an injury prevention, or a
   performance gain - these are forbidden.
5. Whether the dashboard gauge is ever labelled or implied to be a team average.

Be specific. Reference timestamps.</code></pre>

<h3>La chaîne de production réellement fiable</h3>
<ol>
<li><strong>Captures réelles</strong> — mode showcase de l'application <em>(fourni)</em></li>
<li><strong>Compositing dans un téléphone 3D</strong> — Screenhance, Rotato, Jitter, ou After
Effects avec un template de mockup. <strong>C'est ici que se fait la vidéo</strong>, et c'est
l'étape qui préserve la netteté du texte.</li>
<li><strong>Plans d'ambiance</strong> — Veo, pour l'ouverture et les transitions uniquement</li>
<li><strong>Montage, légendes, son</strong> — l'outil de l'étape 2</li>
<li><strong>Relecture critique</strong> — Gemini 2.5 Pro sur le montage final</li>
</ol>
<p>L'étape 2 est le cœur du travail. Veo est un accessoire.</p>

<h2>8 · Livrables attendus</h2>
<table>
<tr><th>Livrable</th><th>Format</th><th>Usage</th></tr>
<tr><td>Master</td><td>9:16, 1080×1920, H.264, 60 fps</td><td>Instagram Reels, TikTok, LinkedIn mobile</td></tr>
<tr><td>Déclinaison carrée</td><td>1:1, 1080×1080</td><td>Fil LinkedIn</td></tr>
<tr><td>Déclinaison paysage</td><td>16:9, 1920×1080</td><td>YouTube, landing page</td></tr>
<tr><td>Version muette sous-titrée</td><td>9:16</td><td>Lecture sans son — majorité des vues</td></tr>
<tr><td>Projet source</td><td>Fichier natif de l'outil</td><td>Retouches ultérieures sans repartir de zéro</td></tr>
</table>

<p style="margin-top:44px;color:#5E6C82;font-size:12.6px;border-top:1px solid rgba(255,255,255,.08);padding-top:20px">
Écrans de ce dossier générés le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
depuis <code>src/showcase/buildProducerKit.tsx</code> — rendu réel des composants de
production, figé aux instants indiqués. Roster de démonstration : ${ROSTER.length} athlètes,
données fictives.</p>

</div></body></html>`;

// Chemin de sortie passé en argument, parce que le script est exécuté depuis
// un bundle temporaire où __dirname ne pointe pas vers les sources.
//   node tmp_kit.js "../../MARKETING/CONTENT/DOSSIER_PRODUCTION_VIDEO.html"
const OUT = path.resolve(
  process.argv[2] ?? "../../MARKETING/CONTENT/DOSSIER_PRODUCTION_VIDEO.html",
);
fs.writeFileSync(OUT, HTML, "utf8");
console.log(`Écrit : ${OUT}`);
console.log(`${FRAMES.length} écrans rendus · ${(HTML.length / 1024).toFixed(0)} Ko`);

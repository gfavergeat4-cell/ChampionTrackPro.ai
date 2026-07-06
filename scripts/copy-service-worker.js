const fs = require("fs");
const path = require("path");

function copy(src, dst) {
  if (!fs.existsSync(src)) {
    console.error("FAIL Missing:", src);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log("OK Copied:", src, "->", dst);
}

const distRoot = path.join(process.cwd(), "web", "dist");

const srcSw = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
const dstSw = path.join(distRoot, "firebase-messaging-sw.js");
copy(srcSw, dstSw);

const srcManifest = path.join(process.cwd(), "public", "manifest.json");
const dstManifest = path.join(distRoot, "manifest.json");
if (fs.existsSync(srcManifest)) {
  fs.mkdirSync(path.dirname(dstManifest), { recursive: true });
  fs.copyFileSync(srcManifest, dstManifest);
  console.log("OK Copied:", srcManifest, "->", dstManifest);
}

const srcIcons = path.join(process.cwd(), "public", "icons");
const dstIcons = path.join(distRoot, "icons");
if (fs.existsSync(srcIcons)) {
  fs.mkdirSync(dstIcons, { recursive: true });
  fs.readdirSync(srcIcons).forEach((f) => {
    const s = path.join(srcIcons, f);
    const d = path.join(dstIcons, f);
    if (fs.statSync(s).isFile()) {
      fs.copyFileSync(s, d);
      console.log("OK Copied:", s, "->", d);
    }
  });
}

// ── Landing page — homepage swap ──────────────────────────────────────────────
// Vercel serves static files before rewrites: web/dist/index.html always wins.
// Fix: save Expo shell as app.html, install landing/index.html as the new index.html.
const srcLanding = path.join(process.cwd(), "public", "landing", "index.html");
const dstIndex   = path.join(distRoot, "index.html");
const dstApp     = path.join(distRoot, "app.html");
const dstLandingCopy = path.join(distRoot, "landing", "index.html");

if (fs.existsSync(srcLanding)) {
  // 1. Save Expo-generated shell so the React app stays accessible at /app
  if (fs.existsSync(dstIndex)) {
    fs.copyFileSync(dstIndex, dstApp);
    console.log("OK Saved Expo shell -> app.html");
  }
  // 2. Install landing page as the site homepage
  fs.copyFileSync(srcLanding, dstIndex);
  console.log("OK Installed public/landing/index.html -> web/dist/index.html (homepage)");
  // 3. Also serve it at /landing/ for direct link sharing
  fs.mkdirSync(path.join(distRoot, "landing"), { recursive: true });
  fs.copyFileSync(srcLanding, dstLandingCopy);
  console.log("OK Installed public/landing/index.html -> web/dist/landing/index.html");
} else {
  console.warn("WARN public/landing/index.html not found — homepage unchanged.");
}

// Validation: SW doit utiliser importScripts (mode classique pour Android/Chrome)
const swTxt = fs.readFileSync(dstSw, "utf8");
if (swTxt.includes("importScripts")) {
  console.log("OK SW uses importScripts (classic mode) - correct for background notifications.");
} else {
  console.error("FAIL SW must use importScripts for background notifications to work.");
  process.exit(1);
}

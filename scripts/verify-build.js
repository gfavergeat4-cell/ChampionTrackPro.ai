const fs = require("fs");
const path = require("path");

function ok(msg) { console.log("[VERIFY] OK " + msg); }
function fail(msg) { console.error("[VERIFY] FAIL " + msg); process.exitCode = 1; }
function mustExist(p) {
  if (!fs.existsSync(p)) fail("Missing file: " + p);
  else ok(p + " - " + fs.statSync(p).size + " bytes");
}

console.log("[VERIFY] ===== Verifying Build Artifacts =====");

const distRoot = path.join(process.cwd(), "web", "dist");

const required = [
  path.join(distRoot, "index.html"),
  path.join(distRoot, "firebase-messaging-sw.js"),
  path.join(distRoot, "manifest.json"),
];
required.forEach(mustExist);

const swPath = path.join(distRoot, "firebase-messaging-sw.js");
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, "utf8");

  // Le SW doit utiliser importScripts (mode classique) — pas ESM
  if (sw.includes("importScripts")) {
    ok("SW uses importScripts (classic mode) - correct for background notifications");
  } else {
    fail("SW must use importScripts for background notifications to work on Android/Chrome");
  }

  // Doit utiliser la lib compat
  if (sw.includes("firebase-app-compat") && sw.includes("firebase-messaging-compat")) {
    ok("SW uses compat libraries - correct");
  } else {
    fail("SW must use firebase-app-compat and firebase-messaging-compat");
  }

  // Ne doit pas utiliser ESM import (incompatible avec les SW classiques)
  if (sw.includes("import {")) {
    fail("SW must NOT use ESM import{} - use importScripts instead");
  } else {
    ok("SW has no ESM imports - correct");
  }
}

if (process.exitCode) {
  console.error("[VERIFY] BUILD VERIFICATION FAILED");
  process.exit(1);
} else {
  console.log("[VERIFY] BUILD VERIFICATION PASSED");
}

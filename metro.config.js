const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// (Optionnel) Si tu utilises des extensions particulières, tu peux les ajouter ici.
// Par défaut Expo gère déjà .js .jsx .ts .tsx .json .wasm etc.
// Exemple pour s’assurer des extensions web :
config.resolver.sourceExts = Array.from(new Set([
  ...(config.resolver.sourceExts || []),
  "web.js","web.ts","web.tsx","js","jsx","ts","tsx","json"
]));

module.exports = config;

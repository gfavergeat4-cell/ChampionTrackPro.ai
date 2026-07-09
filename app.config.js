export default {
  expo: {
    name: "ChampionTrackPro",
    slug: "championtrackpro",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    scheme: "championtrackpro",
    owner: "favergab",
    ios: { bundleIdentifier: "com.championtrackpro.app" },
    android: { package: "com.championtrackpro.app" },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
      output: "single",
      entryPoint: "./index.web.js",
      name: "ChampionTrackPro",
      shortName: "ChampionTrackPro",
      description: "The Training Intelligence",
      themeColor: "#0A1F3C",
      backgroundColor: "#0A1F3C",
      lang: "en",
      scope: "/",
      startUrl: "/",
      display: "standalone",
      orientation: "portrait",
      // Les fichiers dans public/ sont automatiquement copiés dans le build web
    },
    plugins: ["expo-font"],
    extra: {
      eas: { projectId: "265f2c6f-c23c-46ba-b6ae-43fdf41bb497" }
    }
  }
};


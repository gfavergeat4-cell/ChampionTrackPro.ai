import React from "react";
import { Platform, Image } from "react-native";

const nativeLogoSource = require("../../public/logo/logo_nobackground.png");

export default function ChampionTrackProLogo() {
  if (Platform.OS === "web") {
    return (
      <img
        src="/logo/logo_bon.png"
        alt=""
        style={{ width: 300, maxWidth: "80%", height: "auto", display: "block", margin: "0 auto" }}
      />
    );
  }
  return (
    <Image
      source={nativeLogoSource}
      style={{ width: 280, height: 80, backgroundColor: "transparent" }}
      resizeMode="contain"
      accessibilityLabel="ChampionTrackPro"
    />
  );
}

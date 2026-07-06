import React from "react";
import ChampionTrackProLogo from "./ChampionTrackProLogo";

export default function BrandHeader() {
  return (
    <div style={{
      width: "100%",
      textAlign: "center",
      userSelect: "none",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: "16px",
      paddingRight: "16px",
      paddingTop: "24px",
      position: "relative",
      background: "none",
      backgroundColor: "transparent",
      border: "none",
    }}>
      <ChampionTrackProLogo />
    </div>
  );
}


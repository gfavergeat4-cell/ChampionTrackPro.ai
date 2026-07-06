import React, { useEffect, useRef, useState } from "react";

type Props = { children: React.ReactNode; width?: number; height?: number };

export default function MobileViewport({ children, width = 390, height = 844 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [screenSize, setScreenSize] = useState({ isMobile: false, isTablet: false, isDesktop: false });

  useEffect(() => {
    const checkScreenSize = () => {
      const windowWidth = window.innerWidth;
      const isMobileDevice = windowWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTabletDevice = windowWidth > 768 && windowWidth <= 1024;
      const isDesktopDevice = windowWidth > 1024;
      
      setScreenSize({
        isMobile: isMobileDevice,
        isTablet: isTabletDevice,
        isDesktop: isDesktopDevice
      });
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Sur mobile : plein écran sans bordure
  if (screenSize.isMobile) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "linear-gradient(180deg, #0E1528 0%, #000 100%)",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {children}
      </div>
    );
  }

  // Sur tablette : taille adaptée avec bordure arrondie
  if (screenSize.isTablet) {
    const tabletWidth = Math.min(width * 1.2, window.innerWidth * 0.8);
    const tabletHeight = Math.min(height * 1.2, window.innerHeight * 0.9);
    
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "linear-gradient(180deg, #0E1528 0%, #000 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          ref={containerRef}
          style={{
            width: `${tabletWidth}px`,
            height: `${tabletHeight}px`,
            borderRadius: "20px",
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            background: "transparent",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Sur desktop : mobile centré avec bordure arrondie
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(180deg, #0E1528 0%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        ref={containerRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: "24px",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          background: "transparent",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
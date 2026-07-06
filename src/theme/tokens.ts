export const tokens = {
  colors: {
    // Backgrounds
    bg: "#0A0F1B", // Deep navy blue-black
    bgSecondary: "#1A1A2E", // Slightly lighter dark blue
    surface: "#2C2C4A", // Card backgrounds
    surfaceHover: "#3A3A5C", // Hover states
    
    // Text
    text: "#FFFFFF",
    textSecondary: "#A0A2A8", // Light gray for secondary text
    textMuted: "#6B7280", // Muted text
    
    // Accents
    accentBlue: "#4A90E2", // Medium blue
    accentCyan: "#00C2FF", // Bright cyan
    accentPurple: "#6A5CFF", // Purple accent
    accentGradient: ["#00C2FF", "#6A5CFF"], // Main gradient
    
    // Status
    success: "#22C55E",
    warning: "#F59E0B", 
    danger: "#EF4444",
    info: "#3B82F6",
    
    // Interactive
    primary: "#00C2FF",
    primaryHover: "#00A8E6",
    secondary: "#4A90E2",
    secondaryHover: "#3A7BC7"
  },
  
  gradients: {
    primary: ["#00C2FF", "#6A5CFF"], // Main brand gradient
    secondary: ["#4A90E2", "#00C2FF"], // Secondary gradient
    success: ["#22C55E", "#16A34A"],
    warning: ["#F59E0B", "#D97706"],
    danger: ["#EF4444", "#DC2626"],
    surface: ["#2C2C4A", "#1A1A2E"] // Subtle surface gradient
  },
  
  radii: { 
    xs: 4, 
    sm: 8, 
    md: 12, 
    lg: 16, 
    xl: 20, 
    xxl: 24,
    full: 9999
  },
  
  spacing: { 
    xs: 4, 
    sm: 8, 
    md: 12, 
    lg: 16, 
    xl: 24, 
    xxl: 32,
    xxxl: 48
  },
  
  shadows: {
    glow: {
      shadowColor: "#00C2FF",
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8
    },
    glowPurple: {
      shadowColor: "#6A5CFF", 
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6
    },
    card: {
      shadowColor: "#000000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4
    },
    button: {
      shadowColor: "#00C2FF",
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5
    }
  },
  
  typography: {
    ui: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    brand: "Cinzel, serif",
    mono: "JetBrains Mono, monospace"
  },
  
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 48
  },
  
  fontWeights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },
  
  animations: {
    fast: 150,
    normal: 250,
    slow: 350
  },
  
  // Responsive breakpoints
  breakpoints: {
    xs: 480,    // Mobile small
    sm: 768,    // Mobile large
    md: 1024,   // Tablet
    lg: 1280,   // Laptop
    xl: 1536,   // Desktop
    xxl: 1920   // Large desktop
  },
  
  // Responsive spacing
  responsiveSpacing: {
    xs: { xs: 4, sm: 6, md: 8, lg: 10, xl: 12 },
    sm: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 },
    md: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 },
    lg: { xs: 16, sm: 20, md: 24, lg: 32, xl: 40 },
    xl: { xs: 24, sm: 32, md: 40, lg: 48, xl: 64 }
  },
  
  // Responsive font sizes
  responsiveFontSizes: {
    xs: { xs: 10, sm: 11, md: 12, lg: 13, xl: 14 },
    sm: { xs: 12, sm: 13, md: 14, lg: 15, xl: 16 },
    md: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 },
    lg: { xs: 16, sm: 17, md: 18, lg: 19, xl: 20 },
    xl: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 },
    xxl: { xs: 20, sm: 24, md: 28, lg: 32, xl: 36 },
    xxxl: { xs: 24, sm: 28, md: 32, lg: 36, xl: 40 },
    display: { xs: 32, sm: 40, md: 48, lg: 56, xl: 64 }
  }
} as const;


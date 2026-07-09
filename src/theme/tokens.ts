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


// ── DA v2 — « Stadium at night » (docs/03_DIRECTION_ARTISTIQUE.md) ──────────
// Export ADDITIF : les écrans migrés Supabase consomment `da`, les anciens
// écrans gardent `tokens` jusqu'à leur migration. Source de vérité : doc 03.
export const da = {
  bg: {
    void: "#070B14",     // fond racine
    court: "#0A0F1E",    // fond écrans
  },
  surface: {
    s1: "#0E1528",       // cartes
    s2: "#131C33",       // cartes surélevées, modales
  },
  line: {
    dim: "rgba(0,212,255,0.14)",
    focus: "rgba(0,212,255,0.35)",  // bordure de l'élément qui demande la décision
  },
  accent: {
    cyan: "#00D4FF",     // action/focus — jamais décoratif
    deep: "#0066FF",
  },
  state: {
    green: "#00C853",    // zone GREEN — sacrée (langage Morin)
    blue: "#2196F3",     // zone BLUE
    yellow: "#FFB800",   // zone YELLOW
    red: "#EF4444",      // flags priorité 1 uniquement
    insufficient: "rgba(255,255,255,0.25)",
  },
  text: {
    hi: "#FFFFFF",
    mid: "#9CA3AF",
    low: "rgba(255,255,255,0.45)",
  },
  radius: { card: 12, control: 8, pill: 999 },
  glow: "0 0 30px rgba(0,180,255,0.25)", // UN seul élément lumineux par écran
} as const;


// ── Courtlight v3 — langage visuel propriétaire (docs/06_REDESIGN_COURTLIGHT.md) ──
// Étend `da` vers une identité complète. Fond #070B14, vignette radiale,
// trois plans de matière (Court/Cartes/Verre), physique spring & settle.
// Typographie : Marcellus (marque) + Inter 300-600 (UI). Source : doc 06 §3.
export const courtlight = {
  bg: {
    court: "#070B14",
    vignette: "radial-gradient(1200px 800px at 50% -10%, #0D2545 0%, #070B14 60%)",
  },
  surface: {
    card: "rgba(17,26,45,0.92)",   // cartes graphite
    glass: "rgba(19,28,51,0.66)",  // verre de focus — translucide, halo cyan
  },
  edge: {
    rim: "inset 0 1px 0 rgba(160,220,255,0.10)",  // liseré zénithal (1 px haut)
    hair: "1px solid rgba(0,212,255,0.10)",        // séparateur subtil
  },
  shadow: {
    e1: "0 8px 24px rgba(0,0,0,0.45)",              // carte
    e2: "0 16px 48px rgba(0,0,0,0.55)",              // verre de focus
    glowFocus: "0 0 40px rgba(0,180,255,0.22)",      // UN par écran
  },
  zoneGlow: {
    GREEN:  "0 0 18px rgba(0,200,83,0.45)",
    BLUE:   "0 0 18px rgba(33,150,243,0.45)",
    YELLOW: "0 0 18px rgba(255,184,0,0.50)",
    NONE:   "none",
  },
  zone: {
    GREEN:  "#00C853",
    BLUE:   "#2196F3",
    YELLOW: "#FFB800",
  },
  text: {
    hi:  "#FFFFFF",
    mid: "#9CA3AF",
    low: "rgba(255,255,255,0.45)",
  },
  accent: {
    cyan: "#00D4FF",
    deep: "#0066FF",
  },
  motion: {
    spring: "cubic-bezier(0.34, 1.3, 0.44, 1)",
    settle: "cubic-bezier(0.22, 1, 0.36, 1)",
    fast: 140,   // ms
    base: 260,
    hero: 600,   // count-up matinal — max absolu 700
  },
  radius: { card: 16, control: 10, halo: 999 },
  type: {
    brand: "'Marcellus', serif",                       // identité, capitales
    ui: "'Inter', -apple-system, sans-serif",          // interface
    mono: "'JetBrains Mono', monospace",
    weights: { light: "300", regular: "400", medium: "500", semibold: "600" } as const,
    // Grands chiffres : Inter Light 300 + fontVariantNumeric: 'tabular-nums'
    // Labels : petites capitales 11 px, letterSpacing +16 % (+0.16em)
  },
} as const;

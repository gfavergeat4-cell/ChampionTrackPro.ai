import { tokens } from '../theme/tokens';
import { DeviceInfo } from '../hooks/useDevice';

// Fonction pour obtenir la valeur responsive
export const getResponsiveValue = <T>(
  values: Record<string, T>,
  device?: DeviceInfo
): T => {
  // Vérifier si device est défini
  if (!device || !device.breakpoint) {
    // Retourner une valeur par défaut (xs ou la première valeur disponible)
    return values.xs || Object.values(values)[0];
  }
  
  const { breakpoint } = device;
  
  // Retourne la valeur pour le breakpoint actuel
  return values[breakpoint] || values.xs || Object.values(values)[0];
};

// Fonction pour obtenir l'espacement responsive
export const getResponsiveSpacing = (
  size: keyof typeof tokens.responsiveSpacing,
  device?: DeviceInfo
): number => {
  return getResponsiveValue(tokens.responsiveSpacing[size], device);
};

// Fonction pour obtenir la taille de police responsive
export const getResponsiveFontSize = (
  size: keyof typeof tokens.responsiveFontSizes,
  device?: DeviceInfo
): number => {
  return getResponsiveValue(tokens.responsiveFontSizes[size], device);
};

// Fonction pour obtenir le nombre de colonnes selon l'écran
export const getGridColumns = (device: DeviceInfo): number => {
  if (device.isMobile) return 1;
  if (device.isTablet) return 2;
  if (device.isDesktop) return 3;
  return 4;
};

// Fonction pour obtenir la largeur maximale du contenu
export const getMaxContentWidth = (device: DeviceInfo): number => {
  if (device.isMobile) return device.screenWidth;
  if (device.isTablet) return 768;
  if (device.isDesktop) return 1200;
  return 1400;
};

// Fonction pour déterminer si on doit afficher la navigation bottom
export const shouldShowBottomNavigation = (device: DeviceInfo): boolean => {
  return device.isMobile || device.isTablet;
};

// Fonction pour déterminer si on doit afficher la sidebar
export const shouldShowSidebar = (device: DeviceInfo): boolean => {
  return device.isDesktop;
};

// Fonction pour obtenir le padding du conteneur
export const getContainerPadding = (device: DeviceInfo): number => {
  if (device.isMobile) return getResponsiveSpacing('md', device);
  if (device.isTablet) return getResponsiveSpacing('lg', device);
  return getResponsiveSpacing('xl', device);
};

// Fonction pour obtenir la hauteur de la navigation
export const getNavigationHeight = (device: DeviceInfo): number => {
  if (device.isWeb) return 60; // Web header
  if (device.isMobile) return 80; // Mobile avec status bar
  return 60; // Default
};

// Fonction pour obtenir le style de la grille
export const getGridStyle = (device: DeviceInfo) => {
  const columns = getGridColumns(device);
  const gap = getResponsiveSpacing('md', device);
  
  return {
    display: 'flex',
    flexDirection: device.isMobile ? 'column' : 'row',
    flexWrap: 'wrap',
    gap,
    justifyContent: device.isMobile ? 'center' : 'flex-start'
  };
};

// Fonction pour obtenir le style du conteneur principal
export const getMainContainerStyle = (device: DeviceInfo) => {
  const maxWidth = getMaxContentWidth(device);
  const padding = getContainerPadding(device);
  
  return {
    flex: 1,
    maxWidth: device.isDesktop ? maxWidth : '100%',
    marginHorizontal: device.isDesktop ? 'auto' : 0,
    paddingHorizontal: padding,
    paddingTop: getNavigationHeight(device)
  };
};








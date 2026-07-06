import { useState, useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';

interface DeviceInfo {
  isWeb: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  orientation: 'portrait' | 'landscape';
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export const useDevice = (): DeviceInfo => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const isWeb = Platform.OS === 'web';
  const screenWidth = dimensions.width;
  const screenHeight = dimensions.height;
  
  // Breakpoints responsive
  const getBreakpoint = (width: number): DeviceInfo['breakpoint'] => {
    if (width < 480) return 'xs';      // Mobile small
    if (width < 768) return 'sm';      // Mobile large
    if (width < 1024) return 'md';     // Tablet
    if (width < 1280) return 'lg';     // Laptop
    if (width < 1536) return 'xl';     // Desktop
    return 'xxl';                      // Large desktop
  };

  const breakpoint = getBreakpoint(screenWidth);
  
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
  const isTablet = breakpoint === 'md';
  const isDesktop = breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === 'xxl';
  
  const orientation = screenHeight > screenWidth ? 'portrait' : 'landscape';

  return {
    isWeb,
    isMobile,
    isTablet,
    isDesktop,
    screenWidth,
    screenHeight,
    orientation,
    breakpoint
  };
};













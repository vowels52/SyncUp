// Light theme colors
const lightColors = {
  // Primary Brand Colors
  primary: '#24284b',      // Dark blue from logo
  primaryDark: '#1a1d35',  // Darker version
  primaryLight: '#3d4268', // Lighter version

  // Accent Colors
  accent: '#e19e5f',       // Gray orange from logo
  accentLight: '#f0c9a3',  // Lighter orange

  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#eeeef0',       // Light gray from logo
  gray100: '#e5e5e8',
  gray200: '#d5d5da',
  gray300: '#c5c5cc',
  gray400: '#9a9aa5',
  gray500: '#757582',
  gray600: '#545671',      // Gray blue from logo
  gray700: '#846351',      // Darker gray orange from logo
  gray800: '#5a4438',
  gray900: '#24284b',      // Dark blue

  // Semantic Colors
  success: '#4CAF50',
  warning: '#e19e5f',      // Using accent orange for warnings
  error: '#F44336',
  info: '#545671',         // Using gray blue for info

  // Background Colors
  background: '#f5f5f7',   // Slightly lighter gray for better contrast
  surface: '#FFFFFF',
  overlay: 'rgba(36, 40, 75, 0.5)', // Using dark blue for overlay

  // Text Colors
  text: '#1a1d35',         // Even darker blue for better contrast
  textPrimary: '#1a1d35',  // Very dark blue for primary text
  textSecondary: '#3d4268', // Darker gray blue for better visibility
  textDisabled: '#757582',  // Darker disabled text
  textOnPrimary: '#FFFFFF',
};

// Dark theme colors
const darkColors = {
  // Primary Brand Colors
  primary: '#3d4268',      // Lighter version of dark blue for dark mode
  primaryDark: '#24284b',  // Original dark blue
  primaryLight: '#5a5f8f', // Even lighter

  // Accent Colors
  accent: '#e19e5f',       // Gray orange from logo (same as light)
  accentLight: '#f0c9a3',  // Lighter orange

  // Neutral Colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#1a1d35',       // Very dark blue
  gray100: '#24284b',      // Dark blue
  gray200: '#2f3357',
  gray300: '#3d4268',
  gray400: '#545671',      // Gray blue from logo
  gray500: '#6d7088',
  gray600: '#9a9aa5',
  gray700: '#c5c5cc',
  gray800: '#d5d5da',
  gray900: '#eeeef0',      // Light gray

  // Semantic Colors
  success: '#66BB6A',
  warning: '#e19e5f',      // Using accent orange
  error: '#EF5350',
  info: '#6d7088',         // Lighter gray blue for dark mode

  // Background Colors
  background: '#1a1d35',   // Very dark blue
  surface: '#24284b',      // Dark blue for surfaces
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Text Colors
  text: '#FFFFFF',         // Pure white for better contrast
  textPrimary: '#FFFFFF',  // Pure white for primary text
  textSecondary: '#c5c5cc', // Much lighter gray for better visibility
  textDisabled: '#9a9aa5',  // Lighter disabled text
  textOnPrimary: '#1a1d35', // Dark text on primary color
};

// Default export for backward compatibility (light mode)
export const colors = lightColors;

// Export function to get colors based on theme
export const getColors = (isDarkMode: boolean) => {
  return isDarkMode ? darkColors : lightColors;
};

export const typography = {
  // Font Families
  fontRegular: 'System',
  fontMedium: 'System',
  fontBold: 'System',
  
  // Font Sizes
  fontSize10: 10,
  fontSize12: 12,
  fontSize14: 14,
  fontSize16: 16,
  fontSize18: 18,
  fontSize20: 20,
  fontSize24: 24,
  fontSize28: 28,
  fontSize32: 32,
  fontSize40: 40,
  
  // Font Weights
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
  
  // Line Heights
  lineHeight16: 16,
  lineHeight20: 20,
  lineHeight24: 24,
  lineHeight28: 28,
  lineHeight32: 32,
  lineHeight40: 40,
  lineHeight48: 48,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const shadows = {
  small: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const layout = {
  screenPadding: spacing.md,
  cardPadding: spacing.md,
  sectionSpacing: spacing.lg,
  itemSpacing: spacing.md,
};

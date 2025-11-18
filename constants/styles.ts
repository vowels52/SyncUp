import { StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows, getColors } from './theme';

// Static styles for backward compatibility (light mode)
export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
  },
  cardLarge: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shadow: shadows.small,
  shadowMedium: shadows.medium,
  shadowLarge: shadows.large,
});

export const textStyles = StyleSheet.create({
  h1: {
    fontSize: typography.fontSize32,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight40,
  },
  h2: {
    fontSize: typography.fontSize28,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight32,
  },
  h3: {
    fontSize: typography.fontSize24,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight32,
  },
  h4: {
    fontSize: typography.fontSize20,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight28,
  },
  body1: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeightRegular,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight24,
  },
  body2: {
    fontSize: typography.fontSize14,
    fontWeight: typography.fontWeightRegular,
    color: colors.textPrimary,
    lineHeight: typography.lineHeight20,
  },
  caption: {
    fontSize: typography.fontSize12,
    fontWeight: typography.fontWeightRegular,
    color: colors.textSecondary,
    lineHeight: typography.lineHeight16,
  },
  button: {
    fontSize: typography.fontSize16,
    fontWeight: typography.fontWeightSemiBold,
    lineHeight: typography.lineHeight24,
  },
});

// Themed styles - use these for dark mode support
export const getCommonStyles = (isDarkMode: boolean) => {
  const themeColors = getColors(isDarkMode);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    screenContainer: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      ...shadows.small,
    },
    cardLarge: {
      backgroundColor: themeColors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.medium,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    shadow: shadows.small,
    shadowMedium: shadows.medium,
    shadowLarge: shadows.large,
  });
};

export const getTextStyles = (isDarkMode: boolean) => {
  const themeColors = getColors(isDarkMode);

  return StyleSheet.create({
    h1: {
      fontSize: typography.fontSize32,
      fontWeight: typography.fontWeightBold,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight40,
    },
    h2: {
      fontSize: typography.fontSize28,
      fontWeight: typography.fontWeightBold,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight32,
    },
    h3: {
      fontSize: typography.fontSize24,
      fontWeight: typography.fontWeightSemiBold,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight32,
    },
    h4: {
      fontSize: typography.fontSize20,
      fontWeight: typography.fontWeightSemiBold,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight28,
    },
    body1: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightRegular,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight24,
    },
    body2: {
      fontSize: typography.fontSize14,
      fontWeight: typography.fontWeightRegular,
      color: themeColors.textPrimary,
      lineHeight: typography.lineHeight20,
    },
    caption: {
      fontSize: typography.fontSize12,
      fontWeight: typography.fontWeightRegular,
      color: themeColors.textSecondary,
      lineHeight: typography.lineHeight16,
    },
    button: {
      fontSize: typography.fontSize16,
      fontWeight: typography.fontWeightSemiBold,
      lineHeight: typography.lineHeight24,
    },
  });
};

import { useTheme } from '@/template';
import { getCommonStyles, getTextStyles } from '@/constants/styles';

/**
 * Hook to get common and text styles based on the current theme
 * Returns themed versions of commonStyles and textStyles
 */
export function useThemedStyles() {
  const { isDarkMode } = useTheme();

  return {
    commonStyles: getCommonStyles(isDarkMode),
    textStyles: getTextStyles(isDarkMode),
  };
}

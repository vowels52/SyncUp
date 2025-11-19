import { getColors } from '@/constants/theme';
import { useTheme } from '@/template';

/**
 * Hook to get colors based on the current theme (light/dark mode)
 * Returns the appropriate color palette for the active theme
 */
export function useThemedColors() {
  const { isDarkMode } = useTheme();
  return getColors(isDarkMode);
}

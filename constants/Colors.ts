/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#24284b';  // Dark blue from logo
const tintColorDark = '#e19e5f';   // Gray orange from logo

export const Colors = {
  light: {
    text: '#1a1d35',      // Very dark blue for better contrast
    background: '#f5f5f7', // Lighter gray
    tint: tintColorLight,
    icon: '#3d4268',      // Darker blue for better visibility
    tabIconDefault: '#545671',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FFFFFF',      // Pure white for better contrast
    background: '#1a1d35', // Very dark blue
    tint: tintColorDark,
    icon: '#c5c5cc',      // Much lighter gray for visibility
    tabIconDefault: '#c5c5cc',
    tabIconSelected: tintColorDark,
  },
};

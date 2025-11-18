# Dark Mode Implementation Guide

This guide explains how dark mode is implemented in SyncUp and how to use it in your components.

## Overview

Dark mode has been fully implemented with three modes:
- **Light Mode**: Traditional light theme
- **Dark Mode**: Dark theme optimized for low-light environments
- **Auto Mode**: Automatically follows system theme preferences

## How It Works

### 1. Theme Configuration (`constants/theme.ts`)

The theme file contains two color palettes:
- `lightColors`: Colors for light mode
- `darkColors`: Colors for dark mode
- `getColors(isDarkMode)`: Function to get the appropriate palette

### 2. Theme Provider (`template/theme/context.tsx`)

The `ThemeProvider` manages theme state and persistence:
- Stores user preference in AsyncStorage
- Provides `themeMode`, `isDarkMode`, and `setThemeMode` via context
- Supports 'light', 'dark', and 'auto' modes

### 3. Root Layout (`app/_layout.tsx`)

The app is wrapped with `ThemeProvider` at the root level, making theme available throughout the app.

## Using Dark Mode in Components

### Method 1: Using the `useThemedColors` Hook (Recommended)

This is the simplest way to get themed colors:

```tsx
import { useThemedColors } from '@/hooks/useThemedColors';

export default function MyComponent() {
  const colors = useThemedColors();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
    },
    text: {
      color: colors.textPrimary,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello World</Text>
    </View>
  );
}
```

### Method 2: Using the Theme Context Directly

For more control over theme state:

```tsx
import { useTheme } from '@/template';
import { getColors } from '@/constants/theme';

export default function MyComponent() {
  const { themeMode, isDarkMode, setThemeMode } = useTheme();
  const colors = getColors(isDarkMode);

  // Check current theme mode
  console.log('Current mode:', themeMode); // 'light', 'dark', or 'auto'

  // Toggle dark mode
  const toggleDarkMode = () => {
    setThemeMode(isDarkMode ? 'light' : 'dark');
  };

  return (
    <View style={{ backgroundColor: colors.background }}>
      <Button onPress={toggleDarkMode} title="Toggle Dark Mode" />
    </View>
  );
}
```

## Available Color Properties

Both light and dark color palettes include:

### Brand Colors
- `primary` - Primary brand color
- `primaryDark` - Darker shade of primary
- `primaryLight` - Lighter shade of primary
- `accent` - Accent color
- `accentLight` - Lighter shade of accent

### Neutral Colors
- `white`, `black`
- `gray50` through `gray900` (9 shades)

### Semantic Colors
- `success` - Green for success states
- `warning` - Orange for warnings
- `error` - Red for errors
- `info` - Blue for informational messages

### Background & Surface
- `background` - Main background color
- `surface` - Card/surface color
- `overlay` - Semi-transparent overlay

### Text Colors
- `text` - Default text color
- `textPrimary` - Primary text color
- `textSecondary` - Secondary/muted text
- `textDisabled` - Disabled text
- `textOnPrimary` - Text on primary color backgrounds

## Example: Converting Existing Component

### Before (Static Colors)
```tsx
import { colors } from '@/constants/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background, // Always light
  },
});
```

### After (Dynamic Colors)
```tsx
import { useThemedColors } from '@/hooks/useThemedColors';

function MyComponent() {
  const colors = useThemedColors();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background, // Respects theme
    },
  });

  return <View style={styles.container} />;
}
```

## Settings Toggle

Dark mode can be toggled in the app:
1. Navigate to **Profile** screen
2. Under **Appearance** section:
   - Toggle **Dark Mode** switch for manual control
   - Tap **Auto (System)** to follow system preferences

## Theme Persistence

User theme preferences are automatically saved and restored:
- Stored in AsyncStorage under `@syncup_theme_mode`
- Persists across app restarts
- No additional setup needed

## Best Practices

1. **Always use themed colors** instead of hardcoded hex values
2. **Use `useThemedColors` hook** for simplicity
3. **Move StyleSheet inside components** when using themed colors (see profile.tsx example)
4. **Test both themes** when designing new UI
5. **Use semantic colors** (success, error, warning) for consistency

## Files Modified

- `constants/theme.ts` - Added dark color palette
- `template/theme/context.tsx` - Theme provider (new)
- `template/index.ts` - Export theme utilities
- `app/_layout.tsx` - Wrapped with ThemeProvider
- `hooks/useThemedColors.ts` - Convenience hook (new)
- `app/profile.tsx` - Example implementation with toggle

## Troubleshooting

### Colors not updating when theme changes
- Ensure StyleSheet is created inside the component, not outside
- Make sure you're using `useThemedColors()` or `getColors(isDarkMode)`

### Theme not persisting
- Check that AsyncStorage is properly set up
- Verify ThemeProvider is at the root level

### Can't access theme context
- Ensure component is inside ThemeProvider
- Import from correct location: `import { useTheme } from '@/template'`

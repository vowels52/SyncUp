import { Stack } from 'expo-router';
import { AuthProvider, AlertProvider } from '@/template';

export default function RootLayout() {
  return (
    <AlertProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{
              headerShown: false,
              presentation: 'modal'
            }}
          />
          <Stack.Screen
            name="club-detail"
            options={{
              headerShown: false,
              presentation: 'card'
            }}
          />
        </Stack>
      </AuthProvider>
    </AlertProvider>
  );
}

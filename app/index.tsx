import { AuthRouter } from '@/template';
import { Redirect } from 'expo-router';

export default function RootScreen() {
  return (
    <AuthRouter loginRoute="/auth">
      <Redirect href="/(tabs)" />
    </AuthRouter>
  );
}

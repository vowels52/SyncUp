import { useEffect, useState } from 'react';
import { AuthRouter, useAuth } from '@/template';
import { Redirect } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { View, ActivityIndicator } from 'react-native';
import { useThemedColors } from '@/hooks/useThemedColors';

function ProfileCheck() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const colors = useThemedColors();

  useEffect(() => {
    checkProfile();
  }, [user]);

  const checkProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name, major, year')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Check if user has completed their profile
      const profileComplete = data && data.full_name && data.major && data.year;
      setHasProfile(!!profileComplete);
    } catch (error) {
      console.error('Error checking profile:', error);
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={hasProfile ? '/(tabs)' : '/onboarding'} />;
}

export default function RootScreen() {
  return (
    <AuthRouter loginRoute="/auth">
      <ProfileCheck />
    </AuthRouter>
  );
}

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth, useAlert } from '@/template';
import { useRouter } from 'expo-router';
import { typography, spacing, borderRadius, shadows } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@/hooks/useThemedColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function AuthScreen() {
  const colors = useThemedColors();
  const { commonStyles, textStyles } = useThemedStyles();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, signUpWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const validateEmail = (email: string) => {
    const eduRegex = /^[^\s@]+@[^\s@]+\.edu$/;
    return eduRegex.test(email);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      showAlert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      showAlert('Invalid Email', 'Please use your university email address (.edu)');
      return;
    }

    if (isLogin) {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        showAlert('Login Failed', error);
      } else {
        router.replace('/(tabs)');
      }
    } else {
      if (password !== confirmPassword) {
        showAlert('Error', 'Passwords do not match');
        return;
      }

      if (password.length < 6) {
        showAlert('Error', 'Password must be at least 6 characters');
        return;
      }

      const { error } = await sendOTP(email);
      if (error) {
        showAlert('Error', error);
      } else {
        setShowOtpInput(true);
        showAlert('OTP Sent', 'Please check your email for verification code');
      }
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      showAlert('Error', 'Please enter the verification code');
      return;
    }

    const { error } = await verifyOTPAndLogin(email, otp, { password });
    if (error) {
      showAlert('Verification Failed', error);
    } else {
      router.replace('/onboarding');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    header: {
      alignItems: 'center',
      marginTop: spacing.xxl,
      marginBottom: spacing.xl,
    },
    logoContainer: {
      marginBottom: spacing.md,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...shadows.medium,
    },
    title: {
      ...textStyles.h1,
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    subtitle: {
      ...textStyles.body1,
      color: colors.textSecondary,
    },
    form: {
      flex: 1,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    inputIcon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      height: 50,
      fontSize: typography.fontSize16,
      color: colors.textPrimary,
    },
    eyeIcon: {
      padding: spacing.xs,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.md,
      ...shadows.small,
    },
    primaryButtonText: {
      ...textStyles.button,
      color: colors.white,
    },
    switchButton: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
    switchButtonText: {
      ...textStyles.body2,
      color: colors.primary,
    },
    otpTitle: {
      ...textStyles.h3,
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    otpDescription: {
      ...textStyles.body2,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    footer: {
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
    },
    footerText: {
      ...textStyles.caption,
      textAlign: 'center',
      color: colors.textSecondary,
    },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="people" size={48} color={colors.white} />
            </View>
          </View>
          <Text style={styles.title}>SyncUp</Text>
          <Text style={styles.subtitle}>Connect. Collaborate. Succeed.</Text>
        </View>

        {!showOtpInput ? (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="University Email (.edu)"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleAuth}
              disabled={operationLoading}
            >
              {operationLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchButton}>
              <Text style={styles.switchButtonText}>
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.otpTitle}>Verify Your Email</Text>
            <Text style={styles.otpDescription}>
              We sent a verification code to {email}
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons name="key-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter OTP Code"
                placeholderTextColor={colors.textSecondary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleVerifyOTP}
              disabled={operationLoading}
            >
              {operationLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowOtpInput(false)} style={styles.switchButton}>
              <Text style={styles.switchButtonText}>Back to Sign Up</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
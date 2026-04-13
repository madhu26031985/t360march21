import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleGLogo } from '@/components/auth/GoogleGLogo';
import { AppleMark } from '@/components/auth/AppleMark';

export default function Login() {
  const { theme } = useTheme();
  const { signIn, signInWithGoogle, signInWithApple, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    void WebBrowser.maybeCompleteAuthSession();
  }, []);

  // OAuth redirect failures (e.g. Apple) land with ?error=&error_description= from Supabase.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const search = window.location.search;
    if (!search || search.length < 2) return;
    const params = new URLSearchParams(search);
    const desc = params.get('error_description');
    const err = params.get('error');
    if (!err && !desc) return;
    let msg = desc || err || 'Sign in failed';
    try {
      msg = decodeURIComponent(msg.replace(/\+/g, ' '));
    } catch {
      /* keep raw */
    }
    setSignInError(msg);
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      const msg = 'Please enter both email and password';
      setSignInError(msg);
      Alert.alert('Error', msg);
      return;
    }

    setSignInError('');
    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.success) {
        const normalizedError = (result.error || '').toLowerCase();
        const isInvalidCredentialsError =
          normalizedError.includes('invalid login credentials') ||
          normalizedError.includes('invalid credentials') ||
          normalizedError.includes('invalid email or password');

        // Check if it's an email verification error
        if (result.error?.includes('verify your email') ||
            result.error?.includes('verification link') ||
            result.error?.includes('Email not confirmed') ||
            result.error?.includes('email not confirmed')) {
          setSignInError('Please verify your email before signing in.');
          Alert.alert(
            'Email Verification Required',
            'Please check your email and click the verification link before signing in. If you didn\'t receive the email, you can request a new one.',
            [
              {
                text: 'Resend Verification',
                onPress: () => router.push('/forgot-password')
              },
              { text: 'OK' }
            ]
          );
        } else if (isInvalidCredentialsError) {
          const msg = 'Incorrect email or password. Please try again.';
          setSignInError(msg);
          Alert.alert('Sign In Failed', msg);
        } else {
          const msg = result.error || 'Please check your credentials';
          setSignInError(msg);
          Alert.alert('Sign In Failed', msg);
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSignInError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/signup');
  };

  const oauthBusy = googleLoading || appleLoading;

  const handleGoogleSignIn = async () => {
    setSignInError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success && result.error) {
        setSignInError(result.error);
        Alert.alert('Google Sign In', result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign in failed';
      setSignInError(msg);
      Alert.alert('Error', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setSignInError('');
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.success && result.error) {
        setSignInError(result.error);
        Alert.alert('Sign in with Apple', result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apple sign in failed';
      setSignInError(msg);
      Alert.alert('Error', msg);
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/images/yy.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Sign in to T360</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Email Address</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Mail size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={(v) => {
                  if (signInError) setSignInError('');
                  setEmail(v);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Lock size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.colors.textSecondary}
                value={password}
                onChangeText={(v) => {
                  if (signInError) setSignInError('');
                  setPassword(v);
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={16} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={16} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, (isLoading || oauthBusy) && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading || oauthBusy}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
          {signInError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText} maxFontSizeMultiplier={1.3}>{signInError}</Text>
            </View>
          ) : null}

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.orText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              or
            </Text>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (googleLoading || isLoading) && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || isLoading || appleLoading}
            activeOpacity={0.85}
          >
            <View style={styles.googleIconSlot} pointerEvents="none">
              {googleLoading ? (
                <ActivityIndicator color="#f0f6fc" size="small" />
              ) : (
                <GoogleGLogo size={18} />
              )}
            </View>
            <Text style={styles.googleButtonText} maxFontSizeMultiplier={1.2}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.appleButton, (appleLoading || isLoading) && styles.appleButtonDisabled]}
            onPress={handleAppleSignIn}
            disabled={appleLoading || isLoading || googleLoading}
            activeOpacity={0.85}
          >
            <View style={styles.appleIconSlot} pointerEvents="none">
              {appleLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <AppleMark size={18} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.appleButtonText} maxFontSizeMultiplier={1.2}>
              Sign in with Apple
            </Text>
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => router.push('/forgot-password')}>
            <Text style={[styles.forgotPasswordText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={[styles.registerPrompt, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Don't have an account?</Text>
          
          <TouchableOpacity style={[styles.registerButton, { borderColor: theme.colors.primary }]} onPress={handleSignUp}>
            <Text style={[styles.registerButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Sign Up</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 13,
    paddingBottom: 19,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 19,
  },
  logoContainer: {
    marginBottom: 13,
  },
  logoImage: {
    width: 83,
    height: 83,
    borderRadius: 42,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  formSection: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 13,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 13,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 6,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    width: '100%',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 13,
    elevation: 6,
  },
  signInButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  errorBanner: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  signInButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
    width: '100%',
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
    minHeight: 1,
    opacity: 0.9,
  },
  orText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 14,
    textTransform: 'lowercase',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#21262d',
    borderWidth: 1,
    borderColor: '#30363d',
    minHeight: 44,
  },
  googleButtonDisabled: {
    opacity: 0.72,
  },
  googleIconSlot: {
    position: 'absolute',
    left: 16,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
    letterSpacing: -0.2,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    minHeight: 44,
  },
  appleButtonDisabled: {
    opacity: 0.72,
  },
  appleIconSlot: {
    position: 'absolute',
    left: 16,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: -11,
  },
  registerPrompt: {
    fontSize: 12,
    marginBottom: 10,
    fontWeight: '500',
  },
  registerButton: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 13,
    paddingVertical: 11,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  registerButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 10,
  },
  forgotPasswordText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

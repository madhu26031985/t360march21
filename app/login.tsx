import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleGLogo } from '@/components/auth/GoogleGLogo';
import { AppleMark } from '@/components/auth/AppleMark';

export default function Login() {
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
    <SafeAreaView style={styles.container}>
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
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Sign in to T360</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formCard}>
        <View style={styles.formSection}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Email address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your email"
                placeholderTextColor="#8b949e"
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
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your password"
                placeholderTextColor="#8b949e"
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
                  <EyeOff size={16} color="#6e7781" />
                ) : (
                  <Eye size={16} color="#6e7781" />
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
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Text>
          </TouchableOpacity>
          {signInError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText} maxFontSizeMultiplier={1.3}>{signInError}</Text>
            </View>
          ) : null}

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: '#d0d7de' }]} />
            <Text style={styles.orText} maxFontSizeMultiplier={1.2}>
              or
            </Text>
            <View style={[styles.orLine, { backgroundColor: '#d0d7de' }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (googleLoading || isLoading) && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading || isLoading || appleLoading}
            activeOpacity={0.85}
          >
            <View style={styles.googleIconSlot} pointerEvents="none">
              {googleLoading ? (
                <ActivityIndicator color="#24292f" size="small" />
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
                <ActivityIndicator color="#24292f" size="small" />
              ) : (
                <AppleMark size={18} color="#24292f" />
              )}
            </View>
            <Text style={styles.appleButtonText} maxFontSizeMultiplier={1.2}>
              Sign in with Apple
            </Text>
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPasswordButton} onPress={() => router.push('/forgot-password')}>
            <Text style={styles.forgotPasswordText} maxFontSizeMultiplier={1.3}>
              Forgot Password?
            </Text>
          </TouchableOpacity>
        </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.registerPrompt} maxFontSizeMultiplier={1.3}>New to T360? </Text>
          <TouchableOpacity onPress={handleSignUp}>
            <Text style={styles.registerLink} maxFontSizeMultiplier={1.3}>Create an account</Text>
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
    backgroundColor: '#f6f8fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    color: '#24292f',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  formSection: {
    marginBottom: 2,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 7,
    color: '#24292f',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d7de',
    paddingHorizontal: 12,
    minHeight: 42,
    backgroundColor: '#ffffff',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#24292f',
  },
  eyeButton: {
    padding: 6,
  },
  signInButton: {
    backgroundColor: '#1f883d',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a7f37',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  errorBanner: {
    marginTop: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff818266',
    backgroundColor: '#ffebe9',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#cf222e',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 6,
    width: '100%',
  },
  orLine: {
    flex: 1,
    height: 1,
    minHeight: 1,
  },
  orText: {
    fontSize: 14,
    color: '#57606a',
    paddingHorizontal: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d7de',
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
    fontWeight: '500',
    color: '#24292f',
    letterSpacing: -0.2,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d7de',
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
    fontWeight: '500',
    color: '#24292f',
    letterSpacing: -0.2,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  registerPrompt: {
    fontSize: 14,
    color: '#57606a',
  },
  registerLink: {
    fontSize: 14,
    color: '#0969da',
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0969da',
  },
});

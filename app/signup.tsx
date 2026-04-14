import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleGLogo } from '@/components/auth/GoogleGLogo';
import { AppleMark } from '@/components/auth/AppleMark';

export default function SignUp() {
  const { theme } = useTheme();
  const { signUp, verifyEmailOtp, resendVerificationEmail, signInWithGoogle, signInWithApple, isAuthenticated } =
    useAuth();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);

  // Refs for OTP inputs
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);

  const oauthBusy = googleLoading || appleLoading;

  useEffect(() => {
    void WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success && result.error) {
        Alert.alert('Google', result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign in failed';
      Alert.alert('Error', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      if (!result.success && result.error) {
        Alert.alert('Sign in with Apple', result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Apple sign in failed';
      Alert.alert('Error', msg);
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSignUp = async () => {
    // Check each field individually for better error messages
    if (!name.trim()) {
      Alert.alert('Error', 'Full name is required');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Email address is required');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Error', 'Password is required');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert('Error', 'Please confirm your password');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await signUp(email, password, name);
      
      if (result.success) {
        if (result.error && result.error.includes('verification link')) {
          // Email confirmation required
          setUserEmail(email.trim());
          setSignUpSuccess(true);
        } else {
          // Direct success (shouldn't happen with email confirmation enabled)
          setUserEmail(email.trim());
          setSignUpSuccess(true);
        }
      } else {
        Alert.alert('Sign Up Failed', result.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    router.replace('/login');
  };

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  const handleOtpChange = (index: number, value: string) => {
    // Handle only single digit
    if (value.length > 1) {
      value = value.charAt(value.length - 1);
    }

    const newOtpDigits = [...otpDigits];
    newOtpDigits[index] = value;
    setOtpDigits(newOtpDigits);
    setVerificationCode(newOtpDigits.join(''));

    // Auto-focus next input when digit is entered
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    // Move to previous input on backspace if current input is empty
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }
    if (verificationCode.trim().length !== 6 || !/^\d{6}$/.test(verificationCode.trim())) {
      Alert.alert('Error', 'Please enter a valid 6-digit code.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await verifyEmailOtp(userEmail, verificationCode.trim());
      if (result.success) {
        Alert.alert('Success', 'Email verified successfully! You can now sign in.');
        router.replace('/login');
      } else {
        Alert.alert('Verification Failed', result.error || 'Invalid code. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred during verification.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const result = await resendVerificationEmail(userEmail);
      if (result.success) {
        Alert.alert('Code Resent', 'A new 6-digit code has been sent to your email.');
      } else {
        Alert.alert('Resend Failed', result.error || 'Failed to resend code. Please try again later.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while resending the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show success screen after successful signup
  if (signUpSuccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.verificationScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.verificationContainer}>
              <View style={styles.verificationLogoContainer}>
                <Image
                  source={require('../assets/images/yy.png')}
                  style={styles.verificationLogoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Verify Your Email
              </Text>

              <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                We've sent a 6-digit verification code to:
              </Text>

              <Text style={[styles.emailAddress, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                {userEmail}
              </Text>

              <Text style={[styles.otpLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Enter Verification Code:
              </Text>

              <View style={styles.otpContainer}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpInputRefs.current[index] = ref)}
                    style={[styles.otpInput, {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface
                    }]}
                    value={otpDigits[index]}
                    onChangeText={(value) => handleOtpChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                    autoFocus={index === 0}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.verifyButton, { backgroundColor: theme.colors.primary, opacity: isLoading ? 0.7 : 1 }]}
                onPress={handleVerifyCode}
                disabled={isLoading}
              >
                <Text style={styles.verifyButtonText} maxFontSizeMultiplier={1.3}>
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendCodeButton}
                onPress={handleResendCode}
                disabled={isLoading}
              >
                <Text style={[styles.resendCodeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  {isLoading ? 'Resending...' : 'Resend Code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.backToLoginButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary, borderWidth: 1 }]}
                onPress={handleBackToLogin}
              >
                <Text style={[styles.backToLoginButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Sign up to continue</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formCard}>
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Full name</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your full name"
                placeholderTextColor="#8b949e"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
          </View>

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Email address</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your email"
                placeholderTextColor="#8b949e"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Create Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Create a password"
                placeholderTextColor="#8b949e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
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

          {/* Confirm Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Confirm password</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Confirm your password"
                placeholderTextColor="#8b949e"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showConfirmPassword ? (
                  <EyeOff size={16} color="#6e7781" />
                ) : (
                  <Eye size={16} color="#6e7781" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, (isLoading || oauthBusy) && styles.signUpButtonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading || oauthBusy}
          >
            <Text style={styles.signUpButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: '#d0d7de' }]} />
            <Text style={styles.orText} maxFontSizeMultiplier={1.2}>
              or
            </Text>
            <View style={[styles.orLine, { backgroundColor: '#d0d7de' }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (googleLoading || isLoading) && styles.googleButtonDisabled]}
            onPress={handleGoogleSignUp}
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
            onPress={handleAppleSignUp}
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
        </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.signInPrompt} maxFontSizeMultiplier={1.3}>Already have an account? </Text>
          <TouchableOpacity onPress={handleSignIn}>
            <Text style={styles.signInLink} maxFontSizeMultiplier={1.3}>Sign in</Text>
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
  signUpButton: {
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
  signUpButtonDisabled: {
    opacity: 0.7,
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
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
  signInPrompt: {
    fontSize: 14,
    color: '#57606a',
  },
  signInLink: {
    fontSize: 14,
    color: '#0969da',
    fontWeight: '600',
  },
  verificationScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  verificationContainer: {
    alignItems: 'center',
    width: '100%',
  },
  verificationLogoContainer: {
    marginBottom: 20,
  },
  verificationLogoImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 6,
  },
  emailAddress: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpLabel: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    width: '100%',
  },
  otpInput: {
    width: 45,
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    fontSize: 20,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  resendCodeButton: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  resendCodeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  backToLoginButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  backToLoginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
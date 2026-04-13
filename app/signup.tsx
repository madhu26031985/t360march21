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
import { User, Mail, Eye, EyeOff, Lock } from 'lucide-react-native';
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create Your Account</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Full Name</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <User size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
          </View>

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
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Create Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Lock size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Create a password"
                placeholderTextColor={theme.colors.textSecondary}
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
                  <EyeOff size={16} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={16} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Confirm Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Lock size={16} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.colors.textSecondary}
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
                  <EyeOff size={16} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={16} color={theme.colors.textSecondary} />
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
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.orText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              or
            </Text>
            <View style={[styles.orLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, (googleLoading || isLoading) && styles.googleButtonDisabled]}
            onPress={handleGoogleSignUp}
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
            onPress={handleAppleSignUp}
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
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={[styles.signInPrompt, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Already have an account?</Text>
          
          <TouchableOpacity style={[styles.signInButton, { backgroundColor: theme.colors.surface }]} onPress={handleSignIn}>
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
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
    paddingTop: 8,
    paddingBottom: 19,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 9,
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
  signUpButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 13,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
  signUpButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  signUpButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
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
    marginTop: 4,
  },
  signInPrompt: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '500',
  },
  signInButton: {
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 13,
    paddingVertical: 10,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  signInButtonText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '700',
    letterSpacing: 0.2,
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
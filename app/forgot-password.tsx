import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Mail, ArrowLeft, Send, Lock, Eye, EyeOff, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPassword() {
  const { theme } = useTheme();
  const { sendPasswordResetOtp, verifyPasswordResetOtp } = useAuth();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const handleSendResetCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Sending password reset OTP for:', email.trim());
      
      const result = await sendPasswordResetOtp(email.trim());

      if (result.success) {
        setOtpSent(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to send reset code');
      }
    } catch (error) {
      console.error('Error sending reset code:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async () => {
    if (!verificationCode.trim()) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    if (verificationCode.trim().length !== 6 || !/^\d{6}$/.test(verificationCode.trim())) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in both password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await verifyPasswordResetOtp(email.trim(), verificationCode.trim(), newPassword.trim());

      if (result.success) {
        setPasswordReset(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const result = await sendPasswordResetOtp(email.trim());
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

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  // Success state after password reset
  if (passwordReset) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.successSection}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/images/yy.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            
            <View style={[styles.successIcon, { backgroundColor: theme.colors.success + '20' }]}>
              <CheckCircle size={32} color={theme.colors.success} />
            </View>
            
            <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Password Reset Successfully!</Text>
            <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your password has been updated. You can now sign in with your new password.
            </Text>

            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleBackToLogin}
            >
              <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // OTP verification and password reset state
  if (otpSent) {
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
            <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Reset Your Password</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              We've sent a 6-digit code to your email
            </Text>
          </View>

          {/* Email Display */}
          <View style={[styles.emailCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.emailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Verification code sent to:
            </Text>
            <Text style={[styles.emailAddress, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {email}
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Verification Code Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Verification Code</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Mail size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text, textAlign: 'center', letterSpacing: 4 }]}
                  placeholder="------"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>New Password</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Lock size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showNewPassword ? (
                    <EyeOff size={20} color={theme.colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Confirm New Password</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Lock size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Confirm new password"
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
                    <EyeOff size={20} color={theme.colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={[styles.requirementsContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.requirementsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Password Requirements:</Text>
              <Text style={[styles.requirementText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                • At least 6 characters long
              </Text>
              <Text style={[styles.requirementText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                • Must match in both fields
              </Text>
            </View>

            {/* Reset Password Button */}
            <TouchableOpacity
              style={[styles.resetPasswordButton, isLoading && styles.resetPasswordButtonDisabled]}
              onPress={handleVerifyAndResetPassword}
              disabled={isLoading}
            >
              <Text style={styles.resetPasswordButtonText} maxFontSizeMultiplier={1.3}>
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </Text>
            </TouchableOpacity>

            {/* Resend Code Button */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={isLoading}
            >
              <Text style={[styles.resendButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                {isLoading ? 'Resending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Initial email input state
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
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Forgot Password?</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Enter your email address and we'll send you a 6-digit code to reset your password.
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Email Address</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Mail size={20} color={theme.colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter your email address"
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Send Reset Code Button */}
          <TouchableOpacity
            style={[styles.sendResetButton, isLoading && styles.sendResetButtonDisabled]}
            onPress={handleSendResetCode}
            disabled={isLoading}
          >
            <Send size={18} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.sendResetButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity 
            style={[styles.backToLoginLink, { borderColor: theme.colors.primary }]} 
            onPress={handleBackToLogin}
          >
            <Text style={[styles.backToLoginLinkText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              Back to Sign In
            </Text>
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
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  emailCard: {
    marginHorizontal: 0,
    marginBottom: 32,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emailLabel: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  emailAddress: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  eyeButton: {
    padding: 8,
  },
  requirementsContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  sendResetButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  sendResetButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  resetPasswordButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  resetPasswordButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  resetPasswordButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  sendResetButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  backToLoginLink: {
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  backToLoginLinkText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Success state styles
  successSection: {
    alignItems: 'center',
    paddingTop: 60,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  signInButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
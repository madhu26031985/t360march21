import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPassword() {
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
      <SafeAreaView style={styles.container}>
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
            
            <Text style={styles.successTitle} maxFontSizeMultiplier={1.3}>Password reset successfully</Text>
            <Text style={styles.successMessage} maxFontSizeMultiplier={1.3}>
              Your password has been updated. You can now sign in with your new password.
            </Text>

            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleBackToLogin}
            >
              <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign in now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // OTP verification and password reset state
  if (otpSent) {
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
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>Reset your password</Text>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
              We've sent a 6-digit code to your email
            </Text>
          </View>

          {/* Email Display */}
          <View style={styles.emailCard}>
            <Text style={styles.emailLabel} maxFontSizeMultiplier={1.3}>
              Verification code sent to:
            </Text>
            <Text style={styles.emailAddress} maxFontSizeMultiplier={1.3}>
              {email}
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formCard}>
          <View style={styles.formSection}>
            {/* Verification Code Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Verification code</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, { textAlign: 'center', letterSpacing: 4 }]}
                  placeholder="------"
                  placeholderTextColor="#8b949e"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>New password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter new password"
                  placeholderTextColor="#8b949e"
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
                    <EyeOff size={16} color="#6e7781" />
                  ) : (
                    <Eye size={16} color="#6e7781" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel} maxFontSizeMultiplier={1.3}>Confirm new password</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm new password"
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

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle} maxFontSizeMultiplier={1.3}>Password requirements:</Text>
              <Text style={styles.requirementText} maxFontSizeMultiplier={1.3}>
                • At least 6 characters long
              </Text>
              <Text style={styles.requirementText} maxFontSizeMultiplier={1.3}>
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
                {isLoading ? 'Resetting password...' : 'Reset password'}
              </Text>
            </TouchableOpacity>

            {/* Resend Code Button */}
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={isLoading}
            >
              <Text style={styles.resendButtonText} maxFontSizeMultiplier={1.3}>
                {isLoading ? 'Resending...' : 'Resend code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backToSignInButton} onPress={handleBackToLogin}>
              <Text style={styles.backToLoginLinkText} maxFontSizeMultiplier={1.3}>
                Back to sign in
              </Text>
            </TouchableOpacity>
          </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Initial email input state
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
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>Forgot password?</Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
            Enter your email address and we'll send you a 6-digit code to reset your password.
          </Text>
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
                placeholder="Enter your email address"
                placeholderTextColor="#8b949e"
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
            <Text style={styles.sendResetButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Sending...' : 'Send reset code'}
            </Text>
          </TouchableOpacity>
        </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity onPress={handleBackToLogin}>
            <Text style={styles.backToLoginLinkText} maxFontSizeMultiplier={1.3}>
              Back to sign in
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    color: '#57606a',
    paddingHorizontal: 10,
  },
  emailCard: {
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d7de',
    backgroundColor: '#ffffff',
    padding: 14,
    alignItems: 'center',
  },
  emailLabel: {
    fontSize: 13,
    marginBottom: 5,
    textAlign: 'center',
    color: '#57606a',
  },
  emailAddress: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: '#0969da',
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
  requirementsContainer: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d0d7de',
    backgroundColor: '#f6f8fa',
    padding: 12,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#24292f',
  },
  requirementText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
    color: '#57606a',
  },
  sendResetButton: {
    backgroundColor: '#1f883d',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a7f37',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendResetButtonDisabled: {
    opacity: 0.7,
  },
  resetPasswordButton: {
    backgroundColor: '#1f883d',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a7f37',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetPasswordButtonDisabled: {
    opacity: 0.7,
  },
  resetPasswordButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  sendResetButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  resendButton: {
    paddingVertical: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  backToSignInButton: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#0969da',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 2,
  },
  backToLoginLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0969da',
  },
  // Success state styles
  successSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    color: '#24292f',
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    paddingHorizontal: 16,
    color: '#57606a',
  },
  signInButton: {
    backgroundColor: '#1f883d',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1a7f37',
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
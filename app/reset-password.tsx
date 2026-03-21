import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield, CircleCheck as CheckCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Constants from 'expo-constants';

export default function ResetPassword() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0];
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [passwordReset, setPasswordReset] = useState(false);

  useEffect(() => {
    console.log('Reset password component mounted');
    console.log('Params received:', params);
    console.log('Token extracted:', token);
    
    if (token) {
      validateToken();
    } else {
      console.log('No token found in URL params');
      Alert.alert('Invalid Link', 'This password reset link is invalid.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    }
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      console.log('No token to validate');
      Alert.alert('Invalid Link', 'This password reset link is invalid.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
      setIsValidatingToken(false);
      return;
    }

    console.log('Validating token:', token);

    try {
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase configuration');
        Alert.alert('Error', 'Configuration error. Please try again later.');
        setIsValidatingToken(false);
        return;
      }
      
      console.log('Making token validation request...');
      const response = await fetch(`${supabaseUrl}/functions/v1/check-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();
      console.log('Token validation result:', result);

      if (result.success) {
        console.log('Token is valid, showing password form');
        setTokenValid(true);
        setUserEmail(result.email);
      } else {
        console.log('Token validation failed:', result.error);
        Alert.alert('Invalid Link', result.error || 'This password reset link is invalid or expired.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
        // Don't set isValidatingToken to false here - keep loading until redirect
        return;
      }
    } catch (error) {
      console.error('Error validating token:', error);
      Alert.alert('Error', 'Failed to validate reset link.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
      // Don't set isValidatingToken to false here - keep loading until redirect
      return;
    } finally {
      // Only set loading to false if token is valid
      if (tokenValid) {
        console.log('Token validation completed, setting loading to false');
        setIsValidatingToken(false);
      }
    }
  };

  const handleResetPassword = async () => {
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
      console.log('Updating password...');
      
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        Alert.alert('Error', 'Configuration error. Please try again later.');
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/update-user-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          token,
          newPassword: newPassword.trim()
        }),
      });

      const result = await response.json();
      console.log('Password update result:', result);

      if (result.success) {
        setPasswordReset(true);
      } else {
        Alert.alert('Error', result.message || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/login');
  };

  // Loading state while validating token
  if (isValidatingToken || !tokenValid) {
    console.log('Rendering token validation loading state');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require('../assets/images/yy.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {isValidatingToken ? 'Validating reset link...' : 'Redirecting...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state after password reset
  if (passwordReset) {
    console.log('Rendering password reset success state');
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
            

            <TouchableOpacity
              style={[styles.backToLoginButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleBackToLogin}
            >
              <Text style={styles.backToLoginButtonText} maxFontSizeMultiplier={1.3}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main password reset form
  console.log('Rendering password reset form');
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
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Reset Your Password</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Please enter your new password below
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* New Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>New Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
          <View style={styles.requirementsContainer}>
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
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <Text style={styles.resetPasswordButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Updating Password...' : 'Update Password'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 30,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 32,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  formSection: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 18,
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
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  // Success state styles
  successSection: {
    alignItems: 'center',
    paddingTop: 60,
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
  backToLoginButton: {
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
  backToLoginButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
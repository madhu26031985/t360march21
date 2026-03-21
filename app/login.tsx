import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { theme } = useTheme();
  const { signIn, isAuthenticated } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.success) {
        // Check if it's an email verification error
        if (result.error?.includes('verify your email') ||
            result.error?.includes('verification link') ||
            result.error?.includes('Email not confirmed') ||
            result.error?.includes('email not confirmed')) {
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
        } else {
          Alert.alert('Sign In Failed', result.error || 'Please check your credentials');
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/signup');
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
                onChangeText={setEmail}
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
                onChangeText={setPassword}
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
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Signing In...' : 'Sign In'}
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
  signInButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.4,
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

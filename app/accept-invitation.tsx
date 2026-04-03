import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Building2, Crown, User, Shield, UserCheck, Eye as EyeIcon } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import Constants from 'expo-constants';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

interface InvitationDetails {
  email: string;
  fullName: string;
  role: string;
  clubName: string;
  clubNumber: string | null;
  inviterName: string;
  inviterEmail: string;
}

export default function AcceptInvitation() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0];
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      Alert.alert('Invalid Link', 'This invitation link is invalid.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
    }
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      Alert.alert('Invalid Link', 'This invitation link is invalid.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
      setIsValidatingToken(false);
      return;
    }

    try {
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        Alert.alert('Error', 'Configuration error. Please try again later.');
        setIsValidatingToken(false);
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invitation?token=${token}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setTokenValid(true);
        setInvitationDetails(result.invitation);
      } else {
        Alert.alert('Invalid Link', result.error || 'This invitation link is invalid or expired.', [
          { text: 'OK', onPress: () => router.replace('/login') }
        ]);
        return;
      }
    } catch (error) {
      console.error('Error validating token:', error);
      Alert.alert('Error', 'Failed to validate invitation link.', [
        { text: 'OK', onPress: () => router.replace('/login') }
      ]);
      return;
    } finally {
      if (tokenValid) {
        setIsValidatingToken(false);
      }
    }
  };

  const handleAcceptInvitation = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in both password fields');
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
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        Alert.alert('Error', 'Configuration error. Please try again later.');
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          token: token,
          password: password.trim()
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAccountCreated(true);
      } else {
        Alert.alert('Error', result.error || 'Failed to accept invitation');
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    router.replace('/login');
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={16} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={16} color="#ffffff" />;
      case 'club_leader': return <Shield size={16} color="#ffffff" />;
      case 'guest': return <EyeIcon size={16} color="#ffffff" />;
      case 'member': return <User size={16} color="#ffffff" />;
      default: return <User size={16} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return EXCOMM_UI.solidBg;
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'Executive Committee Member';
      case 'visiting_tm': return 'Visiting Toastmaster';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  // Loading state while validating token
  if (isValidatingToken || !tokenValid) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Image 
            source={require('../assets/images/yy.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {isValidatingToken ? 'Validating invitation...' : 'Redirecting...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state after account creation
  if (accountCreated) {
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
            
            <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Welcome to T-360!</Text>
            <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your account has been created successfully and you've been added to {invitationDetails?.clubName}.
            </Text>

            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSignIn}
            >
              <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main invitation acceptance form
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Join Your Club</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Complete your registration to join the club
          </Text>
        </View>

        {/* Invitation Details Card */}
        {invitationDetails && (
          <View style={[styles.invitationCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {invitationDetails.clubName}
                </Text>
                <View style={styles.clubMeta}>
                  {invitationDetails.clubNumber && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{invitationDetails.clubNumber}
                    </Text>
                  )}
                  <View style={[styles.roleTag, { backgroundColor: getRoleColor(invitationDetails.role) }]}>
                    {getRoleIcon(invitationDetails.role)}
                    <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(invitationDetails.role)}</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <View style={styles.inviterInfo}>
              <Text style={[styles.inviterText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Invited by {invitationDetails.inviterName}
              </Text>
            </View>
          </View>
        )}

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create Your Password</Text>
          
          {/* Email Display */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Email Address</Text>
            <View style={[styles.emailDisplay, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.emailText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {invitationDetails?.email}
              </Text>
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                ) : (
                  <Eye size={20} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Confirm Password</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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

          {/* Accept Invitation Button */}
          <TouchableOpacity
            style={[styles.acceptButton, isLoading && styles.acceptButtonDisabled]}
            onPress={handleAcceptInvitation}
            disabled={isLoading}
          >
            <Text style={styles.acceptButtonText} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Creating Account...' : 'Accept Invitation & Join Club'}
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 24,
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
  invitationCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  inviterInfo: {
    marginTop: 8,
  },
  inviterText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  formSection: {
    marginBottom: 32,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
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
  emailDisplay: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '500',
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
  acceptButton: {
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
  acceptButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
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
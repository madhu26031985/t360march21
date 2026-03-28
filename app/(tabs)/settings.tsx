import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Share, Platform, KeyboardAvoidingView } from 'react-native';
import { Linking } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { User, CircleHelp as HelpCircle, LogOut, ChevronRight, Building2, Shield, FileText, Trash2, MessageCircle, Share2, DollarSign, Video, Calendar, AlertTriangle, Globe, Linkedin, RefreshCw } from 'lucide-react-native';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  hideBottomBorder?: boolean;
}

function SettingItem({ icon, title, description, onPress, rightElement, showChevron = true, hideBottomBorder }: SettingItemProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.settingItem, { borderBottomColor: theme.colors.border, borderBottomWidth: hideBottomBorder ? 0 : 1 }]} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          {icon}
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
          {description && <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{description}</Text>}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {showChevron && <ChevronRight size={16} color={theme.colors.textSecondary} />}
      </View>
    </TouchableOpacity>
  );
}

// Helper function to show alerts that works on both web and mobile
const showAlert = (title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>) => {
  if (Platform.OS === 'web') {
    // Web: Use window.alert or window.confirm
    if (buttons && buttons.length > 1) {
      // Multiple buttons - use confirm
      const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
      if (confirmed) {
        const confirmButton = buttons.find(b => b.style !== 'cancel');
        confirmButton?.onPress?.();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel');
        cancelButton?.onPress?.();
      }
    } else {
      // Single button or no buttons - use alert
      window.alert(message ? `${title}\n\n${message}` : title);
      buttons?.[0]?.onPress?.();
    }
  } else {
    // Mobile: Use Alert.alert
    Alert.alert(title, message, buttons);
  }
};

export default function Settings() {
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const avatarAbortRef = React.useRef<AbortController | null>(null);

  const handleShareApp = async () => {
    try {
      const message = `Welcome to the T360 App! 👋

We manage our Toastmasters club digitally using T360.

📲 Download the app using the link below:

Android: https://play.google.com/store/apps/details?id=com.toastmaster360.mobile&pcampaignid=web_share

iOS: https://apps.apple.com/in/app/t-360/id6752499801

Once downloaded, sign up and you're all set ✅

Welcome to a seamless digital experience! 🚀`;

      await Share.share({
        message: message,
      });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const handleWhatsAppSupport = async () => {
    try {
      const url = 'https://wa.me/9597491113';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open WhatsApp');
      }
    } catch (error) {
      console.error('Error opening WhatsApp URL:', error);
      showAlert('Error', 'Failed to open WhatsApp');
    }
  };

  const handleHelpSupport = async () => {
    try {
      const url = 'https://t360.in/support';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open support website');
      }
    } catch (error) {
      console.error('Error opening support URL:', error);
      showAlert('Error', 'Failed to open support website');
    }
  };

  const handlePricing = async () => {
    try {
      const url = 'https://t360.in/pricing';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open pricing page');
      }
    } catch (error) {
      console.error('Error opening pricing URL:', error);
      showAlert('Error', 'Failed to open pricing page');
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      const url = 'https://t360.in/privacy';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open privacy policy');
      }
    } catch (error) {
      console.error('Error opening privacy policy URL:', error);
      showAlert('Error', 'Failed to open privacy policy');
    }
  };

  const handleDataProtection = async () => {
    try {
      const url = 'https://t360.in/data-protection';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open data protection');
      }
    } catch (error) {
      console.error('Error opening data protection URL:', error);
      showAlert('Error', 'Failed to open data protection');
    }
  };

  const handleTrainingVideos = async () => {
    try {
      const url = 'https://t360.in/demo';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open training videos');
      }
    } catch (error) {
      console.error('Error opening training videos URL:', error);
      showAlert('Error', 'Failed to open training videos');
    }
  };

  const handleTalkToUs = async () => {
    try {
      const url = 'https://calendly.com/t360-support/demo';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open Calendly');
      }
    } catch (error) {
      console.error('Error opening Calendly URL:', error);
      showAlert('Error', 'Failed to open Calendly');
    }
  };

  const handleLinkedIn = async () => {
    try {
      const url = 'https://www.linkedin.com/in/madhu-sri-82a60b372/';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open LinkedIn');
      }
    } catch (error) {
      console.error('Error opening LinkedIn URL:', error);
      showAlert('Error', 'Failed to open LinkedIn');
    }
  };

  const handleWebsite = async () => {
    try {
      const url = 'https://t360.in/';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert('Error', 'Cannot open website');
      }
    } catch (error) {
      console.error('Error opening website URL:', error);
      showAlert('Error', 'Failed to open website');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showAlert('Error', 'Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);

    try {
      // Call the delete account edge function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user?.id }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Clear local storage
      await AsyncStorage.removeItem('currentClubId');

      // Close modal
      setShowDeleteModal(false);
      setDeleteConfirmation('');

      // Show success message
      showAlert('Account Deleted', 'Your account has been successfully deleted.', [
        {
          text: 'OK',
          onPress: async () => {
            // Sign out and redirect to login
            await signOut();
            router.replace('/login');
          },
        },
      ]);
    } catch (error) {
      console.error('Error deleting account:', error);
      showAlert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      avatarAbortRef.current?.abort();
      avatarAbortRef.current = new AbortController();
      loadUserAvatar(avatarAbortRef.current.signal);
    }
    return () => {
      avatarAbortRef.current?.abort();
    };
  }, [user?.id]);

  const loadUserAvatar = async (signal: AbortSignal) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle()
        .abortSignal(signal);

      if (signal.aborted) return;

      if (error || !data?.avatar_url) {
        setUserAvatar(null);
        return;
      }

      setUserAvatar(data.avatar_url);
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      setUserAvatar(null);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    const performSignOut = async () => {
      if (isSigningOut) return;
      setIsSigningOut(true);

      avatarAbortRef.current?.abort();

      try {
        await AsyncStorage.removeItem('currentClubId');
      } catch {
        // non-critical
      }

      try {
        await signOut();
      } catch {
        // continue to navigation even on error
      }

      router.replace('/login');
    };

    showAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Unified Master Box - premium design like Journey/Admin */}
        <View style={[styles.settingsMasterBox, { backgroundColor: theme.colors.surface }]}>
          {/* Profile */}
          <View style={styles.settingsProfileBlock}>
            <View style={styles.profileInfo}>
              <View style={[styles.avatar, { backgroundColor: '#3b82f6' }]}>
                {userAvatar ? (
                  <Image
                    source={{ uri: userAvatar }}
                    style={styles.avatarImage}
                    onError={() => setUserAvatar(null)}
                    resizeMode="cover"
                  />
                ) : (
                  <User size={24} color="#ffffff" />
                )}
              </View>
              <View style={styles.profileText}>
                <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{user?.fullName || 'User'}</Text>
                <Text style={[styles.profileEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{user?.email || 'user@email.com'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editProfileButton} onPress={() => router.push('/profile')}>
              <Text style={styles.editProfileText} maxFontSizeMultiplier={1.3}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Club */}
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Club</Text>
          <SettingItem
            icon={<Building2 size={20} color="#10b981" />}
            title="Create New Club"
            description="Start a new Toastmasters club"
            onPress={() => router.push('/create-club')}
          />
          <SettingItem icon={<Building2 size={20} color="#0ea5e9" />} title="My Club Relationships" description="Request to join clubs and manage memberships" onPress={() => router.push('/my-club-relationships')} hideBottomBorder />

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Support */}
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Support</Text>
          <SettingItem icon={<Share2 size={20} color="#3b82f6" />} title="Share App" description="Invite members to download T360" onPress={handleShareApp} />
          <SettingItem icon={<Globe size={20} color="#0ea5e9" />} title="Web Login" description="Access T360 on your browser" onPress={() => Linking.openURL('https://t360.in/weblogin')} />
          <SettingItem icon={<MessageCircle size={20} color="#25D366" />} title="WhatsApp Support 24/7" description="Get instant help on WhatsApp" onPress={handleWhatsAppSupport} />
          <SettingItem icon={<Calendar size={20} color="#8b5cf6" />} title="Talk to us" description="Schedule a call with our team" onPress={handleTalkToUs} />
          <SettingItem icon={<HelpCircle size={20} color="#6366f1" />} title="Help & Support" description="FAQs, contact support, tutorials" onPress={handleHelpSupport} />
          <SettingItem icon={<DollarSign size={20} color="#f59e0b" />} title="Pricing" description="View pricing plans and options" onPress={handlePricing} />
          <SettingItem icon={<FileText size={20} color="#8b5cf6" />} title="Privacy Policy" description="Read our privacy policy" onPress={handlePrivacyPolicy} />
          <SettingItem icon={<Shield size={20} color="#10b981" />} title="Data Protection" description="Learn more about data protection" onPress={handleDataProtection} />
          <SettingItem icon={<RefreshCw size={20} color="#3b82f6" />} title="App Version Check" description="Check for latest version and updates" onPress={() => router.push('/version-debug')} hideBottomBorder />

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Product Training Videos */}
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Product Training Videos</Text>
          <SettingItem icon={<Video size={20} color="#ef4444" />} title="Watch Training Videos" description="Learn how to use T360 effectively" onPress={handleTrainingVideos} hideBottomBorder />

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Connect With Us */}
          <Text style={[styles.settingsSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Connect With Us</Text>
          <SettingItem icon={<Linkedin size={20} color="#0077b5" />} title="LinkedIn" description="Connect with us on LinkedIn" onPress={handleLinkedIn} />
          <SettingItem icon={<Globe size={20} color="#3b82f6" />} title="Website" description="Visit our website" onPress={handleWebsite} hideBottomBorder />

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Sign Out */}
          <View style={styles.signOutWrapper}>
            <TouchableOpacity
              style={[styles.signOutButton, { backgroundColor: '#3b82f6' }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LogOut size={20} color="#ffffff" />
              <Text style={styles.signOutText} maxFontSizeMultiplier={1.3}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: theme.colors.border }]} />

          {/* Danger Zone */}
          <View style={[styles.dangerZoneContainer, {
            backgroundColor: 'transparent',
            borderColor: '#fecaca'
          }]}>
            <View style={styles.dangerZoneHeader}>
              <AlertTriangle size={20} color="#ef4444" />
              <Text style={[styles.dangerZoneTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Danger Zone</Text>
            </View>

            <TouchableOpacity
              style={[styles.deleteAccountButton, { backgroundColor: '#ef4444' }]}
              onPress={() => setShowDeleteModal(true)}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color="#ffffff" />
              <Text style={styles.deleteAccountText} maxFontSizeMultiplier={1.3}>Delete Account</Text>
            </TouchableOpacity>

            {/* GDPR Notice */}
            <Text style={[styles.gdprNotice, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Need 30-day GDPR delay?{'\n'}
              Write to us → support@t360.in
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Image
            source={require('@/assets/images/yy.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Club automation tool</Text>
          <Text style={[styles.footerSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {`Version ${Constants.expoConfig?.version ?? '82'}`}
          </Text>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmation('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Trash2 size={48} color="#ef4444" />
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Delete Account</Text>
            </View>

            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              This action cannot be undone.
            </Text>

            <View style={styles.warningList}>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet} maxFontSizeMultiplier={1.3}>•</Text>
                <Text style={[styles.warningText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Deletion starts instantly
                </Text>
              </View>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet} maxFontSizeMultiplier={1.3}>•</Text>
                <Text style={[styles.warningText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Everything gone in 24 h
                </Text>
              </View>
              <View style={styles.warningItem}>
                <Text style={styles.warningBullet} maxFontSizeMultiplier={1.3}>•</Text>
                <Text style={[styles.warningText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cannot login back
                </Text>
              </View>
            </View>

            <Text style={[styles.modalInstructions, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Type <Text style={styles.deleteKeyword} maxFontSizeMultiplier={1.3}>DELETE</Text> to confirm:
            </Text>

            <TextInput
              style={[styles.confirmationInput, {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type DELETE here"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmation('');
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.deleteButton,
                  (deleteConfirmation !== 'DELETE' || isDeleting) && styles.deleteButtonDisabled
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmation !== 'DELETE' || isDeleting}
              >
                <Text style={styles.deleteButtonText} maxFontSizeMultiplier={1.3}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  content: {
    flex: 1,
  },
  settingsMasterBox: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  settingsDivider: {
    height: 1,
    marginVertical: 18,
  },
  settingsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingsProfileBlock: {
    paddingVertical: 4,
  },
  signOutWrapper: {
    marginTop: 4,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    backgroundColor: '#3b82f6',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
  },
  editProfileButton: {
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editProfileText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerZoneContainer: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
  },
  dangerZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteAccountText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  gdprNotice: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93c5fd',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  warningList: {
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  warningBullet: {
    fontSize: 16,
    marginRight: 8,
    color: '#ef4444',
    fontWeight: '700',
  },
  warningText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  modalInstructions: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteKeyword: {
    fontWeight: '700',
    color: '#ef4444',
  },
  confirmationInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  deleteButtonDisabled: {
    backgroundColor: '#fca5a5',
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 30,
  },
  footerLogo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  footerText: {
    fontSize: 14,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
  },
});
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Share, Platform, KeyboardAvoidingView } from 'react-native';
import { Linking } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect } from 'react';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  User,
  CircleHelp as HelpCircle,
  LogOut,
  ChevronRight,
  Building2,
  Shield,
  FileText,
  Trash2,
  MessageCircle,
  Share2,
  Video,
  Calendar,
  AlertTriangle,
  Globe,
  Linkedin,
  RefreshCw,
} from 'lucide-react-native';

/** Notion-like neutrals (match admin / invite flow). Sign out & delete keep explicit brand colours below. */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
};

/** User asked to keep sign-out and delete styling; keep these as-is. */
const SIGN_OUT_BLUE = '#3b82f6';
const DELETE_RED = '#ef4444';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  hideBottomBorder?: boolean;
  iconBackgroundColor?: string;
}

function SettingItem({
  icon,
  title,
  description,
  onPress,
  rightElement,
  showChevron = true,
  hideBottomBorder,
  iconBackgroundColor,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={[styles.settingItem, !hideBottomBorder && styles.settingItemBorder]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIconWrap, { backgroundColor: iconBackgroundColor || N.iconTile }]}>{icon}</View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {description ? (
            <Text style={[styles.settingDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.25}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.settingRight}>
        {rightElement}
        {showChevron ? <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const showAlert = (
  title: string,
  message?: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
      if (confirmed) {
        const confirmButton = buttons.find((b) => b.style !== 'cancel');
        confirmButton?.onPress?.();
      } else {
        const cancelButton = buttons.find((b) => b.style === 'cancel');
        cancelButton?.onPress?.();
      }
    } else {
      window.alert(message ? `${title}\n\n${message}` : title);
      buttons?.[0]?.onPress?.();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const avatarAbortRef = React.useRef<AbortController | null>(null);

  const mutedIcon = (Icon: typeof User, size = 18) => <Icon size={size} color={N.iconMuted} strokeWidth={1.75} />;
  const themedIcon = (Icon: typeof User, color: string, size = 18) => <Icon size={size} color={color} strokeWidth={1.75} />;

  const handleShareApp = async () => {
    try {
      const message = `Welcome to the T360 App! 👋

We manage our Toastmasters club digitally using T360.

📲 Download the app using the link below:

Android: https://play.google.com/store/apps/details?id=com.toastmaster360.mobile&pcampaignid=web_share

iOS: https://apps.apple.com/in/app/t-360/id6752499801

Once downloaded, sign up and you're all set ✅

Welcome to a seamless digital experience! 🚀`;

      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing app:', error);
    }
  };

  const handleWhatsAppSupport = async () => {
    try {
      const url = 'https://wa.me/9597491113';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open WhatsApp');
    } catch (error) {
      console.error('Error opening WhatsApp URL:', error);
      showAlert('Error', 'Failed to open WhatsApp');
    }
  };

  const handleHelpSupport = async () => {
    try {
      const url = 'https://t360.in/support';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open support website');
    } catch (error) {
      console.error('Error opening support URL:', error);
      showAlert('Error', 'Failed to open support website');
    }
  };

  const handlePricing = async () => {
    try {
      const url = 'https://t360.in/pricing';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open pricing page');
    } catch (error) {
      console.error('Error opening pricing URL:', error);
      showAlert('Error', 'Failed to open pricing page');
    }
  };

  const handlePrivacyPolicy = async () => {
    try {
      const url = 'https://t360.in/privacy';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open privacy policy');
    } catch (error) {
      console.error('Error opening privacy policy URL:', error);
      showAlert('Error', 'Failed to open privacy policy');
    }
  };

  const handleDataProtection = async () => {
    try {
      const url = 'https://t360.in/data-protection';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open data protection');
    } catch (error) {
      console.error('Error opening data protection URL:', error);
      showAlert('Error', 'Failed to open data protection');
    }
  };

  const handleTrainingVideos = async () => {
    try {
      const url = 'https://t360.in/demo';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open training videos');
    } catch (error) {
      console.error('Error opening training videos URL:', error);
      showAlert('Error', 'Failed to open training videos');
    }
  };

  const handleTalkToUs = async () => {
    try {
      const url = 'https://calendly.com/t360-support/demo';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open Calendly');
    } catch (error) {
      console.error('Error opening Calendly URL:', error);
      showAlert('Error', 'Failed to open Calendly');
    }
  };

  const handleLinkedIn = async () => {
    try {
      const url = 'https://www.linkedin.com/in/madhu-sri-82a60b372/';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open LinkedIn');
    } catch (error) {
      console.error('Error opening LinkedIn URL:', error);
      showAlert('Error', 'Failed to open LinkedIn');
    }
  };

  const handleWebsite = async () => {
    try {
      const url = 'https://t360.in/';
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else showAlert('Error', 'Cannot open website');
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
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user?.id }),
      });

      if (!response.ok) throw new Error('Failed to delete account');

      await AsyncStorage.removeItem('currentClubId');
      setShowDeleteModal(false);
      setDeleteConfirmation('');

      showAlert('Account Deleted', 'Your account has been successfully deleted.', [
        {
          text: 'OK',
          onPress: async () => {
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
        /* non-critical */
      }

      try {
        await signOut();
      } catch {
        /* continue */
      }

      router.replace('/login');
    };

    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Settings
          </Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.pageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
            <View style={styles.profileBlock}>
              <View style={styles.profileRow}>
                <View style={[styles.avatar, { backgroundColor: N.iconTile }]}>
                  {userAvatar ? (
                    <Image source={{ uri: userAvatar }} style={styles.avatarImage} onError={() => setUserAvatar(null)} resizeMode="cover" />
                  ) : (
                    <User size={24} color={N.iconMuted} strokeWidth={2} />
                  )}
                </View>
                <View style={styles.profileText}>
                  <Text style={[styles.profileName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {user?.fullName || 'User'}
                  </Text>
                  <Text style={[styles.profileEmail, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {user?.email || 'user@email.com'}
                  </Text>
                  {user?.email?.toLowerCase().endsWith('@privaterelay.appleid.com') ? (
                    <Text style={[styles.profileAppleRelayNote, { color: N.textTertiary }]} maxFontSizeMultiplier={1.2}>
                      Sign in with Apple shared a private relay email (Hide My Email). It is not the same as your Gmail
                      address, and Supabase treats it as a separate account unless you link identities.
                    </Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.editProfileButton, { borderColor: N.border, backgroundColor: N.surface }]}
                onPress={() => router.push('/profile')}
                activeOpacity={0.65}
              >
                <Text style={[styles.editProfileText, { color: N.accent }]} maxFontSizeMultiplier={1.3}>
                  Edit profile
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.insetDivider, { backgroundColor: N.border }]} />

            <Text style={[styles.sectionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Club
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border }]}>
              <SettingItem
                icon={themedIcon(Building2, '#2563EB')}
                iconBackgroundColor="#EFF6FF"
                title="Create new club"
                description="Start a new Toastmasters club"
                onPress={() => router.push('/create-club')}
                hideBottomBorder
              />
            </View>

            <Text style={[styles.sectionLabel, { color: N.textSecondary, marginTop: 20 }]} maxFontSizeMultiplier={1.2}>
              Support
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border }]}>
              <SettingItem
                icon={themedIcon(Share2, '#16A34A')}
                iconBackgroundColor="#F0FDF4"
                title="Share app"
                description="Invite members to download T360"
                onPress={handleShareApp}
              />
              <SettingItem
                icon={themedIcon(Globe, '#334155')}
                iconBackgroundColor="#F1F5F9"
                title="Web login"
                description="Access T360 on your browser"
                onPress={() => Linking.openURL('https://t360.in/weblogin')}
              />
              <SettingItem
                icon={themedIcon(MessageCircle, '#22C55E')}
                iconBackgroundColor="#ECFDF5"
                title="WhatsApp support 24/7"
                description="Get instant help on WhatsApp"
                onPress={handleWhatsAppSupport}
              />
              <SettingItem
                icon={themedIcon(Calendar, '#D97706')}
                iconBackgroundColor="#FEF3C7"
                title="Talk to us"
                description="Schedule a call with our team"
                onPress={handleTalkToUs}
              />
              <SettingItem
                icon={themedIcon(HelpCircle, '#6366F1')}
                iconBackgroundColor="#EEF2FF"
                title="Help & support"
                description="FAQs, contact support, tutorials"
                onPress={handleHelpSupport}
              />
              <SettingItem
                icon={themedIcon(FileText, '#475569')}
                iconBackgroundColor="#F8FAFC"
                title="Privacy policy"
                description="Read our privacy policy"
                onPress={handlePrivacyPolicy}
              />
              <SettingItem
                icon={themedIcon(Shield, '#0891B2')}
                iconBackgroundColor="#ECFEFF"
                title="Data protection"
                description="Learn more about data protection"
                onPress={handleDataProtection}
              />
              <SettingItem
                icon={themedIcon(RefreshCw, '#7C3AED')}
                iconBackgroundColor="#F5F3FF"
                title="App version check"
                description="Check for latest version and updates"
                onPress={() => router.push('/version-debug')}
                hideBottomBorder
              />
            </View>

            <Text style={[styles.sectionLabel, { color: N.textSecondary, marginTop: 20 }]} maxFontSizeMultiplier={1.2}>
              Product training videos
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border }]}>
              <SettingItem
                icon={themedIcon(Video, '#7C3AED')}
                iconBackgroundColor="#F5F3FF"
                title="Watch training videos"
                description="Learn how to use T360 effectively"
                onPress={handleTrainingVideos}
                hideBottomBorder
              />
            </View>

            <Text style={[styles.sectionLabel, { color: N.textSecondary, marginTop: 20 }]} maxFontSizeMultiplier={1.2}>
              Connect with us
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border }]}>
              <SettingItem
                icon={themedIcon(Linkedin, '#0A66C2')}
                iconBackgroundColor="#EFF6FF"
                title="LinkedIn"
                description="Connect with us on LinkedIn"
                onPress={handleLinkedIn}
              />
              <SettingItem
                icon={themedIcon(Globe, '#334155')}
                iconBackgroundColor="#F1F5F9"
                title="Website"
                description="Visit our website"
                onPress={handleWebsite}
                hideBottomBorder
              />
            </View>

            <TouchableOpacity
              style={[styles.signOutButton, { backgroundColor: SIGN_OUT_BLUE }]}
              onPress={handleSignOut}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <LogOut size={20} color="#ffffff" strokeWidth={2} />
              <Text style={styles.signOutText} maxFontSizeMultiplier={1.3}>
                Sign Out
              </Text>
            </TouchableOpacity>

            <View style={styles.dangerSection}>
              <View style={styles.dangerSectionHeader}>
                <AlertTriangle size={18} color={DELETE_RED} strokeWidth={2} />
                <Text style={[styles.dangerSectionTitle, { color: DELETE_RED }]} maxFontSizeMultiplier={1.2}>
                  Danger zone
                </Text>
              </View>
              <Text style={[styles.dangerSectionHint, { color: N.textSecondary }]} maxFontSizeMultiplier={1.15}>
                Permanently delete your account and data. This cannot be undone.
              </Text>
              <TouchableOpacity
                style={[styles.deleteAccountButton, { backgroundColor: DELETE_RED }]}
                onPress={() => setShowDeleteModal(true)}
                activeOpacity={0.85}
              >
                <Trash2 size={20} color="#ffffff" strokeWidth={2} />
                <Text style={styles.deleteAccountText} maxFontSizeMultiplier={1.3}>
                  Delete account
                </Text>
              </TouchableOpacity>
              <Text style={[styles.gdprNotice, { color: N.textSecondary }]} maxFontSizeMultiplier={1.25}>
                Need 30-day GDPR delay?{'\n'}Write to us → support@t360.in
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Image source={require('@/assets/images/yy.png')} style={styles.footerLogo} resizeMode="contain" />
            <Text style={[styles.footerText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              We Salute Toastmasters
            </Text>
            <Text style={[styles.footerSubtext, { color: N.textTertiary }]} maxFontSizeMultiplier={1.3}>
              {`Version ${Constants.expoConfig?.version ?? '92'}`}
            </Text>
          </View>
        </ScrollView>

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
            <View style={[styles.modalContent, { backgroundColor: N.surface, borderColor: N.border }]}>
              <View style={styles.modalHeader}>
                <Trash2 size={40} color={DELETE_RED} strokeWidth={1.75} />
                <Text style={[styles.modalTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  Delete account
                </Text>
              </View>

              <Text style={[styles.modalDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                This action cannot be undone.
              </Text>

              <View style={styles.warningList}>
                {['Deletion starts instantly', 'Everything gone in 24 h', 'Cannot login back'].map((line) => (
                  <View key={line} style={styles.warningItem}>
                    <Text style={[styles.warningBullet, { color: DELETE_RED }]} maxFontSizeMultiplier={1.3}>
                      •
                    </Text>
                    <Text style={[styles.warningText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      {line}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.modalInstructions, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Type <Text style={[styles.deleteKeyword, { color: DELETE_RED }]}>DELETE</Text> to confirm:
              </Text>

              <TextInput
                style={[
                  styles.confirmationInput,
                  { backgroundColor: N.page, color: N.text, borderColor: N.border },
                ]}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder="Type DELETE here"
                placeholderTextColor={N.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { borderColor: N.border }]}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmation('');
                  }}
                  disabled={isDeleting}
                  activeOpacity={0.65}
                >
                  <Text style={[styles.cancelButtonText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.deleteButton,
                    { backgroundColor: DELETE_RED },
                    (deleteConfirmation !== 'DELETE' || isDeleting) && styles.deleteButtonDisabled,
                  ]}
                  onPress={handleDeleteAccount}
                  disabled={deleteConfirmation !== 'DELETE' || isDeleting}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteButtonText} maxFontSizeMultiplier={1.3}>
                    {isDeleting ? 'Deleting…' : 'Delete account'}
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  pageInset: {
    marginHorizontal: 16,
    marginTop: 4,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  profileBlock: {
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    lineHeight: 20,
  },
  profileAppleRelayNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  editProfileButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '600',
  },
  insetDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 8,
  },
  notionGroup: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 0,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: N.surface,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: N.border,
  },
  settingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 12,
  },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 20,
  },
  signOutText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.1,
  },
  dangerSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  dangerSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  dangerSectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginBottom: 14,
  },
  deleteAccountText: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.1,
  },
  gdprNotice: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 4,
    padding: 22,
    borderWidth: 1,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  warningList: {
    marginBottom: 18,
    alignSelf: 'stretch',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingHorizontal: 4,
    gap: 8,
  },
  warningBullet: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  modalInstructions: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteKeyword: {
    fontWeight: '700',
  },
  confirmationInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {},
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
  },
  footerLogo: {
    width: 72,
    height: 72,
    marginBottom: 10,
    opacity: 0.9,
  },
  footerText: {
    fontSize: 13,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
  },
});

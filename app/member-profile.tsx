import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Mail, Phone, MapPin, Copy, Linkedin, Twitter, Instagram, Youtube } from 'lucide-react-native';

const NOTION_BORDER = 'rgba(55, 53, 47, 0.09)';
const COPY_RAIL_W = 44;
import { Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  About: string | null;
  'Toastmaster since': string | null;
  'Mentor Name': string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  youtube_url: string | null;
  avatar_url: string | null;
  location: string | null;
  occupation: string | null;
  interests: string | null;
  achievements: string | null;
}

export default function MemberProfile() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const memberId = typeof params.memberId === 'string' ? params.memberId : params.memberId?.[0];
  
  const [member, setMember] = useState<ClubMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (memberId) {
      loadMemberProfile();
    }
  }, [memberId]);

  const loadMemberProfile = async () => {
    if (!memberId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          id,
          role,
          is_authenticated,
          created_at,
          app_user_profiles (
            id,
            full_name,
            email,
            phone_number,
            avatar_url,
            is_active,
            "About",
            "Toastmaster since",
            "Mentor Name",
            facebook_url,
            linkedin_url,
            instagram_url,
            twitter_url,
            youtube_url,
            location,
            occupation,
            interests,
            achievements
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('user_id', memberId)
        .eq('is_authenticated', true)
        .single();

      if (error) {
        console.error('Error loading member profile:', error);
        Alert.alert('Error', 'Failed to load member profile');
        return;
      }

      if (data) {
        const memberData = {
          id: (data as any).app_user_profiles.id,
          full_name: (data as any).app_user_profiles.full_name,
          email: (data as any).app_user_profiles.email,
          phone_number: (data as any).app_user_profiles.phone_number,
          role: (data as any).role,
          is_active: (data as any).app_user_profiles.is_active,
          created_at: (data as any).created_at,
          About: (data as any).app_user_profiles.About,
          'Toastmaster since': (data as any).app_user_profiles['Toastmaster since'],
          'Mentor Name': (data as any).app_user_profiles['Mentor Name'],
          facebook_url: (data as any).app_user_profiles.facebook_url,
          linkedin_url: (data as any).app_user_profiles.linkedin_url,
          instagram_url: (data as any).app_user_profiles.instagram_url,
          twitter_url: (data as any).app_user_profiles.twitter_url,
          youtube_url: (data as any).app_user_profiles.youtube_url,
          avatar_url: (data as any).app_user_profiles.avatar_url,
          location: (data as any).app_user_profiles.location,
          occupation: (data as any).app_user_profiles.occupation,
          interests: (data as any).app_user_profiles.interests,
          achievements: (data as any).app_user_profiles.achievements,
        };

        setMember(memberData);
      }
    } catch (error) {
      console.error('Error loading member profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyEmail = async () => {
    if (member?.email) {
      await Clipboard.setStringAsync(member.email);
      Alert.alert('Copied', 'Email copied to clipboard');
    }
  };

  const handleCopyPhone = async () => {
    if (member?.phone_number) {
      await Clipboard.setStringAsync(member.phone_number);
      Alert.alert('Copied', 'Phone number copied to clipboard');
    }
  };

  const handleCopyAbout = async () => {
    if (member?.About) {
      await Clipboard.setStringAsync(member.About);
      Alert.alert('Copied', 'About Me copied to clipboard');
    }
  };

  const handleOpenSocialMedia = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open link');
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#FFFFFF' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading member profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#FFFFFF' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Member not found
          </Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.goBackButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pageBg = theme.mode === 'dark' ? theme.colors.background : '#FFFFFF';
  const textMain = theme.colors.text;
  const textMuted = theme.colors.textSecondary;
  const borderColor = theme.mode === 'light' ? NOTION_BORDER : theme.colors.border;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: pageBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={textMain} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textMain }]} maxFontSizeMultiplier={1.3}>
          Member Profile
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={[styles.scrollContent, { backgroundColor: pageBg }]}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {member.avatar_url ? (
              <Image
                source={{ uri: member.avatar_url }}
                style={[styles.avatar, { borderColor: borderColor }]}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { borderColor: borderColor }]}>
                <User size={48} color={textMuted} />
              </View>
            )}
          </View>
          <Text style={[styles.memberName, { color: textMain }]} maxFontSizeMultiplier={1.3}>
            {member.full_name}
          </Text>
          {member.location ? (
            <View style={styles.locationRow}>
              <MapPin size={14} color={textMuted} />
              <Text style={[styles.locationText, { color: textMuted }]} maxFontSizeMultiplier={1.3}>
                {member.location}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.hairline, { backgroundColor: borderColor }]} />

        <View style={styles.contactBlock}>
          <View style={styles.contactRow}>
            <View style={styles.contactLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.mode === 'dark' ? theme.colors.surface : '#F3F4F6' }]}>
                <Mail size={18} color="#3B82F6" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: textMuted }]} maxFontSizeMultiplier={1.3}>
                  Email
                </Text>
                <Text style={[styles.contactValue, { color: textMain }]} maxFontSizeMultiplier={1.3}>
                  {member.email}
                </Text>
              </View>
            </View>
            <View style={styles.copyRail}>
              <TouchableOpacity style={styles.copyHit} onPress={handleCopyEmail} accessibilityLabel="Copy email">
                <Copy size={16} color={textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {member.phone_number ? (
            <>
              <View style={[styles.hairlineInset, { backgroundColor: borderColor }]} />
              <View style={styles.contactRow}>
                <View style={styles.contactLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: theme.mode === 'dark' ? theme.colors.surface : '#F3F4F6' }]}>
                    <Phone size={18} color="#10B981" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactLabel, { color: textMuted }]} maxFontSizeMultiplier={1.3}>
                      Phone
                    </Text>
                    <Text style={[styles.contactValue, { color: textMain }]} maxFontSizeMultiplier={1.3}>
                      {member.phone_number}
                    </Text>
                  </View>
                </View>
                <View style={styles.copyRail}>
                  <TouchableOpacity style={styles.copyHit} onPress={handleCopyPhone} accessibilityLabel="Copy phone">
                    <Copy size={16} color={textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {member.About ? (
          <>
            <View style={[styles.hairline, { backgroundColor: borderColor }]} />
            <View style={styles.aboutBlock}>
              <View style={styles.aboutTitleRow}>
                <Text style={[styles.aboutTitle, { color: textMain }]} maxFontSizeMultiplier={1.3}>
                  About Me
                </Text>
                <View style={styles.copyRail}>
                  <TouchableOpacity
                    style={styles.copyHit}
                    onPress={handleCopyAbout}
                    accessibilityRole="button"
                    accessibilityLabel="Copy About Me"
                  >
                    <Copy size={16} color={textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.aboutText, { color: textMuted }]} maxFontSizeMultiplier={1.3}>
                {member.About}
              </Text>
            </View>
          </>
        ) : null}

        {(member.linkedin_url || member.twitter_url || member.instagram_url || member.youtube_url) ? (
          <>
            <View style={[styles.hairline, { backgroundColor: borderColor, marginTop: 8 }]} />
            <View style={styles.socialMediaSection}>
              {member.linkedin_url ? (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#0A66C2' }]}
                  onPress={() => handleOpenSocialMedia(member.linkedin_url!)}
                  activeOpacity={0.8}
                >
                  <Linkedin size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              {member.twitter_url ? (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#1DA1F2' }]}
                  onPress={() => handleOpenSocialMedia(member.twitter_url!)}
                  activeOpacity={0.8}
                >
                  <Twitter size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              {member.instagram_url ? (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#E4405F' }]}
                  onPress={() => handleOpenSocialMedia(member.instagram_url!)}
                  activeOpacity={0.8}
                >
                  <Instagram size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              {member.youtube_url ? (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#FF0000' }]}
                  onPress={() => handleOpenSocialMedia(member.youtube_url!)}
                  activeOpacity={0.8}
                >
                  <Youtube size={22} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
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
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  goBackButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
  },
  goBackButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 16,
  },
  hairlineInset: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginLeft: 48,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 0,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  memberName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '400',
  },
  contactBlock: {
    marginBottom: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '400',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  copyRail: {
    width: COPY_RAIL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyHit: {
    width: COPY_RAIL_W,
    height: COPY_RAIL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutBlock: {
    paddingBottom: 4,
  },
  aboutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COPY_RAIL_W,
    marginBottom: 10,
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
  },
  socialMediaSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  socialIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, User, Mail, Phone, MapPin, Copy, Linkedin, Twitter, Instagram, Youtube } from 'lucide-react-native';
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

  const handleCall = () => {
    if (member?.phone_number) {
      const phoneUrl = `tel:${member.phone_number}`;
      Linking.openURL(phoneUrl).catch(() => {
        Alert.alert('Error', 'Unable to make phone call');
      });
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText} maxFontSizeMultiplier={1.3}>Loading member profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText} maxFontSizeMultiplier={1.3}>Member not found</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Member Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              {member.avatar_url ? (
                <Image
                  source={{ uri: member.avatar_url }}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={48} color="#6B7280" />
                </View>
              )}
            </View>
            <Text style={styles.memberName} maxFontSizeMultiplier={1.3}>{member.full_name}</Text>
            {member.location && (
              <View style={styles.locationRow}>
                <MapPin size={14} color="#6B7280" />
                <Text style={styles.locationText} maxFontSizeMultiplier={1.3}>{member.location}</Text>
              </View>
            )}
          </View>

          {/* Contact Information Section */}
          <View style={styles.contactSection}>
            {/* Email Row */}
            <View style={styles.contactRow}>
              <View style={styles.contactLeft}>
                <View style={styles.iconContainer}>
                  <Mail size={18} color="#3B82F6" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel} maxFontSizeMultiplier={1.3}>Email</Text>
                  <Text style={styles.contactValue} maxFontSizeMultiplier={1.3}>{member.email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.actionButton} onPress={handleCopyEmail}>
                <Copy size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Phone Row */}
            {member.phone_number && (
              <>
                <View style={styles.divider} />
                <View style={styles.contactRow}>
                  <View style={styles.contactLeft}>
                    <View style={styles.iconContainer}>
                      <Phone size={18} color="#10B981" />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactLabel} maxFontSizeMultiplier={1.3}>Phone</Text>
                      <Text style={styles.contactValue} maxFontSizeMultiplier={1.3}>{member.phone_number}</Text>
                    </View>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton} onPress={handleCopyPhone}>
                      <Copy size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.callButton]} onPress={handleCall}>
                      <Phone size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* About Section */}
          {member.About && (
            <View style={styles.aboutSection}>
              <View style={styles.aboutHeaderRow}>
                <Text style={styles.aboutTitle} maxFontSizeMultiplier={1.3}>
                  About Me
                </Text>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleCopyAbout}
                  accessibilityRole="button"
                  accessibilityLabel="Copy About Me"
                >
                  <Copy size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.aboutText} maxFontSizeMultiplier={1.3}>
                {member.About}
              </Text>
            </View>
          )}

          {/* Social Media Section */}
          {(member.linkedin_url || member.twitter_url || member.instagram_url || member.youtube_url) && (
            <View style={styles.socialMediaSection}>
              {member.linkedin_url && (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#0A66C2' }]}
                  onPress={() => handleOpenSocialMedia(member.linkedin_url!)}
                  activeOpacity={0.8}
                >
                  <Linkedin size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {member.twitter_url && (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#1DA1F2' }]}
                  onPress={() => handleOpenSocialMedia(member.twitter_url!)}
                  activeOpacity={0.8}
                >
                  <Twitter size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {member.instagram_url && (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#E4405F' }]}
                  onPress={() => handleOpenSocialMedia(member.instagram_url!)}
                  activeOpacity={0.8}
                >
                  <Instagram size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
              {member.youtube_url && (
                <TouchableOpacity
                  style={[styles.socialIcon, { backgroundColor: '#FF0000' }]}
                  onPress={() => handleOpenSocialMedia(member.youtube_url!)}
                  activeOpacity={0.8}
                >
                  <Youtube size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    color: '#111827',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  headerBackButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  contentCard: {
    marginHorizontal: 20,
    marginVertical: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  memberName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  contactSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
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
    color: '#6B7280',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    marginLeft: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 0,
  },
  aboutSection: {
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  aboutHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22.4,
    color: '#374151',
  },
  socialMediaSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
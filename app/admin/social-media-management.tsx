import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Facebook, Twitter, Linkedin, Instagram, MessageCircle, Youtube, ExternalLink } from 'lucide-react-native';
import { Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';

interface ClubSocialMedia {
  facebook_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

interface SocialPlatform {
  key: keyof ClubSocialMedia;
  name: string;
}

/** Brand accents readable on light surfaces (Notion-style clarity). */
const SOCIAL_ICON_COLORS: Record<string, string> = {
  Facebook: '#1877F2',
  Twitter: '#1D9BF0',
  LinkedIn: '#0A66C2',
  Instagram: '#E4405F',
  WhatsApp: '#25D366',
  YouTube: '#FF0000',
  Website: '#2383E2',
};

export default function SocialMediaManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [socialMedia, setSocialMedia] = useState<ClubSocialMedia>({
    facebook_url: null,
    twitter_url: null,
    linkedin_url: null,
    instagram_url: null,
    whatsapp_url: null,
    youtube_url: null,
    website_url: null,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);

  const socialPlatforms: SocialPlatform[] = [
    { key: 'facebook_url', name: 'Facebook' },
    { key: 'twitter_url', name: 'Twitter' },
    { key: 'linkedin_url', name: 'LinkedIn' },
    { key: 'instagram_url', name: 'Instagram' },
    { key: 'whatsapp_url', name: 'WhatsApp' },
    { key: 'youtube_url', name: 'YouTube' },
  ];

  const renderPlatformIcon = (platformName: string, fallbackColor: string) => {
    const iconColor = SOCIAL_ICON_COLORS[platformName] ?? fallbackColor;
    switch (platformName) {
      case 'Facebook':
        return <Facebook size={20} color={iconColor} />;
      case 'Twitter':
        return <Twitter size={20} color={iconColor} />;
      case 'LinkedIn':
        return <Linkedin size={20} color={iconColor} />;
      case 'Instagram':
        return <Instagram size={20} color={iconColor} />;
      case 'WhatsApp':
        return <MessageCircle size={20} color={iconColor} />;
      case 'YouTube':
        return <Youtube size={20} color={iconColor} />;
      default:
        return <ExternalLink size={20} color={iconColor} />;
    }
  };

  useEffect(() => {
    loadClubSocialMedia();
    loadClubInfo();
  }, []);

  const loadClubSocialMedia = async () => {
    if (!user?.currentClubId) {
      console.log('No current club ID, stopping load');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading social media for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('club_profiles')
        .select('facebook_url, twitter_url, linkedin_url, instagram_url, whatsapp_url, youtube_url, website_url')
        .eq('club_id', user.currentClubId)
        .single();

      console.log('Social media query result:', { data, error });

      if (error) {
        if (error.code === 'PGRST116') {
          // No club profile exists yet, use empty defaults
          console.log('No club profile found, using defaults');
          setSocialMedia({
            facebook_url: null,
            twitter_url: null,
            linkedin_url: null,
            instagram_url: null,
            whatsapp_url: null,
            youtube_url: null,
            website_url: null,
          });
        } else {
          console.error('Error loading club social media:', error);
          Alert.alert('Error', `Failed to load club social media information: ${error.message}`);
        }
      } else if (data) {
        console.log('Setting social media data:', data);
        setSocialMedia(data);
      }
    } catch (error) {
      console.error('Error loading club social media:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading social media settings');
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const updateSocialMediaField = (field: keyof ClubSocialMedia, value: string) => {
    let processedValue = value.trim();
    
    // Auto-prepend https:// if user enters a URL without protocol
    if (processedValue && !processedValue.startsWith('http://') && !processedValue.startsWith('https://')) {
      // Check if it looks like a URL (contains a dot)
      if (processedValue.includes('.')) {
        processedValue = 'https://' + processedValue;
      }
    }
    
    setSocialMedia(prev => ({
      ...prev,
      [field]: processedValue || null
    }));
  };

  const validateUrl = (url: string, platform: string, showAlert = true): boolean => {
    if (!url.trim()) return true;
    
    // Auto-prepend https:// if no protocol is specified
    let processedUrl = url.trim();
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }
    
    try {
      new URL(processedUrl);
      return true;
    } catch {
      if (showAlert) {
        Alert.alert('Invalid URL', `Please enter a valid URL for ${platform} (e.g., example.com or https://example.com)`);
      }
      return false;
    }
  };

  const performSave = async (silent = false) => {
    if (!user?.currentClubId) {
      if (!silent) Alert.alert('Error', 'No club selected');
      return;
    }

    console.log('Starting save process...');
    console.log('Current club ID:', user.currentClubId);
    console.log('Social media data to save:', socialMedia);

    for (const platform of socialPlatforms) {
      const url = socialMedia[platform.key];
      if (url && !validateUrl(url, platform.name)) {
        return;
      }
    }

    const websiteUrl = socialMedia.website_url;
    if (websiteUrl && !validateUrl(websiteUrl, 'Website')) {
      return;
    }

    setIsSaving(true);

    try {
      // First check if club_profiles record exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      console.log('Existing profile check:', { existingProfile, checkError });

      if (checkError && checkError.code === 'PGRST116') {
        // No profile exists, create one first
        console.log('Creating new club profile...');
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...socialMedia,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any);

        if (createError) {
          console.error('Error creating club profile:', createError);
          if (!silent) Alert.alert('Error', `Failed to create club profile: ${createError.message}`);
          return;
        }

        console.log('Club profile created successfully');
      } else if (checkError) {
        console.error('Error checking existing profile:', checkError);
        if (!silent) Alert.alert('Error', `Database error: ${checkError.message}`);
        return;
      } else {
        // Profile exists, update it
        console.log('Updating existing club profile...');
        const { error: updateError } = await supabase
          .from('club_profiles')
          .update({
            ...socialMedia,
            updated_at: new Date().toISOString()
          } as any)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          if (!silent) Alert.alert('Error', `Failed to update social media links: ${updateError.message}`);
          return;
        }

        console.log('Club profile updated successfully');
      }

    } catch (error) {
      console.error('Error updating club social media:', error);
      if (!silent) Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const maybeAutoSave = () => {
    if (isSaving) return;
    for (const platform of socialPlatforms) {
      const url = socialMedia[platform.key];
      if (url && !validateUrl(url, platform.name, false)) return;
    }
    const websiteUrl = socialMedia.website_url;
    if (websiteUrl && !validateUrl(websiteUrl, 'Website', false)) return;
    void performSave(true);
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

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading social media settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Social Media</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.managementPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {clubInfo && (
            <View style={[styles.clubHeaderBlock, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {clubInfo.name}
              </Text>
              <View style={styles.clubMeta}>
                {clubInfo.club_number ? (
                  <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Club #{clubInfo.club_number}
                  </Text>
                ) : null}
                {user?.clubRole ? (
                  <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                    {getRoleIcon(user.clubRole)}
                    <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>
                      {formatRole(user.clubRole)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.formsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club social media links
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Add your club&apos;s public profiles. Auto-saved.
            </Text>

            {socialPlatforms.map((platform, index) => (
              <View
                key={platform.key}
                style={[
                  styles.platformRow,
                  index > 0 && [styles.platformRowDivider, { borderTopColor: theme.colors.border }],
                ]}
              >
                <View style={styles.platformLabelRow}>
                  <View style={styles.platformIconSlot}>{renderPlatformIcon(platform.name, theme.colors.text)}</View>
                  <View style={styles.platformLabelText}>
                    <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {platform.name}
                    </Text>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.urlInput,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                  value={socialMedia[platform.key] || ''}
                  onChangeText={(text) => updateSocialMediaField(platform.key, text)}
                  onEndEditing={maybeAutoSave}
                  onBlur={maybeAutoSave}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}

            <View style={[styles.platformRow, styles.platformRowDivider, { borderTopColor: theme.colors.border }]}>
              <View style={styles.platformLabelRow}>
                <View style={styles.platformIconSlot}>
                  <ExternalLink size={20} color={SOCIAL_ICON_COLORS.Website} />
                </View>
                <View style={styles.platformLabelText}>
                  <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Website
                  </Text>
                </View>
              </View>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                value={socialMedia.website_url || ''}
                onChangeText={(text) => updateSocialMediaField('website_url', text)}
                onEndEditing={maybeAutoSave}
                onBlur={maybeAutoSave}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
  },
  managementPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  clubHeaderBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.2,
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
    paddingVertical: 3,
    borderRadius: 2,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  formsSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 4,
    lineHeight: 19,
  },
  platformRow: {
    paddingVertical: 14,
  },
  platformRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  platformLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  platformIconSlot: {
    width: 28,
    alignItems: 'center',
    paddingTop: 2,
    marginRight: 10,
  },
  platformLabelText: {
    flex: 1,
    minWidth: 0,
  },
  platformName: {
    fontSize: 15,
    fontWeight: '500',
  },
  urlInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
});
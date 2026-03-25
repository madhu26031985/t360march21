import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Facebook, Twitter, Linkedin, Instagram, MessageCircle, Youtube, ExternalLink, ChevronDown } from 'lucide-react-native';
import { Building2, Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';

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
  icon: React.ReactNode;
  color: string;
  placeholder: string;
}

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
  const [infoBoxExpanded, setInfoBoxExpanded] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  const socialPlatforms: SocialPlatform[] = [
    {
      key: 'facebook_url',
      name: 'Facebook',
      icon: <Facebook size={20} color="#ffffff" />,
      color: '#1877f2',
      placeholder: 'https://facebook.com/yourclub'
    },
    {
      key: 'twitter_url',
      name: 'Twitter',
      icon: <Twitter size={20} color="#ffffff" />,
      color: '#1da1f2',
      placeholder: 'https://twitter.com/yourclub'
    },
    {
      key: 'linkedin_url',
      name: 'LinkedIn',
      icon: <Linkedin size={20} color="#ffffff" />,
      color: '#0a66c2',
      placeholder: 'https://linkedin.com/company/yourclub'
    },
    {
      key: 'instagram_url',
      name: 'Instagram',
      icon: <Instagram size={20} color="#ffffff" />,
      color: '#e4405f',
      placeholder: 'https://instagram.com/yourclub'
    },
    {
      key: 'whatsapp_url',
      name: 'WhatsApp',
      icon: <MessageCircle size={20} color="#ffffff" />,
      color: '#25d366',
      placeholder: 'https://chat.whatsapp.com/yourgroup'
    },
    {
      key: 'youtube_url',
      name: 'YouTube',
      icon: <Youtube size={20} color="#ffffff" />,
      color: '#ff0000',
      placeholder: 'https://youtube.com/@yourclub'
    },
  ];

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

  const validateUrl = (url: string, platform: string): boolean => {
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
      Alert.alert('Invalid URL', `Please enter a valid URL for ${platform} (e.g., example.com or https://example.com)`);
      return false;
    }
  };

  const performSave = async () => {
    if (!user?.currentClubId) {
      Alert.alert('Error', 'No club selected');
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
          Alert.alert('Error', `Failed to create club profile: ${createError.message}`);
          return;
        }

        console.log('Club profile created successfully');
      } else if (checkError) {
        console.error('Error checking existing profile:', checkError);
        Alert.alert('Error', `Database error: ${checkError.message}`);
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
          Alert.alert('Error', `Failed to update social media links: ${updateError.message}`);
          return;
        }

        console.log('Club profile updated successfully');
      }


      Alert.alert('Success', 'Club social media links updated successfully!');
      
      // Reload the data to confirm it was saved
      await loadClubSocialMedia();
    } catch (error) {
      console.error('Error updating club social media:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!user?.currentClubId) {
      Alert.alert('Error', 'No club selected');
      return;
    }
    if (isSaving) return;
    setShowSaveConfirmModal(true);
  };

  const confirmSave = () => {
    setShowSaveConfirmModal(false);
    void performSave();
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return '#8b5cf6';
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Social Media Management</Text>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={14} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.managementPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Club Card */}
          {clubInfo && (
            <View style={styles.clubCard}>
              <View style={styles.clubHeader}>
                <View style={styles.clubInfo}>
                  <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {clubInfo.name}
                  </Text>
                  <View style={styles.clubMeta}>
                    {clubInfo.club_number && (
                      <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Club #{clubInfo.club_number}
                      </Text>
                    )}
                    {user?.clubRole && (
                      <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                        {getRoleIcon(user.clubRole)}
                        <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.formsSection]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Social Links</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Add your club&apos;s public profiles
            </Text>
          
            {socialPlatforms.map((platform, index) => (
              <View key={platform.key} style={[styles.platformField, index > 0 && styles.platformFieldWithDivider]}>
                <View style={styles.platformHeader}>
                  <View style={[styles.platformIcon, { backgroundColor: platform.color }]}>
                    {platform.icon}
                  </View>
                  <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {platform.name}
                  </Text>
                  <Text style={[styles.platformHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {platform.placeholder.replace('https://', '')}
                  </Text>
                </View>
              
                <TextInput
                  style={[styles.urlInput, { 
                    backgroundColor: theme.colors.background, 
                    borderColor: '#E5E7EB',
                    color: theme.colors.text 
                  }]}
                  placeholderTextColor={theme.colors.textSecondary}
                  value={socialMedia[platform.key] || ''}
                  onChangeText={(text) => updateSocialMediaField(platform.key, text)}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}

            <View style={[styles.platformField, styles.platformFieldWithDivider]}>
              <View style={styles.platformHeader}>
                <View style={[styles.platformIcon, { backgroundColor: '#6b7280' }]}>
                  <ExternalLink size={18} color="#ffffff" />
                </View>
                <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Website
                </Text>
                <Text style={[styles.platformHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  yourclub.com
                </Text>
              </View>
            
              <TextInput
                style={[styles.urlInput, { 
                  backgroundColor: theme.colors.background, 
                  borderColor: '#E5E7EB',
                  color: theme.colors.text 
                }]}
                placeholderTextColor={theme.colors.textSecondary}
                value={socialMedia.website_url || ''}
                onChangeText={(text) => updateSocialMediaField('website_url', text)}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

          <View style={[styles.infoBox, { backgroundColor: theme.colors.background, borderColor: '#E5E7EB' }]}>
            <TouchableOpacity
              style={styles.infoBoxHeader}
              onPress={() => setInfoBoxExpanded((v) => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={infoBoxExpanded ? 'Hide social media info' : 'Show social media info'}
            >
              <View style={styles.infoBoxHeaderText}>
                <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Social Media Management
                </Text>
                <Text style={[styles.infoSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Bring your club&apos;s presence to life 🌐
                </Text>
              </View>
              <View style={{ transform: [{ rotate: infoBoxExpanded ? '180deg' : '0deg' }] }}>
                <ChevronDown size={22} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {infoBoxExpanded && (
              <View style={styles.infoBoxExpanded}>
                <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Add all your official social media links in one place—whether it&apos;s Instagram, LinkedIn, Facebook, or YouTube. These links will be seamlessly displayed under the Club tab, making it easy for members to explore, follow, and stay connected.
                </Text>
                <Text style={[styles.infoBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Encourage engagement beyond meetings. Help members celebrate moments, stay updated on events, and actively interact with your club&apos;s journey—all from within the app.
                </Text>
                <Text style={[styles.infoFooter, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  One place. All your platforms. Stronger member connection.
                </Text>
              </View>
            )}
          </View>
          </View>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSaveConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveConfirmModal(false)}
      >
        <View style={styles.confirmModalRoot}>
          <Pressable style={styles.confirmModalBackdrop} onPress={() => setShowSaveConfirmModal(false)} />
          <View style={[styles.confirmModalCard, { backgroundColor: theme.colors.surface }]} accessibilityRole="dialog">
            <Text style={[styles.confirmModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Save social links?
            </Text>
            <Text style={[styles.confirmModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your social media links will be updated for this club.
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalButtonSecondary, { borderColor: '#E5E7EB' }]}
                onPress={() => setShowSaveConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmModalButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, { backgroundColor: theme.colors.primary }]}
                onPress={confirmSave}
                activeOpacity={0.7}
              >
                <Text style={[styles.confirmModalButtonText, styles.confirmModalButtonTextPrimary]} maxFontSizeMultiplier={1.3}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 33,
    height: 33,
    borderRadius: 9,
  },
  content: {
    flex: 1,
  },
  managementPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clubCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
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
    fontSize: 16,
    fontWeight: '600',
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
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  formsSection: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 18,
    lineHeight: 18,
  },
  platformField: {
    paddingVertical: 14,
  },
  platformFieldWithDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  platformIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  platformName: {
    fontSize: 15,
    fontWeight: '600',
  },
  platformHint: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
    flexShrink: 1,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  infoBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoBoxHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  infoBoxExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  infoBody: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  infoFooter: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    marginTop: 2,
  },
  confirmModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  confirmModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    padding: 20,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'stretch',
  },
  confirmModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmModalButtonSecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModalButtonTextPrimary: {
    color: '#ffffff',
  },
});
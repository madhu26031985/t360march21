import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Facebook, Twitter, Linkedin, Instagram, MessageCircle, Youtube, ExternalLink } from 'lucide-react-native';
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

  const handleSave = async () => {
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
          <Save size={16} color="#ffffff" />
          <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
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

        <View style={[styles.formsSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Social Media Platforms</Text>
          
          {socialPlatforms.map((platform) => (
            <View key={platform.key} style={styles.platformField}>
              <View style={styles.platformHeader}>
                <View style={[styles.platformIcon, { backgroundColor: platform.color }]}>
                  {platform.icon}
                </View>
                <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {platform.name}
                </Text>
              </View>
              
              <TextInput
                style={[styles.urlInput, { 
                  backgroundColor: theme.colors.background, 
                  borderColor: theme.colors.border,
                  color: theme.colors.text 
                }]}
                placeholder={platform.placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                value={socialMedia[platform.key] || ''}
                onChangeText={(text) => updateSocialMediaField(platform.key, text)}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}

          <View style={styles.platformField}>
            <View style={styles.platformHeader}>
              <View style={[styles.platformIcon, { backgroundColor: '#6b7280' }]}>
                <ExternalLink size={20} color="#ffffff" />
              </View>
              <Text style={[styles.platformName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Website
              </Text>
            </View>
            
            <TextInput
              style={[styles.urlInput, { 
                backgroundColor: theme.colors.background, 
                borderColor: theme.colors.border,
                color: theme.colors.text 
              }]}
              placeholder="https://yourclub.com"
              placeholderTextColor={theme.colors.textSecondary}
              value={socialMedia.website_url || ''}
              onChangeText={(text) => updateSocialMediaField('website_url', text)}
              autoCapitalize="none"
              autoCorrect={false}
            />
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  platformField: {
    marginBottom: 24,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  platformIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '600',
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
});
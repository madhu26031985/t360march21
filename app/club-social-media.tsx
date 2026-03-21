import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Facebook, Twitter, Linkedin, Instagram, MessageCircle, Youtube, ExternalLink, Building2 } from 'lucide-react-native';

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
  isConnected: boolean;
  url: string | null;
}

export default function ClubSocialMedia() {
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
  
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClubData();
  }, []);

  const loadClubData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (clubError) {
        console.error('Error loading club info:', clubError);
      } else {
        setClubInfo(clubData);
      }

      const { data: socialData, error: socialError } = await supabase
        .from('club_profiles')
        .select('facebook_url, twitter_url, linkedin_url, instagram_url, whatsapp_url, youtube_url, website_url')
        .eq('club_id', user.currentClubId)
        .single();

      if (socialError) {
        console.error('Error loading club social media:', socialError);
      } else if (socialData) {
        setSocialMedia(socialData);
      }
    } catch (error) {
      console.error('Error loading club data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialMediaPress = async (url: string | null, platform: string) => {
    if (!url) {
      Alert.alert('Not Available', `${platform} link not available for this club`);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this URL');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to open ${platform} link`);
    }
  };

  const getSocialPlatforms = (): SocialPlatform[] => [
    {
      key: 'facebook_url',
      name: 'Facebook',
      icon: <Facebook size={20} color="#ffffff" />,
      color: '#1877f2',
      isConnected: !!socialMedia.facebook_url,
      url: socialMedia.facebook_url,
    },
    {
      key: 'twitter_url',
      name: 'Twitter',
      icon: <Twitter size={20} color="#ffffff" />,
      color: '#1da1f2',
      isConnected: !!socialMedia.twitter_url,
      url: socialMedia.twitter_url,
    },
    {
      key: 'linkedin_url',
      name: 'LinkedIn',
      icon: <Linkedin size={20} color="#ffffff" />,
      color: '#0a66c2',
      isConnected: !!socialMedia.linkedin_url,
      url: socialMedia.linkedin_url,
    },
    {
      key: 'instagram_url',
      name: 'Instagram',
      icon: <Instagram size={20} color="#ffffff" />,
      color: '#e4405f',
      isConnected: !!socialMedia.instagram_url,
      url: socialMedia.instagram_url,
    },
    {
      key: 'whatsapp_url',
      name: 'WhatsApp',
      icon: <MessageCircle size={20} color="#ffffff" />,
      color: '#25d366',
      isConnected: !!socialMedia.whatsapp_url,
      url: socialMedia.whatsapp_url,
    },
    {
      key: 'youtube_url',
      name: 'YouTube',
      icon: <Youtube size={20} color="#ffffff" />,
      color: '#ff0000',
      isConnected: !!socialMedia.youtube_url,
      url: socialMedia.youtube_url,
    },
  ];

  const SocialPlatformCard = ({ platform }: { platform: SocialPlatform }) => (
    <TouchableOpacity
      style={[styles.platformCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleSocialMediaPress(platform.url, platform.name)}
      disabled={!platform.isConnected}
    >
      <View style={[styles.platformIconContainer, { backgroundColor: platform.color }]}>
        {platform.icon}
      </View>
      <View style={styles.platformInfo}>
        <Text style={[styles.platformTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {platform.name}
        </Text>
        <View style={styles.connectionStatus}>
          {platform.isConnected ? (
            <View style={styles.connectedContainer}>
              <Text style={[styles.connectedText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Connected
              </Text>
              <ExternalLink size={12} color={theme.colors.primary} />
            </View>
          ) : (
            <Text style={[styles.notConnectedText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Not connected
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading social media...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const platforms = getSocialPlatforms();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Social Media</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                {clubInfo.club_number && (
                  <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Club #{clubInfo.club_number}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.platformsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Social Media Platforms
          </Text>
          
          <View style={styles.platformsGrid}>
            {platforms.map((platform) => (
              <SocialPlatformCard key={platform.key} platform={platform} />
            ))}
          </View>
        </View>

        {socialMedia.website_url && (
          <View style={[styles.websiteSection, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.websiteSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club Website
            </Text>
            <TouchableOpacity
              style={styles.websiteButton}
              onPress={() => handleSocialMediaPress(socialMedia.website_url, 'Website')}
            >
              <ExternalLink size={16} color={theme.colors.primary} />
              <Text style={[styles.websiteButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Visit Club Website
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  clubNumber: {
    fontSize: 13,
  },
  platformsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  platformCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 100,
  },
  platformIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  platformInfo: {
    flex: 1,
  },
  platformTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  notConnectedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  connectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  websiteSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
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
  websiteSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  websiteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
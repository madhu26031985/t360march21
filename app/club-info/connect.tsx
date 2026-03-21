import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Share2, Facebook, Twitter, Linkedin, Instagram, MessageCircle, Youtube, ExternalLink } from 'lucide-react-native';

export default function Connect() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [socialData, setSocialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select('facebook_url, twitter_url, linkedin_url, instagram_url, whatsapp_url, youtube_url, website_url')
        .eq('club_id', user.currentClubId)
        .single();

      if (data) {
        setSocialData(data);
      }
    } catch (error) {
      console.error('Error loading social data:', error);
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connect With Us</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasSocialMedia = socialData?.facebook_url || socialData?.twitter_url || socialData?.linkedin_url ||
    socialData?.instagram_url || socialData?.whatsapp_url || socialData?.youtube_url || socialData?.website_url;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connect With Us</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#06b6d4' + '20' }]}>
              <Share2 size={20} color="#06b6d4" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Social Media</Text>
          </View>

          {hasSocialMedia ? (
            <View style={styles.socialMediaContainer}>
              <View style={styles.socialIconsGrid}>
                {socialData?.facebook_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#1877f2' }]}
                    onPress={() => handleSocialMediaPress(socialData.facebook_url, 'Facebook')}
                  >
                    <Facebook size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}

                {socialData?.twitter_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#1da1f2' }]}
                    onPress={() => handleSocialMediaPress(socialData.twitter_url, 'Twitter')}
                  >
                    <Twitter size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}

                {socialData?.linkedin_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#0a66c2' }]}
                    onPress={() => handleSocialMediaPress(socialData.linkedin_url, 'LinkedIn')}
                  >
                    <Linkedin size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}

                {socialData?.instagram_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#e4405f' }]}
                    onPress={() => handleSocialMediaPress(socialData.instagram_url, 'Instagram')}
                  >
                    <Instagram size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}

                {socialData?.whatsapp_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#25d366' }]}
                    onPress={() => handleSocialMediaPress(socialData.whatsapp_url, 'WhatsApp')}
                  >
                    <MessageCircle size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}

                {socialData?.youtube_url && (
                  <TouchableOpacity
                    style={[styles.socialIcon, { backgroundColor: '#ff0000' }]}
                    onPress={() => handleSocialMediaPress(socialData.youtube_url, 'YouTube')}
                  >
                    <Youtube size={28} color="#ffffff" />
                  </TouchableOpacity>
                )}
              </View>

              {socialData?.website_url && (
                <TouchableOpacity
                  style={[styles.websiteButton, { backgroundColor: '#6366f1' }]}
                  onPress={() => handleSocialMediaPress(socialData.website_url, 'Website')}
                >
                  <ExternalLink size={20} color="#ffffff" />
                  <Text style={styles.websiteButtonText}>Visit Our Website</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noSocialMedia}>
              <Share2 size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.noSocialMediaText, { color: theme.colors.textSecondary }]}>
                No social media links available
              </Text>
              <Text style={[styles.noSocialMediaSubtext, { color: theme.colors.textSecondary }]}>
                Contact your ExComm to add social media links
              </Text>
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
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  socialMediaContainer: {
    gap: 20,
  },
  socialIconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'flex-start',
  },
  socialIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  websiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#6366f1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  websiteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  noSocialMedia: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSocialMediaText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noSocialMediaSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
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
});

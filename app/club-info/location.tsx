import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, MapPin, Globe } from 'lucide-react-native';

export default function Location() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [locationData, setLocationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLocationData();
  }, []);

  const loadLocationData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select('city, country, address, pin_code, google_location_link')
        .eq('club_id', user.currentClubId)
        .single();

      if (data) {
        setLocationData(data);
      }
    } catch (error) {
      console.error('Error loading location data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleMapsPress = async () => {
    try {
      const url = locationData?.google_location_link;
      if (!url) {
        Alert.alert('Error', 'No location link available');
        return;
      }

      let mapsUrl = url;

      if (Platform.OS === 'ios') {
        const googleMapsPattern = /maps\.google\.com\/?\?q=([^&]+)/;
        const match = url.match(googleMapsPattern);

        if (match) {
          const coordinates = decodeURIComponent(match[1]);
          mapsUrl = `maps://maps.apple.com/?q=${encodeURIComponent(coordinates)}`;
        } else {
          mapsUrl = url.replace('https://maps.google.com', 'maps://maps.apple.com');
        }
      }

      const supported = await Linking.canOpenURL(mapsUrl);
      if (supported) {
        await Linking.openURL(mapsUrl);
      } else {
        Alert.alert('Error', 'Cannot open maps application');
      }
    } catch (error) {
      console.error('Error opening maps link:', error);
      Alert.alert('Error', 'Failed to open maps application');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Location</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#ef4444' + '20' }]}>
              <MapPin size={20} color="#ef4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Meeting Location</Text>
          </View>

          {locationData?.city || locationData?.country || locationData?.address ? (
            <View style={styles.locationCard}>
              <View style={styles.locationHeader}>
                <Text style={[styles.locationCity, { color: theme.colors.text }]}>
                  {locationData?.city || 'City not set'}
                </Text>
                <Text style={[styles.locationCountry, { color: theme.colors.textSecondary }]}>
                  {locationData?.country || 'Country not set'}
                </Text>
              </View>

              {locationData?.address && (
                <View style={styles.addressContainer}>
                  <Text style={[styles.addressText, { color: theme.colors.text }]}>
                    {locationData.address}
                  </Text>
                  {locationData?.pin_code && (
                    <Text style={[styles.pinCodeText, { color: theme.colors.textSecondary }]}>
                      {locationData.pin_code}
                    </Text>
                  )}
                </View>
              )}

              {locationData?.google_location_link && (
                <TouchableOpacity
                  style={[styles.mapsButton, { backgroundColor: '#3b82f6' }]}
                  onPress={handleGoogleMapsPress}
                >
                  <Globe size={16} color="#ffffff" />
                  <Text style={styles.mapsButtonText}>
                    {Platform.OS === 'ios' ? 'View on Apple Maps' : 'View on Google Maps'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noLocationInfo}>
              <MapPin size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.noLocationText, { color: theme.colors.textSecondary }]}>
                Location information not available
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
  locationCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
  },
  locationHeader: {
    marginBottom: 16,
    alignItems: 'center',
  },
  locationCity: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  locationCountry: {
    fontSize: 16,
    fontWeight: '500',
  },
  addressContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  addressText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
    fontWeight: '500',
  },
  pinCodeText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  mapsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  noLocationInfo: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noLocationText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
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

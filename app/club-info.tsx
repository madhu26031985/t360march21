import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Building2, Target, Heart, Calendar, MapPin, Share2, Home, Users, Settings } from 'lucide-react-native';

interface MenuItemProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

function MenuItem({ title, icon, color, onPress }: MenuItemProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.menuTitle, { color: theme.colors.text }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function ClubInfo() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [clubName, setClubName] = useState('');
  const [clubNumber, setClubNumber] = useState('');
  const [bannerColor, setBannerColor] = useState('#4f46e5');
  const [isLoading, setIsLoading] = useState(true);
  const [isExComm, setIsExComm] = useState(false);

  useEffect(() => {
    loadClubBasicInfo();
    loadUserRole();
  }, []);

  const loadClubBasicInfo = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (data) {
        setClubName(data.name);
        setClubNumber(data.club_number || '');
      }

      const { data: profileData, error: profileError } = await supabase
        .from('club_profiles')
        .select('banner_color')
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (profileData?.banner_color) {
        setBannerColor(profileData.banner_color);
      }
    } catch (error) {
      console.error('Error loading club info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserRole = async () => {
    if (!user?.id || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading user role:', error);
        return;
      }

      setIsExComm(data?.role === 'excomm');
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Club Information</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Club Information</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroSection, { backgroundColor: bannerColor }]}>
          <Text style={styles.heroClubName}>{clubName}</Text>
          {clubNumber && <Text style={styles.heroClubNumber}>Club #{clubNumber}</Text>}
        </View>

        <View style={styles.content}>
          <View style={styles.menuGrid}>
            <MenuItem
              title="Club Information"
              icon={<Building2 size={18} color="#ffffff" />}
              color="#3b82f6"
              onPress={() => router.push('/club-info/basic-info')}
            />

            <MenuItem
              title="Toastmasters Hierarchy"
              icon={<Target size={18} color="#ffffff" />}
              color="#8b5cf6"
              onPress={() => router.push('/club-info/hierarchy')}
            />

            <MenuItem
              title="Our Mission"
              icon={<Target size={18} color="#ffffff" />}
              color="#ec4899"
              onPress={() => router.push('/club-info/mission')}
            />

            <MenuItem
              title="Our Values"
              icon={<Heart size={18} color="#ffffff" />}
              color="#10b981"
              onPress={() => router.push('/club-info/values')}
            />

            <MenuItem
              title="Meeting Information"
              icon={<Calendar size={18} color="#ffffff" />}
              color="#f59e0b"
              onPress={() => router.push('/club-info/meeting-info')}
            />

            <MenuItem
              title="Location"
              icon={<MapPin size={18} color="#ffffff" />}
              color="#ef4444"
              onPress={() => router.push('/club-info/location')}
            />

            <MenuItem
              title="Connect With Us"
              icon={<Share2 size={18} color="#ffffff" />}
              color="#06b6d4"
              onPress={() => router.push('/club-info/connect')}
            />
          </View>
        </View>

        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
        <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                <Home size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/club')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                <Users size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/meetings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                <Calendar size={16} color="#0ea5e9" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                <Settings size={16} color="#8b5cf6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            {isExComm && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#FFE5E5' }]}>
                  <Settings size={16} color="#dc2626" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>
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
  heroSection: {
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroClubName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroClubNumber: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  content: {
    padding: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  menuItem: {
    width: '31%',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
    borderWidth: 1,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  menuTitle: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
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
  navigationSection: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});

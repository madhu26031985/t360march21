import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Youtube, FileText, Building2, Home, Users, Calendar, Settings } from 'lucide-react-native';

const FOOTER_NAV_ICON_SIZE = 15;

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function ResourcesRepository() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExComm, setIsExComm] = useState(false);

  useEffect(() => {
    loadClubInfo();
    loadUserRole();
  }, []);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

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

      if (error) return;
      setIsExComm(data?.role === 'excomm');
    } catch (error) {
      console.error('Error loading user role:', error);
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

  const resourceCategories: {
    id: string;
    title: string;
    route: '/resources-youtube' | '/resources-evaluation-forms' | '/resources-magazines' | '/resources-others';
    Icon: typeof Youtube;
  }[] = [
    { id: 'youtube', title: 'YouTube Videos', Icon: Youtube, route: '/resources-youtube' },
    { id: 'evaluation_form', title: 'Evaluation Forms', Icon: FileText, route: '/resources-evaluation-forms' },
    { id: 'magazine', title: 'Magazines', Icon: BookOpen, route: '/resources-magazines' },
    { id: 'other_pdf', title: 'Others', Icon: FileText, route: '/resources-others' },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading resources...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Resources</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View
            style={[
              styles.clubCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <View style={styles.clubHeader}>
              <View
                style={[
                  styles.clubIconContainer,
                  { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border },
                ]}
              >
                <Building2 size={20} color={theme.colors.textSecondary} />
              </View>
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
                    <View
                      style={[
                        styles.roleTagNeutral,
                        { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                      ]}
                    >
                      <Text
                        style={[styles.roleTagNeutralText, { color: theme.colors.textSecondary }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {formatRole(user.clubRole)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View
          style={[
            styles.infoCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.infoTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Your club&apos;s knowledge, thoughtfully shared.
          </Text>
        </View>

        <View style={styles.categoriesGrid}>
          {resourceCategories.map((category) => {
            const CatIcon = category.Icon;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryTile,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
                onPress={() => router.push(category.route)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.categoryIconWell,
                    { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.border },
                  ]}
                >
                  <CatIcon size={22} color={theme.colors.textSecondary} strokeWidth={1.75} />
                </View>
                <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {category.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
        <View
          style={[
            styles.navigationSection,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.navigationBar}>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)')}>
              <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                <Home size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/club')}>
              <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/meetings')}>
              <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/settings')}>
              <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                <Settings size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            {isExComm && (
              <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/admin')}>
                <View style={[styles.navIcon, { backgroundColor: theme.colors.background }]}>
                  <Settings size={FOOTER_NAV_ICON_SIZE} color={theme.colors.textSecondary} />
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
    borderWidth: 1,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
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
  roleTagNeutral: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleTagNeutralText: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: 'flex-start',
  },
  categoryTile: {
    width: '31%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 95,
  },
  categoryIconWell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  navSpacer: {
    minHeight: 8,
  },
  navigationSection: {
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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

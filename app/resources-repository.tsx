import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Youtube, FileText, Building2, Crown, User, Shield, Eye, UserCheck, Home, Users, Calendar, Settings } from 'lucide-react-native';

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

  const resourceCategories = [
    {
      id: 'youtube',
      title: 'YouTube Videos',
      icon: <Youtube size={40} color="#ffffff" />,
      color: '#4169E1',
      route: '/resources-youtube',
    },
    {
      id: 'evaluation_form',
      title: 'Evaluation Forms',
      icon: <FileText size={40} color="#ffffff" />,
      color: '#f59e0b',
      route: '/resources-evaluation-forms',
    },
    {
      id: 'magazine',
      title: 'Magazines',
      icon: <BookOpen size={40} color="#ffffff" />,
      color: '#10b981',
      route: '/resources-magazines',
    },
    {
      id: 'other_pdf',
      title: 'Others',
      icon: <FileText size={40} color="#ffffff" />,
      color: '#8b5cf6',
      route: '/resources-others',
    },
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
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
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

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: '#e0f2fe' }]}>
          <Text style={[styles.infoTitle, { color: '#0369a1' }]} maxFontSizeMultiplier={1.3}>
            Your club's knowledge, thoughtfully shared. 📚
          </Text>
        </View>

        {/* Resource Categories Grid */}
        <View style={styles.categoriesGrid}>
          {resourceCategories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryTile,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push(category.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.categoryIconCircle, { backgroundColor: category.color }]}>
                {category.icon}
              </View>
              <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {category.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
        <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationBar}>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)')}>
              <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                <Home size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/club')}>
              <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                <Users size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/meetings')}>
              <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                <Calendar size={16} color="#0ea5e9" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/settings')}>
              <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                <Settings size={16} color="#8b5cf6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            {isExComm && (
              <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/admin')}>
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
  infoCard: {
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
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
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
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: '500',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, ChevronDown, ChevronUp, Users, GraduationCap, Mic, Tag as TagIcon, Award } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface RoleCount {
  role_name: string;
  count: number;
}

interface CategoryData {
  key_speakers: RoleCount[];
  club_speakers: RoleCount[];
  educational_speakers: RoleCount[];
  ancillary_speakers: RoleCount[];
  tag_roles: RoleCount[];
}

export default function RolesCompleted() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryData, setCategoryData] = useState<CategoryData>({
    key_speakers: [],
    club_speakers: [],
    educational_speakers: [],
    ancillary_speakers: [],
    tag_roles: [],
  });

  useEffect(() => {
    if (user?.id) {
      loadRolesData();
    }
  }, [user]);

  const loadRolesData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select('role_name, role_classification')
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true);

      if (error) throw error;

      const roleCounts: { [key: string]: number } = {};
      data?.forEach((role) => {
        roleCounts[role.role_name] = (roleCounts[role.role_name] || 0) + 1;
      });

      const keySpeakers: RoleCount[] = [];
      const clubSpeakers: RoleCount[] = [];
      const educationalSpeakers: RoleCount[] = [];
      const ancillarySpeakers: RoleCount[] = [];
      const tagRoles: RoleCount[] = [];

      Object.entries(roleCounts).forEach(([roleName, count]) => {
        const roleData = data?.find((r) => r.role_name === roleName);
        if (!roleData) return;

        const classification = roleData.role_classification;

        const excludedClassifications = [
          'On-the-Spot Speaking',
          'Prepared Speaker',
          'Speech evaluvator'
        ];

        if (excludedClassifications.includes(classification)) {
          return;
        }

        const roleCount: RoleCount = { role_name: roleName, count };

        if (classification === 'Key Speakers') {
          keySpeakers.push(roleCount);
        } else if (classification === 'Club Speakers') {
          clubSpeakers.push(roleCount);
        } else if (classification === 'Educational speaker') {
          educationalSpeakers.push(roleCount);
        } else if (classification === 'Tag roles') {
          tagRoles.push(roleCount);
        } else {
          ancillarySpeakers.push(roleCount);
        }
      });

      setCategoryData({
        key_speakers: keySpeakers,
        club_speakers: clubSpeakers,
        educational_speakers: educationalSpeakers,
        ancillary_speakers: ancillarySpeakers,
        tag_roles: tagRoles,
      });
    } catch (error) {
      console.error('Error loading roles data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getTotalCount = (roles: RoleCount[]) => {
    return roles.reduce((sum, role) => sum + role.count, 0);
  };

  const totalRoles =
    getTotalCount(categoryData.key_speakers) +
    getTotalCount(categoryData.club_speakers) +
    getTotalCount(categoryData.educational_speakers) +
    getTotalCount(categoryData.ancillary_speakers) +
    getTotalCount(categoryData.tag_roles);

  const renderCategory = (
    title: string,
    icon: React.ReactNode,
    roles: RoleCount[],
    categoryKey: string,
    color: string
  ) => {
    const isExpanded = expandedCategories.has(categoryKey);
    const totalCount = getTotalCount(roles);

    if (totalCount === 0) return null;

    return (
      <View style={[styles.categoryContainer, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(categoryKey)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryLeft}>
            <View style={[styles.categoryIcon, { backgroundColor: color + '15' }]}>
              {icon}
            </View>
            <View style={styles.categoryInfo}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {title}
              </Text>
              <Text style={[styles.categorySubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {totalCount} {totalCount === 1 ? 'activity' : 'activities'}
              </Text>
            </View>
          </View>
          <View style={styles.categoryRight}>
            <View style={[styles.countBadge, { backgroundColor: color + '10' }]}>
              <Text style={[styles.countText, { color: color }]} maxFontSizeMultiplier={1.3}>{totalCount}</Text>
            </View>
            {isExpanded ? (
              <ChevronUp size={20} color={theme.colors.textSecondary} />
            ) : (
              <ChevronDown size={20} color={theme.colors.textSecondary} />
            )}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.rolesListContainer}>
            {roles.map((role) => (
              <View
                key={role.role_name}
                style={[styles.roleItem, { borderLeftColor: color }]}
              >
                <View style={styles.roleLeft}>
                  <View style={[styles.roleDot, { backgroundColor: color }]} />
                  <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {role.role_name}
                  </Text>
                </View>
                <View style={[styles.roleCountBadge, { backgroundColor: color + '10' }]}>
                  <Text style={[styles.roleCountText, { color: color }]} maxFontSizeMultiplier={1.3}>
                    {role.count}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          My Journey
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading your journey...
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.statsContent}>
              <View style={[styles.totalBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                <Award size={28} color={theme.colors.primary} />
              </View>
              <View style={styles.statsText}>
                <Text style={[styles.totalNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {totalRoles}
                </Text>
                <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Total Activities
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.categoriesContainer}>
            {renderCategory(
              'Key Speaker Roles',
              <Users size={20} color="#6366f1" />,
              categoryData.key_speakers,
              'key_speakers',
              '#6366f1'
            )}

            {renderCategory(
              'Club Speaker Roles',
              <Mic size={20} color="#8b5cf6" />,
              categoryData.club_speakers,
              'club_speakers',
              '#8b5cf6'
            )}

            {renderCategory(
              'Educational Speaker Roles',
              <GraduationCap size={20} color="#ec4899" />,
              categoryData.educational_speakers,
              'educational_speakers',
              '#ec4899'
            )}

            {renderCategory(
              'Ancillary Speaker Roles',
              <Mic size={20} color="#10b981" />,
              categoryData.ancillary_speakers,
              'ancillary_speakers',
              '#10b981'
            )}

            {renderCategory(
              'Tag Roles',
              <TagIcon size={20} color="#f59e0b" />,
              categoryData.tag_roles,
              'tag_roles',
              '#f59e0b'
            )}
          </View>

          {totalRoles === 0 && (
            <View style={styles.emptyStateContainer}>
              <Award size={56} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No Roles Yet
              </Text>
              <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Your completed roles will appear here as you progress in your Toastmasters journey
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  totalBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsText: {
    flex: 1,
  },
  totalNumber: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 40,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  categoriesContainer: {
    padding: 16,
    gap: 12,
  },
  categoryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categorySubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
  },
  rolesListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  roleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleName: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  roleCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  roleCountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

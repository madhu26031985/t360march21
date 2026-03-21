import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Crown, User, Building2, Calendar, Filter, Shield, Home, Users, Settings } from 'lucide-react-native';
import { Image } from 'react-native';
import React from 'react';

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

interface ExCommMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface ExCommRole {
  key: string;
  title: string;
  description: string;
  member: ExCommMember | null;
  term_start: string | null;
  term_end: string | null;
}

export default function ExecutiveCommittee() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [excommRoles, setExcommRoles] = useState<ExCommRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'excomm' | 'club_leaders'>('excomm');
  const [isExComm, setIsExComm] = useState(false);

  const excommRoleDefinitions = [
    {
      key: 'president',
      title: 'President',
      description: 'Chief executive officer of the club'
    },
    {
      key: 'vpe',
      title: 'VP Education',
      description: 'Oversees educational programs and member development'
    },
    {
      key: 'vpm',
      title: 'VP Membership',
      description: 'Manages membership growth and retention'
    },
    {
      key: 'vppr',
      title: 'VP Public Relations',
      description: 'Handles club marketing and public relations'
    },
    {
      key: 'secretary',
      title: 'Secretary',
      description: 'Maintains club records and correspondence'
    },
    {
      key: 'treasurer',
      title: 'Treasurer',
      description: 'Manages club finances and dues'
    },
    {
      key: 'saa',
      title: 'Sergeant at Arms',
      description: 'Maintains order and manages club property'
    },
    {
      key: 'ipp',
      title: 'Immediate Past President',
      description: 'Former president providing guidance and continuity'
    },
    {
      key: 'area_director',
      title: 'Area Director',
      description: 'Oversees clubs within a specific area'
    },
    {
      key: 'division_director',
      title: 'Division Director',
      description: 'Manages multiple areas within a division'
    },
    {
      key: 'district_director',
      title: 'District Director',
      description: 'Leads the entire district organization'
    },
    {
      key: 'program_quality_director',
      title: 'Program Quality Director',
      description: 'Ensures quality of educational programs district-wide'
    },
    {
      key: 'club_growth_director',
      title: 'Club Growth Director',
      description: 'Focuses on club growth and new club development'
    },
    {
      key: 'immediate_past_district_director',
      title: 'Immediate Past District Director',
      description: 'Former district director providing continuity and guidance'
    }
  ];

  // Core ExComm roles (8 roles)
  const excommCoreRoles = excommRoleDefinitions.slice(0, 8);

  // Club Leader roles (district-level)
  const clubLeaderRoles = excommRoleDefinitions.slice(8);

  // Memoize filtered roles by category
  const filteredRoles = useMemo(() => {
    const categoryRoles = selectedCategory === 'excomm' ? excommCoreRoles : clubLeaderRoles;
    return excommRoles.filter(role => categoryRoles.some(cr => cr.key === role.key));
  }, [excommRoles, selectedCategory, excommCoreRoles, clubLeaderRoles]);

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

  const loadExcommRoles = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select(`
          president_id, president_term_start, president_term_end,
          ipp_id, ipp_term_start, ipp_term_end,
          vpe_id, vpe_term_start, vpe_term_end,
          vpm_id, vpm_term_start, vpm_term_end,
          vppr_id, vppr_term_start, vppr_term_end,
          secretary_id, secretary_term_start, secretary_term_end,
          treasurer_id, treasurer_term_start, treasurer_term_end,
          saa_id, saa_term_start, saa_term_end,
          area_director_id, area_director_term_start, area_director_term_end,
          division_director_id, division_director_term_start, division_director_term_end,
          district_director_id, district_director_term_start, district_director_term_end,
          program_quality_director_id, program_quality_director_term_start, program_quality_director_term_end,
          club_growth_director_id, club_growth_director_term_start, club_growth_director_term_end,
          immediate_past_district_director_id, immediate_past_district_director_term_start, immediate_past_district_director_term_end
        `)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading excomm roles:', error);
        setExcommRoles([]);
        return;
      }

      const clubProfile = data || {};

      // Get unique member IDs for assigned roles
      const memberIds = [...new Set(
        excommRoleDefinitions
          .map(role => (clubProfile as any)[`${role.key}_id`])
          .filter(Boolean)
      )];

      let members: ExCommMember[] = [];
      if (memberIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from('app_user_profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', memberIds);

        if (membersError) {
          console.error('Error loading member details:', membersError);
        } else {
          members = membersData || [];
        }
      }

      // Build roles with member details
      const roles = excommRoleDefinitions.map(role => {
        const memberId = (clubProfile as any)[`${role.key}_id`];
        const member = memberId ? members.find(m => m.id === memberId) || null : null;

        return {
          key: role.key,
          title: role.title,
          description: role.description,
          member,
          term_start: (clubProfile as any)[`${role.key}_term_start`] || null,
          term_end: (clubProfile as any)[`${role.key}_term_end`] || null,
        };
      });

      setExcommRoles(roles);
    } catch (error) {
      console.error('Error loading excomm roles:', error);
      setExcommRoles([]);
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

  const loadData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadClubInfo(),
        loadExcommRoles(),
        loadUserRole()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <User size={12} color="#ffffff" />;
      case 'club_leader': return <Crown size={12} color="#ffffff" />;
      case 'guest': return <User size={12} color="#ffffff" />;
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

  const ExCommRoleCard = React.memo(({ role }: { role: ExCommRole }) => {
    const handleViewProfile = useCallback(() => {
      if (role.member) {
        router.push({
          pathname: '/member-profile',
          params: { memberId: role.member.id }
        });
      }
    }, [role.member]);

    return (
      <View style={[styles.roleCard, { backgroundColor: theme.colors.surface }]}>
        {/* Role Header with Icon and Title */}
        <View style={styles.roleHeaderSection}>
          <View style={[styles.roleIconLarge, { backgroundColor: '#ede9fe' }]}>
            <Crown size={28} color="#8b5cf6" />
          </View>
          <View style={styles.roleTitleSection}>
            <Text style={[styles.roleTitleLarge, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {role.title}
            </Text>
            <Text style={[styles.roleDescriptionLarge, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {role.description}
            </Text>
          </View>
        </View>

      {/* Member Information */}
      {role.member ? (
        <>
          <View style={styles.memberSectionLarge}>
            <View style={styles.memberAvatarLarge}>
              {role.member.avatar_url ? (
                <Image source={{ uri: role.member.avatar_url }} style={styles.memberAvatarImageLarge} />
              ) : (
                <User size={50} color="#ffffff" />
              )}
            </View>
            <View style={styles.memberDetailsLarge}>
              <Text style={[styles.memberNameLarge, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {role.member.full_name}
              </Text>
            </View>
          </View>

          {/* Term Information */}
          <View style={styles.termSectionLarge}>
            <View style={styles.termColumnRow}>
              <View style={styles.termColumn}>
                <Text style={[styles.termLabelLarge, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Term Start
                </Text>
                <View style={styles.termDateRow}>
                  <Calendar size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.termDateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {formatDate(role.term_start)}
                  </Text>
                </View>
              </View>

              <View style={styles.termColumn}>
                <Text style={[styles.termLabelLarge, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Term End
                </Text>
                <View style={styles.termDateRow}>
                  <Calendar size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.termDateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {formatDate(role.term_end)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* View Profile Button */}
          <TouchableOpacity
            style={[styles.viewProfileButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleViewProfile}
            activeOpacity={0.8}
          >
            <Text style={styles.viewProfileButtonText} maxFontSizeMultiplier={1.3}>
              View profile
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.noMemberAssignedLarge}>
          <View style={[styles.memberAvatarLarge, { backgroundColor: theme.colors.textSecondary }]}>
            <User size={50} color="#ffffff" />
          </View>
          <Text style={[styles.noMemberTextLarge, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            No member assigned
          </Text>
        </View>
      )}
      </View>
    );
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading Executive Committee...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Club Leadership</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                      {getRoleIcon(user.clubRole)}
                      <Text style={styles.roleText}>{formatRole(user.clubRole)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Category Filter */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            <TouchableOpacity
              style={[
                styles.filterTab,
                {
                  backgroundColor: selectedCategory === 'excomm' ? theme.colors.primary : theme.colors.surface,
                  borderColor: selectedCategory === 'excomm' ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedCategory('excomm')}
            >
              <Crown size={16} color={selectedCategory === 'excomm' ? '#ffffff' : theme.colors.textSecondary} />
              <Text style={[
                styles.filterTabText,
                { color: selectedCategory === 'excomm' ? '#ffffff' : theme.colors.text }
              ]}>
                ExComm
              </Text>
              <View style={[
                styles.filterTabCount,
                { backgroundColor: selectedCategory === 'excomm' ? 'rgba(255, 255, 255, 0.2)' : theme.colors.background }
              ]}>
                <Text style={[
                  styles.filterTabCountText,
                  { color: selectedCategory === 'excomm' ? '#ffffff' : theme.colors.textSecondary }
                ]}>
                  {excommCoreRoles.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTab,
                {
                  backgroundColor: selectedCategory === 'club_leaders' ? theme.colors.warning : theme.colors.surface,
                  borderColor: selectedCategory === 'club_leaders' ? theme.colors.warning : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedCategory('club_leaders')}
            >
              <Shield size={16} color={selectedCategory === 'club_leaders' ? '#ffffff' : theme.colors.textSecondary} />
              <Text style={[
                styles.filterTabText,
                { color: selectedCategory === 'club_leaders' ? '#ffffff' : theme.colors.text }
              ]}>
                Club Leaders
              </Text>
              <View style={[
                styles.filterTabCount,
                { backgroundColor: selectedCategory === 'club_leaders' ? 'rgba(255, 255, 255, 0.2)' : theme.colors.background }
              ]}>
                <Text style={[
                  styles.filterTabCountText,
                  { color: selectedCategory === 'club_leaders' ? '#ffffff' : theme.colors.textSecondary }
                ]}>
                  {clubLeaderRoles.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Roles Section */}
        <View style={styles.rolesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            {selectedCategory === 'excomm' ? 'Executive Committee' : 'Club Leaders'}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            {selectedCategory === 'excomm' 
              ? 'Core leadership roles within the club'
              : 'District-level leadership positions'
            }
          </Text>
          
          {filteredRoles.map((role) => (
            <ExCommRoleCard key={role.key} role={role} />
          ))}
        </View>

        {/* Empty State */}
        {filteredRoles.every(role => !role.member) && (
          <View style={styles.emptyState}>
            {selectedCategory === 'excomm' ? (
              <Crown size={48} color={theme.colors.textSecondary} />
            ) : (
              <Shield size={48} color={theme.colors.textSecondary} />
            )}
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              No {selectedCategory === 'excomm' ? 'Executive Committee' : 'Club Leaders'} assigned
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              {selectedCategory === 'excomm'
                ? 'Executive Committee roles will appear here once they are assigned'
                : 'Club leader positions will appear here once they are assigned'
              }
            </Text>
          </View>
        )}

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
  contentContainer: {
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
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
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 12,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    marginRight: 6,
  },
  filterTabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterTabCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  roleCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  roleHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  roleIconLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleTitleSection: {
    flex: 1,
  },
  roleTitleLarge: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  roleDescriptionLarge: {
    fontSize: 14,
    lineHeight: 20,
  },
  memberSectionLarge: {
    alignItems: 'center',
    marginBottom: 24,
  },
  memberAvatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  memberAvatarImageLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  memberDetailsLarge: {
    alignItems: 'center',
  },
  memberNameLarge: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  noMemberAssignedLarge: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noMemberTextLarge: {
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 16,
  },
  termSectionLarge: {
    marginBottom: 20,
  },
  termColumnRow: {
    flexDirection: 'row',
    gap: 16,
  },
  termColumn: {
    flex: 1,
    alignItems: 'center',
  },
  termLabelLarge: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  termDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termDateText: {
    fontSize: 14,
    marginLeft: 6,
  },
  viewProfileButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  viewProfileButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
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
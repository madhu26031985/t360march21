import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ChevronDown, UserCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type ClubInfo = {
  id: string;
  club_name: string;
  club_number: string | null;
};

type Member = {
  id: string;
  full_name: string;
};

type RoleCount = {
  role_name: string;
  count: number;
};

type MemberRoleData = {
  member_id: string;
  member_name: string;
  role_counts: RoleCount[];
  total_roles: number;
};

type ExpandedMembers = {
  [key: string]: boolean;
};

export default function MemberReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'0-3' | '4-6'>('0-3');
  const [roleData, setRoleData] = useState<MemberRoleData[]>([]);
  const [expandedMembers, setExpandedMembers] = useState<ExpandedMembers>({});
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    loadClubInfo();
    loadMembers();
  }, [user?.currentClubId]);

  useEffect(() => {
    if (selectedMembers.length > 0) {
      loadRoleData();
    } else {
      setRoleData([]);
    }
  }, [selectedMembers, selectedRange]);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const [clubRes, profileRes] = await Promise.all([
        supabase.from('clubs').select('id, name, club_number').eq('id', user.currentClubId).maybeSingle(),
        supabase.from('club_profiles').select('banner_color').eq('club_id', user.currentClubId).maybeSingle(),
      ]);
      if (clubRes.data) setClubInfo({ id: clubRes.data.id, club_name: clubRes.data.name, club_number: clubRes.data.club_number });
      setBannerColor(profileRes.data?.banner_color || '#1e3a5f');
    } catch {}
  };

  const loadMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          user_id,
          app_user_profiles!inner(id, full_name)
        `)
        .eq('club_id', user.currentClubId);

      if (error) {
        console.error('Error loading members:', error);
        return;
      }

      const membersList: Member[] = (data || [])
        .map((rel: any) => ({
          id: rel.user_id,
          full_name: rel.app_user_profiles.full_name,
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setMembers(membersList);

      // Auto-select all members on initial load
      if (membersList.length > 0 && selectedMembers.length === 0) {
        setSelectedMembers(membersList.map(m => m.id));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading members:', error);
      setLoading(false);
    }
  };

  const loadRoleData = async () => {
    if (!user?.currentClubId || selectedMembers.length === 0) return;

    try {
      setLoading(true);

      const today = new Date();
      const startDate = new Date();
      const endDate = new Date();

      if (selectedRange === '0-3') {
        startDate.setMonth(today.getMonth() - 3);
      } else {
        startDate.setMonth(today.getMonth() - 6);
        endDate.setMonth(today.getMonth() - 3);
        endDate.setDate(endDate.getDate() - 1);
      }

      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          role_name,
          booking_status,
          app_club_meeting!inner(meeting_date)
        `)
        .eq('club_id', user.currentClubId)
        .eq('booking_status', 'booked')
        .in('assigned_user_id', selectedMembers)
        .gte('app_club_meeting.meeting_date', toLocalDateStr(startDate))
        .lte('app_club_meeting.meeting_date', toLocalDateStr(endDate))
        .not('assigned_user_id', 'is', null);

      if (error) {
        console.error('Error loading role data:', error);
        Alert.alert('Error', 'Failed to load role data');
        setLoading(false);
        return;
      }

      const normalizeRoleName = (roleName: string): string => {
        // Prepared Speaker 1-5 + Ice Breaker 1-5 → "Prepared Speaker"
        if (/^Prepared Speaker \d+$/i.test(roleName) || /^Ice Breaker \d+$/i.test(roleName)) {
          return 'Prepared Speaker';
        }

        // Evaluator 1-5 → "Evaluator"
        if (/^Evaluator \d+$/i.test(roleName)) {
          return 'Evaluator';
        }

        // Table Topics Speaker 1-12 → "Table Topics Speaker"
        if (/^Table Topics Speaker \d+$/i.test(roleName)) {
          return 'Table Topics Speaker';
        }

        return roleName;
      };

      const memberRoleMap = new Map<string, Map<string, number>>();

      (data || []).forEach((record: any) => {
        const memberId = record.assigned_user_id;
        const roleName = record.role_name;

        if (!memberId || !roleName) return;

        const normalizedRole = normalizeRoleName(roleName);

        if (!memberRoleMap.has(memberId)) {
          memberRoleMap.set(memberId, new Map<string, number>());
        }

        const roleMap = memberRoleMap.get(memberId)!;
        roleMap.set(normalizedRole, (roleMap.get(normalizedRole) || 0) + 1);
      });

      const memberDataList: MemberRoleData[] = [];

      selectedMembers.forEach((memberId) => {
        const member = members.find((m) => m.id === memberId);
        if (!member) return;

        const roleMap = memberRoleMap.get(memberId) || new Map();
        const roleCounts: RoleCount[] = Array.from(roleMap.entries())
          .map(([role_name, count]) => ({ role_name, count }))
          .sort((a, b) => b.count - a.count);

        const totalRoles = roleCounts.reduce((sum, r) => sum + r.count, 0);

        memberDataList.push({
          member_id: memberId,
          member_name: member.full_name,
          role_counts: roleCounts,
          total_roles: totalRoles,
        });
      });

      // Sort by total roles (highest first)
      memberDataList.sort((a, b) => b.total_roles - a.total_roles);

      setRoleData(memberDataList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading role data:', error);
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const selectAllMembers = () => {
    setSelectedMembers(members.map((m) => m.id));
  };

  const selectNone = () => {
    setSelectedMembers([]);
  };

  const getSelectedMembersText = () => {
    if (selectedMembers.length === 0) return 'Select members';
    if (selectedMembers.length === 1) {
      const member = members.find((m) => m.id === selectedMembers[0]);
      return member?.full_name || 'Selected';
    }
    if (selectedMembers.length === members.length) return 'All members';
    return `${selectedMembers.length} members selected`;
  };

  const toggleMemberExpansion = (memberId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Member Report
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.clubBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
          <Text style={styles.clubBannerName} maxFontSizeMultiplier={1.3}>{clubInfo?.club_name || ''}</Text>
          {clubInfo?.club_number ? (
            <Text style={styles.clubBannerNumber} maxFontSizeMultiplier={1.3}>Club #{clubInfo.club_number}</Text>
          ) : null}
        </View>

        <View style={styles.filterSection}>
          <TouchableOpacity
            style={[styles.memberDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowMemberDropdown(!showMemberDropdown)}
          >
            <UserCircle size={20} color={theme.colors.textSecondary} />
            <Text style={[styles.dropdownText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {getSelectedMembersText()}
            </Text>
            <ChevronDown size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          {showMemberDropdown && (
            <View style={[styles.dropdownMenu, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.dropdownActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#3b82f6' + '20' }]}
                  onPress={selectAllMembers}
                >
                  <Text style={[styles.actionButtonText, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#ef4444' + '20' }]}
                  onPress={selectNone}
                >
                  <Text style={[styles.actionButtonText, { color: '#ef4444' }]} maxFontSizeMultiplier={1.3}>
                    None
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.memberList} nestedScrollEnabled>
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberItem,
                      { borderBottomColor: theme.colors.border },
                      selectedMembers.includes(member.id) && { backgroundColor: '#3b82f6' + '10' },
                    ]}
                    onPress={() => toggleMember(member.id)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: theme.colors.border },
                        selectedMembers.includes(member.id) && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
                      ]}
                    />
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={styles.rangeSelector}>
          <TouchableOpacity
            style={[
              styles.rangeButton,
              selectedRange === '0-3' && { backgroundColor: '#2563eb' },
              { borderColor: theme.colors.border },
            ]}
            onPress={() => setSelectedRange('0-3')}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selectedRange === '0-3' ? { color: '#fff' } : { color: theme.colors.text },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              0-3 Months
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.rangeButton,
              selectedRange === '4-6' && { backgroundColor: '#2563eb' },
              { borderColor: theme.colors.border },
            ]}
            onPress={() => setSelectedRange('4-6')}
          >
            <Text
              style={[
                styles.rangeButtonText,
                selectedRange === '4-6' ? { color: '#fff' } : { color: theme.colors.text },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              4-6 Months
            </Text>
          </TouchableOpacity>
        </View>

        {loading && selectedMembers.length > 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading role data...
            </Text>
          </View>
        ) : selectedMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <UserCircle size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Select members to view their role report
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {roleData.map((memberData) => {
              const isExpanded = expandedMembers[memberData.member_id];
              return (
                <TouchableOpacity
                  key={memberData.member_id}
                  style={[styles.memberCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => toggleMemberExpansion(memberData.member_id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberCardHeader}>
                    <Text style={[styles.memberCardName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {memberData.member_name}
                    </Text>
                    <View style={[styles.totalBadge, { backgroundColor: '#3b82f6' + '20' }]}>
                      <Text style={[styles.totalBadgeText, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>
                        {memberData.total_roles} roles
                      </Text>
                    </View>
                  </View>

                  {isExpanded && memberData.role_counts.length === 0 && (
                    <Text style={[styles.noRolesText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No roles found in this period
                    </Text>
                  )}

                  {isExpanded && memberData.role_counts.length > 0 && (
                    <View style={styles.rolesList}>
                      {memberData.role_counts.map((role, index) => (
                        <View
                          key={`${role.role_name}-${index}`}
                          style={[styles.roleItem, { borderBottomColor: theme.colors.border }]}
                        >
                          <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {role.role_name}
                          </Text>
                          <View style={[styles.countBadge, { backgroundColor: '#10b981' + '20' }]}>
                            <Text style={[styles.countText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                              {role.count}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacing} />
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
  clubBanner: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  clubBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  clubBannerNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  clubName: {
    fontSize: 18,
    fontWeight: '700',
  },
  filterSection: {
    marginHorizontal: 16,
    marginTop: 16,
    position: 'relative',
    zIndex: 1000,
  },
  memberDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberList: {
    maxHeight: 250,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  rangeSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  resultsContainer: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  memberCard: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberCardName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  totalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noRolesText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  rolesList: {
    gap: 8,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 32,
    alignItems: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
});

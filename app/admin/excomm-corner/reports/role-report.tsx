import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Shield, ChevronDown, ChevronUp, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type MemberEntry = {
  member_name: string;
  count: number;
};

type RoleData = {
  role_name: string;
  count: number;
  members: MemberEntry[];
};

type ClubInfo = {
  id: string;
  club_name: string;
  club_number: string | null;
};

export default function RoleReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roleData, setRoleData] = useState<RoleData[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [selectedRange, setSelectedRange] = useState<'0-3' | '4-6'>('0-3');
  const [expandedRoles, setExpandedRoles] = useState<{ [key: string]: boolean }>({});
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    loadClubInfo();
    loadRoleData();
  }, [user?.currentClubId, selectedRange]);

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

  const normalizeRoleName = (roleName: string): string => {
    if (roleName.match(/^Prepared Speaker [1-5]$/) || roleName.match(/^Ice Breaker [1-5]$/)) {
      return 'Prepared Speaker';
    }
    if (roleName.match(/^Evaluator [1-5]$/)) return 'Evaluator';
    if (roleName.match(/^Table Topics Speaker ([1-9]|1[0-2])$/)) return 'Table Topics Speaker';
    return roleName;
  };

  const loadRoleData = async () => {
    if (!user?.currentClubId) return;

    try {
      setLoading(true);
      setExpandedRoles({});

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
          role_name,
          app_user_profiles ( full_name ),
          meeting:app_club_meeting!inner ( meeting_date, club_id )
        `)
        .eq('meeting.club_id', user.currentClubId)
        .gte('meeting.meeting_date', toLocalDateStr(startDate))
        .lte('meeting.meeting_date', toLocalDateStr(endDate))
        .not('assigned_user_id', 'is', null);

      if (error) {
        setLoading(false);
        return;
      }

      const roleMap: { [role: string]: { [member: string]: number } } = {};

      (data || []).forEach((record: any) => {
        const roleName = normalizeRoleName(record.role_name);
        const memberName = record.app_user_profiles?.full_name || 'Unknown';

        if (!roleMap[roleName]) roleMap[roleName] = {};
        roleMap[roleName][memberName] = (roleMap[roleName][memberName] || 0) + 1;
      });

      const roleCounts: RoleData[] = Object.entries(roleMap)
        .map(([role_name, memberCounts]) => {
          const members: MemberEntry[] = Object.entries(memberCounts)
            .map(([member_name, count]) => ({ member_name, count }))
            .sort((a, b) => b.count - a.count);
          const count = members.reduce((s, m) => s + m.count, 0);
          return { role_name, count, members };
        })
        .sort((a, b) => b.count - a.count);

      setRoleData(roleCounts);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  const toggleRole = (roleName: string) => {
    setExpandedRoles(prev => ({ ...prev, [roleName]: !prev[roleName] }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Role Report
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.clubBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
          <Text style={styles.clubBannerName} maxFontSizeMultiplier={1.3}>
            {clubInfo?.club_name || ''}
          </Text>
          {clubInfo?.club_number ? (
            <Text style={styles.clubBannerNumber} maxFontSizeMultiplier={1.3}>
              Club #{clubInfo.club_number}
            </Text>
          ) : null}
        </View>

        <View style={styles.filterSection}>
          <View style={styles.rangeButtons}>
            <TouchableOpacity
              style={[styles.rangeButton, selectedRange === '0-3' && { backgroundColor: '#3b82f6' }, { borderColor: theme.colors.border }]}
              onPress={() => setSelectedRange('0-3')}
            >
              <Text style={[styles.rangeButtonText, selectedRange === '0-3' ? { color: '#ffffff' } : { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                0-3 Months
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rangeButton, selectedRange === '4-6' && { backgroundColor: '#3b82f6' }, { borderColor: theme.colors.border }]}
              onPress={() => setSelectedRange('4-6')}
            >
              <Text style={[styles.rangeButtonText, selectedRange === '4-6' ? { color: '#ffffff' } : { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                4-6 Months
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading role data...
            </Text>
          </View>
        ) : roleData.length === 0 ? (
          <View style={styles.emptyState}>
            <Shield size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No roles found in this period
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Roles Completed ({roleData.reduce((sum, role) => sum + role.count, 0)} total)
            </Text>

            {roleData.map((role, index) => {
              const isExpanded = expandedRoles[role.role_name];
              return (
                <View
                  key={`${role.role_name}-${index}`}
                  style={[styles.roleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.roleHeader}
                    onPress={() => toggleRole(role.role_name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {role.role_name}
                    </Text>
                    <View style={styles.roleHeaderRight}>
                      <View style={[styles.countBadge, { backgroundColor: '#8b5cf6' + '20' }]}>
                        <Text style={[styles.countText, { color: '#8b5cf6' }]} maxFontSizeMultiplier={1.3}>
                          {role.count}
                        </Text>
                      </View>
                      {isExpanded
                        ? <ChevronUp size={16} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
                        : <ChevronDown size={16} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
                      }
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.membersList, { borderTopColor: theme.colors.border }]}>
                      {role.members.map((member, mIdx) => (
                        <View
                          key={`${member.member_name}-${mIdx}`}
                          style={[
                            styles.memberRow,
                            mIdx < role.members.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.colors.border },
                          ]}
                        >
                          <View style={[styles.memberAvatar, { backgroundColor: '#3b82f6' + '15' }]}>
                            <User size={14} color="#3b82f6" />
                          </View>
                          <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {member.member_name}
                          </Text>
                          <View style={[styles.memberCount, { backgroundColor: theme.colors.background }]}>
                            <Text style={[styles.memberCountText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {member.count}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: { width: 40 },
  content: { flex: 1 },
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
  filterSection: { marginHorizontal: 16, marginTop: 16 },
  rangeButtons: { flexDirection: 'row', gap: 12 },
  rangeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  rangeButtonText: { fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: { marginTop: 16, fontSize: 14 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: { marginTop: 16, fontSize: 14, textAlign: 'center' },
  resultsContainer: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  roleCard: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  roleName: { fontSize: 15, fontWeight: '600', flex: 1 },
  roleHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  countBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 44,
    alignItems: 'center',
  },
  countText: { fontSize: 15, fontWeight: '700' },
  membersList: {
    borderTopWidth: 0.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: { flex: 1, fontSize: 14, fontWeight: '500' },
  memberCount: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 32,
    alignItems: 'center',
  },
  memberCountText: { fontSize: 13, fontWeight: '600' },
  bottomSpacing: { height: 40 },
});

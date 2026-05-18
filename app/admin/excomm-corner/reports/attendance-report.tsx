import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ChevronDown, UserCircle, Home, Users, Calendar, Settings, Shield, CheckCircle2, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

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

type MeetingColumn = {
  id: string;
  meeting_number: string | number | null;
  meeting_date: string;
};

type AttendanceGridRow = {
  member_id: string;
  member_name: string;
  total: number;
  byMeeting: Record<string, boolean>;
};

const NAME_COL_WIDTH = 132;
const MEETING_COL_WIDTH = 52;
const TOTAL_COL_WIDTH = 56;

export default function AttendanceReport() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const hasClub = Boolean(user?.currentClubId);
  const isExComm = user?.clubs?.find((c) => c.id === user.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;
  const FOOTER_NAV_ICON_SIZE = 16;
  const [loading, setLoading] = useState(true);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'0-3' | '4-6'>('0-3');
  const [meetingColumns, setMeetingColumns] = useState<MeetingColumn[]>([]);
  const [gridRows, setGridRows] = useState<AttendanceGridRow[]>([]);
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    loadClubInfo();
    loadMembers();
  }, [user?.currentClubId]);

  useEffect(() => {
    if (selectedMembers.length > 0) {
      loadAttendanceData();
    } else {
      setMeetingColumns([]);
      setGridRows([]);
    }
  }, [selectedMembers, selectedRange, members]);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const [clubRes, profileRes] = await Promise.all([
        supabase.from('clubs').select('id, name, club_number').eq('id', user.currentClubId).maybeSingle(),
        supabase.from('club_profiles').select('banner_color').eq('club_id', user.currentClubId).maybeSingle(),
      ]);
      if (clubRes.data) {
        setClubInfo({
          id: clubRes.data.id,
          club_name: clubRes.data.name,
          club_number: clubRes.data.club_number,
        });
      }
      setBannerColor(profileRes.data?.banner_color || '#1e3a5f');
    } catch {
      // no-op
    }
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

      if (membersList.length > 0 && selectedMembers.length === 0) {
        setSelectedMembers(membersList.map((m) => m.id));
      }
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async () => {
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

      const startStr = toLocalDateStr(startDate);
      const endStr = toLocalDateStr(endDate);

      const [meetingsRes, attendanceRes, rolesRes] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select('id, meeting_number, meeting_date')
          .eq('club_id', user.currentClubId)
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr)
          .order('meeting_date', { ascending: false }),
        supabase
          .from('app_meeting_attendance')
          .select('user_id, meeting_id, attendance_status')
          .eq('club_id', user.currentClubId)
          .in('user_id', selectedMembers)
          .in('attendance_status', ['present', 'late'])
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr),
        supabase
          .from('app_meeting_roles_management')
          .select('assigned_user_id, meeting_id, meeting:app_club_meeting!inner(meeting_date)')
          .eq('club_id', user.currentClubId)
          .in('assigned_user_id', selectedMembers)
          .eq('booking_status', 'booked')
          .gte('meeting.meeting_date', startStr)
          .lte('meeting.meeting_date', endStr),
      ]);

      if (meetingsRes.error || attendanceRes.error || rolesRes.error) {
        console.error(
          'Error loading attendance data:',
          meetingsRes.error || attendanceRes.error || rolesRes.error
        );
        Alert.alert('Error', 'Failed to load attendance data');
        return;
      }

      const columns: MeetingColumn[] = (meetingsRes.data || []).map((m) => ({
        id: m.id,
        meeting_number: m.meeting_number,
        meeting_date: m.meeting_date,
      }));

      const presentKeys = new Set<string>();

      (attendanceRes.data || []).forEach((record: any) => {
        if (record.user_id && record.meeting_id) {
          presentKeys.add(`${record.user_id}:${record.meeting_id}`);
        }
      });

      (rolesRes.data || []).forEach((record: any) => {
        if (record.assigned_user_id && record.meeting_id) {
          presentKeys.add(`${record.assigned_user_id}:${record.meeting_id}`);
        }
      });

      const rows: AttendanceGridRow[] = selectedMembers
        .map((memberId) => {
          const member = members.find((m) => m.id === memberId);
          if (!member) return null;

          const byMeeting: Record<string, boolean> = {};
          let total = 0;

          columns.forEach((col) => {
            const present = presentKeys.has(`${memberId}:${col.id}`);
            byMeeting[col.id] = present;
            if (present) total += 1;
          });

          return {
            member_id: memberId,
            member_name: member.full_name,
            total,
            byMeeting,
          };
        })
        .filter(Boolean) as AttendanceGridRow[];

      rows.sort((a, b) => b.total - a.total || a.member_name.localeCompare(b.member_name));

      setMeetingColumns(columns);
      setGridRows(rows);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.pageMain}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Attendance Report</Text>
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
              Loading attendance data...
            </Text>
          </View>
        ) : selectedMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <UserCircle size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Select members to view attendance report
            </Text>
          </View>
        ) : meetingColumns.length === 0 ? (
          <View style={styles.emptyState}>
            <Calendar size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No meetings in this period
            </Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meetingColumns.length} meeting{meetingColumns.length !== 1 ? 's' : ''} · {gridRows.length} member
              {gridRows.length !== 1 ? 's' : ''}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.gridTable, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.gridHeaderRow, { borderBottomColor: theme.colors.border }]}>
                  <Text
                    style={[styles.gridHeaderCell, styles.gridNameCell, { color: theme.colors.text }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    Name
                  </Text>
                  {meetingColumns.map((col) => (
                    <Text
                      key={col.id}
                      style={[styles.gridHeaderCell, styles.gridMeetingCell, { color: theme.colors.text }]}
                      maxFontSizeMultiplier={1.2}
                    >
                      #{col.meeting_number ?? '—'}
                    </Text>
                  ))}
                  <Text
                    style={[styles.gridHeaderCell, styles.gridTotalCell, { color: theme.colors.text }]}
                    maxFontSizeMultiplier={1.2}
                  >
                    Total
                  </Text>
                </View>
                {gridRows.map((row, index) => {
                  const isLast = index === gridRows.length - 1;
                  return (
                    <View
                      key={row.member_id}
                      style={[
                        styles.gridDataRow,
                        !isLast && {
                          borderBottomColor: theme.colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.gridNameCell, styles.gridNameText, { color: theme.colors.text }]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={1.2}
                      >
                        {row.member_name}
                      </Text>
                      {meetingColumns.map((col) => {
                        const present = row.byMeeting[col.id];
                        return (
                          <View key={col.id} style={styles.gridMeetingCell}>
                            {present ? (
                              <CheckCircle2 size={18} color="#16a34a" />
                            ) : (
                              <XCircle size={18} color="#ef4444" />
                            )}
                          </View>
                        );
                      })}
                      <Text
                        style={[styles.gridTotalCell, styles.gridTotalText, { color: theme.colors.text }]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {row.total}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Home</Text>
          </TouchableOpacity>
          {hasClub ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>
          ) : null}
          {hasClub ? (
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/meetings')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting</Text>
            </TouchableOpacity>
          ) : null}
          {isExComm ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageMain: {
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
  summaryText: {
    fontSize: 13,
    marginBottom: 12,
  },
  gridTable: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gridDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  gridHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridNameCell: {
    width: NAME_COL_WIDTH,
    textAlign: 'left',
    paddingRight: 8,
  },
  gridNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridMeetingCell: {
    width: MEETING_COL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTotalCell: {
    width: TOTAL_COL_WIDTH,
    textAlign: 'center',
  },
  gridTotalText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});

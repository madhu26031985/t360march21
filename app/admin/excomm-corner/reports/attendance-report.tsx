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
import { ArrowLeft, ChevronDown, ChevronUp, UserCircle, Home, Users, Calendar, Settings, Shield } from 'lucide-react-native';
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

type MemberAttendanceData = {
  member_id: string;
  member_name: string;
  attended_count: number;
  attended_meetings: Array<{
    meeting_id: string;
    meeting_date: string | null;
    meeting_number: string | null;
  }>;
};

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
  const [attendanceData, setAttendanceData] = useState<MemberAttendanceData[]>([]);
  const [bannerColor, setBannerColor] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadClubInfo();
    loadMembers();
  }, [user?.currentClubId]);

  useEffect(() => {
    if (selectedMembers.length > 0) {
      loadAttendanceData();
    } else {
      setAttendanceData([]);
    }
  }, [selectedMembers, selectedRange]);

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

      const [attendanceRes, rolesRes] = await Promise.all([
        supabase
          .from('app_meeting_attendance')
          .select(`
            user_id,
            meeting_id,
            attendance_status,
            meeting_date,
            meeting:app_club_meeting!inner(
              meeting_number,
              meeting_date
            )
          `)
          .eq('club_id', user.currentClubId)
          .in('user_id', selectedMembers)
          .eq('attendance_status', 'present')
          .gte('meeting_date', toLocalDateStr(startDate))
          .lte('meeting_date', toLocalDateStr(endDate)),
        supabase
          .from('app_meeting_roles_management')
          .select(`
            assigned_user_id,
            meeting_id,
            booking_status,
            meeting:app_club_meeting!inner(
              meeting_number,
              meeting_date
            )
          `)
          .eq('club_id', user.currentClubId)
          .in('assigned_user_id', selectedMembers)
          .eq('booking_status', 'booked')
          .gte('meeting.meeting_date', toLocalDateStr(startDate))
          .lte('meeting.meeting_date', toLocalDateStr(endDate)),
      ]);

      if (attendanceRes.error || rolesRes.error) {
        console.error('Error loading attendance data:', attendanceRes.error || rolesRes.error);
        Alert.alert('Error', 'Failed to load attendance data');
        return;
      }

      const attendanceMap = new Map<string, number>();
      const meetingMap = new Map<string, Array<{ meeting_id: string; meeting_date: string | null; meeting_number: string | null }>>();
      const seenUserMeeting = new Set<string>();

      const addMeetingForMember = (
        memberId: string | null | undefined,
        meetingId: string | null | undefined,
        meetingDate: string | null,
        meetingNumber: string | null
      ) => {
        if (!memberId || !meetingId) return;
        const uniqueKey = `${memberId}:${meetingId}`;
        if (seenUserMeeting.has(uniqueKey)) return;
        seenUserMeeting.add(uniqueKey);

        attendanceMap.set(memberId, (attendanceMap.get(memberId) || 0) + 1);

        const existingMeetings = meetingMap.get(memberId) || [];
        existingMeetings.push({
          meeting_id: meetingId,
          meeting_date: meetingDate,
          meeting_number: meetingNumber,
        });
        meetingMap.set(memberId, existingMeetings);
      };

      (attendanceRes.data || []).forEach((record: any) => {
        if (!record.user_id) return;
        const existingMeetings = meetingMap.get(record.user_id) || [];
        const meetingObj = Array.isArray(record.meeting) ? record.meeting[0] : record.meeting;
        if (existingMeetings) {
          addMeetingForMember(
            record.user_id,
            record.meeting_id,
            meetingObj?.meeting_date || record.meeting_date || null,
            meetingObj?.meeting_number || null
          );
        }
      });

      (rolesRes.data || []).forEach((record: any) => {
        const meetingObj = Array.isArray(record.meeting) ? record.meeting[0] : record.meeting;
        addMeetingForMember(
          record.assigned_user_id,
          record.meeting_id,
          meetingObj?.meeting_date || null,
          meetingObj?.meeting_number || null
        );
      });

      const memberDataList: MemberAttendanceData[] = selectedMembers
        .map((memberId) => {
          const member = members.find((m) => m.id === memberId);
          if (!member) return null;

          return {
            member_id: memberId,
            member_name: member.full_name,
            attended_count: attendanceMap.get(memberId) || 0,
            attended_meetings: (meetingMap.get(memberId) || []).sort((a, b) => {
              const aTs = a.meeting_date ? new Date(a.meeting_date).getTime() : 0;
              const bTs = b.meeting_date ? new Date(b.meeting_date).getTime() : 0;
              return bTs - aTs;
            }),
          };
        })
        .filter(Boolean) as MemberAttendanceData[];

      memberDataList.sort((a, b) => b.attended_count - a.attended_count);

      setAttendanceData(memberDataList);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberExpansion = (memberId: string) => {
    setExpandedMembers((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const formatMeetingDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date not available';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
        ) : (
          <View style={styles.resultsContainer}>
            {attendanceData.map((memberData) => {
              const isExpanded = !!expandedMembers[memberData.member_id];
              return (
                <TouchableOpacity
                  key={memberData.member_id}
                  style={[styles.memberCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => toggleMemberExpansion(memberData.member_id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.memberCardHeader}>
                    <Text style={[styles.memberCardName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {memberData.member_name}
                    </Text>
                    <View style={styles.badgeWithIcon}>
                      <View style={[styles.totalBadge, { backgroundColor: '#3b82f6' + '20' }]}>
                        <Text style={[styles.totalBadgeText, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>
                          {memberData.attended_count} meetings attended
                        </Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={16} color={theme.colors.textSecondary} />
                      ) : (
                        <ChevronDown size={16} color={theme.colors.textSecondary} />
                      )}
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.meetingsList}>
                      {memberData.attended_meetings.length === 0 ? (
                        <Text style={[styles.emptyMeetingsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          No attended meetings in this period
                        </Text>
                      ) : (
                        memberData.attended_meetings.map((meeting, idx) => (
                          <View
                            key={`${meeting.meeting_id}-${idx}`}
                            style={[styles.meetingItemCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                          >
                            <Text style={[styles.meetingItemTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              Meeting #{meeting.meeting_number || '-'}
                            </Text>
                            <Text style={[styles.meetingItemDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {formatMeetingDate(meeting.meeting_date)}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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
  },
  badgeWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  meetingsList: {
    marginTop: 12,
    gap: 8,
  },
  emptyMeetingsText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  meetingItemCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  meetingItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  meetingItemDate: {
    fontSize: 13,
    fontWeight: '500',
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

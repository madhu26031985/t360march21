import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Building2,
  UserCheck,
  CircleCheck as CheckCircle,
  X as XCircle,
  CircleAlert as AlertCircle,
  User,
  Users,
  Crown,
  Shield,
  Eye,
  Calendar,
  Home,
  Settings,
} from 'lucide-react-native';

const BOOK_ROLE_DOCK_ICON_SIZE = 15;

type AttendanceScopeTab = 'my_attendance' | 'all_attendance';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
}

interface AttendanceRecord {
  id: string;
  meeting_id: string;
  user_id: string;
  club_id: string;
  user_full_name: string;
  user_email: string;
  user_role: string;
  attendance_status: 'present' | 'absent' | 'not_applicable';
  attendance_marked_by: string | null;
  attendance_marked_at: string | null;
  is_attendance_open: boolean;
  created_at: string;
  updated_at: string;
  user_avatar_url?: string | null;
}

const ATTENDANCE_BASE_SELECT = `
  id,
  meeting_id,
  user_id,
  club_id,
  user_full_name,
  user_email,
  user_role,
  attendance_status,
  attendance_marked_by,
  attendance_marked_at,
  is_attendance_open,
  created_at,
  updated_at
`;

function sanitizeAvatarUrl(url: string | null | undefined): string | null {
  const trimmed = (url || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return null;
  if (trimmed.length > 2048) return null;
  return trimmed;
}

export default function AttendanceReport() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceScopeTab, setAttendanceScopeTab] = useState<AttendanceScopeTab>('my_attendance');
  const [selectedTab, setSelectedTab] = useState<'all' | 'present' | 'absent' | 'not_applicable' | 'pending'>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [updatingRecords, setUpdatingRecords] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Array<{ role: string; count: number }>>([]);
  const [allAttendanceLoaded, setAllAttendanceLoaded] = useState(false);

  useEffect(() => {
    if (meetingId) {
      loadAttendanceData();
    }
  }, [meetingId]);

  useEffect(() => {
    if (attendanceScopeTab === 'my_attendance') {
      setSelectedRoleFilter('all');
    }
  }, [attendanceScopeTab]);

  useEffect(() => {
    if (attendanceScopeTab === 'all_attendance' && !allAttendanceLoaded) {
      void loadAllAttendanceRows();
    }
  }, [attendanceScopeTab, allAttendanceLoaded]);

  useEffect(() => {
    calculateRoleFilters();
  }, [attendanceRecords]);

  const baseRecords = useMemo(() => {
    if (attendanceScopeTab === 'my_attendance' && user?.id) {
      return attendanceRecords.filter((r) => r.user_id === user.id);
    }
    return attendanceRecords;
  }, [attendanceRecords, attendanceScopeTab, user?.id]);

  const filteredRecords = useMemo(() => {
    let filtered = [...baseRecords];
    switch (selectedTab) {
      case 'present':
        filtered = filtered.filter((r) => r.attendance_status === 'present');
        break;
      case 'absent':
        filtered = filtered.filter((r) => r.attendance_status === 'absent');
        break;
      case 'not_applicable':
        filtered = filtered.filter((r) => r.attendance_status === 'not_applicable');
        break;
      case 'pending':
        filtered = filtered.filter((r) => !r.attendance_marked_by);
        break;
      default:
        break;
    }
    if (attendanceScopeTab === 'all_attendance' && selectedRoleFilter !== 'all') {
      filtered = filtered.filter(
        (r) => r.user_role.toLowerCase() === selectedRoleFilter.toLowerCase()
      );
    }
    return filtered;
  }, [baseRecords, selectedTab, selectedRoleFilter, attendanceScopeTab]);

  const scopedStats = useMemo(() => {
    const list = baseRecords;
    return {
      total_members: list.length,
      present_count: list.filter((r) => r.attendance_status === 'present').length,
      absent_count: list.filter((r) => r.attendance_status === 'absent').length,
      not_applicable_count: list.filter((r) => r.attendance_status === 'not_applicable').length,
      marked_count: list.filter((r) => r.attendance_marked_by !== null).length,
      pending_count: list.filter((r) => !r.attendance_marked_by).length,
    };
  }, [baseRecords]);

  const tabCounts = useMemo(
    () => ({
      all: baseRecords.length,
      present: baseRecords.filter((r) => r.attendance_status === 'present').length,
      absent: baseRecords.filter((r) => r.attendance_status === 'absent').length,
      not_applicable: baseRecords.filter((r) => r.attendance_status === 'not_applicable').length,
      pending: baseRecords.filter((r) => !r.attendance_marked_by).length,
    }),
    [baseRecords]
  );

  const loadAttendanceData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await loadAttendanceSnapshot();
    } catch (error) {
      console.error('Error loading attendance data:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeetingLite = async () => {
    if (!meetingId) return;
    const { data, error } = await supabase
      .from('app_club_meeting')
      .select('id,meeting_title,meeting_date,meeting_number,meeting_start_time,meeting_end_time,meeting_mode,meeting_location,meeting_link,meeting_status')
      .eq('id', meetingId)
      .single();
    if (!error && data) setMeeting(data as Meeting);
  };

  const loadAttendanceSnapshot = async () => {
    if (!meetingId || !user?.id) return;
    try {
      const { data, error } = await (supabase as any).rpc('get_attendance_report_snapshot', {
        p_meeting_id: meetingId,
      });
      if (!error && data && typeof data === 'object') {
        const raw = data as any;
        if (raw.meeting) {
          setMeeting(raw.meeting as Meeting);
        }
        const myRows = Array.isArray(raw.my_records) ? raw.my_records : [];
        setAttendanceRecords(
          myRows.map((r: any) => ({
            ...r,
            user_avatar_url: sanitizeAvatarUrl(r.user_avatar_url),
          }))
        );
        setAllAttendanceLoaded(false);
        return;
      }
    } catch (error) {
      console.warn('Attendance snapshot RPC failed, using fallback:', error);
    }

    await Promise.all([loadMeetingLite(), loadMyAttendanceRowsFallback()]);
  };

  const loadMyAttendanceRowsFallback = async () => {
    if (!meetingId || !user?.id) return;
    const { data, error } = await supabase
      .from('app_meeting_attendance')
      .select(ATTENDANCE_BASE_SELECT)
      .eq('meeting_id', meetingId)
      .eq('user_id', user.id)
      .order('user_full_name');
    if (error) {
      console.error('Error loading my attendance rows:', error);
      return;
    }
    setAttendanceRecords((data || []).map((r) => ({ ...r, user_avatar_url: null } as AttendanceRecord)));
    setAllAttendanceLoaded(false);
  };

  const loadAllAttendanceRows = async () => {
    if (!meetingId) return;
    try {
      const { data, error } = await (supabase as any).rpc('get_attendance_report_rows', {
        p_meeting_id: meetingId,
      });
      if (!error && Array.isArray(data)) {
        setAttendanceRecords(
          data.map((r: any) => ({
            ...r,
            user_avatar_url: sanitizeAvatarUrl(r.user_avatar_url),
          }))
        );
        setAllAttendanceLoaded(true);
        return;
      }
    } catch (error) {
      console.warn('Attendance rows RPC failed, using fallback:', error);
    }

    const { data, error } = await supabase
      .from('app_meeting_attendance')
      .select(ATTENDANCE_BASE_SELECT)
      .eq('meeting_id', meetingId)
      .order('user_full_name');
    if (error) {
      console.error('Error loading all attendance rows:', error);
      return;
    }
    setAttendanceRecords((data || []).map((r) => ({ ...r, user_avatar_url: null } as AttendanceRecord)));
    setAllAttendanceLoaded(true);
  };

  const calculateRoleFilters = () => {
    const roleCounts = attendanceRecords.reduce((acc, record) => {
      const role = record.user_role.toLowerCase();
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const filters = Object.entries(roleCounts).map(([role, count]) => ({
      role,
      count,
    })).sort((a, b) => b.count - a.count);

    setRoleFilters(filters);
  };

  const handleMarkAttendance = async (recordId: string, status: 'present' | 'absent' | 'not_applicable') => {
    setUpdatingRecords(prev => new Set([...prev, recordId]));
    
    try {
      const { error } = await supabase
        .from('app_meeting_attendance')
        .update({
          attendance_status: status,
          attendance_marked_by: user?.id,
          attendance_marked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', recordId);

      if (error) {
        console.error('Error marking attendance:', error);
        Alert.alert('Error', 'Failed to mark attendance');
        return;
      }

      // Update local state immediately
      setAttendanceRecords(prev => 
        prev.map(record => 
          record.id === recordId 
            ? { 
                ...record, 
                attendance_status: status,
                attendance_marked_by: user?.id || null,
                attendance_marked_at: new Date().toISOString()
              }
            : record
        )
      );
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setUpdatingRecords(prev => {
        const newSet = new Set(prev);
        newSet.delete(recordId);
        return newSet;
      });
    }
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const getRoleIcon = (role: string, size: number, iconColor: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={size} color={iconColor} />;
      case 'visiting_tm':
        return <UserCheck size={size} color={iconColor} />;
      case 'club_leader':
        return <Shield size={size} color={iconColor} />;
      case 'guest':
        return <Eye size={size} color={iconColor} />;
      case 'member':
        return <User size={size} color={iconColor} />;
      default:
        return <User size={size} color={iconColor} />;
    }
  };

  /** Subtle role chip backgrounds (no bright purple/green). */
  const getRoleNotionTint = (role: string) => {
    const r = role.toLowerCase();
    const hairline = theme.colors.border;
    if (r === 'excomm') return { bg: theme.colors.primary + '22', border: hairline };
    if (r === 'member') return { bg: theme.colors.backgroundSecondary, border: hairline };
    if (r === 'guest') return { bg: theme.colors.border + '33', border: hairline };
    return { bg: theme.colors.backgroundSecondary, border: hairline };
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

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'present':
        return { bg: theme.colors.primary + '22', fg: theme.colors.primary };
      case 'absent':
        return { bg: theme.colors.border + '55', fg: theme.colors.text };
      case 'not_applicable':
        return { bg: theme.colors.border + '44', fg: theme.colors.textSecondary };
      default:
        return { bg: theme.colors.border + '44', fg: theme.colors.textSecondary };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'P';
      case 'absent': return 'A';
      case 'not_applicable': return 'NA';
      default: return status;
    }
  };

  const canEditAttendance = (record: AttendanceRecord) => {
    // ExComm can edit anyone's attendance
    if (user?.clubRole?.toLowerCase() === 'excomm') {
      return true;
    }
    
    // Members can edit their own attendance if they marked it themselves
    if (record.user_id === user?.id && record.attendance_marked_by === user?.id) {
      return true;
    }
    
    // Members can mark their own attendance if it hasn't been marked yet
    if (record.user_id === user?.id && !record.attendance_marked_by) {
      return true;
    }
    
    return false;
  };

  const AttendanceCard = ({ record }: { record: AttendanceRecord }) => {
    const isUpdating = updatingRecords.has(record.id);
    const isMarkedByCurrentUser = record.attendance_marked_by === user?.id;
    const canEdit = canEditAttendance(record);
    const roleTint = getRoleNotionTint(record.user_role);
    const statusStyle = getStatusBadgeStyle(record.attendance_status);
    const isPresent = record.attendance_status === 'present';
    const isAbsent = record.attendance_status === 'absent';
    const isNA = record.attendance_status === 'not_applicable';

    const ink = theme.colors.text;
    const muted = theme.colors.textSecondary;
    const hairline = theme.colors.border;
    const shell = theme.colors.surface;
    const accent = theme.colors.primary;
    const accentSoft = theme.colors.primary + '22';
    const inset = theme.colors.backgroundSecondary;

    return (
      <View style={[styles.attendanceCard, { borderBottomColor: hairline }]}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <View style={[styles.memberAvatar, { backgroundColor: inset, borderColor: hairline }]}>
              {record.user_avatar_url ? (
                <Image
                  source={{ uri: record.user_avatar_url }}
                  style={styles.memberAvatarImage}
                  onError={() => {
                    console.log('Avatar load error for:', record.user_full_name);
                  }}
                />
              ) : (
                <Text style={[styles.memberInitials, { color: ink }]} maxFontSizeMultiplier={1.25}>
                  {record.user_full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              )}
            </View>

            <View style={styles.memberDetails}>
              <Text style={[styles.memberName, { color: ink }]} maxFontSizeMultiplier={1.25}>
                {record.user_full_name}
              </Text>
              <View
                style={[
                  styles.roleTag,
                  { backgroundColor: roleTint.bg, borderColor: roleTint.border, borderWidth: 1 },
                ]}
              >
                {getRoleIcon(record.user_role, 12, muted)}
                <Text style={[styles.roleText, { color: ink }]} maxFontSizeMultiplier={1.15}>
                  {formatRole(record.user_role)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusBadgeSquare, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.fg }]} maxFontSizeMultiplier={1.15}>
              {getStatusLabel(record.attendance_status)}
            </Text>
          </View>
        </View>

        {record.attendance_marked_by !== null && (
          <Text style={[styles.markedByText, { color: muted }]} maxFontSizeMultiplier={1.15}>
            {isMarkedByCurrentUser ? 'Marked by you' : 'Marked by ExComm'}
          </Text>
        )}

        {canEdit && (
          <View style={styles.attendanceActionsRow}>
            <Pressable
              onPress={() => handleMarkAttendance(record.id, 'present')}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  borderColor: isPresent ? accent : hairline,
                  backgroundColor: isPresent ? accentSoft : shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <CheckCircle size={12} color={isPresent ? accent : muted} />
              <Text style={[styles.statusPillText, { color: isPresent ? accent : muted }]} maxFontSizeMultiplier={1.1}>
                Here
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleMarkAttendance(record.id, 'absent')}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  borderColor: isAbsent ? ink : hairline,
                  backgroundColor: isAbsent ? theme.colors.border + '44' : shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <XCircle size={12} color={isAbsent ? ink : muted} />
              <Text style={[styles.statusPillText, { color: isAbsent ? ink : muted }]} maxFontSizeMultiplier={1.1}>
                Away
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleMarkAttendance(record.id, 'not_applicable')}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  borderColor: isNA ? muted : hairline,
                  backgroundColor: isNA ? inset : shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <AlertCircle size={12} color={muted} />
              <Text style={[styles.statusPillText, { color: isNA ? ink : muted }]} maxFontSizeMultiplier={1.1}>
                N/A
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const completionPct =
    scopedStats.total_members > 0
      ? Math.round((scopedStats.marked_count / scopedStats.total_members) * 100)
      : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading attendance…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting not found
          </Text>
          <TouchableOpacity
            style={[styles.ghostBackBtn, { borderColor: theme.colors.border, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.ghostBackBtnText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusTab = (key: typeof selectedTab, label: string, count: number) => {
    const selected = selectedTab === key;
    return (
      <Pressable
        key={key}
        onPress={() => setSelectedTab(key)}
        style={({ pressed }) => [
          styles.notionStatusPill,
          {
            opacity: pressed ? 0.92 : 1,
            borderColor: selected ? theme.colors.primary : theme.colors.border,
            backgroundColor: selected ? theme.colors.primary + '18' : theme.colors.surface,
          },
        ]}
      >
        <Text
          style={[styles.notionStatusPillText, { color: selected ? theme.colors.text : theme.colors.textSecondary }]}
          maxFontSizeMultiplier={1.1}
        >
          {label}{' '}
          <Text style={{ fontWeight: '700' }}>({count})</Text>
        </Text>
      </Pressable>
    );
  };

  const tc = theme.colors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tc.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.bookRoleMain}>
          <View style={[styles.header, { backgroundColor: tc.surface, borderBottomColor: tc.border }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color={tc.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
              Attendance
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.bookRoleScroll}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.notionSheet, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.meetingMetaRow}>
                <View style={[styles.dateChip, { backgroundColor: tc.backgroundSecondary }]}>
                  <Text style={[styles.dateChipDay, { color: tc.text }]} maxFontSizeMultiplier={1.2}>
                    {new Date(meeting.meeting_date).getDate()}
                  </Text>
                  <Text style={[styles.dateChipMonth, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                    {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.meetingMetaText}>
                  <Text style={[styles.meetingMetaTitle, { color: tc.text }]} maxFontSizeMultiplier={1.15}>
                    {meeting.meeting_title}
                  </Text>
                  <Text style={[styles.meetingMetaLine, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.15}>
                    {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
                    {meeting.meeting_number != null && String(meeting.meeting_number).trim() !== ''
                      ? ` · Meeting ${meeting.meeting_number}`
                      : ''}
                  </Text>
                  {meeting.meeting_start_time ? (
                    <Text style={[styles.meetingMetaLine, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.15}>
                      {meeting.meeting_start_time}
                      {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
                      {' · '}
                      {formatMeetingMode(meeting.meeting_mode)}
                    </Text>
                  ) : (
                    <Text style={[styles.meetingMetaLine, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.15}>
                      {formatMeetingMode(meeting.meeting_mode)}
                    </Text>
                  )}
                </View>
              </View>

              <View style={[styles.notionHairline, { backgroundColor: tc.border }]} />

              <View style={styles.notionTabsRow}>
                <TouchableOpacity
                  style={[
                    styles.notionTab,
                    {
                      backgroundColor:
                        attendanceScopeTab === 'my_attendance' ? tc.primary : 'transparent',
                      borderColor:
                        attendanceScopeTab === 'my_attendance' ? tc.primary : tc.border,
                    },
                  ]}
                  onPress={() => setAttendanceScopeTab('my_attendance')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.notionTabText,
                      {
                        color: attendanceScopeTab === 'my_attendance' ? '#ffffff' : tc.text,
                      },
                    ]}
                    maxFontSizeMultiplier={1.12}
                  >
                    My attendance
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.notionTab,
                    {
                      backgroundColor:
                        attendanceScopeTab === 'all_attendance' ? tc.primary : 'transparent',
                      borderColor:
                        attendanceScopeTab === 'all_attendance' ? tc.primary : tc.border,
                    },
                  ]}
                  onPress={() => setAttendanceScopeTab('all_attendance')}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.notionTabText,
                      {
                        color: attendanceScopeTab === 'all_attendance' ? '#ffffff' : tc.text,
                      },
                    ]}
                    maxFontSizeMultiplier={1.12}
                  >
                    All attendance
                  </Text>
                </TouchableOpacity>
              </View>

              {attendanceScopeTab === 'all_attendance' && (
                <>
                  <View style={[styles.notionHairline, { backgroundColor: tc.border }]} />

                  <View style={styles.notionStatsRow}>
                    <View style={[styles.notionStatCell, { backgroundColor: tc.backgroundSecondary, borderColor: tc.border }]}>
                      <Text style={[styles.notionStatNum, { color: tc.text }]} maxFontSizeMultiplier={1.15}>
                        {scopedStats.total_members}
                      </Text>
                      <Text style={[styles.notionStatLbl, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        In view
                      </Text>
                    </View>
                    <View style={[styles.notionStatCell, { backgroundColor: tc.primary + '22', borderColor: tc.border }]}>
                      <Text style={[styles.notionStatNum, { color: tc.primary }]} maxFontSizeMultiplier={1.15}>
                        {scopedStats.present_count}
                      </Text>
                      <Text style={[styles.notionStatLbl, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        Here
                      </Text>
                    </View>
                    <View style={[styles.notionStatCell, { backgroundColor: tc.backgroundSecondary, borderColor: tc.border }]}>
                      <Text style={[styles.notionStatNum, { color: tc.text }]} maxFontSizeMultiplier={1.15}>
                        {scopedStats.absent_count}
                      </Text>
                      <Text style={[styles.notionStatLbl, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        Away
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.notionNaNote, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                    N/A · {scopedStats.not_applicable_count}
                  </Text>

                  <View style={styles.progressBlock}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressTitle, { color: tc.text }]} maxFontSizeMultiplier={1.15}>
                        Marked
                      </Text>
                      <Text style={[styles.progressPercentage, { color: tc.primary }]} maxFontSizeMultiplier={1.15}>
                        {completionPct}%
                      </Text>
                    </View>
                    <View style={[styles.progressBar, { backgroundColor: tc.border }]}>
                      <View style={[styles.progressFill, { backgroundColor: tc.primary, width: `${completionPct}%` }]} />
                    </View>
                    <Text style={[styles.progressText, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.12}>
                      {scopedStats.marked_count} of {scopedStats.total_members} rows marked
                    </Text>
                  </View>

                  <View style={[styles.notionHairline, { backgroundColor: tc.border }]} />

                  <Text style={[styles.listCaption, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                    Filter by status
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.notionStatusScroll}
                  >
                    {statusTab('all', 'All', tabCounts.all)}
                    {statusTab('present', 'Here', tabCounts.present)}
                    {statusTab('absent', 'Away', tabCounts.absent)}
                    {statusTab('not_applicable', 'N/A', tabCounts.not_applicable)}
                  </ScrollView>
                </>
              )}

              {attendanceScopeTab === 'all_attendance' && roleFilters.length > 0 ? (
                <>
                  <View style={[styles.notionHairline, { backgroundColor: tc.border }]} />
                  <Text style={[styles.listCaption, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                    Filter by role
                  </Text>
                  <Pressable
                    onPress={() => setSelectedRoleFilter('all')}
                    style={({ pressed }) => [
                      styles.roleFilterRow,
                      {
                        borderColor: selectedRoleFilter === 'all' ? tc.primary : tc.border,
                        backgroundColor: selectedRoleFilter === 'all' ? tc.primary + '18' : tc.surface,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View style={styles.roleFilterRowLeft}>
                      <View style={[styles.roleFilterIconWrap, { backgroundColor: tc.backgroundSecondary }]}>
                        <Building2 size={12} color={selectedRoleFilter === 'all' ? tc.primary : tc.textSecondary} />
                      </View>
                      <Text style={[styles.roleFilterRowText, { color: tc.text }]} maxFontSizeMultiplier={1.12}>
                        All roles
                      </Text>
                    </View>
                    <Text style={[styles.roleFilterRowCount, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                      {attendanceRecords.length}
                    </Text>
                  </Pressable>
                  {roleFilters.map(({ role, count }) => {
                    const sel = selectedRoleFilter === role;
                    const tint = getRoleNotionTint(role);
                    return (
                      <Pressable
                        key={role}
                        onPress={() => setSelectedRoleFilter(role)}
                        style={({ pressed }) => [
                          styles.roleFilterRow,
                          {
                            borderColor: sel ? tc.primary : tc.border,
                            backgroundColor: sel ? tc.primary + '18' : tc.surface,
                            opacity: pressed ? 0.92 : 1,
                          },
                        ]}
                      >
                        <View style={styles.roleFilterRowLeft}>
                          <View style={[styles.roleFilterIconWrap, { backgroundColor: tint.bg }]}>
                            {getRoleIcon(role, 12, sel ? tc.primary : tc.textSecondary)}
                          </View>
                          <Text style={[styles.roleFilterRowText, { color: tc.text }]} maxFontSizeMultiplier={1.12}>
                            {formatRole(role)}
                          </Text>
                        </View>
                        <Text style={[styles.roleFilterRowCount, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                          {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}

              <View style={[styles.notionHairline, { backgroundColor: tc.border }]} />

              <Text style={[styles.listCaption, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.1}>
                {attendanceScopeTab === 'my_attendance'
                  ? 'Your row'
                  : selectedTab === 'all'
                    ? 'Everyone'
                    : selectedTab === 'present'
                      ? 'Here'
                      : selectedTab === 'absent'
                        ? 'Away'
                        : selectedTab === 'not_applicable'
                          ? 'N/A'
                          : 'Unmarked'}{' '}
                ({filteredRecords.length})
              </Text>

              {filteredRecords.length > 0 ? (
                <View>
                  {filteredRecords.map((record) => (
                    <AttendanceCard key={record.id} record={record} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <UserCheck size={36} color={tc.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: tc.text }]} maxFontSizeMultiplier={1.2}>
                    {attendanceScopeTab === 'my_attendance'
                      ? 'No attendance row for you'
                      : 'No one in this filter'}
                  </Text>
                  <Text style={[styles.emptyStateSubtext, { color: tc.textSecondary }]} maxFontSizeMultiplier={1.12}>
                    {attendanceScopeTab === 'my_attendance'
                      ? 'You may not be on the guest list for this meeting yet.'
                      : 'Try another status or role filter.'}
                  </Text>
                </View>
              )}

              <View style={styles.bottomPadding} />
            </View>
          </ScrollView>

          <View
            style={[
              styles.geBottomDock,
              {
                borderTopColor: tc.border,
                backgroundColor: tc.surface,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.footerNavigationContent}
            >
              <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Home size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0a66c2" />
                </View>
                <Text style={[styles.footerNavLabel, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
                  Home
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Users size={BOOK_ROLE_DOCK_ICON_SIZE} color="#d97706" />
                </View>
                <Text style={[styles.footerNavLabel, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
                  Club
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/meetings')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Calendar size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0ea5e9" />
                </View>
                <Text style={[styles.footerNavLabel, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
                  Meeting
                </Text>
              </TouchableOpacity>
              {isExComm ? (
                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/(tabs)/admin')}
                  activeOpacity={0.75}
                >
                  <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                    <Shield size={BOOK_ROLE_DOCK_ICON_SIZE} color="#7c3aed" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
                    Admin
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/settings')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Settings size={BOOK_ROLE_DOCK_ICON_SIZE} color="#6b7280" />
                </View>
                <Text style={[styles.footerNavLabel, { color: tc.text }]} maxFontSizeMultiplier={1.3}>
                  Settings
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    fontSize: 14,
    fontWeight: '500',
  },
  ghostBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghostBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  bookRoleMain: {
    flex: 1,
    minHeight: 0,
  },
  bookRoleScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    ...Platform.select({
      web: {
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      },
      default: {},
    }),
  },
  notionHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 12,
  },
  notionTabsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 8,
  },
  notionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  notionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  meetingMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  dateChip: {
    width: 48,
    height: 48,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipDay: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  dateChipMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -1,
  },
  meetingMetaText: {
    flex: 1,
    minWidth: 0,
  },
  meetingMetaTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingMetaLine: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
  },
  notionStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  notionStatCell: {
    flex: 1,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  notionStatNum: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  notionStatLbl: {
    fontSize: 11,
    fontWeight: '500',
  },
  notionNaNote: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  progressBlock: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 0,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listCaption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  notionStatusScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
    marginBottom: 4,
  },
  notionStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notionStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  roleFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  roleFilterRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  roleFilterIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleFilterRowText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  roleFilterRowCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceCard: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  memberDetails: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeSquare: {
    width: 32,
    height: 32,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  markedByText: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 10,
  },
  attendanceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
  bottomPadding: {
    height: 8,
  },
});
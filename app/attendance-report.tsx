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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Building2,
  UserCheck,
  ClipboardCheck,
  CircleCheck as CheckCircle,
  X as XCircle,
  CircleAlert as AlertCircle,
  User,
  Crown,
  Shield,
  Eye,
  FileText,
  Bell,
  BookOpen,
  CheckSquare,
  Clock,
  Languages,
} from 'lucide-react-native';

const N = {
  canvas: '#F7F7F5',
  shell: '#FFFFFF',
  ink: '#37352F',
  muted: '#787774',
  faint: 'rgba(55, 53, 47, 0.08)',
  hairline: 'rgba(55, 53, 47, 0.09)',
  segment: '#E3E2E0',
  inset: '#FAFAF8',
  accent: '#6BA8F0',
  accentSoft: 'rgba(107, 168, 240, 0.18)',
};

const ATTENDANCE_SHORTCUT_ICON_SIZE = 15;

type AttendanceScopeTab = 'my_attendance' | 'all_attendance';

const ATTENDANCE_SHORTCUTS = [
  { pathname: '/meeting-agenda-view' as const, label: 'Agenda', Icon: FileText },
  { pathname: '/role-completion-report' as const, label: 'Role completion', Icon: ClipboardCheck },
  { pathname: '/live-voting' as const, label: 'Voting', Icon: CheckSquare },
  { pathname: '/ah-counter-corner' as const, label: 'Ah counter', Icon: Bell },
  { pathname: '/grammarian' as const, label: 'Grammarian', Icon: Languages },
  { pathname: '/timer-report-details' as const, label: 'Timer', Icon: Clock },
  { pathname: '/educational-corner' as const, label: 'Educational', Icon: BookOpen },
  { pathname: '/toastmaster-corner' as const, label: 'Toastmaster', Icon: Crown },
] as const;

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

export default function AttendanceReport() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [attendanceScopeTab, setAttendanceScopeTab] = useState<AttendanceScopeTab>('my_attendance');
  const [selectedTab, setSelectedTab] = useState<'all' | 'present' | 'absent' | 'not_applicable' | 'pending'>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [updatingRecords, setUpdatingRecords] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Array<{ role: string; count: number }>>([]);

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
      await Promise.all([
        loadMeeting(),
        loadAttendanceRecords()
      ]);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      Alert.alert('Error', 'Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadAttendanceRecords = async () => {
    if (!meetingId) return;

    try {
      console.log('Loading attendance records for meeting:', meetingId);
      
      const { data, error } = await supabase
        .from('app_meeting_attendance')
        .select(`
          *,
          app_user_profiles!fk_app_meeting_attendance_user_id (
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .order('user_full_name');

      console.log('Attendance records query result:', {
        count: data?.length || 0,
        error: error?.message || 'none',
        sampleData: data?.slice(0, 3).map(d => ({
          name: d.user_full_name,
          status: d.attendance_status,
          markedBy: d.attendance_marked_by,
          hasAvatar: !!(d as any).app_user_profiles?.avatar_url
        })) || []
      });

      if (error) {
        console.error('Error loading attendance records:', error);
        return;
      }

      // Process the data to include avatar URLs
      const processedData = (data || []).map(record => ({
        ...record,
        user_avatar_url: (record as any).app_user_profiles?.avatar_url || null
      }));
      
      setAttendanceRecords(processedData);
    } catch (error) {
      console.error('Error loading attendance records:', error);
    }
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
      console.log('Marking attendance:', { recordId, status, markedBy: user?.id });
      
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
      
      console.log('Attendance marked successfully');
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
    if (r === 'excomm') return { bg: N.accentSoft, border: N.hairline };
    if (r === 'member') return { bg: N.inset, border: N.hairline };
    if (r === 'guest') return { bg: 'rgba(55, 53, 47, 0.05)', border: N.hairline };
    return { bg: N.segment, border: N.hairline };
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
        return { bg: N.accentSoft, fg: N.accent };
      case 'absent':
        return { bg: 'rgba(55, 53, 47, 0.08)', fg: N.ink };
      case 'not_applicable':
        return { bg: 'rgba(55, 53, 47, 0.06)', fg: N.muted };
      default:
        return { bg: 'rgba(55, 53, 47, 0.06)', fg: N.muted };
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

    return (
      <View style={[styles.attendanceCard, { borderBottomColor: N.hairline }]}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <View style={[styles.memberAvatar, { backgroundColor: N.inset, borderColor: N.hairline }]}>
              {record.user_avatar_url ? (
                <Image
                  source={{ uri: record.user_avatar_url }}
                  style={styles.memberAvatarImage}
                  onError={() => {
                    console.log('Avatar load error for:', record.user_full_name);
                  }}
                />
              ) : (
                <Text style={[styles.memberInitials, { color: N.ink }]} maxFontSizeMultiplier={1.25}>
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
              <Text style={[styles.memberName, { color: N.ink }]} maxFontSizeMultiplier={1.25}>
                {record.user_full_name}
              </Text>
              <View
                style={[
                  styles.roleTag,
                  { backgroundColor: roleTint.bg, borderColor: roleTint.border, borderWidth: 1 },
                ]}
              >
                {getRoleIcon(record.user_role, 12, N.muted)}
                <Text style={[styles.roleText, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                  {formatRole(record.user_role)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusBadgeCircle, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.fg }]} maxFontSizeMultiplier={1.15}>
              {getStatusLabel(record.attendance_status)}
            </Text>
          </View>
        </View>

        {record.attendance_marked_by !== null && (
          <Text style={[styles.markedByText, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
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
                  borderColor: isPresent ? N.accent : N.hairline,
                  backgroundColor: isPresent ? N.accentSoft : N.shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <CheckCircle size={12} color={isPresent ? N.accent : N.muted} />
              <Text style={[styles.statusPillText, { color: isPresent ? N.accent : N.muted }]} maxFontSizeMultiplier={1.1}>
                Here
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleMarkAttendance(record.id, 'absent')}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  borderColor: isAbsent ? N.ink : N.hairline,
                  backgroundColor: isAbsent ? 'rgba(55, 53, 47, 0.08)' : N.shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <XCircle size={12} color={isAbsent ? N.ink : N.muted} />
              <Text style={[styles.statusPillText, { color: isAbsent ? N.ink : N.muted }]} maxFontSizeMultiplier={1.1}>
                Away
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleMarkAttendance(record.id, 'not_applicable')}
              disabled={isUpdating}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  borderColor: isNA ? N.muted : N.hairline,
                  backgroundColor: isNA ? N.inset : N.shell,
                  opacity: pressed ? 0.88 : isUpdating ? 0.55 : 1,
                },
              ]}
            >
              <AlertCircle size={12} color={N.muted} />
              <Text style={[styles.statusPillText, { color: isNA ? N.ink : N.muted }]} maxFontSizeMultiplier={1.1}>
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
      <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.ink }]} maxFontSizeMultiplier={1.3}>
            Loading attendance…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.ink }]} maxFontSizeMultiplier={1.3}>
            Meeting not found
          </Text>
          <TouchableOpacity
            style={[styles.ghostBackBtn, { borderColor: N.hairline, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.ghostBackBtnText, { color: N.ink }]} maxFontSizeMultiplier={1.2}>
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
          selected && styles.notionStatusPillActive,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <Text style={[styles.notionStatusPillText, { color: selected ? N.ink : N.muted }]} maxFontSizeMultiplier={1.1}>
          {label}{' '}
          <Text style={{ fontWeight: '700' }}>({count})</Text>
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
      <View style={styles.notionTopBar}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={N.ink} />
        </TouchableOpacity>
        <Text style={[styles.notionTopTitle, { color: N.ink }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          Attendance
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.notionScroll}
        contentContainerStyle={styles.notionScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.notionShell, { backgroundColor: N.shell, borderColor: N.faint }]}>
          <View style={styles.meetingMetaRow}>
            <View style={[styles.dateChip, { backgroundColor: N.inset }]}>
              <Text style={[styles.dateChipDay, { color: N.ink }]} maxFontSizeMultiplier={1.2}>
                {new Date(meeting.meeting_date).getDate()}
              </Text>
              <Text style={[styles.dateChipMonth, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingMetaText}>
              <Text style={[styles.meetingMetaTitle, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                {meeting.meeting_title}
              </Text>
              <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
                {meeting.meeting_number != null && String(meeting.meeting_number).trim() !== ''
                  ? ` · Meeting ${meeting.meeting_number}`
                  : ''}
              </Text>
              {meeting.meeting_start_time ? (
                <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                  {meeting.meeting_start_time}
                  {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
                  {' · '}
                  {formatMeetingMode(meeting.meeting_mode)}
                </Text>
              ) : (
                <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                  {formatMeetingMode(meeting.meeting_mode)}
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.notionSegment, { backgroundColor: N.segment }]}>
            <View style={styles.notionSegmentRow}>
              <Pressable
                onPress={() => setAttendanceScopeTab('my_attendance')}
                style={({ pressed }) => [
                  styles.notionSegPill,
                  attendanceScopeTab === 'my_attendance' && styles.notionSegPillActive,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.notionSegPillText,
                    { color: attendanceScopeTab === 'my_attendance' ? N.ink : N.muted },
                  ]}
                  maxFontSizeMultiplier={1.12}
                >
                  My attendance
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAttendanceScopeTab('all_attendance')}
                style={({ pressed }) => [
                  styles.notionSegPill,
                  attendanceScopeTab === 'all_attendance' && styles.notionSegPillActive,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.notionSegPillText,
                    { color: attendanceScopeTab === 'all_attendance' ? N.ink : N.muted },
                  ]}
                  maxFontSizeMultiplier={1.12}
                >
                  All attendance
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />

          <View style={styles.notionStatsRow}>
            <View style={[styles.notionStatCell, { backgroundColor: N.inset, borderColor: N.hairline }]}>
              <Text style={[styles.notionStatNum, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                {scopedStats.total_members}
              </Text>
              <Text style={[styles.notionStatLbl, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                In view
              </Text>
            </View>
            <View style={[styles.notionStatCell, { backgroundColor: N.accentSoft, borderColor: N.hairline }]}>
              <Text style={[styles.notionStatNum, { color: N.accent }]} maxFontSizeMultiplier={1.15}>
                {scopedStats.present_count}
              </Text>
              <Text style={[styles.notionStatLbl, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                Here
              </Text>
            </View>
            <View style={[styles.notionStatCell, { backgroundColor: N.inset, borderColor: N.hairline }]}>
              <Text style={[styles.notionStatNum, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                {scopedStats.absent_count}
              </Text>
              <Text style={[styles.notionStatLbl, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                Away
              </Text>
            </View>
          </View>
          <Text style={[styles.notionNaNote, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
            N/A · {scopedStats.not_applicable_count}
          </Text>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                Marked
              </Text>
              <Text style={[styles.progressPercentage, { color: N.accent }]} maxFontSizeMultiplier={1.15}>
                {completionPct}%
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: N.hairline }]}>
              <View style={[styles.progressFill, { backgroundColor: N.accent, width: `${completionPct}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: N.muted }]} maxFontSizeMultiplier={1.12}>
              {scopedStats.marked_count} of {scopedStats.total_members} rows marked
            </Text>
          </View>

          <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />

          <Text style={[styles.listCaption, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
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

          {attendanceScopeTab === 'all_attendance' && roleFilters.length > 0 ? (
            <>
              <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />
              <Text style={[styles.listCaption, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                Filter by role
              </Text>
              <Pressable
                onPress={() => setSelectedRoleFilter('all')}
                style={({ pressed }) => [
                  styles.roleFilterRow,
                  {
                    borderColor: selectedRoleFilter === 'all' ? N.accent : N.hairline,
                    backgroundColor: selectedRoleFilter === 'all' ? N.accentSoft : N.shell,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <View style={styles.roleFilterRowLeft}>
                  <View style={[styles.roleFilterIconWrap, { backgroundColor: N.inset }]}>
                    <Building2 size={12} color={selectedRoleFilter === 'all' ? N.accent : N.muted} />
                  </View>
                  <Text style={[styles.roleFilterRowText, { color: N.ink }]} maxFontSizeMultiplier={1.12}>
                    All roles
                  </Text>
                </View>
                <Text style={[styles.roleFilterRowCount, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
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
                        borderColor: sel ? N.accent : N.hairline,
                        backgroundColor: sel ? N.accentSoft : N.shell,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <View style={styles.roleFilterRowLeft}>
                      <View style={[styles.roleFilterIconWrap, { backgroundColor: tint.bg }]}>
                        {getRoleIcon(role, 12, sel ? N.accent : N.muted)}
                      </View>
                      <Text style={[styles.roleFilterRowText, { color: N.ink }]} maxFontSizeMultiplier={1.12}>
                        {formatRole(role)}
                      </Text>
                    </View>
                    <Text style={[styles.roleFilterRowCount, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}

          <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />

          <Text style={[styles.listCaption, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
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
              <UserCheck size={36} color={N.muted} />
              <Text style={[styles.emptyStateText, { color: N.ink }]} maxFontSizeMultiplier={1.2}>
                {attendanceScopeTab === 'my_attendance'
                  ? 'No attendance row for you'
                  : 'No one in this filter'}
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: N.muted }]} maxFontSizeMultiplier={1.12}>
                {attendanceScopeTab === 'my_attendance'
                  ? 'You may not be on the guest list for this meeting yet.'
                  : 'Try another status or role filter.'}
              </Text>
            </View>
          )}

          <View style={[styles.notionDivider, { backgroundColor: N.hairline, marginTop: 8 }]} />
          <Text style={[styles.listCaption, { color: N.muted, marginBottom: 10 }]} maxFontSizeMultiplier={1.1}>
            Shortcuts
          </Text>
          <View style={styles.quickActionsInner}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsContent}
            >
              {ATTENDANCE_SHORTCUTS.map(({ pathname, label, Icon }) => (
                <TouchableOpacity
                  key={pathname}
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname, params: { meetingId: meeting?.id } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: N.inset, borderColor: N.hairline }]}>
                    <Icon size={ATTENDANCE_SHORTCUT_ICON_SIZE} color={N.accent} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.bottomPadding} />
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
    fontSize: 14,
    fontWeight: '500',
  },
  ghostBackBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
  },
  ghostBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notionTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: N.canvas,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notionTopTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  notionScroll: {
    flex: 1,
  },
  notionScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  notionShell: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    ...Platform.select({
      web: {
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      },
      default: {},
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
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
    borderRadius: 8,
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
  notionSegment: {
    borderRadius: 9,
    padding: 3,
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  notionSegmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notionSegPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  notionSegPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  notionSegPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  notionStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  notionStatCell: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
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
    borderRadius: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: N.hairline,
    backgroundColor: N.shell,
  },
  notionStatusPillActive: {
    borderColor: N.accent,
    backgroundColor: N.accentSoft,
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
    borderRadius: 8,
    borderWidth: 1,
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
    borderRadius: 7,
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
    borderRadius: 8,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    borderRadius: 8,
    borderWidth: 1,
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
  quickActionsInner: {
    marginHorizontal: -4,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
    paddingBottom: 2,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 45,
  },
  quickActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    borderWidth: 1,
  },
  quickActionLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 56,
  },
  bottomPadding: {
    height: 8,
  },
});
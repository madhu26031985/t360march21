import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Building2, UserCheck, CircleCheck as CheckCircle, X as XCircle, CircleAlert as AlertCircle, User, Crown, Shield, Eye, FileText, Bell, Calendar, BookOpen, Star, Mic, CheckSquare, Clock, MessageSquare, Award, ClipboardCheck } from 'lucide-react-native';
import { Image } from 'react-native';

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

interface AttendanceStats {
  total_members: number;
  present_count: number;
  absent_count: number;
  not_applicable_count: number;
  marked_count: number;
  pending_count: number;
}

export default function AttendanceReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({
    total_members: 0,
    present_count: 0,
    absent_count: 0,
    not_applicable_count: 0,
    marked_count: 0,
    pending_count: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'all' | 'present' | 'absent' | 'not_applicable' | 'pending'>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [updatingRecords, setUpdatingRecords] = useState<Set<string>>(new Set());
  const [roleFilters, setRoleFilters] = useState<Array<{ role: string; count: number }>>([]);

  useEffect(() => {
    if (meetingId) {
      loadAttendanceData();
    }
  }, [meetingId]);

  useEffect(() => {
    filterRecords();
    calculateStats();
    calculateRoleFilters();
  }, [attendanceRecords, selectedTab, selectedRoleFilter]);

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

  const filterRecords = () => {
    let filtered = attendanceRecords;

    // Filter by attendance status
    switch (selectedTab) {
      case 'present':
        filtered = filtered.filter(r => r.attendance_status === 'present');
        break;
      case 'absent':
        filtered = filtered.filter(r => r.attendance_status === 'absent');
        break;
      case 'not_applicable':
        filtered = filtered.filter(r => r.attendance_status === 'not_applicable');
        break;
      case 'pending':
        filtered = filtered.filter(r => !r.attendance_marked_by);
        break;
    }

    // Filter by role
    if (selectedRoleFilter !== 'all') {
      filtered = filtered.filter(r => r.user_role.toLowerCase() === selectedRoleFilter.toLowerCase());
    }

    setFilteredRecords(filtered);
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

  const calculateStats = () => {
    const presentCount = attendanceRecords.filter(r => r.attendance_status === 'present').length;
    const absentCount = attendanceRecords.filter(r => r.attendance_status === 'absent').length;
    const notApplicableCount = attendanceRecords.filter(r => r.attendance_status === 'not_applicable').length;
    const markedCount = attendanceRecords.filter(r => r.attendance_marked_by !== null).length;
    const pendingCount = attendanceRecords.filter(r => r.attendance_marked_by === null).length;

    setAttendanceStats({
      total_members: attendanceRecords.length,
      present_count: presentCount,
      absent_count: absentCount,
      not_applicable_count: notApplicableCount,
      marked_count: markedCount,
      pending_count: pendingCount,
    });
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

  const getRoleIcon = (role: string, size: number = 16) => {
    const iconColor = "#ffffff";
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={size} color={iconColor} />;
      case 'visiting_tm': return <UserCheck size={size} color={iconColor} />;
      case 'club_leader': return <Shield size={size} color={iconColor} />;
      case 'guest': return <Eye size={size} color={iconColor} />;
      case 'member': return <User size={size} color={iconColor} />;
      default: return <User size={size} color={iconColor} />;
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle size={16} color="#10b981" />;
      case 'absent': return <XCircle size={16} color="#ef4444" />;
      case 'not_applicable': return <AlertCircle size={16} color="#6b7280" />;
      default: return <AlertCircle size={16} color="#6b7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#10b981';
      case 'absent': return '#ef4444';
      case 'not_applicable': return '#6b7280';
      default: return '#6b7280';
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
    const isMarked = record.attendance_marked_by !== null;
    const isMarkedByCurrentUser = record.attendance_marked_by === user?.id;
    const canEdit = canEditAttendance(record);

    return (
      <View style={[styles.attendanceCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={styles.memberInfo}>
            <View style={[styles.memberAvatar, { backgroundColor: getRoleColor(record.user_role) }]}>
              {record.user_avatar_url ? (
                <Image
                  source={{ uri: record.user_avatar_url }}
                  style={styles.memberAvatarImage}
                  onError={() => {
                    console.log('Avatar load error for:', record.user_full_name);
                  }}
                />
              ) : (
                <Text style={styles.memberInitials} maxFontSizeMultiplier={1.3}>
                  {record.user_full_name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              )}
            </View>

            <View style={styles.memberDetails}>
              <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {record.user_full_name}
              </Text>
              <View style={[styles.roleTag, { backgroundColor: getRoleColor(record.user_role) }]}>
                {getRoleIcon(record.user_role, 12)}
                <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(record.user_role)}</Text>
              </View>
            </View>
          </View>

          {/* Status Badge in top right */}
          <View style={[
            styles.statusBadgeCircle,
            { backgroundColor: getStatusColor(record.attendance_status) }
          ]}>
            <Text style={styles.statusBadgeText} maxFontSizeMultiplier={1.3}>
              {getStatusLabel(record.attendance_status)}
            </Text>
          </View>
        </View>

        {isMarked && (
          <Text style={[styles.markedByText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {isMarkedByCurrentUser ? 'Marked by you' : 'Marked by ExComm'}
          </Text>
        )}

        {/* Attendance Actions - Only show if user can edit */}
        {canEdit && (
          <View style={styles.attendanceActionsRow}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                {
                  backgroundColor: record.attendance_status === 'present' ? '#10b981' : '#ffffff',
                  borderColor: '#10b981',
                  opacity: isUpdating ? 0.6 : 1,
                }
              ]}
              onPress={() => handleMarkAttendance(record.id, 'present')}
              disabled={isUpdating}
            >
              <CheckCircle size={9} color={record.attendance_status === 'present' ? '#ffffff' : '#10b981'} />
              <Text style={[
                styles.statusButtonText,
                { color: record.attendance_status === 'present' ? '#ffffff' : '#10b981' }
              ]} maxFontSizeMultiplier={1.3}>
                P
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                {
                  backgroundColor: record.attendance_status === 'absent' ? '#ef4444' : '#ffffff',
                  borderColor: '#ef4444',
                  opacity: isUpdating ? 0.6 : 1,
                }
              ]}
              onPress={() => handleMarkAttendance(record.id, 'absent')}
              disabled={isUpdating}
            >
              <XCircle size={9} color={record.attendance_status === 'absent' ? '#ffffff' : '#ef4444'} />
              <Text style={[
                styles.statusButtonText,
                { color: record.attendance_status === 'absent' ? '#ffffff' : '#ef4444' }
              ]} maxFontSizeMultiplier={1.3}>
                A
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                {
                  backgroundColor: record.attendance_status === 'not_applicable' ? '#6b7280' : theme.colors.surface,
                  borderColor: record.attendance_status === 'not_applicable' ? '#6b7280' : theme.colors.border,
                  opacity: isUpdating ? 0.6 : 1,
                }
              ]}
              onPress={() => handleMarkAttendance(record.id, 'not_applicable')}
              disabled={isUpdating}
              activeOpacity={0.7}
            >
              <AlertCircle size={9} color={record.attendance_status === 'not_applicable' ? '#ffffff' : '#6b7280'} />
              <Text style={[
                styles.statusButtonText,
                { color: record.attendance_status === 'not_applicable' ? '#ffffff' : '#6b7280' }
              ]} maxFontSizeMultiplier={1.3}>
                NA
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading attendance report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Card */}
        <View style={[styles.meetingCard, {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border
        }]}>
          <View style={styles.meetingCardContent}>
            <View style={[styles.dateBox, {
              backgroundColor: theme.colors.primary + '15'
            }]}>
              <Text style={[styles.dateDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).getDate()}
              </Text>
              <Text style={[styles.dateMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingDetails}>
              <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_title}
              </Text>
              <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Day: {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              {meeting.meeting_start_time && (
                <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Time: {meeting.meeting_start_time}
                  {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                </Text>
              )}
              <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Mode: {meeting.meeting_mode === 'in_person' ? 'In Person' :
                       meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
              </Text>
            </View>
          </View>
          <View style={styles.meetingCardDecoration} />
        </View>

        {/* Attendance Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#3b82f6' }]}>
            <Text style={styles.statNumber} maxFontSizeMultiplier={1.3}>{attendanceStats.total_members}</Text>
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.3}>Total Members</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
            <Text style={styles.statNumber} maxFontSizeMultiplier={1.3}>{attendanceStats.present_count}</Text>
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.3}>Present</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#ef4444' }]}>
            <Text style={styles.statNumber} maxFontSizeMultiplier={1.3}>{attendanceStats.absent_count}</Text>
            <Text style={styles.statLabel} maxFontSizeMultiplier={1.3}>Absent</Text>
          </View>
        </View>

        {/* Attendance Progress */}
        <View style={[styles.progressCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.progressLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Attendance Marked
          </Text>
          <Text style={[styles.progressValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {attendanceStats.marked_count} of {attendanceStats.total_members}
          </Text>
        </View>

        {/* Attendance Status Filter Tabs */}
        <View style={styles.tabsContainer}>
          <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            FILTER BY STATUS
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: selectedTab === 'all' ? '#3b82f6' : theme.colors.surface,
                  borderColor: selectedTab === 'all' ? '#3b82f6' : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedTab('all')}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === 'all' ? '#ffffff' : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                All
              </Text>
              <View style={[
                styles.tabCount,
                { backgroundColor: selectedTab === 'all' ? 'rgba(255, 255, 255, 0.3)' : '#3b82f6' + '20' }
              ]}>
                <Text style={[
                  styles.tabCountText,
                  { color: selectedTab === 'all' ? '#ffffff' : '#3b82f6' }
                ]} maxFontSizeMultiplier={1.3}>
                  {attendanceStats.total_members}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: selectedTab === 'present' ? '#10b981' : theme.colors.surface,
                  borderColor: selectedTab === 'present' ? '#10b981' : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedTab('present')}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === 'present' ? '#ffffff' : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Present
              </Text>
              <View style={[
                styles.tabCount,
                { backgroundColor: selectedTab === 'present' ? 'rgba(255, 255, 255, 0.3)' : '#10b981' + '20' }
              ]}>
                <Text style={[
                  styles.tabCountText,
                  { color: selectedTab === 'present' ? '#ffffff' : '#10b981' }
                ]} maxFontSizeMultiplier={1.3}>
                  {attendanceStats.present_count}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: selectedTab === 'absent' ? '#ef4444' : theme.colors.surface,
                  borderColor: selectedTab === 'absent' ? '#ef4444' : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedTab('absent')}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === 'absent' ? '#ffffff' : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Absent
              </Text>
              <View style={[
                styles.tabCount,
                { backgroundColor: selectedTab === 'absent' ? 'rgba(255, 255, 255, 0.3)' : '#ef4444' + '20' }
              ]}>
                <Text style={[
                  styles.tabCountText,
                  { color: selectedTab === 'absent' ? '#ffffff' : '#ef4444' }
                ]} maxFontSizeMultiplier={1.3}>
                  {attendanceStats.absent_count}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: selectedTab === 'not_applicable' ? '#6b7280' : theme.colors.surface,
                  borderColor: selectedTab === 'not_applicable' ? '#6b7280' : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedTab('not_applicable')}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === 'not_applicable' ? '#ffffff' : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                N/A
              </Text>
              <View style={[
                styles.tabCount,
                { backgroundColor: selectedTab === 'not_applicable' ? 'rgba(255, 255, 255, 0.3)' : '#6b7280' + '20' }
              ]}>
                <Text style={[
                  styles.tabCountText,
                  { color: selectedTab === 'not_applicable' ? '#ffffff' : '#6b7280' }
                ]} maxFontSizeMultiplier={1.3}>
                  {attendanceStats.not_applicable_count}
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Role Filter Cards */}
        {roleFilters.length > 0 && (
          <View style={styles.roleFilterSection}>
            <Text style={[styles.filterSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              FILTER BY ROLE
            </Text>

            <TouchableOpacity
              style={[
                styles.roleFilterCard,
                {
                  backgroundColor: selectedRoleFilter === 'all' ? '#3b82f6' : theme.colors.surface,
                  borderColor: selectedRoleFilter === 'all' ? '#3b82f6' : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedRoleFilter('all')}
            >
              <View style={styles.roleFilterLeft}>
                <View style={[
                  styles.roleFilterIcon,
                  { backgroundColor: selectedRoleFilter === 'all' ? 'rgba(255, 255, 255, 0.2)' : '#3b82f6' + '20' }
                ]}>
                  <Building2 size={9} color={selectedRoleFilter === 'all' ? '#ffffff' : '#3b82f6'} />
                </View>
                <Text style={[
                  styles.roleFilterText,
                  { color: selectedRoleFilter === 'all' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  All Roles
                </Text>
              </View>
              <View style={[
                styles.roleFilterBadge,
                { backgroundColor: selectedRoleFilter === 'all' ? 'rgba(255, 255, 255, 0.2)' : '#3b82f6' + '20' }
              ]}>
                <Text style={[
                  styles.roleFilterBadgeText,
                  { color: selectedRoleFilter === 'all' ? '#ffffff' : '#3b82f6' }
                ]} maxFontSizeMultiplier={1.3}>
                  {attendanceRecords.length}
                </Text>
              </View>
            </TouchableOpacity>

            {roleFilters.map(({ role, count }) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleFilterCard,
                  {
                    backgroundColor: selectedRoleFilter === role ? getRoleColor(role) : theme.colors.surface,
                    borderColor: selectedRoleFilter === role ? getRoleColor(role) : theme.colors.border,
                  }
                ]}
                onPress={() => setSelectedRoleFilter(role)}
              >
                <View style={styles.roleFilterLeft}>
                  <View style={[
                    styles.roleFilterIcon,
                    { backgroundColor: selectedRoleFilter === role ? 'rgba(255, 255, 255, 0.2)' : getRoleColor(role) + '20' }
                  ]}>
                    {getRoleIcon(role, 9)}
                  </View>
                  <Text style={[
                    styles.roleFilterText,
                    { color: selectedRoleFilter === role ? '#ffffff' : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {formatRole(role)}
                  </Text>
                </View>
                <View style={[
                  styles.roleFilterBadge,
                  { backgroundColor: selectedRoleFilter === role ? 'rgba(255, 255, 255, 0.2)' : getRoleColor(role) + '20' }
                ]}>
                  <Text style={[
                    styles.roleFilterBadgeText,
                    { color: selectedRoleFilter === role ? '#ffffff' : getRoleColor(role) }
                  ]} maxFontSizeMultiplier={1.3}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Members List */}
        <View style={styles.membersSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {selectedTab === 'all' ? 'All Members' : 
             selectedTab === 'pending' ? 'Pending Members' :
             `${getStatusLabel(selectedTab)} Members`} ({filteredRecords.length})
          </Text>
          
          {filteredRecords.length > 0 ? (
            <View style={styles.membersList}>
              {filteredRecords.map((record) => (
                <AttendanceCard key={record.id} record={record} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <UserCheck size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No members in this category
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {selectedTab === 'pending' 
                  ? 'All attendance has been marked'
                  : `No members with ${getStatusLabel(selectedTab).toLowerCase()} status`
                }
              </Text>
            </View>
          )}
        </View>

        {/* Navigation Quick Actions */}
        <View style={[styles.quickActionsBoxContainer, { backgroundColor: '#ffffff' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                <Bell size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                <Calendar size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                <BookOpen size={24} color="#f97316" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Star size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                <FileText size={24} color="#8b5cf6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Mic size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                <CheckSquare size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <CheckSquare size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                <ClipboardCheck size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                <Award size={24} color="#10b981" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                <Clock size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MessageSquare size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TTM</Text>
            </TouchableOpacity>

          </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    minHeight: 96,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    zIndex: 1,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  meetingCardDateTime: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingCardMode: {
    fontSize: 10,
    fontWeight: '500',
  },
  meetingCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingTop: 6,
    gap: 4,
  },
  statCard: {
    flex: 1,
    borderRadius: 5,
    padding: 7,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  statNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 5,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
  },
  progressCard: {
    marginHorizontal: 6,
    marginTop: 6,
    borderRadius: 5,
    padding: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressLabel: {
    fontSize: 6,
    fontWeight: '500',
    marginBottom: 2,
  },
  progressValue: {
    fontSize: 8,
    fontWeight: '700',
  },
  tabsContainer: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterSectionLabel: {
    fontSize: 5.5,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabsContent: {
    paddingHorizontal: 0,
    gap: 4,
  },
  roleIconSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  roleFilterSection: {
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  roleFilterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  roleFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleFilterIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  roleFilterText: {
    fontSize: 7.5,
    fontWeight: '600',
  },
  roleFilterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 18,
    alignItems: 'center',
  },
  roleFilterBadgeText: {
    fontSize: 7,
    fontWeight: '700',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1.5,
  },
  tabText: {
    fontSize: 6.5,
    fontWeight: '700',
    marginRight: 3,
  },
  tabCount: {
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    borderRadius: 5,
    minWidth: 12,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 6,
    fontWeight: '700',
  },
  membersSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  membersList: {
    gap: 12,
  },
  attendanceCard: {
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  markedByText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  attendanceActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 29,
  },
  statusButtonText: {
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 4,
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
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  quickActionsBoxContainer: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionsContent: {
    paddingHorizontal: 10,
    gap: 10,
  },
  quickActionItem: {
    alignItems: 'center',
    marginRight: 3,
  },
  quickActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 70,
  },
});
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ahCounterQueryKeys, fetchAhCounterSnapshot } from '@/lib/ahCounterSnapshot';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, User, FileText, ChartBar, Play, ClipboardList, Bell, Users, BookOpen, Star, Mic, CheckSquare, FileBarChart, MessageSquare, Crown, Settings, UserCog, LayoutDashboard, Vote, Info, X, UserCheck, NotebookPen, ClipboardCheck, Trash2, Plus, Search } from 'lucide-react-native';
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
  meeting_status: string;
}

interface AssignedAhCounter {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

type TabType = 'audit' | 'report';

interface AuditMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ReportEntry {
  id: string;
  memberId: string;
  memberName: string;
  fillerWord: string;
  avatarUrl: string | null;
  dbRowId?: string;
  dbColumn?: string;
}

const FILLER_WORDS = [
  'Ah', 'Um', 'Uh', 'Er', 'Hmm', 'Like', 'You Know', 'So', 'Well', 'Okay',
  'Actually', 'Basically', 'I Mean', 'Kind Of', 'Sort Of', 'Right', 'Literally', 'You See', 'Anyway', 'Honestly',
];

const FILLER_WORD_TO_COLUMN: Record<string, string> = {
  'Ah': 'ah_count',
  'Um': 'um_count',
  'Uh': 'uh_count',
  'Er': 'er_count',
  'Hmm': 'hmm_count',
  'Like': 'like_count',
  'So': 'so_count',
  'Well': 'well_count',
  'Okay': 'okay_count',
  'You Know': 'you_know_count',
  'Right': 'right_count',
  'Actually': 'actually_count',
  'Basically': 'basically_count',
  'Literally': 'literally_count',
  'I Mean': 'i_mean_count',
  'You See': 'you_see_count',
};

const COLUMN_TO_FILLER_WORD: Record<string, string> = Object.fromEntries(
  Object.entries(FILLER_WORD_TO_COLUMN).map(([word, col]) => [col, word])
);

/** Bottom dock icon size — matches `grammarian.tsx` Grammarian Report footer. */
const FOOTER_NAV_ICON_SIZE = 15;

export default function AhCounterCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignedAhCounter, setAssignedAhCounter] = useState<AssignedAhCounter | null>(null);
  // Don't block navigation on Slow 4G — render the page immediately and hydrate data in the background.
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('audit');
  const hasLoadedOnce = useRef<boolean>(false);
  const hasFocusedOnceRef = useRef<boolean>(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const [reportStats, setReportStats] = useState({ totalSpeakers: 0, completedReports: 0, selectedMembers: 0 });
  const [isExComm, setIsExComm] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const isAssignedAhCounter = !!(assignedAhCounter && user?.id && assignedAhCounter.id === user.id);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);

  // Audit state
  const [auditMembers, setAuditMembers] = useState<AuditMember[]>([]);
  const [auditMembersLoading, setAuditMembersLoading] = useState(false);
  const [selectedFillerWord, setSelectedFillerWord] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([]);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [customFillerWords, setCustomFillerWords] = useState<string[]>([]);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordInput, setNewWordInput] = useState('');
  const [guestMembers, setGuestMembers] = useState<{ user_id: string; full_name: string }[]>([]);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [newGuestInput, setNewGuestInput] = useState('');
  const [bookingAhCounterRole, setBookingAhCounterRole] = useState(false);
  const [showAssignAhCounterModal, setShowAssignAhCounterModal] = useState(false);
  const [assignAhCounterSearch, setAssignAhCounterSearch] = useState('');
  const [assigningAhCounterRole, setAssigningAhCounterRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);

  useEffect(() => {
    if (meetingId && user?.currentClubId) {
      void loadData();
    } else if (!hasLoadedOnce.current) {
      setIsLoading(false);
    }
  }, [meetingId, user?.currentClubId]);

  // Lazy-load the heavy lists by tab to keep initial page load fast.
  useEffect(() => {
    if (!hasLoadedOnce.current) return;
    if (!meetingId || !user?.currentClubId) return;
    if (activeTab === 'audit' && auditMembers.length === 0 && !auditMembersLoading) {
      void loadAuditMembers();
    }
    if (activeTab === 'report' && reportEntries.length === 0) {
      void loadReportEntries();
    }
  }, [activeTab, meetingId, user?.currentClubId, auditMembers.length, auditMembersLoading, reportEntries.length]);

  // Reload report stats and audit members when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      if (meetingId && user?.currentClubId) {
        // Refresh via the same snapshot-first path to avoid duplicate network fan-out.
        void loadData();
      }
    }, [meetingId, user?.currentClubId])
  );

  // Reload report stats when switching to audit tab, and load audit members
  useEffect(() => {
    // Avoid duplicate mount-time fetches; refresh only after the first successful load.
    if (activeTab === 'audit' && hasLoadedOnce.current && meetingId && user?.currentClubId) {
      // Refresh snapshot (counts / assignment) without blocking UI,
      // and ensure the audit member list is fetched on-demand.
      void loadData();
    }
  }, [activeTab, meetingId, user?.currentClubId, auditMembers.length]);

  const handleBookAhCounterInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingAhCounterRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%Ah Counter%' },
        'Ah Counter is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadData();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingAhCounterRole(false);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members: ClubMember[] = (data || [])
        .map((item) => {
          const p = (item as any).app_user_profiles;
          if (!p?.id) return null;
          return {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
          };
        })
        .filter((m): m is ClubMember => m !== null);

      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const handleAssignAhCounterToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningAhCounterRole(true);
    try {
      const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%Ah Counter%' });
      if (!roleId) {
        Alert.alert('Error', 'No open Ah Counter role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignAhCounterModal(false);
        setAssignAhCounterSearch('');
        await loadData();
        Alert.alert('Assigned', `${member.full_name} is now the Ah Counter for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
      }
    } finally {
      setAssigningAhCounterRole(false);
    }
  };

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      if (!hasLoadedOnce.current) setIsLoading(false);
      return;
    }
    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) setIsLoading(true);
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const run = async () => {
    try {
      const effectiveUserId = user?.id ?? '';
      const snap = await queryClient.fetchQuery({
        queryKey: ahCounterQueryKeys.snapshot(
          meetingId,
          user.currentClubId,
          effectiveUserId || 'anon'
        ),
        queryFn: () => fetchAhCounterSnapshot(meetingId),
        staleTime: 60 * 1000,
      });

      if (snap?.meeting && Object.keys(snap.meeting).length > 0 && snap.club_id) {
        setMeeting(snap.meeting as unknown as Meeting);
        setAssignedAhCounter(snap.assigned_ah_counter);
        setIsExComm(snap.is_excomm);
        setIsVPEClub(snap.is_vpe_for_club);
        setReportStats({
          totalSpeakers: snap.report_stats.total_speakers,
          completedReports: snap.report_stats.completed_reports,
          selectedMembers: snap.report_stats.selected_members,
        });
        setPublishedCount(snap.published_count);
        setIsPublished(snap.total_reports > 0 && snap.published_count === snap.total_reports);
        // Heavy lists are loaded on-demand per tab (to keep initial load < 1s).
      } else {
        await Promise.all([
          loadMeeting(),
          loadAssignedAhCounter(),
          loadReportStats(),
          loadUserRole(),
          loadIsVPEClub(),
          loadPublishStatus(),
        ]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      hasLoadedOnce.current = true;
      if (isFirstLoad) setIsLoading(false);
      loadInFlightRef.current = null;
    }
    };

    loadInFlightRef.current = run();
    return loadInFlightRef.current;
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

  const loadAssignedAhCounter = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%Ah Counter%')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading Ah Counter:', error);
        return;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        setAssignedAhCounter({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading Ah Counter:', error);
    }
  };

  const loadIsVPEClub = async () => {
    if (!user?.currentClubId || !user?.id) {
      setIsVPEClub(false);
      return;
    }
    const { data, error } = await supabase
      .from('club_profiles')
      .select('vpe_id')
      .eq('club_id', user.currentClubId)
      .maybeSingle();
    if (error) {
      console.error('Error loading club VPE:', error);
      setIsVPEClub(false);
      return;
    }
    setIsVPEClub(data?.vpe_id === user.id);
  };

  const loadReportStats = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      const [attendeesResult, reportsResult, trackedMembersResult] = await Promise.all([
        supabase
          .from('app_meeting_attendance')
          .select('user_id', { count: 'exact' })
          .eq('meeting_id', meetingId)
          .eq('club_id', user.currentClubId)
          .in('attendance_status', ['present', 'late']),
        supabase
          .from('ah_counter_reports')
          .select('speaker_user_id', { count: 'exact' })
          .eq('meeting_id', meetingId)
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('ah_counter_tracked_members')
          .select('user_id', { count: 'exact' })
          .eq('meeting_id', meetingId)
          .eq('club_id', user.currentClubId)
      ]);

      setReportStats({
        totalSpeakers: attendeesResult.count || 0,
        completedReports: reportsResult.count || 0,
        selectedMembers: trackedMembersResult.count || 0
      });
    } catch (error) {
      console.error('Error loading report stats:', error);
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

  const loadPublishStatus = async () => {
    if (!meetingId || !user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('ah_counter_reports')
        .select('id, is_published')
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);
      if (error) return;
      const total = data?.length || 0;
      const published = data?.filter(r => r.is_published).length || 0;
      setPublishedCount(published);
      setIsPublished(total > 0 && published === total);
    } catch (e) {
      console.error('Error loading publish status:', e);
    }
  };

  const handlePublishAll = async () => {
    if (!meetingId || !user?.currentClubId) return;
    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('ah_counter_reports')
        .update({ is_published: true })
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);
      if (error) { Alert.alert('Error', 'Failed to publish report'); return; }
      setIsPublished(true);
      await loadPublishStatus();
    } catch (e) {
      Alert.alert('Error', 'Failed to publish report');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublishAll = async () => {
    if (!meetingId || !user?.currentClubId) return;
    setIsPublishing(true);
    try {
      const { error } = await supabase
        .from('ah_counter_reports')
        .update({ is_published: false })
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);
      if (error) { Alert.alert('Error', 'Failed to unpublish report'); return; }
      setIsPublished(false);
      await loadPublishStatus();
    } catch (e) {
      Alert.alert('Error', 'Failed to unpublish report');
    } finally {
      setIsPublishing(false);
    }
  };

  const loadReportEntries = async () => {
    if (!meetingId || !user?.currentClubId) return;
    try {
      const { data, error } = await (supabase as any).rpc('get_ah_counter_report_rows', {
        p_meeting_id: meetingId,
      });
      if (error || !Array.isArray(data)) {
        console.error('Error loading report entries:', error);
        return;
      }
      const entries: ReportEntry[] = [];
      for (const row of (data || [])) {
        const avatarUrl = (row as any).app_user_profiles?.avatar_url ?? null;
        for (const [col, word] of Object.entries(COLUMN_TO_FILLER_WORD)) {
          const count = (row as any)[col] || 0;
          for (let i = 0; i < count; i++) {
            entries.push({
              id: `${row.id}_${col}_${i}`,
              memberId: row.speaker_user_id || `guest_${row.speaker_name}`,
              memberName: row.speaker_name,
              fillerWord: word,
              avatarUrl,
              dbRowId: row.id,
              dbColumn: col,
            });
          }
        }
      }
      entries.sort((a, b) => a.memberName.localeCompare(b.memberName));
      setReportEntries(entries);
    } catch (e) {
      console.error('Error loading report entries:', e);
    }
  };

  const loadAuditMembers = async () => {
    if (!meetingId || !user?.currentClubId) return;
    setAuditMembersLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_ah_counter_audit_members', {
        p_meeting_id: meetingId,
      });
      if (error || !Array.isArray(data)) {
        console.error('Error loading audit members:', error);
        setAuditMembers([]);
        return;
      }
      setAuditMembers(
        (data || []).map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
        }))
      );
    } catch (error) {
      console.error('Error loading audit members:', error);
    } finally {
      setAuditMembersLoading(false);
    }
  };

  const addToReport = async () => {
    if (!selectedFillerWord || !selectedMemberId || !meetingId || !user?.currentClubId || !user?.id) return;
    const member = [...auditMembers, ...guestMembers].find(m => m.user_id === selectedMemberId);
    if (!member) return;

    setIsSavingEntry(true);
    try {
      const column = FILLER_WORD_TO_COLUMN[selectedFillerWord];

      const { data: existing } = await supabase
        .from('ah_counter_reports')
        .select('id, ' + column)
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId)
        .eq('speaker_user_id', selectedMemberId)
        .maybeSingle();

      if (existing) {
        const currentCount = (existing as any)[column] || 0;
        await supabase
          .from('ah_counter_reports')
          .update({ [column]: currentCount + 1 })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('ah_counter_reports')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            speaker_user_id: selectedMemberId,
            speaker_name: member.full_name,
            recorded_by: user.id,
            [column]: 1,
          });
      }

      const newEntry: ReportEntry = {
        id: Date.now().toString(),
        memberId: selectedMemberId,
        memberName: member.full_name,
        fillerWord: selectedFillerWord,
        avatarUrl: member.avatar_url,
        dbRowId: existing?.id,
        dbColumn: column,
      };
      setReportEntries(prev => [newEntry, ...prev]);
      setSelectedFillerWord(null);
      setSelectedMemberId(null);
    } catch (error) {
      console.error('Error adding entry:', error);
    } finally {
      setIsSavingEntry(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    const entry = reportEntries.find(e => e.id === entryId);
    setReportEntries(prev => prev.filter(e => e.id !== entryId));

    if (!entry?.dbRowId || !entry?.dbColumn) return;
    try {
      const { data: row } = await supabase
        .from('ah_counter_reports')
        .select(`id, ${entry.dbColumn}`)
        .eq('id', entry.dbRowId)
        .maybeSingle();

      if (!row) return;
      const currentCount = (row as any)[entry.dbColumn] || 0;
      if (currentCount <= 1) {
        const remainingCols = Object.values(FILLER_WORD_TO_COLUMN)
          .filter(c => c !== entry.dbColumn);
        const { data: otherRow } = await supabase
          .from('ah_counter_reports')
          .select(remainingCols.join(', '))
          .eq('id', entry.dbRowId)
          .maybeSingle();
        const hasOtherCounts = otherRow
          ? remainingCols.some(c => ((otherRow as any)[c] || 0) > 0)
          : false;
        if (hasOtherCounts) {
          await supabase
            .from('ah_counter_reports')
            .update({ [entry.dbColumn]: 0 })
            .eq('id', entry.dbRowId);
        } else {
          await supabase
            .from('ah_counter_reports')
            .delete()
            .eq('id', entry.dbRowId);
        }
      } else {
        await supabase
          .from('ah_counter_reports')
          .update({ [entry.dbColumn]: currentCount - 1 })
          .eq('id', entry.dbRowId);
      }
    } catch (e) {
      console.error('Error removing entry from DB:', e);
    }
  };

  const confirmAddCustomWord = () => {
    const word = newWordInput.trim();
    if (!word) return;
    const allWords = [...FILLER_WORDS, ...customFillerWords];
    if (allWords.some(w => w.toLowerCase() === word.toLowerCase())) {
      setNewWordInput('');
      setShowAddWordModal(false);
      return;
    }
    setCustomFillerWords(prev => [...prev, word]);
    setSelectedFillerWord(word);
    setNewWordInput('');
    setShowAddWordModal(false);
  };

  const confirmAddGuest = () => {
    const name = newGuestInput.trim();
    if (!name) return;
    const guestId = `guest_${Date.now()}`;
    const newGuest = { user_id: guestId, full_name: name };
    setGuestMembers(prev => [...prev, newGuest]);
    setSelectedMemberId(guestId);
    setNewGuestInput('');
    setShowAddGuestModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'N/A';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredMembersForAssignAhCounter = clubMembers.filter((member) => {
    const q = assignAhCounterSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  const handleAhCounterNavPress = () => {
    if (!meetingId) return;
    if (isVPEClub && !assignedAhCounter) {
      setShowAssignAhCounterModal(true);
      void loadClubMembers();
    } else {
      router.push({ pathname: '/ah-counter-corner', params: { meetingId } });
    }
  };

  // Note: we intentionally do not return a full-screen loading state.
  // The screen should open instantly; sections show their own spinners/placeholders.

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if no Ah Counter is assigned - show simple empty state
  if (!assignedAhCounter) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter Report</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.noBookingContentContainer}>
          <View style={styles.noBookingContentTop}>
          <View style={[styles.noAssignmentNotionCard, {
            backgroundColor: theme.colors.surface,
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
                    Time: {formatTime(meeting.meeting_start_time)}
                    {meeting.meeting_end_time && ` - ${formatTime(meeting.meeting_end_time)}`}
                  </Text>
                )}
                <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Mode: {meeting.meeting_mode === 'in_person' ? 'In Person' :
                         meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
                </Text>
              </View>
            </View>
            <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />

          {/* No Ah Counter Assigned State */}
          <View style={[styles.noAssignmentState, styles.noAssignmentStateInCard]}>
            <View style={[styles.noAssignmentIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
              <ClipboardList size={32} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.noAssignmentTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Turn 'ahhs' into awareness!
            </Text>
            <Text style={[styles.noAssignmentSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              It's time to become — Ah Counter now. 😊
            </Text>
            <TouchableOpacity
              style={[
                styles.bookRoleButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: bookingAhCounterRole || assigningAhCounterRole ? 0.85 : 1,
                },
              ]}
              onPress={() => handleBookAhCounterInline()}
              disabled={bookingAhCounterRole || assigningAhCounterRole}
            >
              {bookingAhCounterRole ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                  Book Ah Counter Role
                </Text>
              )}
            </TouchableOpacity>
          </View>
            <View style={styles.meetingCardDecoration} />
          </View>
          </View>

          {/* Footer Navigation */}
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 24,
            marginBottom: 16,
          }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerNavigationContent}>
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                  <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={handleAhCounterNavPress}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Bell size={FOOTER_NAV_ICON_SIZE} color="#4f46e5" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF4E6' }]}>
                  <Star size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" fill="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TMOD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                  <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#16a34a" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Star size={FOOTER_NAV_ICON_SIZE} color="#ea580c" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                  <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#4f46e5" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Mic size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                  <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                  <Mic size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6F4FF' }]}>
                  <Clock size={FOOTER_NAV_ICON_SIZE} color="#0369a1" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF1F2' }]}>
                  <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#e11d48" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>

              {/* ExComm-Only Admin Icons */}
              {isExComm && (
                <>
                  <TouchableOpacity
                    style={styles.footerNavItem}
                    onPress={() => router.push('/admin/voting-operations')}
                  >
                    <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                      <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#772432" />
                    </View>
                    <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.footerNavItem}
                    onPress={() => router.push('/admin/meeting-management')}
                  >
                    <View style={[styles.footerNavIcon, { backgroundColor: '#DBEAFE' }]}>
                      <LayoutDashboard size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                    </View>
                    <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.footerNavItem}
                    onPress={() => router.push('/admin/manage-club-users')}
                  >
                    <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3C7' }]}>
                      <UserCog size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                    </View>
                    <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.footerNavItem}
                    onPress={() => router.push('/admin/club-operations')}
                  >
                    <View style={[styles.footerNavIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Settings size={FOOTER_NAV_ICON_SIZE} color="#10b981" />
                    </View>
                    <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </ScrollView>

        <Modal
          visible={showAssignAhCounterModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAssignAhCounterModal(false);
            setAssignAhCounterSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAssignAhCounterModal(false);
              setAssignAhCounterSearch('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.assignAhCounterMemberModal, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.assignAhCounterModalHeader}>
                <Text style={[styles.assignAhCounterModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Assign Ah Counter
                </Text>
                <TouchableOpacity
                  style={styles.assignAhCounterModalClose}
                  onPress={() => {
                    setShowAssignAhCounterModal(false);
                    setAssignAhCounterSearch('');
                  }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.assignAhCounterModalHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Choose a club member to book the Ah Counter role for this meeting.
              </Text>
              <View style={[styles.assignAhCounterSearchRow, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.assignAhCounterSearchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={assignAhCounterSearch}
                  onChangeText={setAssignAhCounterSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {assignAhCounterSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAssignAhCounterSearch('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.assignAhCounterMembersScroll} showsVerticalScrollIndicator={false}>
                {assigningAhCounterRole ? (
                  <View style={styles.assignAhCounterNoResults}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : filteredMembersForAssignAhCounter.length > 0 ? (
                  filteredMembersForAssignAhCounter.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.assignAhCounterMemberRow, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignAhCounterToMember(member)}
                      disabled={assigningAhCounterRole}
                    >
                      <View style={styles.assignAhCounterMemberAvatar}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.assignAhCounterMemberAvatarImg} />
                        ) : (
                          <User size={20} color="#ffffff" />
                        )}
                      </View>
                      <View style={styles.assignAhCounterMemberInfo}>
                        <Text style={[styles.assignAhCounterMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.assignAhCounterNoResults}>
                    <Text style={[styles.assignAhCounterNoResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No members found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowInfoModal(true)}>
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={styles.contentTop}>
        {/* Meeting Info Card */}
        <View style={[styles.meetingCardSimple, {
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
              <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_title}
              </Text>
              <Text style={[styles.meetingInfo, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Day: {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              <Text style={[styles.meetingInfo, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Time: {formatTime(meeting.meeting_start_time)} - {formatTime(meeting.meeting_end_time)}
              </Text>
              <Text style={[styles.meetingInfo, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Mode: {meeting.meeting_mode}
              </Text>
            </View>
          </View>
        </View>

        {/* Assigned Ah Counter Card */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.ahCounterCard}>
            <View style={styles.ahCounterInfo}>
              <View style={styles.ahCounterAvatar}>
                {assignedAhCounter.avatar_url ? (
                  <Image
                    source={{ uri: assignedAhCounter.avatar_url }}
                    style={styles.ahCounterAvatarImage}
                  />
                ) : (
                  <User size={16} color="#ffffff" />
                )}
              </View>
              <View style={styles.ahCounterDetails}>
                <Text style={[styles.ahCounterName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {assignedAhCounter.full_name}
                </Text>
                <Text style={[styles.ahCounterRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Ah Counter
                </Text>
              </View>
              {isAssignedAhCounter && (
                <TouchableOpacity
                  style={styles.prepSpaceIconButton}
                  onPress={() => router.push({ pathname: '/ah-counter-notes', params: { meetingId: meeting?.id } })}
                >
                  <NotebookPen size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'audit' && { borderBottomWidth: 2, borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('audit')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'audit' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Ah Counter Audit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'report' && { borderBottomWidth: 2, borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('report')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'report' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Publish Report
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'audit' ? (
          <View style={styles.tabContent}>
            {!isAssignedAhCounter && (
              <View style={[styles.viewOnlyBanner, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  View only — only the assigned Ah Counter can record entries.
                </Text>
              </View>
            )}

            {/* Filler Words Box */}
            <View style={[styles.auditBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.auditBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Filler Words
              </Text>
              <View style={styles.fillerWordsGrid}>
                {[...FILLER_WORDS, ...customFillerWords].map(word => (
                  <TouchableOpacity
                    key={word}
                    style={[
                      styles.fillerWordChip,
                      selectedFillerWord === word
                        ? { backgroundColor: '#ef4444', borderColor: '#ef4444' }
                        : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                      !isAssignedAhCounter && { opacity: 0.5 }
                    ]}
                    onPress={() => isAssignedAhCounter && setSelectedFillerWord(selectedFillerWord === word ? null : word)}
                    disabled={!isAssignedAhCounter}
                  >
                    <Text style={[
                      styles.fillerWordChipText,
                      { color: selectedFillerWord === word ? '#ffffff' : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {word}
                    </Text>
                  </TouchableOpacity>
                ))}
                {isAssignedAhCounter && (
                  <TouchableOpacity
                    style={[styles.fillerWordChip, styles.addWordChip, { borderColor: theme.colors.primary }]}
                    onPress={() => setShowAddWordModal(true)}
                  >
                    <Plus size={14} color={theme.colors.primary} />
                    <Text style={[styles.fillerWordChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Members Box */}
            <View style={[styles.auditBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.auditBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Members
              </Text>
              {auditMembersLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
              ) : auditMembers.length === 0 && guestMembers.length === 0 ? (
                <View>
                  <Text style={[styles.auditEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No members found
                  </Text>
                  {isAssignedAhCounter && (
                    <TouchableOpacity
                      style={[styles.fillerWordChip, styles.addWordChip, { borderColor: theme.colors.primary, marginTop: 10, alignSelf: 'flex-start' }]}
                      onPress={() => setShowAddGuestModal(true)}
                    >
                      <Plus size={14} color={theme.colors.primary} />
                      <Text style={[styles.fillerWordChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Add Guest</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.fillerWordsGrid}>
                  {[...auditMembers, ...guestMembers].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(member => (
                    <TouchableOpacity
                      key={member.user_id}
                      style={[
                        styles.fillerWordChip,
                        selectedMemberId === member.user_id
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : member.user_id.startsWith('guest_')
                            ? { backgroundColor: theme.colors.background, borderColor: '#f59e0b', borderStyle: 'dashed' }
                            : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        !isAssignedAhCounter && { opacity: 0.5 }
                      ]}
                      onPress={() => isAssignedAhCounter && setSelectedMemberId(selectedMemberId === member.user_id ? null : member.user_id)}
                      disabled={!isAssignedAhCounter}
                    >
                      <Text style={[
                        styles.fillerWordChipText,
                        { color: selectedMemberId === member.user_id ? '#ffffff' : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {isAssignedAhCounter && (
                    <TouchableOpacity
                      style={[styles.fillerWordChip, styles.addWordChip, { borderColor: theme.colors.primary }]}
                      onPress={() => setShowAddGuestModal(true)}
                    >
                      <Plus size={14} color={theme.colors.primary} />
                      <Text style={[styles.fillerWordChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Add to Report Button — only for assigned Ah Counter */}
            {isAssignedAhCounter && (
              <TouchableOpacity
                style={[
                  styles.addToReportBtn,
                  selectedFillerWord && selectedMemberId
                    ? { backgroundColor: '#16a34a' }
                    : { backgroundColor: theme.colors.border }
                ]}
                onPress={addToReport}
                disabled={!selectedFillerWord || !selectedMemberId || isSavingEntry}
              >
                {isSavingEntry ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Plus size={18} color="#ffffff" />
                    <Text style={styles.addToReportBtnText} maxFontSizeMultiplier={1.3}>
                      {selectedFillerWord && selectedMemberId
                        ? `Add to Report: ${[...auditMembers, ...guestMembers].find(m => m.user_id === selectedMemberId)?.full_name} – ${selectedFillerWord}`
                        : 'Select a filler word and member'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Report Box */}
            <View style={[styles.auditBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.auditBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Report {reportEntries.length > 0 ? `(${reportEntries.length})` : ''}
              </Text>
              {reportEntries.length === 0 ? (
                <Text style={[styles.auditEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No entries yet. Select a filler word and a member, then tap Add to Report.
                </Text>
              ) : (
                reportEntries.map((entry, index) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.reportEntryRow,
                      { borderBottomColor: theme.colors.border },
                      index === reportEntries.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.reportEntryLeft}>
                      <View style={[styles.reportEntryAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                        {entry.avatarUrl ? (
                          <Image source={{ uri: entry.avatarUrl }} style={styles.reportEntryAvatarImg} />
                        ) : (
                          <Text style={[styles.reportEntryAvatarInitial, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            {entry.memberName.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.reportEntryInfo}>
                        <Text style={[styles.reportEntryName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {entry.memberName}
                        </Text>
                        <Text style={[styles.reportEntryFiller, { color: '#ef4444' }]} maxFontSizeMultiplier={1.3}>
                          {entry.fillerWord}
                        </Text>
                      </View>
                    </View>
                    {isAssignedAhCounter && (
                      <TouchableOpacity
                        style={styles.reportEntryDelete}
                        onPress={() => removeEntry(entry.id)}
                      >
                        <Trash2 size={16} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonEmoji}>🚧</Text>
            <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Coming Soon</Text>
            <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Publish Report feature is under development.
            </Text>
          </View>
        )}
        </View>

        {/* Spacer pushes nav to bottom when content is short */}
        <View style={styles.navSpacer} />

        {/* Footer Navigation */}
        <View
          style={[
            styles.quickActionsBoxContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={handleAhCounterNavPress}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                <Bell size={FOOTER_NAV_ICON_SIZE} color="#4f46e5" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E6EFF4' }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
                <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#16a34a" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFF7ED' }]}>
                <Star size={FOOTER_NAV_ICON_SIZE} color="#ea580c" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#4f46e5" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FDF4FF' }]}>
                <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E0F2FE' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#0284c7" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#059669" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Roles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF2F2' }]}>
                <ClipboardList size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Eval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEFBF0' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E6F4FF' }]}>
                <Clock size={FOOTER_NAV_ICON_SIZE} color="#0369a1" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFF1F2' }]}>
                <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#e11d48" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Ah Counter – How it works
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Congratulations on picking up the Ah Counter role.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • Click Ah Counter Audit{'\n'}
                • Go to Manage Members and select only the members attending the meeting{'\n'}
                • Open Ah Counter Audit{'\n'}
                • Mark the ahs and pauses — entries are auto-saved
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • Finally, click Publish All
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Your report will appear under Published Reports for all members to view.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                To make changes later:
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • Open Ah Counter Audit{'\n'}
                • Click Unpublish All{'\n'}
                • Make your updates{'\n'}
                • Publish again
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                All the best!
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Guest Member Modal */}
      <Modal
        visible={showAddGuestModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddGuestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.addWordModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text, fontSize: 17 }]} maxFontSizeMultiplier={1.3}>
                Add Guest
              </Text>
              <TouchableOpacity onPress={() => { setShowAddGuestModal(false); setNewGuestInput(''); }}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <Text style={[styles.auditEmptyText, { color: theme.colors.textSecondary, marginBottom: 12, fontSize: 13 }]} maxFontSizeMultiplier={1.3}>
                Enter the guest's name manually. This is for visitors not in the app.
              </Text>
              <TextInput
                style={[styles.addWordInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.background }]}
                placeholder="e.g. John Smith..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newGuestInput}
                onChangeText={setNewGuestInput}
                autoFocus
                maxLength={50}
                onSubmitEditing={confirmAddGuest}
              />
              <TouchableOpacity
                style={[styles.addWordConfirmBtn, { backgroundColor: newGuestInput.trim() ? theme.colors.primary : theme.colors.border }]}
                onPress={confirmAddGuest}
                disabled={!newGuestInput.trim()}
              >
                <Text style={styles.addWordConfirmText} maxFontSizeMultiplier={1.3}>Add Guest</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Custom Filler Word Modal */}
      <Modal
        visible={showAddWordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddWordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.addWordModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text, fontSize: 17 }]} maxFontSizeMultiplier={1.3}>
                Add Filler Word
              </Text>
              <TouchableOpacity onPress={() => { setShowAddWordModal(false); setNewWordInput(''); }}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <TextInput
                style={[styles.addWordInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.background }]}
                placeholder="e.g. Actually, Basically..."
                placeholderTextColor={theme.colors.textSecondary}
                value={newWordInput}
                onChangeText={setNewWordInput}
                autoFocus
                maxLength={30}
                onSubmitEditing={confirmAddCustomWord}
              />
              <TouchableOpacity
                style={[styles.addWordConfirmBtn, { backgroundColor: newWordInput.trim() ? theme.colors.primary : theme.colors.border }]}
                onPress={confirmAddCustomWord}
                disabled={!newWordInput.trim()}
              >
                <Text style={styles.addWordConfirmText} maxFontSizeMultiplier={1.3}>Add Word</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
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
    padding: 16,
  },
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  contentTop: {},
  navSpacer: {
    flex: 1,
    minHeight: 16,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
  },
  meetingCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  meetingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  meetingInfoLabel: {
    fontSize: 14,
    width: 60,
  },
  meetingInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  ahCounterCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  ahCounterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  ahCounterAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  ahCounterAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  ahCounterDetails: {
    flex: 1,
  },
  prepSpaceIconButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  ahCounterName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  ahCounterRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  assignedCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  assignedUserContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  noAssignedText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    paddingBottom: 24,
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  manageButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewOnlyBanner: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  viewOnlyBannerText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  comingSoonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  comingSoonEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonSubtext: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  publishStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  publishStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  publishStatusText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  publishButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  unpublishButton: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  unpublishButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  notAssignedCard: {
    padding: 24,
    borderRadius: 12,
  },
  notAssignedText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  meetingCardSimple: {
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
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    zIndex: 0,
  },
  noAssignmentState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  noAssignmentNotionCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  noAssignmentDivider: {
    height: 1,
    marginTop: 14,
  },
  noAssignmentStateInCard: {
    paddingVertical: 52,
    paddingHorizontal: 16,
  },
  noAssignmentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noAssignmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noAssignmentSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  bookRoleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  noBookingContentContainer: {
    flexGrow: 1,
  },
  noBookingContentTop: {
    flex: 1,
  },
  footerNavigationInline: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 45,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  footerNavLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  footerNavigationContainer: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  quickActionsBoxContainer: {
    borderTopWidth: 0,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
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
  },
  quickActionLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  assignAhCounterMemberModal: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
    minWidth: 320,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  assignAhCounterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assignAhCounterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  assignAhCounterModalClose: {
    padding: 4,
  },
  assignAhCounterModalHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  assignAhCounterSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  assignAhCounterSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  assignAhCounterMembersScroll: {
    maxHeight: 400,
  },
  assignAhCounterMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  assignAhCounterMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  assignAhCounterMemberAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  assignAhCounterMemberInfo: {
    flex: 1,
  },
  assignAhCounterMemberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  assignAhCounterNoResults: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  assignAhCounterNoResultsText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  infoModalContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 0,
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  infoModalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoModalButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  comingSoonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  comingSoonIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  comingSoonSubtext: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  auditBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  auditBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fillerWordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fillerWordChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  fillerWordChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  memberSectionDivider: {
    borderTopWidth: 1,
    marginVertical: 12,
  },
  memberSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberHintText: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  membersScroll: {
    marginHorizontal: -4,
  },
  membersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  memberChip: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 72,
    gap: 6,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
  },
  memberChipText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  addToReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  addToReportBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  auditEmptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingVertical: 8,
  },
  reportEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  reportEntryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  reportEntryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  reportEntryText: {
    fontSize: 14,
    flex: 1,
  },
  reportEntryDelete: {
    padding: 6,
  },
  addWordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderStyle: 'dashed',
  },
  membersList: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 10,
  },
  memberListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberListName: {
    fontSize: 14,
    flex: 1,
  },
  reportEntryAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reportEntryAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  reportEntryAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
  },
  reportEntryInfo: {
    flex: 1,
    gap: 2,
  },
  reportEntryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reportEntryFiller: {
    fontSize: 12,
    fontWeight: '600',
  },
  addWordModalContainer: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addWordInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
    marginTop: 16,
  },
  addWordConfirmBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  addWordConfirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

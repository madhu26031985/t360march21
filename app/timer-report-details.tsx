import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import { ArrowLeft, Timer, Calendar, User, ChevronDown, Save, Trash2, X, FileText, Search, Lock, MessageCircle, Snowflake, Mic, MessageSquare, Lightbulb, NotebookPen, Plus, Bell, Users, BookOpen, Star, CheckSquare, ClipboardCheck, FileBarChart, Clock, Info, HelpCircle, Upload, RotateCcw, UserPlus } from 'lucide-react-native';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FOOTER_NAV_ICON_SIZE = 15;

/** Guest display names stored on role rows (app_meeting_roles_management.completion_notes) */
const TIMER_GUEST_PREFIX = 'timer_guest:';

function parseTimerGuestName(completionNotes: string | null | undefined): string | null {
  if (!completionNotes || !completionNotes.startsWith(TIMER_GUEST_PREFIX)) return null;
  const name = completionNotes.slice(TIMER_GUEST_PREFIX.length).trim();
  return name.length > 0 ? name : null;
}

function formatGuestDisplayName(input: string): string {
  const t = input.trim();
  if (!t) return '';
  const titleCaseWord = (w: string) =>
    w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '';
  const titleCasePhrase = (s: string) =>
    s.split(/\s+/).filter(Boolean).map(titleCaseWord).join(' ');
  if (/^guest\s+/i.test(t)) {
    const rest = t.replace(/^guest\s+/i, '').trim();
    return rest ? `Guest ${titleCasePhrase(rest)}` : '';
  }
  return `Guest ${titleCasePhrase(t)}`;
}

/** Sort roles by trailing slot number (1–12) instead of lexicographic order (1, 10, 11, 2…). */
function slotNumberFromRoleName(roleName: string): number {
  const m = roleName.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
}

interface AssignedTimer {
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

interface TimerReport {
  id?: string;
  meeting_id: string;
  club_id: string;
  speaker_name: string;
  speaker_user_id: string | null;
  speech_category: string;
  actual_time_seconds: number;
  actual_time_display: string;
  time_qualification: boolean | null;
  target_min_seconds: number | null;
  target_max_seconds: number | null;
  notes: string | null;
  recorded_by: string;
  recorded_at?: string;
}

interface CategoryRole {
  id: string;
  role_name: string;
  booking_status: string | null;
  assigned_user_id: string | null;
  completion_notes: string | null;
  app_user_profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function TimerReportDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [assignedTimer, setAssignedTimer] = useState<AssignedTimer | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<ClubMember | null>(null);
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState('');
  const [manualNameEntry, setManualNameEntry] = useState(false);
  const [manualNameText, setManualNameText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [reportData, setReportData] = useState<TimerReport>({
    meeting_id: meetingId || '',
    club_id: user?.currentClubId || '',
    speaker_name: '',
    speaker_user_id: null,
    speech_category: 'prepared_speaker',
    actual_time_seconds: 0,
    actual_time_display: '00:00',
    time_qualification: null,
    target_min_seconds: null,
    target_max_seconds: null,
    notes: null,
    recorded_by: user?.id || '',
  });
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [showSecondsModal, setShowSecondsModal] = useState(false);
  const [showQualifiedModal, setShowQualifiedModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; speakerName: string } | null>(null);
  const [showNameRequiredModal, setShowNameRequiredModal] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'record' | 'reports'>('record');
  const [savedReports, setSavedReports] = useState<TimerReport[]>([]);
  const [deletingReports, setDeletingReports] = useState<Set<string>>(new Set());
  const [bookedSpeakers, setBookedSpeakers] = useState<ClubMember[]>([]);
  const [bookingTimerRole, setBookingTimerRole] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [categoryRoles, setCategoryRoles] = useState<CategoryRole[]>([]);
  const [selectedCategoryRoleId, setSelectedCategoryRoleId] = useState<string | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<CategoryRole | null>(null);
  const [assigningTimerRole, setAssigningTimerRole] = useState(false);
  const [guestAssignNameInput, setGuestAssignNameInput] = useState('');
  const [roleTimingSummary, setRoleTimingSummary] = useState<Record<string, { time: string; qualified: boolean }>>({});

  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchInterval, setStopwatchInterval] = useState<NodeJS.Timeout | null>(null);
  const [isVPEClub, setIsVPEClub] = useState(false);

  const isMeetingTimer = !!(assignedTimer && user && assignedTimer.id === user.id);
  const canEditTimerCorner = isMeetingTimer || isVPEClub;
  const effectiveTab = canEditTimerCorner ? selectedTab : 'reports';

  const speechCategories = [
    { value: 'prepared_speaker', label: 'Prepared speakers', color: '#3b82f6', icon: 'message-circle', classifications: ['Prepared Speaker'], roleNames: ['Prepared Speaker 1', 'Prepared Speaker 2', 'Prepared Speaker 3', 'Prepared Speaker 4', 'Prepared Speaker 5'] },
    { value: 'table_topic_speaker', label: 'Table topic speakers', color: '#f97316', icon: 'mic', classifications: ['On-the-Spot Speaking'], roleNames: ['Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3', 'Table Topics Speaker 4', 'Table Topics Speaker 5', 'Table Topics Speaker 6', 'Table Topics Speaker 7', 'Table Topics Speaker 8', 'Table Topics Speaker 9', 'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'] },
    { value: 'evaluation', label: 'Speech evaluvators', color: '#10b981', icon: 'message-square', classifications: ['Speech evaluvator'], roleNames: ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'] },
    { value: 'educational_session', label: 'Educational speaker', color: '#8b5cf6', icon: 'lightbulb', classifications: ['Educational speaker'], roleNames: ['Educational Speaker'] },
  ];

  const qualificationOptions = [
    { value: true, label: 'Yes', color: '#10b981' },
    { value: false, label: 'No', color: '#64748b' },
  ];

  // Generate arrays for dropdowns
  const minuteOptions = Array.from({ length: 61 }, (_, i) => i);
  const secondOptions = Array.from({ length: 60 }, (_, i) => i);
  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  useEffect(() => {
    if (selectedSpeaker) {
      loadSpeakerReport();
    }
  }, [selectedSpeaker]);

  useEffect(() => {
    // Update actual_time_seconds and display when minutes/seconds change
    const totalSeconds = minutes * 60 + seconds;
    setReportData(prev => ({
      ...prev,
      actual_time_seconds: totalSeconds,
      actual_time_display: formatTime(totalSeconds)
    }));
  }, [minutes, seconds]);

  useEffect(() => {
    if (stopwatchRunning) {
      const interval = setInterval(() => {
        setStopwatchTime(prev => prev + 1000);
      }, 1000);
      setStopwatchInterval(interval);
      return () => clearInterval(interval);
    } else if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  }, [stopwatchRunning]);

  const startStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    setStopwatchRunning(true);
  };

  const pauseStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    setStopwatchRunning(false);
  };

  const stopStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    setStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    setStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const formatStopwatchTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadClubMembers(),
        loadAssignedTimer(),
        loadIsVPEClub(),
        loadSavedReports(),
        loadBookedSpeakersForCategory(reportData.speech_category),
        loadCategoryRolesForCategory(reportData.speech_category),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load meeting data');
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

  const loadClubMembers = async () => {
    if (!user?.currentClubId || !meetingId) return;

    try {
      // First, load all club members
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

      const allMembers = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        avatar_url: (item as any).app_user_profiles.avatar_url,
      }));

      // Then, load the timer's selected members for this meeting
      const { data: selectedData, error: selectedError } = await supabase
        .from('app_timer_selected_members')
        .select('selected_member_id')
        .eq('meeting_id', meetingId)
        .eq('timer_user_id', user.id);

      if (selectedError) {
        console.error('Error loading selected members:', selectedError);
      }

      // Filter members based on selection
      let membersToShow = allMembers;
      if (selectedData && selectedData.length > 0) {
        const selectedMemberIds = new Set(selectedData.map((item: any) => item.selected_member_id));
        membersToShow = allMembers.filter(member => selectedMemberIds.has(member.id));
      }

      // Sort members alphabetically by full_name
      membersToShow.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setClubMembers(membersToShow);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadAssignedTimer = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      // Find the Timer role assignment for this meeting
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
        .eq('role_name', 'Timer')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('Error loading assigned Timer:', error);
        return;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        setAssignedTimer({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading assigned Timer:', error);
    }
  };

  const handleBookTimerInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingTimerRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { eqRoleName: 'Timer' },
        'Timer is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadAssignedTimer();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingTimerRole(false);
    }
  };

  const loadBookedSpeakersForCategory = async (category: string) => {
    if (!meetingId) return;

    const selectedCategory = speechCategories.find(c => c.value === category);
    if (!selectedCategory) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          role_name,
          assigned_user_id,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .in('role_name', selectedCategory.roleNames)
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null);

      if (error) {
        console.error('Error loading booked speakers:', error);
        return;
      }

      const speakers = (data || [])
        .filter(item => (item as any).app_user_profiles)
        .map(item => ({
          id: (item as any).app_user_profiles.id,
          full_name: (item as any).app_user_profiles.full_name,
          email: (item as any).app_user_profiles.email,
          avatar_url: (item as any).app_user_profiles.avatar_url,
        }));

      // Remove duplicates based on user id
      const uniqueSpeakers = Array.from(
        new Map(speakers.map(speaker => [speaker.id, speaker])).values()
      );

      // Sort alphabetically
      uniqueSpeakers.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setBookedSpeakers(uniqueSpeakers);
      setSelectedSpeaker((prev) => {
        if (prev && uniqueSpeakers.some((speaker) => speaker.id === prev.id)) return prev;
        return uniqueSpeakers.length > 0 ? uniqueSpeakers[0] : null;
      });
    } catch (error) {
      console.error('Error loading booked speakers:', error);
    }
  };

  const loadCategoryRolesForCategory = async (category: string) => {
    if (!meetingId) return;
    const selectedCategory = speechCategories.find((c) => c.value === category);
    if (!selectedCategory || selectedCategory.roleNames.length === 0) {
      setCategoryRoles([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          booking_status,
          assigned_user_id,
          completion_notes,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .in('role_name', selectedCategory.roleNames);

      if (error) {
        console.error('Error loading category roles:', error);
        return;
      }

      const rows = (data || []) as CategoryRole[];
      rows.sort(
        (a, b) => slotNumberFromRoleName(a.role_name) - slotNumberFromRoleName(b.role_name)
      );
      setCategoryRoles(rows);
    } catch (error) {
      console.error('Error loading category roles:', error);
    }
  };

  const handleAssignCategoryRole = async (member: ClubMember) => {
    if (!canEditTimerCorner || !roleToAssign) return;
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: member.id,
          booking_status: 'booked',
          completion_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleToAssign.id);

      if (error) {
        console.error('Error assigning category role:', error);
        Alert.alert('Error', 'Failed to assign speaker to role');
        return;
      }

      setSelectedCategoryRoleId(roleToAssign.id);
      setSelectedSpeaker(member);
      setShowSpeakerModal(false);
      setSpeakerSearchQuery('');
      setRoleToAssign(null);
      setGuestAssignNameInput('');
      await Promise.all([
        loadCategoryRolesForCategory(reportData.speech_category),
        loadBookedSpeakersForCategory(reportData.speech_category),
      ]);
    } catch (error) {
      console.error('Error assigning category role:', error);
      Alert.alert('Error', 'Failed to assign speaker to role');
    }
  };

  const handleAssignGuestCategoryRole = async () => {
    if (!canEditTimerCorner || !roleToAssign) return;
    const displayName = formatGuestDisplayName(guestAssignNameInput);
    if (!displayName) {
      Alert.alert('Name required', 'Enter a guest name or use the member list above.');
      return;
    }
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: null,
          booking_status: 'booked',
          completion_notes: `${TIMER_GUEST_PREFIX}${displayName}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleToAssign.id);

      if (error) {
        console.error('Error assigning guest to role:', error);
        Alert.alert('Error', 'Failed to assign guest to role');
        return;
      }

      setSelectedCategoryRoleId(roleToAssign.id);
      setSelectedSpeaker(null);
      setManualNameEntry(true);
      setManualNameText(displayName);
      setGuestAssignNameInput('');
      setShowSpeakerModal(false);
      setSpeakerSearchQuery('');
      setRoleToAssign(null);
      await Promise.all([
        loadCategoryRolesForCategory(reportData.speech_category),
        loadBookedSpeakersForCategory(reportData.speech_category),
      ]);
    } catch (error) {
      console.error('Error assigning guest to role:', error);
      Alert.alert('Error', 'Failed to assign guest to role');
    }
  };

  const handleAssignTimerToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) return;
    if (!canEditTimerCorner) {
      Alert.alert('Read only', 'Only the assigned Timer or the club VPE can assign this role.');
      return;
    }
    try {
      const { data: timerRole, error: timerRoleError } = await supabase
        .from('app_meeting_roles_management')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Timer')
        .limit(1)
        .maybeSingle();

      if (timerRoleError) {
        console.error('Error loading Timer role:', timerRoleError);
        Alert.alert('Error', 'Could not load Timer role. Please try again.');
        return;
      }

      if (!timerRole?.id) {
        Alert.alert('Error', 'Timer role is not set up for this meeting.');
        return;
      }

      const { error: assignError } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: member.id,
          booking_status: 'booked',
          completion_notes: null,
        })
        .eq('id', timerRole.id);

      if (assignError) {
        console.error('Error assigning Timer role:', assignError);
        Alert.alert('Could not assign', 'Failed to assign Timer role. Please try again.');
        return;
      }

      setShowSpeakerModal(false);
      setSpeakerSearchQuery('');
      await loadAssignedTimer();
      Alert.alert('Assigned', `${member.full_name} is now the Timer for this meeting.`);
    } catch (error) {
      console.error('Error assigning timer role:', error);
      Alert.alert('Error', 'Failed to assign Timer role.');
    } finally {
      setAssigningTimerRole(false);
    }
  };

  const loadSpeakerReport = async () => {
    // Remove the automatic loading of existing report since we now allow multiple entries
    // Just reset the form when speaker changes
    setReportData(prev => ({
      meeting_id: meetingId || '',
      club_id: user?.currentClubId || '',
      speaker_name: selectedSpeaker?.full_name || '',
      speaker_user_id: selectedSpeaker?.id || null,
      speech_category: prev.speech_category, // Keep the selected category
      actual_time_seconds: 0,
      actual_time_display: '00:00',
      time_qualification: null,
      target_min_seconds: null,
      target_max_seconds: null,
      notes: null,
      recorded_by: user?.id || '',
    }));
    setMinutes(0);
    setSeconds(0);
  };

  const resetForm = () => {
    // Reset form to default state
    setReportData({
      meeting_id: meetingId || '',
      club_id: user?.currentClubId || '',
      speaker_name: '',
      speaker_user_id: null,
      speech_category: 'prepared_speaker',
      actual_time_seconds: 0,
      actual_time_display: '00:00',
      time_qualification: null,
      target_min_seconds: null,
      target_max_seconds: null,
      notes: null,
      recorded_by: user?.id || '',
    });
    setSelectedSpeaker(null);
    setManualNameEntry(false);
    setManualNameText('');
    setMinutes(0);
    setSeconds(0);
  };

  const loadSavedReports = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('timer_reports')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('Error loading saved reports:', error);
        return;
      }

      setSavedReports(data || []);
    } catch (error) {
      console.error('Error loading saved reports:', error);
    }
  };

  /** Restore time + Q on each role row from persisted timer_reports (state alone was lost on navigation). */
  useEffect(() => {
    if (!categoryRoles.length || !user?.id) {
      setRoleTimingSummary({});
      return;
    }
    const cat = reportData.speech_category;
    const myReports = savedReports.filter(
      (r) => r.speech_category === cat && r.recorded_by === user.id
    );
    const next: Record<string, { time: string; qualified: boolean }> = {};
    for (const role of categoryRoles) {
      const guestName = parseTimerGuestName(role.completion_notes);
      let candidates: TimerReport[] = [];
      if (role.assigned_user_id) {
        candidates = myReports.filter((r) => r.speaker_user_id === role.assigned_user_id);
      } else if (guestName) {
        candidates = myReports.filter(
          (r) => !r.speaker_user_id && r.speaker_name.trim() === guestName.trim()
        );
      }
      if (candidates.length) {
        const best = [...candidates].sort(
          (a, b) =>
            new Date(b.recorded_at || b.updated_at || 0).getTime() -
            new Date(a.recorded_at || a.updated_at || 0).getTime()
        )[0];
        next[role.id] = {
          time: best.actual_time_display,
          qualified: !!best.time_qualification,
        };
      }
    }
    setRoleTimingSummary(next);
  }, [savedReports, categoryRoles, reportData.speech_category, user?.id]);

  const handleDeleteReport = (reportId: string, speakerName: string) => {
    setDeleteConfirm({ id: reportId, speakerName });
  };

  const confirmDeleteReport = async () => {
    if (!deleteConfirm) return;
    const { id: reportId } = deleteConfirm;
    setDeleteConfirm(null);
    setDeletingReports(prev => new Set([...prev, reportId]));
    try {
      const { error } = await supabase
        .from('timer_reports')
        .delete()
        .eq('id', reportId);
      if (error) {
        console.error('Error deleting timer report:', error);
        Alert.alert('Error', 'Failed to delete timer report');
        return;
      }
      setSavedReports(prev => prev.filter(report => report.id !== reportId));
    } catch (error) {
      console.error('Error deleting timer report:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setDeletingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const updateCategory = (category: string) => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can edit Timer Corner.');
      return;
    }
    setReportData(prev => ({ ...prev, speech_category: category }));
    setSelectedSpeaker(null);
    setSelectedCategoryRoleId(null);
    setManualNameEntry(false);
    setManualNameText('');
    loadBookedSpeakersForCategory(category);
    loadCategoryRolesForCategory(category);
  };

  const updateQualification = (qualified: boolean) => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can edit Timer Corner.');
      return;
    }
    setReportData(prev => ({ ...prev, time_qualification: qualified }));
  };

  const getCategoryLabel = () => {
    return getCategoryDisplayName(reportData.speech_category);
  };

  const getCategoryColor = (category: string) => {
    const categoryOption = speechCategories.find(c => c.value === category);
    return categoryOption?.color || '#6b7280';
  };

  const getCategoryDisplayName = (category: string) => {
    switch (category) {
      case 'prepared_speaker':
        return 'Prepared Speaker';
      case 'ice_breaker':
        return 'Ice Breaker';
      case 'table_topic_speaker':
        return 'Table Topics Speaker';
      case 'evaluation':
        return 'Evaluator';
      case 'educational_session':
        return 'Educational Speaker';
      default:
        return category;
    }
  };

  const getQualificationLabel = () => {
    return reportData.time_qualification ? 'Yes' : 'No';
  };

  const getCategoryIcon = (iconName: string, color: string, isSelected: boolean) => {
    const size = 16;
    const iconColor = isSelected ? '#ffffff' : color;

    switch (iconName) {
      case 'message-circle':
        return <MessageCircle size={size} color={iconColor} />;
      case 'snowflake':
        return <Snowflake size={size} color={iconColor} />;
      case 'mic':
        return <Mic size={size} color={iconColor} />;
      case 'message-square':
        return <MessageSquare size={size} color={iconColor} />;
      case 'lightbulb':
        return <Lightbulb size={size} color={iconColor} />;
      default:
        return <MessageCircle size={size} color={iconColor} />;
    }
  };

  const ReportCard = ({ report }: { report: TimerReport }) => {
    return (
      <View style={[styles.reportTableRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.reportTableNameCell}>
          <Text style={[styles.reportTableName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {report.speaker_name}
          </Text>
          <Text style={[styles.reportTableCategory, { color: getCategoryColor(report.speech_category) }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {getCategoryDisplayName(report.speech_category)}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <Text style={[styles.reportTableTime, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
            {report.actual_time_display}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <Text style={[
            styles.reportTableQualified,
            { color: report.time_qualification ? '#10b981' : '#64748b' }
          ]} maxFontSizeMultiplier={1.3}>
            {report.time_qualification ? 'Yes' : 'No'}
          </Text>
        </View>

        <View style={styles.reportTableActions}>
          {canEditTimerCorner && (
            <TouchableOpacity
              style={styles.reportTableActionButton}
              onPress={() => handleDeleteReport(report.id!, report.speaker_name)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleSaveReport = async () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can save timer reports.');
      return;
    }

    if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
      Alert.alert('Speaker Required', 'Please select a speaker');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required data to save report');
      return;
    }

    if (!reportData.speech_category) {
      Alert.alert('Error', 'Please select a speech category');
      return;
    }

    const effectiveName = selectedSpeaker ? selectedSpeaker.full_name : manualNameText.trim();
    const effectiveUserId = selectedSpeaker ? selectedSpeaker.id : null;

    setIsSaving(true);

    try {
      // For member entries check for duplicates; for guest (manual) always insert new
      let existingReport = null;
      if (selectedSpeaker) {
        const { data: existingData, error: checkError } = await supabase
          .from('timer_reports')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('speaker_user_id', effectiveUserId)
          .eq('speech_category', reportData.speech_category)
          .eq('recorded_by', user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing report:', checkError);
          Alert.alert('Error', 'Failed to check existing report');
          return;
        }
        existingReport = existingData;
      }

      const saveData = {
        ...reportData,
        meeting_id: meetingId,
        club_id: user.currentClubId,
        speaker_name: effectiveName,
        speaker_user_id: effectiveUserId,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_qualification: reportData.time_qualification ?? false,
      };

      if (existingReport) {
        const { error } = await supabase
          .from('timer_reports')
          .update(saveData)
          .eq('id', existingReport.id);

        if (error) {
          console.error('Error updating report:', error);
          Alert.alert('Error', 'Failed to update report');
          return;
        }

        Alert.alert('Success', `Timer report updated for ${effectiveName} - ${getCategoryLabel()}`);
      } else {
        const { data, error } = await supabase
          .from('timer_reports')
          .insert(saveData)
          .select()
          .single();

        if (error) {
          console.error('Error creating report:', error);
          Alert.alert('Error', 'Failed to save report');
          return;
        }

        Alert.alert('Success', `Timer report saved for ${effectiveName} - ${getCategoryLabel()}`);
      }

      // Reload saved reports to show the new one
      await loadSavedReports();
      if (selectedCategoryRoleId) {
        setRoleTimingSummary((prev) => ({
          ...prev,
          [selectedCategoryRoleId]: {
            time: saveData.actual_time_display,
            qualified: !!saveData.time_qualification,
          },
        }));
      }
      setStopwatchRunning(false);
      setSelectedCategoryRoleId(null);
      setSelectedSpeaker(null);
      setManualNameEntry(false);
      setManualNameText('');
      
      // Stay on Timer Corner tab after save
      setSelectedTab('record');
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter members based on search query
  const filteredClubMembers = clubMembers.filter((member) => {
    const query = speakerSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      member.full_name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  });

  const openAssignTimerFromNav = () => {
    if (!isVPEClub) {
      Alert.alert('Assign Timer', 'Only the club VPE can assign the Timer role from here.');
      return;
    }
    setAssigningTimerRole(true);
    setRoleToAssign(null);
    setGuestAssignNameInput('');
    setSpeakerSearchQuery('');
    setShowSpeakerModal(true);
    void loadClubMembers();
  };

  const renderSpeakerAssignmentModal = () => (
    <Modal
      visible={showSpeakerModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        setShowSpeakerModal(false);
        setSpeakerSearchQuery('');
        setAssigningTimerRole(false);
        setRoleToAssign(null);
        setGuestAssignNameInput('');
      }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => {
          setShowSpeakerModal(false);
          setSpeakerSearchQuery('');
          setRoleToAssign(null);
          setGuestAssignNameInput('');
          setAssigningTimerRole(false);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.speakerModal, { backgroundColor: theme.colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {assigningTimerRole ? 'Assign Timer' : roleToAssign ? `Assign ${roleToAssign.role_name}` : 'Select Speaker'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowSpeakerModal(false);
                setSpeakerSearchQuery('');
                setRoleToAssign(null);
                setAssigningTimerRole(false);
                setGuestAssignNameInput('');
              }}
            >
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {roleToAssign && !assigningTimerRole && (
            <View style={[styles.guestAssignBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <Text style={[styles.guestAssignLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Guest (not in list)
              </Text>
              <TextInput
                style={[styles.guestAssignInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="e.g. Ram → saved as Guest Ram"
                placeholderTextColor={theme.colors.textSecondary}
                value={guestAssignNameInput}
                onChangeText={setGuestAssignNameInput}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.guestAssignButton, { backgroundColor: '#2563eb' }]}
                onPress={handleAssignGuestCategoryRole}
                disabled={!canEditTimerCorner}
              >
                <Text style={styles.guestAssignButtonText} maxFontSizeMultiplier={1.2}>Assign guest</Text>
              </TouchableOpacity>
            </View>
          )}

          {roleToAssign && !assigningTimerRole && (
            <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />
          )}

          <Text style={[styles.modalMembersHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
            Club members
          </Text>

          {filteredClubMembers.length === 0 ? (
            <View style={styles.noBookingContainer}>
              <Text style={[styles.noBookingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                No members match your search
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={speakerSearchQuery}
                  onChangeText={setSpeakerSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {speakerSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSpeakerSearchQuery('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={styles.speakersList} showsVerticalScrollIndicator={false}>
                {filteredClubMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.speakerOption,
                      selectedSpeaker?.id === member.id && { backgroundColor: theme.colors.primary + '20' },
                    ]}
                    onPress={() => (assigningTimerRole ? handleAssignTimerToMember(member) : handleAssignCategoryRole(member))}
                  >
                    <View style={styles.speakerOptionAvatar}>
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.speakerOptionAvatarImage} />
                      ) : (
                        <User size={20} color="#ffffff" />
                      )}
                    </View>
                    <View style={styles.speakerOptionInfo}>
                      <Text
                        style={[
                          styles.speakerOptionName,
                          { color: selectedSpeaker?.id === member.id ? theme.colors.primary : theme.colors.text },
                        ]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {member.full_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const SpeakerSelector = () => (
    <TouchableOpacity
      style={[
        styles.speakerSelector,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        }
      ]}
      onPress={() => {
        if (!canEditTimerCorner) {
          Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can select speakers.');
          return;
        }
        setAssigningTimerRole(false);
        setShowSpeakerModal(true);
      }}
    >
      <View style={styles.speakerSelectorContent}>
        <View style={styles.speakerAvatar}>
          {selectedSpeaker?.avatar_url ? (
            <Image source={{ uri: selectedSpeaker.avatar_url }} style={styles.speakerAvatarImage} />
          ) : (
            <User size={16} color="#ffffff" />
          )}
        </View>
        <View style={styles.speakerInfo}>
          <Text style={[styles.speakerLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Speaker
          </Text>
          <Text style={[styles.speakerName, { color: (selectedSpeaker || manualNameEntry) ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {selectedSpeaker?.full_name || (manualNameEntry && manualNameText ? manualNameText : manualNameEntry ? 'Enter guest name...' : 'Select Speaker')}
          </Text>
        </View>
      </View>
      <ChevronDown size={16} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading timer report...</Text>
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

  // Check if no Timer is assigned
  if (!assignedTimer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
          <TouchableOpacity
            style={[styles.headerInfoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
            onPress={() => setShowHowToModal(true)}
            activeOpacity={0.8}
          >
            <HelpCircle size={18} color="#6E839F" />
          </TouchableOpacity>
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
            <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />

          {/* No Timer Assigned State */}
          <View style={[styles.noAssignmentState, styles.noAssignmentStateInCard]}>
            <Timer size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.noAssignmentSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Every great meeting needs a time hero! 🦸‍♂️ Take charge — book the Timer role.
            </Text>
            <TouchableOpacity
              style={[
                styles.bookRoleButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: bookingTimerRole || assigningTimerRole ? 0.85 : 1,
                },
              ]}
              onPress={() => handleBookTimerInline()}
              disabled={bookingTimerRole || assigningTimerRole}
            >
              {bookingTimerRole ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                  Book Timer Role
                </Text>
              )}
            </TouchableOpacity>
          </View>
            <View pointerEvents="none" style={styles.meetingCardDecoration} />
          </View>
          </View>

          {/* Footer — match Grammarian Report dock (30×30 tiles, FOOTER_NAV_ICON_SIZE) */}
          <View
            style={[
              styles.quickActionsBoxContainer,
              {
                backgroundColor: theme.colors.surface,
                borderTopColor: theme.colors.border,
                marginTop: 8,
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
                onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                  <Bell size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
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
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId, initialTab: 'my_bookings' } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                  <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Withdraw</Text>
              </TouchableOpacity>

              {isVPEClub && (
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={openAssignTimerFromNav}
                  disabled={bookingTimerRole || assigningTimerRole}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                    <UserPlus size={FOOTER_NAV_ICON_SIZE} color="#059669" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Assign</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                  <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Star size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                  <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#9333ea" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                  <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#059669" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <FileBarChart size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Roles</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                  <Timer size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
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
            </ScrollView>
          </View>
        </ScrollView>

        {/* How To Modal (non-assigned view) */}
        <Modal visible={showHowToModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.howToOverlay}
            activeOpacity={1}
            onPress={() => setShowHowToModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={[styles.howToContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.howToHeader}>
                <Text style={[styles.howToTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer – How to Log Timing</Text>
                <TouchableOpacity
                  onPress={() => setShowHowToModal(false)}
                  style={styles.howToClose}
                >
                  <X size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.howToScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF' }]}>
                  <FileText size={14} color='#4F46E5' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Timer Corner Tab</Text>
                </View>
                {[
                  { num: 1, color: '#F59E0B', title: 'Select Category', desc: 'Choose the category. Speech / Table Topics / Evaluation.' },
                  { num: 2, color: '#06B6D4', title: 'Select the Speaker', desc: "Choose the speaker's name from the dropdown." },
                  { num: 3, color: '#10B981', title: 'Use the Stopwatch', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Start</Text> when the speech begins and <Text style={{ fontWeight: '700' }}>Stop</Text> when it ends.</Text> },
                  { num: 4, color: '#6366F1', title: 'Enter the Final Time', desc: <Text maxFontSizeMultiplier={1.3}>The time can be entered or adjusted in <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add Time</Text>.</Text> },
                  { num: 5, color: '#8B5CF6', title: 'Mark Qualification', desc: <Text maxFontSizeMultiplier={1.3}>Select <Text style={{ color: '#10B981', fontWeight: '700' }}>Yes</Text> if the speech met the required time range.{'\n'}Select <Text style={{ fontWeight: '700' }}>No</Text> if the speech was under or over time.</Text> },
                  { num: 6, color: '#EC4899', title: 'Save the Record', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Save</Text> to store the timing entry.</Text> },
                ].map(({ num, color, title, desc }) => (
                  <View key={num} style={styles.howToStep}>
                    <View style={[styles.howToStepNum, { backgroundColor: color }]}>
                      <Text style={styles.howToStepNumText} maxFontSizeMultiplier={1.2}>{num}</Text>
                    </View>
                    <View style={styles.howToStepContent}>
                      <Text style={[styles.howToStepTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
                      {typeof desc === 'string'
                        ? <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{desc}</Text>
                        : <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>
                      }
                    </View>
                  </View>
                ))}
                <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
                  <FileBarChart size={14} color='#4F46E5' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Summary Tab</Text>
                </View>
                <Text style={[styles.howToBodyText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  In the <Text style={{ fontWeight: '700' }}>Summary</Text> tab you can:
                </Text>
                <View style={styles.howToBulletList}>
                  <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} Review all recorded speech timings</Text>
                  <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} View the <Text style={{ fontWeight: '700', color: theme.colors.text }}>Timer Review</Text> report</Text>
                </View>
                <View style={[styles.howToSectionBadge, { backgroundColor: '#FFF7ED', marginTop: 8 }]}>
                  <Upload size={14} color='#EA580C' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#EA580C' }]} maxFontSizeMultiplier={1.3}>Exporting the Report</Text>
                </View>
                <Text style={[styles.howToBodyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Timing reports can be exported as PDF from the web portal. Steps:
                </Text>
                <View style={styles.howToNumberedList}>
                  {[
                    <Text maxFontSizeMultiplier={1.3}>Go to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Settings {'→'} Web Login</Text></Text>,
                    <Text maxFontSizeMultiplier={1.3}>Open the web portal</Text>,
                    <Text maxFontSizeMultiplier={1.3}>Navigate to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Meeting {'→'} Timer</Text></Text>,
                    <Text maxFontSizeMultiplier={1.3}>Click <Text style={{ fontWeight: '700', color: theme.colors.text }}>Download PDF</Text></Text>,
                  ].map((item, i) => (
                    <Text key={i} style={[styles.howToNumberedItem, { color: theme.colors.textSecondary }]}>
                      {i + 1}. {item}
                    </Text>
                  ))}
                </View>
                <View style={[styles.howToTipBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Lightbulb size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.howToTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    <Text style={{ fontWeight: '700' }}>Tips:</Text> Help Tap the{' '}
                    <HelpCircle size={12} color={theme.colors.textSecondary} />{' '}
                    icon anytime to view these instructions.
                  </Text>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {renderSpeakerAssignmentModal()}
      </SafeAreaView>
    );
  }

  const selectedCategoryMeta = speechCategories.find((c) => c.value === reportData.speech_category);
  const isRoleSlotFilled = (role: CategoryRole) => {
    const guestName = parseTimerGuestName(role.completion_notes);
    if (role.booking_status !== 'booked') return false;
    if (role.assigned_user_id) return true;
    return !!guestName;
  };
  const categoryOpenRolesCount = categoryRoles.filter((role) => !isRoleSlotFilled(role)).length;
  const canShowTimeLogger = categoryRoles.length === 0 || !!selectedCategoryRoleId;
  const hasTimerSpeaker =
    !!selectedSpeaker || (!!manualNameEntry && !!manualNameText.trim());

  const renderTimeLoggerCard = () => (
    <View style={[styles.logTimeCard, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.timeLoggerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Time Logger
      </Text>
      <View style={[styles.inlineStopwatchContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <Text style={[styles.inlineStopwatchTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
          Stopwatch
        </Text>
        <Text style={[styles.inlineStopwatchTime, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {formatStopwatchTime(stopwatchTime)}
        </Text>
        <View style={styles.inlineStopwatchButtons}>
          <TouchableOpacity style={[styles.inlineSwBtn, { backgroundColor: '#10b981', opacity: stopwatchRunning ? 0.45 : 1 }]} onPress={startStopwatch} disabled={stopwatchRunning}>
            <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inlineSwBtn, { backgroundColor: '#ef4444', opacity: !stopwatchRunning ? 0.45 : 1 }]} onPress={stopStopwatch} disabled={!stopwatchRunning}>
            <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inlineSwBtn, { backgroundColor: '#f59e0b', opacity: !stopwatchRunning ? 0.45 : 1 }]} onPress={pauseStopwatch} disabled={!stopwatchRunning}>
            <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.inlineSwBtn, { backgroundColor: '#64748b' }]} onPress={resetStopwatch}>
            <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.cardDivider, { backgroundColor: theme.colors.border }]} />
      <View style={styles.addTimeTitleRow}>
        <Text style={[styles.addTimeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Add Time</Text>
        {stopwatchTime > 0 && (
          <TouchableOpacity
            style={[styles.pushStopwatchBtn, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary }]}
            onPress={() => {
              const totalSeconds = Math.floor(stopwatchTime / 1000);
              const mins = Math.floor(totalSeconds / 60);
              const secs = totalSeconds % 60;
              const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
              setReportData(prev => ({ ...prev, actual_time_seconds: totalSeconds, actual_time_display: display }));
              setMinutes(mins);
              setSeconds(secs);
            }}
          >
            <Timer size={12} color={theme.colors.primary} />
            <Text style={[styles.pushStopwatchBtnText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Use {formatStopwatchTime(stopwatchTime)}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={[styles.timeBoxFull, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
        onPress={() => {
          if (!hasTimerSpeaker) {
            Alert.alert('Speaker Required', 'Please select a speaker first');
            return;
          }
          setShowTimePickerModal(true);
        }}
      >
        <View style={styles.timeBoxInner}>
          <Timer size={16} color={theme.colors.primary} />
          <Text style={[styles.timeBoxText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>{reportData.actual_time_display}</Text>
          <ChevronDown size={14} color={theme.colors.textSecondary} />
        </View>
        <Text style={[styles.timeBoxHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Tap to edit</Text>
      </TouchableOpacity>
      <View style={styles.qualifiedRow}>
        <Text style={[styles.qualifiedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Qualified:</Text>
        <View style={styles.qualifiedBtnsRow}>
          <TouchableOpacity
            style={[styles.qualifiedBtnNew, { backgroundColor: reportData.time_qualification === true ? '#3b82f6' : theme.colors.background, borderColor: reportData.time_qualification === true ? '#3b82f6' : theme.colors.border }]}
            onPress={() => { if (!hasTimerSpeaker) { setShowNameRequiredModal(true); return; } updateQualification(true); }}
          >
            <View style={[styles.radioDot, { borderColor: reportData.time_qualification === true ? '#ffffff' : theme.colors.border, backgroundColor: reportData.time_qualification === true ? '#ffffff' : 'transparent' }]}>
              {reportData.time_qualification === true && <View style={styles.radioDotInner} />}
            </View>
            <Text style={[styles.qualifiedBtnNewText, { color: reportData.time_qualification === true ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.qualifiedBtnNew, { backgroundColor: reportData.time_qualification === false ? '#3b82f6' : theme.colors.background, borderColor: reportData.time_qualification === false ? '#3b82f6' : theme.colors.border }]}
            onPress={() => { if (!hasTimerSpeaker) { setShowNameRequiredModal(true); return; } updateQualification(false); }}
          >
            <View style={[styles.radioDot, { borderColor: reportData.time_qualification === false ? '#ffffff' : theme.colors.border, backgroundColor: reportData.time_qualification === false ? '#ffffff' : 'transparent' }]}>
              {reportData.time_qualification === false && <View style={styles.radioDotInner} />}
            </View>
            <Text style={[styles.qualifiedBtnNewText, { color: reportData.time_qualification === false ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>No</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.saveButtonFull, { backgroundColor: hasTimerSpeaker ? theme.colors.primary : '#9ca3af' }]}
        onPress={() => {
          if (!canEditTimerCorner) { Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can save timer reports.'); return; }
          if (!hasTimerSpeaker) { Alert.alert('Speaker Required', 'Please select a speaker'); return; }
          if (!reportData.speech_category) { Alert.alert('Error', 'Please select a speech category'); return; }
          setShowConfirmModal(true);
        }}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonFullText} maxFontSizeMultiplier={1.3}>Save</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
        <TouchableOpacity
          style={[styles.headerInfoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
          onPress={() => setShowHowToModal(true)}
          activeOpacity={0.8}
        >
          <HelpCircle size={18} color="#6E839F" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Info Card */}
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
          <View pointerEvents="none" style={styles.meetingCardDecoration} />
        </View>

        {/* Assigned Timer Section */}
        {assignedTimer && (
          <View style={[styles.timerSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.timerCard}>
              <View style={styles.timerInfo}>
                <View style={styles.timerAvatar}>
                  {assignedTimer.avatar_url ? (
                    <Image source={{ uri: assignedTimer.avatar_url }} style={styles.timerAvatarImage} />
                  ) : (
                    <Timer size={24} color="#ffffff" />
                  )}
                </View>
                <View style={styles.timerDetails}>
                  <Text style={[styles.timerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {assignedTimer.full_name}
                  </Text>
                  <Text style={[styles.timerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Timer
                  </Text>
                </View>
              </View>
              {canEditTimerCorner && (
                <TouchableOpacity
                  style={styles.prepSpaceIconButton}
                  onPress={() => router.push(`/timer-notes?meetingId=${meetingId}`)}
                >
                  <NotebookPen size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {canEditTimerCorner && (
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: effectiveTab === 'record' ? '#3b82f6' : theme.colors.surface,
                  borderColor: effectiveTab === 'record' ? '#3b82f6' : theme.colors.border,
                }
              ]}
              onPress={() => {
                setSelectedTab('record');
                resetForm();
              }}
            >
              <Text style={[
                styles.tabText,
                { color: effectiveTab === 'record' ? '#ffffff' : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                Timer Corner
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: effectiveTab === 'reports' ? '#3b82f6' : theme.colors.surface,
                borderColor: effectiveTab === 'reports' ? '#3b82f6' : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('reports')}
          >
            <Text style={[
              styles.tabText,
              { color: effectiveTab === 'reports' ? '#ffffff' : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Timer Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {effectiveTab === 'record' ? (
          <>
            {/* Vertical Category List */}
            <View style={styles.categoryRowContainer}>
              <View style={styles.categoryRowContent}>
                {speechCategories.map((category) => {
                  const isSelected = reportData.speech_category === category.value;
                  return (
                    <TouchableOpacity
                      key={category.value}
                      style={[
                        styles.categoryPillItem,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => updateCategory(category.value)}
                    >
                      {getCategoryIcon(category.icon, category.color, isSelected)}
                      <Text style={[
                        styles.categoryPillItemText,
                        { color: isSelected ? '#ffffff' : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {categoryRoles.length > 0 && (
              <View style={[styles.preparedRolesCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.preparedRolesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedCategoryMeta?.label ?? 'Category'} roles open: {categoryOpenRolesCount}
                </Text>
                <View style={styles.preparedRolesList}>
                  {categoryRoles.map((role) => {
                    const assignedProfile = role.app_user_profiles;
                    const guestDisplayName = parseTimerGuestName(role.completion_notes);
                    const hasMember =
                      !!role.assigned_user_id && role.booking_status === 'booked' && !!assignedProfile;
                    const hasGuest =
                      role.booking_status === 'booked' && !!guestDisplayName && !role.assigned_user_id;
                    const isSlotFilled = hasMember || hasGuest;
                    const isExpanded = selectedCategoryRoleId === role.id;
                    const roleSummary = roleTimingSummary[role.id];
                    return (
                      <View key={role.id}>
                        <View
                          style={[styles.preparedRoleRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                        >
                        <View style={styles.preparedRoleTextWrap}>
                          <Text style={[styles.preparedRoleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {role.role_name}
                          </Text>
                          {hasMember ? (
                            <Text style={[styles.preparedRoleAssigned, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {assignedProfile!.full_name}
                            </Text>
                          ) : hasGuest ? (
                            <Text style={[styles.preparedRoleAssigned, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              {guestDisplayName}
                            </Text>
                          ) : (
                            <Text style={[styles.preparedRoleOpen, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Open
                            </Text>
                          )}
                          {!!roleSummary && (
                            <View style={styles.roleSummaryRow}>
                              <Text style={[styles.roleSummaryTime, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                                {roleSummary.time}
                              </Text>
                              <View style={[
                                styles.roleSummaryQBadge,
                                { backgroundColor: roleSummary.qualified ? '#dcfce7' : '#fee2e2' }
                              ]}>
                                <Text style={[
                                  styles.roleSummaryQText,
                                  { color: roleSummary.qualified ? '#16a34a' : '#dc2626' }
                                ]} maxFontSizeMultiplier={1.2}>
                                  Q
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        {isSlotFilled ? (
                          <TouchableOpacity
                            style={[styles.preparedRoleArrowBtn, { borderColor: theme.colors.border }]}
                            onPress={() => {
                              if (isExpanded) {
                                setSelectedCategoryRoleId(null);
                                setSelectedSpeaker(null);
                                setManualNameEntry(false);
                                setManualNameText('');
                                return;
                              }
                              setSelectedCategoryRoleId(role.id);
                              if (hasMember && assignedProfile) {
                                setManualNameEntry(false);
                                setManualNameText('');
                                setSelectedSpeaker({
                                  id: assignedProfile.id,
                                  full_name: assignedProfile.full_name,
                                  email: assignedProfile.email,
                                  avatar_url: assignedProfile.avatar_url,
                                });
                              } else if (hasGuest && guestDisplayName) {
                                setSelectedSpeaker(null);
                                setManualNameEntry(true);
                                setManualNameText(guestDisplayName);
                                setReportData((prev) => ({
                                  meeting_id: meetingId || '',
                                  club_id: user?.currentClubId || '',
                                  speaker_name: guestDisplayName,
                                  speaker_user_id: null,
                                  speech_category: prev.speech_category,
                                  actual_time_seconds: 0,
                                  actual_time_display: '00:00',
                                  time_qualification: null,
                                  target_min_seconds: null,
                                  target_max_seconds: null,
                                  notes: null,
                                  recorded_by: user?.id || '',
                                }));
                                setMinutes(0);
                                setSeconds(0);
                                setStopwatchTime(0);
                                setStopwatchRunning(false);
                              }
                            }}
                          >
                            <ChevronDown
                              size={16}
                              color={theme.colors.textSecondary}
                              style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                            />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.preparedRoleAssignBtn, { backgroundColor: '#2563eb' }]}
                            onPress={() => {
                              if (!canEditTimerCorner) return;
                              setAssigningTimerRole(false);
                              setRoleToAssign(role);
                              setGuestAssignNameInput('');
                              setShowSpeakerModal(true);
                            }}
                            disabled={!canEditTimerCorner}
                          >
                            <Text style={styles.preparedRoleAssignBtnText} maxFontSizeMultiplier={1.2}>Assign</Text>
                          </TouchableOpacity>
                        )}
                        </View>
                        {isExpanded && (
                          <View style={styles.inlineLoggerWrap}>
                            {renderTimeLoggerCard()}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {!canShowTimeLogger && (
              <Text style={[styles.selectRoleHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Select an assigned role (down arrow) to open Time Logger.
              </Text>
            )}

            {categoryRoles.length === 0 && canShowTimeLogger && renderTimeLoggerCard()}

            {/* Navigation Quick Actions Box */}
            <View style={[styles.quickActionsBoxContainer, { backgroundColor: '#ffffff' }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                    <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                    <Bell size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                    <Calendar size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                    <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Corner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Star size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                    <FileText size={FOOTER_NAV_ICON_SIZE} color="#8b5cf6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Mic size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speaker</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                    <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#9333ea" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                    <FileText size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quick Overview</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                    <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                    <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Evaluation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                    <FileBarChart size={FOOTER_NAV_ICON_SIZE} color="#10b981" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                    <Star size={FOOTER_NAV_ICON_SIZE} color="#8b5cf6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Toastmaster</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TTM</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </>
        ) : (
          /* Summary Tab */
          <View style={styles.reportsTabContent}>
            <View style={[styles.reportsSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.reportTableHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Timer Summary
              </Text>
              <Text style={[styles.vpeMessageSubtitle, { color: theme.colors.textSecondary, marginTop: 8, marginBottom: 14 }]} maxFontSizeMultiplier={1.2}>
                View complete meeting timing records and qualified statuses.
              </Text>
              <TouchableOpacity
                style={[styles.timerReviewButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/timer-review?meetingId=${meetingId}`)}
              >
                <View style={[styles.timerReviewIconWrap, { backgroundColor: '#FFF4E6' }]}>
                  <FileBarChart size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                </View>
                <View style={styles.timerReviewTextWrap}>
                  <Text style={[styles.timerReviewTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Timer Review
                  </Text>
                  <Text style={[styles.timerReviewSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    View report
                  </Text>
                </View>
                <ChevronDown size={18} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Speech Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Speech Category</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {speechCategories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.modalOption,
                    reportData.speech_category === category.value && { backgroundColor: category.color + '20' }
                  ]}
                  onPress={() => {
                    updateCategory(category.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: reportData.speech_category === category.value ? category.color : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal (Combined Minutes and Seconds) */}
      <Modal
        visible={showTimePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowTimePickerModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.timePickerModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.timePickerHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Set Time</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTimePickerModal(false)}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContent}>
              {/* Minutes Column */}
              <View style={styles.timePickerColumn}>
                <Text style={[styles.timePickerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Minutes</Text>
                <ScrollView style={styles.timePickerList} showsVerticalScrollIndicator={false}>
                  {minuteOptions.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timePickerOption,
                        minutes === minute && { backgroundColor: theme.colors.primary + '20' }
                      ]}
                      onPress={() => setMinutes(minute)}
                    >
                      <Text style={[
                        styles.timePickerOptionText,
                        { color: minutes === minute ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Separator */}
              <Text style={[styles.timePickerSeparator, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>:</Text>

              {/* Seconds Column */}
              <View style={styles.timePickerColumn}>
                <Text style={[styles.timePickerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Seconds</Text>
                <ScrollView style={styles.timePickerList} showsVerticalScrollIndicator={false}>
                  {secondOptions.map((second) => (
                    <TouchableOpacity
                      key={second}
                      style={[
                        styles.timePickerOption,
                        seconds === second && { backgroundColor: theme.colors.primary + '20' }
                      ]}
                      onPress={() => setSeconds(second)}
                    >
                      <Text style={[
                        styles.timePickerOptionText,
                        { color: seconds === second ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {second.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowTimePickerModal(false)}
            >
              <Text style={styles.doneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Confirm Details
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Is this information correct?
            </Text>

            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speech</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {speechCategories.find(c => c.value === reportData.speech_category)?.label ?? reportData.speech_category}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Name</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {selectedSpeaker ? selectedSpeaker.full_name : manualNameText.trim()}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Time</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.primary, fontWeight: '700' }]} maxFontSizeMultiplier={1.3}>
                {reportData.actual_time_display}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Qualified</Text>
              <View style={[
                styles.confirmQualifiedBadge,
                { backgroundColor: reportData.time_qualification ? '#dcfce7' : '#fee2e2' }
              ]}>
                <Text style={[
                  styles.confirmQualifiedText,
                  { color: reportData.time_qualification ? '#16a34a' : '#dc2626' }
                ]} maxFontSizeMultiplier={1.3}>
                  {reportData.time_qualification ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                onPress={async () => {
                  setShowConfirmModal(false);
                  await handleSaveReport();
                }}
                disabled={isSaving}
              >
                <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Saving...' : 'Confirm & Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!deleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#fee2e2' }]}>
              <Trash2 size={24} color="#dc2626" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.text, marginTop: 12 }]} maxFontSizeMultiplier={1.3}>
              Delete Timer Report
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to delete the timer report for{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>{deleteConfirm?.speakerName}</Text>?
              {'\n'}This action cannot be undone.
            </Text>
            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setDeleteConfirm(null)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: '#dc2626' }]}
                onPress={confirmDeleteReport}
              >
                <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Name Required Modal */}
      <Modal
        visible={showNameRequiredModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNameRequiredModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.deleteIconWrap, { backgroundColor: '#fef9c3' }]}>
              <User size={24} color="#ca8a04" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Speaker Required
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              Please select a speaker or enter a guest name, add the time, and then mark qualification.
            </Text>
            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />
            <TouchableOpacity
              style={[styles.confirmSaveBtn, { backgroundColor: theme.colors.primary, alignSelf: 'center', minWidth: 120 }]}
              onPress={() => setShowNameRequiredModal(false)}
            >
              <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Minutes Modal */}
      <Modal
        visible={showMinutesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMinutesModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowMinutesModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Minutes</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {minuteOptions.map((minute) => (
                <TouchableOpacity
                  key={minute}
                  style={[
                    styles.modalOption,
                    minutes === minute && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setMinutes(minute);
                    setShowMinutesModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: minutes === minute ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {minute.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Seconds Modal */}
      <Modal
        visible={showSecondsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSecondsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowSecondsModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Seconds</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {secondOptions.map((second) => (
                <TouchableOpacity
                  key={second}
                  style={[
                    styles.modalOption,
                    seconds === second && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setSeconds(second);
                    setShowSecondsModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: seconds === second ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {second.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Qualified Modal */}
      <Modal
        visible={showQualifiedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQualifiedModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowQualifiedModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Time Qualified?</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {qualificationOptions.map((option) => (
                <TouchableOpacity
                  key={option.value.toString()}
                  style={[
                    styles.modalOption,
                    reportData.time_qualification === option.value && { backgroundColor: option.color + '20' }
                  ]}
                  onPress={() => {
                    updateQualification(option.value);
                    setShowQualifiedModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: reportData.time_qualification === option.value ? option.color : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {renderSpeakerAssignmentModal()}

      {/* How To Modal */}
      <Modal visible={showHowToModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.howToOverlay}
          activeOpacity={1}
          onPress={() => setShowHowToModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.howToContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.howToHeader}>
              <Text style={[styles.howToTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer – How to Log Timing</Text>
              <TouchableOpacity
                onPress={() => setShowHowToModal(false)}
                style={styles.howToClose}
              >
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.howToScroll} showsVerticalScrollIndicator={false}>
              {/* Timer Corner Tab Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF' }]}>
                <FileText size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Timer Corner Tab</Text>
              </View>

              {[
                { num: 1, color: '#F59E0B', title: 'Select Category', desc: 'Choose the category. Speech / Table Topics / Evaluation.' },
                { num: 2, color: '#06B6D4', title: 'Select the Speaker', desc: "Choose the speaker's name from the dropdown." },
                { num: 3, color: '#10B981', title: 'Use the Stopwatch', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Start</Text> when the speech begins and <Text style={{ fontWeight: '700' }}>Stop</Text> when it ends.</Text> },
                { num: 4, color: '#6366F1', title: 'Enter the Final Time', desc: <Text maxFontSizeMultiplier={1.3}>The time can be entered or adjusted in <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add Time</Text>.</Text> },
                { num: 5, color: '#8B5CF6', title: 'Mark Qualification', desc: <Text maxFontSizeMultiplier={1.3}>Select <Text style={{ color: '#10B981', fontWeight: '700' }}>Yes</Text> if the speech met the required time range.{'\n'}Select <Text style={{ fontWeight: '700' }}>No</Text> if the speech was under or over time.</Text> },
                { num: 6, color: '#EC4899', title: 'Save the Record', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Save</Text> to store the timing entry.</Text> },
              ].map(({ num, color, title, desc }) => (
                <View key={num} style={styles.howToStep}>
                  <View style={[styles.howToStepNum, { backgroundColor: color }]}>
                    <Text style={styles.howToStepNumText} maxFontSizeMultiplier={1.2}>{num}</Text>
                  </View>
                  <View style={styles.howToStepContent}>
                    <Text style={[styles.howToStepTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
                    {typeof desc === 'string'
                      ? <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{desc}</Text>
                      : <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>
                    }
                  </View>
                </View>
              ))}

              {/* Summary Tab Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
                <FileBarChart size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Summary Tab</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                In the <Text style={{ fontWeight: '700' }}>Summary</Text> tab you can:
              </Text>
              <View style={styles.howToBulletList}>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} Review all recorded speech timings</Text>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} View the <Text style={{ fontWeight: '700', color: theme.colors.text }}>Timer Review</Text> report</Text>
              </View>

              {/* Exporting Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#FFF7ED', marginTop: 8 }]}>
                <Upload size={14} color='#EA580C' />
                <Text style={[styles.howToSectionBadgeText, { color: '#EA580C' }]} maxFontSizeMultiplier={1.3}>Exporting the Report</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Timing reports can be exported as PDF from the web portal. Steps:
              </Text>
              <View style={styles.howToNumberedList}>
                {[
                  <Text maxFontSizeMultiplier={1.3}>Go to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Settings {'→'} Web Login</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Open the web portal</Text>,
                  <Text maxFontSizeMultiplier={1.3}>Navigate to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Meeting {'→'} Timer</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Click <Text style={{ fontWeight: '700', color: theme.colors.text }}>Download PDF</Text></Text>,
                ].map((item, i) => (
                  <Text key={i} style={[styles.howToNumberedItem, { color: theme.colors.textSecondary }]}>
                    {i + 1}. {item}
                  </Text>
                ))}
              </View>

              {/* Tip Footer */}
              <View style={[styles.howToTipBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Lightbulb size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.howToTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  <Text style={{ fontWeight: '700' }}>Tips:</Text> Help Tap the{' '}
                  <HelpCircle size={12} color={theme.colors.textSecondary} />{' '}
                  icon anytime to view these instructions.
                </Text>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  noBookingContentContainer: {
    flexGrow: 1,
  },
  noBookingContentTop: {
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
  speakerSection: {
    marginHorizontal: 16,
    marginTop: 16,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  speakerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  speakerSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  speakerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    overflow: 'hidden',
  },
  speakerAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  speakerInfo: {
    flex: 1,
  },
  speakerLabel: {
    fontSize: 8,
    fontWeight: '600',
    marginBottom: 2,
  },
  speakerName: {
    fontSize: 11,
    fontWeight: '700',
  },
  speakerSubtext: {
    fontSize: 14,
  },
  readOnlyBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  readOnlyBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  categorySection: {
    marginHorizontal: 16,
    marginTop: 16,
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
  categoryButtonsGrid: {
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryButtonsVertical: {
    gap: 10,
  },
  categoryButtonVertical: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryButtonTextVertical: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryButtonsHorizontal: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryButtonHorizontal: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  categoryButtonTextHorizontal: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  timeSection: {
    marginHorizontal: 16,
    marginTop: 16,
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
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeDropdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  timeDisplayContainer: {
    alignItems: 'center',
  },
  timeDisplay: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: '#ffffff',
  },
  timeText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  timeDisplayLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeIcon: {
    marginRight: -4,
  },
  timeTextLarge: {
    fontSize: 40,
    fontWeight: '700',
  },
  qualifiedRadioGroup: {
    flexDirection: 'row',
    gap: 14,
  },
  qualifiedRadioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#64748b',
  },
  radioCircleSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  qualifiedRadioText: {
    fontSize: 15,
    fontWeight: '500',
  },
  qualifiedSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
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
  qualifiedInlineSection: {
    marginTop: 20,
  },
  qualifiedDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  qualifiedDropdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveSection: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  saveReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveReportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '60%',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalOptionsList: {
    maxHeight: 300,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  speakerModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '70%',
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  timePickerModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  timePickerList: {
    maxHeight: 200,
    borderRadius: 8,
  },
  timePickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 4,
  },
  timePickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 24,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  speakersList: {
    maxHeight: 400,
  },
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  noBookingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBookingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  speakerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  speakerOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  speakerOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  speakerOptionInfo: {
    flex: 1,
  },
  speakerOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  speakerOptionEmail: {
    fontSize: 13,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  accessDeniedState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  noAssignmentState: {
    alignItems: 'center',
    paddingVertical: 80,
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
    paddingVertical: 54,
    paddingHorizontal: 16,
  },
  noAssignmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  noAssignmentSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookRoleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  accessDeniedState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  timerSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  timerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timerTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  timerCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prepSpaceIconButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    overflow: 'hidden',
  },
  timerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  timerDetails: {
    flex: 1,
  },
  timerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1f2937',
  },
  timerRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 40,
  },
  headerInfoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 17,
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
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 5,
  },
  tabCount: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 17,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: '600',
  },
  reportsTabContent: {
    flex: 1,
  },
  reportsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  reportTableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportsList: {
    gap: 6,
  },
  reportTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  reportTableCell: {
    flex: 1,
    justifyContent: 'center',
  },
  reportTableNameCell: {
    flex: 2,
    justifyContent: 'center',
  },
  reportTableCenterCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTableName: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportTableCategory: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  reportTableTime: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  reportTableQualified: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportTableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 50,
  },
  reportTableActionButton: {
    padding: 4,
    borderRadius: 4,
  },
  emptyReportsState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyReportsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyReportsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  inlineStopwatchContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  inlineStopwatchTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inlineStopwatchTime: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  inlineStopwatchButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    width: '100%',
  },
  inlineSwBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  inlineSwBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
  },
  addTimeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addTimeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pushStopwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  pushStopwatchBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmDivider: {
    height: 1,
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmRowDivider: {
    height: 1,
  },
  confirmRowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmRowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  confirmQualifiedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  confirmQualifiedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  loggedTimeSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  allButtonSection: {
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  allButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  allButtonText: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  categoryPillsSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  categoryPillsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  categoryPill: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  categoryPillText: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  timerDisplayCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 7,
    padding: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1.5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  timeTextExtraLarge: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  tapToEditText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 7,
  },
  qualifiedCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 18,
    borderRadius: 7,
    padding: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1.5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  qualifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualifiedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  radioCircleLarge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheckmark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  qualifiedRadioTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveResultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 15,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveResultButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  saveIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2.4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.8,
    elevation: 6,
  },
  personalNotesCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  prepSpaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prepSpaceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prepSpaceTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  prepSpaceAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  readOnlyBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  stopwatchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  stopwatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stopwatchDisplay: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopwatchTime: {
    fontSize: 25,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  stopwatchButtons: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  stopwatchButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopwatchButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  categoryRowContainer: {
    marginTop: 16,
    marginBottom: 4,
  },
  categoryRowContent: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'stretch',
  },
  categoryPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    width: '100%',
  },
  categoryPillItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  preparedRolesCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  preparedRolesTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  preparedRolesList: {
    gap: 8,
  },
  inlineLoggerWrap: {
    marginTop: 8,
    marginBottom: 2,
  },
  preparedRoleRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preparedRoleTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  preparedRoleName: {
    fontSize: 13,
    fontWeight: '600',
  },
  preparedRoleAssigned: {
    fontSize: 12,
    marginTop: 2,
  },
  preparedRoleOpen: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  roleSummaryRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleSummaryTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleSummaryQBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleSummaryQText: {
    fontSize: 11,
    fontWeight: '800',
  },
  preparedRoleAssignBtn: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  preparedRoleAssignBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  preparedRoleArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectRoleHint: {
    marginTop: 10,
    marginHorizontal: 18,
    fontSize: 12,
    fontWeight: '500',
  },
  logTimeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  timeLoggerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  timeBoxFull: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  timeBoxInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBoxText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  timeBoxHint: {
    fontSize: 11,
    marginTop: 4,
  },
  qualifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qualifiedLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 72,
  },
  qualifiedBtnsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  qualifiedBtnNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  qualifiedBtnNewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonFull: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonFullText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
  categoryColumn: {
    flex: 1,
    gap: 7,
  },
  categoryHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    paddingLeft: 2,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 9,
    borderRadius: 9,
    gap: 7,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  controlsColumn: {
    flex: 1.5,
    gap: 10,
  },
  timeCardCompact: {
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeDisplayCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  timeLargeText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tapToEditSmall: {
    fontSize: 7,
    fontWeight: '500',
    marginTop: 3,
  },
  qualifiedSection: {
    gap: 7,
  },
  qualifiedHeading: {
    fontSize: 10,
    fontWeight: '700',
  },
  qualifiedButtons: {
    flexDirection: 'row',
    gap: 7,
  },
  qualifiedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    gap: 5,
  },
  qualifiedBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  radioDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickActionsBoxContainer: {
    borderTopWidth: 0,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  guestAssignBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  guestAssignLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  guestAssignInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  guestAssignButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  guestAssignButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalMembersHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  guestEntryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  guestEntryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestEntryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    marginVertical: 8,
  },
  manualNameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 6,
  },
  timerReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  timerReviewIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerReviewTextWrap: {
    flex: 1,
  },
  timerReviewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  timerReviewSub: {
    fontSize: 12,
    marginTop: 1,
  },
  howToOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  howToContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  howToTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginRight: 8,
  },
  howToClose: {
    padding: 4,
  },
  howToScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  howToSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14,
  },
  howToSectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  howToStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  howToStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  howToStepNumText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  howToStepContent: {
    flex: 1,
  },
  howToStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  howToStepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToBodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  howToBulletList: {
    gap: 4,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToBullet: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToNumberedList: {
    gap: 6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToNumberedItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  howToTipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
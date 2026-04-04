import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import { suggestTimerQualification } from '@/lib/timerQualificationSuggestion';
import { fetchTimerReportSnapshot, fetchTimerReportCategoryBundle, timerReportQueryKeys } from '@/lib/timerReportSnapshot';
import { propagateMeetingVisitingGuestDisplayRename } from '@/lib/syncVisitingGuestRosterNames';
import {
  type MeetingVisitingGuest,
  VISITING_GUEST_SLOT_COUNT,
  parseMeetingVisitingGuests,
  visitingGuestInputsFromRows,
} from '@/lib/meetingVisitingGuests';
import { parseMmSs, TimerDialStopwatch } from '@/components/timer/TimerDialStopwatch';
import { NOTION_TIMER } from '@/components/timer/TimerMinuteProgressRing';
import { ArrowLeft, Timer, Calendar, User, ChevronDown, ChevronUp, Save, Trash2, X, FileText, Search, Lock, MessageCircle, Snowflake, Mic, MessageSquare, Lightbulb, NotebookPen, Plus, Bell, Users, BookOpen, Star, CheckSquare, ClipboardCheck, Clock, Info, RotateCcw, UserPlus, Vote, Play, Pause, Square, Eye, EyeOff } from 'lucide-react-native';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatTimerGuestDisplayName,
  formatTimerGuestSummaryPrimaryName,
  normalizeTimerGuestSpeakerKey,
  parseTimerGuestCompletionNotes,
} from '@/lib/timerGuestDisplayName';

const FOOTER_NAV_ICON_SIZE = 15;

const CATEGORY_ROLE_SELECT_EMBED = `
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `;

const CATEGORY_ROLE_SELECT_WITHOUT_TIMER_COLUMN = `
          id,
          role_name,
          booking_status,
          assigned_user_id,
          completion_notes,
          role_status,
          ${CATEGORY_ROLE_SELECT_EMBED}
        `;

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

function formatTimeForTimerDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function timerMeetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** Same meta line pattern as Grammarian / General Evaluator consolidated header */
function formatTimerConsolidatedMeetingMeta(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeForTimerDisplay(m.meeting_start_time)} - ${formatTimeForTimerDisplay(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeForTimerDisplay(m.meeting_start_time));
  }
  parts.push(timerMeetingModeLabel(m));
  return parts.join(' | ');
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
  /** Lowercase `app_club_user_relationship.role` when known */
  club_role?: string | null;
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
  updated_at?: string;
  summary_visible_to_members?: boolean | null;
  /** Stable row in `app_meeting_visiting_guests` when the speaker is a roster guest */
  visiting_guest_id?: string | null;
}

/** Latest save wins: use max(recorded_at, updated_at) so an update beats an older insert. */
function timerReportLastActivityMs(r: TimerReport): number {
  const rec = r.recorded_at ? new Date(r.recorded_at).getTime() : 0;
  const upd = r.updated_at ? new Date(r.updated_at).getTime() : 0;
  return Math.max(rec, upd);
}

/** One row per speaker (member or guest) per section — keeps the most recently entered/updated report. */
function pickLatestTimerReportPerSpeaker(reports: TimerReport[]): TimerReport[] {
  const map = new Map<string, TimerReport>();
  for (const r of reports) {
    const key =
      r.speaker_user_id != null && String(r.speaker_user_id).length > 0
        ? `u:${r.speaker_user_id}`
        : `g:${r.speech_category}:${(r.speaker_name || '').trim().toLowerCase()}`;
    const prev = map.get(key);
    if (!prev || timerReportLastActivityMs(r) > timerReportLastActivityMs(prev)) {
      map.set(key, r);
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      timerReportLastActivityMs(b) - timerReportLastActivityMs(a) ||
      (a.speaker_name || '').localeCompare(b.speaker_name || '')
  );
}

function isTimerSummaryVisibleColumnError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (error?.code === 'PGRST204' || error?.code === '42703') && message.includes('summary_visible_to_members');
}

/** Roles marked Deleted in Manage Meeting Roles are hidden on the Timer Report. */
function isTimerReportRoleSlotAvailable(role: { role_status?: string | null }): boolean {
  return (role.role_status ?? 'Available') !== 'Deleted';
}

interface CategoryRole {
  id: string;
  role_name: string;
  booking_status: string | null;
  assigned_user_id: string | null;
  completion_notes: string | null;
  role_status?: string | null;
  app_user_profiles?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

function isTimerCategoryRoleSlotFilled(role: CategoryRole): boolean {
  const guestName = parseTimerGuestCompletionNotes(role.completion_notes);
  if (role.booking_status !== 'booked') return false;
  if (role.assigned_user_id) return true;
  return !!guestName;
}

const EXCOMM_RELATIONSHIP_ROLES = new Set([
  'excomm',
  'president',
  'vpe',
  'vpm',
  'vppr',
  'secretary',
  'treasurer',
  'saa',
  'ipp',
]);

/** Subtitle under the speaker name on Timer Summary (club roster role, not speech category). */
function formatClubRelationshipRoleForTimerSummary(roleKey: string | null | undefined): string {
  const r = String(roleKey || '')
    .trim()
    .toLowerCase();
  if (!r) return 'Member';
  if (r === 'visiting_tm') return 'Visiting Toastmaster';
  if (EXCOMM_RELATIONSHIP_ROLES.has(r)) return 'ExComm';
  if (r === 'club_leader') return 'Club Leader';
  if (r === 'guest') return 'Guest';
  if (r === 'member') return 'Member';
  return r
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Reverted: without timer_report_assigned_by, allow manage when editor can edit. */
function canTimerCornerManageAssignment(role: CategoryRole, canEditTimerCorner: boolean): boolean {
  return canEditTimerCorner && isTimerCategoryRoleSlotFilled(role);
}

export default function TimerReportDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [memberClubRoleByUserId, setMemberClubRoleByUserId] = useState<Record<string, string>>({});
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
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'record' | 'reports'>('record');
  const [savedReports, setSavedReports] = useState<TimerReport[]>([]);
  const [timerSummaryVisibleToMembers, setTimerSummaryVisibleToMembers] = useState(true);
  const [visitingGuestInputs, setVisitingGuestInputs] = useState<string[]>(() =>
    Array.from({ length: VISITING_GUEST_SLOT_COUNT }, () => '')
  );
  const [meetingVisitingGuests, setMeetingVisitingGuests] = useState<MeetingVisitingGuest[]>([]);
  const [savingVisitingGuests, setSavingVisitingGuests] = useState(false);
  const [visitingGuestsExpanded, setVisitingGuestsExpanded] = useState(false);
  const [deletingReports, setDeletingReports] = useState<Set<string>>(new Set());
  const [bookedSpeakers, setBookedSpeakers] = useState<ClubMember[]>([]);
  const [bookingTimerRole, setBookingTimerRole] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [categoryRoles, setCategoryRoles] = useState<CategoryRole[]>([]);
  const [selectedCategoryRoleId, setSelectedCategoryRoleId] = useState<string | null>(null);
  const [assigningTimerRole, setAssigningTimerRole] = useState(false);
  const [roleTimingSummary, setRoleTimingSummary] = useState<Record<string, { time: string; qualified: boolean }>>({});

  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchFinalized, setStopwatchFinalized] = useState(false);
  const [stopwatchInterval, setStopwatchInterval] = useState<NodeJS.Timeout | null>(null);
  /** Drives smooth sub-second progress on the minute ring while the stopwatch runs. */
  const [ringFrame, setRingFrame] = useState(0);
  const lastStopwatchTickWallRef = useRef(Date.now());
  /** Once the user taps Yes/No, auto rules never change qualification until reset/category/speaker clears. */
  const timerQualUserOverrideRef = useRef(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [clubName, setClubName] = useState('');
  const [fetchedTimerAvatarUrl, setFetchedTimerAvatarUrl] = useState<string | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const refreshTimerReportOnFocusRef = useRef<() => void>(() => {});

  const isMeetingTimer = !!(assignedTimer && user && assignedTimer.id === user.id);
  const canEditTimerCorner = isMeetingTimer || isVPEClub;
  const effectiveTab = canEditTimerCorner ? selectedTab : 'reports';

  /** Snapshot RPC may omit avatar_url; fall back to signed-in user or club directory */
  const resolvedTimerAvatarUrl = useMemo(() => {
    if (!assignedTimer) return null;
    const fromRole = assignedTimer.avatar_url?.trim();
    if (fromRole) return fromRole;
    const aid = String(assignedTimer.id);
    if (user?.id != null && String(user.id) === aid) {
      const fromUser = user.avatarUrl?.trim();
      if (fromUser) return fromUser;
    }
    const fromDir = clubMembers.find((m) => String(m.id) === aid)?.avatar_url?.trim();
    return fromDir || null;
  }, [assignedTimer, user?.id, user?.avatarUrl, clubMembers]);

  const timerHeaderAvatarUrl = resolvedTimerAvatarUrl || fetchedTimerAvatarUrl;

  const speechCategories = [
    { value: 'prepared_speaker', label: 'Prepared speakers', color: '#3b82f6', icon: 'message-circle', classifications: ['Prepared Speaker'], roleNames: ['Prepared Speaker 1', 'Prepared Speaker 2', 'Prepared Speaker 3', 'Prepared Speaker 4', 'Prepared Speaker 5'] },
    { value: 'table_topic_speaker', label: 'Table topic speakers', color: '#f97316', icon: 'mic', classifications: ['On-the-Spot Speaking'], roleNames: ['Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3', 'Table Topics Speaker 4', 'Table Topics Speaker 5', 'Table Topics Speaker 6', 'Table Topics Speaker 7', 'Table Topics Speaker 8', 'Table Topics Speaker 9', 'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'] },
    { value: 'evaluation', label: 'Speech evaluators', color: '#10b981', icon: 'message-square', classifications: ['Speech evaluvator'], roleNames: ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'] },
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
      void loadData();
    }
  }, [meetingId, user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshTimerReportOnFocusRef.current();
    }, [])
  );

  function loadSpeakerReport() {
    if (!selectedSpeaker) return;
    setReportData((prev) => ({
      meeting_id: meetingId || '',
      club_id: user?.currentClubId || '',
      speaker_name: selectedSpeaker.full_name,
      speaker_user_id: selectedSpeaker.id,
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
    setStopwatchFinalized(false);
    setStopwatchTime(0);
    lastStopwatchTickWallRef.current = Date.now();
    setStopwatchRunning(false);
    timerQualUserOverrideRef.current = false;
  }

  useEffect(() => {
    if (selectedSpeaker) {
      loadSpeakerReport();
    }
  }, [selectedSpeaker]);

  useEffect(() => {
    // Update actual_time_seconds and display when minutes/seconds change
    const totalSeconds = minutes * 60 + seconds;
    setReportData((prev) => ({
      ...prev,
      actual_time_seconds: totalSeconds,
      actual_time_display: formatTime(totalSeconds),
    }));
  }, [minutes, seconds]);

  useEffect(() => {
    if (stopwatchRunning) {
      const interval = setInterval(() => {
        lastStopwatchTickWallRef.current = Date.now();
        setStopwatchTime((prev) => prev + 1000);
      }, 1000);
      setStopwatchInterval(interval);
      return () => clearInterval(interval);
    } else if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!stopwatchRunning) return;
    let cancelled = false;
    let rafId = 0;
    const loop = () => {
      if (cancelled) return;
      setRingFrame((n) => n + 1);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [stopwatchRunning]);

  /** Keep report time in sync with the running / paused stopwatch until Stop finalizes. */
  useEffect(() => {
    if (stopwatchFinalized) return;
    const totalSeconds = Math.floor(stopwatchTime / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    setMinutes(m);
    setSeconds(s);
  }, [stopwatchTime, stopwatchFinalized]);

  useEffect(() => {
    let cancelled = false;
    const aid = assignedTimer?.id;
    if (!aid) {
      setFetchedTimerAvatarUrl(null);
      return;
    }
    const idStr = String(aid);
    const quick =
      assignedTimer.avatar_url?.trim() ||
      (user?.id != null && String(user.id) === idStr && user.avatarUrl?.trim()) ||
      clubMembers.find((m) => String(m.id) === idStr)?.avatar_url?.trim();
    if (quick) {
      setFetchedTimerAvatarUrl(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', aid)
        .maybeSingle();
      if (cancelled || error) return;
      const u = (data as { avatar_url?: string | null } | null)?.avatar_url?.trim();
      setFetchedTimerAvatarUrl(u || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [assignedTimer?.id, assignedTimer?.avatar_url, user?.id, user?.avatarUrl, clubMembers]);

  const startStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    if (stopwatchFinalized) return;
    lastStopwatchTickWallRef.current = Date.now();
    setStopwatchRunning(true);
  };

  const pauseStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    if (stopwatchFinalized) return;
    setStopwatchRunning(false);
  };

  /** Stop: finalize time, lock dial increment, allow editing the time field. */
  const finalizeStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    if (stopwatchFinalized) return;
    const totalSeconds = Math.floor(stopwatchTime / 1000);
    if (totalSeconds === 0 && !stopwatchRunning) {
      Alert.alert('Timer', 'Start the timer before stopping, or use Reset.');
      return;
    }
    setStopwatchRunning(false);
    setStopwatchFinalized(true);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    setMinutes(m);
    setSeconds(s);
    setReportData((prev) => {
      const next = {
        ...prev,
        actual_time_seconds: totalSeconds,
        actual_time_display: formatTime(totalSeconds),
      };
      if (!timerQualUserOverrideRef.current) {
        const sug = suggestTimerQualification(prev.speech_category, totalSeconds);
        if (sug !== null) next.time_qualification = sug;
      }
      return next;
    });
  };

  const resetStopwatch = () => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can use the stopwatch controls.');
      return;
    }
    setStopwatchRunning(false);
    setStopwatchFinalized(false);
    setStopwatchTime(0);
    lastStopwatchTickWallRef.current = Date.now();
    setMinutes(0);
    setSeconds(0);
    timerQualUserOverrideRef.current = false;
    setReportData((prev) => ({
      ...prev,
      actual_time_seconds: 0,
      actual_time_display: '00:00',
      time_qualification: null,
    }));
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

  const loadClubName = async () => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase.from('clubs').select('name').eq('id', user.currentClubId).single();
      if (error) {
        console.error('Error loading club name:', error);
        return;
      }
      if (data?.name) setClubName(data.name);
    } catch (e) {
      console.error('Error loading club name:', e);
    }
  };

  const applyCategoryBundleToState = (
    categoryRolesIn: CategoryRole[],
    booked: { id: string; full_name: string; email: string; avatar_url: string | null }[]
  ) => {
    const rows = categoryRolesIn.filter(isTimerReportRoleSlotAvailable);
    rows.sort((a, b) => slotNumberFromRoleName(a.role_name) - slotNumberFromRoleName(b.role_name));
    setCategoryRoles(rows);

    const bookedUserIds = new Set(
      rows.filter((r) => r.assigned_user_id && r.booking_status === 'booked').map((r) => r.assigned_user_id as string)
    );
    const uniqueSpeakers = booked.filter((s) => bookedUserIds.has(s.id));
    uniqueSpeakers.sort((a, b) => a.full_name.localeCompare(b.full_name));
    setBookedSpeakers(uniqueSpeakers);
    setSelectedSpeaker((prev) => {
      if (prev && uniqueSpeakers.some((s) => s.id === prev.id)) return prev;
      return uniqueSpeakers.length > 0 ? uniqueSpeakers[0] : null;
    });
  };

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const run = async () => {
      try {
        setIsLoading(true);
        const effectiveUserId = user?.id ?? '';
        const snap = await queryClient.fetchQuery({
          queryKey: timerReportQueryKeys.snapshot(
            meetingId,
            reportData.speech_category,
            effectiveUserId || 'anon'
          ),
          queryFn: () => fetchTimerReportSnapshot(meetingId, reportData.speech_category),
          staleTime: 60 * 1000,
        });
        if (snap?.meeting && Object.keys(snap.meeting).length > 0 && snap.club_id) {
          setMeeting(snap.meeting as unknown as Meeting);
          void loadClubName();

          const roleByUser: Record<string, string> = {};
          const allMembers: ClubMember[] = snap.member_directory.map((m) => {
            const id = m.user_id;
            const rawRole = m.club_role?.trim();
            if (id && rawRole) {
              roleByUser[id] = rawRole.toLowerCase();
            }
            return {
              id,
              full_name: m.full_name || '',
              email: m.email || '',
              avatar_url: m.avatar_url ?? null,
              club_role: rawRole ? rawRole.toLowerCase() : null,
            };
          });
          setMemberClubRoleByUserId(roleByUser);
          let membersToShow = allMembers;
          if (snap.selected_member_ids.length > 0) {
            const selectedSet = new Set(snap.selected_member_ids);
            membersToShow = allMembers.filter((m) => selectedSet.has(m.id));
          }
          membersToShow.sort((a, b) => a.full_name.localeCompare(b.full_name));
          setClubMembers(membersToShow);

          if (snap.assigned_timer) {
            setAssignedTimer({
              id: snap.assigned_timer.id,
              full_name: snap.assigned_timer.full_name,
              email: snap.assigned_timer.email,
              avatar_url: snap.assigned_timer.avatar_url,
            });
          } else {
            setAssignedTimer(null);
          }

          setIsVPEClub(snap.is_vpe);
          const snapReports = (snap.timer_reports || []) as TimerReport[];
          setSavedReports(snapReports);
          const snapVisible = snapReports.find((r) => typeof r.summary_visible_to_members === 'boolean')?.summary_visible_to_members;
          if (typeof snapVisible === 'boolean') {
            setTimerSummaryVisibleToMembers(snapVisible);
          } else {
            await loadTimerSummaryVisibility();
          }
          setMeetingVisitingGuests(snap.visiting_guests);
          setVisitingGuestInputs(visitingGuestInputsFromRows(snap.visiting_guests));
          applyCategoryBundleToState(snap.category_roles as CategoryRole[], snap.booked_speakers);
        } else {
          await Promise.all([
            loadMeeting(),
            loadClubMembers(),
            loadAssignedTimer(),
            loadIsVPEClub(),
            loadClubName(),
            loadSavedReports(),
            loadTimerSummaryVisibility(),
            loadBookedSpeakersForCategory(reportData.speech_category),
            loadCategoryRolesForCategory(reportData.speech_category),
            loadVisitingGuestDraftFromDb(),
          ]);
        }
      } catch (error) {
        console.error('Error loading timer snapshot:', error);
        try {
          await Promise.all([
            loadMeeting(),
            loadClubMembers(),
            loadAssignedTimer(),
            loadIsVPEClub(),
            loadClubName(),
            loadSavedReports(),
            loadTimerSummaryVisibility(),
            loadBookedSpeakersForCategory(reportData.speech_category),
            loadCategoryRolesForCategory(reportData.speech_category),
            loadVisitingGuestDraftFromDb(),
          ]);
        } catch (fallbackError) {
          console.error('Error loading data:', fallbackError);
          Alert.alert('Error', 'Failed to load meeting data');
        }
      } finally {
        setIsLoading(false);
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

  const loadClubMembers = async () => {
    if (!user?.currentClubId || !meetingId) return;

    try {
      // Prefer RPC: PostgREST embed on app_club_user_relationship is very slow on large clubs / slow networks.
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_club_member_directory', {
        target_club_id: user.currentClubId,
      });

      let allMembers: ClubMember[] = [];

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        const roleByUser: Record<string, string> = {};
        allMembers = (
          rpcData as {
            user_id: string;
            full_name: string;
            email: string;
            avatar_url: string | null;
            club_role?: string | null;
          }[]
        )
          .map((row) => {
            const raw = row.club_role?.trim();
            if (row.user_id && raw) {
              roleByUser[row.user_id] = raw.toLowerCase();
            }
            return {
              id: row.user_id,
              full_name: row.full_name || '',
              email: row.email || '',
              avatar_url: row.avatar_url ?? null,
              club_role: raw ? raw.toLowerCase() : null,
            };
          })
          .filter((m) => m.id);
        setMemberClubRoleByUserId(roleByUser);
      } else {
        if (rpcError) {
          console.warn('get_club_member_directory failed, falling back to embed query:', rpcError);
        }
        const { data, error } = await supabase
          .from('app_club_user_relationship')
          .select(`
            role,
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

        const roleByUser: Record<string, string> = {};
        allMembers = (data || []).map((item) => {
          const row = item as { role?: string | null; app_user_profiles: ClubMember };
          const prof = row.app_user_profiles;
          const raw = row.role?.trim();
          if (prof?.id && raw) {
            roleByUser[prof.id] = raw.toLowerCase();
          }
          return {
            id: prof.id,
            full_name: prof.full_name,
            email: prof.email,
            avatar_url: prof.avatar_url,
            club_role: raw ? raw.toLowerCase() : null,
          };
        });
        setMemberClubRoleByUserId(roleByUser);
      }

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
          role_status,
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
        .filter((item) => isTimerReportRoleSlotAvailable({ role_status: (item as any).role_status }))
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
      let query = supabase
        .from('app_meeting_roles_management')
        .select(CATEGORY_ROLE_SELECT_WITHOUT_TIMER_COLUMN)
        .eq('meeting_id', meetingId)
        .in('role_name', selectedCategory.roleNames);

      const { data, error } = await query;

      if (error) {
        console.error('Error loading category roles:', error);
        return;
      }

      const rows = ((data || []) as CategoryRole[]).filter(isTimerReportRoleSlotAvailable);
      rows.sort(
        (a, b) => slotNumberFromRoleName(a.role_name) - slotNumberFromRoleName(b.role_name)
      );
      setCategoryRoles(rows);
    } catch (error) {
      console.error('Error loading category roles:', error);
    }
  };

  const refreshCategoryBundleForCategory = async (category: string) => {
    if (!meetingId) return;
    const bundle = await fetchTimerReportCategoryBundle(meetingId, category);
    if (bundle) {
      applyCategoryBundleToState(bundle.category_roles as CategoryRole[], bundle.booked_speakers);
    } else {
      await Promise.all([
        loadCategoryRolesForCategory(category),
        loadBookedSpeakersForCategory(category),
      ]);
    }
  };

  const confirmUnassignCategoryRole = (role: CategoryRole) => {
    if (!canEditTimerCorner || !meetingId) return;
    if (!canTimerCornerManageAssignment(role, canEditTimerCorner)) {
      Alert.alert(
        'Booked elsewhere',
        'This role was booked outside Timer Report. Members can change it from Book a Role.'
      );
      return;
    }
    const label = role.role_name;
    Alert.alert(
      'Unassign role',
      `Remove the current speaker from ${label}? The slot will open for someone else.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => void handleUnassignCategoryRole(role),
        },
      ]
    );
  };

  const openTimerCategoryRoleAssign = useCallback(
    (role: CategoryRole) => {
      if (!canEditTimerCorner || !meetingId) return;
      if (!canTimerCornerManageAssignment(role, canEditTimerCorner)) return;
      router.push({
        pathname: '/timer-role-assign',
        params: {
          meetingId,
          roleId: role.id,
          speechCategory: reportData.speech_category,
        },
      });
    },
    [canEditTimerCorner, meetingId, reportData.speech_category]
  );

  const handleUnassignCategoryRole = async (role: CategoryRole) => {
    if (!canEditTimerCorner || !meetingId) return;
    try {
      const { data: clsRow, error: clsErr } = await supabase
        .from('app_meeting_roles_management')
        .select('role_classification')
        .eq('id', role.id)
        .maybeSingle();

      if (clsErr) {
        console.error('Error loading role classification:', clsErr);
      }

      const memberId = role.assigned_user_id;

      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: null,
          booking_status: 'available',
          completion_notes: null,
          withdrawn_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', role.id);

      if (error) {
        console.error('Error unassigning category role:', error);
        Alert.alert('Error', 'Could not unassign this role. Please try again.');
        return;
      }

      if (
        (clsRow as { role_classification?: string } | null)?.role_classification === 'educational_speaker' &&
        memberId
      ) {
        const { error: eduErr } = await supabase
          .from('app_meeting_educational_speaker')
          .delete()
          .eq('meeting_id', meetingId)
          .eq('speaker_user_id', memberId);
        if (eduErr) {
          console.error('Error clearing educational speaker row:', eduErr);
        }
      }

      if (selectedCategoryRoleId === role.id) {
        setSelectedCategoryRoleId(null);
        setSelectedSpeaker(null);
        setManualNameEntry(false);
        setManualNameText('');
      }

      await refreshCategoryBundleForCategory(reportData.speech_category);
      setShowSpeakerModal(false);
      setSpeakerSearchQuery('');
      setAssigningTimerRole(false);
      Alert.alert('Unassigned', `${role.role_name} is open again.`);
    } catch (e) {
      console.error('Error unassigning category role:', e);
      Alert.alert('Error', 'Could not unassign this role.');
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
    setStopwatchFinalized(false);
    setStopwatchTime(0);
    lastStopwatchTickWallRef.current = Date.now();
    timerQualUserOverrideRef.current = false;
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
      const visible = (data || []).find((r: any) => typeof r.summary_visible_to_members === 'boolean')?.summary_visible_to_members;
      if (typeof visible === 'boolean') {
        setTimerSummaryVisibleToMembers(visible);
      }
    } catch (error) {
      console.error('Error loading saved reports:', error);
    }
  };

  const loadVisitingGuestDraftFromDb = async () => {
    if (!meetingId) return;
    try {
      const { data, error } = await supabase
        .from('app_meeting_visiting_guests')
        .select('id, meeting_id, club_id, slot_number, display_name, created_at, updated_at')
        .eq('meeting_id', meetingId)
        .order('slot_number', { ascending: true });
      if (error) return;
      const rows = parseMeetingVisitingGuests(data ?? []);
      setMeetingVisitingGuests(rows);
      setVisitingGuestInputs(visitingGuestInputsFromRows(rows));
    } catch {
      /* table may not exist until migration */
    }
  };

  refreshTimerReportOnFocusRef.current = () => {
    if (!meetingId || !user?.currentClubId) return;
    void refreshCategoryBundleForCategory(reportData.speech_category);
    void loadVisitingGuestDraftFromDb();
  };

  const loadTimerSummaryVisibility = async () => {
    if (!meetingId) return;
    try {
      const { data, error } = await supabase
        .from('timer_reports')
        .select('summary_visible_to_members')
        .eq('meeting_id', meetingId)
        .limit(1)
        .maybeSingle();
      if (error) {
        if (isTimerSummaryVisibleColumnError(error)) {
          setTimerSummaryVisibleToMembers(true);
          return;
        }
        console.error('Error loading timer summary visibility:', error);
        return;
      }
      if (data && typeof (data as any).summary_visible_to_members === 'boolean') {
        setTimerSummaryVisibleToMembers(Boolean((data as any).summary_visible_to_members));
      }
    } catch (error) {
      console.error('Error loading timer summary visibility:', error);
    }
  };

  /** Restore time + Q on each role row from persisted timer_reports (state alone was lost on navigation). */
  useEffect(() => {
    if (!categoryRoles.length || !user?.id) {
      setRoleTimingSummary({});
      return;
    }
    const cat = reportData.speech_category;
    // Show all timer rows for this category (assigned Timer + VPE share one meeting report).
    // Summary tab already lists everyone; Corner must match so each editor sees the other's entries.
    const categoryReports = savedReports.filter((r) => r.speech_category === cat);
    const next: Record<string, { time: string; qualified: boolean }> = {};
    for (const role of categoryRoles) {
      const guestName = parseTimerGuestCompletionNotes(role.completion_notes);
      let candidates: TimerReport[] = [];
      if (role.assigned_user_id) {
        candidates = categoryReports.filter((r) => r.speaker_user_id === role.assigned_user_id);
      } else if (guestName) {
        const guestKey = normalizeTimerGuestSpeakerKey(guestName);
        candidates = categoryReports.filter(
          (r) =>
            !r.speaker_user_id && normalizeTimerGuestSpeakerKey(r.speaker_name) === guestKey
        );
      }
      if (candidates.length) {
        const best = [...candidates].sort(
          (a, b) => timerReportLastActivityMs(b) - timerReportLastActivityMs(a)
        )[0];
        next[role.id] = {
          time: best.actual_time_display,
          qualified: !!best.time_qualification,
        };
      }
    }
    setRoleTimingSummary(next);
  }, [savedReports, categoryRoles, reportData.speech_category, user?.id]);

  useEffect(() => {
    if (!selectedCategoryRoleId) return;
    if (!categoryRoles.some((r) => r.id === selectedCategoryRoleId)) {
      setSelectedCategoryRoleId(null);
      setSelectedSpeaker(null);
      setManualNameEntry(false);
      setManualNameText('');
    }
  }, [categoryRoles, selectedCategoryRoleId]);

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

  const handleTimerSummaryVisibilityChange = async (visible: boolean) => {
    if (!canEditTimerCorner || !meetingId) return;
    setTimerSummaryVisibleToMembers(visible);
    try {
      const { error } = await supabase
        .from('timer_reports')
        .update({ summary_visible_to_members: visible })
        .eq('meeting_id', meetingId);
      if (error) {
        if (isTimerSummaryVisibleColumnError(error)) {
          Alert.alert('Migration required', 'Run the latest timer summary visibility migration, then try again.');
          return;
        }
        console.error('Error updating timer summary visibility:', error);
        Alert.alert('Error', 'Failed to update timer summary visibility');
        return;
      }
      setSavedReports((prev) => prev.map((r) => ({ ...r, summary_visible_to_members: visible })));
    } catch (error) {
      console.error('Error updating timer summary visibility:', error);
      Alert.alert('Error', 'Failed to update timer summary visibility');
    }
  };

  const handleSaveVisitingGuests = async () => {
    if (!canEditTimerCorner || !meetingId || !user?.currentClubId) return;
    setSavingVisitingGuests(true);
    try {
      const { data: dbBefore, error: beforeErr } = await supabase
        .from('app_meeting_visiting_guests')
        .select('id, slot_number, display_name')
        .eq('meeting_id', meetingId)
        .order('slot_number', { ascending: true });
      if (beforeErr) console.warn('visiting guests before save', beforeErr);
      const beforeBySlot = new Map<number, { id: string; display_name: string }>();
      for (const r of dbBefore || []) {
        const row = r as { id: string; slot_number: number; display_name: string | null };
        beforeBySlot.set(row.slot_number, { id: row.id, display_name: (row.display_name || '').trim() });
      }

      for (let i = 0; i < VISITING_GUEST_SLOT_COUNT; i++) {
        const slot = i + 1;
        const name = (visitingGuestInputs[i] ?? '').trim();
        if (!name) {
          const { error } = await supabase
            .from('app_meeting_visiting_guests')
            .delete()
            .eq('meeting_id', meetingId)
            .eq('slot_number', slot);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('app_meeting_visiting_guests').upsert(
            {
              meeting_id: meetingId,
              club_id: user.currentClubId,
              slot_number: slot,
              display_name: name,
            },
            { onConflict: 'meeting_id,slot_number' }
          );
          if (error) throw error;
        }
      }

      const { data: dbAfter, error: afterErr } = await supabase
        .from('app_meeting_visiting_guests')
        .select('id, slot_number, display_name')
        .eq('meeting_id', meetingId)
        .order('slot_number', { ascending: true });
      if (afterErr) console.warn('visiting guests after save', afterErr);
      const afterBySlot = new Map<number, { id: string; display_name: string }>();
      for (const r of dbAfter || []) {
        const row = r as { id: string; slot_number: number; display_name: string | null };
        afterBySlot.set(row.slot_number, { id: row.id, display_name: (row.display_name || '').trim() });
      }

      for (let i = 0; i < VISITING_GUEST_SLOT_COUNT; i++) {
        const slot = i + 1;
        const newRaw = (visitingGuestInputs[i] ?? '').trim();
        const prev = beforeBySlot.get(slot);
        const oldRaw = prev?.display_name?.trim() ?? '';
        if (oldRaw === newRaw || !oldRaw || !newRaw) continue;
        const after = afterBySlot.get(slot);
        const guestId = after?.id ?? prev?.id;
        if (!guestId) continue;
        await propagateMeetingVisitingGuestDisplayRename({
          meetingId,
          oldRawName: oldRaw,
          newRawName: newRaw,
          visitingGuestId: guestId,
        });
      }

      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'timer-report-snapshot' &&
          q.queryKey[1] === meetingId,
      });
      await queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === 'ah-counter-snapshot' &&
          q.queryKey[1] === meetingId,
      });
      await loadData();
      Alert.alert('Saved', 'Visiting Guest roster is stored for this meeting.');
    } catch (e: unknown) {
      console.error('handleSaveVisitingGuests', e);
      Alert.alert(
        'Error',
        'Could not save Visiting Guest roster. Apply the latest database migration (app_meeting_visiting_guests), then try again.'
      );
    } finally {
      setSavingVisitingGuests(false);
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
    timerQualUserOverrideRef.current = false;
    setReportData((prev) => {
      const next = { ...prev, speech_category: category };
      const t = prev.actual_time_seconds;
      if (stopwatchFinalized && t > 0) {
        const sug = suggestTimerQualification(category, t);
        if (sug !== null) next.time_qualification = sug;
      }
      return next;
    });
    setSelectedSpeaker(null);
    setSelectedCategoryRoleId(null);
    setManualNameEntry(false);
    setManualNameText('');
    void refreshCategoryBundleForCategory(category);
  };

  const updateQualification = (qualified: boolean) => {
    if (!canEditTimerCorner) {
      Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can edit Timer Corner.');
      return;
    }
    timerQualUserOverrideRef.current = true;
    setReportData((prev) => ({ ...prev, time_qualification: qualified }));
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

  const getTimerSummarySpeakerSubtitle = (report: TimerReport): string => {
    if (report.visiting_guest_id) {
      return 'Visiting guest';
    }
    const uid = report.speaker_user_id;
    if (uid == null || String(uid).length === 0) {
      return 'Visiting guest';
    }
    const raw = memberClubRoleByUserId[uid];
    return formatClubRelationshipRoleForTimerSummary(raw);
  };

  const ReportCard = ({ report }: { report: TimerReport }) => {
    const isQualified = !!report.time_qualification;
    const displaySpeakerName =
      report.speaker_user_id != null && String(report.speaker_user_id).length > 0
        ? report.speaker_name
        : formatTimerGuestSummaryPrimaryName(report.speaker_name) ||
          formatTimerGuestDisplayName(report.speaker_name);
    return (
      <View style={[styles.reportTableRow, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.reportTableNameCell}>
          <Text style={[styles.reportTableName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {displaySpeakerName}
          </Text>
          <Text style={[styles.reportTableCategory, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {getTimerSummarySpeakerSubtitle(report)}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <Text style={[styles.reportTableTime, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
            {report.actual_time_display}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <View style={[styles.reportTableQualifiedBadge, { backgroundColor: isQualified ? '#e7f7ee' : '#fee2e2' }]}>
            <Text style={[
              styles.reportTableQualified,
              { color: isQualified ? '#15803d' : '#dc2626' }
            ]} maxFontSizeMultiplier={1.3}>
              {isQualified ? 'Yes' : 'No'}
            </Text>
          </View>
        </View>

        <View style={styles.reportTableActions}>
          {canEditTimerCorner && (
            <TouchableOpacity
              style={styles.reportTableActionButton}
              onPress={() => handleDeleteReport(report.id!, displaySpeakerName)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const summaryCategorySections = [
    { key: 'prepared_speaker', title: 'Prepared Speaker', accent: '#2563EB', soft: '#EFF6FF' },
    { key: 'evaluation', title: 'Evaluators', accent: '#059669', soft: '#ECFDF5' },
    { key: 'table_topic_speaker', title: 'Table Topic Speaker', accent: '#EA580C', soft: '#FFF7ED' },
    { key: 'educational_session', title: 'Educational Speaker', accent: '#7C3AED', soft: '#F5F3FF' },
  ] as const;

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

    if (reportData.actual_time_seconds <= 0) {
      Alert.alert('Time required', 'Use Stop to finalize time (not 00:00), then save.');
      return;
    }
    if (reportData.time_qualification === null) {
      Alert.alert('Qualification required', 'Select Yes or No under Qualified.');
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
          .order('updated_at', { ascending: false })
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing report:', checkError);
          Alert.alert('Error', 'Failed to check existing report');
          return;
        }
        existingReport = existingData;
      }

      const visitingGuestIdForSave =
        effectiveUserId == null
          ? meetingVisitingGuests.find(
              (g) =>
                normalizeTimerGuestSpeakerKey(g.display_name) ===
                normalizeTimerGuestSpeakerKey(effectiveName)
            )?.id ?? null
          : null;

      const saveData = {
        ...reportData,
        meeting_id: meetingId,
        club_id: user.currentClubId,
        speaker_name: effectiveName,
        speaker_user_id: effectiveUserId,
        visiting_guest_id: visitingGuestIdForSave,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_qualification: reportData.time_qualification === true,
        summary_visible_to_members: timerSummaryVisibleToMembers,
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
      setStopwatchFinalized(false);
      setStopwatchTime(0);
      lastStopwatchTickWallRef.current = Date.now();
      timerQualUserOverrideRef.current = false;
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
    setSpeakerSearchQuery('');
    setShowSpeakerModal(true);
    void loadClubMembers();
  };

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  /** Same 7-action dock as Grammarian Report */
  const renderTimerGeDock = () => {
    if (!meeting?.id) return null;
    const mid = meeting.id;
    return (
      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.footerNavigationContent}
        >
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: mid } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Book the role
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({ pathname: '/book-a-role', params: { meetingId: mid, initialTab: 'my_bookings' } })
            }
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Withdraw role
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: mid } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: mid } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Role completion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({
                pathname: '/timer-notes',
                params: { meetingId: mid, clubId: user?.currentClubId ?? '' },
              })
            }
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              prep space
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: mid } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              AGENDA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: mid } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              VOTING
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
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
      }}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => {
          setShowSpeakerModal(false);
          setSpeakerSearchQuery('');
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
              {assigningTimerRole ? 'Assign Timer' : 'Select Speaker'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowSpeakerModal(false);
                setSpeakerSearchQuery('');
                setAssigningTimerRole(false);
              }}
            >
              <X size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

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
                    onPress={() => {
                      if (assigningTimerRole) {
                        void handleAssignTimerToMember(member);
                        return;
                      }
                      setSelectedSpeaker(member);
                      setManualNameEntry(false);
                      setManualNameText('');
                      setShowSpeakerModal(false);
                      setSpeakerSearchQuery('');
                    }}
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={{ flex: 1 }}>
            <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.mainBody}>
              <ScrollView
                style={styles.scrollMain}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.contentContainer, { paddingBottom: 8 }]}
              >
                <View style={styles.contentTop}>
                  <View
                    style={[
                      styles.noAssignmentNotionCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                    ]}
                  >
                    <View style={styles.meetingCardContent}>
                      <View style={[styles.dateBox, { backgroundColor: theme.colors.primary + '15' }]}>
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
                          Mode:{' '}
                          {meeting.meeting_mode === 'in_person'
                            ? 'In Person'
                            : meeting.meeting_mode === 'online'
                              ? 'Online'
                              : 'Hybrid'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />

                    <View style={[styles.noAssignmentState, styles.noAssignmentStateInCard]}>
                      <Timer size={64} color={theme.colors.textSecondary} />
                      <Text style={[styles.noAssignmentSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Every great meeting needs a time hero! Take charge — book the Timer role.
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
                      {isVPEClub ? (
                        <TouchableOpacity
                          style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                          onPress={() => openAssignTimerFromNav()}
                          disabled={bookingTimerRole || assigningTimerRole}
                          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                        >
                          <Text
                            style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }}
                            maxFontSizeMultiplier={1.25}
                          >
                            Assign to a member
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <View pointerEvents="none" style={styles.meetingCardDecoration} />
                  </View>
                </View>
              </ScrollView>
              {renderTimerGeDock()}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const selectedCategoryMeta = speechCategories.find((c) => c.value === reportData.speech_category);
  const isRoleSlotFilled = (role: CategoryRole) => isTimerCategoryRoleSlotFilled(role);
  const categoryOpenRolesCount = categoryRoles.filter((role) => !isRoleSlotFilled(role)).length;
  const hasTimerSpeaker =
    !!selectedSpeaker || (!!manualNameEntry && !!manualNameText.trim());

  const loggerRoleTitle =
    (selectedCategoryRoleId
      ? categoryRoles.find((r) => r.id === selectedCategoryRoleId)?.role_name
      : null) ??
    selectedCategoryMeta?.label ??
    'Speech';
  const loggerSpeakerDisplayName =
    selectedSpeaker?.full_name?.trim() ||
    (manualNameEntry && manualNameText.trim()) ||
    '—';

  const DIAL_PX = 228;

  const renderTimeLoggerCard = () => {
    void ringFrame;
    const dialElapsedSec = stopwatchFinalized
      ? reportData.actual_time_seconds
      : Math.floor(stopwatchTime / 1000);
    const centerTimeText = formatTime(dialElapsedSec);
    const visualElapsedMs = stopwatchFinalized
      ? reportData.actual_time_seconds * 1000
      : stopwatchRunning
        ? stopwatchTime + Math.min(1000, Date.now() - lastStopwatchTickWallRef.current)
        : stopwatchTime;
    const startDisabled = !canEditTimerCorner || stopwatchRunning || stopwatchFinalized;
    const pauseDisabled = !canEditTimerCorner || !stopwatchRunning || stopwatchFinalized;
    const stopDisabled =
      !canEditTimerCorner ||
      stopwatchFinalized ||
      (Math.floor(stopwatchTime / 1000) === 0 && !stopwatchRunning);
    const resetDisabled = !canEditTimerCorner;
    const notionIcon = (disabled: boolean) => (disabled ? NOTION_TIMER.textSecondary : NOTION_TIMER.accent);
    const saveEnabled =
      hasTimerSpeaker && reportData.actual_time_seconds > 0 && reportData.time_qualification !== null;

    return (
      <View style={styles.logTimeCardOuter}>
        <View
          style={[
            styles.logTimeCard,
            { backgroundColor: NOTION_TIMER.card, borderColor: NOTION_TIMER.border },
          ]}
        >
        {/* Speaker header (read-only, Notion-style) */}
        <View
          style={[
            styles.timerLoggerSpeakerCard,
            { backgroundColor: NOTION_TIMER.card, borderColor: NOTION_TIMER.border },
          ]}
        >
          <View style={styles.timerLoggerSpeakerRow}>
            {selectedSpeaker?.avatar_url ? (
              <Image
                source={{ uri: selectedSpeaker.avatar_url }}
                style={[styles.timerLoggerSpeakerAvatar, { borderColor: NOTION_TIMER.border }]}
              />
            ) : (
              <View
                style={[
                  styles.timerLoggerSpeakerAvatar,
                  styles.timerLoggerSpeakerAvatarPlaceholder,
                  { borderColor: NOTION_TIMER.border, backgroundColor: NOTION_TIMER.pageBg },
                ]}
              >
                <User size={22} color={NOTION_TIMER.textSecondary} />
              </View>
            )}
            <View style={styles.timerLoggerSpeakerTextCol}>
              <Text
                style={[styles.timerLoggerRoleLine, { color: NOTION_TIMER.textSecondary, fontWeight: '400' }]}
                maxFontSizeMultiplier={1.2}
              >
                Role: {loggerRoleTitle}
              </Text>
              <Text
                style={[styles.timerLoggerNameLine, { color: NOTION_TIMER.text, fontWeight: '600' }]}
                maxFontSizeMultiplier={1.25}
              >
                {loggerSpeakerDisplayName}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.timeLoggerSectionLabel, { color: NOTION_TIMER.textSecondary }]} maxFontSizeMultiplier={1.2}>
          Time Logger
        </Text>

        <View style={styles.timerDialWrap}>
          <TimerDialStopwatch size={DIAL_PX} elapsedMs={visualElapsedMs} />
          <View style={styles.timerDialCenterOverlay} pointerEvents="none">
            <Text style={[styles.timerDialCenterTime, { color: NOTION_TIMER.text }]} maxFontSizeMultiplier={1.2}>
              {centerTimeText}
            </Text>
          </View>
        </View>

        <View style={styles.timerNotionControlsRow}>
          <TouchableOpacity
            style={[
              styles.timerNotionIconBtn,
              {
                borderColor: NOTION_TIMER.border,
                backgroundColor: NOTION_TIMER.card,
                opacity: startDisabled ? 0.38 : 1,
              },
            ]}
            onPress={startStopwatch}
            disabled={startDisabled}
            activeOpacity={0.65}
            accessibilityLabel="Start timer"
          >
            <Play size={22} color={notionIcon(startDisabled)} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timerNotionIconBtn,
              {
                borderColor: NOTION_TIMER.border,
                backgroundColor: NOTION_TIMER.card,
                opacity: pauseDisabled ? 0.38 : 1,
              },
            ]}
            onPress={pauseStopwatch}
            disabled={pauseDisabled}
            activeOpacity={0.65}
            accessibilityLabel="Pause timer"
          >
            <Pause size={22} color={notionIcon(pauseDisabled)} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timerNotionIconBtn,
              {
                borderColor: NOTION_TIMER.border,
                backgroundColor: NOTION_TIMER.card,
                opacity: stopDisabled ? 0.38 : 1,
              },
            ]}
            onPress={finalizeStopwatch}
            disabled={stopDisabled}
            activeOpacity={0.65}
            accessibilityLabel="Stop and finalize time"
          >
            <Square size={20} color={notionIcon(stopDisabled)} fill={notionIcon(stopDisabled)} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timerNotionIconBtn,
              {
                borderColor: NOTION_TIMER.border,
                backgroundColor: NOTION_TIMER.card,
                opacity: resetDisabled ? 0.38 : 1,
              },
            ]}
            onPress={resetStopwatch}
            disabled={resetDisabled}
            activeOpacity={0.65}
            accessibilityLabel="Reset timer"
          >
            <RotateCcw size={22} color={notionIcon(resetDisabled)} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.timerFieldLabel, { color: NOTION_TIMER.textSecondary, fontWeight: '500' }]} maxFontSizeMultiplier={1.2}>
          Time (MM:SS){stopwatchFinalized ? '' : ' — tap Stop to edit'}
        </Text>
        <TextInput
          style={[
            styles.timerMmSsInput,
            {
              backgroundColor: NOTION_TIMER.card,
              borderColor: NOTION_TIMER.border,
              color: NOTION_TIMER.text,
              opacity: stopwatchFinalized && canEditTimerCorner ? 1 : 0.5,
            },
          ]}
          value={reportData.actual_time_display}
          editable={stopwatchFinalized && !!canEditTimerCorner}
          onChangeText={(t) => {
            if (!stopwatchFinalized || !canEditTimerCorner) return;
            const cleaned = t.replace(/[^\d:]/g, '').slice(0, 5);
            setReportData((prev) => ({ ...prev, actual_time_display: cleaned }));
          }}
          onBlur={() => {
            if (!stopwatchFinalized) return;
            const sec = parseMmSs(reportData.actual_time_display);
            if (sec === null) {
              Alert.alert('Invalid time', 'Use MM:SS with seconds 00–59 (e.g. 05:30).');
              setReportData((prev) => ({
                ...prev,
                actual_time_display: formatTime(prev.actual_time_seconds),
              }));
              return;
            }
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            setMinutes(m);
            setSeconds(s);
            setStopwatchTime(sec * 1000);
            setReportData((prev) => {
              const next = {
                ...prev,
                actual_time_seconds: sec,
                actual_time_display: formatTime(sec),
              };
              if (!timerQualUserOverrideRef.current) {
                const sug = suggestTimerQualification(prev.speech_category, sec);
                if (sug !== null) next.time_qualification = sug;
              }
              return next;
            });
          }}
          placeholder="00:00"
          placeholderTextColor={NOTION_TIMER.textSecondary}
          keyboardType="numbers-and-punctuation"
          maxFontSizeMultiplier={1.3}
        />

        <Text
          style={[styles.timerFieldLabel, { color: NOTION_TIMER.text, marginTop: 14, fontWeight: '600' }]}
          maxFontSizeMultiplier={1.2}
        >
          Qualified
        </Text>
        <View
          style={[styles.qualSegmented, { backgroundColor: NOTION_TIMER.card, borderColor: NOTION_TIMER.border }]}
        >
          <TouchableOpacity
            style={[
              styles.qualSegment,
              reportData.time_qualification === true && {
                backgroundColor: NOTION_TIMER.accent,
              },
            ]}
            onPress={() => {
              if (!hasTimerSpeaker) {
                setShowNameRequiredModal(true);
                return;
              }
              updateQualification(true);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.qualSegmentText,
                {
                  color: reportData.time_qualification === true ? NOTION_TIMER.card : NOTION_TIMER.text,
                  fontWeight: '500',
                },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              Yes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.qualSegment,
              reportData.time_qualification === false && {
                backgroundColor: NOTION_TIMER.accent,
              },
            ]}
            onPress={() => {
              if (!hasTimerSpeaker) {
                setShowNameRequiredModal(true);
                return;
              }
              updateQualification(false);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.qualSegmentText,
                {
                  color: reportData.time_qualification === false ? NOTION_TIMER.card : NOTION_TIMER.text,
                  fontWeight: '500',
                },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              No
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButtonFull,
            {
              backgroundColor: saveEnabled ? NOTION_TIMER.accent : NOTION_TIMER.border,
            },
          ]}
          onPress={() => {
            if (!canEditTimerCorner) {
              Alert.alert('Read Only', 'Only the assigned Timer or the club VPE can save timer reports.');
              return;
            }
            if (!hasTimerSpeaker) {
              Alert.alert('Speaker Required', 'Please select a speaker');
              return;
            }
            if (!reportData.speech_category) {
              Alert.alert('Error', 'Please select a speech category');
              return;
            }
            if (reportData.actual_time_seconds <= 0) {
              Alert.alert('Time required', 'Use Stop to finalize time (not 00:00), then save.');
              return;
            }
            if (reportData.time_qualification === null) {
              Alert.alert('Qualification required', 'Select Yes or No under Qualified.');
              return;
            }
            setShowConfirmModal(true);
          }}
          disabled={isSaving}
        >
          <Text
            style={[
              styles.saveButtonFullText,
              { color: saveEnabled ? NOTION_TIMER.card : NOTION_TIMER.textSecondary },
            ]}
            maxFontSizeMultiplier={1.3}
          >
            Save
          </Text>
        </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={{ flex: 1 }}>
      {/* Header — match Grammarian Report */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, { paddingBottom: 8 }]}
      >
        <View style={styles.contentTop}>
        {/* Flat profile header — same pattern as Grammarian Report */}
        {assignedTimer && (
          <View
            style={[
              styles.consolidatedCornerCard,
              {
                backgroundColor: theme.colors.background,
                borderBottomColor: theme.colors.border,
                marginHorizontal: 16,
                marginTop: 8,
              },
            ]}
          >
            <View style={styles.consolidatedClubBadge}>
              <Text
                style={[
                  styles.consolidatedClubTitle,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {clubName || meeting.meeting_title}
              </Text>
            </View>

            <View style={styles.consolidatedProfileStack}>
              <View
                style={[
                  styles.consolidatedAvatarWrap,
                  {
                    borderColor: theme.mode === 'dark' ? theme.colors.border : '#E8E8E8',
                    backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#F4F4F5',
                  },
                ]}
              >
                {timerHeaderAvatarUrl ? (
                  <Image
                    source={{ uri: timerHeaderAvatarUrl }}
                    style={styles.consolidatedAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Timer size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {assignedTimer.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                Timer
              </Text>
            </View>

            <View style={[styles.consolidatedBottomDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.consolidatedMeetingMetaBlock}>
              <Text
                style={[
                  styles.consolidatedMeetingMetaSingle,
                  { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                {formatTimerConsolidatedMeetingMeta(meeting)}
              </Text>
            </View>
          </View>
        )}

        {/* Tabs — underline style like Grammarian */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {canEditTimerCorner && (
            <TouchableOpacity
              style={[
                styles.timerTabUnderline,
                effectiveTab === 'record' && styles.activeTab,
                effectiveTab === 'record' && { borderBottomColor: theme.colors.primary },
              ]}
              onPress={() => {
                setSelectedTab('record');
                resetForm();
              }}
            >
              <Text
                style={[
                  styles.timerTabText,
                  { color: theme.colors.textSecondary },
                  effectiveTab === 'record' && styles.activeTabText,
                  effectiveTab === 'record' && { color: theme.colors.primary },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Timer Corner
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.timerTabUnderline,
              effectiveTab === 'reports' && styles.activeTab,
              effectiveTab === 'reports' && { borderBottomColor: theme.colors.primary },
            ]}
            onPress={() => setSelectedTab('reports')}
          >
            <Text
              style={[
                styles.timerTabText,
                { color: theme.colors.textSecondary },
                effectiveTab === 'reports' && styles.activeTabText,
                effectiveTab === 'reports' && { color: theme.colors.primary },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              Timer Summary
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabContentWrapper}>
        {/* Tab Content */}
        {effectiveTab === 'record' ? (
          <>
            {canEditTimerCorner && (
              <View style={[styles.summaryVisibilityCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.summaryVisibilityLeft}>
                  {timerSummaryVisibleToMembers ? (
                    <Eye size={18} color={theme.colors.primary} />
                  ) : (
                    <EyeOff size={18} color={theme.colors.textSecondary} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryVisibilityTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      Show Timer report to Member
                    </Text>
                    <Text style={[styles.summaryVisibilityHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                      {timerSummaryVisibleToMembers
                        ? 'Members can see Timer Summary on screen.'
                        : 'Hidden from members. Only Timer and VPE can view it.'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.summaryVisibilityButton,
                    {
                      backgroundColor: timerSummaryVisibleToMembers ? '#2563eb' : theme.colors.background,
                      borderColor: timerSummaryVisibleToMembers ? '#2563eb' : theme.colors.border,
                    },
                  ]}
                  onPress={() => handleTimerSummaryVisibilityChange(!timerSummaryVisibleToMembers)}
                >
                  {timerSummaryVisibleToMembers ? (
                    <Eye size={16} color="#ffffff" />
                  ) : (
                    <EyeOff size={16} color={theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {canEditTimerCorner && (
              <View style={[styles.visitingGuestsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={styles.visitingGuestsHeaderRow}>
                  <View style={styles.summaryVisibilityLeft}>
                    <Users size={18} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryVisibilityTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                        Visiting Guest Management
                      </Text>
                      {!visitingGuestsExpanded ? (
                        <Text
                          style={[styles.summaryVisibilityHint, { color: theme.colors.textSecondary, lineHeight: 15 }]}
                          maxFontSizeMultiplier={1.1}
                        >
                          Tap the arrow to add or edit Visiting Guests (up to 5). Visiting guests are not registered in the app.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.summaryVisibilityButton,
                      {
                        backgroundColor: visitingGuestsExpanded ? '#2563eb' : theme.colors.background,
                        borderColor: visitingGuestsExpanded ? '#2563eb' : theme.colors.border,
                      },
                    ]}
                    onPress={() => setVisitingGuestsExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      visitingGuestsExpanded ? 'Close Visiting Guest Management' : 'Open Visiting Guest Management'
                    }
                  >
                    {visitingGuestsExpanded ? (
                      <ChevronUp size={16} color="#ffffff" />
                    ) : (
                      <ChevronDown size={16} color={theme.colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
                {visitingGuestsExpanded ? (
                  <>
                    {Array.from({ length: VISITING_GUEST_SLOT_COUNT }, (_, i) => (
                      <View key={i} style={[styles.visitingGuestRow, i === 0 && styles.visitingGuestRowFirst]}>
                        <Text style={[styles.visitingGuestLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                          {`Visiting Guest ${i + 1}`}
                        </Text>
                        <TextInput
                          style={[styles.visitingGuestInput, { borderColor: theme.colors.border, color: theme.colors.text }]}
                          placeholder={`Name (e.g. Subha)`}
                          placeholderTextColor={theme.colors.textSecondary}
                          value={visitingGuestInputs[i] ?? ''}
                          onChangeText={(t) =>
                            setVisitingGuestInputs((prev) => {
                              const next = [...prev];
                              next[i] = t;
                              return next;
                            })
                          }
                          editable={!savingVisitingGuests}
                          maxFontSizeMultiplier={1.2}
                        />
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.visitingGuestsSaveBtn, { backgroundColor: '#2563eb', opacity: savingVisitingGuests ? 0.6 : 1 }]}
                      onPress={() => void handleSaveVisitingGuests()}
                      disabled={savingVisitingGuests}
                    >
                      {savingVisitingGuests ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.visitingGuestsSaveBtnText} maxFontSizeMultiplier={1.2}>
                          Save Visiting Guest roster
                        </Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {/* Category grid 2×2 (Notion-style tiles) */}
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
                      <Text
                        style={[
                          styles.categoryPillItemText,
                          { color: isSelected ? '#ffffff' : theme.colors.text },
                        ]}
                        maxFontSizeMultiplier={1.3}
                        numberOfLines={2}
                      >
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
                    const guestRawName = parseTimerGuestCompletionNotes(role.completion_notes);
                    const guestDisplayName = guestRawName ? formatTimerGuestDisplayName(guestRawName) : null;
                    const hasMember =
                      !!role.assigned_user_id && role.booking_status === 'booked' && !!assignedProfile;
                    const hasGuest =
                      role.booking_status === 'booked' && !!guestRawName && !role.assigned_user_id;
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
                              <View
                                style={[
                                  styles.roleSummaryQualBadge,
                                  { backgroundColor: roleSummary.qualified ? '#dcfce7' : '#fee2e2' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.roleSummaryQualText,
                                    { color: roleSummary.qualified ? '#16a34a' : '#dc2626' },
                                  ]}
                                  maxFontSizeMultiplier={1.2}
                                  numberOfLines={1}
                                >
                                  {roleSummary.qualified ? 'Qualified : Yes' : 'Qualified : No'}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>

                        {isSlotFilled ? (
                          <View style={styles.preparedRoleRightActions}>
                            {canEditTimerCorner &&
                              canTimerCornerManageAssignment(role, canEditTimerCorner) && (
                                <TouchableOpacity
                                  style={[
                                    styles.preparedRoleOpenCloseBtn,
                                    {
                                      borderColor: theme.colors.primary,
                                      backgroundColor: theme.colors.surface,
                                      minWidth: 0,
                                      paddingHorizontal: 10,
                                    },
                                  ]}
                                  onPress={() => openTimerCategoryRoleAssign(role)}
                                  activeOpacity={0.85}
                                  accessibilityRole="button"
                                  accessibilityLabel="Reassign speaker for this role"
                                >
                                  <Text
                                    style={[
                                      styles.preparedRoleOpenCloseBtnText,
                                      { color: theme.colors.primary },
                                    ]}
                                    maxFontSizeMultiplier={1.2}
                                  >
                                    Reassign
                                  </Text>
                                </TouchableOpacity>
                              )}
                            <TouchableOpacity
                              style={[
                                styles.preparedRoleOpenCloseBtn,
                                {
                                  borderColor: isExpanded ? theme.colors.border : theme.colors.primary,
                                  backgroundColor: theme.colors.surface,
                                },
                              ]}
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
                                  lastStopwatchTickWallRef.current = Date.now();
                                  timerQualUserOverrideRef.current = false;
                                  setStopwatchRunning(false);
                                  setStopwatchFinalized(false);
                                }
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={isExpanded ? 'Close timer logger' : 'Open timer logger'}
                            >
                              <Text
                                style={[
                                  styles.preparedRoleOpenCloseBtnText,
                                  { color: isExpanded ? theme.colors.textSecondary : theme.colors.primary },
                                ]}
                                maxFontSizeMultiplier={1.2}
                              >
                                {isExpanded ? 'Close' : 'Open'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.preparedRoleAssignBtn, { backgroundColor: '#2563eb' }]}
                            onPress={() => {
                              if (!canEditTimerCorner || !meetingId) return;
                              router.push({
                                pathname: '/timer-role-assign',
                                params: {
                                  meetingId,
                                  roleId: role.id,
                                  speechCategory: reportData.speech_category,
                                },
                              });
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

            {categoryRoles.length === 0 && (
              <View
                style={[
                  styles.timerNoRolesCard,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                ]}
              >
                <Info size={22} color={theme.colors.textSecondary} />
                <Text style={[styles.timerNoRolesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {reportData.speech_category === 'educational_session'
                    ? 'No educational speaker'
                    : `No ${selectedCategoryMeta?.label ?? 'category'} roles available`}
                </Text>
                <Text style={[styles.timerNoRolesSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                  Only roles marked available in Manage Meeting Roles appear here. ExComm can restore or add roles there.
                </Text>
              </View>
            )}

          </>
        ) : (
          /* Summary Tab */
          <View style={styles.reportsTabContent}>
            <View style={[styles.reportsSection, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              {!timerSummaryVisibleToMembers ? (
                <View style={[styles.summaryHiddenCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.summaryHiddenTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    Timer is yet to publish the report.
                  </Text>
                </View>
              ) : savedReports.length === 0 ? (
                <View style={[styles.summaryHiddenCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                  <Clock size={20} color={theme.colors.textSecondary} />
                  <Text style={[styles.summaryHiddenTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    No timer reports yet
                  </Text>
                  <Text style={[styles.summaryHiddenSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                    Timer reports will appear here once time entries are saved.
                  </Text>
                </View>
              ) : (
                <>
                  {summaryCategorySections.map((section) => {
                    const sectionReports = pickLatestTimerReportPerSpeaker(
                      savedReports.filter((r) => r.speech_category === section.key)
                    );
                    if (sectionReports.length === 0) return null;
                    return (
                      <View
                        key={section.key}
                        style={[
                          styles.summaryCategorySection,
                          { borderColor: theme.colors.border, borderLeftColor: section.accent, backgroundColor: section.soft },
                        ]}
                      >
                        <View style={styles.summaryCategoryTitleRow}>
                          <View style={[styles.summaryCategoryDot, { backgroundColor: section.accent }]} />
                          <Text style={[styles.summaryCategoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                            {section.title}
                          </Text>
                        </View>
                        <View style={[styles.reportTableHeader, { borderBottomColor: theme.colors.border }]}>
                          <Text style={[styles.reportTableHeaderText, { color: theme.colors.text, flex: 1.6 }]} maxFontSizeMultiplier={1.2}>
                            Speaker
                          </Text>
                          <Text style={[styles.reportTableHeaderText, { color: theme.colors.text, flex: 0.9, textAlign: 'center' }]} maxFontSizeMultiplier={1.2}>
                            Time
                          </Text>
                          <Text style={[styles.reportTableHeaderText, { color: theme.colors.text, flex: 0.9, textAlign: 'center' }]} maxFontSizeMultiplier={1.2}>
                            Qualified
                          </Text>
                          <View style={{ flex: 0.4 }} />
                        </View>
                        <View>
                          {sectionReports.map((report) => (
                            <ReportCard key={report.id || `${report.speaker_name}-${report.recorded_at}`} report={report} />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          </View>
        )}
        </View>
        </View>
      </ScrollView>
      {renderTimerGeDock()}
      </View>

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
  modalUnassignButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalUnassignButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
  mainBody: {
    flex: 1,
    minHeight: 0,
  },
  scrollMain: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  contentTop: {},
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingBottom: 12,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  consolidatedCornerCard: {
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 720,
    overflow: 'visible',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  consolidatedClubBadge: {
    marginTop: 0,
    marginBottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  consolidatedClubTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  consolidatedProfileStack: {
    alignItems: 'center',
    width: '100%',
  },
  consolidatedAvatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  consolidatedAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 0,
  },
  consolidatedPersonName: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  consolidatedPersonRole: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
  consolidatedBottomDivider: {
    width: '100%',
    maxWidth: 280,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 18,
    marginBottom: 16,
  },
  consolidatedMeetingMetaBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  consolidatedMeetingMetaSingle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: 16,
    borderBottomWidth: 1,
  },
  timerTabUnderline: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  timerTabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  tabContentWrapper: {
    flex: 1,
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
  summaryVisibilityCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryVisibilityLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryVisibilityTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryVisibilityHint: {
    fontSize: 11,
    marginTop: 3,
  },
  summaryVisibilityButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  visitingGuestsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  visitingGuestsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  visitingGuestRow: {
    marginBottom: 8,
  },
  visitingGuestRowFirst: {
    marginTop: 4,
  },
  visitingGuestLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  visitingGuestInput: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  visitingGuestsSaveBtn: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  visitingGuestsSaveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  reportsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  summaryHiddenCard: {
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  summaryHiddenTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryHiddenSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  timerNoRolesCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 0,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  timerNoRolesTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  timerNoRolesSub: {
    fontSize: 12,
    textAlign: 'center',
  },
  summaryCategorySection: {
    marginTop: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  summaryCategoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryCategoryDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  summaryCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  reportTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    marginBottom: 2,
    gap: 8,
  },
  reportTableHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  reportsList: {
    gap: 6,
  },
  reportTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
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
    fontSize: 13,
    fontWeight: '600',
  },
  reportTableCategory: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
  },
  reportTableTime: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  reportTableQualifiedBadge: {
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  reportTableQualified: {
    fontSize: 12,
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
    borderRadius: 0,
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
    borderRadius: 0,
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
    borderRadius: 0,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    columnGap: 10,
    rowGap: 10,
    justifyContent: 'space-between',
  },
  categoryPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: 1,
    width: '47%',
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryPillItemText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  preparedRolesCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 0,
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
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preparedRoleTextWrap: {
    flex: 1,
    minWidth: 0,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  roleSummaryTime: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleSummaryQualBadge: {
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: '72%',
    flexShrink: 1,
  },
  roleSummaryQualText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  preparedRoleAssignBtn: {
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  preparedRoleAssignBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  preparedRoleOpenCloseBtn: {
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparedRoleOpenCloseBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  preparedRoleRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '52%',
  },
  preparedRoleSecondaryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  preparedRoleSecondaryBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logTimeCardOuter: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    backgroundColor: NOTION_TIMER.pageBg,
  },
  logTimeCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  timeLoggerSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
    marginBottom: -4,
  },
  timerNotionControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  timerNotionIconBtn: {
    flex: 1,
    minHeight: 48,
    maxHeight: 52,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLoggerSpeakerCard: {
    borderRadius: 0,
    borderWidth: 1,
    padding: 12,
  },
  timerLoggerSpeakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerLoggerSpeakerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 0,
    borderWidth: 1,
  },
  timerLoggerSpeakerAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLoggerSpeakerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timerLoggerRoleLine: {
    fontSize: 12,
    fontWeight: '600',
  },
  timerLoggerNameLine: {
    fontSize: 17,
    fontWeight: '700',
  },
  timerDialWrap: {
    alignSelf: 'center',
    marginVertical: 8,
    position: 'relative',
  },
  timerDialCenterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDialCenterTime: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dialLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  dialLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dialLegendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 0,
  },
  dialLegendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timerDialControlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  timerDialCtl: {
    flexGrow: 1,
    minWidth: '22%',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDialCtlText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  timerFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  timerMmSsInput: {
    borderWidth: 1,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  qualSegmented: {
    flexDirection: 'row',
    borderRadius: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qualSegment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualSegmentText: {
    fontSize: 15,
    fontWeight: '700',
  },
  timeLoggerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  timeBoxFull: {
    borderWidth: 1,
    borderRadius: 0,
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
  saveButtonFull: {
    paddingVertical: 14,
    borderRadius: 0,
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
  visitingGuestPickHint: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 10,
    marginTop: -4,
  },
  visitingGuestPickList: {
    maxHeight: 220,
    marginBottom: 4,
  },
  visitingGuestPickRowDisabled: {
    opacity: 0.5,
  },
  visitingGuestPickSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
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
    borderRadius: 0,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  timerReviewIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 0,
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
});
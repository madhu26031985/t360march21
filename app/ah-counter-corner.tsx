import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ahCounterQueryKeys, fetchAhCounterSnapshot } from '@/lib/ahCounterSnapshot';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import {
  type MeetingVisitingGuest,
  VISITING_GUEST_SLOT_COUNT,
  parseMeetingVisitingGuests,
  visitingGuestInputsFromRows,
} from '@/lib/meetingVisitingGuests';
import { propagateMeetingVisitingGuestDisplayRename } from '@/lib/syncVisitingGuestRosterNames';
import {
  bookOpenMeetingRole,
  fetchOpenMeetingRoleId,
  fetchBookedMeetingRoleId,
  bookMeetingRoleForCurrentUser,
  reassignBookedMeetingRole,
  type BookMeetingRoleResult,
} from '@/lib/bookMeetingRoleInline';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, User, FileText, ChartBar, Play, ClipboardList, Users, BookOpen, Star, Mic, CheckSquare, FileBarChart, MessageSquare, Crown, Settings, UserCog, LayoutDashboard, Vote, X, UserCheck, NotebookPen, ClipboardCheck, Trash2, Plus, Search, RotateCcw, UserPlus, Eye, EyeOff, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
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

type TabType = 'corner' | 'summary';

function isAhCounterVisibilityTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || msg.includes('ah_counter_corner_visibility') || msg.includes('does not exist');
}

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
  /** When count is stored in ah_counter_reports.custom_filler_counts */
  customSlug?: string;
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

const AH_COUNTER_INTEGER_COUNT_COLUMNS = Object.values(FILLER_WORD_TO_COLUMN);

function fillerWordSlug(word: string): string {
  return word.trim().toLowerCase();
}

function displayWordForSlug(slug: string, clubCustomWords: string[]): string {
  const fromClub = clubCustomWords.find((w) => fillerWordSlug(w) === slug);
  if (fromClub) return fromClub;
  const fromDefault = FILLER_WORDS.find((w) => fillerWordSlug(w) === slug);
  if (fromDefault) return fromDefault;
  return slug.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** Summary breakdown line: "you know - 3 times" / "i mean - 1" */
function formatAhCounterSummaryMemberBreakdownLine(displayLabel: string, count: number): string {
  const phrase = displayLabel.trim().toLowerCase();
  if (count === 1) return `${phrase} - 1`;
  return `${phrase} - ${count} times`;
}

function rowHasAnyFillerCounts(row: Record<string, unknown>): boolean {
  for (const col of AH_COUNTER_INTEGER_COUNT_COLUMNS) {
    const v = row[col];
    if (typeof v === 'number' && v > 0) return true;
  }
  const custom = row.custom_filler_counts;
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    for (const n of Object.values(custom as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0) return true;
    }
  }
  return false;
}

function isAhCounterClubFillerTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || msg.includes('ah_counter_club_custom_filler_words');
}

function formatTimeAhCounterConsolidated(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function ahCounterMeetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** Same meta line pattern as Grammarian assigned header. */
function formatAhCounterConsolidatedMeetingMeta(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeAhCounterConsolidated(m.meeting_start_time)} - ${formatTimeAhCounterConsolidated(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeAhCounterConsolidated(m.meeting_start_time));
  }
  parts.push(ahCounterMeetingModeLabel(m));
  return parts.join(' | ');
}

/** Bottom dock icon size — matches `grammarian.tsx` Grammarian Report footer. */
const FOOTER_NAV_ICON_SIZE = 15;

const VISITING_GUEST_CHIP_PREFIX = 'visg:';

function normalizeGuestNameKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

type AhCounterMemberChip = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  /** From `app_meeting_visiting_guests` — same roster as Timer Corner */
  isVisitingRoster?: boolean;
};

export default function AhCounterCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignedAhCounter, setAssignedAhCounter] = useState<AssignedAhCounter | null>(null);
  // Don't block navigation on Slow 4G — render the page immediately and hydrate data in the background.
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('corner');
  const [ahCounterSummaryVisibleToMembers, setAhCounterSummaryVisibleToMembers] = useState(true);
  /** When false, members should not see report rows until visibility is loaded from DB. */
  const [ahCounterVisibilityFetched, setAhCounterVisibilityFetched] = useState(false);
  const hasLoadedOnce = useRef<boolean>(false);
  const hasFocusedOnceRef = useRef<boolean>(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const [reportStats, setReportStats] = useState({ totalSpeakers: 0, completedReports: 0, selectedMembers: 0 });
  const [isExComm, setIsExComm] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [clubName, setClubName] = useState('');
  const isAssignedAhCounter = !!(assignedAhCounter && user?.id && assignedAhCounter.id === user.id);
  const canEditAhCounterCorner = isAssignedAhCounter || isVPEClub;
  const effectiveTab: TabType = canEditAhCounterCorner ? activeTab : 'summary';
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
  const [visitingGuestInputs, setVisitingGuestInputs] = useState<string[]>(() =>
    Array.from({ length: VISITING_GUEST_SLOT_COUNT }, () => '')
  );
  const [meetingVisitingGuests, setMeetingVisitingGuests] = useState<MeetingVisitingGuest[]>([]);
  const [savingVisitingGuests, setSavingVisitingGuests] = useState(false);
  const [visitingGuestsExpanded, setVisitingGuestsExpanded] = useState(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [newGuestInput, setNewGuestInput] = useState('');
  const [bookingAhCounterRole, setBookingAhCounterRole] = useState(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);
  const [showAssignAhCounterModal, setShowAssignAhCounterModal] = useState(false);
  const [assignAhCounterSearch, setAssignAhCounterSearch] = useState('');
  const [assigningAhCounterRole, setAssigningAhCounterRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  /** Snapshot RPC may omit or strip avatar_url; filled via profile fetch like Timer report. */
  const [fetchedAhCounterAvatarUrl, setFetchedAhCounterAvatarUrl] = useState<string | null>(null);
  const [ahCounterAvatarLoadFailed, setAhCounterAvatarLoadFailed] = useState(false);

  const memberChipsForCorner = useMemo((): AhCounterMemberChip[] => {
    const roster: AhCounterMemberChip[] = meetingVisitingGuests.map((g) => ({
      user_id: `${VISITING_GUEST_CHIP_PREFIX}${g.id}`,
      full_name: g.display_name,
      avatar_url: null,
      isVisitingRoster: true,
    }));
    const rosterNameKeys = new Set(roster.map((r) => normalizeGuestNameKey(r.full_name)));
    const manual: AhCounterMemberChip[] = guestMembers
      .filter((g) => !rosterNameKeys.has(normalizeGuestNameKey(g.full_name)))
      .map((g) => ({
        user_id: g.user_id,
        full_name: g.full_name,
        avatar_url: null,
        isVisitingRoster: false,
      }));
    const audit: AhCounterMemberChip[] = auditMembers.map((a) => ({
      user_id: a.user_id,
      full_name: a.full_name,
      avatar_url: a.avatar_url,
      isVisitingRoster: false,
    }));
    return [...audit, ...roster, ...manual];
  }, [auditMembers, meetingVisitingGuests, guestMembers]);

  const ahCounterSummaryFillerAggregates = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const e of reportEntries) {
      const slug = fillerWordSlug(e.fillerWord);
      const label = displayWordForSlug(slug, customFillerWords);
      const cur = map.get(slug);
      if (cur) cur.count += 1;
      else map.set(slug, { label, count: 1 });
    }
    return [...map.entries()]
      .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [reportEntries, customFillerWords]);

  const ahCounterSummaryTotalInstances = reportEntries.length;
  const ahCounterSummaryDistinctFillers = ahCounterSummaryFillerAggregates.length;

  const ahCounterSummaryMemberRows = useMemo(() => {
    type Agg = { name: string; fillers: Map<string, { label: string; count: number }> };
    const byMember = new Map<string, Agg>();
    for (const e of reportEntries) {
      const key = e.memberId;
      let agg = byMember.get(key);
      if (!agg) {
        agg = { name: e.memberName, fillers: new Map() };
        byMember.set(key, agg);
      }
      const slug = fillerWordSlug(e.fillerWord);
      const label = displayWordForSlug(slug, customFillerWords);
      const cur = agg.fillers.get(slug);
      if (cur) cur.count += 1;
      else agg.fillers.set(slug, { label, count: 1 });
    }
    return [...byMember.entries()]
      .map(([memberKey, agg]) => {
        const byFiller = [...agg.fillers.entries()]
          .map(([slug, v]) => ({ slug, label: v.label, count: v.count }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
        const total = byFiller.reduce((s, x) => s + x.count, 0);
        return { memberKey, memberName: agg.name, total, byFiller };
      })
      .sort((a, b) => b.total - a.total || a.memberName.localeCompare(b.memberName));
  }, [reportEntries, customFillerWords]);

  const [expandedSummaryMemberKey, setExpandedSummaryMemberKey] = useState<string | null>(null);

  const loadVisitingGuestDraftFromDb = useCallback(async () => {
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
  }, [meetingId]);

  useEffect(() => {
    if (meetingId && user?.currentClubId) {
      void loadData();
    } else if (!hasLoadedOnce.current) {
      setIsLoading(false);
    }
  }, [meetingId, user?.currentClubId]);

  useEffect(() => {
    setExpandedSummaryMemberKey(null);
  }, [meetingId]);

  useEffect(() => {
    if (!canEditAhCounterCorner && activeTab === 'corner') {
      setActiveTab('summary');
    }
  }, [canEditAhCounterCorner, activeTab]);

  // Corner: tracked members + live report rows. Summary: report rows only if members are allowed to see them (or user is Ah Counter / VPE).
  useEffect(() => {
    if (!hasLoadedOnce.current || !meetingId || !user?.currentClubId) return;
    if (effectiveTab === 'corner') {
      void loadAuditMembers();
    }
    const privileged = canEditAhCounterCorner;
    const mayLoadForMember = ahCounterVisibilityFetched && ahCounterSummaryVisibleToMembers;
    const shouldLoadReportRows = privileged || mayLoadForMember;
    if (!shouldLoadReportRows) {
      if (!privileged) setReportEntries([]);
      return;
    }
    void loadReportEntries();
  }, [
    effectiveTab,
    meetingId,
    user?.currentClubId,
    assignedAhCounter?.id,
    customFillerWords,
    canEditAhCounterCorner,
    ahCounterSummaryVisibleToMembers,
    ahCounterVisibilityFetched,
  ]);

  // Reload report stats and audit members when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (meetingId && user?.currentClubId && canEditAhCounterCorner) {
        void loadAuditMembers();
        void loadVisitingGuestDraftFromDb();
      }
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      if (meetingId && user?.currentClubId) {
        void loadData();
        void loadAhCounterSummaryVisibility(false);
      }
    }, [meetingId, user?.currentClubId, canEditAhCounterCorner, loadVisitingGuestDraftFromDb])
  );

  const bustAhCounterSnapshotCache = () => {
    if (!meetingId || !user?.currentClubId) return;
    const uid = user?.id ?? '';
    queryClient.removeQueries({
      queryKey: ahCounterQueryKeys.snapshot(meetingId, user.currentClubId, uid || 'anon'),
    });
  };

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
        bustAhCounterSnapshotCache();
        await loadData();
        setBookingSuccessRole('Ah Counter');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } catch (e) {
      console.error('Book Ah Counter:', e);
      Alert.alert('Error', 'Something went wrong while booking. Please try again.');
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

  const resolvedAhCounterAvatarUrl = useMemo(() => {
    if (!assignedAhCounter) return null;
    const fromRole = assignedAhCounter.avatar_url?.trim();
    if (fromRole) return fromRole;
    const aid = String(assignedAhCounter.id);
    if (user?.id != null && String(user.id) === aid) {
      const fromUser = user.avatarUrl?.trim();
      if (fromUser) return fromUser;
    }
    const fromDir = clubMembers.find((m) => String(m.id) === aid)?.avatar_url?.trim();
    return fromDir || null;
  }, [assignedAhCounter, user?.id, user?.avatarUrl, clubMembers]);

  const ahCounterHeaderAvatarUrl = resolvedAhCounterAvatarUrl || fetchedAhCounterAvatarUrl;

  useEffect(() => {
    setAhCounterAvatarLoadFailed(false);
  }, [ahCounterHeaderAvatarUrl]);

  useEffect(() => {
    let cancelled = false;
    const aid = assignedAhCounter?.id;
    if (!aid) {
      setFetchedAhCounterAvatarUrl(null);
      return;
    }
    const idStr = String(aid);
    const quick =
      assignedAhCounter.avatar_url?.trim() ||
      (user?.id != null && String(user.id) === idStr && user.avatarUrl?.trim()) ||
      clubMembers.find((m) => String(m.id) === idStr)?.avatar_url?.trim();
    if (quick) {
      setFetchedAhCounterAvatarUrl(null);
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
      setFetchedAhCounterAvatarUrl(u || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    assignedAhCounter?.id,
    assignedAhCounter?.avatar_url,
    user?.id,
    user?.avatarUrl,
    clubMembers,
  ]);

  useEffect(() => {
    if (!meetingId || !user?.currentClubId || !assignedAhCounter) return;
    if (assignedAhCounter.avatar_url?.trim()) return;
    if (user?.id != null && String(user.id) === String(assignedAhCounter.id) && user.avatarUrl?.trim()) return;
    void loadClubMembers();
  }, [meetingId, user?.currentClubId, user?.id, user?.avatarUrl, assignedAhCounter?.id, assignedAhCounter?.avatar_url]);

  useEffect(() => {
    if (!showAssignAhCounterModal || !user?.currentClubId) return;
    void loadClubMembers();
  }, [showAssignAhCounterModal, user?.currentClubId]);

  const handleAssignAhCounterToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    const reassigning = !!assignedAhCounter;
    setAssigningAhCounterRole(true);
    try {
      let result: BookMeetingRoleResult;
      if (reassigning) {
        const roleId = await fetchBookedMeetingRoleId(meetingId, { ilikeRoleName: '%Ah Counter%' });
        if (!roleId) {
          Alert.alert('Error', 'No booked Ah Counter role was found to reassign.');
          return;
        }
        result = await reassignBookedMeetingRole(member.id, roleId);
      } else {
        const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%Ah Counter%' });
        if (!roleId) {
          Alert.alert('Error', 'No open Ah Counter role was found for this meeting.');
          return;
        }
        result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      }
      if (result.ok) {
        setShowAssignAhCounterModal(false);
        setAssignAhCounterSearch('');
        bustAhCounterSnapshotCache();
        setAssignedAhCounter({
          id: member.id,
          full_name: member.full_name,
          email: member.email,
          avatar_url: member.avatar_url,
        });
        Alert.alert(
          reassigning ? 'Reassigned' : 'Assigned',
          `${member.full_name} is now the Ah Counter for this meeting.`
        );
        void loadData();
      } else {
        Alert.alert(reassigning ? 'Could not reassign' : 'Could not assign', result.message);
      }
    } finally {
      setAssigningAhCounterRole(false);
    }
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

  const loadClubCustomFillerWords = async () => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('ah_counter_club_custom_filler_words')
        .select('word, created_at')
        .eq('club_id', user.currentClubId)
        .order('created_at', { ascending: true });
      if (error) {
        if (isAhCounterClubFillerTableError(error)) {
          console.warn('ah_counter_club_custom_filler_words: apply migration 20260405120000_ah_counter_club_custom_filler_words.sql');
          setCustomFillerWords([]);
          return;
        }
        console.error('Error loading club custom filler words:', error);
        return;
      }
      setCustomFillerWords((data ?? []).map((r: { word: string }) => r.word.trim()).filter(Boolean));
    } catch (e) {
      console.error('Error loading club custom filler words:', e);
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
        setMeetingVisitingGuests(snap.visiting_guests);
        setVisitingGuestInputs(visitingGuestInputsFromRows(snap.visiting_guests));
        void loadClubName();
        void loadClubCustomFillerWords();
        // Heavy lists are loaded on-demand per tab (to keep initial load < 1s).
      } else {
        await Promise.all([
          loadMeeting(),
          loadAssignedAhCounter(),
          loadReportStats(),
          loadUserRole(),
          loadIsVPEClub(),
          loadPublishStatus(),
          loadClubName(),
          loadClubCustomFillerWords(),
          loadVisitingGuestDraftFromDb(),
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
      const clubWords = customFillerWords;
      for (const row of data || []) {
        const r = row as Record<string, unknown>;
        const avatarUrl =
          (r.app_user_profiles as { avatar_url?: string } | null)?.avatar_url ?? null;
        const vgId = r.visiting_guest_id as string | null | undefined;
        const suid = r.speaker_user_id as string | null | undefined;
        const stableMemberId = vgId
          ? `${VISITING_GUEST_CHIP_PREFIX}${vgId}`
          : suid
            ? suid
            : `guest_${r.speaker_name}`;
        for (const [col, word] of Object.entries(COLUMN_TO_FILLER_WORD)) {
          const count = (typeof r[col] === 'number' ? r[col] : 0) as number;
          for (let i = 0; i < count; i++) {
            entries.push({
              id: `${r.id}_${col}_${i}`,
              memberId: stableMemberId,
              memberName: r.speaker_name as string,
              fillerWord: word,
              avatarUrl,
              dbRowId: r.id as string,
              dbColumn: col,
            });
          }
        }
        const customCounts = r.custom_filler_counts as Record<string, unknown> | null | undefined;
        if (customCounts && typeof customCounts === 'object' && !Array.isArray(customCounts)) {
          for (const [slug, raw] of Object.entries(customCounts)) {
            const n = typeof raw === 'number' ? raw : 0;
            for (let i = 0; i < n; i++) {
              entries.push({
                id: `${r.id}_custom_${slug}_${i}`,
                memberId: stableMemberId,
                memberName: r.speaker_name as string,
                fillerWord: displayWordForSlug(slug, clubWords),
                avatarUrl,
                dbRowId: r.id as string,
                customSlug: slug,
              });
            }
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

  const loadAhCounterSummaryVisibility = async (resetFetched = true) => {
    if (!meetingId) {
      setAhCounterVisibilityFetched(true);
      return;
    }
    if (resetFetched) setAhCounterVisibilityFetched(false);
    try {
      const { data, error } = await supabase
        .from('ah_counter_corner_visibility')
        .select('summary_visible_to_members')
        .eq('meeting_id', meetingId)
        .maybeSingle();
      if (error) {
        if (isAhCounterVisibilityTableError(error)) {
          setAhCounterSummaryVisibleToMembers(true);
          return;
        }
        console.error('ah_counter_corner_visibility:', error);
        return;
      }
      setAhCounterSummaryVisibleToMembers(data?.summary_visible_to_members !== false);
    } catch (e) {
      console.error('loadAhCounterSummaryVisibility', e);
    } finally {
      setAhCounterVisibilityFetched(true);
    }
  };

  const handleAhCounterSummaryVisibilityChange = async (visible: boolean) => {
    if (!canEditAhCounterCorner || !meetingId) return;
    setAhCounterSummaryVisibleToMembers(visible);
    try {
      const { error } = await supabase.from('ah_counter_corner_visibility').upsert(
        {
          meeting_id: meetingId,
          summary_visible_to_members: visible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_id' }
      );
      if (error) {
        if (isAhCounterVisibilityTableError(error)) {
          Alert.alert('Migration required', 'Apply the latest Ah Counter database migration, then try again.');
          return;
        }
        console.error('ah_counter_corner_visibility upsert:', error);
        Alert.alert('Error', 'Could not update Ah Counter summary visibility.');
      }
    } catch (e) {
      console.error('handleAhCounterSummaryVisibilityChange', e);
    }
  };

  const handleSaveVisitingGuests = async () => {
    if (!canEditAhCounterCorner || !meetingId || !user?.currentClubId) return;
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
      bustAhCounterSnapshotCache();
      await loadData();
      await loadVisitingGuestDraftFromDb();
      Alert.alert('Saved', 'Visiting Guest roster is stored for this meeting (same list as Timer Corner).');
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

  useEffect(() => {
    if (!meetingId) return;
    void loadAhCounterSummaryVisibility(true);
  }, [meetingId]);

  const addToReport = async () => {
    if (!selectedFillerWord || !selectedMemberId || !meetingId || !user?.currentClubId || !user?.id) return;
    const member = memberChipsForCorner.find((m) => m.user_id === selectedMemberId);
    if (!member) return;
    const visitingGuestId = selectedMemberId.startsWith(VISITING_GUEST_CHIP_PREFIX)
      ? selectedMemberId.slice(VISITING_GUEST_CHIP_PREFIX.length)
      : null;

    setIsSavingEntry(true);
    try {
      const column = FILLER_WORD_TO_COLUMN[selectedFillerWord];
      const isManualGuestChip = selectedMemberId.startsWith('guest_');

      /** PostgREST requires `.select()` before `.eq()` filters — do not chain `.eq()` off `.from()` alone. */
      const existingRowSelect = (columns: string) => {
        let q = supabase
          .from('ah_counter_reports')
          .select(columns)
          .eq('meeting_id', meetingId)
          .eq('club_id', user.currentClubId);
        if (visitingGuestId) {
          return q.eq('visiting_guest_id', visitingGuestId);
        }
        if (isManualGuestChip) {
          return q.is('speaker_user_id', null).eq('speaker_name', member.full_name);
        }
        return q.eq('speaker_user_id', selectedMemberId);
      };

      const speakerInsertFields = () => {
        if (visitingGuestId) {
          return { speaker_user_id: null as string | null, visiting_guest_id: visitingGuestId };
        }
        if (isManualGuestChip) {
          return { speaker_user_id: null as string | null, visiting_guest_id: null as null };
        }
        return { speaker_user_id: selectedMemberId, visiting_guest_id: null as null };
      };

      if (column) {
        const { data: existing } = await existingRowSelect(`id, ${column}`).maybeSingle();

        let rowId: string;
        if (existing) {
          rowId = existing.id;
          const currentCount = (existing as Record<string, number>)[column] || 0;
          const { error: upErr } = await supabase
            .from('ah_counter_reports')
            .update({ [column]: currentCount + 1 })
            .eq('id', rowId);
          if (upErr) throw upErr;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('ah_counter_reports')
            .insert({
              meeting_id: meetingId,
              club_id: user.currentClubId,
              speaker_name: member.full_name,
              recorded_by: user.id,
              ...speakerInsertFields(),
              [column]: 1,
            })
            .select('id')
            .single();
          if (insErr) throw insErr;
          rowId = inserted!.id;
        }

        const newEntry: ReportEntry = {
          id: `${rowId}_${column}_${Date.now()}`,
          memberId: selectedMemberId,
          memberName: member.full_name,
          fillerWord: selectedFillerWord,
          avatarUrl: member.avatar_url,
          dbRowId: rowId,
          dbColumn: column,
        };
        setReportEntries(prev => [newEntry, ...prev]);
      } else {
        const slug = fillerWordSlug(selectedFillerWord);
        const { data: existing } = await existingRowSelect('id, custom_filler_counts').maybeSingle();

        const prevCounts =
          (existing?.custom_filler_counts as Record<string, number> | null) || {};
        const nextCounts = { ...prevCounts, [slug]: (prevCounts[slug] || 0) + 1 };

        let rowId: string;
        if (existing?.id) {
          rowId = existing.id;
          const { error: upErr } = await supabase
            .from('ah_counter_reports')
            .update({ custom_filler_counts: nextCounts })
            .eq('id', rowId);
          if (upErr) throw upErr;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from('ah_counter_reports')
            .insert({
              meeting_id: meetingId,
              club_id: user.currentClubId,
              speaker_name: member.full_name,
              recorded_by: user.id,
              ...speakerInsertFields(),
              custom_filler_counts: { [slug]: 1 },
            })
            .select('id')
            .single();
          if (insErr) throw insErr;
          rowId = inserted!.id;
        }

        const newEntry: ReportEntry = {
          id: `${rowId}_custom_${slug}_${Date.now()}`,
          memberId: selectedMemberId,
          memberName: member.full_name,
          fillerWord: selectedFillerWord,
          avatarUrl: member.avatar_url,
          dbRowId: rowId,
          customSlug: slug,
        };
        setReportEntries(prev => [newEntry, ...prev]);
      }

      setSelectedFillerWord(null);
      setSelectedMemberId(null);
    } catch (error) {
      console.error('Error adding entry:', error);
      Alert.alert('Could not save', 'Check your connection and that the latest database migration is applied.');
    } finally {
      setIsSavingEntry(false);
    }
  };

  const removeEntry = async (entryId: string) => {
    const entry = reportEntries.find(e => e.id === entryId);
    setReportEntries(prev => prev.filter(e => e.id !== entryId));

    if (!entry?.dbRowId) return;
    const selectCols = `${AH_COUNTER_INTEGER_COUNT_COLUMNS.join(', ')}, custom_filler_counts`;

    try {
      if (entry.customSlug) {
        const { data: row, error: fetchErr } = await supabase
          .from('ah_counter_reports')
          .select(selectCols)
          .eq('id', entry.dbRowId)
          .maybeSingle();
        if (fetchErr || !row) return;

        const counts = {
          ...((row as { custom_filler_counts?: Record<string, number> }).custom_filler_counts || {}),
        };
        const cur = typeof counts[entry.customSlug] === 'number' ? counts[entry.customSlug] : 0;
        if (cur <= 1) delete counts[entry.customSlug];
        else counts[entry.customSlug] = cur - 1;

        const merged = { ...(row as Record<string, unknown>), custom_filler_counts: counts };
        if (!rowHasAnyFillerCounts(merged)) {
          await supabase.from('ah_counter_reports').delete().eq('id', entry.dbRowId);
        } else {
          await supabase
            .from('ah_counter_reports')
            .update({ custom_filler_counts: counts })
            .eq('id', entry.dbRowId);
        }
        return;
      }

      if (!entry.dbColumn) return;

      const { data: row, error: fetchErr } = await supabase
        .from('ah_counter_reports')
        .select(selectCols)
        .eq('id', entry.dbRowId)
        .maybeSingle();
      if (fetchErr || !row) return;

      const currentCount = (row as Record<string, number>)[entry.dbColumn] || 0;
      if (currentCount <= 1) {
        const updated = { ...(row as Record<string, unknown>), [entry.dbColumn]: 0 };
        if (!rowHasAnyFillerCounts(updated)) {
          await supabase.from('ah_counter_reports').delete().eq('id', entry.dbRowId);
        } else {
          await supabase
            .from('ah_counter_reports')
            .update({ [entry.dbColumn]: 0 })
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

  const confirmAddCustomWord = async () => {
    const word = newWordInput.trim();
    if (!word || !user?.currentClubId || !user?.id) return;
    const allWords = [...FILLER_WORDS, ...customFillerWords];
    if (allWords.some(w => w.toLowerCase() === word.toLowerCase())) {
      setNewWordInput('');
      setShowAddWordModal(false);
      return;
    }

    const { error } = await supabase.from('ah_counter_club_custom_filler_words').insert({
      club_id: user.currentClubId,
      word,
      created_by: user.id,
    });

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already added', 'That filler word is already in your club list.');
        void loadClubCustomFillerWords();
      } else if (isAhCounterClubFillerTableError(error)) {
        Alert.alert('Migration required', 'Apply the latest Ah Counter migration, then try again.');
      } else {
        console.error('confirmAddCustomWord:', error);
        Alert.alert('Could not save', error.message || 'Try again.');
      }
      return;
    }

    setCustomFillerWords((prev) => [...prev, word]);
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

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const renderAhCounterGeDock = () => {
    if (!meeting) return null;
    return (
      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
            width: windowWidth,
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Book the role
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() =>
              router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id, initialTab: 'my_bookings' } })
            }
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Withdraw role
            </Text>
          </TouchableOpacity>

          {isVPEClub ? (
            <TouchableOpacity
              style={styles.geDockFooterNavItem}
              onPress={() => {
                setShowAssignAhCounterModal(true);
                void loadClubMembers();
              }}
              disabled={bookingAhCounterRole || assigningAhCounterRole}
            >
              <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
                {assignedAhCounter ? (
                  <UserCog size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                ) : (
                  <UserPlus size={FOOTER_NAV_ICON_SIZE} color="#0d9488" />
                )}
              </View>
              <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {assignedAhCounter ? 'Reassign' : 'Assign'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Role completion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() =>
              router.push({
                pathname: '/ah-counter-notes',
                params: { meetingId: meeting.id },
              })
            }
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              prep space
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              AGENDA
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.geDockFooterNavItem}
            onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.geDockFooterNavIcon, footerIconTileStyle]}>
              <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
            </View>
            <Text style={[styles.geDockFooterNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              VOTING
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter Report</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mainBody}>
        <ScrollView
          style={styles.scrollMainUnbooked}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.noBookingContentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
        >
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
            {isVPEClub ? (
              <TouchableOpacity
                style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                onPress={() => {
                  setShowAssignAhCounterModal(true);
                  void loadClubMembers();
                }}
                disabled={bookingAhCounterRole || assigningAhCounterRole}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                  Assign to a member
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
            <View style={styles.meetingCardDecoration} />
          </View>
          </View>
        </ScrollView>
        {renderAhCounterGeDock()}
        </View>
        </View>
        </KeyboardAvoidingView>

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={{ flex: 1 }}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMainUnbooked}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
      >
        <View style={styles.contentTop}>
        {assignedAhCounter && (
          <View
            style={[
              styles.consolidatedCornerCard,
              {
                backgroundColor: theme.colors.background,
                borderBottomColor: theme.colors.border,
                marginTop: 12,
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
                {ahCounterHeaderAvatarUrl && !ahCounterAvatarLoadFailed ? (
                  <Image
                    source={{ uri: ahCounterHeaderAvatarUrl }}
                    style={styles.consolidatedAvatarImage}
                    onError={() => setAhCounterAvatarLoadFailed(true)}
                  />
                ) : (
                  <User size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {assignedAhCounter.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                Ah Counter
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
                {formatAhCounterConsolidatedMeetingMeta(meeting)}
              </Text>
            </View>
          </View>
        )}

        {/* Tabs — Timer-style underline */}
        <View
          style={[
            styles.ahCounterTabRow,
            {
              backgroundColor: theme.colors.surface,
              borderBottomColor: theme.colors.border,
              marginTop: 16,
              marginHorizontal: 16,
            },
          ]}
        >
          {canEditAhCounterCorner ? (
            <TouchableOpacity
              style={[
                styles.ahCounterTabUnderline,
                effectiveTab === 'corner' && { borderBottomColor: theme.colors.primary },
              ]}
              onPress={() => setActiveTab('corner')}
            >
              <Text
                style={[
                  styles.ahCounterTabText,
                  { color: theme.colors.textSecondary },
                  effectiveTab === 'corner' && { color: theme.colors.primary, fontWeight: '700' },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Ah Counter Corner
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.ahCounterTabUnderline,
              effectiveTab === 'summary' && { borderBottomColor: theme.colors.primary },
              !canEditAhCounterCorner && { flex: 1 },
            ]}
            onPress={() => setActiveTab('summary')}
          >
            <Text
              style={[
                styles.ahCounterTabText,
                { color: theme.colors.textSecondary },
                effectiveTab === 'summary' && { color: theme.colors.primary, fontWeight: '700' },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              Ah Counter Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {effectiveTab === 'corner' ? (
          <View style={styles.tabContent}>
            <View
              style={[
                styles.ahCounterNotionPanel,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              {canEditAhCounterCorner && (
                <View
                  style={[
                    styles.ahCounterPanelSection,
                    {
                      borderBottomColor: theme.colors.border,
                      paddingVertical: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    },
                  ]}
                >
                  <View style={styles.summaryVisibilityLeft}>
                    {ahCounterSummaryVisibleToMembers ? (
                      <Eye size={18} color={theme.colors.primary} />
                    ) : (
                      <EyeOff size={18} color={theme.colors.textSecondary} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryVisibilityTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                        Show ah counter report to Member
                      </Text>
                      <Text style={[styles.summaryVisibilityHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        {ahCounterSummaryVisibleToMembers
                          ? 'Members can see Ah Counter Summary on screen.'
                          : 'Hidden from members. Only Ah Counter and VPE can view it.'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.summaryVisibilityButton,
                      {
                        backgroundColor: ahCounterSummaryVisibleToMembers ? '#2563eb' : theme.colors.background,
                        borderColor: ahCounterSummaryVisibleToMembers ? '#2563eb' : theme.colors.border,
                      },
                    ]}
                    onPress={() => handleAhCounterSummaryVisibilityChange(!ahCounterSummaryVisibleToMembers)}
                  >
                    {ahCounterSummaryVisibleToMembers ? (
                      <Eye size={16} color="#ffffff" />
                    ) : (
                      <EyeOff size={16} color={theme.colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {canEditAhCounterCorner && meeting && (
                <TouchableOpacity
                  style={[
                    styles.ahCounterPanelSection,
                    {
                      borderBottomColor: theme.colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    },
                  ]}
                  onPress={() =>
                    router.push({ pathname: '/ah-counter-manage-members', params: { meetingId: meeting.id } })
                  }
                  activeOpacity={0.75}
                >
                  <View style={[styles.manageMembersIconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
                    <Users size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.manageMembersTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      Manage members
                    </Text>
                    <Text style={[styles.manageMembersHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.05}>
                      Select who appears below Filler Words (opens full screen).
                    </Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}

              {canEditAhCounterCorner && meeting && (
                <View
                  style={[
                    styles.ahCounterPanelSection,
                    {
                      borderBottomColor: theme.colors.border,
                      paddingVertical: 10,
                    },
                  ]}
                >
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
                            Same roster as Timer Corner (up to 5). Edits here or on the Timer Report stay in sync for this meeting.
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
                            placeholder="Name (e.g. Subha)"
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

              <View style={[styles.ahCounterPanelSection, { borderBottomColor: theme.colors.border }]}>
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
                        !canEditAhCounterCorner && { opacity: 0.5 },
                      ]}
                      onPress={() => canEditAhCounterCorner && setSelectedFillerWord(selectedFillerWord === word ? null : word)}
                      disabled={!canEditAhCounterCorner}
                    >
                      <Text
                        style={[styles.fillerWordChipText, { color: selectedFillerWord === word ? '#ffffff' : theme.colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {word}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {canEditAhCounterCorner && (
                    <TouchableOpacity
                      style={[styles.fillerWordChip, styles.addWordChip, { borderColor: theme.colors.primary }]}
                      onPress={() => setShowAddWordModal(true)}
                    >
                      <Plus size={14} color={theme.colors.primary} />
                      <Text style={[styles.fillerWordChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                        Add
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {(auditMembers.length > 0 ||
                meetingVisitingGuests.length > 0 ||
                guestMembers.length > 0) && (
                <View style={[styles.ahCounterPanelSection, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.auditBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Meeting Attendees
                  </Text>
                  {auditMembersLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <View style={styles.fillerWordsGrid}>
                      {[...memberChipsForCorner]
                        .sort((a, b) => a.full_name.localeCompare(b.full_name))
                        .map((member) => {
                          const isDashedGuest =
                            member.user_id.startsWith('guest_') ||
                            member.user_id.startsWith(VISITING_GUEST_CHIP_PREFIX);
                          return (
                          <TouchableOpacity
                            key={member.user_id}
                            style={[
                              styles.fillerWordChip,
                              selectedMemberId === member.user_id
                                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                : isDashedGuest
                                  ? { backgroundColor: theme.colors.background, borderColor: '#f59e0b', borderStyle: 'dashed' }
                                  : { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                              !canEditAhCounterCorner && { opacity: 0.5 },
                            ]}
                            onPress={() =>
                              canEditAhCounterCorner &&
                              setSelectedMemberId(selectedMemberId === member.user_id ? null : member.user_id)
                            }
                            disabled={!canEditAhCounterCorner}
                          >
                            <Text
                              style={[
                                styles.fillerWordChipText,
                                { color: selectedMemberId === member.user_id ? '#ffffff' : theme.colors.text },
                              ]}
                              maxFontSizeMultiplier={1.3}
                            >
                              {member.full_name}
                            </Text>
                          </TouchableOpacity>
                          );
                        })}
                      {canEditAhCounterCorner && (
                        <TouchableOpacity
                          style={[styles.fillerWordChip, styles.addWordChip, { borderColor: theme.colors.primary }]}
                          onPress={() => setShowAddGuestModal(true)}
                        >
                          <Plus size={14} color={theme.colors.primary} />
                          <Text style={[styles.fillerWordChipText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            Add Guest
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}

              {canEditAhCounterCorner && (
                <View style={[styles.ahCounterPanelSection, { borderBottomColor: theme.colors.border, paddingVertical: 12 }]}>
                  <TouchableOpacity
                    style={[
                      styles.addToReportBtn,
                      selectedFillerWord && selectedMemberId
                        ? { backgroundColor: '#16a34a' }
                        : { backgroundColor: theme.colors.border },
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
                            ? `Add to Report: ${memberChipsForCorner.find((m) => m.user_id === selectedMemberId)?.full_name} – ${selectedFillerWord}`
                            : 'Select a filler word and member'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={[
                  styles.ahCounterPanelSection,
                  { borderBottomColor: theme.colors.border, borderBottomWidth: 0 },
                ]}
              >
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
                        index === reportEntries.length - 1 && { borderBottomWidth: 0 },
                      ]}
                    >
                      <View style={styles.reportEntryLeft}>
                        <View style={[styles.reportEntryAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                          {entry.avatarUrl ? (
                            <Image source={{ uri: entry.avatarUrl }} style={styles.reportEntryAvatarImg} />
                          ) : (
                            <Text
                              style={[styles.reportEntryAvatarInitial, { color: theme.colors.primary }]}
                              maxFontSizeMultiplier={1.3}
                            >
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
                      {canEditAhCounterCorner && (
                        <TouchableOpacity style={styles.reportEntryDelete} onPress={() => removeEntry(entry.id)}>
                          <Trash2 size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.tabContent}>
            {!ahCounterVisibilityFetched ? (
              <View style={[styles.viewOnlyBanner, { marginHorizontal: 16, marginTop: 12, paddingVertical: 24 }]}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text
                  style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary, marginTop: 12 }]}
                  maxFontSizeMultiplier={1.2}
                >
                  Checking report visibility…
                </Text>
              </View>
            ) : !ahCounterSummaryVisibleToMembers ? (
              <View
                style={[
                  styles.viewOnlyBanner,
                  {
                    marginHorizontal: 16,
                    marginTop: 12,
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {canEditAhCounterCorner
                    ? 'Ah Counter report is not published to members. Turn on "Show ah counter report to Member" in Ah Counter Corner to publish the summary.'
                    : "This meeting's Ah Counter report is visible only to the Ah Counter and VPE."}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.ahCounterNotionPanel,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <View
                  style={[
                    styles.ahCounterPanelSection,
                    { borderBottomColor: theme.colors.border, borderBottomWidth: 0 },
                  ]}
                >
                  <Text style={[styles.auditBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Filler word counts
                    {ahCounterSummaryTotalInstances > 0 ? ` (${ahCounterSummaryTotalInstances})` : ''}
                  </Text>
                  {reportEntries.length === 0 ? (
                    <Text style={[styles.auditEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No Ah Counter entries recorded yet for this meeting.
                    </Text>
                  ) : (
                    <>
                      {ahCounterSummaryFillerAggregates.map((row, index) => (
                        <View
                          key={row.slug}
                          style={[
                            styles.summaryAggregateRow,
                            { borderBottomColor: theme.colors.border },
                            index === ahCounterSummaryFillerAggregates.length - 1 && { borderBottomWidth: 0 },
                          ]}
                        >
                          <Text
                            style={[styles.summaryAggregateLabel, { color: theme.colors.text }]}
                            maxFontSizeMultiplier={1.3}
                          >
                            {row.label}
                          </Text>
                          <Text
                            style={[styles.summaryAggregateCount, { color: theme.colors.textSecondary }]}
                            maxFontSizeMultiplier={1.3}
                          >
                            {row.count === 1 ? '1 time' : `${row.count} times`}
                          </Text>
                        </View>
                      ))}
                      <Text
                        style={[styles.auditBoxTitle, styles.summaryOverallTitle, { color: theme.colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        Overall usage
                      </Text>
                      <View
                        style={[
                          styles.summaryOverallBox,
                          { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        ]}
                      >
                        <Text style={[styles.summaryOverallLine, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                          {ahCounterSummaryTotalInstances === 1
                            ? '1 filler instance recorded for this meeting.'
                            : `${ahCounterSummaryTotalInstances} filler instances recorded for this meeting.`}
                        </Text>
                        <Text
                          style={[styles.summaryOverallSubline, { color: theme.colors.textSecondary }]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {ahCounterSummaryDistinctFillers === 0
                            ? ''
                            : ahCounterSummaryDistinctFillers === 1
                              ? 'Across 1 distinct filler word or phrase.'
                              : `Across ${ahCounterSummaryDistinctFillers} distinct filler words or phrases.`}
                        </Text>
                      </View>
                      <Text
                        style={[styles.auditBoxTitle, styles.summaryMemberSectionTitle, { color: theme.colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        Member filler count
                      </Text>
                      {ahCounterSummaryMemberRows.map((row, rowIndex) => {
                        const expanded = expandedSummaryMemberKey === row.memberKey;
                        return (
                          <View
                            key={row.memberKey}
                            style={[
                              styles.summaryMemberBlock,
                              rowIndex < ahCounterSummaryMemberRows.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: theme.colors.border,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.summaryMemberRowHit}
                              onPress={() =>
                                setExpandedSummaryMemberKey((k) => (k === row.memberKey ? null : row.memberKey))
                              }
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityState={{ expanded }}
                            >
                              <View style={styles.summaryMemberRowInner}>
                                <Text
                                  style={[styles.summaryMemberName, { color: theme.colors.text }]}
                                  maxFontSizeMultiplier={1.3}
                                  numberOfLines={2}
                                >
                                  {row.memberName}
                                </Text>
                                <Text
                                  style={[styles.summaryMemberTotal, { color: theme.colors.textSecondary }]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {row.total} count
                                </Text>
                                {expanded ? (
                                  <ChevronUp size={18} color={theme.colors.textSecondary} />
                                ) : (
                                  <ChevronDown size={18} color={theme.colors.textSecondary} />
                                )}
                              </View>
                            </TouchableOpacity>
                            {expanded ? (
                              <View
                                style={[
                                  styles.summaryMemberBreakdown,
                                  { borderLeftColor: theme.colors.primary + '55' },
                                ]}
                              >
                                {row.byFiller.map((f) => (
                                  <Text
                                    key={f.slug}
                                    style={[styles.summaryMemberBreakdownLine, { color: theme.colors.textSecondary }]}
                                    maxFontSizeMultiplier={1.25}
                                  >
                                    {formatAhCounterSummaryMemberBreakdownLine(f.label, f.count)}
                                  </Text>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>
      {renderAhCounterGeDock()}
      </View>
      </View>
      </KeyboardAvoidingView>

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
                {assignedAhCounter ? 'Reassign Ah Counter' : 'Assign Ah Counter'}
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
              {assignedAhCounter
                ? 'Choose a member to assign as Ah Counter (replaces the current assignee).'
                : 'Choose a club member to book the Ah Counter role for this meeting.'}
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
      <PremiumBookingSuccessModal
        visible={!!bookingSuccessRole}
        roleLabel={bookingSuccessRole ?? ''}
        onClose={() => setBookingSuccessRole(null)}
      />
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
    alignItems: 'stretch',
    width: '100%',
  },
  contentContainerPadded: {
    paddingHorizontal: 16,
  },
  contentTop: {
    width: '100%',
    alignItems: 'stretch',
  },
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
    borderRadius: 0,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  viewOnlyBannerText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
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
  mainBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  scrollMainUnbooked: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  /** Same bottom dock shell as Grammarian / Educational Corner. */
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
  geDockFooterNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  geDockFooterNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  geDockFooterNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  geDockFooterNavLabel: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  /** Grammarian-assigned–style flat header block */
  consolidatedCornerCard: {
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
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
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  consolidatedAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
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
  ahCounterTabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  ahCounterTabUnderline: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  ahCounterTabText: {
    fontSize: 15,
    fontWeight: '500',
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
  ahCounterNotionPanel: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  ahCounterPanelSection: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manageMembersIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageMembersTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  manageMembersHint: {
    fontSize: 11,
    marginTop: 3,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 0,
    borderWidth: 1,
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
    borderRadius: 0,
    marginBottom: 0,
    alignSelf: 'stretch',
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
  summaryAggregateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  summaryAggregateLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  summaryAggregateCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryOverallTitle: {
    marginTop: 20,
    marginBottom: 10,
  },
  summaryOverallBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  summaryOverallLine: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  summaryOverallSubline: {
    fontSize: 13,
    lineHeight: 20,
  },
  summaryMemberSectionTitle: {
    marginTop: 22,
    marginBottom: 10,
  },
  summaryMemberBlock: {
    marginBottom: 0,
  },
  summaryMemberRowHit: {
    paddingVertical: 4,
  },
  summaryMemberRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  summaryMemberName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryMemberTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryMemberBreakdown: {
    marginLeft: 4,
    marginBottom: 10,
    paddingLeft: 12,
    gap: 6,
    borderLeftWidth: 3,
  },
  summaryMemberBreakdownLine: {
    fontSize: 13,
    lineHeight: 20,
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
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reportEntryAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 0,
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

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  bookOpenMeetingRole,
  fetchOpenMeetingRoleId,
  fetchBookedMeetingRoleId,
  bookMeetingRoleForCurrentUser,
  reassignBookedMeetingRole,
  type BookMeetingRoleResult,
} from '@/lib/bookMeetingRoleInline';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import {
  fetchGrammarianCornerSnapshot,
  fetchGrammarianClubMembersDirectory,
  invalidateGrammarianCornerSnapshotCache,
} from '@/lib/grammarianCornerQuery';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import { GrammarianReportSummarySection } from '@/components/grammarian/GrammarianReportSummarySection';
import { GrammarianNotesScreen } from './grammarian-notes';
import { ArrowLeft, BookOpen, Calendar, MapPin, Building2, User, Save, Sparkles, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Minus, Search, FileText, NotebookPen, Bell, Users, Eye, EyeOff, CheckSquare, Timer, Star, Mic, FileBarChart, Award, MessageCircle, MessageSquare, Lightbulb, MessageSquareQuote, ThumbsUp, CheckCircle2, AlertTriangle, TrendingUp, RotateCcw, Info, UserPlus, UserCog, ClipboardCheck, Vote } from 'lucide-react-native';

/** Match Toastmaster / corner bottom dock icon size */
const FOOTER_NAV_ICON_SIZE = 15;
import { Image } from 'react-native';
import { initialsFromName, useShouldLoadNetworkAvatars } from '@/lib/networkAvatarPolicy';

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

function formatTimeForGrammarianDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function grammarianMeetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** Matches General Evaluator / Toastmaster Corner meta line */
function isGrammarianSummaryVisibilityTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    msg.includes('grammarian_meeting_summary_visibility') ||
    msg.includes('does not exist')
  );
}

function formatGrammarianConsolidatedMeetingMeta(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeForGrammarianDisplay(m.meeting_start_time)} - ${formatTimeForGrammarianDisplay(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeForGrammarianDisplay(m.meeting_start_time));
  }
  parts.push(grammarianMeetingModeLabel(m));
  return parts.join(' | ');
}

interface AssignedGrammarian {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface DailyElements {
  word_of_the_day: string;
  idiom_of_the_day: string;
  phrase_of_the_day: string;
  quote_of_the_day: string;
}

interface WordOfTheDay {
  id?: string;
  word: string;
  part_of_speech?: string;
  meaning: string;
  usage: string;
  is_published: boolean;
  created_at?: string;
  published_at?: string;
}

interface IdiomOfTheDay {
  id?: string;
  idiom: string;
  meaning: string;
  usage: string;
  is_published: boolean;
  created_at?: string;
  published_at?: string;
  grammarian_user_id?: string;
}

interface QuoteOfTheDay {
  id?: string;
  quote: string;
  meaning: string;
  usage: string;
  is_published: boolean;
  created_at?: string;
  published_at?: string;
  grammarian_user_id?: string;
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface UsageTracking {
  word_usage: number;
  idiom_usage: number;
  phrase_usage: number;
  quote_usage: number;
}

export default function GrammarianReport() {
  const { theme } = useTheme();
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignedGrammarian, setAssignedGrammarian] = useState<AssignedGrammarian | null>(null);
  /** Lexicon + daily-elements rows are keyed by assigned grammarian; VPE edits the same rows. */
  const effectiveGrammarianUserId = assignedGrammarian?.id ?? user?.id ?? null;
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [clubName, setClubName] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showDailyElementsModal, setShowDailyElementsModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDay>({
    word: '',
    part_of_speech: undefined,
    meaning: '',
    usage: '',
    is_published: false,
    created_at: undefined,
    published_at: undefined,
  });
  const [idiomOfTheDay, setIdiomOfTheDay] = useState<IdiomOfTheDay | null>(null);
  const [quoteOfTheDay, setQuoteOfTheDay] = useState<QuoteOfTheDay | null>(null);
  const [activeTab, setActiveTab] = useState<'corner' | 'summary'>('summary');
  const [summaryMainTab, setSummaryMainTab] = useState<'lexicon' | 'reports'>('lexicon');
  const [summarySubTab, setSummarySubTab] = useState<'word' | 'idiom' | 'quote'>('word');
  const [usageTracking, setUsageTracking] = useState<UsageTracking>({
    word_usage: 0,
    idiom_usage: 0,
    phrase_usage: 0,
    quote_usage: 0,
  });
  const [grammarianReportId, setGrammarianReportId] = useState<string | null>(null);
  const [hasPublishedLiveObservations, setHasPublishedLiveObservations] = useState(false);
  /** Any Good usage / Opportunity row for this meeting (published or not) — drives Summary → Reports. */
  const [hasAnyLiveMeetingNotes, setHasAnyLiveMeetingNotes] = useState(false);
  
  const [dailyElements, setDailyElements] = useState<DailyElements>({
    word_of_the_day: '',
    idiom_of_the_day: '',
    phrase_of_the_day: '',
    quote_of_the_day: '',
  });

  const [feedbackForm, setFeedbackForm] = useState({
    excellent_usage: '',
    improper_usage: '',
    suggestions: '',
  });

  const [existingFeedback, setExistingFeedback] = useState<{
    good_usage: any;
    suggestions: any;
  }>({
    good_usage: null,
    suggestions: null,
  });
  const isInitialMount = useRef(true);
  const notebookPulse = useRef(new Animated.Value(1)).current;
  const wordOfTheDayPulse = useRef(new Animated.Value(1)).current;
  const [bookingGrammarianRole, setBookingGrammarianRole] = useState(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showAssignGrammarianModal, setShowAssignGrammarianModal] = useState(false);
  const [assignGrammarianSearch, setAssignGrammarianSearch] = useState('');
  const [isLoadingClubMembers, setIsLoadingClubMembers] = useState(false);
  const [assigningGrammarianRole, setAssigningGrammarianRole] = useState(false);
  const [cornerLiveSubTab, setCornerLiveSubTab] = useState<'good-usage' | 'improvements' | 'stats'>('good-usage');
  /** Sub-tabs under Grammarian Corner: prep shortcuts vs live meeting tools */
  const [cornerPhaseTab, setCornerPhaseTab] = useState<'pre-meeting' | 'live-meeting'>('pre-meeting');
  const [grammarianSummaryVisibleToMembers, setGrammarianSummaryVisibleToMembers] = useState(true);
  const [grammarianSummaryVisibilityFetched, setGrammarianSummaryVisibilityFetched] = useState(false);
  const [showGrammarianInfoModal, setShowGrammarianInfoModal] = useState(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadAtRef = useRef<number>(0);
  const liveDataLoadedRef = useRef(false);
  const preMeetingDataLoadedRef = useRef(false);
  const preMeetingBackgroundQueuedRef = useRef(false);

  useEffect(() => {
    preMeetingDataLoadedRef.current = false;
    liveDataLoadedRef.current = false;
    preMeetingBackgroundQueuedRef.current = false;
  }, [meetingId]);

  useEffect(() => {
    // Eye-off should hide only Summary -> Reports; keep Lexicon always accessible.
    if (!grammarianSummaryVisibleToMembers && summaryMainTab === 'reports') {
      setSummaryMainTab('lexicon');
    }
  }, [grammarianSummaryVisibleToMembers, summaryMainTab]);

  const wordOfTheDayDotScale = wordOfTheDayPulse.interpolate({
    inputRange: [1, 1.08],
    outputRange: [1, 1.35],
  });

  const wordOfTheDayDotOpacity = wordOfTheDayPulse.interpolate({
    inputRange: [1, 1.08],
    outputRange: [0.7, 1],
  });
  const grammarianFirstName = (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'there';

  // Wait for auth (same idea as toastmaster-corner useFocusEffect deps) so we never "finish" loading
  // before user/club exist — avoids a dead early return that skipped loadData forever.
  useEffect(() => {
    if (!meetingId) {
      setIsLoading(false);
      return;
    }
    if (!user?.currentClubId || !user?.id) {
      return;
    }
    void loadData();
  }, [meetingId, user?.id, user?.currentClubId]);

  useEffect(() => {
    if (selectedMember && grammarianReportId) {
      loadMemberUsage();
      loadMemberFeedback();
    }
  }, [selectedMember, grammarianReportId]);

  // Refresh word of the day, idiom, and quote when screen comes into focus (after publishing from prep space)
  // Skip on initial mount since useEffect already loads everything
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      console.log('🔄 Grammarian Report page focused, refreshing daily elements...');
      if (meetingId) {
        loadWordOfTheDay();
        loadIdiomOfTheDay();
        loadQuoteOfTheDay();
        void loadLiveObservationPresence();
      }
    }, [meetingId])
  );

  const loadData = async (opts?: { force?: boolean }) => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      setIsLoading(false);
      return;
    }

    if (loadInFlightRef.current) return loadInFlightRef.current;
    if (!opts?.force && Date.now() - lastLoadAtRef.current < 1200) return;

    const run = async () => {
      let isVpeForMeeting = false;
      let shouldRefreshLiveObservationPresence = true;
      try {
        if (opts?.force) {
          invalidateGrammarianCornerSnapshotCache(meetingId, user.id, user.currentClubId);
        }
        const snap = await fetchGrammarianCornerSnapshot(meetingId, user.id, user.currentClubId);

        let assigned: AssignedGrammarian | null = null;

        if (snap) {
          isVpeForMeeting = snap.is_vpe_for_club;
          setMeeting(snap.meeting as Meeting);
          if (snap.club_name) setClubName(snap.club_name);
          setIsVPEClub(snap.is_vpe_for_club);
          if (typeof snap.summary_visible_to_members === 'boolean') {
            setGrammarianSummaryVisibleToMembers(snap.summary_visible_to_members);
            setGrammarianSummaryVisibilityFetched(true);
          } else {
            await loadGrammarianSummaryVisibility();
          }
          setHasPublishedLiveObservations(Boolean(snap.has_published_live_observations));
          if (typeof snap.has_published_live_observations === 'boolean') {
            shouldRefreshLiveObservationPresence = false;
          }
          assigned = snap.assigned_grammarian;
          setAssignedGrammarian(assigned);

          // Use bundled pre-meeting data from snapshot to avoid extra first-load requests.
          if (snap.word_of_the_day) {
            const w = snap.word_of_the_day;
            setWordOfTheDay({
              id: w.id,
              word: w.word || '',
              part_of_speech: (w.part_of_speech || undefined) as string | undefined,
              meaning: w.meaning || '',
              usage: w.usage || '',
              is_published: Boolean(w.is_published),
              created_at: w.created_at || undefined,
              published_at: w.published_at || undefined,
            });
          }
          if (snap.idiom_of_the_day) {
            const i = snap.idiom_of_the_day;
            setIdiomOfTheDay({
              id: i.id,
              idiom: i.idiom || '',
              meaning: i.meaning || '',
              usage: i.usage || '',
              is_published: Boolean(i.is_published),
              created_at: i.created_at || undefined,
              published_at: i.published_at || undefined,
              grammarian_user_id: i.grammarian_user_id || undefined,
            });
          }
          if (snap.quote_of_the_day) {
            const q = snap.quote_of_the_day;
            setQuoteOfTheDay({
              id: q.id,
              quote: q.quote || '',
              meaning: q.meaning || '',
              usage: q.usage || '',
              is_published: Boolean(q.is_published),
              created_at: q.created_at || undefined,
              published_at: q.published_at || undefined,
              grammarian_user_id: q.grammarian_user_id || undefined,
            });
          }
          if (snap.daily_elements) {
            setDailyElements({
              word_of_the_day: snap.daily_elements.word_of_the_day || '',
              idiom_of_the_day: snap.daily_elements.idiom_of_the_day || '',
              phrase_of_the_day: snap.daily_elements.phrase_of_the_day || '',
              quote_of_the_day: snap.daily_elements.quote_of_the_day || '',
            });
          }
        } else {
          await Promise.all([loadMeeting(), loadClubName(), loadIsVPEClub()]);
          await loadGrammarianSummaryVisibility();
          assigned = await loadAssignedGrammarian();
          const { data: cp } = await supabase
            .from('club_profiles')
            .select('vpe_id')
            .eq('club_id', user.currentClubId)
            .maybeSingle();
          isVpeForMeeting = cp?.vpe_id === user.id;
        }

        if (assigned) {
          if (!preMeetingDataLoadedRef.current) {
            // Fast-first strategy: load Word of the Day first (primary click path).
            if (!snap?.word_of_the_day) {
              await loadWordOfTheDay();
            }
            preMeetingDataLoadedRef.current = true;

            // Defer secondary pre-meeting data so screen appears faster.
            if (!preMeetingBackgroundQueuedRef.current) {
              preMeetingBackgroundQueuedRef.current = true;
              setTimeout(() => {
                const shouldLoadDaily =
                  !snap?.daily_elements && (isVpeForMeeting || assigned.id === user.id);
                void Promise.all([
                  shouldLoadDaily ? loadDailyElements(assigned.id) : Promise.resolve(),
                  !snap?.idiom_of_the_day ? loadIdiomOfTheDay() : Promise.resolve(),
                  !snap?.quote_of_the_day ? loadQuoteOfTheDay() : Promise.resolve(),
                ]);
              }, 0);
            }
          }
        } else {
          setAssignedGrammarian(null);
          if (isVpeForMeeting && !snap?.daily_elements && user?.id) {
            void loadDailyElements(user.id);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Error', 'Failed to load Grammarian data');
      } finally {
        if (shouldRefreshLiveObservationPresence) {
          void loadLiveObservationPresence();
        }
        lastLoadAtRef.current = Date.now();
        setIsLoading(false);
        loadInFlightRef.current = null;
      }
    };

    loadInFlightRef.current = run();
    return loadInFlightRef.current;
  };

  const loadGrammarianSummaryVisibility = useCallback(async () => {
    if (!meetingId) return;
    setGrammarianSummaryVisibilityFetched(false);
    try {
      const { data, error } = await supabase
        .from('grammarian_meeting_summary_visibility')
        .select('summary_visible_to_members')
        .eq('meeting_id', meetingId)
        .maybeSingle();
      if (error) {
        if (isGrammarianSummaryVisibilityTableError(error)) {
          setGrammarianSummaryVisibleToMembers(true);
          return;
        }
        console.error('grammarian_meeting_summary_visibility:', error);
        setGrammarianSummaryVisibleToMembers(true);
        return;
      }
      setGrammarianSummaryVisibleToMembers(data?.summary_visible_to_members !== false);
    } catch (e) {
      console.error('loadGrammarianSummaryVisibility', e);
      setGrammarianSummaryVisibleToMembers(true);
    } finally {
      setGrammarianSummaryVisibilityFetched(true);
    }
  }, [meetingId]);

  useEffect(() => {
    if (cornerPhaseTab !== 'live-meeting') return;
    if (!meetingId) return;
    if (liveDataLoadedRef.current) return;

    liveDataLoadedRef.current = true;
    void Promise.all([loadLiveObservationPresence(), loadGrammarianReport()]);
  }, [cornerPhaseTab, meetingId]);

  const handleBookGrammarianInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingGrammarianRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%grammarian%' },
        'Grammarian is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        invalidateGrammarianCornerSnapshotCache(meetingId, user.id, user.currentClubId ?? '');
        setAssignedGrammarian({
          id: user.id,
          full_name: user.fullName || 'You',
          email: user.email || '',
          avatar_url: user.avatarUrl ?? null,
        });
        setBookingSuccessRole('Grammarian');
        void loadData({ force: true });
      } else {
        Alert.alert('Could not book', result.message);
      }
    } catch (e) {
      console.error('Book Grammarian:', e);
      Alert.alert('Error', 'Something went wrong while booking. Please try again.');
    } finally {
      setBookingGrammarianRole(false);
    }
  };

  const handleAssignGrammarianToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    const reassigning = !!assignedGrammarian;
    setAssigningGrammarianRole(true);
    try {
      let result: BookMeetingRoleResult;
      if (reassigning) {
        const roleId = await fetchBookedMeetingRoleId(meetingId, { ilikeRoleName: '%grammarian%' });
        if (!roleId) {
          Alert.alert('Error', 'No booked Grammarian role was found to reassign.');
          return;
        }
        result = await reassignBookedMeetingRole(member.id, roleId);
      } else {
        const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%grammarian%' });
        if (!roleId) {
          Alert.alert('Error', 'No open Grammarian role was found for this meeting.');
          return;
        }
        result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      }
      if (result.ok) {
        invalidateGrammarianCornerSnapshotCache(meetingId, user.id, user.currentClubId ?? '');
        setShowAssignGrammarianModal(false);
        setAssignGrammarianSearch('');
        setAssignedGrammarian({
          id: member.id,
          full_name: member.full_name,
          email: member.email,
          avatar_url: member.avatar_url,
        });
        Alert.alert(
          reassigning ? 'Reassigned' : 'Assigned',
          `${member.full_name} is now the Grammarian for this meeting.`
        );
        void loadData({ force: true });
      } else {
        Alert.alert(reassigning ? 'Could not reassign' : 'Could not assign', result.message);
      }
    } finally {
      setAssigningGrammarianRole(false);
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

  const loadAssignedGrammarian = async (): Promise<AssignedGrammarian | null> => {
    if (!meetingId || !user?.currentClubId) return null;

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
        .ilike('role_name', '%grammarian%')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('Error loading assigned Grammarian:', error);
        return null;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        const assigned = {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        } as AssignedGrammarian;
        setAssignedGrammarian(assigned);
        return assigned;
      } else {
        // Explicitly clear when no grammarian is assigned.
        setAssignedGrammarian(null);
        return null;
      }
    } catch (error) {
      console.error('Error loading assigned Grammarian:', error);
      return null;
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    setIsLoadingClubMembers(true);
    try {
      const members = await fetchGrammarianClubMembersDirectory(user.currentClubId);
      setClubMembers(members);

      setSelectedMember((prev) => (prev ? prev : members[0] ?? null));
    } catch (error) {
      console.error('Error loading club members:', error);
    } finally {
      setIsLoadingClubMembers(false);
    }
  };

  useEffect(() => {
    if (!showMemberModal && !showAssignGrammarianModal) return;
    if (!user?.currentClubId) return;
    if (clubMembers.length > 0) return;
    void loadClubMembers();
  }, [showMemberModal, showAssignGrammarianModal, user?.currentClubId, clubMembers.length]);

  const loadClubName = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club name:', error);
        return;
      }

      if (data) {
        setClubName(data.name);
      }
    } catch (error) {
      console.error('Error loading club name:', error);
    }
  };

  const loadDailyElements = async (grammarianUserId?: string | null) => {
    const gid = grammarianUserId ?? effectiveGrammarianUserId;
    if (!meetingId || !gid) return;

    try {
      const { data, error } = await supabase
        .from('app_grammarian_daily_elements')
        .select('word_of_the_day, idiom_of_the_day, phrase_of_the_day, quote_of_the_day')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', gid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading daily elements:', error);
        return;
      }

      if (data) {
        setDailyElements({
          word_of_the_day: data.word_of_the_day || '',
          idiom_of_the_day: data.idiom_of_the_day || '',
          phrase_of_the_day: data.phrase_of_the_day || '',
          quote_of_the_day: data.quote_of_the_day || '',
        });
      }
    } catch (error) {
      console.error('Error loading daily elements:', error);
    }
  };

  const loadGrammarianReport = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('grammarian_reports')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('recorded_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading grammarian report:', error);
        return;
      }

      if (data) {
        setGrammarianReportId(data.id);
      }
    } catch (error) {
      console.error('Error loading grammarian report:', error);
    }
  };

  const loadWordOfTheDay = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('grammarian_word_of_the_day')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading word of the day:', error);
        return;
      }

      if (data) {
        setWordOfTheDay({
          id: data.id,
          word: data.word || '',
          part_of_speech: data.part_of_speech || undefined,
          meaning: data.meaning || '',
          usage: data.usage || '',
          is_published: data.is_published || false,
          created_at: data.created_at,
          published_at: data.published_at,
        });
      }
    } catch (error) {
      console.error('Error loading word of the day:', error);
    }
  };

  const loadIdiomOfTheDay = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('grammarian_idiom_of_the_day')
        .select('*, app_user_profiles(full_name, avatar_url)')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading idiom of the day:', error);
        return;
      }

      if (data) {
        setIdiomOfTheDay({
          id: data.id,
          idiom: data.idiom || '',
          meaning: data.meaning || '',
          usage: data.usage || '',
          is_published: data.is_published || false,
          created_at: data.created_at,
          published_at: data.published_at,
          grammarian_user_id: data.grammarian_user_id,
        });
      }
    } catch (error) {
      console.error('Error loading idiom of the day:', error);
    }
  };

  const loadQuoteOfTheDay = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('grammarian_quote_of_the_day')
        .select('*, app_user_profiles(full_name, avatar_url)')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading quote of the day:', error);
        return;
      }

      if (data) {
        setQuoteOfTheDay({
          id: data.id,
          quote: data.quote || '',
          meaning: data.meaning || '',
          usage: data.usage || '',
          is_published: data.is_published || false,
          created_at: data.created_at,
          published_at: data.published_at,
          grammarian_user_id: data.grammarian_user_id,
        });
      }
    } catch (error) {
      console.error('Error loading quote of the day:', error);
    }
  };

  const loadLiveObservationPresence = async () => {
    if (!meetingId) return;

    try {
      const [pubGood, pubImp, anyGood, anyImp] = await Promise.all([
        supabase
          .from('grammarian_live_good_usage')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .limit(1),
        supabase
          .from('grammarian_live_improvements')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('is_published', true)
          .limit(1),
        supabase.from('grammarian_live_good_usage').select('id').eq('meeting_id', meetingId).limit(1),
        supabase.from('grammarian_live_improvements').select('id').eq('meeting_id', meetingId).limit(1),
      ]);

      const hasPublished =
        (pubGood.data && pubGood.data.length > 0) || (pubImp.data && pubImp.data.length > 0);
      setHasPublishedLiveObservations(!!hasPublished);

      const hasAny =
        (anyGood.data && anyGood.data.length > 0) || (anyImp.data && anyImp.data.length > 0);
      setHasAnyLiveMeetingNotes(!!hasAny);
    } catch (error) {
      console.error('Error loading live observation presence:', error);
    }
  };

  const loadMemberUsage = async () => {
    if (!selectedMember || !grammarianReportId) return;

    try {
      // Load word usage for selected member
      const { data: wordUsageData, error: wordError } = await supabase
        .from('grammarian_word_usage')
        .select('usage_count')
        .eq('grammarian_report_id', grammarianReportId)
        .eq('member_user_id', selectedMember.id)
        .single();

      if (wordError && wordError.code !== 'PGRST116') {
        console.error('Error loading word usage:', wordError);
        return;
      }

      // For now, we'll use the word usage count for all elements
      const wordCount = wordUsageData?.usage_count || 0;
      
      setUsageTracking({
        word_usage: wordCount,
        idiom_usage: 0, // Placeholder - would need separate tracking
        phrase_usage: 0, // Placeholder - would need separate tracking
        quote_usage: 0, // Placeholder - would need separate tracking
      });
    } catch (error) {
      console.error('Error loading member usage:', error);
    }
  };

  const loadMemberFeedback = async () => {
    if (!selectedMember || !grammarianReportId) return;

    try {
      // Load excellent usage (good usage)
      const { data: goodUsageData, error: goodError } = await supabase
        .from('grammarian_good_usage')
        .select('*')
        .eq('grammarian_report_id', grammarianReportId)
        .eq('member_user_id', selectedMember.id)
        .maybeSingle();

      // Load improper usage and suggestions
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('grammarian_suggestions')
        .select('*')
        .eq('grammarian_report_id', grammarianReportId)
        .eq('member_user_id', selectedMember.id)
        .maybeSingle();

      if (goodError && goodError.code !== 'PGRST116') {
        console.error('Error loading good usage:', goodError);
      }

      if (suggestionsError && suggestionsError.code !== 'PGRST116') {
        console.error('Error loading suggestions:', suggestionsError);
      }

      setExistingFeedback({
        good_usage: goodUsageData,
        suggestions: suggestionsData,
      });

      // Update feedback form with existing data
      setFeedbackForm({
        excellent_usage: goodUsageData?.good_usage_text || '',
        improper_usage: suggestionsData?.improper_use || '',
        suggestions: suggestionsData?.suggestions || '',
      });
    } catch (error) {
      console.error('Error loading member feedback:', error);
    }
  };

  const createGrammarianReport = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('grammarian_reports')
        .insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          recorded_by: user.id,
          word_of_the_day: dailyElements.word_of_the_day.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating grammarian report:', error);
        return null;
      }

      setGrammarianReportId(data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating grammarian report:', error);
      return null;
    }
  };


  const handleSaveDailyElements = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    // Check if at least one field is filled
    const hasContent = Object.values(dailyElements).some(value => value.trim().length > 0);
    if (!hasContent) {
      Alert.alert('Error', 'Please fill at least one daily element');
      return;
    }

    setIsSaving(true);

    try {
      const gid = effectiveGrammarianUserId;
      if (!gid) {
        Alert.alert('Error', 'No grammarian context for this meeting.');
        return;
      }

      const saveData = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        grammarian_user_id: gid,
        word_of_the_day: dailyElements.word_of_the_day.trim() || null,
        idiom_of_the_day: dailyElements.idiom_of_the_day.trim() || null,
        phrase_of_the_day: dailyElements.phrase_of_the_day.trim() || null,
        quote_of_the_day: dailyElements.quote_of_the_day.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Check if record exists
      const { data: existingData, error: checkError } = await supabase
        .from('app_grammarian_daily_elements')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', gid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing daily elements:', checkError);
        Alert.alert('Error', 'Failed to check existing data');
        return;
      }

      if (existingData) {
        // Update existing record
        const { error } = await supabase
          .from('app_grammarian_daily_elements')
          .update(saveData)
          .eq('id', existingData.id);

        if (error) {
          console.error('Error updating daily elements:', error);
          Alert.alert('Error', 'Failed to update daily elements');
          return;
        }
      } else {
        // Create new record
        const { error } = await supabase
          .from('app_grammarian_daily_elements')
          .insert({
            ...saveData,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error creating daily elements:', error);
          Alert.alert('Error', 'Failed to save daily elements');
          return;
        }
      }

      Alert.alert('Success', 'Daily elements saved successfully!');
      setShowDailyElementsModal(false);
      
      // Create grammarian report if it doesn't exist
      if (!grammarianReportId) {
        await createGrammarianReport();
      }
    } catch (error) {
      console.error('Error saving daily elements:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUsage = async () => {
    if (!selectedMember || !grammarianReportId || !meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required data to save usage');
      return;
    }

    try {
      // For now, save only word usage to existing table
      const { data: existingUsage, error: checkError } = await supabase
        .from('grammarian_word_usage')
        .select('id')
        .eq('grammarian_report_id', grammarianReportId)
        .eq('member_user_id', selectedMember.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing usage:', checkError);
        return;
      }

      const saveData = {
        grammarian_report_id: grammarianReportId,
        member_user_id: selectedMember.id,
        member_name: selectedMember.full_name,
        usage_count: usageTracking.word_usage,
        updated_at: new Date().toISOString(),
      };

      if (existingUsage) {
        // Update existing usage
        const { error } = await supabase
          .from('grammarian_word_usage')
          .update(saveData)
          .eq('id', existingUsage.id);

        if (error) {
          console.error('Error updating usage:', error);
          Alert.alert('Error', 'Failed to update usage count');
          return;
        }
      } else {
        // Create new usage record
        const { error } = await supabase
          .from('grammarian_word_usage')
          .insert({
            ...saveData,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error creating usage:', error);
          Alert.alert('Error', 'Failed to save usage count');
          return;
        }
      }

      Alert.alert('Success', `Usage count saved for ${selectedMember.full_name}`);
    } catch (error) {
      console.error('Error saving usage:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleSaveFeedback = async () => {
    if (!selectedMember || !grammarianReportId || !meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required data to save feedback');
      return;
    }

    if (!hasFeedbackContent()) {
      Alert.alert('Error', 'Please add at least one feedback item');
      return;
    }

    setIsSaving(true);

    try {
      // Save excellent usage (good usage)
      if (feedbackForm.excellent_usage.trim()) {
        const goodUsageData = {
          grammarian_report_id: grammarianReportId,
          member_user_id: selectedMember.id,
          member_name: selectedMember.full_name,
          good_usage_text: feedbackForm.excellent_usage.trim(),
          updated_at: new Date().toISOString(),
        };

        if (existingFeedback.good_usage) {
          await supabase
            .from('grammarian_good_usage')
            .update(goodUsageData)
            .eq('id', existingFeedback.good_usage.id);
        } else {
          await supabase
            .from('grammarian_good_usage')
            .insert({
              ...goodUsageData,
              created_at: new Date().toISOString(),
            });
        }
      }

      // Save improper usage and suggestions
      if (feedbackForm.improper_usage.trim() || feedbackForm.suggestions.trim()) {
        const suggestionsData = {
          grammarian_report_id: grammarianReportId,
          member_user_id: selectedMember.id,
          member_name: selectedMember.full_name,
          improper_use: feedbackForm.improper_usage.trim() || null,
          suggestions: feedbackForm.suggestions.trim() || null,
          updated_at: new Date().toISOString(),
        };

        if (existingFeedback.suggestions) {
          await supabase
            .from('grammarian_suggestions')
            .update(suggestionsData)
            .eq('id', existingFeedback.suggestions.id);
        } else {
          await supabase
            .from('grammarian_suggestions')
            .insert({
              ...suggestionsData,
              created_at: new Date().toISOString(),
            });
        }
      }

      Alert.alert('Success', `Feedback saved for ${selectedMember.full_name}`);
      setShowFeedbackModal(false);
      
      // Reload feedback to update preview
      await loadMemberFeedback();
    } catch (error) {
      console.error('Error saving feedback:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const updateDailyElement = (field: keyof DailyElements, value: string) => {
    const maxLength =
      field === 'quote_of_the_day' ? 200 : field === 'word_of_the_day' ? 50 : 100;
    if (value.length <= maxLength) {
      setDailyElements(prev => ({ ...prev, [field]: value }));
    }
  };

  const updateUsageCount = (type: keyof UsageTracking, increment: boolean) => {
    setUsageTracking(prev => {
      const currentCount = prev[type] || 0;
      const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);
      
      return {
        ...prev,
        [type]: newCount
      };
    });
  };

  const updateFeedbackField = (field: keyof typeof feedbackForm, value: string) => {
    const maxLength = field === 'excellent_usage' ? 500 : 300;
    if (value.length <= maxLength) {
      setFeedbackForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const hasWordOfTheDayContent = () => {
    return wordOfTheDay.word.trim().length > 0;
  };

  const hasAnyPublishedDailyContent = () => {
    return (wordOfTheDay.word.trim().length > 0 && wordOfTheDay.is_published) ||
           (idiomOfTheDay !== null && idiomOfTheDay.idiom && idiomOfTheDay.idiom.trim().length > 0 && idiomOfTheDay.is_published) ||
           (quoteOfTheDay !== null && quoteOfTheDay.quote && quoteOfTheDay.quote.trim().length > 0 && quoteOfTheDay.is_published);
  };

  /** Members: show Corner placeholder only when there is nothing to read (lexicon draft/published, live notes, or published live). */
  const hasAnyGrammarianShareableContent = () =>
    hasAnyPublishedDailyContent() ||
    wordOfTheDay.word.trim().length > 0 ||
    !!(idiomOfTheDay?.idiom?.trim()) ||
    !!(quoteOfTheDay?.quote?.trim()) ||
    hasAnyLiveMeetingNotes ||
    hasPublishedLiveObservations;

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const isAssignedGrammarian = () => {
    return assignedGrammarian && user && assignedGrammarian.id === user.id;
  };
  const canEditGrammarianCorner = () => {
    return isAssignedGrammarian() || isVPEClub;
  };

  const handleGrammarianSummaryVisibilityChange = async (visible: boolean) => {
    if (!canEditGrammarianCorner() || !meetingId) return;
    setGrammarianSummaryVisibleToMembers(visible);
    try {
      const { error } = await supabase.from('grammarian_meeting_summary_visibility').upsert(
        {
          meeting_id: meetingId,
          summary_visible_to_members: visible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'meeting_id' }
      );
      if (error) {
        if (isGrammarianSummaryVisibilityTableError(error)) {
          Alert.alert('Migration required', 'Apply the latest Grammarian database migration, then try again.');
          void loadGrammarianSummaryVisibility();
          return;
        }
        console.error('grammarian_meeting_summary_visibility upsert:', error);
        Alert.alert('Error', 'Could not update Grammarian summary visibility.');
        void loadGrammarianSummaryVisibility();
        return;
      }
      if (user?.id && user?.currentClubId) {
        invalidateGrammarianCornerSnapshotCache(meetingId, user.id, user.currentClubId);
      }
      void loadData({ force: true });
    } catch (e) {
      console.error('handleGrammarianSummaryVisibilityChange', e);
    }
  };

  const hasAnyDailyElements = () => {
    return Object.values(dailyElements).some(value => value.trim().length > 0);
  };

  // Pending highlight + dot should stop once the actual Word-of-the-Day record is saved/published.
  // `dailyElements.word_of_the_day` is separate (used for usage tracking), so it may lag behind after saving.
  const hasWordOfTheDay = wordOfTheDay.word.trim().length > 0 && wordOfTheDay.is_published;

  useEffect(() => {
    const shouldAnimate = canEditGrammarianCorner() && !hasWordOfTheDay;

    if (!shouldAnimate) {
      notebookPulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(notebookPulse, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(notebookPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
      notebookPulse.setValue(1);
    };
  }, [wordOfTheDay.word, wordOfTheDay.is_published, assignedGrammarian?.id, user?.id, notebookPulse]);

  useEffect(() => {
    const shouldAnimate = canEditGrammarianCorner() && !hasWordOfTheDay;

    if (!shouldAnimate) {
      wordOfTheDayPulse.setValue(1);
      return;
    }

    // `useNativeDriver: false` so the pulse works reliably on `--web` (RN Web doesn't fully support native driver).
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(wordOfTheDayPulse, { toValue: 1.04, duration: 350, useNativeDriver: false }),
        Animated.timing(wordOfTheDayPulse, { toValue: 1.08, duration: 350, useNativeDriver: false }),
        Animated.timing(wordOfTheDayPulse, { toValue: 1, duration: 350, useNativeDriver: false }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
      wordOfTheDayPulse.setValue(1);
    };
  }, [wordOfTheDay.word, wordOfTheDay.is_published, assignedGrammarian?.id, user?.id, hasWordOfTheDay, wordOfTheDayPulse]);

  useEffect(() => {
    if (canEditGrammarianCorner()) {
      setActiveTab('corner');
    }
  }, [assignedGrammarian?.id, user?.id, isVPEClub]);

  const hasFeedbackContent = () => {
    return feedbackForm.excellent_usage.trim().length > 0 ||
           feedbackForm.improper_usage.trim().length > 0 ||
           feedbackForm.suggestions.trim().length > 0;
  };

  const getDailyElementsPreview = () => {
    const filled = Object.entries(dailyElements)
      .filter(([_, value]) => value.trim().length > 0)
      .map(([key, value]) => ({
        key,
        value,
        label: key === 'word_of_the_day' ? 'WORD' :
               key === 'idiom_of_the_day' ? 'IDIOM' :
               key === 'phrase_of_the_day' ? 'PHRASE' : 'QUOTE',
        color: '#000000'
      }));

    return filled;
  };

  const getExistingFeedbackPreview = () => {
    const feedback = [];
    
    if (existingFeedback.good_usage?.good_usage_text) {
      feedback.push({
        type: 'excellent',
        label: '✨ Excellent Usage',
        text: existingFeedback.good_usage.good_usage_text,
        color: '#10b981'
      });
    }
    
    if (existingFeedback.suggestions?.improper_use) {
      feedback.push({
        type: 'improper',
        label: '⚠️ Improper Usage',
        text: existingFeedback.suggestions.improper_use,
        color: '#f59e0b'
      });
    }
    
    if (existingFeedback.suggestions?.suggestions) {
      feedback.push({
        type: 'suggestions',
        label: '💡 Suggestions to Improve',
        text: existingFeedback.suggestions.suggestions,
        color: '#3b82f6'
      });
    }
    
    return feedback;
  };

  const getTotalUsage = () => {
    return usageTracking.word_usage + usageTracking.idiom_usage + usageTracking.phrase_usage + usageTracking.quote_usage;
  };

  const UsageCard = ({ type, label, color }: { type: keyof UsageTracking; label: string; color: string }) => {
    const count = usageTracking[type] || 0;
    const canEdit = canEditGrammarianCorner();

    return (
      <View style={[styles.usageCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.usageLabel, { color: color }]} maxFontSizeMultiplier={1.3}>{label}</Text>
        <View style={styles.counterSection}>
          {canEdit ? (
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: theme.colors.background }]}
              onPress={() => updateUsageCount(type, false)}
              disabled={count === 0}
            >
              <Minus size={20} color={count === 0 ? theme.colors.textSecondary : color} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.counterButton, { backgroundColor: theme.colors.surface }]} />
          )}

          <View style={[styles.countDisplay, { borderColor: color }]}>
            <Text style={[styles.countText, { color: color }]} maxFontSizeMultiplier={1.3}>{count}</Text>
          </View>

          {canEdit ? (
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: theme.colors.background }]}
              onPress={() => updateUsageCount(type, true)}
            >
              <Plus size={20} color={color} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.counterButton, { backgroundColor: theme.colors.surface }]} />
          )}
        </View>
      </View>
    );
  };

  // Filter club members based on search query
  const filteredClubMembers = clubMembers.filter(member => {
    const query = memberSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      member.full_name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  });

  const filteredMembersForAssign = clubMembers.filter((member) => {
    const q = assignGrammarianSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  const MemberSelector = () => (
    <TouchableOpacity
      style={[styles.memberSelector, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => setShowMemberModal(true)}
    >
      <View style={styles.memberSelectorContent}>
        <View style={styles.memberAvatar}>
          {shouldLoadAvatars && selectedMember?.avatar_url ? (
            <Image source={{ uri: selectedMember.avatar_url }} style={styles.memberAvatarImage} />
          ) : (
            <Text style={styles.memberAvatarInitial} maxFontSizeMultiplier={1.1}>
              {initialsFromName(selectedMember?.full_name || 'Member', 1)}
            </Text>
          )}
        </View>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {selectedMember?.full_name || 'Select Member'}
          </Text>
          <Text style={[styles.memberSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {selectedMember ? 'Tap to change member' : 'Choose a member to track'}
          </Text>
        </View>
      </View>
      <ChevronDown size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  /** Same 7-action dock as General Evaluator Report */
  const renderGrammarianGeDock = () => (
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
          style={styles.footerNavItem}
          onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Book
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() =>
            router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id, initialTab: 'my_bookings' } })
          }
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Withdraw
          </Text>
        </TouchableOpacity>

        {isVPEClub ? (
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => setShowAssignGrammarianModal(true)}
            disabled={bookingGrammarianRole || assigningGrammarianRole}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              {assignedGrammarian ? (
                <UserCog size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              ) : (
                <UserPlus size={FOOTER_NAV_ICON_SIZE} color="#0d9488" />
              )}
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {assignedGrammarian ? 'Reassign' : 'Assign'}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
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
          onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Complete
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() =>
            router.push({
              pathname: '/grammarian-notes',
              params: { meetingId: meeting.id, clubId: user?.currentClubId ?? '' },
            })
          }
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            My Space
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Agenda
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerNavItem}
          onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
        >
          <View style={[styles.footerNavIcon, footerIconTileStyle]}>
            <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
          </View>
          <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Voting
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading Grammarian report...</Text>
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

  // Check if no Grammarian is assigned
  if (!assignedGrammarian) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian Report</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.mainBody}>
        <ScrollView
          style={styles.scrollMain}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
        >
          <View style={styles.contentTop}>
          <View style={[styles.noAssignmentNotionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
                <Text
                  style={[styles.meetingCardMetaCompact, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.25}
                >
                  {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'short' })} • {meeting.meeting_start_time || '--:--'}
                  {meeting.meeting_end_time ? ` - ${meeting.meeting_end_time}` : ''}
                </Text>
                <Text
                  style={[styles.meetingCardMetaCompact, styles.meetingCardMetaModeLine, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.25}
                >
                  {grammarianMeetingModeLabel(meeting)}
                </Text>
              </View>
            </View>

            <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />

            <View style={[styles.noAssignmentState, styles.noAssignmentStateInCard]}>
            <BookOpen size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.noAssignmentSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Love good words and great grammar?
            </Text>
            <TouchableOpacity
              style={[
                styles.bookRoleButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: bookingGrammarianRole || assigningGrammarianRole ? 0.85 : 1,
                },
              ]}
              onPress={() => handleBookGrammarianInline()}
              disabled={bookingGrammarianRole || assigningGrammarianRole}
            >
              {bookingGrammarianRole ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                  Book Grammarian
                </Text>
              )}
            </TouchableOpacity>
            {isVPEClub ? (
              <TouchableOpacity
                style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                onPress={() => {
                  setShowAssignGrammarianModal(true);
                  void loadClubMembers();
                }}
                disabled={bookingGrammarianRole || assigningGrammarianRole}
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
        {renderGrammarianGeDock()}
        </View>

        </View>
        </KeyboardAvoidingView>

        <Modal
          visible={showAssignGrammarianModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAssignGrammarianModal(false);
            setAssignGrammarianSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAssignGrammarianModal(false);
              setAssignGrammarianSearch('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.memberModal, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {assignedGrammarian ? 'Reassign Grammarian' : 'Assign Grammarian'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setShowAssignGrammarianModal(false);
                    setAssignGrammarianSearch('');
                  }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.assignModalHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                {assignedGrammarian
                  ? 'Choose a member to assign as Grammarian (replaces the current assignee).'
                  : 'Choose a club member to book the Grammarian role for this meeting.'}
              </Text>
              <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={assignGrammarianSearch}
                  onChangeText={setAssignGrammarianSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {assignGrammarianSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAssignGrammarianSearch('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
                {assigningGrammarianRole ? (
                  <View style={styles.noResultsContainer}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : isLoadingClubMembers && clubMembers.length === 0 ? (
                  <View style={styles.noResultsContainer}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : filteredMembersForAssign.length > 0 ? (
                  filteredMembersForAssign.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.memberOption, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignGrammarianToMember(member)}
                      disabled={assigningGrammarianRole}
                    >
                      <View style={styles.memberOptionAvatar}>
                        {shouldLoadAvatars && member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                        ) : (
                          <Text style={styles.memberOptionAvatarInitial} maxFontSizeMultiplier={1.1}>
                            {initialsFromName(member.full_name, 1)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.memberOptionInfo}>
                        <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian Report</Text>
        {canEditGrammarianCorner() ? (
          <TouchableOpacity
            style={styles.headerInfoButton}
            onPress={() => setShowGrammarianInfoModal(true)}
            activeOpacity={0.8}
          >
            <Info size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
      >
        <View style={styles.contentTop}>
        {/* Flat header — matches Educational Corner / GE Report */}
        {assignedGrammarian && (
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
                {shouldLoadAvatars && assignedGrammarian.avatar_url ? (
                  <Image source={{ uri: assignedGrammarian.avatar_url }} style={styles.consolidatedAvatarImage} />
                ) : (
                  <Text
                    style={[
                      styles.consolidatedAvatarInitial,
                      { color: theme.mode === 'dark' ? '#E5E7EB' : '#6B7280' },
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {initialsFromName(assignedGrammarian.full_name, 1)}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {assignedGrammarian.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                Grammarian
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
                {formatGrammarianConsolidatedMeetingMeta(meeting)}
              </Text>
            </View>
          </View>
        )}

        {/* Tab Navigation */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          {canEditGrammarianCorner() && (
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'corner' && styles.activeTab,
                activeTab === 'corner' && { borderBottomColor: theme.colors.primary }
              ]}
              onPress={() => setActiveTab('corner')}
            >
              <Text style={[
                styles.tabText,
                { color: theme.colors.textSecondary },
                activeTab === 'corner' && styles.activeTabText,
                activeTab === 'corner' && { color: theme.colors.primary }
              ]} maxFontSizeMultiplier={1.3}>
                Grammarian Corner
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'summary' && styles.activeTab,
              activeTab === 'summary' && { borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('summary')}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.textSecondary },
              activeTab === 'summary' && styles.activeTabText,
              activeTab === 'summary' && { color: theme.colors.primary }
            ]} maxFontSizeMultiplier={1.3}>
              Grammarian Summary
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContentWrapper}>
        {canEditGrammarianCorner() && activeTab === 'corner' ? (
          <>
            {/* Grammarian Corner: Pre meeting vs Live meeting */}
            <View
              style={[
                styles.cornerPhaseTabRow,
                { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.cornerPhaseTab,
                  cornerPhaseTab === 'pre-meeting' && styles.cornerPhaseTabActive,
                  cornerPhaseTab === 'pre-meeting' && { borderBottomColor: theme.colors.primary },
                ]}
                onPress={() => setCornerPhaseTab('pre-meeting')}
              >
                <Text
                  style={[
                    styles.cornerPhaseTabText,
                    { color: theme.colors.textSecondary },
                    cornerPhaseTab === 'pre-meeting' && styles.cornerPhaseTabTextActive,
                    cornerPhaseTab === 'pre-meeting' && { color: theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  Pre meeting
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cornerPhaseTab,
                  cornerPhaseTab === 'live-meeting' && styles.cornerPhaseTabActive,
                  cornerPhaseTab === 'live-meeting' && { borderBottomColor: theme.colors.primary },
                ]}
                onPress={() => setCornerPhaseTab('live-meeting')}
              >
                <Text
                  style={[
                    styles.cornerPhaseTabText,
                    { color: theme.colors.textSecondary },
                    cornerPhaseTab === 'live-meeting' && styles.cornerPhaseTabTextActive,
                    cornerPhaseTab === 'live-meeting' && { color: theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  Live meeting
                </Text>
              </TouchableOpacity>
            </View>

            {cornerPhaseTab === 'pre-meeting' ? (
              <View style={[styles.preMeetingSection, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.preMeetingIconsRow}>
                  <TouchableOpacity
                    style={[
                      styles.preMeetingIconCard,
                      !hasWordOfTheDay && styles.preMeetingIconCardPending,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/grammarian-word-prep',
                        params: { meetingId: meeting?.id as string },
                      })
                    }
                  >
                    <View style={[styles.preMeetingIconWrap, { backgroundColor: '#EFF6FF' }]}>
                      <BookOpen size={18} color="#2563eb" />
                    </View>

                    {!hasWordOfTheDay && (
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.preMeetingPendingDot,
                          {
                            backgroundColor: '#f97316',
                            borderColor: '#fdba74',
                            opacity: wordOfTheDayDotOpacity,
                            transform: [{ scale: wordOfTheDayDotScale }],
                          },
                        ]}
                      />
                    )}
                    <Text style={[styles.preMeetingIconLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Word of the day
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.preMeetingIconCard}
                    onPress={() =>
                      router.push({
                        pathname: '/grammarian-quote-prep',
                        params: { meetingId: meeting?.id as string },
                      })
                    }
                  >
                    <View style={[styles.preMeetingIconWrap, { backgroundColor: '#F5F3FF' }]}>
                      <MessageSquareQuote size={18} color="#7c3aed" />
                    </View>
                    <Text style={[styles.preMeetingIconLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Quote of the day
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.preMeetingIconCard}
                    onPress={() =>
                      router.push({
                        pathname: '/grammarian-idiom-prep',
                        params: { meetingId: meeting?.id as string },
                      })
                    }
                  >
                    <View style={[styles.preMeetingIconWrap, { backgroundColor: '#FFFBEB' }]}>
                      <Lightbulb size={18} color="#f59e0b" />
                    </View>
                    <Text style={[styles.preMeetingIconLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Idiom of the day
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {canEditGrammarianCorner() && (
                  <View
                    style={[
                      styles.liveMeetingVisibilityCard,
                      {
                        marginHorizontal: 16,
                        marginTop: 10,
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View style={styles.summaryVisibilityRow}>
                      <View style={styles.summaryVisibilityLeft}>
                        {grammarianSummaryVisibleToMembers ? (
                          <Eye size={18} color={theme.colors.primary} />
                        ) : (
                          <EyeOff size={18} color={theme.colors.textSecondary} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.summaryVisibilityTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                            Show report to member
                          </Text>
                          <Text style={[styles.summaryVisibilityHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                            {grammarianSummaryVisibleToMembers
                              ? 'Members can see Grammarian Summary on screen.'
                              : 'Hidden until you turn this on. No one (including you) can view live report or summary while off.'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.summaryVisibilityButton,
                          {
                            backgroundColor: grammarianSummaryVisibleToMembers ? '#2563eb' : theme.colors.background,
                            borderColor: grammarianSummaryVisibleToMembers ? '#2563eb' : theme.colors.border,
                          },
                        ]}
                        onPress={() => handleGrammarianSummaryVisibilityChange(!grammarianSummaryVisibleToMembers)}
                      >
                        {grammarianSummaryVisibleToMembers ? (
                          <Eye size={16} color="#ffffff" />
                        ) : (
                          <EyeOff size={16} color={theme.colors.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {!grammarianSummaryVisibilityFetched ? (
                  <View style={{ paddingVertical: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text
                      style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary, marginTop: 12 }]}
                      maxFontSizeMultiplier={1.2}
                    >
                      Checking report visibility…
                    </Text>
                  </View>
                ) : !grammarianSummaryVisibleToMembers ? (
                  <View
                    style={[
                      styles.viewOnlyBanner,
                      {
                        marginHorizontal: 16,
                        marginTop: 8,
                        marginBottom: 8,
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.unpublishedReportTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                      Report is yet to be published..
                    </Text>
                    <Text style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary, marginTop: 8 }]} maxFontSizeMultiplier={1.15}>
                      Turn on &quot;Show report to member&quot; above when you are ready to share this report with the meeting.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={[styles.preMeetingSection, { backgroundColor: theme.colors.surface, paddingTop: 14 }]}>
                      <View style={[styles.liveSegmentControl, { backgroundColor: '#F8FAFC', borderColor: '#DBEAFE' }]}>
                        <TouchableOpacity
                          style={[
                            styles.liveSegmentTab,
                            cornerLiveSubTab === 'good-usage' && [styles.liveSegmentTabActive, { backgroundColor: '#EFF6FF' }],
                          ]}
                          onPress={() => {
                            setCornerLiveSubTab('good-usage');
                          }}
                        >
                          <CheckCircle2
                            size={14}
                            color={cornerLiveSubTab === 'good-usage' ? '#111827' : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.liveSegmentTabText,
                              {
                                color: cornerLiveSubTab === 'good-usage' ? '#111827' : theme.colors.textSecondary,
                                fontWeight: cornerLiveSubTab === 'good-usage' ? '700' : '600',
                              },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            Good Usage
                          </Text>
                        </TouchableOpacity>

                        <View style={[styles.liveSegmentDivider, { backgroundColor: '#DBEAFE' }]} />

                        <TouchableOpacity
                          style={[
                            styles.liveSegmentTab,
                            cornerLiveSubTab === 'improvements' && [styles.liveSegmentTabActive, { backgroundColor: '#EFF6FF' }],
                          ]}
                          onPress={() => {
                            setCornerLiveSubTab('improvements');
                          }}
                        >
                          <AlertTriangle
                            size={14}
                            color={cornerLiveSubTab === 'improvements' ? '#111827' : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.liveSegmentTabText,
                              {
                                color: cornerLiveSubTab === 'improvements' ? '#111827' : theme.colors.textSecondary,
                                fontWeight: cornerLiveSubTab === 'improvements' ? '700' : '600',
                              },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            Opportunity
                          </Text>
                        </TouchableOpacity>

                        <View style={[styles.liveSegmentDivider, { backgroundColor: '#DBEAFE' }]} />

                        <TouchableOpacity
                          style={[
                            styles.liveSegmentTab,
                            cornerLiveSubTab === 'stats' && [styles.liveSegmentTabActive, { backgroundColor: '#EFF6FF' }],
                          ]}
                          onPress={() => {
                            setCornerLiveSubTab('stats');
                          }}
                        >
                          <TrendingUp
                            size={14}
                            color={cornerLiveSubTab === 'stats' ? '#111827' : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.liveSegmentTabText,
                              {
                                color: cornerLiveSubTab === 'stats' ? '#111827' : theme.colors.textSecondary,
                                fontWeight: cornerLiveSubTab === 'stats' ? '700' : '600',
                              },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            Stats
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.inlineLiveMeetingPanel}>
                      <GrammarianNotesScreen
                        variant="live-inline"
                        liveSubTab={cornerLiveSubTab}
                        meetingId={meeting?.id}
                      />
                    </View>
                  </>
                )}
              </>
            )}

            {/* Grammarian role guidance removed (requested by user). */}

        {/* Daily content placeholder for non-grammarians */}
        {!canEditGrammarianCorner() && !hasAnyGrammarianShareableContent() && (
          <View style={styles.wordPlaceholderContainer}>
            <View style={[styles.wordPlaceholderIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <BookOpen size={32} color={theme.colors.primary} />
            </View>
            <Text style={[styles.wordPlaceholderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Grammarian Corner is being prepared!
            </Text>
            <Text style={[styles.wordPlaceholderSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {assignedGrammarian
                ? `Open Grammarian Summary for Word, Idiom, Quote, or live Good usage and Opportunity when ${assignedGrammarian.full_name.trim().split(/\s+/)[0]} adds them.`
                : 'Open Grammarian Summary for Word, Idiom, Quote, or live notes when they are added.'}
            </Text>
          </View>
        )}


        {/* Member Selection and Usage Tracking - Only show if daily elements are set */}
        {canEditGrammarianCorner() && hasAnyDailyElements() && (
          <>
            {/* Member Selection */}
            <View style={[styles.memberSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Member</Text>
              <MemberSelector />
            </View>

            {/* Usage Tracking - Only show if member is selected */}
            {selectedMember && (
              <>
                {/* Total Usage Counter */}
                <View style={[styles.totalSection, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.totalLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Total Daily Elements Used</Text>
                  <View style={[styles.totalCount, { backgroundColor: '#8b5cf6' + '20', borderColor: '#8b5cf6' }]}>
                    <Text style={[styles.totalCountText, { color: '#8b5cf6' }]} maxFontSizeMultiplier={1.3}>{getTotalUsage()}</Text>
                  </View>
                </View>

                {/* Usage Tracking Grid */}
                <View style={[styles.usageTrackingSection, { backgroundColor: theme.colors.surface }]}>
                  <View style={styles.usageTrackingHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Daily Elements Usage Tracking</Text>
                    {getTotalUsage() > 0 && (
                      <TouchableOpacity
                        style={[styles.saveUsageButton, { backgroundColor: theme.colors.primary }]}
                        onPress={handleSaveUsage}
                      >
                        <Save size={16} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.usageGrid}>
                    {dailyElements.word_of_the_day && (
                      <UsageCard type="word_usage" label="Word" color="#000000" />
                    )}
                    {dailyElements.idiom_of_the_day && (
                      <UsageCard type="idiom_usage" label="Idiom" color="#000000" />
                    )}
                    {dailyElements.phrase_of_the_day && (
                      <UsageCard type="phrase_usage" label="Phrase" color="#000000" />
                    )}
                    {dailyElements.quote_of_the_day && (
                      <UsageCard type="quote_usage" label="Quote" color="#000000" />
                    )}
                  </View>
                </View>

                {/* Member Feedback Section */}
                <View style={[styles.memberFeedbackSection, { backgroundColor: theme.colors.surface }]}>
                  <View style={styles.memberFeedbackHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Member Feedback</Text>
                    <TouchableOpacity
                      style={[styles.addFeedbackButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => setShowFeedbackModal(true)}
                    >
                      <Plus size={14} color="#ffffff" />
                      <Text style={styles.addFeedbackButtonText} maxFontSizeMultiplier={1.3}>Add Feedback</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Feedback Preview */}
                  {getExistingFeedbackPreview().length > 0 ? (
                    <View style={styles.feedbackPreviewGrid}>
                      {getExistingFeedbackPreview().map((feedback, index) => (
                        <View key={index} style={[styles.feedbackPreviewCard, { 
                          backgroundColor: theme.colors.background,
                          borderLeftColor: feedback.color 
                        }]}>
                          <Text style={[styles.feedbackPreviewLabel, { color: feedback.color }]} maxFontSizeMultiplier={1.3}>
                            {feedback.label}
                          </Text>
                          <Text style={[styles.feedbackPreviewText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {feedback.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.noFeedbackState}>
                      <Text style={[styles.noFeedbackText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {`No feedback added yet. Tap "Add Feedback" to provide member feedback.`}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
          </>
        ) : !grammarianSummaryVisibilityFetched ? (
          <View style={[styles.viewOnlyBanner, { marginHorizontal: 16, marginTop: 12, paddingVertical: 24 }]}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text
              style={[styles.viewOnlyBannerText, { color: theme.colors.textSecondary, marginTop: 12 }]}
              maxFontSizeMultiplier={1.2}
            >
              Checking report visibility…
            </Text>
          </View>
        ) : (
          <GrammarianReportSummarySection
            theme={theme}
            styles={styles}
            summaryMainTab={summaryMainTab}
            setSummaryMainTab={setSummaryMainTab}
            reportsVisibleToMembers={grammarianSummaryVisibleToMembers}
            summarySubTab={summarySubTab}
            setSummarySubTab={setSummarySubTab}
            wordOfTheDay={wordOfTheDay}
            idiomOfTheDay={idiomOfTheDay}
            quoteOfTheDay={quoteOfTheDay}
            assignedGrammarian={assignedGrammarian}
            clubName={clubName}
            meetingId={meetingId as string}
            hasPublishedLiveObservations={hasPublishedLiveObservations}
            hasAnyLiveMeetingNotes={hasAnyLiveMeetingNotes}
          />
        )}
        </View>
        </View>
      </ScrollView>
      {renderGrammarianGeDock()}
      </View>

      <Modal
        visible={showAssignGrammarianModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAssignGrammarianModal(false);
          setAssignGrammarianSearch('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowAssignGrammarianModal(false);
            setAssignGrammarianSearch('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.memberModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {assignedGrammarian ? 'Reassign Grammarian' : 'Assign Grammarian'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowAssignGrammarianModal(false);
                  setAssignGrammarianSearch('');
                }}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.assignModalHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              {assignedGrammarian
                ? 'Choose a member to assign as Grammarian (replaces the current assignee).'
                : 'Choose a club member to book the Grammarian role for this meeting.'}
            </Text>
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search by name or email..."
                placeholderTextColor={theme.colors.textSecondary}
                value={assignGrammarianSearch}
                onChangeText={setAssignGrammarianSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {assignGrammarianSearch.length > 0 && (
                <TouchableOpacity onPress={() => setAssignGrammarianSearch('')}>
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {assigningGrammarianRole ? (
                <View style={styles.noResultsContainer}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : isLoadingClubMembers && clubMembers.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : filteredMembersForAssign.length > 0 ? (
                filteredMembersForAssign.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberOption, { backgroundColor: theme.colors.background }]}
                    onPress={() => handleAssignGrammarianToMember(member)}
                    disabled={assigningGrammarianRole}
                  >
                    <View style={styles.memberOptionAvatar}>
                      {shouldLoadAvatars && member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                      ) : (
                        <Text style={styles.memberOptionAvatarInitial} maxFontSizeMultiplier={1.1}>
                          {initialsFromName(member.full_name, 1)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.memberOptionInfo}>
                      <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No members found
                  </Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Daily Elements Modal */}
      <Modal
        visible={showDailyElementsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDailyElementsModal(false)}
      >
        <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.fullScreenModalContent}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
                  <Sparkles size={20} color="#8b5cf6" />
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Unlock the Power of Words
                </Text>
              </View>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity 
                  style={[
                    styles.saveButton,
                    { 
                      backgroundColor: hasAnyDailyElements() ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    }
                  ]}
                  onPress={handleSaveDailyElements}
                  disabled={!hasAnyDailyElements() || isSaving}
                >
                  <Save size={16} color={hasAnyDailyElements() ? "#ffffff" : theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowDailyElementsModal(false)}>
                  <X size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Word of the Day */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Word of the Day</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter word of the day..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={dailyElements.word_of_the_day}
                  onChangeText={(text) => updateDailyElement('word_of_the_day', text)}
                  maxLength={50}
                />
                <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dailyElements.word_of_the_day.length}/50 characters
                </Text>
              </View>

              {/* Idiom of the Day */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Idiom of the Day</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter idiom of the day..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={dailyElements.idiom_of_the_day}
                  onChangeText={(text) => updateDailyElement('idiom_of_the_day', text)}
                  maxLength={100}
                />
                <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dailyElements.idiom_of_the_day.length}/100 characters
                </Text>
              </View>

              {/* Phrase of the Day */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Phrase of the Day</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter phrase of the day..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={dailyElements.phrase_of_the_day}
                  onChangeText={(text) => updateDailyElement('phrase_of_the_day', text)}
                  maxLength={100}
                />
                <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dailyElements.phrase_of_the_day.length}/100 characters
                </Text>
              </View>

              {/* Quote of the Day */}
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quote of the Day</Text>
                <TextInput
                  style={[styles.textAreaInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter quote of the day..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={dailyElements.quote_of_the_day}
                  onChangeText={(text) => updateDailyElement('quote_of_the_day', text)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={200}
                />
                <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dailyElements.quote_of_the_day.length}/200 characters
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveFormButton,
                  {
                    backgroundColor: hasAnyDailyElements() ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={handleSaveDailyElements}
                disabled={!hasAnyDailyElements() || isSaving}
              >
                <Save size={16} color={hasAnyDailyElements() ? "#ffffff" : theme.colors.textSecondary} />
                <Text style={[
                  styles.saveFormButtonText,
                  { color: hasAnyDailyElements() ? "#ffffff" : theme.colors.textSecondary }
                ]} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Saving...' : 'Save Daily Elements'}
                </Text>
              </TouchableOpacity>

              {/* Bottom spacing for mobile */}
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Member Selection Modal */}
      <Modal
        visible={showMemberModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowMemberModal(false);
          setMemberSearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowMemberModal(false);
            setMemberSearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.memberModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Member</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowMemberModal(false);
                  setMemberSearchQuery('');
                }}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search by name or email..."
                placeholderTextColor={theme.colors.textSecondary}
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {memberSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {isLoadingClubMembers && clubMembers.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <ActivityIndicator color={theme.colors.primary} />
                </View>
              ) : filteredClubMembers.length > 0 ? (
                filteredClubMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.memberOption,
                      selectedMember?.id === member.id && { backgroundColor: theme.colors.primary + '20' }
                    ]}
                    onPress={() => {
                      setSelectedMember(member);
                      setShowMemberModal(false);
                      setMemberSearchQuery('');
                    }}
                  >
                    <View style={styles.memberOptionAvatar}>
                      {shouldLoadAvatars && member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                      ) : (
                        <Text style={styles.memberOptionAvatarInitial} maxFontSizeMultiplier={1.1}>
                          {initialsFromName(member.full_name, 1)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.memberOptionInfo}>
                      <Text style={[
                        styles.memberOptionName,
                        { color: selectedMember?.id === member.id ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                      <Text style={[styles.memberOptionEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {member.email}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No members found
                  </Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showGrammarianInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGrammarianInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGrammarianInfoModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.grammarianInfoModalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <Text style={[styles.grammarianInfoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Grammarian Guide
            </Text>
            <ScrollView style={styles.grammarianInfoScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.grammarianInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                {`Hello ${grammarianFirstName}, you are the Grammarian of the Day! 🌟

You will see two tabs: Grammarian Corner and Grammarian Summary.
All other members will be able to view only the Grammarian Summary.

In Grammarian Summary, Lexicon shows Word, Idiom, and Quote of the Day; Reports opens the full meeting report when available.

Under Grammarian Corner, use Pre meeting for prep shortcuts and Live meeting for Good usage, Opportunity, and Stats.

📝 Pre meeting
Add the Word of the Day, Quote, and Idiom
Once added, they are saved automatically
All members can view them in the Grammarian Summary

🎤 Live meeting
Capture key observations:
Good usage of language
Opportunities for improvement
Stats – track Word of the Day usage

📊 After the Meeting
Use the Publish button under Stats to share your report
Once published, all members can view it in the Grammarian Summary
You can unpublish anytime to make edits

Finally, don’t forget to share the Grammarian Report with all club members.

💬 You’re making a meaningful effort to help everyone improve their language and communication. Your role truly elevates the quality of the meeting—thank you for your contribution!`}
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.grammarianInfoCloseBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowGrammarianInfoModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.grammarianInfoCloseBtnText} maxFontSizeMultiplier={1.2}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Member Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <SafeAreaView style={[styles.fullScreenModal, { backgroundColor: theme.colors.background }]}>
          <View style={styles.fullScreenModalContent}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalIcon, { backgroundColor: '#8b5cf6' }]}>
                  {shouldLoadAvatars && selectedMember?.avatar_url ? (
                    <Image source={{ uri: selectedMember.avatar_url }} style={styles.modalIconImage} />
                  ) : (
                    <Text style={styles.modalIconInitial} maxFontSizeMultiplier={1.1}>
                      {initialsFromName(selectedMember?.full_name || 'Member', 1)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedMember?.full_name}
                </Text>
              </View>
              <View style={styles.modalHeaderRight}>
                <TouchableOpacity 
                  style={[
                    styles.saveButton,
                    { 
                      backgroundColor: hasFeedbackContent() ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    }
                  ]}
                  onPress={handleSaveFeedback}
                  disabled={!hasFeedbackContent() || isSaving}
                >
                  <Save size={16} color={hasFeedbackContent() ? "#ffffff" : theme.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowFeedbackModal(false)}>
                  <X size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Excellent Usage */}
              <View style={styles.feedbackFormField}>
                <View style={styles.feedbackFieldHeader}>
                  <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    ✨ Excellent Usage
                  </Text>
                  <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {feedbackForm.excellent_usage.length}/500
                  </Text>
                </View>
                <TextInput
                  style={[styles.feedbackTextInput, { 
                    backgroundColor: theme.colors.surface, 
                    borderColor: theme.colors.border,
                    color: theme.colors.text 
                  }]}
                  placeholder=""
                  placeholderTextColor={theme.colors.textSecondary}
                  value={feedbackForm.excellent_usage}
                  onChangeText={(text) => updateFeedbackField('excellent_usage', text)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>

              {/* Improper Usage */}
              <View style={styles.feedbackFormField}>
                <View style={styles.feedbackFieldHeader}>
                  <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    ⚠️ Improper Usage
                  </Text>
                  <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {feedbackForm.improper_usage.length}/300
                  </Text>
                </View>
                <TextInput
                  style={[styles.feedbackTextInput, { 
                    backgroundColor: theme.colors.surface, 
                    borderColor: theme.colors.border,
                    color: theme.colors.text 
                  }]}
                  placeholder=""
                  placeholderTextColor={theme.colors.textSecondary}
                  value={feedbackForm.improper_usage}
                  onChangeText={(text) => updateFeedbackField('improper_usage', text)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={300}
                />
              </View>

              {/* Suggestions to Improve */}
              <View style={styles.feedbackFormField}>
                <View style={styles.feedbackFieldHeader}>
                  <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    💡 Suggestions to Improve
                  </Text>
                  <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {feedbackForm.suggestions.length}/300
                  </Text>
                </View>
                <TextInput
                  style={[styles.feedbackTextInput, { 
                    backgroundColor: theme.colors.surface, 
                    borderColor: theme.colors.border,
                    color: theme.colors.text 
                  }]}
                  placeholder=""
                  placeholderTextColor={theme.colors.textSecondary}
                  value={feedbackForm.suggestions}
                  onChangeText={(text) => updateFeedbackField('suggestions', text)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={300}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveFeedbackButton,
                  {
                    backgroundColor: hasFeedbackContent() ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={handleSaveFeedback}
                disabled={!hasFeedbackContent() || isSaving}
              >
                <Save size={16} color={hasFeedbackContent() ? "#ffffff" : theme.colors.textSecondary} />
                <Text style={[
                  styles.saveFeedbackButtonText,
                  { color: hasFeedbackContent() ? "#ffffff" : theme.colors.textSecondary }
                ]} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Saving...' : 'Save Feedback'}
                </Text>
              </TouchableOpacity>

              {/* Bottom spacing for mobile */}
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
      <PremiumBookingSuccessModal
        visible={!!bookingSuccessRole}
        roleLabel={bookingSuccessRole ?? ''}
        onClose={() => setBookingSuccessRole(null)}
      />
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
  headerSpacer: {
    width: 40,
  },
  headerInfoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flex: 1,
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
  mainBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  scrollMain: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  contentTop: {
    width: '100%',
    alignItems: 'stretch',
  },
  /** One unified bottom panel — same as General Evaluator / Educational Corner */
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
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
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
  /** Flat Notion-style header — same as General Evaluator Report */
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
  consolidatedAvatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.4,
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
  meetingCardMetaCompact: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meetingCardMetaModeLine: {
    marginTop: 3,
  },
  tabContentWrapper: {
    flex: 1,
  },
  /** Sub-tabs under Grammarian Corner (Pre meeting / Live meeting) */
  cornerPhaseTabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cornerPhaseTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  cornerPhaseTabActive: {
    borderBottomWidth: 2,
  },
  cornerPhaseTabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cornerPhaseTabTextActive: {
    fontWeight: '700',
  },
  liveMeetingVisibilityCard: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryVisibilityRow: {
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
  viewOnlyBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  viewOnlyBannerText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  unpublishedReportTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    zIndex: 0,
  },
  assignedGrammarianSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  preMeetingSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  preMeetingHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  preMeetingIconsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  preMeetingIconCard: {
    flex: 1,
    borderRadius: 0,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  preMeetingIconCardPending: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  preMeetingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  preMeetingIconLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  liveSegmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 0,
    borderWidth: 1,
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  liveSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 0,
    gap: 5,
    width: '100%',
    borderWidth: 0,
  },
  liveSegmentTabActive: {
    borderWidth: 0,
  },
  liveSegmentTabText: {
    fontSize: 11,
  },
  liveSegmentDivider: {
    width: 1,
    alignSelf: 'stretch',
    opacity: 1,
  },
  liveSegmentHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  inlineLiveMeetingPanel: {
    marginTop: 12,
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  preMeetingPendingDot: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  assignedGrammarianCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedGrammarianInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assignedGrammarianAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    overflow: 'hidden',
  },
  assignedGrammarianAvatarImage: {
    width: '100%',
    height: '100%',
  },
  assignedGrammarianDetails: {
    flex: 1,
  },
  prepSpaceIconButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
  },
  toastmasterActionWrapper: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    marginLeft: 10,
  },
  toastmasterActionHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#f97316',
    textAlign: 'center',
    lineHeight: 15,
    letterSpacing: -0.2,
  },
  assignedGrammarianName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
    color: '#1f2937',
  },
  assignedGrammarianRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  unlockWordsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockWordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlockWordsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  unlockWordsInfo: {
    flex: 1,
  },
  unlockWordsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  unlockWordsSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  dailyElementsPreview: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  memberSection: {
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
  memberSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberSubtext: {
    fontSize: 14,
  },
  totalSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  totalCount: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCountText: {
    fontSize: 24,
    fontWeight: '900',
  },
  usageTrackingSection: {
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
  usageTrackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  saveUsageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  usageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  usageCard: {
    width: '48%',
    borderRadius: 10,
    padding: 12,
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
  usageLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countDisplay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  countText: {
    fontSize: 16,
    fontWeight: '900',
  },
  memberFeedbackSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
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
  memberFeedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addFeedbackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  feedbackPreviewGrid: {
    gap: 12,
  },
  feedbackPreviewCard: {
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  feedbackPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  feedbackPreviewText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noFeedbackState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noFeedbackText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  noAssignmentState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
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
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
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
  assignModalHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  comingSoonContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    marginHorizontal: 16,
    marginTop: 16,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 26,
  },
  addWordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  addWordButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addWordButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  grammarianRoleCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  grammarianRoleIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  grammarianRoleTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  grammarianRoleBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  wordPlaceholderContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  wordPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  wordPlaceholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  wordPlaceholderSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  grammarianInfoModalCard: {
    width: '90%',
    maxWidth: 520,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: '78%',
  },
  grammarianInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  grammarianInfoScroll: {
    maxHeight: 420,
  },
  grammarianInfoText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  grammarianInfoCloseBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  grammarianInfoCloseBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  fullScreenModal: {
    flex: 1,
  },
  fullScreenModalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  modalIconImage: {
    width: 40,
    height: 40,
  },
  modalIconInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  closeButton: {
    padding: 4,
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
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 6,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '500',
  },
  saveFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveFormButtonText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  memberModal: {
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
  membersList: {
    maxHeight: 400,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  memberOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberOptionAvatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  memberOptionInfo: {
    flex: 1,
  },
  memberOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberOptionEmail: {
    fontSize: 13,
  },
  feedbackFormField: {
    marginBottom: 24,
  },
  feedbackFieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackFieldLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  feedbackTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 80,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  saveFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  saveFeedbackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalBottomSpacing: {
    height: 40,
  },
  wordOfTheDayContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  wordOfTheDayHeader: {
    backgroundColor: '#800000',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  wordOfTheDayHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordOfTheDayIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  wordOfTheDayHeaderTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  wordOfTheDayContent: {
    padding: 26,
    flexDirection: 'column',
  },
  wordOfTheDayWordContainer: {
    marginBottom: 29,
    paddingTop: 6,
  },
  wordOfTheDayWord: {
    fontSize: 30,
    fontWeight: '700',
    color: '#8B1A1A',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  wordOfTheDayPartOfSpeechBadge: {
    backgroundColor: '#D4A574',
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  wordOfTheDayPartOfSpeech: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    textTransform: 'lowercase',
  },
  wordOfTheDaySection: {
    marginBottom: 19,
  },
  wordOfTheDaySectionLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#A0826D',
    marginBottom: 8,
  },
  wordOfTheDayText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  wordOfTheDayUsageText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  wordOfTheDayFooterSection: {
    marginTop: 24,
  },
  wordOfTheDayDivider: {
    height: 2,
    backgroundColor: '#D4A574',
    marginTop: 13,
    marginBottom: 19,
  },
  wordOfTheDayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordOfTheDayAvatarContainer: {
    marginRight: 12,
  },
  wordOfTheDayAvatar: {
    width: 55,
    height: 55,
    borderRadius: 28,
  },
  wordOfTheDayAvatarPlaceholder: {
    width: 55,
    height: 55,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordOfTheDayAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  wordOfTheDayPublisherInfo: {
    flex: 1,
  },
  wordOfTheDayPublishedBy: {
    fontSize: 14,
    marginBottom: 4,
  },
  wordOfTheDayPublisherName: {
    fontWeight: '600',
  },
  wordOfTheDayPublishedDate: {
    fontSize: 14,
    marginTop: 4,
  },
  wordOfTheDayFooterDivider: {
    height: 1,
    backgroundColor: '#D4A574',
    marginVertical: 16,
  },
  wordOfTheDayClubNameFull: {
    fontSize: 14,
    marginTop: 4,
  },
  wordOfTheDayClubName: {
    fontSize: 14,
    marginTop: 4,
  },
  wordOfTheDayDateTime: {
    fontSize: 13,
    lineHeight: 18,
  },
  publishSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  publishInfo: {
    flex: 1,
    marginRight: 16,
  },
  publishTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  publishSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  publishButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  publishButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  prepSpaceCard: {
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
  prepSpaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  prepSpaceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prepSpaceInfo: {
    flex: 1,
  },
  prepSpaceTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  prepSpaceSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  prepSpaceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
  },
  prepSpaceButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  slideWrapper: {
    width: '100%',
    paddingHorizontal: 16,
  },
  slideContainer: {
    paddingHorizontal: 0,
    width: '100%',
  },
  dailyElementsTabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  dailyElementsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  dailyElementsTabActive: {
    borderBottomColor: '#1E40AF',
  },
  dailyElementsTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  dailyElementsTabTextActive: {
    color: '#1E40AF',
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: 16,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  summaryCardContainer: {
    padding: 16,
    paddingTop: 24,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 20,
  },
  summaryCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eef0fd',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryCardTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  summaryCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 22,
  },
  summaryCardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#4f6ef7',
    shadowColor: '#4f6ef7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryCardButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryRedirectContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  summaryRedirectContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  summaryIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  summaryRedirectTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryRedirectDescription: {
    fontSize: 14,
    marginBottom: 0,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryRedirectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRedirectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
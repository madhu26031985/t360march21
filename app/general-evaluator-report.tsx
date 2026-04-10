import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import { fetchGeneralEvaluatorReportBundle, generalEvaluatorReportQueryKeys } from '@/lib/generalEvaluatorReportQuery';
import { getRoleColor, formatRole } from '@/lib/roleUtils';
import { ArrowLeft, Calendar, Star, X, NotebookPen, FileText, Users, RotateCcw, ClipboardCheck, Search, Vote } from 'lucide-react-native';
import { Crown, User, Shield, Eye, EyeOff, UserCheck } from 'lucide-react-native';

const FOOTER_NAV_ICON_SIZE = 15;

/** General Evaluator Corner ratings use a 1–10 scale per question. */
const GE_RATING_MIN = 1;
const GE_RATING_MAX = 10;

/** Amazon-style rating stars (filled yellow / gray empty). */
const GE_STAR_FILL = '#FFC940';
const GE_STAR_STROKE = '#E47911';
const GE_STAR_EMPTY_STROKE = '#D5D4D4';

/** Notion-style palette (light) — text, muted, accent blue, page background. */
const NOTION_TEXT = '#37352F';
const NOTION_TEXT_MUTED = '#787774';
const NOTION_ACCENT = '#2383E2';
const NOTION_PAGE_BG = '#FBFBFA';
const NOTION_SURFACE = '#FFFFFF';
const NOTION_DIVIDER = 'rgba(55, 53, 47, 0.09)';

const NOTION_FONT_FAMILY =
  Platform.OS === 'web'
    ? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
    : undefined;

/** Map a 1–10 per-question score to 0–5 stars (10 → 5, 9 → 4.5, 8 → 4). */
function geTenPointToStars(score: number | null | undefined): number {
  if (score == null || typeof score !== 'number' || !Number.isFinite(score)) return 0;
  const s = Math.max(GE_RATING_MIN, Math.min(GE_RATING_MAX, score));
  return s / 2;
}

/** Map total score vs max (e.g. 100/100) to 0–5 stars for the summary header. */
function geTotalToStars(total: number, maxTotal: number): number {
  if (maxTotal <= 0 || !Number.isFinite(total)) return 0;
  return Math.min(5, Math.max(0, (total / maxTotal) * 5));
}

function GeFiveStarRow({
  rating,
  size = 16,
  filledColor = GE_STAR_FILL,
  emptyStrokeColor = GE_STAR_EMPTY_STROKE,
  strokeColor = GE_STAR_STROKE,
}: {
  rating: number;
  size?: number;
  /** Interior fill for scored portion (Amazon-style yellow). */
  filledColor?: string;
  /** Outline for empty / background stars. */
  emptyStrokeColor?: string;
  /** Outline on filled stars (slightly darker). */
  strokeColor?: string;
}) {
  const clamped = Math.min(5, Math.max(0, rating));
  return (
    <View style={geFiveStarRowStyles.row}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i));
        return (
          <View key={i} style={{ width: size, height: size }} collapsable={false}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}>
              <Star
                size={size}
                color={emptyStrokeColor}
                fill="none"
                stroke={emptyStrokeColor}
                strokeWidth={1.25}
              />
            </View>
            {fill > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size * fill,
                  height: size,
                  overflow: 'hidden',
                }}
              >
                <Star
                  size={size}
                  color={strokeColor}
                  fill={filledColor}
                  stroke={strokeColor}
                  strokeWidth={1}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const geFiveStarRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});

function normalizeStoredGeRating(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n >= GE_RATING_MIN && n <= GE_RATING_MAX) return n;
  if (n >= 0 && n <= 9) return n + 1;
  return null;
}

const getRoleIcon = (role: string) => {
  switch (role.toLowerCase()) {
    case 'excomm': return <Crown size={12} color="#ffffff" />;
    case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
    case 'club_leader': return <Shield size={12} color="#ffffff" />;
    case 'guest': return <Eye size={12} color="#ffffff" />;
    case 'member': return <User size={12} color="#ffffff" />;
    default: return <User size={12} color="#ffffff" />;
  }
};

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

function formatTimeForDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function meetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** e.g. "April 4 | Sat | 19:30 - 20:30 | In Person" — matches Toastmaster Corner */
function formatConsolidatedMeetingMetaSingleLine(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeForDisplay(m.meeting_start_time)} - ${formatTimeForDisplay(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeForDisplay(m.meeting_start_time));
  }
  parts.push(meetingModeLabel(m));
  return parts.join(' | ');
}

interface GeneralEvaluator {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string; // Added booking_status to GeneralEvaluator interface
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface GeneralEvaluatorData {
  id: string;
  meeting_id: string;
  club_id: string;
  evaluator_user_id: string;
  personal_notes: string | null;
  evaluation_summary: string | null; // Added
  what_went_well: string | null; // Added
  what_needs_improvement: string | null; // Added
  evaluation_data: any; // Added
  is_completed: boolean; // Added
  submitted_at: string | null; // Added
  summary_visible_to_members?: boolean | null;
  created_at: string;
  updated_at: string;
}

interface EvaluationQuestion {
  id: string;
  title: string;
  description: string;
}

interface FeedbackForm {
  summary: string;
  whatWentWell: string;
  whatNeedsImprovement: string;
}
export default function GeneralEvaluatorReport() {
  const { theme } = useTheme();
  const notion =
    theme.mode === 'light'
      ? {
          text: NOTION_TEXT,
          muted: NOTION_TEXT_MUTED,
          accent: NOTION_ACCENT,
          divider: NOTION_DIVIDER,
          surface: NOTION_SURFACE,
          page: NOTION_PAGE_BG,
        }
      : {
          text: theme.colors.text,
          muted: theme.colors.textSecondary,
          accent: theme.colors.primary,
          divider: theme.colors.border,
          surface: theme.colors.surface,
          page: theme.colors.background,
        };
  const notionType = NOTION_FONT_FAMILY ? ({ fontFamily: NOTION_FONT_FAMILY } as const) : {};
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [generalEvaluator, setGeneralEvaluator] = useState<GeneralEvaluator | null>(null);
  const [clubInfo, setClubInfo] = useState<{ id: string; name: string; club_number: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, number | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    summary: '',
    whatWentWell: '',
    whatNeedsImprovement: '',
  });
  const [existingEvaluation, setExistingEvaluation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'feedback'>('categories');
  const [bookingGeRole, setBookingGeRole] = useState(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showAssignGeModal, setShowAssignGeModal] = useState(false);
  const [assignGeSearch, setAssignGeSearch] = useState('');
  const [assigningGeRole, setAssigningGeRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [clubMembersLoading, setClubMembersLoading] = useState(false);
  /** When false, regular members do not see scores on the Summary tab (GE and VPE always do). */
  const [summaryVisibleToMembers, setSummaryVisibleToMembers] = useState(true);
  const [supportsSummaryVisibilityColumn, setSupportsSummaryVisibilityColumn] = useState(true);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  /** Always call latest loader from focus effect (withdraw/book flows update DB without remounting this screen). */
  const loadGeneralEvaluatorDataRef = useRef<() => Promise<void>>(async () => {});

  const evaluationQuestions: EvaluationQuestion[] = [
    {
      id: 'q1_preparation_setup',
      title: '1. Meeting Prep & Setup',
      description: 'Was the meeting well-prepared (venue, agenda, and roles assigned in advance)?',
    },
    {
      id: 'q2_opening_quality',
      title: '2. Meeting Opening',
      description: 'Did the meeting start on time with an engaging and confident opening?',
    },
    {
      id: 'q3_guest_experience',
      title: '3. Guest Experience',
      description: 'Were guests warmly welcomed, introduced, and made comfortable?',
    },
    {
      id: 'q4_meeting_leadership',
      title: '4. Meeting Leadership',
      description: 'Did the Toastmaster clearly manage the theme, flow, and transitions?',
    },
    {
      id: 'q5_role_execution',
      title: '5. Role Execution',
      description: 'Did supporting roles (Timer, Ah-Counter, Grammarian, Table Topics Master) perform effectively?',
    },
    {
      id: 'q6_speaker_intro_support',
      title: '6. Speaker Effectiveness',
      description: 'How effectively were speakers prepared, introduced, and supported?',
    },
    {
      id: 'q7_time_discipline',
      title: '7. Time Management',
      description: 'Did speakers and segments stay within the allotted time?',
    },
    {
      id: 'q8_evaluation_quality',
      title: '8. Evaluation Quality',
      description: 'Were evaluations constructive, specific, and helpful (with examples)?',
    },
    {
      id: 'q9_flow_feedback_collection',
      title: '9. Feedback collection',
      description: 'Was the meeting well-paced, and were feedback/comments gathered from guests and visiting Toastmasters?',
    },
    {
      id: 'q10_overall_experience',
      title: '10. Overall Experience',
      description: 'Was the meeting engaging, well-organized, and valuable for members and guests?',
    },
  ];

  useFocusEffect(
    useCallback(() => {
      if (!meetingId || !user?.currentClubId) {
        setIsLoading(false);
        return;
      }
      const uid = user?.id ?? 'anon';
      /** Drop cached snapshot so Book a Role / visibility changes show current data. */
      queryClient.removeQueries({
        queryKey: generalEvaluatorReportQueryKeys.snapshot(meetingId, user.currentClubId, uid),
      });
      void loadGeneralEvaluatorDataRef.current();
    }, [meetingId, user?.currentClubId, user?.id, queryClient])
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave();
    }, 2000);

    return () => clearTimeout(timer);
  }, [responses, feedbackForm]);

  const loadGeneralEvaluatorData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    if (loadInFlightRef.current) {
      return loadInFlightRef.current;
    }

    const run = async () => {
      try {
        const effectiveUserId = user?.id ?? '';
        // Prefer single RPC (get_general_evaluator_report_snapshot) → one round-trip vs 4+ parallel REST calls.
        // Club roster for “Assign GE” still loads on demand via loadClubMembers().
        const bundle = await queryClient.fetchQuery({
          queryKey: generalEvaluatorReportQueryKeys.snapshot(
            meetingId,
            user.currentClubId,
            effectiveUserId || 'anon'
          ),
          queryFn: () => fetchGeneralEvaluatorReportBundle(meetingId, user.currentClubId, effectiveUserId),
          staleTime: 0,
        });
        setMeeting(bundle.meeting as Meeting | null);
        setClubInfo(bundle.clubInfo);
        setIsVPEClub(bundle.isVPEClub);
        setGeneralEvaluator(bundle.generalEvaluator as GeneralEvaluator | null);

        if (bundle.geReport) {
          const data = bundle.geReport as GeneralEvaluatorData;
          setExistingEvaluation(data);
          setSummaryVisibleToMembers(data.summary_visible_to_members !== false);
          setFeedbackForm({
            summary: data.evaluation_summary || '',
            whatWentWell: data.what_went_well || '',
            whatNeedsImprovement: data.what_needs_improvement || '',
          });
          if (data.evaluation_data && typeof data.evaluation_data === 'object') {
            const incoming = data.evaluation_data as Record<string, unknown>;
            const normalized: Record<string, number | null> = {};
            for (const q of evaluationQuestions) {
              normalized[q.id] = normalizeStoredGeRating(incoming?.[q.id]);
            }
            setResponses(normalized);
          } else {
            setResponses({});
          }
        } else {
          setExistingEvaluation(null);
          setSummaryVisibleToMembers(true);
          setFeedbackForm({
            summary: '',
            whatWentWell: '',
            whatNeedsImprovement: '',
          });
          setResponses({});
        }
      } catch (error) {
        console.error('Error loading general evaluator data:', error);
        Alert.alert('Error', 'Failed to load general evaluator data');
      } finally {
        setIsLoading(false);
        loadInFlightRef.current = null;
      }
    };

    loadInFlightRef.current = run();
    return loadInFlightRef.current;
  };

  const handleBookGeneralEvaluatorInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingGeRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%general evaluator%' },
        'General Evaluator is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadGeneralEvaluatorData();
        setBookingSuccessRole('General Evaluator');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingGeRole(false);
    }
  };

  /** Assign-GE modal only: RPC avoids slow PostgREST embed on app_club_user_relationship (see evaluation-corner). */
  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;
    setClubMembersLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_club_member_directory', {
        target_club_id: user.currentClubId,
      });
      if (!rpcError && rpcData) {
        const rows = rpcData as { user_id: string; full_name: string; email: string; avatar_url: string | null }[];
        const members: ClubMember[] = rows.map((row) => ({
          id: row.user_id,
          full_name: row.full_name,
          email: row.email,
          avatar_url: row.avatar_url,
        }));
        members.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setClubMembers(members);
        return;
      }
      if (rpcError) {
        console.warn('get_club_member_directory failed, falling back to relationship query:', rpcError.message);
      }
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
        .map((item: any) => {
          const p = item.app_user_profiles;
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
    } catch (e) {
      console.error('Error loading club members:', e);
    } finally {
      setClubMembersLoading(false);
    }
  };

  const handleAssignGeToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningGeRole(true);
    try {
      const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%general evaluator%' });
      if (!roleId) {
        Alert.alert('Error', 'No open General Evaluator role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignGeModal(false);
        setAssignGeSearch('');
        await loadGeneralEvaluatorData();
        Alert.alert('Assigned', `${member.full_name} is now the General Evaluator for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
      }
    } finally {
      setAssigningGeRole(false);
    }
  };

  const filteredMembersForAssignGe = clubMembers.filter((member) => {
    const q = assignGeSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  const loadExistingEvaluation = async (evaluatorUserId: string) => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_ge')
        .select('*') // Select all columns including personal_notes, evaluation_summary etc.
        .eq('meeting_id', meetingId)
        .eq('evaluator_user_id', evaluatorUserId)
        .eq('booking_status', 'booked') // Only load if the report is from a booked GE
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading existing evaluation for assigned GE:', error);
        return;
      }

      if (data) {
        setExistingEvaluation(data as GeneralEvaluatorData);
        setSummaryVisibleToMembers(data.summary_visible_to_members !== false);
        setFeedbackForm({
          summary: data.evaluation_summary || '',
          whatWentWell: data.what_went_well || '',
          whatNeedsImprovement: data.what_needs_improvement || '',
        });
        if (data.evaluation_data && typeof data.evaluation_data === 'object') {
          const incoming = data.evaluation_data as Record<string, unknown>;
          const normalized: Record<string, number | null> = {};
          for (const q of evaluationQuestions) {
            normalized[q.id] = normalizeStoredGeRating(incoming?.[q.id]);
          }
          setResponses(normalized);
        }
      } else {
        setExistingEvaluation(null);
        setSummaryVisibleToMembers(true);
        setFeedbackForm({
          summary: '',
          whatWentWell: '',
          whatNeedsImprovement: '',
        });
        setResponses({});
      }
    } catch (error) {
      console.error('Error loading evaluation for assigned GE:', error);
    }
  };

  /** Reload GE report from the snapshot after persist (correct for VPE: row is under assigned GE user id). */
  const refreshGeReportAfterSave = async () => {
    if (!meetingId || !user?.currentClubId) return;
    await queryClient.invalidateQueries({
      queryKey: generalEvaluatorReportQueryKeys.snapshot(meetingId, user.currentClubId, user?.id ?? 'anon'),
    });
    loadInFlightRef.current = null;
    await loadGeneralEvaluatorData();
  };

  // Access control helpers
  const isGeneralEvaluator = () => {
    return generalEvaluator?.assigned_user_id === user?.id && generalEvaluator?.booking_status === 'booked';
  };
  const canAccessGeneralEvaluatorCorner = isGeneralEvaluator() || isVPEClub;
  const canEditGeneralEvaluatorCorner = canAccessGeneralEvaluatorCorner;
  const isGeRoleBooked = generalEvaluator?.booking_status === 'booked';

  /** Members (not assigned GE / not VPE) poll visibility so the Summary tab reacts when the eye is turned off. */
  useEffect(() => {
    if (!meetingId || !generalEvaluator?.assigned_user_id) return;
    const isAssignedGe =
      !!user?.id &&
      generalEvaluator.assigned_user_id === user.id &&
      generalEvaluator.booking_status === 'booked';
    if (isAssignedGe || isVPEClub) return;

    const evalUid = generalEvaluator.assigned_user_id;
    let cancelled = false;

    const pollVisibility = async () => {
      const { data, error } = await supabase
        .from('app_meeting_ge')
        .select('summary_visible_to_members')
        .eq('meeting_id', meetingId)
        .eq('evaluator_user_id', evalUid)
        .maybeSingle();
      if (cancelled || error) return;
      const row = data as { summary_visible_to_members?: boolean } | null;
      if (row && typeof row.summary_visible_to_members === 'boolean') {
        setSummaryVisibleToMembers(row.summary_visible_to_members !== false);
      }
    };

    void pollVisibility();
    const interval = setInterval(pollVisibility, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [meetingId, generalEvaluator?.assigned_user_id, generalEvaluator?.booking_status, isVPEClub, user?.id]);

  const isMissingSummaryVisibilityColumnError = (error: any): boolean => {
    const message = String(error?.message ?? '').toLowerCase();
    return (error?.code === 'PGRST204' || error?.code === '42703') && message.includes('summary_visible_to_members');
  };

  const handleSummaryVisibilityChange = async (visible: boolean) => {
    if (!canEditGeneralEvaluatorCorner || !meetingId || !user?.currentClubId) return;
    const previous = summaryVisibleToMembers;
    setSummaryVisibleToMembers(visible);
    if (!existingEvaluation?.id) {
      return;
    }
    const { error } = await supabase
      .from('app_meeting_ge')
      .update({
        summary_visible_to_members: visible,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', existingEvaluation.id);
    if (error) {
      if (isMissingSummaryVisibilityColumnError(error)) {
        setSupportsSummaryVisibilityColumn(false);
        Alert.alert('Migration pending', 'Visibility toggle will work after DB migration is run.');
        return;
      }
      console.error('Error updating GE summary visibility:', error);
      setSummaryVisibleToMembers(previous);
      Alert.alert('Error', 'Could not update member visibility. Please try again.');
      return;
    }
    setExistingEvaluation((prev) => (prev ? { ...prev, summary_visible_to_members: visible } : prev));
    void queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) &&
        q.queryKey[0] === 'general-evaluator-report-snapshot' &&
        q.queryKey[1] === meetingId,
    });
  };

  const handleRatingChange = (questionId: string, rating: number) => {
    if (!canEditGeneralEvaluatorCorner) {
      Alert.alert('Access Denied', 'Only the assigned General Evaluator or VPE can mark this evaluation.');
      return;
    }
    
    setResponses(prev => ({
      ...prev,
      [questionId]: rating
    }));
  };

  const updateFeedbackField = (field: keyof FeedbackForm, value: string) => {
    // Update character limit to match database (1200 characters)
    if (value.length <= 1200) { 
      setFeedbackForm(prev => ({ ...prev, [field]: value }));
    }
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };
  const getScoreLabel = (score: number | null): 'Needs Improvement' | 'Average' | 'Excellent' | 'Not rated' => {
    if (score == null) return 'Not rated';
    if (score <= 3) return 'Needs Improvement';
    if (score <= 6) return 'Average';
    return 'Excellent';
  };

  const getCompletionStats = () => {
    const totalQuestions = evaluationQuestions.length;
    const answeredQuestions = evaluationQuestions.filter((q) => typeof responses[q.id] === 'number').length;
    // Ensure hasFeedback is true if any of the text fields have content after trimming
    const hasFeedback = 
      (feedbackForm.summary && feedbackForm.summary.trim().length > 0) || 
      (feedbackForm.whatWentWell && feedbackForm.whatWentWell.trim().length > 0) || 
      (feedbackForm.whatNeedsImprovement && feedbackForm.whatNeedsImprovement.trim().length > 0);
    
    return { totalQuestions, answeredQuestions, hasFeedback };
  };

  const handleSaveEvaluation = async () => {
    if (!canEditGeneralEvaluatorCorner) {
      Alert.alert('Access Denied', 'Only the assigned General Evaluator or VPE can save this evaluation.');
      return;
    }

    if (!generalEvaluator || generalEvaluator.booking_status !== 'booked') {
      Alert.alert(
        'General Evaluator not booked',
        'Assign or book the General Evaluator role before saving this report.'
      );
      return;
    }

    const { answeredQuestions, hasFeedback } = getCompletionStats();

    if (answeredQuestions === 0 && !hasFeedback) {
      Alert.alert('No Content', 'Please answer at least one question or provide feedback before saving.');
      return;
    }

    setIsSaving(true);

    try {
      if (!meetingId || !user?.currentClubId) {
        Alert.alert('Error', 'Missing required information');
        return;
      }

      const saveData: Record<string, any> = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        evaluator_user_id: generalEvaluator?.assigned_user_id || user.id,
        booking_status: 'booked',
        evaluation_data: responses,
        evaluation_summary: feedbackForm.summary.trim() || null,
        what_went_well: feedbackForm.whatWentWell.trim() || null,
        what_needs_improvement: feedbackForm.whatNeedsImprovement.trim() || null,
        is_completed: answeredQuestions > 0 || hasFeedback, // Ensure this is true if any feedback is present
        submitted_at: new Date().toISOString(),
      };
      if (supportsSummaryVisibilityColumn) {
        saveData.summary_visible_to_members = summaryVisibleToMembers;
      }

      if (existingEvaluation) {
        // Update existing evaluation
        const { error } = await supabase
          .from('app_meeting_ge')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingEvaluation.id);

        if (error) {
          if (isMissingSummaryVisibilityColumnError(error)) {
            setSupportsSummaryVisibilityColumn(false);
            const fallbackData = { ...saveData };
            delete fallbackData.summary_visible_to_members;
            const { error: fallbackError } = await supabase
              .from('app_meeting_ge')
              .update({
                ...fallbackData,
                updated_at: new Date().toISOString(),
              } as any)
              .eq('id', existingEvaluation.id);
            if (!fallbackError) {
              Alert.alert('Success', 'General Evaluator Report updated successfully!');
              await refreshGeReportAfterSave();
              return;
            }
          }
          console.error('Error updating evaluation:', error);
          Alert.alert('Error', 'Failed to update evaluation report');
          return;
        }

        Alert.alert('Success', 'General Evaluator Report updated successfully!');
      } else {
        // Create new evaluation
        const { error } = await supabase
          .from('app_meeting_ge')
          .insert({
            ...saveData,
            created_at: new Date().toISOString(),
          } as any);

        if (error) {
          if (isMissingSummaryVisibilityColumnError(error)) {
            setSupportsSummaryVisibilityColumn(false);
            const fallbackData = { ...saveData };
            delete fallbackData.summary_visible_to_members;
            const { error: fallbackError } = await supabase
              .from('app_meeting_ge')
              .insert({
                ...fallbackData,
                created_at: new Date().toISOString(),
              } as any);
            if (!fallbackError) {
              Alert.alert('Success', 'General Evaluator Report saved successfully!');
              await refreshGeReportAfterSave();
              return;
            }
          }
          console.error('Error creating evaluation:', error);
          Alert.alert('Error', 'Failed to save evaluation report');
          return;
        }

        Alert.alert('Success', 'General Evaluator Report saved successfully!');
      }

      await refreshGeReportAfterSave();
    } catch (error) {
      console.error('Error saving evaluation:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const autoSave = async () => {
    if (!canEditGeneralEvaluatorCorner || !meetingId || !user?.currentClubId) {
      return;
    }

    if (!generalEvaluator || generalEvaluator.booking_status !== 'booked') {
      return;
    }

    const { answeredQuestions, hasFeedback } = getCompletionStats();

    if (answeredQuestions === 0 && !hasFeedback) {
      return;
    }

    try {
      const saveData: Record<string, any> = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        evaluator_user_id: generalEvaluator?.assigned_user_id || user.id,
        booking_status: 'booked',
        evaluation_data: responses,
        evaluation_summary: feedbackForm.summary.trim() || null,
        what_went_well: feedbackForm.whatWentWell.trim() || null,
        what_needs_improvement: feedbackForm.whatNeedsImprovement.trim() || null,
        is_completed: answeredQuestions > 0 || hasFeedback,
        submitted_at: new Date().toISOString(),
      };
      if (supportsSummaryVisibilityColumn) {
        saveData.summary_visible_to_members = summaryVisibleToMembers;
      }

      if (existingEvaluation) {
        const { error } = await supabase
          .from('app_meeting_ge')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingEvaluation.id);
        if (error && isMissingSummaryVisibilityColumnError(error)) {
          setSupportsSummaryVisibilityColumn(false);
          const fallbackData = { ...saveData };
          delete fallbackData.summary_visible_to_members;
          await supabase
            .from('app_meeting_ge')
            .update({
              ...fallbackData,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', existingEvaluation.id);
        }
      } else {
        const { error } = await supabase
          .from('app_meeting_ge')
          .insert({
            ...saveData,
            created_at: new Date().toISOString(),
          } as any);
        if (error && isMissingSummaryVisibilityColumnError(error)) {
          setSupportsSummaryVisibilityColumn(false);
          const fallbackData = { ...saveData };
          delete fallbackData.summary_visible_to_members;
          await supabase
            .from('app_meeting_ge')
            .insert({
              ...fallbackData,
              created_at: new Date().toISOString(),
            } as any);
        }

        await refreshGeReportAfterSave();
      }
    } catch (error) {
      console.error('Error auto-saving evaluation:', error);
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

  const geTotalMax = evaluationQuestions.length * GE_RATING_MAX;
  /** Icons sit inside the single bottom dock — no per-tile boxes. */
  const footerIconTileStyle = {
    borderWidth: 0,
    backgroundColor: 'transparent',
  } as const;
  const totalScore = evaluationQuestions.reduce((sum, q) => sum + (typeof responses[q.id] === 'number' ? (responses[q.id] as number) : 0), 0);
  const overallScoreOutOfFive = geTotalToStars(totalScore, geTotalMax);
  const getOverallRating = (score: number): 'Excellent' | 'Good' | 'Needs Improvement' => {
    if (score >= Math.round((56 / 72) * geTotalMax)) return 'Excellent';
    if (score >= Math.round((36 / 72) * geTotalMax)) return 'Good';
    return 'Needs Improvement';
  };

  // Summary tab score visibility is controlled only by the members toggle.
  const showGeSummaryToViewer = summaryVisibleToMembers;

  const renderGeTotalScoreCard = () => {
    const overallStarRating = geTotalToStars(totalScore, geTotalMax);
    const emptyStarStroke = theme.mode === 'dark' ? '#6b7280' : GE_STAR_EMPTY_STROKE;
    return (
      <View style={[styles.summaryCard, { backgroundColor: notion.surface, borderBottomColor: notion.divider }]}>
        <View style={styles.summaryCardTopRow}>
          <View style={styles.summaryScoreTexts}>
            <View style={styles.overallRatingRow}>
              <Text
                style={[styles.summaryText, styles.overallRatingLabel, notionType, { color: notion.text }]}
                maxFontSizeMultiplier={1.2}
              >
                Overall Rating: {getOverallRating(totalScore)}
              </Text>
              <GeFiveStarRow rating={overallStarRating} size={20} emptyStrokeColor={emptyStarStroke} />
            </View>
          </View>
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (!canAccessGeneralEvaluatorCorner && activeTab !== 'feedback') {
      setActiveTab('feedback');
    }
  }, [canAccessGeneralEvaluatorCorner, activeTab]);

  const RatingCard = ({ question }: { question: EvaluationQuestion }) => {
    const current = responses[question.id];
    return (
      <View style={[styles.ratingCard, { backgroundColor: notion.surface, borderBottomColor: notion.divider }]}>
        <Text style={[styles.ratingCardTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.3}>
          {question.title}
        </Text>
        <Text style={[styles.ratingCardDesc, notionType, { color: notion.muted }]} maxFontSizeMultiplier={1.2}>
          {question.description}
        </Text>

        <View style={styles.sliderRow}>
          {Array.from({ length: 10 }, (_, i) => {
            const value = i + GE_RATING_MIN;
            return (
              <Pressable
                key={`${question.id}-${value}`}
                style={[
                  styles.sliderStep,
                  {
                    backgroundColor: current != null && value <= current ? notion.accent : theme.mode === 'light' ? 'rgba(55, 53, 47, 0.08)' : '#E5E7EB',
                  },
                ]}
                onPress={() => handleRatingChange(question.id, value)}
              />
            );
          })}
        </View>

        <View style={styles.scaleRow}>
          {Array.from({ length: 10 }, (_, i) => {
            const value = i + GE_RATING_MIN;
            return (
              <Text key={`${question.id}-scale-${value}`} style={[styles.scaleTick, notionType, { color: notion.muted }]} maxFontSizeMultiplier={1.1}>
                {value}
              </Text>
            );
          })}
        </View>

        <View style={styles.ratingMetaRow}>
          <Text style={[styles.selectedValue, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.2}>
            Selected: {current == null ? '-' : `${current}/${GE_RATING_MAX}`}
          </Text>
          <Text style={[styles.scoreBadge, { color: notion.accent }]} maxFontSizeMultiplier={1.2}>
            {getScoreLabel(current)}
          </Text>
        </View>
      </View>
    );
  };

  loadGeneralEvaluatorDataRef.current = loadGeneralEvaluatorData;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: notion.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.3}>Loading General Evaluator Report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: notion.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: notion.accent, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { totalQuestions, answeredQuestions, hasFeedback } = getCompletionStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: notion.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.kavInner}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: notion.surface, borderBottomColor: notion.divider }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={notion.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.3}>General Evaluator Report</Text>
        <View style={styles.infoButton} />
      </View>

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 8 }]}
      >
        <View style={styles.contentTop} nativeID="general-evaluator-report-content">
        {/* General Evaluator Assignment Section — layout matches Educational Corner */}
        {generalEvaluator?.assigned_user_id && generalEvaluator.app_user_profiles ? (
          <View
            style={[
              styles.consolidatedCornerCard,
              {
                backgroundColor: notion.page,
                borderBottomColor: notion.divider,
                marginTop: 12,
              },
            ]}
          >
            <View style={styles.consolidatedClubBadge}>
              <Text
                style={[
                  styles.consolidatedClubTitle,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {clubInfo?.name || 'Club'}
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
                {generalEvaluator.app_user_profiles.avatar_url ? (
                  <Image
                    source={{ uri: generalEvaluator.app_user_profiles.avatar_url }}
                    style={styles.consolidatedAvatarImage}
                  />
                ) : (
                  <User size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {generalEvaluator.app_user_profiles.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  notionType,
                  { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                General evaluator
              </Text>
            </View>

            {isGeRoleBooked && (
              <>
                <View style={[styles.consolidatedBottomDivider, { backgroundColor: notion.divider }]} />
                <View style={styles.consolidatedMeetingMetaBlock}>
                  <Text
                    style={[
                      styles.consolidatedMeetingMetaSingle,
                      notionType,
                      { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {formatConsolidatedMeetingMetaSingleLine(meeting)}
                  </Text>
                </View>
              </>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.noAssignmentNotionCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
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
                  {formatMeetingMode(meeting.meeting_mode)}
                </Text>
              </View>
            </View>
            <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.noToastmasterCard}>
              <View style={[styles.noToastmasterIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <Star size={32} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.noToastmasterText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Guide the meeting to excellence ⭐
              </Text>
              <Text style={[styles.noToastmasterSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                It's time to become General Evaluator now.
              </Text>
              <TouchableOpacity
                style={[
                  styles.bookRoleButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: bookingGeRole || assigningGeRole ? 0.85 : 1,
                    zIndex: 2,
                  },
                ]}
                onPress={() => handleBookGeneralEvaluatorInline()}
                disabled={bookingGeRole || assigningGeRole}
                delayPressIn={0}
                activeOpacity={0.88}
                hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
              >
                {bookingGeRole ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                    Book GE Role
                  </Text>
                )}
              </TouchableOpacity>
              {isVPEClub ? (
                <TouchableOpacity
                  style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                  onPress={() => {
                    setShowAssignGeModal(true);
                    void loadClubMembers();
                  }}
                  disabled={bookingGeRole || assigningGeRole}
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                    Assign to a member
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.meetingCardDecoration} pointerEvents="none" />
          </View>
        )}

        {/* Tabs/content are available only after GE role is booked */}
        {isGeRoleBooked && (
          <>
            {/* Tab Selector */}
            <View style={[styles.tabContainer, { backgroundColor: notion.page, borderBottomColor: notion.divider }]}>
              {canAccessGeneralEvaluatorCorner && (
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'categories' && styles.activeTab,
                    { borderBottomColor: activeTab === 'categories' ? notion.accent : 'transparent' },
                  ]}
                  onPress={() => setActiveTab('categories')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      notionType,
                      { color: activeTab === 'categories' ? notion.accent : notion.muted },
                    ]}
                    maxFontSizeMultiplier={1.1}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    GE corner
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'feedback' && styles.activeTab,
                  { borderBottomColor: activeTab === 'feedback' ? notion.accent : 'transparent' },
                ]}
                onPress={() => setActiveTab('feedback')}
              >
                <Text
                  style={[
                    styles.tabText,
                    notionType,
                    { color: activeTab === 'feedback' ? notion.accent : notion.muted },
                  ]}
                  maxFontSizeMultiplier={1.1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  GE Summary
                </Text>
              </TouchableOpacity>
            </View>

            {/* Evaluation Categories */}
            {canAccessGeneralEvaluatorCorner && activeTab === 'categories' && (
              <>
                <View style={styles.categoriesSection}>
                  {canEditGeneralEvaluatorCorner && (
                    <View style={[styles.geVisibilityCard, { backgroundColor: notion.surface, borderColor: notion.divider }]}>
                      <View style={styles.geVisibilityLeft}>
                        {summaryVisibleToMembers ? (
                          <Eye size={18} color={notion.accent} />
                        ) : (
                          <EyeOff size={18} color={notion.muted} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.geVisibilityTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.2}>
                            Show GE report to Member
                          </Text>
                          <Text style={[styles.geVisibilityHint, notionType, { color: notion.muted }]} maxFontSizeMultiplier={1.1}>
                            {summaryVisibleToMembers
                              ? 'Members can see GE Summary on screen.'
                              : 'Hidden from members. Only General Evaluator and VPE can view it.'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.geVisibilityButton,
                          {
                            backgroundColor: summaryVisibleToMembers ? notion.accent : notion.page,
                            borderColor: summaryVisibleToMembers ? notion.accent : notion.divider,
                          },
                        ]}
                        onPress={() => handleSummaryVisibilityChange(!summaryVisibleToMembers)}
                      >
                        {summaryVisibleToMembers ? (
                          <Eye size={16} color="#ffffff" />
                        ) : (
                          <EyeOff size={16} color={notion.muted} />
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {renderGeTotalScoreCard()}

                  {evaluationQuestions.map((question) => (
                    <RatingCard key={question.id} question={question} />
                  ))}
                </View>
              </>
            )}

            {activeTab === 'feedback' && (
              <View style={styles.categoriesSection}>
                {showGeSummaryToViewer ? (
                  <>
                    {renderGeTotalScoreCard()}

                    <View style={[styles.scoreSummaryHeader, { backgroundColor: notion.surface, borderColor: notion.divider }]}>
                      <View style={styles.scoreSummaryHeaderTopRow}>
                        <Text style={[styles.scoreSummaryHeaderTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.2}>
                          Final Summary Ratings
                        </Text>
                        <View style={[styles.scoreSummaryValueChip, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                          <Text style={[styles.scoreSummaryValueChipText, { color: notion.accent }]} maxFontSizeMultiplier={1.1}>
                            {overallScoreOutOfFive.toFixed(1)}/5
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.scoreSummaryHeaderSub, notionType, { color: notion.muted }]} maxFontSizeMultiplier={1.1}>
                        Final evaluation snapshot for all criteria
                      </Text>
                    </View>
                    <View style={[styles.scoreListCard, { backgroundColor: notion.surface, borderColor: notion.divider }]}>
                      {evaluationQuestions.map((question, index) => {
                        const score = responses[question.id];
                        const cleanTitle = question.title.replace(/^\d+\.\s*/, '');
                        return (
                          <View
                            key={`summary-${question.id}`}
                            style={[
                              styles.scoreListRow,
                              { borderBottomColor: notion.divider },
                              index === evaluationQuestions.length - 1 && styles.scoreListRowLast,
                            ]}
                          >
                            <View style={styles.scoreQuestionWrap}>
                              <View style={[styles.scoreQuestionIndex, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
                                <Text style={[styles.scoreQuestionIndexText, { color: notion.accent }]} maxFontSizeMultiplier={1.1}>
                                  {index + 1}
                                </Text>
                              </View>
                              <Text style={[styles.scoreQuestionTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.2}>
                                {cleanTitle}
                              </Text>
                            </View>
                            {score == null ? (
                              <View style={[styles.unratedPill, { backgroundColor: '#F8FAFC', borderColor: notion.divider }]}>
                                <Text style={[styles.scoreValueDash, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                                  Not rated
                                </Text>
                              </View>
                            ) : (
                              <GeFiveStarRow
                                rating={geTenPointToStars(score)}
                                size={15}
                                emptyStrokeColor={theme.mode === 'dark' ? '#6b7280' : GE_STAR_EMPTY_STROKE}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View
                    style={[
                      styles.summaryHiddenPlaceholder,
                      { backgroundColor: notion.page, borderBottomColor: notion.divider },
                    ]}
                  >
                    <EyeOff size={36} color={notion.muted} />
                    <Text style={[styles.summaryHiddenTitle, notionType, { color: notion.text }]} maxFontSizeMultiplier={1.25}>
                      General evalutor is yet to publish the evalution score
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        </View>

      </ScrollView>

        <View
          style={[
            styles.geBottomDock,
            {
              borderTopColor: notion.divider,
              backgroundColor: notion.surface,
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
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
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
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Withdraw</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Complete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push(`/general-evaluator-notes?meetingId=${meetingId}`)}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Space</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>
            </View>
        </View>
      </View>
      </View>

        <Modal
          visible={showAssignGeModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAssignGeModal(false);
            setAssignGeSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.geAssignOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAssignGeModal(false);
              setAssignGeSearch('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.geAssignModal, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.geAssignHeader}>
                <Text style={[styles.geAssignTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Assign General Evaluator
                </Text>
                <TouchableOpacity
                  style={styles.geAssignClose}
                  onPress={() => {
                    setShowAssignGeModal(false);
                    setAssignGeSearch('');
                  }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.geAssignHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Choose a club member to book the General Evaluator role for this meeting.
              </Text>
              <View style={[styles.geAssignSearchWrap, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.geAssignSearchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={assignGeSearch}
                  onChangeText={setAssignGeSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {assignGeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAssignGeSearch('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.geAssignList} showsVerticalScrollIndicator={false}>
                {assigningGeRole || clubMembersLoading ? (
                  <View style={styles.geAssignEmptyWrap}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : filteredMembersForAssignGe.length > 0 ? (
                  filteredMembersForAssignGe.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.geAssignMemberRow, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignGeToMember(member)}
                      disabled={assigningGeRole}
                    >
                      <View style={styles.geAssignAvatar}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.geAssignAvatarImage} />
                        ) : (
                          <Star size={20} color="#ffffff" />
                        )}
                      </View>
                      <View style={styles.geAssignMemberTextWrap}>
                        <Text style={[styles.geAssignMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.geAssignEmptyWrap}>
                    <Text style={[styles.geAssignEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No members found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
        <PremiumBookingSuccessModal
          visible={!!bookingSuccessRole}
          roleLabel={bookingSuccessRole ?? ''}
          onClose={() => setBookingSuccessRole(null)}
        />
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
  infoButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kavInner: {
    flex: 1,
    minHeight: 0,
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
  /** One unified bottom panel for shortcuts (not a separate floating card in the scroll). */
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
  navSpacer: {
    flex: 1,
    minHeight: 16,
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
    alignItems: 'flex-start',
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  meetingCardMetaCompact: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meetingCardMetaModeLine: {
    marginTop: 3,
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
  meetingCardDateTime: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingCardMode: {
    fontSize: 10,
    fontWeight: '500',
  },
  /** Flat Notion-style header — same surface as page, no card chrome. */
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
  evaluatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  evaluatorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  evaluatorTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  evaluatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evaluatorAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    overflow: 'hidden',
  },
  evaluatorDetails: {
    flex: 1,
  },
  evaluatorName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
    color: '#1f2937',
  },
  evaluatorRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  prepSpaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
  },
  prepSpaceIconFloating: {
    position: 'absolute',
    top: 10,
    right: 10,
    marginLeft: 0,
    zIndex: 2,
  },
  evaluatorEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  evaluatorRole: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  evaluatorRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  accessDeniedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  accessDeniedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noEvaluatorCard: {
    alignItems: 'center',
    paddingVertical: 26,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  noAssignmentDivider: {
    height: 1,
    marginTop: 14,
  },
  noToastmasterCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noToastmasterIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noToastmasterText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noToastmasterSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  noEvaluatorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noEvaluatorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noEvaluatorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  guideMessage: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  geAssignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  geAssignModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  geAssignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  geAssignTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  geAssignClose: {
    padding: 6,
  },
  geAssignHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  geAssignSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  geAssignSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  geAssignList: {
    maxHeight: 360,
  },
  geAssignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  geAssignAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  geAssignAvatarImage: {
    width: '100%',
    height: '100%',
  },
  geAssignMemberTextWrap: {
    flex: 1,
  },
  geAssignMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  geAssignEmptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geAssignEmptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderBottomWidth: 1,
    borderRadius: 0,
    overflow: 'visible',
  },
  inlineTabContainer: {
    marginHorizontal: 0,
    marginTop: 14,
    borderRadius: 10,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  activeTab: {
    // Active tab styling handled by borderBottomColor
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  feedbackSection: {
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
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  feedbackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  feedbackEmoji: {
    fontSize: 20,
    fontWeight: '700',
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  feedbackAccessDenied: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  feedbackAccessText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  feedbackField: {
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
  wordCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  feedbackTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  categoriesSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 0,
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
  summaryCard: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  geVisibilityCard: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  geVisibilityLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  geVisibilityTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  geVisibilityHint: {
    fontSize: 11,
    marginTop: 3,
  },
  geVisibilityButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryScoreTexts: {
    flex: 1,
    minWidth: 0,
  },
  summaryVisibilityToggleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  summaryVisibilityLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryVisibilityHint: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
    fontWeight: '400',
  },
  summaryHiddenPlaceholder: {
    borderWidth: 0,
    borderRadius: 0,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryHiddenTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryHiddenBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  overallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overallRatingLabel: {
    flex: 1,
    marginRight: 4,
  },
  scoreListCard: {
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
    borderBottomWidth: 1,
    marginTop: 8,
  },
  scoreSummaryHeader: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  scoreSummaryHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreSummaryHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  scoreSummaryValueChip: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scoreSummaryValueChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scoreSummaryHeaderSub: {
    fontSize: 11,
    marginTop: 3,
  },
  scoreListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  scoreListRowLast: {
    borderBottomWidth: 0,
  },
  scoreQuestionWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreQuestionIndex: {
    width: 22,
    height: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  scoreQuestionIndexText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scoreQuestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  unratedPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  scoreValueDash: {
    fontSize: 11,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'right',
  },
  ratingCard: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 6,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  ratingCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  ratingCardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  sliderStep: {
    flex: 1,
    height: 10,
    borderRadius: 999,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleTick: {
    fontSize: 10,
    width: 12,
    textAlign: 'center',
  },
  ratingMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  scoreBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  categorySection: {
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  categoryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.2,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '600',
  },
  questionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  questionCard: {
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 16,
  },
  ratingsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingOption: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  ratingContent: {
    alignItems: 'center',
    gap: 6,
  },
  ratingLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  legendCard: {
    marginHorizontal: 16,
    marginBottom: 16,
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
  legendTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  legendItems: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

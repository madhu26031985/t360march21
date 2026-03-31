import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import { fetchGeneralEvaluatorReportBundle, generalEvaluatorReportQueryKeys } from '@/lib/generalEvaluatorReportQuery';
import { exportAgendaToPDF } from '@/lib/pdfExportUtils';
import { getRoleColor, formatRole } from '@/lib/roleUtils';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, Star, Info, CircleCheck as CheckCircle, Circle, CircleAlert as AlertCircle, X, NotebookPen, Bell, FileText, Users, MessageSquare, MessageCircle, Mic, BookOpen, CheckSquare, ClipboardCheck, FileBarChart, Search, UserPlus, Vote, Settings, UserCog, LayoutDashboard, Download } from 'lucide-react-native';
import { Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';

const FOOTER_NAV_ICON_SIZE = 15;

/** General Evaluator Corner ratings use a 1–10 scale per question. */
const GE_RATING_MIN = 1;
const GE_RATING_MAX = 10;

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
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    summary: '',
    whatWentWell: '',
    whatNeedsImprovement: '',
  });
  const [existingEvaluation, setExistingEvaluation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'feedback'>('categories');
  const [bookingGeRole, setBookingGeRole] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showAssignGeModal, setShowAssignGeModal] = useState(false);
  const [assignGeSearch, setAssignGeSearch] = useState('');
  const [assigningGeRole, setAssigningGeRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [clubMembersLoading, setClubMembersLoading] = useState(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);

  const evaluationQuestions: EvaluationQuestion[] = [
    {
      id: 'q1_preparation_setup',
      title: '1. Preparation & Setup',
      description: 'Was the meeting well-prepared (venue, agenda, and roles assigned in advance)?',
    },
    {
      id: 'q2_opening_quality',
      title: '2. Opening Quality',
      description: 'Did the meeting start on time with an engaging and confident opening?',
    },
    {
      id: 'q3_guest_experience',
      title: '3. Guest Experience',
      description: 'Were guests warmly welcomed, introduced, and made comfortable?',
    },
    {
      id: 'q4_meeting_leadership',
      title: '4. Meeting Leadership (Toastmaster)',
      description: 'Did the Toastmaster clearly manage the theme, flow, and transitions?',
    },
    {
      id: 'q5_role_execution',
      title: '5. Role Execution',
      description: 'Did supporting roles (Timer, Ah-Counter, Grammarian, Table Topics Master) perform effectively?',
    },
    {
      id: 'q6_speaker_intro_support',
      title: '6. Speaker Introduction & Support',
      description: 'Were speakers introduced well and supported throughout their speeches?',
    },
    {
      id: 'q7_time_discipline',
      title: '7. Time Discipline (Speakers & Agenda)',
      description: 'Did speakers and segments stay within the allotted time?',
    },
    {
      id: 'q8_evaluation_quality',
      title: '8. Evaluation Quality',
      description: 'Were evaluations constructive, specific, and helpful (with examples)?',
    },
    {
      id: 'q9_flow_feedback_collection',
      title: '9. Flow & Feedback Collection',
      description: 'Was the meeting well-paced, and were feedback/comments gathered from guests and visiting Toastmasters?',
    },
    {
      id: 'q10_overall_experience',
      title: '10. Overall Experience',
      description: 'Was the meeting engaging, well-organized, and valuable for members and guests?',
    },
  ];

  useEffect(() => {
    if (meetingId) {
      void loadGeneralEvaluatorData();
    }
  }, [meetingId, user?.currentClubId]);

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
          staleTime: 60 * 1000,
        });
        setMeeting(bundle.meeting as Meeting | null);
        setClubInfo(bundle.clubInfo);
        setIsVPEClub(bundle.isVPEClub);
        setGeneralEvaluator(bundle.generalEvaluator as GeneralEvaluator | null);

        if (bundle.geReport) {
          const data = bundle.geReport as GeneralEvaluatorData;
          setExistingEvaluation(data);
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

  // Access control helpers
  const isGeneralEvaluator = () => {
    return generalEvaluator?.assigned_user_id === user?.id && generalEvaluator?.booking_status === 'booked';
  };
  const canAccessGeneralEvaluatorCorner = isGeneralEvaluator() || isVPEClub;
  const canEditGeneralEvaluatorCorner = canAccessGeneralEvaluatorCorner;
  const isGeRoleBooked = generalEvaluator?.booking_status === 'booked';
  const isExComm = (user?.clubRole || user?.role || '').toLowerCase() === 'excomm';

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

    // Verify GE is still booked
    if (!generalEvaluator || generalEvaluator.booking_status !== 'booked') {
      Alert.alert('Access Denied', 'You are no longer the assigned General Evaluator for this meeting.');
      return;
    }

    const { answeredQuestions, hasFeedback } = getCompletionStats();

    // Diagnostic log: Check the values right before the save attempt
    console.log('--- Save Attempt Diagnostics ---');
    console.log('feedbackForm state:', feedbackForm);
    console.log('answeredQuestions:', answeredQuestions);
    console.log('hasFeedback (calculated):', hasFeedback);
    console.log('--------------------------------');

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

      const saveData = {
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

      // Diagnostic log: Check the final saveData object
      console.log('Final saveData object:', saveData);

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
          console.error('Error creating evaluation:', error);
          Alert.alert('Error', 'Failed to save evaluation report');
          return;
        }

        Alert.alert('Success', 'General Evaluator Report saved successfully!');
      }

      // Reload the evaluation to get the updated data
      await loadExistingEvaluation(user.id);
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
      const saveData = {
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

      if (existingEvaluation) {
        await supabase
          .from('app_meeting_ge')
          .update({
            ...saveData,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingEvaluation.id);
      } else {
        await supabase
          .from('app_meeting_ge')
          .insert({
            ...saveData,
            created_at: new Date().toISOString(),
          } as any);

        await loadExistingEvaluation(user.id);
      }
    } catch (error) {
      console.error('Error auto-saving evaluation:', error);
    }
  };

  const handleInfoClick = () => {
    Alert.alert('Coming soon');
  };

  const handleExportPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is available on the web version of this app.');
      return;
    }
    setIsExporting(true);
    try {
      const clubName = (clubInfo?.name || 'Club').replace(/[^a-z0-9]/gi, '_');
      const meetingNum = meeting?.meeting_number || 'X';
      const date = meeting?.meeting_date ? new Date(meeting.meeting_date).toISOString().split('T')[0] : 'date';
      const filename = `${clubName}_Meeting_${meetingNum}_General_Evaluator_Report_${date}.pdf`;
      await exportAgendaToPDF('general-evaluator-report-content', filename);
    } catch (error) {
      console.error('Error exporting GE PDF:', error);
      Alert.alert('Export Failed', 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
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

  const formatConsolidatedMeetingMetaSingleLine = (m: Meeting): string => {
    const date = new Date(m.meeting_date);
    const day = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const start = m.meeting_start_time || '--:--';
    const end = m.meeting_end_time || '--:--';
    return `${day} | ${weekday} | ${start} - ${end} | ${formatMeetingMode(m.meeting_mode)}`;
  };

  const geTotalMax = evaluationQuestions.length * GE_RATING_MAX;
  const totalScore = evaluationQuestions.reduce((sum, q) => sum + (typeof responses[q.id] === 'number' ? (responses[q.id] as number) : 0), 0);
  const getOverallRating = (score: number): 'Excellent' | 'Good' | 'Needs Improvement' => {
    if (score >= Math.round((56 / 72) * geTotalMax)) return 'Excellent';
    if (score >= Math.round((36 / 72) * geTotalMax)) return 'Good';
    return 'Needs Improvement';
  };

  useEffect(() => {
    if (!canAccessGeneralEvaluatorCorner && activeTab !== 'feedback') {
      setActiveTab('feedback');
    }
  }, [canAccessGeneralEvaluatorCorner, activeTab]);

  const RatingCard = ({ question }: { question: EvaluationQuestion }) => {
    const current = responses[question.id];
    return (
      <View style={[styles.ratingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.ratingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {question.title}
        </Text>
        <Text style={[styles.ratingCardDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
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
                    backgroundColor: current != null && value <= current ? theme.colors.primary : '#E5E7EB',
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
              <Text key={`${question.id}-scale-${value}`} style={[styles.scaleTick, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                {value}
              </Text>
            );
          })}
        </View>

        <View style={styles.ratingMetaRow}>
          <Text style={[styles.selectedValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
            Selected: {current == null ? '-' : `${current}/${GE_RATING_MAX}`}
          </Text>
          <Text style={[styles.scoreBadge, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
            {getScoreLabel(current)}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading General Evaluator Report...</Text>
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

  const { totalQuestions, answeredQuestions, hasFeedback } = getCompletionStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator Report</Text>
        {isGeRoleBooked ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={handleExportPDF}
              disabled={isExporting}
            >
              <Download size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={handleInfoClick}
            >
              <Info size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoButton} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={styles.contentTop} nativeID="general-evaluator-report-content">
        {/* General Evaluator Assignment Section */}
        {generalEvaluator?.assigned_user_id && generalEvaluator.app_user_profiles ? (
          <View style={[styles.evaluatorSection, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.evaluatorClubName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              {clubInfo?.name || 'Club'}
            </Text>
            <View style={styles.evaluatorCard}>
              {canEditGeneralEvaluatorCorner && (
                <TouchableOpacity
                  style={[styles.prepSpaceIcon, styles.prepSpaceIconFloating, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => router.push(`/general-evaluator-notes?meetingId=${meetingId}`)}
                >
                  <NotebookPen size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
              <View style={styles.evaluatorInfoCentered}>
                <View style={styles.evaluatorAvatarLarge}>
                  {generalEvaluator.app_user_profiles.avatar_url ? (
                    <Image
                      source={{ uri: generalEvaluator.app_user_profiles.avatar_url }}
                      style={styles.evaluatorAvatarImage}
                    />
                  ) : (
                    <Star size={28} color="#ffffff" />
                  )}
                </View>
                <Text style={[styles.evaluatorNameCentered, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {generalEvaluator.app_user_profiles.full_name}
                </Text>
                <Text style={[styles.evaluatorRoleLabelCentered, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  General evaluator
                </Text>
              </View>
            </View>

            {isGeRoleBooked && (
              <>
                <View style={[styles.consolidatedBottomDivider, { backgroundColor: '#EAEAEA' }]} />
                <View style={styles.consolidatedMeetingMetaBlock}>
                  <Text
                    style={[
                      styles.consolidatedMeetingMetaSingle,
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
            </View>
            <View style={styles.meetingCardDecoration} pointerEvents="none" />
          </View>
        )}

        {/* Tabs/content are available only after GE role is booked */}
        {isGeRoleBooked && (
          <>
            {/* Tab Selector */}
            <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
              {canAccessGeneralEvaluatorCorner && (
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === 'categories' && styles.activeTab,
                    { borderBottomColor: activeTab === 'categories' ? theme.colors.primary : 'transparent' }
                  ]}
                  onPress={() => setActiveTab('categories')}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: activeTab === 'categories' ? theme.colors.primary : theme.colors.textSecondary }
                    ]}
                    maxFontSizeMultiplier={1.1}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    General Evaluator Corner
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'feedback' && styles.activeTab,
                  { borderBottomColor: activeTab === 'feedback' ? theme.colors.primary : 'transparent' }
                ]}
                onPress={() => setActiveTab('feedback')}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === 'feedback' ? theme.colors.primary : theme.colors.textSecondary }
                  ]}
                  maxFontSizeMultiplier={1.1}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  General Evaluator Summary
                </Text>
              </TouchableOpacity>
            </View>

            {/* Evaluation Categories */}
            {canAccessGeneralEvaluatorCorner && activeTab === 'categories' && (
              <>
                <View style={styles.categoriesSection}>
                  <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.summaryText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Total Score: {totalScore} / {geTotalMax}
                    </Text>
                    <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Overall Rating: {getOverallRating(totalScore)}
                    </Text>
                  </View>

                  {evaluationQuestions.map((question) => (
                    <RatingCard key={question.id} question={question} />
                  ))}
                </View>
              </>
            )}

            {activeTab === 'feedback' && (
              <View style={styles.categoriesSection}>
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.summaryText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Total Score: {totalScore} / {geTotalMax}
                  </Text>
                  <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Overall Rating: {getOverallRating(totalScore)}
                  </Text>
                </View>

                <View style={[styles.scoreListCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  {evaluationQuestions.map((question, index) => {
                    const score = responses[question.id];
                    return (
                      <View
                        key={`summary-${question.id}`}
                        style={[
                          styles.scoreListRow,
                          { borderBottomColor: theme.colors.border },
                          index === evaluationQuestions.length - 1 && styles.scoreListRowLast,
                        ]}
                      >
                        <Text style={[styles.scoreQuestionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                          {question.title}
                        </Text>
                        <View style={[styles.scoreValuePill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                          <Text style={[styles.scoreValueText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.1}>
                            {score == null ? '-' : `${score}/${GE_RATING_MAX}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        </View>

        {/* Footer Navigation */}
        <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            marginTop: 0,
            marginBottom: 16,
          }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.footerNavigationContent}
            >
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                  <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                  <Bell size={FOOTER_NAV_ICON_SIZE} color="#772432" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              {isVPEClub && !generalEvaluator?.assigned_user_id && (
                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => {
                    setShowAssignGeModal(true);
                    void loadClubMembers();
                  }}
                  disabled={bookingGeRole || assigningGeRole}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#ECFDF5' }]}>
                    <UserPlus size={FOOTER_NAV_ICON_SIZE} color="#059669" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Assign</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                  <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#16a34a" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Eye size={FOOTER_NAV_ICON_SIZE} color="#ea580c" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                  <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                  <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                  <Mic size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6F4FF' }]}>
                  <Clock size={FOOTER_NAV_ICON_SIZE} color="#0369a1" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF1F2' }]}>
                  <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#e11d48" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Mic size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/admin/voting-operations' })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                  <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#772432" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
              </TouchableOpacity>

              {isExComm && (
                <>
                  <TouchableOpacity
                    style={styles.footerNavItem}
                    onPress={() => router.push('/admin/club-operations')}
                  >
                    <View style={[styles.footerNavIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Settings size={FOOTER_NAV_ICON_SIZE} color="#10b981" />
                    </View>
                    <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
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
                </>
              )}
            </ScrollView>
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
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  contentTop: {
  },
  navSpacer: {
    flex: 1,
    minHeight: 16,
  },
  footerNavigationInline: {
    borderTopWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  evaluatorSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  evaluatorClubName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
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
  evaluatorCard: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderLeftWidth: 0,
    position: 'relative',
  },
  evaluatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  evaluatorInfoCentered: {
    alignItems: 'center',
    justifyContent: 'center',
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
  evaluatorAvatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  evaluatorAvatarImage: {
    width: '100%',
    height: '100%',
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
  evaluatorNameCentered: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  evaluatorRoleLabelCentered: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
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
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  activeTab: {
    // Active tab styling handled by borderBottomColor
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
  },
  consolidatedBottomDivider: {
    height: 1,
    marginTop: 10,
    marginBottom: 10,
  },
  consolidatedMeetingMetaBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  consolidatedMeetingMetaSingle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  scoreListCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scoreListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  scoreListRowLast: {
    borderBottomWidth: 0,
  },
  scoreQuestionTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  scoreValuePill: {
    minWidth: 56,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValueText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ratingCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
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
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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

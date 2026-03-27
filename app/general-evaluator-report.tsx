import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import { getRoleColor, formatRole } from '@/lib/roleUtils';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, Star, Info, CircleCheck as CheckCircle, Circle, CircleAlert as AlertCircle, X, NotebookPen, Bell, FileText, Users, MessageSquare, Mic, BookOpen, CheckSquare, ClipboardCheck, FileBarChart } from 'lucide-react-native';
import { Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';

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
  question: string;
  category: string;
}

interface EvaluationResponse {
  questionId: string;
  rating: 'done_well' | 'partially_done' | 'not_done' | 'na';
}

interface FeedbackForm {
  summary: string;
  whatWentWell: string;
  whatNeedsImprovement: string;
}
interface EvaluationCategory {
  id: string;
  title: string;
  questions: EvaluationQuestion[];
}

export default function GeneralEvaluatorReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [generalEvaluator, setGeneralEvaluator] = useState<GeneralEvaluator | null>(null);
  const [clubInfo, setClubInfo] = useState<{ id: string; name: string; club_number: string | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<Record<string, EvaluationResponse['rating']>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['before_meeting']));
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    summary: '',
    whatWentWell: '',
    whatNeedsImprovement: '',
  });
  const [existingEvaluation, setExistingEvaluation] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'categories' | 'feedback'>('categories');
  const [bookingGeRole, setBookingGeRole] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);

  const evaluationCategories: EvaluationCategory[] = [
    {
      id: 'before_meeting',
      title: '1. Before Meeting',
      questions: [
        { id: 'room_ready', question: 'Was the meeting room/online platform ready on time?', category: 'before_meeting' },
        { id: 'guests_welcomed', question: 'Were guests welcomed warmly upon arrival?', category: 'before_meeting' },
        { id: 'agenda_received', question: 'Did members receive the agenda before the meeting?', category: 'before_meeting' },
        { id: 'roles_assigned', question: 'Were all roles assigned in advance by the VPE?', category: 'before_meeting' },
      ]
    },
    {
      id: 'opening',
      title: '2. Opening',
      questions: [
        { id: 'meeting_start_time', question: 'Did the meeting start on time?', category: 'opening' },
        { id: 'presiding_officer', question: 'Was the presiding officer prepared and confident?', category: 'opening' },
        { id: 'introductions', question: 'Were members and guests introduced properly?', category: 'opening' },
        { id: 'opening_tone', question: 'Did the opening set an enthusiastic and positive tone?', category: 'opening' },
      ]
    },
    {
      id: 'toastmaster',
      title: '3. Toastmaster',
      questions: [
        { id: 'theme_explanation', question: 'Did the Toastmaster explain the meeting theme clearly?', category: 'toastmaster' },
        { id: 'smooth_transitions', question: 'Were transitions between segments smooth and engaging?', category: 'toastmaster' },
        { id: 'time_management', question: 'Did the Toastmaster manage time effectively?', category: 'toastmaster' },
        { id: 'proper_introductions', question: 'Was the General Evaluator and Table Topics Master introduced properly?', category: 'toastmaster' },
      ]
    },
    {
      id: 'evaluation',
      title: '4. Evaluation',
      questions: [
        { id: 'ge_role_explanation', question: 'Did the General Evaluator explain their role clearly?', category: 'evaluation' },
        { id: 'constructive_evaluations', question: 'Were speech evaluators constructive and encouraging?', category: 'evaluation' },
        { id: 'recommendations_examples', question: 'Did evaluators provide recommendations with examples?', category: 'evaluation' },
        { id: 'feedback_timing', question: 'Was overall feedback delivered within the allotted time?', category: 'evaluation' },
      ]
    },
    {
      id: 'tag_team',
      title: '5. Tag Team',
      questions: [
        { id: 'timer_role_report', question: 'Did the Timer explain their role and present the report clearly?', category: 'tag_team' },
        { id: 'ah_counter_effectiveness', question: 'Did the Ah-Counter perform effectively and give a useful report?', category: 'tag_team' },
        { id: 'grammarian_performance', question: 'Did the Grammarian capture gaps and highlight positive usage?', category: 'tag_team' },
        { id: 'reports_timing', question: 'Were all reports concise and delivered within the time limit?', category: 'tag_team' },
      ]
    },
    {
      id: 'table_topics',
      title: '6. Table Topics Session',
      questions: [
        { id: 'tt_rules_explanation', question: 'Did the Table Topics Master explain the rules and timing?', category: 'table_topics' },
        { id: 'topics_quality', question: 'Were the topics clear, creative, and relevant to the theme?', category: 'table_topics' },
        { id: 'participation_encouragement', question: 'Were members without roles and guests encouraged to participate?', category: 'table_topics' },
        { id: 'smooth_return', question: 'Was control smoothly returned to the Toastmaster?', category: 'table_topics' },
      ]
    },
    {
      id: 'speakers',
      title: '7. Speakers',
      questions: [
        { id: 'speaker_introductions', question: 'Were all prepared speakers introduced properly?', category: 'speakers' },
        { id: 'time_adherence', question: 'Did speakers stay within their allotted time?', category: 'speakers' },
        { id: 'pathways_alignment', question: 'Were speeches aligned with Pathways projects or objectives?', category: 'speakers' },
        { id: 'speaker_support', question: 'Did the Toastmaster and evaluators support the speakers effectively?', category: 'speakers' },
      ]
    },
    {
      id: 'educational_speaker',
      title: '8. Educational Speaker',
      questions: [
        { id: 'educational_introduction', question: 'Was the Educational Speaker (if any) properly introduced?', category: 'educational_speaker' },
        { id: 'content_relevance', question: 'Was the content relevant and useful to members?', category: 'educational_speaker' },
        { id: 'audience_engagement', question: 'Did the speaker engage the audience effectively?', category: 'educational_speaker' },
        { id: 'educational_timing', question: 'Was the session kept within the allotted time?', category: 'educational_speaker' },
      ]
    },
    {
      id: 'meeting_flow_closing',
      title: '9. Meeting Flow & Closing',
      questions: [
        { id: 'agenda_followed', question: 'Was the agenda followed throughout the meeting?', category: 'meeting_flow_closing' },
        { id: 'meeting_timing', question: 'Did the meeting stay within the scheduled time?', category: 'meeting_flow_closing' },
        { id: 'supportive_atmosphere', question: 'Was the atmosphere supportive and enjoyable?', category: 'meeting_flow_closing' },
        { id: 'guest_feedback', question: 'Were guests invited to share feedback before closing?', category: 'meeting_flow_closing' },
      ]
    }
  ];

  useEffect(() => {
    if (meetingId) {
      loadGeneralEvaluatorData();
    }
  }, [meetingId]);

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

    try {
      await loadMeeting();
      await loadClubInfo();
      await loadIsVPEClub();

      // Load the assigned General Evaluator for this meeting
      const { data: geData, error: geError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .ilike('role_name', '%general evaluator%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked') // Only consider booked GE
        .maybeSingle();

      if (geError && geError.code !== 'PGRST116') {
        console.error('Error loading general evaluator assignment:', geError);
        // Continue without GE assignment if there's an error
      }
      setGeneralEvaluator(geData);

      // Now load the evaluation data for the assigned GE (if any)
      // This ensures we load THE report for the meeting, not just the logged-in user's
      if (geData?.assigned_user_id) {
        await loadExistingEvaluation(geData.assigned_user_id);
      } else {
        // If no GE is assigned, clear any existing evaluation data
        setExistingEvaluation(null);
        setFeedbackForm({
          summary: '',
          whatWentWell: '',
          whatNeedsImprovement: '',
        });
        setResponses({}); // Clear responses too
      }
    } catch (error) {
      console.error('Error loading general evaluator data:', error);
      Alert.alert('Error', 'Failed to load general evaluator data');
    } finally {
      setIsLoading(false);
    }
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

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
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
          setResponses(data.evaluation_data);
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

  // Check if current user is the General Evaluator
  const isGeneralEvaluator = () => {
    return generalEvaluator?.assigned_user_id === user?.id && generalEvaluator?.booking_status === 'booked';
  };

  const handleRatingChange = (questionId: string, rating: EvaluationResponse['rating']) => {
    if (!isGeneralEvaluator()) {
      Alert.alert('Access Denied', 'Only the assigned General Evaluator can mark this evaluation.');
      return;
    }
    
    setResponses(prev => ({
      ...prev,
      [questionId]: rating
    }));
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
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
  const getRatingIcon = (rating: EvaluationResponse['rating']) => {
    switch (rating) {
      case 'done_well':
        return <CheckCircle size={20} color="#10b981" />;
      case 'partially_done':
        return <AlertCircle size={20} color="#f59e0b" />;
      case 'not_done':
        return <X size={20} color="#ef4444" />;
      case 'na':
        return <Circle size={20} color="#6b7280" />;
      default:
        return <Circle size={20} color="#e5e7eb" />;
    }
  };

  const getRatingColor = (rating: EvaluationResponse['rating']) => {
    switch (rating) {
      case 'done_well': return '#10b981';
      case 'partially_done': return '#f59e0b';
      case 'not_done': return '#ef4444';
      case 'na': return '#6b7280';
      default: return '#e5e7eb';
    }
  };

  const getRatingLabel = (rating: EvaluationResponse['rating']) => {
    switch (rating) {
      case 'done_well': return 'Done well';
      case 'partially_done': return 'Partially done';
      case 'not_done': return 'Not done';
      case 'na': return 'N/A';
      default: return '';
    }
  };

  const getCompletionStats = () => {
    const totalQuestions = evaluationCategories.reduce((sum, cat) => sum + cat.questions.length, 0);
    const answeredQuestions = Object.keys(responses).length;
    const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    // Ensure hasFeedback is true if any of the text fields have content after trimming
    const hasFeedback = 
      (feedbackForm.summary && feedbackForm.summary.trim().length > 0) || 
      (feedbackForm.whatWentWell && feedbackForm.whatWentWell.trim().length > 0) || 
      (feedbackForm.whatNeedsImprovement && feedbackForm.whatNeedsImprovement.trim().length > 0);
    
    return { totalQuestions, answeredQuestions, completionPercentage, hasFeedback };
  };

  const handleSaveEvaluation = async () => {
    if (!isGeneralEvaluator()) {
      Alert.alert('Access Denied', 'Only the assigned General Evaluator can save this evaluation.');
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
        evaluator_user_id: user.id,
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
    if (!isGeneralEvaluator() || !meetingId || !user?.currentClubId) {
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
        evaluator_user_id: user.id,
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

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const RatingOption = ({ rating, currentRating, onPress }: { 
    rating: EvaluationResponse['rating']; 
    currentRating: EvaluationResponse['rating'] | undefined; 
    onPress: () => void; 
  }) => {
    const isSelected = currentRating === rating;
    
    return (
      <TouchableOpacity
        style={[
          styles.ratingOption,
          {
            borderColor: isSelected ? getRatingColor(rating) : '#e5e7eb',
            backgroundColor: isSelected ? getRatingColor(rating) + '10' : 'transparent',
          }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.ratingContent}>
          {getRatingIcon(rating)}
          <Text style={[
            styles.ratingLabel,
            { color: isSelected ? getRatingColor(rating) : '#6b7280' }
          ]} maxFontSizeMultiplier={1.3}>
            {getRatingLabel(rating)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const QuestionCard = ({ question }: { question: EvaluationQuestion }) => {
    const currentRating = responses[question.id];
    
    return (
      <View style={[styles.questionCard, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.questionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {question.question}
        </Text>
        
        <View style={styles.ratingsContainer}>
          <RatingOption
            rating="done_well"
            currentRating={currentRating}
            onPress={() => handleRatingChange(question.id, 'done_well')}
          />
          <RatingOption
            rating="partially_done"
            currentRating={currentRating}
            onPress={() => handleRatingChange(question.id, 'partially_done')}
          />
          <RatingOption
            rating="not_done"
            currentRating={currentRating}
            onPress={() => handleRatingChange(question.id, 'not_done')}
          />
          <RatingOption
            rating="na"
            currentRating={currentRating}
            onPress={() => handleRatingChange(question.id, 'na')}
          />
        </View>
      </View>
    );
  };

  const CategorySection = ({ category }: { category: EvaluationCategory }) => {
    const isExpanded = expandedCategories.has(category.id);
    const categoryResponses = category.questions.filter(q => responses[q.id]);
    const completionCount = categoryResponses.length;
    const totalCount = category.questions.length;
    
    return (
      <View style={[styles.categorySection, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => toggleCategory(category.id)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryTitleContainer}>
            <View style={[styles.categoryIcon, { backgroundColor: '#ef4444' + '20' }]}>
              <Star size={16} color="#ef4444" />
            </View>
            <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {category.title}
            </Text>
          </View>
          
          <View style={styles.categoryMeta}>
            <View style={[
              styles.completionBadge,
              { backgroundColor: completionCount === totalCount ? '#10b981' + '20' : '#f59e0b' + '20' }
            ]}>
              <Text style={[
                styles.completionText,
                { color: completionCount === totalCount ? '#10b981' : '#f59e0b' }
              ]} maxFontSizeMultiplier={1.3}>
                {completionCount}/{totalCount}
              </Text>
            </View>
            
            <View style={[
              styles.expandIcon,
              { transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }
            ]}>
              <Text style={[styles.chevron, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>›</Text>
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.questionsContainer}>
            {category.questions.map((question) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </View>
        )}
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

  const { totalQuestions, answeredQuestions, completionPercentage, hasFeedback } = getCompletionStats();
  const hasContent = answeredQuestions > 0 || hasFeedback;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator Report</Text>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={handleInfoClick}
        >
          <Info size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        <View style={styles.contentTop}>
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
                Mode: {formatMeetingMode(meeting.meeting_mode)}
              </Text>
            </View>
          </View>
        </View>

        {/* General Evaluator Assignment Section */}
        <View style={[styles.evaluatorSection, { backgroundColor: theme.colors.surface }]}>
          {generalEvaluator?.assigned_user_id && generalEvaluator.app_user_profiles ? (
            <View style={styles.evaluatorCard}>
              <View style={styles.evaluatorInfo}>
                <View style={styles.evaluatorAvatar}>
                  {generalEvaluator.app_user_profiles.avatar_url ? (
                    <Image
                      source={{ uri: generalEvaluator.app_user_profiles.avatar_url }}
                      style={styles.evaluatorAvatarImage}
                    />
                  ) : (
                    <Star size={24} color="#ffffff" />
                  )}
                </View>
                <View style={styles.evaluatorDetails}>
                  <Text style={[styles.evaluatorName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {generalEvaluator.app_user_profiles.full_name}
                  </Text>
                  <Text style={[styles.evaluatorRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    General evaluator
                  </Text>
                </View>
                {isGeneralEvaluator() && (
                  <TouchableOpacity
                    style={[styles.prepSpaceIcon, { backgroundColor: '#E8F4FD' }]}
                    onPress={() => router.push(`/general-evaluator-notes?meetingId=${meetingId}`)}
                  >
                    <NotebookPen size={18} color="#3b82f6" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.noEvaluatorCard}>
              <View style={[styles.noEvaluatorIcon, { backgroundColor: '#3b82f6' + '20' }]}>
                <Star size={28} color="#3b82f6" />
              </View>
              <Text style={[styles.guideMessage, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Guide the meeting to excellence ⭐
              </Text>
              {isVPEClub ? (
                <View style={styles.vpeDualButtonsRow}>
                  <TouchableOpacity
                    style={[styles.bookRoleButton, styles.vpeDualBtn, { opacity: bookingGeRole ? 0.85 : 1 }]}
                    onPress={() => handleBookGeneralEvaluatorInline()}
                    disabled={bookingGeRole}
                  >
                    {bookingGeRole ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                        Book the GE role
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vpeDualBtn, styles.assignOutlineBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    onPress={() => router.push({ pathname: '/admin/manage-meeting-roles', params: { meetingId } })}
                  >
                    <Text style={[styles.assignOutlineText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                      Assign
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.bookRoleButton, { opacity: bookingGeRole ? 0.85 : 1 }]}
                  onPress={() => handleBookGeneralEvaluatorInline()}
                  disabled={bookingGeRole}
                >
                  {bookingGeRole ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                      Book the GE role
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
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
              maxFontSizeMultiplier={1.3}
            >
              Evaluation Categories
            </Text>
          </TouchableOpacity>
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
              maxFontSizeMultiplier={1.3}
            >
              Evaluation Feedback
            </Text>
          </TouchableOpacity>
        </View>

        {/* Feedback Sections */}
        {activeTab === 'feedback' && (
          <View style={[styles.feedbackSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.feedbackHeader}>
              <View style={[styles.feedbackIcon, { backgroundColor: '#3b82f6' + '20' }]}>
                <Text style={[styles.feedbackEmoji, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>📝</Text>
              </View>
              <Text style={[styles.feedbackTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                General Evaluation Feedback
              </Text>
            </View>

          {/* Summary */}
          <View style={styles.feedbackField}>
            <View style={styles.feedbackFieldHeader}>
              <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meeting Summary
              </Text>
              <Text style={[styles.wordCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {(feedbackForm.summary || '').length}/1200 characters
              </Text>
            </View>
            <TextInput
              style={[
                styles.feedbackTextInput, 
                { 
                  backgroundColor: theme.colors.background, 
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  opacity: isGeneralEvaluator() ? 1 : 0.6
                }
              ]}
              placeholder="Provide an overall summary of today's meeting, highlighting key moments and general observations..."
              placeholderTextColor={theme.colors.textSecondary}
              value={feedbackForm.summary}
              onChangeText={(text) => updateFeedbackField('summary', text)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={isGeneralEvaluator()}
              maxLength={1200} // Added maxLength
            />
          </View>

          {/* What Went Well */}
          <View style={styles.feedbackField}>
            <View style={styles.feedbackFieldHeader}>
              <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                What Went Well?
              </Text>
              <Text style={[styles.wordCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {(feedbackForm.whatWentWell || '').length}/1200 characters
              </Text>
            </View>
            <TextInput
              style={[
                styles.feedbackTextInput, 
                { 
                  backgroundColor: theme.colors.background, 
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  opacity: isGeneralEvaluator() ? 1 : 0.6
                }
              ]}
              placeholder="Highlight the positive aspects of the meeting, successful moments, and things that worked well..."
              placeholderTextColor={theme.colors.textSecondary}
              value={feedbackForm.whatWentWell}
              onChangeText={(text) => updateFeedbackField('whatWentWell', text)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={isGeneralEvaluator()}
              maxLength={1200} // Added maxLength
            />
          </View>

          {/* What Needs Improvement */}
          <View style={styles.feedbackField}>
            <View style={styles.feedbackFieldHeader}>
              <Text style={[styles.feedbackFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                What Needs Improvement?
              </Text>
              <Text style={[styles.wordCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {(feedbackForm.whatNeedsImprovement || '').length}/1200 characters
              </Text>
            </View>
            <TextInput
              style={[
                styles.feedbackTextInput, 
                { 
                  backgroundColor: theme.colors.background, 
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  opacity: isGeneralEvaluator() ? 1 : 0.6
                }
              ]}
              placeholder="Provide constructive feedback on areas that could be improved for future meetings..."
              placeholderTextColor={theme.colors.textSecondary}
              value={feedbackForm.whatNeedsImprovement}
              onChangeText={(text) => updateFeedbackField('whatNeedsImprovement', text)}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={isGeneralEvaluator()}
              maxLength={1200} // Added maxLength
            />
          </View>
          </View>
        )}

        {/* Evaluation Categories */}
        {activeTab === 'categories' && (
          <>
            <View style={styles.categoriesSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Evaluation Categories
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                
              </Text>

              {evaluationCategories.map((category) => (
                <CategorySection key={category.id} category={category} />
              ))}
            </View>

            {/* Legend */}
            <View style={[styles.legendCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.legendTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Rating Guide</Text>

              <View style={styles.legendItems}>
                <View style={styles.legendItem}>
                  <CheckCircle size={16} color="#10b981" />
                  <Text style={[styles.legendText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Done well - Excellent performance</Text>
                </View>

                <View style={styles.legendItem}>
                  <AlertCircle size={16} color="#f59e0b" />
                  <Text style={[styles.legendText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Partially done - Good with room for improvement</Text>
                </View>

                <View style={styles.legendItem}>
                  <X size={16} color="#ef4444" />
                  <Text style={[styles.legendText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Not done - Needs significant improvement</Text>
                </View>

                <View style={styles.legendItem}>
                  <Circle size={16} color="#6b7280" />
                  <Text style={[styles.legendText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>N/A - Not applicable to this meeting</Text>
                </View>
              </View>
            </View>
          </>
        )}

        </View>

        {/* Footer Navigation */}
        {meeting && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 24,
            marginBottom: 16,
          }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.footerNavigationContent}
            >
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                  <FileText size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                  <Bell size={20} color="#772432" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Users size={20} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                  <Calendar size={20} color="#004165" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                  <BookOpen size={20} color="#16a34a" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                  <NotebookPen size={20} color="#4f46e5" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Mic size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                  <CheckSquare size={20} color="#a855f7" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#ECFDF5' }]}>
                  <CheckSquare size={20} color="#059669" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Roles</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF2F2' }]}>
                  <ClipboardCheck size={20} color="#dc2626" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluations</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                  <Mic size={20} color="#C9B84E" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                  <Clock size={20} color="#C9B84E" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting.id } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDFA' }]}>
                  <MessageSquare size={20} color="#0d9488" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
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
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  contentTop: {
    flex: 1,
  },
  footerNavigationInline: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  footerNavigationContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  footerNavItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  footerNavIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNavLabel: {
    fontSize: 11,
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
  evaluatorSection: {
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
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
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
  prepSpaceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
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
    backgroundColor: '#3b82f6',
    paddingVertical: 9,
    paddingHorizontal: 21,
    borderRadius: 12,
    marginTop: 5,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookRoleButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  vpeDualButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 5,
  },
  vpeDualBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignOutlineBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  assignOutlineText: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '600',
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

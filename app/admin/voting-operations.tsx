import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Vote, Calendar, Users, X, Save, Trash2, ChartBar as BarChart3, Building2, Crown, User, Shield, Eye, UserCheck, Search, Sparkles } from 'lucide-react-native';

/** Notion-like palette: flat surfaces, hairline borders, muted text, single accent blue */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  borderStrong: 'rgba(55, 53, 47, 0.16)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  accentSoftBorder: 'rgba(35, 131, 226, 0.28)',
  segmentTrack: '#E8E7E5',
  rowSelected: 'rgba(35, 131, 226, 0.07)',
  pillBg: '#F0EFED',
  pillExCommBg: '#F4F0FA',
  pillExCommText: '#6940A5',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
};

interface Poll {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  end_time: string | null;
}

interface PollQuestion {
  id: string;
  question_text: string;
  question_type: string;
  min_options: number;
  max_options: number;
  order_index: number;
  is_active: boolean;
}

interface PollForm {
  title: string;
  selectedQuestions: string[];
  questionOptions: { [questionId: string]: string[] };
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export default function VotingOperations() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollQuestions, setPollQuestions] = useState<PollQuestion[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /** Create-tab question list; may still load after main shell (club + polls) is shown */
  const [isPollQuestionsLoading, setIsPollQuestionsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'create' | 'published' | 'completed'>('create');
  const [filteredPolls, setFilteredPolls] = useState<Poll[]>([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedQuestionForOptions, setSelectedQuestionForOptions] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filteredClubMembers, setFilteredClubMembers] = useState<ClubMember[]>([]);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [showMeetingSelectModal, setShowMeetingSelectModal] = useState(false);
  const [openMeetings, setOpenMeetings] = useState<Array<{ id: string; meeting_date: string; meeting_title: string }>>([]);
  const [closePollConfirm, setClosePollConfirm] = useState<Poll | null>(null);
  const [isClosingPoll, setIsClosingPoll] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  /** Avoid refetching roster on every modal open for the same club */
  const membersLoadedClubIdRef = useRef<string | null>(null);

  const [pollForm, setPollForm] = useState<PollForm>({
    title: '',
    selectedQuestions: [],
    questionOptions: {},
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterPolls();
  }, [polls, selectedTab]);

  // Calculate hasActivePoll before using it in useEffect
  const publishedCount = polls.filter(p => p.status === 'published').length;
  const completedCount = polls.filter(p => p.status === 'completed').length;
  const hasActivePoll = publishedCount > 0;

  // Auto-switch to published tab if create tab is selected but there's an active poll
  useEffect(() => {
    if (selectedTab === 'create' && hasActivePoll) {
      setSelectedTab('published');
    }
  }, [hasActivePoll, selectedTab]);

  // Filter club members based on search query
  useEffect(() => {
    if (memberSearchQuery.trim()) {
      const query = memberSearchQuery.toLowerCase().trim();
      setFilteredClubMembers(
        clubMembers.filter(member => 
          member.full_name.toLowerCase().includes(query) ||
          member.email.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredClubMembers(clubMembers);
    }
  }, [clubMembers, memberSearchQuery]);
  const loadData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      setIsPollQuestionsLoading(false);
      return;
    }

    membersLoadedClubIdRef.current = null;
    setClubMembers([]);
    setIsPollQuestionsLoading(true);

    // Questions run in parallel with club + polls so total time ≈ max(not sum) of the two groups.
    const questionsPromise = loadPollQuestions().finally(() => setIsPollQuestionsLoading(false));

    try {
      await Promise.all([loadClubInfo(), loadPolls()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }

    await questionsPromise;

    InteractionManager.runAfterInteractions(() => {
      void loadClubMembers();
    });
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

  const loadPolls = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('polls')
        .select('id, title, description, status, created_at, end_time')
        .eq('club_id', user.currentClubId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading polls:', error);
        return;
      }

      setPolls(data || []);
    } catch (error) {
      console.error('Error loading polls:', error);
    }
  };

  const loadPollQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('polls_questions')
        .select('id, question_text, question_type, min_options, max_options, order_index, is_active')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error loading poll questions:', error);
        return;
      }

      setPollQuestions(data || []);
    } catch (error) {
      console.error('Error loading poll questions:', error);
    }
  };

  const loadClubMembers = async () => {
    const clubId = user?.currentClubId;
    if (!clubId) return;

    if (membersLoadedClubIdRef.current === clubId) return;

    setIsLoadingMembers(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_club_member_directory', {
        target_club_id: clubId,
      });

      let members: ClubMember[] = [];

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        members = (rpcData as { user_id: string; full_name: string; email: string; avatar_url: string | null }[])
          .map((row) => ({
            id: row.user_id,
            full_name: row.full_name || '',
            email: row.email || '',
            avatar_url: row.avatar_url ?? null,
          }))
          .filter((m) => m.id);
      } else {
        if (rpcError) {
          console.warn('get_club_member_directory failed, falling back to embed query:', rpcError);
        }
        const { data, error } = await supabase
          .from('app_club_user_relationship')
          .select('app_user_profiles!inner(id, full_name, email, avatar_url)')
          .eq('club_id', clubId)
          .eq('is_authenticated', true);

        if (error) {
          console.error('Error loading club members:', error);
          return;
        }

        members = (data || [])
          .map((item) => ({
            id: (item as any).app_user_profiles.id,
            full_name: (item as any).app_user_profiles.full_name,
            email: (item as any).app_user_profiles.email,
            avatar_url: (item as any).app_user_profiles.avatar_url || null,
          }))
          .filter((m) => m.id);
      }

      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);
      membersLoadedClubIdRef.current = clubId;
    } catch (error) {
      console.error('Error loading club members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const openMemberPicker = (questionId: string) => {
    setSelectedQuestionForOptions(questionId);
    setShowMemberModal(true);
    void loadClubMembers();
  };

  const filterPolls = () => {
    if (selectedTab === 'published') {
      setFilteredPolls(polls.filter(p => p.status === 'published'));
    } else if (selectedTab === 'completed') {
      setFilteredPolls(polls.filter(p => p.status === 'completed'));
    } else {
      setFilteredPolls([]);
    }
  };

  const resetForm = () => {
    setPollForm({
      title: '',
      selectedQuestions: [],
      questionOptions: {},
    });
  };

  const updatePollField = (field: keyof PollForm, value: any) => {
    setPollForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleQuestion = (questionId: string) => {
    setPollForm(prev => {
      const isSelected = prev.selectedQuestions.includes(questionId);
      const newSelectedQuestions = isSelected
        ? prev.selectedQuestions.filter(id => id !== questionId)
        : [...prev.selectedQuestions, questionId];
      
      // Initialize options for newly selected questions
      const newQuestionOptions = { ...prev.questionOptions };
      if (!isSelected) {
        newQuestionOptions[questionId] = [];
      } else {
        delete newQuestionOptions[questionId];
      }
      
      return {
        ...prev,
        selectedQuestions: newSelectedQuestions,
        questionOptions: newQuestionOptions,
      };
    });
  };

  const isQuestionAboutMembers = (questionText: string): boolean => {
    const memberKeywords = ['best', 'speaker', 'evaluator', 'role player', 'member', 'toastmaster', 'who was'];
    return memberKeywords.some(keyword => questionText.toLowerCase().includes(keyword.toLowerCase()));
  };

  const addTextOption = (questionId: string) => {
    setPollForm(prev => ({
      ...prev,
      questionOptions: {
        ...prev.questionOptions,
        [questionId]: [...(prev.questionOptions[questionId] || []), '']
      }
    }));
  };

  const updateQuestionOption = (questionId: string, optionIndex: number, value: string) => {
    setPollForm(prev => ({
      ...prev,
      questionOptions: {
        ...prev.questionOptions,
        [questionId]: (prev.questionOptions[questionId] || []).map((option, idx) => 
          idx === optionIndex ? value : option
        )
      }
    }));
  };

  const addQuestionOption = (questionId: string) => {
    openMemberPicker(questionId);
  };

  const handleMemberSelect = (member: ClubMember) => {
    if (!selectedQuestionForOptions) return;
    
    setPollForm(prev => ({
      ...prev,
      questionOptions: {
        ...prev.questionOptions,
        [selectedQuestionForOptions]: [...(prev.questionOptions[selectedQuestionForOptions] || []), member.full_name]
      }
    }));
    
    setShowMemberModal(false);
    setSelectedQuestionForOptions(null);
    setMemberSearchQuery(''); // Clear search when closing
  };

  const handleAddMemberOption = (questionId: string) => {
    openMemberPicker(questionId);
  };

  const removeQuestionOption = (questionId: string, optionIndex: number) => {
    setPollForm(prev => ({
      ...prev,
      questionOptions: {
        ...prev.questionOptions,
        [questionId]: prev.questionOptions[questionId]?.filter((_, idx) => idx !== optionIndex) || []
      }
    }));
  };

  const handleAutoFill = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data: meetings, error: meetingError } = await supabase
        .from('app_club_meeting')
        .select('id, meeting_date, meeting_title')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'open')
        .order('meeting_date', { ascending: false });

      if (meetingError) {
        console.error('Error loading open meetings:', meetingError);
        Alert.alert('Error', 'Failed to load meeting data');
        return;
      }

      if (!meetings || meetings.length === 0) {
        Alert.alert('Info', 'No open meetings found. Auto-fill requires an open meeting.');
        return;
      }

      if (meetings.length === 1) {
        await populatePollFromMeeting(meetings[0].id, meetings[0].meeting_date);
      } else {
        setOpenMeetings(meetings);
        setShowMeetingSelectModal(true);
      }
    } catch (error) {
      console.error('Error in auto-fill:', error);
      Alert.alert('Error', 'An unexpected error occurred during auto-fill');
    }
  };

  const populatePollFromMeeting = async (meetingId: string, meetingDate: string) => {
    setIsAutoFilling(true);
    setShowMeetingSelectModal(false);

    try {

      const newQuestionOptions: { [questionId: string]: string[] } = {};
      const newSelectedQuestions: string[] = [];

      console.log('=== Starting Auto-Fill for Meeting:', meetingId, '===');
      console.log('Total questions to process:', pollQuestions.length);

      for (const question of pollQuestions) {
        const questionText = question.question_text.toLowerCase();
        let options: string[] = [];

        console.log('Processing question:', question.question_text, '| lowercase:', questionText);

        // Best Role Player: TMOD, General Evaluator, Table Topics Master (booked roles, no qualification)
        if (questionText.includes('best role player')) {
          console.log('✓ Matched: Best Role Player');
          const { data: roleBookings, error: roleError } = await supabase
            .from('app_meeting_roles_management')
            .select(`
              assigned_user_id,
              role_name,
              app_user_profiles!fk_meeting_roles_management_assigned_user_id (full_name)
            `)
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .in('role_name', ['Toastmaster of the Day', 'General Evaluator', 'Table Topics Master'])
            .not('assigned_user_id', 'is', null);

          if (roleError) {
            console.error('Error fetching role players:', roleError);
          }
          console.log('Role Players found:', roleBookings?.length || 0, roleBookings);
          options = roleBookings?.map((booking: any) => booking.app_user_profiles?.full_name).filter(Boolean) || [];
        }
        // Best Prepared Speaker: Qualified speakers from timer reports
        else if (questionText.includes('best prepared speaker')) {
          const { data: timerReports } = await supabase
            .from('timer_reports')
            .select('speaker_name, time_qualification')
            .eq('meeting_id', meetingId)
            .eq('speech_category', 'prepared_speaker')
            .eq('time_qualification', true);

          options = Array.from(new Set(timerReports?.map(r => r.speaker_name) || []));
        }
        // Best Speech Evaluator: Qualified evaluators from timer reports
        else if (questionText.includes('best speech evaluator') || questionText.includes('best evaluator')) {
          const { data: timerReports } = await supabase
            .from('timer_reports')
            .select('speaker_name, time_qualification')
            .eq('meeting_id', meetingId)
            .eq('speech_category', 'evaluation')
            .eq('time_qualification', true);

          options = Array.from(new Set(timerReports?.map(r => r.speaker_name) || []));
        }
        // Best Ancillary Speaker: Timer, Ah Counter, Grammarian (booked roles, no qualification needed)
        else if (questionText.includes('best ancillary') || questionText.includes('best auxiliary')) {
          console.log('✓ Matched: Best Ancillary/Auxiliary Speaker');
          const { data: roleBookings, error: roleError } = await supabase
            .from('app_meeting_roles_management')
            .select(`
              assigned_user_id,
              role_name,
              app_user_profiles!fk_meeting_roles_management_assigned_user_id (full_name)
            `)
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .in('role_name', ['Timer', 'Ah Counter', 'Grammarian'])
            .not('assigned_user_id', 'is', null);

          if (roleError) {
            console.error('Error fetching ancillary speakers:', roleError);
          }
          console.log('Ancillary Speakers found:', roleBookings?.length || 0, roleBookings);
          options = roleBookings?.map((booking: any) => booking.app_user_profiles?.full_name).filter(Boolean) || [];
        }
        // Best Table Topics Speaker: Qualified speakers from timer reports
        else if (questionText.includes('best table topic speaker') || questionText.includes('best table topics speaker')) {
          const { data: timerReports } = await supabase
            .from('timer_reports')
            .select('speaker_name, time_qualification')
            .eq('meeting_id', meetingId)
            .eq('speech_category', 'table_topic_speaker')
            .eq('time_qualification', true);

          options = Array.from(new Set(timerReports?.map(r => r.speaker_name).filter(Boolean) || []));
        }
        // Overall Meeting Experience: Add Good/Bad options
        else if (questionText.includes('overall') && (questionText.includes('experience') || questionText.includes('meeting'))) {
          options = ['Good', 'Bad'];
        }

        if (options.length > 0) {
          console.log('✓ Adding question with', options.length, 'options:', options);
          newSelectedQuestions.push(question.id);
          newQuestionOptions[question.id] = options;
        } else {
          console.log('✗ No options found for this question');
        }
      }

      console.log('=== Auto-Fill Complete ===');
      console.log('Total questions selected:', newSelectedQuestions.length);
      console.log('Question options:', newQuestionOptions);

      if (newSelectedQuestions.length === 0) {
        Alert.alert('Info', 'No qualifying data found for auto-fill. Please ensure meeting roles are booked and timer reports are submitted.');
        return;
      }

      const formattedDate = new Date(meetingDate).toLocaleDateString();
      setPollForm(prev => ({
        ...prev,
        title: `Meeting Poll - ${formattedDate}`,
        selectedQuestions: newSelectedQuestions,
        questionOptions: newQuestionOptions,
      }));

      Alert.alert('Success', `Auto-filled ${newSelectedQuestions.length} question(s) with data from the selected meeting. You can now edit the options as needed.`);
    } catch (error) {
      console.error('Error in auto-fill:', error);
      Alert.alert('Error', 'An unexpected error occurred during auto-fill');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const validateForm = (): boolean => {
    if (!pollForm.title.trim()) {
      Alert.alert('Error', 'Please enter a poll title');
      return false;
    }

    if (pollForm.selectedQuestions.length === 0) {
      Alert.alert('Error', 'Please select at least one question');
      return false;
    }

    for (const questionId of pollForm.selectedQuestions) {
      const options = pollForm.questionOptions[questionId] || [];
      const validOptions = options.filter(opt => opt.trim());
      const question = pollQuestions.find(q => q.id === questionId);
      const minOptions = question?.min_options || 2;
      
      if (validOptions.length < minOptions) {
        Alert.alert('Error', `"${question?.question_text}" must have at least ${minOptions} options`);
        return false;
      }
    }

    return true;
  };

  const handleSavePoll = async () => {
    if (!validateForm() || !user?.currentClubId) return;

    setIsSaving(true);
    
    try {
      // Create poll
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .insert({
          title: pollForm.title.trim(),
          description: null,
          club_id: user.currentClubId,
          created_by: user.id,
          status: 'published',
        } as any)
        .select()
        .single();

      if (pollError) {
        console.error('Error creating poll:', pollError);
        Alert.alert('Error', 'Failed to create poll');
        return;
      }

      // Create poll items for each question and option
      const pollItems = [];
      for (let qIndex = 0; qIndex < pollForm.selectedQuestions.length; qIndex++) {
        const questionId = pollForm.selectedQuestions[qIndex];
        const question = pollQuestions.find(q => q.id === questionId);
        const options = pollForm.questionOptions[questionId] || [];
        const validOptions = options.filter(opt => opt.trim());
        
        for (let oIndex = 0; oIndex < validOptions.length; oIndex++) {
          const optionText = validOptions[oIndex];
          pollItems.push({
            poll_id: (pollData as any).id,
            question_id: questionId,
            option_id: `${questionId}_opt${oIndex + 1}`,
            question_text: question?.question_text || '',
            option_text: optionText.trim(),
            question_order: qIndex,
            option_order: oIndex,
            vote_count: 0,
            is_active: true,
          });
        }
      }

      const { error: itemsError } = await supabase
        .from('poll_items')
        .insert(pollItems as any);

      if (itemsError) {
        console.error('Error creating poll items:', itemsError);
        Alert.alert('Error', 'Failed to create poll options');
        return;
      }

      Alert.alert('Success', 'Poll created successfully!');
      resetForm();
      loadPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewResults = (poll: Poll) => {
    router.push(`/admin/poll-results?pollId=${poll.id}`);
  };

  const handleClosePollClick = (poll: Poll) => {
    setClosePollConfirm(poll);
  };

  const confirmClosePoll = async () => {
    const poll = closePollConfirm;
    if (!poll) return;

    setIsClosingPoll(true);
    try {
      const { error } = await supabase
        .from('polls')
        .update({ 
          status: 'completed',
          end_time: new Date().toISOString()
        } as any)
        .eq('id', poll.id);

      if (error) {
        console.error('Error closing poll:', error);
        Alert.alert('Error', 'Failed to close poll');
        setClosePollConfirm(null);
        return;
      }

      setClosePollConfirm(null);
      loadPolls();
    } catch (error) {
      console.error('Error closing poll:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      setClosePollConfirm(null);
    } finally {
      setIsClosingPoll(false);
    }
  };

  const getRoleIcon = (role: string, iconColor: string = N.text) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color={iconColor} />;
      case 'visiting_tm': return <UserCheck size={12} color={iconColor} />;
      case 'club_leader': return <Shield size={12} color={iconColor} />;
      case 'guest': return <Eye size={12} color={iconColor} />;
      case 'member': return <User size={12} color={iconColor} />;
      default: return <User size={12} color={iconColor} />;
    }
  };

  /** Soft Notion-style role chips (text + icon on tinted ground) */
  const notionRolePill = (role: string): { bg: string; fg: string } => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return { bg: N.pillExCommBg, fg: N.pillExCommText };
      case 'visiting_tm':
        return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#047857' };
      case 'club_leader':
        return { bg: 'rgba(245, 158, 11, 0.14)', fg: '#B45309' };
      case 'guest':
        return { bg: N.pillBg, fg: N.textSecondary };
      case 'member':
        return { bg: N.accentSoft, fg: N.accent };
      default:
        return { bg: N.pillBg, fg: N.textSecondary };
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

  const PollCard = ({ poll }: { poll: Poll }) => (
    <View style={[styles.pollCard, { backgroundColor: N.surface, borderColor: N.border }]}>
      <View style={styles.pollContent}>
        <Text style={[styles.pollTitle, { color: N.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {poll.title}
        </Text>
        {poll.description && (
          <Text style={[styles.pollDescription, { color: N.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {poll.description}
          </Text>
        )}
        <View style={styles.pollMeta}>
          <View style={styles.pollDate}>
            <Calendar size={12} color={N.textTertiary} strokeWidth={2} />
            <Text style={[styles.pollDateText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {new Date(poll.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View
            style={[
              styles.statusTag,
              {
                backgroundColor:
                  poll.status === 'published' ? 'rgba(16, 185, 129, 0.12)' : N.pillBg,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: poll.status === 'published' ? '#047857' : N.textSecondary },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              {poll.status === 'published' ? 'Active' : 'Done'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.pollActions}>
        {poll.status === 'completed' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: N.accentSoft, borderWidth: 1, borderColor: N.accentSoftBorder }]}
            onPress={() => handleViewResults(poll)}
            activeOpacity={0.7}
          >
            <BarChart3 size={14} color={N.accent} strokeWidth={2} />
          </TouchableOpacity>
        )}
        {poll.status === 'published' && (
          <TouchableOpacity
            style={[styles.closePollsButton, { backgroundColor: N.page, borderColor: N.borderStrong }]}
            onPress={() => handleClosePollClick(poll)}
            activeOpacity={0.7}
          >
            <Text style={[styles.closePollsButtonText, { color: N.textSecondary }]}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>Loading voting operations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header — minimal doc title */}
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Voting Operations</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Club — flat callout block */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: N.surface, borderColor: N.border }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: 'rgba(55, 53, 47, 0.06)' }]}>
                <Building2 size={18} color={N.iconMuted} strokeWidth={1.75} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (() => {
                    const pill = notionRolePill(user.clubRole);
                    return (
                      <View style={[styles.roleTag, { backgroundColor: pill.bg }]}>
                        {getRoleIcon(user.clubRole, pill.fg)}
                        <Text style={[styles.roleText, { color: pill.fg }]} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Tabs — segment control (Notion-style) */}
        <View style={[styles.tabsSegmentWrap, { backgroundColor: N.segmentTrack }]}>
          {!hasActivePoll && (
            <TouchableOpacity
              style={[
                styles.tabSegment,
                selectedTab === 'create' && styles.tabSegmentActive,
                { backgroundColor: selectedTab === 'create' ? N.surface : 'transparent' },
              ]}
              onPress={() => setSelectedTab('create')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.tabSegmentText, { color: selectedTab === 'create' ? N.text : N.textSecondary }]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                Create poll
              </Text>
              <Plus size={14} color={selectedTab === 'create' ? N.text : N.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.tabSegment,
              hasActivePoll && styles.tabSegmentWide,
              selectedTab === 'published' && styles.tabSegmentActive,
              { backgroundColor: selectedTab === 'published' ? N.surface : 'transparent' },
            ]}
            onPress={() => setSelectedTab('published')}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.tabSegmentText, { color: selectedTab === 'published' ? N.text : N.textSecondary }]}
              maxFontSizeMultiplier={1.3}
            >
              Active
            </Text>
            <View style={[styles.tabCountNotion, { backgroundColor: N.pillBg }]}>
              <Text style={[styles.tabCountNotionText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {publishedCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabSegment,
              hasActivePoll && styles.tabSegmentWide,
              selectedTab === 'completed' && styles.tabSegmentActive,
              { backgroundColor: selectedTab === 'completed' ? N.surface : 'transparent' },
            ]}
            onPress={() => setSelectedTab('completed')}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.tabSegmentText, { color: selectedTab === 'completed' ? N.text : N.textSecondary }]}
              maxFontSizeMultiplier={1.3}
            >
              Results
            </Text>
            <View style={[styles.tabCountNotion, { backgroundColor: N.pillBg }]}>
              <Text style={[styles.tabCountNotionText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {completedCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {selectedTab === 'create' && !hasActivePoll && (
          <View style={[styles.createPollCard, { backgroundColor: N.surface, borderColor: N.border }]}>
            <TouchableOpacity
              style={[
                styles.autoFillHero,
                {
                  backgroundColor: isAutoFilling || isPollQuestionsLoading ? N.pillBg : N.page,
                  borderColor: N.border,
                },
              ]}
              onPress={handleAutoFill}
              disabled={isAutoFilling || isPollQuestionsLoading}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Auto fill polls"
            >
              <View style={[styles.autoFillHeroIconWrap, { backgroundColor: N.iconTile }]}>
                <Sparkles
                  size={18}
                  color={isAutoFilling || isPollQuestionsLoading ? N.textTertiary : N.accent}
                  strokeWidth={1.75}
                />
              </View>
              <Text
                style={[
                  styles.autoFillHeroLabel,
                  { color: isAutoFilling || isPollQuestionsLoading ? N.textSecondary : N.text },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {isAutoFilling ? 'Filling…' : 'Auto fill polls'}
              </Text>
            </TouchableOpacity>

            {/* Poll Title */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: N.page, borderColor: N.border, color: N.text }]}
                placeholder="Untitled poll"
                placeholderTextColor={N.textTertiary}
                value={pollForm.title}
                onChangeText={(text) => updatePollField('title', text)}
              />
            </View>

            {/* Available Questions */}
            <View style={styles.questionsSection}>
              <Text style={[styles.questionsTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Questions · {pollForm.selectedQuestions.length} selected
              </Text>

              {isPollQuestionsLoading ? (
                <View style={styles.questionsLoadingRow}>
                  <ActivityIndicator size="small" color={N.accent} />
                  <Text style={[styles.questionsLoadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Loading questions…
                  </Text>
                </View>
              ) : null}

              {!isPollQuestionsLoading &&
                pollQuestions.map((question) => {
                const isSelected = pollForm.selectedQuestions.includes(question.id);
                
                return (
                  <View key={question.id} style={[styles.questionCard, { borderColor: N.border }]}>
                    <TouchableOpacity
                      style={[
                        styles.questionSelector,
                        {
                          backgroundColor: isSelected ? N.rowSelected : N.surface,
                          borderColor: isSelected ? N.accentSoftBorder : N.border,
                        }
                      ]}
                      onPress={() => toggleQuestion(question.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.questionCheckbox,
                        {
                          backgroundColor: isSelected ? N.accent : 'transparent',
                          borderColor: isSelected ? N.accent : N.borderStrong,
                        }
                      ]}>
                        {isSelected && (
                          <Text style={styles.checkmark} maxFontSizeMultiplier={1.3}>✓</Text>
                        )}
                      </View>
                      <Text style={[styles.questionText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                        {question.question_text}
                      </Text>
                    </TouchableOpacity>

                    {/* Options for selected questions */}
                    {isSelected && (
                      <View style={styles.optionsSection}>
                        <Text style={[styles.optionsLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Options · min {question.min_options}, max {question.max_options}
                        </Text>
                        
                        {(pollForm.questionOptions[question.id] || []).map((option, optionIndex) => (
                          <View key={optionIndex} style={styles.optionRow}>
                            <TextInput
                              style={[styles.optionInput, { backgroundColor: N.page, borderColor: N.border, color: N.text }]}
                              placeholder={`Option ${optionIndex + 1}`}
                              placeholderTextColor={N.textTertiary}
                              value={option}
                              onChangeText={(text) => updateQuestionOption(question.id, optionIndex, text)}
                            />
                            {(pollForm.questionOptions[question.id]?.length || 0) > question.min_options && (
                              <TouchableOpacity
                                style={[styles.removeOptionButton, { backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}
                                onPress={() => removeQuestionOption(question.id, optionIndex)}
                              >
                                <Trash2 size={14} color="#DC2626" strokeWidth={2} />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}

                        {(pollForm.questionOptions[question.id]?.length || 0) < question.max_options && (
                          <View style={styles.addOptionsContainer}>
                            <TouchableOpacity
                              style={[styles.addOptionButton, { backgroundColor: N.page, borderColor: N.border }]}
                              onPress={() => addTextOption(question.id)}
                            >
                              <Plus size={14} color={N.textSecondary} strokeWidth={2} />
                              <Text style={[styles.addOptionText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>Add option</Text>
                            </TouchableOpacity>
                            
                            {isQuestionAboutMembers(question.question_text) && (
                              <TouchableOpacity
                                style={[styles.addOptionButton, { backgroundColor: N.accentSoft, borderColor: N.accentSoftBorder }]}
                                onPress={() => handleAddMemberOption(question.id)}
                              >
                                <Plus size={14} color={N.accent} strokeWidth={2} />
                                <Text style={[styles.addOptionText, { color: N.accent }]} maxFontSizeMultiplier={1.3}>Add member</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {!isPollQuestionsLoading && pollQuestions.length === 0 ? (
                <View style={styles.noQuestionsState}>
                  <Vote size={28} color={N.textTertiary} strokeWidth={1.5} />
                  <Text style={[styles.noQuestionsText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No questions yet
                  </Text>
                  <Text style={[styles.noQuestionsSubtext, { color: N.textTertiary }]} maxFontSizeMultiplier={1.3}>
                    Ask an admin to add poll questions in the system.
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Primary actions */}
            <View style={styles.pollActionsRow}>
              <TouchableOpacity
                style={[
                  styles.createPollButton,
                  {
                    backgroundColor: isSaving ? N.pillBg : N.text,
                    borderColor: isSaving ? N.border : N.text,
                  },
                ]}
                onPress={handleSavePoll}
                disabled={isSaving || isPollQuestionsLoading}
                activeOpacity={0.85}
              >
                <Save size={16} color={isSaving || isPollQuestionsLoading ? N.textSecondary : N.surface} strokeWidth={2} />
                <Text
                  style={[
                    styles.createPollButtonText,
                    { color: isSaving || isPollQuestionsLoading ? N.textSecondary : N.surface },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {isSaving ? 'Creating…' : isPollQuestionsLoading ? 'Loading…' : 'Create poll'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active Poll Notice */}
        {hasActivePoll && selectedTab === 'create' && (
          <View style={[styles.activePollNotice, { backgroundColor: N.surface, borderLeftColor: N.accent, borderColor: N.border }]}>
            <View style={[styles.noticeIcon, { backgroundColor: N.accentSoft }]}>
              <Vote size={22} color={N.accent} strokeWidth={2} />
            </View>
            <Text style={[styles.noticeTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              One poll at a time
            </Text>
            <Text style={[styles.noticeMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Close the current poll before creating another.
            </Text>
            <TouchableOpacity
              style={[styles.viewActivePollButton, { backgroundColor: N.text }]}
              onPress={() => setSelectedTab('published')}
              activeOpacity={0.85}
            >
              <Text style={[styles.viewActivePollButtonText, { color: N.surface }]} maxFontSizeMultiplier={1.3}>View active poll</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active / Results (completed) polls list */}
        {(selectedTab === 'published' || selectedTab === 'completed') && (
          <View style={[styles.pollsSection, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Text style={[styles.sectionTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              {selectedTab === 'published'
                ? `Active · ${filteredPolls.length}`
                : `Results · ${filteredPolls.length}`}
            </Text>
            
            {filteredPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}

            {filteredPolls.length === 0 && (
              <View style={styles.emptyState}>
                <Vote size={28} color={N.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.emptyText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'published'
                    ? 'No active polls'
                    : 'No results yet'}
                </Text>
                <Text style={[styles.emptySubtext, { color: N.textTertiary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'published' 
                    ? 'When you publish a poll, it shows up here.'
                    : 'Closed polls appear in this list.'
                  }
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Close Poll Confirmation Modal - works on web */}
      <Modal
        visible={!!closePollConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !isClosingPoll && setClosePollConfirm(null)}
      >
        <TouchableOpacity
          style={styles.closePollModalOverlay}
          activeOpacity={1}
          onPress={() => !isClosingPoll && setClosePollConfirm(null)}
        >
          <TouchableOpacity
            style={[styles.closePollModalContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.closePollModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Close Poll
            </Text>
            <Text style={[styles.closePollModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to close "{closePollConfirm?.title}"? This will stop accepting new votes.
            </Text>
            <View style={styles.closePollModalButtons}>
              <TouchableOpacity
                style={[styles.closePollModalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => !isClosingPoll && setClosePollConfirm(null)}
                disabled={isClosingPoll}
              >
                <Text style={[styles.closePollModalCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closePollModalConfirmBtn, { backgroundColor: '#dc2626' }]}
                onPress={confirmClosePoll}
                disabled={isClosingPoll}
              >
                <Text style={styles.closePollModalConfirmText} maxFontSizeMultiplier={1.3}>
                  {isClosingPoll ? 'Closing...' : 'Close Poll'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Meeting Selection Modal */}
      <Modal
        visible={showMeetingSelectModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMeetingSelectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.meetingModal, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Meeting</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowMeetingSelectModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.meetingsList}
              contentContainerStyle={styles.meetingsListContent}
            >
              {openMeetings.map((meeting) => (
                <TouchableOpacity
                  key={meeting.id}
                  style={[styles.meetingOption, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => populatePollFromMeeting(meeting.id, meeting.meeting_date)}
                >
                  <View style={[styles.meetingIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Calendar size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.meetingInfo}>
                    <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {meeting.meeting_title || 'Club Meeting'}
                    </Text>
                    <Text style={[styles.meetingDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Member Selection Modal */}
      <Modal
        visible={showMemberModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.memberModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Club Member</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowMemberModal(false);
                  setMemberSearchQuery('');
                }}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search and Count Section */}
            <View style={styles.searchSection}>
              <View style={[styles.searchContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Search size={16} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search members..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={memberSearchQuery}
                  onChangeText={setMemberSearchQuery}
                  autoCapitalize="none"
                />
              </View>
              <Text style={[styles.memberCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {filteredClubMembers.length} of {clubMembers.length} members
              </Text>
            </View>
            
            {/* Members List with proper scrolling */}
            <ScrollView 
              style={styles.membersList} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.membersListContent}
            >
              {isLoadingMembers && filteredClubMembers.length === 0 ? (
                <View style={styles.membersLoading}>
                  <ActivityIndicator size="small" color={N.accent} />
                  <Text style={[styles.membersLoadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Loading members…
                  </Text>
                </View>
              ) : null}
              {filteredClubMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberOption, { backgroundColor: theme.colors.surface }]}
                  onPress={() => handleMemberSelect(member)}
                >
                  <View style={styles.memberAvatar}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.memberAvatarImage} />
                    ) : (
                      <User size={20} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {/* Empty State for Search */}
              {filteredClubMembers.length === 0 && memberSearchQuery.trim() && (
                <View style={styles.emptySearchState}>
                  <Search size={32} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptySearchText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No members found
                  </Text>
                  <Text style={[styles.emptySearchSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Try searching with a different name or email
                  </Text>
                </View>
              )}
            </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  clubCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 4,
    padding: 14,
    borderWidth: 1,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  tabsSegmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 4,
    borderRadius: 6,
    gap: 2,
  },
  tabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 6,
  },
  tabSegmentWide: {
    flex: 1,
  },
  tabSegmentActive: {
    shadowColor: 'rgba(55, 53, 47, 0.12)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabSegmentText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  tabCountNotion: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 22,
    alignItems: 'center',
  },
  tabCountNotionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  createPollCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 4,
    padding: 20,
    borderWidth: 1,
  },
  autoFillHero: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  autoFillHeroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoFillHeroLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
    letterSpacing: 0.02,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
  },
  questionsSection: {
    marginBottom: 20,
  },
  questionsTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    letterSpacing: -0.1,
  },
  questionsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  questionsLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  questionCard: {
    borderRadius: 4,
    padding: 0,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  questionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 0,
    padding: 12,
    marginBottom: 0,
  },
  questionCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
    lineHeight: 22,
    letterSpacing: -0.15,
  },
  optionsSection: {
    paddingLeft: 16,
    marginBottom: 12,
  },
  optionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginRight: 8,
    fontSize: 14,
  },
  removeOptionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 4,
    paddingVertical: 10,
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  noQuestionsState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noQuestionsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noQuestionsSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  pollActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createPollButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    paddingVertical: 12,
    borderWidth: 1,
  },
  createPollButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  pollsSection: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 4,
    padding: 18,
    borderWidth: 1,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  pollCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  pollContent: {
    flex: 1,
    marginRight: 12,
  },
  pollTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  pollDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  pollMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pollDateText: {
    fontSize: 11,
    marginLeft: 4,
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pollActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePollsButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePollsButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closePollModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  closePollModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  closePollModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  closePollModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  closePollModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closePollModalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  closePollModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  closePollModalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 12,
  },
  closePollModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  activePollNotice: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 4,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noticeTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  noticeMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  viewActivePollButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 4,
  },
  viewActivePollButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  memberModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    minHeight: '75%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  memberCount: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  membersList: {
    flex: 1,
  },
  membersListContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  membersLoading: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  membersLoadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberEmail: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  memberRoleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberRoleText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 3,
  },
  emptySearchState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptySearchText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySearchSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  meetingModal: {
    width: '90%',
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  meetingsList: {
    maxHeight: 400,
  },
  meetingsListContent: {
    padding: 16,
  },
  meetingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  meetingIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  meetingDate: {
    fontSize: 13,
    lineHeight: 18,
  },
});
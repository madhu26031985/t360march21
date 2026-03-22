import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Vote, Calendar, Users, X, Save, Trash2, ChartBar as BarChart3, Building2, Crown, User, Shield, Eye, UserCheck, Search, Sparkles } from 'lucide-react-native';

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
  role: string;
}

export default function VotingOperations() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollQuestions, setPollQuestions] = useState<PollQuestion[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      return;
    }

    try {
      await Promise.all([
        loadClubInfo(),
        loadPolls(),
        loadPollQuestions(),
        loadClubMembers()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
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

  const loadPolls = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('polls')
        .select('*')
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
      console.log('Loading poll questions...');
      const { data, error } = await supabase
        .from('polls_questions')
        .select('*')
        .eq('is_active', true)
        .order('order_index');

      if (error) {
        console.error('Error loading poll questions:', error);
        return;
      }

      console.log('Poll questions loaded:', data?.length || 0);
      setPollQuestions(data || []);
    } catch (error) {
      console.error('Error loading poll questions:', error);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      console.log('Loading club members...');
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('user_id, role, app_user_profiles!inner(id, full_name, email, avatar_url)')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        avatar_url: (item as any).app_user_profiles.avatar_url || null,
        role: (item as any).role,
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));

      console.log('Club members loaded:', members.length);
      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
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
    setSelectedQuestionForOptions(questionId);
    setShowMemberModal(true);
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
    console.log('Add Member button pressed for question:', questionId);
    setSelectedQuestionForOptions(questionId);
    setShowMemberModal(true);
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

  const PollCard = ({ poll }: { poll: Poll }) => (
    <View style={[styles.pollCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.pollContent}>
        <Text style={[styles.pollTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {poll.title}
        </Text>
        {poll.description && (
          <Text style={[styles.pollDescription, { color: theme.colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {poll.description}
          </Text>
        )}
        <View style={styles.pollMeta}>
          <View style={styles.pollDate}>
            <Calendar size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.pollDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {new Date(poll.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View style={[
            styles.statusTag,
            { backgroundColor: poll.status === 'published' ? '#10b981' + '20' : '#6b7280' + '20' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: poll.status === 'published' ? '#10b981' : '#6b7280' }
            ]} maxFontSizeMultiplier={1.3}>
              {poll.status === 'published' ? 'Active' : 'Results'}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.pollActions}>
        {poll.status === 'completed' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#eff6ff' }]}
            onPress={() => handleViewResults(poll)}
            activeOpacity={0.7}
          >
            <BarChart3 size={14} color="#3b82f6" />
          </TouchableOpacity>
        )}
        {poll.status === 'published' && (
          <TouchableOpacity
            style={[styles.closePollsButton, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}
            onPress={() => handleClosePollClick(poll)}
            activeOpacity={0.7}
          >
            <Text style={styles.closePollsButtonText}>Close polls</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading voting operations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting Operations</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                      {getRoleIcon(user.clubRole)}
                      <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {!hasActivePoll && (
            <TouchableOpacity
              style={[
                styles.tab,
                {
                  backgroundColor: selectedTab === 'create' ? theme.colors.primary : theme.colors.surface,
                  borderColor: selectedTab === 'create' ? theme.colors.primary : theme.colors.border,
                }
              ]}
              onPress={() => setSelectedTab('create')}
            >
              <Text style={[
                styles.tabText,
                { color: selectedTab === 'create' ? '#ffffff' : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Create Poll
              </Text>
              <Plus size={16} color={selectedTab === 'create' ? '#ffffff' : theme.colors.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              hasActivePoll ? styles.tabWide : styles.tab,
              {
                backgroundColor: selectedTab === 'published' ? theme.colors.primary : theme.colors.surface,
                borderColor: selectedTab === 'published' ? theme.colors.primary : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('published')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'published' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Active
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'published' ? '#ffffff' + '20' : theme.colors.primary + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'published' ? '#ffffff' : theme.colors.primary }
              ]} maxFontSizeMultiplier={1.3}>
                {publishedCount}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              hasActivePoll ? styles.tabWide : styles.tab,
              {
                backgroundColor: selectedTab === 'completed' ? theme.colors.primary : theme.colors.surface,
                borderColor: selectedTab === 'completed' ? theme.colors.primary : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('completed')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'completed' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Results
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'completed' ? '#ffffff' + '20' : theme.colors.primary + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'completed' ? '#ffffff' : theme.colors.primary }
              ]} maxFontSizeMultiplier={1.3}>
                {completedCount}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {selectedTab === 'create' && !hasActivePoll && (
          <View style={[styles.createPollCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create New Poll</Text>
            
            {/* Poll Title */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Poll Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter poll title"
                placeholderTextColor={theme.colors.textSecondary}
                value={pollForm.title}
                onChangeText={(text) => updatePollField('title', text)}
              />
            </View>

            {/* Available Questions */}
            <View style={styles.questionsSection}>
              <Text style={[styles.questionsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Select Questions ({pollForm.selectedQuestions.length} selected)
              </Text>
              
              {pollQuestions.map((question) => {
                const isSelected = pollForm.selectedQuestions.includes(question.id);
                
                return (
                  <View key={question.id} style={[styles.questionCard, { backgroundColor: theme.colors.background }]}>
                    <TouchableOpacity
                      style={[
                        styles.questionSelector,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '20' : 'transparent',
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => toggleQuestion(question.id)}
                    >
                      <View style={[
                        styles.questionCheckbox,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        }
                      ]}>
                        {isSelected && (
                          <Text style={styles.checkmark} maxFontSizeMultiplier={1.3}>✓</Text>
                        )}
                      </View>
                      <Text style={[
                        styles.questionText,
                        { color: isSelected ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {question.question_text}
                      </Text>
                    </TouchableOpacity>

                    {/* Options for selected questions */}
                    {isSelected && (
                      <View style={styles.optionsSection}>
                        <Text style={[styles.optionsLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Options (min {question.min_options}, max {question.max_options}):
                        </Text>
                        
                        {(pollForm.questionOptions[question.id] || []).map((option, optionIndex) => (
                          <View key={optionIndex} style={styles.optionRow}>
                            <TextInput
                              style={[styles.optionInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                              placeholder={`Option ${optionIndex + 1}`}
                              placeholderTextColor={theme.colors.textSecondary}
                              value={option}
                              onChangeText={(text) => updateQuestionOption(question.id, optionIndex, text)}
                            />
                            {(pollForm.questionOptions[question.id]?.length || 0) > question.min_options && (
                              <TouchableOpacity
                                style={[styles.removeOptionButton, { backgroundColor: '#fef2f2' }]}
                                onPress={() => removeQuestionOption(question.id, optionIndex)}
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}

                        {(pollForm.questionOptions[question.id]?.length || 0) < question.max_options && (
                          <View style={styles.addOptionsContainer}>
                            <TouchableOpacity
                              style={[styles.addOptionButton, { backgroundColor: theme.colors.success + '20', borderColor: theme.colors.success }]}
                              onPress={() => addTextOption(question.id)}
                            >
                              <Plus size={14} color={theme.colors.success} />
                              <Text style={[styles.addOptionText, { color: theme.colors.success }]} maxFontSizeMultiplier={1.3}>Add Option</Text>
                            </TouchableOpacity>
                            
                            {isQuestionAboutMembers(question.question_text) && (
                              <TouchableOpacity
                                style={[styles.addOptionButton, { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }]}
                                onPress={() => handleAddMemberOption(question.id)}
                              >
                                <Plus size={14} color={theme.colors.primary} />
                                <Text style={[styles.addOptionText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Add Member</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {pollQuestions.length === 0 && (
                <View style={styles.noQuestionsState}>
                  <Vote size={32} color={theme.colors.textSecondary} />
                  <Text style={[styles.noQuestionsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No poll questions available
                  </Text>
                  <Text style={[styles.noQuestionsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Contact your system administrator to add poll questions
                  </Text>
                </View>
              )}
            </View>

            {/* Create Poll and Auto Fill Buttons Row */}
            <View style={styles.pollActionsRow}>
              <TouchableOpacity
                style={[
                  styles.createPollButton,
                  {
                    backgroundColor: isSaving ? theme.colors.surface : theme.colors.primary,
                    borderColor: theme.colors.border,
                  }
                ]}
                onPress={handleSavePoll}
                disabled={isSaving}
              >
                <Save size={16} color={isSaving ? theme.colors.textSecondary : "#ffffff"} />
                <Text style={[
                  styles.createPollButtonText,
                  { color: isSaving ? theme.colors.textSecondary : "#ffffff" }
                ]} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Creating...' : 'Create Poll'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.autoFillIconButton,
                  {
                    backgroundColor: isAutoFilling ? theme.colors.surface : '#8b5cf6' + '20',
                    borderColor: '#8b5cf6',
                  }
                ]}
                onPress={handleAutoFill}
                disabled={isAutoFilling}
              >
                <Sparkles size={20} color={isAutoFilling ? theme.colors.textSecondary : "#8b5cf6"} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Active Poll Notice */}
        {hasActivePoll && selectedTab === 'create' && (
          <View style={[styles.activePollNotice, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.noticeIcon, { backgroundColor: theme.colors.warning + '20' }]}>
              <Vote size={24} color={theme.colors.warning} />
            </View>
            <Text style={[styles.noticeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Poll Creation Disabled
            </Text>
            <Text style={[styles.noticeMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Only one poll can be active at a time. Please close the current active poll before creating a new one.
            </Text>
            <TouchableOpacity
              style={[styles.viewActivePollButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setSelectedTab('published')}
            >
              <Text style={styles.viewActivePollButtonText} maxFontSizeMultiplier={1.3}>View Active Poll</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Active / Results (completed) polls list */}
        {(selectedTab === 'published' || selectedTab === 'completed') && (
          <View style={[styles.pollsSection, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {selectedTab === 'published'
                ? `Active Polls (${filteredPolls.length})`
                : `Poll Results (${filteredPolls.length})`}
            </Text>
            
            {filteredPolls.map((poll) => (
              <PollCard key={poll.id} poll={poll} />
            ))}

            {filteredPolls.length === 0 && (
              <View style={styles.emptyState}>
                <Vote size={32} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'published'
                    ? 'No active polls'
                    : 'No poll results yet'}
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'published' 
                    ? 'Active polls will appear here'
                    : 'Finished polls with results will appear here'
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
  content: {
    flex: 1,
  },
  clubCard: {
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
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
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
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
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
  tabWide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
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
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  tabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  createPollCard: {
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
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  questionsSection: {
    marginBottom: 20,
  },
  questionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  questionCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  questionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  questionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
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
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    borderRadius: 8,
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
    gap: 12,
    alignItems: 'center',
  },
  createPollButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  autoFillIconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
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
  createPollButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  pollsSection: {
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
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  pollCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePollsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
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
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noticeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  noticeMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  viewActivePollButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  viewActivePollButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
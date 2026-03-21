import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  MessageSquare,
  Save,
  Plus,
  Trash2,
  X,
  StickyNote,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  User,
  Edit,
  UserMinus,
  CheckSquare,
  UserCheck,
  ClipboardList,
  Shield,
  Vote,
  BookOpen,
  Bell,
  Award,
  Mic,
  GraduationCap,
  Settings,
  UserCog,
  LayoutDashboard,
  CalendarCheck,
  Users,
  Search
} from 'lucide-react-native';

// Type definitions
interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface TableTopicMaster {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface TableTopicQuestion {
  id: string;
  meeting_id: string;
  club_id: string;
  table_topic_master_id: string;
  question_text: string;
  question_order: number;
  is_used: boolean;
  created_at: string;
  updated_at: string;
}

interface QuestionForm {
  question_text: string;
}

interface TableTopicParticipant {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface AssignedQuestion {
  id: string;
  meeting_id: string;
  participant_id: string;
  participant_name: string;
  question_text: string;
  asked_by: string;
  asked_by_name: string;
  table_topic_master_user_id: string;
  booking_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface QuestionSlot {
  index: number;
  questionText: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  isExpanded: boolean;
}

const QUESTION_UPDATE_KEY = '@table_topic_question_update';

/**
 * Table Topic Master Notes Component
 * Allows Table Topic Master to manage their personal question bank
 */
export default function TableTopicMasterNotes(): JSX.Element {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [tableTopicMaster, setTableTopicMaster] = useState<TableTopicMaster | null>(null);
  const [questions, setQuestions] = useState<TableTopicQuestion[]>([]);
  const [participants, setParticipants] = useState<TableTopicParticipant[]>([]);
  const [assignedQuestions, setAssignedQuestions] = useState<AssignedQuestion[]>([]);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedQuestion, setSelectedQuestion] = useState<TableTopicQuestion | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'assignment' | 'notes' | 'quick_access'>('questions');
  const [clubMembers, setClubMembers] = useState<{ id: string; full_name: string; email: string; avatar_url: string | null }[]>([]);
  const [assigningSlotIndex, setAssigningSlotIndex] = useState<number | null>(null);
  const [manualAssignName, setManualAssignName] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [isExcomm, setIsExcomm] = useState<boolean>(false);
  const [personalNotes, setPersonalNotes] = useState<string>('');
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState<boolean>(false);
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [notesJustSaved, setNotesJustSaved] = useState<boolean>(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const questionAutoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [allQuestionsPublishStatus, setAllQuestionsPublishStatus] = useState<{published: number, unpublished: number}>({published: 0, unpublished: 0});

  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question_text: '',
  });

  const [questionSlots, setQuestionSlots] = useState<QuestionSlot[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      index: i,
      questionText: '',
      assignedUserId: null,
      assignedUserName: null,
      isExpanded: false
    }))
  );
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [showParticipantPicker, setShowParticipantPicker] = useState<number | null>(null);
  const [showQuestionsViewer, setShowQuestionsViewer] = useState<boolean>(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState<string>('');
  const hasLoadedInitialData = useRef<boolean>(false);
  const isLoadingFromDatabase = useRef<boolean>(false);

  // Load data on component mount
  useEffect(() => {
    if (meetingId) {
      loadTableTopicMasterData();
      loadAllQuestionsPublishStatus();
      checkExcommStatus();
    }
  }, [meetingId]);

  // Check for question updates when screen gains focus
  useFocusEffect(
    useCallback(() => {
      const checkForQuestionUpdate = async () => {
        try {
          const updateData = await AsyncStorage.getItem(QUESTION_UPDATE_KEY);
          if (updateData) {
            const { slotIndex, questionText } = JSON.parse(updateData);
            await AsyncStorage.removeItem(QUESTION_UPDATE_KEY);
            updateQuestionSlot(slotIndex, questionText);
            await saveQuestionSlotDirectly(slotIndex, questionText);
            hasLoadedInitialData.current = true;
            isLoadingFromDatabase.current = false;
          }
        } catch (error) {
          console.error('Error checking for question update:', error);
        }
      };

      checkForQuestionUpdate();
    }, [meetingId, user?.id, user?.currentClubId])
  );

  // Populate question slots from loaded assigned questions
  useEffect(() => {
    if (!user?.id || !meetingId) return;

    console.log('Populating slots from assigned questions:', assignedQuestions.length);

    // Mark that we're loading from database to prevent auto-save
    isLoadingFromDatabase.current = true;

    // Always reset slots first
    const newSlots = Array.from({ length: 12 }, (_, i) => ({
      index: i,
      questionText: '',
      assignedUserId: null,
      assignedUserName: null,
      isExpanded: false
    }));

    // Filter questions created by current Table Topic Master (already filtered by query, but being safe)
    const myQuestions = assignedQuestions.filter(
      q => q.table_topic_master_user_id === user.id
    );

    console.log('My questions to populate:', myQuestions.length);

    // Populate slots with saved questions
    myQuestions.forEach((q, index) => {
      if (index < 12) {
        newSlots[index] = {
          index: index,
          questionText: q.question_text || '',
          assignedUserId: q.participant_id || null,
          assignedUserName: q.participant_name || null,
          isExpanded: false
        };
        console.log(`Slot ${index}: ${q.question_text?.substring(0, 30)}...`);
      }
    });

    setQuestionSlots(newSlots);

    // Note: The isLoadingFromDatabase flag is cleared by loadAssignedQuestions()
    // after a delay to ensure auto-save doesn't trigger during initial load
  }, [assignedQuestions, user?.id, meetingId]);


  /**
   * Auto-save personal notes
   */
  useEffect(() => {
    // Don't auto-save on initial load or if notes haven't changed
    if (!hasUnsavedNotes || !meetingId || !user?.currentClubId || !user?.id) {
      return;
    }

    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer to save after 2 seconds of inactivity
    autoSaveTimerRef.current = setTimeout(async () => {
      await autoSavePersonalNotes();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [personalNotes, hasUnsavedNotes, meetingId, user?.currentClubId, user?.id]);

  /**
   * Auto-save questions
   */
  useEffect(() => {
    // Don't auto-save on initial load or during database loading
    if (!hasLoadedInitialData.current || isLoadingFromDatabase.current || !meetingId || !user?.currentClubId || !user?.id) {
      console.log('Skipping auto-save:', {
        hasLoaded: hasLoadedInitialData.current,
        isLoading: isLoadingFromDatabase.current,
        hasMeeting: !!meetingId
      });
      return;
    }

    // Clear any existing timer
    if (questionAutoSaveTimerRef.current) {
      clearTimeout(questionAutoSaveTimerRef.current);
    }

    // Set new timer to save after 1.5 seconds of inactivity
    questionAutoSaveTimerRef.current = setTimeout(async () => {
      console.log('Auto-save triggered for questions');
      await saveAllQuestions();
    }, 1500);

    return () => {
      if (questionAutoSaveTimerRef.current) {
        clearTimeout(questionAutoSaveTimerRef.current);
      }
    };
  }, [questionSlots, meetingId, user?.currentClubId, user?.id]);

  /**
   * Load all Table Topic Master data
   */
  const loadTableTopicMasterData = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadTableTopicMaster(),
        loadQuestions(),
        loadParticipants(),
        loadAssignedQuestions(),
        loadPersonalNotes(),
        loadClubMembers()
      ]);
    } catch (error) {
      console.error('Error loading Table Topic Master data:', error);
      Alert.alert('Error', 'Failed to load Table Topic Master data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load personal notes
   */
  const loadPersonalNotes = async (): Promise<void> => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_toastmaster_notes')
        .select('personal_notes')
        .eq('meeting_id', meetingId)
        .eq('toastmaster_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading personal notes:', error);
        return;
      }

      if (data) {
        setPersonalNotes(data.personal_notes || '');
      }
    } catch (error) {
      console.error('Error loading personal notes:', error);
    }
  };

  /**
   * Check if current user is ExComm
   */
  const checkExcommStatus = async (): Promise<void> => {
    if (!user?.id || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (!error && data) {
        setIsExcomm(data.role === 'excomm' || data.role === 'club_leader');
      }
    } catch (error) {
      console.error('Error checking excomm status:', error);
    }
  };

  /**
   * Load meeting details
   */
  const loadMeeting = async (): Promise<void> => {
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

  /**
   * Load Table Topic Master assignment
   */
  const loadTableTopicMaster = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%')
        .eq('role_status', 'Available')
        .not('assigned_user_id', 'is', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading table topic master:', error);
        return;
      }

      setTableTopicMaster(data);
    } catch (error) {
      console.error('Error loading table topic master:', error);
    }
  };

  /**
   * Load existing questions
   */
  const loadQuestions = async (): Promise<void> => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('table_topic_master_questions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_id', user.id)
        .order('question_order');

      if (error) {
        console.error('Error loading questions:', error);
        return;
      }

      setQuestions(data || []);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  /**
   * Load Table Topic Participants
   */
  const loadParticipants = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .or('role_name.ilike.%Table Topics Speaker%,role_name.ilike.%Table Topic Speaker%,role_name.ilike.%Table Topics Participant%,role_name.ilike.%Table Topic Participant%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .order('order_index');

      if (error) {
        console.error('Error loading participants:', error);
        return;
      }

      setParticipants(data || []);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  /**
   * Load all club members for assignment
   */
  const loadClubMembers = async (): Promise<void> => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          user_id,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('club_id', user.currentClubId);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members = (data || [])
        .map((r: any) => r.app_user_profiles)
        .filter(Boolean)
        .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || ''));

      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  /**
   * Load assigned questions
   */
  const loadAssignedQuestions = async (): Promise<void> => {
    if (!meetingId || !user?.id) return;

    try {
      console.log('Loading assigned questions for current TT Master...');

      // Mark that we're loading from database
      isLoadingFromDatabase.current = true;

      // Only load questions created by the current user (current Table Topic Master)
      const { data, error } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_user_id', user.id)
        .in('booking_status', ['booked', 'pending'])
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      console.log('Loaded questions for current TT Master:', {
        count: data?.length || 0,
        currentTTMaster: user?.id,
        questions: data?.map(q => ({
          participant: q.participant_name,
          question: q.question_text
        })) || []
      });

      if (error) {
        console.error('Error loading assigned questions:', error);
        isLoadingFromDatabase.current = false;
        return;
      }

      setAssignedQuestions(data || []);

      // Mark that initial data has been loaded successfully
      // This prevents auto-save from triggering before data is loaded
      // Wait for slots to be populated before clearing the loading flag
      setTimeout(() => {
        isLoadingFromDatabase.current = false;
        console.log('Database load complete - slots populated');
      }, 300);

      if (!hasLoadedInitialData.current) {
        setTimeout(() => {
          hasLoadedInitialData.current = true;
          console.log('Initial data load complete - auto-save now enabled');
        }, 800);
      }
    } catch (error) {
      console.error('Error loading assigned questions:', error);
      isLoadingFromDatabase.current = false;
    }
  };

  /**
   * Check if current user is the Table Topic Master
   */
  const isTableTopicMaster = (): boolean => {
    return tableTopicMaster?.assigned_user_id === user?.id;
  };

  /**
   * Handle adding new question
   */
  const handleAddQuestion = (): void => {
    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master can add questions.');
      return;
    }

    if (questions.length >= 12) {
      Alert.alert('Maximum Reached', 'You can only add up to 12 questions per meeting.');
      return;
    }

    setQuestionForm({ question_text: '' });
    setShowAddModal(true);
  };

  /**
   * Handle saving new question
   */
  const handleSaveQuestion = async (): Promise<void> => {
    if (!questionForm.question_text.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    if (questionForm.question_text.length > 200) {
      Alert.alert('Error', 'Question cannot exceed 200 characters');
      return;
    }

    setIsSaving(true);
    
    try {
      if (!meetingId || !user?.currentClubId || !user?.id) {
        Alert.alert('Error', 'Missing required information');
        return;
      }

      const saveData = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        table_topic_master_id: user.id,
        question_text: questionForm.question_text.trim(),
        question_order: questions.length + 1,
        is_used: false,
      };

      const { error } = await supabase
        .from('table_topic_master_questions')
        .insert(saveData);

      if (error) {
        console.error('Error saving question:', error);
        Alert.alert('Error', 'Failed to save question');
        return;
      }

      Alert.alert('Success', 'Question added successfully');
      setShowAddModal(false);
      setQuestionForm({ question_text: '' });
      
      // Reload questions
      await loadQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle deleting question
   */
  const handleDeleteQuestion = async (questionId: string): Promise<void> => {
    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master can delete questions.');
      return;
    }

    Alert.alert(
      'Delete Question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('table_topic_master_questions')
                .delete()
                .eq('id', questionId);

              if (error) {
                console.error('Error deleting question:', error);
                Alert.alert('Error', 'Failed to delete question');
                return;
              }

              Alert.alert('Success', 'Question deleted successfully');
              
              // Reload questions and reorder
              await loadQuestions();
            } catch (error) {
              console.error('Error deleting question:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  /**
   * Handle marking question as used
   */
  const handleToggleUsed = async (questionId: string, currentUsedStatus: boolean): Promise<void> => {
    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master can mark questions as used.');
      return;
    }

    try {
      const { error } = await supabase
        .from('table_topic_master_questions')
        .update({ 
          is_used: !currentUsedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId);

      if (error) {
        console.error('Error updating question status:', error);
        Alert.alert('Error', 'Failed to update question status');
        return;
      }

      // Update local state
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, is_used: !currentUsedStatus } : q
      ));
    } catch (error) {
      console.error('Error updating question status:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  /**
   * Handle assigning question to participant
   */
  const handleAssignQuestionToParticipant = (question: TableTopicQuestion): void => {
    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master can assign questions.');
      return;
    }

    if (participants.length === 0) {
      Alert.alert('No Participants', 'There are no Table Topic participants booked for this meeting yet.');
      return;
    }

    setSelectedQuestion(question);
    setShowAssignModal(true);
  };

  /**
   * Handle saving question assignment
   */
  const handleSaveAssignment = async (participantId: string): Promise<void> => {
    if (!selectedQuestion || !meetingId || !user?.currentClubId || !user?.id) return;

    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the currently booked Table Topic Master can assign questions.');
      return;
    }

    try {
      const participant = participants.find(p => p.id === participantId);
      if (!participant) return;

      console.log('Assigning question:', {
        questionId: selectedQuestion.id,
        questionText: selectedQuestion.question_text,
        participantId: participantId,
        participantName: participant.app_user_profiles?.full_name,
        meetingId: meetingId,
        clubId: user.currentClubId,
        ttMasterId: user.id
      });

      console.log('Assigning question:', {
        questionId: selectedQuestion.id,
        questionText: selectedQuestion.question_text,
        participantId: participantId,
        participantName: participant.app_user_profiles?.full_name,
        meetingId: meetingId,
        clubId: user.currentClubId,
        ttMasterId: user.id
      });

      // Check if this participant already has a question assigned
      const { data: existingAssignment, error: checkError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('participant_id', participant.assigned_user_id)
        .eq('participant_name', participant.app_user_profiles?.full_name || '')
        .eq('booking_status', 'booked')
        .eq('table_topic_master_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing assignment:', checkError);
        Alert.alert('Error', 'Failed to check existing assignment');
        return;
      }
      
      if (existingAssignment) {
        // Update existing assignment
        console.log('Updating existing assignment:', existingAssignment.id);
        console.log('Updating existing assignment:', existingAssignment.id);
        const { error } = await supabase
          .from('app_meeting_tabletopicscorner')
          .update({
            question_text: selectedQuestion.question_text,
            asked_by: user.id,
            asked_by_name: user.fullName || 'Unknown',
            table_topic_master_user_id: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id);

        if (error) {
          console.error('Error updating question assignment:', error);
          Alert.alert('Error', 'Failed to update question assignment');
          return;
        }
        
        console.log('Question assignment updated successfully');
        
        console.log('Question assignment updated successfully');
      } else {
        // Create new assignment
        console.log('Creating new assignment');
        const { error } = await supabase
          .from('app_meeting_tabletopicscorner')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            participant_id: participant.assigned_user_id,
            participant_name: participant.app_user_profiles?.full_name || 'Unknown',
            question_text: selectedQuestion.question_text,
            asked_by: user.id,
            asked_by_name: user.fullName || 'Unknown',
            table_topic_master_user_id: user.id,
            booking_status: 'booked',
            is_active: true,
          });

        if (error) {
          console.error('Error creating question assignment:', error);
          Alert.alert('Error', 'Failed to assign question');
          return;
        }

        console.log('Question assignment created successfully');
      }
      
      // Mark question as used
      await supabase
        .from('table_topic_master_questions')
        .update({ is_used: true })
        .eq('id', selectedQuestion.id);

      Alert.alert('Success', `Question assigned to ${participant.app_user_profiles?.full_name}`);
      setShowAssignModal(false);
      setSelectedQuestion(null);
      
      // Reload data
      await Promise.all([loadQuestions(), loadAssignedQuestions(), loadAllQuestionsPublishStatus()]);
    } catch (error) {
      console.error('Error saving assignment:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  /**
   * Get assigned participant for a question
   */
  const getAssignedParticipant = (questionText: string): AssignedQuestion | null => {
    return assignedQuestions.find(aq => aq.question_text === questionText) || null;
  };

  /**
   * Auto-save personal notes (silent, no alerts)
   */
  const autoSavePersonalNotes = async (): Promise<void> => {
    if (!isTableTopicMaster()) {
      return;
    }

    if (!meetingId || !user?.currentClubId || !user?.id) {
      return;
    }

    setIsSavingNotes(true);

    try {
      // Check if notes record already exists
      const { data: existingNotes, error: checkError } = await supabase
        .from('app_meeting_toastmaster_notes')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('toastmaster_user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing notes:', checkError);
        return;
      }

      if (existingNotes) {
        // Update existing notes
        const { error } = await supabase
          .from('app_meeting_toastmaster_notes')
          .update({
            personal_notes: personalNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingNotes.id);

        if (error) {
          console.error('Error updating notes:', error);
          return;
        }
      } else {
        // Create new notes
        const { error } = await supabase
          .from('app_meeting_toastmaster_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: user.id,
            personal_notes: personalNotes.trim() || null,
          });

        if (error) {
          console.error('Error creating notes:', error);
          return;
        }
      }

      setHasUnsavedNotes(false);
      setNotesJustSaved(true);

      // Hide "Saved" indicator after 2 seconds
      setTimeout(() => {
        setNotesJustSaved(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  /**
   * Handle saving personal notes
   */
  const handleSavePersonalNotes = async (): Promise<void> => {
    if (!isTableTopicMaster()) {
      Alert.alert('Access Denied', 'Only the assigned Table Topic Master can save personal notes.');
      return;
    }

    if (!meetingId || !user?.currentClubId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);

    try {
      // Check if notes record already exists
      const { data: existingNotes, error: checkError } = await supabase
        .from('app_meeting_toastmaster_notes')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('toastmaster_user_id', user.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing notes:', checkError);
        Alert.alert('Error', 'Failed to check existing notes');
        return;
      }

      if (existingNotes) {
        // Update existing notes
        const { error } = await supabase
          .from('app_meeting_toastmaster_notes')
          .update({
            personal_notes: personalNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingNotes.id);

        if (error) {
          console.error('Error updating notes:', error);
          Alert.alert('Error', 'Failed to update notes');
          return;
        }

        Alert.alert('Success', 'Notes updated successfully');
      } else {
        // Create new notes
        const { error } = await supabase
          .from('app_meeting_toastmaster_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: user.id,
            personal_notes: personalNotes.trim() || null,
          });

        if (error) {
          console.error('Error creating notes:', error);
          Alert.alert('Error', 'Failed to save notes');
          return;
        }

        Alert.alert('Success', 'Notes saved successfully');
      }

      setHasUnsavedNotes(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle closing modal
   */
  /**
   * Load publish status of all assigned questions
   */
  const loadAllQuestionsPublishStatus = async (): Promise<void> => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('is_published, question_text')
        .eq('meeting_id', meetingId);

      if (error) {
        console.error('Error loading publish status:', error);
        return;
      }

      if (data) {
        // Only count questions with text
        const questionsWithText = data.filter(r => r.question_text && r.question_text.trim() !== '');
        const published = questionsWithText.filter(r => r.is_published).length;
        const unpublished = questionsWithText.length - published;
        setAllQuestionsPublishStatus({ published, unpublished });
      }
    } catch (error) {
      console.error('Error loading publish status:', error);
    }
  };

  /**
   * Handle publish/unpublish toggle for all questions
   */
  const handlePublishToggle = async (): Promise<void> => {
    if (!meetingId) {
      Alert.alert('Error', 'Meeting information is missing');
      return;
    }

    try {
      // Get all questions for this meeting
      const { data: existingQuestions, error: checkError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('id, question_text, is_published')
        .eq('meeting_id', meetingId);

      if (checkError) {
        console.error('Error checking questions:', checkError);
        Alert.alert('Error', 'Failed to check questions');
        return;
      }

      if (!existingQuestions || existingQuestions.length === 0) {
        Alert.alert('Error', 'No questions found');
        return;
      }

      // Check if we should publish or unpublish all
      const shouldPublish = allQuestionsPublishStatus.unpublished > 0;

      if (shouldPublish) {
        // PUBLISH MODE: First unpublish all, then publish only questions with text

        // Step 1: Unpublish ALL questions
        const { error: unpublishError } = await supabase
          .from('app_meeting_tabletopicscorner')
          .update({ is_published: false })
          .eq('meeting_id', meetingId);

        if (unpublishError) {
          console.error('Error unpublishing all questions:', unpublishError);
          Alert.alert('Error', 'Failed to unpublish questions');
          return;
        }

        // Step 2: Publish only questions with text
        const questionsWithText = existingQuestions.filter(q => q.question_text && q.question_text.trim() !== '');

        if (questionsWithText.length > 0) {
          const questionIds = questionsWithText.map(q => q.id);
          const { error: publishError } = await supabase
            .from('app_meeting_tabletopicscorner')
            .update({ is_published: true })
            .in('id', questionIds);

          if (publishError) {
            console.error('Error publishing questions:', publishError);
            Alert.alert('Error', 'Failed to publish questions');
            return;
          }
        }

        // Reload status
        await loadAllQuestionsPublishStatus();
        setShowPublishModal(false);
        Alert.alert('Success', `${questionsWithText.length} questions have been published to Summary tab`);
      } else {
        // UNPUBLISH MODE: Unpublish all questions
        const { error } = await supabase
          .from('app_meeting_tabletopicscorner')
          .update({ is_published: false })
          .eq('meeting_id', meetingId);

        if (error) {
          console.error('Error unpublishing questions:', error);
          Alert.alert('Error', 'Failed to unpublish questions');
          return;
        }

        // Reload status
        await loadAllQuestionsPublishStatus();
        setShowPublishModal(false);
        Alert.alert('Success', 'All questions have been unpublished from Summary tab');
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleCloseModal = (): void => {
    setShowAddModal(false);
    setQuestionForm({ question_text: '' });
  };

  const updateQuestionSlot = (index: number, questionText: string): void => {
    setQuestionSlots(prev => prev.map(slot =>
      slot.index === index ? { ...slot, questionText } : slot
    ));
  };

  const saveQuestionSlotDirectly = async (index: number, questionText: string): Promise<void> => {
    if (!meetingId || !user?.currentClubId || !user?.id) return;
    try {
      if (questionText.trim()) {
        const { data: existing } = await supabase
          .from('app_meeting_tabletopicscorner')
          .select('id, question_order')
          .eq('meeting_id', meetingId)
          .eq('table_topic_master_user_id', user.id)
          .order('question_order')
          .limit(12);

        const existingAtIndex = existing?.[index];
        if (existingAtIndex) {
          await supabase
            .from('app_meeting_tabletopicscorner')
            .update({ question_text: questionText.trim() })
            .eq('id', existingAtIndex.id);
        } else {
          await supabase
            .from('app_meeting_tabletopicscorner')
            .insert({
              meeting_id: meetingId,
              club_id: user.currentClubId,
              participant_id: null,
              participant_name: null,
              question_text: questionText.trim(),
              asked_by: user.id,
              asked_by_name: user.fullName || 'Unknown',
              table_topic_master_user_id: user.id,
              booking_status: 'pending',
              is_active: true
            });
        }
      } else {
        const { data: existing } = await supabase
          .from('app_meeting_tabletopicscorner')
          .select('id, question_order')
          .eq('meeting_id', meetingId)
          .eq('table_topic_master_user_id', user.id)
          .order('question_order')
          .limit(12);
        const existingAtIndex = existing?.[index];
        if (existingAtIndex) {
          await supabase
            .from('app_meeting_tabletopicscorner')
            .delete()
            .eq('id', existingAtIndex.id);
        }
      }
    } catch (error) {
      console.error('Error saving question directly:', error);
    }
  };

  const assignParticipantToSlot = (slotIndex: number, participant: TableTopicParticipant | null): void => {
    setQuestionSlots(prev => prev.map(slot =>
      slot.index === slotIndex
        ? {
            ...slot,
            assignedUserId: participant?.assigned_user_id || null,
            assignedUserName: participant?.app_user_profiles?.full_name || null
          }
        : slot
    ));
    setShowParticipantPicker(null);
  };

  const toggleSlotExpanded = (index: number): void => {
    setQuestionSlots(prev => prev.map(slot =>
      slot.index === index ? { ...slot, isExpanded: !slot.isExpanded } : slot
    ));
  };

  const assignClubMemberToSlot = async (slotIndex: number, member: { id: string | null; full_name: string } | null): Promise<void> => {
    setQuestionSlots(prev => prev.map(slot =>
      slot.index === slotIndex
        ? { ...slot, assignedUserId: member?.id || null, assignedUserName: member?.full_name || null }
        : slot
    ));
    setAssigningSlotIndex(null);

    if (!meetingId || !user?.currentClubId || !user?.id) return;
    try {
      const { data: existing } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_user_id', user.id)
        .order('created_at')
        .limit(12);

      const existingAtIndex = existing?.[slotIndex];
      if (existingAtIndex) {
        await supabase
          .from('app_meeting_tabletopicscorner')
          .update({
            participant_id: member?.id || null,
            participant_name: member?.full_name || null,
            booking_status: member ? 'booked' : 'pending'
          })
          .eq('id', existingAtIndex.id);
      }
    } catch (error) {
      console.error('Error assigning member to slot:', error);
    }
  };

  /**
   * Save all questions to database
   */
  const saveAllQuestions = async (showAlerts: boolean = false): Promise<void> => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      console.log('Save skipped - missing required data');
      return;
    }

    // CRITICAL: Don't save if data hasn't been loaded yet to prevent accidental deletion
    if (!hasLoadedInitialData.current) {
      console.log('Save skipped - initial data not yet loaded');
      return;
    }

    // Get all questions that have text
    const questionsToSave = questionSlots.filter(slot => slot.questionText.trim());

    console.log(`Saving ${questionsToSave.length} question(s)...`);

    try {
      // First, delete existing questions for this user and meeting
      const { error: deleteError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_user_id', user.id);

      if (deleteError) {
        console.error('Error clearing existing questions:', deleteError);
      }

      // If there are questions to save, insert them
      if (questionsToSave.length > 0) {
        const recordsToInsert = questionsToSave.map(slot => ({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          participant_id: slot.assignedUserId || null,
          participant_name: slot.assignedUserName || null,
          question_text: slot.questionText.trim(),
          asked_by: user.id,
          asked_by_name: user.fullName || 'Unknown',
          table_topic_master_user_id: user.id,
          booking_status: slot.assignedUserId ? 'booked' : 'pending',
          is_active: true
        }));

        const { error: insertError } = await supabase
          .from('app_meeting_tabletopicscorner')
          .insert(recordsToInsert);

        if (insertError) {
          console.error('Error saving questions:', insertError);
          if (showAlerts) {
            Alert.alert('Error', 'Failed to save questions');
          }
          return;
        }

        console.log(`✓ Saved ${questionsToSave.length} question(s) successfully`);
      }
    } catch (error) {
      console.error('Error saving questions:', error);
      if (showAlerts) {
        Alert.alert('Error', 'Failed to save questions');
      }
    }
  };

  const handlePublishQuestions = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    const questionsToPublish = questionSlots.filter(slot => slot.questionText.trim());
    if (questionsToPublish.length === 0) {
      Alert.alert('No Questions', 'Please add at least one question before publishing.');
      return;
    }

    setIsPublishing(true);

    try {
      const { error: deleteError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('table_topic_master_user_id', user.id);

      if (deleteError) {
        console.error('Error clearing existing questions:', deleteError);
      }

      const recordsToInsert = questionsToPublish.map(slot => ({
        meeting_id: meetingId,
        club_id: user.currentClubId,
        participant_id: slot.assignedUserId || null,
        participant_name: slot.assignedUserName || null,
        question_text: slot.questionText.trim(),
        asked_by: user.id,
        asked_by_name: user.fullName || 'Unknown',
        table_topic_master_user_id: user.id,
        booking_status: slot.assignedUserId ? 'booked' : 'pending',
        is_active: true
      }));

      const { error: insertError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .insert(recordsToInsert);

      if (insertError) {
        console.error('Error publishing questions:', insertError);
        Alert.alert('Error', 'Failed to publish questions');
        return;
      }

      Alert.alert('Success', `Published ${questionsToPublish.length} question(s) to Table Topic Corner`);
      await Promise.all([loadAssignedQuestions(), loadAllQuestionsPublishStatus()]);
    } catch (error) {
      console.error('Error publishing questions:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsPublishing(false);
    }
  };

  const getFilledSlotsCount = (): number => {
    return questionSlots.filter(slot => slot.questionText.trim()).length;
  };

  /**
   * Format meeting mode for display
   */
  const formatMeetingMode = (mode: string): string => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  /**
   * Question Card Component
   */
  const QuestionCard = ({ question, index }: { question: TableTopicQuestion; index: number }): JSX.Element => {
    const assignedParticipant = getAssignedParticipant(question.question_text);
    
    return (
      <View style={[styles.questionCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.questionHeader}>
          <View style={styles.questionNumber}>
            <Text style={[styles.questionNumberText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {index + 1}
            </Text>
          </View>
          
          <View style={styles.questionContent}>
            <Text style={[styles.questionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {question.question_text}
            </Text>
            
            {/* Show assigned participant if any */}
            {assignedParticipant && (
              <View style={[styles.assignedParticipantCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.assignedLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Assigned to:
                </Text>
                <Text style={[styles.assignedParticipantName, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  {assignedParticipant.participant_name}
                </Text>
              </View>
            )}
            
            <View style={styles.questionMeta}>
              <TouchableOpacity
                style={[
                  styles.usedToggle,
                  { backgroundColor: question.is_used ? '#10b981' + '20' : '#6b7280' + '20' }
                ]}
                onPress={() => handleToggleUsed(question.id, question.is_used)}
                disabled={!isTableTopicMaster()}
              >
                <Text style={[
                  styles.usedToggleText,
                  { color: question.is_used ? '#10b981' : '#6b7280' }
                ]} maxFontSizeMultiplier={1.3}>
                  {question.is_used ? 'Used' : 'Unused'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {isTableTopicMaster() && (
            <TouchableOpacity
              style={[styles.deleteQuestionButton, { backgroundColor: '#fef2f2' }]}
              onPress={() => handleDeleteQuestion(question.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading Table Topic Master notes...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state - meeting not found
  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting not found
          </Text>
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

  // Access denied state
  if (!isTableTopicMaster()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Personal notes and questions are only accessible to the assigned Table Topic Master.
          </Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 24 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredClubMembers = clubMembers.filter(member => {
    const query = memberSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (member.full_name || '').toLowerCase().includes(query) ||
      (member.email || '').toLowerCase().includes(query)
    );
  });

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Your Prep Space
        </Text>
        {getFilledSlotsCount() > 0 ? (
          <TouchableOpacity
            style={[
              styles.headerPublishButton,
              {
                backgroundColor: allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                  ? '#f59e0b'
                  : theme.colors.primary,
              },
            ]}
            onPress={() => setShowPublishModal(true)}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <Text style={styles.headerPublishButtonText} maxFontSizeMultiplier={1.3}>
                Publishing...
              </Text>
            ) : (
              <Text style={styles.headerPublishButtonText} maxFontSizeMultiplier={1.3}>
                {allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                  ? 'Unpublish All'
                  : 'Publish All'}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Tab Switcher */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabContentContainer}
        style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'questions' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('questions')}
        >
          <MessageSquare size={16} color={activeTab === 'questions' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'questions' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Questions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'assignment' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('assignment')}
        >
          <UserCheck size={16} color={activeTab === 'assignment' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'assignment' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Assignment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'notes' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('notes')}
        >
          <StickyNote size={16} color={activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Notes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'quick_access' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('quick_access')}
        >
          <FileText size={16} color={activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Quick Access
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Questions Tab */}
        {activeTab === 'questions' && (
        <View style={styles.questionsTabContent}>
          {/* Existing Question Cards */}
          <View style={styles.questionCardsContainer}>
            {questionSlots.filter(s => s.questionText.trim()).length === 0 && (
              <View style={[styles.emptyQuestionsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MessageSquare size={32} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyQuestionsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No questions added yet
                </Text>
                <Text style={[styles.emptyQuestionsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Tap "Add Question" below to get started
                </Text>
              </View>
            )}
            {questionSlots.filter(s => s.questionText.trim()).map((slot, displayIndex) => (
              <View
                key={slot.index}
                style={[styles.newQuestionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <View style={styles.newQuestionCardRow}>
                  <View style={[styles.questionNumberBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                    <Text style={[styles.questionNumberBadgeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                      {displayIndex + 1}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.questionContentExpanded}
                    onPress={() => {
                      router.push({
                        pathname: '/table-topic-question-edit',
                        params: {
                          meetingId,
                          slotIndex: slot.index,
                          questionText: slot.questionText
                        }
                      });
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.questionTextExpanded, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {slot.questionText}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.clearQuestionButton, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => {
                      updateQuestionSlot(slot.index, '');
                    }}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Add Question Button */}
          <TouchableOpacity
            style={[styles.addQuestionButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              const nextSlot = questionSlots.find(s => !s.questionText.trim());
              if (!nextSlot) {
                Alert.alert('Maximum Reached', 'You can only add up to 12 questions per meeting.');
                return;
              }
              router.push({
                pathname: '/table-topic-question-edit',
                params: {
                  meetingId,
                  slotIndex: nextSlot.index,
                  questionText: ''
                }
              });
            }}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.addQuestionButtonText} maxFontSizeMultiplier={1.3}>Add Question</Text>
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </View>
        )}

        {/* Assignment Tab */}
        {activeTab === 'assignment' && (
        <View style={styles.questionsTabContent}>
          {questionSlots.filter(s => s.questionText.trim()).length === 0 ? (
            <View style={[styles.emptyQuestionsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Users size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyQuestionsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                No questions to assign
              </Text>
              <Text style={[styles.emptyQuestionsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Add questions first from the Questions tab
              </Text>
            </View>
          ) : (
            <View style={styles.questionCardsContainer}>
              {questionSlots.filter(s => s.questionText.trim()).map((slot, displayIndex) => (
                <View
                  key={slot.index}
                  style={[styles.assignmentCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                >
                  <View style={styles.assignmentCardTop}>
                    <View style={[styles.questionNumberBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                      <Text style={[styles.questionNumberBadgeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                        {displayIndex + 1}
                      </Text>
                    </View>
                    <Text style={[styles.assignmentQuestionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {slot.questionText}
                    </Text>
                  </View>
                  <View style={[styles.assignmentCardBottom, { borderTopColor: theme.colors.border }]}>
                    {slot.assignedUserName ? (
                      <View style={styles.assignedMemberRow}>
                        <View style={[styles.assignedMemberAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                          <Text style={[styles.assignedMemberInitials, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            {slot.assignedUserName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </Text>
                        </View>
                        <Text style={[styles.assignedMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {slot.assignedUserName}
                        </Text>
                        <TouchableOpacity
                          style={[styles.changeAssignButton, { borderColor: theme.colors.border }]}
                          onPress={() => setAssigningSlotIndex(slot.index)}
                        >
                          <Text style={[styles.changeAssignButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Change</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.assignButton, { backgroundColor: theme.colors.primary }]}
                        onPress={() => setAssigningSlotIndex(slot.index)}
                      >
                        <User size={14} color="#ffffff" />
                        <Text style={styles.assignButtonText} maxFontSizeMultiplier={1.3}>Assign Member</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
          <View style={styles.bottomPadding} />
        </View>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.notesHeader}>
            <View style={[styles.notesIcon, { backgroundColor: '#FFF4E6' }]}>
              <FileText size={20} color="#f59e0b" />
            </View>
            <View style={styles.notesTitleContainer}>
              <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Your Personal Notes
              </Text>
              <Text style={[styles.notesSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Private notes for your Table Topic session. Only you can see this.
              </Text>
            </View>
          </View>

          <View style={styles.notesInputSection}>
            <Text style={[styles.notesInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
              NOTES
            </Text>
            <View style={styles.notesInputHeader}>
              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {personalNotes.trim().split(/\s+/).filter(word => word.length > 0).length}/500 words
              </Text>
              {isSavingNotes && (
                <Text style={[styles.autoSaveIndicator, { color: '#9CA3AF' }]} maxFontSizeMultiplier={1.3}>
                  Saving...
                </Text>
              )}
              {notesJustSaved && !isSavingNotes && (
                <Text style={[styles.autoSaveIndicator, { color: '#10B981' }]} maxFontSizeMultiplier={1.3}>
                  Saved
                </Text>
              )}
            </View>
            <TextInput
              style={[styles.notesTextInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Write your personal notes here... (max 500 words)"
              placeholderTextColor={theme.colors.textSecondary}
              value={personalNotes}
              onChangeText={(text) => {
                const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
                if (wordCount <= 500 || text.length < personalNotes.length) {
                  setPersonalNotes(text);
                  setHasUnsavedNotes(true);
                }
              }}
              multiline
              numberOfLines={15}
              textAlignVertical="top"
            />
          </View>
        </View>
        )}

        {/* Quick Access Tab */}
        {activeTab === 'quick_access' && (
          <View style={[styles.quickAccessSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.quickAccessHeader}>
              <Text style={[styles.quickAccessTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Quick Access
              </Text>
              <Text style={[styles.quickAccessSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Navigate to key meeting functions
              </Text>
            </View>

            <View style={styles.quickAccessGrid}>
              {/* Agenda */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/meeting-agenda-view?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <FileText size={22} color="#10b981" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Agenda
                </Text>
              </TouchableOpacity>

              {/* Ah Counter */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/ah-counter-corner?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Bell size={22} color="#dc2626" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Ah Counter
                </Text>
              </TouchableOpacity>

              {/* Attendance */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/attendance-report?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <UserCheck size={22} color="#3b82f6" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Attendance
                </Text>
              </TouchableOpacity>

              {/* Book a Role */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/book-a-role?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <CalendarCheck size={22} color="#22c55e" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Book a Role
                </Text>
              </TouchableOpacity>

              {/* Educational Speaker */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/educational-corner?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <GraduationCap size={22} color="#0891b2" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Educational Speaker
                </Text>
              </TouchableOpacity>

              {/* General Evaluator */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/general-evaluator-report?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Award size={22} color="#f59e0b" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  General Evaluator
                </Text>
              </TouchableOpacity>

              {/* Grammarian */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/grammarian?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <BookOpen size={22} color="#059669" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Grammarian
                </Text>
              </TouchableOpacity>

              {/* Live Voting */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/live-voting?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Vote size={22} color="#8b5cf6" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Live Voting
                </Text>
              </TouchableOpacity>

              {/* Prepared Speaker */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/evaluation-corner?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Mic size={22} color="#ec4899" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Prepared Speaker
                </Text>
              </TouchableOpacity>

              {/* Roles Completion */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/role-completion-report?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <ClipboardList size={22} color="#6366f1" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Roles Completion
                </Text>
              </TouchableOpacity>

              {/* Table Topic Corner */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/table-topic-corner?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <MessageSquare size={22} color="#14b8a6" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Table Topic Corner
                </Text>
              </TouchableOpacity>

              {/* Timer */}
              <TouchableOpacity
                style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/timer-report-details?meetingId=${meetingId}`)}
              >
                <View style={styles.quickAccessIconContainer}>
                  <Clock size={22} color="#9333ea" />
                </View>
                <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Timer
                </Text>
              </TouchableOpacity>

            </View>

            {/* ExComm Only Section */}
            {isExcomm && (
              <>
                <View style={styles.excommHeader}>
                  <View style={[styles.excommBadge, { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }]}>
                    <Shield size={16} color={theme.colors.primary} />
                    <Text style={[styles.excommBadgeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                      ExComm Only
                    </Text>
                  </View>
                </View>

                <View style={styles.quickAccessGrid}>
                  {/* Admin Panel */}
                  <TouchableOpacity
                    style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => router.push(`/admin/club-operations`)}
                  >
                    <View style={styles.quickAccessIconContainer}>
                      <LayoutDashboard size={22} color="#16a34a" />
                    </View>
                    <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Admin Panel
                    </Text>
                  </TouchableOpacity>

                  {/* Manage Users */}
                  <TouchableOpacity
                    style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => router.push(`/admin/manage-club-users`)}
                  >
                    <View style={styles.quickAccessIconContainer}>
                      <UserCog size={22} color="#ea580c" />
                    </View>
                    <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Manage Users
                    </Text>
                  </TouchableOpacity>

                  {/* Meeting Management */}
                  <TouchableOpacity
                    style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => router.push(`/admin/meeting-management`)}
                  >
                    <View style={styles.quickAccessIconContainer}>
                      <Calendar size={22} color="#2563eb" />
                    </View>
                    <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Meeting Management
                    </Text>
                  </TouchableOpacity>

                  {/* Voting Ops */}
                  <TouchableOpacity
                    style={[styles.quickAccessCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                    onPress={() => router.push(`/admin/voting-operations?meetingId=${meetingId}`)}
                  >
                    <View style={styles.quickAccessIconContainer}>
                      <Vote size={22} color="#7c3aed" />
                    </View>
                    <Text style={[styles.quickAccessLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Voting Ops
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Add Question Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.questionModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Add New Question
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Question Input */}
              <View style={styles.questionInputSection}>
                <View style={styles.questionInputHeader}>
                  <Text style={[styles.questionInputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Table Topic Question
                  </Text>
                  <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {questionForm.question_text.length}/200
                  </Text>
                </View>
                
                <TextInput
                  style={[styles.questionTextInput, { 
                    backgroundColor: theme.colors.surface, 
                    borderColor: theme.colors.border,
                    color: theme.colors.text 
                  }]}
                  placeholder="Enter a thought-provoking question for Table Topic participants..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={questionForm.question_text}
                  onChangeText={(text) => {
                    if (text.length <= 200) {
                      setQuestionForm({ question_text: text });
                    }
                  }}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={200}
                />
                
                <Text style={[styles.questionTip, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  💡 Tip: Create engaging questions that encourage creative thinking and relate to the meeting theme.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={handleCloseModal}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: isSaving ? 0.7 : 1,
                    }
                  ]}
                  onPress={handleSaveQuestion}
                  disabled={isSaving}
                >
                  <Save size={16} color="#ffffff" />
                  <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
                    {isSaving ? 'Saving...' : 'Add Question'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Bottom spacing for mobile */}
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Question Modal */}
      <Modal
        visible={showAssignModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.questionModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Question
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowAssignModal(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Selected Question */}
              {selectedQuestion && (
                <View style={styles.selectedQuestionSection}>
                  <Text style={[styles.selectedQuestionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Question to Assign:
                  </Text>
                  <View style={[styles.selectedQuestionCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.selectedQuestionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {selectedQuestion.question_text}
                    </Text>
                  </View>
                </View>
              )}

              {/* Participants List */}
              <View style={styles.participantsSection}>
                <Text style={[styles.participantsLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Select Participant:
                </Text>
                
                {participants.map((participant) => {
                  const hasAssignment = assignedQuestions.find(aq => aq.participant_id === participant.assigned_user_id);
                  
                  return (
                    <TouchableOpacity
                      key={participant.id}
                      style={[styles.participantCard, { backgroundColor: theme.colors.surface }]}
                      onPress={() => handleSaveAssignment(participant.assigned_user_id || participant.id)}
                    >
                      <View style={styles.participantInfo}>
                        <View style={styles.participantAvatar}>
                          {participant.app_user_profiles?.avatar_url ? (
                            <Image 
                              source={{ uri: participant.app_user_profiles.avatar_url }} 
                              style={styles.participantAvatarImage}
                            />
                          ) : (
                            <MessageSquare size={20} color="#ffffff" />
                          )}
                        </View>
                        <View style={styles.participantDetails}>
                          <Text style={[styles.participantName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {participant.app_user_profiles?.full_name || 'Unknown'}
                          </Text>
                          <Text style={[styles.participantRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {participant.role_name}
                          </Text>
                          {hasAssignment && (
                            <Text style={[styles.currentAssignment, { color: '#f97316' }]} maxFontSizeMultiplier={1.3}>
                              Currently assigned: "{(hasAssignment.question_text || '').substring(0, 50)}..."
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bottom spacing for mobile */}
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Questions Viewer Modal with Horizontal Pagination */}
      <Modal
        visible={showQuestionsViewer}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowQuestionsViewer(false)}
      >
        <View style={styles.viewerModalOverlay}>
          <View style={[styles.viewerModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                View Questions
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowQuestionsViewer(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Question Viewer with Pagination */}
            <View style={styles.viewerContent}>
              {(() => {
                const filledQuestions = questionSlots.filter(s => s.questionText.trim());
                if (filledQuestions.length === 0) return null;

                const currentQuestion = filledQuestions[currentQuestionIndex];
                return (
                  <>
                    {/* Question Counter */}
                    <View style={styles.questionCounter}>
                      <Text style={[styles.questionCounterText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Question {currentQuestionIndex + 1} of {filledQuestions.length}
                      </Text>
                    </View>

                    {/* Question Display */}
                    <ScrollView
                      style={styles.viewerQuestionScroll}
                      contentContainerStyle={styles.viewerQuestionScrollContent}
                      showsVerticalScrollIndicator={true}
                    >
                      <View style={[styles.viewerQuestionCard, { backgroundColor: theme.colors.surface }]}>
                        <View style={[styles.viewerQuestionNumber, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.viewerQuestionNumberText} maxFontSizeMultiplier={1.3}>
                            {String(currentQuestion.index + 1).padStart(2, '0')}
                          </Text>
                        </View>
                        <Text style={[styles.viewerQuestionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {currentQuestion.questionText}
                        </Text>
                        {currentQuestion.assignedUserName && (
                          <View style={[styles.viewerAssignedBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                            <User size={16} color={theme.colors.primary} />
                            <Text style={[styles.viewerAssignedText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                              Assigned to: {currentQuestion.assignedUserName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </ScrollView>

                    {/* Navigation Buttons */}
                    <View style={styles.viewerNavigation}>
                      <TouchableOpacity
                        style={[
                          styles.viewerNavButton,
                          {
                            backgroundColor: currentQuestionIndex > 0 ? theme.colors.primary : theme.colors.border,
                            opacity: currentQuestionIndex > 0 ? 1 : 0.5
                          }
                        ]}
                        onPress={() => {
                          if (currentQuestionIndex > 0) {
                            setCurrentQuestionIndex(currentQuestionIndex - 1);
                          }
                        }}
                        disabled={currentQuestionIndex === 0}
                      >
                        <Text style={styles.viewerNavButtonText} maxFontSizeMultiplier={1.3}>
                          Previous
                        </Text>
                      </TouchableOpacity>

                      {/* Page Dots */}
                      <View style={styles.viewerPageDots}>
                        {filledQuestions.map((_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.viewerPageDot,
                              {
                                backgroundColor: index === currentQuestionIndex
                                  ? theme.colors.primary
                                  : theme.colors.border
                              }
                            ]}
                          />
                        ))}
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.viewerNavButton,
                          {
                            backgroundColor: currentQuestionIndex < filledQuestions.length - 1 ? theme.colors.primary : theme.colors.border,
                            opacity: currentQuestionIndex < filledQuestions.length - 1 ? 1 : 0.5
                          }
                        ]}
                        onPress={() => {
                          if (currentQuestionIndex < filledQuestions.length - 1) {
                            setCurrentQuestionIndex(currentQuestionIndex + 1);
                          }
                        }}
                        disabled={currentQuestionIndex === filledQuestions.length - 1}
                      >
                        <Text style={styles.viewerNavButtonText} maxFontSizeMultiplier={1.3}>
                          Next
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Question Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.questionModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Edit Question
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowEditModal(false)}>
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Question Input */}
              <View style={styles.questionInputSection}>
                <View style={styles.questionInputHeader}>
                  <Text style={[styles.questionInputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Question Text
                  </Text>
                  <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {editingQuestionText.length}/500
                  </Text>
                </View>

                <TextInput
                  style={[styles.questionTextInput, {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }]}
                  placeholder="Enter your question text..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={editingQuestionText}
                  onChangeText={(text) => {
                    if (text.length <= 500) {
                      setEditingQuestionText(text);
                    }
                  }}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={500}
                  autoFocus
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={[styles.modalActionButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalActionButton,
                    {
                      backgroundColor: theme.colors.primary,
                    }
                  ]}
                  onPress={() => {
                    if (editingSlotIndex !== null) {
                      updateQuestionSlot(editingSlotIndex, editingQuestionText);
                    }
                    setShowEditModal(false);
                  }}
                >
                  <Text style={[styles.modalActionButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                    Save
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Bottom spacing for mobile */}
              <View style={styles.modalBottomSpacing} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Publish/Unpublish Confirmation Modal */}
      <Modal
        visible={showPublishModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPublishModal(false)}
      >
        <TouchableOpacity
          style={styles.publishModalOverlay}
          activeOpacity={1}
          onPress={() => setShowPublishModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.publishModalContent, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.publishModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                ? 'Unpublish All Questions?'
                : 'Publish All Questions?'}
            </Text>
            <Text style={[styles.publishModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                ? `This will hide all ${allQuestionsPublishStatus.published} assigned questions from the Summary tab. You can publish them again later.`
                : `This will make all assigned questions visible in the Summary tab.\n\nPublished: ${allQuestionsPublishStatus.published}\nUnpublished: ${allQuestionsPublishStatus.unpublished}`}
            </Text>
            <View style={styles.publishModalButtons}>
              <TouchableOpacity
                style={[styles.publishModalButton, styles.publishModalButtonCancel, { borderColor: theme.colors.border }]}
                onPress={() => setShowPublishModal(false)}
              >
                <Text style={[styles.publishModalButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.publishModalButton,
                  styles.publishModalButtonConfirm,
                  {
                    backgroundColor:
                      allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                        ? '#f59e0b'
                        : theme.colors.primary,
                  },
                ]}
                onPress={handlePublishToggle}
              >
                <Text style={[styles.publishModalButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                  {allQuestionsPublishStatus.unpublished === 0 && allQuestionsPublishStatus.published > 0
                    ? 'Unpublish'
                    : 'Publish'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Participant Picker Modal */}
      <Modal
        visible={showParticipantPicker !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowParticipantPicker(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.centerModalOverlay}>
          <View style={[styles.centerParticipantModal, { backgroundColor: theme.colors.background }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Participant
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowParticipantPicker(null)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Question Preview */}
            {showParticipantPicker !== null && questionSlots[showParticipantPicker] && (
              <View style={[styles.questionPreviewCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.questionPreviewLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  QUESTION {showParticipantPicker + 1}
                </Text>
                <Text style={[styles.questionPreviewText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {questionSlots[showParticipantPicker].questionText}
                </Text>
              </View>
            )}

            {/* Participants List */}
            <ScrollView style={styles.participantsList} showsVerticalScrollIndicator={false}>
              <Text style={[styles.participantsListTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Select a participant:
              </Text>

              {/* Unassigned Option */}
              <TouchableOpacity
                style={[styles.participantModalItem, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => {
                  if (showParticipantPicker !== null) {
                    assignParticipantToSlot(showParticipantPicker, null);
                    setShowParticipantPicker(null);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.participantModalAvatar}>
                  <UserMinus size={20} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.participantModalName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Unassigned
                </Text>
              </TouchableOpacity>

              {/* Participants */}
              {participants.length > 0 ? (
                participants.map((participant) => {
                  const isAlreadyAssigned = showParticipantPicker !== null && questionSlots.some(
                    s => s.index !== showParticipantPicker && s.assignedUserId === participant.assigned_user_id
                  );
                  return (
                    <TouchableOpacity
                      key={participant.id}
                      style={[
                        styles.participantModalItem,
                        {
                          backgroundColor: theme.colors.surface,
                          borderColor: theme.colors.border
                        },
                        isAlreadyAssigned && { opacity: 0.5 }
                      ]}
                      onPress={() => {
                        if (!isAlreadyAssigned && showParticipantPicker !== null) {
                          assignParticipantToSlot(showParticipantPicker, participant);
                          setShowParticipantPicker(null);
                        }
                      }}
                      disabled={isAlreadyAssigned}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.participantModalAvatar, { backgroundColor: '#f97316' }]}>
                        {participant.app_user_profiles?.avatar_url ? (
                          <Image
                            source={{ uri: participant.app_user_profiles.avatar_url }}
                            style={styles.participantModalAvatarImage}
                          />
                        ) : (
                          <Text style={styles.participantModalAvatarInitials} maxFontSizeMultiplier={1.3}>
                            {participant.app_user_profiles?.full_name
                              ?.split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2) || 'TT'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.participantModalInfo}>
                        <Text
                          style={[
                            styles.participantModalName,
                            { color: isAlreadyAssigned ? theme.colors.textSecondary : theme.colors.text }
                          ]}
                          maxFontSizeMultiplier={1.3}
                        >
                          {participant.app_user_profiles?.full_name || 'Unknown'}
                        </Text>
                        {isAlreadyAssigned && (
                          <Text style={[styles.participantModalStatus, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Already assigned to another question
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.noParticipantsInModal}>
                  <View style={[styles.noParticipantsModalIcon, { backgroundColor: '#f97316' + '20' }]}>
                    <Users size={32} color="#f97316" />
                  </View>
                  <Text style={[styles.noParticipantsModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No Participants Available
                  </Text>
                  <Text style={[styles.noParticipantsModalSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No Table Topic speakers have booked roles for this meeting yet.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Club Member Picker Modal for Assignment Tab */}
      <Modal
        visible={assigningSlotIndex !== null}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          setAssigningSlotIndex(null);
          setManualAssignName('');
          setShowManualEntry(false);
          setMemberSearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.memberPickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setAssigningSlotIndex(null);
            setManualAssignName('');
            setShowManualEntry(false);
            setMemberSearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.memberPickerModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.memberPickerHeader, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.memberPickerHeaderLeft}>
                <View style={[styles.memberPickerHeaderIcon, { backgroundColor: theme.colors.primary + '18' }]}>
                  <Users size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.memberPickerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Assign Member
                  </Text>
                  <Text style={[styles.memberPickerSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {clubMembers.length} member{clubMembers.length !== 1 ? 's' : ''} available
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.memberPickerCloseBtn, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  setAssigningSlotIndex(null);
                  setManualAssignName('');
                  setShowManualEntry(false);
                  setMemberSearchQuery('');
                }}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Question Preview */}
            {assigningSlotIndex !== null && questionSlots[assigningSlotIndex]?.questionText ? (
              <View style={[styles.memberPickerQuestionPreview, { backgroundColor: theme.colors.primary + '0D', borderColor: theme.colors.primary + '30' }]}>
                <Text style={[styles.memberPickerQuestionLabel, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  Q{questionSlots.filter(s => s.questionText.trim()).findIndex(s => s.index === assigningSlotIndex) + 1}
                </Text>
                <Text style={[styles.memberPickerQuestionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={2}>
                  {questionSlots[assigningSlotIndex].questionText}
                </Text>
              </View>
            ) : null}

            {/* Search Box */}
            <View style={[styles.memberPickerSearch, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Search size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.memberPickerSearchInput, { color: theme.colors.text }]}
                placeholder="Search by name or email..."
                placeholderTextColor={theme.colors.textSecondary}
                value={memberSearchQuery}
                onChangeText={setMemberSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                maxFontSizeMultiplier={1.3}
              />
              {memberSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
                  <X size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.memberPickerList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Manual Entry Section */}
              {showManualEntry ? (
                <View style={[styles.manualEntryContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.manualEntryLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Enter name manually
                  </Text>
                  <TextInput
                    style={[styles.manualEntryInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                    placeholder="Type a name..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={manualAssignName}
                    onChangeText={setManualAssignName}
                    autoFocus
                    maxFontSizeMultiplier={1.3}
                  />
                  <View style={styles.manualEntryActions}>
                    <TouchableOpacity
                      style={[styles.manualEntryCancelBtn, { borderColor: theme.colors.border }]}
                      onPress={() => { setShowManualEntry(false); setManualAssignName(''); }}
                    >
                      <Text style={[styles.manualEntryCancelText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.manualEntryConfirmBtn, { backgroundColor: manualAssignName.trim() ? theme.colors.primary : theme.colors.border }]}
                      disabled={!manualAssignName.trim()}
                      onPress={() => {
                        if (manualAssignName.trim() && assigningSlotIndex !== null) {
                          assignClubMemberToSlot(assigningSlotIndex, { id: null, full_name: manualAssignName.trim() });
                          setManualAssignName('');
                          setShowManualEntry(false);
                          setMemberSearchQuery('');
                        }
                      }}
                    >
                      <Text style={styles.manualEntryConfirmText} maxFontSizeMultiplier={1.3}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.manualEntryTrigger, { backgroundColor: theme.colors.primary + '0D', borderColor: theme.colors.primary + '40' }]}
                  onPress={() => setShowManualEntry(true)}
                  activeOpacity={0.7}
                >
                  <Edit size={15} color={theme.colors.primary} />
                  <Text style={[styles.manualEntryTriggerText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Enter name manually</Text>
                </TouchableOpacity>
              )}

              {/* Unassign Option */}
              <TouchableOpacity
                style={[styles.memberPickerItem, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => {
                  if (assigningSlotIndex !== null) {
                    assignClubMemberToSlot(assigningSlotIndex, null);
                    setManualAssignName('');
                    setShowManualEntry(false);
                    setMemberSearchQuery('');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.memberPickerAvatar, { backgroundColor: theme.colors.border }]}>
                  <UserMinus size={18} color={theme.colors.textSecondary} />
                </View>
                <View style={styles.memberPickerItemInfo}>
                  <Text style={[styles.memberPickerItemName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Unassigned
                  </Text>
                  <Text style={[styles.memberPickerItemSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Remove current assignment
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Club Members */}
              {filteredClubMembers.length > 0 ? (
                filteredClubMembers.map((member) => {
                  const isAlreadyAssigned = assigningSlotIndex !== null && questionSlots.some(
                    s => s.index !== assigningSlotIndex && s.assignedUserId === member.id
                  );
                  const isCurrentlyAssigned = assigningSlotIndex !== null && questionSlots[assigningSlotIndex]?.assignedUserId === member.id;
                  const initials = (member.full_name || '').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.memberPickerItem,
                        {
                          backgroundColor: isCurrentlyAssigned ? theme.colors.primary + '12' : theme.colors.background,
                          borderColor: isCurrentlyAssigned ? theme.colors.primary : theme.colors.border,
                        },
                        isAlreadyAssigned && { opacity: 0.45 }
                      ]}
                      onPress={() => {
                        if (!isAlreadyAssigned && assigningSlotIndex !== null) {
                          assignClubMemberToSlot(assigningSlotIndex, member);
                          setManualAssignName('');
                          setShowManualEntry(false);
                          setMemberSearchQuery('');
                        }
                      }}
                      disabled={isAlreadyAssigned}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.memberPickerAvatar, { backgroundColor: isCurrentlyAssigned ? theme.colors.primary : '#0ea5e9' }]}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.memberPickerAvatarImage} />
                        ) : (
                          <Text style={styles.memberPickerAvatarInitials} maxFontSizeMultiplier={1.3}>
                            {initials}
                          </Text>
                        )}
                      </View>
                      <View style={styles.memberPickerItemInfo}>
                        <Text style={[styles.memberPickerItemName, { color: isAlreadyAssigned ? theme.colors.textSecondary : (isCurrentlyAssigned ? theme.colors.primary : theme.colors.text) }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name || 'Unknown'}
                        </Text>
                        {isCurrentlyAssigned && (
                          <Text style={[styles.memberPickerItemSub, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                            Currently assigned
                          </Text>
                        )}
                        {isAlreadyAssigned && !isCurrentlyAssigned && (
                          <Text style={[styles.memberPickerItemSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Assigned to another question
                          </Text>
                        )}
                        {!isCurrentlyAssigned && !isAlreadyAssigned && member.email && (
                          <Text style={[styles.memberPickerItemSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {member.email}
                          </Text>
                        )}
                      </View>
                      {isCurrentlyAssigned && (
                        <View style={[styles.memberPickerCheckMark, { backgroundColor: theme.colors.primary }]}>
                          <UserCheck size={14} color="#ffffff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : memberSearchQuery.trim() ? (
                <View style={styles.memberPickerNoResults}>
                  <Search size={28} color={theme.colors.textSecondary} />
                  <Text style={[styles.memberPickerNoResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No members match "{memberSearchQuery}"
                  </Text>
                </View>
              ) : (
                <View style={styles.memberPickerNoResults}>
                  <Users size={28} color={theme.colors.textSecondary} />
                  <Text style={[styles.memberPickerNoResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No club members found
                  </Text>
                </View>
              )}
              <View style={{ height: 16 }} />
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerPublishButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerPublishButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
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
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  meetingNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  meetingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTimeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingModeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  masterSection: {
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
  masterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  masterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  masterTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  masterCard: {
    backgroundColor: '#fef7ed',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  masterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  masterAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  masterAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  masterDetails: {
    flex: 1,
  },
  masterName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  masterEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  masterRole: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  masterRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  questionsSection: {
    marginHorizontal: 11,
    marginTop: 8,
    borderRadius: 11,
    padding: 11,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  questionsEmoji: {
    fontSize: 20,
    fontWeight: '700',
  },
  questionsTitleContainer: {
    flex: 1,
  },
  questionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  questionsSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  questionsList: {
    gap: 8,
  },
  questionCard: {
    borderRadius: 8,
    padding: 11,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  questionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f97316' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  questionNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  questionContent: {
    flex: 1,
    marginRight: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 6,
  },
  assignedParticipantCard: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 6,
  },
  assignedLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  assignedParticipantName: {
    fontSize: 14,
    fontWeight: '600',
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  usedToggle: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  usedToggleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  assignButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  assignButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteQuestionButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noQuestionsCard: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  noQuestionsIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  noQuestionsEmoji: {
    fontSize: 28,
  },
  noQuestionsText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  noQuestionsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 11,
  },
  addFirstQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  addFirstQuestionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  questionsLimit: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  questionsTabContent: {
    flex: 1,
  },
  emptyQuestionsCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyQuestionsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyQuestionsSubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  questionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  questionNumberBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearQuestionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  addQuestionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  assignmentCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  assignmentCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 10,
  },
  assignmentQuestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  assignmentCardBottom: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  assignedMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignedMemberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignedMemberInitials: {
    fontSize: 11,
    fontWeight: '700',
  },
  assignedMemberName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  changeAssignButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  changeAssignButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  manualEntryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  manualEntryTriggerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualEntryContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  manualEntryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualEntryInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  manualEntryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  manualEntryCancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
  },
  manualEntryCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  manualEntryConfirmBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  manualEntryConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  questionSlotsList: {
    gap: 8,
  },
  questionSlotCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  questionSlotHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  questionSlotNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  questionSlotNumberText: {
    fontSize: 12,
    fontWeight: '700',
  },
  questionSlotInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 36,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  assignToButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
    marginLeft: 32,
  },
  assignToButtonText: {
    flex: 1,
    fontSize: 13,
  },
  participantPickerDropdown: {
    marginTop: 6,
    marginLeft: 32,
    borderRadius: 6,
    borderWidth: 1,
    maxHeight: 200,
    overflow: 'hidden',
  },
  participantPickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  participantPickerItemText: {
    fontSize: 14,
  },
  noParticipantsMessage: {
    padding: 12,
  },
  noParticipantsText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 11,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 8,
  },
  publishButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 14,
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
    justifyContent: 'flex-end',
  },
  questionModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  questionInputSection: {
    marginBottom: 24,
  },
  questionInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionInputLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  characterCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  questionTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 100,
    lineHeight: 22,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  questionTip: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  modalBottomSpacing: {
    height: 40,
  },
  selectedQuestionSection: {
    marginBottom: 24,
  },
  selectedQuestionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedQuestionCard: {
    padding: 16,
    borderRadius: 8,
  },
  selectedQuestionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  participantsSection: {
    marginBottom: 24,
  },
  participantsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  participantCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  participantRole: {
    fontSize: 14,
    marginBottom: 4,
  },
  currentAssignment: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Tab styles
  tabContainer: {
    borderBottomWidth: 1,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 50,
  },
  tabContentContainer: {
    paddingHorizontal: 8,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 6,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Notes section styles
  notesSection: {
    marginHorizontal: 11,
    marginTop: 8,
    borderRadius: 11,
    padding: 11,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },
  notesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  notesTitleContainer: {
    flex: 1,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  notesSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  notesInputSection: {
    marginTop: 8,
  },
  notesInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  notesInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  autoSaveIndicator: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  notesTextInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    minHeight: 280,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  // Quick Access section styles
  quickAccessSection: {
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
  quickAccessHeader: {
    marginBottom: 20,
  },
  quickAccessTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  quickAccessSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAccessCard: {
    width: '30%',
    minWidth: 80,
    aspectRatio: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAccessIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAccessLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  excommHeader: {
    marginTop: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  excommBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  excommBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  questionsHeaderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  questionsHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionsAssignedTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  questionsHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  autoAssignButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  autoAssignButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearAllButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressDotsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  progressDot: {
    width: 20,
    height: 6,
    borderRadius: 3,
  },
  questionCardsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  newQuestionCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  newQuestionCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  questionNumberCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionNumberCircleText: {
    fontSize: 18,
    fontWeight: '600',
  },
  questionCardContent: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
  },
  questionCardInput: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    padding: 0,
    minHeight: 24,
  },
  assignedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  assignedStatusText: {
    fontSize: 13,
  },
  assignDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  assignDropdownButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Center Modal styles for Participant Picker
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  centerParticipantModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '100%',
    flexShrink: 1,
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
  questionPreviewCard: {
    marginHorizontal: 20,
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
  questionPreviewLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  questionPreviewText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  participantsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  participantsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  participantModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  participantModalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  participantModalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  participantModalAvatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  participantModalInfo: {
    flex: 1,
  },
  participantModalName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  participantModalStatus: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  noParticipantsInModal: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noParticipantsModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  noParticipantsModalText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noParticipantsModalSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  viewQuestionsButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewQuestionsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  newQuestionCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  questionContentExpanded: {
    flex: 1,
    justifyContent: 'center',
  },
  questionTextExpanded: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  questionTextPlaceholder: {
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  questionActionsColumn: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonCompact: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Viewer Modal Styles
  viewerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerModal: {
    width: '100%',
    maxWidth: 600,
    height: '80%',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 24,
  },
  viewerContent: {
    flex: 1,
    padding: 24,
  },
  questionCounter: {
    alignItems: 'center',
    marginBottom: 20,
  },
  questionCounterText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewerQuestionScroll: {
    flex: 1,
  },
  viewerQuestionScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  viewerQuestionCard: {
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  viewerQuestionNumber: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  viewerQuestionNumberText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  viewerQuestionText: {
    fontSize: 20,
    lineHeight: 32,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  viewerAssignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 16,
  },
  viewerAssignedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  viewerNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 16,
  },
  viewerNavButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  viewerNavButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerPageDots: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  viewerPageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  publishAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  publishAllButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  publishModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  publishModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  publishModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  publishModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  publishModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  publishModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishModalButtonCancel: {
    borderWidth: 1,
  },
  publishModalButtonConfirm: {
    // backgroundColor set dynamically
  },
  publishModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  memberPickerModal: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  memberPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  memberPickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberPickerHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 1,
  },
  memberPickerSubtitle: {
    fontSize: 12,
  },
  memberPickerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberPickerQuestionPreview: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  memberPickerQuestionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    minWidth: 22,
  },
  memberPickerQuestionText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  memberPickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  memberPickerSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  memberPickerList: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  memberPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  memberPickerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  memberPickerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  memberPickerAvatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  memberPickerItemInfo: {
    flex: 1,
  },
  memberPickerItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberPickerItemSub: {
    fontSize: 12,
  },
  memberPickerCheckMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  memberPickerNoResults: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  memberPickerNoResultsText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
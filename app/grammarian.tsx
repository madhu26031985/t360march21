import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import { fetchGrammarianCornerSnapshot, fetchGrammarianClubMembersDirectory } from '@/lib/grammarianCornerQuery';
import { GrammarianReportSummarySection } from '@/components/grammarian/GrammarianReportSummarySection';
import { GrammarianNotesScreen } from './grammarian-notes';
import { ArrowLeft, BookOpen, Calendar, MapPin, Building2, User, Save, Sparkles, X, ChevronRight, ChevronLeft, ChevronDown, Plus, Minus, Search, FileText, NotebookPen, Bell, Users, Eye, CheckSquare, Timer, Star, Mic, FileBarChart, Award, MessageCircle, MessageSquare, Lightbulb, MessageSquareQuote, ThumbsUp, CheckCircle2, AlertTriangle, TrendingUp, RotateCcw, Info, UserPlus } from 'lucide-react-native';

/** Match Toastmaster / corner bottom dock icon size */
const FOOTER_NAV_ICON_SIZE = 15;
import { Image } from 'react-native';

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
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignedGrammarian, setAssignedGrammarian] = useState<AssignedGrammarian | null>(null);
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
  const [summarySubTab, setSummarySubTab] = useState<'word' | 'idiom' | 'quote' | 'report'>('word');
  const [usageTracking, setUsageTracking] = useState<UsageTracking>({
    word_usage: 0,
    idiom_usage: 0,
    phrase_usage: 0,
    quote_usage: 0,
  });
  const [grammarianReportId, setGrammarianReportId] = useState<string | null>(null);
  const [hasPublishedLiveObservations, setHasPublishedLiveObservations] = useState(false);
  
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
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [showAssignGrammarianModal, setShowAssignGrammarianModal] = useState(false);
  const [assignGrammarianSearch, setAssignGrammarianSearch] = useState('');
  const [assigningGrammarianRole, setAssigningGrammarianRole] = useState(false);
  const [cornerLiveSubTab, setCornerLiveSubTab] = useState<'good-usage' | 'improvements' | 'stats'>('good-usage');
  const [showGrammarianInfoModal, setShowGrammarianInfoModal] = useState(false);

  const wordOfTheDayDotScale = wordOfTheDayPulse.interpolate({
    inputRange: [1, 1.08],
    outputRange: [1, 1.35],
  });

  const wordOfTheDayDotOpacity = wordOfTheDayPulse.interpolate({
    inputRange: [1, 1.08],
    outputRange: [0.7, 1],
  });
  const grammarianFirstName = (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'there';

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

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
      }
    }, [meetingId])
  );

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const snap = await fetchGrammarianCornerSnapshot(meetingId, user.id, user.currentClubId);

      if (snap) {
        setMeeting(snap.meeting as Meeting);
        if (snap.club_name) setClubName(snap.club_name);
        setIsVPEClub(snap.is_vpe_for_club);

        if (snap.assigned_grammarian) {
          setAssignedGrammarian(snap.assigned_grammarian);

          if (snap.assigned_grammarian.id === user.id) {
            await loadDailyElements();
            await loadGrammarianReport();
          }

          await loadWordOfTheDay();
          await loadIdiomOfTheDay();
          await loadQuoteOfTheDay();
          await loadPublishedLiveObservations();
        } else {
          setAssignedGrammarian(null);
        }
      } else {
        await Promise.all([loadMeeting(), loadAssignedGrammarian(), loadClubName(), loadIsVPEClub()]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load Grammarian data');
    } finally {
      setIsLoading(false);
    }

    void loadClubMembers();
  };

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
        await loadData();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingGrammarianRole(false);
    }
  };

  const handleAssignGrammarianToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningGrammarianRole(true);
    try {
      const roleId = await fetchOpenMeetingRoleId(meetingId, { ilikeRoleName: '%grammarian%' });
      if (!roleId) {
        Alert.alert('Error', 'No open Grammarian role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignGrammarianModal(false);
        setAssignGrammarianSearch('');
        await loadData();
        Alert.alert('Assigned', `${member.full_name} is now the Grammarian for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
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

  const loadAssignedGrammarian = async () => {
    if (!meetingId || !user?.currentClubId) return;

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
        return;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        setAssignedGrammarian({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });

        // Load daily elements if user is the assigned grammarian
        if (profile.id === user?.id) {
          await loadDailyElements();
          await loadGrammarianReport();
        }

        // Load Word of the Day, Idiom of the Day, and Quote of the Day for all users (grammarians and non-grammarians)
        await loadWordOfTheDay();
        await loadIdiomOfTheDay();
        await loadQuoteOfTheDay();
        await loadPublishedLiveObservations();
      } else {
        // Explicitly clear when no grammarian is assigned.
        setAssignedGrammarian(null);
      }
    } catch (error) {
      console.error('Error loading assigned Grammarian:', error);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const members = await fetchGrammarianClubMembersDirectory(user.currentClubId);
      setClubMembers(members);

      setSelectedMember((prev) => (prev ? prev : members[0] ?? null));
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

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

  const loadDailyElements = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_grammarian_daily_elements')
        .select('word_of_the_day, idiom_of_the_day, phrase_of_the_day, quote_of_the_day')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', user.id)
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

  const loadPublishedLiveObservations = async () => {
    if (!meetingId) return;

    try {
      const [goodUsageResult, improvementsResult] = await Promise.all([
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
      ]);

      const hasPublished =
        (goodUsageResult.data && goodUsageResult.data.length > 0) ||
        (improvementsResult.data && improvementsResult.data.length > 0);

      setHasPublishedLiveObservations(!!hasPublished);
    } catch (error) {
      console.error('Error loading published live observations:', error);
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
      const saveData = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        grammarian_user_id: user.id,
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
        .eq('grammarian_user_id', user.id)
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
          {selectedMember?.avatar_url ? (
            <Image source={{ uri: selectedMember.avatar_url }} style={styles.memberAvatarImage} />
          ) : (
            <User size={20} color="#ffffff" />
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
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian Report</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
          <View style={styles.tabContentWrapper}>
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

            {/* No Grammarian Assigned State */}
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
            </View>
            <View style={styles.meetingCardDecoration} />
          </View>
          </View>

          {/* Navigation Quick Actions — same dock sizing as assigned Grammarian Report (FOOTER_NAV_ICON_SIZE, quickAction*) */}
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
                  onPress={() => setShowAssignGrammarianModal(true)}
                  disabled={bookingGrammarianRole || assigningGrammarianRole}
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
            </ScrollView>
          </View>
        </ScrollView>

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
                  Assign Grammarian
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
                Choose a club member to book the Grammarian role for this meeting.
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
                ) : filteredMembersForAssign.length > 0 ? (
                  filteredMembersForAssign.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.memberOption, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignGrammarianToMember(member)}
                      disabled={assigningGrammarianRole}
                    >
                      <View style={styles.memberOptionAvatar}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                        ) : (
                          <User size={20} color="#ffffff" />
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
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
        </View>

        {/* Assigned Grammarian Section */}
        {assignedGrammarian && (
          <View style={[styles.assignedGrammarianSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.assignedGrammarianCard}>
              <View style={styles.assignedGrammarianInfo}>
                <View style={styles.assignedGrammarianAvatar}>
                  {assignedGrammarian.avatar_url ? (
                    <Image source={{ uri: assignedGrammarian.avatar_url }} style={styles.assignedGrammarianAvatarImage} />
                  ) : (
                    <User size={24} color="#ffffff" />
                  )}
                </View>
                <View style={styles.assignedGrammarianDetails}>
                  <Text style={[styles.assignedGrammarianName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {assignedGrammarian.full_name}
                  </Text>
                  <Text style={[styles.assignedGrammarianRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Grammarian
                  </Text>
                </View>
              </View>
              {isAssignedGrammarian() && (
                <View style={styles.toastmasterActionWrapper}>
                  {/* Note icon removed per user request */}
                </View>
              )}
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
            {/* Pre-meeting shortcuts for assigned Grammarian */}
            <View style={[styles.preMeetingSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.preMeetingHeader, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Pre meeting!
              </Text>

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

                  {/* Journey-style pending highlight dot for Word of the day */}
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

            {/* Live meeting tabs (quick open) */}
            <View style={[styles.preMeetingSection, { backgroundColor: theme.colors.surface, paddingTop: 14 }]}>
              <Text style={[styles.preMeetingHeader, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Live meeting
              </Text>

              <View style={[styles.liveSegmentControl, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                <TouchableOpacity
                  style={[
                    styles.liveSegmentTab,
                    cornerLiveSubTab === 'good-usage' && [styles.liveSegmentTabActive, { backgroundColor: '#ffffff' }],
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

                <View style={[styles.liveSegmentDivider, { backgroundColor: '#CBD5E1' }]} />

                <TouchableOpacity
                  style={[
                    styles.liveSegmentTab,
                    cornerLiveSubTab === 'improvements' && [styles.liveSegmentTabActive, { backgroundColor: '#ffffff' }],
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

                <View style={[styles.liveSegmentDivider, { backgroundColor: '#CBD5E1' }]} />

                <TouchableOpacity
                  style={[
                    styles.liveSegmentTab,
                    cornerLiveSubTab === 'stats' && [styles.liveSegmentTabActive, { backgroundColor: '#ffffff' }],
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

              {/* Hint removed: users can tap tabs to see Live meeting below. */}
            </View>

            {/* Inline Live meeting panel */}
            {canEditGrammarianCorner() && (
              <View style={styles.inlineLiveMeetingPanel}>
                <GrammarianNotesScreen
                  variant="live-inline"
                  liveSubTab={cornerLiveSubTab}
                  meetingId={meeting?.id}
                />
              </View>
            )}

            {/* Grammarian role guidance removed (requested by user). */}

        {/* Daily content placeholder for non-grammarians */}
        {!canEditGrammarianCorner() && !hasAnyPublishedDailyContent() && (
          <View style={styles.wordPlaceholderContainer}>
            <View style={[styles.wordPlaceholderIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <BookOpen size={32} color={theme.colors.primary} />
            </View>
            <Text style={[styles.wordPlaceholderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Grammarian Corner is being prepared!
            </Text>
            <Text style={[styles.wordPlaceholderSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {assignedGrammarian
                ? `Open Grammarian Summary to read Word, Idiom, and Quote of the Day when ${assignedGrammarian.full_name.trim().split(/\s+/)[0]} publishes them.`
                : 'Open Grammarian Summary to read Word, Idiom, and Quote of the Day when they are published.'}
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
                        No feedback added yet. Tap "Add Feedback" to provide member feedback.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}
          </>
        ) : (
          <GrammarianReportSummarySection
            theme={theme}
            styles={styles}
            summarySubTab={summarySubTab}
            setSummarySubTab={setSummarySubTab}
            wordOfTheDay={wordOfTheDay}
            idiomOfTheDay={idiomOfTheDay}
            quoteOfTheDay={quoteOfTheDay}
            assignedGrammarian={assignedGrammarian}
            clubName={clubName}
            meetingId={meetingId as string}
            hasPublishedLiveObservations={hasPublishedLiveObservations}
          />
        )}
        </View>

        {/* Navigation Quick Actions — Word / Quote / Idiom first; same dock as unassigned (quickAction*) */}
        <View
          style={[
            styles.quickActionsBoxContainer,
            {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
            },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            {canEditGrammarianCorner() && (
              <>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() =>
                    router.push({
                      pathname: '/grammarian-word-prep',
                      params: { meetingId: meeting?.id as string },
                    })
                  }
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#EFF6FF' }]}>
                    <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#2563eb" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Word</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() =>
                    router.push({
                      pathname: '/grammarian-quote-prep',
                      params: { meetingId: meeting?.id as string },
                    })
                  }
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F5F3FF' }]}>
                    <MessageSquareQuote size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quote</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() =>
                    router.push({
                      pathname: '/grammarian-idiom-prep',
                      params: { meetingId: meeting?.id as string },
                    })
                  }
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FFFBEB' }]}>
                    <Lightbulb size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Idiom</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() =>
                    router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id, initialTab: 'my_bookings' } })
                  }
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                    <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Withdraw</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() =>
                    router.push({
                      pathname: '/grammarian-live-meeting',
                      params: { meetingId: meeting?.id as string },
                    })
                  }
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#ECFDF5' }]}>
                    <ThumbsUp size={FOOTER_NAV_ICON_SIZE} color="#059669" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                <Bell size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Star size={FOOTER_NAV_ICON_SIZE} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <Eye size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quick Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileBarChart size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                <Award size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Evaluation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#059669" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                <Timer size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MessageSquare size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TTM</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

      </ScrollView>

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
              {filteredClubMembers.length > 0 ? (
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
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                      ) : (
                        <User size={20} color="#ffffff" />
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

📝 Pre-Meeting
Add the Word of the Day, Quote, and Idiom
Once added, they are saved automatically
All members can view them in the Grammarian Summary

🎤 During the Meeting
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
                  {selectedMember?.avatar_url ? (
                    <Image source={{ uri: selectedMember.avatar_url }} style={styles.modalIconImage} />
                  ) : (
                    <User size={20} color="#ffffff" />
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
  },
  tabContentWrapper: {
    flex: 1,
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
    borderRadius: 14,
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
    borderRadius: 12,
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
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  liveSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 50,
    gap: 5,
    width: '100%',
  },
  liveSegmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  liveSegmentTabText: {
    fontSize: 11,
  },
  liveSegmentDivider: {
    width: 1,
    height: 18,
    opacity: 0.5,
  },
  liveSegmentHint: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  inlineLiveMeetingPanel: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
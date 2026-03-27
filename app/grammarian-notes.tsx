import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, StickyNote, BookOpen, AlertCircle, MessageSquareQuote, Lightbulb, Plus, X, CheckCircle2, AlertTriangle, Clock, Trash2, TrendingUp, Minus, MinusCircle, User, Eye, EyeOff, BarChart2 } from 'lucide-react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface GrammarianOfDay {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface GrammarianNotesData {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_user_id: string;
  personal_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WordOfTheDayData {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_user_id: string;
  word: string;
  part_of_speech: string | null;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface IdiomOfTheDayData {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_user_id: string;
  idiom: string;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface QuoteOfTheDayData {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_user_id: string;
  quote: string;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

interface LiveObservation {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_id: string;
  observation: string;
  sequence_order: number;
  is_published: boolean;
  created_at: string;
}

interface ImprovementObservation {
  id: string;
  meeting_id: string;
  club_id: string;
  grammarian_id: string;
  incorrect_usage: string;
  correct_usage: string;
  sequence_order: number;
  is_published: boolean;
  created_at: string;
}

interface MemberUsage {
  id: string;
  member_user_id: string | null;
  member_name_manual?: string | null;
  usage_count: number;
  member_profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface ClubMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export type GrammarianNotesVariant = 'notes' | 'live-only' | 'live-inline';

type LiveSubTab = 'good-usage' | 'improvements' | 'stats';

export function GrammarianNotesScreen({
  variant,
  liveSubTab,
  meetingId: meetingIdFromProps,
}: {
  variant: GrammarianNotesVariant;
  liveSubTab?: LiveSubTab;
  meetingId?: string;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId =
    meetingIdFromProps ??
    (typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0]);
  const requestedLiveSubTab =
    typeof params.subTab === 'string' ? params.subTab : (params.subTab?.[0] as string | undefined);

  const initialLiveMeetingSubTab = requestedLiveSubTab === 'good-usage' || requestedLiveSubTab === 'improvements' || requestedLiveSubTab === 'stats'
    ? requestedLiveSubTab
    : 'good-usage';

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [grammarianOfDay, setGrammarianOfDay] = useState<GrammarianOfDay | null>(null);
  const [notesData, setNotesData] = useState<GrammarianNotesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDayData | null>(null);

  const [idiomOfTheDay, setIdiomOfTheDay] = useState<IdiomOfTheDayData | null>(null);

  const [quoteOfTheDay, setQuoteOfTheDay] = useState<QuoteOfTheDayData | null>(null);

  const [liveMeetingSubTab, setLiveMeetingSubTab] = useState<LiveSubTab>(initialLiveMeetingSubTab);

  useEffect(() => {
    if (!liveSubTab) return;
    setLiveMeetingSubTab(liveSubTab);
  }, [liveSubTab]);
  const [goodUsageList, setGoodUsageList] = useState<LiveObservation[]>([]);
  const [improvementsList, setImprovementsList] = useState<ImprovementObservation[]>([]);
  const [goodUsageInput, setGoodUsageInput] = useState('');
  const [incorrectUsageInput, setIncorrectUsageInput] = useState('');
  const [correctUsageInput, setCorrectUsageInput] = useState('');

  const [wordUsageCount, setWordUsageCount] = useState(0);
  const [idiomUsageCount, setIdiomUsageCount] = useState(0);
  const [quoteUsageCount, setQuoteUsageCount] = useState(0);

  const [wordMemberUsage, setWordMemberUsage] = useState<MemberUsage[]>([]);
  const [idiomMemberUsage, setIdiomMemberUsage] = useState<MemberUsage[]>([]);
  const [quoteMemberUsage, setQuoteMemberUsage] = useState<MemberUsage[]>([]);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState<'word' | 'idiom' | 'quote' | null>(null);
  const [manualMemberName, setManualMemberName] = useState('');
  const [areGoodUsagePublished, setAreGoodUsagePublished] = useState(false);
  const [areImprovementsPublished, setAreImprovementsPublished] = useState(false);
  const [areStatsPublished, setAreStatsPublished] = useState(false);
  const [statsInlineLoaded, setStatsInlineLoaded] = useState(false);
  const [isPublishingAll, setIsPublishingAll] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!meetingId) {
      // Avoid hanging on "Loading live meeting..." if meetingId is temporarily missing.
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setStatsInlineLoaded(false);

    if (variant === 'live-inline') {
      // Inline mode: load only what we need for the default tab quickly.
      // (Good Usage / Opportunity require live observations; Stats requires extra word usage data.)
      loadLiveInlineCoreData();
      return;
    }

    loadNotesData();
  }, [meetingId, variant]);

  useEffect(() => {
    if (variant !== 'live-inline') return;
    if (liveMeetingSubTab !== 'stats') return;
    if (statsInlineLoaded) return;
    if (!meetingId || !user?.currentClubId) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        // Inline Stats UI only shows Word usage, but we still load idiom/quote
        // so "Publish All" validation and publishing is accurate.
        const [wordRes, idiomRes, quoteRes] = await Promise.all([
          loadWordOfTheDayData(),
          loadIdiomOfTheDayData(),
          loadQuoteOfTheDayData(),
        ]);

        setAreStatsPublished(!!(wordRes?.is_published || idiomRes?.is_published || quoteRes?.is_published));
        await loadMemberUsage(wordRes?.id ?? null, idiomRes?.id ?? null, quoteRes?.id ?? null);
      } catch (e) {
        console.error('Error loading inline stats:', e);
      } finally {
        if (!cancelled) {
          setStatsInlineLoaded(true);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [variant, liveMeetingSubTab, statsInlineLoaded, meetingId, user?.currentClubId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);

  const loadNotesData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const [, , , wordResult, idiomResult, quoteResult] = await Promise.all([
        loadMeeting(),
        loadGrammarianOfDay(),
        loadIsVPEClub(),
        loadGrammarianNotesData(),
        loadWordOfTheDayData(),
        loadIdiomOfTheDayData(),
        loadQuoteOfTheDayData(),
        loadLiveObservations(),
        loadUsageStats(),
        loadClubMembers()
      ]);

      await loadMemberUsage(wordResult?.id, idiomResult?.id, quoteResult?.id);

      setAreStatsPublished(!!(wordResult?.is_published || idiomResult?.is_published || quoteResult?.is_published));
    } catch (error) {
      console.error('Error loading notes data:', error);
      Alert.alert('Error', 'Failed to load notes data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLiveInlineCoreData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadGrammarianOfDay(),
        loadIsVPEClub(),
        loadLiveObservations(),
        loadClubMembers(),
      ]);
    } catch (error) {
      console.error('Error loading inline live meeting core:', error);
    } finally {
      setIsLoading(false);
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

  const loadGrammarianOfDay = async () => {
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
        .ilike('role_name', '%grammarian%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading grammarian of day:', error);
        return;
      }

      setGrammarianOfDay(data);
    } catch (error) {
      console.error('Error loading grammarian of day:', error);
    }
  };

  const loadIsVPEClub = async () => {
    if (!user?.currentClubId || !user?.id) {
      setIsVPEClub(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select('vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();
      if (error) {
        console.error('Error loading VPE access:', error);
        setIsVPEClub(false);
        return;
      }
      setIsVPEClub(data?.vpe_id === user.id);
    } catch (error) {
      console.error('Error loading VPE access:', error);
      setIsVPEClub(false);
    }
  };

  const loadGrammarianNotesData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('grammarian_meeting_notes')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', effectiveGrammarianUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading grammarian notes data:', error);
        return;
      }

      if (data) {
        setNotesData(data);
        setNotes(data.personal_notes || '');
      }
    } catch (error) {
      console.error('Error loading grammarian notes data:', error);
    }
  };

  const loadWordOfTheDayData = async (): Promise<{ id: string; is_published: boolean } | null> => {
    if (!meetingId || !user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('grammarian_word_of_the_day')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', effectiveGrammarianUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading word of the day data:', error);
        return null;
      }

      if (data) {
        setWordOfTheDay(data);
        return { id: data.id, is_published: data.is_published ?? false };
      }
      return null;
    } catch (error) {
      console.error('Error loading word of the day data:', error);
      return null;
    }
  };

  const loadIdiomOfTheDayData = async (): Promise<{ id: string; is_published: boolean } | null> => {
    if (!meetingId || !user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('grammarian_idiom_of_the_day')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', effectiveGrammarianUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading idiom of the day data:', error);
        return null;
      }

      if (data) {
        setIdiomOfTheDay(data);
        return { id: data.id, is_published: data.is_published ?? false };
      }
      return null;
    } catch (error) {
      console.error('Error loading idiom of the day data:', error);
      return null;
    }
  };

  const loadQuoteOfTheDayData = async (): Promise<{ id: string; is_published: boolean } | null> => {
    if (!meetingId || !user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('grammarian_quote_of_the_day')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', effectiveGrammarianUserId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading quote of the day data:', error);
        return null;
      }

      if (data) {
        setQuoteOfTheDay(data);
        return { id: data.id, is_published: data.is_published ?? false };
      }
      return null;
    } catch (error) {
      console.error('Error loading quote of the day data:', error);
      return null;
    }
  };

  const loadLiveObservations = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const [goodUsageResult, improvementsResult] = await Promise.all([
        supabase
          .from('grammarian_live_good_usage')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('grammarian_id', effectiveGrammarianUserId)
          .order('sequence_order', { ascending: true }),
        supabase
          .from('grammarian_live_improvements')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('grammarian_id', effectiveGrammarianUserId)
          .order('sequence_order', { ascending: true })
      ]);

      if (goodUsageResult.data) {
        setGoodUsageList(goodUsageResult.data);
        const hasGoodUsage = goodUsageResult.data.length > 0;
        const allGoodUsagePublished = hasGoodUsage && goodUsageResult.data.every(obs => obs.is_published);
        setAreGoodUsagePublished(allGoodUsagePublished);
      }

      if (improvementsResult.data) {
        setImprovementsList(improvementsResult.data);
        const hasImprovements = improvementsResult.data.length > 0;
        const allImprovementsPublished = hasImprovements && improvementsResult.data.every(obs => obs.is_published);
        setAreImprovementsPublished(allImprovementsPublished);
      }
    } catch (error) {
      console.error('Error loading live observations:', error);
    }
  };

  const loadUsageStats = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const [wordResult, idiomResult, quoteResult] = await Promise.all([
        supabase
          .from('grammarian_word_of_the_day')
          .select('usage_count')
          .eq('meeting_id', meetingId)
          .eq('grammarian_user_id', effectiveGrammarianUserId)
          .maybeSingle(),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('usage_count')
          .eq('meeting_id', meetingId)
          .eq('grammarian_user_id', effectiveGrammarianUserId)
          .maybeSingle(),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('usage_count')
          .eq('meeting_id', meetingId)
          .eq('grammarian_user_id', effectiveGrammarianUserId)
          .maybeSingle()
      ]);

      setWordUsageCount(wordResult.data?.usage_count || 0);
      setIdiomUsageCount(idiomResult.data?.usage_count || 0);
      setQuoteUsageCount(quoteResult.data?.usage_count || 0);
    } catch (error) {
      console.error('Error loading usage stats:', error);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('user_id, app_user_profiles(id, full_name, avatar_url)')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      if (data) {
        const members = data
          .map(item => item.app_user_profiles)
          .filter((profile): profile is ClubMember => profile !== null);
        setClubMembers(members);
      }
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadMemberUsage = async (wordId?: string | null, idiomId?: string | null, quoteId?: string | null) => {
    const wId = wordId ?? wordOfTheDay?.id;
    const iId = idiomId ?? idiomOfTheDay?.id;
    const qId = quoteId ?? quoteOfTheDay?.id;

    if (!wId && !iId && !qId) return;

    try {
      const promises = [];

      if (wId) {
        promises.push(
          supabase
            .from('grammarian_word_of_the_day_member_usage')
            .select('*, app_user_profiles(full_name, avatar_url)')
            .eq('word_of_the_day_id', wId)
        );
      }

      if (iId) {
        promises.push(
          supabase
            .from('grammarian_idiom_of_the_day_member_usage')
            .select('*, app_user_profiles(full_name, avatar_url)')
            .eq('idiom_of_the_day_id', iId)
        );
      }

      if (qId) {
        promises.push(
          supabase
            .from('grammarian_quote_of_the_day_member_usage')
            .select('*, app_user_profiles(full_name, avatar_url)')
            .eq('quote_of_the_day_id', qId)
        );
      }

      const results = await Promise.all(promises);
      let resultIndex = 0;

      if (wId && results[resultIndex]) {
        const wordData = results[resultIndex].data || [];
        setWordMemberUsage(wordData.map((item: any) => ({
          id: item.id,
          member_user_id: item.member_user_id,
          member_name_manual: item.member_name_manual,
          usage_count: item.usage_count,
          member_profile: item.app_user_profiles
        })));
        resultIndex++;
      }

      if (iId && results[resultIndex]) {
        const idiomData = results[resultIndex].data || [];
        setIdiomMemberUsage(idiomData.map((item: any) => ({
          id: item.id,
          member_user_id: item.member_user_id,
          member_name_manual: item.member_name_manual,
          usage_count: item.usage_count,
          member_profile: item.app_user_profiles
        })));
        resultIndex++;
      }

      if (qId && results[resultIndex]) {
        const quoteData = results[resultIndex].data || [];
        setQuoteMemberUsage(quoteData.map((item: any) => ({
          id: item.id,
          member_user_id: item.member_user_id,
          member_name_manual: item.member_name_manual,
          usage_count: item.usage_count,
          member_profile: item.app_user_profiles
        })));
      }
    } catch (error) {
      console.error('Error loading member usage:', error);
    }
  };

  const isAssignedGrammarian = () => {
    return grammarianOfDay?.assigned_user_id === user?.id;
  };
  const isGrammarianOfDay = () => {
    return isAssignedGrammarian() || isVPEClub;
  };
  const effectiveGrammarianUserId = grammarianOfDay?.assigned_user_id ?? user?.id ?? null;

  const handleNotesChange = (text: string) => {
    if (text.length <= 1000) {
      setNotes(text);
      setHasUnsavedChanges(text !== (notesData?.personal_notes || ''));

      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }

      autoSaveTimeout.current = setTimeout(() => {
        autoSaveNotes(text);
      }, 2000);
    }
  };

  const autoSaveNotes = async (noteText: string) => {
    if (!isAssignedGrammarian()) {
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      return;
    }

    try {
      if (notesData) {
        const { error } = await supabase
          .from('grammarian_meeting_notes')
          .update({
            personal_notes: noteText.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notesData.id);

        if (error) {
          console.error('Error auto-saving notes:', error);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('grammarian_meeting_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            grammarian_user_id: user.id,
            personal_notes: noteText.trim() || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating notes:', error);
          return;
        }

        if (data) {
          setNotesData(data);
        }
      }

      setHasUnsavedChanges(false);
      await loadGrammarianNotesData();
    } catch (error) {
      console.error('Error auto-saving notes:', error);
    }
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleSaveNotes = async () => {
    if (!isAssignedGrammarian()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian can save personal notes.');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);

    try {
      if (notesData) {
        const { error } = await supabase
          .from('grammarian_meeting_notes')
          .update({
            personal_notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notesData.id);

        if (error) {
          console.error('Error updating personal notes:', error);
          Alert.alert('Error', 'Failed to update personal notes');
          return;
        }

        Alert.alert('Success', 'Personal notes updated successfully');
      } else {
        const { error } = await supabase
          .from('grammarian_meeting_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            grammarian_user_id: user.id,
            personal_notes: notes.trim() || null,
          });

        if (error) {
          console.error('Error creating personal notes:', error);
          Alert.alert('Error', 'Failed to save personal notes');
          return;
        }

        Alert.alert('Success', 'Personal notes saved successfully');
      }

      setHasUnsavedChanges(false);
      await loadGrammarianNotesData();
    } catch (error) {
      console.error('Error saving personal notes:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };


  const handleAddGoodUsage = async () => {
    if (!goodUsageInput.trim()) {
      return;
    }

    if (!isGrammarianOfDay()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian can add observations.');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      const maxSequence = goodUsageList.length > 0
        ? Math.max(...goodUsageList.map(item => item.sequence_order))
        : 0;

      const { error } = await supabase
        .from('grammarian_live_good_usage')
        .insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_id: effectiveGrammarianUserId,
          observation: goodUsageInput.trim(),
          sequence_order: maxSequence + 1,
        });

      if (error) {
        console.error('Error adding good usage observation:', error);
        Alert.alert('Error', 'Failed to add observation');
        return;
      }

      setGoodUsageInput('');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error adding good usage observation:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleDeleteGoodUsage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('grammarian_live_good_usage')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting good usage observation:', error);
        Alert.alert('Error', 'Failed to delete observation');
        return;
      }

      await loadLiveObservations();
    } catch (error) {
      console.error('Error deleting good usage observation:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleAddImprovement = async () => {
    if (!incorrectUsageInput.trim() || !correctUsageInput.trim()) {
      Alert.alert('Required Fields', 'Please fill in both incorrect and correct usage examples.');
      return;
    }

    if (!isGrammarianOfDay()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian can add observations.');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      const maxSequence = improvementsList.length > 0
        ? Math.max(...improvementsList.map(item => item.sequence_order))
        : 0;

      const { error } = await supabase
        .from('grammarian_live_improvements')
        .insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_id: effectiveGrammarianUserId,
          incorrect_usage: incorrectUsageInput.trim(),
          correct_usage: correctUsageInput.trim(),
          sequence_order: maxSequence + 1,
        });

      if (error) {
        console.error('Error adding improvement observation:', error);
        Alert.alert('Error', 'Failed to add observation');
        return;
      }

      setIncorrectUsageInput('');
      setCorrectUsageInput('');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error adding improvement observation:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleDeleteImprovement = async (id: string) => {
    try {
      const { error } = await supabase
        .from('grammarian_live_improvements')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting improvement observation:', error);
        Alert.alert('Error', 'Failed to delete observation');
        return;
      }

      await loadLiveObservations();
    } catch (error) {
      console.error('Error deleting improvement observation:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const updateUsageCount = async (type: 'word' | 'idiom' | 'quote', increment: boolean) => {
    if (!meetingId || !user?.id) return;

    const tableName = type === 'word'
      ? 'grammarian_word_of_the_day'
      : type === 'idiom'
      ? 'grammarian_idiom_of_the_day'
      : 'grammarian_quote_of_the_day';

    const currentCount = type === 'word'
      ? wordUsageCount
      : type === 'idiom'
      ? idiomUsageCount
      : quoteUsageCount;

    const newCount = increment ? currentCount + 1 : Math.max(0, currentCount - 1);

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ usage_count: newCount })
        .eq('meeting_id', meetingId)
        .eq('grammarian_user_id', effectiveGrammarianUserId);

      if (error) {
        console.error(`Error updating ${type} usage count:`, error);
        return;
      }

      if (type === 'word') {
        setWordUsageCount(newCount);
      } else if (type === 'idiom') {
        setIdiomUsageCount(newCount);
      } else {
        setQuoteUsageCount(newCount);
      }
    } catch (error) {
      console.error(`Error updating ${type} usage count:`, error);
    }
  };

  const handleAddMember = async (memberId: string, type: 'word' | 'idiom' | 'quote') => {
    const itemId = type === 'word'
      ? wordOfTheDay?.id
      : type === 'idiom'
      ? idiomOfTheDay?.id
      : quoteOfTheDay?.id;

    if (!itemId) return;

    const tableName = type === 'word'
      ? 'grammarian_word_of_the_day_member_usage'
      : type === 'idiom'
      ? 'grammarian_idiom_of_the_day_member_usage'
      : 'grammarian_quote_of_the_day_member_usage';

    const foreignKeyColumn = type === 'word'
      ? 'word_of_the_day_id'
      : type === 'idiom'
      ? 'idiom_of_the_day_id'
      : 'quote_of_the_day_id';

    try {
      const { error } = await supabase
        .from(tableName)
        .insert({
          [foreignKeyColumn]: itemId,
          member_user_id: memberId,
          usage_count: 0
        });

      if (error) {
        console.error('Error adding member:', error);
        Alert.alert('Error', 'Failed to add member');
        return;
      }

      setShowMemberPicker(null);
      await loadMemberUsage();
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleAddManualMember = async () => {
    const name = manualMemberName.trim();
    if (!name || !showMemberPicker) return;

    const type = showMemberPicker;
    const itemId = type === 'word'
      ? wordOfTheDay?.id
      : type === 'idiom'
      ? idiomOfTheDay?.id
      : quoteOfTheDay?.id;

    if (!itemId) return;

    const tableName = type === 'word'
      ? 'grammarian_word_of_the_day_member_usage'
      : type === 'idiom'
      ? 'grammarian_idiom_of_the_day_member_usage'
      : 'grammarian_quote_of_the_day_member_usage';

    const foreignKeyColumn = type === 'word'
      ? 'word_of_the_day_id'
      : type === 'idiom'
      ? 'idiom_of_the_day_id'
      : 'quote_of_the_day_id';

    try {
      const { error } = await supabase
        .from(tableName)
        .insert({
          [foreignKeyColumn]: itemId,
          member_user_id: null,
          member_name_manual: name,
          usage_count: 0
        });

      if (error) {
        console.error('Error adding manual member:', error);
        Alert.alert('Error', 'Failed to add member');
        return;
      }

      setManualMemberName('');
      setShowMemberPicker(null);
      await loadMemberUsage();
    } catch (error) {
      console.error('Error adding manual member:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const updateMemberUsageCount = async (usageId: string, type: 'word' | 'idiom' | 'quote', increment: boolean) => {
    const tableName = type === 'word'
      ? 'grammarian_word_of_the_day_member_usage'
      : type === 'idiom'
      ? 'grammarian_idiom_of_the_day_member_usage'
      : 'grammarian_quote_of_the_day_member_usage';

    const currentUsage = type === 'word'
      ? wordMemberUsage.find(u => u.id === usageId)
      : type === 'idiom'
      ? idiomMemberUsage.find(u => u.id === usageId)
      : quoteMemberUsage.find(u => u.id === usageId);

    if (!currentUsage) return;

    const newCount = increment ? currentUsage.usage_count + 1 : Math.max(0, currentUsage.usage_count - 1);

    try {
      const { error } = await supabase
        .from(tableName)
        .update({ usage_count: newCount })
        .eq('id', usageId);

      if (error) {
        console.error('Error updating member usage count:', error);
        return;
      }

      await loadMemberUsage();
    } catch (error) {
      console.error('Error updating member usage count:', error);
    }
  };

  const removeMember = async (usageId: string, type: 'word' | 'idiom' | 'quote') => {
    const tableName = type === 'word'
      ? 'grammarian_word_of_the_day_member_usage'
      : type === 'idiom'
      ? 'grammarian_idiom_of_the_day_member_usage'
      : 'grammarian_quote_of_the_day_member_usage';

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', usageId);

      if (error) {
        console.error('Error removing member:', error);
        Alert.alert('Error', 'Failed to remove member');
        return;
      }

      await loadMemberUsage();
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handlePublishGoodUsage = async () => {
    if (!meetingId || !user?.id) return;

    if (goodUsageList.length === 0) {
      Alert.alert('No Observations', 'Please add good usage examples before publishing.');
      return;
    }

    try {
      const { error } = await supabase
        .from('grammarian_live_good_usage')
        .update({ is_published: true })
        .eq('meeting_id', meetingId)
        .eq('grammarian_id', effectiveGrammarianUserId);

      if (error) {
        Alert.alert('Error', 'Failed to publish good usage examples');
        return;
      }

      setAreGoodUsagePublished(true);
      Alert.alert('Success', 'Good usage examples published successfully!');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error publishing good usage:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleUnpublishGoodUsage = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { error } = await supabase
        .from('grammarian_live_good_usage')
        .update({ is_published: false })
        .eq('meeting_id', meetingId)
        .eq('grammarian_id', effectiveGrammarianUserId);

      if (error) {
        Alert.alert('Error', 'Failed to unpublish good usage examples');
        return;
      }

      setAreGoodUsagePublished(false);
      Alert.alert('Success', 'Good usage examples unpublished successfully!');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error unpublishing good usage:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handlePublishImprovements = async () => {
    if (!meetingId || !user?.id) return;

    if (improvementsList.length === 0) {
      Alert.alert('No Observations', 'Please add improvement areas before publishing.');
      return;
    }

    try {
      const { error } = await supabase
        .from('grammarian_live_improvements')
        .update({ is_published: true })
        .eq('meeting_id', meetingId)
        .eq('grammarian_id', effectiveGrammarianUserId);

      if (error) {
        Alert.alert('Error', 'Failed to publish improvement areas');
        return;
      }

      setAreImprovementsPublished(true);
      Alert.alert('Success', 'Improvement areas published successfully!');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error publishing improvements:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleUnpublishImprovements = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { error } = await supabase
        .from('grammarian_live_improvements')
        .update({ is_published: false })
        .eq('meeting_id', meetingId)
        .eq('grammarian_id', effectiveGrammarianUserId);

      if (error) {
        Alert.alert('Error', 'Failed to unpublish improvement areas');
        return;
      }

      setAreImprovementsPublished(false);
      Alert.alert('Success', 'Improvement areas unpublished successfully!');
      await loadLiveObservations();
    } catch (error) {
      console.error('Error unpublishing improvements:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handlePublishStats = async () => {
    if (!wordOfTheDay?.id && !idiomOfTheDay?.id && !quoteOfTheDay?.id) {
      Alert.alert('No Stats', 'Please add word, idiom, or quote of the day before publishing stats.');
      return;
    }

    try {
      const promises = [];

      if (wordOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_word_of_the_day').update({ is_published: true }).eq('id', wordOfTheDay.id)
        );
      }
      if (idiomOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_idiom_of_the_day').update({ is_published: true }).eq('id', idiomOfTheDay.id)
        );
      }
      if (quoteOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_quote_of_the_day').update({ is_published: true }).eq('id', quoteOfTheDay.id)
        );
      }

      const results = await Promise.all(promises);
      if (results.some(r => r.error)) {
        Alert.alert('Error', 'Failed to publish stats');
        return;
      }

      setAreStatsPublished(true);
      Alert.alert('Success', 'Stats published to summary successfully!');
    } catch (error) {
      console.error('Error publishing stats:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const validatePublishAllToSummary = (): string | null => {
    const hasGoodUsage = goodUsageList.length > 0;
    const hasImprovements = improvementsList.length > 0;
    const hasWordStats = !!wordOfTheDay?.id;
    const hasIdiomStats = !!idiomOfTheDay?.id;
    const hasQuoteStats = !!quoteOfTheDay?.id;

    const hasAnyCaptured =
      hasGoodUsage || hasImprovements || hasWordStats || hasIdiomStats || hasQuoteStats;

    if (!hasAnyCaptured) {
      return 'No data captured yet. Add Good Usage / Opportunity / Word usage before publishing.';
    }

    if (hasGoodUsage) {
      const bad = goodUsageList.find(o => !o.observation?.trim());
      if (bad) return 'Good Usage has an empty observation. Please fix it before publishing.';
    }

    if (hasImprovements) {
      const bad = improvementsList.find(
        o => !o.incorrect_usage?.trim() || !o.correct_usage?.trim()
      );
      if (bad) return 'Opportunity has incomplete incorrect/correct usage. Please fix it before publishing.';
    }

    const validateMemberUsage = (label: string, list: MemberUsage[], recordId?: string | null): string | null => {
      if (!recordId) return null;
      if (list.length === 0) {
        return `${label} usage is missing. Add at least one member to capture usage before publishing.`;
      }
      const bad = list.find(u => {
        const hasMember =
          !!u.member_profile ||
          !!u.member_user_id ||
          !!u.member_name_manual?.trim();
        const usageOk = typeof u.usage_count === 'number' && Number.isFinite(u.usage_count) && u.usage_count >= 0;
        return !hasMember || !usageOk;
      });
      if (bad) {
        return `${label} usage has invalid member or count. Please fix it before publishing.`;
      }
      return null;
    };

    if (hasWordStats) {
      if (!wordOfTheDay?.word?.trim()) {
        return 'Word of the Day is missing. Please add the word before publishing.';
      }
      const err = validateMemberUsage('Word', wordMemberUsage, wordOfTheDay?.id);
      if (err) return err;
    }

    if (hasIdiomStats) {
      if (!idiomOfTheDay?.idiom?.trim()) {
        return 'Idiom of the Day is missing. Please add the idiom before publishing.';
      }
      const err = validateMemberUsage('Idiom', idiomMemberUsage, idiomOfTheDay?.id);
      if (err) return err;
    }

    if (hasQuoteStats) {
      if (!quoteOfTheDay?.quote?.trim()) {
        return 'Quote of the Day is missing. Please add the quote before publishing.';
      }
      const err = validateMemberUsage('Quote', quoteMemberUsage, quoteOfTheDay?.id);
      if (err) return err;
    }

    return null;
  };

  const hasGoodUsageCaptured = goodUsageList.length > 0;
  const hasImprovementsCaptured = improvementsList.length > 0;
  const hasStatsCaptured = !!wordOfTheDay?.id || !!idiomOfTheDay?.id || !!quoteOfTheDay?.id;

  const isAllPublishedToSummary =
    (!hasGoodUsageCaptured || areGoodUsagePublished) &&
    (!hasImprovementsCaptured || areImprovementsPublished) &&
    (!hasStatsCaptured || areStatsPublished);

  const handlePublishAllToSummary = async () => {
    if (!meetingId || !user?.id) return;
    if (isPublishingAll) return;

    const validationError = validatePublishAllToSummary();
    if (validationError) {
      Alert.alert('Fix before publishing', validationError);
      return;
    }

    setIsPublishingAll(true);
    try {
      const promises: any[] = [];

      // Publish live observations
      if (goodUsageList.length > 0) {
        promises.push(
          supabase
            .from('grammarian_live_good_usage')
            .update({ is_published: true })
            .eq('meeting_id', meetingId)
            .eq('grammarian_id', effectiveGrammarianUserId)
        );
      }

      if (improvementsList.length > 0) {
        promises.push(
          supabase
            .from('grammarian_live_improvements')
            .update({ is_published: true })
            .eq('meeting_id', meetingId)
            .eq('grammarian_id', effectiveGrammarianUserId)
        );
      }

      // Publish stats
      if (wordOfTheDay?.id) {
        promises.push(
          supabase
            .from('grammarian_word_of_the_day')
            .update({ is_published: true })
            .eq('id', wordOfTheDay.id)
        );
      }
      if (idiomOfTheDay?.id) {
        promises.push(
          supabase
            .from('grammarian_idiom_of_the_day')
            .update({ is_published: true })
            .eq('id', idiomOfTheDay.id)
        );
      }
      if (quoteOfTheDay?.id) {
        promises.push(
          supabase
            .from('grammarian_quote_of_the_day')
            .update({ is_published: true })
            .eq('id', quoteOfTheDay.id)
        );
      }

      const results = await Promise.all(promises);
      if (results.some(r => r.error)) {
        Alert.alert('Error', 'Failed to publish. Please try again.');
        return;
      }

      // Refresh only the relevant bits
      const refreshPromises: any[] = [];
      if (goodUsageList.length > 0) refreshPromises.push(loadLiveObservations());
      refreshPromises.push(loadUsageStats());

      if (wordOfTheDay?.id) refreshPromises.push(loadWordOfTheDayData());
      if (idiomOfTheDay?.id) refreshPromises.push(loadIdiomOfTheDayData());
      if (quoteOfTheDay?.id) refreshPromises.push(loadQuoteOfTheDayData());

      if (wordOfTheDay?.id || idiomOfTheDay?.id || quoteOfTheDay?.id) {
        refreshPromises.push(
          loadMemberUsage(wordOfTheDay?.id ?? null, idiomOfTheDay?.id ?? null, quoteOfTheDay?.id ?? null)
        );
      }

      await Promise.all(refreshPromises);

      setAreGoodUsagePublished(goodUsageList.length > 0);
      setAreImprovementsPublished(improvementsList.length > 0);
      setAreStatsPublished(!!(wordOfTheDay?.id || idiomOfTheDay?.id || quoteOfTheDay?.id));

      Alert.alert('Success', 'Published to Grammarian Summary successfully!');
    } catch (error) {
      console.error('Error publishing all to summary:', error);
      Alert.alert('Error', 'An unexpected error occurred while publishing.');
    } finally {
      setIsPublishingAll(false);
    }
  };

  const handleUnpublishAllToSummary = async () => {
    if (!meetingId || !user?.id) return;
    if (isPublishingAll) return;

    const wId = wordOfTheDay?.id ?? null;
    const iId = idiomOfTheDay?.id ?? null;
    const qId = quoteOfTheDay?.id ?? null;

    setIsPublishingAll(true);
    try {
      const promises: any[] = [];

      // Live observations
      if (wId || iId || qId || hasGoodUsageCaptured) {
        // Publishing/unpublishing toggles the same "summary-ready" flags.
      }
      if (hasGoodUsageCaptured) {
        promises.push(
          supabase
            .from('grammarian_live_good_usage')
            .update({ is_published: false })
            .eq('meeting_id', meetingId)
            .eq('grammarian_id', effectiveGrammarianUserId)
        );
      }

      if (hasImprovementsCaptured) {
        promises.push(
          supabase
            .from('grammarian_live_improvements')
            .update({ is_published: false })
            .eq('meeting_id', meetingId)
            .eq('grammarian_id', effectiveGrammarianUserId)
        );
      }

      // Stats
      if (wId) {
        promises.push(
          supabase
            .from('grammarian_word_of_the_day')
            .update({ is_published: false })
            .eq('id', wId)
        );
      }
      if (iId) {
        promises.push(
          supabase
            .from('grammarian_idiom_of_the_day')
            .update({ is_published: false })
            .eq('id', iId)
        );
      }
      if (qId) {
        promises.push(
          supabase
            .from('grammarian_quote_of_the_day')
            .update({ is_published: false })
            .eq('id', qId)
        );
      }

      const results = await Promise.all(promises);
      if (results.some(r => r.error)) {
        Alert.alert('Error', 'Failed to unpublish. Please try again.');
        return;
      }

      setAreGoodUsagePublished(false);
      setAreImprovementsPublished(false);
      setAreStatsPublished(false);

      // Refresh
      await Promise.all([
        loadLiveObservations(),
        loadUsageStats(),
        loadClubMembers(),
        loadWordOfTheDayData().catch(() => null),
        loadIdiomOfTheDayData().catch(() => null),
        loadQuoteOfTheDayData().catch(() => null),
      ]);

      await loadMemberUsage(wId, iId, qId);

      Alert.alert('Success', 'Unpublished from Grammarian Summary successfully!');
    } catch (error) {
      console.error('Error unpublishing all to summary:', error);
      Alert.alert('Error', 'An unexpected error occurred while unpublishing.');
    } finally {
      setIsPublishingAll(false);
    }
  };

  const confirmPublishAllToSummary = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm('Publish all captured data to Grammarian Summary?');
      if (ok) handlePublishAllToSummary();
      return;
    }

    Alert.alert('Confirm publish', 'Publish all captured data to Grammarian Summary?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Publish', style: 'default', onPress: handlePublishAllToSummary },
    ]);
  };

  const confirmUnpublishAllToSummary = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const ok = window.confirm('Unpublish captured data from Grammarian Summary?');
      if (ok) handleUnpublishAllToSummary();
      return;
    }

    Alert.alert('Confirm unpublish', 'Unpublish captured data from Grammarian Summary?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpublish', style: 'destructive', onPress: handleUnpublishAllToSummary },
    ]);
  };

  const handleUnpublishStats = async () => {
    try {
      const promises = [];

      if (wordOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_word_of_the_day').update({ is_published: false }).eq('id', wordOfTheDay.id)
        );
      }
      if (idiomOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_idiom_of_the_day').update({ is_published: false }).eq('id', idiomOfTheDay.id)
        );
      }
      if (quoteOfTheDay?.id) {
        promises.push(
          supabase.from('grammarian_quote_of_the_day').update({ is_published: false }).eq('id', quoteOfTheDay.id)
        );
      }

      const results = await Promise.all(promises);
      if (results.some(r => r.error)) {
        Alert.alert('Error', 'Failed to unpublish stats');
        return;
      }

      setAreStatsPublished(false);
      Alert.alert('Success', 'Stats unpublished from summary successfully!');
    } catch (error) {
      console.error('Error unpublishing stats:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  if (isLoading) {
    if (variant === 'live-inline') {
      return (
        <View style={styles.inlineLiveSection}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {variant === 'notes' ? 'Loading prep space...' : 'Loading live meeting...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      variant === 'live-inline' ? (
        <View style={styles.inlineLiveSection}>
          <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Meeting not found
          </Text>
        </View>
      ) : (
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
      )
    );
  }

  if ((variant === 'notes' && !isAssignedGrammarian()) || (variant !== 'notes' && !isGrammarianOfDay())) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {variant === 'notes'
              ? 'Personal notes are only accessible to the assigned Grammarian.'
              : 'Live meeting tools are available to the assigned Grammarian or the club VPE.'}
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {variant !== 'live-inline' && (
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {variant === 'notes' ? 'Your Prep Space' : 'Live meeting'}
          </Text>
          <View style={styles.saveButtonPlaceholder} />
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={variant !== 'live-inline'}
      >
        {variant === 'notes' && (
        <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.notesInputSection}>
            <View style={styles.notesInputHeader}>
              <Text style={[styles.notesInputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Your Notes
              </Text>
              <Text style={[styles.wordCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {countWords(notes)} words • {notes.length}/1000 characters
              </Text>
            </View>

            <TextInput
              style={[styles.notesTextInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Write your personal notes here..."
              placeholderTextColor={theme.colors.textSecondary}
              value={notes}
              onChangeText={handleNotesChange}
              multiline
              numberOfLines={15}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          {notesData && (
            <View style={[styles.lastSavedInfo, { backgroundColor: theme.colors.background }]}>
              <Text style={[styles.lastSavedText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Last saved: {new Date(notesData.updated_at).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
        )}


        {(variant === 'live-only' || variant === 'live-inline') && (
          <View style={[styles.liveMeetingContainer, { backgroundColor: theme.colors.background }]}>
            {variant !== 'live-inline' && (
              <View style={styles.liveMeetingTabsContainer}>
                <View style={[styles.segmentControl, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                  <TouchableOpacity
                    style={[
                      styles.segmentTab,
                      liveMeetingSubTab === 'good-usage' && [styles.segmentTabActive, { backgroundColor: '#2563EB' }],
                    ]}
                    onPress={() => setLiveMeetingSubTab('good-usage')}
                  >
                    <CheckCircle2 size={14} color={liveMeetingSubTab === 'good-usage' ? '#ffffff' : theme.colors.textSecondary} />
                    <Text style={[
                      styles.segmentTabText,
                      { color: liveMeetingSubTab === 'good-usage' ? '#ffffff' : theme.colors.textSecondary,
                        fontWeight: liveMeetingSubTab === 'good-usage' ? '700' : '500' }
                    ]} maxFontSizeMultiplier={1.3}>
                      Good Usage
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.segmentDivider, { backgroundColor: '#CBD5E1' }]} />

                  <TouchableOpacity
                    style={[
                      styles.segmentTab,
                      liveMeetingSubTab === 'improvements' && [styles.segmentTabActive, { backgroundColor: '#F59E0B' }],
                    ]}
                    onPress={() => setLiveMeetingSubTab('improvements')}
                  >
                    <AlertTriangle size={14} color={liveMeetingSubTab === 'improvements' ? '#ffffff' : theme.colors.textSecondary} />
                    <Text style={[
                      styles.segmentTabText,
                      { color: liveMeetingSubTab === 'improvements' ? '#ffffff' : theme.colors.textSecondary,
                        fontWeight: liveMeetingSubTab === 'improvements' ? '700' : '500' }
                    ]} maxFontSizeMultiplier={1.3}>
                      Opportunity
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.segmentDivider, { backgroundColor: '#CBD5E1' }]} />

                  <TouchableOpacity
                    style={[
                      styles.segmentTab,
                      liveMeetingSubTab === 'stats' && [styles.segmentTabActive, { backgroundColor: '#6B7280' }],
                    ]}
                    onPress={() => setLiveMeetingSubTab('stats')}
                  >
                    <TrendingUp size={14} color={liveMeetingSubTab === 'stats' ? '#ffffff' : theme.colors.textSecondary} />
                    <Text style={[
                      styles.segmentTabText,
                      { color: liveMeetingSubTab === 'stats' ? '#ffffff' : theme.colors.textSecondary,
                        fontWeight: liveMeetingSubTab === 'stats' ? '700' : '500' }
                    ]} maxFontSizeMultiplier={1.3}>
                      Stats
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {liveMeetingSubTab === 'good-usage' && (
              <>
                {variant === 'live-inline' ? (
                <View style={styles.inlineLiveSection}>
                  {isGrammarianOfDay() && (
                    <View style={styles.inlineInputRow}>
                      <TextInput
                        style={[styles.inlineInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                        placeholder="Add a good usage example..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={goodUsageInput}
                        onChangeText={setGoodUsageInput}
                        multiline
                        maxFontSizeMultiplier={1.3}
                      />
                      <TouchableOpacity
                        style={[styles.inlinePlusButton, { opacity: goodUsageInput.trim() ? 1 : 0.5 }]}
                        onPress={handleAddGoodUsage}
                        disabled={!goodUsageInput.trim()}
                      >
                        <Plus size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.inlineList}>
                    {goodUsageList.length === 0 ? (
                      <View style={styles.inlineEmptyState}>
                        <CheckCircle2 size={22} color={theme.colors.textSecondary} />
                        <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          No items yet
                        </Text>
                      </View>
                    ) : (
                      goodUsageList.map((item, index) => {
                        const formattedDate = (() => {
                          const d = new Date(item.created_at);
                          const day = d.getDate().toString().padStart(2, '0');
                          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          const month = monthNames[d.getMonth()];
                          const year = d.getFullYear();
                          let hours = d.getHours();
                          const minutes = d.getMinutes().toString().padStart(2, '0');
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12 || 12;
                          return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
                        })();

                        return (
                          <View key={item.id} style={styles.inlineRow}>
                            <View style={styles.inlineRowTextCol}>
                              <View style={styles.inlineRowTop}>
                                <Text style={[styles.inlineRowIndex, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  #{index + 1}
                                </Text>
                                <Text style={[styles.inlineRowMainText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {item.observation}
                                </Text>
                              </View>
                              <Text style={[styles.inlineRowSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Good usage example
                              </Text>
                              <Text style={[styles.inlineRowTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                                {formattedDate}
                              </Text>
                            </View>

                            {isGrammarianOfDay() && (
                              <TouchableOpacity
                                style={styles.inlineTrashButton}
                                onPress={() => handleDeleteGoodUsage(item.id)}
                              >
                                <Trash2 size={16} color="#9CA3AF" />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.observationSection}>
                  {isGrammarianOfDay() && (
                    <View style={styles.inputRow}>
                      <View style={[styles.observationInputWrapper, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
                        <Lightbulb size={16} color={theme.colors.textSecondary} />
                        <TextInput
                          style={[styles.observationInputInner, { color: theme.colors.text }]}
                          placeholder="Add good usage example…"
                          placeholderTextColor={theme.colors.textSecondary}
                          value={goodUsageInput}
                          onChangeText={setGoodUsageInput}
                          multiline
                          maxFontSizeMultiplier={1.3}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: '#2563EB', opacity: goodUsageInput.trim() ? 1 : 0.5 }]}
                        onPress={handleAddGoodUsage}
                        disabled={!goodUsageInput.trim()}
                      >
                        <Plus size={16} color="#ffffff" />
                        <Text style={styles.addButtonText} maxFontSizeMultiplier={1.3}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.observationList}>
                    {goodUsageList.length === 0 ? (
                      <View style={styles.emptyState}>
                        <CheckCircle2 size={32} color={theme.colors.textSecondary} />
                        <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          No examples yet.
                        </Text>
                        <Text style={[styles.emptyStateSubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Start adding your first good usage.
                        </Text>
                      </View>
                    ) : (
                      goodUsageList.map((item, index) => {
                        const badgeColors = ['#2563EB', '#059669', '#10B981'];
                        const badgeColor = badgeColors[index % badgeColors.length];
                        const formattedDate = (() => {
                          const d = new Date(item.created_at);
                          const day = d.getDate().toString().padStart(2, '0');
                          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          const month = monthNames[d.getMonth()];
                          const year = d.getFullYear();
                          let hours = d.getHours();
                          const minutes = d.getMinutes().toString().padStart(2, '0');
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          hours = hours % 12 || 12;
                          return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
                        })();
                        return (
                          <View key={item.id} style={[styles.observationCard, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
                            <View style={styles.observationCardHeader}>
                              <View style={[styles.observationBadgeCircle, { backgroundColor: badgeColor }]}>
                                <Text style={styles.observationBadgeText} maxFontSizeMultiplier={1.3}>
                                  #{index + 1}
                                </Text>
                              </View>
                              <Text style={[styles.observationCardWordTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {item.observation}
                              </Text>
                            </View>
                            <View style={styles.observationCategoryRow}>
                              <MinusCircle size={14} color={theme.colors.textSecondary} />
                              <Text style={[styles.observationCategoryLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Good Usage Example
                              </Text>
                            </View>
                            <View style={styles.observationCardFooter}>
                              <View style={styles.observationTimestamp}>
                                <Clock size={14} color={theme.colors.textSecondary} />
                                <Text style={[styles.observationTimestampText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  {formattedDate}
                                </Text>
                              </View>
                              {isGrammarianOfDay() && (
                                <TouchableOpacity
                                  style={styles.deleteButtonNew}
                                  onPress={() => handleDeleteGoodUsage(item.id)}
                                >
                                  <Trash2 size={14} color="#9CA3AF" />
                                  <Text style={[styles.deleteButtonText, { color: '#9CA3AF' }]} maxFontSizeMultiplier={1.3}>Delete</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>

                  {variant !== 'live-inline' && isGrammarianOfDay() && goodUsageList.length > 0 && (
                    <View style={styles.sectionPublishButtonContainer}>
                      {areGoodUsagePublished ? (
                        <TouchableOpacity
                          style={[styles.sectionUnpublishButton, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}
                          onPress={handleUnpublishGoodUsage}
                        >
                          <EyeOff size={18} color="#EF4444" />
                          <Text style={[styles.sectionUnpublishButtonText, { color: '#EF4444' }]} maxFontSizeMultiplier={1.3}>
                            Unpublish
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.sectionPublishButton, { backgroundColor: '#10B981' }]}
                          onPress={handlePublishGoodUsage}
                        >
                          <Eye size={18} color="#ffffff" />
                          <Text style={styles.sectionPublishButtonText} maxFontSizeMultiplier={1.3}>
                            Publish to Summary
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
                )}
              </>
            )}

            {liveMeetingSubTab === 'improvements' && (
              <View style={variant === 'live-inline' ? { padding: 0, gap: 0 } : styles.observationSection}>
                {variant === 'live-inline' && (
                  <View style={styles.inlineLiveSection}>
                    {isGrammarianOfDay() && (
                      <View style={styles.inlineImprovementInputContainer}>
                        <View style={[styles.inlineImprovementFieldCard, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
                          <View style={styles.inlineImprovementFieldHeader}>
                            <View style={[styles.inlineImprovementFieldIcon, { backgroundColor: '#F1F5F9' }]}>
                              <X size={14} color="#DC2626" />
                            </View>
                            <Text style={[styles.inlineImprovementFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              Incorrect
                            </Text>
                          </View>
                          <TextInput
                            style={[styles.inlineImprovementFieldInput, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}
                            placeholder="Enter incorrect usage..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={incorrectUsageInput}
                            onChangeText={setIncorrectUsageInput}
                            multiline
                            maxFontSizeMultiplier={1.3}
                          />
                        </View>

                        <View style={[styles.inlineImprovementFieldCard, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
                          <View style={styles.inlineImprovementFieldHeader}>
                            <View style={[styles.inlineImprovementFieldIcon, { backgroundColor: '#F1F5F9' }]}>
                              <CheckCircle2 size={14} color="#059669" />
                            </View>
                            <Text style={[styles.inlineImprovementFieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              Correct
                            </Text>
                          </View>
                          <TextInput
                            style={[styles.inlineImprovementFieldInput, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}
                            placeholder="Enter correct usage..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={correctUsageInput}
                            onChangeText={setCorrectUsageInput}
                            multiline
                            maxFontSizeMultiplier={1.3}
                          />
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.inlineImprovementSubmitButton,
                            { opacity: (!incorrectUsageInput.trim() || !correctUsageInput.trim()) ? 0.5 : 1 },
                          ]}
                          onPress={handleAddImprovement}
                          disabled={!incorrectUsageInput.trim() || !correctUsageInput.trim()}
                        >
                          <Text style={styles.inlineImprovementSubmitButtonText} maxFontSizeMultiplier={1.3}>
                            Submit
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.inlineList}>
                      {improvementsList.length === 0 ? (
                        <View style={styles.inlineEmptyState}>
                          <AlertTriangle size={28} color={theme.colors.textSecondary} />
                          <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            No opportunities yet.
                          </Text>
                        </View>
                      ) : (
                        improvementsList.map((item, index) => {
                          const formattedDate = (() => {
                            const d = new Date(item.created_at);
                            const day = d.getDate().toString().padStart(2, '0');
                            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            const month = monthNames[d.getMonth()];
                            const year = d.getFullYear();
                            let hours = d.getHours();
                            const minutes = d.getMinutes().toString().padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12 || 12;
                            return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
                          })();

                          return (
                            <View key={item.id} style={styles.inlineRow}>
                              <View style={styles.inlineRowTextCol}>
                                <View style={styles.inlineRowTop}>
                                  <Text style={[styles.inlineRowIndex, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    #{index + 1}
                                  </Text>
                                </View>
                                <Text style={[styles.inlineRowMainText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {item.incorrect_usage}
                                </Text>
                                <Text style={[styles.inlineRowSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  {item.correct_usage ? `Correct: ${item.correct_usage}` : 'Correct: —'}
                                </Text>
                                <Text style={[styles.inlineRowTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                                  {formattedDate}
                                </Text>
                              </View>

                              {isGrammarianOfDay() && (
                                <TouchableOpacity
                                  style={styles.inlineTrashButton}
                                  onPress={() => handleDeleteImprovement(item.id)}
                                >
                                  <Trash2 size={16} color="#9CA3AF" />
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })
                      )}
                    </View>

                    {variant !== 'live-inline' && isGrammarianOfDay() && improvementsList.length > 0 && (
                      <View style={styles.sectionPublishButtonContainer}>
                        {areImprovementsPublished ? (
                          <TouchableOpacity
                            style={[styles.sectionUnpublishButton, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}
                            onPress={handleUnpublishImprovements}
                          >
                            <EyeOff size={18} color="#EF4444" />
                            <Text style={[styles.sectionUnpublishButtonText, { color: '#EF4444' }]} maxFontSizeMultiplier={1.3}>
                              Unpublish
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.sectionPublishButton, { backgroundColor: '#10B981' }]}
                            onPress={handlePublishImprovements}
                          >
                            <Eye size={18} color="#ffffff" />
                            <Text style={styles.sectionPublishButtonText} maxFontSizeMultiplier={1.3}>
                              Publish to Summary
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {variant !== 'live-inline' && (
                  <>
                {isGrammarianOfDay() && (
                  <View style={styles.improvementInputContainer}>
                    <Text style={[styles.improvementSectionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Opportunity
                    </Text>

                    <View style={[styles.improvementFieldCard, { backgroundColor: '#FFF5F5', borderColor: '#FCA5A5' }]}>
                      <View style={styles.improvementFieldHeader}>
                        <View style={[styles.improvementFieldIcon, { backgroundColor: '#FEE2E2' }]}>
                          <X size={14} color="#DC2626" />
                        </View>
                        <Text style={[styles.improvementFieldLabel, { color: '#DC2626' }]} maxFontSizeMultiplier={1.3}>
                          Incorrect Usage
                        </Text>
                      </View>
                      <TextInput
                        style={[styles.improvementFieldInput, { color: theme.colors.text, backgroundColor: '#ffffff', borderColor: '#FEE2E2' }]}
                        placeholder="Enter an incorrect usage example..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={incorrectUsageInput}
                        onChangeText={setIncorrectUsageInput}
                        multiline
                        maxFontSizeMultiplier={1.3}
                      />
                    </View>

                    <View style={[styles.improvementFieldCard, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}>
                      <View style={styles.improvementFieldHeader}>
                        <View style={[styles.improvementFieldIcon, { backgroundColor: '#D1FAE5' }]}>
                          <CheckCircle2 size={14} color="#059669" />
                        </View>
                        <Text style={[styles.improvementFieldLabel, { color: '#059669' }]} maxFontSizeMultiplier={1.3}>
                          Correct Usage
                        </Text>
                      </View>
                      <TextInput
                        style={[styles.improvementFieldInput, { color: theme.colors.text, backgroundColor: '#ffffff', borderColor: '#D1FAE5' }]}
                        placeholder="Enter the correct usage example..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={correctUsageInput}
                        onChangeText={setCorrectUsageInput}
                        multiline
                        maxFontSizeMultiplier={1.3}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.addImprovementButton, { backgroundColor: '#2563EB', opacity: (!incorrectUsageInput.trim() || !correctUsageInput.trim()) ? 0.5 : 1 }]}
                      onPress={handleAddImprovement}
                      disabled={!incorrectUsageInput.trim() || !correctUsageInput.trim()}
                    >
                      <Text style={styles.addImprovementButtonText} maxFontSizeMultiplier={1.3}>Submit</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.observationList}>
                  {improvementsList.length === 0 ? (
                    <View style={styles.emptyState}>
                      <AlertTriangle size={32} color={theme.colors.textSecondary} />
                      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No opportunities yet.
                      </Text>
                      <Text style={[styles.emptyStateSubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Start adding opportunities.
                      </Text>
                    </View>
                  ) : (
                    improvementsList.map((item, index) => {
                      const badgeColors = ['#F59E0B', '#059669', '#2563EB'];
                      const badgeColor = badgeColors[index % badgeColors.length];
                      const formattedDate = (() => {
                        const d = new Date(item.created_at);
                        const day = d.getDate().toString().padStart(2, '0');
                        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        const month = monthNames[d.getMonth()];
                        const year = d.getFullYear();
                        let hours = d.getHours();
                        const minutes = d.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12 || 12;
                        return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
                      })();
                      return (
                        <View key={item.id} style={[styles.improvementCard, { backgroundColor: '#ffffff', borderColor: '#E5E7EB' }]}>
                          <View style={styles.observationCardHeader}>
                            <View style={[styles.observationBadgeCircle, { backgroundColor: badgeColor }]}>
                              <Text style={styles.observationBadgeText} maxFontSizeMultiplier={1.3}>
                                #{index + 1}
                              </Text>
                            </View>
                            <Text style={[styles.observationCardWordTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              Opportunity
                            </Text>
                          </View>

                          <View style={[styles.incorrectSection, { backgroundColor: '#FEE2E2' }]}>
                            <View style={styles.sectionHeader}>
                              <X size={14} color="#DC2626" />
                              <Text style={[styles.sectionTitle, { color: '#DC2626' }]} maxFontSizeMultiplier={1.3}>
                                Incorrect:
                              </Text>
                            </View>
                            <Text style={[styles.sectionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.incorrect_usage}
                            </Text>
                          </View>

                          <View style={[styles.correctSection, { backgroundColor: '#D1FAE5' }]}>
                            <View style={styles.sectionHeader}>
                              <CheckCircle2 size={14} color="#059669" />
                              <Text style={[styles.sectionTitle, { color: '#059669' }]} maxFontSizeMultiplier={1.3}>
                                Correct:
                              </Text>
                            </View>
                            <Text style={[styles.sectionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.correct_usage}
                            </Text>
                          </View>

                          <View style={styles.observationCardFooter}>
                            <View style={styles.observationTimestamp}>
                              <Clock size={14} color={theme.colors.textSecondary} />
                              <Text style={[styles.observationTimestampText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                {formattedDate}
                              </Text>
                            </View>
                            {isGrammarianOfDay() && (
                              <TouchableOpacity
                                style={styles.deleteButtonNew}
                                onPress={() => handleDeleteImprovement(item.id)}
                              >
                                <Trash2 size={14} color="#9CA3AF" />
                                <Text style={[styles.deleteButtonText, { color: '#9CA3AF' }]} maxFontSizeMultiplier={1.3}>Delete</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                {isGrammarianOfDay() && improvementsList.length > 0 && (
                  <View style={styles.sectionPublishButtonContainer}>
                    {areImprovementsPublished ? (
                      <TouchableOpacity
                        style={[styles.sectionUnpublishButton, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}
                        onPress={handleUnpublishImprovements}
                      >
                        <EyeOff size={18} color="#EF4444" />
                        <Text style={[styles.sectionUnpublishButtonText, { color: '#EF4444' }]} maxFontSizeMultiplier={1.3}>
                          Unpublish
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.sectionPublishButton, { backgroundColor: '#10B981' }]}
                        onPress={handlePublishImprovements}
                      >
                        <Eye size={18} color="#ffffff" />
                        <Text style={styles.sectionPublishButtonText} maxFontSizeMultiplier={1.3}>
                          Publish to Summary
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                  </>
                )}
              </View>
            )}

            {liveMeetingSubTab === 'stats' && (
              <View style={variant === 'live-inline' ? { padding: 0, gap: 0 } : styles.observationSection}>
                {variant === 'live-inline' && (
                  <View style={styles.inlineLiveSection}>
                    {wordOfTheDay ? (
                      <View style={styles.inlineStatsSection}>
                        <Text style={[styles.inlineStatsWordLine, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Word of the day: {wordOfTheDay.word}
                        </Text>

                        <View style={styles.inlineList}>
                          {wordMemberUsage.length === 0 ? (
                            <View style={styles.inlineEmptyState}>
                              <TrendingUp size={26} color={theme.colors.textSecondary} />
                              <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                No member added yet.
                              </Text>
                              <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                                Add a member to start tracking usage.
                              </Text>
                            </View>
                          ) : (
                            wordMemberUsage.map((usage) => (
                              <View key={usage.id} style={styles.inlineRow}>
                                <View style={styles.inlineRowTextCol}>
                                  <Text style={[styles.inlineRowMainText, { fontSize: 12 }]} maxFontSizeMultiplier={1.3}>
                                    {usage.member_profile?.full_name || usage.member_name_manual || 'Unknown'}
                                  </Text>
                                </View>

                                {isGrammarianOfDay() ? (
                                  <View style={styles.memberInlineCounter}>
                                    <TouchableOpacity
                                      style={[styles.inlineCounterBtn, { opacity: usage.usage_count === 0 ? 0.4 : 1 }]}
                                      onPress={() => updateMemberUsageCount(usage.id, 'word', false)}
                                      disabled={usage.usage_count === 0 || !isGrammarianOfDay()}
                                    >
                                      <Minus size={13} color="#374151" />
                                    </TouchableOpacity>

                                    <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                      <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                        {usage.usage_count}
                                      </Text>
                                      <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                        {' '}times
                                      </Text>
                                    </View>

                                    <TouchableOpacity
                                      style={[styles.inlineCounterBtn, { backgroundColor: '#2563EB' }]}
                                      onPress={() => updateMemberUsageCount(usage.id, 'word', true)}
                                    >
                                      <Plus size={13} color="#ffffff" />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                      style={styles.removeMemberBtn}
                                      onPress={() => removeMember(usage.id, 'word')}
                                    >
                                      <X size={14} color="#9CA3AF" />
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                    <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                      {usage.usage_count}
                                    </Text>
                                    <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                      {' '}times
                                    </Text>
                                  </View>
                                )}
                              </View>
                            ))
                          )}
                        </View>

                        {isGrammarianOfDay() && (
                          <TouchableOpacity
                            style={[
                              styles.addMemberButton,
                              { backgroundColor: 'transparent', borderColor: '#3B82F6', paddingVertical: 12 },
                            ]}
                            onPress={() => setShowMemberPicker('word')}
                          >
                            <Plus size={16} color="#3B82F6" />
                            <Text style={[styles.addMemberText, { color: '#3B82F6' }]} maxFontSizeMultiplier={1.3}>
                              Add Member
                            </Text>
                          </TouchableOpacity>
                        )}

                        {isGrammarianOfDay() &&
                          (hasGoodUsageCaptured || hasImprovementsCaptured || hasStatsCaptured) && (
                            <View style={styles.sectionPublishButtonContainer}>
                              <TouchableOpacity
                                style={[
                                  styles.sectionPublishButton,
                                  {
                                    backgroundColor: isAllPublishedToSummary ? '#EF4444' : '#4169E1',
                                    borderRadius: 14,
                                    opacity: isPublishingAll ? 0.7 : 1,
                                  },
                                ]}
                                onPress={() => {
                                  if (isAllPublishedToSummary) confirmUnpublishAllToSummary();
                                  else confirmPublishAllToSummary();
                                }}
                                disabled={isPublishingAll}
                              >
                                {isPublishingAll ? (
                                  <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                  <Eye size={18} color="#ffffff" />
                                )}
                                <Text style={styles.sectionPublishButtonText} maxFontSizeMultiplier={1.3}>
                                  {isAllPublishedToSummary
                                    ? 'Unpublish from Grammarian Summary'
                                    : 'Publish All to Grammarian Summary'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                      </View>
                    ) : (
                      <View style={styles.inlineEmptyState}>
                        <TrendingUp size={28} color={theme.colors.textSecondary} />
                        <Text style={[styles.inlineEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          No usage recorded yet.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {variant !== 'live-inline' && (
                  <>
                <View style={styles.statsPageHeader}>
                  <View style={styles.statsPageHeaderRow}>
                    <BarChart2 size={22} color="#F59E0B" />
                    <Text style={[styles.statsPageTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Meeting Usage Stats
                    </Text>
                  </View>
                  <Text style={[styles.statsPageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Track word and language usage during the meeting
                  </Text>
                </View>

                {wordOfTheDay && (
                  <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.statCardHeader}>
                      <BookOpen size={20} color="#2563EB" />
                      <Text style={[styles.statCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Word of the Day
                      </Text>
                    </View>
                    <Text style={[styles.statCardContent, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {wordOfTheDay.word}
                    </Text>

                    <View style={[styles.memberUsageBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.memberUsageBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Member Usage
                      </Text>

                      {wordMemberUsage.map(usage => (
                        <View key={usage.id} style={[styles.memberUsageRow, { borderBottomColor: theme.colors.border }]}>
                          <View style={styles.memberInfo}>
                            <User size={15} color={theme.colors.textSecondary} />
                            <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {usage.member_profile?.full_name || usage.member_name_manual || 'Unknown'}
                            </Text>
                          </View>
                          <View style={styles.memberRowRight}>
                            {isGrammarianOfDay() ? (
                              <View style={styles.memberInlineCounter}>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { opacity: usage.usage_count === 0 ? 0.4 : 1 }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'word', false)}
                                  disabled={usage.usage_count === 0 || !isGrammarianOfDay()}
                                >
                                  <Minus size={13} color="#374151" />
                                </TouchableOpacity>
                                <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                  <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                    {usage.usage_count}
                                  </Text>
                                  <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    {' '}times
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { backgroundColor: '#2563EB' }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'word', true)}
                                >
                                  <Plus size={13} color="#ffffff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.removeMemberBtn}
                                  onPress={() => removeMember(usage.id, 'word')}
                                >
                                  <X size={14} color="#9CA3AF" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {usage.usage_count}
                                </Text>
                                <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  {' '}times
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}

                      <View style={[styles.totalUsageRow, { borderTopColor: theme.colors.border }]}>
                        <Text style={[styles.totalUsageLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Total Usage
                        </Text>
                        <View style={[styles.totalUsageBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.totalUsageBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {wordMemberUsage.reduce((sum, u) => sum + u.usage_count, 0)}
                          </Text>
                          <Text style={[styles.totalUsageBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {' '}times
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isGrammarianOfDay() && (
                      <TouchableOpacity
                        style={[styles.addMemberButton, { backgroundColor: 'transparent', borderColor: '#3B82F6' }]}
                        onPress={() => setShowMemberPicker('word')}
                      >
                        <Plus size={16} color="#3B82F6" />
                        <Text style={[styles.addMemberText, { color: '#3B82F6' }]} maxFontSizeMultiplier={1.3}>
                          Add Member
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {quoteOfTheDay && (
                  <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.statCardHeader}>
                      <MessageSquareQuote size={20} color="#10B981" />
                      <Text style={[styles.statCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Quote of the Day
                      </Text>
                    </View>
                    <Text style={[styles.statCardContent, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {quoteOfTheDay.quote}
                    </Text>

                    <View style={[styles.memberUsageBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.memberUsageBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Member Usage
                      </Text>

                      {quoteMemberUsage.map(usage => (
                        <View key={usage.id} style={[styles.memberUsageRow, { borderBottomColor: theme.colors.border }]}>
                          <View style={styles.memberInfo}>
                            <User size={15} color={theme.colors.textSecondary} />
                            <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {usage.member_profile?.full_name || usage.member_name_manual || 'Unknown'}
                            </Text>
                          </View>
                          <View style={styles.memberRowRight}>
                            {isGrammarianOfDay() ? (
                              <View style={styles.memberInlineCounter}>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { opacity: usage.usage_count === 0 ? 0.4 : 1 }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'quote', false)}
                                  disabled={usage.usage_count === 0 || !isGrammarianOfDay()}
                                >
                                  <Minus size={13} color="#374151" />
                                </TouchableOpacity>
                                <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                  <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                    {usage.usage_count}
                                  </Text>
                                  <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    {' '}times
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { backgroundColor: '#10B981' }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'quote', true)}
                                >
                                  <Plus size={13} color="#ffffff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.removeMemberBtn}
                                  onPress={() => removeMember(usage.id, 'quote')}
                                >
                                  <X size={14} color="#9CA3AF" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {usage.usage_count}
                                </Text>
                                <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  {' '}times
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}

                      <View style={[styles.totalUsageRow, { borderTopColor: theme.colors.border }]}>
                        <Text style={[styles.totalUsageLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Total Usage
                        </Text>
                        <View style={[styles.totalUsageBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.totalUsageBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {quoteMemberUsage.reduce((sum, u) => sum + u.usage_count, 0)}
                          </Text>
                          <Text style={[styles.totalUsageBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {' '}times
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isGrammarianOfDay() && (
                      <TouchableOpacity
                        style={[styles.addMemberButton, { backgroundColor: 'transparent', borderColor: '#3B82F6' }]}
                        onPress={() => setShowMemberPicker('quote')}
                      >
                        <Plus size={16} color="#3B82F6" />
                        <Text style={[styles.addMemberText, { color: '#3B82F6' }]} maxFontSizeMultiplier={1.3}>
                          Add Member
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {idiomOfTheDay && (
                  <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <View style={styles.statCardHeader}>
                      <Lightbulb size={20} color="#F59E0B" />
                      <Text style={[styles.statCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Idiom of the Day
                      </Text>
                    </View>
                    <Text style={[styles.statCardContent, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {idiomOfTheDay.idiom}
                    </Text>

                    <View style={[styles.memberUsageBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                      <Text style={[styles.memberUsageBoxTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Member Usage
                      </Text>

                      {idiomMemberUsage.map(usage => (
                        <View key={usage.id} style={[styles.memberUsageRow, { borderBottomColor: theme.colors.border }]}>
                          <View style={styles.memberInfo}>
                            <User size={15} color={theme.colors.textSecondary} />
                            <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {usage.member_profile?.full_name || usage.member_name_manual || 'Unknown'}
                            </Text>
                          </View>
                          <View style={styles.memberRowRight}>
                            {isGrammarianOfDay() ? (
                              <View style={styles.memberInlineCounter}>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { opacity: usage.usage_count === 0 ? 0.4 : 1 }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'idiom', false)}
                                  disabled={usage.usage_count === 0 || !isGrammarianOfDay()}
                                >
                                  <Minus size={13} color="#374151" />
                                </TouchableOpacity>
                                <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                  <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                    {usage.usage_count}
                                  </Text>
                                  <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    {' '}times
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  style={[styles.inlineCounterBtn, { backgroundColor: '#F59E0B' }]}
                                  onPress={() => updateMemberUsageCount(usage.id, 'idiom', true)}
                                >
                                  <Plus size={13} color="#ffffff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.removeMemberBtn}
                                  onPress={() => removeMember(usage.id, 'idiom')}
                                >
                                  <X size={14} color="#9CA3AF" />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View style={[styles.countBadge, { backgroundColor: '#F1F5F9' }]}>
                                <Text style={[styles.countBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                  {usage.usage_count}
                                </Text>
                                <Text style={[styles.countBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  {' '}times
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}

                      <View style={[styles.totalUsageRow, { borderTopColor: theme.colors.border }]}>
                        <Text style={[styles.totalUsageLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Total Usage
                        </Text>
                        <View style={[styles.totalUsageBadge, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.totalUsageBadgeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {idiomMemberUsage.reduce((sum, u) => sum + u.usage_count, 0)}
                          </Text>
                          <Text style={[styles.totalUsageBadgeUnit, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {' '}times
                          </Text>
                        </View>
                      </View>
                    </View>

                    {isGrammarianOfDay() && (
                      <TouchableOpacity
                        style={[styles.addMemberButton, { backgroundColor: 'transparent', borderColor: '#3B82F6' }]}
                        onPress={() => setShowMemberPicker('idiom')}
                      >
                        <Plus size={16} color="#3B82F6" />
                        <Text style={[styles.addMemberText, { color: '#3B82F6' }]} maxFontSizeMultiplier={1.3}>
                          Add Member
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {!wordOfTheDay && !idiomOfTheDay && !quoteOfTheDay && (
                  <View style={styles.emptyState}>
                    <TrendingUp size={36} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No usage recorded yet.
                    </Text>
                    <Text style={[styles.emptyStateSubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Start tracking usage during the meeting.
                    </Text>
                  </View>
                )}

                {/* end of non-inline stats UI */}
                </>)} 

                {variant !== 'live-inline' && isGrammarianOfDay() && (wordOfTheDay || idiomOfTheDay || quoteOfTheDay) && (
                  <View style={styles.sectionPublishButtonContainer}>
                    {areStatsPublished ? (
                      <TouchableOpacity
                        style={[styles.sectionUnpublishButton, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}
                        onPress={handleUnpublishStats}
                      >
                        <EyeOff size={18} color="#EF4444" />
                        <Text style={[styles.sectionUnpublishButtonText, { color: '#EF4444' }]} maxFontSizeMultiplier={1.3}>
                          Unpublish
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.sectionPublishButton, { backgroundColor: '#10B981' }]}
                        onPress={handlePublishStats}
                      >
                        <Eye size={18} color="#ffffff" />
                        <Text style={styles.sectionPublishButtonText} maxFontSizeMultiplier={1.3}>
                          Publish to Summary
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* common publish button rendered at top of inline stats */}

              </View>
            )}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {(variant === 'live-only' || variant === 'live-inline') && (
      <Modal
        visible={!!showMemberPicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowMemberPicker(null); setManualMemberName(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Add Member
              </Text>
              <TouchableOpacity onPress={() => { setShowMemberPicker(null); setManualMemberName(''); }}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.manualEntryRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
              <TextInput
                style={[styles.manualEntryInput, { color: theme.colors.text }]}
                placeholder="Type a name manually..."
                placeholderTextColor={theme.colors.textSecondary}
                value={manualMemberName}
                onChangeText={setManualMemberName}
                maxFontSizeMultiplier={1.3}
                returnKeyType="done"
                onSubmitEditing={handleAddManualMember}
              />
              <TouchableOpacity
                style={[styles.manualEntryAddBtn, { backgroundColor: manualMemberName.trim() ? '#2563EB' : theme.colors.border }]}
                onPress={handleAddManualMember}
                disabled={!manualMemberName.trim()}
              >
                <Plus size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {clubMembers.filter(member => {
              const usageList = showMemberPicker === 'word'
                ? wordMemberUsage
                : showMemberPicker === 'idiom'
                ? idiomMemberUsage
                : quoteMemberUsage;
              return !usageList.some(u => u.member_user_id === member.id);
            }).length > 0 && (
              <Text style={[styles.memberListDivider, { color: theme.colors.textSecondary, borderColor: theme.colors.border }]} maxFontSizeMultiplier={1.3}>
                Or select a member
              </Text>
            )}

            <ScrollView style={styles.memberList} keyboardShouldPersistTaps="handled">
              {clubMembers
                .filter(member => {
                  const usageList = showMemberPicker === 'word'
                    ? wordMemberUsage
                    : showMemberPicker === 'idiom'
                    ? idiomMemberUsage
                    : quoteMemberUsage;
                  return !usageList.some(u => u.member_user_id === member.id);
                })
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.memberListItem, { borderBottomColor: theme.colors.border, borderColor: theme.colors.border }]}
                    onPress={() => {
                      if (showMemberPicker) {
                        handleAddMember(member.id, showMemberPicker);
                      }
                    }}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: '#0ea5e9' }]}>
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.memberAvatarImage} />
                      ) : (
                        <Text style={styles.memberAvatarInitials} maxFontSizeMultiplier={1.3}>
                          {member.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.memberListName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      )}
    </SafeAreaView>
  );
}

export default function GrammarianNotes() {
  return <GrammarianNotesScreen variant="notes" />;
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveButtonPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  notesSection: {
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
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  notesIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  notesTitleContainer: {
    flex: 1,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  notesSubtitle: {
    fontSize: 8,
    lineHeight: 11,
  },
  notesInputSection: {
    marginBottom: 20,
  },
  notesInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notesInputLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  wordCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 12,
    minHeight: 300,
    lineHeight: 18,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  notesHint: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  unsavedChangesNotice: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  unsavedChangesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  lastSavedInfo: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  lastSavedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  liveMeetingContainer: {
    flex: 1,
  },
  liveMeetingTabsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 1,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 50,
    gap: 5,
  },
  segmentTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentDivider: {
    width: 1,
    height: 18,
    opacity: 0.5,
  },
  segmentTabText: {
    fontSize: 11,
  },
  liveMeetingTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  liveMeetingActiveTab: {
    borderWidth: 1,
  },
  liveMeetingTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Inline Live meeting design (variant="live-inline") — closer to the web design screenshot
  inlineLiveSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inlineInput: {
    flex: 1,
    minHeight: 20,
    maxHeight: 80,
    padding: 0,
    borderWidth: 0,
    fontSize: 13,
  },
  inlinePlusButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  inlineList: {
    gap: 10,
  },
  inlineEmptyState: {
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inlineEmptyText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  inlineRowTextCol: {
    flex: 1,
  },
  inlineRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  inlineRowIndex: {
    fontSize: 11,
    fontWeight: '600',
  },
  inlineRowMainText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineRowSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  inlineRowTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  inlineTrashButton: {
    paddingTop: 2,
    paddingHorizontal: 8,
  },
  inlineImprovementInputContainer: {
    gap: 12,
  },
  inlineImprovementFieldCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  inlineImprovementFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  inlineImprovementFieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineImprovementFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineImprovementFieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
    color: '#111827',
  },
  inlineImprovementSubmitButton: {
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  inlineImprovementSubmitButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  inlineStatsSection: {
    gap: 10,
    marginBottom: 14,
  },
  inlineStatsTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  inlineStatsWordLine: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  inlineStatsSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  observationSection: {
    padding: 16,
    gap: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  observationInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 56,
    maxHeight: 120,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  observationList: {
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  observationCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  observationCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  observationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  observationBadgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  observationBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  observationCardWordTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  observationCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  observationCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 2,
  },
  observationCategoryLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  observationCardText: {
    fontSize: 15,
    lineHeight: 22,
  },
  observationCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  observationTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  observationTimestampText: {
    fontSize: 13,
  },
  observationInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  observationInputInner: {
    flex: 1,
    fontSize: 15,
    minHeight: 20,
  },
  emptyStateSubText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  deleteButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  improvementInputContainer: {
    gap: 12,
  },
  improvementSectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  improvementFieldCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  improvementFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  improvementFieldIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  improvementFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  improvementFieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
    maxHeight: 100,
  },
  improvementInputLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  improvementTextInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 56,
    maxHeight: 100,
  },
  addImprovementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  addImprovementButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  improvementCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  incorrectSection: {
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  correctSection: {
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bottomPadding: {
    height: 40,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginRight: 4,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  disabledTab: {
    opacity: 0.6,
  },
  comingSoonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wordInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 12,
    marginBottom: 20,
  },
  publishSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publishInfo: {
    flex: 1,
    marginRight: 12,
  },
  publishLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  publishDescription: {
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
    color: '#ffffff',
  },
  comingSoonContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  comingSoonIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  comingSoonBadgeLarge: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  comingSoonBadgeLargeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  statsHeader: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  statCardContent: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  statCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  statsPageHeader: {
    gap: 4,
    marginBottom: 4,
  },
  statsPageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsPageTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statsPageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonMinus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  counterButtonPlus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 36,
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  usedBySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 8,
  },
  memberUsageBox: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  memberUsageBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  memberUsageSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  usedByHeader: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  memberRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInlineCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineCounterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    minWidth: 72,
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countBadgeUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
  totalUsageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  totalUsageLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  totalUsageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  totalUsageBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalUsageBadgeUnit: {
    fontSize: 13,
    fontWeight: '400',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberCounterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberCounterMinus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberCounterPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCounterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCounterValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center',
  },
  removeMemberButton: {
    padding: 4,
    marginLeft: 2,
  },
  removeMemberBtn: {
    padding: 4,
    marginLeft: 2,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 4,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  manualEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  manualEntryInput: {
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualEntryAddBtn: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
  },
  memberListDivider: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  memberList: {
    maxHeight: 400,
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarInitials: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  memberListName: {
    fontSize: 16,
    fontWeight: '500',
  },
  publishButtonContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  publishObservationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
  },
  publishObservationsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  unpublishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  unpublishButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionPublishButtonContainer: {
    padding: 16,
    marginTop: 8,
  },
  sectionPublishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
  },
  sectionPublishButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  sectionUnpublishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  sectionUnpublishButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsPublishRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statsPublishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statsPublishBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  statsPublishBtnInactive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  statsUnpublishBtnActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statsUnpublishBtnInactive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  statsPublishBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

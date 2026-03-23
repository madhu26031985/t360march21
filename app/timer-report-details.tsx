import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Timer, Calendar, User, ChevronDown, Save, Trash2, X, FileText, Search, Lock, MessageCircle, Snowflake, Mic, MessageSquare, Lightbulb, NotebookPen, Plus, Bell, Users, BookOpen, Star, CheckSquare, ClipboardCheck, FileBarChart, Clock, Info, HelpCircle, Upload } from 'lucide-react-native';
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface AssignedTimer {
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

interface TimerReport {
  id?: string;
  meeting_id: string;
  club_id: string;
  speaker_name: string;
  speaker_user_id: string | null;
  speech_category: string;
  actual_time_seconds: number;
  actual_time_display: string;
  time_qualification: boolean | null;
  target_min_seconds: number | null;
  target_max_seconds: number | null;
  notes: string | null;
  recorded_by: string;
  recorded_at?: string;
}

export default function TimerReportDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [assignedTimer, setAssignedTimer] = useState<AssignedTimer | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<ClubMember | null>(null);
  const [showSpeakerModal, setShowSpeakerModal] = useState(false);
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState('');
  const [manualNameEntry, setManualNameEntry] = useState(false);
  const [manualNameText, setManualNameText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [reportData, setReportData] = useState<TimerReport>({
    meeting_id: meetingId || '',
    club_id: user?.currentClubId || '',
    speaker_name: '',
    speaker_user_id: null,
    speech_category: 'prepared_speaker',
    actual_time_seconds: 0,
    actual_time_display: '00:00',
    time_qualification: null,
    target_min_seconds: null,
    target_max_seconds: null,
    notes: null,
    recorded_by: user?.id || '',
  });
  
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [showSecondsModal, setShowSecondsModal] = useState(false);
  const [showQualifiedModal, setShowQualifiedModal] = useState(false);
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; speakerName: string } | null>(null);
  const [showNameRequiredModal, setShowNameRequiredModal] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'record' | 'reports'>('record');
  const [savedReports, setSavedReports] = useState<TimerReport[]>([]);
  const [deletingReports, setDeletingReports] = useState<Set<string>>(new Set());
  const [bookedSpeakers, setBookedSpeakers] = useState<ClubMember[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchInterval, setStopwatchInterval] = useState<NodeJS.Timeout | null>(null);

  const speechCategories = [
    { value: 'prepared_speaker', label: 'Speeches', color: '#3b82f6', icon: 'message-circle', classifications: ['Prepared Speaker'], roleNames: ['Prepared Speaker 1', 'Prepared Speaker 2', 'Prepared Speaker 3', 'Prepared Speaker 4', 'Prepared Speaker 5'] },
    { value: 'table_topic_speaker', label: 'Table Topics', color: '#f97316', icon: 'mic', classifications: ['On-the-Spot Speaking'], roleNames: ['Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3', 'Table Topics Speaker 4', 'Table Topics Speaker 5', 'Table Topics Speaker 6', 'Table Topics Speaker 7', 'Table Topics Speaker 8', 'Table Topics Speaker 9', 'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'] },
    { value: 'evaluation', label: 'Evaluators', color: '#10b981', icon: 'message-square', classifications: ['Speech evaluvator', 'Master evaluvator', 'TT _ Evaluvator'], roleNames: ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5', 'Master Evaluator 1', 'Master Evaluator 2', 'Master Evaluator 3', 'Table Topic Evaluator 1', 'Table Topic Evaluator 2', 'Table Topic Evaluator 3'] },
    { value: 'educational_session', label: 'Education', color: '#8b5cf6', icon: 'lightbulb', classifications: ['Educational speaker'], roleNames: ['Educational Speaker'] },
  ];

  const qualificationOptions = [
    { value: true, label: 'Yes', color: '#10b981' },
    { value: false, label: 'No', color: '#64748b' },
  ];

  // Generate arrays for dropdowns
  const minuteOptions = Array.from({ length: 61 }, (_, i) => i);
  const secondOptions = Array.from({ length: 60 }, (_, i) => i);
  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  useEffect(() => {
    if (assignedTimer && user && assignedTimer.id === user.id) {
      setShowHowToModal(true);
    }
  }, [assignedTimer, user]);

  useEffect(() => {
    if (selectedSpeaker) {
      loadSpeakerReport();
    }
  }, [selectedSpeaker]);

  useEffect(() => {
    // Update actual_time_seconds and display when minutes/seconds change
    const totalSeconds = minutes * 60 + seconds;
    setReportData(prev => ({
      ...prev,
      actual_time_seconds: totalSeconds,
      actual_time_display: formatTime(totalSeconds)
    }));
  }, [minutes, seconds]);

  useEffect(() => {
    if (stopwatchRunning) {
      const interval = setInterval(() => {
        setStopwatchTime(prev => prev + 1000);
      }, 1000);
      setStopwatchInterval(interval);
      return () => clearInterval(interval);
    } else if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  }, [stopwatchRunning]);

  const startStopwatch = () => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can use the stopwatch controls.`);
      return;
    }
    setStopwatchRunning(true);
  };

  const pauseStopwatch = () => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can use the stopwatch controls.`);
      return;
    }
    setStopwatchRunning(false);
  };

  const stopStopwatch = () => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can use the stopwatch controls.`);
      return;
    }
    setStopwatchRunning(false);
  };

  const resetStopwatch = () => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can use the stopwatch controls.`);
      return;
    }
    setStopwatchRunning(false);
    setStopwatchTime(0);
  };

  const formatStopwatchTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadClubMembers(),
        loadAssignedTimer(),
        loadSavedReports(),
        loadBookedSpeakersForCategory(reportData.speech_category)
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load meeting data');
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

  const loadClubMembers = async () => {
    if (!user?.currentClubId || !meetingId) return;

    try {
      // First, load all club members
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

      const allMembers = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        avatar_url: (item as any).app_user_profiles.avatar_url,
      }));

      // Then, load the timer's selected members for this meeting
      const { data: selectedData, error: selectedError } = await supabase
        .from('app_timer_selected_members')
        .select('selected_member_id')
        .eq('meeting_id', meetingId)
        .eq('timer_user_id', user.id);

      if (selectedError) {
        console.error('Error loading selected members:', selectedError);
      }

      // Filter members based on selection
      let membersToShow = allMembers;
      if (selectedData && selectedData.length > 0) {
        const selectedMemberIds = new Set(selectedData.map((item: any) => item.selected_member_id));
        membersToShow = allMembers.filter(member => selectedMemberIds.has(member.id));
      }

      // Sort members alphabetically by full_name
      membersToShow.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setClubMembers(membersToShow);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const loadAssignedTimer = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      // Find the Timer role assignment for this meeting
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
        .eq('role_name', 'Timer')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('Error loading assigned Timer:', error);
        return;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        setAssignedTimer({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading assigned Timer:', error);
    }
  };

  const loadBookedSpeakersForCategory = async (category: string) => {
    if (!meetingId) return;

    const selectedCategory = speechCategories.find(c => c.value === category);
    if (!selectedCategory) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          role_name,
          assigned_user_id,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .in('role_name', selectedCategory.roleNames)
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null);

      if (error) {
        console.error('Error loading booked speakers:', error);
        return;
      }

      const speakers = (data || [])
        .filter(item => (item as any).app_user_profiles)
        .map(item => ({
          id: (item as any).app_user_profiles.id,
          full_name: (item as any).app_user_profiles.full_name,
          email: (item as any).app_user_profiles.email,
          avatar_url: (item as any).app_user_profiles.avatar_url,
        }));

      // Remove duplicates based on user id
      const uniqueSpeakers = Array.from(
        new Map(speakers.map(speaker => [speaker.id, speaker])).values()
      );

      // Sort alphabetically
      uniqueSpeakers.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setBookedSpeakers(uniqueSpeakers);
    } catch (error) {
      console.error('Error loading booked speakers:', error);
    }
  };

  const loadSpeakerReport = async () => {
    // Remove the automatic loading of existing report since we now allow multiple entries
    // Just reset the form when speaker changes
    setReportData(prev => ({
      meeting_id: meetingId || '',
      club_id: user?.currentClubId || '',
      speaker_name: selectedSpeaker?.full_name || '',
      speaker_user_id: selectedSpeaker?.id || null,
      speech_category: prev.speech_category, // Keep the selected category
      actual_time_seconds: 0,
      actual_time_display: '00:00',
      time_qualification: null,
      target_min_seconds: null,
      target_max_seconds: null,
      notes: null,
      recorded_by: user?.id || '',
    }));
    setMinutes(0);
    setSeconds(0);
  };

  const resetForm = () => {
    // Reset form to default state
    setReportData({
      meeting_id: meetingId || '',
      club_id: user?.currentClubId || '',
      speaker_name: '',
      speaker_user_id: null,
      speech_category: 'prepared_speaker',
      actual_time_seconds: 0,
      actual_time_display: '00:00',
      time_qualification: null,
      target_min_seconds: null,
      target_max_seconds: null,
      notes: null,
      recorded_by: user?.id || '',
    });
    setSelectedSpeaker(null);
    setManualNameEntry(false);
    setManualNameText('');
    setMinutes(0);
    setSeconds(0);
  };

  const loadSavedReports = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('timer_reports')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('Error loading saved reports:', error);
        return;
      }

      setSavedReports(data || []);
    } catch (error) {
      console.error('Error loading saved reports:', error);
    }
  };

  const handleDeleteReport = (reportId: string, speakerName: string) => {
    setDeleteConfirm({ id: reportId, speakerName });
  };

  const confirmDeleteReport = async () => {
    if (!deleteConfirm) return;
    const { id: reportId } = deleteConfirm;
    setDeleteConfirm(null);
    setDeletingReports(prev => new Set([...prev, reportId]));
    try {
      const { error } = await supabase
        .from('timer_reports')
        .delete()
        .eq('id', reportId);
      if (error) {
        console.error('Error deleting timer report:', error);
        Alert.alert('Error', 'Failed to delete timer report');
        return;
      }
      setSavedReports(prev => prev.filter(report => report.id !== reportId));
    } catch (error) {
      console.error('Error deleting timer report:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setDeletingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const updateCategory = (category: string) => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can edit this report.`);
      return;
    }
    setReportData(prev => ({ ...prev, speech_category: category }));
    setSelectedSpeaker(null);
    setManualNameEntry(false);
    setManualNameText('');
    loadBookedSpeakersForCategory(category);
  };

  const updateQualification = (qualified: boolean) => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can edit this report.`);
      return;
    }
    setReportData(prev => ({ ...prev, time_qualification: qualified }));
  };

  const getCategoryLabel = () => {
    return getCategoryDisplayName(reportData.speech_category);
  };

  const getCategoryColor = (category: string) => {
    const categoryOption = speechCategories.find(c => c.value === category);
    return categoryOption?.color || '#6b7280';
  };

  const getCategoryDisplayName = (category: string) => {
    switch (category) {
      case 'prepared_speaker':
        return 'Prepared Speaker';
      case 'ice_breaker':
        return 'Ice Breaker';
      case 'table_topic_speaker':
        return 'Table Topics Speaker';
      case 'evaluation':
        return 'Evaluator';
      case 'educational_session':
        return 'Educational Speaker';
      default:
        return category;
    }
  };

  const getQualificationLabel = () => {
    return reportData.time_qualification ? 'Yes' : 'No';
  };

  const getCategoryIcon = (iconName: string, color: string, isSelected: boolean) => {
    const size = 16;
    const iconColor = isSelected ? '#ffffff' : color;

    switch (iconName) {
      case 'message-circle':
        return <MessageCircle size={size} color={iconColor} />;
      case 'snowflake':
        return <Snowflake size={size} color={iconColor} />;
      case 'mic':
        return <Mic size={size} color={iconColor} />;
      case 'message-square':
        return <MessageSquare size={size} color={iconColor} />;
      case 'lightbulb':
        return <Lightbulb size={size} color={iconColor} />;
      default:
        return <MessageCircle size={size} color={iconColor} />;
    }
  };

  const ReportCard = ({ report }: { report: TimerReport }) => {
    return (
      <View style={[styles.reportTableRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <View style={styles.reportTableNameCell}>
          <Text style={[styles.reportTableName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {report.speaker_name}
          </Text>
          <Text style={[styles.reportTableCategory, { color: getCategoryColor(report.speech_category) }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {getCategoryDisplayName(report.speech_category)}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <Text style={[styles.reportTableTime, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
            {report.actual_time_display}
          </Text>
        </View>

        <View style={styles.reportTableCenterCell}>
          <Text style={[
            styles.reportTableQualified,
            { color: report.time_qualification ? '#10b981' : '#64748b' }
          ]} maxFontSizeMultiplier={1.3}>
            {report.time_qualification ? 'Yes' : 'No'}
          </Text>
        </View>

        <View style={styles.reportTableActions}>
          {isAssignedTimer && (
            <TouchableOpacity
              style={styles.reportTableActionButton}
              onPress={() => handleDeleteReport(report.id!, report.speaker_name)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const handleSaveReport = async () => {
    if (!isAssignedTimer) {
      Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can save reports.`);
      return;
    }

    if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
      Alert.alert('Speaker Required', 'Please select a speaker or enter a guest name');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required data to save report');
      return;
    }

    if (!reportData.speech_category) {
      Alert.alert('Error', 'Please select a speech category');
      return;
    }

    const effectiveName = selectedSpeaker ? selectedSpeaker.full_name : manualNameText.trim();
    const effectiveUserId = selectedSpeaker ? selectedSpeaker.id : null;

    setIsSaving(true);

    try {
      // For member entries check for duplicates; for guest (manual) always insert new
      let existingReport = null;
      if (selectedSpeaker) {
        const { data: existingData, error: checkError } = await supabase
          .from('timer_reports')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('speaker_user_id', effectiveUserId)
          .eq('speech_category', reportData.speech_category)
          .eq('recorded_by', user.id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing report:', checkError);
          Alert.alert('Error', 'Failed to check existing report');
          return;
        }
        existingReport = existingData;
      }

      const saveData = {
        ...reportData,
        meeting_id: meetingId,
        club_id: user.currentClubId,
        speaker_name: effectiveName,
        speaker_user_id: effectiveUserId,
        recorded_by: user.id,
        recorded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        time_qualification: reportData.time_qualification ?? false,
      };

      if (existingReport) {
        const { error } = await supabase
          .from('timer_reports')
          .update(saveData)
          .eq('id', existingReport.id);

        if (error) {
          console.error('Error updating report:', error);
          Alert.alert('Error', 'Failed to update report');
          return;
        }

        Alert.alert('Success', `Timer report updated for ${effectiveName} - ${getCategoryLabel()}`);
      } else {
        const { data, error } = await supabase
          .from('timer_reports')
          .insert(saveData)
          .select()
          .single();

        if (error) {
          console.error('Error creating report:', error);
          Alert.alert('Error', 'Failed to save report');
          return;
        }

        Alert.alert('Success', `Timer report saved for ${effectiveName} - ${getCategoryLabel()}`);
      }

      // Reload saved reports to show the new one
      await loadSavedReports();
      
      // Stay on Log Time tab (Summary tab removed)
      setSelectedTab('record');
    } catch (error) {
      console.error('Error saving report:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter booked speakers based on search query
  const filteredClubMembers = bookedSpeakers.filter(member => {
    const query = speakerSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return member.full_name.toLowerCase().includes(query);
  });

  const SpeakerSelector = () => (
    <TouchableOpacity
      style={[
        styles.speakerSelector,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        }
      ]}
      onPress={() => {
        if (!isAssignedTimer) {
          Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can select speakers.`);
          return;
        }
        setShowSpeakerModal(true);
      }}
    >
      <View style={styles.speakerSelectorContent}>
        <View style={styles.speakerAvatar}>
          {selectedSpeaker?.avatar_url ? (
            <Image source={{ uri: selectedSpeaker.avatar_url }} style={styles.speakerAvatarImage} />
          ) : (
            <User size={16} color="#ffffff" />
          )}
        </View>
        <View style={styles.speakerInfo}>
          <Text style={[styles.speakerLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Speaker
          </Text>
          <Text style={[styles.speakerName, { color: (selectedSpeaker || manualNameEntry) ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {selectedSpeaker?.full_name || (manualNameEntry && manualNameText ? manualNameText : manualNameEntry ? 'Enter guest name...' : 'Select Speaker')}
          </Text>
        </View>
      </View>
      <ChevronDown size={16} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading timer report...</Text>
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

  // Check if no Timer is assigned
  if (!assignedTimer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
          <TouchableOpacity style={styles.headerSpacer} onPress={() => setShowHowToModal(true)}>
            <HelpCircle size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.noBookingContentContainer}>
          <View style={styles.noBookingContentTop}>
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
            <View style={styles.meetingCardDecoration} />
          </View>

          {/* No Timer Assigned State */}
          <View style={styles.noAssignmentState}>
            <Timer size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.noAssignmentSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Every great meeting needs a time hero! 🦸‍♂️ Take charge — book the Timer role.
            </Text>
            <TouchableOpacity
              style={[styles.bookRoleButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push(`/book-a-role?meetingId=${meetingId}`)}
            >
              <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>Book Timer Role</Text>
            </TouchableOpacity>
          </View>
          </View>

          {/* Footer Navigation */}
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 24,
            marginBottom: 16,
          }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerNavigationContent}>
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                  <FileText size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                  <Bell size={20} color="#772432" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Users size={20} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                  <Calendar size={20} color="#004165" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                  <BookOpen size={20} color="#16a34a" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/grammarian', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                  <NotebookPen size={20} color="#4f46e5" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Mic size={20} color="#ec4899" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                  <Mic size={20} color="#C9B84E" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDFA' }]}>
                  <MessageSquare size={20} color="#0d9488" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId } })}
              >
                <View style={[styles.footerNavIcon, { backgroundColor: '#FFF4E6' }]}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TMOD</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </ScrollView>

        {/* How To Modal (non-assigned view) */}
        <Modal visible={showHowToModal} transparent animationType="fade">
          <TouchableOpacity
            style={styles.howToOverlay}
            activeOpacity={1}
            onPress={() => setShowHowToModal(false)}
          >
            <TouchableOpacity activeOpacity={1} style={[styles.howToContainer, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.howToHeader}>
                <Text style={[styles.howToTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer – How to Log Timing</Text>
                <TouchableOpacity
                  onPress={() => setShowHowToModal(false)}
                  style={styles.howToClose}
                >
                  <X size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.howToScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF' }]}>
                  <FileText size={14} color='#4F46E5' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Log Time Tab</Text>
                </View>
                {[
                  { num: 1, color: '#F59E0B', title: 'Select Category', desc: 'Choose the category. Speech / Table Topics / Evaluation.' },
                  { num: 2, color: '#06B6D4', title: 'Select the Speaker', desc: "Choose the speaker's name from the dropdown." },
                  { num: 3, color: '#10B981', title: 'Use the Stopwatch', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Start</Text> when the speech begins and <Text style={{ fontWeight: '700' }}>Stop</Text> when it ends.</Text> },
                  { num: 4, color: '#6366F1', title: 'Enter the Final Time', desc: <Text maxFontSizeMultiplier={1.3}>The time can be entered or adjusted in <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add Time</Text>.</Text> },
                  { num: 5, color: '#8B5CF6', title: 'Mark Qualification', desc: <Text maxFontSizeMultiplier={1.3}>Select <Text style={{ color: '#10B981', fontWeight: '700' }}>Yes</Text> if the speech met the required time range.{'\n'}Select <Text style={{ fontWeight: '700' }}>No</Text> if the speech was under or over time.</Text> },
                  { num: 6, color: '#EC4899', title: 'Save the Record', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Save</Text> to store the timing entry.</Text> },
                ].map(({ num, color, title, desc }) => (
                  <View key={num} style={styles.howToStep}>
                    <View style={[styles.howToStepNum, { backgroundColor: color }]}>
                      <Text style={styles.howToStepNumText} maxFontSizeMultiplier={1.2}>{num}</Text>
                    </View>
                    <View style={styles.howToStepContent}>
                      <Text style={[styles.howToStepTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
                      {typeof desc === 'string'
                        ? <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{desc}</Text>
                        : <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>
                      }
                    </View>
                  </View>
                ))}
                <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
                  <FileBarChart size={14} color='#4F46E5' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Summary Tab</Text>
                </View>
                <Text style={[styles.howToBodyText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  In the <Text style={{ fontWeight: '700' }}>Summary</Text> tab you can:
                </Text>
                <View style={styles.howToBulletList}>
                  <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} Review all recorded speech timings</Text>
                  <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} View the <Text style={{ fontWeight: '700', color: theme.colors.text }}>Timer Review</Text> report</Text>
                </View>
                <View style={[styles.howToSectionBadge, { backgroundColor: '#FFF7ED', marginTop: 8 }]}>
                  <Upload size={14} color='#EA580C' />
                  <Text style={[styles.howToSectionBadgeText, { color: '#EA580C' }]} maxFontSizeMultiplier={1.3}>Exporting the Report</Text>
                </View>
                <Text style={[styles.howToBodyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Timing reports can be exported as PDF from the web portal. Steps:
                </Text>
                <View style={styles.howToNumberedList}>
                  {[
                    <Text maxFontSizeMultiplier={1.3}>Go to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Settings {'→'} Web Login</Text></Text>,
                    <Text maxFontSizeMultiplier={1.3}>Open the web portal</Text>,
                    <Text maxFontSizeMultiplier={1.3}>Navigate to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Meeting {'→'} Timer</Text></Text>,
                    <Text maxFontSizeMultiplier={1.3}>Click <Text style={{ fontWeight: '700', color: theme.colors.text }}>Download PDF</Text></Text>,
                  ].map((item, i) => (
                    <Text key={i} style={[styles.howToNumberedItem, { color: theme.colors.textSecondary }]}>
                      {i + 1}. {item}
                    </Text>
                  ))}
                </View>
                <View style={[styles.howToTipBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Lightbulb size={16} color={theme.colors.textSecondary} />
                  <Text style={[styles.howToTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    <Text style={{ fontWeight: '700' }}>Tips:</Text> Help Tap the{' '}
                    <HelpCircle size={12} color={theme.colors.textSecondary} />{' '}
                    icon anytime to view these instructions.
                  </Text>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    );
  }

  // Check if current user is the assigned Timer
  const isAssignedTimer = assignedTimer && user && assignedTimer.id === user.id;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Report</Text>
        <TouchableOpacity style={styles.headerSpacer} onPress={() => setShowHowToModal(true)}>
          <HelpCircle size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          <View style={styles.meetingCardDecoration} />
        </View>

        {/* Assigned Timer Section */}
        {assignedTimer && (
          <View style={[styles.timerSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.timerCard}>
              <View style={styles.timerInfo}>
                <View style={styles.timerAvatar}>
                  {assignedTimer.avatar_url ? (
                    <Image source={{ uri: assignedTimer.avatar_url }} style={styles.timerAvatarImage} />
                  ) : (
                    <Timer size={24} color="#ffffff" />
                  )}
                </View>
                <View style={styles.timerDetails}>
                  <Text style={[styles.timerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {assignedTimer.full_name}
                  </Text>
                  <Text style={[styles.timerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Timer
                  </Text>
                </View>
              </View>
              {isAssignedTimer && (
                <TouchableOpacity
                  style={styles.prepSpaceIconButton}
                  onPress={() => router.push(`/timer-notes?meetingId=${meetingId}`)}
                >
                  <NotebookPen size={20} color="#3b82f6" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'record' ? '#3b82f6' : theme.colors.surface,
                borderColor: selectedTab === 'record' ? '#3b82f6' : theme.colors.border,
              }
            ]}
            onPress={() => {
              setSelectedTab('record');
              resetForm();
            }}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'record' ? '#ffffff' : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Log Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {selectedTab === 'record' ? (
          <>
            {/* Horizontal Category Pills */}
            <View style={styles.categoryRowContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRowContent}
              >
                {speechCategories.map((category) => {
                  const isSelected = reportData.speech_category === category.value;
                  return (
                    <TouchableOpacity
                      key={category.value}
                      style={[
                        styles.categoryPillItem,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => updateCategory(category.value)}
                    >
                      {getCategoryIcon(category.icon, category.color, isSelected)}
                      <Text style={[
                        styles.categoryPillItemText,
                        { color: isSelected ? '#ffffff' : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Log Time Card */}
            <View style={[styles.logTimeCard, { backgroundColor: theme.colors.surface }]}>
              {/* Speaker Selection */}
              <SpeakerSelector />
              {manualNameEntry && (
                <TextInput
                  style={[styles.manualNameInput, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    marginTop: 8,
                  }]}
                  placeholder="Type guest name..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={manualNameText}
                  onChangeText={setManualNameText}
                  autoFocus
                  maxLength={80}
                />
              )}

              {/* Inline Stopwatch */}
              <View style={[styles.inlineStopwatchContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.inlineStopwatchTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Stopwatch Timer
                </Text>
                <Text style={[styles.inlineStopwatchTime, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatStopwatchTime(stopwatchTime)}
                </Text>
                <View style={styles.inlineStopwatchButtons}>
                  <TouchableOpacity
                    style={[styles.inlineSwBtn, { backgroundColor: '#10b981', opacity: stopwatchRunning ? 0.45 : 1 }]}
                    onPress={startStopwatch}
                    disabled={stopwatchRunning}
                  >
                    <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Start</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inlineSwBtn, { backgroundColor: '#ef4444', opacity: !stopwatchRunning ? 0.45 : 1 }]}
                    onPress={stopStopwatch}
                    disabled={!stopwatchRunning}
                  >
                    <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Stop</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inlineSwBtn, { backgroundColor: '#f59e0b', opacity: !stopwatchRunning ? 0.45 : 1 }]}
                    onPress={pauseStopwatch}
                    disabled={!stopwatchRunning}
                  >
                    <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Pause</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inlineSwBtn, { backgroundColor: '#64748b' }]}
                    onPress={resetStopwatch}
                  >
                    <Text style={styles.inlineSwBtnText} maxFontSizeMultiplier={1.3}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={[styles.cardDivider, { backgroundColor: theme.colors.border }]} />

              {/* Add Time title row */}
              <View style={styles.addTimeTitleRow}>
                <Text style={[styles.addTimeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Add Time
                </Text>
                {stopwatchTime > 0 && (
                  <TouchableOpacity
                    style={[styles.pushStopwatchBtn, { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary }]}
                    onPress={() => {
                      const totalSeconds = Math.floor(stopwatchTime / 1000);
                      const mins = Math.floor(totalSeconds / 60);
                      const secs = totalSeconds % 60;
                      const display = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                      setReportData(prev => ({
                        ...prev,
                        actual_time_seconds: totalSeconds,
                        actual_time_display: display,
                      }));
                      setMinutes(mins);
                      setSeconds(secs);
                    }}
                  >
                    <Timer size={12} color={theme.colors.primary} />
                    <Text style={[styles.pushStopwatchBtnText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                      Use {formatStopwatchTime(stopwatchTime)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Time Box */}
              <TouchableOpacity
                style={[styles.timeBoxFull, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => {
                  if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
                    Alert.alert('Speaker Required', 'Please select a speaker or enter a guest name first');
                    return;
                  }
                  setShowTimePickerModal(true);
                }}
              >
                <View style={styles.timeBoxInner}>
                  <Timer size={16} color={theme.colors.primary} />
                  <Text style={[styles.timeBoxText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                    {reportData.actual_time_display}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.timeBoxHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Tap to edit
                </Text>
              </TouchableOpacity>

              {/* Qualified Row */}
              <View style={styles.qualifiedRow}>
                <Text style={[styles.qualifiedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Qualified:
                </Text>
                <View style={styles.qualifiedBtnsRow}>
                  <TouchableOpacity
                    style={[
                      styles.qualifiedBtnNew,
                      {
                        backgroundColor: reportData.time_qualification === true ? '#3b82f6' : theme.colors.background,
                        borderColor: reportData.time_qualification === true ? '#3b82f6' : theme.colors.border,
                      }
                    ]}
                    onPress={() => {
                      if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
                        setShowNameRequiredModal(true);
                        return;
                      }
                      updateQualification(true);
                    }}
                  >
                    <View style={[
                      styles.radioDot,
                      {
                        borderColor: reportData.time_qualification === true ? '#ffffff' : theme.colors.border,
                        backgroundColor: reportData.time_qualification === true ? '#ffffff' : 'transparent',
                      }
                    ]}>
                      {reportData.time_qualification === true && <View style={styles.radioDotInner} />}
                    </View>
                    <Text style={[styles.qualifiedBtnNewText, { color: reportData.time_qualification === true ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Yes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.qualifiedBtnNew,
                      {
                        backgroundColor: reportData.time_qualification === false ? '#3b82f6' : theme.colors.background,
                        borderColor: reportData.time_qualification === false ? '#3b82f6' : theme.colors.border,
                      }
                    ]}
                    onPress={() => {
                      if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
                        setShowNameRequiredModal(true);
                        return;
                      }
                      updateQualification(false);
                    }}
                  >
                    <View style={[
                      styles.radioDot,
                      {
                        borderColor: reportData.time_qualification === false ? '#ffffff' : theme.colors.border,
                        backgroundColor: reportData.time_qualification === false ? '#ffffff' : 'transparent',
                      }
                    ]}>
                      {reportData.time_qualification === false && <View style={styles.radioDotInner} />}
                    </View>
                    <Text style={[styles.qualifiedBtnNewText, { color: reportData.time_qualification === false ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      No
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButtonFull,
                  {
                    backgroundColor: (selectedSpeaker || (manualNameEntry && manualNameText.trim())) ? theme.colors.primary : '#9ca3af',
                  }
                ]}
                onPress={() => {
                  if (!isAssignedTimer) {
                    Alert.alert('Read Only', `Only ${assignedTimer?.full_name || 'the assigned Timer'} can save reports.`);
                    return;
                  }
                  if (!selectedSpeaker && (!manualNameEntry || !manualNameText.trim())) {
                    Alert.alert('Speaker Required', 'Please select a speaker or enter a guest name');
                    return;
                  }
                  if (!reportData.speech_category) {
                    Alert.alert('Error', 'Please select a speech category');
                    return;
                  }
                  setShowConfirmModal(true);
                }}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonFullText} maxFontSizeMultiplier={1.3}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            {/* Timer Logged Time Title */}
            <Text style={[styles.loggedTimeSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Timer Logged Time
            </Text>

            {/* All + Filter Tabs */}
            <View style={styles.allButtonSection}>
              <TouchableOpacity
                style={[
                  styles.allButton,
                  {
                    backgroundColor: selectedFilter === 'all' ? theme.colors.primary : theme.colors.surface,
                    borderColor: selectedFilter === 'all' ? theme.colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => setSelectedFilter('all')}
              >
                <Text style={[
                  styles.allButtonText,
                  { color: selectedFilter === 'all' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  All
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categoryPillsSection}>
              <View style={styles.categoryPillsContainer}>
                {speechCategories.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: selectedFilter === category.value ? theme.colors.primary : theme.colors.surface,
                        borderColor: selectedFilter === category.value ? theme.colors.primary : theme.colors.border,
                      }
                    ]}
                    onPress={() => setSelectedFilter(category.value)}
                  >
                    <Text style={[
                      styles.categoryPillText,
                      { color: selectedFilter === category.value ? '#ffffff' : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {category.label.replace(' Speaker', '').replace(' Session', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filtered Records */}
            <View style={[styles.reportsSection, { backgroundColor: theme.colors.surface }]}>
              {(selectedFilter === 'all' ? savedReports : savedReports.filter(r => r.speech_category === selectedFilter)).length > 0 ? (
                <View style={styles.reportsList}>
                  {(selectedFilter === 'all'
                    ? savedReports
                    : savedReports.filter(r => r.speech_category === selectedFilter)
                  ).map((report) => (
                    <ReportCard key={report.id} report={report} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyReportsState}>
                  <Timer size={48} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyReportsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No Timer Records
                  </Text>
                  <Text style={[styles.emptyReportsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Timer records will appear here once you save speech timings
                  </Text>
                </View>
              )}
            </View>

            {/* Timer Review Report Button (below Timer Logged Time) */}
            <TouchableOpacity
              style={[styles.timerReviewButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => router.push(`/timer-review?meetingId=${meetingId}`)}
            >
              <View style={[styles.timerReviewIconWrap, { backgroundColor: '#FFF4E6' }]}>
                <FileBarChart size={20} color="#f59e0b" />
              </View>
              <View style={styles.timerReviewTextWrap}>
                <Text style={[styles.timerReviewTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Timer Review
                </Text>
                <Text style={[styles.timerReviewSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  View report
                </Text>
              </View>
              <ChevronDown size={18} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>

            {/* Navigation Quick Actions Box */}
            <View style={[styles.quickActionsBoxContainer, { backgroundColor: '#ffffff' }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                    <FileText size={24} color="#f59e0b" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                    <Bell size={24} color="#dc2626" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Users size={24} color="#ec4899" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                    <Calendar size={24} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                    <BookOpen size={24} color="#f97316" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Corner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Star size={24} color="#ef4444" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                    <FileText size={24} color="#8b5cf6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Mic size={24} color="#f59e0b" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speaker</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                    <CheckSquare size={24} color="#9333ea" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                    <FileText size={24} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quick Overview</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                    <CheckSquare size={24} color="#3b82f6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                    <ClipboardCheck size={24} color="#dc2626" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Evaluation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                    <FileBarChart size={24} color="#10b981" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                    <Star size={24} color="#8b5cf6" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Toastmaster</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionItem}
                  onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meetingId } })}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <MessageSquare size={24} color="#ef4444" />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TTM</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </>
        ) : (
          /* Summary Tab */
          <View style={styles.reportsTabContent} />
        )}
      </ScrollView>

      {/* Speech Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Speech Category</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {speechCategories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.modalOption,
                    reportData.speech_category === category.value && { backgroundColor: category.color + '20' }
                  ]}
                  onPress={() => {
                    updateCategory(category.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: reportData.speech_category === category.value ? category.color : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Picker Modal (Combined Minutes and Seconds) */}
      <Modal
        visible={showTimePickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowTimePickerModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.timePickerModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.timePickerHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Set Time</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowTimePickerModal(false)}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContent}>
              {/* Minutes Column */}
              <View style={styles.timePickerColumn}>
                <Text style={[styles.timePickerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Minutes</Text>
                <ScrollView style={styles.timePickerList} showsVerticalScrollIndicator={false}>
                  {minuteOptions.map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.timePickerOption,
                        minutes === minute && { backgroundColor: theme.colors.primary + '20' }
                      ]}
                      onPress={() => setMinutes(minute)}
                    >
                      <Text style={[
                        styles.timePickerOptionText,
                        { color: minutes === minute ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {minute.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Separator */}
              <Text style={[styles.timePickerSeparator, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>:</Text>

              {/* Seconds Column */}
              <View style={styles.timePickerColumn}>
                <Text style={[styles.timePickerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Seconds</Text>
                <ScrollView style={styles.timePickerList} showsVerticalScrollIndicator={false}>
                  {secondOptions.map((second) => (
                    <TouchableOpacity
                      key={second}
                      style={[
                        styles.timePickerOption,
                        seconds === second && { backgroundColor: theme.colors.primary + '20' }
                      ]}
                      onPress={() => setSeconds(second)}
                    >
                      <Text style={[
                        styles.timePickerOptionText,
                        { color: seconds === second ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {second.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowTimePickerModal(false)}
            >
              <Text style={styles.doneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Save Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Confirm Details
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Is this information correct?
            </Text>

            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speech</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {speechCategories.find(c => c.value === reportData.speech_category)?.label ?? reportData.speech_category}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Name</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {selectedSpeaker ? selectedSpeaker.full_name : manualNameText.trim()}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Time</Text>
              <Text style={[styles.confirmRowValue, { color: theme.colors.primary, fontWeight: '700' }]} maxFontSizeMultiplier={1.3}>
                {reportData.actual_time_display}
              </Text>
            </View>

            <View style={[styles.confirmRowDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.confirmRow}>
              <Text style={[styles.confirmRowLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Qualified</Text>
              <View style={[
                styles.confirmQualifiedBadge,
                { backgroundColor: reportData.time_qualification ? '#dcfce7' : '#fee2e2' }
              ]}>
                <Text style={[
                  styles.confirmQualifiedText,
                  { color: reportData.time_qualification ? '#16a34a' : '#dc2626' }
                ]} maxFontSizeMultiplier={1.3}>
                  {reportData.time_qualification ? 'Yes' : 'No'}
                </Text>
              </View>
            </View>

            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Edit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.7 : 1 }]}
                onPress={async () => {
                  setShowConfirmModal(false);
                  await handleSaveReport();
                }}
                disabled={isSaving}
              >
                <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Saving...' : 'Confirm & Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={!!deleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirm(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.deleteIconCircle, { backgroundColor: '#fee2e2' }]}>
              <Trash2 size={24} color="#dc2626" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.text, marginTop: 12 }]} maxFontSizeMultiplier={1.3}>
              Delete Timer Report
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to delete the timer report for{' '}
              <Text style={{ fontWeight: '700', color: theme.colors.text }}>{deleteConfirm?.speakerName}</Text>?
              {'\n'}This action cannot be undone.
            </Text>
            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => setDeleteConfirm(null)}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: '#dc2626' }]}
                onPress={confirmDeleteReport}
              >
                <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Name Required Modal */}
      <Modal
        visible={showNameRequiredModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNameRequiredModal(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.deleteIconWrap, { backgroundColor: '#fef9c3' }]}>
              <User size={24} color="#ca8a04" />
            </View>
            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Speaker Required
            </Text>
            <Text style={[styles.confirmSubtitle, { color: theme.colors.textSecondary, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              Please select a speaker or enter a guest name, add the time, and then mark qualification.
            </Text>
            <View style={[styles.confirmDivider, { backgroundColor: theme.colors.border, marginTop: 16 }]} />
            <TouchableOpacity
              style={[styles.confirmSaveBtn, { backgroundColor: theme.colors.primary, alignSelf: 'center', minWidth: 120 }]}
              onPress={() => setShowNameRequiredModal(false)}
            >
              <Text style={styles.confirmSaveText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Minutes Modal */}
      <Modal
        visible={showMinutesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMinutesModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowMinutesModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Minutes</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {minuteOptions.map((minute) => (
                <TouchableOpacity
                  key={minute}
                  style={[
                    styles.modalOption,
                    minutes === minute && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setMinutes(minute);
                    setShowMinutesModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: minutes === minute ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {minute.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Seconds Modal */}
      <Modal
        visible={showSecondsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSecondsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowSecondsModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Seconds</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {secondOptions.map((second) => (
                <TouchableOpacity
                  key={second}
                  style={[
                    styles.modalOption,
                    seconds === second && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    setSeconds(second);
                    setShowSecondsModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: seconds === second ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {second.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Qualified Modal */}
      <Modal
        visible={showQualifiedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQualifiedModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowQualifiedModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Time Qualified?</Text>
            <ScrollView style={styles.modalOptionsList} showsVerticalScrollIndicator={false}>
              {qualificationOptions.map((option) => (
                <TouchableOpacity
                  key={option.value.toString()}
                  style={[
                    styles.modalOption,
                    reportData.time_qualification === option.value && { backgroundColor: option.color + '20' }
                  ]}
                  onPress={() => {
                    updateQualification(option.value);
                    setShowQualifiedModal(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    { color: reportData.time_qualification === option.value ? option.color : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Speaker Selection Modal */}
      <Modal
        visible={showSpeakerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSpeakerModal(false);
          setSpeakerSearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowSpeakerModal(false);
            setSpeakerSearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.speakerModal, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Speaker</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowSpeakerModal(false);
                  setSpeakerSearchQuery('');
                }}
              >
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Guest / Manual entry option */}
            <TouchableOpacity
              style={[styles.guestEntryOption, { borderColor: theme.colors.border, backgroundColor: manualNameEntry ? '#FFF4E6' : theme.colors.background }]}
              onPress={() => {
                setManualNameEntry(true);
                setSelectedSpeaker(null);
                setShowSpeakerModal(false);
                setSpeakerSearchQuery('');
              }}
            >
              <View style={[styles.guestEntryIcon, { backgroundColor: '#FEF3C7' }]}>
                <User size={16} color="#F59E0B" />
              </View>
              <Text style={[styles.guestEntryText, { color: '#92400E' }]} maxFontSizeMultiplier={1.3}>
                Enter Guest Name Manually
              </Text>
            </TouchableOpacity>

            {bookedSpeakers.length > 0 && (
              <View style={[styles.modalDivider, { backgroundColor: theme.colors.border }]} />
            )}

            {bookedSpeakers.length === 0 ? (
              <View style={styles.noBookingContainer}>
                <Text style={[styles.noBookingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No booking
                </Text>
              </View>
            ) : (
              <>
                {/* Search Box */}
                <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
                  <Search size={20} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search by name..."
                    placeholderTextColor={theme.colors.textSecondary}
                    value={speakerSearchQuery}
                    onChangeText={setSpeakerSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {speakerSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSpeakerSearchQuery('')}>
                      <X size={20} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={styles.speakersList} showsVerticalScrollIndicator={false}>
                  {filteredClubMembers.length > 0 ? (
                    filteredClubMembers.map((member) => (
                      <TouchableOpacity
                        key={member.id}
                        style={[
                          styles.speakerOption,
                          selectedSpeaker?.id === member.id && { backgroundColor: theme.colors.primary + '20' }
                        ]}
                        onPress={() => {
                          setSelectedSpeaker(member);
                          setManualNameEntry(false);
                          setManualNameText('');
                          setShowSpeakerModal(false);
                          setSpeakerSearchQuery('');
                        }}
                      >
                        <View style={styles.speakerOptionAvatar}>
                          {member.avatar_url ? (
                            <Image source={{ uri: member.avatar_url }} style={styles.speakerOptionAvatarImage} />
                          ) : (
                            <User size={20} color="#ffffff" />
                          )}
                        </View>
                        <View style={styles.speakerOptionInfo}>
                          <Text style={[
                            styles.speakerOptionName,
                            { color: selectedSpeaker?.id === member.id ? theme.colors.primary : theme.colors.text }
                          ]} maxFontSizeMultiplier={1.3}>
                            {member.full_name}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <View style={styles.noResultsContainer}>
                      <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No speakers found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* How To Modal */}
      <Modal visible={showHowToModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.howToOverlay}
          activeOpacity={1}
          onPress={() => setShowHowToModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.howToContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.howToHeader}>
              <Text style={[styles.howToTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer – How to Log Timing</Text>
              <TouchableOpacity
                onPress={() => setShowHowToModal(false)}
                style={styles.howToClose}
              >
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.howToScroll} showsVerticalScrollIndicator={false}>
              {/* Log Time Tab Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF' }]}>
                <FileText size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Log Time Tab</Text>
              </View>

              {[
                { num: 1, color: '#F59E0B', title: 'Select Category', desc: 'Choose the category. Speech / Table Topics / Evaluation.' },
                { num: 2, color: '#06B6D4', title: 'Select the Speaker', desc: "Choose the speaker's name from the dropdown." },
                { num: 3, color: '#10B981', title: 'Use the Stopwatch', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Start</Text> when the speech begins and <Text style={{ fontWeight: '700' }}>Stop</Text> when it ends.</Text> },
                { num: 4, color: '#6366F1', title: 'Enter the Final Time', desc: <Text maxFontSizeMultiplier={1.3}>The time can be entered or adjusted in <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add Time</Text>.</Text> },
                { num: 5, color: '#8B5CF6', title: 'Mark Qualification', desc: <Text maxFontSizeMultiplier={1.3}>Select <Text style={{ color: '#10B981', fontWeight: '700' }}>Yes</Text> if the speech met the required time range.{'\n'}Select <Text style={{ fontWeight: '700' }}>No</Text> if the speech was under or over time.</Text> },
                { num: 6, color: '#EC4899', title: 'Save the Record', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Save</Text> to store the timing entry.</Text> },
              ].map(({ num, color, title, desc }) => (
                <View key={num} style={styles.howToStep}>
                  <View style={[styles.howToStepNum, { backgroundColor: color }]}>
                    <Text style={styles.howToStepNumText} maxFontSizeMultiplier={1.2}>{num}</Text>
                  </View>
                  <View style={styles.howToStepContent}>
                    <Text style={[styles.howToStepTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
                    {typeof desc === 'string'
                      ? <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{desc}</Text>
                      : <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>
                    }
                  </View>
                </View>
              ))}

              {/* Summary Tab Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
                <FileBarChart size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Summary Tab</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                In the <Text style={{ fontWeight: '700' }}>Summary</Text> tab you can:
              </Text>
              <View style={styles.howToBulletList}>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} Review all recorded speech timings</Text>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} View the <Text style={{ fontWeight: '700', color: theme.colors.text }}>Timer Review</Text> report</Text>
              </View>

              {/* Exporting Section */}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#FFF7ED', marginTop: 8 }]}>
                <Upload size={14} color='#EA580C' />
                <Text style={[styles.howToSectionBadgeText, { color: '#EA580C' }]} maxFontSizeMultiplier={1.3}>Exporting the Report</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Timing reports can be exported as PDF from the web portal. Steps:
              </Text>
              <View style={styles.howToNumberedList}>
                {[
                  <Text maxFontSizeMultiplier={1.3}>Go to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Settings {'→'} Web Login</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Open the web portal</Text>,
                  <Text maxFontSizeMultiplier={1.3}>Navigate to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Meeting {'→'} Timer</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Click <Text style={{ fontWeight: '700', color: theme.colors.text }}>Download PDF</Text></Text>,
                ].map((item, i) => (
                  <Text key={i} style={[styles.howToNumberedItem, { color: theme.colors.textSecondary }]}>
                    {i + 1}. {item}
                  </Text>
                ))}
              </View>

              {/* Tip Footer */}
              <View style={[styles.howToTipBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Lightbulb size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.howToTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  <Text style={{ fontWeight: '700' }}>Tips:</Text> Help Tap the{' '}
                  <HelpCircle size={12} color={theme.colors.textSecondary} />{' '}
                  icon anytime to view these instructions.
                </Text>
              </View>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  noBookingContentContainer: {
    flexGrow: 1,
  },
  noBookingContentTop: {
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
  meetingCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  speakerSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  speakerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  speakerSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  speakerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    overflow: 'hidden',
  },
  speakerAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  speakerInfo: {
    flex: 1,
  },
  speakerLabel: {
    fontSize: 8,
    fontWeight: '600',
    marginBottom: 2,
  },
  speakerName: {
    fontSize: 11,
    fontWeight: '700',
  },
  speakerSubtext: {
    fontSize: 14,
  },
  readOnlyBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  readOnlyBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  categorySection: {
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
  categoryButtonsGrid: {
    gap: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
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
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryButtonsVertical: {
    gap: 10,
  },
  categoryButtonVertical: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
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
  categoryButtonTextVertical: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryButtonsHorizontal: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryButtonHorizontal: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  categoryButtonTextHorizontal: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  timeSection: {
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
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  timeInputGroup: {
    alignItems: 'center',
  },
  timeInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  timeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timeDropdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  timeDisplayContainer: {
    alignItems: 'center',
  },
  timeDisplay: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: '#ffffff',
  },
  timeText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  timeDisplayLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  timeIcon: {
    marginRight: -4,
  },
  timeTextLarge: {
    fontSize: 40,
    fontWeight: '700',
  },
  qualifiedRadioGroup: {
    flexDirection: 'row',
    gap: 14,
  },
  qualifiedRadioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#64748b',
  },
  radioCircleSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  qualifiedRadioText: {
    fontSize: 15,
    fontWeight: '500',
  },
  qualifiedSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qualifiedInlineSection: {
    marginTop: 20,
  },
  qualifiedDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  qualifiedDropdownText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveSection: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 20,
  },
  saveReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveReportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '60%',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalOptionsList: {
    maxHeight: 300,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  speakerModal: {
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  timePickerModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  timePickerColumn: {
    flex: 1,
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  timePickerList: {
    maxHeight: 200,
    borderRadius: 8,
  },
  timePickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 4,
  },
  timePickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerSeparator: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 24,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
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
  speakersList: {
    maxHeight: 400,
  },
  noResultsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  noBookingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noBookingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  speakerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  speakerOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  speakerOptionAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  speakerOptionInfo: {
    flex: 1,
  },
  speakerOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  speakerOptionEmail: {
    fontSize: 13,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  accessDeniedState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  noAssignmentState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  noAssignmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  noAssignmentSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
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
  accessDeniedState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  timerSection: {
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
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  timerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  timerTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  timerCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prepSpaceIconButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerAvatar: {
    width: 49,
    height: 49,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    overflow: 'hidden',
  },
  timerAvatarImage: {
    width: '100%',
    height: '100%',
  },
  timerDetails: {
    flex: 1,
  },
  timerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1f2937',
  },
  timerRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 40,
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 17,
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
    fontSize: 11,
    fontWeight: '600',
    marginRight: 5,
  },
  tabCount: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 17,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: '600',
  },
  reportsTabContent: {
    flex: 1,
  },
  reportsSection: {
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
  reportTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    marginBottom: 8,
    gap: 8,
  },
  reportTableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportsList: {
    gap: 6,
  },
  reportTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  reportTableCell: {
    flex: 1,
    justifyContent: 'center',
  },
  reportTableNameCell: {
    flex: 2,
    justifyContent: 'center',
  },
  reportTableCenterCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTableName: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportTableCategory: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  reportTableTime: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  reportTableQualified: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  reportTableActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 50,
  },
  reportTableActionButton: {
    padding: 4,
    borderRadius: 4,
  },
  emptyReportsState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyReportsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyReportsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  inlineStopwatchContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  inlineStopwatchTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inlineStopwatchTime: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  inlineStopwatchButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    width: '100%',
  },
  inlineSwBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  inlineSwBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 4,
  },
  addTimeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addTimeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pushStopwatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  pushStopwatchBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmDivider: {
    height: 1,
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmRowDivider: {
    height: 1,
  },
  confirmRowLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmRowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  confirmQualifiedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  confirmQualifiedText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  loggedTimeSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  allButtonSection: {
    marginHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },
  allButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  allButtonText: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  categoryPillsSection: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  categoryPillsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  categoryPill: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  categoryPillText: {
    fontSize: 8.5,
    fontWeight: '600',
  },
  timerDisplayCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 7,
    padding: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1.5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  timeTextExtraLarge: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  tapToEditText: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 7,
  },
  qualifiedCard: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 18,
    borderRadius: 7,
    padding: 9,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1.5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  qualifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualifiedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  radioCircleLarge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCheckmark: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  qualifiedRadioTextLarge: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveResultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 15,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveResultButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  saveIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2.4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.8,
    elevation: 6,
  },
  personalNotesCard: {
    marginHorizontal: 16,
    marginTop: 20,
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
  prepSpaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prepSpaceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  prepSpaceTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  prepSpaceAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  readOnlyBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  stopwatchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  stopwatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stopwatchDisplay: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopwatchTime: {
    fontSize: 25,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  stopwatchButtons: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  stopwatchButton: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopwatchButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  categoryRowContainer: {
    marginTop: 16,
    marginBottom: 4,
  },
  categoryRowContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  categoryPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  logTimeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  timeBoxFull: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  timeBoxInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBoxText: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  timeBoxHint: {
    fontSize: 11,
    marginTop: 4,
  },
  qualifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qualifiedLabel: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 72,
  },
  qualifiedBtnsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  qualifiedBtnNew: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  qualifiedBtnNewText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonFull: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonFullText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    gap: 10,
  },
  categoryColumn: {
    flex: 1,
    gap: 7,
  },
  categoryHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
    paddingLeft: 2,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 9,
    borderRadius: 9,
    gap: 7,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  controlsColumn: {
    flex: 1.5,
    gap: 10,
  },
  timeCardCompact: {
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  timeDisplayCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  timeLargeText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tapToEditSmall: {
    fontSize: 7,
    fontWeight: '500',
    marginTop: 3,
  },
  qualifiedSection: {
    gap: 7,
  },
  qualifiedHeading: {
    fontSize: 10,
    fontWeight: '700',
  },
  qualifiedButtons: {
    flexDirection: 'row',
    gap: 7,
  },
  qualifiedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    gap: 5,
  },
  qualifiedBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  radioDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#3b82f6',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickActionsBoxContainer: {
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
  quickActionsContent: {
    flexDirection: 'row',
    gap: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  guestEntryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  guestEntryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestEntryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalDivider: {
    height: 1,
    marginVertical: 8,
  },
  manualNameInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 6,
  },
  timerReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  timerReviewIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerReviewTextWrap: {
    flex: 1,
  },
  timerReviewTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  timerReviewSub: {
    fontSize: 12,
    marginTop: 1,
  },
  howToOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  howToContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  howToTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginRight: 8,
  },
  howToClose: {
    padding: 4,
  },
  howToScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  howToSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14,
  },
  howToSectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  howToStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  howToStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  howToStepNumText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  howToStepContent: {
    flex: 1,
  },
  howToStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  howToStepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToBodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  howToBulletList: {
    gap: 4,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToBullet: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToNumberedList: {
    gap: 6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToNumberedItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  howToTipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
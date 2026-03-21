import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  StickyNote,
  GraduationCap,
  FileText,
  ClipboardList,
  X,
  Bell,
  UserCheck,
  Vote,
  Clock,
  BookOpen,
  Award,
  Mic,
  Settings,
  UserCog,
  LayoutDashboard,
  Calendar,
  CalendarCheck,
  MessageSquare,
  NotebookPen,
  Shield,
  Save
} from 'lucide-react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface EducationalSpeaker {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface EducationalNotesData {
  id: string;
  meeting_id: string;
  club_id: string;
  speaker_user_id: string;
  notes: string | null;
  opening_notes: string | null;
  mid_section_notes: string | null;
  closing_notes: string | null;
  speech_title: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export default function EducationalSpeakerNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [educationalSpeaker, setEducationalSpeaker] = useState<EducationalSpeaker | null>(null);
  const [notesData, setNotesData] = useState<EducationalNotesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openingNotes, setOpeningNotes] = useState('');
  const [midSectionNotes, setMidSectionNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [educationalTitle, setEducationalTitle] = useState('');
  const [educationalSummary, setEducationalSummary] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isExcomm, setIsExcomm] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'quick_access' | 'educational_session'>('educational_session');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataLoaded = useRef(false);

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
      checkExcommStatus();
    }
  }, [meetingId]);

  // Auto-save effect with debouncing (only for notes tab)
  useEffect(() => {
    if (!initialDataLoaded.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (hasUnsavedChanges) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSave();
      }, 2000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [openingNotes, midSectionNotes, closingNotes, hasUnsavedChanges]);

  const autoSave = async () => {
    if (!isEducationalSpeaker()) {
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      return;
    }

    setIsSaving(true);

    try {
      if (notesData) {
        const { error } = await supabase
          .from('app_meeting_educational_speaker')
          .update({
            opening_notes: openingNotes.trim() || null,
            mid_section_notes: midSectionNotes.trim() || null,
            closing_notes: closingNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notesData.id);

        if (error) {
          console.error('Error auto-saving:', error);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('app_meeting_educational_speaker')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            speaker_user_id: user.id,
            opening_notes: openingNotes.trim() || null,
            mid_section_notes: midSectionNotes.trim() || null,
            closing_notes: closingNotes.trim() || null,
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
      await loadEducationalNotesData();
    } catch (error) {
      console.error('Error auto-saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveEducationalSession = async () => {
    if (!isEducationalSpeaker()) {
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      return;
    }

    setIsSaving(true);

    try {
      if (notesData) {
        const { error } = await supabase
          .from('app_meeting_educational_speaker')
          .update({
            speech_title: educationalTitle.trim() || null,
            summary: educationalSummary.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notesData.id);

        if (error) {
          console.error('Error saving educational session:', error);
          Alert.alert('Error', 'Failed to save educational session');
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('app_meeting_educational_speaker')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            speaker_user_id: user.id,
            speech_title: educationalTitle.trim() || null,
            summary: educationalSummary.trim() || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating educational session:', error);
          Alert.alert('Error', 'Failed to save educational session');
          return;
        }

        if (data) {
          setNotesData(data);
        }
      }

      await loadEducationalNotesData();
      Alert.alert('Success', 'Educational session saved successfully');
    } catch (error) {
      console.error('Error saving educational session:', error);
      Alert.alert('Error', 'Failed to save educational session');
    } finally {
      setIsSaving(false);
    }
  };

  const loadNotesData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadEducationalSpeaker(),
        loadEducationalNotesData()
      ]);
      initialDataLoaded.current = true;
    } catch (error) {
      console.error('Error loading notes data:', error);
      Alert.alert('Error', 'Failed to load notes data');
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

  const loadEducationalSpeaker = async () => {
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
        .eq('role_name', 'Educational Speaker')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading educational speaker:', error);
        return;
      }

      setEducationalSpeaker(data);
    } catch (error) {
      console.error('Error loading educational speaker:', error);
    }
  };

  const loadEducationalNotesData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_educational_speaker')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading educational notes data:', error);
        return;
      }

      if (data) {
        setNotesData(data);
        setOpeningNotes(data.opening_notes || '');
        setMidSectionNotes(data.mid_section_notes || '');
        setClosingNotes(data.closing_notes || '');
        setEducationalTitle(data.speech_title || '');
        setEducationalSummary(data.summary || '');
      }
    } catch (error) {
      console.error('Error loading educational notes data:', error);
    }
  };

  const checkExcommStatus = async () => {
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

  const isEducationalSpeaker = () => {
    return educationalSpeaker?.assigned_user_id === user?.id;
  };

  const handleOpeningNotesChange = (text: string) => {
    setOpeningNotes(text);
    setHasUnsavedChanges(true);
  };

  const handleMidSectionNotesChange = (text: string) => {
    setMidSectionNotes(text);
    setHasUnsavedChanges(true);
  };

  const handleClosingNotesChange = (text: string) => {
    setClosingNotes(text);
    setHasUnsavedChanges(true);
  };

  const handleEducationalTitleChange = (text: string) => {
    setEducationalTitle(text);
  };

  const handleEducationalSummaryChange = (text: string) => {
    setEducationalSummary(text);
  };

  const handleClearEducationalTitle = () => {
    setEducationalTitle('');
  };

  const handleClearEducationalSummary = () => {
    setEducationalSummary('');
  };

  const handleClearOpeningNotes = () => {
    setOpeningNotes('');
    setHasUnsavedChanges(true);
  };

  const handleClearMidSectionNotes = () => {
    setMidSectionNotes('');
    setHasUnsavedChanges(true);
  };

  const handleClearClosingNotes = () => {
    setClosingNotes('');
    setHasUnsavedChanges(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading notes...</Text>
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

  if (!isEducationalSpeaker()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Notes are only accessible to the assigned Educational Speaker.
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContentContainer}
        >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'educational_session' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('educational_session')}
        >
          <GraduationCap size={18} color={activeTab === 'educational_session' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'educational_session' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Educational Session
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
          <StickyNote size={18} color={activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary} />
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
          <ClipboardList size={18} color={activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Quick Access
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Educational Session Tab */}
        {activeTab === 'educational_session' && (
          <View style={[styles.educationalSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.educationalHeader}>
              <View style={[styles.educationalIcon, { backgroundColor: '#f97316' + '15' }]}>
                <GraduationCap size={20} color="#f97316" />
              </View>
              <View style={styles.educationalTitleContainer}>
                <Text style={[styles.educationalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Educational Session
                </Text>
                <Text style={[styles.educationalSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Set the topic and summary for your educational session
                </Text>
              </View>
            </View>

            <View style={styles.educationalInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.educationalInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  EDUCATIONAL TITLE
                </Text>
                {educationalTitle.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearEducationalTitle}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.educationalTextInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="e.g., Effective Communication, Leadership Skills..."
                placeholderTextColor={theme.colors.textSecondary}
                value={educationalTitle}
                onChangeText={handleEducationalTitleChange}
                maxLength={200}
              />
              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {educationalTitle.length}/200
              </Text>
            </View>

            <View style={styles.educationalInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.educationalInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  SUMMARY
                </Text>
                {educationalSummary.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearEducationalSummary}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.educationalSummaryInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Describe your educational session and key learning points..."
                placeholderTextColor={theme.colors.textSecondary}
                value={educationalSummary}
                onChangeText={handleEducationalSummaryChange}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={600}
              />
              <Text
                style={[
                  styles.characterCount,
                  {
                    color: educationalSummary.trim().length < 350 && educationalSummary.trim()
                      ? '#f59e0b'
                      : educationalSummary.length > 600
                      ? '#f59e0b'
                      : theme.colors.textSecondary
                  }
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {educationalSummary.length}/600
              </Text>
              <Text style={[styles.characterHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Maximum 600 characters
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.saveEducationalButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: isSaving ? 0.7 : 1,
                }
              ]}
              onPress={saveEducationalSession}
              disabled={isSaving}
            >
              <Save size={18} color="#ffffff" />
              <Text
                style={[
                  styles.saveEducationalButtonText,
                  { color: '#ffffff' }
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {isSaving ? 'Saving...' : 'Save Educational Session'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Personal Notes Tab */}
        {activeTab === 'notes' && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.notesHeader}>
              <View style={[styles.notesIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
                <GraduationCap size={20} color="#8b5cf6" />
              </View>
              <View style={styles.notesTitleContainer}>
                <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Your Prep Space
                </Text>
                <Text style={[styles.notesSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Private notes for your educational presentation
                </Text>
              </View>
            </View>

            {/* Opening Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.educationalInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  OPENING
                </Text>
                {openingNotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearOpeningNotes}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.notesTextInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Opening remarks, introduction, welcome message..."
                placeholderTextColor={theme.colors.textSecondary}
                value={openingNotes}
                onChangeText={handleOpeningNotesChange}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={600}
              />

              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {openingNotes.length}/600
              </Text>
            </View>

            {/* Mid Section Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.educationalInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  MID SECTION
                </Text>
                {midSectionNotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearMidSectionNotes}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.notesTextInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Main content, key points, teaching moments..."
                placeholderTextColor={theme.colors.textSecondary}
                value={midSectionNotes}
                onChangeText={handleMidSectionNotesChange}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={600}
              />

              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {midSectionNotes.length}/600
              </Text>
            </View>

            {/* Closing Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.educationalInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  CLOSING
                </Text>
                {closingNotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearClosingNotes}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.notesTextInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Closing remarks, key takeaways, call to action..."
                placeholderTextColor={theme.colors.textSecondary}
                value={closingNotes}
                onChangeText={handleClosingNotesChange}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={600}
              />

              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {closingNotes.length}/600
              </Text>
            </View>

            <Text style={[styles.notesVisibility, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Visible only to you
            </Text>

            {(hasUnsavedChanges || isSaving) && (
              <View style={[styles.unsavedChangesNotice, { backgroundColor: isSaving ? '#dcfce7' : '#fef3c7' }]}>
                <Text style={[styles.unsavedChangesText, { color: isSaving ? '#16a34a' : '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Auto-saving...' : 'Auto-save pending...'}
                </Text>
              </View>
            )}

            {notesData && (
              <View style={[styles.lastSavedInfo, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.lastSavedText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Last saved: {new Date(notesData.updated_at).toLocaleString()}
                </Text>
              </View>
            )}
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

        <View style={styles.bottomPadding} />
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
  content: {
    flex: 1,
  },
  tabContentContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tabContainer: {
    borderBottomWidth: 1,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginHorizontal: 4,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  educationalSection: {
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
  educationalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  educationalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  educationalTitleContainer: {
    flex: 1,
  },
  educationalTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  educationalSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  educationalInputSection: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  educationalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  educationalTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  educationalSummaryInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 180,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  characterHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  saveEducationalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveEducationalButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  notesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  notesTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 140,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 6,
  },
  notesVisibility: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
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
    marginBottom: 24,
  },
  quickAccessTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
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
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAccessIconContainer: {
    marginBottom: 8,
  },
  quickAccessLabel: {
    fontSize: 11,
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
  bottomPadding: {
    height: 40,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

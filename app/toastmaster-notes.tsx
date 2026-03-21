import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, X, StickyNote, FileText, UserCheck, ClipboardList, Shield, Sparkles, Vote, Clock, BookOpen, Bell, Award, Mic, GraduationCap, Settings, UserCog, LayoutDashboard, CalendarCheck, MessageSquare, Calendar, Save } from 'lucide-react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface ToastmasterOfDay {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ToastmasterMeetingData {
  id: string;
  meeting_id: string;
  club_id: string;
  toastmaster_user_id: string;
  personal_notes: string | null;
  opening_notes: string | null;
  mid_section_notes: string | null;
  closure_notes: string | null;
  theme_of_the_day: string | null;
  theme_summary: string | null;
  created_at: string;
  updated_at: string;
}

export default function ToastmasterNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [toastmasterOfDay, setToastmasterOfDay] = useState<ToastmasterOfDay | null>(null);
  const [meetingData, setMeetingData] = useState<ToastmasterMeetingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openingNotes, setOpeningNotes] = useState('');
  const [midSectionNotes, setMidSectionNotes] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [themeOfTheDay, setThemeOfTheDay] = useState('');
  const [themeSummary, setThemeSummary] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedThemeChanges, setHasUnsavedThemeChanges] = useState(false);
  const [isExcomm, setIsExcomm] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'quick_access' | 'theme'>('theme');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataLoaded = useRef(false);
  const themeNamePulse = useRef(new Animated.Value(1)).current;
  const themeSummaryPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
      checkExcommStatus();
    }
  }, [meetingId]);

  // Auto-save effect with debouncing (only for notes, not theme)
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
      }, 2000); // Auto-save after 2 seconds of inactivity
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [openingNotes, midSectionNotes, closureNotes, hasUnsavedChanges]);

  useEffect(() => {
    const shouldAnimateName = themeOfTheDay.length === 0;
    const shouldAnimateSummary = themeSummary.length === 0;

    const createLoop = (value: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(value, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );

    let nameAnim: Animated.CompositeAnimation | null = null;
    let summaryAnim: Animated.CompositeAnimation | null = null;

    if (shouldAnimateName) {
      nameAnim = createLoop(themeNamePulse);
      nameAnim.start();
    } else {
      themeNamePulse.setValue(1);
    }

    if (shouldAnimateSummary) {
      summaryAnim = createLoop(themeSummaryPulse);
      summaryAnim.start();
    } else {
      themeSummaryPulse.setValue(1);
    }

    return () => {
      if (nameAnim) nameAnim.stop();
      if (summaryAnim) summaryAnim.stop();
    };
  }, [themeOfTheDay, themeSummary, themeNamePulse, themeSummaryPulse]);

  const loadNotesData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadToastmasterOfDay(),
        loadToastmasterNotesData()
      ]);
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

  const loadToastmasterOfDay = async () => {
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
        .ilike('role_name', '%toastmaster%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading toastmaster of day:', error);
        return;
      }

      setToastmasterOfDay(data);
    } catch (error) {
      console.error('Error loading toastmaster of day:', error);
    }
  };

  const loadToastmasterNotesData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('toastmaster_meeting_data')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('toastmaster_user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading toastmaster meeting data:', error);
        return;
      }

      if (data) {
        setMeetingData(data);
        setOpeningNotes(data.opening_notes || '');
        setMidSectionNotes(data.mid_section_notes || '');
        setClosureNotes(data.closure_notes || '');
        setThemeOfTheDay(data.theme_of_the_day || '');
        setThemeSummary(data.theme_summary || '');
      }
      // Reset unsaved changes flags
      setHasUnsavedChanges(false);
      setHasUnsavedThemeChanges(false);
      // Mark initial data as loaded after a short delay
      setTimeout(() => {
        initialDataLoaded.current = true;
      }, 100);
    } catch (error) {
      console.error('Error loading toastmaster meeting data:', error);
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

  // Check if current user is the Toastmaster of the Day
  const isToastmasterOfDay = () => {
    return toastmasterOfDay?.assigned_user_id === user?.id;
  };

  const handleOpeningNotesChange = (text: string) => {
    if (text.length <= 600) {
      setOpeningNotes(text);
      checkForUnsavedChanges(text, midSectionNotes, closureNotes);
    }
  };

  const handleMidSectionNotesChange = (text: string) => {
    if (text.length <= 600) {
      setMidSectionNotes(text);
      checkForUnsavedChanges(openingNotes, text, closureNotes);
    }
  };

  const handleClosureNotesChange = (text: string) => {
    if (text.length <= 600) {
      setClosureNotes(text);
      checkForUnsavedChanges(openingNotes, midSectionNotes, text);
    }
  };

  const handleThemeChange = (theme: string) => {
    if (theme.length <= 200) {
      setThemeOfTheDay(theme);
      checkForUnsavedThemeChanges(theme, themeSummary);
    }
  };

  const handleThemeSummaryChange = (summary: string) => {
    if (summary.length <= 600) {
      setThemeSummary(summary);
      checkForUnsavedThemeChanges(themeOfTheDay, summary);
    }
  };

  const checkForUnsavedChanges = (
    currentOpening: string,
    currentMid: string,
    currentClosure: string
  ) => {
    const hasChanges =
      currentOpening !== (meetingData?.opening_notes || '') ||
      currentMid !== (meetingData?.mid_section_notes || '') ||
      currentClosure !== (meetingData?.closure_notes || '');
    setHasUnsavedChanges(hasChanges);
  };

  const checkForUnsavedThemeChanges = (
    currentTheme: string,
    currentSummary: string
  ) => {
    const hasChanges =
      currentTheme !== (meetingData?.theme_of_the_day || '') ||
      currentSummary !== (meetingData?.theme_summary || '');
    setHasUnsavedThemeChanges(hasChanges);
  };

  const autoSave = async () => {
    if (!isToastmasterOfDay() || !meetingId || !user?.currentClubId || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (meetingData) {
        // Update existing record (only notes, not theme)
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            opening_notes: openingNotes.trim() || null,
            mid_section_notes: midSectionNotes.trim() || null,
            closure_notes: closureNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meetingData.id);

        if (error) {
          console.error('Error updating data:', error);
          return;
        }
      } else {
        // Create new record (only notes, not theme)
        const { data, error } = await supabase
          .from('toastmaster_meeting_data')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: user.id,
            opening_notes: openingNotes.trim() || null,
            mid_section_notes: midSectionNotes.trim() || null,
            closure_notes: closureNotes.trim() || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating data:', error);
          return;
        }

        if (data) {
          setMeetingData(data);
        }
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error auto-saving data:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const saveTheme = async () => {
    if (!isToastmasterOfDay() || !meetingId || !user?.currentClubId || isSaving) {
      return;
    }

    const charCount = themeSummary.trim().length;
    if (charCount > 400) {
      Alert.alert('Validation Error', 'Theme summary cannot exceed 400 characters.');
      return;
    }

    setIsSaving(true);

    try {
      if (meetingData) {
        // Update existing record
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            theme_of_the_day: themeOfTheDay.trim() || null,
            theme_summary: themeSummary.trim() || null,
            updated_at: updatedAt,
          })
          .eq('id', meetingData.id);

        if (error) {
          console.error('Error updating theme:', error);
          Alert.alert('Error', 'Failed to save theme. Please try again.');
          return;
        }

        // Update local state with saved values
        setMeetingData({
          ...meetingData,
          theme_of_the_day: themeOfTheDay.trim() || null,
          theme_summary: themeSummary.trim() || null,
          updated_at: updatedAt,
        });
      } else {
        // Create new record with theme only
        const { data, error } = await supabase
          .from('toastmaster_meeting_data')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: user.id,
            theme_of_the_day: themeOfTheDay.trim() || null,
            theme_summary: themeSummary.trim() || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating theme:', error);
          Alert.alert('Error', 'Failed to save theme. Please try again.');
          return;
        }

        if (data) {
          setMeetingData(data);
        }
      }

      setHasUnsavedThemeChanges(false);
      Alert.alert('Success', 'Theme saved successfully!');
    } catch (error) {
      console.error('Error saving theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearOpeningNotes = () => {
    setOpeningNotes('');
    checkForUnsavedChanges('', midSectionNotes, closureNotes);
  };

  const handleClearMidSectionNotes = () => {
    setMidSectionNotes('');
    checkForUnsavedChanges(openingNotes, '', closureNotes);
  };

  const handleClearClosureNotes = () => {
    setClosureNotes('');
    checkForUnsavedChanges(openingNotes, midSectionNotes, '');
  };

  const handleClearTheme = () => {
    setThemeOfTheDay('');
    checkForUnsavedThemeChanges('', themeSummary);
  };

  const handleClearThemeSummary = () => {
    setThemeSummary('');
    checkForUnsavedThemeChanges(themeOfTheDay, '');
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading personal notes...</Text>
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

  if (!isToastmasterOfDay()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Personal notes are only accessible to the assigned Toastmaster of the Day.
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
        <View style={styles.headerRightSpacer} />
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
            activeTab === 'theme' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('theme')}
        >
          <Sparkles size={18} color={activeTab === 'theme' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'theme' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Theme
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Theme Tab */}
        {activeTab === 'theme' && (
          <View style={[styles.themeSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.themeHeader}>
              <View style={[styles.themeIcon, { backgroundColor: '#f0e7ff' }]}>
                <Sparkles size={20} color="#8b5cf6" />
              </View>
              <View style={styles.themeTitleContainer}>
                <Text style={[styles.themeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Meeting Theme
                </Text>
                <Text style={[styles.themeSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Set the theme of the day for your meeting
                </Text>
              </View>
            </View>

            <View style={styles.themeInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.themeInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  THEME NAME
                </Text>
                {themeOfTheDay.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearTheme}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <Animated.View
                style={
                  themeOfTheDay.length === 0
                    ? [
                        styles.themeAttentionHighlight,
                        {
                          transform: [{ scale: themeNamePulse }],
                        },
                      ]
                    : undefined
                }
              >
                <TextInput
                  style={[styles.themeTextInput, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }]}
                  placeholder="e.g., Innovation, Leadership, Growth..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={themeOfTheDay}
                  onChangeText={handleThemeChange}
                  maxLength={125}
                />
              </Animated.View>
              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {themeOfTheDay.length}/125
              </Text>
            </View>

            <View style={styles.themeInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.themeInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  THEME SUMMARY
                </Text>
                {themeSummary.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearThemeSummary}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <Animated.View
                style={
                  themeSummary.length === 0
                    ? [
                        styles.themeAttentionHighlight,
                        {
                          transform: [{ scale: themeSummaryPulse }],
                        },
                      ]
                    : undefined
                }
              >
                <TextInput
                  style={[styles.themeSummaryInput, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }]}
                  placeholder="Describe the theme and how it relates to today's meeting..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={themeSummary}
                  onChangeText={handleThemeSummaryChange}
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  maxLength={400}
                />
              </Animated.View>
              <Text
                style={[
                  styles.characterCount,
                  {
                    color: themeSummary.length > 400
                      ? '#dc2626'
                      : theme.colors.textSecondary
                  }
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {themeSummary.length}/400
              </Text>
              <Text style={[styles.characterHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Maximum 400 characters
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveThemeButton,
                {
                  backgroundColor: !isSaving
                    ? theme.colors.primary
                    : theme.colors.border,
                  opacity: !isSaving ? 1 : 0.5
                }
              ]}
              onPress={saveTheme}
              disabled={isSaving}
            >
              <View style={styles.saveThemeButtonContent}>
                {!isSaving && (
                  <Save
                    size={20}
                    color="#FFFFFF"
                  />
                )}
                <Text
                  style={[
                    styles.saveThemeButtonText,
                    {
                      color: !isSaving
                        ? '#FFFFFF'
                        : theme.colors.textSecondary,
                      marginLeft: isSaving ? 0 : 8
                    }
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {isSaving ? 'Saving...' : 'Save Theme'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.notesHeader}>
              <View style={[styles.notesIcon, { backgroundColor: '#FFF4E6' }]}>
                <StickyNote size={20} color="#f59e0b" />
              </View>
              <View style={styles.notesTitleContainer}>
                <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Your Prep Notes
                </Text>
                <Text style={[styles.notesSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Private notes for your meeting. Only you can see this.
                </Text>
              </View>
            </View>

            {/* Opening Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.notesInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
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
                placeholder="Opening remarks, introductions, agenda overview..."
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
                <Text style={[styles.notesInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
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
                placeholder="Transitions, key announcements, reminders..."
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

            {/* Closure Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.notesInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                  CLOSURE
                </Text>
                {closureNotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearButton, { backgroundColor: theme.colors.border }]}
                    onPress={handleClearClosureNotes}
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
                placeholder="Closing remarks, thank yous, next meeting announcements..."
                placeholderTextColor={theme.colors.textSecondary}
                value={closureNotes}
                onChangeText={handleClosureNotesChange}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={600}
              />

              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {closureNotes.length}/600
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
  headerRightSpacer: {
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
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    fontSize: 16,
    minHeight: 120,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  notesVisibility: {
    fontSize: 13,
    lineHeight: 18,
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
  bottomPadding: {
    height: 40,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
    width: '22%',
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
  tabContainer: {
    borderBottomWidth: 1,
    maxHeight: 56,
  },
  tabContentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  themeSection: {
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
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  themeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  themeTitleContainer: {
    flex: 1,
  },
  themeTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  themeSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  themeInputSection: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  themeInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  themeSummaryInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 160,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  characterHint: {
    fontSize: 11,
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 2,
  },
  themeAttentionHighlight: {
    borderRadius: 16,
    padding: 4,
  },
  saveThemeButton: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveThemeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveThemeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
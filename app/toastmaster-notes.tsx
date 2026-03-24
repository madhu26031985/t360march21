import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, X, StickyNote, FileText } from 'lucide-react-native';
import { MeetingAgendaViewContent } from './meeting-agenda-view';

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'meeting_agenda'>('notes');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataLoaded = useRef(false);

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
    }
  }, [meetingId]);

  // Auto-save effect with debouncing
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
      }
      // Reset unsaved changes flags
      setHasUnsavedChanges(false);
      // Mark initial data as loaded after a short delay
      setTimeout(() => {
        initialDataLoaded.current = true;
      }, 100);
    } catch (error) {
      console.error('Error loading toastmaster meeting data:', error);
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

  const autoSave = async () => {
    if (!isToastmasterOfDay() || !meetingId || !user?.currentClubId || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (meetingData) {
        // Update existing record
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
        // Create new record
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
            activeTab === 'meeting_agenda' && styles.activeTab,
            { borderBottomColor: theme.colors.primary }
          ]}
          onPress={() => setActiveTab('meeting_agenda')}
        >
          <FileText size={18} color={activeTab === 'meeting_agenda' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'meeting_agenda' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Meeting Agenda
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {activeTab === 'meeting_agenda' && meetingId ? (
        <View style={styles.agendaEmbedWrap}>
          <MeetingAgendaViewContent meetingId={meetingId} embedded />
        </View>
      ) : (
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
      )}
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
  agendaEmbedWrap: {
    flex: 1,
    minHeight: 0,
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
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterCount: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
});
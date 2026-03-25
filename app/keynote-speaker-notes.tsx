import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, StickyNote, Mic, X } from 'lucide-react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface KeynoteSpeaker {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface KeynoteNotesData {
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

export default function KeynoteSpeakerNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [keynoteSpeaker, setKeynoteSpeaker] = useState<KeynoteSpeaker | null>(null);
  const [notesData, setNotesData] = useState<KeynoteNotesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openingNotes, setOpeningNotes] = useState('');
  const [midSectionNotes, setMidSectionNotes] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialDataLoaded = useRef(false);

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
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
    if (!isKeynoteSpeaker()) {
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      return;
    }

    setIsSaving(true);

    try {
      if (notesData) {
        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
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
          .from('app_meeting_keynote_speaker')
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
      await loadKeynoteNotesData();
    } catch (error) {
      console.error('Error auto-saving:', error);
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
        loadKeynoteSpeaker(),
        loadKeynoteNotesData()
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

  const loadKeynoteSpeaker = async () => {
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
        .ilike('role_name', '%keynote%')
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading keynote speaker:', error);
        return;
      }

      setKeynoteSpeaker(data);
    } catch (error) {
      console.error('Error loading keynote speaker:', error);
    }
  };

  const loadKeynoteNotesData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_keynote_speaker')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading keynote notes data:', error);
        return;
      }

      if (data) {
        setNotesData(data);
        setOpeningNotes(data.opening_notes || '');
        setMidSectionNotes(data.mid_section_notes || '');
        setClosingNotes(data.closing_notes || '');
      }
    } catch (error) {
      console.error('Error loading keynote notes data:', error);
    }
  };

  const isKeynoteSpeaker = () => {
    return keynoteSpeaker?.assigned_user_id === user?.id;
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

  if (!isKeynoteSpeaker()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Notes are only accessible to the assigned Keynote Speaker.
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.notesHeader}>
              <View style={[styles.notesIcon, { backgroundColor: '#ec4899' + '20' }]}>
                <Mic size={20} color="#ec4899" />
              </View>
              <View style={styles.notesTitleContainer}>
                <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Your Prep Space
                </Text>
                <Text style={[styles.notesSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Private notes only. Your keynote title is set in Keynote Speaker Corner.
                </Text>
              </View>
            </View>

            {/* Opening Notes */}
            <View style={styles.notesInputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={[styles.keynoteInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
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
                <Text style={[styles.keynoteInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
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
                <Text style={[styles.keynoteInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
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
  keynoteInputSection: {
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keynoteInputLabel: {
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
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
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
  bottomPadding: {
    height: 40,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

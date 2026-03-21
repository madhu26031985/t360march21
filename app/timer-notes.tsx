import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Clock, FileText, UserCheck, ClipboardList } from 'lucide-react-native';
import { Image } from 'react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
}

interface TimerRole {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface TimerNotesData {
  id: string;
  meeting_id: string;
  club_id: string;
  timer_user_id: string;
  personal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function TimerNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [timerRole, setTimerRole] = useState<TimerRole | null>(null);
  const [notesData, setNotesData] = useState<TimerNotesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'meeting_agenda' | 'attendance' | 'role_completion'>('notes');

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
    }
  }, [meetingId]);

  const loadNotesData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadTimerRole(),
        loadTimerNotesData()
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

  const loadTimerRole = async () => {
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
        .eq('role_name', 'Timer')
        .maybeSingle();

      if (error) {
        console.error('Error loading timer role:', error);
        return;
      }

      setTimerRole(data);
    } catch (error) {
      console.error('Error loading timer role:', error);
    }
  };

  const loadTimerNotesData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_timer_notes')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('timer_user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading timer notes:', error);
        return;
      }

      if (data) {
        setNotesData(data);
        setNotes(data.personal_notes || '');
      }
    } catch (error) {
      console.error('Error loading timer notes:', error);
    }
  };

  const handleSaveNotes = async () => {
    if (!meetingId || !user?.id || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);
    try {
      if (notesData?.id) {
        const { error } = await supabase
          .from('app_meeting_timer_notes')
          .update({
            personal_notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', notesData.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('app_meeting_timer_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            timer_user_id: user.id,
            personal_notes: notes
          })
          .select()
          .single();

        if (error) throw error;
        if (data) setNotesData(data);
      }

      setHasUnsavedChanges(false);
      Alert.alert('Success', 'Notes saved successfully');

      await loadTimerNotesData();
    } catch (error) {
      console.error('Error saving notes:', error);
      Alert.alert('Error', 'Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    setHasUnsavedChanges(true);
  };

  const isAssignedTimer = timerRole?.assigned_user_id === user?.id;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAssignedTimer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <Clock size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You must be the assigned Timer for this meeting to access your prep space.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
        {activeTab === 'notes' ? (
          <TouchableOpacity
            style={[
              styles.saveButtonHeader,
              {
                backgroundColor: hasUnsavedChanges ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={handleSaveNotes}
            disabled={isSaving || !hasUnsavedChanges}
          >
            <Save size={16} color={hasUnsavedChanges ? "#ffffff" : theme.colors.textSecondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContentContainer}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'notes' && styles.activeTab,
              { borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('notes')}
          >
            <FileText size={16} color={activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary} />
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
            <FileText size={16} color={activeTab === 'meeting_agenda' ? theme.colors.primary : theme.colors.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'meeting_agenda' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Agenda
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'attendance' && styles.activeTab,
              { borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('attendance')}
          >
            <UserCheck size={16} color={activeTab === 'attendance' ? theme.colors.primary : theme.colors.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'attendance' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'role_completion' && styles.activeTab,
              { borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('role_completion')}
          >
            <ClipboardList size={16} color={activeTab === 'role_completion' ? theme.colors.primary : theme.colors.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'role_completion' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Roles
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Personal Notes Tab */}
        {activeTab === 'notes' && (
          <View style={[styles.notesSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.notesHeader}>
              <View style={[styles.notesIcon, { backgroundColor: '#FFF4E6' }]}>
                <FileText size={20} color="#f59e0b" />
              </View>
              <View style={styles.notesTitleContainer}>
                <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Your Prep Space
                </Text>
                <Text style={[styles.notesSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Private notes for your meeting. Only you can see this.
                </Text>
              </View>
            </View>

            <View style={styles.notesInputSection}>
              <Text style={[styles.notesInputLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                NOTES
              </Text>

              <TextInput
                style={[styles.notesTextInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Write your notes, reminders, or speech points..."
                placeholderTextColor={theme.colors.textSecondary}
                value={notes}
                onChangeText={handleNotesChange}
                multiline
                numberOfLines={15}
                textAlignVertical="top"
                maxLength={5000}
              />

              <Text style={[styles.notesVisibility, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Visible only to you
              </Text>
            </View>

            {/* Save Status */}
            {hasUnsavedChanges && (
              <View style={[styles.unsavedChangesNotice, { backgroundColor: '#fef3c7' }]}>
                <Text style={[styles.unsavedChangesText, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                  You have unsaved changes
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Meeting Agenda Tab */}
        {activeTab === 'meeting_agenda' && meeting && (
          <View style={[styles.agendaSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.agendaHeader}>
              <View style={[styles.agendaIcon, { backgroundColor: '#10b981' + '20' }]}>
                <FileText size={20} color="#10b981" />
              </View>
              <Text style={[styles.agendaTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meeting Agenda
              </Text>
            </View>

            <Text style={[styles.agendaDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              View the meeting agenda and review your timing responsibilities for each segment.
            </Text>

            <TouchableOpacity
              style={[styles.agendaButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => router.push(`/meeting-agenda-view?meetingId=${meetingId}`)}
            >
              <FileText size={18} color="#ffffff" />
              <Text style={styles.agendaButtonText} maxFontSizeMultiplier={1.3}>View Agenda</Text>
            </TouchableOpacity>

            <View style={[styles.agendaTipBox, { backgroundColor: '#FEF3E2' }]}>
              <Text style={[styles.agendaTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                💡 Tip: Review the agenda before the meeting to stay confident and prepared.
              </Text>
            </View>
          </View>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && meeting && (
          <View style={[styles.agendaSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.agendaHeader}>
              <View style={[styles.agendaIcon, { backgroundColor: '#E8F4FD' }]}>
                <UserCheck size={20} color="#3b82f6" />
              </View>
              <Text style={[styles.agendaTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Attendance Tracking
              </Text>
            </View>

            <Text style={[styles.agendaDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Track member attendance for this meeting.
            </Text>

            <TouchableOpacity
              style={[styles.agendaButton, { backgroundColor: '#3b82f6' }]}
              onPress={() => router.push(`/attendance-details?meetingId=${meetingId}`)}
            >
              <UserCheck size={18} color="#ffffff" />
              <Text style={styles.agendaButtonText} maxFontSizeMultiplier={1.3}>View Attendance</Text>
            </TouchableOpacity>

            <View style={[styles.agendaTipBox, { backgroundColor: '#FEF3E2' }]}>
              <Text style={[styles.agendaTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                💡 Tip: Mark your attendance at the start of the meeting for accuracy.
              </Text>
            </View>
          </View>
        )}

        {/* Role Completion Tab */}
        {activeTab === 'role_completion' && meeting && (
          <View style={[styles.agendaSection, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.agendaHeader}>
              <View style={[styles.agendaIcon, { backgroundColor: '#FFF4E6' }]}>
                <ClipboardList size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.agendaTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Role Completion
              </Text>
            </View>

            <Text style={[styles.agendaDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Track role completion for all meeting roles.
            </Text>

            <TouchableOpacity
              style={[styles.agendaButton, { backgroundColor: '#f59e0b' }]}
              onPress={() => router.push(`/role-completion-report?meetingId=${meetingId}`)}
            >
              <ClipboardList size={18} color="#ffffff" />
              <Text style={styles.agendaButtonText} maxFontSizeMultiplier={1.3}>View Role Completion</Text>
            </TouchableOpacity>

            <View style={[styles.agendaTipBox, { backgroundColor: '#FEF3E2' }]}>
              <Text style={[styles.agendaTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                💡 Tip: Keep track of which roles have been completed during the meeting.
              </Text>
            </View>
          </View>
        )}
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
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  saveButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  notesSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  notesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notesTitleContainer: {
    flex: 1,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  notesSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  notesInputSection: {
    marginBottom: 16,
  },
  notesInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  notesTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 250,
    lineHeight: 22,
    marginBottom: 8,
  },
  notesVisibility: {
    fontSize: 12,
  },
  unsavedChangesNotice: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 4,
  },
  unsavedChangesText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabsContentContainer: {
    gap: 0,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  agendaSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  agendaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agendaTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  agendaDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  agendaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  agendaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  agendaTipBox: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  agendaTipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});

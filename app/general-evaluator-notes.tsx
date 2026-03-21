import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Save,
  FileText,
  UserCheck,
  ClipboardList,
  Bell,
  Award,
  Mic,
  GraduationCap,
  Settings,
  UserCog,
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  Calendar,
  Vote,
  Clock,
  BookOpen,
  Shield
} from 'lucide-react-native';
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

interface GeneralEvaluator {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface GeneralEvaluatorData {
  id: string;
  meeting_id: string;
  club_id: string;
  evaluator_user_id: string;
  personal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function GeneralEvaluatorNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [generalEvaluator, setGeneralEvaluator] = useState<GeneralEvaluator | null>(null);
  const [evaluatorData, setEvaluatorData] = useState<GeneralEvaluatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'quick_access'>('notes');
  const [isExcomm, setIsExcomm] = useState<boolean>(false);

  useEffect(() => {
    if (meetingId) {
      loadNotesData();
      checkExcommStatus();
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
        loadGeneralEvaluator(),
        loadEvaluatorData()
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

  const loadGeneralEvaluator = async () => {
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
        .ilike('role_name', '%general evaluator%')
        .eq('role_status', 'Available')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading general evaluator:', error);
        return;
      }

      setGeneralEvaluator(data);
    } catch (error) {
      console.error('Error loading general evaluator:', error);
    }
  };

  const loadEvaluatorData = async () => {
    if (!meetingId || !user?.id) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_ge')
        .select('id, meeting_id, club_id, evaluator_user_id, personal_notes, created_at, updated_at')
        .eq('meeting_id', meetingId)
        .eq('evaluator_user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading evaluator data:', error);
        return;
      }

      if (data) {
        setEvaluatorData(data);
        setNotes(data.personal_notes || '');
      }
    } catch (error) {
      console.error('Error loading evaluator data:', error);
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

  // Check if current user is the General Evaluator
  const isGeneralEvaluator = () => {
    return generalEvaluator?.assigned_user_id === user?.id;
  };

  const handleNotesChange = (text: string) => {
    setNotes(text);
    setHasUnsavedChanges(text !== (evaluatorData?.personal_notes || ''));
  };

  const handleSaveNotes = async () => {
    if (!isGeneralEvaluator()) {
      Alert.alert('Access Denied', 'Only the assigned General Evaluator can save personal notes.');
      return;
    }

    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);
    
    try {
      if (evaluatorData) {
        // Update existing evaluator record with personal notes
        const { error } = await supabase
          .from('app_meeting_ge')
          .update({
            personal_notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', evaluatorData.id);

        if (error) {
          console.error('Error updating personal notes:', error);
          Alert.alert('Error', 'Failed to update personal notes');
          return;
        }

        Alert.alert('Success', 'Personal notes updated successfully');
      } else {
        // Create new evaluator record with personal notes
        const { error } = await supabase
          .from('app_meeting_ge')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            evaluator_user_id: user.id,
            personal_notes: notes.trim() || null,
            evaluation_data: {},
            is_completed: false,
          });

        if (error) {
          console.error('Error creating personal notes:', error);
          Alert.alert('Error', 'Failed to save personal notes');
          return;
        }

        Alert.alert('Success', 'Personal notes saved successfully');
      }

      setHasUnsavedChanges(false);
      // Reload notes to get updated data
      await loadEvaluatorData();
    } catch (error) {
      console.error('Error saving personal notes:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
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

  if (!isGeneralEvaluator()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <FileText size={64} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You must be the assigned General Evaluator for this meeting to access your prep space.
          </Text>
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
        {activeTab === 'notes' ? (
          <TouchableOpacity
            style={[
              styles.saveButton,
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
              activeTab === 'quick_access' && styles.activeTab,
              { borderBottomColor: theme.colors.primary }
            ]}
            onPress={() => setActiveTab('quick_access')}
          >
            <ClipboardList size={16} color={activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary} />
            <Text style={[
              styles.tabText,
              { color: activeTab === 'quick_access' ? theme.colors.primary : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              Quick Access
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Notes Tab */}
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
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
});
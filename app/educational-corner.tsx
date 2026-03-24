import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import {
  ArrowLeft,
  GraduationCap,
  NotebookPen,
  FileText,
  Bell,
  Users,
  Calendar,
  BookOpen,
  Eye,
  Vote,
  Mic,
  CheckSquare,
  MessageSquare,
  Clock,
  LayoutDashboard,
  UserCog,
  Settings,
  Star,
  Crown,
  FileBarChart
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
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
  club_name?: string;
}

interface UserProfile {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface EducationalSpeaker {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string; // Added booking_status to EducationalSpeaker interface
  speech_title: string | null;
  summary: string | null; // Changed from educational_details
  notes: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

/**
 * Educational Corner Component
 * Displays Educational Speaker assignment and allows adding speech details
 */
export default function EducationalCorner(): JSX.Element {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [educationalSpeaker, setEducationalSpeaker] = useState<EducationalSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExComm, setIsExComm] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [bookingEducationalRole, setBookingEducationalRole] = useState(false);

  // Load data on component mount
  useEffect(() => {
    if (meetingId) {
      loadEducationalCornerData();
    }
  }, [meetingId]);

  // Reload educational speaker data when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      // Always refresh when coming back to this screen
      if (meetingId && user?.id) {
        loadEducationalSpeaker();
      }
    }, [meetingId, user?.id])
  );

  /**
   * Load all educational corner data
   */
  const loadEducationalCornerData = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadEducationalSpeaker(),
        checkUserRole(),
      ]);
    } catch (error) {
      console.error('Error loading educational corner data:', error);
      Alert.alert('Error', 'Failed to load educational corner data');
    } finally {
      setIsLoading(false);
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
        .select(`
          *,
          clubs!inner(name)
        `)
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      // Flatten the club data
      const meetingData: Meeting = {
        ...data,
        club_name: (data as any).clubs?.name
      };

      setMeeting(meetingData);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  /**
   * Load Educational Speaker assignment and its details
   */
  const handleBookEducationalSpeakerInline = async (): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingEducationalRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { eqRoleName: 'Educational Speaker' },
        'Educational Speaker is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadEducationalSpeaker();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingEducationalRole(false);
    }
  };

  const loadEducationalSpeaker = async (): Promise<void> => {
    if (!meetingId || !user?.id) return;

    try {
      // Step 1: Load the Educational Speaker assignment from app_meeting_roles_management
      const { data: roleAssignment, error: roleError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
          role_status,
          role_classification,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_name', 'Educational Speaker')
        .eq('booking_status', 'booked') // Ensure it's a booked assignment
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error loading educational speaker role assignment:', roleError);
        setEducationalSpeaker(null);
        setEducationalForm({ title: '', summary: '' });
        return;
      }

      if (roleAssignment) {
        // Found an assigned Educational Speaker
        const speakerData: EducationalSpeaker = {
          id: roleAssignment.id,
          role_name: roleAssignment.role_name,
          assigned_user_id: roleAssignment.assigned_user_id,
          booking_status: roleAssignment.booking_status,
          app_user_profiles: roleAssignment.app_user_profiles,
          speech_title: null, // Initialize to null
          summary: null,      // Initialize to null
          notes: null,        // Initialize to null
        };

        // Step 2: Load educational content for the assigned speaker (if any)
        if (roleAssignment.assigned_user_id) { // Removed the check for user.id
          const { data: educationalContent, error: contentError } = await supabase
            .from('app_meeting_educational_speaker')
            .select('speech_title, summary, notes')
            .eq('meeting_id', meetingId)
            .eq('speaker_user_id', roleAssignment.assigned_user_id) // Use assigned_user_id
            .maybeSingle();

          if (contentError && contentError.code !== 'PGRST116') {
            console.error('Error loading educational content:', contentError);
          }

          if (educationalContent) {
            speakerData.speech_title = educationalContent.speech_title;
            speakerData.summary = educationalContent.summary;
            speakerData.notes = educationalContent.notes;
          }
        }

        setEducationalSpeaker(speakerData);
      } else {
        // No Educational Speaker assigned for this meeting
        setEducationalSpeaker(null);
      }
    } catch (error) {
      console.error('Error in loadEducationalSpeaker:', error);
      setEducationalSpeaker(null);
    }
  };

  /**
   * Check if current user is ExComm
   */
  const checkUserRole = async (): Promise<void> => {
    if (!user?.id || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading user role:', error);
        return;
      }

      setIsExComm(data?.role === 'excomm');
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  /**
   * Check if current user is the Educational Speaker
   */
  const isEducationalSpeaker = (): boolean => {
    return educationalSpeaker?.assigned_user_id === user?.id;
  };

  /**
   * Check if Educational Title and Summary are both added
   */
  const hasTitleAndSummary = (): boolean => {
    return !!(educationalSpeaker?.speech_title?.trim() && educationalSpeaker?.summary?.trim());
  };

  const EDUCATIONAL_CONGRATS_SEEN_KEY = meetingId ? `educationalCongratsSeen_${meetingId}` : null;

  useEffect(() => {
    if (isLoading || !meeting || !isEducationalSpeaker() || hasTitleAndSummary() || !EDUCATIONAL_CONGRATS_SEEN_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(EDUCATIONAL_CONGRATS_SEEN_KEY);
        if (!cancelled && !seen) setShowCongratsModal(true);
      } catch {
        if (!cancelled) setShowCongratsModal(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, meeting, educationalSpeaker?.assigned_user_id, educationalSpeaker?.speech_title, educationalSpeaker?.summary, EDUCATIONAL_CONGRATS_SEEN_KEY]);

  const dismissCongratsModal = useCallback(() => {
    if (EDUCATIONAL_CONGRATS_SEEN_KEY) {
      AsyncStorage.setItem(EDUCATIONAL_CONGRATS_SEEN_KEY, '1').catch(() => {});
    }
    setShowCongratsModal(false);
  }, [EDUCATIONAL_CONGRATS_SEEN_KEY]);

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

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Loading Educational Corner...
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

  // Main render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Educational Corner
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
      >
        {/* Meeting Card */}
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

        {/* Educational Speaker Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          {educationalSpeaker?.assigned_user_id && educationalSpeaker.app_user_profiles ? (
            <>
              <View style={styles.speakerCard}>
                <View style={styles.speakerInfo}>
                  <View style={styles.speakerAvatar}>
                    {educationalSpeaker.app_user_profiles.avatar_url ? (
                      <Image
                        source={{ uri: educationalSpeaker.app_user_profiles.avatar_url }}
                        style={styles.speakerAvatarImage}
                      />
                    ) : (
                      <GraduationCap size={16} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.speakerDetails}>
                    <Text style={[styles.speakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {educationalSpeaker.app_user_profiles.full_name}
                    </Text>
                    <Text style={[styles.speakerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Educational speaker
                    </Text>
                  </View>
                  {isEducationalSpeaker() && (
                    <TouchableOpacity
                      style={[styles.notesIconButton, { backgroundColor: '#8b5cf6' + '15' }]}
                      onPress={() => router.push({
                        pathname: '/educational-speaker-notes',
                        params: { meetingId: meeting?.id }
                      })}
                    >
                      <NotebookPen size={18} color="#8b5cf6" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noSpeakerCard}>
              <View style={[styles.noSpeakerIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <GraduationCap size={32} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.noSpeakerText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                The stage is yours — make it count.
              </Text>
              <TouchableOpacity
                style={[
                  styles.bookSpeakerButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: bookingEducationalRole ? 0.85 : 1,
                  },
                ]}
                onPress={() => handleBookEducationalSpeakerInline()}
                disabled={bookingEducationalRole}
              >
                {bookingEducationalRole ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.bookSpeakerButtonText} maxFontSizeMultiplier={1.3}>
                    Book Educational Speaker Role
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Educational Speech Content Section - Only show when Educational Speaker is assigned */}
        {educationalSpeaker?.assigned_user_id && (
          educationalSpeaker.speech_title && educationalSpeaker.summary ? (
            <View style={[styles.educationalDisplayCard, { backgroundColor: theme.colors.surface }]}>
              {/* Header with emoji */}
              <View style={styles.educationalDisplayHeader}>
                <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
                <Text style={[styles.educationalDisplayHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  EDUCATIONAL SPEECH
                </Text>
                <Text style={styles.educationalHeaderEmoji} maxFontSizeMultiplier={1.3}>🎓</Text>
                <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
              </View>

              <View style={styles.educationalDisplayDivider} />

              {/* Speech Title */}
              <Text style={[styles.educationalDisplayTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {educationalSpeaker.speech_title}
              </Text>

              {/* Summary */}
              <Text style={[styles.educationalDisplaySummary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {educationalSpeaker.summary}
              </Text>

              <View style={styles.educationalDisplayDivider} />

              {/* Speaker Info at Bottom */}
              {educationalSpeaker.app_user_profiles && (
                <View style={styles.educationalDisplaySpeaker}>
                  <View style={styles.educationalDisplaySpeakerAvatar}>
                    {educationalSpeaker.app_user_profiles.avatar_url ? (
                      <Image
                        source={{ uri: educationalSpeaker.app_user_profiles.avatar_url }}
                        style={styles.educationalDisplayAvatarImage}
                      />
                    ) : (
                      <GraduationCap size={24} color="#f97316" />
                    )}
                  </View>
                  <View style={styles.educationalDisplaySpeakerInfo}>
                    <Text style={[styles.educationalDisplaySpeakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {educationalSpeaker.app_user_profiles.full_name}
                    </Text>
                    <Text style={[styles.educationalDisplaySpeakerRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Educational Speaker
                    </Text>
                    {meeting?.club_name && (
                      <Text style={[styles.educationalDisplayClubName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {meeting.club_name}
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Title Box */}
              <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                {!(isEducationalSpeaker() && !hasTitleAndSummary()) && (
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: '#f97316' + '20' }]}>
                      <GraduationCap size={20} color="#f97316" />
                    </View>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Speech</Text>
                  </View>
                )}

                {educationalSpeaker?.speech_title ? (
                  <Text style={[styles.speechContentTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {educationalSpeaker.speech_title}
                  </Text>
                ) : isEducationalSpeaker() && !hasTitleAndSummary() ? (
                  <View style={styles.educationalInstructionsCard}>
                    <Text style={[styles.educationalInstructionsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Congrats {user?.fullName?.split(' ')[0] || 'there'}! 🎉
                    </Text>
                    <Text style={[styles.educationalInstructionsBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Great step in leading the educational session. Add your{' '}
                      <Text style={styles.educationalInstructionsHighlight}>Educational Title</Text>
                      {' '}and a short{' '}
                      <Text style={styles.educationalInstructionsHighlight}>summary</Text>
                      {' '}by opening the Educational Session tab in Your Prep Space to help members understand the context and what to expect.
                    </Text>
                    <Text style={[styles.educationalInstructionsBody, { color: theme.colors.textSecondary, marginTop: 12 }]} maxFontSizeMultiplier={1.3}>
                      You can also add personal notes to prepare and organize your thoughts. These are visible only to you. Use the quick access button to jump to the agenda easily.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.educationalComingSoonCard}>
                    <Text style={[styles.educationalComingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Get ready for an insightful knowledge-sharing session by the Educational Speaker — coming soon.
                    </Text>
                  </View>
                )}
              </View>

              {/* Summary Box - Only show if there's a title but no summary */}
              {educationalSpeaker?.speech_title && (
                educationalSpeaker.summary ? (
                  <View style={[styles.summarySectionCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.summarySectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      SUMMARY
                    </Text>
                    <Text style={[styles.summarySectionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {educationalSpeaker.summary}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.emptyStateSummaryBox, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.emptyStateCard}>
                      <View style={[styles.emptyStateIcon, { backgroundColor: '#FEF3E2' }]}>
                        <Text style={styles.emptyStateEmoji} maxFontSizeMultiplier={1.3}>📝</Text>
                      </View>
                      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        No Summary Added
                      </Text>
                      <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Add a summary to explain the educational topic
                      </Text>
                    </View>
                  </View>
                )
              )}
            </>
          )
        )}

        {/* Footer Navigation - Show when NO Educational Speaker assigned */}
        {!educationalSpeaker?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 'auto',
            marginBottom: 16,
          }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                  <FileText size={20} color="#f59e0b" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF4E6' }]}>
                  <Star size={20} color="#f59e0b" fill="#f59e0b" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TMOD</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Users size={20} color="#ec4899" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E6EFF4' }]}>
                  <Calendar size={20} color="#004165" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <BookOpen size={20} color="#16a34a" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF7ED' }]}>
                  <Star size={20} color="#ea580c" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                  <NotebookPen size={20} color="#4f46e5" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Mic size={20} color="#ec4899" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                  <CheckSquare size={20} color="#9333ea" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEFBF0' }]}>
                  <FileBarChart size={20} color="#C9B84E" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E6F4FF' }]}>
                  <Clock size={20} color="#0369a1" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FFF1F2' }]}>
                  <MessageSquare size={20} color="#e11d48" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#F9E8EB' }]}>
                  <Bell size={20} color="#772432" />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
              </TouchableOpacity>

              {/* ExComm-Only Admin Icons */}
              {isExComm && (
                <>
                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => router.push('/admin/voting-operations')}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#EDE9FE' }]}>
                      <Vote size={20} color="#8b5cf6" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting Ops</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => router.push('/admin/meeting-management')}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                      <LayoutDashboard size={20} color="#3b82f6" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => router.push('/admin/manage-club-users')}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                      <UserCog size={20} color="#f59e0b" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => router.push('/admin/club-operations')}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Settings size={20} color="#10b981" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Ops</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionItem}
                    onPress={() => router.push('/admin/excomm-corner')}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                      <Crown size={20} color="#ec4899" />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>ExComm</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )}

        {/* Footer Navigation - Only show when Educational Speaker is assigned */}
        {educationalSpeaker?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 24,
            marginBottom: 16,
          }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.footerNavigationContent}
            >
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <Bell size={20} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={20} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                <Calendar size={20} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                <BookOpen size={20} color="#16a34a" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FFF7ED' }]}>
                <Eye size={20} color="#ea580c" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                <NotebookPen size={20} color="#4f46e5" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                <Vote size={20} color="#a855f7" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/speeches-delivered' })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Mic size={20} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/roles-completed' })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#ECFDF5' }]}>
                <CheckSquare size={20} color="#059669" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Roles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDFA' }]}>
                <MessageSquare size={20} color="#0d9488" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Clock size={20} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/club-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F5F3FF' }]}>
                <LayoutDashboard size={20} color="#7c3aed" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/manage-club-users')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FDF2F8' }]}>
                <UserCog size={20} color="#db2777" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/meeting-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                <Settings size={20} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/voting-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <CheckSquare size={20} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        )}

      </ScrollView>

      {/* Congrats Educational Speaker modal - shown once per meeting when title/summary not added */}
      <Modal
        visible={showCongratsModal}
        transparent
        animationType="fade"
        onRequestClose={dismissCongratsModal}
      >
        <TouchableOpacity
          style={styles.congratsModalOverlay}
          activeOpacity={1}
          onPress={dismissCongratsModal}
        >
          <TouchableOpacity
            style={[styles.congratsModalContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={[styles.congratsModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Congrats {user?.fullName?.split(' ')[0] || 'there'}! 🎉
            </Text>
            <Text style={[styles.congratsModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              You're the Educational Speaker, leading a knowledge-sharing session. Add your{' '}
              <Text style={styles.congratsModalHighlight}>Educational Title</Text>
              {' '}and{' '}
              <Text style={styles.congratsModalHighlight}>summary</Text>
              {' '}to set the stage!
            </Text>
            <TouchableOpacity
              style={[styles.congratsModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={dismissCongratsModal}
            >
              <Text style={styles.congratsModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
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
  section: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  speakerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
    marginBottom: 16,
  },
  speakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  speakerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  speakerAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  speakerDetails: {
    flex: 1,
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  speakerRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  notesIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  speakerEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  speakerRole: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  speakerRoleText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  noSpeakerCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noSpeakerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noSpeakerText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  bookSpeakerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  bookSpeakerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  speechContent: {
    marginTop: 16,
  },
  speechContentTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 26,
  },
  summarySectionCard: {
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f97316',
  },
  summarySectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summarySectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  educationalInstructionsCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  educationalInstructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  educationalInstructionsBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
  },
  educationalInstructionsHighlight: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  congratsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  congratsModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  congratsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  congratsModalMessage: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  congratsModalHighlight: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  congratsModalButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  congratsModalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  educationalComingSoonCard: {
    position: 'relative',
    alignItems: 'flex-start',
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  educationalComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  educationalDisplayCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  educationalDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  educationalDisplayHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  decorativeSparkleSmall: {
    fontSize: 16,
  },
  educationalHeaderEmoji: {
    fontSize: 18,
  },
  educationalDisplayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  educationalDisplayTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  educationalDisplaySummary: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 0,
  },
  educationalDisplaySpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  educationalDisplaySpeakerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  educationalDisplayAvatarImage: {
    width: '100%',
    height: '100%',
  },
  educationalDisplaySpeakerInfo: {
    flex: 1,
  },
  educationalDisplaySpeakerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  educationalDisplaySpeakerRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  educationalDisplayClubName: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyStateSummaryBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateEmoji: {
    fontSize: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
  footerNavigationInline: {
    paddingVertical: 16,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionsBoxContainer: {
    paddingHorizontal: 8,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  footerNavIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});

import React, { useState, useEffect, useCallback } from 'react';
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
  Mic,
  Edit3,
  Plus,
  FileText,
  Star,
  Users,
  Calendar,
  BookOpen,
  CheckSquare,
  Clock,
  MessageSquare,
  MessageCircle,
  Bell,
  Vote,
  LayoutDashboard,
  UserCog,
  Settings,
  Crown,
  FileBarChart,
  NotebookPen,
  Eye,
  ClipboardCheck
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
}

interface UserProfile {
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface KeynoteSpeaker {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status: string;
  speech_title: string | null;
  summary: string | null;
  notes: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ClubInfo {
  name: string;
  club_number: string | null;
}

/**
 * Keynote Speaker Corner Component
 * Displays Keynote Speaker assignment and allows adding speech details
 */
export default function KeynoteSpeakerCorner(): JSX.Element {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [keynoteSpeaker, setKeynoteSpeaker] = useState<KeynoteSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExComm, setIsExComm] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [bookingKeynoteRole, setBookingKeynoteRole] = useState(false);

  // Load data on component mount
  useEffect(() => {
    if (meetingId) {
      loadKeynoteSpeakerCornerData();
    }
  }, [meetingId]);

  // Reload keynote speaker data when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      if (meetingId && user?.id) {
        loadKeynoteSpeaker();
      }
    }, [meetingId, user?.id])
  );

  /**
   * Load all keynote speaker corner data
   */
  const loadKeynoteSpeakerCornerData = async (): Promise<void> => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadKeynoteSpeaker(),
        checkUserRole(),
        loadClubInfo(),
      ]);
    } catch (error) {
      console.error('Error loading keynote speaker corner data:', error);
      Alert.alert('Error', 'Failed to load keynote speaker corner data');
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

  const handleBookKeynoteSpeakerInline = async (): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingKeynoteRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%keynote speaker%' },
        'Keynote Speaker is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadKeynoteSpeaker();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingKeynoteRole(false);
    }
  };

  /**
   * Load Keynote Speaker assignment and its details
   */
  const loadKeynoteSpeaker = async (): Promise<void> => {
    if (!meetingId || !user?.id) return;

    try {
      // Step 1: Load the Keynote Speaker assignment from app_meeting_roles_management
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
        .ilike('role_name', '%keynote speaker%')
        .eq('booking_status', 'booked')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error loading keynote speaker role assignment:', roleError);
        setKeynoteSpeaker(null);
        return;
      }

      if (roleAssignment) {
        // Found an assigned Keynote Speaker
        const speakerData: KeynoteSpeaker = {
          id: roleAssignment.id,
          role_name: roleAssignment.role_name,
          assigned_user_id: roleAssignment.assigned_user_id,
          booking_status: roleAssignment.booking_status,
          app_user_profiles: roleAssignment.app_user_profiles,
          speech_title: null,
          summary: null,
          notes: null,
        };

        // Step 2: Load keynote content for the assigned speaker (if any)
        if (roleAssignment.assigned_user_id) {
          const { data: keynoteContent, error: contentError } = await supabase
            .from('app_meeting_keynote_speaker')
            .select('speech_title, summary, notes')
            .eq('meeting_id', meetingId)
            .eq('speaker_user_id', roleAssignment.assigned_user_id)
            .maybeSingle();

          if (contentError && contentError.code !== 'PGRST116') {
            console.error('Error loading keynote content:', contentError);
          }

          if (keynoteContent) {
            speakerData.speech_title = keynoteContent.speech_title;
            speakerData.summary = keynoteContent.summary;
            speakerData.notes = keynoteContent.notes;
          }
        }

        setKeynoteSpeaker(speakerData);
      } else {
        // No Keynote Speaker assigned for this meeting
        setKeynoteSpeaker(null);
      }
    } catch (error) {
      console.error('Error in loadKeynoteSpeaker:', error);
      setKeynoteSpeaker(null);
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
   * Load club information
   */
  const loadClubInfo = async (): Promise<void> => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('name, club_number')
        .eq('id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      if (data) {
        setClubInfo(data);
      }
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  /**
   * Check if current user is the Keynote Speaker
   */
  const isKeynoteSpeaker = (): boolean => {
    return keynoteSpeaker?.assigned_user_id === user?.id;
  };

  /**
   * Check if Keynote Title and Summary are both added
   */
  const hasTitleAndSummary = (): boolean => {
    return !!(keynoteSpeaker?.speech_title?.trim() && keynoteSpeaker?.summary?.trim());
  };

  const KEYNOTE_CONGRATS_SEEN_KEY = meetingId ? `keynoteCongratsSeen_${meetingId}` : null;

  useEffect(() => {
    if (isLoading || !meeting || !isKeynoteSpeaker() || hasTitleAndSummary() || !KEYNOTE_CONGRATS_SEEN_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(KEYNOTE_CONGRATS_SEEN_KEY);
        if (!cancelled && !seen) setShowCongratsModal(true);
      } catch {
        if (!cancelled) setShowCongratsModal(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, meeting, keynoteSpeaker?.assigned_user_id, keynoteSpeaker?.speech_title, keynoteSpeaker?.summary, KEYNOTE_CONGRATS_SEEN_KEY]);

  const dismissCongratsModal = useCallback(() => {
    if (KEYNOTE_CONGRATS_SEEN_KEY) {
      AsyncStorage.setItem(KEYNOTE_CONGRATS_SEEN_KEY, '1').catch(() => {});
    }
    setShowCongratsModal(false);
  }, [KEYNOTE_CONGRATS_SEEN_KEY]);

  /**
   * Handle adding/editing keynote content
   */
  const handleAddKeynoteContent = (): void => {
    if (!isKeynoteSpeaker()) {
      Alert.alert('Access Denied', 'Only the assigned Keynote Speaker can add content.');
      return;
    }

    router.push({
      pathname: '/keynote-speaker-form',
      params: {
        meetingId: meeting?.id,
        speechTitle: keynoteSpeaker?.speech_title || '',
        summary: keynoteSpeaker?.summary || '',
      }
    });
  };

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
            Loading Keynote Speaker Corner...
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Keynote Speaker Corner
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
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

        {/* Keynote Speaker Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          {keynoteSpeaker?.assigned_user_id && keynoteSpeaker.app_user_profiles ? (
            <>
              <View style={styles.speakerCard}>
                <View style={styles.speakerInfo}>
                  <View style={styles.speakerAvatar}>
                    {keynoteSpeaker.app_user_profiles.avatar_url ? (
                      <Image
                        source={{ uri: keynoteSpeaker.app_user_profiles.avatar_url }}
                        style={styles.speakerAvatarImage}
                      />
                    ) : (
                      <Mic size={16} color="#ffffff" />
                    )}
                  </View>
                  <View style={styles.speakerDetails}>
                    <Text style={[styles.speakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {keynoteSpeaker.app_user_profiles.full_name}
                    </Text>
                    <Text style={[styles.speakerRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Keynote speaker
                    </Text>
                  </View>
                  {isKeynoteSpeaker() && (
                    <TouchableOpacity
                      style={[styles.notesIconButton, { backgroundColor: '#f59e0b' + '15' }]}
                      onPress={() => router.push({
                        pathname: '/keynote-speaker-notes',
                        params: { meetingId: meeting?.id }
                      })}
                    >
                      <NotebookPen size={18} color="#f59e0b" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noSpeakerCard}>
              <View style={[styles.noSpeakerIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <Mic size={32} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.noSpeakerText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Inspire, Engage, Elevate
              </Text>
              <Text style={[styles.noSpeakerSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Your voice matters! 🎤
              </Text>
              <TouchableOpacity
                style={[
                  styles.bookSpeakerButton,
                  {
                    backgroundColor: theme.colors.primary,
                    opacity: bookingKeynoteRole ? 0.85 : 1,
                  },
                ]}
                onPress={() => handleBookKeynoteSpeakerInline()}
                disabled={bookingKeynoteRole}
              >
                {bookingKeynoteRole ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.bookSpeakerButtonText} maxFontSizeMultiplier={1.3}>
                    Book Keynote Speaker Role
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Keynote Speech Content Section - Only show when Keynote Speaker is assigned */}
        {keynoteSpeaker?.assigned_user_id && (
          <>
            {keynoteSpeaker.speech_title && keynoteSpeaker.summary ? (
              <View style={[styles.keynoteDisplayCard, { backgroundColor: '#ffffff' }]}>
                {/* Decorative Header */}
                <View style={styles.keynoteDisplayHeader}>
                  <Text style={styles.keynoteHeaderEmoji} maxFontSizeMultiplier={1.3}>🎤</Text>
                  <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
                  <Text style={[styles.keynoteDisplayHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    KEYNOTE SPEECH
                  </Text>
                  <Text style={styles.keynoteHeaderEmoji} maxFontSizeMultiplier={1.3}>🎤</Text>
                  <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
                </View>

                <View style={styles.keynoteDisplayDivider} />

                {/* Speech Title */}
                <Text style={[styles.keynoteDisplayTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {keynoteSpeaker.speech_title}
                </Text>

                {/* Speech Summary */}
                <Text style={[styles.keynoteDisplaySummary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {keynoteSpeaker.summary}
                </Text>

                <View style={styles.keynoteDisplayDivider} />

                {/* Keynote Speaker Info at Bottom */}
                {keynoteSpeaker.app_user_profiles && (
                  <View style={styles.keynoteDisplaySpeaker}>
                    <View style={styles.keynoteDisplaySpeakerAvatar}>
                      {keynoteSpeaker.app_user_profiles.avatar_url ? (
                        <Image
                          source={{ uri: keynoteSpeaker.app_user_profiles.avatar_url }}
                          style={styles.keynoteDisplayAvatarImage}
                        />
                      ) : (
                        <Mic size={24} color="#f59e0b" />
                      )}
                    </View>
                    <View style={styles.keynoteDisplaySpeakerInfo}>
                      <Text style={[styles.keynoteDisplaySpeakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {keynoteSpeaker.app_user_profiles.full_name}
                      </Text>
                      <Text style={[styles.keynoteDisplaySpeakerRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Keynote Speaker
                      </Text>
                      {clubInfo?.name && (
                        <Text style={[styles.keynoteDisplayClubName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {clubInfo.name}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Keynote Speech Title Box */}
                <View style={[styles.section, { backgroundColor: '#ffffff' }]}>
                  {!(isKeynoteSpeaker() && !hasTitleAndSummary()) && (
                    <View style={styles.keynoteHeaderRow}>
                      <View style={[styles.keynoteHeaderIcon, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={styles.keynoteHeaderEmoji} maxFontSizeMultiplier={1.3}>🎤</Text>
                      </View>
                      <Text style={[styles.keynoteHeaderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speech</Text>
                    </View>
                  )}

                  {isKeynoteSpeaker() && !hasTitleAndSummary() ? (
                    <View style={styles.keynoteInstructionsCard}>
                      <Text style={[styles.keynoteInstructionsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Congrats {user?.fullName?.split(' ')[0] || 'there'}! 🎉
                      </Text>
                      <Text style={[styles.keynoteInstructionsBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Great step in leading the keynote session. Add your{' '}
                        <Text style={styles.keynoteInstructionsHighlight}>Keynote Title</Text>
                        {' '}and a short{' '}
                        <Text style={styles.keynoteInstructionsHighlight}>summary</Text>
                        {' '}by opening the Keynote Speech tab in Your Prep Space to help members understand the context and what to expect.
                      </Text>
                      <Text style={[styles.keynoteInstructionsBody, { color: theme.colors.textSecondary, marginTop: 12 }]} maxFontSizeMultiplier={1.3}>
                        You can also add personal notes to prepare and organize your thoughts. These are visible only to you. Use the quick access button to jump to the agenda easily.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.keynoteComingSoonCard}>
                      <Text style={[styles.keynoteComingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Get ready for a powerful experience story by the Keynote Speaker — coming soon.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* Footer Navigation - Show when Keynote Speaker IS assigned */}
        {keynoteSpeaker?.assigned_user_id && (
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
              onPress={() => router.push({ pathname: '/educational-speaker-details', params: { meetingId: meeting?.id } })}
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
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
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
                <Vote size={20} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Footer Navigation - Show when NO Keynote Speaker assigned */}
        {!keynoteSpeaker?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            marginTop: 24,
            marginBottom: 16,
          }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerNavigationContent}>
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
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Mic size={20} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6F4FF' }]}>
                <Clock size={20} color="#0369a1" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FFF1F2' }]}>
                <MessageCircle size={20} color="#e11d48" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                <Mic size={20} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/admin/voting-operations' })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <ClipboardCheck size={20} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
            </TouchableOpacity>

            {isExComm && (
              <>
                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/admin/club-operations')}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Settings size={20} color="#10b981" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/admin/meeting-management')}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#DBEAFE' }]}>
                    <LayoutDashboard size={20} color="#3b82f6" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/admin/manage-club-users')}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3C7' }]}>
                    <UserCog size={20} color="#f59e0b" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
        )}

      </ScrollView>

      {/* Congrats Keynote Speaker modal - shown once per meeting when title/summary not added */}
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
              You're the Keynote Speaker, leading a powerful experience story. Add your{' '}
              <Text style={styles.congratsModalHighlight}>Keynote Title</Text>
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
  speakerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    marginBottom: 16,
  },
  speakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f59e0b',
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
    marginLeft: 'auto',
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
  noSpeakerSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
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
  keynoteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  keynoteHeaderIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  keynoteHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  keynoteInstructionsCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
  },
  keynoteInstructionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  keynoteInstructionsBody: {
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'left',
  },
  keynoteInstructionsHighlight: {
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
  keynoteComingSoonCard: {
    position: 'relative',
    alignItems: 'flex-start',
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  keynoteComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  keynoteDisplayCard: {
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
    shadowRadius: 12,
    elevation: 8,
    position: 'relative',
  },
  keynoteDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  keynoteDisplayHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  keynoteHeaderEmoji: {
    fontSize: 20,
  },
  decorativeSparkleSmall: {
    fontSize: 16,
  },
  keynoteDisplayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  keynoteDisplayTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  keynoteDisplaySummary: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 0,
  },
  keynoteDisplaySpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  keynoteDisplaySpeakerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#f59e0b',
  },
  keynoteDisplayAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  keynoteDisplaySpeakerInfo: {
    flex: 1,
  },
  keynoteDisplaySpeakerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  keynoteDisplaySpeakerRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  keynoteDisplayClubName: {
    fontSize: 13,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
  footerNavigationContainer: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  quickActionsBoxContainer: {
    paddingHorizontal: 8,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
  footerNavigationFixed: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
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
});

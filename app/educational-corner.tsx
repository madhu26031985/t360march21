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
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
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
  MessageCircle,
  Clock,
  LayoutDashboard,
  UserCog,
  Settings,
  ClipboardCheck,
  Edit3,
  Save,
  User,
  X,
  Search,
} from 'lucide-react-native';

/** Match Toastmaster Corner bottom dock icon size */
const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_EDUCATIONAL_TITLE_MAX_LEN = 50;

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

function formatTimeForDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

function meetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** e.g. "March 31 | Tue | 16:00 - 17:00 | In Person" — matches Toastmaster Corner meta line */
function formatConsolidatedMeetingMetaSingleLine(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const parts: string[] = [monthDay, weekdayShort];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(
      `${formatTimeForDisplay(m.meeting_start_time)} - ${formatTimeForDisplay(m.meeting_end_time)}`
    );
  } else if (m.meeting_start_time) {
    parts.push(formatTimeForDisplay(m.meeting_start_time));
  }
  parts.push(meetingModeLabel(m));
  return parts.join(' | ');
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

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
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
  const { width: windowWidth } = useWindowDimensions();
  const consolidatedCardSideMargin = Math.min(56, Math.max(36, Math.round(windowWidth * 0.11)));

  // State management
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [educationalSpeaker, setEducationalSpeaker] = useState<EducationalSpeaker | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExComm, setIsExComm] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [bookingEducationalRole, setBookingEducationalRole] = useState(false);
  const [showAssignEducationalModal, setShowAssignEducationalModal] = useState(false);
  const [assignEducationalSearch, setAssignEducationalSearch] = useState('');
  const [assigningEducationalRole, setAssigningEducationalRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [cornerEducationalTitle, setCornerEducationalTitle] = useState('');
  const [savingCornerEducational, setSavingCornerEducational] = useState(false);
  const [editingSavedCornerEducational, setEditingSavedCornerEducational] = useState(false);

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
        loadClubMembers(),
      ]);
    } catch (error) {
      console.error('Error loading educational corner data:', error);
      Alert.alert('Error', 'Failed to load educational corner data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubMembers = async (): Promise<void> => {
    if (!user?.currentClubId) return;
    try {
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
      const members = (data || []).map((item: any) => ({
        id: item.app_user_profiles.id,
        full_name: item.app_user_profiles.full_name,
        email: item.app_user_profiles.email,
        avatar_url: item.app_user_profiles.avatar_url,
      }));
      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };

  const handleAssignEducationalToMember = async (member: ClubMember): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningEducationalRole(true);
    try {
      const roleId = await fetchOpenMeetingRoleId(meetingId, { eqRoleName: 'Educational Speaker' });
      if (!roleId) {
        Alert.alert('Error', 'No open Educational Speaker role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignEducationalModal(false);
        setAssignEducationalSearch('');
        await loadEducationalSpeaker();
        Alert.alert('Assigned', `${member.full_name} is now the Educational Speaker for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
      }
    } finally {
      setAssigningEducationalRole(false);
    }
  };

  const filteredMembersForAssign = clubMembers.filter((member) => {
    const q = assignEducationalSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

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
        .eq('role_status', 'Available')
        .eq('booking_status', 'booked')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error loading educational speaker role assignment:', roleError);
        setEducationalSpeaker(null);
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
            .select('speech_title, notes')
            .eq('meeting_id', meetingId)
            .eq('speaker_user_id', roleAssignment.assigned_user_id)
            .maybeSingle();

          if (contentError && contentError.code !== 'PGRST116') {
            console.error('Error loading educational content:', contentError);
          }

          if (educationalContent) {
            speakerData.speech_title = educationalContent.speech_title;
            speakerData.summary = null;
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

      const { data: vpeData, error: vpeError } = await supabase
        .from('club_profiles')
        .select('vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();
      if (vpeError) {
        console.error('Error loading club VPE:', vpeError);
        setIsVPEClub(false);
      } else {
        setIsVPEClub(vpeData?.vpe_id === user.id);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  /**
   * Booked Educational Speaker (same idea as Toastmaster Corner: assigned + booked status)
   */
  const isEducationalSpeaker = (): boolean => {
    const status = educationalSpeaker?.booking_status?.toLowerCase();
    return (
      !!user?.id &&
      educationalSpeaker?.assigned_user_id === user.id &&
      status === 'booked'
    );
  };

  const hasEducationalTitle = (): boolean => {
    return !!(educationalSpeaker?.speech_title?.trim());
  };
  const canEditEducationalCorner = (): boolean => {
    return isEducationalSpeaker() || isVPEClub;
  };
  const effectiveEducationalSpeakerUserId = educationalSpeaker?.assigned_user_id || user?.id || null;


  const alertCorner = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message || '');
  };

  /** Restore draft from last saved title and exit edit mode */
  const cancelCornerEducationalEdit = () => {
    setCornerEducationalTitle(
      (educationalSpeaker?.speech_title || '').slice(0, CORNER_EDUCATIONAL_TITLE_MAX_LEN)
    );
    setEditingSavedCornerEducational(false);
  };

  const clearCornerEducationalTitle = () => {
    setCornerEducationalTitle('');
  };

  const saveCornerEducationalTitle = async () => {
    if (!canEditEducationalCorner() || !meetingId || !user?.currentClubId || savingCornerEducational || !effectiveEducationalSpeakerUserId) return;
    const name = cornerEducationalTitle.trim().slice(0, CORNER_EDUCATIONAL_TITLE_MAX_LEN);
    setSavingCornerEducational(true);
    try {
      const { data: existing, error: findErr } = await supabase
        .from('app_meeting_educational_speaker')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', effectiveEducationalSpeakerUserId)
        .maybeSingle();

      if (findErr && findErr.code !== 'PGRST116') {
        console.error('Error finding educational row:', findErr);
        alertCorner('Error', 'Failed to save. Please try again.');
        return;
      }

      const updatedAt = new Date().toISOString();

      if (!name) {
        if (!existing?.id) {
          alertCorner('Validation', 'Please enter an educational title.');
          return;
        }
        const { error } = await supabase
          .from('app_meeting_educational_speaker')
          .update({
            speech_title: null,
            summary: null,
            updated_at: updatedAt,
          })
          .eq('id', existing.id);
        if (error) {
          console.error('Error clearing educational title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
        setEducationalSpeaker((prev) => (prev ? { ...prev, speech_title: null, summary: null } : prev));
        alertCorner('Success', 'Educational title cleared.');
        setEditingSavedCornerEducational(false);
        await loadEducationalSpeaker();
        return;
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('app_meeting_educational_speaker')
          .update({
            speech_title: name,
            summary: null,
            updated_at: updatedAt,
          })
          .eq('id', existing.id);
        if (error) {
          console.error('Error updating educational title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
      } else {
        const { error } = await supabase.from('app_meeting_educational_speaker').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          speaker_user_id: effectiveEducationalSpeakerUserId,
          speech_title: name,
          summary: null,
        });
        if (error) {
          console.error('Error inserting educational title:', error);
          alertCorner('Error', 'Failed to save. Please try again.');
          return;
        }
      }

      setEducationalSpeaker((prev) =>
        prev
          ? { ...prev, speech_title: name, summary: null }
          : prev
      );
      alertCorner('Success', 'Educational title saved!');
      setEditingSavedCornerEducational(false);
      await loadEducationalSpeaker();
    } catch (e) {
      console.error('saveCornerEducationalTitle:', e);
      alertCorner('Error', 'Failed to save. Please try again.');
    } finally {
      setSavingCornerEducational(false);
    }
  };

  useEffect(() => {
    if (!canEditEducationalCorner() || !effectiveEducationalSpeakerUserId) return;
    const titleSaved = !!(educationalSpeaker?.speech_title?.trim());
    if (titleSaved && !editingSavedCornerEducational) return;
    setCornerEducationalTitle(
      (educationalSpeaker?.speech_title || '').slice(0, CORNER_EDUCATIONAL_TITLE_MAX_LEN)
    );
  }, [
    isVPEClub,
    effectiveEducationalSpeakerUserId,
    educationalSpeaker?.assigned_user_id,
    educationalSpeaker?.speech_title,
    editingSavedCornerEducational,
  ]);


  const showConsolidatedEducationalCard = Boolean(
    educationalSpeaker?.assigned_user_id && educationalSpeaker.app_user_profiles
  );

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
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded]}
      >
        {showConsolidatedEducationalCard ? (
          <View style={styles.contentTop} pointerEvents="box-none">
            <View
              style={[
                styles.consolidatedCornerCard,
                {
                  backgroundColor: theme.mode === 'dark' ? theme.colors.surface : '#FFFFFF',
                  shadowColor: '#000000',
                  borderColor: theme.mode === 'dark' ? theme.colors.border : '#E8EAED',
                  marginHorizontal: consolidatedCardSideMargin,
                },
              ]}
            >
              <View style={styles.consolidatedClubBadge}>
                <Text
                  style={[
                    styles.consolidatedClubTitle,
                    { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {meeting.club_name || meeting.meeting_title}
                </Text>
              </View>

              <View style={styles.consolidatedProfileStack}>
                <View
                  style={[
                    styles.consolidatedAvatarWrap,
                    {
                      borderColor: theme.mode === 'dark' ? theme.colors.border : '#E8E8E8',
                      backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#F4F4F5',
                    },
                  ]}
                >
                  {educationalSpeaker!.app_user_profiles!.avatar_url ? (
                    <Image
                      source={{ uri: educationalSpeaker!.app_user_profiles!.avatar_url }}
                      style={styles.consolidatedAvatarImage}
                    />
                  ) : (
                    <User size={40} color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'} />
                  )}
                </View>
                <Text
                  style={[
                    styles.consolidatedPersonName,
                    { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                  ]}
                  maxFontSizeMultiplier={1.25}
                >
                  {educationalSpeaker!.app_user_profiles!.full_name}
                </Text>
                <Text
                  style={[
                    styles.consolidatedPersonRole,
                    { color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666' },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  Educational Speaker
                </Text>
              </View>

              <View style={[styles.consolidatedDivider, { backgroundColor: '#EAEAEA' }]} />

              {canEditEducationalCorner() && (!hasEducationalTitle() || editingSavedCornerEducational) ? (
                <View style={styles.consolidatedThemeFormStretch}>
                  <View style={styles.cornerEdTitleFormHeader}>
                    <Text
                      style={[
                        styles.themeDaySectionHeading,
                        styles.cornerEdTitleFormHeadingText,
                        { color: theme.colors.text },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      ✨ Educational Title
                    </Text>
                    <TouchableOpacity
                      style={styles.cornerEdTitleCloseHit}
                      onPress={cancelCornerEducationalEdit}
                      accessibilityLabel="Cancel editing educational title"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={22} color={theme.mode === 'dark' ? '#A3A3A3' : '#6B7280'} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cornerThemeFormInputSection}>
                    <TextInput
                      style={[
                        styles.cornerThemeNameInput,
                        styles.cornerThemeNameInputClean,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          color: theme.colors.text,
                        },
                      ]}
                      placeholder="Enter title"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={cornerEducationalTitle}
                      onChangeText={(t) =>
                        setCornerEducationalTitle(t.slice(0, CORNER_EDUCATIONAL_TITLE_MAX_LEN))
                      }
                      maxLength={CORNER_EDUCATIONAL_TITLE_MAX_LEN}
                    />
                    <View style={styles.cornerThemeInputFooterRow}>
                      <Text
                        style={[styles.cornerThemeHelperCaption, { color: theme.colors.textSecondary }]}
                        maxFontSizeMultiplier={1.25}
                      >
                        Enter title (e.g. Leadership, Active listening)
                      </Text>
                      <Text style={[styles.cornerThemeCharCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {cornerEducationalTitle.length}/{CORNER_EDUCATIONAL_TITLE_MAX_LEN}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cornerEdTitleActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.cornerEdTitleSecondaryBtn,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.background,
                          opacity: savingCornerEducational ? 0.5 : 1,
                        },
                      ]}
                      onPress={clearCornerEducationalTitle}
                      disabled={savingCornerEducational || !cornerEducationalTitle}
                      accessibilityLabel="Clear educational title"
                    >
                      <Text
                        style={[styles.cornerEdTitleSecondaryBtnText, { color: theme.colors.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        Clear
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.cornerEdTitlePrimaryBtn,
                        {
                          backgroundColor: theme.colors.primary,
                          opacity: savingCornerEducational ? 0.5 : 1,
                        },
                      ]}
                      onPress={saveCornerEducationalTitle}
                      disabled={savingCornerEducational}
                      accessibilityLabel="Save educational title"
                    >
                      <View style={styles.cornerThemeSaveBtnInner}>
                        {!savingCornerEducational && (
                          <Save size={14} color="#FFFFFF" />
                        )}
                        <Text
                          style={[
                            styles.cornerThemeSaveBtnText,
                            styles.cornerThemeSaveBtnTextCompact,
                            { color: '#FFFFFF', marginLeft: savingCornerEducational ? 0 : 6 },
                          ]}
                          maxFontSizeMultiplier={1.3}
                        >
                          {savingCornerEducational ? 'Saving...' : 'Save Title'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : educationalSpeaker?.speech_title?.trim() ? (
                <>
                  <View style={styles.consolidatedThemeLabelRow}>
                    <View style={styles.consolidatedThemeTitleRail} />
                    <Text
                      style={[
                        styles.consolidatedThemeSectionLabel,
                        styles.consolidatedThemeSectionLabelInLabelRow,
                        { color: theme.mode === 'dark' ? '#A3A3A3' : '#8A8FA3' },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      EDUCATIONAL TITLE
                    </Text>
                    <View style={styles.consolidatedThemeTitleRail}>
                      {canEditEducationalCorner() ? (
                        <TouchableOpacity
                          style={styles.consolidatedThemeEditHit}
                          onPress={() => setEditingSavedCornerEducational(true)}
                          accessibilityLabel="Edit educational title"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit3 size={20} color={theme.mode === 'dark' ? '#A3A3A3' : '#777777'} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.consolidatedThemeTitle,
                      { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                    ]}
                    maxFontSizeMultiplier={1.15}
                  >
                    {educationalSpeaker.speech_title}
                  </Text>
                </>
              ) : (
                <View style={[styles.themeComingSoonInCombined, styles.consolidatedThemeComingSoon]}>
                  <Text
                    style={[
                      styles.themeComingSoonTitle,
                      styles.consolidatedThemeComingSoonText,
                      { color: theme.colors.textSecondary },
                    ]}
                    maxFontSizeMultiplier={1.25}
                  >
                    The Educational Speaker{'\n'}is preparing the session — stay tuned!
                  </Text>
                </View>
              )}

              <View style={[styles.consolidatedBottomDivider, { backgroundColor: '#EAEAEA' }]} />

              <View style={styles.consolidatedMeetingMetaBlock}>
                <Text
                  style={[
                    styles.consolidatedMeetingMetaSingle,
                    { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {formatConsolidatedMeetingMetaSingleLine(meeting)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.noAssignmentNotionCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.meetingCardContent}>
                <View style={[styles.dateBox, { backgroundColor: theme.colors.primary + '15' }]}>
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
                    Mode:{' '}
                    {meeting.meeting_mode === 'in_person'
                      ? 'In Person'
                      : meeting.meeting_mode === 'online'
                        ? 'Online'
                        : 'Hybrid'}
                  </Text>
                </View>
              </View>
              <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />
              {!educationalSpeaker?.assigned_user_id ? (
                <View style={styles.noSpeakerCard}>
                  <View style={[styles.noSpeakerIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                    <GraduationCap size={32} color={theme.colors.textSecondary} />
                  </View>
                  <Text style={[styles.noSpeakerText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    The stage is yours — make it count.
                  </Text>
                  {isVPEClub ? (
                    <View style={styles.vpeDualButtonsRow}>
                      <TouchableOpacity
                        style={[
                          styles.bookSpeakerButton,
                          styles.vpeDualBtn,
                          styles.vpeRoleButtonCompact,
                          styles.vpeDualBtnEqualHeight,
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
                          <Text style={[styles.bookSpeakerButtonText, styles.vpeRoleButtonText]} maxFontSizeMultiplier={1.3}>
                            Book Now
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.vpeDualBtn, styles.assignOutlineBtn, styles.vpeRoleButtonCompact, styles.vpeDualBtnEqualHeight, { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                        onPress={() => setShowAssignEducationalModal(true)}
                      >
                        <Text style={[styles.assignOutlineText, styles.vpeRoleButtonText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                          Assign
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
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
                          Book Now
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.edSpeakerLoadingRow}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }} maxFontSizeMultiplier={1.3}>
                    Loading speaker profile…
                  </Text>
                </View>
              )}
              <View style={styles.meetingCardDecoration} />
            </View>
          </>
        )}

        {/* Spacer that pushes nav to bottom when content is short (same pattern as Toastmaster Corner) */}
        <View style={styles.navSpacer} />

        {/* Footer Navigation — same as Toastmaster Corner when no TMOD (no ed speaker booked here) */}
        {!educationalSpeaker?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            marginTop: 0,
            marginBottom: 16,
          }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.footerNavigationContent}>
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <Bell size={FOOTER_NAV_ICON_SIZE} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#16a34a" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FFF7ED' }]}>
                <Eye size={FOOTER_NAV_ICON_SIZE} color="#ea580c" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6F4FF' }]}>
                <Clock size={FOOTER_NAV_ICON_SIZE} color="#0369a1" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FFF1F2' }]}>
                <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#e11d48" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/admin/voting-operations' })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#772432" />
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
                    <Settings size={FOOTER_NAV_ICON_SIZE} color="#10b981" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/admin/meeting-management')}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#DBEAFE' }]}>
                    <LayoutDashboard size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.footerNavItem}
                  onPress={() => router.push('/admin/manage-club-users')}
                >
                  <View style={[styles.footerNavIcon, { backgroundColor: '#FEF3C7' }]}>
                    <UserCog size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
                  </View>
                  <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
                </TouchableOpacity>
              </>
            )}

        <Modal
          visible={showAssignEducationalModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAssignEducationalModal(false);
            setAssignEducationalSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.educationalAssignOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAssignEducationalModal(false);
              setAssignEducationalSearch('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.educationalAssignModal, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.educationalAssignHeader}>
                <Text style={[styles.educationalAssignTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Assign Educational Speaker
                </Text>
                <TouchableOpacity
                  style={styles.educationalAssignClose}
                  onPress={() => {
                    setShowAssignEducationalModal(false);
                    setAssignEducationalSearch('');
                  }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.educationalAssignHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Choose a club member to book the Educational Speaker role.
              </Text>
              <View style={[styles.educationalAssignSearchWrap, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.educationalAssignSearchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={assignEducationalSearch}
                  onChangeText={setAssignEducationalSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {assignEducationalSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAssignEducationalSearch('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.educationalAssignList} showsVerticalScrollIndicator={false}>
                {assigningEducationalRole ? (
                  <View style={styles.educationalAssignEmptyWrap}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : filteredMembersForAssign.length > 0 ? (
                  filteredMembersForAssign.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.educationalAssignMemberRow, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignEducationalToMember(member)}
                      disabled={assigningEducationalRole}
                    >
                      <View style={styles.educationalAssignAvatar}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.educationalAssignAvatarImage} />
                        ) : (
                          <User size={20} color="#ffffff" />
                        )}
                      </View>
                      <View style={styles.educationalAssignMemberTextWrap}>
                        <Text style={[styles.educationalAssignMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.educationalAssignEmptyWrap}>
                    <Text style={[styles.educationalAssignEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      No members found
                    </Text>
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
          </ScrollView>
          </View>
        )}

        {/* Footer Navigation — same dock as Toastmaster Corner + Prep (educational speaker notes) */}
        {educationalSpeaker?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            marginTop: 0,
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
                <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            {canEditEducationalCorner() && (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() =>
                  router.push({
                    pathname: '/educational-speaker-notes',
                    params: { meetingId: meeting?.id },
                  })
                }
                accessibilityLabel="Educational speaker prep space"
              >
                <View
                  style={[
                    styles.footerNavIcon,
                    { backgroundColor: theme.mode === 'dark' ? '#374151' : '#F1F5F9' },
                  ]}
                >
                  <NotebookPen
                    size={FOOTER_NAV_ICON_SIZE}
                    color={theme.mode === 'dark' ? '#A3A3A3' : '#777777'}
                  />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Prep
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <Bell size={FOOTER_NAV_ICON_SIZE} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDF4' }]}>
                <BookOpen size={FOOTER_NAV_ICON_SIZE} color="#16a34a" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FFF7ED' }]}>
                <Eye size={FOOTER_NAV_ICON_SIZE} color="#ea580c" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Gen Eval</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#EEF2FF' }]}>
                <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#f97316" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FDF4FF' }]}>
                <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Mic size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#ECFDF5' }]}>
                <CheckSquare size={FOOTER_NAV_ICON_SIZE} color="#059669" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Roles</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F0FDFA' }]}>
                <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#0d9488" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TT Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FEFBF0' }]}>
                <Clock size={FOOTER_NAV_ICON_SIZE} color="#C9B84E" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/club-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F5F3FF' }]}>
                <LayoutDashboard size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/manage-club-users')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#FDF2F8' }]}>
                <UserCog size={FOOTER_NAV_ICON_SIZE} color="#db2777" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/meeting-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#E6EFF4' }]}>
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#004165" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/admin/voting-operations')}
            >
              <View style={[styles.footerNavIcon, { backgroundColor: '#F9E8EB' }]}>
                <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#772432" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Vote Ops</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        )}

      </ScrollView>

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
  contentContainer: {
    flexGrow: 1,
    flexDirection: 'column',
  },
  contentContainerPadded: {
    paddingHorizontal: 4,
  },
  /** Expands inside ScrollView so the horizontal nav bar sits at the bottom when content is short */
  navSpacer: {
    flex: 1,
    minHeight: 16,
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
    fontSize: 15.3,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noAssignmentNotionCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  noAssignmentDivider: {
    height: 1,
    marginTop: 14,
  },
  bookSpeakerButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 28,
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
  vpeDualButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 28,
  },
  vpeDualBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignOutlineBtn: {
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  assignOutlineText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vpeRoleButtonCompact: {
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  vpeDualBtnEqualHeight: {
    minHeight: 42,
    marginTop: 0,
  },
  vpeRoleButtonText: {
    fontSize: 12,
  },
  educationalAssignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  educationalAssignModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  educationalAssignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  educationalAssignTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  educationalAssignClose: {
    padding: 6,
  },
  educationalAssignHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  educationalAssignSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  educationalAssignSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  educationalAssignList: {
    maxHeight: 360,
  },
  educationalAssignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  educationalAssignAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  educationalAssignAvatarImage: {
    width: '100%',
    height: '100%',
  },
  educationalAssignMemberTextWrap: {
    flex: 1,
  },
  educationalAssignMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  educationalAssignEmptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  educationalAssignEmptyText: {
    fontSize: 14,
    fontWeight: '500',
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
    borderTopWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 6,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 45,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  footerNavLabel: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  contentTop: {
    width: '100%',
  },
  consolidatedCornerCard: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 12,
  },
  consolidatedClubBadge: {
    marginTop: 2,
    marginBottom: 20,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  consolidatedClubTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 23,
  },
  consolidatedProfileStack: {
    alignItems: 'center',
    width: '100%',
  },
  consolidatedAvatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  consolidatedAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  consolidatedPersonName: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  consolidatedPersonRole: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 6,
  },
  consolidatedDivider: {
    width: '100%',
    height: 1,
    marginTop: 16,
    marginBottom: 16,
  },
  consolidatedThemeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: 4,
  },
  consolidatedThemeSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  consolidatedThemeSectionLabelInLabelRow: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  consolidatedThemeTitleRail: {
    width: 44,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consolidatedThemeEditHit: {
    padding: 4,
  },
  consolidatedThemeTitle: {
    fontSize: 31,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 36,
    letterSpacing: 0.5,
    paddingHorizontal: 8,
  },
  consolidatedBottomDivider: {
    width: '100%',
    height: 1,
    marginTop: 22,
    marginBottom: 20,
  },
  consolidatedThemeFormStretch: {
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: 0,
  },
  cornerEdTitleFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  cornerEdTitleFormHeadingText: {
    flex: 1,
    textAlign: 'left',
    marginBottom: 0,
    paddingRight: 8,
  },
  cornerEdTitleCloseHit: {
    padding: 4,
  },
  cornerEdTitleActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  cornerEdTitleSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cornerEdTitleSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cornerEdTitlePrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  themeDaySectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  themeDaySectionHeadingConsolidated: {
    textAlign: 'center',
    marginBottom: 14,
  },
  cornerThemeFormInputSection: {
    marginBottom: 16,
  },
  cornerThemeNameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  cornerThemeNameInputClean: {
    borderWidth: 1.5,
    marginBottom: 0,
  },
  cornerThemeInputFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cornerThemeHelperCaption: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginRight: 12,
  },
  cornerThemeCharCount: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  cornerThemeSaveBtn: {
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerThemeSaveBtnCompact: {
    alignSelf: 'center',
    width: '70%',
    maxWidth: 260,
    marginTop: 8,
    paddingVertical: 11,
    paddingHorizontal: 17,
    borderRadius: 10,
  },
  cornerThemeSaveBtnTextCompact: {
    fontSize: 14,
  },
  cornerThemeSaveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerThemeSaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  consolidatedThemeComingSoon: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  consolidatedThemeComingSoonText: {
    textAlign: 'center',
  },
  consolidatedMeetingMetaBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  consolidatedMeetingMetaSingle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  themeComingSoonInCombined: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  themeComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  edSpeakerLoadingRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});

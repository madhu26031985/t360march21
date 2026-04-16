import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { initialsFromName, useShouldLoadNetworkAvatars } from '@/lib/networkAvatarPolicy';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import {
  educationalCornerQueryKeys,
  fetchEducationalCornerBundle,
  fetchClubMembersForEducationalAssign,
  type EducationalCornerBundle,
  type EducationalCornerMeeting as Meeting,
  type EducationalCornerSpeaker as EducationalSpeaker,
  type EducationalCornerClubMember as ClubMember,
} from '@/lib/educationalCornerQuery';
import { EDUCATIONAL_CORNER_SNAPSHOT_STALE_MS } from '@/lib/prefetchEducationalCorner';
import {
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  Edit3,
  FileText,
  GraduationCap,
  NotebookPen,
  RotateCcw,
  Save,
  Search,
  User,
  Users,
  Vote,
  X,
} from 'lucide-react-native';

/** Match Toastmaster Corner bottom dock icon size */
const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_EDUCATIONAL_TITLE_MAX_LEN = 50;

/** Match TM Corner — flat Notion chrome */
const NOTION_FLAT_BORDER_LIGHT = 'rgba(55, 53, 47, 0.09)';
const NOTION_FLAT_RADIUS = 4;

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

/**
 * Educational Corner Component
 * Displays Educational Speaker assignment and allows adding speech details
 */
export default function EducationalCorner(): JSX.Element {
  const { theme } = useTheme();
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  // State management
  const skipFocusRefetchRef = useRef(true);
  /** Sync guard so rapid double-taps on iOS cannot enqueue two bookings before state disables the button. */
  const bookEducationalInFlightRef = useRef(false);

  const {
    data: bundle,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: educationalCornerQueryKeys.snapshot(meetingId ?? '', user?.id ?? 'anon'),
    queryFn: () => fetchEducationalCornerBundle(meetingId!, user?.id ?? '', user!.currentClubId!),
    initialData: () => {
      if (!meetingId) return undefined;
      const userKey = educationalCornerQueryKeys.snapshot(meetingId, user?.id ?? 'anon');
      const warmUser = queryClient.getQueryData<EducationalCornerBundle | null>(userKey);
      if (warmUser !== undefined) return warmUser;
      const warmAnon = queryClient.getQueryData<EducationalCornerBundle | null>(
        educationalCornerQueryKeys.snapshot(meetingId, 'anon')
      );
      return warmAnon;
    },
    enabled: Boolean(meetingId && user?.currentClubId),
    staleTime: EDUCATIONAL_CORNER_SNAPSHOT_STALE_MS,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [educationalSpeaker, setEducationalSpeaker] = useState<EducationalSpeaker | null>(null);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [bookingEducationalRole, setBookingEducationalRole] = useState(false);
  const [showAssignEducationalModal, setShowAssignEducationalModal] = useState(false);
  const [assignEducationalSearch, setAssignEducationalSearch] = useState('');
  const [assigningEducationalRole, setAssigningEducationalRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [cornerEducationalTitle, setCornerEducationalTitle] = useState('');
  const [savingCornerEducational, setSavingCornerEducational] = useState(false);
  const [editingSavedCornerEducational, setEditingSavedCornerEducational] = useState(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);

  useEffect(() => {
    skipFocusRefetchRef.current = true;
  }, [meetingId]);

  useEffect(() => {
    if (bundle === undefined) return;
    if (bundle === null) {
      setMeeting(null);
      setEducationalSpeaker(null);
      setIsVPEClub(false);
      return;
    }
    setMeeting(bundle.meeting);
    setEducationalSpeaker(bundle.educationalSpeaker);
    setIsVPEClub(bundle.isVPEClub);
  }, [bundle]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefetchRef.current) {
        skipFocusRefetchRef.current = false;
        return;
      }
      if (meetingId && user?.currentClubId) {
        void refetch();
      }
    }, [meetingId, user?.currentClubId, refetch])
  );

  useEffect(() => {
    if (!showAssignEducationalModal || !user?.currentClubId) return;
    let cancelled = false;
    void (async () => {
      const members = await fetchClubMembersForEducationalAssign(user.currentClubId!);
      if (!cancelled) setClubMembers(members);
    })();
    return () => {
      cancelled = true;
    };
  }, [showAssignEducationalModal, user?.currentClubId]);

  /** Open role row id from snapshot — avoids an extra app_meeting_roles_management round-trip before PATCH. */
  const resolveOpenEducationalRoleId = async (): Promise<string | null> => {
    if (educationalSpeaker?.id && !educationalSpeaker.assigned_user_id) {
      return educationalSpeaker.id;
    }
    return fetchOpenMeetingRoleId(meetingId!, { eqRoleName: 'Educational Speaker' });
  };

  const handleAssignEducationalToMember = async (member: ClubMember): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningEducationalRole(true);
    try {
      const roleId = await resolveOpenEducationalRoleId();
      if (!roleId) {
        Alert.alert('Error', 'No open Educational Speaker role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setEducationalSpeaker((prev) =>
          prev
            ? {
                ...prev,
                assigned_user_id: member.id,
                booking_status: 'booked',
                app_user_profiles: {
                  full_name: member.full_name,
                  email: member.email,
                  avatar_url: member.avatar_url ?? null,
                },
              }
            : prev
        );
        setShowAssignEducationalModal(false);
        setAssignEducationalSearch('');
        void refetch();
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

  const handleBookEducationalSpeakerInline = async (): Promise<void> => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    if (bookEducationalInFlightRef.current) return;
    bookEducationalInFlightRef.current = true;
    setBookingEducationalRole(true);
    try {
      let result: Awaited<ReturnType<typeof bookOpenMeetingRole>>;
      if (educationalSpeaker?.id && !educationalSpeaker.assigned_user_id) {
        result = await bookMeetingRoleForCurrentUser(user.id, educationalSpeaker.id);
        if (!result.ok) {
          result = await bookOpenMeetingRole(
            user.id,
            meetingId,
            { eqRoleName: 'Educational Speaker' },
            'Educational Speaker is already booked or not set up for this meeting.'
          );
        }
      } else {
        result = await bookOpenMeetingRole(
          user.id,
          meetingId,
          { eqRoleName: 'Educational Speaker' },
          'Educational Speaker is already booked or not set up for this meeting.'
        );
      }
      if (result.ok) {
        setEducationalSpeaker((prev) =>
          prev
            ? {
                ...prev,
                assigned_user_id: user.id,
                booking_status: 'booked',
                app_user_profiles: {
                  full_name: user.fullName || prev.app_user_profiles?.full_name || 'Member',
                  email: (user as { email?: string | null }).email || prev.app_user_profiles?.email || '',
                  avatar_url: user.avatarUrl || prev.app_user_profiles?.avatar_url || null,
                },
              }
            : prev
        );
        void refetch();
        setBookingSuccessRole('Educational Speaker');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      bookEducationalInFlightRef.current = false;
      setBookingEducationalRole(false);
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
        await refetch();
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
      await refetch();
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

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;
  const waitingForInputs = !meetingId || !user?.currentClubId;

  if ((isPending && !isError) || waitingForInputs) {
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

  if (isError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Educational Corner
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {"Couldn't load Educational Corner."}
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }]}
            onPress={() => refetch()}
          >
            <Text style={[styles.backButtonText, { color: '#fff' }]} maxFontSizeMultiplier={1.3}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
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

      <View style={styles.mainBody}>
      <ScrollView
        style={styles.scrollMain}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded, { paddingBottom: 16 }]}
      >
        <View style={styles.contentTop} pointerEvents="box-none">
        {showConsolidatedEducationalCard ? (
            <View
              style={[
                styles.consolidatedCornerCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.mode === 'light' ? NOTION_FLAT_BORDER_LIGHT : theme.colors.border,
                  marginTop: 12,
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
                  {shouldLoadAvatars && educationalSpeaker!.app_user_profiles!.avatar_url ? (
                    <Image
                      source={{ uri: educationalSpeaker!.app_user_profiles!.avatar_url }}
                      style={styles.consolidatedAvatarImage}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.consolidatedAvatarInitial,
                        { color: theme.mode === 'dark' ? '#E5E7EB' : '#4B5563' },
                      ]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {initialsFromName(educationalSpeaker!.app_user_profiles!.full_name, 1)}
                    </Text>
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

              <View
                style={[
                  styles.consolidatedDivider,
                  {
                    backgroundColor: theme.mode === 'light' ? NOTION_FLAT_BORDER_LIGHT : theme.colors.border,
                  },
                ]}
              />

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

              <View
                style={[
                  styles.consolidatedBottomDivider,
                  {
                    backgroundColor: theme.mode === 'light' ? NOTION_FLAT_BORDER_LIGHT : theme.colors.border,
                  },
                ]}
              />

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
                  <TouchableOpacity
                    style={[
                      styles.bookSpeakerButton,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: bookingEducationalRole || assigningEducationalRole ? 0.85 : 1,
                        zIndex: 2,
                      },
                    ]}
                    onPress={() => handleBookEducationalSpeakerInline()}
                    disabled={bookingEducationalRole || assigningEducationalRole}
                    delayPressIn={0}
                    activeOpacity={0.88}
                    hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
                  >
                    {bookingEducationalRole ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.bookSpeakerButtonText} maxFontSizeMultiplier={1.3}>
                        Book Now
                      </Text>
                    )}
                  </TouchableOpacity>
                  {isVPEClub ? (
                    <TouchableOpacity
                      style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                      onPress={() => setShowAssignEducationalModal(true)}
                      disabled={bookingEducationalRole || assigningEducationalRole}
                      hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                        Assign to a member
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.edSpeakerLoadingRow}>
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.textSecondary, marginTop: 8 }} maxFontSizeMultiplier={1.3}>
                    Loading speaker profile…
                  </Text>
                </View>
              )}
              <View style={styles.meetingCardDecoration} pointerEvents="none" />
            </View>
          </>
        )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom + 10, 22),
            width: windowWidth,
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={FOOTER_NAV_ICON_SIZE} color="#004165" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Book
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({ pathname: '/book-a-role', params: { meetingId: meeting.id, initialTab: 'my_bookings' } })
            }
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <RotateCcw size={FOOTER_NAV_ICON_SIZE} color="#4F46E5" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Withdraw
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#ec4899" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Attendance
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <ClipboardCheck size={FOOTER_NAV_ICON_SIZE} color="#3b82f6" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Complete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() =>
              router.push({
                pathname: '/educational-speaker-notes',
                params: { meetingId: meeting.id, clubId: user?.currentClubId ?? '' },
              })
            }
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <NotebookPen size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              My Space
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <FileText size={FOOTER_NAV_ICON_SIZE} color="#f59e0b" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Agenda
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting.id } })}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Vote size={FOOTER_NAV_ICON_SIZE} color="#a855f7" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Voting
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>

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
                      {shouldLoadAvatars && member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.educationalAssignAvatarImage} />
                      ) : (
                        <Text style={styles.educationalAssignAvatarInitial} maxFontSizeMultiplier={1.1}>
                          {initialsFromName(member.full_name, 1)}
                        </Text>
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
      <PremiumBookingSuccessModal
        visible={!!bookingSuccessRole}
        roleLabel={bookingSuccessRole ?? ''}
        onClose={() => setBookingSuccessRole(null)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
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
    alignItems: 'stretch',
    width: '100%',
  },
  contentContainerPadded: {
    paddingHorizontal: 16,
  },
  contentTop: {
    width: '100%',
    alignItems: 'stretch',
  },
  mainBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    alignItems: 'stretch',
  },
  scrollMain: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
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
    paddingVertical: 14,
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  educationalAssignAvatarInitial: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    flexGrow: 1,
    gap: 8,
    paddingVertical: 2,
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 2,
    paddingBottom: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  /** Flat Notion-style block — matches TM Corner. */
  consolidatedCornerCard: {
    marginBottom: 0,
    borderRadius: NOTION_FLAT_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'hidden',
  },
  consolidatedClubBadge: {
    marginTop: 0,
    marginBottom: 16,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  consolidatedAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  consolidatedAvatarInitial: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.4,
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
    borderRadius: NOTION_FLAT_RADIUS,
    borderWidth: 1,
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
    borderRadius: NOTION_FLAT_RADIUS,
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
    borderRadius: NOTION_FLAT_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 11,
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
    borderRadius: NOTION_FLAT_RADIUS,
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
    borderRadius: NOTION_FLAT_RADIUS,
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

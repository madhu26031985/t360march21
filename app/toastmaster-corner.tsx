import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import PremiumBookingSuccessModal from '@/components/PremiumBookingSuccessModal';
import {
  fetchToastmasterCornerBundle,
  toastmasterCornerQueryKeys,
  type ToastmasterCornerMeeting as Meeting,
  type ToastmasterCornerClubInfo as ClubInfo,
  type ToastmasterOfDayRow as ToastmasterOfDay,
  type ToastmasterMeetingDataRow as ToastmasterMeetingData,
} from '@/lib/toastmasterCornerQuery';
import { bookOpenMeetingRole, fetchOpenMeetingRoleId, bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import {
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  Crown,
  Edit3,
  Eye,
  FileText,
  NotebookPen,
  RotateCcw,
  Save,
  Search,
  Shield,
  User,
  UserCheck,
  Users,
  Vote,
  X,
} from 'lucide-react-native';
import { Image } from 'expo-image';

/** Bottom nav: icons + labels scaled to 75% of prior size (25% reduction) */
const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_THEME_MAX_LEN = 50;

/** Notion-like flat chrome (light) — subtle edge, no heavy “card” shadow */
const NOTION_FLAT_BORDER_LIGHT = 'rgba(55, 53, 47, 0.09)';
const NOTION_FLAT_RADIUS = 4;

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

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
  charter_date: string | null;
}

interface ToastmasterOfDay {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  booking_status?: string;
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

function formatTimeForDisplay(t: string): string {
  const p = t.split(':');
  if (p.length >= 2) return `${p[0]}:${p[1]}`;
  return t;
}

/** Line 2: Tue • 16:00 – 17:00 (no mode) */
function formatMeetingCardScheduleLine(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  if (m.meeting_start_time && m.meeting_end_time) {
    return `${weekdayShort} • ${formatTimeForDisplay(m.meeting_start_time)} – ${formatTimeForDisplay(m.meeting_end_time)}`;
  }
  if (m.meeting_start_time) {
    return `${weekdayShort} • ${formatTimeForDisplay(m.meeting_start_time)}`;
  }
  return weekdayShort;
}

function meetingModeLabel(m: Meeting): string {
  return m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
}

/** e.g. "March 31 | Tue | 16:00 - 17:00 | In Person" */
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

export default function ToastmasterCorner() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const queryClient = useQueryClient();
  const clubId = user?.currentClubId;
  const uid = user?.id;
  const queryEnabled = !!meetingId && !!clubId;

  const { data: cornerData, isPending, isError, error } = useQuery({
    queryKey: toastmasterCornerQueryKeys.detail(meetingId ?? '', clubId ?? '', uid ?? 'anon'),
    queryFn: () => fetchToastmasterCornerBundle(meetingId!, clubId!, uid ?? ''),
    enabled: queryEnabled,
    staleTime: 60_000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [toastmasterOfDay, setToastmasterOfDay] = useState<ToastmasterOfDay | null>(null);
  const [toastmasterMeetingData, setToastmasterMeetingData] = useState<ToastmasterMeetingData | null>(null); // New state for consolidated data
  const [isExComm, setIsExComm] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const [bookingTmodRole, setBookingTmodRole] = useState(false);
  const [bookingSuccessRole, setBookingSuccessRole] = useState<string | null>(null);
  const [showAssignToastmasterModal, setShowAssignToastmasterModal] = useState(false);
  const [assignToastmasterSearch, setAssignToastmasterSearch] = useState('');
  const [assigningToastmasterRole, setAssigningToastmasterRole] = useState(false);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [assignRosterLoading, setAssignRosterLoading] = useState(false);
  const rosterRequestId = useRef(0);
  /** Sync guard so rapid double-taps on iOS cannot enqueue two bookings before state disables the button. */
  const bookTmodInFlightRef = useRef(false);
  const [cornerThemeName, setCornerThemeName] = useState('');
  const [savingCornerTheme, setSavingCornerTheme] = useState(false);
  const [editingSavedCornerTheme, setEditingSavedCornerTheme] = useState(false);

  const isToastmasterOfDay = () => {
    const status = toastmasterOfDay?.booking_status?.toLowerCase();
    return (
      !!user?.id &&
      toastmasterOfDay?.assigned_user_id === user.id &&
      status === 'booked'
    );
  };

  const isThemeCompleted = () => {
    return !!(toastmasterMeetingData?.theme_of_the_day?.trim());
  };
  const canEditToastmasterTheme = () => {
    return isToastmasterOfDay() || isVPEClub;
  };
  const effectiveToastmasterUserId = toastmasterOfDay?.assigned_user_id || user?.id || null;

  useEffect(() => {
    setMeeting(null);
    setClubInfo(null);
    setToastmasterOfDay(null);
    setToastmasterMeetingData(null);
    setIsExComm(false);
    setIsVPEClub(false);
  }, [meetingId]);

  useEffect(() => {
    if (!cornerData) return;
    setMeeting(cornerData.meeting);
    setClubInfo(cornerData.clubInfo);
    setToastmasterOfDay(cornerData.toastmasterOfDay);
    setToastmasterMeetingData(cornerData.toastmasterMeetingData);
    setIsExComm(cornerData.isExComm);
    setIsVPEClub(cornerData.isVPEClub);
  }, [cornerData]);

  useEffect(() => {
    if (!isError || !error) return;
    console.error('Toastmaster corner query error:', error);
    Alert.alert('Error', 'Failed to load toastmaster corner data');
  }, [isError, error]);

  const isLoading =
    (queryEnabled && isPending);

  const invalidateToastmasterCorner = useCallback(async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) return;
    await queryClient.invalidateQueries({
      queryKey: toastmasterCornerQueryKeys.detail(meetingId, user.currentClubId, user.id),
    });
  }, [meetingId, queryClient, user?.currentClubId, user?.id]);

  useEffect(() => {
    if (!canEditToastmasterTheme() || !effectiveToastmasterUserId) return;
    const themeSaved = !!(toastmasterMeetingData?.theme_of_the_day?.trim());
    if (themeSaved && !editingSavedCornerTheme) return;
    setCornerThemeName(
      (toastmasterMeetingData?.theme_of_the_day || '').slice(0, CORNER_THEME_MAX_LEN)
    );
  }, [
    isVPEClub,
    effectiveToastmasterUserId,
    toastmasterOfDay?.assigned_user_id,
    toastmasterMeetingData?.id,
    toastmasterMeetingData?.theme_of_the_day,
    editingSavedCornerTheme,
  ]);

  const alertCorner = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message || '');
  };

  const cancelCornerThemeEdit = () => {
    setCornerThemeName(
      (toastmasterMeetingData?.theme_of_the_day || '').slice(0, CORNER_THEME_MAX_LEN)
    );
    setEditingSavedCornerTheme(false);
  };

  const clearCornerThemeName = () => {
    setCornerThemeName('');
  };

  const saveCornerTheme = async () => {
    if (!canEditToastmasterTheme() || !meetingId || !user?.currentClubId || savingCornerTheme || !effectiveToastmasterUserId) return;
    const name = cornerThemeName.trim().slice(0, CORNER_THEME_MAX_LEN);
    setSavingCornerTheme(true);
    try {
      if (!name) {
        if (!toastmasterMeetingData?.id) {
          alertCorner('Validation', 'Please enter a theme name.');
          return;
        }
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            theme_of_the_day: null,
            theme_summary: null,
            updated_at: updatedAt,
          })
          .eq('id', toastmasterMeetingData.id);
        if (error) {
          console.error('Error clearing theme:', error);
          alertCorner('Error', 'Failed to save theme. Please try again.');
          return;
        }
        setToastmasterMeetingData({
          ...toastmasterMeetingData,
          theme_of_the_day: null,
          theme_summary: null,
          updated_at: updatedAt,
        });
        alertCorner('Success', 'Theme cleared.');
        setEditingSavedCornerTheme(false);
        await invalidateToastmasterCorner();
        return;
      }

      if (toastmasterMeetingData?.id) {
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            theme_of_the_day: name,
            theme_summary: null,
            updated_at: updatedAt,
          })
          .eq('id', toastmasterMeetingData.id);
        if (error) {
          console.error('Error updating theme:', error);
          alertCorner('Error', 'Failed to save theme. Please try again.');
          return;
        }
        setToastmasterMeetingData({
          ...toastmasterMeetingData,
          theme_of_the_day: name,
          theme_summary: null,
          updated_at: updatedAt,
        });
      } else {
        const { data, error } = await supabase
          .from('toastmaster_meeting_data')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: effectiveToastmasterUserId,
            theme_of_the_day: name,
            theme_summary: null,
          })
          .select()
          .single();
        if (error) {
          console.error('Error creating theme:', error);
          alertCorner('Error', 'Failed to save theme. Please try again.');
          return;
        }
        if (data) setToastmasterMeetingData(data as ToastmasterMeetingData);
      }
      alertCorner('Success', 'Theme saved successfully!');
      setEditingSavedCornerTheme(false);
      await invalidateToastmasterCorner();
    } catch (e) {
      console.error('Error saving theme:', e);
      alertCorner('Error', 'Failed to save theme. Please try again.');
    } finally {
      setSavingCornerTheme(false);
    }
  };

  /** Open TMOD role row id from snapshot — skips extra app_meeting_roles_management GET before PATCH. */
  const resolveOpenToastmasterRoleId = async (): Promise<string | null> => {
    if (toastmasterOfDay?.id && !toastmasterOfDay.assigned_user_id) {
      return toastmasterOfDay.id;
    }
    return fetchOpenMeetingRoleId(meetingId!, { ilikeRoleName: '%toastmaster%' });
  };

  const handleBookTmodInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    if (bookTmodInFlightRef.current) return;
    bookTmodInFlightRef.current = true;
    setBookingTmodRole(true);
    try {
      let result: Awaited<ReturnType<typeof bookOpenMeetingRole>>;
      if (toastmasterOfDay?.id && !toastmasterOfDay.assigned_user_id) {
        result = await bookMeetingRoleForCurrentUser(user.id, toastmasterOfDay.id);
        if (!result.ok) {
          result = await bookOpenMeetingRole(
            user.id,
            meetingId,
            { ilikeRoleName: '%toastmaster%' },
            'Toastmaster of the Day is already booked or not set up for this meeting.'
          );
        }
      } else {
        result = await bookOpenMeetingRole(
          user.id,
          meetingId,
          { ilikeRoleName: '%toastmaster%' },
          'Toastmaster of the Day is already booked or not set up for this meeting.'
        );
      }
      if (result.ok) {
        await invalidateToastmasterCorner();
        setBookingSuccessRole('Toastmaster of the Day');
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      bookTmodInFlightRef.current = false;
      setBookingTmodRole(false);
    }
  };

  const loadClubMembers = async () => {
    const clubId = user?.currentClubId;
    if (!clubId) return;
    const reqId = ++rosterRequestId.current;
    setAssignRosterLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_club_member_directory', {
        target_club_id: clubId,
      });

      if (reqId !== rosterRequestId.current) return;

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        const members: ClubMember[] = (rpcData as { user_id: string; full_name: string; email: string; avatar_url: string | null }[])
          .map((row) => ({
            id: row.user_id,
            full_name: row.full_name || '',
            email: row.email || '',
            avatar_url: row.avatar_url ?? null,
          }))
          .filter((m) => m.id);
        members.sort((a, b) => a.full_name.localeCompare(b.full_name));
        setClubMembers(members);
        return;
      }

      if (rpcError) {
        console.warn('get_club_member_directory failed, falling back to embed query:', rpcError);
      }

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
        .eq('club_id', clubId)
        .eq('is_authenticated', true);

      if (reqId !== rosterRequestId.current) return;

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }
      const members = (data || []).map((item: any) => ({
        id: item.app_user_profiles?.id,
        full_name: item.app_user_profiles?.full_name ?? '',
        email: item.app_user_profiles?.email ?? '',
        avatar_url: item.app_user_profiles?.avatar_url ?? null,
      })).filter((m: ClubMember) => m.id);
      members.sort((a: ClubMember, b: ClubMember) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    } finally {
      if (reqId === rosterRequestId.current) {
        setAssignRosterLoading(false);
      }
    }
  };

  const handleAssignToastmasterToMember = async (member: ClubMember) => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to assign this role.');
      return;
    }
    setAssigningToastmasterRole(true);
    try {
      const roleId = await resolveOpenToastmasterRoleId();
      if (!roleId) {
        Alert.alert('Error', 'No open Toastmaster role was found for this meeting.');
        return;
      }
      const result = await bookMeetingRoleForCurrentUser(member.id, roleId);
      if (result.ok) {
        setShowAssignToastmasterModal(false);
        setAssignToastmasterSearch('');
        await invalidateToastmasterCorner();
        Alert.alert('Assigned', `${member.full_name} is now Toastmaster of the Day for this meeting.`);
      } else {
        Alert.alert('Could not assign', result.message);
      }
    } finally {
      setAssigningToastmasterRole(false);
    }
  };

  const filteredMembersForAssign = clubMembers.filter((member) => {
    const q = assignToastmasterSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      member.full_name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q)
    );
  });

  const handleAddTheme = () => {
    router.push({
      pathname: '/toastmaster-theme-form',
      params: {
        meetingId: meeting?.id,
        clubId: clubInfo?.id,
      }
    });
  };

  const handleEditTheme = () => {
    router.push({
      pathname: '/toastmaster-theme-form',
      params: {
        meetingId: meeting?.id,
        clubId: clubInfo?.id,
      }
    });
  };

  const canEditTheme = () => {
    return isToastmasterOfDay() || isExComm;
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return EXCOMM_UI.solidBg;
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading Toastmaster Corner...</Text>
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

  const showConsolidatedTmodCard = Boolean(
    toastmasterOfDay?.assigned_user_id && toastmasterOfDay.app_user_profiles
  );

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TM Corner</Text>
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
        {showConsolidatedTmodCard ? (
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
                {clubInfo?.name || meeting.meeting_title}
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
                {toastmasterOfDay!.app_user_profiles!.avatar_url ? (
                  <Image
                    source={{ uri: toastmasterOfDay!.app_user_profiles!.avatar_url }}
                    cachePolicy="memory-disk"
                    style={styles.consolidatedAvatarImage}
                  />
                ) : (
                  <User
                    size={40}
                    color={theme.mode === 'dark' ? '#737373' : '#9CA3AF'}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.consolidatedPersonName,
                  { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
                ]}
                maxFontSizeMultiplier={1.25}
              >
                {toastmasterOfDay!.app_user_profiles!.full_name}
              </Text>
              <Text
                style={[
                  styles.consolidatedPersonRole,
                  {
                    color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666',
                  },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                Toastmaster of the Day
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

            {canEditToastmasterTheme() && (!isThemeCompleted() || editingSavedCornerTheme) ? (
              <View style={styles.consolidatedThemeFormStretch}>
                <View style={styles.cornerThemeEditHeader}>
                  <Text
                    style={[
                      styles.themeDaySectionHeading,
                      styles.cornerThemeEditHeadingText,
                      { color: theme.colors.text },
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    ✨ Theme of the Day
                  </Text>
                  <TouchableOpacity
                    style={styles.cornerThemeEditCloseHit}
                    onPress={cancelCornerThemeEdit}
                    accessibilityLabel="Cancel editing theme"
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
                    placeholder="Enter theme"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={cornerThemeName}
                    onChangeText={(t) => setCornerThemeName(t.slice(0, CORNER_THEME_MAX_LEN))}
                    maxLength={CORNER_THEME_MAX_LEN}
                  />
                  <View style={styles.cornerThemeInputFooterRow}>
                    <Text
                      style={[styles.cornerThemeHelperCaption, { color: theme.colors.textSecondary }]}
                      maxFontSizeMultiplier={1.25}
                    >
                      Enter theme (e.g. Leadership, AI Era)
                    </Text>
                    <Text style={[styles.cornerThemeCharCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {cornerThemeName.length}/{CORNER_THEME_MAX_LEN}
                    </Text>
                  </View>
                </View>

                <View style={styles.cornerThemeEditActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.cornerThemeEditSecondaryBtn,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.background,
                        opacity: savingCornerTheme ? 0.5 : 1,
                      },
                    ]}
                    onPress={clearCornerThemeName}
                    disabled={savingCornerTheme || !cornerThemeName}
                    accessibilityLabel="Clear theme text"
                  >
                    <Text
                      style={[styles.cornerThemeEditSecondaryBtnText, { color: theme.colors.text }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      Clear
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.cornerThemeEditPrimaryBtn,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: savingCornerTheme ? 0.5 : 1,
                      },
                    ]}
                    onPress={saveCornerTheme}
                    disabled={savingCornerTheme}
                    accessibilityLabel="Save theme of the day"
                  >
                    <View style={styles.cornerThemeSaveBtnInner}>
                      {!savingCornerTheme && <Save size={14} color="#FFFFFF" />}
                      <Text
                        style={[
                          styles.cornerThemeSaveBtnText,
                          styles.cornerThemeSaveBtnTextCompact,
                          { color: '#FFFFFF', marginLeft: savingCornerTheme ? 0 : 6 },
                        ]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {savingCornerTheme ? 'Saving...' : 'Save Theme'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ) : toastmasterMeetingData?.theme_of_the_day?.trim() ? (
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
                    THEME OF THE DAY
                  </Text>
                  <View style={styles.consolidatedThemeTitleRail}>
                    {canEditToastmasterTheme() ? (
                      <TouchableOpacity
                        style={styles.consolidatedThemeEditHit}
                        onPress={() => setEditingSavedCornerTheme(true)}
                        accessibilityLabel="Edit theme of the day"
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
                  {toastmasterMeetingData.theme_of_the_day}
                </Text>
              </>
            ) : (
              <View style={[styles.themeComingSoonInCombined, styles.consolidatedThemeComingSoon]}>
                <Text
                  style={[styles.themeComingSoonTitle, styles.consolidatedThemeComingSoonText, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.25}
                >
                  Toastmaster of the Day{'\n'}is crafting the theme — stay tuned!
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
                  <Text
                    style={[styles.meetingCardMetaCompact, { color: theme.colors.textSecondary }]}
                    maxFontSizeMultiplier={1.25}
                  >
                    {formatMeetingCardScheduleLine(meeting)}
                  </Text>
                  <Text
                    style={[styles.meetingCardMetaCompact, styles.meetingCardMetaModeLine, { color: theme.colors.textSecondary }]}
                    maxFontSizeMultiplier={1.25}
                  >
                    {meetingModeLabel(meeting)}
                  </Text>
                </View>
              </View>
              <View style={[styles.noAssignmentDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.noToastmasterCard}>
                <View style={[styles.noToastmasterIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                  <Crown size={32} color={theme.colors.textSecondary} />
                </View>
                <Text style={[styles.noToastmasterText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  It's time to lead.
                </Text>
                <Text style={[styles.noToastmasterSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  It's time to become — TMOD now. 💫
                </Text>
                <TouchableOpacity
                  style={[
                    styles.bookRoleButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: bookingTmodRole || assigningToastmasterRole ? 0.85 : 1,
                      zIndex: 2,
                    },
                  ]}
                  onPress={() => handleBookTmodInline()}
                  disabled={bookingTmodRole || assigningToastmasterRole}
                  delayPressIn={0}
                  activeOpacity={0.88}
                  hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
                >
                  {bookingTmodRole ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                      Book TMOD Role
                    </Text>
                  )}
                </TouchableOpacity>
                {isVPEClub ? (
                  <TouchableOpacity
                    style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 12 }}
                    onPress={() => {
                      setShowAssignToastmasterModal(true);
                      void loadClubMembers();
                    }}
                    disabled={bookingTmodRole || assigningToastmasterRole}
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.primary }} maxFontSizeMultiplier={1.25}>
                      Assign to a member
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
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
                pathname: '/toastmaster-notes',
                params: { meetingId: meeting.id, clubId: clubInfo?.id ?? '' },
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
          visible={showAssignToastmasterModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAssignToastmasterModal(false);
            setAssignToastmasterSearch('');
          }}
        >
          <TouchableOpacity
            style={styles.assignOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowAssignToastmasterModal(false);
              setAssignToastmasterSearch('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.assignModal, { backgroundColor: theme.colors.surface }]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.assignHeader}>
                <Text style={[styles.assignTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Assign Toastmaster
                </Text>
                <TouchableOpacity
                  style={styles.assignClose}
                  onPress={() => {
                    setShowAssignToastmasterModal(false);
                    setAssignToastmasterSearch('');
                  }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.assignHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Choose a club member to book the Toastmaster role for this meeting.
              </Text>
              <View style={[styles.assignSearchWrap, { backgroundColor: theme.colors.background }]}>
                <Search size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.assignSearchInput, { color: theme.colors.text }]}
                  placeholder="Search by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={assignToastmasterSearch}
                  onChangeText={setAssignToastmasterSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {assignToastmasterSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAssignToastmasterSearch('')}>
                    <X size={20} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView style={styles.assignList} showsVerticalScrollIndicator={false}>
                {assigningToastmasterRole ? (
                  <View style={styles.assignEmptyWrap}>
                    <ActivityIndicator color={theme.colors.primary} />
                  </View>
                ) : assignRosterLoading ? (
                  <View style={styles.assignEmptyWrap}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={[styles.assignEmptyText, { color: theme.colors.textSecondary, marginTop: 10 }]} maxFontSizeMultiplier={1.2}>
                      Loading members…
                    </Text>
                  </View>
                ) : filteredMembersForAssign.length > 0 ? (
                  filteredMembersForAssign.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={[styles.assignMemberRow, { backgroundColor: theme.colors.background }]}
                      onPress={() => handleAssignToastmasterToMember(member)}
                      disabled={assigningToastmasterRole}
                    >
                      <View style={styles.assignAvatar}>
                        {member.avatar_url ? (
                          <Image
                            source={{ uri: member.avatar_url }}
                            cachePolicy="memory-disk"
                            style={styles.assignAvatarImage}
                          />
                        ) : (
                          <User size={20} color="#ffffff" />
                        )}
                      </View>
                      <View style={styles.assignMemberTextWrap}>
                        <Text style={[styles.assignMemberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.assignEmptyWrap}>
                    <Text style={[styles.assignEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
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
  /** One unified bottom panel for shortcuts (not a separate floating card in the scroll). */
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
  clubCard: {
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
    alignItems: 'flex-start',
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
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  meetingCardMetaCompact: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  meetingCardMetaModeLine: {
    marginTop: 3,
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
  /** Meeting + TMOD/theme in one flat bordered panel (no stacked card shadows) */
  toastmasterHubPanel: {
    marginHorizontal: 16,
    marginTop: 13,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toastmasterHubMeeting: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  toastmasterHubDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  toastmasterHubSection: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 16,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toastmasterInCombined: {
    width: '100%',
  },
  toastmasterRowMerged: {
    paddingVertical: 8,
    borderRadius: 8,
  },
  combinedTmodThemeDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  themeHeaderRowInCombined: {
    marginTop: 8,
    marginBottom: 8,
  },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  themeHeaderIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  themeHeaderEmoji: {
    fontSize: 18,
  },
  themeHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  themeAddButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toastmasterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  toastmasterAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  toastmasterAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  toastmasterDetails: {
    flex: 1,
  },
  toastmasterName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  toastmasterRoleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  toastmasterEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  toastmasterRole: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  toastmasterRoleText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  noToastmasterCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noToastmasterIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  noToastmasterText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noToastmasterSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
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
  assignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  assignModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  assignHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  assignTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  assignClose: {
    padding: 6,
  },
  assignHint: {
    fontSize: 13,
    marginBottom: 10,
  },
  assignSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  assignSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  assignList: {
    maxHeight: 360,
  },
  assignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  assignAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  assignAvatarImage: {
    width: '100%',
    height: '100%',
  },
  assignMemberTextWrap: {
    flex: 1,
  },
  assignMemberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  assignEmptyWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignEmptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  bookRoleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    letterSpacing: -0.5,
  },
  themeTitleInCombined: {
    marginTop: 8,
    marginBottom: 4,
  },
  noThemeCard: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  noThemeIconLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  noThemeEmojiLarge: {
    fontSize: 20,
  },
  noThemeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  noThemeDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  addThemeButtonNew: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addThemeButtonTextNew: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  noPermissionCard: {
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  noPermissionText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
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
  quickActionsBoxContainer: {
    paddingHorizontal: 8,
  },
  quickActionsBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  quickActionsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
  setThemeAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setThemeAuthorTextCol: {
    flex: 1,
    minWidth: 0,
    marginLeft: 2,
  },
  setThemeAuthorName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  setThemeAuthorRole: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  cornerThemeFormMerged: {
    paddingTop: 4,
    width: '100%',
  },
  themeDaySectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.2,
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
  /** ~30% smaller footprint than full-width Save Theme */
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
  /** Flat Notion-style block — light border, 4px radius, no shadow. */
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
  /** Keeps “THEME OF THE DAY” centered while fixed rails hold the edit control */
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
  cornerThemeEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  cornerThemeEditHeadingText: {
    flex: 1,
    textAlign: 'left',
    marginBottom: 0,
    paddingRight: 8,
  },
  cornerThemeEditCloseHit: {
    padding: 4,
  },
  cornerThemeEditActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  cornerThemeEditSecondaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: NOTION_FLAT_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cornerThemeEditSecondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cornerThemeEditPrimaryBtn: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: NOTION_FLAT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  themeDaySectionHeadingConsolidated: {
    textAlign: 'center',
    marginBottom: 14,
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
  themeComingSoonCard: {
    position: 'relative',
    alignItems: 'flex-start',
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
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
});


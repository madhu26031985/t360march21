import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, Crown, User, Shield, Eye, UserCheck, Plus, Edit3, FileText, NotebookPen, MessageSquare, Bell, FileBarChart, Award, BookOpen, Mic, ClipboardCheck, CheckSquare, Users, MessageCircle, Settings, UserCog, LayoutDashboard, Vote, Save, X } from 'lucide-react-native';
import { Image } from 'react-native';

/** Bottom nav: icons + labels scaled to 75% of prior size (25% reduction) */
const FOOTER_NAV_ICON_SIZE = 15;

const CORNER_THEME_MAX_LEN = 50;

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

// NEW INTERFACE for consolidated Toastmaster data
interface ToastmasterMeetingData {
  id: string;
  meeting_id: string;
  club_id: string;
  toastmaster_user_id: string;
  personal_notes: string | null;
  theme_of_the_day: string | null; // New column
  theme_summary: string | null;    // New column
  created_at: string;
  updated_at: string;
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
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams();
  /** Wide side gutters so the elevated card reads like meeting-detail panels (~11% each side, clamped). */
  const consolidatedCardSideMargin = Math.min(56, Math.max(36, Math.round(windowWidth * 0.11)));
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [toastmasterOfDay, setToastmasterOfDay] = useState<ToastmasterOfDay | null>(null);
  const [toastmasterMeetingData, setToastmasterMeetingData] = useState<ToastmasterMeetingData | null>(null); // New state for consolidated data
  const [isExComm, setIsExComm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingTmodRole, setBookingTmodRole] = useState(false);
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

  useEffect(() => {
    if (meetingId) {
      loadToastmasterCornerData();
    }
  }, [meetingId]);

  useFocusEffect(
    useCallback(() => {
      // Always refresh when coming back to this screen
      if (meetingId && user?.currentClubId) {
        loadToastmasterCornerData();
      }
    }, [meetingId, user?.currentClubId])
  );

  const TMOD_CONGRATS_SEEN_KEY = meetingId ? `tmodCongratsSeen_${meetingId}` : null;

  useEffect(() => {
    if (isLoading || !meeting || !isToastmasterOfDay() || isThemeCompleted() || !TMOD_CONGRATS_SEEN_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(TMOD_CONGRATS_SEEN_KEY);
        if (!cancelled && !seen) setShowCongratsModal(true);
      } catch {
        if (!cancelled) setShowCongratsModal(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoading, meeting, toastmasterOfDay?.assigned_user_id, toastmasterMeetingData?.theme_of_the_day, TMOD_CONGRATS_SEEN_KEY]);

  const dismissCongratsModal = useCallback(() => {
    if (TMOD_CONGRATS_SEEN_KEY) {
      AsyncStorage.setItem(TMOD_CONGRATS_SEEN_KEY, '1').catch(() => {});
    }
    setShowCongratsModal(false);
  }, [TMOD_CONGRATS_SEEN_KEY]);

  useEffect(() => {
    if (!user?.id || toastmasterOfDay?.assigned_user_id !== user.id) return;
    const themeSaved = !!(toastmasterMeetingData?.theme_of_the_day?.trim());
    if (themeSaved && !editingSavedCornerTheme) return;
    setCornerThemeName(
      (toastmasterMeetingData?.theme_of_the_day || '').slice(0, CORNER_THEME_MAX_LEN)
    );
  }, [
    user?.id,
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
    if (!isToastmasterOfDay() || !meetingId || !user?.currentClubId || savingCornerTheme) return;
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
        await loadToastmasterCornerData();
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
            toastmaster_user_id: user.id,
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
      await loadToastmasterCornerData();
    } catch (e) {
      console.error('Error saving theme:', e);
      alertCorner('Error', 'Failed to save theme. Please try again.');
    } finally {
      setSavingCornerTheme(false);
    }
  };

  const handleBookTmodInline = async () => {
    if (!meetingId || !user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingTmodRole(true);
    try {
      const result = await bookOpenMeetingRole(
        user.id,
        meetingId,
        { ilikeRoleName: '%toastmaster%' },
        'Toastmaster of the Day is already booked or not set up for this meeting.'
      );
      if (result.ok) {
        await loadToastmasterCornerData();
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingTmodRole(false);
    }
  };

  const loadToastmasterCornerData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      // Booked TMOD comes from app_meeting_roles_management (not app_meeting_roles).
      // Theme in toastmaster_meeting_data is keyed by toastmaster_user_id — must match this assignee.
      const { data: tmData, error: tmError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
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
        .maybeSingle();

      if (tmError) {
        console.error('Error loading toastmaster of day:', tmError);
        // Continue without toastmasterOfDay if there's an error
      }
      setToastmasterOfDay(tmData);

      await Promise.all([
        loadMeeting(),
        loadClubInfo(),
        loadToastmasterMeetingData(tmData?.assigned_user_id), // Pass assigned_user_id
        loadUserRole()
      ]);
    } catch (error) {
      console.error('Error loading toastmaster corner data:', error);
      Alert.alert('Error', 'Failed to load toastmaster corner data');
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

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number, charter_date')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const loadUserRole = async () => {
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

  /** Theme row for whoever is booked TMOD only. No row / empty theme → new TMOD can enter. */
  const loadToastmasterMeetingData = async (assignedToastmasterId: string | null) => {
    if (!meetingId || !user?.currentClubId) {
      setToastmasterMeetingData(null);
      return;
    }

    try {
      if (!assignedToastmasterId) {
        setToastmasterMeetingData(null);
        return;
      }

      const { data, error } = await supabase
        .from('toastmaster_meeting_data')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId)
        .eq('toastmaster_user_id', assignedToastmasterId)
        .maybeSingle();

      if (error) {
        console.error('Error loading toastmaster meeting data:', error);
        setToastmasterMeetingData(null);
        return;
      }

      setToastmasterMeetingData(data ?? null);
    } catch (error) {
      console.error('Error loading toastmaster meeting data:', error);
      setToastmasterMeetingData(null);
    }
  };

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
      case 'excomm': return '#8b5cf6';
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Toastmaster Corner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.contentContainer, styles.contentContainerPadded]}
      >
        <View style={styles.contentTop} pointerEvents="box-none">
        {showConsolidatedTmodCard ? (
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

            <View style={[styles.consolidatedDivider, { backgroundColor: '#EAEAEA' }]} />

            {isToastmasterOfDay() && (!isThemeCompleted() || editingSavedCornerTheme) ? (
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
                    {isToastmasterOfDay() ? (
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
        ) : (
          <>
            <View
              style={[
                styles.meetingCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
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
              <View style={styles.meetingCardDecoration} />
            </View>

            <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
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
                      opacity: bookingTmodRole ? 0.85 : 1,
                    },
                  ]}
                  onPress={() => handleBookTmodInline()}
                  disabled={bookingTmodRole}
                >
                  {bookingTmodRole ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>
                      Book TMOD Role
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        </View>

        {/* Spacer that pushes nav to bottom when content is short */}
        <View style={styles.navSpacer} />

        {/* Footer Navigation - Show when NO TMOD assigned */}
        {!toastmasterOfDay?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            marginTop: 0,
            marginBottom: 16
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
          </ScrollView>
        </View>
        )}

        {/* Footer Navigation - Only show when TMOD is assigned */}
        {toastmasterOfDay?.assigned_user_id && (
          <View style={[styles.footerNavigationInline, {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            marginTop: 0,
            marginBottom: 16
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

            {isToastmasterOfDay() && (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() =>
                  router.push({
                    pathname: '/toastmaster-notes',
                    params: { meetingId: meeting?.id, clubId: clubInfo?.id },
                  })
                }
                accessibilityLabel="TMOD prep space"
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

      {/* Congrats TMOD modal - shown once per meeting when TMOD has not added theme */}
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
              You're the TMOD, leading the meeting as captain and host. Add your{' '}
              <Text style={styles.congratsModalHighlight}>Theme of the Day</Text>
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
  },
  contentContainerPadded: {
    paddingHorizontal: 4,
  },
  contentTop: {},
  navSpacer: {
    flex: 1,
    minHeight: 16,
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
  bookRoleButton: {
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
  /** ~30% smaller footprint than full-width Save Theme */
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
    borderRadius: 10,
    borderWidth: 1.5,
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
    borderRadius: 10,
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


import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Animated, Modal, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { bookOpenMeetingRole } from '@/lib/bookMeetingRoleInline';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, Crown, User, Shield, Eye, UserCheck, Plus, Edit3, FileText, NotebookPen, MessageSquare, Bell, FileBarChart, Award, BookOpen, Mic, ClipboardCheck, CheckSquare, Users, MessageCircle, Settings, UserCog, LayoutDashboard, Vote, Sparkles, Save, X } from 'lucide-react-native';
import { Image } from 'react-native';

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

function formatCornerMeetingMeta(m: Meeting): string {
  const date = new Date(m.meeting_date);
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const parts: string[] = [monthDay, weekday];
  if (m.meeting_start_time && m.meeting_end_time) {
    parts.push(`${m.meeting_start_time} – ${m.meeting_end_time}`);
  } else if (m.meeting_start_time) {
    parts.push(m.meeting_start_time);
  }
  const mode =
    m.meeting_mode === 'in_person' ? 'In Person' : m.meeting_mode === 'online' ? 'Online' : 'Hybrid';
  parts.push(mode);
  return parts.join(' · ');
}

export default function ToastmasterCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
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
  const [cornerThemeSummary, setCornerThemeSummary] = useState('');
  const [savingCornerTheme, setSavingCornerTheme] = useState(false);
  const [editingSavedCornerTheme, setEditingSavedCornerTheme] = useState(false);

  const themeIconPulse = useRef(new Animated.Value(1)).current;

  const isToastmasterOfDay = () => {
    return toastmasterOfDay?.assigned_user_id === user?.id && toastmasterOfDay?.booking_status === 'booked';
  };

  const isThemeCompleted = () => {
    return !!(toastmasterMeetingData?.theme_of_the_day && toastmasterMeetingData?.theme_summary);
  };

  useEffect(() => {
    const shouldAnimate = isToastmasterOfDay() && !isThemeCompleted();

    if (!shouldAnimate) {
      themeIconPulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(themeIconPulse, {
          toValue: 1.15,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(themeIconPulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
      themeIconPulse.setValue(1);
    };
  }, [toastmasterMeetingData?.theme_of_the_day, toastmasterMeetingData?.theme_summary, toastmasterOfDay?.assigned_user_id]);

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
  }, [isLoading, meeting, toastmasterOfDay?.assigned_user_id, toastmasterMeetingData?.theme_of_the_day, toastmasterMeetingData?.theme_summary, TMOD_CONGRATS_SEEN_KEY]);

  const dismissCongratsModal = useCallback(() => {
    if (TMOD_CONGRATS_SEEN_KEY) {
      AsyncStorage.setItem(TMOD_CONGRATS_SEEN_KEY, '1').catch(() => {});
    }
    setShowCongratsModal(false);
  }, [TMOD_CONGRATS_SEEN_KEY]);

  useEffect(() => {
    if (!user?.id || toastmasterOfDay?.assigned_user_id !== user.id) return;
    const bothSaved = !!(
      toastmasterMeetingData?.theme_of_the_day && toastmasterMeetingData?.theme_summary
    );
    if (bothSaved && !editingSavedCornerTheme) return;
    setCornerThemeName(toastmasterMeetingData?.theme_of_the_day || '');
    setCornerThemeSummary(toastmasterMeetingData?.theme_summary || '');
  }, [
    user?.id,
    toastmasterOfDay?.assigned_user_id,
    toastmasterMeetingData?.id,
    toastmasterMeetingData?.theme_of_the_day,
    toastmasterMeetingData?.theme_summary,
    editingSavedCornerTheme,
  ]);

  const alertCorner = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message || '');
  };

  const saveCornerTheme = async () => {
    if (!isToastmasterOfDay() || !meetingId || !user?.currentClubId || savingCornerTheme) return;
    const summaryLen = cornerThemeSummary.trim().length;
    if (summaryLen > 400) {
      alertCorner('Validation', 'Theme summary cannot exceed 400 characters.');
      return;
    }
    setSavingCornerTheme(true);
    try {
      if (toastmasterMeetingData?.id) {
        const updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            theme_of_the_day: cornerThemeName.trim() || null,
            theme_summary: cornerThemeSummary.trim() || null,
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
          theme_of_the_day: cornerThemeName.trim() || null,
          theme_summary: cornerThemeSummary.trim() || null,
          updated_at: updatedAt,
        });
      } else {
        const { data, error } = await supabase
          .from('toastmaster_meeting_data')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            toastmaster_user_id: user.id,
            theme_of_the_day: cornerThemeName.trim() || null,
            theme_summary: cornerThemeSummary.trim() || null,
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
      // Load Toastmaster of Day first, as it's needed for loadToastmasterMeetingData
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

  // NEW FUNCTION to load consolidated Toastmaster data
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

      const { data: allEntries, error } = await supabase
        .from('toastmaster_meeting_data')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading toastmaster meeting data:', error);
        setToastmasterMeetingData(null);
        return;
      }

      if (!allEntries || allEntries.length === 0) {
        setToastmasterMeetingData(null);
        return;
      }

      const bookedTmodEntry = allEntries.find(
        (e: any) => e.toastmaster_user_id === assignedToastmasterId
      );
      setToastmasterMeetingData(bookedTmodEntry || allEntries[0]);
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

  const showConsolidatedThemeView =
    Boolean(
      toastmasterOfDay?.assigned_user_id &&
        toastmasterOfDay.app_user_profiles &&
        toastmasterMeetingData?.theme_of_the_day &&
        toastmasterMeetingData?.theme_summary
    ) && !(isToastmasterOfDay() && editingSavedCornerTheme);

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
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.contentTop} pointerEvents="box-none">
        {showConsolidatedThemeView ? (
          <View
            style={[
              styles.consolidatedCornerCard,
              {
                backgroundColor: theme.mode === 'dark' ? theme.colors.surface : '#FFFFFF',
                shadowColor: '#000000',
              },
            ]}
          >
            {isToastmasterOfDay() && (
              <View style={styles.consolidatedCardActions}>
                <TouchableOpacity
                  style={styles.consolidatedCardActionHit}
                  onPress={() =>
                    router.push({
                      pathname: '/toastmaster-notes',
                      params: { meetingId: meeting?.id, clubId: clubInfo?.id },
                    })
                  }
                  accessibilityLabel="Open prep space"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <NotebookPen
                    size={20}
                    color={theme.mode === 'dark' ? '#A3A3A3' : '#777777'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.consolidatedCardActionHit}
                  onPress={() => setEditingSavedCornerTheme(true)}
                  accessibilityLabel="Edit theme of the day"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit3 size={20} color={theme.mode === 'dark' ? '#A3A3A3' : '#777777'} />
                </TouchableOpacity>
              </View>
            )}

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

            <Text
              style={[
                styles.consolidatedThemeSectionLabel,
                { color: theme.mode === 'dark' ? '#A3A3A3' : '#8A8FA3' },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              THEME OF THE DAY
            </Text>
            <Text
              style={[
                styles.consolidatedThemeTitle,
                { color: theme.mode === 'dark' ? theme.colors.text : '#111111' },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {toastmasterMeetingData!.theme_of_the_day}
            </Text>
            <Text
              style={[
                styles.consolidatedThemeSummary,
                {
                  color: theme.mode === 'dark' ? theme.colors.textSecondary : '#666666',
                },
              ]}
              maxFontSizeMultiplier={1.25}
            >
              &ldquo;{toastmasterMeetingData!.theme_summary}&rdquo;
            </Text>

            <View style={[styles.consolidatedBottomDivider, { backgroundColor: '#EAEAEA' }]} />

            <Text
              style={[
                styles.consolidatedMeetingMetaBottom,
                { color: theme.mode === 'dark' ? '#A3A3A3' : '#999999' },
              ]}
              maxFontSizeMultiplier={1.2}
            >
              {formatCornerMeetingMeta(meeting)}
            </Text>
          </View>
        ) : (
        <>
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

        {/* Toastmaster of the Day Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          {toastmasterOfDay?.assigned_user_id && toastmasterOfDay.app_user_profiles ? (
            <View style={styles.toastmasterCard}>
              <View style={styles.toastmasterInfo}>
                <View style={styles.toastmasterAvatar}>
                  {toastmasterOfDay.app_user_profiles.avatar_url ? (
                    <Image
                      source={{ uri: toastmasterOfDay.app_user_profiles.avatar_url }}
                      style={styles.toastmasterAvatarImage}
                    />
                  ) : (
                    <Crown size={16} color="#ffffff" />
                  )}
                </View>
                <View style={styles.toastmasterDetails}>
                  <Text style={[styles.toastmasterName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {toastmasterOfDay.app_user_profiles.full_name}
                  </Text>
                  <Text style={[styles.toastmasterRoleLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Toastmaster of the day
                  </Text>
                </View>
                {isToastmasterOfDay() && (
                  <View style={styles.toastmasterActionWrapper}>
                    <Animated.View
                      style={
                        !isThemeCompleted()
                          ? [
                              styles.themeNotebookHighlight,
                              {
                                transform: [{ scale: themeIconPulse }],
                                shadowColor: '#f97316',
                              },
                            ]
                          : undefined
                      }
                    >
                      <TouchableOpacity
                        style={styles.prepSpaceIconButton}
                        onPress={() =>
                          router.push({
                            pathname: '/toastmaster-notes',
                            params: { meetingId: meeting?.id, clubId: clubInfo?.id },
                          })
                        }
                      >
                        <NotebookPen size={20} color="#f97316" />
                      </TouchableOpacity>
                    </Animated.View>

                    {!isThemeCompleted() && (
                      <Text
                        style={styles.toastmasterActionHint}
                        maxFontSizeMultiplier={1.2}
                      >
                        Add theme
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          ) : (
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
          )}
        </View>

        {/* Theme of the Day Section - Only show when TMOD is assigned */}
        {toastmasterOfDay?.assigned_user_id && (
          <>
                {/* Theme Title Box */}
                <View style={[styles.section, { backgroundColor: '#ffffff' }]}>
                  {!(
                    isToastmasterOfDay() &&
                    (!isThemeCompleted() || editingSavedCornerTheme)
                  ) && (
                    <View style={styles.themeHeaderRow}>
                      <View style={[styles.themeHeaderIcon, { backgroundColor: '#FFF4E6' }]}>
                        <Text style={styles.themeHeaderEmoji} maxFontSizeMultiplier={1.3}>🎭</Text>
                      </View>
                      <Text style={[styles.themeHeaderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Theme of the Day</Text>
                    </View>
                  )}

                  {isToastmasterOfDay() && (!isThemeCompleted() || editingSavedCornerTheme) ? (
                      <View
                        style={[
                          styles.cornerThemeFormCard,
                          {
                            backgroundColor: theme.colors.surface,
                          },
                        ]}
                      >
                        <View style={styles.cornerThemeFormHeader}>
                          <View style={[styles.cornerThemeFormIcon, { backgroundColor: '#f0e7ff' }]}>
                            <Sparkles size={20} color="#8b5cf6" />
                          </View>
                          <View style={styles.cornerThemeFormTitleBlock}>
                            <Text style={[styles.cornerThemeFormTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              Meeting Theme
                            </Text>
                            <Text style={[styles.cornerThemeFormSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Set the theme of the day for your meeting
                            </Text>
                          </View>
                          {editingSavedCornerTheme && (
                            <TouchableOpacity
                              onPress={() => setEditingSavedCornerTheme(false)}
                              style={styles.cornerThemeFormCancel}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.cornerThemeFormCancelText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                                Cancel
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        <View style={styles.cornerThemeFormInputSection}>
                          <View style={styles.cornerThemeFormLabelRow}>
                            <Text style={[styles.cornerThemeFormLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                              THEME NAME
                            </Text>
                            {cornerThemeName.length > 0 && (
                              <TouchableOpacity
                                style={[styles.cornerThemeFormClear, { backgroundColor: theme.colors.border }]}
                                onPress={() => setCornerThemeName('')}
                                accessibilityLabel="Clear theme name"
                              >
                                <X size={14} color={theme.colors.text} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <TextInput
                            style={[
                              styles.cornerThemeNameInput,
                              {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                                color: theme.colors.text,
                              },
                            ]}
                            placeholder="e.g., Innovation, Leadership, Growth..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={cornerThemeName}
                            onChangeText={setCornerThemeName}
                            maxLength={125}
                          />
                          <Text style={[styles.cornerThemeCharCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {cornerThemeName.length}/125
                          </Text>
                        </View>

                        <View style={styles.cornerThemeFormInputSection}>
                          <View style={styles.cornerThemeFormLabelRow}>
                            <Text style={[styles.cornerThemeFormLabel, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>
                              THEME SUMMARY
                            </Text>
                            {cornerThemeSummary.length > 0 && (
                              <TouchableOpacity
                                style={[styles.cornerThemeFormClear, { backgroundColor: theme.colors.border }]}
                                onPress={() => setCornerThemeSummary('')}
                                accessibilityLabel="Clear theme summary"
                              >
                                <X size={14} color={theme.colors.text} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <TextInput
                            style={[
                              styles.cornerThemeSummaryInput,
                              {
                                backgroundColor: theme.colors.background,
                                borderColor: theme.colors.border,
                                color: theme.colors.text,
                              },
                            ]}
                            placeholder="Describe the theme and how it relates to today's meeting..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={cornerThemeSummary}
                            onChangeText={setCornerThemeSummary}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                            maxLength={400}
                          />
                          <Text
                            style={[
                              styles.cornerThemeCharCount,
                              {
                                color:
                                  cornerThemeSummary.length > 400
                                    ? '#dc2626'
                                    : theme.colors.textSecondary,
                              },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            {cornerThemeSummary.length}/400
                          </Text>
                          <Text style={[styles.cornerThemeCharHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Maximum 400 characters
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.cornerThemeSaveBtn,
                            {
                              backgroundColor: savingCornerTheme ? theme.colors.border : theme.colors.primary,
                              opacity: savingCornerTheme ? 0.5 : 1,
                            },
                          ]}
                          onPress={saveCornerTheme}
                          disabled={savingCornerTheme}
                        >
                          <View style={styles.cornerThemeSaveBtnInner}>
                            {!savingCornerTheme && <Save size={20} color="#FFFFFF" />}
                            <Text
                              style={[
                                styles.cornerThemeSaveBtnText,
                                {
                                  color: savingCornerTheme ? theme.colors.textSecondary : '#FFFFFF',
                                  marginLeft: savingCornerTheme ? 0 : 8,
                                },
                              ]}
                              maxFontSizeMultiplier={1.3}
                            >
                              {savingCornerTheme ? 'Saving...' : 'Save Theme'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                  ) : toastmasterMeetingData?.theme_of_the_day ? (
                    <Text style={[styles.themeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {toastmasterMeetingData.theme_of_the_day}
                    </Text>
                  ) : (
                    <View style={styles.themeComingSoonCard}>
                      <Text style={[styles.themeComingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Toastmaster of the Day{'\n'}is crafting the theme — stay tuned!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Theme Summary Box */}
                {toastmasterMeetingData?.theme_of_the_day && (
                  toastmasterMeetingData.theme_summary ? (
                    <View style={[styles.themeSummaryCard, { backgroundColor: '#ffffff' }]}>
                      <Text style={[styles.themeSummaryLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        THEME SUMMARY
                      </Text>
                      <Text style={[styles.themeSummaryText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {toastmasterMeetingData.theme_summary}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.emptyStateSummaryBox, { backgroundColor: '#ffffff' }]}>
                      <View style={styles.emptyStateCard}>
                        <View style={[styles.emptyStateIcon, { backgroundColor: '#FEF3E2' }]}>
                          <Text style={styles.emptyStateEmoji} maxFontSizeMultiplier={1.3}>📝</Text>
                        </View>
                        <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          No Summary Added
                        </Text>
                        <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Add a summary to explain the theme
                        </Text>
                      </View>
                    </View>
                  )
                )}
          </>
        )}
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
                <NotebookPen size={20} color="#f97316" />
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
                <NotebookPen size={20} color="#f97316" />
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
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId: meeting?.id } })}
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
                <MessageCircle size={20} color="#0d9488" />
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
                <ClipboardCheck size={20} color="#772432" />
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
              You're the TMOD, leading the meeting as captain and host. Add{' '}
              <Text style={styles.congratsModalHighlight}>Theme of the Day</Text>
              {' '}and{' '}
              <Text style={styles.congratsModalHighlight}>Theme summary</Text>
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
  toastmasterCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 13,
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
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
  prepSpaceIconButton: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  themeNotebookHighlight: {
    borderRadius: 22,
    padding: 4,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  toastmasterActionWrapper: {
    alignItems: 'center',
  },
  toastmasterActionHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#ea580c',
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
  themeSummaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 3,
    borderColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  themeSummaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  themeSummaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  noSummaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  noSummaryText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
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
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateEmoji: {
    fontSize: 28,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
    marginTop: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyStateSummaryBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  footerNavigationInline: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
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
  cornerThemeFormCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cornerThemeFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  cornerThemeFormCancel: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  cornerThemeFormCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cornerThemeFormIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cornerThemeFormTitleBlock: {
    flex: 1,
  },
  cornerThemeFormTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cornerThemeFormSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  cornerThemeFormInputSection: {
    marginBottom: 20,
  },
  cornerThemeFormLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cornerThemeFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cornerThemeFormClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerThemeNameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  cornerThemeSummaryInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 160,
    lineHeight: 24,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  cornerThemeCharCount: {
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  cornerThemeCharHint: {
    fontSize: 11,
    textAlign: 'right',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cornerThemeSaveBtn: {
    marginTop: 4,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  consolidatedCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginBottom: 4,
  },
  consolidatedCardActionHit: {
    padding: 8,
  },
  consolidatedClubBadge: {
    backgroundColor: '#F1F2F4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 2,
    marginBottom: 20,
    alignSelf: 'center',
  },
  consolidatedClubTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
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
  consolidatedThemeSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
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
  consolidatedThemeSummary: {
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'left',
    alignSelf: 'stretch',
    marginTop: 14,
    paddingHorizontal: 4,
    fontStyle: 'italic',
  },
  consolidatedBottomDivider: {
    width: '100%',
    height: 1,
    marginTop: 22,
    marginBottom: 20,
  },
  consolidatedMeetingMetaBottom: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: 0.3,
    paddingHorizontal: 8,
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
  themeComingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
});


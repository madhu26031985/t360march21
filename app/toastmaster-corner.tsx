import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, Crown, User, Shield, Eye, UserCheck, Plus, Edit3, FileText, NotebookPen, Star, MessageSquare, Bell, FileBarChart, Award, BookOpen, Mic, ClipboardCheck, CheckSquare, Users, MessageCircle, Settings, UserCog, LayoutDashboard, Vote } from 'lucide-react-native';
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

export default function ToastmasterCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [toastmasterOfDay, setToastmasterOfDay] = useState<ToastmasterOfDay | null>(null);
  const [toastmasterMeetingData, setToastmasterMeetingData] = useState<ToastmasterMeetingData | null>(null); // New state for consolidated data
  const [isExComm, setIsExComm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Star size={20} color="#f59e0b" fill="#f59e0b" />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Toastmaster Corner</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.contentTop} pointerEvents="box-none">
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
                style={[styles.bookRoleButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push({
                  pathname: '/book-a-role',
                  params: { meetingId: meeting?.id }
                })}
              >
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>Book TMOD Role</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Theme of the Day Section - Only show when TMOD is assigned */}
        {toastmasterOfDay?.assigned_user_id && (
          <>
            {toastmasterMeetingData?.theme_of_the_day && toastmasterMeetingData?.theme_summary ? (
              <View style={[styles.themeDisplayCard, { backgroundColor: '#ffffff' }]}>
                {/* Decorative Header */}
                <View style={styles.themeDisplayHeader}>
                  <Text style={styles.themeHeaderEmoji} maxFontSizeMultiplier={1.3}>🎭</Text>
                  <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
                  <Text style={[styles.themeDisplayHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    THEME OF THE DAY
                  </Text>
                  <Text style={styles.themeHeaderEmoji} maxFontSizeMultiplier={1.3}>🎭</Text>
                  <Text style={styles.decorativeSparkleSmall} maxFontSizeMultiplier={1.3}>✨</Text>
                </View>

                <View style={styles.themeDisplayDivider} />

                {/* Theme Title */}
                <Text style={[styles.themeDisplayTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {toastmasterMeetingData.theme_of_the_day}
                </Text>

                {/* Theme Summary */}
                <Text style={[styles.themeDisplaySummary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {toastmasterMeetingData.theme_summary}
                </Text>

                <View style={styles.themeDisplayDivider} />

                {/* Toastmaster Info at Bottom */}
                {toastmasterOfDay.app_user_profiles && (
                  <View style={styles.themeDisplayToastmaster}>
                    <View style={styles.themeDisplayToastmasterAvatar}>
                      {toastmasterOfDay.app_user_profiles.avatar_url ? (
                        <Image
                          source={{ uri: toastmasterOfDay.app_user_profiles.avatar_url }}
                          style={styles.themeDisplayAvatarImage}
                        />
                      ) : (
                        <Crown size={24} color="#8b5cf6" />
                      )}
                    </View>
                    <View style={styles.themeDisplayToastmasterInfo}>
                      <Text style={[styles.themeDisplayToastmasterName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {toastmasterOfDay.app_user_profiles.full_name}
                      </Text>
                      <Text style={[styles.themeDisplayToastmasterRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Toastmaster of the Day
                      </Text>
                      {clubInfo?.name && (
                        <Text style={[styles.themeDisplayClubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {clubInfo.name}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <>
                {/* Theme Title Box */}
                <View style={[styles.section, { backgroundColor: '#ffffff' }]}>
                  <View style={styles.themeHeaderRow}>
                    <View style={[styles.themeHeaderIcon, { backgroundColor: '#FFF4E6' }]}>
                      <Text style={styles.themeHeaderEmoji} maxFontSizeMultiplier={1.3}>🎭</Text>
                    </View>
                    <Text style={[styles.themeHeaderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Theme of the Day</Text>
                  </View>

                  {toastmasterMeetingData?.theme_of_the_day ? (
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  themeDisplayCard: {
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
  },
  themeDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  themeDisplayHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  decorativeSparkleSmall: {
    fontSize: 16,
  },
  themeDisplayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  themeDisplayTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  themeDisplaySummary: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 0,
  },
  themeDisplayToastmaster: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  themeDisplayToastmasterAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#8b5cf6',
  },
  themeDisplayAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  themeDisplayToastmasterInfo: {
    flex: 1,
  },
  themeDisplayToastmasterName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  themeDisplayToastmasterRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  themeDisplayClubNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
});


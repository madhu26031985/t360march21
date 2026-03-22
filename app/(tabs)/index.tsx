import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Building2, User, BookOpen, Users, Calendar, Vote, FileText, ClipboardCheck, ChevronRight, MessageSquare, Mic, GraduationCap } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import ClubSwitcher from '@/components/ClubSwitcher';
import { supabase } from '@/lib/supabase';

interface IconTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  width?: string;
  onPress: () => void;
}

function IconTile({ title, icon, color, width, onPress }: IconTileProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.iconTile,
        width ? { width } : null,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconTileIconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.iconTileTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

interface MeetingActionButtonProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

function MeetingActionButton({ title, icon, color, onPress }: MeetingActionButtonProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.meetingActionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.meetingActionButtonIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.meetingActionButtonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

interface JourneyPlaceholderTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

function JourneyPlaceholderTile({ title, icon, color, onPress }: JourneyPlaceholderTileProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.journeyPlaceholderTile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.journeyPlaceholderIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.journeyPlaceholderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

interface JourneyListCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  inline?: boolean;
}

function JourneyListCard({ title, description, icon, color, onPress, inline }: JourneyListCardProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.journeyListCard,
        !inline && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        inline && styles.journeyListCardInline,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.journeyListIconWrap, { backgroundColor: `${color}20` }]}>
        {icon}
      </View>
      <View style={styles.journeyListTextCol}>
        <Text style={[styles.journeyListTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={[styles.journeyListDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyJourney() {
  const { theme } = useTheme();
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [currentOpenMeetingId, setCurrentOpenMeetingId] = useState<string | null>(null);
  const [currentOpenMeetingTitle, setCurrentOpenMeetingTitle] = useState<string | null>(null);
  const [currentOpenMeetingDate, setCurrentOpenMeetingDate] = useState<string | null>(null);
  const [currentOpenMeetingStartTime, setCurrentOpenMeetingStartTime] = useState<string | null>(null);
  const [currentOpenMeetingEndTime, setCurrentOpenMeetingEndTime] = useState<string | null>(null);
  const [currentOpenMeetingMode, setCurrentOpenMeetingMode] = useState<string | null>(null);
  const [meetingAttendedCount, setMeetingAttendedCount] = useState<number>(0);
  const [speechesGivenCount, setSpeechesGivenCount] = useState<number>(0);
  const [rolesCompletedCount, setRolesCompletedCount] = useState<number>(0);
  const [evaluationsGivenCount, setEvaluationsGivenCount] = useState<number>(0);
  const [hasActivePoll, setHasActivePoll] = useState<boolean>(false);
  const [hasVotedInActivePoll, setHasVotedInActivePoll] = useState<boolean>(false);

  const voteNowScale = useSharedValue(1);
  useEffect(() => {
    voteNowScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);
  const voteNowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: voteNowScale.value }],
  }));

  const daysToGo = (() => {
    if (!currentOpenMeetingDate) return null;
    const meetingMidnight = new Date(`${currentOpenMeetingDate}T00:00:00`);
    const now = new Date();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = meetingMidnight.getTime() - nowMidnight.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  })();

  const meetingStatusText = (() => {
    if (!currentOpenMeetingDate) return '—';
    const now = new Date();

    if (daysToGo! > 0) {
      if (daysToGo === 1) return '🟠 Tomorrow';
      if (daysToGo === 2) return '🟡 In 2 days';
      if (daysToGo === 5) return '🟡 In 5 days';
      return `🟡 In ${daysToGo} days`;
    }

    if (daysToGo! < 0) return '✅ Completed';

    if (!currentOpenMeetingStartTime && !currentOpenMeetingEndTime) return '🔴 Today';

    const startTime = currentOpenMeetingStartTime || '00:00:00';
    const endTime = currentOpenMeetingEndTime || '23:59:59';
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    const meetingStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startParts[0] || 0, startParts[1] || 0, 0);
    const meetingEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endParts[0] || 0, endParts[1] || 0, 0);

    if (now < meetingStart) {
      const minsToStart = (meetingStart.getTime() - now.getTime()) / (1000 * 60);
      if (minsToStart <= 30) return '⚡ Starting Soon';
      return '🔴 Today';
    }
    if (now <= meetingEnd) return '🟢 Live Now';
    return '✅ Completed';
  })();

  const meetingDateObj = currentOpenMeetingDate ? new Date(`${currentOpenMeetingDate}T00:00:00`) : null;
  const meetingDayNum = meetingDateObj ? meetingDateObj.getDate() : null;
  const meetingMonth = meetingDateObj
    ? meetingDateObj.toLocaleString('default', { month: 'short' }).toUpperCase()
    : null;
  const meetingWeekday = meetingDateObj
    ? meetingDateObj.toLocaleDateString('default', { weekday: 'long' })
    : null;

  const formatTime = (t: string | null) => {
    if (!t) return null;
    const parts = t.split(':');
    if (parts.length < 2) return t;
    return `${parts[0]}:${parts[1]}`;
  };

  const formatMeetingMode = (mode: string | null) => {
    if (!mode) return '—';
    if (mode === 'in_person') return 'In Person';
    if (mode === 'online') return 'Online';
    if (mode === 'hybrid') return 'Hybrid';
    return mode;
  };

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserProfile();
      }
    }, [isAuthenticated, refreshUserProfile])
  );

  useEffect(() => {
    const loadJourneyStats = async () => {
      if (!user?.id || !user?.currentClubId) return;

      try {
        // Meeting attended: distinct meetings where user has any booked role
        const { data: meetingData, error: meetingErr } = await supabase
          .from('app_meeting_roles_management')
          .select('meeting_id')
          .eq('club_id', user.currentClubId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked');

        if (!meetingErr) {
          const distinctMeetingIds = new Set((meetingData || []).map((row: any) => row.meeting_id));
          setMeetingAttendedCount(distinctMeetingIds.size);
        } else {
          console.error('Error loading meeting attended count:', meetingErr);
        }

        // Roles completed: count of all roles booked
        const { count: rolesCount, error: rolesErr } = await supabase
          .from('app_meeting_roles_management')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', user.currentClubId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked');

        if (!rolesErr) setRolesCompletedCount(rolesCount ?? 0);
        else console.error('Error loading roles completed count:', rolesErr);

        // Speeches Given: count of prepared speeches booked
        const { count: speechesCount, error: speechesErr } = await supabase
          .from('app_meeting_roles_management')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', user.currentClubId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked')
          .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%');

        if (!speechesErr) setSpeechesGivenCount(speechesCount ?? 0);
        else console.error('Error loading speeches given count:', speechesErr);

        // Evaluation given: count of evaluator roles booked (speech evaluator, etc.)
        const { count: evalsCount, error: evalsErr } = await supabase
          .from('app_meeting_roles_management')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', user.currentClubId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked')
          .in('role_classification', ['Speech evaluvator', 'Master evaluvator', 'speech_evaluator']);

        if (!evalsErr) setEvaluationsGivenCount(evalsCount ?? 0);
        else console.error('Error loading evaluations given count:', evalsErr);
      } catch (e) {
        console.error('Error loading journey stats:', e);
      }
    };

    if (isAuthenticated) loadJourneyStats();
  }, [isAuthenticated, user?.id, user?.currentClubId]);

  useEffect(() => {
    if (user?.id) {
      loadUserAvatar();
    }
  }, [user?.id]);

  useEffect(() => {
    const loadCurrentOpenMeeting = async () => {
      if (!user?.currentClubId) {
        setCurrentOpenMeetingId(null);
        setCurrentOpenMeetingTitle(null);
        setCurrentOpenMeetingDate(null);
        setCurrentOpenMeetingStartTime(null);
        setCurrentOpenMeetingEndTime(null);
        setCurrentOpenMeetingMode(null);
        return;
      }

      try {
        const thirtysixHoursAgo = new Date();
        thirtysixHoursAgo.setHours(thirtysixHoursAgo.getHours() - 36);
        const cutoffDate = thirtysixHoursAgo.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('app_club_meeting')
          .select('id, meeting_title, meeting_date, meeting_start_time, meeting_end_time, meeting_mode')
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'open')
          .gte('meeting_date', cutoffDate)
          .order('meeting_date', { ascending: true })
          .limit(1);

        if (error) {
          console.error('Error loading current open meeting:', error);
          setCurrentOpenMeetingId(null);
          setCurrentOpenMeetingTitle(null);
          setCurrentOpenMeetingDate(null);
          setCurrentOpenMeetingStartTime(null);
          setCurrentOpenMeetingEndTime(null);
          setCurrentOpenMeetingMode(null);
          return;
        }

        setCurrentOpenMeetingId((data && data[0]?.id) || null);
        setCurrentOpenMeetingTitle((data && data[0]?.meeting_title) || null);
        setCurrentOpenMeetingDate((data && data[0]?.meeting_date) || null);
        setCurrentOpenMeetingStartTime((data && data[0]?.meeting_start_time) || null);
        setCurrentOpenMeetingEndTime((data && data[0]?.meeting_end_time) || null);
        setCurrentOpenMeetingMode((data && data[0]?.meeting_mode) || null);
      } catch (e) {
        console.error('Exception loading current open meeting:', e);
        setCurrentOpenMeetingId(null);
        setCurrentOpenMeetingTitle(null);
        setCurrentOpenMeetingDate(null);
        setCurrentOpenMeetingStartTime(null);
        setCurrentOpenMeetingEndTime(null);
        setCurrentOpenMeetingMode(null);
      }
    };

    loadCurrentOpenMeeting();
  }, [user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.currentClubId || !user?.id) {
        setHasActivePoll(false);
        setHasVotedInActivePoll(false);
        return;
      }
      (async () => {
        const { data: polls, error: pollsError } = await supabase
          .from('polls')
          .select('id')
          .eq('club_id', user.currentClubId)
          .eq('status', 'published');
        const active = !pollsError && polls && polls.length > 0;
        setHasActivePoll(!!active);
        if (!active || !polls?.length) {
          setHasVotedInActivePoll(false);
          return;
        }
        const pollIds = polls.map((p: { id: string }) => p.id);
        const { data: votes, error: votesError } = await supabase
          .from('simple_poll_votes')
          .select('poll_id')
          .eq('user_id', user.id)
          .in('poll_id', pollIds)
          .limit(1);
        setHasVotedInActivePoll(!votesError && votes && votes.length > 0);
      })();
    }, [user?.currentClubId, user?.id])
  );

  const loadUserAvatar = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading avatar:', error);
        setUserAvatar(null);
        return;
      }

      if ((data as any)?.avatar_url) {
        setUserAvatar((data as any).avatar_url);
      } else {
        setUserAvatar(null);
      }
    } catch (error) {
      console.error('Could not load user avatar:', error);
      setUserAvatar(null);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.authCheckContainer}>
          <Text style={[styles.authCheckText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Please sign in to continue
          </Text>
          <TouchableOpacity 
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            {userAvatar ? (
              <Image 
                source={{ uri: userAvatar }} 
                style={styles.profileAvatarImage}
                onError={() => setUserAvatar(null)}
              />
            ) : (
              <User size={20} color="#ffffff" />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {user.fullName}
            </Text>
            <Text style={[styles.profileSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Welcome back
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* No club card - only when user has no club */}
        {!user?.currentClubId && (
          <View style={[styles.noClubSwitcher, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.noClubHeader}>
              <View style={[styles.noClubIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <Building2 size={20} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.noClubInfo}>
                <Text style={[styles.noClubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No club
                </Text>
                <Text style={[styles.noClubSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Join or create a club to get started
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Welcome Message - only show if user has no clubs */}
        {!user?.currentClubId && (
          <>
            <View style={styles.welcomeMessageSection}>
              <View style={[styles.welcomeMessageCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.welcomeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  🎉 Welcome to T-360! 🎉
                </Text>

                <Text style={[styles.welcomeSubtitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Thank you for signing up!
                </Text>

                <View style={styles.welcomeContent}>
                  <View style={styles.welcomePoint}>
                    <Text style={[styles.welcomePointText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      👉 If you want to join a Toastmasters club, go to Settings → Club → My Club Relationships and request to join from the available clubs.
                    </Text>
                  </View>

                  <View style={styles.welcomePoint}>
                    <Text style={[styles.welcomePointText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      👉 If you are an ExCom member starting a new club on T-360, simply go to Settings → Create Club to get started with managing your Toastmasters club seamlessly.
                    </Text>
                  </View>
                </View>

                <Text style={[styles.welcomeClosing, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  We're excited to have you onboard and can't wait to see your club thrive with T-360! 🚀
                </Text>
              </View>
            </View>

            <View style={[styles.journeyUnifiedBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.journeyListCardsContainer}>
                <JourneyListCard
                  title="My Profile"
                  description="View and edit your personal information"
                  icon={<User size={18} color="#3b82f6" />}
                  color="#3b82f6"
                  onPress={() => router.push('/profile')}
                  inline
                />
                <JourneyListCard
                  title="My Speeches"
                  description="Manage and organize your speech documents"
                  icon={<BookOpen size={18} color="#3b82f6" />}
                  color="#3b82f6"
                  onPress={() => router.push('/speech-repository')}
                  inline
                />
                <JourneyListCard
                  title="My Mentor"
                  description="Get guidance from your mentor"
                  icon={<Users size={18} color="#3b82f6" />}
                  color="#3b82f6"
                  onPress={() => router.push('/my-growth-guidance')}
                  inline
                />
              </View>
            </View>
          </>
        )}

            {/* My Journey + Meeting - One Master Box (when user has a club) */}
        {user?.currentClubId && (
          <>
                <View style={[styles.masterBox, { backgroundColor: theme.colors.surface }]}>
                  {/* Club selection - integrated into master box */}
                  <ClubSwitcher showRole={true} embedded />
                  <View style={[styles.masterBoxDivider, { backgroundColor: theme.colors.border }]} />
                  {/* Profile, Speeches, Mentor */}
                  <View style={styles.journeyListCardsContainer}>
                    <JourneyListCard
                      title="My Profile"
                      description="View and edit your personal information"
                      icon={<User size={18} color="#3b82f6" />}
                      color="#3b82f6"
                      onPress={() => router.push('/profile')}
                      inline
                    />
                    <JourneyListCard
                      title="My Speeches"
                      description="Manage and organize your speech documents"
                      icon={<BookOpen size={18} color="#3b82f6" />}
                      color="#3b82f6"
                      onPress={() => router.push('/speech-repository')}
                      inline
                    />
                    <JourneyListCard
                      title="My Mentor"
                      description="Get guidance from your mentor"
                      icon={<Users size={18} color="#3b82f6" />}
                      color="#3b82f6"
                      onPress={() => router.push('/my-growth-guidance')}
                      inline
                    />
                  </View>
                  <View style={[styles.masterBoxDivider, { backgroundColor: theme.colors.border }]} />
                  {/* Stats - clean Apple-style 2x2 grid */}
                  <View style={styles.masterStatsGrid}>
                    <View style={styles.masterStatsRow}>
                      <View style={styles.masterStatsCell}>
                        <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                          {meetingAttendedCount}
                        </Text>
                        <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Meeting attended</Text>
                      </View>
                      <View style={[styles.masterStatsVDivider, { backgroundColor: theme.colors.border }]} />
                      <View style={styles.masterStatsCell}>
                        <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                          {speechesGivenCount}
                        </Text>
                        <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Speeches Given</Text>
                      </View>
                    </View>
                    <View style={[styles.masterStatsHDivider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.masterStatsRow}>
                      <View style={styles.masterStatsCell}>
                        <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                          {rolesCompletedCount}
                        </Text>
                        <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Roles completed</Text>
                      </View>
                      <View style={[styles.masterStatsVDivider, { backgroundColor: theme.colors.border }]} />
                      <View style={styles.masterStatsCell}>
                        <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                          {evaluationsGivenCount}
                        </Text>
                        <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Evaluation given</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.masterBoxDivider, { backgroundColor: theme.colors.border }]} />
                  {/* Meeting details */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push('/(tabs)/meetings')}
                    style={styles.meetingDetailsRow}
                  >
                  {currentOpenMeetingId ? (
                    <>
                  <View style={[styles.dateBadge, { backgroundColor: theme.colors.textSecondary + '18' }]}>
                    <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {meetingDayNum ?? '—'}
                    </Text>
                    <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {meetingMonth ?? ''}
                    </Text>
                  </View>

                  <View style={styles.heroMeetingInfo}>
                    <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                      {currentOpenMeetingTitle || 'Open meeting'}
                    </Text>
                    {meetingWeekday && (
                      <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        Day: {meetingWeekday}
                      </Text>
                    )}
                    {(currentOpenMeetingStartTime || currentOpenMeetingEndTime) && (
                      <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        Time: {formatTime(currentOpenMeetingStartTime)}
                        {currentOpenMeetingEndTime ? ` - ${formatTime(currentOpenMeetingEndTime)}` : ''}
                      </Text>
                    )}
                    {currentOpenMeetingMode && (
                      <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        Mode: {formatMeetingMode(currentOpenMeetingMode)}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.meetingStatusPill, { backgroundColor: '#fed7aa' }]}>
                    <Text style={[styles.meetingStatusPillText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {meetingStatusText}
                    </Text>
                  </View>
                    </>
              ) : (
                  <Text style={[styles.meetingBarSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    No meeting is open - Contact VPE
                  </Text>
              )}
                  </TouchableOpacity>

              <View style={[styles.meetingActionsDivider, { backgroundColor: theme.colors.border }]} />

              <TouchableOpacity
                style={styles.meetingActionsHeader}
                onPress={() => router.push('/(tabs)/meetings')}
                activeOpacity={0.7}
              >
                <Text style={[styles.meetingActionsHeaderText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Meeting Actions
                </Text>
                <ChevronRight size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.meetingActionsGrid}>
                <MeetingActionButton
                  title="Book a Role"
                  icon={<Calendar size={16} color="#ffffff" />}
                  color="#0a66c2"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting to book a role.');
                      return;
                    }
                    router.push(`/book-a-role?meetingId=${currentOpenMeetingId}`);
                  }}
                />
                <MeetingActionButton
                  title="Meeting Agenda"
                  icon={<FileText size={16} color="#ffffff" />}
                  color="#10b981"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting to view agenda.');
                      return;
                    }
                    router.push(`/meeting-agenda-view?meetingId=${currentOpenMeetingId}`);
                  }}
                />
                <MeetingActionButton
                  title="Toastmaster of the day"
                  icon={<MessageSquare size={16} color="#ffffff" />}
                  color="#84cc16"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Toastmaster.');
                      return;
                    }
                    router.push(`/toastmaster-corner?meetingId=${currentOpenMeetingId}`);
                  }}
                />
                <MeetingActionButton
                  title="Prepared Speeches"
                  icon={<Mic size={16} color="#ffffff" />}
                  color="#14b8a6"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for prepared speeches.');
                      return;
                    }
                    router.push(`/evaluation-corner?meetingId=${currentOpenMeetingId}`);
                  }}
                />
                <MeetingActionButton
                  title="Grammarian"
                  icon={<BookOpen size={16} color="#ffffff" />}
                  color="#8b5cf6"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Grammarian.');
                      return;
                    }
                    router.push(`/grammarian?meetingId=${currentOpenMeetingId}`);
                  }}
                />
                <MeetingActionButton
                  title="Educational speaker"
                  icon={<GraduationCap size={16} color="#ffffff" />}
                  color="#f97316"
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Educational speaker.');
                      return;
                    }
                    router.push({ pathname: '/educational-corner', params: { meetingId: currentOpenMeetingId } });
                  }}
                />
              </View>

              <TouchableOpacity
                style={[styles.liveVotingHeroCard, { backgroundColor: theme.colors.surface, borderColor: '#93c5fd' }]}
                onPress={() => {
                  if (!currentOpenMeetingId) {
                    Alert.alert('No open meeting', 'There is no current open meeting to view live voting.');
                    return;
                  }
                  router.push(`/live-voting?meetingId=${currentOpenMeetingId}`);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.liveVotingHeroContent}>
                  <View style={[styles.liveVotingHeroIconWrap, { backgroundColor: '#0a66c2' }]}>
                    <Vote size={18} color="#ffffff" />
                  </View>
                  <View style={styles.liveVotingHeroTextWrap}>
                    <View style={styles.liveVotingHeroTitleRow}>
                      <Text style={[styles.liveVotingHeroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
                      {hasActivePoll && !hasVotedInActivePoll && (
                        <View style={[styles.liveVotingBadge, { backgroundColor: '#dbeafe' }]}>
                          <View style={styles.liveVotingBadgeDot} />
                          <Text style={styles.liveVotingBadgeText} maxFontSizeMultiplier={1.3}>Live</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.liveVotingHeroSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Participate in club polls</Text>
                  </View>
                  {hasActivePoll && !hasVotedInActivePoll ? (
                    <Animated.View style={[styles.voteNowButtonWrap, voteNowAnimatedStyle]}>
                      <View style={[styles.voteNowButton, { backgroundColor: '#0a66c2' }]}>
                        <Text style={styles.voteNowButtonText} maxFontSizeMultiplier={1.3}>Vote now</Text>
                        <ChevronRight size={12} color="#ffffff" />
                      </View>
                    </Animated.View>
                  ) : (
                    <ChevronRight size={20} color={theme.colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  authCheckContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  authCheckText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  noClubSwitcher: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noClubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noClubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noClubInfo: {
    flex: 1,
  },
  noClubText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  noClubSubtext: {
    fontSize: 13,
  },
  welcomeMessageSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  welcomeMessageCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  welcomeContent: {
    marginBottom: 14,
    gap: 12,
  },
  welcomePoint: {
    paddingHorizontal: 4,
  },
  welcomePointText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'left',
  },
  welcomeClosing: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  featuresGrid: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  sectionHeading: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 0,
    marginBottom: 4,
  },

  iconTile: {
    width: '31%',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 85,
  },

  iconTileIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },

  iconTileTitle: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },

  journeyPlaceholderTile: {
    width: '31%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    marginBottom: 12,
  },
  journeyPlaceholderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  journeyPlaceholderTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },

  masterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  masterBoxDivider: {
    height: 1,
    marginVertical: 18,
  },
  masterStatsGrid: {
    paddingVertical: 4,
  },
  masterStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  masterStatsCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterStatsNumber: {
    fontSize: 22,
    fontWeight: '700',
  },
  masterStatsLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  masterStatsVDivider: {
    width: 1,
  },
  masterStatsHDivider: {
    height: 1,
  },
  journeyUnifiedBox: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  journeyUnifiedDivider: {
    height: 1,
    marginVertical: 14,
  },
  journeyListCardsContainer: {
    width: '100%',
  },
  journeyListOuter: {
    paddingHorizontal: 16,
    marginTop: 8,
    paddingBottom: 16,
    flexDirection: 'column',
  },
  journeyListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
  },
  journeyListCardInline: {
    borderWidth: 0,
    marginBottom: 4,
    paddingVertical: 10,
  },
  journeyListIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyListTextCol: {
    flex: 1,
  },
  journeyListTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  journeyListDesc: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 2,
  },

  statsGridSection: {
    paddingHorizontal: 16,
    marginTop: -4,
    marginBottom: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statsBox: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'flex-start',
  },
  statsNumber: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    marginTop: 2,
  },

  meetingActionsCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  meetingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  meetingStatusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  meetingStatusPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  meetingActionsDivider: {
    height: 1,
    marginVertical: 14,
  },
  meetingActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  meetingActionsHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  meetingActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  liveVotingHeroCard: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
    borderWidth: 1,
  },
  liveVotingHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveVotingHeroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveVotingHeroTextWrap: {
    flex: 1,
  },
  liveVotingHeroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 1,
  },
  liveVotingHeroTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveVotingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  liveVotingBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0a66c2',
  },
  liveVotingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0a66c2',
  },
  liveVotingHeroSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  voteNowButtonWrap: {
    marginLeft: 4,
  },
  voteNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 18,
  },
  voteNowButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  meetingActionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  meetingActionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  meetingActionButtonTitle: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
  meetingBarCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  meetingBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  meetingBarTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
  },
  meetingBarSub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },

  heroCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    zIndex: 1,
  },
  dateBadge: {
    width: 49,
    height: 49,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadgeDay: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  dateBadgeMonth: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -2,
  },
  heroMeetingInfo: {
    flex: 1,
  },
  heroMeetingTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  heroMeetingTime: {
    fontSize: 9,
    fontWeight: '500',
    marginBottom: 1,
  },
  heroMeetingMode: {
    fontSize: 9,
    fontWeight: '500',
  },
  enterMeetingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  enterMeetingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  meetingBarCountdownWrap: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  meetingBarCountdownText: {
    fontSize: 14,
    fontWeight: '600',
  },

  quickAccessGrid: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Building2, User, BookOpen, Users, Calendar, Vote, FileText, ClipboardCheck, ChevronRight, MessageSquare, Mic, GraduationCap, AlertCircle, X, Bell } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import ClubSwitcher from '@/components/ClubSwitcher';
import { supabase } from '@/lib/supabase';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';

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
  showAlert?: boolean;
  /** Single avatar fallback. Ignored if `avatarUrls` is non-empty. */
  avatarUrl?: string | null;
  /** Booked members’ avatars; if more than one, cycles every `avatarRotateIntervalMs`. */
  avatarUrls?: string[];
  /** Default 3000 ms when multiple `avatarUrls`. */
  avatarRotateIntervalMs?: number;
}

function MeetingActionButton({
  title,
  icon,
  color,
  onPress,
  showAlert,
  avatarUrl,
  avatarUrls,
  avatarRotateIntervalMs = 3000,
}: MeetingActionButtonProps) {
  const { theme } = useTheme();
  const sourceList = useMemo(() => {
    const multi = (avatarUrls ?? []).map((u) => u.trim()).filter(Boolean);
    if (multi.length > 0) return multi;
    const one = avatarUrl?.trim();
    return one ? [one] : [];
  }, [avatarUrl, avatarUrls]);

  const sourceKey = sourceList.join('\u0000');
  const [activeUrls, setActiveUrls] = useState<string[]>([]);
  const [rotateIndex, setRotateIndex] = useState(0);
  const [droppedUrls, setDroppedUrls] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setActiveUrls(sourceList);
    setRotateIndex(0);
    setDroppedUrls(new Set());
  }, [sourceKey]);

  const visibleUrls = useMemo(
    () => activeUrls.filter((u) => !droppedUrls.has(u)),
    [activeUrls, droppedUrls]
  );
  const visibleKey = visibleUrls.join('\u0000');

  useEffect(() => {
    const n = visibleUrls.length;
    if (n <= 1) return;
    const id = setInterval(() => {
      setRotateIndex((i) => (i + 1) % n);
    }, avatarRotateIntervalMs);
    return () => clearInterval(id);
  }, [visibleKey, visibleUrls.length, avatarRotateIntervalMs]);

  useEffect(() => {
    const n = visibleUrls.length;
    if (n === 0) {
      setRotateIndex(0);
      return;
    }
    setRotateIndex((i) => i % n);
  }, [visibleKey, visibleUrls.length]);

  const currentUri = visibleUrls.length > 0 ? visibleUrls[rotateIndex % visibleUrls.length] : null;
  const showAvatar = !!currentUri;

  const alertScale = useSharedValue(1);
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (!showAlert) {
      alertScale.value = 1;
      iconPulse.value = 1;
      return;
    }
    alertScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  }, [showAlert]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  const handleAvatarError = () => {
    if (!currentUri) return;
    setDroppedUrls((prev) => new Set(prev).add(currentUri));
    setRotateIndex(0);
  };

  return (
    <TouchableOpacity
      style={[
        styles.meetingActionButton,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        showAlert && styles.meetingActionButtonAlert,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.meetingActionButtonIcon,
          showAvatar
            ? [styles.meetingActionButtonIconWithAvatar, { backgroundColor: color }]
            : { backgroundColor: color },
          iconPulseStyle,
        ]}
      >
        {showAvatar ? (
          <Image
            key={currentUri}
            source={{ uri: currentUri }}
            style={styles.meetingActionButtonAvatarImage}
            resizeMode="cover"
            onError={handleAvatarError}
          />
        ) : (
          icon
        )}
      </Animated.View>
      <Text style={[styles.meetingActionButtonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
        {title}
      </Text>
      {showAlert && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.meetingActionAlertBadge, alertAnimatedStyle]}
        >
          <AlertCircle size={14} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
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
  const [tmodNeedsThemeAlert, setTmodNeedsThemeAlert] = useState<boolean>(false);
  /** Current user has Toastmaster of the Day booked for the open meeting */
  const [userBookedToastmaster, setUserBookedToastmaster] = useState<boolean>(false);
  const [educationalSpeakerNeedsAlert, setEducationalSpeakerNeedsAlert] = useState<boolean>(false);
  /** Booked Prepared Speaker / Ice Breaker but missing speech details in app_evaluation_pathway (same checks as evaluation-corner) */
  const [preparedSpeakerNeedsSpeechDetailsAlert, setPreparedSpeakerNeedsSpeechDetailsAlert] = useState<boolean>(false);
  /** Booked Grammarian but no word of the day (matches grammarian.tsx: daily elements or structured WOTD row for this user) */
  const [grammarianNeedsWordOfTheDayAlert, setGrammarianNeedsWordOfTheDayAlert] = useState<boolean>(false);
  /** Booked role avatars for Journey Meeting Actions (visible to all; multiple → rotate 3s) */
  const [journeyGrammarianAvatarUrls, setJourneyGrammarianAvatarUrls] = useState<string[]>([]);
  /** Booked Toastmaster (any member) — same source as Meetings → Roles */
  const [journeyToastmasterAvatarUrls, setJourneyToastmasterAvatarUrls] = useState<string[]>([]);
  const [journeyEducationalAvatarUrls, setJourneyEducationalAvatarUrls] = useState<string[]>([]);
  const [journeyPreparedSpeakerAvatarUrls, setJourneyPreparedSpeakerAvatarUrls] = useState<string[]>([]);
  const [journeyTableTopicsMasterAvatarUrls, setJourneyTableTopicsMasterAvatarUrls] = useState<string[]>([]);
  const [journeyTableTopicsSpeakerAvatarUrls, setJourneyTableTopicsSpeakerAvatarUrls] = useState<string[]>([]);
  const [showBookRolePrompt, setShowBookRolePrompt] = useState<boolean>(false);
  const [showBookRoleAttention, setShowBookRoleAttention] = useState<boolean>(false);
  const bookRolePromptHandledThisSession = useRef<boolean>(false);

  const voteNowScale = useSharedValue(1);
  const heroReminderFade = useSharedValue(1);
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
  const heroReminderTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroReminderFade.value,
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

  const isCurrentOpenMeetingCompleted = meetingStatusText.includes('Completed');

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
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
        const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('app_club_meeting')
          .select('id, meeting_title, meeting_date, meeting_start_time, meeting_end_time, meeting_mode')
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'open')
          .gte('meeting_date', cutoffDate)
          .order('meeting_date', { ascending: true })
          .limit(5);

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

        const now = new Date();
        const openMeetingsWithinWindow = (data || []).filter((meeting) => {
          const meetingEndDateTime = new Date(
            `${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`
          );
          const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
          return hoursSinceMeetingEnd < 4;
        });

        const active = openMeetingsWithinWindow[0];
        setCurrentOpenMeetingId(active?.id || null);
        setCurrentOpenMeetingTitle(active?.meeting_title || null);
        setCurrentOpenMeetingDate(active?.meeting_date || null);
        setCurrentOpenMeetingStartTime(active?.meeting_start_time || null);
        setCurrentOpenMeetingEndTime(active?.meeting_end_time || null);
        setCurrentOpenMeetingMode(active?.meeting_mode || null);
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

  const refreshPollStatus = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) {
      setHasActivePoll(false);
      setHasVotedInActivePoll(false);
      return;
    }
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
  }, [user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      refreshPollStatus();
    }, [refreshPollStatus])
  );

  useEffect(() => {
    if (!user?.currentClubId || !user?.id) return;

    const channelPolls = supabase
      .channel('journey-polls')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
        filter: `club_id=eq.${user.currentClubId}`,
      }, (payload) => {
        const row = payload.new as { status?: string } | null;
        if (row?.status === 'published' || payload.eventType === 'DELETE') {
          refreshPollStatus();
        }
      })
      .subscribe();

    const channelVotes = supabase
      .channel('journey-votes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'simple_poll_votes',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        refreshPollStatus();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelPolls);
      supabase.removeChannel(channelVotes);
    };
  }, [user?.currentClubId, user?.id, refreshPollStatus]);

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id) {
        setTmodNeedsThemeAlert(false);
        setUserBookedToastmaster(false);
        return;
      }
      let cancelled = false;
      (async () => {
        const { data: roleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', currentOpenMeetingId)
          .ilike('role_name', '%toastmaster%')
          .eq('booking_status', 'booked')
          .limit(1);
        const role = Array.isArray(roleData) && roleData.length > 0 ? roleData[0] : null;
        const isCurrentUserTmod = !!(role && role.assigned_user_id === user.id);
        if (!cancelled) {
          setUserBookedToastmaster(isCurrentUserTmod);
        }
        if (!isCurrentUserTmod || cancelled) {
          if (!cancelled) setTmodNeedsThemeAlert(false);
          return;
        }
        const { data: themeData } = await supabase
          .from('toastmaster_meeting_data')
          .select('theme_of_the_day, theme_summary')
          .eq('meeting_id', currentOpenMeetingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const hasTheme = !!(themeData?.theme_of_the_day?.trim() && themeData?.theme_summary?.trim());
        if (!cancelled) setTmodNeedsThemeAlert(!hasTheme);
      })();
      return () => { cancelled = true; };
    }, [currentOpenMeetingId, user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id) {
        setEducationalSpeakerNeedsAlert(false);
        return;
      }
      let cancelled = false;
      (async () => {
        const { data: roleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', currentOpenMeetingId)
          .eq('role_name', 'Educational Speaker')
          .eq('booking_status', 'booked')
          .limit(1);
        const role = Array.isArray(roleData) && roleData.length > 0 ? roleData[0] : null;
        const isCurrentUserEdSpeaker = role && role.assigned_user_id === user.id;
        if (!isCurrentUserEdSpeaker || cancelled) {
          if (!cancelled) setEducationalSpeakerNeedsAlert(false);
          return;
        }
        const { data: contentData } = await supabase
          .from('app_meeting_educational_speaker')
          .select('speech_title, summary')
          .eq('meeting_id', currentOpenMeetingId)
          .eq('speaker_user_id', user.id)
          .maybeSingle();
        const hasContent = !!(contentData?.speech_title?.trim() && contentData?.summary?.trim());
        if (!cancelled) setEducationalSpeakerNeedsAlert(!hasContent);
      })();
      return () => { cancelled = true; };
    }, [currentOpenMeetingId, user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id || isCurrentOpenMeetingCompleted) {
        setPreparedSpeakerNeedsSpeechDetailsAlert(false);
        return;
      }
      let cancelled = false;

      const pathwayHasSpeechDetails = (p: {
        speech_title?: string | null;
        pathway_name?: string | null;
        level?: number | null;
        project_name?: string | null;
        evaluation_form?: string | null;
        comments_for_evaluator?: string | null;
      } | null) =>
        !!(
          p &&
          (p.speech_title?.trim() ||
            p.pathway_name?.trim() ||
            p.level != null ||
            p.project_name?.trim() ||
            p.evaluation_form?.trim() ||
            p.comments_for_evaluator?.trim())
        );

      (async () => {
        const { data: psRoles, error: rolesErr } = await supabase
          .from('app_meeting_roles_management')
          .select('role_name')
          .eq('meeting_id', currentOpenMeetingId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked')
          .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%');

        if (rolesErr || cancelled) {
          if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(false);
          return;
        }
        if (!psRoles?.length) {
          if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(false);
          return;
        }

        const { data: pathways, error: pathErr } = await supabase
          .from('app_evaluation_pathway')
          .select(
            'role_name, speech_title, pathway_name, level, project_name, evaluation_form, comments_for_evaluator'
          )
          .eq('meeting_id', currentOpenMeetingId)
          .eq('user_id', user.id);

        if (pathErr || cancelled) {
          if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(false);
          return;
        }

        const byRole = new Map(
          (pathways || []).map((row: any) => [row.role_name as string, row])
        );

        let needs = false;
        for (const row of psRoles) {
          const p = byRole.get(row.role_name);
          if (!pathwayHasSpeechDetails(p || null)) {
            needs = true;
            break;
          }
        }
        if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(needs);
      })();

      return () => {
        cancelled = true;
      };
    }, [currentOpenMeetingId, user?.id, isCurrentOpenMeetingCompleted])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id || isCurrentOpenMeetingCompleted) {
        setGrammarianNeedsWordOfTheDayAlert(false);
        return;
      }
      let cancelled = false;
      (async () => {
        const { data: gRole, error: rErr } = await supabase
          .from('app_meeting_roles_management')
          .select('id')
          .eq('meeting_id', currentOpenMeetingId)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked')
          .ilike('role_name', '%grammarian%')
          .limit(1)
          .maybeSingle();

        if (rErr || cancelled || !gRole) {
          if (!cancelled) setGrammarianNeedsWordOfTheDayAlert(false);
          return;
        }

        const [dailyRes, wotdRes] = await Promise.all([
          supabase
            .from('app_grammarian_daily_elements')
            .select('word_of_the_day')
            .eq('meeting_id', currentOpenMeetingId)
            .eq('grammarian_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('grammarian_word_of_the_day')
            .select('word, grammarian_user_id')
            .eq('meeting_id', currentOpenMeetingId)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        const dailyWord = (dailyRes.data?.word_of_the_day || '').trim();
        const wotd = wotdRes.data;
        const structuredWord =
          wotd && wotd.grammarian_user_id === user.id ? (wotd.word || '').trim() : '';

        const hasWord = !!(dailyWord || structuredWord);
        if (!cancelled) setGrammarianNeedsWordOfTheDayAlert(!hasWord);
      })();

      return () => {
        cancelled = true;
      };
    }, [currentOpenMeetingId, user?.id, isCurrentOpenMeetingCompleted])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || isCurrentOpenMeetingCompleted) {
        setJourneyGrammarianAvatarUrls([]);
        setJourneyToastmasterAvatarUrls([]);
        setJourneyEducationalAvatarUrls([]);
        setJourneyPreparedSpeakerAvatarUrls([]);
        setJourneyTableTopicsMasterAvatarUrls([]);
        setJourneyTableTopicsSpeakerAvatarUrls([]);
        return;
      }
      const meetingId = currentOpenMeetingId;
      let cancelled = false;

      const orderedAvatarUrlsForRoles = async (
        rolesPromise: Promise<{
          data: { assigned_user_id: string | null }[] | null;
          error: unknown;
        }>
      ): Promise<string[]> => {
        const { data, error } = await rolesPromise;
        if (cancelled || error || !data?.length) return [];
        const seen = new Set<string>();
        const orderedIds: string[] = [];
        for (const row of data) {
          const id = row.assigned_user_id;
          if (id && !seen.has(id)) {
            seen.add(id);
            orderedIds.push(id);
          }
        }
        if (!orderedIds.length) return [];
        const { data: profiles, error: pErr } = await supabase
          .from('app_user_profiles')
          .select('id, avatar_url')
          .in('id', orderedIds);
        if (cancelled || pErr || !profiles?.length) return [];
        const urlById = new Map(
          (profiles as { id: string; avatar_url: string | null }[]).map((p) => [
            p.id,
            (p.avatar_url || '').trim() || null,
          ])
        );
        return orderedIds.map((id) => urlById.get(id)).filter((u): u is string => !!u);
      };

      (async () => {
        const [gUrls, tmUrls, eUrls, pUrls, ttmUrls, ttsUrls] = await Promise.all([
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .ilike('role_name', '%grammarian%')
          ),
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .ilike('role_name', '%toastmaster%')
          ),
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .eq('role_name', 'Educational Speaker')
          ),
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%')
          ),
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .ilike('role_name', '%table%topics%master%')
          ),
          orderedAvatarUrlsForRoles(
            supabase
              .from('app_meeting_roles_management')
              .select('assigned_user_id')
              .eq('meeting_id', meetingId)
              .eq('booking_status', 'booked')
              .or(
                'role_name.ilike.%Table Topics Speaker%,role_name.ilike.%Table Topic Speaker%,role_name.ilike.%Table Topics Participant%,role_name.ilike.%Table Topic Participant%'
              )
          ),
        ]);
        if (!cancelled) {
          setJourneyGrammarianAvatarUrls(gUrls);
          setJourneyToastmasterAvatarUrls(tmUrls);
          setJourneyEducationalAvatarUrls(eUrls);
          setJourneyPreparedSpeakerAvatarUrls(pUrls);
          setJourneyTableTopicsMasterAvatarUrls(ttmUrls);
          setJourneyTableTopicsSpeakerAvatarUrls(ttsUrls);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [currentOpenMeetingId, isCurrentOpenMeetingCompleted])
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id || !user?.currentClubId) {
        setShowBookRoleAttention(false);
        return;
      }
      if (isCurrentOpenMeetingCompleted) {
        setShowBookRoleAttention(false);
        return;
      }
      const r = (user.clubRole || user.role || '').toLowerCase();
      if (r === 'guest') {
        setShowBookRoleAttention(false);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const { count, error } = await supabase
            .from('app_meeting_roles_management')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', user.currentClubId)
            .eq('meeting_id', currentOpenMeetingId)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked');
          if (!cancelled) setShowBookRoleAttention(!error && (count ?? 0) === 0);
        } catch {
          if (!cancelled) setShowBookRoleAttention(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [currentOpenMeetingId, user?.id, user?.currentClubId, user?.clubRole, user?.role, isCurrentOpenMeetingCompleted])
  );

  const BOOK_ROLE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  useFocusEffect(
    useCallback(() => {
      if (!currentOpenMeetingId || !user?.id || !user?.currentClubId) {
        setShowBookRolePrompt(false);
        return;
      }
      const role = (user.clubRole || user.role || '').toLowerCase();
      if (role === 'guest') {
        setShowBookRolePrompt(false);
        return;
      }
      let cancelled = false;
      (async () => {
        try {
          const lastShownRaw = await AsyncStorage.getItem('bookRolePromptLastShown');
          const lastShown = lastShownRaw ? parseInt(lastShownRaw, 10) : 0;
          if (cancelled || (lastShown > 0 && Date.now() - lastShown < BOOK_ROLE_COOLDOWN_MS)) return;

          const { count, error } = await supabase
            .from('app_meeting_roles_management')
            .select('id', { count: 'exact', head: true })
            .eq('club_id', user.currentClubId)
            .eq('meeting_id', currentOpenMeetingId)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked');
          if (cancelled || error || (count ?? 0) > 0) return;

          bookRolePromptHandledThisSession.current = true;
          setShowBookRolePrompt(true);
        } catch {
          if (!cancelled) setShowBookRolePrompt(false);
        }
      })();
      return () => { cancelled = true; };
    }, [currentOpenMeetingId, user?.id, user?.currentClubId, user?.clubRole, user?.role])
  );

  const dismissBookRolePrompt = useCallback(async () => {
    bookRolePromptHandledThisSession.current = true;
    setShowBookRolePrompt(false);
    try {
      await AsyncStorage.setItem('bookRolePromptLastShown', String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  }, []);

  /** TMOD tile: show booked member’s photo for everyone; fallback to session avatar if you’re TM but DB has no URL */
  const journeyToastmasterDisplayAvatarUrls = useMemo(() => {
    if (journeyToastmasterAvatarUrls.length > 0) return journeyToastmasterAvatarUrls;
    if (userBookedToastmaster && userAvatar) return [userAvatar];
    return [];
  }, [journeyToastmasterAvatarUrls, userBookedToastmaster, userAvatar]);

  type PendingMeetingReminderKey =
    | 'book_role'
    | 'toastmaster_theme'
    | 'educational_speech'
    | 'grammarian_wotd'
    | 'prepared_speech';

  const pendingMeetingReminders = useMemo((): { key: PendingMeetingReminderKey; text: string }[] => {
    if (!currentOpenMeetingId || isCurrentOpenMeetingCompleted) return [];
    const name =
      (user?.fullName || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] || 'You';
    const out: { key: PendingMeetingReminderKey; text: string }[] = [];
    if (showBookRoleAttention) {
      out.push({
        key: 'book_role',
        text: `${name}, the stage is waiting. Book your role now!`,
      });
    }
    if (tmodNeedsThemeAlert) {
      out.push({
        key: 'toastmaster_theme',
        text: `${name}, please add the Theme of the Day.`,
      });
    }
    if (educationalSpeakerNeedsAlert) {
      out.push({
        key: 'educational_speech',
        text: `${name}, please add the educational details.`,
      });
    }
    if (grammarianNeedsWordOfTheDayAlert) {
      out.push({
        key: 'grammarian_wotd',
        text: `${name}, don't forget to add the Word of the Day!`,
      });
    }
    if (preparedSpeakerNeedsSpeechDetailsAlert) {
      out.push({
        key: 'prepared_speech',
        text: `${name}, please add your speech details.`,
      });
    }
    return out;
  }, [
    currentOpenMeetingId,
    isCurrentOpenMeetingCompleted,
    showBookRoleAttention,
    tmodNeedsThemeAlert,
    educationalSpeakerNeedsAlert,
    grammarianNeedsWordOfTheDayAlert,
    preparedSpeakerNeedsSpeechDetailsAlert,
    user?.fullName,
  ]);

  const pendingRemindersKey = pendingMeetingReminders.map((r) => r.key).join('|');

  const [heroReminderSlide, setHeroReminderSlide] = useState(0);

  useEffect(() => {
    setHeroReminderSlide(0);
  }, [pendingRemindersKey]);

  useEffect(() => {
    const n = pendingMeetingReminders.length;
    if (n <= 1) return;
    const id = setInterval(() => {
      setHeroReminderSlide((i) => (i + 1) % n);
    }, 5000);
    return () => clearInterval(id);
  }, [pendingRemindersKey, pendingMeetingReminders.length]);

  useEffect(() => {
    if (pendingMeetingReminders.length === 0) return;
    heroReminderFade.value = 0.35;
    heroReminderFade.value = withTiming(1, { duration: 400 });
  }, [heroReminderSlide, pendingMeetingReminders.length]);

  const openPendingReminderTarget = useCallback(
    (key: PendingMeetingReminderKey) => {
      if (!currentOpenMeetingId) return;
      switch (key) {
        case 'book_role':
          router.push(`/book-a-role?meetingId=${currentOpenMeetingId}`);
          break;
        case 'toastmaster_theme':
          router.push(`/toastmaster-corner?meetingId=${currentOpenMeetingId}&showCongrats=1`);
          break;
        case 'educational_speech':
          router.push({
            pathname: '/educational-corner',
            params: { meetingId: currentOpenMeetingId, showCongrats: '1' },
          });
          break;
        case 'grammarian_wotd':
          router.push(`/grammarian?meetingId=${currentOpenMeetingId}`);
          break;
        case 'prepared_speech':
          router.push(`/evaluation-corner?meetingId=${currentOpenMeetingId}`);
          break;
        default:
          break;
      }
    },
    [currentOpenMeetingId]
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
                  showAlert={showBookRoleAttention}
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
                  avatarUrls={journeyToastmasterDisplayAvatarUrls}
                  showAlert={tmodNeedsThemeAlert}
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Toastmaster.');
                      return;
                    }
                    const q = tmodNeedsThemeAlert ? '&showCongrats=1' : '';
                    router.push(`/toastmaster-corner?meetingId=${currentOpenMeetingId}${q}`);
                  }}
                />
                <MeetingActionButton
                  title="Prepared Speeches"
                  icon={<Mic size={16} color="#ffffff" />}
                  color="#14b8a6"
                  avatarUrls={journeyPreparedSpeakerAvatarUrls}
                  showAlert={preparedSpeakerNeedsSpeechDetailsAlert}
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
                  avatarUrls={journeyGrammarianAvatarUrls}
                  showAlert={grammarianNeedsWordOfTheDayAlert}
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
                  avatarUrls={journeyEducationalAvatarUrls}
                  showAlert={educationalSpeakerNeedsAlert}
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Educational speaker.');
                      return;
                    }
                    router.push({
                      pathname: '/educational-corner',
                      params: {
                        meetingId: currentOpenMeetingId,
                        ...(educationalSpeakerNeedsAlert && { showCongrats: '1' }),
                      },
                    });
                  }}
                />
                <MeetingActionButton
                  title="Table Topics Master"
                  icon={<MessageSquare size={16} color="#ffffff" />}
                  color="#ea580c"
                  avatarUrls={journeyTableTopicsMasterAvatarUrls}
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Table Topics.');
                      return;
                    }
                    router.push({ pathname: '/table-topic-corner', params: { meetingId: currentOpenMeetingId } });
                  }}
                />
                <MeetingActionButton
                  title="Table Topics Speaker"
                  icon={<Mic size={16} color="#ffffff" />}
                  color="#fb923c"
                  avatarUrls={journeyTableTopicsSpeakerAvatarUrls}
                  onPress={() => {
                    if (!currentOpenMeetingId) {
                      Alert.alert('No open meeting', 'There is no current open meeting for Table Topics.');
                      return;
                    }
                    router.push({ pathname: '/table-topic-corner', params: { meetingId: currentOpenMeetingId } });
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

              {pendingMeetingReminders.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.actionReminderHeroCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  onPress={() => {
                    const item = pendingMeetingReminders[heroReminderSlide];
                    if (item) openPendingReminderTarget(item.key);
                  }}
                  activeOpacity={0.88}
                >
                  <View style={styles.actionReminderHeroRow}>
                    <View style={styles.actionReminderHeroIconWrap}>
                      <Bell size={16} color={PENDING_ACTION_UI.accent} strokeWidth={2} />
                    </View>
                    <View style={styles.actionReminderHeroTextCol}>
                      <Animated.View style={heroReminderTextAnimatedStyle}>
                        <Text
                          style={[styles.actionReminderHeroMessage, { color: theme.colors.textSecondary }]}
                          maxFontSizeMultiplier={1.25}
                        >
                          {pendingMeetingReminders[heroReminderSlide]?.text ?? ''}
                        </Text>
                      </Animated.View>
                    </View>
                    <ChevronRight size={14} color={theme.colors.textSecondary} />
                  </View>
                  {pendingMeetingReminders.length > 1 && (
                    <View style={styles.actionReminderDots}>
                      {pendingMeetingReminders.map((r, i) => (
                        <View
                          key={r.key}
                          style={[
                            styles.actionReminderDot,
                            i === heroReminderSlide ? styles.actionReminderDotActive : styles.actionReminderDotInactive,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Book Role prompt - for Visiting TM, ExComm, Member (not Guest) who haven't booked any role */}
      <Modal
        visible={showBookRolePrompt}
        transparent
        animationType="fade"
        onRequestClose={dismissBookRolePrompt}
      >
        <TouchableOpacity
          style={styles.bookRolePromptOverlay}
          activeOpacity={1}
          onPress={dismissBookRolePrompt}
        >
          <TouchableOpacity
            style={[styles.bookRolePromptContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.bookRolePromptHeaderRow}>
              <Text style={[styles.bookRolePromptTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Ready to shine?
              </Text>
              <TouchableOpacity onPress={dismissBookRolePrompt} style={styles.bookRolePromptCloseBtn} hitSlop={12}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.bookRolePromptSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your next opportunity is here.
            </Text>
            <View style={[styles.bookRolePromptDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.bookRolePromptMeetingRow}>
              {(meetingMonth != null && meetingDayNum != null) && (
                <View style={[styles.bookRolePromptDateBox, { backgroundColor: theme.colors.border }]}>
                  <Text style={[styles.bookRolePromptDateMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {meetingMonth}
                  </Text>
                  <Text style={[styles.bookRolePromptDateDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {meetingDayNum}
                  </Text>
                </View>
              )}
              <View style={styles.bookRolePromptMeetingInfo}>
                <Text style={[styles.bookRolePromptMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {currentOpenMeetingTitle || 'Meeting'}
                </Text>
                {daysToGo !== null && (
                  <View style={[styles.bookRolePromptMeetingStatus, { marginTop: 2 }]}>
                    <View style={[styles.bookRolePromptStatusDot, { backgroundColor: daysToGo <= 1 ? '#22c55e' : '#94a3b8', marginRight: 6 }]} />
                    <Text style={[styles.bookRolePromptMeetingStatusText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {daysToGo === 0 ? 'Today' : daysToGo === 1 ? 'Tomorrow' : `In ${daysToGo} days`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.bookRolePromptButton, { backgroundColor: theme.colors.text }]}
              onPress={() => {
                dismissBookRolePrompt();
                if (currentOpenMeetingId) {
                  router.push({ pathname: '/book-a-role', params: { meetingId: currentOpenMeetingId } });
                }
              }}
            >
              <Text style={styles.bookRolePromptButtonText} maxFontSizeMultiplier={1.3}>Book a role</Text>
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
  bookRolePromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  bookRolePromptContent: {
    borderRadius: 17,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 289,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  bookRolePromptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  bookRolePromptTitle: {
    fontSize: 19,
    fontWeight: '700',
    flex: 1,
  },
  bookRolePromptCloseBtn: {
    padding: 4,
  },
  bookRolePromptSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  bookRolePromptDivider: {
    height: 1,
    marginBottom: 12,
  },
  bookRolePromptMeetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  bookRolePromptDateBox: {
    width: 38,
    height: 42,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookRolePromptDateMonth: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bookRolePromptDateDay: {
    fontSize: 16,
    fontWeight: '700',
  },
  bookRolePromptMeetingInfo: {
    flex: 1,
  },
  bookRolePromptMeetingTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  bookRolePromptMeetingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookRolePromptStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bookRolePromptMeetingStatusText: {
    fontSize: 13,
  },
  bookRolePromptButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookRolePromptButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
  actionReminderHeroCard: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  actionReminderHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionReminderHeroIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PENDING_ACTION_UI.softBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionReminderHeroTextCol: {
    flex: 1,
    paddingRight: 2,
  },
  actionReminderHeroMessage: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },
  actionReminderDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  actionReminderDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  actionReminderDotActive: {
    backgroundColor: PENDING_ACTION_UI.accent,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  actionReminderDotInactive: {
    backgroundColor: '#e5e7eb',
  },
  meetingActionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  meetingActionButtonAlert: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  meetingActionAlertBadge: {
    marginLeft: 4,
  },
  meetingActionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  /** Ring color comes from tile `color` prop */
  meetingActionButtonIconWithAvatar: {
    padding: 2,
    overflow: 'hidden',
  },
  meetingActionButtonAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
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

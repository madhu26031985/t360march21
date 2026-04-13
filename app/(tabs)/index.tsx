import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  User,
  BookOpen,
  Calendar,
  Vote,
  FileText,
  ClipboardCheck,
  ChevronRight,
  MessageSquare,
  Mic,
  GraduationCap,
  AlertCircle,
  X,
  LucideBell,
  Timer,
  Sparkles,
  UserCheck,
  Trophy,
  Settings,
  Briefcase,
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import ClubSwitcher from '@/components/ClubSwitcher';
import { supabase } from '@/lib/supabase';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import {
  type MeetingRoleRow,
  orderedUniqueUserIds,
  mapIdsToAvatarUrls,
  isGrammarianRole,
  isToastmasterRole,
  isEducationalSpeakerRoleRow,
  isPreparedSpeakerRole,
  isTableTopicsMasterRole,
  isTableTopicsSpeakerRole,
  isSpeechEvaluatorRole,
  isGeneralEvaluatorRole,
  isTimerRole,
  isAhCounterRole,
} from '@/lib/journeyMeetingOpenData';
import { prefetchEducationalCorner } from '@/lib/prefetchEducationalCorner';
import { prefetchAhCounter } from '@/lib/prefetchAhCounter';
import { prefetchGrammarianCorner } from '@/lib/prefetchGrammarianCorner';
import { prefetchGeneralEvaluatorReport } from '@/lib/prefetchGeneralEvaluatorReport';
import { prefetchMyMentorSnapshot } from '@/lib/myMentorSnapshot';
import { prefetchTableTopicCorner } from '@/lib/prefetchTableTopicCorner';
import { prefetchTimerReport } from '@/lib/prefetchTimerReport';
import { prefetchToastmasterCorner } from '@/lib/prefetchToastmasterCorner';
import { prefetchEvaluationCornerSnapshot } from '@/lib/evaluationCornerSnapshot';
import { prefetchMeetingAgendaView } from '@/lib/meetingAgendaPrefetch';
import { journeyHomeQueryKeys, fetchJourneyHomeSnapshot } from '@/lib/journeyHomeQuery';
import { fetchVpeNudgesSnapshot, vpeNudgesQueryKeys } from '@/lib/vpeNudgesSnapshot';
import { computeVpeSmartDailyHomeReminder } from '@/lib/vpeSmartDailyHomeReminder';
import { prefetchVpeNudges } from '@/lib/prefetchVpeNudges';
import { prefetchClubLandingCritical } from '@/lib/clubTabLandingData';
import { prefetchProfileSnapshot } from '@/lib/profileSnapshot';
import { prefetchMyRoleInsightsPanel } from '@/components/MyRoleInsightsPanel';
import { prefetchMyAttendancePanel } from '@/components/MyAttendancePanel';
import { prefetchMyAwardsPanel } from '@/components/MyAwardsPanel';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceSoft: '#F7F6F3',
  border: 'rgba(55, 53, 47, 0.10)',
  text: '#37352F',
  textSecondary: '#787774',
  iconStrong: '#787774',
  iconTile: '#EFEDEB',
  accent: '#9A6A3A',
};

const ROLE_PLAYER_CONGRATS_STORAGE_PREFIX = 'journey_role_player_congrats_ack_v1_';

const ROLE_PLAYER_CONGRATS_TEMPLATES = [
  '{name}, great step forward in your Toastmasters journey!',
  '{name}, well done on taking the stage—keep shining!',
  '{name}, fantastic commitment to your growth—keep going!',
  '{name}, every role you take builds your confidence—well done!',
  '{name}, strong progress toward becoming a better speaker!',
  "{name}, you're growing with every meeting—great job!",
  '{name}, well done stepping up and taking initiative!',
  '{name}, each role brings you closer to mastery—keep it up!',
  '{name}, proud to see you actively participating—well done!',
  "{name}, you're making your mark—keep going strong!",
  '{name}, every speech and role adds to your journey—great work!',
  '{name}, your consistency is shaping your success!',
  '{name}, excellent step toward becoming a confident leader!',
  "{name}, you're building your skills one meeting at a time!",
  '{name}, great to see you take another step forward!',
  "{name}, your effort today will reflect in tomorrow's growth!",
  '{name}, stepping up like this makes all the difference!',
  "{name}, you're inspiring progress—keep it going!",
  '{name}, every participation counts—well done!',
  "{name}, you're on your way to becoming a stronger communicator!",
] as const;

function pickRolePlayerCongratsMessage(firstName: string): string {
  const i = Math.floor(Math.random() * ROLE_PLAYER_CONGRATS_TEMPLATES.length);
  return ROLE_PLAYER_CONGRATS_TEMPLATES[i].replace(/\{name\}/g, firstName);
}

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
            resizeMode="contain"
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
  description: React.ReactNode;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  inline?: boolean;
  /** Amber border + pulse + dot (same language as Meeting Actions pending) */
  showPendingHighlight?: boolean;
  /** Pulse icon only (no border or badge) */
  animateIconOnly?: boolean;
  iconBackgroundColor?: string;
}

function JourneyListCard({
  title,
  description,
  icon,
  color,
  onPress,
  inline,
  showPendingHighlight,
  animateIconOnly,
  iconBackgroundColor,
}: JourneyListCardProps) {
  const { theme } = useTheme();
  const alertScale = useSharedValue(1);
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (!showPendingHighlight && !animateIconOnly) {
      alertScale.value = 1;
      iconPulse.value = 1;
      return;
    }
    if (showPendingHighlight) {
      alertScale.value = withRepeat(
        withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        true
      );
    } else {
      alertScale.value = 1;
    }
    iconPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      true
    );
  }, [showPendingHighlight, animateIconOnly]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  return (
    <TouchableOpacity
      style={[
        styles.journeyListCard,
        !inline && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        inline && styles.journeyListCardInline,
        showPendingHighlight && styles.journeyListCardPending,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.journeyListIconWrap, { backgroundColor: iconBackgroundColor || `${color}20` }, iconPulseStyle]}>
        {icon}
      </Animated.View>
      <View style={styles.journeyListTextCol}>
        <Text style={[styles.journeyListTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {typeof description === 'string' ? (
          <Text style={[styles.journeyListDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {description}
          </Text>
        ) : (
          description
        )}
      </View>
      {showPendingHighlight && (
        <Animated.View pointerEvents="box-none" style={[styles.journeyListAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={12} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

export default function MyJourney() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, refreshUserProfile, hasInitialized } = useAuth();
  const profileFieldsLoaded = hasInitialized && !!user;
  const userAvatar = (user?.avatarUrl || '').trim() || null;
  const profileHasAbout =
    typeof user?.profileAbout === 'string' && user.profileAbout.trim().length > 0;
  const [headerAvatarLoadFailed, setHeaderAvatarLoadFailed] = useState(false);
  useEffect(() => {
    setHeaderAvatarLoadFailed(false);
  }, [user?.avatarUrl]);
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
  const [journeySpeechEvaluatorAvatarUrls, setJourneySpeechEvaluatorAvatarUrls] = useState<string[]>([]);
  const [journeyGeneralEvaluatorAvatarUrls, setJourneyGeneralEvaluatorAvatarUrls] = useState<string[]>([]);
  const [journeyTimerAvatarUrls, setJourneyTimerAvatarUrls] = useState<string[]>([]);
  const [journeyAhCounterAvatarUrls, setJourneyAhCounterAvatarUrls] = useState<string[]>([]);
  const [showBookRoleAttention, setShowBookRoleAttention] = useState<boolean>(false);
  /** Vice President Education for current club (`club_profiles.vpe_id`) */
  const [isVPEForCurrentClub, setIsVPEForCurrentClub] = useState<boolean>(false);
  const [showNoTasksModal, setShowNoTasksModal] = useState<boolean>(false);
  /** Re-evaluate “live meeting” window periodically on meeting day */
  const [journeyLiveWindowTick, setJourneyLiveWindowTick] = useState(0);
  /** Open meeting is between start and end time; user still needs to mark attendance */
  const [journeyNeedsAttendanceReminder, setJourneyNeedsAttendanceReminder] = useState(false);
  /** Open meeting is live; user has booked roles not marked complete */
  const [journeyNeedsRoleCompletionReminder, setJourneyNeedsRoleCompletionReminder] = useState(false);
  const [showRolePlayerCongratsModal, setShowRolePlayerCongratsModal] = useState(false);
  const [rolePlayerCongratsBody, setRolePlayerCongratsBody] = useState('');
  /** Hidden until AsyncStorage load; default true avoids flashing the row before we know */
  const [rolePlayerCongratsDismissed, setRolePlayerCongratsDismissed] = useState(true);
  const [roleCongratsAckLoaded, setRoleCongratsAckLoaded] = useState(false);

  const {
    data: journeyHomeSnapshot,
    refetch: refetchJourneyHome,
  } = useQuery({
    queryKey: journeyHomeQueryKeys.snapshot(user?.currentClubId ?? '', user?.id ?? ''),
    queryFn: async () => {
      const d = await fetchJourneyHomeSnapshot(user!.currentClubId!, user!.id);
      if (d === null) {
        return {
          club_id: user!.currentClubId!,
          open_meeting: null,
          open_meetings_count: 0,
          journey_stats: {
            meeting_attended_count: 0,
            roles_completed_count: 0,
            speeches_given_count: 0,
            evaluations_given_count: 0,
          },
          is_vpe_for_club: false,
          has_active_poll: false,
          has_voted_in_active_poll: false,
        };
      }
      return d;
    },
    enabled: Boolean(isAuthenticated && user?.currentClubId && user?.id),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: vpeNudgesSnapshot } = useQuery({
    queryKey: vpeNudgesQueryKeys.snapshot(user?.currentClubId ?? '', user?.id ?? ''),
    queryFn: () => fetchVpeNudgesSnapshot(user!.currentClubId!),
    enabled: Boolean(isAuthenticated && user?.currentClubId && user?.id && isVPEForCurrentClub),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (!journeyHomeSnapshot) return;
    const d = journeyHomeSnapshot;
    if (d.open_meeting) {
      setCurrentOpenMeetingId(d.open_meeting.id);
      setCurrentOpenMeetingTitle(d.open_meeting.meeting_title);
      setCurrentOpenMeetingDate(d.open_meeting.meeting_date);
      setCurrentOpenMeetingStartTime(d.open_meeting.meeting_start_time);
      setCurrentOpenMeetingEndTime(d.open_meeting.meeting_end_time);
      setCurrentOpenMeetingMode(d.open_meeting.meeting_mode);
    } else {
      setCurrentOpenMeetingId(null);
      setCurrentOpenMeetingTitle(null);
      setCurrentOpenMeetingDate(null);
      setCurrentOpenMeetingStartTime(null);
      setCurrentOpenMeetingEndTime(null);
      setCurrentOpenMeetingMode(null);
    }
    setMeetingAttendedCount(d.journey_stats.meeting_attended_count);
    setRolesCompletedCount(d.journey_stats.roles_completed_count);
    setSpeechesGivenCount(d.journey_stats.speeches_given_count);
    setEvaluationsGivenCount(d.journey_stats.evaluations_given_count);
    setIsVPEForCurrentClub(d.is_vpe_for_club);
    setHasActivePoll(d.has_active_poll);
    setHasVotedInActivePoll(d.has_voted_in_active_poll);
  }, [journeyHomeSnapshot]);

  const voteNowScale = useSharedValue(1);
  const heroReminderFade = useSharedValue(1);
  const headerAvatarRingPulse = useSharedValue(1);
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
  const headerAvatarRingAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerAvatarRingPulse.value }],
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

  useEffect(() => {
    if (daysToGo === null || daysToGo !== 0) return undefined;
    const id = setInterval(() => setJourneyLiveWindowTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [daysToGo]);

  const isOpenMeetingLiveNow = useMemo(() => {
    if (!currentOpenMeetingDate || daysToGo === null || daysToGo !== 0) return false;
    if (!currentOpenMeetingStartTime && !currentOpenMeetingEndTime) return false;
    const now = new Date();
    const startTime = currentOpenMeetingStartTime || '00:00:00';
    const endTime = currentOpenMeetingEndTime || '23:59:59';
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    const meetingStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      startParts[0] || 0,
      startParts[1] || 0,
      startParts[2] || 0
    );
    const meetingEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      endParts[0] || 0,
      endParts[1] || 0,
      endParts[2] || 0
    );
    return now >= meetingStart && now <= meetingEnd;
  }, [
    currentOpenMeetingDate,
    currentOpenMeetingStartTime,
    currentOpenMeetingEndTime,
    daysToGo,
    journeyLiveWindowTick,
  ]);

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

  const refreshCurrentOpenMeeting = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) {
      setCurrentOpenMeetingId(null);
      setCurrentOpenMeetingTitle(null);
      setCurrentOpenMeetingDate(null);
      setCurrentOpenMeetingStartTime(null);
      setCurrentOpenMeetingEndTime(null);
      setCurrentOpenMeetingMode(null);
      setMeetingAttendedCount(0);
      setRolesCompletedCount(0);
      setSpeechesGivenCount(0);
      setEvaluationsGivenCount(0);
      setHasActivePoll(false);
      setHasVotedInActivePoll(false);
      setIsVPEForCurrentClub(false);
      return;
    }
    await refetchJourneyHome();
    if (user?.currentClubId && user?.id) {
      void queryClient.invalidateQueries({
        queryKey: vpeNudgesQueryKeys.snapshot(user.currentClubId, user.id),
      });
    }
  }, [user?.currentClubId, user?.id, refetchJourneyHome, queryClient]);

  useFocusEffect(
    useCallback(() => {
      refreshCurrentOpenMeeting();
      const id = setInterval(() => {
        refreshCurrentOpenMeeting();
      }, 30000);
      return () => clearInterval(id);
    }, [refreshCurrentOpenMeeting])
  );

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refreshCurrentOpenMeeting();
      }
      appStateRef.current = nextState;
    });
    return () => {
      sub.remove();
    };
  }, [refreshCurrentOpenMeeting]);

  useEffect(() => {
    if (!user?.currentClubId) return;
    const meetingChannel = supabase
      .channel(`journey-open-meeting-${user.currentClubId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_club_meeting',
          filter: `club_id=eq.${user.currentClubId}`,
        },
        () => {
          refreshCurrentOpenMeeting();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(meetingChannel);
    };
  }, [user?.currentClubId, refreshCurrentOpenMeeting]);

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
          void refetchJourneyHome();
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
        void refetchJourneyHome();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelPolls);
      supabase.removeChannel(channelVotes);
    };
  }, [user?.currentClubId, user?.id, refetchJourneyHome]);

  const resetJourneyMeetingDerivedState = useCallback(() => {
    setTmodNeedsThemeAlert(false);
    setUserBookedToastmaster(false);
    setEducationalSpeakerNeedsAlert(false);
    setPreparedSpeakerNeedsSpeechDetailsAlert(false);
    setGrammarianNeedsWordOfTheDayAlert(false);
    setJourneyGrammarianAvatarUrls([]);
    setJourneyToastmasterAvatarUrls([]);
    setJourneyEducationalAvatarUrls([]);
    setJourneyPreparedSpeakerAvatarUrls([]);
    setJourneyTableTopicsMasterAvatarUrls([]);
    setJourneyTableTopicsSpeakerAvatarUrls([]);
    setJourneySpeechEvaluatorAvatarUrls([]);
    setJourneyGeneralEvaluatorAvatarUrls([]);
    setJourneyTimerAvatarUrls([]);
    setJourneyAhCounterAvatarUrls([]);
    setShowBookRoleAttention(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
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
        if (!currentOpenMeetingId || !user?.id) {
          resetJourneyMeetingDerivedState();
          return;
        }

        if (isCurrentOpenMeetingCompleted) {
          resetJourneyMeetingDerivedState();
          return;
        }

        const meetingId = currentOpenMeetingId;
        const uid = user.id;

        const { data: roleRows, error: rolesErr } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id, role_name, role_classification, role_status')
          .eq('meeting_id', meetingId)
          .eq('booking_status', 'booked');

        if (cancelled) return;

        if (rolesErr || !roleRows) {
          console.error('Error loading meeting roles for Journey:', rolesErr);
          resetJourneyMeetingDerivedState();
          return;
        }

        const rows = roleRows as MeetingRoleRow[];

        const idsG = orderedUniqueUserIds(rows, isGrammarianRole);
        const idsTm = orderedUniqueUserIds(rows, isToastmasterRole);
        const idsE = orderedUniqueUserIds(rows, isEducationalSpeakerRoleRow);
        const idsP = orderedUniqueUserIds(rows, isPreparedSpeakerRole);
        const idsTtm = orderedUniqueUserIds(rows, isTableTopicsMasterRole);
        const idsTts = orderedUniqueUserIds(rows, isTableTopicsSpeakerRole);
        const idsSe = orderedUniqueUserIds(rows, isSpeechEvaluatorRole);
        const idsGe = orderedUniqueUserIds(rows, isGeneralEvaluatorRole);
        const idsTimer = orderedUniqueUserIds(rows, isTimerRole);
        const idsAh = orderedUniqueUserIds(rows, isAhCounterRole);

        const allAvatarIds = [
          ...new Set([
            ...idsG,
            ...idsTm,
            ...idsE,
            ...idsP,
            ...idsTtm,
            ...idsTts,
            ...idsSe,
            ...idsGe,
            ...idsTimer,
            ...idsAh,
          ]),
        ];

        const urlById = new Map<string, string | null | undefined>();
        if (allAvatarIds.length > 0) {
          const { data: profiles, error: pErr } = await supabase
            .from('app_user_profiles')
            .select('id, avatar_url')
            .in('id', allAvatarIds);
          if (!cancelled && !pErr && profiles) {
            for (const p of profiles as { id: string; avatar_url: string | null }[]) {
              urlById.set(p.id, p.avatar_url);
            }
          }
        }

        if (cancelled) return;

        setJourneyGrammarianAvatarUrls(mapIdsToAvatarUrls(idsG, urlById));
        setJourneyToastmasterAvatarUrls(mapIdsToAvatarUrls(idsTm, urlById));
        setJourneyEducationalAvatarUrls(mapIdsToAvatarUrls(idsE, urlById));
        setJourneyPreparedSpeakerAvatarUrls(mapIdsToAvatarUrls(idsP, urlById));
        setJourneyTableTopicsMasterAvatarUrls(mapIdsToAvatarUrls(idsTtm, urlById));
        setJourneyTableTopicsSpeakerAvatarUrls(mapIdsToAvatarUrls(idsTts, urlById));
        setJourneySpeechEvaluatorAvatarUrls(mapIdsToAvatarUrls(idsSe, urlById));
        setJourneyGeneralEvaluatorAvatarUrls(mapIdsToAvatarUrls(idsGe, urlById));
        setJourneyTimerAvatarUrls(mapIdsToAvatarUrls(idsTimer, urlById));
        setJourneyAhCounterAvatarUrls(mapIdsToAvatarUrls(idsAh, urlById));

        const userBookedTm = rows.some(
          (r) => isToastmasterRole(r) && r.assigned_user_id === uid
        );
        setUserBookedToastmaster(userBookedTm);

        const parallel: Promise<void>[] = [];

        if (userBookedTm) {
          parallel.push(
            (async () => {
              const { data: themeData } = await supabase
                .from('toastmaster_meeting_data')
                .select('theme_of_the_day')
                .eq('meeting_id', meetingId)
                .eq('toastmaster_user_id', uid)
                .maybeSingle();
              const hasTheme = !!(themeData?.theme_of_the_day?.trim());
              if (!cancelled) setTmodNeedsThemeAlert(!hasTheme);
            })()
          );
        } else {
          setTmodNeedsThemeAlert(false);
        }

        const edAssigned = rows.find(
          (r) =>
            r.role_name === 'Educational Speaker' &&
            r.role_status === 'Available' &&
            r.assigned_user_id === uid
        );
        if (edAssigned) {
          parallel.push(
            (async () => {
              const { data: contentData } = await supabase
                .from('app_meeting_educational_speaker')
                .select('speech_title')
                .eq('meeting_id', meetingId)
                .eq('speaker_user_id', uid)
                .maybeSingle();
              const hasContent = !!(contentData?.speech_title?.trim());
              if (!cancelled) setEducationalSpeakerNeedsAlert(!hasContent);
            })()
          );
        } else {
          setEducationalSpeakerNeedsAlert(false);
        }

        const psRoles = rows.filter((r) => r.assigned_user_id === uid && isPreparedSpeakerRole(r));
        if (!psRoles.length) {
          setPreparedSpeakerNeedsSpeechDetailsAlert(false);
        } else {
          parallel.push(
            (async () => {
              const { data: pathways, error: pathErr } = await supabase
                .from('app_evaluation_pathway')
                .select(
                  'role_name, speech_title, pathway_name, level, project_name, evaluation_form, comments_for_evaluator'
                )
                .eq('meeting_id', meetingId)
                .eq('user_id', uid);

              if (pathErr || cancelled) {
                if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(false);
                return;
              }

              const byRole = new Map(
                (pathways || []).map((row: { role_name: string }) => [row.role_name as string, row])
              );

              let needs = false;
              for (const row of psRoles) {
                const p = byRole.get(row.role_name as string);
                if (!pathwayHasSpeechDetails(p || null)) {
                  needs = true;
                  break;
                }
              }
              if (!cancelled) setPreparedSpeakerNeedsSpeechDetailsAlert(needs);
            })()
          );
        }

        const hasGramRole = rows.some((r) => r.assigned_user_id === uid && isGrammarianRole(r));
        if (hasGramRole) {
          parallel.push(
            (async () => {
              const [dailyRes, wotdRes] = await Promise.all([
                supabase
                  .from('app_grammarian_daily_elements')
                  .select('word_of_the_day')
                  .eq('meeting_id', meetingId)
                  .eq('grammarian_user_id', uid)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle(),
                supabase
                  .from('grammarian_word_of_the_day')
                  .select('word, grammarian_user_id')
                  .eq('meeting_id', meetingId)
                  .maybeSingle(),
              ]);
              if (cancelled) return;
              const dailyWord = (dailyRes.data?.word_of_the_day || '').trim();
              const wotd = wotdRes.data;
              const structuredWord =
                wotd && wotd.grammarian_user_id === uid ? (wotd.word || '').trim() : '';
              const hasWord = !!(dailyWord || structuredWord);
              if (!cancelled) setGrammarianNeedsWordOfTheDayAlert(!hasWord);
            })()
          );
        } else {
          setGrammarianNeedsWordOfTheDayAlert(false);
        }

        const rlow = (user.clubRole || user.role || '').toLowerCase();
        if (rlow === 'guest') {
          setShowBookRoleAttention(false);
        } else {
          const userRoleCount = rows.filter((r) => r.assigned_user_id === uid).length;
          setShowBookRoleAttention(userRoleCount === 0);
        }

        await Promise.all(parallel);
      })();

      return () => {
        cancelled = true;
      };
    }, [
      currentOpenMeetingId,
      user?.id,
      user?.clubRole,
      user?.role,
      isCurrentOpenMeetingCompleted,
      resetJourneyMeetingDerivedState,
    ])
  );

  const refreshJourneyLiveTaskFlags = useCallback(async () => {
    const meetingId = currentOpenMeetingId;
    const uid = user?.id;
    if (!meetingId || !uid) return;

    try {
      const { data: attendanceRows, error: attErr } = await supabase
        .from('app_meeting_attendance')
        .select('attendance_marked_by, attendance_marked_at, updated_at')
        .eq('meeting_id', meetingId)
        .eq('user_id', uid)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (attErr) {
        setJourneyNeedsAttendanceReminder(true);
      } else {
        const hasMarkedAttendance = (attendanceRows || []).some(
          (row) => row.attendance_marked_by != null
        );
        const hasAnyAttendanceRow = (attendanceRows || []).length > 0;
        setJourneyNeedsAttendanceReminder(!hasAnyAttendanceRow || !hasMarkedAttendance);
      }

      const { data: roles, error: rolesErr } = await supabase
        .from('app_meeting_roles_management')
        .select('id, is_completed')
        .eq('meeting_id', meetingId)
        .eq('assigned_user_id', uid)
        .eq('booking_status', 'booked');

      if (rolesErr || !roles?.length) {
        setJourneyNeedsRoleCompletionReminder(false);
      } else {
        setJourneyNeedsRoleCompletionReminder(roles.some((r) => !r.is_completed));
      }
    } catch {
      setJourneyNeedsAttendanceReminder(false);
      setJourneyNeedsRoleCompletionReminder(false);
    }
  }, [currentOpenMeetingId, user?.id]);

  useEffect(() => {
    if (!currentOpenMeetingId || !user?.id) {
      setJourneyNeedsAttendanceReminder(false);
      setJourneyNeedsRoleCompletionReminder(false);
      return undefined;
    }
    if (!isOpenMeetingLiveNow) {
      setJourneyNeedsAttendanceReminder(false);
      setJourneyNeedsRoleCompletionReminder(false);
      return undefined;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) void refreshJourneyLiveTaskFlags();
    };

    run();
    const intervalId = setInterval(run, 120000);

    const meetingId = currentOpenMeetingId;
    const uid = user.id;
    const channel = supabase
      .channel(`journey-live-task-flags-${meetingId}-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_meeting_attendance',
          filter: `meeting_id=eq.${meetingId}`,
        },
        run
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_meeting_roles_management',
          filter: `meeting_id=eq.${meetingId}`,
        },
        run
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [currentOpenMeetingId, user?.id, isOpenMeetingLiveNow, refreshJourneyLiveTaskFlags]);

  useFocusEffect(
    useCallback(() => {
      if (isOpenMeetingLiveNow && currentOpenMeetingId && user?.id) {
        void refreshJourneyLiveTaskFlags();
      }
    }, [isOpenMeetingLiveNow, currentOpenMeetingId, user?.id, refreshJourneyLiveTaskFlags])
  );

  useEffect(() => {
    setRoleCongratsAckLoaded(false);
    if (!currentOpenMeetingId || !user?.id) {
      setRolePlayerCongratsDismissed(true);
      setRoleCongratsAckLoaded(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const key = `${ROLE_PLAYER_CONGRATS_STORAGE_PREFIX}${user.id}_${currentOpenMeetingId}`;
        const v = await AsyncStorage.getItem(key);
        if (!cancelled) {
          setRolePlayerCongratsDismissed(v === '1');
        }
      } catch {
        if (!cancelled) setRolePlayerCongratsDismissed(false);
      } finally {
        if (!cancelled) setRoleCongratsAckLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOpenMeetingId, user?.id]);

  /** TMOD tile: show booked member’s photo for everyone; fallback to session avatar if you’re TM but DB has no URL */
  const journeyToastmasterDisplayAvatarUrls = useMemo(() => {
    if (journeyToastmasterAvatarUrls.length > 0) return journeyToastmasterAvatarUrls;
    if (userBookedToastmaster && userAvatar) return [userAvatar];
    return [];
  }, [journeyToastmasterAvatarUrls, userBookedToastmaster, userAvatar]);

  /** Table Topics tile: Table Topics Master first, then booked speakers (rotation like other multi-role tiles). */
  const journeyTableTopicsDisplayAvatarUrls = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of [...journeyTableTopicsMasterAvatarUrls, ...journeyTableTopicsSpeakerAvatarUrls]) {
      const t = (u || '').trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }, [journeyTableTopicsMasterAvatarUrls, journeyTableTopicsSpeakerAvatarUrls]);

  type PendingMeetingReminderKey =
    | 'profile_intro'
    | 'profile_picture'
    | 'book_role'
    | 'toastmaster_theme'
    | 'educational_speech'
    | 'grammarian_wotd'
    | 'prepared_speech'
    | 'vpe_open_meetings_0'
    | 'vpe_open_meetings_1'
    | 'vpe_open_meetings_2'
    | 'vpe_open_meetings_3'
    | 'vpe_smart_daily_insight';

  const pendingMeetingReminders = useMemo((): { key: PendingMeetingReminderKey; text: string }[] => {
    const name =
      (user?.fullName || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] || 'You';
    const out: { key: PendingMeetingReminderKey; text: string }[] = [];
    if (profileFieldsLoaded && !profileHasAbout) {
      out.push({
        key: 'profile_intro',
        text: `${name}, Update profile intro.`,
      });
    }
    if (profileFieldsLoaded && !userAvatar) {
      out.push({
        key: 'profile_picture',
        text: `${name}, Update Profile picture.`,
      });
    }

    if (isVPEForCurrentClub && !isOpenMeetingLiveNow) {
      const smart = computeVpeSmartDailyHomeReminder(vpeNudgesSnapshot ?? undefined);
      if (smart) {
        out.push({
          key: 'vpe_smart_daily_insight',
          text: smart.text,
        });
      }
    }

    const openMeetingsCount = Math.max(
      journeyHomeSnapshot?.open_meetings_count ?? 0,
      currentOpenMeetingId ? 1 : 0
    );
    if (isVPEForCurrentClub && !isOpenMeetingLiveNow) {
      const bucket = Math.min(openMeetingsCount, 3) as 0 | 1 | 2 | 3;
      const vpeTexts: Record<0 | 1 | 2 | 3, string> = {
        0: `Hi ${name}, it's time to get started! 🚀\nLet's kick things off by creating your first meeting.`,
        1: '💡 Smart tip: Open 2 more meetings to stay ahead.',
        2: `Hi ${name}, you're doing great! 🎯\nYou already have 2 meetings open — would you like to add the third?`,
        3: `Hi ${name}, excellent planning! 🌟\nMembers can see several dates — keep filling the pipeline when you can.`,
      };
      out.push({
        key: `vpe_open_meetings_${bucket}` as PendingMeetingReminderKey,
        text: vpeTexts[bucket],
      });
    }

    if (!currentOpenMeetingId || isCurrentOpenMeetingCompleted) return out;

    if (isOpenMeetingLiveNow) {
      return out;
    }

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
        text: `${name}, please add your educational title.`,
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
    isOpenMeetingLiveNow,
    showBookRoleAttention,
    tmodNeedsThemeAlert,
    educationalSpeakerNeedsAlert,
    grammarianNeedsWordOfTheDayAlert,
    preparedSpeakerNeedsSpeechDetailsAlert,
    isVPEForCurrentClub,
    profileFieldsLoaded,
    profileHasAbout,
    userAvatar,
    user?.fullName,
    journeyHomeSnapshot?.open_meetings_count,
    vpeNudgesSnapshot,
  ]);

  const userFirstName = useMemo(
    () =>
      (user?.fullName || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0] || 'You',
    [user?.fullName]
  );

  const isExComm = useMemo(() => {
    const fromList =
      user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
    const fromField = user?.clubRole?.toLowerCase() === 'excomm';
    return fromList || fromField;
  }, [user?.clubs, user?.currentClubId, user?.clubRole]);

  const openRolePlayerCongrats = useCallback(() => {
    setRolePlayerCongratsBody(pickRolePlayerCongratsMessage(userFirstName));
    setShowRolePlayerCongratsModal(true);
  }, [userFirstName]);

  const acknowledgeRolePlayerCongrats = useCallback(async () => {
    if (currentOpenMeetingId && user?.id) {
      try {
        await AsyncStorage.setItem(
          `${ROLE_PLAYER_CONGRATS_STORAGE_PREFIX}${user.id}_${currentOpenMeetingId}`,
          '1'
        );
      } catch {
        /* non-fatal */
      }
      setRolePlayerCongratsDismissed(true);
    }
    setShowRolePlayerCongratsModal(false);
  }, [currentOpenMeetingId, user?.id]);

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
      switch (key) {
        case 'profile_intro':
        case 'profile_picture':
          router.push('/profile');
          break;
        case 'book_role':
          if (!currentOpenMeetingId) return;
          router.push(`/book-a-role?meetingId=${currentOpenMeetingId}`);
          break;
        case 'toastmaster_theme':
          if (!currentOpenMeetingId) return;
          prefetchToastmasterCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
          router.push(`/toastmaster-corner?meetingId=${currentOpenMeetingId}&showCongrats=1`);
          break;
        case 'educational_speech':
          if (!currentOpenMeetingId) return;
          prefetchEducationalCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
          router.push({
            pathname: '/educational-corner',
            params: { meetingId: currentOpenMeetingId, showCongrats: '1' },
          });
          break;
        case 'grammarian_wotd':
          if (!currentOpenMeetingId) return;
          prefetchGrammarianCorner(currentOpenMeetingId, user?.id, user?.currentClubId);
          router.push(`/grammarian?meetingId=${currentOpenMeetingId}`);
          break;
        case 'prepared_speech':
          if (!currentOpenMeetingId) return;
          prefetchEvaluationCornerSnapshot(currentOpenMeetingId);
          router.push(`/evaluation-corner?meetingId=${currentOpenMeetingId}`);
          break;
        case 'vpe_open_meetings_0':
        case 'vpe_open_meetings_1':
        case 'vpe_open_meetings_2':
          router.push('/admin/meeting-management');
          if (user?.currentClubId && user?.id) {
            void queryClient.invalidateQueries({
              queryKey: journeyHomeQueryKeys.snapshot(user.currentClubId, user.id),
            });
          }
          break;
        case 'vpe_open_meetings_3': {
          const first =
            (user?.fullName || '')
              .trim()
              .split(/\s+/)
              .filter(Boolean)[0] || 'there';
          Alert.alert(
            `Congrats, ${first}!`,
            "You're absolutely crushing it—top-tier VPE planning right there! 🚀"
          );
          break;
        }
        case 'vpe_smart_daily_insight':
          prefetchVpeNudges(queryClient, user?.currentClubId, user?.id);
          router.push('/vpe-nudges');
          break;
        default:
          break;
      }
    },
    [currentOpenMeetingId, queryClient, user?.id, user?.currentClubId, user?.fullName]
  );

  const showMyProfilePending =
    profileFieldsLoaded && (!userAvatar || !profileHasAbout);
  const showHeaderAvatarPending = profileFieldsLoaded && !userAvatar;
  const [backgroundPrefetchReady, setBackgroundPrefetchReady] = useState(false);

  const handleMyProfilePress = useCallback(() => {
    prefetchProfileSnapshot(user?.id);
    router.push('/profile');
  }, [user?.id]);

  const handleMyGrowthPress = useCallback(() => {
    void prefetchMyRoleInsightsPanel(user?.currentClubId, user?.id);
    setTimeout(() => {
      void prefetchMyAttendancePanel(user?.id, user?.currentClubId);
    }, 120);
    setTimeout(() => {
      void prefetchMyAwardsPanel(user?.id, user?.currentClubId, user?.fullName);
    }, 260);
    router.push('/my-growth');
  }, [user?.currentClubId, user?.id, user?.fullName]);

  const goToReportsSection = useCallback(() => {
    router.push({ pathname: '/(tabs)/meetings', params: { section: 'reports' } });
  }, []);

  const handlePreparedSpeechesPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for prepared speeches.');
      return;
    }
    prefetchEvaluationCornerSnapshot(currentOpenMeetingId);
    router.push(`/evaluation-corner?meetingId=${currentOpenMeetingId}`);
  }, [currentOpenMeetingId]);

  useEffect(() => {
    const timer = setTimeout(() => setBackgroundPrefetchReady(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    if (!currentOpenMeetingId) return;
    prefetchEvaluationCornerSnapshot(currentOpenMeetingId);
  }, [backgroundPrefetchReady, currentOpenMeetingId]);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    if (!currentOpenMeetingId) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Delay heavy warmups until Home has already painted on slow networks.
    timers.push(
      setTimeout(() => prefetchEvaluationCornerSnapshot(currentOpenMeetingId), 150),
      setTimeout(
        () => prefetchToastmasterCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId),
        900
      ),
      setTimeout(
        () => prefetchEducationalCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId),
        1650
      ),
      setTimeout(
        () => prefetchGeneralEvaluatorReport(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId),
        2300
      ),
      setTimeout(
        () => prefetchTableTopicCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId),
        3000
      ),
      setTimeout(() => prefetchTimerReport(queryClient, currentOpenMeetingId, user?.id), 3700),
      setTimeout(() => prefetchAhCounter(queryClient, currentOpenMeetingId, user?.currentClubId, user?.id), 4300),
      setTimeout(() => prefetchGrammarianCorner(currentOpenMeetingId, user?.id, user?.currentClubId), 4900)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [backgroundPrefetchReady, currentOpenMeetingId, queryClient, user?.currentClubId, user?.id]);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    prefetchMyMentorSnapshot(user?.currentClubId);
  }, [backgroundPrefetchReady, user?.currentClubId]);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    prefetchClubLandingCritical(user?.currentClubId ?? null);
  }, [backgroundPrefetchReady, user?.currentClubId]);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    prefetchProfileSnapshot(user?.id);
  }, [backgroundPrefetchReady, user?.id]);

  useEffect(() => {
    if (!backgroundPrefetchReady) return;
    if (!user?.id || !user?.currentClubId) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        void prefetchMyRoleInsightsPanel(user.currentClubId, user.id);
      }, 1400),
      setTimeout(() => {
        void prefetchMyAttendancePanel(user.id, user.currentClubId);
      }, 2200),
      setTimeout(() => {
        void prefetchMyAwardsPanel(user.id, user.currentClubId, user.fullName);
      }, 3000)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [backgroundPrefetchReady, user?.id, user?.currentClubId, user?.fullName]);

  const handleGrammarianPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Grammarian.');
      return;
    }
    prefetchGrammarianCorner(currentOpenMeetingId, user?.id, user?.currentClubId);
    router.push(`/grammarian?meetingId=${currentOpenMeetingId}`);
  }, [currentOpenMeetingId, user?.id, user?.currentClubId]);

  const handleToastmasterPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Toastmaster.');
      return;
    }
    prefetchToastmasterCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
    router.push(`/toastmaster-corner?meetingId=${currentOpenMeetingId}`);
  }, [currentOpenMeetingId, queryClient, user?.id, user?.currentClubId]);

  const handleEducationalSpeakerPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Educational speaker.');
      return;
    }
    prefetchEducationalCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
    router.push({
      pathname: '/educational-corner',
      params: { meetingId: currentOpenMeetingId },
    });
  }, [currentOpenMeetingId, queryClient, user?.id, user?.currentClubId]);

  const handleGeneralEvaluatorPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for General Evaluator.');
      return;
    }
    prefetchGeneralEvaluatorReport(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
    router.push({ pathname: '/general-evaluator-report', params: { meetingId: currentOpenMeetingId } });
  }, [currentOpenMeetingId, queryClient, user?.id, user?.currentClubId]);

  const handleTableTopicPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Table Topics.');
      return;
    }
    prefetchTableTopicCorner(queryClient, currentOpenMeetingId, user?.id, user?.currentClubId);
    router.push({ pathname: '/table-topic-corner', params: { meetingId: currentOpenMeetingId } });
  }, [currentOpenMeetingId, queryClient, user?.id, user?.currentClubId]);

  const handleTimerPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Timer.');
      return;
    }
    prefetchTimerReport(queryClient, currentOpenMeetingId, user?.id);
    router.push({ pathname: '/timer-report-details', params: { meetingId: currentOpenMeetingId } });
  }, [currentOpenMeetingId, queryClient, user?.id]);

  const handleAhCounterPress = useCallback(() => {
    if (!currentOpenMeetingId) {
      Alert.alert('No open meeting', 'There is no current open meeting for Ah Counter.');
      return;
    }
    prefetchAhCounter(queryClient, currentOpenMeetingId, user?.currentClubId, user?.id);
    router.push({ pathname: '/ah-counter-corner', params: { meetingId: currentOpenMeetingId } });
  }, [currentOpenMeetingId, queryClient, user?.currentClubId, user?.id]);

  useEffect(() => {
    if (!showHeaderAvatarPending) {
      headerAvatarRingPulse.value = 1;
      return;
    }
    headerAvatarRingPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 650 }), withTiming(1, { duration: 650 })),
      -1,
      true
    );
  }, [showHeaderAvatarPending]);

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.authCheckContainer}>
          <Text style={[styles.authCheckText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Please sign in to continue
          </Text>
          <TouchableOpacity 
            style={[styles.signInButton, { backgroundColor: N.text }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const noClubOnboarding = !user?.currentClubId;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.container,
        { backgroundColor: N.page },
      ]}
    >
      {/* Header */}
      {!noClubOnboarding ? (
        <View
          style={[
            styles.header,
            { backgroundColor: N.surface, borderBottomColor: N.border },
          ]}
        >
          <View style={styles.profileHeader}>
            <View style={styles.profileHeaderLeft}>
              <Animated.View
                style={[
                  styles.profileAvatarOuter,
                  showHeaderAvatarPending && styles.profileAvatarOuterPending,
                  showHeaderAvatarPending && headerAvatarRingAnimatedStyle,
                ]}
              >
                <View style={styles.profileAvatar}>
                  {userAvatar && !headerAvatarLoadFailed ? (
                    <Image
                      source={{ uri: userAvatar }}
                      style={styles.profileAvatarImage}
                      onError={() => setHeaderAvatarLoadFailed(true)}
                    />
                  ) : (
                    <User size={20} color="#ffffff" />
                  )}
                </View>
              </Animated.View>
              <TouchableOpacity
                style={styles.profileInfo}
                activeOpacity={0.7}
                onPress={() => router.push('/business-card')}
                accessibilityRole="button"
                accessibilityLabel="Open business card"
              >
                <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {user.fullName}
                </Text>
                <Text
                  style={[styles.profileSubtitle, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.3}
                >
                  Welcome back
                </Text>
              </TouchableOpacity>
            </View>
            {isExComm && user?.currentClubId ? (
              <TouchableOpacity
                style={[styles.toolkitHeaderButton, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}
                onPress={() => router.push('/my-tool-kit')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Open My tool kit"
              >
                <Briefcase size={18} color={N.iconStrong} strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        style={[styles.content, { backgroundColor: N.page }]}
        contentContainerStyle={[styles.scrollContent, noClubOnboarding && styles.noClubScrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {noClubOnboarding ? (
          <View style={styles.noClubOnboardingStack}>
            {/* Hero: same asset + type scale as `app/create-club.tsx` */}
            <View style={[styles.noClubHeroSection, { backgroundColor: N.surface, borderColor: N.border }]}>
              <Image
                source={require('@/assets/images/yy.png')}
                style={styles.noClubLogoImage}
                resizeMode="contain"
              />
              <Text style={[styles.noClubTagline, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                We Salute Toastmasters.
              </Text>
              <Text style={[styles.noClubHeroTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Start Your Journey
              </Text>
            </View>

            <View style={[styles.noClubActionsSection, { backgroundColor: N.surface, borderColor: N.border }]}>
              <TouchableOpacity
                style={styles.noClubOptionBlock}
                onPress={() => router.push('/create-club')}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Create your club. For leaders and ExComm."
              >
                <View style={styles.noClubOptionTitleRow}>
                  <Text style={styles.noClubOptionEmojiInline} maxFontSizeMultiplier={1.2}>
                    🚀
                  </Text>
                  <Text style={[styles.noClubOptionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                    Create your club
                  </Text>
                </View>
                <Text
                  style={[styles.noClubOptionDesc, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.15}
                >
                  Plan meetings, assign roles, and run your club digitally.
                </Text>
                <Text
                  style={[styles.noClubOptionFooter, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.1}
                >
                  Leaders & Excomm
                </Text>
              </TouchableOpacity>

              <View style={[styles.noClubUnifiedDivider, { backgroundColor: N.border }]} />

              <TouchableOpacity
                style={styles.noClubOptionBlock}
                onPress={() => router.push('/my-club-relationships')}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel="Join an existing club. For guest, visiting Toastmasters, and members."
              >
                <View style={styles.noClubOptionTitleRow}>
                  <Text style={styles.noClubOptionEmojiInline} maxFontSizeMultiplier={1.2}>
                    🤝
                  </Text>
                  <Text style={[styles.noClubOptionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                    Join an existing club
                  </Text>
                </View>
                <Text
                  style={[styles.noClubOptionDesc, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.15}
                >
                  Join your existing Toastmasters club using an invite or request access.
                </Text>
                <Text
                  style={[styles.noClubOptionFooter, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.1}
                >
                  Guest, Visiting Toastmasters, Members
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

            {/* My Journey + Meeting - One Master Box (when user has a club) */}
        {user?.currentClubId && (
          <>
                <View style={[styles.masterBox, { backgroundColor: N.surface, borderColor: N.border }]}>
                  {/* Club selection - integrated into master box */}
                  <ClubSwitcher
                    showRole={true}
                    embedded
                    variant="notion"
                    clubIconBackgroundColor="#F1F5F9"
                    clubIconColor="#334155"
                  />
                  <View style={[styles.masterBoxDivider, { backgroundColor: N.border }]} />
                  {/* Profile, Speeches, Mentor */}
                  <View style={styles.journeyListCardsContainer}>
                    <JourneyListCard
                      title="My Profile"
                      description="View and edit your personal information"
                      icon={<User size={18} color="#111827" />}
                      color="#111827"
                      iconBackgroundColor="#F3F4F6"
                      onPress={handleMyProfilePress}
                      inline
                    />
                    <JourneyListCard
                      title="My Growth"
                      description="Speeches, mentor, and My Role Insights"
                      icon={<Trophy size={18} color="#D97706" />}
                      color="#D97706"
                      iconBackgroundColor="#FEF3C7"
                      onPress={handleMyGrowthPress}
                      inline
                    />
                    {!isOpenMeetingLiveNow ? (
                      <JourneyListCard
                        title="My Tasks"
                        description={
                          pendingMeetingReminders.length > 0 ? (
                            <Animated.View style={[styles.myTasksAnimatedWrap, heroReminderTextAnimatedStyle]}>
                              <Text style={[styles.myTasksAnimatedText, { color: N.accent }]} maxFontSizeMultiplier={1.2}>
                                {pendingMeetingReminders[heroReminderSlide]?.text ?? ''}
                              </Text>
                            </Animated.View>
                          ) : (
                            <Text style={[styles.journeyListDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                              All set, champ! No tasks pending.
                            </Text>
                          )
                        }
                        icon={<LucideBell size={18} color="#D97706" />}
                        color="#D97706"
                        iconBackgroundColor="#FFFBEB"
                        onPress={() => {
                          const item = pendingMeetingReminders[heroReminderSlide];
                          if (item) {
                            openPendingReminderTarget(item.key);
                            return;
                          }
                          setShowNoTasksModal(true);
                        }}
                        animateIconOnly={pendingMeetingReminders.length > 0}
                        inline
                      />
                    ) : null}
                    {isOpenMeetingLiveNow && journeyNeedsAttendanceReminder && currentOpenMeetingId ? (
                      <JourneyListCard
                        title={`Mark attendance, ${userFirstName}!`}
                        description="Confirm you were present at this meeting."
                        icon={<UserCheck size={18} color={N.iconStrong} />}
                        color={N.iconStrong}
                        onPress={() =>
                          router.push({
                            pathname: '/attendance-report',
                            params: { meetingId: currentOpenMeetingId },
                          })
                        }
                        inline
                        showPendingHighlight
                      />
                    ) : null}
                    {isOpenMeetingLiveNow && journeyNeedsRoleCompletionReminder && currentOpenMeetingId ? (
                      <JourneyListCard
                        title={`Mark role completion, ${userFirstName}!`}
                        description="Record how your role went for this meeting."
                        icon={<ClipboardCheck size={18} color={N.iconStrong} />}
                        color={N.iconStrong}
                        onPress={() =>
                          router.push({
                            pathname: '/role-completion-report',
                            params: { meetingId: currentOpenMeetingId },
                          })
                        }
                        inline
                        showPendingHighlight
                      />
                    ) : null}
                    {isOpenMeetingLiveNow && hasActivePoll && !hasVotedInActivePoll && currentOpenMeetingId ? (
                      <JourneyListCard
                        title={`Cast your vote, ${userFirstName}!`}
                        description="A live poll is open—tap to participate."
                        icon={<Vote size={18} color={N.iconStrong} />}
                        color={N.iconStrong}
                        onPress={() =>
                          router.push({
                            pathname: '/live-voting',
                            params: { meetingId: currentOpenMeetingId },
                          })
                        }
                        inline
                        showPendingHighlight
                      />
                    ) : null}
                    {isOpenMeetingLiveNow && roleCongratsAckLoaded && !rolePlayerCongratsDismissed ? (
                      <TouchableOpacity
                        style={[
                          styles.journeyListCard,
                          styles.journeyListCardInline,
                          styles.rolePlayerCongratsRow,
                          { borderColor: theme.colors.border },
                        ]}
                        onPress={openRolePlayerCongrats}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.rolePlayerCongratsIconWrap, { backgroundColor: N.iconTile }]}>
                          <Sparkles size={18} color={N.iconStrong} />
                        </View>
                        <View style={styles.journeyListTextCol}>
                          <Text style={[styles.journeyListTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {`Congrats, ${userFirstName}!`}
                          </Text>
                          <Text style={[styles.journeyListDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                            Tap to read a note for you.
                          </Text>
                        </View>
                        <ChevronRight size={18} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={[styles.masterBoxDivider, { backgroundColor: N.border }]} />
                  {/* Meeting details */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push('/(tabs)/meetings')}
                    style={styles.meetingDetailsRow}
                  >
                  {currentOpenMeetingId ? (
                    <>
                  <View style={[styles.dateBadge, { backgroundColor: N.iconTile }]}>
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

                  <View style={[styles.meetingStatusPill, { backgroundColor: N.iconTile }]}>
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

              <View style={[styles.meetingActionsDivider, { backgroundColor: N.border }]} />

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
                  icon={<Calendar size={16} color="#D97706" />}
                  color="#FEF3C7"
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
                  title="Toastmaster of the day"
                  icon={<MessageSquare size={16} color="#2563EB" />}
                  color="#EFF6FF"
                  avatarUrls={journeyToastmasterDisplayAvatarUrls}
                  showAlert={tmodNeedsThemeAlert}
                  onPress={handleToastmasterPress}
                />
                <MeetingActionButton
                  title="Prepared Speeches"
                  icon={<Mic size={16} color="#7C3AED" />}
                  color="#F5F3FF"
                  avatarUrls={journeyPreparedSpeakerAvatarUrls}
                  showAlert={preparedSpeakerNeedsSpeechDetailsAlert}
                  onPress={handlePreparedSpeechesPress}
                />
                <MeetingActionButton
                  title="Speech evalution"
                  icon={<Mic size={16} color="#7C3AED" />}
                  color="#F5F3FF"
                  avatarUrls={journeySpeechEvaluatorAvatarUrls}
                  onPress={handlePreparedSpeechesPress}
                />
                <MeetingActionButton
                  title="General Evaluator"
                  icon={<ClipboardCheck size={16} color="#2563EB" />}
                  color="#EFF6FF"
                  avatarUrls={journeyGeneralEvaluatorAvatarUrls}
                  onPress={handleGeneralEvaluatorPress}
                />
                <MeetingActionButton
                  title="Table topic"
                  icon={<Mic size={16} color="#7C3AED" />}
                  color="#F5F3FF"
                  avatarUrls={journeyTableTopicsDisplayAvatarUrls}
                  onPress={handleTableTopicPress}
                />
                <MeetingActionButton
                  title="Educational speaker"
                  icon={<GraduationCap size={16} color="#16A34A" />}
                  color="#ECFDF5"
                  avatarUrls={journeyEducationalAvatarUrls}
                  showAlert={educationalSpeakerNeedsAlert}
                  onPress={handleEducationalSpeakerPress}
                />
                <MeetingActionButton
                  title="Timer"
                  icon={<Timer size={16} color="#111827" />}
                  color="#F3F4F6"
                  avatarUrls={journeyTimerAvatarUrls}
                  onPress={handleTimerPress}
                />
                <MeetingActionButton
                  title="Ah Counter"
                  icon={<LucideBell size={16} color="#111827" />}
                  color="#F3F4F6"
                  avatarUrls={journeyAhCounterAvatarUrls}
                  onPress={handleAhCounterPress}
                />
                <MeetingActionButton
                  title="Grammarian"
                  icon={<BookOpen size={16} color="#16A34A" />}
                  color="#ECFDF5"
                  avatarUrls={journeyGrammarianAvatarUrls}
                  showAlert={grammarianNeedsWordOfTheDayAlert}
                  onPress={handleGrammarianPress}
                />
              </View>

              <TouchableOpacity
                style={[styles.liveVotingHeroCard, { backgroundColor: N.surface, borderColor: N.border }]}
                onPress={() => {
                  if (!currentOpenMeetingId) {
                    Alert.alert('No open meeting', 'There is no current open meeting to view agenda.');
                    return;
                  }
                  prefetchMeetingAgendaView(currentOpenMeetingId);
                  router.push(`/meeting-agenda-view?meetingId=${currentOpenMeetingId}`);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.liveVotingHeroContent}>
                  <View style={[styles.liveVotingHeroIconWrap, { backgroundColor: '#F1F5F9' }]}>
                    <FileText size={18} color="#334155" />
                  </View>
                  <View style={styles.liveVotingHeroTextWrap}>
                    <View style={styles.liveVotingHeroTitleRow}>
                      <Text style={[styles.liveVotingHeroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Agenda</Text>
                    </View>
                    <Text
                      style={[styles.liveVotingHeroSubtitle, { color: theme.colors.textSecondary, marginTop: 2 }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      Your roadmap for this meeting
                    </Text>
                  </View>
                  <ChevronRight size={20} color={theme.colors.textSecondary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.liveVotingHeroCard, { backgroundColor: N.surface, borderColor: N.border }]}
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
                  <View style={[styles.liveVotingHeroIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <Vote size={18} color="#D97706" />
                  </View>
                  <View style={styles.liveVotingHeroTextWrap}>
                    <View style={styles.liveVotingHeroTitleRow}>
                      <Text style={[styles.liveVotingHeroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Voting</Text>
                      {hasActivePoll && !hasVotedInActivePoll && (
                        <View style={[styles.liveVotingBadge, { backgroundColor: N.iconTile }]}>
                          <View style={styles.liveVotingBadgeDot} />
                          <Text style={styles.liveVotingBadgeText} maxFontSizeMultiplier={1.3}>Live</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.liveVotingHeroSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Participate in club polls</Text>
                  </View>
                  {hasActivePoll && !hasVotedInActivePoll ? (
                    <Animated.View style={[styles.voteNowButtonWrap, voteNowAnimatedStyle]}>
                      <View style={[styles.voteNowButton, { backgroundColor: N.text }]}>
                        <Text style={styles.voteNowButtonText} maxFontSizeMultiplier={1.3}>Vote now</Text>
                        <ChevronRight size={12} color="#ffffff" />
                      </View>
                    </Animated.View>
                  ) : (
                    <ChevronRight size={20} color={theme.colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>

              <View style={[styles.masterBoxDivider, { backgroundColor: N.border }]} />
              <TouchableOpacity
                style={styles.journeySectionHeader}
                onPress={() => router.push('/(tabs)/club')}
                activeOpacity={0.7}
              >
                <Text style={[styles.journeySectionHeaderText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Your Toastmasters Journey
                </Text>
                <ChevronRight size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              {/* Stats - clean Apple-style 2x2 grid */}
              <View style={styles.masterStatsGrid}>
                <View style={styles.masterStatsRow}>
                  <TouchableOpacity style={styles.masterStatsCell} onPress={goToReportsSection} activeOpacity={0.75}>
                    <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {meetingAttendedCount}
                    </Text>
                    <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Meeting attended</Text>
                  </TouchableOpacity>
                  <View style={[styles.masterStatsVDivider, { backgroundColor: theme.colors.border }]} />
                  <TouchableOpacity style={styles.masterStatsCell} onPress={goToReportsSection} activeOpacity={0.75}>
                    <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {speechesGivenCount}
                    </Text>
                    <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Speeches Given</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.masterStatsHDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.masterStatsRow}>
                  <TouchableOpacity style={styles.masterStatsCell} onPress={goToReportsSection} activeOpacity={0.75}>
                    <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {rolesCompletedCount}
                    </Text>
                    <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Roles completed</Text>
                  </TouchableOpacity>
                  <View style={[styles.masterStatsVDivider, { backgroundColor: theme.colors.border }]} />
                  <TouchableOpacity style={styles.masterStatsCell} onPress={goToReportsSection} activeOpacity={0.75}>
                    <Text style={[styles.masterStatsNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {evaluationsGivenCount}
                    </Text>
                    <Text style={[styles.masterStatsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Evaluation given</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showNoTasksModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoTasksModal(false)}
      >
        <TouchableOpacity
          style={styles.noTasksOverlay}
          activeOpacity={1}
          onPress={() => setShowNoTasksModal(false)}
        >
          <TouchableOpacity
            style={[styles.noTasksContent, { backgroundColor: N.surface, borderColor: N.border }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={[styles.noTasksTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {`${userFirstName}, You’ve nailed it, champ—no pending tasks!`}
            </Text>
            <TouchableOpacity
              style={[styles.noTasksButton, { backgroundColor: N.text }]}
              onPress={() => setShowNoTasksModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.noTasksButtonText} maxFontSizeMultiplier={1.2}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showRolePlayerCongratsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRolePlayerCongratsModal(false)}
      >
        <TouchableOpacity
          style={styles.noTasksOverlay}
          activeOpacity={1}
          onPress={() => setShowRolePlayerCongratsModal(false)}
        >
          <TouchableOpacity
            style={[styles.noTasksContent, { backgroundColor: N.surface, borderColor: N.border }]}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={[styles.roleCongratsModalTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              All the best
            </Text>
            <Text style={[styles.roleCongratsModalBody, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
              {rolePlayerCongratsBody}
            </Text>
            <TouchableOpacity
              style={[styles.noTasksButton, { backgroundColor: N.text }]}
              onPress={acknowledgeRolePlayerCongrats}
              activeOpacity={0.85}
            >
              <Text style={styles.noTasksButtonText} maxFontSizeMultiplier={1.2}>
                Got it
              </Text>
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
  noTasksOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  noTasksContent: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  noTasksTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  noTasksButton: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  noTasksButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  roleCongratsModalTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  roleCongratsModalBody: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  incompleteProfileBulletBlock: {
    gap: 12,
    marginBottom: 4,
  },
  incompleteProfileBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  incompleteProfileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  incompleteProfileBulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  incompleteProfileLaterBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  incompleteProfileLaterText: {
    fontSize: 15,
    fontWeight: '600',
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
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  profileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatarOuter: {
    marginRight: 12,
    padding: 3,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  profileAvatarOuterPending: {
    borderColor: PENDING_ACTION_UI.border,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: N.iconStrong,
    alignItems: 'center',
    justifyContent: 'center',
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
  toolkitHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 10,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  noClubScrollContent: {
    flexGrow: 1,
    backgroundColor: N.page,
    paddingBottom: 8,
  },
  noClubOnboardingStack: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  /** Match `create-club` heroSection / logoImage / tagline / heroTitle */
  noClubHeroSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  noClubLogoImage: {
    width: 82,
    height: 82,
    marginBottom: 8,
  },
  noClubTagline: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  noClubHeroTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  /** Match `create-club` formSection container for actions */
  noClubActionsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
  },
  noClubUnifiedDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: 20,
  },
  noClubOptionBlock: {
    paddingVertical: 4,
    borderRadius: 0,
  },
  noClubOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noClubOptionEmojiInline: {
    fontSize: 22,
    lineHeight: 26,
  },
  noClubOptionHeading: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  noClubOptionDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    fontWeight: '400',
  },
  noClubOptionFooter: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 14,
    opacity: 0.85,
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
    borderRadius: 4,
    borderWidth: 1,
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
  journeyListCardsContainer: {
    width: '100%',
  },
  journeyNudgeProfileDivider: {
    height: 1,
    marginTop: 2,
    marginBottom: 6,
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
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 12,
    position: 'relative',
  },
  journeyListCardInline: {
    borderWidth: 0,
    marginBottom: 4,
    paddingVertical: 10,
  },
  journeyListCardPending: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  journeyListAlertBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
  },
  journeyListIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 4,
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
  myTasksAnimatedWrap: {
    marginTop: 4,
  },
  myTasksAnimatedText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  journeySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 2,
  },
  journeySectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vpeBellEmoji: {
    fontSize: 18,
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
    borderRadius: 4,
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
  rolePlayerCongratsRow: {
    borderWidth: 1,
  },
  rolePlayerCongratsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 12,
  },
  liveVotingHeroCard: {
    borderRadius: 4,
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
    borderRadius: 4,
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
    backgroundColor: N.iconStrong,
  },
  liveVotingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: N.textSecondary,
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
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderWidth: 0,
    backgroundColor: 'transparent',
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
    borderRadius: 4,
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
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  /** Ring color comes from tile `color` prop */
  meetingActionButtonIconWithAvatar: {
    padding: 0,
    overflow: 'hidden',
  },
  meetingActionButtonAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
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

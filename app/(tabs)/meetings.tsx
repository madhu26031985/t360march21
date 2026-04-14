import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useRef, useMemo, type ComponentType } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import { prefetchToastmasterCorner } from '@/lib/prefetchToastmasterCorner';
import { Calendar, Vote, Building2, Clock, Lock, FileText, Timer, ChartBar as BarChart3, BookOpen, Star, MessageSquare, ClipboardCheck, UserCheck, Award, Book, MessageCircle, ChevronRight, ChevronDown, ChevronUp, BookCheck, Ear, UserPlus, Mic, ClipboardList, MessageSquareQuote, ScrollText, UserCog, Lightbulb, Target, RefreshCw, MonitorCheck, CheckCircle, Search, AlertCircle } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import ClubSwitcher from '@/components/ClubSwitcher';
import { ClubReportsList } from '@/components/ClubReportsList';

const ROLE_AVATAR_ROTATE_MS = 3000;

/** Cycle through booked members’ avatar URLs (Journey / Meetings tabs). */
function useRotatingRoleAvatars(avatarUrls: string[] | undefined) {
  const sourceList = useMemo(
    () => (avatarUrls ?? []).map((u) => u.trim()).filter(Boolean),
    [avatarUrls]
  );
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
    }, ROLE_AVATAR_ROTATE_MS);
    return () => clearInterval(id);
  }, [visibleKey, visibleUrls.length]);

  useEffect(() => {
    const n = visibleUrls.length;
    if (n === 0) {
      setRotateIndex(0);
      return;
    }
    setRotateIndex((i) => i % n);
  }, [visibleKey, visibleUrls.length]);

  const currentUri = visibleUrls.length > 0 ? visibleUrls[rotateIndex % visibleUrls.length] : null;
  const currentUriRef = useRef<string | null>(null);
  currentUriRef.current = currentUri;

  const onImageError = useCallback(() => {
    const u = currentUriRef.current;
    if (!u) return;
    setDroppedUrls((prev) => new Set(prev).add(u));
    setRotateIndex(0);
  }, []);

  return { currentUri, hasPhoto: !!currentUri, onImageError };
}

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
  meeting_day: string | null;
  isPlaceholder?: boolean;
}

interface TabItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  route?: string;
  comingSoon?: boolean;
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}

function FeatureCard({ title, description, icon, onPress }: FeatureCardProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.featureCard, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.featureTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface KeyRoleCardWithTmodAlertProps {
  tab: TabItem;
  meetingId: string;
  onPress: () => void;
  showAlert?: boolean;
  /** Booked member photo(s) for this key role; multiple → rotate every 3s */
  avatarUrls?: string[];
}

interface SpeakingRoleCardWithAlertProps {
  tab: TabItem;
  meetingId: string;
  onPress: () => void;
  showAlert?: boolean;
  /** Booked members’ avatars; multiple → rotate every 3s */
  avatarUrls?: string[];
}

function SpeakingRoleCardWithAlert({
  tab,
  meetingId,
  onPress,
  showAlert,
  avatarUrls,
}: SpeakingRoleCardWithAlertProps) {
  const { theme } = useTheme();
  const { currentUri, hasPhoto, onImageError } = useRotatingRoleAvatars(avatarUrls);
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
  const title = tab.id === 'evaluation_corner' ? 'Prepared Speeches' : tab.id === 'educational_corner' ? 'Educational Corner' : 'Keynote Speaker';
  return (
    <TouchableOpacity
      style={[
        styles.speakingRoleCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        showAlert && styles.speakingRoleCardAlert,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {hasPhoto && currentUri ? (
        <Animated.View
          style={[
            styles.speakingRoleIcon,
            styles.speakingRoleIconAvatarRing,
            { backgroundColor: tab.color },
            iconPulseStyle,
          ]}
        >
          <Image
            key={currentUri}
            source={{ uri: currentUri }}
            style={styles.speakingRoleIconAvatarImage}
            resizeMode="cover"
            onError={onImageError}
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.speakingRoleIcon, { backgroundColor: tab.color + '25' }, iconPulseStyle]}>
          {tab.id === 'evaluation_corner' && <Mic size={22} color={tab.color} />}
          {tab.id === 'educational_corner' && <Lightbulb size={22} color={tab.color} />}
          {tab.id === 'keynote_speaker' && <Mic size={22} color={tab.color} />}
        </Animated.View>
      )}
      <Text style={[styles.speakingRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      {showAlert && (
        <Animated.View pointerEvents="box-none" style={[styles.speakingRoleAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={12} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

type SupportRowIcon = ComponentType<{ size?: number; color?: string }>;

interface SupportFullWidthRoleCardWithAlertProps {
  title: string;
  description: string;
  iconColor: string;
  SupportIcon: SupportRowIcon;
  showAlert?: boolean;
  comingSoon?: boolean;
  onPress: () => void;
  avatarUrls?: string[];
}

/** Full-width support role row (e.g. Grammarian) with optional pending-action border + pulse */
function SupportFullWidthRoleCardWithAlert({
  title,
  description,
  iconColor,
  SupportIcon,
  showAlert,
  comingSoon,
  onPress,
  avatarUrls,
}: SupportFullWidthRoleCardWithAlertProps) {
  const { theme } = useTheme();
  const { currentUri, hasPhoto, onImageError } = useRotatingRoleAvatars(avatarUrls);
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
  return (
    <TouchableOpacity
      style={[
        styles.keyRoleCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        showAlert && styles.keyRoleCardTmodAlert,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={comingSoon}
    >
      {hasPhoto && currentUri ? (
        <Animated.View
          style={[
            styles.keyRoleIcon,
            styles.keyRoleIconAvatarRing,
            { backgroundColor: iconColor },
            iconPulseStyle,
          ]}
        >
          <Image
            key={currentUri}
            source={{ uri: currentUri }}
            style={styles.keyRoleIconAvatarImage}
            resizeMode="cover"
            onError={onImageError}
          />
        </Animated.View>
      ) : (
        <Animated.View style={[styles.keyRoleIcon, { backgroundColor: iconColor + '25' }, iconPulseStyle]}>
          <SupportIcon size={20} color={iconColor} />
        </Animated.View>
      )}
      <View style={styles.keyRoleContent}>
        <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {description}
          </Text>
        ) : null}
      </View>
      {showAlert && (
        <Animated.View pointerEvents="box-none" style={[styles.keyRoleAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={14} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
      {!comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
      {comingSoon && (
        <View style={styles.actionComingSoonBadge}>
          <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>
            Coming Soon
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Timer / Ah Counter half-width tile with optional booked member photo */
function SupportHalfRoleCardWithAvatar({
  tab,
  iconColor,
  SupportIcon,
  avatarUrls,
  onPress,
  comingSoon,
}: {
  tab: TabItem;
  iconColor: string;
  SupportIcon: SupportRowIcon;
  avatarUrls?: string[];
  onPress: () => void;
  comingSoon?: boolean;
}) {
  const { theme } = useTheme();
  const { currentUri, hasPhoto, onImageError } = useRotatingRoleAvatars(avatarUrls);
  return (
    <TouchableOpacity
      style={[styles.supportRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!!comingSoon}
    >
      {hasPhoto && currentUri ? (
        <View style={[styles.supportRoleIcon, styles.supportRoleIconAvatarRing, { backgroundColor: iconColor }]}>
          <Image
            key={currentUri}
            source={{ uri: currentUri }}
            style={styles.supportRoleIconAvatarImage}
            resizeMode="cover"
            onError={onImageError}
          />
        </View>
      ) : (
        <View style={[styles.supportRoleIcon, { backgroundColor: iconColor + '25' }]}>
          <SupportIcon size={20} color={iconColor} />
        </View>
      )}
      <Text style={[styles.supportRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {tab.title}
      </Text>
      {!comingSoon && <ChevronRight size={18} color={theme.colors.textSecondary} />}
      {comingSoon && (
        <View style={[styles.comingSoonBadge]}>
          <Text style={styles.comingSoonBadgeText} maxFontSizeMultiplier={1.2}>
            Coming Soon
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface BookRoleCoreCardProps {
  tab: TabItem;
  description: string;
  showAttention: boolean;
  onPress: () => void;
}

/** Book a Role row with pulse + border when user has no roles booked for this meeting */
function BookRoleCoreCard({ tab, description, showAttention, onPress }: BookRoleCoreCardProps) {
  const { theme } = useTheme();
  const alertScale = useSharedValue(1);
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (!showAttention) {
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
  }, [showAttention]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));
  return (
    <TouchableOpacity
      style={[
        styles.keyRoleCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        showAttention && styles.keyRoleCardTmodAlert,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }, iconPulseStyle]}>
        <Calendar size={20} color={tab.color} />
      </Animated.View>
      <View style={styles.keyRoleContent}>
        <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {tab.title}
        </Text>
        {description ? (
          <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {description}
          </Text>
        ) : null}
      </View>
      {showAttention && (
        <Animated.View pointerEvents="box-none" style={[styles.keyRoleAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={14} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

function KeyRoleCardWithTmodAlert({
  tab,
  meetingId,
  onPress,
  showAlert,
  avatarUrls,
}: KeyRoleCardWithTmodAlertProps) {
  const { theme } = useTheme();
  const { currentUri, hasPhoto, onImageError } = useRotatingRoleAvatars(avatarUrls);
  const alertScale = useSharedValue(1);
  useEffect(() => {
    if (!showAlert) {
      alertScale.value = 1;
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
  }, [showAlert]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const title = tab.id === 'toastmaster_corner' ? 'Toastmaster of the Day' : tab.id === 'general_evaluator' ? 'General Evaluator' : 'Table Topics Master';
  const subtitle = tab.id === 'toastmaster_corner' ? 'Leads meeting, introduces speakers' : tab.id === 'general_evaluator' ? 'Evaluates meeting and all roles' : 'Conducts impromptu speaking';
  return (
    <TouchableOpacity
      key={tab.id}
      style={[
        styles.keyRoleCard,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        showAlert && styles.keyRoleCardTmodAlert,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {hasPhoto && currentUri ? (
        <View style={[styles.keyRoleIcon, styles.keyRoleIconAvatarRing, { backgroundColor: tab.color }]}>
          <Image
            key={currentUri}
            source={{ uri: currentUri }}
            style={styles.keyRoleIconAvatarImage}
            resizeMode="cover"
            onError={onImageError}
          />
        </View>
      ) : (
        <View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }]}>
          {tab.id === 'toastmaster_corner' && <MessageSquare size={20} color={tab.color} />}
          {tab.id === 'general_evaluator' && <Star size={20} color={tab.color} />}
          {tab.id === 'table_topic_corner' && <MessageSquare size={20} color={tab.color} />}
        </View>
      )}
      <View style={styles.keyRoleContent}>
        <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          {subtitle}
        </Text>
      </View>
      {showAlert && (
        <Animated.View pointerEvents="box-none" style={[styles.keyRoleAlertBadge, alertAnimatedStyle]}>
          <AlertCircle size={14} color={PENDING_ACTION_UI.accent} fill={PENDING_ACTION_UI.accent} />
        </Animated.View>
      )}
      <ChevronRight size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

export default function ClubMeetings() {
  const { theme } = useTheme();
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();
  const queryClient = useQueryClient();
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [nextMeetings, setNextMeetings] = useState<Meeting[]>([]);
  /** Completed (`close`) meetings for Meeting History section */
  const [meetingHistory, setMeetingHistory] = useState<Meeting[]>([]);
  const [expandedHistoryMeetingId, setExpandedHistoryMeetingId] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [expandedNextMeeting, setExpandedNextMeeting] = useState<string | null>(null);
  const [openMeetingTab, setOpenMeetingTab] = useState<'actions' | 'roles' | 'evaluation'>('actions');
  /** Expand/collapse the open meeting card (tabs + actions) to reduce scrolling */
  const [openMeetingDetailExpanded, setOpenMeetingDetailExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnlyOneOpenMeeting, setHasOnlyOneOpenMeeting] = useState(false);
  const [vpeName, setVpeName] = useState<string>('VPE');
  const [tmodNeedsThemeByMeeting, setTmodNeedsThemeByMeeting] = useState<Record<string, boolean>>({});
  const [educationalSpeakerNeedsByMeeting, setEducationalSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [keynoteSpeakerNeedsByMeeting, setKeynoteSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [preparedSpeakerNeedsByMeeting, setPreparedSpeakerNeedsByMeeting] = useState<Record<string, boolean>>({});
  const [grammarianNeedsWotdByMeeting, setGrammarianNeedsWotdByMeeting] = useState<Record<string, boolean>>({});
  const [bookRoleNoRolesByMeeting, setBookRoleNoRolesByMeeting] = useState<Record<string, boolean>>({});
  /** Booked Toastmaster's avatar URL per meeting (for all members to see) */
  const [toastmasterBookedAvatarByMeeting, setToastmasterBookedAvatarByMeeting] = useState<
    Record<string, string | null>
  >({});
  /** Booked Toastmaster's user id per meeting (for merging with local avatar fallback) */
  const [toastmasterBookedUserIdByMeeting, setToastmasterBookedUserIdByMeeting] = useState<
    Record<string, string | null>
  >({});
  /** Signed-in user's avatar (Profile tab); used if meeting query omits URL but user is TM */
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string | null>(null);
  /** Booked role avatar URL lists per meeting (Speaking + Grammarian rows) */
  const [grammarianAvatarsByMeeting, setGrammarianAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const [educationalSpeakerAvatarsByMeeting, setEducationalSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [preparedSpeakerAvatarsByMeeting, setPreparedSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [keynoteSpeakerAvatarsByMeeting, setKeynoteSpeakerAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [generalEvaluatorAvatarsByMeeting, setGeneralEvaluatorAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [tableTopicsMasterAvatarsByMeeting, setTableTopicsMasterAvatarsByMeeting] = useState<
    Record<string, string[]>
  >({});
  const [timerAvatarsByMeeting, setTimerAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const [ahCounterAvatarsByMeeting, setAhCounterAvatarsByMeeting] = useState<Record<string, string[]>>({});
  const lastRefreshTime = useRef<number>(0);
  const hasLoadedOnce = useRef<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);
  const [reportsAnchorY, setReportsAnchorY] = useState<number | null>(null);

  useEffect(() => {
    if (params?.section !== 'reports') return;
    if (reportsAnchorY === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(reportsAnchorY - 12, 0), animated: true });
  }, [params?.section, reportsAnchorY]);

  useEffect(() => {
    if (user?.currentClubId) {
      Promise.all([loadOpenMeetings(), loadVPEInfo()]);
    } else if (!hasLoadedOnce.current) {
      setIsLoading(false);
    }
  }, [user?.currentClubId]);

  useEffect(() => {
    setOpenMeetingDetailExpanded(true);
  }, [currentMeeting?.id]);

  useEffect(() => {
    if (!user?.id) {
      setCurrentUserAvatarUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const url = (data as { avatar_url?: string | null } | null)?.avatar_url?.trim();
      if (error || !url) setCurrentUserAvatarUrl(null);
      else setCurrentUserAvatarUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      (async () => {
        const { data } = await supabase
          .from('app_user_profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        const url = (data as { avatar_url?: string | null } | null)?.avatar_url?.trim();
        setCurrentUserAvatarUrl(url || null);
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastRefresh = (now - lastRefreshTime.current) / 1000;

      // Only refresh if more than 30 seconds have passed
      if (timeSinceLastRefresh < 30) {
        return;
      }

      lastRefreshTime.current = now;

      if (user?.currentClubId) {
        const tasks: Promise<void>[] = [loadOpenMeetings(), loadVPEInfo()];
        if (isAuthenticated) tasks.push(refreshUserProfile());
        Promise.all(tasks);
      }
    }, [user?.currentClubId, isAuthenticated, refreshUserProfile])
  );

  useEffect(() => {
    const meetingIds: string[] = [];
    if (currentMeeting?.id && !currentMeeting?.isPlaceholder) meetingIds.push(currentMeeting.id);
    nextMeetings.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !m.id.startsWith('placeholder')) meetingIds.push(m.id);
    });
    meetingHistory.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) meetingIds.push(m.id);
    });
    if (meetingIds.length === 0 || !user?.id) {
      setTmodNeedsThemeByMeeting({});
      setEducationalSpeakerNeedsByMeeting({});
      setKeynoteSpeakerNeedsByMeeting({});
      setPreparedSpeakerNeedsByMeeting({});
      setGrammarianNeedsWotdByMeeting({});
      setToastmasterBookedAvatarByMeeting({});
      setToastmasterBookedUserIdByMeeting({});
      setGrammarianAvatarsByMeeting({});
      setEducationalSpeakerAvatarsByMeeting({});
      setPreparedSpeakerAvatarsByMeeting({});
      setKeynoteSpeakerAvatarsByMeeting({});
      setGeneralEvaluatorAvatarsByMeeting({});
      setTableTopicsMasterAvatarsByMeeting({});
      setTimerAvatarsByMeeting({});
      setAhCounterAvatarsByMeeting({});
      return;
    }
    let cancelled = false;
    (async () => {
      const isMeetingCompletedForAlerts = (m: Meeting) => {
        if (!m?.meeting_date) return false;
        const now = new Date();
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const meetingMidnight = new Date(`${m.meeting_date}T00:00:00`);
        const diffDays = meetingMidnight.getTime() - nowMidnight.getTime();
        const daysToGo = Math.ceil(diffDays / (1000 * 60 * 60 * 24));
        if (daysToGo < 0) return true;
        const hasTimes = !!(m.meeting_start_time || m.meeting_end_time);
        if (!hasTimes) return false;
        const endTime = m.meeting_end_time || '23:59:59';
        const endParts = endTime.split(':').map(Number);
        const meetingEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          endParts[0] || 0,
          endParts[1] || 0,
          0
        );
        return now > meetingEnd;
      };

      const meetingById = new Map<string, Meeting>();
      if (currentMeeting?.id && !currentMeeting?.isPlaceholder) {
        meetingById.set(currentMeeting.id, currentMeeting);
      }
      nextMeetings.forEach((mt) => {
        if (mt?.id && !mt?.isPlaceholder && !String(mt.id).startsWith('placeholder')) {
          meetingById.set(mt.id, mt);
        }
      });
      meetingHistory.forEach((mt) => {
        if (mt?.id && !mt?.isPlaceholder && !String(mt.id).startsWith('placeholder')) {
          meetingById.set(mt.id, mt);
        }
      });

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

      const tmodResult: Record<string, boolean> = {};
      const tmodAvatarResult: Record<string, string | null> = {};
      const tmodBookedUserIdResult: Record<string, string | null> = {};
      const edResult: Record<string, boolean> = {};
      const keynoteResult: Record<string, boolean> = {};
      const preparedResult: Record<string, boolean> = {};
      const grammarianResult: Record<string, boolean> = {};
      const grammarianAvatarsResult: Record<string, string[]> = {};
      const educationalAvatarsResult: Record<string, string[]> = {};
      const preparedAvatarsResult: Record<string, string[]> = {};
      const keynoteAvatarsResult: Record<string, string[]> = {};
      const generalEvaluatorAvatarsResult: Record<string, string[]> = {};
      const tableTopicsMasterAvatarsResult: Record<string, string[]> = {};
      const timerAvatarsResult: Record<string, string[]> = {};
      const ahCounterAvatarsResult: Record<string, string[]> = {};

      const fetchOrderedAvatarUrls = async (
        meetingId: string,
        kind:
          | 'grammarian'
          | 'educational'
          | 'prepared'
          | 'keynote'
          | 'general_evaluator'
          | 'table_topic_master'
          | 'timer'
          | 'ah_counter'
      ): Promise<string[]> => {
        let q;
        if (kind === 'grammarian') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%grammarian%');
        } else if (kind === 'educational') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .eq('role_name', 'Educational Speaker');
        } else if (kind === 'keynote') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%keynote speaker%');
        } else if (kind === 'general_evaluator') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%general evaluator%');
        } else if (kind === 'table_topic_master') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%');
        } else if (kind === 'timer') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .eq('role_name', 'Timer');
        } else if (kind === 'ah_counter') {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%Ah Counter%');
        } else {
          q = supabase
            .from('app_meeting_roles_management')
            .select('assigned_user_id')
            .eq('meeting_id', meetingId)
            .eq('booking_status', 'booked')
            .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%');
        }
        const { data, error } = await q;
        if (cancelled || error || !data?.length) return [];
        const seen = new Set<string>();
        const orderedIds: string[] = [];
        for (const row of data as { assigned_user_id: string | null }[]) {
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

      for (const mid of meetingIds) {
        if (cancelled) break;
        const { data: roleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .ilike('role_name', '%toastmaster%')
          .eq('booking_status', 'booked')
          .limit(1);
        const role = Array.isArray(roleData) && roleData.length > 0 ? roleData[0] : null;
        const tmodBookedUserId = role?.assigned_user_id as string | undefined;
        tmodBookedUserIdResult[mid] = tmodBookedUserId || null;
        if (!tmodBookedUserId) {
          tmodAvatarResult[mid] = null;
        } else {
          const { data: tmodProfile, error: tmodProfErr } = await supabase
            .from('app_user_profiles')
            .select('avatar_url')
            .eq('id', tmodBookedUserId)
            .maybeSingle();
          const avatarUrl = tmodProfErr
            ? null
            : (tmodProfile as { avatar_url?: string | null } | null)?.avatar_url?.trim() || null;
          tmodAvatarResult[mid] = avatarUrl;
        }
        const isCurrentUserTmod = role && role.assigned_user_id === user.id;
        if (!isCurrentUserTmod) {
          tmodResult[mid] = false;
        } else {
          const { data: themeData } = await supabase
            .from('toastmaster_meeting_data')
            .select('theme_of_the_day')
            .eq('meeting_id', mid)
            .eq('toastmaster_user_id', user.id)
            .maybeSingle();
          const hasTheme = !!(themeData?.theme_of_the_day?.trim());
          tmodResult[mid] = !hasTheme;
        }
        const { data: edRoleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .eq('role_name', 'Educational Speaker')
          .eq('role_status', 'Available')
          .eq('booking_status', 'booked')
          .limit(1);
        const edRole = Array.isArray(edRoleData) && edRoleData.length > 0 ? edRoleData[0] : null;
        const isCurrentUserEdSpeaker = edRole && edRole.assigned_user_id === user.id;
        if (!isCurrentUserEdSpeaker) {
          edResult[mid] = false;
        } else {
          const { data: contentData } = await supabase
            .from('app_meeting_educational_speaker')
            .select('speech_title')
            .eq('meeting_id', mid)
            .eq('speaker_user_id', user.id)
            .maybeSingle();
          const hasContent = !!(contentData?.speech_title?.trim());
          edResult[mid] = !hasContent;
        }
        const { data: keynoteRoleData } = await supabase
          .from('app_meeting_roles_management')
          .select('id, assigned_user_id')
          .eq('meeting_id', mid)
          .ilike('role_name', '%keynote speaker%')
          .eq('booking_status', 'booked')
          .limit(1);
        const keynoteRole = Array.isArray(keynoteRoleData) && keynoteRoleData.length > 0 ? keynoteRoleData[0] : null;
        const isCurrentUserKeynote = keynoteRole && keynoteRole.assigned_user_id === user.id;
        if (!isCurrentUserKeynote) {
          keynoteResult[mid] = false;
        } else {
          const { data: keynoteContentData } = await supabase
            .from('app_meeting_keynote_speaker')
            .select('speech_title')
            .eq('meeting_id', mid)
            .eq('speaker_user_id', user.id)
            .maybeSingle();
          const hasKeynoteContent = !!(keynoteContentData?.speech_title?.trim());
          keynoteResult[mid] = !hasKeynoteContent;
        }

        const mt = meetingById.get(mid);
        const completed = mt ? isMeetingCompletedForAlerts(mt) : false;
        if (completed) {
          preparedResult[mid] = false;
          grammarianResult[mid] = false;
        } else {
          const { data: psRoles, error: rolesErr } = await supabase
            .from('app_meeting_roles_management')
            .select('role_name')
            .eq('meeting_id', mid)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked')
            .or('role_classification.eq.Prepared Speaker,role_name.ilike.%prepared%speaker%,role_name.ilike.%ice%breaker%');

          if (rolesErr || cancelled) {
            preparedResult[mid] = false;
          } else if (!psRoles?.length) {
            preparedResult[mid] = false;
          } else {
            const { data: pathways, error: pathErr } = await supabase
              .from('app_evaluation_pathway')
              .select(
                'role_name, speech_title, pathway_name, level, project_name, evaluation_form, comments_for_evaluator'
              )
              .eq('meeting_id', mid)
              .eq('user_id', user.id);

            if (pathErr || cancelled) {
              preparedResult[mid] = false;
            } else {
              const byRole = new Map((pathways || []).map((row: { role_name: string }) => [row.role_name, row]));
              let needsPrepared = false;
              for (const row of psRoles) {
                const p = byRole.get(row.role_name);
                if (!pathwayHasSpeechDetails(p || null)) {
                  needsPrepared = true;
                  break;
                }
              }
              preparedResult[mid] = needsPrepared;
            }
          }

          const { data: gRole, error: gErr } = await supabase
            .from('app_meeting_roles_management')
            .select('id')
            .eq('meeting_id', mid)
            .eq('assigned_user_id', user.id)
            .eq('booking_status', 'booked')
            .ilike('role_name', '%grammarian%')
            .limit(1)
            .maybeSingle();

          if (gErr || cancelled || !gRole) {
            grammarianResult[mid] = false;
          } else {
            const [dailyRes, wotdRes] = await Promise.all([
              supabase
                .from('app_grammarian_daily_elements')
                .select('word_of_the_day')
                .eq('meeting_id', mid)
                .eq('grammarian_user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from('grammarian_word_of_the_day')
                .select('word, grammarian_user_id')
                .eq('meeting_id', mid)
                .maybeSingle(),
            ]);
            if (cancelled) {
              grammarianResult[mid] = false;
            } else {
              const dailyWord = (dailyRes.data?.word_of_the_day || '').trim();
              const wotd = wotdRes.data;
              const structuredWord =
                wotd && wotd.grammarian_user_id === user.id ? (wotd.word || '').trim() : '';
              grammarianResult[mid] = !(dailyWord || structuredWord);
            }
          }
        }

        if (!cancelled) {
          const [
            gAv,
            eAv,
            pAv,
            knAv,
            geAv,
            ttmAv,
            timerAv,
            ahAv,
          ] = await Promise.all([
            fetchOrderedAvatarUrls(mid, 'grammarian'),
            fetchOrderedAvatarUrls(mid, 'educational'),
            fetchOrderedAvatarUrls(mid, 'prepared'),
            fetchOrderedAvatarUrls(mid, 'keynote'),
            fetchOrderedAvatarUrls(mid, 'general_evaluator'),
            fetchOrderedAvatarUrls(mid, 'table_topic_master'),
            fetchOrderedAvatarUrls(mid, 'timer'),
            fetchOrderedAvatarUrls(mid, 'ah_counter'),
          ]);
          grammarianAvatarsResult[mid] = gAv;
          educationalAvatarsResult[mid] = eAv;
          preparedAvatarsResult[mid] = pAv;
          keynoteAvatarsResult[mid] = knAv;
          generalEvaluatorAvatarsResult[mid] = geAv;
          tableTopicsMasterAvatarsResult[mid] = ttmAv;
          timerAvatarsResult[mid] = timerAv;
          ahCounterAvatarsResult[mid] = ahAv;
        }
      }
      if (!cancelled) {
        setTmodNeedsThemeByMeeting(tmodResult);
        setToastmasterBookedAvatarByMeeting(tmodAvatarResult);
        setToastmasterBookedUserIdByMeeting(tmodBookedUserIdResult);
        setEducationalSpeakerNeedsByMeeting(edResult);
        setKeynoteSpeakerNeedsByMeeting(keynoteResult);
        setPreparedSpeakerNeedsByMeeting(preparedResult);
        setGrammarianNeedsWotdByMeeting(grammarianResult);
        setGrammarianAvatarsByMeeting(grammarianAvatarsResult);
        setEducationalSpeakerAvatarsByMeeting(educationalAvatarsResult);
        setPreparedSpeakerAvatarsByMeeting(preparedAvatarsResult);
        setKeynoteSpeakerAvatarsByMeeting(keynoteAvatarsResult);
        setGeneralEvaluatorAvatarsByMeeting(generalEvaluatorAvatarsResult);
        setTableTopicsMasterAvatarsByMeeting(tableTopicsMasterAvatarsResult);
        setTimerAvatarsByMeeting(timerAvatarsResult);
        setAhCounterAvatarsByMeeting(ahCounterAvatarsResult);
      }
    })();
    return () => { cancelled = true; };
  }, [currentMeeting, nextMeetings, meetingHistory, user?.id]);

  const refreshBookRoleAttention = useCallback(() => {
    if (!user?.id || !user?.currentClubId) {
      setBookRoleNoRolesByMeeting({});
      return;
    }
    const r = (user.clubRole || user.role || '').toLowerCase();
    if (r === 'guest') {
      setBookRoleNoRolesByMeeting({});
      return;
    }
    const ids = new Set<string>();
    if (currentMeeting?.id && !currentMeeting.isPlaceholder) ids.add(currentMeeting.id);
    nextMeetings.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) ids.add(m.id);
    });
    meetingHistory.forEach((m) => {
      if (m?.id && !m?.isPlaceholder && !String(m.id).startsWith('placeholder')) ids.add(m.id);
    });
    if (selectedMeeting?.id && !selectedMeeting.isPlaceholder) ids.add(selectedMeeting.id);
    if (expandedNextMeeting && !String(expandedNextMeeting).startsWith('placeholder')) {
      ids.add(expandedNextMeeting);
    }
    if (expandedHistoryMeetingId && !String(expandedHistoryMeetingId).startsWith('placeholder')) {
      ids.add(expandedHistoryMeetingId);
    }
    if (ids.size === 0) {
      setBookRoleNoRolesByMeeting({});
      return;
    }

    const isMeetingCompletedForHighlight = (m: Meeting) => {
      if (!m?.meeting_date) return false;

      const now = new Date();
      const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const meetingMidnight = new Date(`${m.meeting_date}T00:00:00`);

      const diffDays = meetingMidnight.getTime() - nowMidnight.getTime();
      const daysToGo = Math.ceil(diffDays / (1000 * 60 * 60 * 24));
      if (daysToGo < 0) return true;

      const hasTimes = !!(m.meeting_start_time || m.meeting_end_time);
      if (!hasTimes) return false;

      const endTime = m.meeting_end_time || '23:59:59';
      const endParts = endTime.split(':').map(Number);
      const meetingEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endParts[0] || 0, endParts[1] || 0, 0);
      return now > meetingEnd;
    };

    let cancelled = false;
    (async () => {
      const next: Record<string, boolean> = {};

      const meetingById = new Map<string, Meeting>();
      if (currentMeeting?.id && !currentMeeting.isPlaceholder) meetingById.set(currentMeeting.id, currentMeeting);
      nextMeetings.forEach((m) => {
        if (m?.id && !m?.isPlaceholder) meetingById.set(m.id, m);
      });
      if (selectedMeeting?.id && !selectedMeeting.isPlaceholder) meetingById.set(selectedMeeting.id, selectedMeeting);
      if (expandedNextMeeting && !String(expandedNextMeeting).startsWith('placeholder')) {
        // We may not have the full object here, so completion-by-time only applies when meetingById has it.
      }

      for (const mid of ids) {
        const m = meetingById.get(mid);
        if (m && isMeetingCompletedForHighlight(m)) {
          next[mid] = false;
          continue;
        }

        const { count, error } = await supabase
          .from('app_meeting_roles_management')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', user.currentClubId)
          .eq('meeting_id', mid)
          .eq('assigned_user_id', user.id)
          .eq('booking_status', 'booked');
        next[mid] = !error && (count ?? 0) === 0;
      }
      if (!cancelled) setBookRoleNoRolesByMeeting(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.currentClubId, user?.clubRole, user?.role, currentMeeting, nextMeetings, meetingHistory, selectedMeeting, expandedNextMeeting, expandedHistoryMeetingId]);

  useEffect(() => {
    const cleanup = refreshBookRoleAttention();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [refreshBookRoleAttention]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = refreshBookRoleAttention();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [refreshBookRoleAttention])
  );

  const loadVPEInfo = async () => {
    if (!user?.currentClubId) return;

    setVpeName('VPE');

    try {
      // Optimized single query with join - fetches VPE name in one call
      const { data: clubProfile, error } = await supabase
        .from('club_profiles')
        .select(`
          vpe_id,
          app_user_profiles!club_profiles_vpe_id_fkey (
            full_name
          )
        `)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading VPE info:', error);
        return;
      }

      // Access the joined VPE profile data
      const vpeProfile = clubProfile?.app_user_profiles as { full_name: string } | null;
      if (vpeProfile?.full_name) {
        setVpeName(vpeProfile.full_name);
      }
    } catch (error) {
      console.error('Error loading VPE info:', error);
    }
  };

  const loadOpenMeetings = async () => {
    if (!user?.currentClubId) {
      setMeetingHistory([]);
      setExpandedHistoryMeetingId(null);
      if (!hasLoadedOnce.current) {
        setIsLoading(false);
      }
      return;
    }

    const isFirstLoad = !hasLoadedOnce.current;
    if (isFirstLoad) setIsLoading(true);

    try {
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
      const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

      const meetingSelect =
        'id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location, meeting_link, meeting_status, meeting_day';

      const [openRes, historyRes] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select(meetingSelect)
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'open')
          .gte('meeting_date', cutoffDate)
          .order('meeting_date', { ascending: true })
          .order('meeting_start_time', { ascending: true }),
        supabase
          .from('app_club_meeting')
          .select(meetingSelect)
          .eq('club_id', user.currentClubId)
          .eq('meeting_status', 'close')
          .order('meeting_date', { ascending: false })
          .order('meeting_start_time', { ascending: false })
          .limit(50),
      ]);

      const { data: openData, error: openError } = openRes;
      const { data: historyData, error: historyError } = historyRes;

      if (historyError) {
        console.error('Error loading meeting history:', historyError);
        setMeetingHistory([]);
      } else {
        setMeetingHistory(historyData || []);
      }

      if (openError) {
        console.error('Error loading open meetings:', openError);
        setIsLoading(false);
        return;
      }

      const allOpenMeetings = openData || [];

      const now = new Date();
      const openMeetings = allOpenMeetings.filter(meeting => {
        const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
        const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceMeetingEnd < 4;
      });

      if (openMeetings.length > 0) {
        setCurrentMeeting(openMeetings[0]);
        setHasOnlyOneOpenMeeting(openMeetings.length === 1);

        const nextOpenMeetings = openMeetings.slice(1, 3);

        const totalMeetingsNeeded = 3;
        const placeholdersNeeded = Math.max(0, totalMeetingsNeeded - openMeetings.length);

        const placeholders: Meeting[] = Array.from({ length: placeholdersNeeded }, (_, index) => ({
          id: `placeholder-${index}`,
          meeting_title: 'Coming Soon',
          meeting_date: '',
          meeting_number: null,
          meeting_start_time: null,
          meeting_end_time: null,
          meeting_mode: '',
          meeting_location: null,
          meeting_link: null,
          meeting_status: 'placeholder',
          meeting_day: null,
          isPlaceholder: true,
        }));

        setNextMeetings([...nextOpenMeetings, ...placeholders].slice(0, 2));
      } else {
        setCurrentMeeting(null);
        setNextMeetings([]);
        setHasOnlyOneOpenMeeting(false);
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      hasLoadedOnce.current = true;
      if (isFirstLoad) setIsLoading(false);
    }
  };

  const handleNextMeetingPress = (meetingId: string) => {
    if (expandedNextMeeting === meetingId) {
      setExpandedNextMeeting(null);
    } else {
      setExpandedNextMeeting(meetingId);
      setOpenMeetingTab('actions');
    }
  };

  const handleTabPress = (tab: TabItem, meetingId: string) => {
    if (tab.route) {
      let routeWithId = tab.route.replace('meetingId=undefined', `meetingId=${meetingId}`);
      if (tab.id === 'toastmaster_corner') {
        prefetchToastmasterCorner(queryClient, meetingId, user?.id, user?.currentClubId);
      }
      if (tab.id === 'toastmaster_corner' && tmodNeedsThemeByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      if (tab.id === 'educational_corner' && educationalSpeakerNeedsByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      if (tab.id === 'keynote_speaker' && keynoteSpeakerNeedsByMeeting[meetingId]) {
        routeWithId += '&showCongrats=1';
      }
      router.push(routeWithId);
      return;
    }

    if (tab.comingSoon) {
      Alert.alert('Coming Soon', `${tab.title} will be available in a future update.`);
      return;
    }

    if (tab.id === 'overview') {
      router.push(`/quick-overview?meetingId=${meetingId}`);
      return;
    }

    if (tab.id === 'book_role') {
      router.push(`/book-a-role?meetingId=${meetingId}`);
      return;
    }

    if (tab.id === 'live_voting') {
      router.push(`/live-voting?meetingId=${meetingId}`);
      return;
    }
  };

  const renderActionCard = (tab: TabItem, meetingId: string, fullWidth?: boolean) => (
    <TouchableOpacity
      key={tab.id}
      style={[
        fullWidth ? styles.actionCardFull : styles.actionCardHalf,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
      onPress={() => handleTabPress(tab, meetingId)}
      activeOpacity={0.7}
      disabled={!!tab.comingSoon}
    >
      <View style={[styles.actionCardIcon, { backgroundColor: tab.color + '25' }]}>
        {tab.id === 'book_role' && <Calendar size={20} color={tab.color} />}
        {tab.id === 'overview' && <RefreshCw size={20} color={tab.color} />}
        {tab.id === 'agenda' && <MonitorCheck size={20} color={tab.color} />}
        {tab.id === 'live_voting' && <CheckCircle size={20} color={tab.color} />}
        {tab.id === 'role_completion' && <ClipboardCheck size={20} color={tab.color} />}
        {tab.id === 'attendance' && <BarChart3 size={20} color={tab.color} />}
        {tab.id === 'feedback_corner' && <Search size={20} color={tab.color} />}
        {tab.id === 'member_feedback' && <Star size={20} color={tab.color} />}
        {tab.id === 'meeting_minutes' && <ScrollText size={20} color={tab.color} />}
        {!['book_role', 'overview', 'agenda', 'live_voting', 'role_completion', 'attendance', 'feedback_corner', 'member_feedback', 'meeting_minutes'].includes(tab.id) && (
          <FileText size={20} color={tab.color} />
        )}
      </View>
      <View style={styles.actionCardContent}>
        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {tab.title}
        </Text>
        {tab.comingSoon && (
          <View style={styles.actionComingSoonBadge}>
            <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>Coming Soon</Text>
          </View>
        )}
      </View>
      {!tab.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
    </TouchableOpacity>
  );

  const getTabsByCategory = (meetingId: string) => {
    const allTabs = getTabsForMeeting(meetingId);
    const byId = new Map(allTabs.map(t => [t.id, t]));
    const take = (ids: string[]) => ids.map(id => byId.get(id)).filter(Boolean) as TabItem[];
    return {
      core: take(['book_role', 'overview', 'agenda']),
      operations: take(['live_voting', 'role_completion', 'attendance']),
      feedbackReports: take(['feedback_corner', 'member_feedback', 'guest_feedback', 'meeting_minutes']),
      keyRoles: take(['toastmaster_corner', 'general_evaluator', 'table_topic_corner']),
      speakingRoles: take(['evaluation_corner', 'educational_corner', 'keynote_speaker']),
      supportRoles: take(['timer', 'ah_counter', 'grammarian', 'listener', 'quiz_master']),
      evaluation: take(['prepared_speech_evaluation', 'master_evaluation', 'table_topics_evaluation']),
      others: allTabs.filter(t => !['book_role', 'overview', 'agenda', 'live_voting', 'role_completion', 'attendance', 'feedback_corner', 'member_feedback', 'guest_feedback', 'meeting_minutes', 'toastmaster_corner', 'general_evaluator', 'table_topic_corner', 'evaluation_corner', 'educational_corner', 'keynote_speaker', 'timer', 'grammarian', 'listener', 'ah_counter', 'quiz_master', 'prepared_speech_evaluation', 'master_evaluation', 'table_topics_evaluation', 'guest_introduce'].includes(t.id)),
    };
  };

  const renderActionsTabContent = (meetingId: string) => {
    const { core, operations, feedbackReports, others } = getTabsByCategory(meetingId);
    return (
      <View style={styles.actionsTabContainer}>
        {/* Core */}
        {core.length > 0 && (
          <View style={styles.actionsSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Core</Text>
            <View style={styles.keyRolesList}>
              {core.map((tab) => {
                const descriptions: Record<string, string> = {
                  book_role: 'Book roles for this meeting',
                  overview: 'View meeting overview and status',
                  agenda: 'View and manage meeting agenda',
                };
                const description = descriptions[tab.id] || '';
                if (tab.id === 'book_role') {
                  return (
                    <BookRoleCoreCard
                      key={tab.id}
                      tab={tab}
                      description={description}
                      showAttention={bookRoleNoRolesByMeeting[meetingId] === true}
                      onPress={() => handleTabPress(tab, meetingId)}
                    />
                  );
                }
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => handleTabPress(tab, meetingId)}
                    activeOpacity={0.7}
                    disabled={!!tab.comingSoon}
                  >
                    <View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }]}>
                      {tab.id === 'overview' && <RefreshCw size={20} color={tab.color} />}
                      {tab.id === 'agenda' && <MonitorCheck size={20} color={tab.color} />}
                    </View>
                    <View style={styles.keyRoleContent}>
                      <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {tab.title}
                      </Text>
                      {description ? (
                        <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          {description}
                        </Text>
                      ) : null}
                    </View>
                    {!tab.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
                    {tab.comingSoon && (
                      <View style={styles.actionComingSoonBadge}>
                        <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>Coming Soon</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Operations */}
        {(operations[0] || operations[1] || operations[2]) && (
          <View style={styles.actionsSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Operations</Text>
            <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.speakingRolesGrid}>
              {operations.map((tab) => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.speakingRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => handleTabPress(tab, meetingId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.speakingRoleIcon, { backgroundColor: tab.color + '25' }]}>
                    {tab.id === 'live_voting' && <CheckCircle size={22} color={tab.color} />}
                    {tab.id === 'role_completion' && <ClipboardCheck size={22} color={tab.color} />}
                    {tab.id === 'attendance' && <BarChart3 size={22} color={tab.color} />}
                  </View>
                  <Text style={[styles.speakingRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Closing and reports - same design as Quick Overview (full-width cards with subtitle) */}
        {feedbackReports[3] && (
          <View style={styles.actionsSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Closing and reports</Text>
            <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.keyRolesList}>
              <TouchableOpacity
                key={feedbackReports[3].id}
                style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => handleTabPress(feedbackReports[3], meetingId)}
                activeOpacity={0.7}
                disabled={!!feedbackReports[3].comingSoon}
              >
                <View style={[styles.keyRoleIcon, { backgroundColor: (feedbackReports[3].color || '#6b7280') + '25' }]}>
                  <ScrollText size={20} color={feedbackReports[3].color || '#6b7280'} />
                </View>
                <View style={styles.keyRoleContent}>
                  <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {feedbackReports[3].title}
                  </Text>
                  <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Record and review meeting minutes
                  </Text>
                </View>
                {!feedbackReports[3].comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
                {feedbackReports[3].comingSoon && (
                  <View style={styles.actionComingSoonBadge}>
                    <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>Coming Soon</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => router.push({ pathname: '/(tabs)/meetings', params: { section: 'reports' } })}
                activeOpacity={0.7}
              >
                <View style={[styles.keyRoleIcon, { backgroundColor: '#3b82f625' }]}>
                  <ClipboardList size={20} color="#3b82f6" />
                </View>
                <View style={styles.keyRoleContent}>
                  <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Club reports
                  </Text>
                  <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    View member, roles, and attendance reports
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {others.length > 0 && (
          <View style={styles.actionsSection}>
            <Text style={[styles.actionsSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Others</Text>
            <View style={styles.actionsCardsRow}>
              {others.map((tab) => renderActionCard(tab, meetingId, false))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderRolesTabContent = (meetingId: string) => {
    const { keyRoles, speakingRoles, supportRoles } = getTabsByCategory(meetingId);
    const tmodNeedsAlert = tmodNeedsThemeByMeeting[meetingId] === true;
    const educationalSpeakerNeedsAlert = educationalSpeakerNeedsByMeeting[meetingId] === true;
    const keynoteSpeakerNeedsAlert = keynoteSpeakerNeedsByMeeting[meetingId] === true;
    const preparedSpeakerNeedsAlert = preparedSpeakerNeedsByMeeting[meetingId] === true;
    const grammarianNeedsAlert = grammarianNeedsWotdByMeeting[meetingId] === true;
    const tmBookedUserId = toastmasterBookedUserIdByMeeting[meetingId];
    const tmAvatarFromDb = toastmasterBookedAvatarByMeeting[meetingId]?.trim() || null;
    const toastmasterDisplayAvatarUrl =
      tmAvatarFromDb ||
      (tmBookedUserId && user?.id === tmBookedUserId ? currentUserAvatarUrl : null) ||
      null;
    const toastmasterAvatarUrlsForCard = toastmasterDisplayAvatarUrl
      ? [toastmasterDisplayAvatarUrl]
      : [];

    return (
      <View style={styles.rolesTabContainer}>
        {/* Key Roles - full-width stacked cards */}
        {keyRoles.length > 0 && (
          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Key Roles</Text>
            <View style={styles.keyRolesList}>
              {keyRoles.map((tab) => (
                <KeyRoleCardWithTmodAlert
                  key={tab.id}
                  tab={tab}
                  meetingId={meetingId}
                  onPress={() => handleTabPress(tab, meetingId)}
                  showAlert={tab.id === 'toastmaster_corner' && tmodNeedsAlert}
                  avatarUrls={
                    tab.id === 'toastmaster_corner'
                      ? toastmasterAvatarUrlsForCard
                      : tab.id === 'general_evaluator'
                        ? generalEvaluatorAvatarsByMeeting[meetingId] ?? []
                        : tab.id === 'table_topic_corner'
                          ? tableTopicsMasterAvatarsByMeeting[meetingId] ?? []
                          : []
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Speaking Roles - 3 side-by-side cards */}
        {speakingRoles.length > 0 && (
          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speaking Roles</Text>
            <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.speakingRolesGrid}>
              {speakingRoles.map((tab) => (
                <SpeakingRoleCardWithAlert
                  key={tab.id}
                  tab={tab}
                  meetingId={meetingId}
                  onPress={() => handleTabPress(tab, meetingId)}
                  showAlert={
                    (tab.id === 'evaluation_corner' && preparedSpeakerNeedsAlert) ||
                    (tab.id === 'educational_corner' && educationalSpeakerNeedsAlert) ||
                    (tab.id === 'keynote_speaker' && keynoteSpeakerNeedsAlert)
                  }
                  avatarUrls={
                    tab.id === 'evaluation_corner'
                      ? preparedSpeakerAvatarsByMeeting[meetingId]
                      : tab.id === 'educational_corner'
                        ? educationalSpeakerAvatarsByMeeting[meetingId]
                        : tab.id === 'keynote_speaker'
                          ? keynoteSpeakerAvatarsByMeeting[meetingId]
                          : undefined
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Support Roles - Timer & Ah Counter in 2-column grid; Grammarian, Listener, Quiz Master as full-width cards */}
        {supportRoles.length > 0 && (
          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Support Roles</Text>
            <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
            {/* Top row: Timer and Ah Counter - 2-column grid */}
            <View style={styles.supportRolesGrid}>
              {supportRoles.filter(t => t.id === 'timer' || t.id === 'ah_counter').map((tab) => {
                const iconColor = tab.color || '#6b7280';
                const SupportIcon = tab.id === 'timer' ? Timer : BarChart3;
                return (
                  <SupportHalfRoleCardWithAvatar
                    key={tab.id}
                    tab={tab}
                    iconColor={iconColor}
                    SupportIcon={SupportIcon}
                    avatarUrls={
                      tab.id === 'timer'
                        ? timerAvatarsByMeeting[meetingId]
                        : ahCounterAvatarsByMeeting[meetingId]
                    }
                    onPress={() => handleTabPress(tab, meetingId)}
                    comingSoon={!!tab.comingSoon}
                  />
                );
              })}
            </View>
            {/* Below: Grammarian, Listener, Quiz Master - full-width cards like Table Topics Master */}
            <View style={[styles.keyRolesList, { marginTop: 12 }]}>
              {supportRoles.filter(t => ['grammarian', 'listener', 'quiz_master'].includes(t.id)).map((tab) => {
                const iconColor = tab.color || '#6b7280';
                const SupportIcon = tab.id === 'grammarian' ? BookOpen : tab.id === 'listener' ? Ear : BookCheck;
                const descriptions: Record<string, string> = {
                  grammarian: 'Tracks grammar and word of the day',
                  listener: 'Reports on listening comprehension',
                  quiz_master: 'Conducts meeting quizzes',
                };
                const description = descriptions[tab.id] || '';
                return (
                  <SupportFullWidthRoleCardWithAlert
                    key={tab.id}
                    title={tab.title}
                    description={description}
                    iconColor={iconColor}
                    SupportIcon={SupportIcon}
                    showAlert={tab.id === 'grammarian' && grammarianNeedsAlert}
                    comingSoon={!!tab.comingSoon}
                    onPress={() => handleTabPress(tab, meetingId)}
                    avatarUrls={tab.id === 'grammarian' ? grammarianAvatarsByMeeting[meetingId] : undefined}
                  />
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEvaluationTabContent = (meetingId: string) => {
    const { evaluation, feedbackReports } = getTabsByCategory(meetingId);
    const feedbackItems = [feedbackReports[0], feedbackReports[1], feedbackReports[2]].filter(Boolean) as TabItem[];
    if (evaluation.length === 0 && feedbackItems.length === 0) {
      return (
        <View style={[styles.emptyTabState, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.emptyTabText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Evaluation features coming soon
          </Text>
        </View>
      );
    }
    const descriptions: Record<string, string> = {
      prepared_speech_evaluation: 'Evaluate prepared speeches',
      master_evaluation: 'Master-level meeting evaluation',
      table_topics_evaluation: 'Evaluate table topics responses',
      feedback_corner: 'Share your meeting experience',
      member_feedback: 'Submit member feedback',
      guest_feedback: 'Collect feedback from guests',
    };
    const renderKeyRoleCard = (tab: TabItem) => (
      <TouchableOpacity
        key={tab.id}
        style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        onPress={() => handleTabPress(tab, meetingId)}
        activeOpacity={0.7}
        disabled={!!tab.comingSoon}
      >
        <View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }]}>
          {tab.id === 'prepared_speech_evaluation' && <ClipboardList size={20} color={tab.color} />}
          {tab.id === 'master_evaluation' && <Star size={20} color={tab.color} />}
          {tab.id === 'table_topics_evaluation' && <MessageSquareQuote size={20} color={tab.color} />}
          {tab.id === 'feedback_corner' && <Search size={20} color={tab.color} />}
          {tab.id === 'member_feedback' && <Star size={20} color={tab.color} />}
          {tab.id === 'guest_feedback' && <UserPlus size={20} color={tab.color} />}
        </View>
        <View style={styles.keyRoleContent}>
          <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {tab.title}
          </Text>
          <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {descriptions[tab.id] || ''}
          </Text>
        </View>
        {!tab.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
        {tab.comingSoon && (
          <View style={styles.actionComingSoonBadge}>
            <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>Coming Soon</Text>
          </View>
        )}
      </TouchableOpacity>
    );
    return (
      <View style={styles.rolesTabContainer}>
        {/* Evaluation section - Key Roles style */}
        {evaluation.length > 0 && (
          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluation</Text>
            <View style={styles.keyRolesList}>
              {evaluation.map(renderKeyRoleCard)}
            </View>
          </View>
        )}
        {/* Feedback section - Key Roles style */}
        {feedbackItems.length > 0 && (
          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Feedback</Text>
            <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.keyRolesList}>
              {feedbackItems.map(renderKeyRoleCard)}
            </View>
          </View>
        )}
      </View>
    );
  };

  const getTabsForMeeting = (meetingId: string): TabItem[] => [
    {
      id: 'book_role',
      title: 'Book a Role',
      icon: <Calendar size={18} color="#ffffff" />,
      color: '#0a66c2'
    },
    {
      id: 'overview',
      title: 'Quick Overview',
      icon: <FileText size={18} color="#ffffff" />,
      color: '#3b82f6'
    },
    {
      id: 'agenda',
      title: 'Meeting Agenda',
      icon: <FileText size={18} color="#ffffff" />,
      color: '#10b981',
      route: `/meeting-agenda-view?meetingId=${meetingId}`
    },
    {
      id: 'toastmaster_corner',
      title: 'Toastmaster of the day',
      icon: <MessageSquare size={18} color="#ffffff" />,
      color: '#84cc16',
      route: `/toastmaster-corner?meetingId=${meetingId}`
    },
    {
      id: 'general_evaluator',
      title: 'General Evaluator',
      icon: <Star size={18} color="#ffffff" />,
      color: '#ef4444',
      route: `/general-evaluator-report?meetingId=${meetingId}`
    },
    {
      id: 'table_topic_corner',
      title: 'Table Topic Corner',
      icon: <MessageSquare size={18} color="#ffffff" />,
      color: '#f97316',
      route: `/table-topic-corner?meetingId=${meetingId}`
    },
    {
      id: 'timer',
      title: 'Timer',
      icon: <Timer size={18} color="#ffffff" />,
      color: '#f59e0b',
      route: `/timer-report-details?meetingId=${meetingId}`
    },
    {
      id: 'ah_counter',
      title: 'Ah Counter',
      icon: <BarChart3 size={18} color="#ffffff" />,
      color: '#06b6d4',
      route: `/ah-counter-corner?meetingId=${meetingId}`
    },
    {
      id: 'grammarian',
      title: 'Grammarian',
      icon: <BookOpen size={18} color="#ffffff" />,
      color: '#8b5cf6',
      route: `/grammarian?meetingId=${meetingId}`
    },
    {
      id: 'evaluation_corner',
      title: 'Prepared Speeches',
      icon: <Award size={18} color="#ffffff" />,
      color: '#14b8a6',
      route: `/evaluation-corner?meetingId=${meetingId}`
    },
    {
      id: 'educational_corner',
      title: 'Educational Corner',
      icon: <Book size={18} color="#ffffff" />,
      color: '#f97316',
      route: `/educational-corner?meetingId=${meetingId}`
    },
    {
      id: 'keynote_speaker',
      title: 'Keynote Speaker',
      icon: <Mic size={18} color="#ffffff" />,
      color: '#f59e0b',
      route: `/keynote-speaker-corner?meetingId=${meetingId}`
    },
    {
      id: 'prepared_speech_evaluation',
      title: 'Speech Evaluation',
      icon: <ClipboardList size={18} color="#ffffff" />,
      color: '#ef4444',
      route: `/prepared-speech-evaluations?meetingId=${meetingId}`,
      comingSoon: true
    },
    {
      id: 'live_voting',
      title: 'Live Voting',
      icon: <Vote size={18} color="#ffffff" />,
      color: '#8b5cf6'
    },
    {
      id: 'role_completion',
      title: 'Role Completion',
      icon: <ClipboardCheck size={18} color="#ffffff" />,
      color: '#6366f1',
      route: `/role-completion-report?meetingId=${meetingId}`
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      icon: <UserCheck size={18} color="#ffffff" />,
      color: '#ec4899',
      route: `/attendance-report?meetingId=${meetingId}`
    },
    {
      id: 'feedback_corner',
      title: 'Meeting Feedback',
      icon: <MessageCircle size={18} color="#ffffff" />,
      color: '#a855f7',
      route: `/feedback-corner?meetingId=${meetingId}`
    },
    {
      id: 'quiz_master',
      title: 'Quiz Master',
      icon: <BookCheck size={18} color="#ffffff" />,
      color: '#8b5cf6',
      comingSoon: true
    },
    {
      id: 'listener',
      title: 'Listener',
      icon: <Ear size={18} color="#ffffff" />,
      color: '#06b6d4',
      comingSoon: true
    },
    {
      id: 'guest_introduce',
      title: 'Guest Introduce',
      icon: <UserPlus size={18} color="#ffffff" />,
      color: '#10b981',
      comingSoon: true
    },
    {
      id: 'table_topics_evaluation',
      title: 'Table Topics Evaluation',
      icon: <MessageSquareQuote size={18} color="#ffffff" />,
      color: '#f97316',
      comingSoon: true
    },
    {
      id: 'master_evaluation',
      title: 'Master Evaluation',
      icon: <Star size={18} color="#ffffff" />,
      color: '#fbbf24',
      comingSoon: true
    },
    {
      id: 'member_feedback',
      title: 'Member Feedback',
      icon: <UserCog size={18} color="#ffffff" />,
      color: '#ec4899',
      comingSoon: true
    },
    {
      id: 'guest_feedback',
      title: 'Guest Feedback',
      icon: <UserPlus size={18} color="#ffffff" />,
      color: '#14b8a6',
      comingSoon: true
    },
    {
      id: 'meeting_minutes',
      title: 'Meeting Minutes',
      icon: <ScrollText size={18} color="#ffffff" />,
      color: '#3b82f6',
      comingSoon: true
    }
  ];

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  const handleFeaturePress = (featurePath: string) => {
    // Check if user has a club
    if (!user?.currentClubId) {
      Alert.alert(
        'Join a Club',
        'To access this feature, please join a club by reaching out to your ExComm or create a club under Settings.',
        [
          {
            text: 'Create Club',
            onPress: () => router.push('/create-club'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    // User has a club, navigate to the feature
    router.push(featurePath as any);
  };

  // Early return if user is not loaded yet
  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Meetings</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Meetings</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
        {user?.currentClubId ? (
          <View style={[styles.meetingsMasterBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <ClubSwitcher
              showRole={true}
              embedded
              variant="notion"
              clubIconBackgroundColor="#F1F5F9"
              clubIconColor="#334155"
            />
            <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
            {/* Open Meetings Section */}
            <View style={styles.meetingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Open Meetings
            </Text>

            {isLoading ? (
              <View style={[styles.noMeetingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Loading meetings...
                </Text>
              </View>
            ) : currentMeeting ? (
              <View style={styles.meetingsList}>
                {(() => {
                  const meetingDate = new Date(currentMeeting.meeting_date);
                  const isToday = new Date().toDateString() === meetingDate.toDateString();
                  const dayNum = meetingDate.getDate();
                  const month = meetingDate.toLocaleString('default', { month: 'short' }).toUpperCase();

                  return (
                    <View key={currentMeeting.id}>
                      {openMeetingDetailExpanded ? (
                        /* Unified expanded box - meeting bar + tabs + content in one card */
                        <View style={[styles.unifiedExpandedMeetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                          <View style={styles.unifiedMeetingBar}>
                            <View style={styles.heroCardContent}>
                              <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                                <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                              </View>
                              <View style={styles.heroMeetingInfo}>
                                <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{currentMeeting.meeting_title}</Text>
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                                </Text>
                                {currentMeeting.meeting_start_time && (
                                  <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                    Time: {formatTime(currentMeeting.meeting_start_time)}
                                    {currentMeeting.meeting_end_time && ` - ${formatTime(currentMeeting.meeting_end_time)}`}
                                  </Text>
                                )}
                                <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Mode: {formatMeetingMode(currentMeeting.meeting_mode)}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.enterMeetingButton, { backgroundColor: theme.colors.primary }]}
                                onPress={() => {
                                  setOpenMeetingDetailExpanded(false);
                                  setSelectedMeeting(null);
                                }}
                                activeOpacity={0.8}
                                accessibilityLabel="Collapse meeting details"
                              >
                                <Text style={styles.enterMeetingButtonText} maxFontSizeMultiplier={1.3}>
                                  Close
                                </Text>
                                <ChevronUp size={16} color="#ffffff" />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                          <View style={[styles.openMeetingTabs, { backgroundColor: theme.colors.textSecondary + '08', borderColor: theme.colors.border }]}>
                            {(['actions', 'roles', 'evaluation'] as const).map((tab) => (
                              <TouchableOpacity
                                key={tab}
                                style={[
                                  styles.openMeetingTab,
                                  openMeetingTab === tab && styles.openMeetingTabActive,
                                  openMeetingTab === tab && { backgroundColor: theme.colors.textSecondary + '15' },
                                ]}
                                onPress={() => setOpenMeetingTab(tab)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.openMeetingTabText,
                                    { color: openMeetingTab === tab ? theme.colors.text : theme.colors.textSecondary },
                                    openMeetingTab === tab ? styles.openMeetingTabTextActive : undefined,
                                  ]}
                                  maxFontSizeMultiplier={1.3}
                                >
                                  {tab === 'actions' ? 'Actions' : tab === 'roles' ? 'Roles' : 'Evaluation'}
                                </Text>
                                {openMeetingTab === tab && <View style={[styles.openMeetingTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                          <View style={styles.unifiedMeetingContent}>
                            {openMeetingTab === 'actions' && renderActionsTabContent(currentMeeting.id)}
                            {openMeetingTab === 'roles' && renderRolesTabContent(currentMeeting.id)}
                            {openMeetingTab === 'evaluation' && renderEvaluationTabContent(currentMeeting.id)}
                          </View>
                        </View>
                      ) : (
                        /* Collapsed - standalone meeting card */
                        <View style={[styles.heroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                          <View style={styles.heroCardContent}>
                            <View style={[styles.dateBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                              <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                              <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                            </View>
                            <View style={styles.heroMeetingInfo}>
                              <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{currentMeeting.meeting_title}</Text>
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                              </Text>
                              {currentMeeting.meeting_start_time && (
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Time: {formatTime(currentMeeting.meeting_start_time)}
                                  {currentMeeting.meeting_end_time && ` - ${formatTime(currentMeeting.meeting_end_time)}`}
                                </Text>
                              )}
                              <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Mode: {formatMeetingMode(currentMeeting.meeting_mode)}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.enterMeetingButton, { backgroundColor: theme.colors.primary }]}
                              onPress={() => {
                                setOpenMeetingDetailExpanded(true);
                                setSelectedMeeting(currentMeeting);
                                setOpenMeetingTab('actions');
                              }}
                              activeOpacity={0.8}
                              accessibilityLabel="Expand meeting details"
                            >
                              <Text style={styles.enterMeetingButtonText} maxFontSizeMultiplier={1.3}>Open</Text>
                              <ChevronDown size={16} color="#ffffff" />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.heroCardDecoration} />
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            ) : (
              <View style={[styles.noMeetingsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Something exciting is coming! 🚀
                </Text>
                <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Your VPE is preparing upcoming meetings.
                </Text>
                <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Stay tuned or connect with{' '}
                  <Text style={[styles.vpeName, { color: theme.colors.primary, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                    {vpeName.trim().split(/\s+/).filter(Boolean)[0] || vpeName}
                  </Text>
                  {' '}for details.
                </Text>
              </View>
            )}
          </View>

          {nextMeetings.length > 0 && (
            <>
              <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.nextMeetingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Next Meetings
            </Text>

            <View style={styles.nextMeetingsList}>
              {nextMeetings.map((meeting) => {
                const isPlaceholder = meeting.isPlaceholder;
                const meetingDate = meeting.meeting_date ? new Date(meeting.meeting_date) : new Date();
                const dayNum = meetingDate.getDate();
                const month = meetingDate.toLocaleString('default', { month: 'short' }).toUpperCase();

                return (
                  <View key={meeting.id}>
                    {isPlaceholder ? (
                      <View style={[styles.lockedHeroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                        <View style={styles.heroCardContent}>
                          <View style={[styles.comingSoonIcon, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                            <Lock size={24} color={theme.colors.textSecondary} />
                          </View>
                          <View style={styles.comingSoonContent}>
                            <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Coming Soon</Text>
                            <View style={styles.vpeContactRow}>
                              <Text style={[styles.comingSoonSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Contact VPE:{' '}
                              </Text>
                              <Text style={[styles.comingSoonSubtitle, { color: theme.colors.primary, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                                {vpeName}
                              </Text>
                              <ChevronRight size={16} color={theme.colors.primary} style={{ marginLeft: 2 }} />
                            </View>
                          </View>
                        </View>
                        <View style={styles.heroCardDecoration} />
                      </View>
                    ) : true ? (
                      /* Unified expanded box for Next Meeting */
                      <View style={[styles.unifiedExpandedMeetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                        <View style={styles.unifiedMeetingBar}>
                          <View style={styles.heroCardContent}>
                            <View style={[styles.dateBadge, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                              <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                              <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                            </View>
                            <View style={styles.heroMeetingInfo}>
                              <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{meeting.meeting_title}</Text>
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                              </Text>
                              {meeting.meeting_start_time && (
                                <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                  Time: {formatTime(meeting.meeting_start_time)}
                                  {meeting.meeting_end_time && ` - ${formatTime(meeting.meeting_end_time)}`}
                                </Text>
                              )}
                              <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Mode: {formatMeetingMode(meeting.meeting_mode)}
                              </Text>
                            </View>
                            <View style={styles.meetingActionSpacer} />
                          </View>
                        </View>
                        <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={[styles.openMeetingTabs, { backgroundColor: theme.colors.textSecondary + '08', borderColor: theme.colors.border }]}>
                          {(['actions', 'roles', 'evaluation'] as const).map((tab) => (
                            <TouchableOpacity
                              key={tab}
                              style={[
                                styles.openMeetingTab,
                                openMeetingTab === tab && styles.openMeetingTabActive,
                                openMeetingTab === tab && { backgroundColor: theme.colors.textSecondary + '15' },
                              ]}
                              onPress={() => setOpenMeetingTab(tab)}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.openMeetingTabText,
                                  { color: openMeetingTab === tab ? theme.colors.text : theme.colors.textSecondary },
                                  openMeetingTab === tab ? styles.openMeetingTabTextActive : undefined,
                                ]}
                                maxFontSizeMultiplier={1.3}
                              >
                                {tab === 'actions' ? 'Actions' : tab === 'roles' ? 'Roles' : 'Evaluation'}
                              </Text>
                              {openMeetingTab === tab && <View style={[styles.openMeetingTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={[styles.unifiedMeetingDivider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.unifiedMeetingContent}>
                          {openMeetingTab === 'actions' && renderActionsTabContent(meeting.id)}
                          {openMeetingTab === 'roles' && renderRolesTabContent(meeting.id)}
                          {openMeetingTab === 'evaluation' && renderEvaluationTabContent(meeting.id)}
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.lockedHeroMeetingCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
                        <View style={styles.heroCardContent}>
                          <View style={[styles.dateBadge, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                            <Text style={[styles.dateBadgeDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{dayNum}</Text>
                            <Text style={[styles.dateBadgeMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{month}</Text>
                          </View>
                          <View style={styles.heroMeetingInfo}>
                            <Text style={[styles.heroMeetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{meeting.meeting_title}</Text>
                            <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Day: {meetingDate.toLocaleDateString('default', { weekday: 'long' })}
                            </Text>
                            {meeting.meeting_start_time && (
                              <Text style={[styles.heroMeetingTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Time: {formatTime(meeting.meeting_start_time)}
                                {meeting.meeting_end_time && ` - ${formatTime(meeting.meeting_end_time)}`}
                              </Text>
                            )}
                            <Text style={[styles.heroMeetingMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                              Mode: {formatMeetingMode(meeting.meeting_mode)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.preplanButton, { backgroundColor: theme.colors.primary }]}
                            onPress={() => handleNextMeetingPress(meeting.id)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.preplanButtonText} maxFontSizeMultiplier={1.3}>Plan</Text>
                            <ChevronDown size={16} color="#ffffff" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.heroCardDecoration} />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
            </>
          )}

          <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.meetingHistorySection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting History
            </Text>
            <TouchableOpacity
              style={[
                styles.meetingHistoryEntryCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
              onPress={() => router.push('/meeting-history')}
              activeOpacity={0.8}
              accessibilityLabel="Open meeting history page"
            >
              <View style={[styles.comingSoonIcon, { backgroundColor: theme.colors.textSecondary + '15' }]}>
                <Clock size={22} color={theme.colors.textSecondary} />
              </View>
              <View style={styles.comingSoonContent}>
                <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {isLoading ? 'Loading meeting history…' : 'View meeting history'}
                </Text>
                <Text style={[styles.comingSoonSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {isLoading
                    ? 'Preparing completed meetings.'
                    : `${meetingHistory.length} completed meeting${meetingHistory.length === 1 ? '' : 's'} available`}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.meetingsMasterDivider, { backgroundColor: theme.colors.border }]} />
          <ClubReportsList
            theme={theme}
            onReportPress={handleFeaturePress}
            onSectionLayout={setReportsAnchorY}
          />

          </View>
        ) : (
          <View style={[styles.noClubCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  featuresGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  featureCard: {
    borderRadius: 0,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: '#e7f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  noClubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noClubIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
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
  meetingsMasterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  meetingsMasterDivider: {
    height: 1,
    marginVertical: 20,
  },
  meetingsSection: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  meetingsList: {
    gap: 16,
  },
  heroMeetingCard: {
    borderRadius: 0,
    padding: 14,
    minHeight: 84,
    overflow: 'hidden',
    position: 'relative',
  },
  heroCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    zIndex: 1,
  },
  heroCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  dateBadge: {
    width: 49,
    height: 49,
    borderRadius: 0,
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
  meetingActionSpacer: {
    width: 72,
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
    paddingHorizontal: 20,
    borderRadius: 0,
    gap: 4,
  },
  enterMeetingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  unifiedExpandedMeetingCard: {
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  unifiedMeetingBar: {
    padding: 14,
  },
  unifiedMeetingDivider: {
    height: 1,
    marginHorizontal: 0,
  },
  unifiedMeetingContent: {
    padding: 18,
  },
  meetingActionsContainer: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  meetingMasterBox: {
    padding: 20,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openMeetingTabs: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  openMeetingTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  openMeetingTabActive: {
    fontWeight: '600',
  },
  openMeetingTabText: {
    fontSize: 12,
    fontWeight: '500',
  },
  openMeetingTabTextActive: {
    fontWeight: '600',
  },
  openMeetingTabIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -16,
    width: 32,
    height: 3,
    borderRadius: 0,
  },
  rolesTabContainer: {
    paddingBottom: 8,
  },
  rolesSection: {
    marginBottom: 20,
  },
  rolesSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  rolesSectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  keyRolesList: {
    gap: 10,
  },
  keyRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyRoleCardTmodAlert: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  keyRoleAlertBadge: {
    marginRight: 4,
  },
  keyRoleIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyRoleIconAvatarRing: {
    padding: 2,
    overflow: 'hidden',
  },
  keyRoleIconAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 0,
  },
  keyRoleContent: {
    flex: 1,
  },
  keyRoleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  keyRoleSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
  speakingRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speakingRoleCard: {
    width: '30%',
    minWidth: 0,
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    position: 'relative',
  },
  speakingRoleCardAlert: {
    borderColor: PENDING_ACTION_UI.border,
    borderWidth: 1.5,
  },
  speakingRoleAlertBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  speakingRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  speakingRoleIconAvatarRing: {
    padding: 2,
    overflow: 'hidden',
  },
  speakingRoleIconAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 0,
  },
  speakingRoleTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  supportRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  supportRoleCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  supportRoleIcon: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  supportRoleIconAvatarRing: {
    padding: 2,
    overflow: 'hidden',
  },
  supportRoleIconAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 0,
  },
  supportRoleTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  evaluationTabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  evaluationCard: {
    width: '31%',
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  emptyTabState: {
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
  },
  emptyTabText: {
    fontSize: 12,
  },
  actionsTabContainer: {
    paddingBottom: 8,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  actionsSectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  actionsCardsColumn: {
    gap: 10,
    marginBottom: 10,
  },
  actionsCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  actionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardHalf: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionComingSoonBadge: {
    marginTop: 4,
  },
  actionComingSoonText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f59e0b',
  },
  actionSection: {
    marginBottom: 14,
  },
  actionSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '31%',
    padding: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    minHeight: 85,
    justifyContent: 'center',
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  actionTitle: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 11,
  },
  comingSoonBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,
    marginTop: 4,
  },
  comingSoonBadgeText: {
    fontSize: 7.5,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  noMeetingsCard: {
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  noMeetingsText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  noMeetingsSubtext: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  vpeName: {
    fontWeight: '600',
  },
  nextMeetingsSection: {
    paddingBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  nextMeetingsList: {
    gap: 16,
  },
  meetingHistorySection: {
    paddingBottom: 0,
  },
  meetingHistoryEntryCard: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    minHeight: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  lockedHeroMeetingCard: {
    borderRadius: 0,
    padding: 14,
    minHeight: 84,
    overflow: 'hidden',
    position: 'relative',
  },
  nextMeetingPlanButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 0,
  },
  nextMeetingPlanButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  lockedIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  preplanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
    gap: 4,
  },
  preplanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  lockedMeetingCard: {
    width: '48%',
    borderRadius: 0,
    padding: 20,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockedDateBadge: {
    width: 60,
    height: 60,
    borderRadius: 0,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockedDateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  lockedDateMonth: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: -2,
  },
  lockedMeetingTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  lockedMeetingTime: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockedMeetingSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  comingSoonIcon: {
    width: 60,
    height: 60,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonContent: {
    flex: 1,
    justifyContent: 'center',
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  comingSoonSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  vpeContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
 
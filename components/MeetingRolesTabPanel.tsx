import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useState, useEffect, useCallback, useRef, useMemo, type ComponentType } from 'react';
import { PENDING_ACTION_UI } from '@/lib/pendingActionUi';
import {
  MessageSquare,
  Star,
  Timer,
  ChartBar as BarChart3,
  BookOpen,
  Ear,
  BookCheck,
  Mic,
  AlertCircle,
  ChevronRight,
  Lightbulb,
} from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { MeetingFlowTab } from '@/lib/meetingTabsCatalog';

const ROLE_AVATAR_ROTATE_MS = 3000;

/** @deprecated Use MeetingFlowTab; kept for existing imports */
export type MeetingRoleTab = MeetingFlowTab;

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

function getRolePanelTabs(meetingId: string): MeetingRoleTab[] {
  return [
    {
      id: 'toastmaster_corner',
      title: 'Toastmaster of the day',
      color: '#84cc16',
      route: `/toastmaster-corner?meetingId=${meetingId}`,
    },
    {
      id: 'general_evaluator',
      title: 'General Evaluator',
      color: '#ef4444',
      route: `/general-evaluator-report?meetingId=${meetingId}`,
    },
    {
      id: 'table_topic_corner',
      title: 'Table Topic Corner',
      color: '#f97316',
      route: `/table-topic-corner?meetingId=${meetingId}`,
    },
    {
      id: 'evaluation_corner',
      title: 'Prepared Speeches',
      color: '#14b8a6',
      route: `/evaluation-corner?meetingId=${meetingId}`,
    },
    {
      id: 'educational_corner',
      title: 'Educational Corner',
      color: '#f97316',
      route: `/educational-corner?meetingId=${meetingId}`,
    },
    {
      id: 'keynote_speaker',
      title: 'Keynote Speaker',
      color: '#f59e0b',
      route: `/keynote-speaker-corner?meetingId=${meetingId}`,
    },
    {
      id: 'timer',
      title: 'Timer',
      color: '#f59e0b',
      route: `/timer-report-details?meetingId=${meetingId}`,
    },
    {
      id: 'ah_counter',
      title: 'Ah Counter',
      color: '#06b6d4',
      route: `/ah-counter-corner?meetingId=${meetingId}`,
    },
    {
      id: 'grammarian',
      title: 'Grammarian',
      color: '#8b5cf6',
      route: `/grammarian?meetingId=${meetingId}`,
    },
    {
      id: 'listener',
      title: 'Listener',
      color: '#06b6d4',
      comingSoon: true,
    },
    {
      id: 'quiz_master',
      title: 'Quiz Master',
      color: '#8b5cf6',
      comingSoon: true,
    },
  ];
}

function categorizeRoleTabs(meetingId: string) {
  const allTabs = getRolePanelTabs(meetingId);
  const byId = new Map(allTabs.map((t) => [t.id, t]));
  const take = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as MeetingRoleTab[];
  return {
    keyRoles: take(['toastmaster_corner', 'general_evaluator', 'table_topic_corner']),
    speakingRoles: take(['evaluation_corner', 'educational_corner', 'keynote_speaker']),
    supportRoles: take(['timer', 'ah_counter', 'grammarian', 'listener', 'quiz_master']),
  };
}

type SupportRowIcon = ComponentType<{ size?: number; color?: string }>;

function SpeakingRoleCardWithAlert({
  tab,
  onPress,
  showAlert,
  avatarUrls,
}: {
  tab: MeetingRoleTab;
  onPress: () => void;
  showAlert?: boolean;
  avatarUrls?: string[];
}) {
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
      withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      true
    );
    iconPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 600 }), withTiming(1, { duration: 600 })),
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
  const title =
    tab.id === 'evaluation_corner'
      ? 'Prepared Speeches'
      : tab.id === 'educational_corner'
        ? 'Educational Corner'
        : 'Keynote Speaker';
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

function SupportFullWidthRoleCardWithAlert({
  title,
  description,
  iconColor,
  SupportIcon,
  showAlert,
  comingSoon,
  onPress,
  avatarUrls,
}: {
  title: string;
  description: string;
  iconColor: string;
  SupportIcon: SupportRowIcon;
  showAlert?: boolean;
  comingSoon?: boolean;
  onPress: () => void;
  avatarUrls?: string[];
}) {
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
      withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      true
    );
    iconPulse.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 600 }), withTiming(1, { duration: 600 })),
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
          style={[styles.keyRoleIcon, styles.keyRoleIconAvatarRing, { backgroundColor: iconColor }, iconPulseStyle]}
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

function SupportHalfRoleCardWithAvatar({
  tab,
  iconColor,
  SupportIcon,
  avatarUrls,
  onPress,
  comingSoon,
}: {
  tab: MeetingRoleTab;
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
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonBadgeText} maxFontSizeMultiplier={1.2}>
            Coming Soon
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function KeyRoleCardWithTmodAlert({
  tab,
  onPress,
  showAlert,
  avatarUrls,
}: {
  tab: MeetingRoleTab;
  onPress: () => void;
  showAlert?: boolean;
  avatarUrls?: string[];
}) {
  const { theme } = useTheme();
  const { currentUri, hasPhoto, onImageError } = useRotatingRoleAvatars(avatarUrls);
  const alertScale = useSharedValue(1);
  useEffect(() => {
    if (!showAlert) {
      alertScale.value = 1;
      return;
    }
    alertScale.value = withRepeat(
      withSequence(withTiming(1.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      true
    );
  }, [showAlert]);
  const alertAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: alertScale.value }],
  }));
  const title =
    tab.id === 'toastmaster_corner'
      ? 'Toastmaster of the Day'
      : tab.id === 'general_evaluator'
        ? 'General Evaluator'
        : 'Table Topics Master';
  const subtitle =
    tab.id === 'toastmaster_corner'
      ? 'Leads meeting, introduces speakers'
      : tab.id === 'general_evaluator'
        ? 'Evaluates meeting and all roles'
        : 'Conducts impromptu speaking';
  return (
    <TouchableOpacity
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

export type MeetingRolesTabRoleUi = {
  tmodNeedsAlert?: boolean;
  educationalSpeakerNeedsAlert?: boolean;
  keynoteSpeakerNeedsAlert?: boolean;
  preparedSpeakerNeedsAlert?: boolean;
  grammarianNeedsAlert?: boolean;
  toastmasterAvatarUrls?: string[];
  generalEvaluatorAvatarUrls?: string[];
  tableTopicsMasterAvatarUrls?: string[];
  preparedSpeakerAvatarUrls?: string[];
  educationalSpeakerAvatarUrls?: string[];
  keynoteSpeakerAvatarUrls?: string[];
  timerAvatarUrls?: string[];
  ahCounterAvatarUrls?: string[];
  grammarianAvatarUrls?: string[];
};

export function MeetingRolesTabPanel({
  meetingId,
  onTabPress,
  roleUi,
}: {
  meetingId: string;
  onTabPress: (tab: MeetingRoleTab) => void;
  roleUi?: MeetingRolesTabRoleUi;
}) {
  const { theme } = useTheme();
  const { keyRoles, speakingRoles, supportRoles } = categorizeRoleTabs(meetingId);
  const tmodNeedsAlert = roleUi?.tmodNeedsAlert === true;
  const educationalSpeakerNeedsAlert = roleUi?.educationalSpeakerNeedsAlert === true;
  const keynoteSpeakerNeedsAlert = roleUi?.keynoteSpeakerNeedsAlert === true;
  const preparedSpeakerNeedsAlert = roleUi?.preparedSpeakerNeedsAlert === true;
  const grammarianNeedsAlert = roleUi?.grammarianNeedsAlert === true;

  return (
    <View style={styles.rolesTabContainer}>
      {keyRoles.length > 0 && (
        <View style={styles.rolesSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Key Roles
          </Text>
          <View style={styles.keyRolesList}>
            {keyRoles.map((tab) => (
              <KeyRoleCardWithTmodAlert
                key={tab.id}
                tab={tab}
                onPress={() => onTabPress(tab)}
                showAlert={tab.id === 'toastmaster_corner' && tmodNeedsAlert}
                avatarUrls={
                  tab.id === 'toastmaster_corner'
                    ? roleUi?.toastmasterAvatarUrls
                    : tab.id === 'general_evaluator'
                      ? roleUi?.generalEvaluatorAvatarUrls ?? []
                      : tab.id === 'table_topic_corner'
                        ? roleUi?.tableTopicsMasterAvatarUrls ?? []
                        : []
                }
              />
            ))}
          </View>
        </View>
      )}

      {speakingRoles.length > 0 && (
        <View style={styles.rolesSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Speaking Roles
          </Text>
          <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.speakingRolesGrid}>
            {speakingRoles.map((tab) => (
              <SpeakingRoleCardWithAlert
                key={tab.id}
                tab={tab}
                onPress={() => onTabPress(tab)}
                showAlert={
                  (tab.id === 'evaluation_corner' && preparedSpeakerNeedsAlert) ||
                  (tab.id === 'educational_corner' && educationalSpeakerNeedsAlert) ||
                  (tab.id === 'keynote_speaker' && keynoteSpeakerNeedsAlert)
                }
                avatarUrls={
                  tab.id === 'evaluation_corner'
                    ? roleUi?.preparedSpeakerAvatarUrls
                    : tab.id === 'educational_corner'
                      ? roleUi?.educationalSpeakerAvatarUrls
                      : tab.id === 'keynote_speaker'
                        ? roleUi?.keynoteSpeakerAvatarUrls
                        : undefined
                }
              />
            ))}
          </View>
        </View>
      )}

      {supportRoles.length > 0 && (
        <View style={styles.rolesSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Support Roles
          </Text>
          <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.supportRolesGrid}>
            {supportRoles
              .filter((t) => t.id === 'timer' || t.id === 'ah_counter')
              .map((tab) => {
                const iconColor = tab.color || '#6b7280';
                const SupportIcon = tab.id === 'timer' ? Timer : BarChart3;
                return (
                  <SupportHalfRoleCardWithAvatar
                    key={tab.id}
                    tab={tab}
                    iconColor={iconColor}
                    SupportIcon={SupportIcon}
                    avatarUrls={
                      tab.id === 'timer' ? roleUi?.timerAvatarUrls : roleUi?.ahCounterAvatarUrls
                    }
                    onPress={() => onTabPress(tab)}
                    comingSoon={!!tab.comingSoon}
                  />
                );
              })}
          </View>
          <View style={[styles.keyRolesList, { marginTop: 12 }]}>
            {supportRoles
              .filter((t) => ['grammarian', 'listener', 'quiz_master'].includes(t.id))
              .map((tab) => {
                const iconColor = tab.color || '#6b7280';
                const SupportIcon =
                  tab.id === 'grammarian' ? BookOpen : tab.id === 'listener' ? Ear : BookCheck;
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
                    onPress={() => onTabPress(tab)}
                    avatarUrls={tab.id === 'grammarian' ? roleUi?.grammarianAvatarUrls : undefined}
                  />
                );
              })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  actionComingSoonBadge: {
    marginTop: 4,
  },
  actionComingSoonText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f59e0b',
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
});

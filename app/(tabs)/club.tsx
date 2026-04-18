import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Clock,
  Clock3,
  Globe,
  Link as LinkIcon,
  Instagram,
  Lightbulb,
  Linkedin,
  MessageCircle,
  Mic2,
  ChevronLeft,
  ChevronRight,
  Facebook,
  MapPin,
  RotateCcw,
  Twitter,
  Star,
  Users,
  Youtube,
} from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClubInfoManagementBundle, ClubSocialUrlsRow } from '@/lib/clubInfoManagementQuery';
import {
  fetchClubLandingCritical,
  getCachedClubLandingCritical,
  type ExcommPreviewRow,
  type MemberPreview,
  type MemberPreviewClubRole,
} from '@/lib/clubTabLandingData';
import { DEFAULT_TOASTMASTERS_CLUB_MISSION } from '@/lib/defaultClubMission';
import { avatarUrlForDisplay } from '@/lib/avatarDisplayUrl';
import { initialsFromName, useShouldLoadNetworkAvatars } from '@/lib/networkAvatarPolicy';

/** Web: defer offscreen images; async decode. Native: no-op spread. */
function webImageExtra(lazy: boolean): Record<string, string> {
  if (Platform.OS !== 'web') return {};
  return { loading: lazy ? 'lazy' : 'eager', decoding: 'async' };
}

const EXCOMM_CAROUSEL_MS = 3000;
const MEMBERS_CAROUSEL_MS = 2000;
const ED_SPEECH_CAROUSEL_MS = 3500;
/** Word of the day: cycle published entries from last 6 months */
/** Club FAQ: one Q&A visible, advance every 3s */
const CLUB_FAQ_CAROUSEL_MS = 3000;
/** Rolling window for published quote & idiom carousels (calendar days) */
const GRAMMARIAN_PUBLISHED_LOOKBACK_DAYS = 180;

/** Club page design system — white-first, Notion-style (spec) */
const C = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  cta: '#111111',
  chipBg: '#F3F4F6',
  tileBg: '#FAFAFA',
};

const WHY_JOIN_ITEMS = [
  { icon: '🎤', title: 'Public Speaking', desc: 'Master confident and effective communication.' },
  { icon: '👥', title: 'Leadership Skills', desc: 'Learn to lead, inspire and influence others.' },
  { icon: '🚀', title: 'Maximise Your Potential', desc: 'Unlock your full capabilities.' },
  { icon: '🤝', title: 'Networking', desc: 'Build meaningful connections.' },
  { icon: '🏆', title: 'Competitive Advantage', desc: 'Stand out professionally.' },
  { icon: '💪', title: 'Self-Confidence', desc: 'Grow your confidence and self-awareness.' },
];

type ClubFaqHeroRow = {
  id: string;
  question: string;
  answer: string;
};

function previewRoleLabel(cr: MemberPreviewClubRole): string {
  switch (cr) {
    case 'visiting_tm':
      return 'Visiting Toastmaster';
    case 'guest':
      return 'Guest';
    default:
      return 'Member';
  }
}

function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^mailto:/i.test(t)) return t;
  if (t.startsWith('wa.me/')) return `https://${t}`;
  return `https://${t.replace(/^\/+/, '')}`;
}

function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return time;
}

function formatMeetingMode(mode: string | null | undefined): string | null {
  if (!mode) return null;
  switch (mode) {
    case 'in_person':
      return 'In person';
    case 'online':
      return 'Online';
    case 'hybrid':
      return 'Hybrid';
    default:
      return mode;
  }
}

function formatMeetingFrequency(frequency: string | null | undefined): string | null {
  if (!frequency) return null;
  if (frequency === 'Bi-weekly') return 'Fortnightly';
  return frequency;
}

function formatMeetingDuration(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const [sh = 0, sm = 0] = start.split(':').map(Number);
  const [eh = 0, em = 0] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  minutes %= 60;
  if (hours > 0 && minutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
}

function formatCharterDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return null;
  }
}

function normalizeBannerColor(raw: string | null | undefined): string | null {
  const value = (raw || '').trim();
  if (!value) return null;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : null;
}

function socialIconForKey(key: string) {
  switch (key) {
    case 'web':
      return Globe;
    case 'wa':
      return MessageCircle;
    case 'fb':
      return Facebook;
    case 'ig':
      return Instagram;
    case 'li':
      return Linkedin;
    case 'x':
      return Twitter;
    case 'yt':
      return Youtube;
    default:
      return LinkIcon;
  }
}

async function openUrl(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert('Unable to open link', 'This URL cannot be opened on your device.');
  } catch {
    Alert.alert('Error', 'Could not open the link.');
  }
}

function ExcommCarouselCard({
  rows,
  onSeeAll,
  variant = 'card',
}: {
  rows: ExcommPreviewRow[];
  onSeeAll: () => void;
  variant?: 'card' | 'notion';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    slideX.setValue(0);
  }, [rows, opacity, slideX]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideX, {
          toValue: -36,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        slideX.setValue(36);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(slideX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, EXCOMM_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      slideX.stopAnimation();
    };
  }, [rows.length, opacity, slideX]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];

  return (
    <View style={variant === 'notion' ? undefined : styles.card}>
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInRow]} maxFontSizeMultiplier={1.2}>
          Executive committee
        </Text>
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
          <Text style={styles.textLinkSmall} maxFontSizeMultiplier={1.1}>
            See all
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.excommSlide,
          {
            opacity,
            transform: [{ translateX: slideX }],
          },
        ]}
      >
        <Text style={styles.excommRole} maxFontSizeMultiplier={1.1}>
          {row.title}
        </Text>
        {shouldLoadAvatars && row.member.avatar_url ? (
          <Image
            source={{
              uri: avatarUrlForDisplay(row.member.avatar_url, 160) ?? row.member.avatar_url,
            }}
            style={styles.excommAvatar}
            resizeMode="cover"
            {...webImageExtra(false)}
          />
        ) : (
          <View style={[styles.excommAvatar, styles.excommAvatarPlaceholder]}>
            <Text style={styles.excommInitial} maxFontSizeMultiplier={1.2}>
              {(row.member.full_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.excommName} maxFontSizeMultiplier={1.15}>
          {row.member.full_name}
        </Text>
      </Animated.View>

      {rows.length > 1 ? (
        <View style={styles.excommDots}>
          {rows.map((r, i) => (
            <View
              key={r.key}
              style={[styles.excommDot, i === safeIndex && styles.excommDotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MembersCarouselCard({
  rows,
  onViewAll,
  onViewMember,
  variant = 'card',
}: {
  rows: MemberPreview[];
  onViewAll: () => void;
  onViewMember: (memberId: string) => void;
  variant?: 'card' | 'notion';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const pageCount = Math.ceil(rows.length / 2);
  const [pairIndex, setPairIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const slideY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const pageCountRef = useRef(pageCount);
  pageCountRef.current = pageCount;

  useEffect(() => {
    setPairIndex(0);
    opacity.setValue(1);
    slideY.setValue(0);
    scale.setValue(1);
  }, [rows, opacity, slideY, scale]);

  useEffect(() => {
    if (pageCount <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideY, {
          toValue: -28,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setPairIndex((i) => (i + 1) % pageCountRef.current);
        slideY.setValue(32);
        scale.setValue(0.96);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideY, {
            toValue: 0,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, MEMBERS_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      slideY.stopAnimation();
      scale.stopAnimation();
    };
  }, [pageCount, opacity, slideY, scale]);

  if (!rows.length) return null;

  const safePair = Math.min(pairIndex, pageCount - 1);
  const left = rows[safePair * 2];
  const right = rows[safePair * 2 + 1];

  const renderTile = (m: MemberPreview | undefined) => {
    if (!m) {
      return <View style={[styles.memberTileFlex, styles.memberPairSpacer]} />;
    }
    const notion = variant === 'notion';
    return (
      <View
        style={[
          styles.memberTile,
          notion && styles.memberTileNotion,
          styles.memberTileFlex,
          { backgroundColor: C.tileBg },
        ]}
      >
        {shouldLoadAvatars && m.avatar_url ? (
          <Image
            source={{ uri: avatarUrlForDisplay(m.avatar_url, 112) ?? m.avatar_url }}
            style={styles.memberAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.memberAvatar, styles.memberAvatarPh]}>
            <Text style={styles.memberInitial} maxFontSizeMultiplier={1.2}>
              {(m.full_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.memberName} numberOfLines={2} maxFontSizeMultiplier={1.1}>
          {m.full_name}
        </Text>
        <Text style={styles.memberRoleTag} maxFontSizeMultiplier={1.05}>
          {previewRoleLabel(m.clubRole)}
        </Text>
        <TouchableOpacity
          style={[styles.memberViewBtn, notion && styles.memberViewBtnNotion]}
          onPress={() => onViewMember(m.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.memberViewBtnText} maxFontSizeMultiplier={1.05}>
            View
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={variant === 'notion' ? undefined : styles.card}>
      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInRow]} maxFontSizeMultiplier={1.2}>
          Members
        </Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={styles.textLinkSmall} maxFontSizeMultiplier={1.1}>
            View all
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.memberPairSlide,
          {
            opacity,
            transform: [{ translateY: slideY }, { scale }],
          },
        ]}
      >
        <View style={styles.memberPairRow}>{renderTile(left)}{renderTile(right)}</View>
      </Animated.View>

      {pageCount > 1 ? (
        <View style={styles.excommDots}>
          {Array.from({ length: pageCount }, (_, i) => (
            <View key={i} style={[styles.excommDot, i === safePair && styles.excommDotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ClubStatsCounts = {
  speeches: number;
  educationalSpeeches: number;
  tableTopicSpeeches: number;
  meetingsConducted: number;
  themes: number;
  evaluations: number;
};

const CLUB_STATS_PERIOD_OPTIONS = [
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 180, label: 'Last 180 days' },
  { days: 365, label: 'Last 1 year' },
] as const;

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function meetingDateRangeRollingDays(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return { from: formatLocalYmd(from), to: formatLocalYmd(to) };
}

async function countThemesForMeetings(clubId: string, meetingIds: string[]): Promise<number> {
  if (meetingIds.length === 0) return 0;
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < meetingIds.length; i += CHUNK) {
    const chunk = meetingIds.slice(i, i + CHUNK);
    const { count, error } = await supabase
      .from('toastmaster_meeting_data')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .in('meeting_id', chunk)
      .not('theme_of_the_day', 'is', null)
      .neq('theme_of_the_day', '');
    if (error) {
      console.warn('Club stats theme count:', error.message);
      continue;
    }
    total += count ?? 0;
  }
  return total;
}

/** Club-wide counts from completed roles / meetings in the rolling last `daysBack` calendar days. */
async function fetchClubStatsRollingDays(clubId: string, daysBack: number): Promise<ClubStatsCounts> {
  const empty: ClubStatsCounts = {
    speeches: 0,
    educationalSpeeches: 0,
    tableTopicSpeeches: 0,
    meetingsConducted: 0,
    themes: 0,
    evaluations: 0,
  };

  try {
    const { from: meetingDateStart, to: meetingDateEnd } = meetingDateRangeRollingDays(daysBack);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - daysBack);
    const rolesCreatedAtGte = start.toISOString();

    const rolesBase = () =>
      supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_completed', true)
        .gte('created_at', rolesCreatedAtGte);

    const [speechesR, edR, ttR, evalR, meetingsInRangeR] = await Promise.all([
      rolesBase().eq('role_classification', 'Prepared Speaker'),
      rolesBase().eq('role_classification', 'Educational speaker'),
      rolesBase().eq('role_classification', 'On-the-Spot Speaking'),
      rolesBase().in('role_classification', ['Speech evaluvator', 'Master evaluvator', 'speech_evaluator']),
      supabase
        .from('app_club_meeting')
        .select('id')
        .eq('club_id', clubId)
        .gte('meeting_date', meetingDateStart)
        .lte('meeting_date', meetingDateEnd),
    ]);

    if (speechesR.error) console.warn('Club stats speeches:', speechesR.error.message);
    if (edR.error) console.warn('Club stats educational:', edR.error.message);
    if (ttR.error) console.warn('Club stats table topics:', ttR.error.message);
    if (evalR.error) console.warn('Club stats evaluations:', evalR.error.message);
    if (meetingsInRangeR.error) console.warn('Club stats meetings list:', meetingsInRangeR.error.message);

    const meetingIds =
      !meetingsInRangeR.error && meetingsInRangeR.data?.length
        ? meetingsInRangeR.data.map((r) => r.id)
        : [];
    const meetingsConducted = meetingsInRangeR.error ? 0 : (meetingsInRangeR.data?.length ?? 0);
    const themes = meetingsInRangeR.error ? 0 : await countThemesForMeetings(clubId, meetingIds);

    return {
      speeches: speechesR.error ? 0 : (speechesR.count ?? 0),
      educationalSpeeches: edR.error ? 0 : (edR.count ?? 0),
      tableTopicSpeeches: ttR.error ? 0 : (ttR.count ?? 0),
      meetingsConducted,
      themes,
      evaluations: evalR.error ? 0 : (evalR.count ?? 0),
    };
  } catch (e) {
    console.warn('Club stats load error:', e);
    return empty;
  }
}

type GrammarianPublishedCarouselRow = {
  id: string;
  lead: string;
  meaning: string | null;
  usage: string | null;
  meetingDateLabel: string;
  addedBy: string | null;
};

/** Published quotes for meetings in the rolling last N calendar days (newest first). */
async function fetchPublishedClubQuotesRollingDays(
  clubId: string,
  daysBack: number
): Promise<GrammarianPublishedCarouselRow[]> {
  try {
    const { from, to } = meetingDateRangeRollingDays(daysBack);
    const { data, error } = await supabase
      .from('grammarian_quote_of_the_day')
      .select('*, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);
    if (error || !data?.length) {
      if (error) console.warn('Club quotes of the day:', error.message);
      return [];
    }
    const rows = ((data as Array<Record<string, any>> | null) ?? []);
    const meetingDateOf = (r: Record<string, any>) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };
    const authorById = await mapRowAuthorsById(rows);
    const mapped = rows
      .map((r) => {
        const md = meetingDateOf(r);
        if (md < from || md > to) return null;
        const lead = (r.quote ?? '').trim();
        if (!lead) return null;
        const rawUsage = (r as { usage?: string | null }).usage;
        const usageStr = typeof rawUsage === 'string' ? rawUsage.trim() : '';
        return {
          id: r.id,
          lead,
          meaning: ((r.meaning ?? '').trim()) || null,
          usage: usageStr || null,
          addedBy: authorById.get(String(r.id)) ?? null,
          meetingDateRaw: md,
          meetingDateLabel: formatCharterDateShort(md) || md || '—',
        };
      })
      .filter(Boolean) as Array<GrammarianPublishedCarouselRow & { meetingDateRaw: string }>;
    mapped.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return mapped.map(({ meetingDateRaw: _x, ...rest }) => rest);
  } catch (e) {
    console.warn('Club quotes carousel load error:', e);
    return [];
  }
}

/** Published idioms for meetings in the rolling last N calendar days (newest first). */
async function fetchPublishedClubIdiomsRollingDays(
  clubId: string,
  daysBack: number
): Promise<GrammarianPublishedCarouselRow[]> {
  try {
    const { from, to } = meetingDateRangeRollingDays(daysBack);
    const { data, error } = await supabase
      .from('grammarian_idiom_of_the_day')
      .select('*, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);
    if (error || !data?.length) {
      if (error) console.warn('Club idioms of the day:', error.message);
      return [];
    }
    const rows = ((data as Array<Record<string, any>> | null) ?? []);
    const meetingDateOf = (r: Record<string, any>) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };
    const authorById = await mapRowAuthorsById(rows);
    const mapped = rows
      .map((r) => {
        const md = meetingDateOf(r);
        if (md < from || md > to) return null;
        const lead = (r.idiom ?? '').trim();
        if (!lead) return null;
        const rawUsage = (r as { usage?: string | null }).usage;
        const usageStr = typeof rawUsage === 'string' ? rawUsage.trim() : '';
        return {
          id: r.id,
          lead,
          meaning: ((r.meaning ?? '').trim()) || null,
          usage: usageStr || null,
          addedBy: authorById.get(String(r.id)) ?? null,
          meetingDateRaw: md,
          meetingDateLabel: formatCharterDateShort(md) || md || '—',
        };
      })
      .filter(Boolean) as Array<GrammarianPublishedCarouselRow & { meetingDateRaw: string }>;
    mapped.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return mapped.map(({ meetingDateRaw: _x, ...rest }) => rest);
  } catch (e) {
    console.warn('Club idioms carousel load error:', e);
    return [];
  }
}

type ClubWotdCarouselRow = {
  id: string;
  word: string;
  meaning: string | null;
  partOfSpeech: string | null;
  usage: string | null;
  meetingDateLabel: string;
  addedBy: string | null;
};

type ClubTableTopicQuestionRow = {
  id: string;
  question: string;
  createdAt: string;
  meetingDateLabel: string;
  addedBy: string | null;
};

type GeneralEvaluatorScoringRow = {
  key: string;
  evaluatorName: string;
  evaluatorAvatarUrl: string | null;
  meetingDateRaw: string;
  meetingDateLabel: string;
  meetingNumber: string | null;
  score: number | null;
  overallScoreTotal: number | null;
  overallScoreMax: number | null;
};

type TimerMeetingWiseRow = {
  key: string;
  meetingDateRaw: string;
  meetingDateLabel: string;
  meetingNumber: string | null;
  timerName: string;
  timerAvatarUrl: string | null;
  categoryStats: Array<{
    key: 'prepared_speeches' | 'evaluation' | 'table_topic_speakers' | 'educational_speech';
    label: string;
    qualified: number;
    total: number;
  }>;
};

type AhCounterMeetingWiseRow = {
  key: string;
  meetingDateRaw: string;
  meetingDateLabel: string;
  meetingNumber: string | null;
  ahCounterName: string;
  ahCounterAvatarUrl: string | null;
  words: Array<{ label: string; count: number }>;
};

async function mapRowAuthorsById(
  rows: Array<Record<string, any>>,
  idKeys: string[] = ['grammarian_user_id', 'created_by', 'user_id', 'added_by', 'asked_by'],
  nameKeys: string[] = ['added_by_name', 'asked_by_name', 'created_by_name']
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const userIds = new Set<string>();

  for (const row of rows) {
    for (const key of nameKeys) {
      const value = row?.[key];
      if (typeof value === 'string' && value.trim()) {
        result.set(String(row.id), value.trim());
        break;
      }
    }
    if (!result.has(String(row.id))) {
      for (const key of idKeys) {
        const id = row?.[key];
        if (typeof id === 'string' && id.trim()) {
          userIds.add(id.trim());
          break;
        }
      }
    }
  }

  if (userIds.size) {
    const { data } = await supabase
      .from('app_user_profiles')
      .select('id, full_name')
      .in('id', Array.from(userIds));
    const profileNameById = new Map(((data as Array<{ id: string; full_name: string | null }> | null) ?? [])
      .map((p) => [p.id, (p.full_name ?? '').trim()]));

    for (const row of rows) {
      if (result.has(String(row.id))) continue;
      for (const key of idKeys) {
        const id = row?.[key];
        if (typeof id === 'string' && id.trim()) {
          const name = profileNameById.get(id.trim());
          if (name) result.set(String(row.id), name);
          break;
        }
      }
    }
  }

  return result;
}

/** Published words of the day for meetings in the rolling last 6 calendar months (newest meeting first). */
async function fetchPublishedClubWordsLast6Months(clubId: string): Promise<ClubWotdCarouselRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data, error } = await supabase
      .from('grammarian_word_of_the_day')
      .select('*, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);

    if (error || !data?.length) {
      if (error) console.warn('Club words of the day:', error.message);
      return [];
    }

    const rows = ((data as Array<Record<string, any>> | null) ?? []);
    const meetingDateOf = (r: Record<string, any>) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };

    const authorById = await mapRowAuthorsById(rows);
    const mapped = rows
      .map((r) => {
        const md = meetingDateOf(r);
        if (md < meetingDateStart || md > meetingDateEnd) return null;
        const word = (r.word ?? '').trim();
        if (!word) return null;
        const rawUsage = (r as { usage?: string | null }).usage;
        const usageStr = typeof rawUsage === 'string' ? rawUsage.trim() : '';
        return {
          id: r.id,
          word,
          meaning: ((r.meaning ?? '').trim()) || null,
          partOfSpeech: ((r.part_of_speech ?? '').trim()) || null,
          usage: usageStr || null,
          addedBy: authorById.get(String(r.id)) ?? null,
          meetingDateRaw: md,
          meetingDateLabel: formatCharterDateShort(md) || md || '—',
        };
      })
      .filter(Boolean) as Array<
        ClubWotdCarouselRow & { meetingDateRaw: string }
      >;

    mapped.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return mapped.map(({ meetingDateRaw: _d, ...rest }) => rest);
  } catch (e) {
    console.warn('Club words of the day load error:', e);
    return [];
  }
}

async function fetchClubTableTopicQuestions(clubId: string): Promise<ClubTableTopicQuestionRow[]> {
  try {
    const { data, error } = await supabase
      .from('app_meeting_tabletopicscorner')
      .select('*')
      .eq('club_id', clubId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data?.length) {
      if (error) console.warn('Club table topic questions:', error.message);
      return [];
    }

    const rows = (data as Array<{
      id: string;
      question_text: string | null;
      created_at: string | null;
      created_by?: string | null;
      user_id?: string | null;
      added_by?: string | null;
      asked_by?: string | null;
      asked_by_name?: string | null;
    }> | null) ?? [];
    const authorById = await mapRowAuthorsById(rows as Array<Record<string, any>>);

    return rows
      .map((r) => {
        const question = (r.question_text ?? '').trim();
        if (!question) return null;
        const createdAt = r.created_at ?? '';
        return {
          id: r.id,
          question,
          createdAt,
          meetingDateLabel: formatCharterDateShort(createdAt) || '—',
          addedBy: authorById.get(String(r.id)) ?? null,
        };
      })
      .filter(Boolean) as ClubTableTopicQuestionRow[];
  } catch (e) {
    console.warn('Club table topic questions load error:', e);
    return [];
  }
}

function normalizeGeTenPoint(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  if (rounded >= 1 && rounded <= 10) return rounded;
  if (rounded >= 0 && rounded <= 9) return rounded + 1;
  return null;
}

function geTenPointToStars(score: number | null | undefined): number {
  if (score == null || typeof score !== 'number' || !Number.isFinite(score)) return 0;
  const s = Math.max(1, Math.min(10, score));
  return s / 2;
}

function GeFiveStarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  const clamped = Math.min(5, Math.max(0, rating));
  return (
    <View style={styles.geStarRow}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.min(1, Math.max(0, clamped - i));
        return (
          <View key={i} style={{ width: size, height: size }} collapsable={false}>
            <View style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}>
              <Star
                size={size}
                color="#D1D5DB"
                fill="none"
                stroke="#D1D5DB"
                strokeWidth={1.2}
              />
            </View>
            {fill > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: size * fill,
                  height: size,
                  overflow: 'hidden',
                }}
              >
                <Star
                  size={size}
                  color="#F59E0B"
                  fill="#FBBF24"
                  stroke="#F59E0B"
                  strokeWidth={1}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

async function fetchGeneralEvaluatorScoringLast6Months(
  clubId: string
): Promise<GeneralEvaluatorScoringRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data, error } = await supabase
      .from('app_meeting_ge')
      .select('id, meeting_id, evaluator_user_id, evaluation_data, submitted_at, created_at, is_completed')
      .eq('club_id', clubId)
      .eq('booking_status', 'booked')
      .eq('is_completed', true)
      .limit(200);

    if (error || !data?.length) {
      if (error) console.warn('GE scoring load:', error.message);
      return [];
    }

    const geRows = (data as Array<{
      id: string;
      meeting_id: string;
      evaluator_user_id: string;
      evaluation_data: Record<string, unknown> | null;
      submitted_at: string | null;
      created_at: string | null;
      is_completed: boolean | null;
    }> | null) ?? [];
    if (!geRows.length) return [];

    const meetingIds = [...new Set(geRows.map((r) => r.meeting_id).filter(Boolean))];
    const evaluatorIds = [...new Set(geRows.map((r) => r.evaluator_user_id).filter(Boolean))];

    const [meetingsRes, profilesRes] = await Promise.all([
      supabase
        .from('app_club_meeting')
        .select('id, meeting_date, meeting_number')
        .in('id', meetingIds),
      supabase
        .from('app_user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', evaluatorIds),
    ]);

    if (meetingsRes.error) {
      console.warn('GE scoring meetings load:', meetingsRes.error.message);
      return [];
    }
    if (profilesRes.error) {
      console.warn('GE scoring profiles load:', profilesRes.error.message);
    }

    const meetings = (meetingsRes.data as Array<{
      id: string;
      meeting_date: string;
      meeting_number: string | null;
    }> | null) ?? [];
    const profiles = (profilesRes.data as Array<{
      id: string;
      full_name: string;
      avatar_url: string | null;
    }> | null) ?? [];

    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const rows: GeneralEvaluatorScoringRow[] = [];
    for (const ge of geRows) {
      const meeting = meetingById.get(ge.meeting_id);
      if (!meeting) continue;
      if (meeting.meeting_date < meetingDateStart || meeting.meeting_date > meetingDateEnd) continue;

      const evalData =
        ge.evaluation_data && typeof ge.evaluation_data === 'object'
          ? (ge.evaluation_data as Record<string, unknown>)
          : {};
      const normalizedValues = Object.values(evalData)
        .map((v) => normalizeGeTenPoint(v))
        .filter((v): v is number => typeof v === 'number');
      const total = normalizedValues.reduce((sum, n) => sum + n, 0);
      const max = normalizedValues.length * 10;
      const score = normalizeGeTenPoint(evalData.q10_overall_experience);

      const prof = profileById.get(ge.evaluator_user_id);
      rows.push({
        key: ge.id,
        evaluatorName: prof?.full_name?.trim() || 'General Evaluator',
        evaluatorAvatarUrl: prof?.avatar_url ?? null,
        meetingDateRaw: meeting.meeting_date,
        meetingDateLabel: formatCharterDateShort(meeting.meeting_date) || meeting.meeting_date || '—',
        meetingNumber: meeting.meeting_number ?? null,
        score,
        overallScoreTotal: max > 0 ? total : null,
        overallScoreMax: max > 0 ? max : null,
      });
    }

    rows.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return rows.slice(0, 40);
  } catch (e) {
    console.warn('GE scoring load error:', e);
    return [];
  }
}

async function fetchTimerMeetingWiseLast6Months(clubId: string): Promise<TimerMeetingWiseRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data, error } = await supabase
      .from('timer_reports')
      .select('id, meeting_id, recorded_by, speech_category, time_qualification')
      .eq('club_id', clubId)
      .limit(800);
    if (error || !data?.length) {
      if (error) console.warn('Timer report load:', error.message);
      return [];
    }

    const timerRows = (data as Array<{
      id: string;
      meeting_id: string;
      recorded_by: string;
      speech_category: string;
      time_qualification: boolean;
    }> | null) ?? [];
    if (!timerRows.length) return [];

    const meetingIds = [...new Set(timerRows.map((r) => r.meeting_id).filter(Boolean))];
    const timerUserIds = [...new Set(timerRows.map((r) => r.recorded_by).filter(Boolean))];

    const [meetingsRes, profilesRes] = await Promise.all([
      supabase
        .from('app_club_meeting')
        .select('id, meeting_date, meeting_number')
        .in('id', meetingIds),
      supabase
        .from('app_user_profiles')
        .select('id, full_name, avatar_url')
        .in('id', timerUserIds),
    ]);
    if (meetingsRes.error) {
      console.warn('Timer meetings load:', meetingsRes.error.message);
      return [];
    }
    if (profilesRes.error) {
      console.warn('Timer profiles load:', profilesRes.error.message);
    }

    const meetings = (meetingsRes.data as Array<{
      id: string;
      meeting_date: string;
      meeting_number: string | null;
    }> | null) ?? [];
    const profiles = (profilesRes.data as Array<{
      id: string;
      full_name: string;
      avatar_url: string | null;
    }> | null) ?? [];
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const grouped = new Map<
      string,
      {
        meetingDateRaw: string;
        meetingDateLabel: string;
        meetingNumber: string | null;
        timerName: string;
        timerAvatarUrl: string | null;
        categoryStats: TimerMeetingWiseRow['categoryStats'];
      }
    >();

    const emptyCategoryStats = (): TimerMeetingWiseRow['categoryStats'] => [
      { key: 'prepared_speeches', label: 'Prepared speeches', qualified: 0, total: 0 },
      { key: 'evaluation', label: 'Evaluation', qualified: 0, total: 0 },
      { key: 'table_topic_speakers', label: 'Table topic speakers', qualified: 0, total: 0 },
      { key: 'educational_speech', label: 'Educational speech', qualified: 0, total: 0 },
    ];
    const mapCategoryKey = (
      raw: string
    ): 'prepared_speeches' | 'evaluation' | 'table_topic_speakers' | 'educational_speech' | null => {
      const v = (raw || '').trim().toLowerCase();
      if (v === 'prepared_speech' || v === 'prepared_speeches' || v === 'prepared speech') {
        return 'prepared_speeches';
      }
      if (v === 'evaluation' || v === 'evaluations') return 'evaluation';
      if (v === 'table_topic_speaker' || v === 'table_topic_speakers' || v === 'table topic speaker') {
        return 'table_topic_speakers';
      }
      if (v === 'educational_session' || v === 'educational_speech' || v === 'educational speech') {
        return 'educational_speech';
      }
      return null;
    };

    for (const row of timerRows) {
      const meeting = meetingById.get(row.meeting_id);
      if (!meeting) continue;
      if (meeting.meeting_date < meetingDateStart || meeting.meeting_date > meetingDateEnd) continue;
      const prof = profileById.get(row.recorded_by);
      const bucket = grouped.get(row.meeting_id);
      if (!bucket) {
        grouped.set(row.meeting_id, {
          meetingDateRaw: meeting.meeting_date,
          meetingDateLabel: formatCharterDateShort(meeting.meeting_date) || meeting.meeting_date || '—',
          meetingNumber: meeting.meeting_number ?? null,
          timerName: prof?.full_name?.trim() || 'Timer',
          timerAvatarUrl: prof?.avatar_url ?? null,
          categoryStats: emptyCategoryStats(),
        });
      }
      const target = grouped.get(row.meeting_id);
      if (!target) continue;
      const categoryKey = mapCategoryKey(row.speech_category);
      if (!categoryKey) continue;
      const slot = target.categoryStats.find((s) => s.key === categoryKey);
      if (!slot) continue;
      slot.total += 1;
      if (row.time_qualification) slot.qualified += 1;
    }

    const result: TimerMeetingWiseRow[] = Array.from(grouped.entries()).map(([meetingId, val]) => ({
      key: meetingId,
      ...val,
    }));
    result.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return result.slice(0, 40);
  } catch (e) {
    console.warn('Timer report meeting-wise load error:', e);
    return [];
  }
}

async function fetchAhCounterMeetingWiseLast6Months(clubId: string): Promise<AhCounterMeetingWiseRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data: meetingsInRange, error: meetingsErr } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_date, meeting_number')
      .eq('club_id', clubId)
      .gte('meeting_date', meetingDateStart)
      .lte('meeting_date', meetingDateEnd)
      .order('meeting_date', { ascending: false })
      .limit(200);
    if (meetingsErr || !meetingsInRange?.length) {
      if (meetingsErr) console.warn('Ah counter meetings range load:', meetingsErr.message);
      return [];
    }

    const meetings = (meetingsInRange as Array<{
      id: string;
      meeting_date: string;
      meeting_number: string | null;
    }> | null) ?? [];
    const meetingIds = meetings.map((m) => m.id);

    const { data: publishedRows, error: publishedErr } = await supabase
      .from('ah_counter_reports')
      .select(
        'id, meeting_id, recorded_by, is_published, um_count, uh_count, ah_count, er_count, hmm_count, like_count, so_count, well_count, okay_count, you_know_count, right_count, actually_count, basically_count, literally_count, i_mean_count, you_see_count, custom_filler_counts'
      )
      .in('meeting_id', meetingIds)
      .eq('is_published', true)
      .limit(1200);
    if (publishedErr) {
      console.warn('Ah counter published rows load:', publishedErr.message);
    }

    let rows = (publishedRows as Array<Record<string, any>> | null) ?? [];
    if (!rows.length) {
      // Fallback: some legacy rows may not have is_published set correctly.
      const { data: fallbackRows, error: fallbackErr } = await supabase
        .from('ah_counter_reports')
        .select(
          'id, meeting_id, recorded_by, is_published, um_count, uh_count, ah_count, er_count, hmm_count, like_count, so_count, well_count, okay_count, you_know_count, right_count, actually_count, basically_count, literally_count, i_mean_count, you_see_count, custom_filler_counts'
        )
        .in('meeting_id', meetingIds)
        .limit(1200);
      if (fallbackErr) {
        console.warn('Ah counter fallback rows load:', fallbackErr.message);
        return [];
      }
      rows = (fallbackRows as Array<Record<string, any>> | null) ?? [];
    }
    if (!rows.length) return [];

    const userIds = [...new Set(rows.map((r) => String(r.recorded_by || '')).filter(Boolean))];
    const { data: profilesData, error: profilesErr } = await supabase
      .from('app_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    if (profilesErr) {
      console.warn('Ah counter profiles load:', profilesErr.message);
    }
    const profiles = (profilesData as Array<{ id: string; full_name: string; avatar_url: string | null }> | null) ?? [];
    const meetingById = new Map(meetings.map((m) => [m.id, m]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const fillerDefs: Array<{ key: string; label: string }> = [
      { key: 'um_count', label: 'Um' },
      { key: 'uh_count', label: 'Uh' },
      { key: 'ah_count', label: 'Ah' },
      { key: 'er_count', label: 'Er' },
      { key: 'hmm_count', label: 'Hmm' },
      { key: 'like_count', label: 'Like' },
      { key: 'so_count', label: 'So' },
      { key: 'well_count', label: 'Well' },
      { key: 'okay_count', label: 'Okay' },
      { key: 'you_know_count', label: 'You know' },
      { key: 'right_count', label: 'Right' },
      { key: 'actually_count', label: 'Actually' },
      { key: 'basically_count', label: 'Basically' },
      { key: 'literally_count', label: 'Literally' },
      { key: 'i_mean_count', label: 'I mean' },
      { key: 'you_see_count', label: 'You see' },
    ];

    const grouped = new Map<
      string,
      {
        meetingDateRaw: string;
        meetingDateLabel: string;
        meetingNumber: string | null;
        ahCounterName: string;
        ahCounterAvatarUrl: string | null;
        wordsMap: Map<string, number>;
      }
    >();

    for (const row of rows) {
      const meetingId = String(row.meeting_id || '');
      if (!meetingId) continue;
      const meeting = meetingById.get(meetingId);
      if (!meeting) continue;

      const prof = profileById.get(String(row.recorded_by || ''));
      if (!grouped.has(meetingId)) {
        grouped.set(meetingId, {
          meetingDateRaw: meeting.meeting_date,
          meetingDateLabel: formatCharterDateShort(meeting.meeting_date) || meeting.meeting_date || '—',
          meetingNumber: meeting.meeting_number ?? null,
          ahCounterName: prof?.full_name?.trim() || 'Ah Counter',
          ahCounterAvatarUrl: prof?.avatar_url ?? null,
          wordsMap: new Map<string, number>(),
        });
      }
      const bucket = grouped.get(meetingId);
      if (!bucket) continue;

      for (const def of fillerDefs) {
        const c = typeof row[def.key] === 'number' ? row[def.key] : 0;
        if (c > 0) bucket.wordsMap.set(def.label, (bucket.wordsMap.get(def.label) ?? 0) + c);
      }
      const custom = row.custom_filler_counts;
      if (custom && typeof custom === 'object') {
        for (const [k, v] of Object.entries(custom)) {
          const n = typeof v === 'number' ? v : 0;
          if (n <= 0) continue;
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
          bucket.wordsMap.set(label, (bucket.wordsMap.get(label) ?? 0) + n);
        }
      }
    }

    const out: AhCounterMeetingWiseRow[] = Array.from(grouped.entries()).map(([meetingId, g]) => ({
      key: meetingId,
      meetingDateRaw: g.meetingDateRaw,
      meetingDateLabel: g.meetingDateLabel,
      meetingNumber: g.meetingNumber,
      ahCounterName: g.ahCounterName,
      ahCounterAvatarUrl: g.ahCounterAvatarUrl,
      words: Array.from(g.wordsMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    }));
    out.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return out.slice(0, 40);
  } catch (e) {
    console.warn('Ah counter meeting-wise load error:', e);
    return [];
  }
}

async function fetchClubSecondarySnapshotLast6Months(clubId: string): Promise<{
  educationalSpeeches: EducationalSpeechDeliveredRow[];
  toastmasterThemes: ToastmasterThemeDeliveredRow[];
  preparedSpeeches: PreparedSpeechDeliveredRow[];
  quoteRows: GrammarianPublishedCarouselRow[];
  idiomRows: GrammarianPublishedCarouselRow[];
  wotdRows: ClubWotdCarouselRow[];
  timerMeetingWiseRows: TimerMeetingWiseRow[];
  ahCounterMeetingWiseRows: AhCounterMeetingWiseRow[];
  tableTopicQuestionRows: ClubTableTopicQuestionRow[];
  generalEvaluatorScoringRows: GeneralEvaluatorScoringRow[];
} | null> {
  try {
    const { data, error } = await (supabase as any).rpc('get_club_tab_secondary_snapshot', {
      p_club_id: clubId,
      p_months: 6,
    });
    if (error || !data || typeof data !== 'object') {
      if (error) console.warn('Club secondary snapshot RPC:', error.message);
      return null;
    }
    const root = data as Record<string, unknown>;
    return {
      educationalSpeeches: ((root.educationalSpeeches as EducationalSpeechDeliveredRow[] | null) ?? []),
      toastmasterThemes: ((root.toastmasterThemes as ToastmasterThemeDeliveredRow[] | null) ?? []),
      preparedSpeeches: ((root.preparedSpeeches as PreparedSpeechDeliveredRow[] | null) ?? []),
      quoteRows: ((root.quoteRows as GrammarianPublishedCarouselRow[] | null) ?? []),
      idiomRows: ((root.idiomRows as GrammarianPublishedCarouselRow[] | null) ?? []),
      wotdRows: ((root.wotdRows as ClubWotdCarouselRow[] | null) ?? []),
      timerMeetingWiseRows: ((root.timerMeetingWiseRows as TimerMeetingWiseRow[] | null) ?? []),
      ahCounterMeetingWiseRows: ((root.ahCounterMeetingWiseRows as AhCounterMeetingWiseRow[] | null) ?? []),
      tableTopicQuestionRows: ((root.tableTopicQuestionRows as ClubTableTopicQuestionRow[] | null) ?? []),
      generalEvaluatorScoringRows: ((root.generalEvaluatorScoringRows as GeneralEvaluatorScoringRow[] | null) ?? []),
    };
  } catch (e) {
    console.warn('Club secondary snapshot RPC load error:', e);
    return null;
  }
}

type EducationalSpeechDeliveredRow = {
  key: string;
  speechTitle: string;
  speakerName: string;
  avatarUrl: string | null;
  meetingDateRaw: string;
  meetingDateLabel: string;
};

/** Sessions with a saved title on `app_meeting_educational_speaker` in the rolling last 6 months. */
async function fetchEducationalSpeechesDeliveredLast6Months(
  clubId: string
): Promise<EducationalSpeechDeliveredRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data: meetingsInRange, error: mErr } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_date')
      .eq('club_id', clubId)
      .gte('meeting_date', meetingDateStart)
      .lte('meeting_date', meetingDateEnd);

    if (mErr) {
      console.warn('Educational speeches: meetings', mErr.message);
      return [];
    }
    const meetingRows = meetingsInRange || [];
    if (meetingRows.length === 0) return [];

    const dateByMeetingId = new Map(meetingRows.map((m) => [m.id, m.meeting_date as string]));
    const meetingIds = meetingRows.map((m) => m.id);
    const CHUNK = 80;
    const esRows: { speech_title: string; speaker_user_id: string; meeting_id: string }[] = [];

    for (let i = 0; i < meetingIds.length; i += CHUNK) {
      const chunk = meetingIds.slice(i, i + CHUNK);
      const { data: chunkData, error: esErr } = await supabase
        .from('app_meeting_educational_speaker')
        .select('speech_title, speaker_user_id, meeting_id')
        .eq('club_id', clubId)
        .in('meeting_id', chunk)
        .not('speech_title', 'is', null)
        .neq('speech_title', '');
      if (esErr) {
        console.warn('Educational speeches: content', esErr.message);
        continue;
      }
      for (const r of chunkData || []) {
        const t = (r as { speech_title: string | null }).speech_title?.trim();
        if (t) {
          esRows.push({
            speech_title: t,
            speaker_user_id: (r as { speaker_user_id: string }).speaker_user_id,
            meeting_id: (r as { meeting_id: string }).meeting_id,
          });
        }
      }
    }

    if (esRows.length === 0) return [];

    const speakerIds = [...new Set(esRows.map((r) => r.speaker_user_id))];
    const { data: profiles, error: pErr } = await supabase
      .from('app_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', speakerIds);

    if (pErr) console.warn('Educational speeches: profiles', pErr.message);
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    const rows: EducationalSpeechDeliveredRow[] = esRows.map((r) => {
      const prof = profileById.get(r.speaker_user_id);
      const meetingDateRaw = dateByMeetingId.get(r.meeting_id) || '';
      const meetingDateLabel =
        formatCharterDateShort(meetingDateRaw) || meetingDateRaw || '—';
      return {
        key: `${r.meeting_id}:${r.speaker_user_id}`,
        speechTitle: r.speech_title,
        speakerName: prof?.full_name?.trim() || 'Member',
        avatarUrl: prof?.avatar_url ?? null,
        meetingDateRaw,
        meetingDateLabel,
      };
    });

    rows.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return rows.slice(0, 40);
  } catch (e) {
    console.warn('Educational speeches load error:', e);
    return [];
  }
}

type ToastmasterThemeDeliveredRow = {
  key: string;
  themeTitle: string;
  toastmasterName: string;
  avatarUrl: string | null;
  meetingDateRaw: string;
  meetingDateLabel: string;
};

/** Toastmaster corner rows with a non-empty `theme_of_the_day` in the rolling last 6 months. */
async function fetchToastmasterThemesDeliveredLast6Months(
  clubId: string
): Promise<ToastmasterThemeDeliveredRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data: meetingsInRange, error: mErr } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_date')
      .eq('club_id', clubId)
      .gte('meeting_date', meetingDateStart)
      .lte('meeting_date', meetingDateEnd);

    if (mErr) {
      console.warn('Toastmaster themes: meetings', mErr.message);
      return [];
    }
    const meetingRows = meetingsInRange || [];
    if (meetingRows.length === 0) return [];

    const dateByMeetingId = new Map(meetingRows.map((m) => [m.id, m.meeting_date as string]));
    const meetingIds = meetingRows.map((m) => m.id);
    const CHUNK = 80;
    const tmdRows: { theme_of_the_day: string; toastmaster_user_id: string; meeting_id: string }[] =
      [];

    for (let i = 0; i < meetingIds.length; i += CHUNK) {
      const chunk = meetingIds.slice(i, i + CHUNK);
      const { data: chunkData, error: tErr } = await supabase
        .from('toastmaster_meeting_data')
        .select('theme_of_the_day, toastmaster_user_id, meeting_id')
        .eq('club_id', clubId)
        .in('meeting_id', chunk)
        .not('theme_of_the_day', 'is', null)
        .neq('theme_of_the_day', '');
      if (tErr) {
        console.warn('Toastmaster themes: content', tErr.message);
        continue;
      }
      for (const r of chunkData || []) {
        const theme = (r as { theme_of_the_day: string | null }).theme_of_the_day?.trim();
        if (theme) {
          tmdRows.push({
            theme_of_the_day: theme,
            toastmaster_user_id: (r as { toastmaster_user_id: string }).toastmaster_user_id,
            meeting_id: (r as { meeting_id: string }).meeting_id,
          });
        }
      }
    }

    if (tmdRows.length === 0) return [];

    const tmIds = [...new Set(tmdRows.map((r) => r.toastmaster_user_id))];
    const { data: profiles, error: pErr } = await supabase
      .from('app_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', tmIds);

    if (pErr) console.warn('Toastmaster themes: profiles', pErr.message);
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    const rows: ToastmasterThemeDeliveredRow[] = tmdRows.map((r) => {
      const prof = profileById.get(r.toastmaster_user_id);
      const meetingDateRaw = dateByMeetingId.get(r.meeting_id) || '';
      const meetingDateLabel =
        formatCharterDateShort(meetingDateRaw) || meetingDateRaw || '—';
      return {
        key: `${r.meeting_id}:${r.toastmaster_user_id}`,
        themeTitle: r.theme_of_the_day,
        toastmasterName: prof?.full_name?.trim() || 'Toastmaster',
        avatarUrl: prof?.avatar_url ?? null,
        meetingDateRaw,
        meetingDateLabel,
      };
    });

    rows.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return rows.slice(0, 40);
  } catch (e) {
    console.warn('Toastmaster themes load error:', e);
    return [];
  }
}

type PreparedSpeechDeliveredRow = {
  key: string;
  speechTitle: string;
  /** Pathway name only (e.g. Presentation Mastery). */
  pathwayName: string;
  projectName: string | null;
  level: number | null;
  speakerName: string;
  avatarUrl: string | null;
  meetingDateRaw: string;
  meetingDateLabel: string;
};

function pathwayRowIsPreparedOrIce(roleName: string | null | undefined): boolean {
  if (!roleName) return false;
  const n = roleName.toLowerCase();
  return (
    n.includes('prepared speaker') ||
    n.includes('prepared speech') ||
    n.includes('ice breaker')
  );
}

function pathwayRowHasAnySpeechDetail(row: {
  speech_title?: string | null;
  pathway_name?: string | null;
  project_name?: string | null;
  level?: number | null;
}): boolean {
  return !!(
    row.speech_title?.trim() ||
    row.pathway_name?.trim() ||
    row.project_name?.trim() ||
    row.level != null
  );
}

/**
 * Prepared / Ice Breaker speeches in the last 6 months.
 * Primary: `app_evaluation_pathway` (where members enter title & pathway — matches get_delivered_speeches).
 * Fallback: `app_meeting_roles_management` for Ice Breaker + Prepared Speaker with speech_title (no is_completed gate).
 */
async function fetchPreparedSpeechesDeliveredLast6Months(
  clubId: string
): Promise<PreparedSpeechDeliveredRow[]> {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateStart = formatLocalYmd(start);
    const meetingDateEnd = formatLocalYmd(end);

    const { data: meetingsInRange, error: mErr } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_date')
      .eq('club_id', clubId)
      .gte('meeting_date', meetingDateStart)
      .lte('meeting_date', meetingDateEnd);

    if (mErr) {
      console.warn('Prepared speeches: meetings', mErr.message);
      return [];
    }
    const meetingRows = meetingsInRange || [];
    if (meetingRows.length === 0) return [];

    const dateByMeetingId = new Map(meetingRows.map((m) => [m.id, m.meeting_date as string]));
    const meetingIds = meetingRows.map((m) => m.id);
    const CHUNK = 80;

    type Acc = {
      key: string;
      meeting_id: string;
      user_id: string;
      speechTitle: string;
      pathway_name: string | null;
      project_name: string | null;
      level: number | null;
    };
    const byComposite = new Map<string, Acc>();
    const addRow = (a: Acc) => {
      const k = `${a.meeting_id}:${a.user_id}`;
      if (!byComposite.has(k)) byComposite.set(k, a);
    };

    for (let i = 0; i < meetingIds.length; i += CHUNK) {
      const chunk = meetingIds.slice(i, i + CHUNK);

      const { data: epData, error: epErr } = await supabase
        .from('app_evaluation_pathway')
        .select(
          'id, meeting_id, user_id, speech_title, pathway_name, project_name, level, role_name'
        )
        .in('meeting_id', chunk);
      if (epErr) {
        console.warn('Prepared speeches: evaluation pathway', epErr.message);
      } else {
        for (const raw of epData || []) {
          const r = raw as {
            id: string;
            meeting_id: string;
            user_id: string | null;
            speech_title: string | null;
            pathway_name: string | null;
            project_name: string | null;
            level: number | null;
            role_name: string | null;
          };
          if (!r.user_id || !pathwayRowIsPreparedOrIce(r.role_name)) continue;
          if (!pathwayRowHasAnySpeechDetail(r)) continue;

          const title =
            r.speech_title?.trim() ||
            r.project_name?.trim() ||
            'Prepared speech';
          addRow({
            key: `ep:${r.id}`,
            meeting_id: r.meeting_id,
            user_id: r.user_id,
            speechTitle: title,
            pathway_name: r.pathway_name,
            project_name: r.project_name,
            level: r.level,
          });
        }
      }

      const { data: roleData, error: rErr } = await supabase
        .from('app_meeting_roles_management')
        .select(
          'id, meeting_id, assigned_user_id, speech_title, pathway_name, project_title, role_classification'
        )
        .eq('club_id', clubId)
        .in('meeting_id', chunk)
        .in('role_classification', ['Prepared Speaker', 'Ice Breaker'])
        .not('assigned_user_id', 'is', null);
      if (rErr) {
        console.warn('Prepared speeches: roles', rErr.message);
        continue;
      }
      for (const raw of roleData || []) {
        const row = raw as {
          id: string;
          meeting_id: string;
          assigned_user_id: string | null;
          speech_title: string | null;
          pathway_name: string | null;
          project_title: string | null;
        };
        const uid = row.assigned_user_id;
        if (!uid) continue;
        const composite = `${row.meeting_id}:${uid}`;
        if (byComposite.has(composite)) continue;

        const title = row.speech_title?.trim();
        const hasPath =
          !!(row.pathway_name?.trim() || row.project_title?.trim());
        if (!title && !hasPath) continue;

        addRow({
          key: `rm:${row.id}`,
          meeting_id: row.meeting_id,
          user_id: uid,
          speechTitle: title || row.project_title?.trim() || 'Prepared speech',
          pathway_name: row.pathway_name,
          project_name: row.project_title,
          level: null,
        });
      }
    }

    const accumulated = Array.from(byComposite.values());
    if (accumulated.length === 0) return [];

    const speakerIds = [...new Set(accumulated.map((r) => r.user_id))];
    const { data: profiles, error: pErr } = await supabase
      .from('app_user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', speakerIds);

    if (pErr) console.warn('Prepared speeches: profiles', pErr.message);
    const profileById = new Map((profiles || []).map((p) => [p.id, p]));

    const rows: PreparedSpeechDeliveredRow[] = accumulated.map((r) => {
      const prof = profileById.get(r.user_id);
      const meetingDateRaw = dateByMeetingId.get(r.meeting_id) || '';
      const meetingDateLabel =
        formatCharterDateShort(meetingDateRaw) || meetingDateRaw || '—';

      const pathwayName = r.pathway_name?.trim() ?? '';

      return {
        key: r.key,
        speechTitle: r.speechTitle,
        pathwayName,
        projectName: r.project_name?.trim() || null,
        level: r.level ?? null,
        speakerName: prof?.full_name?.trim() || 'Speaker',
        avatarUrl: prof?.avatar_url ?? null,
        meetingDateRaw,
        meetingDateLabel,
      };
    });

    rows.sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw));
    return rows.slice(0, 40);
  } catch (e) {
    console.warn('Prepared speeches load error:', e);
    return [];
  }
}

type DeliveredHighlightRow = {
  key: string;
  headline: string;
  /** When set, shows a labeled “Pathway” block between the title and avatar. */
  pathwayDisplay?: string;
  personName: string;
  avatarUrl: string | null;
  meetingDateLabel: string;
};

const FAQ_ROW_ICONS: { Icon: typeof Lightbulb; color: string }[] = [
  { Icon: Lightbulb, color: '#f59e0b' },
  { Icon: Users, color: '#3b82f6' },
  { Icon: Mic2, color: '#8b5cf6' },
  { Icon: BookOpen, color: '#10b981' },
  { Icon: MessageCircle, color: '#ec4899' },
  { Icon: CircleHelp, color: '#6b7280' },
];

function ClubFaqHeroCard({ items, variant = 'card' }: { items: ClubFaqHeroRow[]; variant?: 'card' | 'notion' }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const nRef = useRef(items.length);
  nRef.current = items.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    translateY.setValue(0);
  }, [items, opacity, translateY]);

  useEffect(() => {
    if (items.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % nRef.current);
        translateY.setValue(10);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, CLUB_FAQ_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [items.length, opacity, translateY]);

  if (!items.length) {
    return (
      <View style={variant === 'notion' ? styles.faqHeroNotion : [styles.card, styles.faqHeroCard]}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Questions
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No questions published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const row = items[safeIndex];
  const { Icon, color } = FAQ_ROW_ICONS[safeIndex % FAQ_ROW_ICONS.length];

  return (
    <View style={variant === 'notion' ? styles.faqHeroNotion : [styles.card, styles.faqHeroCard]}>
      <Animated.View
        style={[
          styles.faqHeroCarouselInner,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`${row.question}. ${row.answer}`}
      >
        <View style={styles.faqHeroRow}>
          <View style={styles.faqHeroIconWrap} accessible={false}>
            <Icon size={22} color={color} strokeWidth={2} />
          </View>
          <View style={styles.faqHeroTextCol}>
            <Text style={styles.faqHeroQuestion} maxFontSizeMultiplier={1.12}>
              {row.question}
            </Text>
            <Text style={styles.faqHeroAnswer} maxFontSizeMultiplier={1.15}>
              {row.answer}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.faqHeroBottomRule} />
    </View>
  );
}

function GrammarianPublishedCarousel({
  title,
  rows,
  variant = 'card',
}: {
  title: string;
  rows: GrammarianPublishedCarouselRow[];
  variant?: 'card' | 'embedded';
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={[variant === 'embedded' ? styles.embeddedSection : styles.card, styles.grammarianHighlightCard]}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No entries published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;

  const goPrev = () => {
    setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  };

  const goNext = () => {
    setIndex((prev) => (prev + 1) % rows.length);
  };

  return (
    <View style={[variant === 'embedded' ? styles.embeddedSection : styles.card, styles.grammarianHighlightCard]}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>

      <View
        style={styles.wotdCarouselSlide}
        accessibilityRole="summary"
        accessibilityLabel={`${row.lead}. ${row.meaning ?? ''}. ${row.meetingDateLabel}`}
      >
        <Text style={styles.grammarianClubDayLead} maxFontSizeMultiplier={1.15}>
          {row.lead}
        </Text>
        {row.meaning ? (
          <Text style={styles.grammarianClubDayMeaning} maxFontSizeMultiplier={1.12}>
            {row.meaning}
          </Text>
        ) : null}
        {row.usage ? (
          <Text style={styles.wotdUsage} maxFontSizeMultiplier={1.1}>
            {row.usage}
          </Text>
        ) : null}
        <Text style={styles.wotdMeetingDate} maxFontSizeMultiplier={1.08}>
          {row.meetingDateLabel}
        </Text>
        <Text style={styles.addedByText} maxFontSizeMultiplier={1.08}>
          Added by {row.addedBy?.trim() || '—'}
        </Text>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel={`Previous ${title}`}
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel={`Next ${title}`}
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function ClubWordOfTheDayCarousel({
  rows,
  variant = 'card',
}: {
  rows: ClubWotdCarouselRow[];
  variant?: 'card' | 'embedded';
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={[variant === 'embedded' ? styles.embeddedSection : styles.card, styles.grammarianHighlightCard]}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Word of the day
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No words published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;

  const goPrev = () => {
    setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  };

  const goNext = () => {
    setIndex((prev) => (prev + 1) % rows.length);
  };

  return (
    <View style={[variant === 'embedded' ? styles.embeddedSection : styles.card, styles.grammarianHighlightCard]}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Word of the day
      </Text>

      <View
        style={styles.wotdCarouselSlide}
        accessibilityRole="summary"
        accessibilityLabel={`${row.word}. ${row.meaning ?? ''}. ${row.meetingDateLabel}`}
      >
        <Text style={styles.grammarianClubDayLead} maxFontSizeMultiplier={1.15}>
          {row.word}
        </Text>
        {row.partOfSpeech ? (
          <Text style={styles.wotdPartOfSpeech} maxFontSizeMultiplier={1.08}>
            {row.partOfSpeech}
          </Text>
        ) : null}
        {row.meaning ? (
          <Text style={styles.grammarianClubDayMeaning} maxFontSizeMultiplier={1.12}>
            {row.meaning}
          </Text>
        ) : null}
        {row.usage ? (
          <Text style={styles.wotdUsage} maxFontSizeMultiplier={1.1}>
            {row.usage}
          </Text>
        ) : null}
        <Text style={styles.wotdMeetingDate} maxFontSizeMultiplier={1.08}>
          {row.meetingDateLabel}
        </Text>
        <Text style={styles.addedByText} maxFontSizeMultiplier={1.08}>
          Added by {row.addedBy?.trim() || '—'}
        </Text>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous word of the day"
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel="Next word of the day"
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/** Prepared speeches: two-column layout; transition = scale + crossfade (distinct from Toastmaster / Educational). */
function PreparedSpeechesHighlightCarousel({
  rows,
  variant = 'card',
}: {
  rows: PreparedSpeechDeliveredRow[];
  variant?: 'card' | 'embedded';
}) {
  if (!rows.length) {
    return (
      <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Prepared speeches — last 6 months
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No prepared speeches available yet.
        </Text>
      </View>
    );
  }
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.meetingDateRaw.localeCompare(a.meetingDateRaw)),
    [rows]
  );

  const pathwayMetaLabel = (row: PreparedSpeechDeliveredRow): string | null => {
    const levelText = typeof row.level === 'number' ? `L${row.level}` : null;
    const projectNum = row.projectName?.match(/\d+/)?.[0] ?? null;
    const projectText = projectNum ? `P${projectNum}` : null;
    if (!levelText && !projectText) return null;
    if (levelText && projectText) return `${levelText}, ${projectText}`;
    return levelText ?? projectText;
  };

  return (
    <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Prepared speeches — last 6 months
      </Text>
      <View style={styles.preparedTableHeader}>
        <View style={[styles.preparedCell, styles.preparedColName, styles.preparedCellDivider]}>
          <Text style={styles.preparedTableHeadText}>Name</Text>
        </View>
        <View style={[styles.preparedCell, styles.preparedColSpeech, styles.preparedCellDivider]}>
          <Text style={styles.preparedTableHeadText}>Speech title</Text>
        </View>
        <View style={[styles.preparedCell, styles.preparedColPathway]}>
          <Text style={styles.preparedTableHeadText}>Pathway</Text>
        </View>
      </View>
      <ScrollView
        style={styles.preparedTableScroll}
        contentContainerStyle={styles.preparedTableScrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
      {sortedRows.map((row) => {
        const pathwayMeta = pathwayMetaLabel(row);
        return (
          <View key={row.key} style={styles.preparedTableRow}>
            <View style={[styles.preparedCell, styles.preparedColName, styles.preparedCellDivider]}>
              <Text style={styles.preparedTableCellText} numberOfLines={2}>
                {row.speakerName}
              </Text>
            </View>
            <View style={[styles.preparedCell, styles.preparedColSpeech, styles.preparedCellDivider]}>
              <Text style={styles.preparedTableCellText} numberOfLines={3}>
                {row.speechTitle}
              </Text>
            </View>
            <View style={[styles.preparedCell, styles.preparedColPathway]}>
              <Text style={styles.preparedTableCellText} numberOfLines={2}>
                {row.pathwayName.trim() || '—'}
              </Text>
              {pathwayMeta ? (
                <Text style={styles.preparedPathwayMeta} numberOfLines={1}>
                  {pathwayMeta}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

const MemoDeliveredHighlightCarousel = memo(DeliveredHighlightCarousel);
const MemoPreparedSpeechesHighlightCarousel = memo(PreparedSpeechesHighlightCarousel);
const MemoClubWordOfTheDayCarousel = memo(ClubWordOfTheDayCarousel);
const MemoGrammarianPublishedCarousel = memo(GrammarianPublishedCarousel);
const MemoTimerMeetingWiseCarousel = memo(TimerMeetingWiseCarousel);
const MemoAhCounterMeetingWiseCarousel = memo(AhCounterMeetingWiseCarousel);
const MemoTableTopicQuestionsCarousel = memo(TableTopicQuestionsCarousel);
const MemoGeneralEvaluatorScoringCarousel = memo(GeneralEvaluatorScoringCarousel);

function DeliveredHighlightCarousel({
  sectionTitle,
  subtitle,
  rows,
  variant,
  containerVariant = 'card',
}: {
  sectionTitle: string;
  subtitle?: string;
  rows: DeliveredHighlightRow[];
  variant: 'toastmaster' | 'educational';
  containerVariant?: 'card' | 'embedded';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const [index, setIndex] = useState(0);
  
  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={containerVariant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          {sectionTitle}
        </Text>
        {subtitle ? (
          <Text style={styles.clubStatsPeriod} maxFontSizeMultiplier={1.15}>
            {subtitle}
          </Text>
        ) : null}
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No records available yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;

  const goPrev = () => {
    setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  };

  const goNext = () => {
    setIndex((prev) => (prev + 1) % rows.length);
  };

  return (
    <View style={containerVariant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        {sectionTitle}
      </Text>
      {subtitle ? (
        <Text style={styles.clubStatsPeriod} maxFontSizeMultiplier={1.15}>
          {subtitle}
        </Text>
      ) : null}

      <View
        style={styles.edSpeechSlide}
        accessibilityRole="summary"
        accessibilityLabel={`${row.headline}${
          row.pathwayDisplay !== undefined ? `. Pathway: ${row.pathwayDisplay || '—'}` : ''
        }. ${row.personName}. ${row.meetingDateLabel}`}
      >
        <Text style={styles.edSpeechTitle} numberOfLines={3} maxFontSizeMultiplier={1.12}>
          {row.headline}
        </Text>
        {row.pathwayDisplay !== undefined ? (
          <View style={styles.edSpeechPathwayBlock}>
            <Text style={styles.edSpeechFieldLabel} maxFontSizeMultiplier={1.05}>
              Pathway
            </Text>
            <Text style={styles.edSpeechPathwayValue} numberOfLines={3} maxFontSizeMultiplier={1.1}>
              {row.pathwayDisplay.trim() ? row.pathwayDisplay : '—'}
            </Text>
          </View>
        ) : null}
        {shouldLoadAvatars && row.avatarUrl ? (
          <Image
            source={{ uri: avatarUrlForDisplay(row.avatarUrl, 144) ?? row.avatarUrl }}
            style={styles.edSpeechAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.edSpeechAvatar, styles.edSpeechAvatarPh]}>
            <Text style={styles.edSpeechInitial} maxFontSizeMultiplier={1.2}>
              {initialsFromName(row.personName, 2)}
            </Text>
          </View>
        )}
        <Text style={styles.edSpeechName} maxFontSizeMultiplier={1.15}>
          {row.personName}
        </Text>
        <Text style={styles.edSpeechDate} maxFontSizeMultiplier={1.1}>
          {row.meetingDateLabel}
        </Text>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel={`Previous ${variant === 'toastmaster' ? 'toastmaster theme' : 'educational speech'}`}
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel={`Next ${variant === 'toastmaster' ? 'toastmaster theme' : 'educational speech'}`}
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function emptyClubStats(): ClubStatsCounts {
  return {
    speeches: 0,
    educationalSpeeches: 0,
    tableTopicSpeeches: 0,
    meetingsConducted: 0,
    themes: 0,
    evaluations: 0,
  };
}

function clubStatsSlides(stats: ClubStatsCounts): { key: string; label: string; value: number }[] {
  return [
    { key: 'speeches', label: 'Speeches', value: stats.speeches },
    { key: 'ed', label: 'Educational speeches', value: stats.educationalSpeeches },
    { key: 'tt', label: 'Table topic speeches', value: stats.tableTopicSpeeches },
    { key: 'meetings', label: 'Meetings conducted', value: stats.meetingsConducted },
    { key: 'themes', label: 'Themes', value: stats.themes },
    { key: 'evals', label: 'Evaluations', value: stats.evaluations },
  ];
}

function ClubStatsStaticCard({
  stats,
  selectedDays,
  onSelectDays,
  loading,
  variant = 'card',
}: {
  stats: ClubStatsCounts | null;
  selectedDays: number;
  onSelectDays: (days: number) => void;
  loading: boolean;
  variant?: 'card' | 'notion';
}) {
  const slides = stats ? clubStatsSlides(stats) : clubStatsSlides(emptyClubStats());

  return (
    <View style={variant === 'notion' ? undefined : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Club stats
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clubStatsChipRow}
        accessibilityRole="tablist"
      >
        {CLUB_STATS_PERIOD_OPTIONS.map((opt) => {
          const active = selectedDays === opt.days;
          return (
            <TouchableOpacity
              key={opt.days}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelectDays(opt.days)}
              style={[styles.clubStatsChip, active && styles.clubStatsChipActive]}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.clubStatsChipText, active && styles.clubStatsChipTextActive]}
                maxFontSizeMultiplier={1.12}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.clubStatsGridLoading}>
          <ActivityIndicator color={C.cta} />
        </View>
      ) : (
        <View style={styles.clubStatsGrid}>
          {[0, 1, 2].map((rowIdx) => (
            <View key={rowIdx} style={styles.clubStatsGridRow}>
              {slides.slice(rowIdx * 2, rowIdx * 2 + 2).map((s) => (
                <View key={s.key} style={styles.clubStatsBox} accessibilityRole="text">
                  <Text style={styles.clubStatsBoxLabel} maxFontSizeMultiplier={1.08} numberOfLines={3}>
                    {s.label}
                  </Text>
                  <Text style={styles.clubStatsBoxValue} maxFontSizeMultiplier={1.15}>
                    {s.value}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TableTopicQuestionsCarousel({
  rows,
  variant = 'card',
}: {
  rows: ClubTableTopicQuestionRow[];
  variant?: 'card' | 'embedded';
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Table topic questions
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No table topic questions captured yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;

  const goPrev = () => setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  const goNext = () => setIndex((prev) => (prev + 1) % rows.length);

  return (
    <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Table topic questions
      </Text>
      <Text style={styles.tableTopicQuestionText} maxFontSizeMultiplier={1.18}>
        {row.question}
      </Text>
      <Text style={styles.tableTopicQuestionDate} maxFontSizeMultiplier={1.1}>
        {row.meetingDateLabel}
      </Text>
      {row.addedBy ? (
        <Text style={styles.addedByText} maxFontSizeMultiplier={1.08}>
          Added by {row.addedBy}
        </Text>
      ) : null}
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous table topic question"
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel="Next table topic question"
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function GeneralEvaluatorScoringCarousel({
  rows,
  variant = 'card',
}: {
  rows: GeneralEvaluatorScoringRow[];
  variant?: 'card' | 'embedded';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          General evaluator scoring
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No scoring records published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;
  const goPrev = () => setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  const goNext = () => setIndex((prev) => (prev + 1) % rows.length);

  return (
    <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        General evaluator scoring
      </Text>
      <View style={styles.edSpeechSlide}>
        <Text style={styles.edSpeechTitle} numberOfLines={2} maxFontSizeMultiplier={1.12}>
          {row.meetingNumber?.trim()
            ? `Meeting ${row.meetingNumber} • ${row.meetingDateLabel}`
            : row.meetingDateLabel}
        </Text>

        {shouldLoadAvatars && row.evaluatorAvatarUrl ? (
          <Image
            source={{ uri: avatarUrlForDisplay(row.evaluatorAvatarUrl, 144) ?? row.evaluatorAvatarUrl }}
            style={styles.edSpeechAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.edSpeechAvatar, styles.edSpeechAvatarPh]}>
            <Text style={styles.edSpeechInitial} maxFontSizeMultiplier={1.2}>
              {initialsFromName(row.evaluatorName, 2)}
            </Text>
          </View>
        )}
        <Text style={styles.edSpeechName} maxFontSizeMultiplier={1.15}>
          {row.evaluatorName}
        </Text>
        <Text style={styles.geScoreLine} maxFontSizeMultiplier={1.1}>
          Score
        </Text>
        <GeFiveStarRow rating={geTenPointToStars(row.score)} size={20} />
        <Text style={styles.geOverallScoreLine} maxFontSizeMultiplier={1.1}>
          Overall score:{' '}
          {row.overallScoreTotal != null && row.overallScoreMax != null
            ? `${row.overallScoreTotal}/${row.overallScoreMax}`
            : '—'}
        </Text>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous general evaluator score"
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel="Next general evaluator score"
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function TimerMeetingWiseCarousel({
  rows,
  variant = 'card',
}: {
  rows: TimerMeetingWiseRow[];
  variant?: 'card' | 'embedded';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Timer report - meeting wise
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No timer reports published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;
  const goPrev = () => setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  const goNext = () => setIndex((prev) => (prev + 1) % rows.length);

  return (
    <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Timer report - meeting wise
      </Text>
      <View style={styles.edSpeechSlide}>
        <Text style={styles.edSpeechTitle} numberOfLines={2} maxFontSizeMultiplier={1.12}>
          {row.meetingNumber?.trim()
            ? `Meeting ${row.meetingNumber} • ${row.meetingDateLabel}`
            : row.meetingDateLabel}
        </Text>
        {shouldLoadAvatars && row.timerAvatarUrl ? (
          <Image
            source={{ uri: avatarUrlForDisplay(row.timerAvatarUrl, 144) ?? row.timerAvatarUrl }}
            style={styles.edSpeechAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.edSpeechAvatar, styles.edSpeechAvatarPh]}>
            <Text style={styles.edSpeechInitial} maxFontSizeMultiplier={1.2}>
              {initialsFromName(row.timerName, 2)}
            </Text>
          </View>
        )}
        <Text style={styles.edSpeechName} maxFontSizeMultiplier={1.15}>
          {row.timerName}
        </Text>
        <View style={styles.timerTableWrap}>
          <View style={styles.timerTableHeadRow}>
            <Text style={[styles.timerTableHeadCell, styles.timerTableColCategory]} maxFontSizeMultiplier={1.05}>
              Category
            </Text>
            <Text style={[styles.timerTableHeadCell, styles.timerTableColCount]} maxFontSizeMultiplier={1.05}>
              Qualified
            </Text>
            <Text style={[styles.timerTableHeadCell, styles.timerTableColCount]} maxFontSizeMultiplier={1.05}>
              Total
            </Text>
          </View>
          {row.categoryStats.map((s, idx) => (
            <View
              key={`${row.key}:${s.key}`}
              style={[styles.timerTableBodyRow, idx !== row.categoryStats.length - 1 && styles.timerTableRowDivider]}
            >
              <Text style={[styles.timerTableBodyCell, styles.timerTableColCategory]} numberOfLines={2} maxFontSizeMultiplier={1.08}>
                {s.label}
              </Text>
              <Text style={[styles.timerTableBodyCell, styles.timerTableColCount]} maxFontSizeMultiplier={1.08}>
                {s.qualified}
              </Text>
              <Text style={[styles.timerTableBodyCell, styles.timerTableColCount]} maxFontSizeMultiplier={1.08}>
                {s.total}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous timer report"
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel="Next timer report"
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function AhCounterMeetingWiseCarousel({
  rows,
  variant = 'card',
}: {
  rows: AhCounterMeetingWiseRow[];
  variant?: 'card' | 'embedded';
}) {
  const shouldLoadAvatars = useShouldLoadNetworkAvatars();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [rows]);

  if (!rows.length) {
    return (
      <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
        <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
          Ah counter report
        </Text>
        <Text style={styles.smallMuted} maxFontSizeMultiplier={1.15}>
          No Ah counter reports published yet.
        </Text>
      </View>
    );
  }

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const canNavigate = rows.length > 1;
  const maxWordCount = Math.max(1, ...row.words.map((w) => w.count));
  const goPrev = () => setIndex((prev) => (prev - 1 + rows.length) % rows.length);
  const goNext = () => setIndex((prev) => (prev + 1) % rows.length);

  return (
    <View style={variant === 'embedded' ? styles.embeddedSection : styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Ah counter report
      </Text>
      <View style={styles.edSpeechSlide}>
        <Text style={styles.edSpeechTitle} numberOfLines={2} maxFontSizeMultiplier={1.12}>
          {row.meetingNumber?.trim()
            ? `Meeting ${row.meetingNumber} • ${row.meetingDateLabel}`
            : row.meetingDateLabel}
        </Text>
        {shouldLoadAvatars && row.ahCounterAvatarUrl ? (
          <Image
            source={{ uri: avatarUrlForDisplay(row.ahCounterAvatarUrl, 144) ?? row.ahCounterAvatarUrl }}
            style={styles.edSpeechAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.edSpeechAvatar, styles.edSpeechAvatarPh]}>
            <Text style={styles.edSpeechInitial} maxFontSizeMultiplier={1.2}>
              {initialsFromName(row.ahCounterName, 2)}
            </Text>
          </View>
        )}
        <Text style={styles.edSpeechName} maxFontSizeMultiplier={1.15}>
          {row.ahCounterName}
        </Text>

        <View style={styles.ahWordsWrap}>
          {row.words.length ? (
            row.words.map((w) => (
              <View key={`${row.key}:${w.label}`} style={styles.ahWordRow}>
                <View style={styles.ahWordLabelWrap}>
                  <Text style={styles.ahWordLabel} maxFontSizeMultiplier={1.05}>
                    {w.label}
                  </Text>
                </View>
                <View style={styles.ahWordBarTrack}>
                  <View style={[styles.ahWordBarFill, { width: `${(w.count / maxWordCount) * 100}%` }]} />
                </View>
                <Text style={styles.ahWordCount} maxFontSizeMultiplier={1.05}>
                  {w.count}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.smallMuted} maxFontSizeMultiplier={1.1}>
              No filler words recorded.
            </Text>
          )}
        </View>
      </View>
      {canNavigate ? (
        <View style={styles.highlightControlsRow}>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityLabel="Previous Ah counter report"
          >
            <ChevronLeft size={16} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.highlightControlsText} maxFontSizeMultiplier={1.08}>
            {safeIndex + 1} / {rows.length}
          </Text>
          <TouchableOpacity
            style={styles.highlightArrowButton}
            onPress={goNext}
            activeOpacity={0.8}
            accessibilityLabel="Next Ah counter report"
          >
            <ChevronRight size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function MyClub() {
  const { user, isAuthenticated } = useAuth();
  const firstContentLoggedRef = useRef(false);
  const [bundle, setBundle] = useState<ClubInfoManagementBundle | null>(null);
  const [social, setSocial] = useState<ClubSocialUrlsRow | null>(null);
  const [excommPreview, setExcommPreview] = useState<ExcommPreviewRow[]>([]);
  const [membersPreview, setMembersPreview] = useState<MemberPreview[]>([]);
  const [clubStatsPeriodDays, setClubStatsPeriodDays] = useState(180);
  const [clubStats, setClubStats] = useState<ClubStatsCounts | null>(null);
  const [clubStatsLoading, setClubStatsLoading] = useState(false);
  const [clubStatsByDays, setClubStatsByDays] = useState<Record<number, ClubStatsCounts>>({});
  const [educationalSpeechesDelivered, setEducationalSpeechesDelivered] = useState<
    EducationalSpeechDeliveredRow[]
  >([]);
  const [toastmasterThemesDelivered, setToastmasterThemesDelivered] = useState<
    ToastmasterThemeDeliveredRow[]
  >([]);
  const [preparedSpeechesDelivered, setPreparedSpeechesDelivered] = useState<
    PreparedSpeechDeliveredRow[]
  >([]);
  const [clubFaqItems, setClubFaqItems] = useState<ClubFaqHeroRow[]>([]);
  const [clubQuoteRows, setClubQuoteRows] = useState<GrammarianPublishedCarouselRow[]>([]);
  const [clubIdiomRows, setClubIdiomRows] = useState<GrammarianPublishedCarouselRow[]>([]);
  const [clubWotdRows, setClubWotdRows] = useState<ClubWotdCarouselRow[]>([]);
  const [timerMeetingWiseRows, setTimerMeetingWiseRows] = useState<TimerMeetingWiseRow[]>([]);
  const [ahCounterMeetingWiseRows, setAhCounterMeetingWiseRows] = useState<AhCounterMeetingWiseRow[]>([]);
  const [tableTopicQuestionRows, setTableTopicQuestionRows] = useState<ClubTableTopicQuestionRow[]>([]);
  const [generalEvaluatorScoringRows, setGeneralEvaluatorScoringRows] = useState<
    GeneralEvaluatorScoringRow[]
  >([]);
  const [landingLoading, setLandingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user?.currentClubId) {
      setBundle(null);
      setSocial(null);
      setExcommPreview([]);
      setMembersPreview([]);
      setClubStatsByDays({});
      setEducationalSpeechesDelivered([]);
      setToastmasterThemesDelivered([]);
      setPreparedSpeechesDelivered([]);
      setClubFaqItems([]);
      setClubQuoteRows([]);
      setClubIdiomRows([]);
      setClubWotdRows([]);
      setTimerMeetingWiseRows([]);
      setAhCounterMeetingWiseRows([]);
      setTableTopicQuestionRows([]);
      setGeneralEvaluatorScoringRows([]);
      return;
    }

    const clubId = user.currentClubId;

    setEducationalSpeechesDelivered([]);
    setToastmasterThemesDelivered([]);
    setPreparedSpeechesDelivered([]);
    setClubFaqItems([]);
    setClubQuoteRows([]);
    setClubIdiomRows([]);
    setClubWotdRows([]);
    setTimerMeetingWiseRows([]);
    setAhCounterMeetingWiseRows([]);
    setTableTopicQuestionRows([]);
    setGeneralEvaluatorScoringRows([]);
    setClubStatsByDays({});

    const runCritical = async () => {
      const criticalStartMs = Date.now();
      setLandingLoading(true);
      try {
        const warm = await getCachedClubLandingCritical(clubId);
        if (!cancelled && warm) {
          setBundle(warm.bundle);
          setSocial(warm.bundle.social);
          setExcommPreview(warm.excomm);
          setMembersPreview(warm.members);
          // Keep spinner off while refreshing in background.
          setLandingLoading(false);
        }

        const { bundle: b, excomm, members: membersP } = await fetchClubLandingCritical(clubId, {
          bypassCache: !!warm,
        });
        if (cancelled) return;
        setBundle(b);
        setSocial(b.social);
        setExcommPreview(excomm);
        setMembersPreview(membersP);
        console.log(
          '[club-perf] critical-loaded',
          JSON.stringify({ clubId, elapsedMs: Date.now() - criticalStartMs, fromWarmCache: !!warm })
        );
      } catch (e) {
        console.error('Club landing critical load error:', e);
        if (!cancelled) {
          setBundle(null);
          setSocial(null);
          setExcommPreview([]);
          setMembersPreview([]);
        }
      } finally {
        if (!cancelled) setLandingLoading(false);
      }
    };

    const runSecondary = async () => {
      const secondaryStartMs = Date.now();
      try {
        const rpcSnapshot = await fetchClubSecondarySnapshotLast6Months(clubId);
        if (rpcSnapshot) {
          if (cancelled) return;
          const faqRes = await supabase
            .from('club_faq_items')
            .select('id, question, answer')
            .eq('club_id', clubId)
            .order('sort_order', { ascending: true });
          if (cancelled) return;

          setEducationalSpeechesDelivered(rpcSnapshot.educationalSpeeches);
          setToastmasterThemesDelivered(rpcSnapshot.toastmasterThemes);
          setPreparedSpeechesDelivered(rpcSnapshot.preparedSpeeches);
          if (faqRes.error) {
            console.warn('Club FAQ load:', faqRes.error.message);
            setClubFaqItems([]);
          } else {
            const faqRows = (faqRes.data as Array<{
              id: string;
              question: string | null;
              answer: string | null;
            }> | null) ?? [];
            setClubFaqItems(
              faqRows
                .filter((r) => (r.question?.trim() || r.answer?.trim()))
                .map((r) => ({
                  id: r.id,
                  question: (r.question ?? '').trim(),
                  answer: (r.answer ?? '').trim(),
                }))
            );
          }
          setClubQuoteRows(rpcSnapshot.quoteRows);
          setClubIdiomRows(rpcSnapshot.idiomRows);
          setClubWotdRows(rpcSnapshot.wotdRows);
          setTimerMeetingWiseRows(rpcSnapshot.timerMeetingWiseRows);
          setAhCounterMeetingWiseRows(rpcSnapshot.ahCounterMeetingWiseRows);
          setTableTopicQuestionRows(rpcSnapshot.tableTopicQuestionRows);
          setGeneralEvaluatorScoringRows(rpcSnapshot.generalEvaluatorScoringRows);
          console.log(
            '[club-perf] secondary-loaded',
            JSON.stringify({ clubId, elapsedMs: Date.now() - secondaryStartMs, source: 'rpc' })
          );
          return;
        }

        const [
          edSpeeches,
          tmThemes,
          prepSpeeches,
          faqRes,
          quoteRows,
          idiomRows,
          wotdRows,
          timerRows,
          ahRows,
          tableTopicRows,
          geScoringRows,
        ] =
          await Promise.all([
            fetchEducationalSpeechesDeliveredLast6Months(clubId),
            fetchToastmasterThemesDeliveredLast6Months(clubId),
            fetchPreparedSpeechesDeliveredLast6Months(clubId),
            supabase
              .from('club_faq_items')
              .select('id, question, answer')
              .eq('club_id', clubId)
              .order('sort_order', { ascending: true }),
            fetchPublishedClubQuotesRollingDays(clubId, GRAMMARIAN_PUBLISHED_LOOKBACK_DAYS),
            fetchPublishedClubIdiomsRollingDays(clubId, GRAMMARIAN_PUBLISHED_LOOKBACK_DAYS),
            fetchPublishedClubWordsLast6Months(clubId),
            fetchTimerMeetingWiseLast6Months(clubId),
            fetchAhCounterMeetingWiseLast6Months(clubId),
            fetchClubTableTopicQuestions(clubId),
            fetchGeneralEvaluatorScoringLast6Months(clubId),
          ]);
        if (cancelled) return;
        setEducationalSpeechesDelivered(edSpeeches);
        setToastmasterThemesDelivered(tmThemes);
        setPreparedSpeechesDelivered(prepSpeeches);
        if (faqRes.error) {
          console.warn('Club FAQ load:', faqRes.error.message);
          setClubFaqItems([]);
        } else {
          const faqRows = (faqRes.data as Array<{
            id: string;
            question: string | null;
            answer: string | null;
          }> | null) ?? [];
          setClubFaqItems(
            faqRows
              .filter((r) => (r.question?.trim() || r.answer?.trim()))
              .map((r) => ({
                id: r.id,
                question: (r.question ?? '').trim(),
                answer: (r.answer ?? '').trim(),
              }))
          );
        }
        setClubQuoteRows(quoteRows);
        setClubIdiomRows(idiomRows);
        setClubWotdRows(wotdRows);
        setTimerMeetingWiseRows(timerRows);
        setAhCounterMeetingWiseRows(ahRows);
        setTableTopicQuestionRows(tableTopicRows);
        setGeneralEvaluatorScoringRows(geScoringRows);
        console.log(
          '[club-perf] secondary-loaded',
          JSON.stringify({ clubId, elapsedMs: Date.now() - secondaryStartMs, source: 'legacy-fallback' })
        );
      } catch (e) {
        console.error('Club landing secondary load error:', e);
        if (!cancelled) {
          setEducationalSpeechesDelivered([]);
          setToastmasterThemesDelivered([]);
          setPreparedSpeechesDelivered([]);
          setClubFaqItems([]);
          setClubQuoteRows([]);
          setClubIdiomRows([]);
          setClubWotdRows([]);
          setTimerMeetingWiseRows([]);
          setAhCounterMeetingWiseRows([]);
          setTableTopicQuestionRows([]);
          setGeneralEvaluatorScoringRows([]);
        }
      }
    };

    void runCritical();
    void runSecondary();

    return () => {
      cancelled = true;
    };
  }, [user?.currentClubId]);

  useEffect(() => {
    const clubId = user?.currentClubId;
    if (!clubId) {
      setClubStats(null);
      setClubStatsLoading(false);
      return;
    }
    const warmStats = clubStatsByDays[clubStatsPeriodDays];
    if (warmStats) {
      setClubStats(warmStats);
      setClubStatsLoading(false);
    }
  }, [user?.currentClubId, clubStatsPeriodDays, clubStatsByDays]);

  useEffect(() => {
    const clubId = user?.currentClubId;
    if (!clubId) return;
    const warmStats = clubStatsByDays[clubStatsPeriodDays];
    let cancelled = false;
    (async () => {
      if (!warmStats) setClubStatsLoading(true);
      try {
        const s = await fetchClubStatsRollingDays(clubId, clubStatsPeriodDays);
        if (!cancelled) {
          setClubStatsByDays((prev) => ({ ...prev, [clubStatsPeriodDays]: s }));
          setClubStats(s);
        }
      } catch {
        if (!cancelled) {
          const fallback = emptyClubStats();
          setClubStatsByDays((prev) => ({ ...prev, [clubStatsPeriodDays]: fallback }));
          setClubStats(fallback);
        }
      } finally {
        if (!cancelled) setClubStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.currentClubId, clubStatsPeriodDays]);

  useEffect(() => {
    const clubId = user?.currentClubId;
    if (!clubId) return;
    let cancelled = false;
    const missingDays = CLUB_STATS_PERIOD_OPTIONS.map((o) => o.days).filter((d) => !clubStatsByDays[d]);
    if (!missingDays.length) return;

    (async () => {
      const results = await Promise.all(
        missingDays.map(async (days) => {
          try {
            const s = await fetchClubStatsRollingDays(clubId, days);
            return { days, stats: s };
          } catch {
            return { days, stats: emptyClubStats() };
          }
        })
      );
      if (cancelled) return;
      setClubStatsByDays((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.days] = r.stats;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.currentClubId]);

  useEffect(() => {
    // Keep skeleton visible only when we truly have no data.
    if (clubStats && clubStatsLoading) {
      setClubStatsLoading(false);
    }
  }, [clubStats, clubStatsLoading]);

  useEffect(() => {
    if (bundle && !firstContentLoggedRef.current) {
      firstContentLoggedRef.current = true;
      console.log(
        '[club-perf] first-content-visible',
        JSON.stringify({ clubId: user?.currentClubId ?? null, atMs: Date.now() })
      );
    }
  }, [bundle, user?.currentClubId]);

  const handleFeaturePress = (featurePath: string) => {
    if (!user?.currentClubId) {
      Alert.alert(
        'Join a Club',
        'To access this feature, please join a club by reaching out to your ExComm or create a club under Settings.',
        [
          { text: 'Create Club', onPress: () => router.push('/create-club') },
          { text: 'OK', style: 'cancel' },
        ]
      );
      return;
    }
    router.push(featurePath as any);
  };

  const socialLinks = useMemo(() => {
    const links: { key: string; label: string; url: string }[] = [];
    if (!social) return links;
    const add = (key: string, label: string, raw: string | null) => {
      const u = normalizeExternalUrl(raw);
      if (u) links.push({ key, label, url: u });
    };
    add('web', 'Website', social.website_url);
    add('wa', 'WhatsApp', social.whatsapp_url);
    add('fb', 'Facebook', social.facebook_url);
    add('ig', 'Instagram', social.instagram_url);
    add('li', 'LinkedIn', social.linkedin_url);
    add('x', 'X / Twitter', social.twitter_url);
    add('yt', 'YouTube', social.youtube_url);
    return links;
  }, [social]);

  const profile = bundle?.clubData;
  const clubBannerColor = normalizeBannerColor(profile?.banner_color);
  const locationLines = [profile?.address, profile?.city, profile?.country]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  const locationText = locationLines.join(', ');
  const mapsUrl = normalizeExternalUrl(profile?.google_location_link ?? undefined);

  const meetingDayLabel = bundle?.meetingSchedule.meeting_day
    ? bundle.meetingSchedule.meeting_day
    : '—';
  const startT = bundle ? formatTime(bundle.meetingSchedule.meeting_start_time) : '';
  const endT = bundle ? formatTime(bundle.meetingSchedule.meeting_end_time) : '';
  const timeRange =
    startT && endT ? `${startT}–${endT}` : startT || endT || '—';

  const charterShort = bundle ? formatCharterDateShort(bundle.clubInfo.charter_date) : null;
  const clubNumberCharterLine = bundle
    ? [
        bundle.clubInfo.club_number ? `Club #${bundle.clubInfo.club_number}` : null,
        charterShort ? `Chartered ${charterShort}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const orgMetaLine = bundle
    ? [
        bundle.clubData.district?.trim()
          ? `District ${bundle.clubData.district.trim()}`
          : null,
        bundle.clubData.division?.trim()
          ? `Division ${bundle.clubData.division.trim()}`
          : null,
        bundle.clubData.area?.trim() ? `Area ${bundle.clubData.area.trim()}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const frequencyDisplay =
    bundle && formatMeetingFrequency(bundle.meetingSchedule.meeting_frequency)
      ? formatMeetingFrequency(bundle.meetingSchedule.meeting_frequency)!
      : '—';
  const formatDisplay =
    bundle && formatMeetingMode(bundle.meetingSchedule.meeting_type)
      ? formatMeetingMode(bundle.meetingSchedule.meeting_type)!
      : '—';
  const onlineMeetingUrl = bundle
    ? normalizeExternalUrl(bundle.meetingSchedule.online_meeting_link ?? undefined)
    : null;

  const meetingSecondaryLine = [frequencyDisplay, formatDisplay]
    .filter((s) => s && s !== '—')
    .join(' • ');
  const meetingSecondaryDisplay = meetingSecondaryLine.length > 0 ? meetingSecondaryLine : '—';
  const meetingA11yLabel = `Meeting. ${meetingDayLabel}, ${timeRange}. ${meetingSecondaryDisplay}.`;
  const timeZoneDisplay = bundle?.clubData.time_zone?.trim() || 'IST';
  const meetingDurationDisplay =
    formatMeetingDuration(bundle?.meetingSchedule.meeting_start_time, bundle?.meetingSchedule.meeting_end_time) || '—';

  const educationalHighlightRows = useMemo(
    () =>
      educationalSpeechesDelivered.map((r) => ({
        key: r.key,
        headline: r.speechTitle,
        personName: r.speakerName,
        avatarUrl: r.avatarUrl,
        meetingDateLabel: r.meetingDateLabel,
      })),
    [educationalSpeechesDelivered]
  );

  const toastmasterHighlightRows = useMemo(
    () =>
      toastmasterThemesDelivered.map((r) => ({
        key: r.key,
        headline: r.themeTitle,
        personName: r.toastmasterName,
        avatarUrl: r.avatarUrl,
        meetingDateLabel: r.meetingDateLabel,
      })),
    [toastmasterThemesDelivered]
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: C.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isAuthenticated ? (
          <Text style={styles.body} maxFontSizeMultiplier={1.3}>
            Please sign in to view your club.
          </Text>
        ) : user?.currentClubId ? (
          <>
            {landingLoading && !bundle ? (
              <View style={styles.loaderWrap}>
                <ActivityIndicator color={C.cta} />
                <Text style={styles.smallMuted} maxFontSizeMultiplier={1.2}>
                  Loading…
                </Text>
              </View>
            ) : bundle ? (
              <>
                {/* Notion-style single top card: club, about, meeting grid, location */}
                <View style={styles.clubTopSegment}>
                  <View style={styles.clubTopFlatBox}>
                    <View
                      style={[
                        styles.clubTopBlock,
                        clubBannerColor ? { backgroundColor: clubBannerColor } : null,
                      ]}
                    >
                    <Text
                      style={[styles.clubTopTitle, clubBannerColor ? styles.clubTopTitleOnBanner : null]}
                      maxFontSizeMultiplier={1.15}
                    >
                      {bundle.clubInfo.name}
                    </Text>
                    {clubNumberCharterLine ? (
                      <Text
                        style={[styles.clubTopMeta, clubBannerColor ? styles.clubTopMetaOnBanner : null]}
                        maxFontSizeMultiplier={1.1}
                      >
                        {clubNumberCharterLine}
                      </Text>
                    ) : null}
                    {orgMetaLine ? (
                      <Text
                        style={[styles.clubTopMeta, clubBannerColor ? styles.clubTopMetaOnBanner : null]}
                        maxFontSizeMultiplier={1.1}
                      >
                        {orgMetaLine}
                      </Text>
                    ) : null}
                    </View>

                    <View style={styles.clubTopDivider} />

                    <View style={styles.clubTopBlock}>
                    <Text style={styles.clubTopSectionTitle} maxFontSizeMultiplier={1.12}>Our Mission</Text>
                    <Text style={[styles.clubTopBody, styles.clubTopMissionBody]} maxFontSizeMultiplier={1.15}>
                      {(bundle.clubData.club_mission ?? '').trim() || DEFAULT_TOASTMASTERS_CLUB_MISSION}
                    </Text>
                    </View>

                    <View style={styles.clubTopDivider} />

                    <View style={styles.clubTopBlock}>
                    <Text style={styles.clubTopSectionTitle} maxFontSizeMultiplier={1.12}>Meeting Schedule</Text>
                    <View style={styles.scheduleGrid}>
                      <View style={styles.scheduleRowPair}>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#DBEAFE' }]}>
                              <CalendarDays size={18} color="#2563EB" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {meetingDayLabel}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#EDE9FE' }]}>
                              <RotateCcw size={18} color="#7C3AED" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {frequencyDisplay}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.scheduleRowPair}>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#DCFCE7' }]}>
                              <Clock3 size={18} color="#16A34A" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {timeRange}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#FEF3C7' }]}>
                              <Globe size={18} color="#D97706" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {timeZoneDisplay}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.scheduleRowPair}>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#FCE7F3' }]}>
                              <Clock size={18} color="#DB2777" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {meetingDurationDisplay}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scheduleCell}>
                          <View style={styles.scheduleRow}>
                            <View style={[styles.scheduleIconBox, { backgroundColor: '#E0F2FE' }]}>
                              <MapPin size={18} color="#0284C7" strokeWidth={2} />
                            </View>
                            <Text style={styles.scheduleRowText} maxFontSizeMultiplier={1.15}>
                              {formatDisplay}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    </View>

                    <View style={styles.clubTopDivider} />

                    <View style={styles.clubTopBlock}>
                    <Text style={styles.clubTopSectionTitle} maxFontSizeMultiplier={1.12}>Why Join?</Text>
                    {WHY_JOIN_ITEMS.map((item) => (
                      <View key={item.title} style={styles.whyJoinRow}>
                        <View style={styles.whyJoinIconBox}>
                          <Text style={styles.whyJoinIcon}>{item.icon}</Text>
                        </View>
                        <View style={styles.whyJoinTextCol}>
                          <Text style={styles.whyJoinTitle} maxFontSizeMultiplier={1.1}>{item.title}</Text>
                          <Text style={styles.whyJoinDesc} maxFontSizeMultiplier={1.1}>{item.desc}</Text>
                        </View>
                      </View>
                    ))}
                    </View>

                    <View style={styles.clubTopDivider} />

                    <View style={styles.clubTopBlock}>
                    <Text style={styles.clubTopSectionTitle} maxFontSizeMultiplier={1.12}>Location</Text>
                    <View style={styles.locationInnerBox}>
                      <Text style={styles.locationAddressText} maxFontSizeMultiplier={1.15}>
                        {locationText || '—'}
                      </Text>
                      {mapsUrl ? (
                        <TouchableOpacity
                          style={styles.locationMapsButton}
                          onPress={() => openUrl(mapsUrl)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.locationMapsButtonText} maxFontSizeMultiplier={1.12}>
                            Open in Maps
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {onlineMeetingUrl ? (
                      <TouchableOpacity
                        style={[styles.locationMapsButton, styles.notionOnlineButton]}
                        onPress={() => openUrl(onlineMeetingUrl)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.locationMapsButtonText} maxFontSizeMultiplier={1.12}>
                          Open online meeting link
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    </View>

                    {(excommPreview.length > 0 || membersPreview.length > 0) ? (
                      <>
                        <View style={styles.clubTopDivider} />
                        <View style={styles.clubTopBlock}>
                          {excommPreview.length > 0 ? (
                            <ExcommCarouselCard
                              variant="notion"
                              rows={excommPreview}
                              onSeeAll={() => handleFeaturePress('/executive-committee')}
                            />
                          ) : null}
                          {excommPreview.length > 0 && membersPreview.length > 0 ? (
                            <View style={styles.notionPeopleDivider} />
                          ) : null}
                          {membersPreview.length > 0 ? (
                            <MembersCarouselCard
                              variant="notion"
                              rows={membersPreview}
                              onViewAll={() => handleFeaturePress('/club-members')}
                              onViewMember={(id) =>
                                handleFeaturePress(`/member-profile?memberId=${encodeURIComponent(id)}` as any)
                              }
                            />
                          ) : null}
                        </View>
                      </>
                    ) : null}

                    {bundle ? (
                      <>
                        <View style={styles.clubTopDivider} />
                        <View style={styles.clubTopBlock}>
                          <ClubStatsStaticCard
                            variant="notion"
                            stats={clubStats}
                            selectedDays={clubStatsPeriodDays}
                            onSelectDays={setClubStatsPeriodDays}
                            loading={clubStatsLoading}
                          />
                        </View>
                      </>
                    ) : null}

                    {clubFaqItems.length > 0 ? (
                      <>
                        <View style={styles.clubTopDivider} />
                        <View style={styles.clubTopBlock}>
                          <ClubFaqHeroCard variant="notion" items={clubFaqItems} />
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>

                <View style={styles.clubTopFlatBox}>
                  <View style={styles.clubTopBlock}>
                    <MemoDeliveredHighlightCarousel
                      sectionTitle="Toastmaster & theme — last 6 months"
                      rows={toastmasterHighlightRows}
                      variant="toastmaster"
                      containerVariant="embedded"
                    />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoPreparedSpeechesHighlightCarousel rows={preparedSpeechesDelivered} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoDeliveredHighlightCarousel
                      sectionTitle="Educational speeches — last 6 months"
                      rows={educationalHighlightRows}
                      variant="educational"
                      containerVariant="embedded"
                    />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoClubWordOfTheDayCarousel rows={clubWotdRows} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <View style={styles.grammarianDualRow}>
                      <View style={styles.grammarianDualCol}>
                        <MemoGrammarianPublishedCarousel
                          title="Quote of the day"
                          rows={clubQuoteRows}
                          variant="embedded"
                        />
                      </View>
                      <View style={styles.grammarianDualCol}>
                        <MemoGrammarianPublishedCarousel
                          title="Idiom of the day"
                          rows={clubIdiomRows}
                          variant="embedded"
                        />
                      </View>
                    </View>
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoTimerMeetingWiseCarousel rows={timerMeetingWiseRows} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoAhCounterMeetingWiseCarousel rows={ahCounterMeetingWiseRows} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoTableTopicQuestionsCarousel rows={tableTopicQuestionRows} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                    <MemoGeneralEvaluatorScoringCarousel rows={generalEvaluatorScoringRows} variant="embedded" />
                  </View>
                  <View style={styles.clubTopDivider} />
                  <View style={styles.clubTopBlock}>
                  {/* Connect */}
                  <View style={styles.embeddedSection}>
                  <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
                    Connect
                  </Text>
                  {socialLinks.length > 0 ? (
                    <View style={styles.pillWrap}>
                      {socialLinks.map((s) => {
                        const Icon = socialIconForKey(s.key);
                        return (
                          <TouchableOpacity
                            key={s.key}
                            style={styles.socialIconPill}
                            onPress={() => openUrl(s.url)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={s.label}
                          >
                            <Icon size={20} color={C.text} strokeWidth={2} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.smallMuted} maxFontSizeMultiplier={1.2}>
                      No social links on file.
                    </Text>
                  )}
                </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.body} maxFontSizeMultiplier={1.2}>
                  We couldn’t load club details. Try again later.
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <View style={styles.noClubRow}>
              <View style={styles.noClubIcon}>
                <Building2 size={20} color={C.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bodyStrong} maxFontSizeMultiplier={1.2}>
                  No club
                </Text>
                <Text style={styles.smallMuted} maxFontSizeMultiplier={1.2}>
                  Join or create a club to get started.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const SECTION_GAP = 16;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  clubTopSegment: {
    marginBottom: SECTION_GAP,
  },
  clubTopFlatBox: {
    backgroundColor: C.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  clubTopBlock: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  clubTopDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  clubTopTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  clubTopTitleOnBanner: {
    color: '#FFFFFF',
  },
  clubTopMeta: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  clubTopMetaOnBanner: {
    color: 'rgba(255,255,255,0.92)',
  },
  clubTopSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  clubTopBody: {
    fontSize: 16,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 24,
  },
  clubTopMissionBody: {
    fontStyle: 'italic',
    fontSize: 14.4,
  },
  scheduleGrid: {
    marginTop: 2,
    gap: 10,
  },
  scheduleRowPair: {
    flexDirection: 'row',
    gap: 10,
  },
  scheduleCell: {
    flex: 1,
    minWidth: 0,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  scheduleRowText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: C.textSecondary,
    lineHeight: 16,
  },
  scheduleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clubTopBodySpaced: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 24,
  },
  whyJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  whyJoinIconBox: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: '#0D4D7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  whyJoinIcon: {
    fontSize: 14,
  },
  whyJoinTextCol: {
    flex: 1,
  },
  whyJoinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    lineHeight: 19,
  },
  whyJoinDesc: {
    marginTop: 1,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  locationInnerBox: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  /** ~20% smaller than clubTopBody for Location block only */
  locationAddressText: {
    fontSize: 12.8,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 19.2,
  },
  locationMapsButton: {
    backgroundColor: C.cta,
    borderRadius: 0,
    paddingVertical: 11,
    paddingHorizontal: 13,
    alignItems: 'center',
    marginTop: 13,
  },
  locationMapsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notionOnlineButton: {
    marginTop: 11,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: SECTION_GAP,
  },
  embeddedSection: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
    padding: 0,
    marginBottom: 0,
  },
  grammarianHighlightCard: {
    padding: 18,
    minHeight: 220,
  },
  notionPeopleCard: {
    backgroundColor: C.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: SECTION_GAP,
  },
  notionPeopleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  clubStatsPeriod: {
    fontSize: 13,
    fontWeight: '400',
    color: C.textSecondary,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  clubStatsChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    marginBottom: 10,
    gap: 8,
  },
  clubStatsChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.chipBg,
  },
  clubStatsChipActive: {
    backgroundColor: C.text,
    borderColor: C.text,
  },
  clubStatsChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSecondary,
  },
  clubStatsChipTextActive: {
    color: '#FFFFFF',
  },
  clubStatsGrid: {
    gap: 10,
  },
  clubStatsGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  clubStatsBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 104,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 0,
    backgroundColor: C.tileBg,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubStatsBoxLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  clubStatsBoxValue: {
    fontSize: 28,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.5,
  },
  clubStatsGridLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  grammarianClubDayLead: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    lineHeight: 22,
    marginTop: 2,
  },
  grammarianClubDayMeaning: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },
  wotdCarouselSlide: {
    overflow: 'hidden',
    minHeight: 98,
    paddingVertical: 6,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  wotdPartOfSpeech: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    color: C.textMuted,
    marginTop: 4,
  },
  wotdUsage: {
    fontSize: 13,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
  wotdMeetingDate: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    marginTop: 10,
  },
  faqHeroCard: {
    paddingVertical: 4,
  },
  faqHeroNotion: {
    paddingVertical: 4,
  },
  faqHeroCarouselInner: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    minHeight: 72,
    paddingBottom: 4,
  },
  faqHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  faqHeroIconWrap: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  faqHeroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  faqHeroBottomRule: {
    marginTop: 4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    alignSelf: 'stretch',
  },
  faqHeroQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    textAlign: 'left',
    lineHeight: 21,
    marginBottom: 6,
  },
  faqHeroAnswer: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textSecondary,
    textAlign: 'left',
    lineHeight: 20,
  },
  preparedSpeechSlide: {
    paddingVertical: 10,
    minHeight: 140,
    overflow: 'hidden',
  },
  preparedTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.chipBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  preparedTableHeadText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  preparedTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 56,
  },
  preparedTableScroll: {
    maxHeight: 448,
  },
  preparedTableScrollContent: {
    paddingBottom: 2,
  },
  preparedTableCellText: {
    fontSize: 13,
    color: C.text,
    lineHeight: 18,
  },
  preparedPathwayMeta: {
    marginTop: 2,
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 16,
    fontWeight: '500',
  },
  preparedCell: {
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  preparedCellDivider: {
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  preparedColName: {
    flex: 1.1,
    paddingRight: 8,
  },
  preparedColSpeech: {
    flex: 1.4,
    paddingRight: 8,
  },
  preparedColPathway: {
    flex: 1.5,
  },
  preparedSpeechColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  preparedSpeechLeft: {
    width: 108,
    alignItems: 'center',
  },
  preparedSpeechAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  preparedSpeechAvatarPh: {
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  preparedSpeechInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: C.textSecondary,
  },
  preparedSpeechSpeakerName: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
    width: '100%',
  },
  preparedSpeechDate: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textMuted,
    textAlign: 'center',
  },
  preparedSpeechRight: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  preparedSpeechTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    textAlign: 'left',
    lineHeight: 22,
    marginBottom: 12,
  },
  preparedSpeechPathwayLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  preparedSpeechPathwayLine: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textSecondary,
    textAlign: 'left',
    lineHeight: 20,
  },
  preparedSpeechPathwayLineMuted: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textMuted,
    textAlign: 'left',
  },
  edSpeechSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 200,
    overflow: 'hidden',
    alignSelf: 'stretch',
    width: '100%',
  },
  edSpeechTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  edSpeechPathwayBlock: {
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 12,
    width: '100%',
  },
  edSpeechFieldLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  edSpeechPathwayValue: {
    fontSize: 14,
    fontWeight: '500',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  edSpeechAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
  },
  edSpeechAvatarPh: {
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  edSpeechInitial: {
    fontSize: 26,
    fontWeight: '600',
    color: C.textSecondary,
  },
  edSpeechName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  edSpeechDate: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textSecondary,
    textAlign: 'center',
  },
  highlightControlsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  highlightArrowButton: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.chipBg,
  },
  highlightControlsText: {
    fontSize: 12,
    fontWeight: '500',
    color: C.textSecondary,
    minWidth: 52,
    textAlign: 'center',
  },
  tableTopicQuestionText: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
    lineHeight: 26,
    marginTop: 4,
  },
  tableTopicQuestionDate: {
    marginTop: 12,
    fontSize: 13,
    color: C.textSecondary,
    fontWeight: '500',
  },
  addedByText: {
    marginTop: 4,
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  geScoreLine: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textAlign: 'center',
  },
  geStarRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  geOverallScoreLine: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: C.textSecondary,
    textAlign: 'center',
  },
  timerTableWrap: {
    marginTop: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 0,
    overflow: 'hidden',
  },
  timerTableHeadRow: {
    flexDirection: 'row',
    backgroundColor: C.chipBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  timerTableHeadCell: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  timerTableBodyRow: {
    flexDirection: 'row',
  },
  timerTableRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  timerTableBodyCell: {
    fontSize: 13,
    color: C.text,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  timerTableColCategory: {
    flex: 2.2,
  },
  timerTableColCount: {
    flex: 1,
    textAlign: 'center',
  },
  ahWordsWrap: {
    marginTop: 10,
    width: '100%',
    gap: 8,
  },
  ahWordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ahWordLabelWrap: {
    width: 90,
  },
  ahWordLabel: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  ahWordBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.chipBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 0,
    overflow: 'hidden',
  },
  ahWordBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  ahWordCount: {
    width: 28,
    textAlign: 'right',
    fontSize: 12,
    color: C.text,
    fontWeight: '600',
  },
  sectionTitleInRow: {
    marginBottom: 0,
    flex: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  aboutBody: {
    fontSize: 15,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  aboutPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textMuted,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialIconPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.chipBg,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLinkSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSecondary,
  },
  grammarianDualRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  grammarianDualCol: {
    flex: 1,
    minWidth: 280,
  },
  excommSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 172,
    overflow: 'hidden',
  },
  excommDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingBottom: 4,
  },
  excommDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
  },
  excommDotActive: {
    backgroundColor: C.textSecondary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  excommRole: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  excommAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  excommAvatarPlaceholder: {
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  excommInitial: {
    fontSize: 28,
    fontWeight: '600',
    color: C.textSecondary,
  },
  excommName: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    textAlign: 'center',
  },
  memberPairSlide: {
    minHeight: 188,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberPairRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  memberTileFlex: {
    flex: 1,
    minWidth: 0,
  },
  memberPairSpacer: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  memberTile: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    alignItems: 'center',
  },
  memberTileNotion: {
    borderRadius: 0,
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 8,
  },
  memberAvatarPh: {
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  memberInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: C.textSecondary,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    textAlign: 'center',
    minHeight: 32,
    marginBottom: 4,
  },
  memberRoleTag: {
    fontSize: 10,
    fontWeight: '500',
    color: C.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  memberViewBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: C.card,
  },
  memberViewBtnNotion: {
    borderRadius: 0,
  },
  memberViewBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.cta,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 22,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    marginBottom: 4,
  },
  smallMuted: {
    fontSize: 13,
    fontWeight: '400',
    color: C.textMuted,
  },
  noClubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noClubIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.chipBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

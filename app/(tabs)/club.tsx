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
  CircleHelp,
  Globe,
  Link as LinkIcon,
  Instagram,
  Lightbulb,
  Linkedin,
  MessageCircle,
  Mic2,
  Facebook,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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

/** Web: defer offscreen images; async decode. Native: no-op spread. */
function webImageExtra(lazy: boolean): Record<string, string> {
  if (Platform.OS !== 'web') return {};
  return { loading: lazy ? 'lazy' : 'eager', decoding: 'async' };
}

const EXCOMM_CAROUSEL_MS = 3000;
const MEMBERS_CAROUSEL_MS = 2000;
const ED_SPEECH_CAROUSEL_MS = 3500;
/** Word of the day: cycle published entries from last 6 months */
const CLUB_WOTD_CAROUSEL_MS = 4000;
/** Quote / idiom carousels on Club tab */
const CLUB_GRAMMARIAN_CAROUSEL_MS = 4000;
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
        {row.member.avatar_url ? (
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
        {m.avatar_url ? (
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
      .select('id, quote, meaning, usage, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);
    if (error || !data?.length) {
      if (error) console.warn('Club quotes of the day:', error.message);
      return [];
    }
    const meetingDateOf = (r: (typeof data)[number]) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };
    const mapped = data
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
      .select('id, idiom, meaning, usage, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);
    if (error || !data?.length) {
      if (error) console.warn('Club idioms of the day:', error.message);
      return [];
    }
    const meetingDateOf = (r: (typeof data)[number]) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };
    const mapped = data
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
};

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
      .select('id, word, meaning, part_of_speech, usage, app_club_meeting(meeting_date)')
      .eq('club_id', clubId)
      .eq('is_published', true)
      .limit(120);

    if (error || !data?.length) {
      if (error) console.warn('Club words of the day:', error.message);
      return [];
    }

    const meetingDateOf = (r: (typeof data)[number]) => {
      const m = r.app_club_meeting as { meeting_date?: string } | { meeting_date?: string }[] | null;
      if (Array.isArray(m)) return m[0]?.meeting_date ?? '';
      return m?.meeting_date ?? '';
    };

    const mapped = data
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

function ClubFaqHeroCard({ items }: { items: ClubFaqHeroRow[] }) {
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

  if (!items.length) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const row = items[safeIndex];
  const { Icon, color } = FAQ_ROW_ICONS[safeIndex % FAQ_ROW_ICONS.length];

  return (
    <View style={[styles.card, styles.faqHeroCard]}>
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
  intervalMs,
}: {
  title: string;
  rows: GrammarianPublishedCarouselRow[];
  intervalMs: number;
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const nRef = useRef(rows.length);
  nRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    translateY.setValue(0);
  }, [rows, opacity, translateY]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % nRef.current);
        translateY.setValue(24);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 72,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, intervalMs);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [rows.length, opacity, translateY, intervalMs]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>

      <Animated.View
        style={[
          styles.wotdCarouselSlide,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
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
      </Animated.View>
    </View>
  );
}

function ClubWordOfTheDayCarousel({ rows }: { rows: ClubWotdCarouselRow[] }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const nRef = useRef(rows.length);
  nRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    translateY.setValue(0);
  }, [rows, opacity, translateY]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % nRef.current);
        translateY.setValue(24);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 72,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, CLUB_WOTD_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [rows.length, opacity, translateY]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Word of the day
      </Text>

      <Animated.View
        style={[
          styles.wotdCarouselSlide,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
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
      </Animated.View>
    </View>
  );
}

/** Prepared speeches: two-column layout; transition = scale + crossfade (distinct from Toastmaster / Educational). */
function PreparedSpeechesHighlightCarousel({ rows }: { rows: PreparedSpeechDeliveredRow[] }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    scale.setValue(1);
  }, [rows, opacity, scale]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        scale.setValue(1.05);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 7,
            tension: 78,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, ED_SPEECH_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [rows.length, opacity, scale]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const pathwayNameT = row.pathwayName.trim();
  const hasPathway = pathwayNameT.length > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Prepared speeches — last 6 months
      </Text>

      <Animated.View
        style={[styles.preparedSpeechSlide, { opacity, transform: [{ scale }] }]}
        accessibilityRole="summary"
        accessibilityLabel={`${row.speechTitle}${
          hasPathway ? `. Pathway: ${pathwayNameT}` : ''
        }. ${row.speakerName}. ${row.meetingDateLabel}`}
      >
        <View style={styles.preparedSpeechColumns}>
          <View style={styles.preparedSpeechLeft}>
            {row.avatarUrl ? (
              <Image
                source={{ uri: avatarUrlForDisplay(row.avatarUrl, 128) ?? row.avatarUrl }}
                style={styles.preparedSpeechAvatar}
                resizeMode="cover"
                {...webImageExtra(true)}
              />
            ) : (
              <View style={[styles.preparedSpeechAvatar, styles.preparedSpeechAvatarPh]}>
                <Text style={styles.preparedSpeechInitial} maxFontSizeMultiplier={1.15}>
                  {(row.speakerName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.preparedSpeechSpeakerName} numberOfLines={2} maxFontSizeMultiplier={1.12}>
              {row.speakerName}
            </Text>
            <Text style={styles.preparedSpeechDate} maxFontSizeMultiplier={1.08}>
              {row.meetingDateLabel}
            </Text>
          </View>

          <View style={styles.preparedSpeechRight}>
            <Text style={styles.preparedSpeechTitle} numberOfLines={4} maxFontSizeMultiplier={1.12}>
              {row.speechTitle}
            </Text>
            <Text style={styles.preparedSpeechPathwayLabel} maxFontSizeMultiplier={1.05}>
              Pathway
            </Text>
            {hasPathway ? (
              <Text style={styles.preparedSpeechPathwayLine} numberOfLines={3} maxFontSizeMultiplier={1.1}>
                {pathwayNameT}
              </Text>
            ) : (
              <Text style={styles.preparedSpeechPathwayLineMuted} maxFontSizeMultiplier={1.08}>
                —
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function DeliveredHighlightCarousel({
  sectionTitle,
  subtitle,
  rows,
  variant,
}: {
  sectionTitle: string;
  subtitle?: string;
  rows: DeliveredHighlightRow[];
  /** Toastmaster: horizontal slide; Educational: vertical slide. */
  variant: 'toastmaster' | 'educational';
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [rows, opacity, translateX, translateY]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advanceToastmaster = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -36,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        translateX.setValue(36);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 76,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const advanceEducational = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -22,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        translateY.setValue(26);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 72,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const advance = variant === 'toastmaster' ? advanceToastmaster : advanceEducational;
    const id = setInterval(advance, ED_SPEECH_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
    };
  }, [rows.length, opacity, translateX, translateY, variant]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        {sectionTitle}
      </Text>
      {subtitle ? (
        <Text style={styles.clubStatsPeriod} maxFontSizeMultiplier={1.15}>
          {subtitle}
        </Text>
      ) : null}

      <Animated.View
        style={[
          styles.edSpeechSlide,
          {
            opacity,
            transform:
              variant === 'toastmaster' ? [{ translateX }] : [{ translateY }],
          },
        ]}
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
        {row.avatarUrl ? (
          <Image
            source={{ uri: avatarUrlForDisplay(row.avatarUrl, 144) ?? row.avatarUrl }}
            style={styles.edSpeechAvatar}
            resizeMode="cover"
            {...webImageExtra(true)}
          />
        ) : (
          <View style={[styles.edSpeechAvatar, styles.edSpeechAvatarPh]}>
            <Text style={styles.edSpeechInitial} maxFontSizeMultiplier={1.2}>
              {(row.personName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.edSpeechName} maxFontSizeMultiplier={1.15}>
          {row.personName}
        </Text>
        <Text style={styles.edSpeechDate} maxFontSizeMultiplier={1.1}>
          {row.meetingDateLabel}
        </Text>
      </Animated.View>
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
}: {
  stats: ClubStatsCounts | null;
  selectedDays: number;
  onSelectDays: (days: number) => void;
  loading: boolean;
}) {
  const slides = stats ? clubStatsSlides(stats) : clubStatsSlides(emptyClubStats());

  return (
    <View style={styles.card}>
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

export default function MyClub() {
  const { user, isAuthenticated } = useAuth();
  const [bundle, setBundle] = useState<ClubInfoManagementBundle | null>(null);
  const [social, setSocial] = useState<ClubSocialUrlsRow | null>(null);
  const [excommPreview, setExcommPreview] = useState<ExcommPreviewRow[]>([]);
  const [membersPreview, setMembersPreview] = useState<MemberPreview[]>([]);
  const [clubStatsPeriodDays, setClubStatsPeriodDays] = useState(180);
  const [clubStats, setClubStats] = useState<ClubStatsCounts | null>(null);
  const [clubStatsLoading, setClubStatsLoading] = useState(false);
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
  const [landingLoading, setLandingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user?.currentClubId) {
      setBundle(null);
      setSocial(null);
      setExcommPreview([]);
      setMembersPreview([]);
      setEducationalSpeechesDelivered([]);
      setToastmasterThemesDelivered([]);
      setPreparedSpeechesDelivered([]);
      setClubFaqItems([]);
      setClubQuoteRows([]);
      setClubIdiomRows([]);
      setClubWotdRows([]);
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

    const runCritical = async () => {
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
      try {
        const [edSpeeches, tmThemes, prepSpeeches, faqRes, quoteRows, idiomRows, wotdRows] =
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
          ]);
        if (cancelled) return;
        setEducationalSpeechesDelivered(edSpeeches);
        setToastmasterThemesDelivered(tmThemes);
        setPreparedSpeechesDelivered(prepSpeeches);
        if (faqRes.error) {
          console.warn('Club FAQ load:', faqRes.error.message);
          setClubFaqItems([]);
        } else {
          setClubFaqItems(
            (faqRes.data ?? [])
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
        }
      }
    };

    void runCritical();
    const secondaryTimer = setTimeout(() => {
      void runSecondary();
    }, 1400);

    return () => {
      cancelled = true;
      clearTimeout(secondaryTimer);
    };
  }, [user?.currentClubId]);

  useEffect(() => {
    const clubId = user?.currentClubId;
    if (!clubId) {
      setClubStats(null);
      setClubStatsLoading(false);
      return;
    }
    let cancelled = false;
    const statsTimer = setTimeout(() => {
      (async () => {
        if (!clubStats) setClubStatsLoading(true);
        try {
          const s = await fetchClubStatsRollingDays(clubId, clubStatsPeriodDays);
          if (!cancelled) setClubStats(s);
        } catch {
          if (!cancelled) setClubStats(emptyClubStats());
        } finally {
          if (!cancelled) setClubStatsLoading(false);
        }
      })();
    }, 1800);
    return () => {
      cancelled = true;
      clearTimeout(statsTimer);
    };
  }, [user?.currentClubId, clubStatsPeriodDays]);

  useEffect(() => {
    // Keep skeleton visible only when we truly have no data.
    if (clubStats && clubStatsLoading) {
      setClubStatsLoading(false);
    }
  }, [clubStats, clubStatsLoading]);

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

  const socialLinks: { key: string; label: string; url: string }[] = [];
  if (social) {
    const add = (key: string, label: string, raw: string | null) => {
      const u = normalizeExternalUrl(raw);
      if (u) socialLinks.push({ key, label, url: u });
    };
    add('web', 'Website', social.website_url);
    add('wa', 'WhatsApp', social.whatsapp_url);
    add('fb', 'Facebook', social.facebook_url);
    add('ig', 'Instagram', social.instagram_url);
    add('li', 'LinkedIn', social.linkedin_url);
    add('x', 'X / Twitter', social.twitter_url);
    add('yt', 'YouTube', social.youtube_url);
  }

  const profile = bundle?.clubData;
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
                <View style={styles.notionTopCard}>
                  <View style={styles.notionTitleWrap}>
                    <Text
                      style={styles.notionTitle}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.38}
                      maxFontSizeMultiplier={1.12}
                      {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
                    >
                      {bundle.clubInfo.name}
                    </Text>
                  </View>
                  {clubNumberCharterLine ? (
                    <Text style={styles.notionMetaLine} maxFontSizeMultiplier={1.2}>
                      {clubNumberCharterLine}
                    </Text>
                  ) : null}
                  {orgMetaLine ? (
                    <Text style={[styles.notionMetaLine, styles.notionMetaLineTight]} maxFontSizeMultiplier={1.2}>
                      {orgMetaLine}
                    </Text>
                  ) : null}

                  <View style={styles.notionDivider} />

                  <Text style={styles.notionSectionLabel} maxFontSizeMultiplier={1.15}>
                    About
                  </Text>
                  <Text style={styles.notionAboutBody} maxFontSizeMultiplier={1.25}>
                    {(bundle.clubData.club_mission ?? '').trim() ||
                      DEFAULT_TOASTMASTERS_CLUB_MISSION}
                  </Text>

                  <View style={styles.notionDivider} />

                  <View
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={meetingA11yLabel}
                  >
                    <Text style={styles.notionMeetingBlockLabel} maxFontSizeMultiplier={1.15}>
                      Meeting
                    </Text>
                    <Text style={styles.notionMeetingPrimaryLine} maxFontSizeMultiplier={1.2}>
                      <Text style={styles.notionMeetingDay}>{meetingDayLabel}</Text>
                      <Text style={styles.notionMeetingPrimarySep}> • </Text>
                      <Text style={styles.notionMeetingTime}>{timeRange}</Text>
                    </Text>
                    <Text style={styles.notionMeetingSecondaryLine} maxFontSizeMultiplier={1.18}>
                      {meetingSecondaryDisplay}
                    </Text>
                  </View>

                  <View style={styles.notionDivider} />

                  <Text style={styles.notionSectionLabel} maxFontSizeMultiplier={1.15}>
                    Location
                  </Text>
                  <View style={styles.notionLocationShell}>
                    <View style={styles.notionLocationBody}>
                      <Text style={styles.notionAddress} maxFontSizeMultiplier={1.2}>
                        {locationText || '—'}
                      </Text>
                      {mapsUrl ? (
                        <TouchableOpacity
                          style={styles.notionMapsButton}
                          onPress={() => openUrl(mapsUrl)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.notionMapsButtonText} maxFontSizeMultiplier={1.12}>
                            Open in Maps
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  {onlineMeetingUrl ? (
                    <TouchableOpacity
                      style={[styles.notionMapsButton, styles.notionOnlineButton]}
                      onPress={() => openUrl(onlineMeetingUrl)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.notionMapsButtonText} maxFontSizeMultiplier={1.12}>
                        Open online meeting link
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {excommPreview.length > 0 || membersPreview.length > 0 ? (
                  <View style={styles.notionPeopleCard}>
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
                ) : null}

                {bundle ? (
                  <ClubStatsStaticCard
                    stats={clubStats}
                    selectedDays={clubStatsPeriodDays}
                    onSelectDays={setClubStatsPeriodDays}
                    loading={clubStatsLoading}
                  />
                ) : null}

                {clubFaqItems.length > 0 ? <ClubFaqHeroCard items={clubFaqItems} /> : null}

                {toastmasterHighlightRows.length > 0 ? (
                  <DeliveredHighlightCarousel
                    sectionTitle="Toastmaster & theme — last 6 months"
                    rows={toastmasterHighlightRows}
                    variant="toastmaster"
                  />
                ) : null}

                {preparedSpeechesDelivered.length > 0 ? (
                  <PreparedSpeechesHighlightCarousel rows={preparedSpeechesDelivered} />
                ) : null}

                {educationalHighlightRows.length > 0 ? (
                  <DeliveredHighlightCarousel
                    sectionTitle="Educational speeches — last 6 months"
                    rows={educationalHighlightRows}
                    variant="educational"
                  />
                ) : null}

                {clubWotdRows.length > 0 ? <ClubWordOfTheDayCarousel rows={clubWotdRows} /> : null}

                {clubQuoteRows.length > 0 ? (
                  <GrammarianPublishedCarousel
                    title="Quote of the day"
                    rows={clubQuoteRows}
                    intervalMs={CLUB_GRAMMARIAN_CAROUSEL_MS}
                  />
                ) : null}

                {clubIdiomRows.length > 0 ? (
                  <GrammarianPublishedCarousel
                    title="Idiom of the day"
                    rows={clubIdiomRows}
                    intervalMs={CLUB_GRAMMARIAN_CAROUSEL_MS}
                  />
                ) : null}

                {/* Connect */}
                <View style={styles.card}>
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
  notionTopCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    marginBottom: SECTION_GAP,
  },
  notionTitleWrap: {
    width: '100%',
    minHeight: 26,
  },
  notionTitle: {
    width: '100%',
    fontSize: 21,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.3,
  },
  notionMetaLine: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textSecondary,
    marginTop: 10,
    lineHeight: 20,
  },
  notionMetaLineTight: {
    marginTop: 6,
  },
  notionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 20,
  },
  notionSectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  notionAboutBody: {
    fontSize: 15,
    fontWeight: '400',
    color: C.text,
    lineHeight: 24,
  },
  notionMeetingBlockLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  notionMeetingPrimaryLine: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  notionMeetingDay: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4F46E5',
  },
  notionMeetingPrimarySep: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
  },
  notionMeetingTime: {
    fontSize: 18,
    fontWeight: '600',
    color: C.text,
  },
  notionMeetingSecondaryLine: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    color: C.textSecondary,
    lineHeight: 18,
  },
  notionLocationShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
  },
  notionLocationBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  notionAddress: {
    fontSize: 15,
    fontWeight: '400',
    color: C.text,
    lineHeight: 22,
  },
  notionMapsButton: {
    backgroundColor: C.cta,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  notionMapsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  notionOnlineButton: {
    marginTop: 14,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: SECTION_GAP,
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
    fontWeight: '500',
    color: C.textMuted,
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
    borderRadius: 8,
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
    borderRadius: 12,
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
    minHeight: 88,
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

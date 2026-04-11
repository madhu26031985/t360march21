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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Calendar, Clock, MapPin, RefreshCw } from 'lucide-react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchClubInfoManagementBundle,
  type ClubInfoManagementBundle,
} from '@/lib/clubInfoManagementQuery';

const EXCOMM_CAROUSEL_MS = 3000;
const MEMBERS_CAROUSEL_MS = 2000;
const CLUB_STATS_CAROUSEL_MS = 2000;
const ED_SPEECH_CAROUSEL_MS = 3500;
/** Club FAQ hero: longer hold so question + answer can be read */
const CLUB_FAQ_CAROUSEL_MS = 4800;
/** Word of the day: cycle published entries from last 6 months */
const CLUB_WOTD_CAROUSEL_MS = 4000;
/** Quote / idiom carousels on Club tab */
const CLUB_GRAMMARIAN_CAROUSEL_MS = 4000;
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
  mapPlaceholder: '#E8EDF3',
};

type ClubSocialRow = {
  facebook_url: string | null;
  twitter_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  whatsapp_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
};

type ExcommPreviewRow = {
  key: string;
  title: string;
  member: { id: string; full_name: string; avatar_url: string | null };
};

type MemberPreviewClubRole = 'member' | 'visiting_tm' | 'guest';

type MemberPreview = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  clubRole: MemberPreviewClubRole;
};

type ClubFaqHeroRow = {
  id: string;
  question: string;
  answer: string;
};

const PREVIEW_ROLES = ['member', 'visiting_tm', 'guest'] as const;

function normalizePreviewRole(role: string | null | undefined): MemberPreviewClubRole {
  if (role === 'visiting_tm') return 'visiting_tm';
  if (role === 'guest') return 'guest';
  return 'member';
}

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

const EXCOMM_ROLE_KEYS: { key: string; title: string }[] = [
  { key: 'president', title: 'President' },
  { key: 'vpe', title: 'VP Education' },
  { key: 'vpm', title: 'VP Membership' },
  { key: 'vppr', title: 'VP Public Relations' },
  { key: 'secretary', title: 'Secretary' },
  { key: 'treasurer', title: 'Treasurer' },
  { key: 'saa', title: 'Sergeant at Arms' },
  { key: 'ipp', title: 'Immediate Past President' },
];

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

type SocialFaIconStyle = 'brand' | 'solid';

function socialIconForKey(key: string): { name: string; iconStyle: SocialFaIconStyle } {
  switch (key) {
    case 'web':
      return { name: 'globe', iconStyle: 'solid' };
    case 'wa':
      return { name: 'whatsapp', iconStyle: 'brand' };
    case 'fb':
      return { name: 'facebook', iconStyle: 'brand' };
    case 'ig':
      return { name: 'instagram', iconStyle: 'brand' };
    case 'li':
      return { name: 'linkedin', iconStyle: 'brand' };
    case 'x':
      return { name: 'x-twitter', iconStyle: 'brand' };
    case 'yt':
      return { name: 'youtube', iconStyle: 'brand' };
    default:
      return { name: 'link', iconStyle: 'solid' };
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
}: {
  rows: ExcommPreviewRow[];
  onSeeAll: () => void;
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
    <View style={styles.card}>
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
          <Image source={{ uri: row.member.avatar_url }} style={styles.excommAvatar} resizeMode="cover" />
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
}: {
  rows: MemberPreview[];
  onViewAll: () => void;
  onViewMember: (memberId: string) => void;
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
    return (
      <View style={[styles.memberTile, styles.memberTileFlex, { backgroundColor: C.tileBg }]}>
        {m.avatar_url ? (
          <Image source={{ uri: m.avatar_url }} style={styles.memberAvatar} resizeMode="cover" />
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
          style={styles.memberViewBtn}
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
    <View style={styles.card}>
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

async function fetchExcommPreview(clubId: string): Promise<ExcommPreviewRow[]> {
  const { data: profile, error } = await supabase
    .from('club_profiles')
    .select(
      'president_id, vpe_id, vpm_id, vppr_id, secretary_id, treasurer_id, saa_id, ipp_id'
    )
    .eq('club_id', clubId)
    .maybeSingle();

  if (error || !profile) return [];

  const p = profile as Record<string, string | null>;
  const slots = EXCOMM_ROLE_KEYS.map((r) => ({
    key: r.key,
    title: r.title,
    userId: p[`${r.key}_id`] ?? null,
  })).filter((s) => s.userId);

  if (slots.length === 0) return [];

  const ids = slots.map((s) => s.userId as string);
  const { data: people, error: pe } = await supabase
    .from('app_user_profiles')
    .select('id, full_name, avatar_url')
    .in('id', ids);

  if (pe || !people?.length) return [];

  return slots
    .map((s) => {
      const m = people.find((x) => x.id === s.userId);
      if (!m) return null;
      return {
        key: s.key,
        title: s.title,
        member: {
          id: m.id,
          full_name: m.full_name ?? 'Member',
          avatar_url: m.avatar_url ?? null,
        },
      };
    })
    .filter(Boolean) as ExcommPreviewRow[];
}

async function fetchMembersPreview(clubId: string, limit: number): Promise<MemberPreview[]> {
  const { data, error } = await supabase
    .from('app_club_user_relationship')
    .select(
      `
      role,
      app_user_profiles (
        id,
        full_name,
        avatar_url
      )
    `
    )
    .eq('club_id', clubId)
    .eq('is_authenticated', true)
    .in('role', [...PREVIEW_ROLES])
    .limit(80);

  if (error || !data?.length) return [];

  const byId = new Map<string, MemberPreview>();
  for (const row of data) {
    const r = row as {
      role: string;
      app_user_profiles: { id: string; full_name: string; avatar_url: string | null } | null;
    };
    const prof = r.app_user_profiles;
    if (!prof?.id) continue;
    const clubRole = normalizePreviewRole(r.role);
    if (!byId.has(prof.id)) {
      byId.set(prof.id, {
        id: prof.id,
        full_name: prof.full_name ?? 'Member',
        avatar_url: prof.avatar_url ?? null,
        clubRole,
      });
    }
  }

  const rows = Array.from(byId.values());
  rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return rows.slice(0, limit);
}

type ClubStatsLast6Months = {
  speeches: number;
  educationalSpeeches: number;
  tableTopicSpeeches: number;
  meetingsConducted: number;
  themes: number;
  evaluations: number;
};

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

/** Club-wide counts from completed roles / meetings in the rolling last 6 calendar months. */
async function fetchClubStatsLast6Months(clubId: string): Promise<ClubStatsLast6Months> {
  const empty: ClubStatsLast6Months = {
    speeches: 0,
    educationalSpeeches: 0,
    tableTopicSpeeches: 0,
    meetingsConducted: 0,
    themes: 0,
    evaluations: 0,
  };

  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    const meetingDateEnd = formatLocalYmd(end);
    const meetingDateStart = formatLocalYmd(start);
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
      .limit(400);
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
      .limit(400);
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
      .limit(400);

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
  /** Pathway name line (e.g. Presentation Mastery). */
  pathwayName: string;
  /** Second line: Level N · project (no pathway repeat). */
  pathwayDetail: string;
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
      const detailParts: string[] = [];
      if (r.level != null) detailParts.push(`Level ${r.level}`);
      const proj = r.project_name?.trim();
      if (proj && proj !== r.speechTitle.trim()) detailParts.push(proj);
      const pathwayDetail = detailParts.join(' · ');

      return {
        key: r.key,
        speechTitle: r.speechTitle,
        pathwayName,
        pathwayDetail,
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

function ClubFaqHeroCard({ items }: { items: ClubFaqHeroRow[] }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const nRef = useRef(items.length);
  nRef.current = items.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
    scale.setValue(1);
  }, [items, opacity, scale]);

  useEffect(() => {
    if (items.length <= 1) return;

    const advance = () => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % nRef.current);
        scale.setValue(1.04);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 7,
            tension: 76,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const id = setInterval(advance, CLUB_FAQ_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [items.length, opacity, scale]);

  if (!items.length) return null;

  const safeIndex = Math.min(index, items.length - 1);
  const row = items[safeIndex];

  return (
    <View style={[styles.card, styles.faqHeroCard]}>
      <Text style={[styles.sectionTitle, styles.faqHeroSectionTitle]} maxFontSizeMultiplier={1.2}>
        Club FAQ
      </Text>

      <Animated.View
        style={[
          styles.faqHeroSlide,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`${row.question}. ${row.answer}`}
      >
        <Text style={styles.faqHeroQuestion} maxFontSizeMultiplier={1.12}>
          {row.question}
        </Text>
        <Text style={styles.faqHeroAnswer} maxFontSizeMultiplier={1.1}>
          {row.answer}
        </Text>
      </Animated.View>
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

/** Prepared speeches: two-column layout (speaker + date | title + pathway), same fade carousel as other highlights. */
function PreparedSpeechesHighlightCarousel({ rows }: { rows: PreparedSpeechDeliveredRow[] }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
  }, [rows, opacity]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    };

    const id = setInterval(advance, ED_SPEECH_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
    };
  }, [rows.length, opacity]);

  if (!rows.length) return null;

  const safeIndex = Math.min(index, rows.length - 1);
  const row = rows[safeIndex];
  const pathwayNameT = row.pathwayName.trim();
  const pathwayDetailT = row.pathwayDetail.trim();
  const hasPathway = pathwayNameT.length > 0 || pathwayDetailT.length > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Prepared speeches — last 6 months
      </Text>
      <Text style={styles.clubStatsPeriod} maxFontSizeMultiplier={1.15}>
        Completed roles with a recorded speech title
      </Text>

      <Animated.View
        style={[styles.preparedSpeechSlide, { opacity }]}
        accessibilityRole="summary"
        accessibilityLabel={`${row.speechTitle}. ${row.speakerName}. ${row.meetingDateLabel}`}
      >
        <View style={styles.preparedSpeechColumns}>
          <View style={styles.preparedSpeechLeft}>
            {row.avatarUrl ? (
              <Image
                source={{ uri: row.avatarUrl }}
                style={styles.preparedSpeechAvatar}
                resizeMode="cover"
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
              <>
                <Text style={styles.preparedSpeechPathwayLine} numberOfLines={3} maxFontSizeMultiplier={1.1}>
                  {pathwayNameT || pathwayDetailT}
                </Text>
                {pathwayNameT && pathwayDetailT ? (
                  <Text
                    style={styles.preparedSpeechPathwaySubline}
                    numberOfLines={3}
                    maxFontSizeMultiplier={1.08}
                  >
                    {pathwayDetailT}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.preparedSpeechPathwayLineMuted} maxFontSizeMultiplier={1.08}>
                —
              </Text>
            )}
          </View>
        </View>
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

function DeliveredHighlightCarousel({
  sectionTitle,
  subtitle,
  rows,
}: {
  sectionTitle: string;
  subtitle?: string;
  rows: DeliveredHighlightRow[];
}) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
  }, [rows, opacity]);

  useEffect(() => {
    if (rows.length <= 1) return;

    const advance = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % rowsLenRef.current);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    };

    const id = setInterval(advance, ED_SPEECH_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
    };
  }, [rows.length, opacity]);

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
        style={[styles.edSpeechSlide, { opacity }]}
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
          <Image source={{ uri: row.avatarUrl }} style={styles.edSpeechAvatar} resizeMode="cover" />
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

function ClubStatsCarouselCard({ stats }: { stats: ClubStatsLast6Months }) {
  const slides: { key: string; label: string; value: number }[] = [
    { key: 'speeches', label: 'Number of speeches', value: stats.speeches },
    { key: 'ed', label: 'Number of educational speeches', value: stats.educationalSpeeches },
    { key: 'tt', label: 'Number of table topic speeches', value: stats.tableTopicSpeeches },
    { key: 'meetings', label: 'Number of meetings conducted', value: stats.meetingsConducted },
    { key: 'themes', label: 'Number of themes', value: stats.themes },
    { key: 'evals', label: 'Number of evaluations', value: stats.evaluations },
  ];

  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const nRef = useRef(slides.length);
  nRef.current = slides.length;

  useEffect(() => {
    setIndex(0);
    opacity.setValue(1);
  }, [stats, opacity]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const advance = () => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % nRef.current);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      });
    };

    const id = setInterval(advance, CLUB_STATS_CAROUSEL_MS);
    return () => {
      clearInterval(id);
      opacity.stopAnimation();
    };
  }, [slides.length, opacity]);

  const safeIndex = Math.min(index, slides.length - 1);
  const slide = slides[safeIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.2}>
        Club stats — last 6 months
      </Text>
      <Text style={styles.clubStatsPeriod} maxFontSizeMultiplier={1.15}>
        Based on completed roles and meetings in your club
      </Text>

      <Animated.View
        style={[styles.clubStatsSlide, { opacity }]}
        accessibilityRole="summary"
        accessibilityLabel={`${slide.label}: ${slide.value}`}
      >
        <Text style={styles.clubStatsMetricLabel} maxFontSizeMultiplier={1.12}>
          {slide.label}
        </Text>
        <Text style={styles.clubStatsMetricValue} maxFontSizeMultiplier={1.2}>
          {slide.value}
        </Text>
      </Animated.View>

      {slides.length > 1 ? (
        <View style={styles.excommDots}>
          {slides.map((s, i) => (
            <View key={s.key} style={[styles.excommDot, i === safeIndex && styles.excommDotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function MyClub() {
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const [bundle, setBundle] = useState<ClubInfoManagementBundle | null>(null);
  const [social, setSocial] = useState<ClubSocialRow | null>(null);
  const [excommPreview, setExcommPreview] = useState<ExcommPreviewRow[]>([]);
  const [membersPreview, setMembersPreview] = useState<MemberPreview[]>([]);
  const [clubStats, setClubStats] = useState<ClubStatsLast6Months | null>(null);
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

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) refreshUserProfile();
    }, [isAuthenticated, refreshUserProfile])
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.currentClubId) {
        setBundle(null);
        setSocial(null);
        setExcommPreview([]);
        setMembersPreview([]);
        setClubStats(null);
        setEducationalSpeechesDelivered([]);
        setToastmasterThemesDelivered([]);
        setPreparedSpeechesDelivered([]);
        setClubFaqItems([]);
        setClubQuoteRows([]);
        setClubIdiomRows([]);
        setClubWotdRows([]);
        return;
      }
      setLandingLoading(true);
      setClubStats(null);
      setEducationalSpeechesDelivered([]);
      setToastmasterThemesDelivered([]);
      setPreparedSpeechesDelivered([]);
      setClubFaqItems([]);
      setClubQuoteRows([]);
      setClubIdiomRows([]);
      setClubWotdRows([]);
      try {
        const clubId = user.currentClubId;
        const [
          b,
          socialRes,
          excomm,
          membersP,
          stats,
          edSpeeches,
          tmThemes,
          prepSpeeches,
          faqRes,
          quoteRows,
          idiomRows,
          wotdRows,
        ] = await Promise.all([
          fetchClubInfoManagementBundle(clubId),
          supabase
            .from('club_profiles')
            .select(
              'facebook_url, twitter_url, linkedin_url, instagram_url, whatsapp_url, youtube_url, website_url'
            )
            .eq('club_id', clubId)
            .maybeSingle(),
          fetchExcommPreview(clubId),
          fetchMembersPreview(clubId, 24),
          fetchClubStatsLast6Months(clubId),
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
        setBundle(b);
        setSocial((socialRes.data as ClubSocialRow) ?? null);
        setExcommPreview(excomm);
        setMembersPreview(membersP);
        setClubStats(stats);
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
        console.error('Club landing load error:', e);
        if (!cancelled) {
          setBundle(null);
          setSocial(null);
          setExcommPreview([]);
          setMembersPreview([]);
          setClubStats(null);
          setEducationalSpeechesDelivered([]);
          setToastmasterThemesDelivered([]);
          setPreparedSpeechesDelivered([]);
          setClubFaqItems([]);
          setClubQuoteRows([]);
          setClubIdiomRows([]);
          setClubWotdRows([]);
        }
      } finally {
        if (!cancelled) setLandingLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.currentClubId]);

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
        bundle.clubData.region?.trim()
          ? `Region ${bundle.clubData.region.trim()}`
          : null,
        bundle.clubData.country?.trim() || null,
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
                  <Text style={styles.notionTitle} maxFontSizeMultiplier={1.12}>
                    {bundle.clubInfo.name}
                  </Text>
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
                  {bundle.clubData.club_mission?.trim() ? (
                    <Text style={styles.notionAboutBody} maxFontSizeMultiplier={1.25}>
                      {bundle.clubData.club_mission.trim()}
                    </Text>
                  ) : (
                    <Text style={styles.notionAboutPlaceholder} maxFontSizeMultiplier={1.2}>
                      No description yet. Your club can add a mission statement in club information settings.
                    </Text>
                  )}

                  <View style={styles.notionDivider} />

                  <Text style={styles.notionSectionLabel} maxFontSizeMultiplier={1.15}>
                    Meeting
                  </Text>
                  <View style={styles.notionMeetingGrid}>
                    <View style={styles.notionMeetingRow}>
                      <NotionMeetingTile
                        icon={<Calendar size={16} color={C.textSecondary} />}
                        label="Day"
                        value={meetingDayLabel}
                      />
                      <NotionMeetingTile
                        icon={<Clock size={16} color={C.textSecondary} />}
                        label="Time"
                        value={timeRange !== '—' ? timeRange : '—'}
                      />
                    </View>
                    <View style={styles.notionMeetingRow}>
                      <NotionMeetingTile
                        icon={<RefreshCw size={16} color="#3b82f6" />}
                        label="Frequency"
                        value={frequencyDisplay}
                      />
                      <NotionMeetingTile
                        icon={<MapPin size={16} color="#ef4444" />}
                        label="Format"
                        value={formatDisplay}
                      />
                    </View>
                  </View>

                  <View style={styles.notionDivider} />

                  <Text style={styles.notionSectionLabel} maxFontSizeMultiplier={1.15}>
                    Location
                  </Text>
                  <View style={styles.notionLocationShell}>
                    {mapsUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => openUrl(mapsUrl)}
                        accessibilityRole="button"
                        accessibilityLabel="Open map preview in maps"
                      >
                        <View style={styles.notionMapPlaceholder}>
                          <MapPin size={28} color={C.textMuted} />
                          <Text style={styles.notionMapHint} maxFontSizeMultiplier={1.1}>
                            Tap to open map
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.notionMapPlaceholder}>
                        <MapPin size={28} color={C.textMuted} />
                      </View>
                    )}
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

                {excommPreview.length > 0 ? (
                  <ExcommCarouselCard
                    rows={excommPreview}
                    onSeeAll={() => handleFeaturePress('/executive-committee')}
                  />
                ) : null}

                {membersPreview.length > 0 ? (
                  <MembersCarouselCard
                    rows={membersPreview}
                    onViewAll={() => handleFeaturePress('/club-members')}
                    onViewMember={(id) =>
                      handleFeaturePress(`/member-profile?memberId=${encodeURIComponent(id)}` as any)
                    }
                  />
                ) : null}

                {clubFaqItems.length > 0 ? <ClubFaqHeroCard items={clubFaqItems} /> : null}

                {educationalHighlightRows.length > 0 ? (
                  <DeliveredHighlightCarousel
                    sectionTitle="Educational speeches — last 6 months"
                    rows={educationalHighlightRows}
                  />
                ) : null}

                {toastmasterHighlightRows.length > 0 ? (
                  <DeliveredHighlightCarousel
                    sectionTitle="Toastmaster & theme — last 6 months"
                    rows={toastmasterHighlightRows}
                  />
                ) : null}

                {preparedSpeechesDelivered.length > 0 ? (
                  <PreparedSpeechesHighlightCarousel rows={preparedSpeechesDelivered} />
                ) : null}

                {clubStats ? <ClubStatsCarouselCard stats={clubStats} /> : null}

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
                        const { name, iconStyle } = socialIconForKey(s.key);
                        const faStyleProps =
                          iconStyle === 'brand' ? { brand: true } : { solid: true };
                        return (
                          <TouchableOpacity
                            key={s.key}
                            style={styles.socialIconPill}
                            onPress={() => openUrl(s.url)}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={s.label}
                          >
                            <FontAwesome6
                              name={name as any}
                              {...faStyleProps}
                              size={20}
                              color={C.text}
                            />
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

function NotionMeetingTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.notionTile} accessibilityRole="text">
      <View style={styles.notionTileLabelRow}>
        {icon}
        <Text style={styles.notionTileLabel} maxFontSizeMultiplier={1.1}>
          {label}
        </Text>
      </View>
      <Text style={styles.notionTileValue} maxFontSizeMultiplier={1.15}>
        {value}
      </Text>
    </View>
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
  notionTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: C.text,
    lineHeight: 32,
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
  notionAboutPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
    color: C.textMuted,
    lineHeight: 22,
  },
  notionMeetingGrid: {
    gap: 10,
  },
  notionMeetingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  notionTile: {
    flex: 1,
    backgroundColor: C.chipBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  notionTileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  notionTileLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textSecondary,
  },
  notionTileValue: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    lineHeight: 22,
  },
  notionLocationShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    backgroundColor: C.card,
  },
  notionMapPlaceholder: {
    height: 132,
    backgroundColor: C.mapPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  notionMapHint: {
    fontSize: 13,
    fontWeight: '500',
    color: C.textMuted,
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
    marginTop: -6,
    marginBottom: 8,
    lineHeight: 18,
  },
  clubStatsSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    minHeight: 120,
  },
  clubStatsMetricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  clubStatsMetricValue: {
    fontSize: 40,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.5,
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
    padding: 6,
  },
  faqHeroSectionTitle: {
    marginBottom: 5,
  },
  faqHeroSlide: {
    overflow: 'hidden',
    paddingVertical: 3,
    minHeight: 66,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  faqHeroQuestion: {
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
    textAlign: 'left',
    lineHeight: 16,
    marginBottom: 5,
    paddingHorizontal: 0,
    width: '100%',
  },
  faqHeroAnswer: {
    fontSize: 12,
    fontWeight: '400',
    color: C.textSecondary,
    textAlign: 'left',
    lineHeight: 16,
    paddingHorizontal: 0,
    width: '100%',
  },
  preparedSpeechSlide: {
    paddingVertical: 10,
    minHeight: 140,
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
  preparedSpeechPathwaySubline: {
    fontSize: 13,
    fontWeight: '400',
    color: C.textSecondary,
    textAlign: 'left',
    lineHeight: 19,
    marginTop: 4,
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

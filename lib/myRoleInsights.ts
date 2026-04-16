import { supabase } from '@/lib/supabase';
import type { MeetingRoleRow } from '@/lib/journeyMeetingOpenData';
import {
  isAhCounterRole,
  isEducationalSpeakerRoleRow,
  isGeneralEvaluatorRole,
  isGrammarianRole,
  isKeynoteSpeakerRoleRow,
  isPreparedSpeakerRole,
  isSpeechEvaluatorRole,
  isTableTopicsMasterRole,
  isTableTopicsSpeakerRole,
  isTimerRole,
  isToastmasterRole,
} from '@/lib/journeyMeetingOpenData';

export type InsightCategory =
  | 'toastmaster'
  | 'general_evaluator'
  | 'table_topics_master'
  | 'table_topics_speaker'
  | 'prepared_speaker'
  | 'educational_speaker'
  | 'keynote_speaker'
  | 'speech_evaluator'
  | 'timer'
  | 'ah_counter'
  | 'grammarian';

/** Row titles in My Role Insights (tracks UI). */
export const INSIGHT_ROW_LABELS: Record<InsightCategory, string> = {
  table_topics_speaker: 'Table Topic Speaker',
  prepared_speaker: 'Prepared Speaker',
  educational_speaker: 'Educational Speaker',
  keynote_speaker: 'Keynote Speaker',
  toastmaster: 'Toastmaster',
  table_topics_master: 'Table Topics Master',
  speech_evaluator: 'Evaluator',
  general_evaluator: 'General Evaluator',
  timer: 'Timer',
  ah_counter: 'Ah Counter',
  grammarian: 'Grammarian',
};

export type InsightTrackId = 'speaking' | 'leadership' | 'feedback' | 'coordination';

export const INSIGHT_TRACKS: {
  id: InsightTrackId;
  emoji: string;
  title: string;
  categories: InsightCategory[];
}[] = [
  {
    id: 'speaking',
    emoji: '🔥',
    title: 'Speaking Track',
    categories: ['table_topics_speaker', 'prepared_speaker', 'educational_speaker', 'keynote_speaker'],
  },
  {
    id: 'leadership',
    emoji: '🎯',
    title: 'Leadership Track',
    categories: ['toastmaster', 'table_topics_master'],
  },
  {
    id: 'feedback',
    emoji: '🧠',
    title: 'Feedback Track',
    categories: ['speech_evaluator', 'general_evaluator'],
  },
  {
    id: 'coordination',
    emoji: '⏱️',
    title: 'Coordination Track',
    categories: ['timer', 'ah_counter', 'grammarian'],
  },
];

export const ALL_INSIGHT_CATEGORIES: InsightCategory[] = INSIGHT_TRACKS.flatMap((t) => t.categories);

const ALL_TRACK_CATEGORIES = ALL_INSIGHT_CATEGORIES;

const INSIGHT_CATEGORY_SET = new Set<string>(ALL_INSIGHT_CATEGORIES);

export function isInsightCategory(value: string | undefined): value is InsightCategory {
  return !!value && INSIGHT_CATEGORY_SET.has(value);
}

/** @deprecated Use INSIGHT_TRACKS + INSIGHT_ROW_LABELS */
export const INSIGHT_CATEGORY_ORDER: { key: InsightCategory; label: string }[] = ALL_TRACK_CATEGORIES.map((key) => ({
  key,
  label: INSIGHT_ROW_LABELS[key],
}));

/** Days since meeting (0 = today); null if invalid. */
export function insightDaysSinceMeeting(meetingDateStr: string): number | null {
  const parts = meetingDateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const meet = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  meet.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - meet.getTime()) / 86400000);
  if (diff < 0) return null;
  return diff;
}

/** Show ⚠️ when last performance is this many days ago or more. */
export const INSIGHT_STALE_DAYS = 60;

export function computeSmartInsight(insights: MyRoleInsightsMap): { headline: string; body: string } | null {
  const trackSum = (id: InsightTrackId) => {
    const t = INSIGHT_TRACKS.find((x) => x.id === id);
    if (!t) return 0;
    return t.categories.reduce((s, k) => s + insights[k].totalCount, 0);
  };
  const speaking = trackSum('speaking');
  const leadership = trackSum('leadership');
  const feedback = trackSum('feedback');
  const coordination = trackSum('coordination');
  const total = speaking + leadership + feedback + coordination;
  if (total === 0) return null;

  if (speaking >= 4 && feedback <= 2) {
    return { headline: 'You are strong in Speaking 👍', body: 'Try Feedback roles next.' };
  }
  if (feedback >= 4 && speaking <= 2) {
    return { headline: 'You are strong in Feedback 👍', body: 'Try Speaking roles next.' };
  }
  if (leadership === 0 && speaking + feedback >= 4) {
    return { headline: 'Ready to lead?', body: 'Consider Toastmaster or Table Topics Master.' };
  }
  if (coordination >= 6 && speaking <= 2) {
    return { headline: 'Great meeting support 👍', body: 'Try a speaking role to grow further.' };
  }
  return null;
}

function norm(s: string | null | undefined): string {
  return (s || '').toLowerCase();
}

export function classifyInsightCategory(row: MeetingRoleRow): InsightCategory | null {
  if (isTableTopicsMasterRole(row)) return 'table_topics_master';
  if (isTableTopicsSpeakerRole(row)) return 'table_topics_speaker';
  if (row.role_classification === 'On-the-Spot Speaking' && !norm(row.role_name).includes('master')) {
    return 'table_topics_speaker';
  }
  if (isGeneralEvaluatorRole(row)) return 'general_evaluator';
  if (isToastmasterRole(row)) return 'toastmaster';
  if (isPreparedSpeakerRole(row)) return 'prepared_speaker';
  if (isKeynoteSpeakerRoleRow(row)) return 'keynote_speaker';
  if (isEducationalSpeakerRoleRow(row) || norm(row.role_classification) === 'educational_speaker') {
    return 'educational_speaker';
  }
  if (isSpeechEvaluatorRole(row)) return 'speech_evaluator';
  const rn = norm(row.role_name);
  if (rn.includes('evaluator') && !rn.includes('general')) return 'speech_evaluator';
  if (isTimerRole(row)) return 'timer';
  if (isAhCounterRole(row)) return 'ah_counter';
  if (isGrammarianRole(row)) return 'grammarian';
  return null;
}

export type RoleInsightLastBooking = {
  meetingDate: string;
  meetingNumber: string | number | null;
  meetingTitle: string | null;
  roleDisplayName: string | null;
};

export type MyRoleInsightCategoryData = {
  totalCount: number;
  lastBooking: RoleInsightLastBooking | null;
};

export type MyRoleInsightsMap = Record<InsightCategory, MyRoleInsightCategoryData>;

export type RoleInsightOccurrence = {
  roleRowId: string;
  meetingId: string;
  meetingDate: string;
  meetingNumber: string | number | null;
  meetingTitle: string | null;
  roleDisplayName: string | null;
  /** Filled for Toastmaster occurrences from `toastmaster_meeting_data`. */
  themeOfTheDay?: string | null;
};

export type OccurrencesByCategory = Record<InsightCategory, RoleInsightOccurrence[]>;

export type MyRoleInsightsPayload = {
  map: MyRoleInsightsMap;
  occurrencesByCategory: OccurrencesByCategory;
};

const ROLE_INSIGHTS_CACHE_TTL_MS = 2 * 60 * 1000;
type RoleInsightsCacheEntry = {
  key: string;
  at: number;
  payload: MyRoleInsightsPayload;
};
let roleInsightsCacheEntry: RoleInsightsCacheEntry | null = null;

function roleInsightsCacheKey(clubId: string, userId: string): string {
  return `${clubId}:${userId}`;
}

export function getCachedMyRoleInsights(
  clubId: string,
  userId: string,
  maxAgeMs: number = ROLE_INSIGHTS_CACHE_TTL_MS
): MyRoleInsightsPayload | null {
  const key = roleInsightsCacheKey(clubId, userId);
  if (!roleInsightsCacheEntry || roleInsightsCacheEntry.key !== key) return null;
  if (Date.now() - roleInsightsCacheEntry.at > maxAgeMs) return null;
  return roleInsightsCacheEntry.payload;
}

export function setCachedMyRoleInsights(clubId: string, userId: string, payload: MyRoleInsightsPayload): void {
  roleInsightsCacheEntry = {
    key: roleInsightsCacheKey(clubId, userId),
    at: Date.now(),
    payload,
  };
}

export async function fetchMyRoleInsightsCached(
  clubId: string,
  userId: string,
  options?: {
    maxAgeMs?: number;
    forceRefresh?: boolean;
  }
): Promise<MyRoleInsightsPayload> {
  const maxAgeMs = options?.maxAgeMs ?? ROLE_INSIGHTS_CACHE_TTL_MS;
  if (!options?.forceRefresh) {
    const cached = getCachedMyRoleInsights(clubId, userId, maxAgeMs);
    if (cached) return cached;
  }
  const payload = await fetchMyRoleInsights(clubId, userId);
  setCachedMyRoleInsights(clubId, userId, payload);
  return payload;
}

export function emptyMyRoleInsightsMap(): MyRoleInsightsMap {
  const out = {} as MyRoleInsightsMap;
  for (const key of ALL_TRACK_CATEGORIES) {
    out[key] = { totalCount: 0, lastBooking: null };
  }
  return out;
}

export function emptyOccurrencesByCategory(): OccurrencesByCategory {
  const out = {} as OccurrencesByCategory;
  for (const key of ALL_TRACK_CATEGORIES) {
    out[key] = [];
  }
  return out;
}

export function emptyMyRoleInsightsPayload(): MyRoleInsightsPayload {
  return {
    map: emptyMyRoleInsightsMap(),
    occurrencesByCategory: emptyOccurrencesByCategory(),
  };
}

function parseMeetingDate(meetingDate: string): number {
  const parts = meetingDate.split('-').map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return 0;
  return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
}

export function formatDaysSinceMeeting(meetingDateStr: string): string {
  const parts = meetingDateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return '—';
  const meet = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  meet.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - meet.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff < 0) return `In ${Math.abs(diff)} days`;
  return `${diff} days ago`;
}

/** Role insights date (e.g. Nov 23, 2025). Single export avoids stale-bundle ReferenceErrors. */
export function formatInsightMeetingDate(meetingDateStr: string): string {
  const parts = meetingDateStr.split('-').map((p) => parseInt(p, 10));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return meetingDateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function fetchMyRoleInsights(clubId: string, userId: string): Promise<MyRoleInsightsPayload> {
  const { data, error } = await supabase
    .from('app_meeting_roles_management')
    .select(
      `
      id,
      role_name,
      role_classification,
      app_club_meeting (
        id,
        meeting_date,
        meeting_number,
        meeting_title
      )
    `
    )
    .eq('club_id', clubId)
    .eq('assigned_user_id', userId)
    .eq('booking_status', 'booked');

  if (error) {
    console.error('fetchMyRoleInsights:', error);
    return emptyMyRoleInsightsPayload();
  }

  type Row = {
    id: string;
    role_name: string | null;
    role_classification: string | null;
    app_club_meeting: {
      id: string;
      meeting_date: string;
      meeting_number: string | number | null;
      meeting_title: string | null;
    } | null;
  };

  const rows = (data || []) as Row[];

  const expanded: Array<{
    roleRowId: string;
    row: MeetingRoleRow;
    meetingDate: string;
    meetingNumber: string | number | null;
    meetingTitle: string | null;
    roleDisplayName: string | null;
    meetingId: string;
  }> = [];

  for (const r of rows) {
    const mRaw = r.app_club_meeting;
    const m = Array.isArray(mRaw) ? mRaw[0] : mRaw;
    if (!m?.meeting_date) continue;
    expanded.push({
      roleRowId: r.id,
      row: {
        id: r.id,
        assigned_user_id: userId,
        role_name: r.role_name,
        role_classification: r.role_classification,
        role_status: null,
      },
      meetingDate: m.meeting_date,
      meetingNumber: m.meeting_number ?? null,
      meetingTitle: m.meeting_title ?? null,
      roleDisplayName: r.role_name,
      meetingId: m.id,
    });
  }

  expanded.sort((a, b) => {
    const ta = parseMeetingDate(a.meetingDate);
    const tb = parseMeetingDate(b.meetingDate);
    if (tb !== ta) return tb - ta;
    return b.meetingId.localeCompare(a.meetingId);
  });

  const out = emptyMyRoleInsightsMap();
  const occurrencesByCategory = emptyOccurrencesByCategory();

  for (const item of expanded) {
    const cat = classifyInsightCategory(item.row);
    if (!cat) continue;
    const slot = out[cat];
    slot.totalCount += 1;
    if (!slot.lastBooking) {
      slot.lastBooking = {
        meetingDate: item.meetingDate,
        meetingNumber: item.meetingNumber,
        meetingTitle: item.meetingTitle,
        roleDisplayName: item.roleDisplayName,
      };
    }
    occurrencesByCategory[cat].push({
      roleRowId: item.roleRowId,
      meetingId: item.meetingId,
      meetingDate: item.meetingDate,
      meetingNumber: item.meetingNumber,
      meetingTitle: item.meetingTitle,
      roleDisplayName: item.roleDisplayName,
    });
  }

  const tmodOcc = occurrencesByCategory.toastmaster;
  if (tmodOcc.length > 0) {
    const meetingIds = [...new Set(tmodOcc.map((o) => o.meetingId))];
    const { data: themeRows, error: themeErr } = await supabase
      .from('toastmaster_meeting_data')
      .select('meeting_id, theme_of_the_day')
      .in('meeting_id', meetingIds);
    if (themeErr) {
      console.error('fetchMyRoleInsights: toastmaster themes', themeErr);
    } else {
      const themeByMeetingId = new Map<string, string | null>(
        (themeRows || []).map((r: { meeting_id: string; theme_of_the_day: string | null }) => [
          r.meeting_id,
          r.theme_of_the_day ?? null,
        ])
      );
      for (const o of tmodOcc) {
        o.themeOfTheDay = themeByMeetingId.get(o.meetingId) ?? null;
      }
    }
  }

  return { map: out, occurrencesByCategory };
}

import {
  INSIGHT_ROW_LABELS,
  insightDaysSinceMeeting,
  type InsightCategory,
  type MyRoleInsightsMap,
} from '@/lib/myRoleInsights';

/** Two roles per calendar day; cycles through all My Role Insights categories. */
export const HOME_DAILY_ROLE_PAIRS: readonly [InsightCategory, InsightCategory][] = [
  ['toastmaster', 'prepared_speaker'],
  ['table_topics_master', 'table_topics_speaker'],
  ['educational_speaker', 'keynote_speaker'],
  ['speech_evaluator', 'general_evaluator'],
  ['timer', 'ah_counter'],
  ['grammarian', 'toastmaster'],
];

export type HomeRoleBookingInsight = {
  category: InsightCategory;
  text: string;
};

function localDayIndex(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / 86400000);
}

export function getHomeRolePairDayIndex(date: Date = new Date()): number {
  const idx = localDayIndex(date) % HOME_DAILY_ROLE_PAIRS.length;
  return idx < 0 ? idx + HOME_DAILY_ROLE_PAIRS.length : idx;
}

function roleLabelForInsight(category: InsightCategory): string {
  return INSIGHT_ROW_LABELS[category].toLowerCase();
}

function formatRecencyLabel(category: InsightCategory, meetingDate: string): string {
  const days = insightDaysSinceMeeting(meetingDate);
  const label = roleLabelForInsight(category);
  if (days === null) return `${label} performed —`;
  if (days === 0) return `${label} performed today.`;
  if (days === 1) return `${label} performed 1 day ago.`;
  return `${label} performed ${days} days ago.`;
}

/** Four insights for today: count + recency for each of the two daily roles. */
export function buildHomeRoleBookingInsights(
  map: MyRoleInsightsMap,
  date: Date = new Date(),
  clubHasCompletedMeeting = false
): HomeRoleBookingInsight[] {
  if (!clubHasCompletedMeeting) return [];

  const pair = HOME_DAILY_ROLE_PAIRS[getHomeRolePairDayIndex(date)];
  const out: HomeRoleBookingInsight[] = [];

  for (const category of pair) {
    const label = roleLabelForInsight(category);
    const { totalCount, lastBooking } = map[category];
    if (totalCount <= 0) {
      out.push({
        category,
        text: `${label}, you have not stepped in yet.`,
      });
    } else {
      out.push({
        category,
        text: `${label}, you have stepped in ${totalCount} time${totalCount === 1 ? '' : 's'}.`,
      });
    }

    const lastDate = lastBooking?.meetingDate;
    if (!lastDate) {
      out.push({
        category,
        text: `${label} has not been performed yet.`,
      });
    } else {
      out.push({
        category,
        text: formatRecencyLabel(category, lastDate),
      });
    }
  }

  return out;
}

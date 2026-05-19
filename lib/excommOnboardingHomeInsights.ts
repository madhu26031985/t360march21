import {
  sectionTaskProgress,
  type T360ClubOnboardingProgress,
} from '@/lib/t360ClubOnboarding';
import { supabase } from '@/lib/supabase';

const ONBOARDING_MY_TASKS_MEMBER_THRESHOLD = 7;
const ONBOARDING_MY_TASKS_DAYS_AFTER_FIRST_MEETING = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ExComm My Tasks onboarding nudges — four core setup sections only. */
export const EXCOMM_ONBOARDING_MY_TASKS_SECTION_IDS = [
  'setting_up',
  'user_management',
  'manage_club_excomm',
  'meeting_management',
] as const;

export type ExcommOnboardingMyTasksSectionId =
  (typeof EXCOMM_ONBOARDING_MY_TASKS_SECTION_IDS)[number];

export type ExcommOnboardingHomeInsight = {
  sectionId: ExcommOnboardingMyTasksSectionId;
  text: string;
};

function localDayIndex(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / 86400000);
}

/**
 * Stop ExComm onboarding nudges in My Tasks when the club is established:
 * 30+ days since the first meeting was created, or 7+ users have joined.
 */
export async function shouldSuppressExcommOnboardingMyTasksInsights(clubId: string): Promise<boolean> {
  const [firstMeetingRes, membersRes] = await Promise.all([
    supabase
      .from('app_club_meeting')
      .select('created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('app_club_user_relationship')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId),
  ]);

  if ((membersRes.count ?? 0) >= ONBOARDING_MY_TASKS_MEMBER_THRESHOLD) {
    return true;
  }

  const firstCreatedAt = firstMeetingRes.data?.created_at;
  if (firstCreatedAt) {
    const elapsedMs = Date.now() - new Date(firstCreatedAt).getTime();
    if (elapsedMs >= ONBOARDING_MY_TASKS_DAYS_AFTER_FIRST_MEETING * MS_PER_DAY) {
      return true;
    }
  }

  return false;
}

/** One alert per incomplete section, in checklist order. */
export function buildExcommOnboardingSectionAlerts(
  progress: T360ClubOnboardingProgress
): ExcommOnboardingHomeInsight[] {
  const out: ExcommOnboardingHomeInsight[] = [];

  for (const sectionId of EXCOMM_ONBOARDING_MY_TASKS_SECTION_IDS) {
    const section = progress.sections.find((s) => s.id === sectionId);
    if (!section) continue;

    const { tasksDone, tasksTotal } = sectionTaskProgress(section);
    if (tasksTotal === 0 || tasksDone >= tasksTotal) continue;

    out.push({
      sectionId,
      text: `${section.title} ${tasksDone}/${tasksTotal} completed; complete it now.`,
    });
  }

  return out;
}

/** Show two section alerts per calendar day; rotate pairs every 24 hours. */
export function pickDailyExcommOnboardingInsights(
  alerts: ExcommOnboardingHomeInsight[],
  date: Date = new Date()
): ExcommOnboardingHomeInsight[] {
  if (alerts.length <= 2) return alerts;

  const day = localDayIndex(date);
  const pairCount = Math.ceil(alerts.length / 2);
  const pairIndex = ((day % pairCount) + pairCount) % pairCount;
  const start = pairIndex * 2;
  return alerts.slice(start, start + 2);
}

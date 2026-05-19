import {
  sectionTaskProgress,
  type T360ClubOnboardingProgress,
} from '@/lib/t360ClubOnboarding';

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

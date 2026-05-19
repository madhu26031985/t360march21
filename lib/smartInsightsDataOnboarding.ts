import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';

export type SmartInsightsDataOnboardingInput = {
  vpeSmartInsightUseCount: number;
  myTasksUseCount: number;
  attendanceMarkedMemberCount: number;
  roleCompletionMemberCount: number;
};

export type SmartInsightsDataOnboardingProgress = {
  vpeSmartInsightsUsed: FieldProgress;
  myTasksUsed: FieldProgress;
  attendanceMarkedByUsers: FieldProgress;
  roleCompletionMarkedByUsers: FieldProgress;
};

export function computeSmartInsightsDataOnboarding(
  input: SmartInsightsDataOnboardingInput
): SmartInsightsDataOnboardingProgress {
  return {
    vpeSmartInsightsUsed: cappedProgress(input.vpeSmartInsightUseCount, 5),
    myTasksUsed: cappedProgress(input.myTasksUseCount, 10),
    attendanceMarkedByUsers: cappedProgress(input.attendanceMarkedMemberCount, 5),
    roleCompletionMarkedByUsers: cappedProgress(input.roleCompletionMemberCount, 5),
  };
}

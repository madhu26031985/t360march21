import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';

export type VotingOperationsOnboardingInput = {
  pollCount: number;
  distinctVoterCount: number;
  distinctQuestionCount: number;
  pollClosedCount: number;
};

export type VotingOperationsOnboardingProgress = {
  votingCreated: FieldProgress;
  fiveUsersVoted: FieldProgress;
  fiveQuestionsFilled: FieldProgress;
  votingClosed: FieldProgress;
};

export function computeVotingOperationsOnboarding(
  input: VotingOperationsOnboardingInput
): VotingOperationsOnboardingProgress {
  return {
    votingCreated: cappedProgress(input.pollCount > 0 ? 1 : 0, 1),
    fiveUsersVoted: cappedProgress(input.distinctVoterCount, 5),
    fiveQuestionsFilled: cappedProgress(input.distinctQuestionCount, 5),
    votingClosed: cappedProgress(input.pollClosedCount > 0 ? 1 : 0, 1),
  };
}

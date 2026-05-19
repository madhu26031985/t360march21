import { type FieldProgress } from '@/lib/clubInfoSetupCompletion';

type ExcommProfileFields = {
  president_id?: string | null;
  vpe_id?: string | null;
  vpm_id?: string | null;
};

function slotAssigned(value: string | null | undefined): FieldProgress {
  const done = typeof value === 'string' && value.trim().length > 0 ? 1 : 0;
  return { done, total: 1 };
}

export type ExcommClubOnboardingProgress = {
  presidentAssigned: FieldProgress;
  vpeAssigned: FieldProgress;
  vpmAssigned: FieldProgress;
};

export function computeExcommClubOnboarding(
  profile: ExcommProfileFields | null | undefined
): ExcommClubOnboardingProgress {
  return {
    presidentAssigned: slotAssigned(profile?.president_id),
    vpeAssigned: slotAssigned(profile?.vpe_id),
    vpmAssigned: slotAssigned(profile?.vpm_id),
  };
}

/** Question ids stored in app_meeting_ge.evaluation_data (1–10 scale each). */
export const GE_EVALUATION_QUESTION_IDS = [
  'q1_preparation_setup',
  'q2_opening_quality',
  'q3_guest_experience',
  'q4_meeting_leadership',
  'q5_role_execution',
  'q6_speaker_intro_support',
  'q7_time_discipline',
  'q8_evaluation_quality',
  'q9_flow_feedback_collection',
  'q10_overall_experience',
] as const;

export const GE_RATING_MIN = 1;
export const GE_RATING_MAX = 10;

export function normalizeStoredGeRating(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n >= GE_RATING_MIN && n <= GE_RATING_MAX) return n;
  if (n >= 0 && n <= 9) return n + 1;
  return null;
}

/** Map total score vs max (e.g. 72/80) to 0–5 stars — same as General Evaluator Report screen. */
export function geTotalToStars(total: number, maxTotal: number): number {
  if (maxTotal <= 0 || !Number.isFinite(total)) return 0;
  return Math.min(5, Math.max(0, (total / maxTotal) * 5));
}

export type GeOverallRatingLabel = 'Excellent' | 'Good' | 'Needs Improvement';

export type GeRatingSummary = {
  stars: number;
  totalScore: number;
  maxTotal: number;
  label: GeOverallRatingLabel;
};

export function getGeOverallRatingLabel(totalScore: number, maxTotal: number): GeOverallRatingLabel {
  if (totalScore >= Math.round((56 / 72) * maxTotal)) return 'Excellent';
  if (totalScore >= Math.round((36 / 72) * maxTotal)) return 'Good';
  return 'Needs Improvement';
}

export function computeGeRatingSummary(evaluationData: unknown): GeRatingSummary | null {
  if (!evaluationData || typeof evaluationData !== 'object') return null;
  const data = evaluationData as Record<string, unknown>;
  const maxTotal = GE_EVALUATION_QUESTION_IDS.length * GE_RATING_MAX;
  const totalScore = GE_EVALUATION_QUESTION_IDS.reduce((sum, qId) => {
    const rating = normalizeStoredGeRating(data[qId]);
    return sum + (rating ?? 0);
  }, 0);
  const hasAny = GE_EVALUATION_QUESTION_IDS.some((qId) => normalizeStoredGeRating(data[qId]) != null);
  if (!hasAny) return null;
  return {
    stars: geTotalToStars(totalScore, maxTotal),
    totalScore,
    maxTotal,
    label: getGeOverallRatingLabel(totalScore, maxTotal),
  };
}

export function computeGeOverallStars(evaluationData: unknown): number | null {
  return computeGeRatingSummary(evaluationData)?.stars ?? null;
}

export function formatGeStarRating(stars: number | null | undefined): string {
  if (stars == null || !Number.isFinite(stars) || stars <= 0) return '—';
  const rounded = Math.round(stars * 10) / 10;
  return `${rounded}/5`;
}

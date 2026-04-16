import type { QueryClient } from '@tanstack/react-query';
import {
  fetchGeneralEvaluatorReportBundle,
  generalEvaluatorReportQueryKeys,
} from '@/lib/generalEvaluatorReportQuery';

/** Must match `fetchQuery` / `prefetchQuery` for this snapshot so home prefetch stays warm after navigation. */
export const GENERAL_EVALUATOR_REPORT_SNAPSHOT_STALE_MS = 60 * 1000;

/** Call before navigating to General Evaluator Report so native often reads warm cache. */
export function prefetchGeneralEvaluatorReport(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  userId: string | null | undefined,
  clubId: string | null | undefined
): void {
  if (!meetingId || !clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: generalEvaluatorReportQueryKeys.snapshot(meetingId, clubId, effectiveUserId || 'anon'),
    queryFn: () => fetchGeneralEvaluatorReportBundle(meetingId, clubId, effectiveUserId),
    staleTime: GENERAL_EVALUATOR_REPORT_SNAPSHOT_STALE_MS,
  });
}

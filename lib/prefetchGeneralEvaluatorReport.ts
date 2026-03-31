import type { QueryClient } from '@tanstack/react-query';
import {
  fetchGeneralEvaluatorReportBundle,
  generalEvaluatorReportQueryKeys,
} from '@/lib/generalEvaluatorReportQuery';

const STALE_MS = 60 * 1000;

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
    staleTime: STALE_MS,
  });
}

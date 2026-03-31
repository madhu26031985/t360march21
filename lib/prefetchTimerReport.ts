import type { QueryClient } from '@tanstack/react-query';
import { fetchTimerReportSnapshot, timerReportQueryKeys } from '@/lib/timerReportSnapshot';

const STALE_MS = 60 * 1000;
const DEFAULT_SPEECH_CATEGORY = 'prepared_speaker';

export function prefetchTimerReport(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  userId: string | null | undefined
): void {
  if (!meetingId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: timerReportQueryKeys.snapshot(
      meetingId,
      DEFAULT_SPEECH_CATEGORY,
      effectiveUserId || 'anon'
    ),
    queryFn: () => fetchTimerReportSnapshot(meetingId, DEFAULT_SPEECH_CATEGORY),
    staleTime: STALE_MS,
  });
}

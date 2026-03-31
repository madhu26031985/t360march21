import type { QueryClient } from '@tanstack/react-query';
import { ahCounterQueryKeys, fetchAhCounterSnapshot } from '@/lib/ahCounterSnapshot';

const STALE_MS = 60 * 1000;

export function prefetchAhCounter(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  clubId: string | null | undefined,
  userId: string | null | undefined
): void {
  if (!meetingId || !clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: ahCounterQueryKeys.snapshot(meetingId, clubId, effectiveUserId || 'anon'),
    queryFn: () => fetchAhCounterSnapshot(meetingId),
    staleTime: STALE_MS,
  });
}

import type { QueryClient } from '@tanstack/react-query';
import { educationalCornerQueryKeys, fetchEducationalCornerBundle } from '@/lib/educationalCornerQuery';

const STALE_MS = 60 * 1000;

/** Call before navigating to Educational Corner so the screen often reads from cache. */
export function prefetchEducationalCorner(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  userId: string | null | undefined,
  clubId: string | null | undefined
): void {
  if (!meetingId || !clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: educationalCornerQueryKeys.snapshot(meetingId, effectiveUserId || 'anon'),
    queryFn: () => fetchEducationalCornerBundle(meetingId, effectiveUserId, clubId),
    staleTime: STALE_MS,
  });
}

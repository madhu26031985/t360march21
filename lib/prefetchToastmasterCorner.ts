import type { QueryClient } from '@tanstack/react-query';
import { fetchToastmasterCornerBundle, toastmasterCornerQueryKeys } from '@/lib/toastmasterCornerQuery';

const STALE_MS = 60 * 1000;

/** Start Toastmaster corner fetch before navigation so the screen often hits React Query cache (helps native). */
export function prefetchToastmasterCorner(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  userId: string | null | undefined,
  clubId: string | null | undefined
): void {
  if (!meetingId || !clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: toastmasterCornerQueryKeys.detail(meetingId, clubId, effectiveUserId || 'anon'),
    queryFn: () => fetchToastmasterCornerBundle(meetingId, clubId, effectiveUserId),
    staleTime: STALE_MS,
  });
}

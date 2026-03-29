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
  if (!meetingId || !userId || !clubId) return;
  void queryClient.prefetchQuery({
    queryKey: toastmasterCornerQueryKeys.detail(meetingId, clubId, userId),
    queryFn: () => fetchToastmasterCornerBundle(meetingId, clubId, userId),
    staleTime: STALE_MS,
  });
}

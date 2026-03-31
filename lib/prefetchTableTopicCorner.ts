import type { QueryClient } from '@tanstack/react-query';
import { fetchTableTopicCornerBundle, tableTopicCornerQueryKeys } from '@/lib/tableTopicCornerQuery';

const STALE_MS = 60 * 1000;

export function prefetchTableTopicCorner(
  queryClient: QueryClient,
  meetingId: string | null | undefined,
  userId: string | null | undefined,
  clubId: string | null | undefined
): void {
  if (!meetingId || !clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: tableTopicCornerQueryKeys.snapshot(meetingId, clubId, effectiveUserId || 'anon'),
    queryFn: () => fetchTableTopicCornerBundle(meetingId, clubId),
    staleTime: STALE_MS,
  });
}

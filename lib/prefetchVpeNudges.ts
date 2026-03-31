import type { QueryClient } from '@tanstack/react-query';
import { fetchVpeNudgesSnapshot, vpeNudgesQueryKeys } from '@/lib/vpeNudgesSnapshot';

const STALE_MS = 60 * 1000;

export function prefetchVpeNudges(
  queryClient: QueryClient,
  clubId: string | null | undefined,
  userId: string | null | undefined
): void {
  if (!clubId) return;
  const effectiveUserId = userId ?? '';
  void queryClient.prefetchQuery({
    queryKey: vpeNudgesQueryKeys.snapshot(clubId, effectiveUserId || 'anon'),
    queryFn: () => fetchVpeNudgesSnapshot(clubId),
    staleTime: STALE_MS,
  });
}

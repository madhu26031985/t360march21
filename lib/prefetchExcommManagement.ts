import type { QueryClient } from '@tanstack/react-query';
import { excommManagementQueryKeys, fetchExcommManagementBundle } from '@/lib/excommManagementQuery';

const STALE_MS = 5 * 60 * 1000;

/** Call before navigating to ExComm Management so the screen often reads from cache (sub‑500ms). */
export function prefetchExcommManagement(queryClient: QueryClient, clubId: string | null | undefined): void {
  if (!clubId) return;
  void queryClient.prefetchQuery({
    queryKey: excommManagementQueryKeys.snapshot(clubId),
    queryFn: () => fetchExcommManagementBundle(clubId),
    staleTime: STALE_MS,
  });
}

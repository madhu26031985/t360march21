import type { QueryClient } from '@tanstack/react-query';
import { clubInfoManagementQueryKeys, fetchClubInfoManagementBundle } from '@/lib/clubInfoManagementQuery';

const STALE_MS = 5 * 60 * 1000;

export function prefetchClubInfoManagement(
  queryClient: QueryClient,
  clubId: string | null | undefined
): void {
  if (!clubId) return;
  void queryClient.prefetchQuery({
    queryKey: clubInfoManagementQueryKeys.detail(clubId),
    queryFn: () => fetchClubInfoManagementBundle(clubId),
    staleTime: STALE_MS,
  });
}

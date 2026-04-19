import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';

/**
 * Resolves `?skin=` for public agenda routes. On static web exports, query params
 * are sometimes missing from Router hooks; fall back to `window.location.search`.
 */
export function usePublicAgendaSkinQuery(): string | string[] | undefined {
  const globalParams = useGlobalSearchParams<{ skin?: string | string[] }>();
  const localParams = useLocalSearchParams<{ skin?: string | string[] }>();
  const pathname = usePathname();

  return useMemo(() => {
    void pathname;
    const fromRouter = localParams.skin ?? globalParams.skin;
    if (fromRouter != null && String(Array.isArray(fromRouter) ? fromRouter[0] : fromRouter).trim() !== '') {
      return fromRouter;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const s = new URLSearchParams(window.location.search).get('skin');
        if (s?.trim()) return s.trim();
      } catch {
        /* ignore */
      }
    }
    return undefined;
  }, [globalParams.skin, localParams.skin, pathname]);
}

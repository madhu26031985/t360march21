import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

const NATIVE_AVATAR_PROBE_URL = 'https://t360.in/favicon.ico';
const NATIVE_AVATAR_PROBE_MAX_MS = 700;
const NATIVE_AVATAR_PROBE_TTL_MS = 30_000;

let nativeAvatarProbeValue: boolean | null = null;
let nativeAvatarProbeAt = 0;
let nativeAvatarProbeInFlight: Promise<boolean> | null = null;

type NavigatorConnectionLike = {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

function shouldBlockAvatarDownloads(connection: NavigatorConnectionLike | undefined): boolean {
  if (Platform.OS !== 'web') return false;
  if (!connection) return false;
  if (connection.saveData) return true;
  const effectiveType = String(connection.effectiveType || '').toLowerCase();
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g') return true;
  if (typeof connection.downlink === 'number' && connection.downlink > 0 && connection.downlink < 1.5) return true;
  if (typeof connection.rtt === 'number' && connection.rtt >= 350) return true;
  return false;
}

function getNavigatorConnection(): NavigatorConnectionLike | undefined {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return undefined;
  const nav = navigator as Navigator & {
    connection?: NavigatorConnectionLike;
    mozConnection?: NavigatorConnectionLike;
    webkitConnection?: NavigatorConnectionLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection;
}

async function runWebSpeedProbe(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof fetch === 'undefined') return true;
  const startedAt = Date.now();
  try {
    const url = `${window.location.origin}/favicon.ico?avatar_probe=${startedAt}`;
    const response = await fetch(url, { cache: 'no-store' });
    const elapsedMs = Date.now() - startedAt;
    if (!response.ok) return elapsedMs < 500;
    return elapsedMs < 500;
  } catch {
    return false;
  }
}

async function runNativeSpeedProbe(): Promise<boolean> {
  if (Platform.OS === 'web' || typeof fetch === 'undefined') return true;
  const startedAt = Date.now();
  try {
    const response = await fetch(`${NATIVE_AVATAR_PROBE_URL}?avatar_probe=${startedAt}`, {
      cache: 'no-store',
    });
    const elapsedMs = Date.now() - startedAt;
    if (!response.ok) return elapsedMs < NATIVE_AVATAR_PROBE_MAX_MS;
    return elapsedMs < NATIVE_AVATAR_PROBE_MAX_MS;
  } catch {
    return false;
  }
}

async function getNativeProbeDecision(): Promise<boolean> {
  const now = Date.now();
  if (nativeAvatarProbeValue !== null && now - nativeAvatarProbeAt < NATIVE_AVATAR_PROBE_TTL_MS) {
    return nativeAvatarProbeValue;
  }
  if (!nativeAvatarProbeInFlight) {
    nativeAvatarProbeInFlight = runNativeSpeedProbe()
      .then((decision) => {
        nativeAvatarProbeValue = decision;
        nativeAvatarProbeAt = Date.now();
        return decision;
      })
      .finally(() => {
        nativeAvatarProbeInFlight = null;
      });
  }
  return nativeAvatarProbeInFlight;
}

export function useShouldLoadNetworkAvatars(): boolean {
  const getCurrent = (): boolean => {
    if (Platform.OS !== 'web') {
      return nativeAvatarProbeValue ?? false;
    }
    return !shouldBlockAvatarDownloads(getNavigatorConnection());
  };

  const [shouldLoadAvatars, setShouldLoadAvatars] = useState<boolean>(getCurrent);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      let cancelled = false;
      void getNativeProbeDecision().then((decision) => {
        if (!cancelled) setShouldLoadAvatars(decision);
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    const connection = getNavigatorConnection();
    const recompute = async () => {
      const connectionAllowsAvatars = getCurrent();
      if (!connectionAllowsAvatars) {
        if (!cancelled) setShouldLoadAvatars(false);
        return;
      }
      const probeAllowsAvatars = await runWebSpeedProbe();
      if (!cancelled) setShouldLoadAvatars(probeAllowsAvatars);
    };

    void recompute();
    if (!connection?.addEventListener) {
      return () => {
        cancelled = true;
      };
    }
    const handleChange = () => {
      void recompute();
    };
    connection.addEventListener('change', handleChange);
    return () => {
      cancelled = true;
      connection.removeEventListener?.('change', handleChange);
    };
  }, []);

  return shouldLoadAvatars;
}

export function initialsFromName(name: string | null | undefined, maxChars = 2): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, maxChars).toUpperCase();
  return parts
    .slice(0, maxChars)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

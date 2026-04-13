import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';

/**
 * Production is built with experiments.baseUrl `/weblogin`. In development, Expo Router does not
 * apply that prefix to URLs, so `/weblogin` would otherwise resolve to a non-existent "weblogin" route
 * (Unmatched Route). Rewrite to the same path without the prefix; keep query + hash for OAuth.
 *
 * In production, the router usually strips `/weblogin` before matching; if this screen still mounts,
 * send users to `/`.
 */
export default function WebloginWeb() {
  useEffect(() => {
    if (typeof window === 'undefined' || !__DEV__) return;

    const { origin, pathname, search, hash } = window.location;
    if (!pathname.startsWith('/weblogin')) return;

    let path = pathname.slice('/weblogin'.length);
    if (path === '' || path === '/') path = '/';
    else if (!path.startsWith('/')) path = `/${path}`;

    const target = `${origin}${path}${search}${hash}`;
    if (target !== window.location.href) {
      window.location.replace(target);
    }
  }, []);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <View style={{ flex: 1, backgroundColor: '#0f1419' }} />;
}

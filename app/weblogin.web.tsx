import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Production is built with experiments.baseUrl `/weblogin`. In development, Expo Router does not
 * apply that prefix to URLs, so `/weblogin` would otherwise resolve to a non-existent "weblogin" route
 * (Unmatched Route). Rewrite to the same path without the prefix; keep query + hash for OAuth.
 *
 * **Important (production):** Do not use `<Redirect href="/" />` here. OAuth returns to
 * `https://…/weblogin/#access_token=…` or `?code=…`; an immediate redirect drops hash/query before
 * Supabase `detectSessionInUrl` runs, so users appear logged out and return to login.
 */
export default function WebloginWeb() {
  const { isAuthenticated, hasInitialized, isLoading } = useAuth();
  const fallbackToLoginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { origin, pathname, search, hash } = window.location;

    if (__DEV__) {
      if (!pathname.startsWith('/weblogin')) return;
      // Netlify local dev serves the app under /weblogin via redirects.
      // Full-page navigation to "/" would hit "/" -> "/weblogin/" and loop; use client-side routing instead.
      if (window.location.port === '8888') {
        router.replace('/');
        return;
      }
      let path = pathname.slice('/weblogin'.length);
      if (path === '' || path === '/') path = '/';
      else if (!path.startsWith('/')) path = `/${path}`;
      const target = `${origin}${path}${search}${hash}`;
      if (target !== window.location.href) {
        window.location.replace(target);
      }
      return;
    }

    // Production: normalize bare `/weblogin` → `/weblogin/` while preserving OAuth hash/query.
    if (pathname === '/weblogin') {
      window.location.replace(`${origin}/weblogin/${search}${hash}`);
    }
  }, []);

  useEffect(() => {
    if (__DEV__) return;
    if (!hasInitialized || isLoading) return;

    if (isAuthenticated) {
      if (fallbackToLoginTimer.current) {
        clearTimeout(fallbackToLoginTimer.current);
        fallbackToLoginTimer.current = null;
      }
      router.replace('/(tabs)');
      return;
    }

    if (typeof window === 'undefined') return;

    const { search, hash } = window.location;
    const qp = new URLSearchParams(search);
    // Supabase sends failures as ?error=&error_description= — not a session-in-progress case.
    if (qp.get('error')) {
      router.replace(`/login${search}`);
      return;
    }

    const hasOauthInUrl =
      hash.includes('access_token') ||
      hash.includes('code') ||
      search.includes('code=');

    // Successful OAuth return: give Supabase time to apply session from URL before login fallback.
    const delayMs = hasOauthInUrl ? 2800 : 500;
    fallbackToLoginTimer.current = setTimeout(() => {
      fallbackToLoginTimer.current = null;
      router.replace('/login');
    }, delayMs);

    return () => {
      if (fallbackToLoginTimer.current) {
        clearTimeout(fallbackToLoginTimer.current);
        fallbackToLoginTimer.current = null;
      }
    };
  }, [hasInitialized, isLoading, isAuthenticated]);

  if (__DEV__) {
    const isNetlifyDev = typeof window !== 'undefined' && window.location.port === '8888';
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: isNetlifyDev ? '#ffffff' : '#0f1419',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isNetlifyDev ? <ActivityIndicator size="small" color="#6B7280" /> : null}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="small" color="#6B7280" />
    </View>
  );
}

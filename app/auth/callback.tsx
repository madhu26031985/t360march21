import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

/**
 * Native OAuth fallback callback route.
 * Handles cases where provider returns to app deep link directly.
 */
export default function AuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    let mounted = true;

    const finishAuth = async () => {
      try {
        const code = typeof params.code === 'string' ? params.code : null;
        const error = typeof params.error_description === 'string' ? params.error_description : null;

        if (error) {
          router.replace(`/login?error_description=${encodeURIComponent(error)}`);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            router.replace(`/login?error_description=${encodeURIComponent(exchangeError.message)}`);
            return;
          }
          if (mounted) router.replace('/(tabs)');
          return;
        }

        // Fallback for token-based providers using URL hash fragments.
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('#')) {
          const fragment = initialUrl.split('#')[1] || '';
          const hash = new URLSearchParams(fragment);
          const access_token = hash.get('access_token');
          const refresh_token = hash.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setSessionError) {
              router.replace(`/login?error_description=${encodeURIComponent(setSessionError.message)}`);
              return;
            }
            if (mounted) router.replace('/(tabs)');
            return;
          }
        }

        router.replace('/login');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'OAuth callback failed';
        router.replace(`/login?error_description=${encodeURIComponent(msg)}`);
      }
    };

    void finishAuth();
    return () => {
      mounted = false;
    };
  }, [params.code, params.error_description]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      <ActivityIndicator size="small" color="#6B7280" />
    </View>
  );
}

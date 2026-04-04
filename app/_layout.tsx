import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Linking, Platform } from 'react-native';
import { useEffect } from 'react';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import Constants from 'expo-constants';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { supabase } from '@/lib/supabase';
import UpdatePrompt from '@/components/UpdatePrompt';

function AppContent() {
  const { updateInfo, dismissUpdate } = useAppUpdate();

  useEffect(() => {
    console.log('🎨 [APP LAYOUT] AppContent rendered with updateInfo:', updateInfo);
  }, [updateInfo]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="vpe-nudges" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="accept-invitation" options={{ headerShown: false }} />
        <Stack.Screen name="create-club" options={{ headerShown: false }} />
        <Stack.Screen name="club-members" options={{ headerShown: false }} />
        <Stack.Screen name="member-profile" options={{ headerShown: false }} />
        <Stack.Screen name="book-a-role" options={{ headerShown: false }} />
        <Stack.Screen name="admin/edit-user" options={{ headerShown: false }} />
        <Stack.Screen name="meeting-details" options={{ headerShown: false }} />
        <Stack.Screen name="feedback-corner" options={{ headerShown: false }} />
        <Stack.Screen name="role-completion-report" options={{ headerShown: false }} />
        <Stack.Screen name="general-evaluator-notes" options={{ headerShown: false }} />
        <Stack.Screen name="table-topic-master-notes" options={{ headerShown: false }} />
        <Stack.Screen name="toastmaster-notes" options={{ headerShown: false }} />
        <Stack.Screen name="feedback-form" options={{ headerShown: false }} />
        <Stack.Screen name="meeting-agenda-view" options={{ headerShown: false }} />
        <Stack.Screen name="timer-role-assign" options={{ headerShown: false }} />
        <Stack.Screen name="[clubId]/agenda/[meetingNo]/[meetingId]" options={{ headerShown: false }} />
        <Stack.Screen name="[clubId]/a/[meetingId]" options={{ headerShown: false }} />
        <Stack.Screen name="a/[meetingId]" options={{ headerShown: false }} />
        <Stack.Screen name="version-debug" options={{ headerShown: false }} />
      </Stack>

      {updateInfo && (() => {
        console.log('🎯 [APP LAYOUT] Rendering UpdatePrompt with:', {
          visible: true,
          currentVersion: Constants.expoConfig?.version || '1.0.0',
          latestVersion: updateInfo.latestVersion,
          forceUpdate: updateInfo.forceUpdate,
          message: updateInfo.message,
          storeUrl: updateInfo.storeUrl,
        });
        return (
          <UpdatePrompt
            visible={true}
            currentVersion={Constants.expoConfig?.version || '1.0.0'}
            latestVersion={updateInfo.latestVersion}
            forceUpdate={updateInfo.forceUpdate}
            message={updateInfo.message}
            storeUrl={updateInfo.storeUrl}
            onDismiss={dismissUpdate}
          />
        );
      })()}
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  // Check if we should show splash screen first
  const shouldShowSplash = true; // Always show splash on app start

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      focusManager.setFocused(next === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Handle deep links for email confirmation
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);

      // Handle Supabase auth callback
      if (url.includes('access_token') || url.includes('refresh_token')) {
        // Extract tokens from URL and set session
        const urlObj = new URL(url);
        const accessToken = urlObj.searchParams.get('access_token');
        const refreshToken = urlObj.searchParams.get('refresh_token');

        if (accessToken && refreshToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error setting session from deep link:', error);
            } else {
              console.log('Session set successfully from deep link');
            }
          });
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { invalidateClubLandingCriticalCache } from '@/lib/clubTabLandingData';

// Conditional logging - only logs in development mode
const isDev = __DEV__;
const devLog = isDev ? console.log : () => {};
const devWarn = isDev ? console.warn : () => {};
// Always log errors
const logError = console.error;

interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  isActive: boolean;
  role?: string;
  clubId?: string;
  clubRole?: string;
  isAuthenticated?: boolean;
  clubs?: Array<{
    id: string;
    name: string;
    club_number: string | null;
    role: string;
    is_authenticated: boolean;
  }>;
  currentClubId?: string;
  /** From `app_user_profiles` — avoids a duplicate fetch on Journey Home */
  avatarUrl?: string | null;
  profileAbout?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  connectionError: boolean;
  retryConnection: () => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Opens Google OAuth (web: full redirect; native: in-app browser + code/hash exchange). */
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;

  signOut: () => Promise<void>;
  switchClub: (clubId: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasswordResetOtp: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  hasInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const isLoadingProfileRef = useRef(false);
  const lastProfileLoadTime = useRef<number>(0);
  const initProfileLoadedRef = useRef(false);

  const retryConnection = () => {
    setConnectionError(false);
    setIsLoading(true);
    setHasInitialized(false);
    setRetryKey(k => k + 1);
  };

  useEffect(() => {
    isLoadingProfileRef.current = false;
    let isMounted = true;
    let loadingUserId: string | null = null;
    let profileAbortController: AbortController | null = null;

    const runMigration = async () => {
      try {
        const migrationVersion = await AsyncStorage.getItem('club_id_migration_v1');
        if (!migrationVersion) {
          await AsyncStorage.removeItem('currentClubId');
          await AsyncStorage.setItem('club_id_migration_v1', 'done');
        }
      } catch {
        // non-critical
      }
    };

    runMigration();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      devLog('🔄 Auth state change event:', event, { userId: session?.user?.id || 'none' });

      if (event === 'TOKEN_REFRESHED') {
        if (session) setSession(session);
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        profileAbortController?.abort();
        profileAbortController = null;
        setUser(null);
        setSession(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        setHasInitialized(true);
        loadingUserId = null;
        isLoadingProfileRef.current = false;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        const runAppVersionPing = () => {
          void (async () => {
            try {
              const appVersion = Constants.expoConfig?.version ?? 'unknown';
              const platform = Platform.OS as 'ios' | 'android' | 'web';
              const buildNumber =
                platform === 'ios'
                  ? Constants.expoConfig?.ios?.buildNumber ?? null
                  : platform === 'android'
                  ? String(Constants.expoConfig?.android?.versionCode ?? '')
                  : null;
              const now = new Date().toISOString();
              // One round-trip (replaces select + update/insert). first_seen_at uses table default on insert.
              const { error: upsertError } = await supabase.from('user_app_versions').upsert(
                {
                  user_id: session.user.id,
                  platform,
                  app_version: appVersion,
                  build_number: buildNumber,
                  last_seen_at: now,
                  updated_at: now,
                },
                { onConflict: 'user_id,platform' }
              );
              if (upsertError) {
                console.warn('[AppVersion] upsert error:', JSON.stringify(upsertError));
              }
            } catch (e) {
              console.warn('[AppVersion] unexpected error:', e);
            }
          })();
        };

        // Web: defer so we don't compete with profile + Journey Home on Slow networks.
        if (Platform.OS === 'web') {
          const w = typeof globalThis !== 'undefined' ? (globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback : undefined;
          if (typeof w === 'function') {
            w(() => runAppVersionPing(), { timeout: 4000 });
          } else {
            setTimeout(runAppVersionPing, 2000);
          }
        } else {
          runAppVersionPing();
        }
      }

      const shouldLoadProfile = ['SIGNED_IN', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event);
      if (!shouldLoadProfile) {
        setSession(session);
        return;
      }

      if (loadingUserId === session.user.id) {
        devLog('⏭️ Already loading profile for this user, skipping');
        return;
      }

      profileAbortController?.abort();
      const controller = new AbortController();
      profileAbortController = controller;

      setSession(session);
      loadingUserId = session.user.id;
      isLoadingProfileRef.current = true;

      (async () => {
        try {
          await loadUserProfile(session.user, () => isMounted && !controller.signal.aborted, controller.signal);
          devLog('✅ Profile loaded');
        } catch (err) {
          if ((err as any)?.name === 'AbortError') return;
          devWarn('⚠️ Profile load failed:', err);
          if (isMounted && !controller.signal.aborted) setFallbackUser(session.user);
        } finally {
          isLoadingProfileRef.current = false;
          if (loadingUserId === session.user.id) loadingUserId = null;
          if (isMounted && !controller.signal.aborted) {
            setIsAuthenticated(true);
            setIsLoading(false);
            setHasInitialized(true);
          }
        }
      })();
    });

    return () => {
      isMounted = false;
      profileAbortController?.abort();
      subscription?.unsubscribe();
    };
  }, [retryKey]);

  const loadUserProfile = async (supabaseUser: SupabaseUser, getMounted: (() => boolean) | boolean = true, signal?: AbortSignal) => {
    const isMounted = () => typeof getMounted === 'function' ? getMounted() : getMounted;
    try {
      devLog('Loading user profile for:', supabaseUser.id);

      lastProfileLoadTime.current = Date.now();

      await loadUserProfileData(supabaseUser, signal);

    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      console.error('Error loading user profile:', error);
      if (!isMounted()) return;
      if (user?.currentClubId) {
        devLog('⚠️ Error but keeping existing user data');
        return;
      }
      setFallbackUser(supabaseUser);
    }
  };

  const setFallbackUser = (supabaseUser: SupabaseUser) => {
    const fallbackUser = {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      fullName: supabaseUser.user_metadata?.full_name || 'User',
      phoneNumber: undefined,
      isActive: true,
      role: 'new_user',
      clubs: [],
      isAuthenticated: false,
      currentClubId: undefined,
    };
    
    devLog('Setting fallback user:', fallbackUser);
    setUser(fallbackUser);
  };

  const loadUserProfileData = async (supabaseUser: SupabaseUser, signal?: AbortSignal) => {
    try {
      devLog('🔍 AuthContext: Starting loadUserProfileData for user:', supabaseUser.email);
      devLog('🆔 AuthContext: Supabase User ID:', supabaseUser.id);

      if (signal?.aborted) return;

      devLog('🔍 AuthContext: Querying app_user_profiles for user:', supabaseUser.id);
      const profileQuery = supabase
        .from('app_user_profiles')
        .select('id, email, full_name, phone_number, role, is_active, created_at, updated_at, avatar_url, About')
        .eq('id', supabaseUser.id)
        .maybeSingle()
        .abortSignal(signal as AbortSignal);

      const timeoutId = setTimeout(() => {
        devWarn('⚠️ Profile query timeout after 8s');
      }, 8000);

      const { data: appProfile, error: appError } = await profileQuery;
      clearTimeout(timeoutId);

      if (signal?.aborted) return;

      devLog('📋 AuthContext: app_user_profiles query result:', {
        hasData: !!appProfile,
        error: appError?.message || 'none', 
        errorCode: appError?.code || 'none',
        userId: supabaseUser.id,
        profileId: (appProfile as any)?.id || 'none',
        email: (appProfile as any)?.email || 'none'
      });

      // If profile doesn't exist, create it
      if (appError && appError.code === 'PGRST116') {
        devLog('🆕 AuthContext: Profile not found, creating new profile...');
        
        const newProfileData = {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          full_name: supabaseUser.user_metadata?.full_name || 'User',
          role: 'new_user',
          is_active: true,
        };

        devLog('🆕 AuthContext: New profile data:', newProfileData);

        // Try to create profile using service role or handle RLS
        try {
          const { data: createdProfile, error: createError } = await supabase
            .from('app_user_profiles')
            .insert(newProfileData as any)
            .select()
            .single();

          if (createError) {
            console.error('💥 AuthContext: Error creating user profile:', createError);
            
            // If RLS policy prevents creation, use fallback approach
            if (createError.code === '42501') {
              devLog('🔒 AuthContext: RLS policy preventing profile creation, using fallback user data');
              setFallbackUser(supabaseUser);
              return;
            }
            
            throw new Error('Failed to create user profile');
          }

          devLog('✅ AuthContext: New profile created successfully:', createdProfile);
          // Use the newly created profile
          const finalProfile = createdProfile;
          
          // Process the created profile
          await processUserProfile(finalProfile, supabaseUser, signal);
          return;
          
        } catch (createError) {
          console.error('💥 AuthContext: Profile creation failed:', createError);
          devLog('🔄 AuthContext: Using fallback user approach');
          setFallbackUser(supabaseUser);
          return;
        }
      } else if (appError && appError.code !== 'PGRST116') {
        console.error('💥 AuthContext: Error loading app user profile:', appError);
        throw new Error('Profile load failed');
      }

      if (!appProfile) {
        devLog('❌ AuthContext: No profile available, using fallback');
        setFallbackUser(supabaseUser);
        return;
      }
      
      // Process existing profile
      await processUserProfile(appProfile, supabaseUser, signal);

    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      devWarn('⚠️ AuthContext: Error in loadUserProfileData, using fallback:', error);
      setFallbackUser(supabaseUser);
    }
  };

  const processUserProfile = async (appProfile: any, supabaseUser: SupabaseUser, signal?: AbortSignal) => {
    try {
      if (signal?.aborted) return;
      devLog('🔍 AuthContext: Processing user profile for:', appProfile.email);

      // Fetch club relationships and stored club ID in parallel
      const [clubResult, storedClubId] = await Promise.all([
        supabase
          .from('app_club_user_relationship')
          .select(`
            club_id,
            role,
            is_authenticated,
            user_id,
            clubs (
              id,
              name,
              club_number
            )
          `)
          .eq('user_id', appProfile.id)
          .abortSignal(signal as AbortSignal),
        AsyncStorage.getItem('currentClubId').catch(() => null),
      ]);

      const { data: clubRelationships, error: clubError } = clubResult;

      devLog('🏢 AuthContext: Club relationships query result:', {
        success: !clubError,
        count: clubRelationships?.length || 0,
        error: clubError?.message || 'none',
        queryUserId: appProfile.id,
        relationships: clubRelationships?.map(rel => ({
          clubName: (rel as any).clubs?.name,
          role: (rel as any).role,
          isAuth: (rel as any).is_authenticated,
          userId: (rel as any).user_id
        })) || []
      });

      // Process club relationships
      let clubs: Array<{
        id: string;
        name: string;
        club_number: string | null;
        role: string;
        is_authenticated: boolean;
      }> = [];
      let currentClubId = undefined;
      let currentClubRole = undefined;
      let isAuthenticated = false;
      
            if (clubRelationships && clubRelationships.length > 0 && !clubError) {
        devLog('✅ AuthContext: Processing', clubRelationships.length, 'club relationships:');

        // Filter for authenticated clubs only right after fetching
        const authenticatedClubRelationships = clubRelationships.filter(c => c.is_authenticated);

        // Populate the 'clubs' array for the user object with only authenticated relationships
        clubs = authenticatedClubRelationships.map(rel => {
          devLog(`   📍 AuthContext: Club: ${(rel as any).clubs?.name || 'Unknown'}`);
          devLog(`      AuthContext: Role: ${(rel as any).role}`);
          devLog(`      AuthContext: Authenticated: ${(rel as any).is_authenticated}`);
          devLog(`      AuthContext: Club ID: ${(rel as any).club_id}`);

          return {
            id: (rel as any).club_id,
            name: (rel as any).clubs?.name || 'Unknown Club',
            club_number: (rel as any).clubs?.club_number || null,
            role: (rel as any).role,
            is_authenticated: (rel as any).is_authenticated,
          };
        });

        devLog('🔐 AuthContext: Authenticated clubs found:', clubs.length);
        clubs.forEach(club => {
          devLog(`   ✅ AuthContext: ${club.name} (${club.role})`);
        });

        devLog('💾 AuthContext: Stored club ID retrieved:', storedClubId || 'none');
        let currentClub = null;

        if (clubs.length > 0) {
          // Prefer stored club if valid, otherwise use first club
          if (storedClubId) {
            currentClub = clubs.find(c => c.id === storedClubId);
            if (currentClub) {
              devLog('💾 AuthContext: Using stored club:', currentClub.name);
            } else {
              devLog('⚠️ AuthContext: Stored club ID not found in user clubs, using first club');
              currentClub = clubs[0];
              // Update stored club ID to match the new selection
              try {
                await AsyncStorage.setItem('currentClubId', currentClub.id);
                devLog('💾 AuthContext: Updated stored club ID to:', currentClub.id);
              } catch (updateError) {
                devWarn('💾 AuthContext: Failed to update club ID:', updateError);
              }
            }
          } else {
            devLog('💾 AuthContext: No stored club ID, using first club');
            currentClub = clubs[0];
          }
          devLog('🎯 AuthContext: Selected authenticated club:', currentClub?.name);
        } else {
          devLog('❌ AuthContext: No authenticated clubs found for user');
        }

        if (currentClub) {
          currentClubId = currentClub.id;
          currentClubRole = currentClub.role;
          isAuthenticated = currentClub.is_authenticated;

          devLog('🎯 AuthContext: Selected club context:', {
            clubName: currentClub.name,
            clubId: currentClub.id,
            role: currentClubRole,
            isAuthenticated: isAuthenticated
          });

          // Store the current club ID for persistence
          try {
            devLog('💾 AuthContext: Saving club ID to AsyncStorage:', currentClub.id);
            await AsyncStorage.setItem('currentClubId', currentClub.id);
            devLog('💾 AuthContext: Club ID saved successfully to AsyncStorage');
          } catch (storageError) {
            devWarn('💾 AuthContext: Storage save error:', storageError);
          }
        } else {
          // If no currentClub is selected (e.g., no authenticated clubs), ensure currentClubId is undefined
          currentClubId = undefined;
          currentClubRole = undefined;
          isAuthenticated = false;
          devLog('❌ AuthContext: No current club selected');
        }
      } else {
        devLog('❌ AuthContext: No club relationships found for user:', appProfile.email);
        if (clubError) {
          console.error('❌ AuthContext: Club query error:', clubError.message);
        }
        // Ensure clubs array is empty if no relationships or error
        clubs = [];
        currentClubId = undefined;
        currentClubRole = undefined;
        isAuthenticated = false;
      }

       
      
      // Determine final user role - prioritize authenticated club role
      const finalRole = (isAuthenticated && currentClubRole) 
        ? currentClubRole 
        : (appProfile.role !== 'new_user' ? appProfile.role : 'new_user');
      
      devLog('🎭 AuthContext: Final role assigned:', finalRole);
      
      const aboutRaw = (appProfile as { About?: string | null }).About;
      const avatarRaw = (appProfile as { avatar_url?: string | null }).avatar_url;

      const existingUser = {
        id: appProfile.id,
        email: appProfile.email,
        fullName: appProfile.full_name,
        phoneNumber: appProfile.phone_number || undefined,
        isActive: appProfile.is_active || true,
        role: finalRole,
        clubId: currentClubId,
        clubRole: currentClubRole,
        isAuthenticated: isAuthenticated,
        clubs: clubs,
        currentClubId: currentClubId,
        avatarUrl: typeof avatarRaw === 'string' ? avatarRaw.trim() || null : null,
        profileAbout: typeof aboutRaw === 'string' ? aboutRaw : null,
      };
      
      devLog('👤 AuthContext: FINAL USER OBJECT:', {
        email: existingUser.email,
        userId: existingUser.id,
        role: existingUser.role,
        clubRole: existingUser.clubRole,
        hasClub: !!existingUser.currentClubId,
        currentClubId: existingUser.currentClubId,
        isAuthenticated: existingUser.isAuthenticated,
        totalClubs: existingUser.clubs?.length || 0,
        clubNames: existingUser.clubs?.map(c => c.name) || []
      });
      
      devLog('✅ AuthContext: Setting user object in state');
      setUser(existingUser);
    } catch (error) {
      console.error('💥 AuthContext: Error processing user profile:', error);
      setFallbackUser(supabaseUser);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      devLog('🔐 AuthContext: Starting sign in for:', email);

      if (!supabase) {
        console.error('💥 AuthContext: Supabase client not available');
        return { success: false, error: 'Authentication service not available' };
      }

      devLog('🔐 AuthContext: Calling signInWithPassword...');
      const signInPromise = supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign in timeout')), 10000)
      );

      const result = await Promise.race([signInPromise, timeoutPromise]) as any;
      const { data, error } = result;

      devLog('🔐 AuthContext: Sign in result:', {
        success: !error,
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message || 'none'
      });

      if (error) {
        // Check for specific email confirmation error
        if (error.message.includes('email not confirmed') || error.message.includes('Email not confirmed')) {
          devLog('📧 AuthContext: Email not confirmed error');
          return { success: false, error: 'Please check your email and click the verification link before signing in.' };
        }

        // Check for banned/deleted user error
        if (error.message.includes('banned') || error.message.includes('User is banned')) {
          devLog('🚫 AuthContext: User account has been deleted');
          return { success: false, error: 'This account has been deleted and can no longer be used.' };
        }

        console.error('💥 AuthContext: Sign in error:', error.message);
        return { success: false, error: error.message };
      }

      // Additional check for email confirmation status
      if (data.user && !data.user.email_confirmed_at) {
        devLog('📧 AuthContext: User email not confirmed');
        return { success: false, error: 'Please verify your email address before signing in. Check your inbox for a verification link.' };
      }

      // Check if user account has been deleted (banned)
      if (data.user && data.user.banned_until) {
        devLog('🚫 AuthContext: User account is banned/deleted');
        await supabase.auth.signOut();
        return { success: false, error: 'This account has been deleted and can no longer be used.' };
      }

      // Check metadata for deletion flag
      if (data.user && data.user.user_metadata?.account_deleted) {
        devLog('🚫 AuthContext: User account marked as deleted');
        await supabase.auth.signOut();
        return { success: false, error: 'This account has been deleted and can no longer be used.' };
      }

      devLog('✅ AuthContext: Sign in successful');
      return { success: true };
    } catch (error) {
      console.error('💥 AuthContext: Sign in error:', error);
      if (error instanceof Error) {
        if (error.message === 'Sign in timeout') {
          devLog('⏰ AuthContext: Sign in timeout occurred');
          return { success: false, error: 'Connection timeout. Please check your internet connection and try again.' };
        }
        // Handle JSON parse errors
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          console.error('💥 AuthContext: JSON parse error, possibly server issue');
          return { success: false, error: 'Server error. Please try again later or contact support.' };
        }
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const signUp = async (email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const signUpPromise = supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: 'toastmaster360://auth/callback'
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Sign up timeout')), 10000)
      );

      const result = await Promise.race([signUpPromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) {
        console.error('❌ Sign up error from Supabase:', error.message);
        // Check for specific duplicate user error
        if (error.message.includes('already registered') ||
            error.message.includes('User already registered') ||
            error.message.includes('already been registered')) {
          return {
            success: false,
            error: 'This email address is already registered. Please sign in or use a different email address.'
          };
        }
        return { success: false, error: error.message };
      }

      // Supabase returns a user even if email exists but unconfirmed
      // Check if this is actually a new signup or existing user
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        devLog('❌ Email exists but unconfirmed:', email.trim());
        return {
          success: false,
          error: 'This email address is already registered. Please sign in or check your email for the verification link.'
        };
      }

      // Check if user needs to confirm email
      if (data.user && !data.user.email_confirmed_at) {
        return {
          success: true,
          error: 'Please check your email and click the verification link to complete your registration.'
        };
      }

      return { success: true };
    } catch (error) {
      console.error('💥 Sign up exception:', error);
      if (error instanceof Error && error.message === 'Sign up timeout') {
        return { success: false, error: 'Connection timeout. Please check your internet connection and try again.' };
      }
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const getOAuthRedirectUrl = (): string => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/weblogin/`;
    }
    return Linking.createURL('/login');
  };

  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const redirectTo = getOAuthRedirectUrl();
      devLog('🔐 AuthContext: Google OAuth redirectTo:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        devWarn('Google OAuth start error:', error.message);
        return { success: false, error: error.message };
      }

      if (!data?.url) {
        return { success: false, error: 'No OAuth URL returned. Enable Google in Supabase Auth providers.' };
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(data.url);
        return { success: true };
      }

      const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
        return { success: false, error: 'Sign in was cancelled' };
      }

      if (authResult.type !== 'success' || !authResult.url) {
        return { success: false, error: 'Could not complete Google sign in' };
      }

      const incoming = authResult.url;
      let code: string | null = null;
      let hashParams = new URLSearchParams();
      try {
        const url = new URL(incoming);
        code = url.searchParams.get('code');
        if (url.hash.length > 1) {
          hashParams = new URLSearchParams(url.hash.slice(1));
        }
      } catch {
        const hashIdx = incoming.indexOf('#');
        if (hashIdx >= 0) {
          hashParams = new URLSearchParams(incoming.slice(hashIdx + 1).split('?')[0]);
        }
        const qIdx = incoming.indexOf('?');
        if (qIdx >= 0) {
          const qs = incoming.slice(qIdx + 1).split('#')[0];
          code = new URLSearchParams(qs).get('code');
        }
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          return { success: false, error: exchangeError.message };
        }
        return { success: true };
      }

      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (sessionError) {
          return { success: false, error: sessionError.message };
        }
        return { success: true };
      }

      return { success: false, error: 'Unexpected response from Google sign in' };
    } catch (e) {
      logError('Google sign in error:', e);
      const msg = e instanceof Error ? e.message : 'Google sign in failed';
      return { success: false, error: msg };
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://app.toastmaster360.com/reset-password',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const setupPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    invalidateClubLandingCriticalCache();
    setUser(null);
    setSession(null);
    setIsAuthenticated(false);

    try {
      await AsyncStorage.multiRemove(['currentClubId']);
    } catch {
      // non-critical
    }

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 5000)),
      ]);
    } catch (error) {
      devWarn('⚠️ AuthContext: Sign out error (non-critical):', error instanceof Error ? error.message : error);
    }
  };

  const switchClub = async (clubId: string) => {
    if (!user || !user.clubs) return;
    
    devLog('🔄 AuthContext: Switching to club:', clubId);
    
    const selectedClub = user.clubs.find(c => c.id === clubId);
    if (!selectedClub) return;
    
    try {
      // Store the selected club ID
      try {
        devLog('💾 AuthContext: Saving new club ID to AsyncStorage:', clubId);
        await AsyncStorage.setItem('currentClubId', clubId);
        devLog('💾 AuthContext: Club ID saved successfully');
      } catch (storageError) {
        devWarn('💾 AuthContext: AsyncStorage error during club switch:', storageError);
      }
      
      // Update user state with new current club
      const updatedUser = {
        ...user,
        clubId: selectedClub.id,
        clubRole: selectedClub.role,
        isAuthenticated: selectedClub.is_authenticated,
        currentClubId: selectedClub.id,
        role: selectedClub.is_authenticated ? selectedClub.role : user.role,
      };
      
      devLog('✅ AuthContext: Club switched successfully to:', selectedClub.name);
      invalidateClubLandingCriticalCache();
      setUser(updatedUser);
    } catch (error) {
      console.error('💥 AuthContext: Error switching club:', error);
    }
  };

  const refreshUserProfile = async () => {
    if (!session?.user) {
      devLog('⏭️ AuthContext: No session, skipping profile refresh');
      return;
    }

    // Prevent excessive reloads - only reload if at least 30 seconds have passed
    const now = Date.now();
    const timeSinceLastLoad = now - lastProfileLoadTime.current;
    const MIN_RELOAD_INTERVAL = 30000; // 30 seconds

    if (timeSinceLastLoad < MIN_RELOAD_INTERVAL) {
      devLog(`⏭️ AuthContext: Profile refresh skipped (${Math.round(timeSinceLastLoad / 1000)}s since last reload)`);
      return;
    }

    // Skip if already loading
    if (isLoadingProfileRef.current) {
      devLog('⏭️ AuthContext: Profile already loading, skipping refresh');
      return;
    }

    try {
      devLog('🔄 AuthContext: Refreshing user profile...');
      isLoadingProfileRef.current = true;
      lastProfileLoadTime.current = now;
      await loadUserProfile(session.user);
      devLog('✅ AuthContext: User profile refreshed successfully');
    } catch (error) {
      console.error('💥 AuthContext: Error refreshing user profile:', error);
    } finally {
      isLoadingProfileRef.current = false;
    }
  };

  const verifyEmailOtp = async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error verifying email OTP:', error);
      return { success: false, error: 'An unexpected error occurred during verification.' };
    }
  };

  const resendVerificationEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error resending verification email:', error);
      return { success: false, error: 'An unexpected error occurred while resending the email.' };
    }
  };

  const sendPasswordResetOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // Don't create new user if email doesn't exist
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending password reset OTP:', error);
      return { success: false, error: 'An unexpected error occurred while sending the reset code.' };
    }
  };

  const verifyPasswordResetOtp = async (email: string, token: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!supabase) {
        return { success: false, error: 'Authentication service not available' };
      }

      // First verify the OTP
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      });

      if (verifyError) {
        return { success: false, error: verifyError.message };
      }

      if (!data.session) {
        return { success: false, error: 'Failed to establish session after verification' };
      }

      // Update the password using the temporary session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword.trim()
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Sign out after password update to force fresh login
      await supabase.auth.signOut();

      return { success: true };
    } catch (error) {
      console.error('Error verifying password reset OTP:', error);
      return { success: false, error: 'An unexpected error occurred during password reset.' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated,
      connectionError,
      retryConnection,
      signIn,
      signInWithGoogle,
      signUp,
      resetPassword,
      signOut,
      switchClub,
      refreshUserProfile,
      verifyEmailOtp,
      resendVerificationEmail,
      sendPasswordResetOtp,
      verifyPasswordResetOtp,
      hasInitialized,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
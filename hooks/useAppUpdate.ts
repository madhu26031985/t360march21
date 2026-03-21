import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

interface VersionConfig {
  currentVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  updateMessage: string | null;
  storeUrl: string | null;
}

interface UpdateInfo {
  needsUpdate: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  message: string;
  storeUrl: string;
}

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Log when updateInfo changes
  useEffect(() => {
    console.log('🔄 [VERSION CHECK] updateInfo state changed:', updateInfo);
  }, [updateInfo]);

  useEffect(() => {
    console.log('🎬 [VERSION CHECK] Hook mounted');
    // Add a small delay to ensure app is fully loaded
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const checkForUpdate = async () => {
    try {
      setIsChecking(true);
      console.log('🔍 [VERSION CHECK] Starting...');

      // Skip version check for web platform entirely
      if (Platform.OS === 'web') {
        console.log('🌐 [VERSION CHECK] Web platform detected - skipping version check');
        setIsChecking(false);
        return;
      }

      const installedVersion = Constants.expoConfig?.version || '1.0.0';
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      console.log('=== VERSION CHECK DEBUG ===');
      console.log('📱 Installed version:', installedVersion);
      console.log('🤖 Platform:', platform);
      console.log('📲 Platform.OS raw:', Platform.OS);
      console.log('🔧 Constants.expoConfig:', Constants.expoConfig);

      console.log('🌐 [VERSION CHECK] Querying database for platform:', platform);

      const { data, error } = await supabase
        .from('app_version_config')
        .select('current_version, minimum_version, force_update, update_message, store_url')
        .eq('platform', platform)
        .single();

      console.log('📊 [VERSION CHECK] Database response:', { data, error });

      if (error) {
        console.error('❌ [VERSION CHECK] Database error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        setIsChecking(false);
        return;
      }

      if (!data) {
        console.error('❌ [VERSION CHECK] No data returned');
        setIsChecking(false);
        return;
      }

      // Map database snake_case to camelCase
      const config: VersionConfig = {
        currentVersion: data.current_version,
        minimumVersion: data.minimum_version,
        forceUpdate: data.force_update,
        updateMessage: data.update_message,
        storeUrl: data.store_url,
      };

      console.log('✅ [VERSION CHECK] Config loaded successfully');
      console.log('📋 Required version:', config.currentVersion);
      console.log('📋 Minimum version:', config.minimumVersion);
      console.log('📋 Force update flag:', config.forceUpdate);
      console.log('📋 Store URL:', config.storeUrl);

      // Check if version data is valid
      if (!config.currentVersion || !config.minimumVersion) {
        console.error('⚠️ [VERSION CHECK] Invalid version configuration in database');
        setIsChecking(false);
        return;
      }

      const comparisonResult = compareVersions(installedVersion, config.currentVersion);
      const minimumComparisonResult = compareVersions(installedVersion, config.minimumVersion);

      console.log('🔢 [VERSION CHECK] Version comparison:');
      console.log(`   ${installedVersion} vs ${config.currentVersion} = ${comparisonResult}`);
      console.log(`   ${installedVersion} vs ${config.minimumVersion} (min) = ${minimumComparisonResult}`);

      const needsUpdate = comparisonResult < 0;
      const needsForceUpdate = minimumComparisonResult < 0;

      console.log('📊 [VERSION CHECK] Decision:');
      console.log('   needsUpdate:', needsUpdate);
      console.log('   needsForceUpdate:', needsForceUpdate);

      if (needsUpdate || needsForceUpdate) {
        const updateData = {
          needsUpdate: true,
          forceUpdate: needsForceUpdate || config.forceUpdate,
          latestVersion: config.currentVersion,
          message: config.updateMessage || 'A new version is available! Update now for the best experience.',
          storeUrl: config.storeUrl || getDefaultStoreUrl(platform),
        };
        console.log('🚨 [VERSION CHECK] UPDATE REQUIRED! Setting updateInfo:', updateData);
        setUpdateInfo(updateData);
      } else {
        console.log('✅ [VERSION CHECK] No update needed - app is up to date');
      }
      console.log('=== END VERSION CHECK ===');
    } catch (error: any) {
      console.error('❌ [VERSION CHECK] Exception caught:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
    } finally {
      setIsChecking(false);
      console.log('🏁 [VERSION CHECK] Finished. isChecking set to false');
    }
  };

  const dismissUpdate = () => {
    if (updateInfo && !updateInfo.forceUpdate) {
      setUpdateInfo(null);
    }
  };

  return {
    updateInfo,
    isChecking,
    dismissUpdate,
    recheckUpdate: checkForUpdate,
  };
}

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

function getDefaultStoreUrl(platform: 'ios' | 'android'): string {
  if (platform === 'ios') {
    return 'https://apps.apple.com/app/your-app-id';
  }
  return 'https://play.google.com/store/apps/details?id=your.package.name';
}

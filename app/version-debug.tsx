import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, AlertTriangle, Download, Smartphone, Package, Code } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceSoft: '#F7F6F3',
  border: 'rgba(55, 53, 47, 0.10)',
  text: '#37352F',
  textSecondary: '#787774',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.10)',
  successSoft: '#F3F8F5',
  warningSoft: '#FBF8F1',
  dangerSoft: '#FBF3F3',
};

export default function VersionCheckScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<'up-to-date' | 'optional' | 'required' | 'error'>('up-to-date');
  const [dbConfig, setDbConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [queryLogs, setQueryLogs] = useState<string[]>([]);
  const installedVersion = Constants.expoConfig?.version || '1.0.0';
  const platformLabel = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';

  useEffect(() => {
    checkVersionConfig();
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setQueryLogs(prev => [...prev, `${timestamp}: ${message}`]);
  };

  const checkVersionConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      setQueryLogs([]);

      addLog('Starting version check...');
      addLog(`Installed version: ${installedVersion}`);
      addLog(`Platform: ${Platform.OS}`);
      addLog(`Platform.OS raw: ${Platform.OS}`);

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      addLog(`Querying database for platform: ${platform}`);

      const { data, error: dbError } = await supabase
        .from('app_version_config')
        .select('current_version, minimum_version, force_update, update_message, store_url')
        .eq('platform', platform)
        .maybeSingle();

      if (dbError) {
        addLog(`Database error: ${dbError.message}`);
        setError(dbError.message);
        setUpdateStatus('error');
        setLoading(false);
        return;
      }

      if (!data) {
        addLog('No version configuration found in database');
        setError('Version configuration not found');
        setUpdateStatus('error');
        setLoading(false);
        return;
      }

      addLog('Database config retrieved successfully');
      addLog(`Current version in DB: ${data.current_version}`);
      addLog(`Minimum version in DB: ${data.minimum_version}`);
      addLog(`Force update: ${data.force_update}`);

      setDbConfig(data);

      const needsForceUpdate = compareVersions(installedVersion, data.minimum_version) < 0;
      const needsUpdate = compareVersions(installedVersion, data.current_version) < 0;

      addLog(`Needs update: ${needsUpdate}`);
      addLog(`Needs force update: ${needsForceUpdate}`);

      if (needsForceUpdate) {
        setUpdateStatus('required');
        addLog('Status: Update REQUIRED');
      } else if (needsUpdate) {
        setUpdateStatus('optional');
        addLog('Status: Update AVAILABLE');
      } else {
        setUpdateStatus('up-to-date');
        addLog('Status: UP TO DATE');
      }

      setLoading(false);
    } catch (err: any) {
      addLog(`Exception: ${err.message}`);
      setError(err.message);
      setUpdateStatus('error');
      setLoading(false);
    }
  };

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

  const handleUpdatePress = async () => {
    if (!dbConfig?.store_url) return;

    try {
      const canOpen = await Linking.canOpenURL(dbConfig.store_url);
      if (canOpen) {
        await Linking.openURL(dbConfig.store_url);
      }
    } catch (err) {
      console.error('Error opening store URL:', err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: N.text }]} maxFontSizeMultiplier={1.3}>App Version Check</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Checking for updates...
            </Text>
          </View>
        ) : (
          <>
            {updateStatus === 'up-to-date' && (
              <View style={[styles.statusCard, styles.upToDateCard, { borderColor: N.border }]}>
                <CheckCircle2 size={52} color={N.textSecondary} />
                <Text style={[styles.statusTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>You're up to date!</Text>
                <Text style={[styles.statusDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  You're using the latest version of T360
                </Text>
                <View style={[styles.versionBadge, { backgroundColor: N.iconMuted }]}>
                  <Text style={styles.versionText} maxFontSizeMultiplier={1.3}>v{installedVersion}</Text>
                </View>
              </View>
            )}

            {updateStatus === 'optional' && (
              <View style={[styles.statusCard, styles.optionalCard, { borderColor: N.border }]}>
                <Download size={52} color={N.textSecondary} />
                <Text style={[styles.statusTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Update Available</Text>
                <Text style={[styles.statusDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dbConfig?.update_message || 'A new version is available with improvements and bug fixes.'}
                </Text>
                <View style={[styles.versionInfo, { borderColor: N.border }]}>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Current Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      v{installedVersion}
                    </Text>
                  </View>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Latest Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      v{dbConfig?.current_version}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.updateButton, { backgroundColor: N.text }]} onPress={handleUpdatePress}>
                  <Download size={20} color="#ffffff" />
                  <Text style={styles.updateButtonText} maxFontSizeMultiplier={1.3}>Update Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {updateStatus === 'required' && (
              <View style={[styles.statusCard, styles.requiredCard, { borderColor: N.border }]}>
                <AlertTriangle size={52} color={N.textSecondary} />
                <Text style={[styles.statusTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Update Required</Text>
                <Text style={[styles.statusDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {dbConfig?.update_message || 'This version is no longer supported. Please update to continue using T360.'}
                </Text>
                <View style={[styles.versionInfo, { borderColor: N.border }]}>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Current Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      v{installedVersion}
                    </Text>
                  </View>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Required Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      v{dbConfig?.minimum_version}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.updateButton, styles.requiredButton, { backgroundColor: N.text }]} onPress={handleUpdatePress}>
                  <Download size={20} color="#ffffff" />
                  <Text style={styles.updateButtonText} maxFontSizeMultiplier={1.3}>Update Required</Text>
                </TouchableOpacity>
              </View>
            )}

            {updateStatus === 'error' && (
              <View style={[styles.statusCard, styles.errorCard, { borderColor: N.border }]}>
                <AlertTriangle size={52} color={N.textSecondary} />
                <Text style={[styles.statusTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Unable to Check</Text>
                <Text style={[styles.statusDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {error || 'Could not check for updates. Please try again later.'}
                </Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: N.text }]} onPress={checkVersionConfig}>
                  <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.3}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.infoSection, { backgroundColor: N.surface, borderColor: N.border }]}>
              <View style={styles.infoGrid}>
                <View style={[styles.infoCard, { backgroundColor: N.surfaceSoft }]}>
                  <View style={[styles.iconCircle, { backgroundColor: N.iconTile }]}>
                    <Smartphone size={22} color={N.iconMuted} />
                  </View>
                  <Text style={[styles.infoCardLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Platform
                  </Text>
                  <Text style={[styles.infoCardValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {platformLabel}
                  </Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: N.surfaceSoft }]}>
                  <View style={[styles.iconCircle, { backgroundColor: N.iconTile }]}>
                    <Package size={22} color={N.iconMuted} />
                  </View>
                  <Text style={[styles.infoCardLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Version
                  </Text>
                  <Text style={[styles.infoCardValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {installedVersion}
                  </Text>
                </View>

                {Constants.nativeBuildVersion && (
                  <View style={[styles.infoCard, { backgroundColor: N.surfaceSoft }]}>
                    <View style={[styles.iconCircle, { backgroundColor: N.iconTile }]}>
                      <Code size={22} color={N.iconMuted} />
                    </View>
                    <Text style={[styles.infoCardLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Build
                    </Text>
                    <Text style={[styles.infoCardValue, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      {Constants.nativeBuildVersion}
                    </Text>
                  </View>
                )}
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  statusCard: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  upToDateCard: {
    backgroundColor: N.successSoft,
  },
  optionalCard: {
    backgroundColor: N.warningSoft,
  },
  requiredCard: {
    backgroundColor: N.dangerSoft,
  },
  errorCard: {
    backgroundColor: N.dangerSoft,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  versionBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  versionInfo: {
    width: '100%',
    backgroundColor: N.surface,
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  versionLabel: {
    fontSize: 14,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateButton: {
    backgroundColor: N.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 4,
  },
  requiredButton: {
    backgroundColor: '#ef4444',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  retryButton: {
    backgroundColor: N.text,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoSection: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  infoCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: N.border,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoCardLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  infoCardValue: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  debugToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debugToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  debugSection: {
    borderRadius: 4,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  debugBlock: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  debugText: {
    fontSize: 13,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  logText: {
    fontSize: 11,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  refreshButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

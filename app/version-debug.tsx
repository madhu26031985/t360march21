import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CheckCircle2, AlertTriangle, Download, ChevronDown, ChevronUp, Info, Smartphone, Package, Code } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function VersionCheckScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<'up-to-date' | 'optional' | 'required' | 'error'>('up-to-date');
  const [dbConfig, setDbConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [queryLogs, setQueryLogs] = useState<string[]>([]);
  const installedVersion = Constants.expoConfig?.version || '1.0.0';

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>App Version Check</Text>
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
              <View style={[styles.statusCard, styles.upToDateCard]}>
                <CheckCircle2 size={64} color="#10b981" />
                <Text style={styles.statusTitle} maxFontSizeMultiplier={1.3}>You're up to date!</Text>
                <Text style={styles.statusDescription} maxFontSizeMultiplier={1.3}>
                  You're using the latest version of T360
                </Text>
                <View style={styles.versionBadge}>
                  <Text style={styles.versionText} maxFontSizeMultiplier={1.3}>v{installedVersion}</Text>
                </View>
              </View>
            )}

            {updateStatus === 'optional' && (
              <View style={[styles.statusCard, styles.optionalCard]}>
                <Download size={64} color="#f59e0b" />
                <Text style={styles.statusTitle} maxFontSizeMultiplier={1.3}>Update Available</Text>
                <Text style={styles.statusDescription} maxFontSizeMultiplier={1.3}>
                  {dbConfig?.update_message || 'A new version is available with improvements and bug fixes.'}
                </Text>
                <View style={styles.versionInfo}>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Current Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      v{installedVersion}
                    </Text>
                  </View>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Latest Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      v{dbConfig?.current_version}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.updateButton} onPress={handleUpdatePress}>
                  <Download size={20} color="#ffffff" />
                  <Text style={styles.updateButtonText} maxFontSizeMultiplier={1.3}>Update Now</Text>
                </TouchableOpacity>
              </View>
            )}

            {updateStatus === 'required' && (
              <View style={[styles.statusCard, styles.requiredCard]}>
                <AlertTriangle size={64} color="#ef4444" />
                <Text style={styles.statusTitle} maxFontSizeMultiplier={1.3}>Update Required</Text>
                <Text style={styles.statusDescription} maxFontSizeMultiplier={1.3}>
                  {dbConfig?.update_message || 'This version is no longer supported. Please update to continue using T360.'}
                </Text>
                <View style={styles.versionInfo}>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Current Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      v{installedVersion}
                    </Text>
                  </View>
                  <View style={styles.versionRow}>
                    <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Required Version:
                    </Text>
                    <Text style={[styles.versionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      v{dbConfig?.minimum_version}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.updateButton, styles.requiredButton]} onPress={handleUpdatePress}>
                  <Download size={20} color="#ffffff" />
                  <Text style={styles.updateButtonText} maxFontSizeMultiplier={1.3}>Update Required</Text>
                </TouchableOpacity>
              </View>
            )}

            {updateStatus === 'error' && (
              <View style={[styles.statusCard, styles.errorCard]}>
                <AlertTriangle size={64} color="#ef4444" />
                <Text style={styles.statusTitle} maxFontSizeMultiplier={1.3}>Unable to Check</Text>
                <Text style={styles.statusDescription} maxFontSizeMultiplier={1.3}>
                  {error || 'Could not check for updates. Please try again later.'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={checkVersionConfig}>
                  <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.3}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.infoSection, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.infoGrid}>
                <View style={[styles.infoCard, { backgroundColor: theme.colors.background }]}>
                  <View style={[styles.iconCircle, { backgroundColor: '#eff6ff' }]}>
                    <Smartphone size={24} color="#3b82f6" />
                  </View>
                  <Text style={[styles.infoCardLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Platform
                  </Text>
                  <Text style={[styles.infoCardValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
                  </Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: theme.colors.background }]}>
                  <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}>
                    <Package size={24} color="#10b981" />
                  </View>
                  <Text style={[styles.infoCardLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Version
                  </Text>
                  <Text style={[styles.infoCardValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {installedVersion}
                  </Text>
                </View>

                {Constants.nativeBuildVersion && (
                  <View style={[styles.infoCard, { backgroundColor: theme.colors.background }]}>
                    <View style={[styles.iconCircle, { backgroundColor: '#fef3c7' }]}>
                      <Code size={24} color="#f59e0b" />
                    </View>
                    <Text style={[styles.infoCardLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Build
                    </Text>
                    <Text style={[styles.infoCardValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {Constants.nativeBuildVersion}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.debugToggle, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowDebugInfo(!showDebugInfo)}
              activeOpacity={0.7}
            >
              <View style={styles.debugToggleLeft}>
                <Info size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.debugToggleText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Developer Information
                </Text>
              </View>
              {showDebugInfo ? (
                <ChevronUp size={20} color={theme.colors.textSecondary} />
              ) : (
                <ChevronDown size={20} color={theme.colors.textSecondary} />
              )}
            </TouchableOpacity>

            {showDebugInfo && (
              <View style={[styles.debugSection, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.debugBlock}>
                  <Text style={[styles.debugTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    App Information
                  </Text>
                  <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Version: {Constants.expoConfig?.version || 'UNKNOWN'}
                  </Text>
                  <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Platform: {Platform.OS}
                  </Text>
                  <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Native Build Version: {Constants.nativeAppVersion || 'N/A'}
                  </Text>
                  <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Native Build Number: {Constants.nativeBuildVersion || 'N/A'}
                  </Text>
                </View>

                {dbConfig && (
                  <View style={styles.debugBlock}>
                    <Text style={[styles.debugTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Database Configuration
                    </Text>
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Current Version: {dbConfig.current_version}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Minimum Version: {dbConfig.minimum_version}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Force Update: {dbConfig.force_update ? 'YES' : 'NO'}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Store URL: {dbConfig.store_url || 'N/A'}
                    </Text>
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      Message: {dbConfig.update_message || 'N/A'}
                    </Text>
                  </View>
                )}

                <View style={styles.debugBlock}>
                  <Text style={[styles.debugTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Query Logs
                  </Text>
                  {queryLogs.length === 0 ? (
                    <Text style={[styles.debugText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                      No logs available
                    </Text>
                  ) : (
                    queryLogs.map((log, index) => (
                      <Text key={index} style={[styles.logText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        {log}
                      </Text>
                    ))
                  )}
                </View>

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={checkVersionConfig}
                  activeOpacity={0.8}
                >
                  <Text style={styles.refreshButtonText} maxFontSizeMultiplier={1.3}>
                    Refresh Check
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  upToDateCard: {
    backgroundColor: '#f0fdf4',
  },
  optionalCard: {
    backgroundColor: '#fffbeb',
  },
  requiredCard: {
    backgroundColor: '#fef2f2',
  },
  errorCard: {
    backgroundColor: '#fef2f2',
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
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
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
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
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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

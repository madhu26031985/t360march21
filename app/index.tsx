import { View, StyleSheet, Image, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { T360PremiumLaunchSplash } from '@/components/T360PremiumLaunchSplash';

export default function Index() {
  const { isLoading, isAuthenticated, hasInitialized, connectionError, retryConnection } = useAuth();
  const [launchSequenceDone, setLaunchSequenceDone] = useState(false);

  const handleLaunchComplete = useCallback(() => {
    setLaunchSequenceDone(true);
  }, []);

  useEffect(() => {
    if (!launchSequenceDone || !hasInitialized || isLoading || connectionError) {
      return;
    }
    const navTimer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }, 1100);

    return () => {
      clearTimeout(navTimer);
    };
  }, [launchSequenceDone, isLoading, isAuthenticated, hasInitialized, connectionError]);

  if (connectionError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.topSection}>
            <Image source={require('../assets/images/yy.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.errorSection}>
            <WifiOff size={48} color="#9CA3AF" strokeWidth={1.5} />
            <Text style={styles.errorTitle} maxFontSizeMultiplier={1.2}>
              No Connection
            </Text>
            <Text style={styles.errorMessage} maxFontSizeMultiplier={1.2}>
              Unable to connect to the server.{'\n'}Please check your internet connection and try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryConnection} activeOpacity={0.8}>
              <RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.2}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!launchSequenceDone) {
    return <T360PremiumLaunchSplash onSequenceComplete={handleLaunchComplete} />;
  }

  if (!hasInitialized || isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.connectingBg]}>
        <View style={styles.connectingWrap}>
          <Image source={require('../assets/images/yy.png')} style={styles.logoSmall} resizeMode="contain" />
          <ActivityIndicator size="small" color="#64748B" style={styles.spinner} />
          <Text style={styles.connectingText} maxFontSizeMultiplier={1.2}>
            Connecting…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return <View style={styles.bridge} />;
}

const styles = StyleSheet.create({
  bridge: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  connectingBg: {
    backgroundColor: '#F8FAFC',
  },
  connectingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoSmall: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  spinner: {
    marginBottom: 12,
  },
  connectingText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#64748B',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logo: {
    width: 154,
    height: 154,
    marginBottom: 16,
    alignSelf: 'center',
  },
  errorSection: {
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

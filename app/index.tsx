import { View, StyleSheet, Image, Text, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { WifiOff, RefreshCw } from 'lucide-react-native';

export default function Index() {
  const { isLoading, isAuthenticated, hasInitialized, connectionError, retryConnection } = useAuth();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 2500);

    return () => clearTimeout(minTimer);
  }, []);

  useEffect(() => {
    if (!isLoading && hasInitialized && minSplashTimeElapsed && !connectionError) {
      const navTimer = setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, 100);

      return () => {
        clearTimeout(navTimer);
      };
    }
  }, [isLoading, isAuthenticated, hasInitialized, minSplashTimeElapsed, connectionError]);

  if (connectionError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.topSection}>
            <Image
              source={require('../assets/images/yy.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.errorSection}>
            <WifiOff size={48} color="#9CA3AF" strokeWidth={1.5} />
            <Text style={styles.errorTitle} maxFontSizeMultiplier={1.2}>No Connection</Text>
            <Text style={styles.errorMessage} maxFontSizeMultiplier={1.2}>
              Unable to connect to the server.{'\n'}Please check your internet connection and try again.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryConnection} activeOpacity={0.8}>
              <RefreshCw size={18} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.2}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8F9FA' }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.topSection}>
          <Image
            source={require('../assets/images/yy.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>We Salute Toastmasters!</Text>
        </View>
        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#6B7280" />
            <Text style={styles.loadingText} maxFontSizeMultiplier={1.2}>Connecting...</Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  tagline: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1F2937',
    letterSpacing: -0.5,
    width: '100%',
    alignSelf: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
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

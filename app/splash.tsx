import { View, StyleSheet, Image, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// This splash screen is kept for backward compatibility but is no longer used
// The splash functionality is now in app/index.tsx
export default function SplashScreen() {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#F8F9FA' }]}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Image
            source={require('../assets/images/yy.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>We Salute Toastmasters!</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Smartphone, CheckCircle } from 'lucide-react-native';

export default function ProductInvite() {
  const handlePlayStorePress = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.toastmaster360.mobile&pcampaignid=web_share');
  };

  const handleAppStorePress = () => {
    Linking.openURL('https://apps.apple.com/in/app/t-360/id6752499801');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.mainTitle} maxFontSizeMultiplier={1.3}>
          Welcome to the <Text style={styles.highlightText} maxFontSizeMultiplier={1.3}>T360 App!</Text>
        </Text>

        <View style={styles.divider} />

        <Text style={styles.description} maxFontSizeMultiplier={1.3}>
          We manage our Toastmasters club digitally using T360.
        </Text>

        <View style={styles.divider} />

        <View style={styles.downloadSection}>
          <Smartphone size={32} color="#ffffff" />
          <Text style={styles.downloadText} maxFontSizeMultiplier={1.3}>Download the app using the link below:</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.storeButton}
            onPress={handlePlayStorePress}
            activeOpacity={0.8}
          >
            <View style={styles.playStoreButton}>
              <View style={styles.playIconContainer}>
                <View style={[styles.playTriangle, styles.playTriangleRed]} />
                <View style={[styles.playTriangle, styles.playTriangleYellow]} />
                <View style={[styles.playTriangle, styles.playTriangleGreen]} />
                <View style={[styles.playTriangle, styles.playTriangleBlue]} />
              </View>
              <View style={styles.storeTextContainer}>
                <Text style={styles.storeLabel} maxFontSizeMultiplier={1.3}>Get it on</Text>
                <Text style={styles.storeName} maxFontSizeMultiplier={1.3}>Google Play</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.storeButton}
            onPress={handleAppStorePress}
            activeOpacity={0.8}
          >
            <View style={styles.appStoreButton}>
              <Text style={styles.appleIcon} maxFontSizeMultiplier={1.3}>

              </Text>
              <View style={styles.storeTextContainer}>
                <Text style={styles.storeLabel} maxFontSizeMultiplier={1.3}>Download on the</Text>
                <Text style={styles.storeName} maxFontSizeMultiplier={1.3}>App Store</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.checkSection}>
          <Text style={styles.checkText} maxFontSizeMultiplier={1.3}>Once downloaded, sign up and you're all set</Text>
          <CheckCircle size={28} color="#4ade80" fill="#4ade80" />
        </View>

        <View style={styles.divider} />

        <Text style={styles.footerText} maxFontSizeMultiplier={1.3}>
          <Text style={styles.footerHighlight} maxFontSizeMultiplier={1.3}>Welcome to a seamless digital experience!</Text> 🚀
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#004165',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  logoBox: {
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 100,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 20,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 42,
  },
  highlightText: {
    color: '#fbbf24',
  },
  description: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
  },
  downloadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  downloadText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
    marginVertical: 16,
  },
  storeButton: {
    width: '100%',
  },
  playStoreButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  playIconContainer: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  playTriangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
  playTriangleRed: {
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#ea4335',
    top: 0,
    left: 8,
  },
  playTriangleYellow: {
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fbbc04',
    bottom: 0,
    left: 8,
  },
  playTriangleGreen: {
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#34a853',
    right: 0,
    top: 8,
  },
  playTriangleBlue: {
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#4285f4',
    left: 0,
    top: 8,
  },
  appStoreButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  appleIcon: {
    fontSize: 32,
    color: '#ffffff',
  },
  storeTextContainer: {
    alignItems: 'flex-start',
  },
  storeLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#ffffff',
  },
  storeName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  checkSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  checkText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  footerText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 32,
  },
  footerHighlight: {
    color: '#fbbf24',
  },
});

import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  notionDark: '#37352F',
  notionSoft: '#F1F1EF',
};

const PAYMENT_URL = 'https://razorpay.me/@t360payment';
const ANDROID_PACKAGE = 'com.toastmaster360.mobile';
const IOS_APP_STORE_ID = '6752499801';
const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const APP_STORE_WEB_URL = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;

export default function BuyUsACoffeeScreen() {
  const handleBuyCoffee = async () => {
    try {
      const supported = await Linking.canOpenURL(PAYMENT_URL);
      if (!supported) {
        Alert.alert('Error', 'Cannot open payment link right now.');
        return;
      }
      await Linking.openURL(PAYMENT_URL);
    } catch (error) {
      console.error('Error opening payment link:', error);
      Alert.alert('Error', 'Failed to open payment link.');
    }
  };

  const handleShareReview = async () => {
    try {
      if (Platform.OS === 'web') {
        // RN Alert actions are unreliable on web; use native confirm so click always resolves.
        const pickPlayStore =
          typeof window !== 'undefined'
            ? window.confirm('Review T360:\nOK = Play Store\nCancel = App Store')
            : true;
        await Linking.openURL(pickPlayStore ? PLAY_STORE_WEB_URL : APP_STORE_WEB_URL);
        return;
      }

      if (Platform.OS === 'android') {
        const marketUrl = `market://details?id=${ANDROID_PACKAGE}`;
        const canUseMarket = await Linking.canOpenURL(marketUrl);
        await Linking.openURL(canUseMarket ? marketUrl : PLAY_STORE_WEB_URL);
        return;
      }

      if (Platform.OS === 'ios') {
        const reviewUrl = `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;
        await Linking.openURL(reviewUrl);
        return;
      }

      await Linking.openURL(PLAY_STORE_WEB_URL);
    } catch (error) {
      console.error('Error opening store review:', error);
      Alert.alert('Error', 'Failed to open review page.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={23} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Love T360 {'\u2764\uFE0F'}
        </Text>
        <View style={styles.rightSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
            We built T360 to help Toastmasters clubs run better, more meaningful meetings - and to give back to the community. We truly wish to keep it free for everyone.
          </Text>
          <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
            {'\n'}Your support and reviews help us improve T360, reach more clubs, and continue this journey. Even a small coffee or a quick review makes a real difference. {'\u{1F499}'}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.buyButton} activeOpacity={0.88} onPress={handleBuyCoffee}>
              <Text style={styles.buyButtonText} maxFontSizeMultiplier={1.3}>
                {'\u2615'} Buy us a coffee
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.88} onPress={handleShareReview}>
              <Text style={styles.secondaryButtonText} maxFontSizeMultiplier={1.3}>
                {'\u2B50'} Share a review
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
    backgroundColor: N.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: N.text,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: N.border,
    backgroundColor: N.surface,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 22,
    color: N.text,
    fontWeight: '400',
  },
  actionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 10,
  },
  buyButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: N.notionDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: N.border,
    backgroundColor: N.notionSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: N.text,
    fontSize: 13,
    fontWeight: '600',
  },
});

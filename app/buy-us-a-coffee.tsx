import { useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Home,
  Users,
  Calendar,
  Settings,
  Coffee,
  MessageCircle,
  Globe,
  Shield,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

const FOOTER_NAV_ICON_SIZE = 15;
const T360_WEB_LOGIN_URL = 'https://t360.in/weblogin';
const T360_WHATSAPP_SUPPORT_URL = 'https://wa.me/9597491113';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  notionDark: '#37352F',
};

const PAYMENT_URL = 'https://razorpay.me/@t360payment';
const ANDROID_PACKAGE = 'com.toastmaster360.mobile';
const IOS_APP_STORE_ID = '6752499801';
const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const APP_STORE_WEB_URL = `https://apps.apple.com/app/id${IOS_APP_STORE_ID}?action=write-review`;

export default function BuyUsACoffeeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reviewPickerVisible, setReviewPickerVisible] = useState(false);

  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const openWhatsAppSupport = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WHATSAPP_SUPPORT_URL);
      if (supported) await Linking.openURL(T360_WHATSAPP_SUPPORT_URL);
      else Alert.alert('Error', 'Cannot open WhatsApp');
    } catch {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  }, []);

  const openWebLogin = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WEB_LOGIN_URL);
      if (supported) await Linking.openURL(T360_WEB_LOGIN_URL);
      else Alert.alert('Error', 'Cannot open web login');
    } catch {
      Alert.alert('Error', 'Failed to open web login');
    }
  }, []);

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

  const openPlayStoreReview = async () => {
    setReviewPickerVisible(false);
    try {
      await Linking.openURL(PLAY_STORE_WEB_URL);
    } catch (error) {
      console.error('Error opening Play Store:', error);
      Alert.alert('Error', 'Failed to open Play Store.');
    }
  };

  const openAppStoreReview = async () => {
    setReviewPickerVisible(false);
    try {
      await Linking.openURL(APP_STORE_WEB_URL);
    } catch (error) {
      console.error('Error opening App Store:', error);
      Alert.alert('Error', 'Failed to open App Store.');
    }
  };

  const handleShareReview = async () => {
    try {
      if (Platform.OS === 'web') {
        setReviewPickerVisible(true);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.pageMain}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={23} color={N.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
            Proudly built for the community.
          </Text>
          <View style={styles.rightSpacer} />
        </View>

        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.logoBlock}>
              <Image source={require('@/assets/images/yy.png')} style={styles.logoImage} resizeMode="contain" />
              <Text style={styles.saluteLine} maxFontSizeMultiplier={1.25}>
                We salute Toastmasters
              </Text>
            </View>

            <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
              We built T360 to simplify role booking, voting, and the overall Toastmasters club journey. Before T360, clubs spent too much time managing operations instead of focusing on communication and member growth.
            </Text>
            <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
              If T360 has helped you, your support truly means a lot. A quick review or even a small coffee helps us improve, reach more clubs, and continue building for you. Your contribution helps us keep the product free for everyone.
            </Text>
            <Text style={styles.paragraph} maxFontSizeMultiplier={1.25}>
              Thank you for your support. {'\u2764\uFE0F'}
            </Text>

            <View style={styles.actionsColumn}>
              <TouchableOpacity style={styles.actionPrimary} activeOpacity={0.85} onPress={handleBuyCoffee}>
                <Text style={styles.actionPrimaryLabel} maxFontSizeMultiplier={1.25}>
                  {'\u2615'}  Buy a coffee
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionSecondary} activeOpacity={0.85} onPress={handleShareReview}>
                <Text style={styles.actionSecondaryLabel} maxFontSizeMultiplier={1.25}>
                  {'\u2B50'}  Share a review
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.geBottomDock,
            {
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.footerNavigationContent}
          >
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Club
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/meetings')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meeting
              </Text>
            </TouchableOpacity>
            {isExComm ? (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/admin')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Shield size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
                </View>
                <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Admin
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Settings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/buy-us-a-coffee')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Coffee size={FOOTER_NAV_ICON_SIZE} color="#92400e" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Coffee
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={openWhatsAppSupport} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#22c55e" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={openWebLogin} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Globe size={FOOTER_NAV_ICON_SIZE} color="#334155" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Web
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={reviewPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setReviewPickerVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>
                  Review T360
                </Text>
                <Text style={styles.modalHint} maxFontSizeMultiplier={1.2}>
                  Choose where you would like to leave a review.
                </Text>
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.modalStoreBtn} activeOpacity={0.85} onPress={openPlayStoreReview}>
                    <Text style={styles.modalStoreBtnText} maxFontSizeMultiplier={1.2}>
                      Play Store
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.modalPipe} maxFontSizeMultiplier={1.2}>
                    |
                  </Text>
                  <TouchableOpacity style={styles.modalStoreBtn} activeOpacity={0.85} onPress={openAppStoreReview}>
                    <Text style={styles.modalStoreBtnText} maxFontSizeMultiplier={1.2}>
                      App Store
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setReviewPickerVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText} maxFontSizeMultiplier={1.2}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
  },
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  pageScroll: {
    flex: 1,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
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
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: N.text,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderColor: N.border,
    backgroundColor: N.surface,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logoImage: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  saluteLine: {
    fontSize: 12,
    fontWeight: '500',
    color: N.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 22,
    color: N.text,
    fontWeight: '400',
  },
  actionsColumn: {
    marginTop: 8,
    width: '100%',
    gap: 8,
  },
  actionPrimary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: N.notionDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionPrimaryLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  actionSecondary: {
    width: '100%',
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.border,
    backgroundColor: N.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSecondaryLabel: {
    color: N.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: N.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: N.border,
    paddingVertical: 22,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: N.text,
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalHint: {
    fontSize: 13,
    fontWeight: '400',
    color: N.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalStoreBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.border,
    backgroundColor: N.page,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  modalStoreBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: N.text,
  },
  modalPipe: {
    fontSize: 14,
    fontWeight: '400',
    color: N.textSecondary,
    paddingHorizontal: 2,
  },
  modalCancel: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: N.textSecondary,
  },
});

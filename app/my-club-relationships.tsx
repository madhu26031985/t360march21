import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Home, Settings, Users, Calendar, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

const WHATSAPP_SUPPORT_URL = 'https://wa.me/9597491113';
const FOOTER_NAV_ICON_SIZE = 15;

/** Match `app/create-club.tsx` Notion-style tokens and hero typography. */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.10)',
  text: '#37352F',
  textSecondary: '#787774',
  accent: '#2383E2',
};

export default function MyClubRelationships() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const openWhatsAppSupport = async () => {
    try {
      const supported = await Linking.canOpenURL(WHATSAPP_SUPPORT_URL);
      if (supported) await Linking.openURL(WHATSAPP_SUPPORT_URL);
      else Alert.alert('Error', 'Cannot open WhatsApp');
    } catch {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  };

  const tabBarBottomPadding =
    Platform.OS === 'web'
      ? Math.min(Math.max(insets.bottom, 8), 14)
      : Math.max(insets.bottom, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]} edges={['top']}>
      <View style={styles.flex1}>
        <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <ArrowLeft size={22} color={N.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Joining a club
          </Text>
          <View style={styles.helpButton} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {/* Hero — same asset, layout, and type scale as Create New Club */}
          <View style={[styles.heroSection, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Image
              source={require('@/assets/images/yy.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={[styles.tagline, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              We Salute Toastmasters.
            </Text>
            <Text style={[styles.heroTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              Start Your Journey
            </Text>
          </View>

          <View style={[styles.formSection, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Text style={[styles.body, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              If your club invited you to T360, ask your ExCom or VPE to add your email to the club.
            </Text>

            <Text style={[styles.body, styles.onceAddedLead, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              Once added:
            </Text>

            <Text style={[styles.body, styles.stepLine, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              → Go to Settings
            </Text>
            <Text style={[styles.body, styles.stepLine, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              → Tap Sign out
            </Text>
            <Text style={[styles.body, styles.stepLine, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              → Then Sign in again
            </Text>

            <Text style={[styles.body, styles.bodyGap, { color: N.text }]} maxFontSizeMultiplier={1.25}>
              {"You'll see your club instantly."}
            </Text>

            <Text style={[styles.helpLead, { color: N.text }]} maxFontSizeMultiplier={1.2}>
              Need help?
            </Text>

            <TouchableOpacity
              onPress={openWhatsAppSupport}
              activeOpacity={0.7}
              accessibilityRole="link"
              accessibilityLabel="Contact WhatsApp Support"
            >
              <Text style={[styles.whatsAppLink, { color: N.accent }]} maxFontSizeMultiplier={1.2}>
                Contact WhatsApp Support
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomDock,
            {
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              paddingBottom: tabBarBottomPadding,
              width: windowWidth,
            },
          ]}
        >
          <View style={styles.tabBarRow}>
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
              </View>
              <Text
                style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                Home
              </Text>
            </TouchableOpacity>
            {hasClub ? (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/club')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
                </View>
                <Text
                  style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  Club
                </Text>
              </TouchableOpacity>
            ) : null}
            {hasClub ? (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/meetings')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
                </View>
                <Text
                  style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  Meeting
                </Text>
              </TouchableOpacity>
            ) : null}
            {isExComm ? (
              <TouchableOpacity
                style={styles.footerNavItem}
                onPress={() => router.push('/(tabs)/admin')}
                activeOpacity={0.75}
              >
                <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                  <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
                </View>
                <Text
                  style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
              </View>
              <Text
                style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  helpButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  heroSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  logoImage: {
    width: 82,
    height: 82,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  formSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 4,
    borderWidth: 1,
    padding: 20,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyGap: {
    marginTop: 16,
  },
  onceAddedLead: {
    marginTop: 16,
    marginBottom: 4,
    fontWeight: '600',
  },
  stepLine: {
    marginTop: 8,
  },
  helpLead: {
    marginTop: 22,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  whatsAppLink: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  bottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
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
});

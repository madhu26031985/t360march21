import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

export default function PricingScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={23} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Pricing
        </Text>
        <View style={styles.rightSpacer} />
      </View>

      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.logoBlock}>
            <Image source={require('@/assets/images/yy.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.saluteLine} maxFontSizeMultiplier={1.25}>
              We salute Toastmasters
            </Text>
          </View>

          <Text style={styles.paragraph} maxFontSizeMultiplier={1.3}>
            T360 is currently in Beta, and we are continuously improving the product to make the Toastmasters club
            experience simpler, smarter, and more efficient. At present, T360 is available free of cost while we enhance
            features based on user feedback and club needs.
          </Text>

          <Text style={styles.paragraph} maxFontSizeMultiplier={1.3}>
            Starting 1st January 2027, T360 will move to a club-level subscription model, with an expected pricing of
            ₹1,000 per club per year. Your support, feedback, and encouragement mean a lot to us as we continue
            building a better experience for Toastmasters clubs.
          </Text>

          <Text style={styles.paragraph} maxFontSizeMultiplier={1.3}>
            Thank you for being part of the journey ❤️
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: N.text,
    textAlign: 'center',
  },
  rightSpacer: {
    width: 40,
  },
  pageScroll: {
    flex: 1,
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
    width: 88,
    height: 88,
    marginBottom: 8,
  },
  saluteLine: {
    fontSize: 13,
    fontWeight: '500',
    color: N.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: N.text,
    fontWeight: '400',
  },
});

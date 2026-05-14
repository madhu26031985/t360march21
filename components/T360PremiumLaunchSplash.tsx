import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

const BRAND_MS = 2000;
const CROSSFADE_MS = 420;
/** Hold screen 2 through last stagger + brief read before handoff */
const FEATURE_HOLD_MS = 3000;

const FEATURE_EASE = Easing.bezier(0.22, 1, 0.36, 1);

type FeatureRowDef =
  | { emoji: string; label: string; pillBg: string; delay: number; fromLeft: boolean }
  | { whatsapp: true; label: string; pillBg: string; delay: number; fromLeft: boolean };

const FEATURE_ROWS: FeatureRowDef[] = [
  { emoji: '🎤', label: 'Meeting Management', pillBg: '#fdecea', delay: 750, fromLeft: true },
  { emoji: '📅', label: 'Role Booking', pillBg: '#e8f0fe', delay: 980, fromLeft: false },
  { emoji: '📋', label: 'Meeting Agenda', pillBg: '#fff8e6', delay: 1210, fromLeft: true },
  { emoji: '🗳️', label: 'Live Voting', pillBg: '#e8f7ee', delay: 1440, fromLeft: false },
  { emoji: '📈', label: 'Club Analytics', pillBg: '#f0eeff', delay: 1670, fromLeft: true },
  { whatsapp: true, label: '24/7 WhatsApp Support', pillBg: '#dcfce7', delay: 1900, fromLeft: false },
];

type Props = {
  onSequenceComplete: () => void;
};

function isWhatsAppFeature(row: FeatureRowDef): row is Extract<FeatureRowDef, { whatsapp: true }> {
  return 'whatsapp' in row && row.whatsapp === true;
}

function FeatureRow(row: FeatureRowDef) {
  const { label, pillBg, delay, fromLeft } = row;
  const fromX = fromLeft ? -70 : 70;
  const wa = isWhatsAppFeature(row);
  return (
    <MotiView
      from={{ opacity: 0, translateX: fromX }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{
        type: 'timing',
        duration: 520,
        delay,
        easing: FEATURE_EASE,
      }}
      style={styles.featureRow}
    >
      <View style={[styles.iconPill, { backgroundColor: pillBg }]}>
        {wa ? (
          <FontAwesome5 name="whatsapp" size={20} color="#25D366" brand />
        ) : (
          <Text style={styles.iconPillEmoji} maxFontSizeMultiplier={1.1}>
            {row.emoji}
          </Text>
        )}
      </View>
      <Text
        style={styles.featureLabel}
        maxFontSizeMultiplier={1.15}
        {...(wa ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.82 } : {})}
      >
        {label}
      </Text>
    </MotiView>
  );
}

function Screen2LogoBlock() {
  return (
    <View style={styles.logoStack}>
      <MotiView
        pointerEvents="none"
        style={styles.pulseRing}
        from={{ opacity: 0.55, scale: 0.88 }}
        animate={{ opacity: 0, scale: 1.18 }}
        transition={{
          type: 'timing',
          duration: 2200,
          loop: true,
          repeatReverse: false,
          delay: 1000,
        }}
      />
      <MotiView
        from={{ opacity: 0, scale: 0.78, translateY: -22 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{
          type: 'spring',
          damping: 17,
          stiffness: 200,
          mass: 0.9,
        }}
        style={styles.logoClipWrap}
      >
        <View style={styles.logoCircleClip}>
          <Image
            source={require('../assets/images/yy.png')}
            style={styles.logoImageFill}
            resizeMode="contain"
          />
        </View>
      </MotiView>
    </View>
  );
}

export function T360PremiumLaunchSplash({ onSequenceComplete }: Props) {
  const [phase, setPhase] = useState<'brand' | 'features'>('brand');
  const [brandExiting, setBrandExiting] = useState(false);

  useEffect(() => {
    const startFade = setTimeout(() => setBrandExiting(true), BRAND_MS - CROSSFADE_MS);
    const switchPhase = setTimeout(() => setPhase('features'), BRAND_MS);
    return () => {
      clearTimeout(startFade);
      clearTimeout(switchPhase);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'features') return;
    const done = setTimeout(() => {
      onSequenceComplete();
    }, FEATURE_HOLD_MS);
    return () => clearTimeout(done);
  }, [phase, onSequenceComplete]);

  return (
    <View style={styles.root}>
      <MotiView
        pointerEvents={phase === 'brand' ? 'auto' : 'none'}
        animate={{
          opacity: phase === 'brand' && !brandExiting ? 1 : 0,
        }}
        transition={{
          type: 'timing',
          duration: CROSSFADE_MS,
        }}
        style={[StyleSheet.absoluteFill, styles.layerCenter]}
      >
        <LinearGradient colors={['#FFFFFF', '#F8FAFC', '#EEF2FF']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centerContent}>
            <MotiView
              from={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
            >
              <Image source={require('../assets/images/yy.png')} style={styles.logo} resizeMode="contain" />
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 14 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 640, delay: 280 }}
              style={styles.taglineWrap}
            >
              <Text style={styles.tagline} maxFontSizeMultiplier={1.25}>
                We Salute Toastmasters
              </Text>
            </MotiView>
          </View>
        </SafeAreaView>
      </MotiView>

      <MotiView
        pointerEvents={phase === 'features' ? 'auto' : 'none'}
        animate={{
          opacity: phase === 'features' ? 1 : 0,
        }}
        transition={{
          type: 'timing',
          duration: CROSSFADE_MS,
        }}
        style={[StyleSheet.absoluteFill, styles.layerFlex]}
      >
        <View style={[StyleSheet.absoluteFill, styles.screen2Bg]} />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {phase === 'features' ? (
            <View style={styles.screen2Body}>
              <Screen2LogoBlock />

              <Text style={styles.mainTagline} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                <Text style={styles.mainTaglineDark}>One Platform. </Text>
                <Text style={styles.mainTaglineBlue}>Better Meetings.</Text>
              </Text>

              <View style={styles.featureList}>
                {FEATURE_ROWS.map((r) => (
                  <FeatureRow key={r.label} {...r} />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.featuresPlaceholder} />
          )}
        </SafeAreaView>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  layerCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  layerFlex: {
    flex: 1,
  },
  screen2Bg: {
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    width: Platform.OS === 'web' ? 168 : 156,
    height: Platform.OS === 'web' ? 168 : 156,
    alignSelf: 'center',
  },
  taglineWrap: {
    marginTop: 22,
  },
  tagline: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1E293B',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  featuresPlaceholder: {
    flex: 1,
  },
  screen2Body: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 36 : 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
  },
  logoStack: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(230, 51, 41, 0.55)',
    alignSelf: 'center',
  },
  logoClipWrap: {
    zIndex: 2,
  },
  logoCircleClip: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  logoImageFill: {
    width: 88,
    height: 88,
  },
  mainTagline: {
    marginTop: 19.8,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  mainTaglineDark: {
    color: '#111111',
  },
  mainTaglineBlue: {
    color: '#0a66c2',
  },
  featureList: {
    marginTop: 30,
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  featureRow: {
    width: '92%',
    maxWidth: 340,
    minWidth: 268,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  featureLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});

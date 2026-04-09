import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, Users, Sparkles, Home, Calendar, Settings, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import SpeechRepository from './speech-repository';
import MyGrowthGuidance from './my-growth-guidance';
import { prefetchMyMentorSnapshot } from '@/lib/myMentorSnapshot';
import MyRoleInsightsPanel from '@/components/MyRoleInsightsPanel';

type GrowthTab = 'speeches' | 'mentor' | 'role_insights';
const FOOTER_NAV_ICON_SIZE = 15;

export default function MyGrowthScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;
  const [tab, setTab] = useState<GrowthTab>('role_insights');

  useEffect(() => {
    if (tab === 'mentor' && user?.currentClubId) {
      prefetchMyMentorSnapshot(user.currentClubId);
    }
  }, [tab, user?.currentClubId]);

  const tabButton = (key: GrowthTab, label: string, Icon: typeof BookOpen, active: boolean) => (
    <TouchableOpacity
      key={key}
      style={[
        styles.segmentTab,
        active && [styles.segmentTabActive, { backgroundColor: '#2563EB', borderColor: '#1D4ED8' }],
      ]}
      onPress={() => setTab(key)}
      activeOpacity={0.85}
    >
      <Icon size={13} color={active ? '#ffffff' : theme.colors.textSecondary} />
      <Text
        style={[
          styles.segmentTabText,
          { color: active ? '#ffffff' : theme.colors.textSecondary, fontWeight: active ? '700' : '500' },
        ]}
        maxFontSizeMultiplier={1.15}
        numberOfLines={2}
        textAlign="center"
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.pageMain}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          My Growth
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={[styles.segmentOuter, { borderColor: '#BFDBFE', backgroundColor: '#F8FAFC' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {tabButton('role_insights', 'My Role Insights', Sparkles, tab === 'role_insights')}
          <View style={[styles.segmentDivider, { backgroundColor: '#BFDBFE' }]} />
          {tabButton('mentor', 'My Mentor', Users, tab === 'mentor')}
          <View style={[styles.segmentDivider, { backgroundColor: '#BFDBFE' }]} />
          {tabButton('speeches', 'My Speeches', BookOpen, tab === 'speeches')}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {tab === 'speeches' ? (
          <SpeechRepository embedded />
        ) : tab === 'mentor' ? (
          <MyGrowthGuidance embedded />
        ) : (
          <MyRoleInsightsPanel />
        )}
      </View>
      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
              <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Club
            </Text>
          </TouchableOpacity>
          {hasClub ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Meeting
              </Text>
            </TouchableOpacity>
          ) : null}
          {isExComm ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
                <Shield size={FOOTER_NAV_ICON_SIZE} color="#dc2626" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: 0.5 }]}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
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
  root: {
    flex: 1,
  },
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 44,
  },
  segmentOuter: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    overflow: 'hidden',
  },
  segmentScrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: '100%',
    justifyContent: 'space-between',
    gap: 0,
  },
  segmentTab: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentTabActive: {},
  segmentDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  segmentTabText: {
    fontSize: 11,
    lineHeight: 14,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
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

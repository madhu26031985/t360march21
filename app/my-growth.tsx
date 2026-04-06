import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, BookOpen, Users, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import SpeechRepository from './speech-repository';
import MyGrowthGuidance from './my-growth-guidance';
import { prefetchMyMentorSnapshot } from '@/lib/myMentorSnapshot';
import MyRoleInsightsPanel from '@/components/MyRoleInsightsPanel';

type GrowthTab = 'speeches' | 'mentor' | 'role_insights';

export default function MyGrowthScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<GrowthTab>('speeches');

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
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          My growth
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
          {tabButton('speeches', 'My speeches', BookOpen, tab === 'speeches')}
          <View style={[styles.segmentDivider, { backgroundColor: '#BFDBFE' }]} />
          {tabButton('mentor', 'My mentor', Users, tab === 'mentor')}
          <View style={[styles.segmentDivider, { backgroundColor: '#BFDBFE' }]} />
          {tabButton('role_insights', 'My Role Insights', Sparkles, tab === 'role_insights')}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
});

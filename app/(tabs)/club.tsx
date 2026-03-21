import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Users,
  Crown,
  Building2,
  Link,
  ClipboardList,
  UserCircle,
  Shield,
  Mic,
  MessageSquare,
  BookOpen,
  Clock,
  GraduationCap,
  UserCheck,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ChevronRight,
  Info,
  LayoutGrid,
} from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';
import { useCallback, useEffect, useRef, useState } from 'react';

interface IconTileProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

interface ReportRowProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  theme: { colors: { text: string; textSecondary: string } };
}

function ReportRow({ title, icon, color, onPress, theme }: ReportRowProps) {
  return (
    <TouchableOpacity
      style={styles.reportsRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.reportsRowIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.reportsRowLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>{title}</Text>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

function IconTile({ title, icon, color, onPress }: IconTileProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.iconTile,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconTileIcon, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={[styles.iconTileTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function MyClub() {
  const { theme } = useTheme();
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const params = useLocalSearchParams<{ section?: string }>();

  const scrollRef = useRef<ScrollView>(null);
  const [reportsAnchorY, setReportsAnchorY] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserProfile();
      }
    }, [isAuthenticated, refreshUserProfile])
  );

  useEffect(() => {
    if (params?.section !== 'reports') return;
    if (reportsAnchorY === null) return;

    // Scroll so the "Reports" heading is visible under the Club Overview.
    scrollRef.current?.scrollTo({ y: Math.max(reportsAnchorY - 12, 0), animated: true });
  }, [params?.section, reportsAnchorY]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Please sign in to view your club</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleFeaturePress = (featurePath: string) => {
    // Check if user has a club
    if (!user?.currentClubId) {
      Alert.alert(
        'Join a Club',
        'To access this feature, please join a club by reaching out to your ExComm or create a club under Settings.',
        [
          {
            text: 'Create Club',
            onPress: () => router.push('/create-club'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      return;
    }

    // User has a club, navigate to the feature
    router.push(featurePath as any);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Club</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Club Switcher or No Club Card */}
        {user?.currentClubId ? (
          <View style={[styles.clubMasterBox, { backgroundColor: theme.colors.surface }]}>
            {/* Club selection - integrated into master box */}
            <ClubSwitcher showRole={true} embedded />
            <View style={[styles.clubMasterDivider, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.clubMasterSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>Club Overview</Text>
          <View style={styles.clubOverviewGrid}>
            <TouchableOpacity
              style={[styles.clubOverviewTile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => handleFeaturePress('/club-info')}
              activeOpacity={0.7}
            >
              <View style={[styles.clubOverviewTileIcon, { backgroundColor: '#1A73E820' }]}>
                <Info size={18} color="#1A73E8" />
              </View>
              <Text style={[styles.clubOverviewTileLabel, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>Info</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clubOverviewTile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => handleFeaturePress('/club-members')}
              activeOpacity={0.7}
            >
              <View style={[styles.clubOverviewTileIcon, { backgroundColor: '#1A73E820' }]}>
                <Users size={18} color="#1A73E8" />
              </View>
              <Text style={[styles.clubOverviewTileLabel, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>Members</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clubOverviewTile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => handleFeaturePress('/executive-committee')}
              activeOpacity={0.7}
            >
              <View style={[styles.clubOverviewTileIcon, { backgroundColor: '#1A73E820' }]}>
                <LayoutGrid size={18} color="#1A73E8" />
              </View>
              <Text style={[styles.clubOverviewTileLabel, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>Leadership</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clubOverviewTile, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => handleFeaturePress('/resources-repository')}
              activeOpacity={0.7}
            >
              <View style={[styles.clubOverviewTileIcon, { backgroundColor: '#1A73E820' }]}>
                <Link size={18} color="#1A73E8" />
              </View>
              <Text style={[styles.clubOverviewTileLabel, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>Resources</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.clubMasterDivider, { backgroundColor: theme.colors.border }]} />
          <View
            onLayout={(e) => setReportsAnchorY(e.nativeEvent.layout.y)}
          >
            <Text
              style={[styles.clubMasterSectionTitle, { color: theme.colors.textSecondary }]}
              maxFontSizeMultiplier={1.2}
            >
              Reports
            </Text>
          </View>
          <ReportRow title="Member Report" icon={<UserCircle size={20} color="#14b8a6" />} color="#14b8a6" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/member-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Roles Report" icon={<Shield size={20} color="#8b5cf6" />} color="#8b5cf6" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/role-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="TMOD Report" icon={<Mic size={20} color="#6366f1" />} color="#6366f1" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/tmod-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Prepared Speeches" icon={<MessageSquare size={20} color="#10b981" />} color="#10b981" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/prepared-speech-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Grammarian" icon={<BookOpen size={20} color="#f59e0b" />} color="#f59e0b" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/grammarian-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Timer" icon={<Clock size={20} color="#f59e0b" />} color="#f59e0b" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/timer-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Educational" icon={<GraduationCap size={20} color="#f97316" />} color="#f97316" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/educational-speaker-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="General Evaluator" icon={<UserCheck size={20} color="#ec4899" />} color="#ec4899" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/ge-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Ah Counter" icon={<AlertCircle size={20} color="#ef4444" />} color="#ef4444" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/ah-counter-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Table Topics" icon={<HelpCircle size={20} color="#0ea5e9" />} color="#0ea5e9" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/table-topics-questioner-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Attendance" icon={<Users size={20} color="#06b6d4" />} color="#06b6d4" onPress={() => handleFeaturePress('/admin/excomm-corner/reports/attendance-report')} theme={theme} />
          <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
          <ReportRow title="Pathways" icon={<TrendingUp size={20} color="#84cc16" />} color="#84cc16" onPress={() => handleFeaturePress('/admin/excomm-corner/vpe/pathway-reports')} theme={theme} />
          </View>
        ) : (
          <View style={[styles.noClubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.noClubIcon, { backgroundColor: theme.colors.textSecondary + '20' }]}>
              <Building2 size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={styles.noClubInfo}>
              <Text style={[styles.noClubText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                No club
              </Text>
              <Text style={[styles.noClubSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Join or create a club to get started
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  sectionHeading: {
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  clubMasterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  clubMasterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  clubMasterDivider: {
    height: 1,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  clubOverviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  clubOverviewTile: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    minWidth: 0,
    overflow: 'hidden',
  },
  clubOverviewTileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubOverviewTileLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  reportsSingleCard: {
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  reportsRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  reportsRowDivider: {
    height: 1,
  },
  reportsAdvancedGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  reportsAdvancedCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportsAdvancedIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsAdvancedLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  iconGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  iconTile: {
    width: '31%',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 95,
  },
  iconTileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconTileTitle: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 14,
  },
  noClubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  noClubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noClubInfo: {
    flex: 1,
  },
  noClubText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  noClubSubtext: {
    fontSize: 13,
  },
});
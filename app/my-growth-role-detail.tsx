import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ListRenderItem,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  INSIGHT_ROW_LABELS,
  fetchMyRoleInsights,
  insightDaysSinceMeeting,
  isInsightCategory,
  type InsightCategory,
  type RoleInsightOccurrence,
} from '@/lib/myRoleInsights';

type RoleHistoryItem = {
  date: string;
  meetingId: string;
};

type RoleData = {
  role: string;
  club: string;
  totalCount: number;
  lastDoneDays: number;
  last30Days: number;
  last90Days: number;
  bestStreak: number;
  averageGap: number;
  milestone: number;
  history: RoleHistoryItem[];
};

const colors = {
  background: '#FFFFFF',
  primaryText: '#111827',
  secondaryText: '#6B7280',
  subtleText: '#9CA3AF',
  accent: '#004165',
  accentLight: '#F1F5F9',
  divider: '#E5E7EB',
};

function formatDate(input: string): string {
  const [year, month, day] = input.split('-').map((v) => parseInt(v, 10));
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isFutureDate(input: string): boolean {
  const [year, month, day] = input.split('-').map((v) => parseInt(v, 10));
  const value = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(value.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  value.setHours(0, 0, 0, 0);
  return value.getTime() > today.getTime();
}

function calculateAverageGap(history: RoleHistoryItem[]): number {
  if (history.length < 2) return 0;
  const ordered = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));
  const gaps: number[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = new Date(ordered[i].date);
    const next = new Date(ordered[i + 1].date);
    const diffMs = Math.abs(current.getTime() - next.getTime());
    gaps.push(Math.round(diffMs / 86400000));
  }
  if (!gaps.length) return 0;
  const avg = gaps.reduce((sum, n) => sum + n, 0) / gaps.length;
  return Math.round(avg);
}

function nextMilestone(totalCount: number): number {
  if (totalCount < 10) return 10;
  return Math.ceil((totalCount + 1) / 5) * 5;
}

function calculateBestStreak(history: RoleHistoryItem[]): number {
  if (!history.length) return 0;
  const ordered = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));
  let best = 1;
  let current = 1;
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const d1 = new Date(ordered[i].date);
    const d2 = new Date(ordered[i + 1].date);
    const gap = Math.round(Math.abs(d1.getTime() - d2.getTime()) / 86400000);
    if (gap <= 7) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.75}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function IdentitySection({
  totalCount,
  lastDoneDays,
}: {
  totalCount: number;
  lastDoneDays: number;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.heroCard}>
        <Text style={styles.identityLead}>You've stepped in</Text>
        <Text style={styles.identityBigLine}>
          <Text style={styles.identityNumber}>{totalCount}</Text>
          <Text style={styles.identitySuffix}> times 🎤</Text>
        </Text>
        <Text style={styles.identityMeta}>Last time: {lastDoneDays} days ago</Text>
      </View>
    </View>
  );
}

function InsightSection({
  last30Days,
  bestStreak,
}: {
  last30Days: number;
  bestStreak: number;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.insightRow}>
        <Text style={styles.insightChip}>+{last30Days} in 30 days</Text>
        <Text style={styles.insightChip}>🔥 {bestStreak} streak</Text>
      </View>
    </View>
  );
}

function PatternSection({ averageGapDays }: { averageGapDays: number }) {
  const months = Math.max(1, Math.round(averageGapDays / 30));
  return (
    <View style={styles.section}>
      <Text style={styles.patternText}>You take this role about every {months} month{months > 1 ? 's' : ''}</Text>
    </View>
  );
}

function JourneyTimeline({
  history,
  maxVisible = 4,
}: {
  history: RoleHistoryItem[];
  maxVisible?: number;
}) {
  const renderItem: ListRenderItem<RoleHistoryItem> = ({ item }) => (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineDot}>●</Text>
      <View style={styles.timelineBody}>
        <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
        <Text style={styles.timelineMeeting}>Meeting #{item.meetingId}</Text>
      </View>
    </View>
  );

  return (
    <View
      style={[
        styles.journeyListContainer,
        history.length > maxVisible ? styles.journeyListContainerScrollable : null,
      ]}
    >
      <Text style={styles.journeyTitle}>YOUR JOURNEY</Text>
      <FlatList
        data={history}
        keyExtractor={(item, idx) => `${item.date}-${item.meetingId}-${idx}`}
        renderItem={renderItem}
        scrollEnabled={history.length > maxVisible}
        nestedScrollEnabled
        contentContainerStyle={styles.timelineList}
      />
    </View>
  );
}

function ActionSection({
  milestone,
  totalCount,
  upcomingBookedDate,
}: {
  milestone: number;
  totalCount: number;
  upcomingBookedDate?: string | null;
}) {
  const remaining = Math.max(0, milestone - totalCount);
  return (
    <View style={styles.section}>
      {upcomingBookedDate ? (
        <>
          <Text style={styles.actionHeadline}>Great, you already picked this up 🎉</Text>
          <Text style={styles.actionSubtext}>Booked for {formatDate(upcomingBookedDate)}</Text>
        </>
      ) : (
        <>
          <Text style={styles.actionHeadline}>On your way to {milestone} 🎯</Text>
          <Text style={styles.actionSubtext}>{remaining} more to go</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/meetings')}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>Take this role again →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

export default function RoleDetailScreen() {
  const { user } = useAuth();
  const { category: categoryParam } = useLocalSearchParams<{ category: string }>();
  const category: InsightCategory | null = isInsightCategory(categoryParam) ? categoryParam : null;
  const [items, setItems] = useState<RoleInsightOccurrence[]>([]);
  const [loading, setLoading] = useState(true);

  const clubDisplayName = useMemo(() => {
    const id = user?.currentClubId;
    if (!id) return '';
    return user?.clubs?.find((c) => c.id === id)?.name?.trim() || '';
  }, [user?.currentClubId, user?.clubs]);

  const load = useCallback(async () => {
    if (!user?.currentClubId || !user?.id || !category) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = await fetchMyRoleInsights(user.currentClubId, user.id);
      const roleItems = payload.occurrencesByCategory[category] ?? [];
      const ordered = [...roleItems].sort((a, b) => (a.meetingDate < b.meetingDate ? 1 : -1));
      setItems(ordered);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.currentClubId, user?.id, category]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const history = useMemo<RoleHistoryItem[]>(
    () =>
      items.map((row) => ({
        date: row.meetingDate,
        meetingId: row.meetingNumber == null || row.meetingNumber === '' ? '—' : String(row.meetingNumber),
      })),
    [items]
  );

  const completedHistory = useMemo(
    () => history.filter((h) => !isFutureDate(h.date)),
    [history]
  );

  const upcomingRoleBooking = useMemo(
    () =>
      history
        .filter((h) => isFutureDate(h.date))
        .sort((a, b) => (a.date > b.date ? 1 : -1))[0] ?? null,
    [history]
  );

  const computedAverageGap = useMemo(() => calculateAverageGap(completedHistory), [completedHistory]);
  const computedBestStreak = useMemo(() => calculateBestStreak(completedHistory), [completedHistory]);
  const lastDoneDays = useMemo(() => {
    if (!completedHistory[0]) return 0;
    return insightDaysSinceMeeting(completedHistory[0].date) ?? 0;
  }, [completedHistory]);
  const last30Days = useMemo(
    () =>
      completedHistory.reduce((sum, h) => {
        const days = insightDaysSinceMeeting(h.date);
        return days !== null && days <= 30 ? sum + 1 : sum;
      }, 0),
    [completedHistory]
  );
  const last90Days = useMemo(
    () =>
      history.reduce((sum, h) => {
        const days = insightDaysSinceMeeting(h.date);
        return days !== null && days <= 90 ? sum + 1 : sum;
      }, 0),
    [history]
  );
  const roleData: RoleData = {
    role: category ? INSIGHT_ROW_LABELS[category] : 'Role',
    club: clubDisplayName || 'T-360 Training Club',
    totalCount: completedHistory.length,
    lastDoneDays,
    last30Days,
    last90Days,
    bestStreak: computedBestStreak,
    averageGap: computedAverageGap,
    milestone: nextMilestone(completedHistory.length),
    history: completedHistory,
  };

  if (!category) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.centeredStateText}>Invalid role type.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.centeredStateText}>Loading role details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (roleData.totalCount === 0 && !upcomingRoleBooking) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header title={roleData.role} subtitle={roleData.club} />
        <View style={styles.centeredState}>
          <Text style={styles.centeredStateText}>No role history yet for this track.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header title={roleData.role} subtitle={roleData.club} />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.timelineContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <IdentitySection totalCount={roleData.totalCount} lastDoneDays={roleData.lastDoneDays} />
          <InsightSection
            last30Days={roleData.last30Days}
            bestStreak={computedBestStreak}
          />
          <PatternSection averageGapDays={computedAverageGap} />
          <JourneyTimeline history={roleData.history} maxVisible={4} />
          <ActionSection
            milestone={roleData.milestone}
            totalCount={roleData.totalCount}
            upcomingBookedDate={upcomingRoleBooking?.date ?? null}
          />
          <View style={styles.bottomSpace} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 13,
    color: colors.primaryText,
    fontWeight: '400',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'left',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    marginTop: 0,
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  section: {
    marginTop: 24,
  },
  heroCard: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 20,
  },
  identityLead: {
    fontSize: 14,
    color: colors.subtleText,
    marginBottom: 6,
  },
  identityBigLine: {
    marginBottom: 6,
  },
  identityNumber: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  identitySuffix: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  identityMeta: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  insightChip: {
    fontSize: 14,
    color: colors.primaryText,
    fontWeight: '500',
    backgroundColor: colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  patternText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '400',
  },
  timelineContainer: {
    paddingBottom: 24,
  },
  screenScroll: {
    flex: 1,
  },
  journeyListContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  journeyListContainerScrollable: {
    maxHeight: 252,
  },
  timelineList: {
    gap: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  timelineDot: {
    fontSize: 9,
    color: colors.primaryText,
    marginTop: 6,
    marginRight: 10,
    lineHeight: 14,
  },
  timelineBody: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryText,
    marginBottom: 2,
  },
  timelineMeeting: {
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '400',
  },
  journeyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.subtleText,
    letterSpacing: 1,
    marginBottom: 10,
  },
  actionHeadline: {
    fontSize: 18,
    color: colors.primaryText,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtext: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 14,
    color: colors.secondaryText,
    fontWeight: '400',
  },
  actionButton: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpace: {
    height: 20,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  centeredStateText: {
    fontSize: 13,
    color: colors.secondaryText,
    fontWeight: '500',
    textAlign: 'center',
  },
});

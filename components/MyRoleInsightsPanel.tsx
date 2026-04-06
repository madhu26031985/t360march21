import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  INSIGHT_TRACKS,
  INSIGHT_ROW_LABELS,
  INSIGHT_STALE_DAYS,
  emptyMyRoleInsightsPayload,
  fetchMyRoleInsights,
  formatDaysSinceMeeting,
  computeSmartInsight,
  insightDaysSinceMeeting,
  type InsightCategory,
  type MyRoleInsightsMap,
} from '@/lib/myRoleInsights';

function TrackRoleRow({
  categoryKey,
  insights,
  theme,
  isLast,
}: {
  categoryKey: InsightCategory;
  insights: MyRoleInsightsMap;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast: boolean;
}) {
  const { totalCount, lastBooking: row } = insights[categoryKey];
  const label = INSIGHT_ROW_LABELS[categoryKey];
  const days = row?.meetingDate ? insightDaysSinceMeeting(row.meetingDate) : null;
  const showStale = row && days !== null && days >= INSIGHT_STALE_DAYS;
  const canOpenDetail = totalCount > 0;

  return (
    <TouchableOpacity
      style={[
        styles.trackRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
        !canOpenDetail && styles.trackRowDisabled,
      ]}
      activeOpacity={canOpenDetail ? 0.65 : 1}
      disabled={!canOpenDetail}
      onPress={() => {
        if (!canOpenDetail) return;
        router.push({ pathname: '/my-growth-role-detail', params: { category: categoryKey } });
      }}
      accessibilityRole="button"
      accessibilityLabel={canOpenDetail ? `${label}, view all bookings` : `${label}, not done yet`}
    >
      <View style={styles.trackRowTop}>
        <Text style={[styles.trackRowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15} numberOfLines={2}>
          {label}
        </Text>
        <View style={styles.trackRowCountWrap}>
          <Text style={[styles.trackRowCount, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
            {totalCount}x
          </Text>
          {canOpenDetail ? <ChevronRight size={18} color={theme.colors.textSecondary} strokeWidth={2} /> : null}
        </View>
      </View>
      {row ? (
        <View style={styles.trackRowLastWrap}>
          <Text style={[styles.trackRowLast, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.12}>
            Last:{' '}
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>{formatDaysSinceMeeting(row.meetingDate)}</Text>
            {showStale ? (
              <Text style={{ color: theme.colors.text }} accessibilityLabel="Stale role reminder">
                {' '}
                ⚠️
              </Text>
            ) : null}
          </Text>
        </View>
      ) : (
        <Text style={[styles.trackRowEmpty, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.12}>
          Not done yet
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function MyRoleInsightsPanel() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [insights, setInsights] = useState<MyRoleInsightsMap>(() => emptyMyRoleInsightsPayload().map);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const smart = useMemo(() => computeSmartInsight(insights), [insights]);

  const load = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) {
      setInsights(emptyMyRoleInsightsPayload().map);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMyRoleInsights(user.currentClubId, user.id);
      setInsights(payload.map);
    } catch (e) {
      console.error(e);
      setError('Could not load role insights.');
      setInsights(emptyMyRoleInsightsPayload().map);
    } finally {
      setLoading(false);
    }
  }, [user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!user?.currentClubId) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.muted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          Join a club to see your role history.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.muted, { color: theme.colors.textSecondary, marginTop: 12 }]} maxFontSizeMultiplier={1.2}>
          Loading your role insights…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }} maxFontSizeMultiplier={1.2}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {INSIGHT_TRACKS.map((track) => (
        <View key={track.id} style={styles.trackSection}>
          <Text style={[styles.trackHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
            {track.emoji} {track.title}
          </Text>
          <View style={[styles.trackCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {track.categories.map((key, i) => (
              <TrackRoleRow
                key={key}
                categoryKey={key}
                insights={insights}
                theme={theme}
                isLast={i === track.categories.length - 1}
              />
            ))}
          </View>
        </View>
      ))}

      {smart ? (
        <View style={styles.smartSection}>
          <Text style={[styles.smartSectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
            💡 Smart insight
          </Text>
          <View style={[styles.smartCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.smartHeadline, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
              {smart.headline}
            </Text>
            <Text style={[styles.smartBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.12}>
              {smart.body}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/meetings')}
              activeOpacity={0.75}
              style={[styles.smartCta, { borderColor: theme.colors.primary }]}
            >
              <Text style={[styles.smartCtaText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.12}>
                → Take a role
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    fontSize: 15,
    textAlign: 'center',
  },
  trackSection: {
    marginBottom: 18,
  },
  trackHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  trackCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trackRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  trackRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  trackRowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  trackRowDisabled: {
    opacity: 0.85,
  },
  trackRowCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackRowCount: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  trackRowLastWrap: {
    marginTop: 6,
  },
  trackRowLast: {
    fontSize: 13,
    lineHeight: 18,
  },
  trackRowEmpty: {
    fontSize: 13,
    marginTop: 6,
    fontStyle: 'italic',
  },
  smartSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  smartSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  smartCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  smartHeadline: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  smartBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  smartCta: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  smartCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

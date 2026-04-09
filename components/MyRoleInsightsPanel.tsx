import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ChevronRight, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  INSIGHT_TRACKS,
  INSIGHT_ROW_LABELS,
  emptyMyRoleInsightsPayload,
  fetchMyRoleInsights,
  insightDaysSinceMeeting,
  computeSmartInsight,
  type InsightCategory,
  type MyRoleInsightsMap,
  type OccurrencesByCategory,
} from '@/lib/myRoleInsights';

function TrackRoleRow({
  categoryKey,
  insights,
  occurrencesByCategory,
  theme,
  isLast,
}: {
  categoryKey: InsightCategory;
  insights: MyRoleInsightsMap;
  occurrencesByCategory: OccurrencesByCategory;
  theme: ReturnType<typeof useTheme>['theme'];
  isLast: boolean;
}) {
  const { totalCount, lastBooking: row } = insights[categoryKey];
  const label = INSIGHT_ROW_LABELS[categoryKey];
  const canOpenDetail = totalCount > 0;
  const recentCount = (occurrencesByCategory[categoryKey] || []).reduce((sum, item) => {
    const days = insightDaysSinceMeeting(item.meetingDate);
    return days !== null && days <= 30 ? sum + 1 : sum;
  }, 0);

  const getTierColors = () => {
    if (totalCount >= 12) {
      return { bg: '#EAF1FF', border: '#A9C8FF', icon: '#5B7BBF', number: '#1F4B9A' };
    }
    if (totalCount >= 8) {
      return { bg: '#FFF4E5', border: '#E8BE7C', icon: '#A6691E', number: '#8A4F0A' };
    }
    return { bg: '#FFF8EE', border: '#D7B27E', icon: '#9A6830', number: '#8A5A24' };
  };
  const tierColors = getTierColors();

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
      <View
        style={[
          styles.roleBadgeWrap,
          {
            borderColor: tierColors.border,
            backgroundColor: tierColors.bg,
          },
        ]}
      >
        <Shield size={40} color={tierColors.icon} strokeWidth={1.8} />
        <Text style={[styles.roleBadgeNumber, { color: tierColors.number }]} maxFontSizeMultiplier={1.0}>
          {totalCount}
        </Text>
      </View>

      <View style={styles.trackRowTop}>
        <Text style={[styles.trackRowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.trackRowRecent, { color: '#1B7F4A' }]} maxFontSizeMultiplier={1.05}>
          +{recentCount} last 30 days
        </Text>
      </View>

      {canOpenDetail ? <ChevronRight size={20} color={theme.colors.textSecondary} strokeWidth={2.1} /> : null}
    </TouchableOpacity>
  );
}

export default function MyRoleInsightsPanel() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [insights, setInsights] = useState<MyRoleInsightsMap>(() => emptyMyRoleInsightsPayload().map);
  const [occurrencesByCategory, setOccurrencesByCategory] = useState<OccurrencesByCategory>(
    () => emptyMyRoleInsightsPayload().occurrencesByCategory
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(INSIGHT_TRACKS[0]?.id ?? 'speaking');

  const smart = useMemo(() => computeSmartInsight(insights), [insights]);

  const load = useCallback(async () => {
    if (!user?.currentClubId || !user?.id) {
      const empty = emptyMyRoleInsightsPayload();
      setInsights(empty.map);
      setOccurrencesByCategory(empty.occurrencesByCategory);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchMyRoleInsights(user.currentClubId, user.id);
      setInsights(payload.map);
      setOccurrencesByCategory(payload.occurrencesByCategory);
    } catch (e) {
      console.error(e);
      setError('Could not load role insights.');
      const empty = emptyMyRoleInsightsPayload();
      setInsights(empty.map);
      setOccurrencesByCategory(empty.occurrencesByCategory);
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

  const selectedTrack = INSIGHT_TRACKS.find((t) => t.id === selectedTrackId) ?? INSIGHT_TRACKS[0];
  const selectedTrackSortedCategories = [...selectedTrack.categories].sort((a, b) => {
    const byCount = insights[b].totalCount - insights[a].totalCount;
    if (byCount !== 0) return byCount;
    return INSIGHT_ROW_LABELS[a].localeCompare(INSIGHT_ROW_LABELS[b]);
  });

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.trackTabsGrid}>
        {INSIGHT_TRACKS.map((track) => {
          const active = selectedTrack?.id === track.id;
          return (
            <TouchableOpacity
              key={track.id}
              style={[
                styles.trackTab,
                {
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                },
              ]}
              activeOpacity={0.85}
              onPress={() => setSelectedTrackId(track.id)}
            >
              <Text
                style={[styles.trackTabText, { color: active ? '#ffffff' : theme.colors.text }]}
                maxFontSizeMultiplier={1.1}
                numberOfLines={1}
              >
                {track.emoji} {track.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedTrack ? (
        <View style={styles.trackSection}>
          <View style={[styles.trackCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {selectedTrackSortedCategories.map((key, i) => (
              <TrackRoleRow
                key={key}
                categoryKey={key}
                insights={insights}
                occurrencesByCategory={occurrencesByCategory}
                theme={theme}
                isLast={i === selectedTrackSortedCategories.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}

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
  trackTabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  trackTab: {
    width: '48.8%',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  trackTabText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  trackHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  trackCard: {
    borderRadius: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trackRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleBadgeWrap: {
    width: 52,
    height: 52,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  roleBadgeNumber: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  trackRowTop: {
    flex: 1,
    minWidth: 0,
  },
  trackRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  trackRowDisabled: {
    opacity: 0.85,
  },
  trackRowRecent: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
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
    borderRadius: 0,
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
    borderRadius: 0,
    borderWidth: 1,
  },
  smartCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

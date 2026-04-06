import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchMyRoleInsights,
  formatDaysSinceMeeting,
  formatInsightMeetingDate,
  INSIGHT_ROW_LABELS,
  INSIGHT_STALE_DAYS,
  insightDaysSinceMeeting,
  isInsightCategory,
  type InsightCategory,
  type RoleInsightOccurrence,
} from '@/lib/myRoleInsights';

function meetingNumberLabel(row: RoleInsightOccurrence): string {
  if (row.meetingNumber == null || row.meetingNumber === '') return '—';
  return String(row.meetingNumber);
}

export default function MyGrowthRoleDetailScreen() {
  const { theme } = useTheme();
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
      const { occurrencesByCategory } = await fetchMyRoleInsights(user.currentClubId, user.id);
      setItems(occurrencesByCategory[category] ?? []);
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

  const title = category ? INSIGHT_ROW_LABELS[category] : 'Role details';

  const mostRecent = items[0];
  const daysSinceLast = mostRecent?.meetingDate ? insightDaysSinceMeeting(mostRecent.meetingDate) : null;
  const showStaleWarning =
    mostRecent && daysSinceLast !== null && daysSinceLast >= INSIGHT_STALE_DAYS;

  const staleInsightCopy = useMemo(() => {
    if (category === 'toastmaster') {
      return {
        body: "You haven't taken this role in a while. Consider taking it again to improve leadership.",
      };
    }
    if (category === 'general_evaluator' || category === 'speech_evaluator') {
      return {
        body: "You haven't taken this role in a while. Stepping back in helps sharpen your feedback skills.",
      };
    }
    return {
      body: "You haven't taken this role in a while. Consider booking it again to stay in practice.",
    };
  }, [category]);

  const goTakeRole = () => router.push('/(tabs)/meetings');

  const borderHairline = { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth };

  const renderHeaderBar = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.background, ...borderHairline }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
        <ArrowLeft size={22} color={theme.colors.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        {clubDisplayName ? (
          <Text
            style={[styles.headerClub, { color: theme.colors.textSecondary }]}
            maxFontSizeMultiplier={1.15}
            numberOfLines={1}
          >
            {clubDisplayName}
          </Text>
        ) : null}
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <View style={styles.headerRightSpacer} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {renderHeaderBar()}

      {!category ? (
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Invalid role type.
          </Text>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.muted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            No booked performances in this club for this role yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* TOTAL EXPERIENCE — flat block, divider only */}
          <View style={[styles.sectionBlock, borderHairline]}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.05}>
              TOTAL EXPERIENCE
            </Text>
            <Text style={[styles.experienceCount, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
              {items.length} {items.length === 1 ? 'time' : 'times'}
            </Text>
            <Text style={[styles.experienceLast, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.12}>
              Last done:{' '}
              <Text style={{ color: theme.colors.text, fontWeight: '600' }}>
                {mostRecent?.meetingDate ? formatDaysSinceMeeting(mostRecent.meetingDate) : '—'}
              </Text>
              {showStaleWarning ? (
                <Text style={{ color: theme.colors.text }} accessibilityLabel="Reminder: role not taken recently">
                  {' '}
                  ⚠️
                </Text>
              ) : null}
            </Text>
          </View>

          {showStaleWarning ? (
            <View style={[styles.sectionBlock, borderHairline]}>
              <Text style={[styles.insightBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.12}>
                {staleInsightCopy.body}
              </Text>
              <TouchableOpacity
                onPress={goTakeRole}
                activeOpacity={0.6}
                style={styles.textLinkHit}
                accessibilityRole="button"
                accessibilityLabel="Take this role"
              >
                <Text style={[styles.textLink, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.12}>
                  → Take this role
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={[styles.journeySectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
            YOUR JOURNEY
          </Text>

          <View style={styles.timeline}>
            {items.map((row, index) => {
              const isLast = index === items.length - 1;
              const dateLine = formatInsightMeetingDate(row.meetingDate);
              const num = meetingNumberLabel(row);

              return (
                <View
                  key={row.roleRowId}
                  style={[
                    styles.timelineRow,
                    !isLast && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: theme.colors.text }]} />
                    {!isLast ? (
                      <View style={[styles.timelineLine, { backgroundColor: theme.colors.border }]} />
                    ) : null}
                  </View>
                  <View style={styles.timelineMain}>
                    <Text style={[styles.timelineDate, { color: theme.colors.text }]} maxFontSizeMultiplier={1.12}>
                      {dateLine}
                    </Text>
                    {category === 'toastmaster' ? (
                      <>
                        <Text style={[styles.journeyPrimary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.12}>
                          {(row.themeOfTheDay || '').trim() || 'No theme recorded'}
                        </Text>
                        <Text style={[styles.journeyMeta, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                          Meeting #{num}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.journeyPrimary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.12}>
                        Meeting #{num}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const RAIL_WIDTH = 20;
const DOT_SIZE = 8;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
    padding: 10,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerClub: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRightSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionBlock: {
    paddingTop: 18,
    paddingBottom: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  experienceCount: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  experienceLast: {
    fontSize: 14,
    lineHeight: 20,
  },
  insightBody: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  textLinkHit: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 8,
  },
  textLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  journeySectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 14,
  },
  timeline: {
    marginLeft: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingBottom: 18,
    marginBottom: 0,
  },
  timelineRail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    marginRight: 12,
    alignSelf: 'stretch',
  },
  timelineDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: 6,
    opacity: 0.85,
  },
  timelineLine: {
    width: 1,
    flex: 1,
    minHeight: 20,
    marginTop: 6,
    opacity: 0.9,
  },
  timelineMain: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 2,
  },
  timelineDate: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  journeyPrimary: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  journeyMeta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
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
    lineHeight: 22,
  },
});

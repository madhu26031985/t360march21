import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Volume2, Calendar, BarChart3 } from 'lucide-react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AhCounterRecord {
  id: string;
  speaker_name: string;
  um_count: number;
  uh_count: number;
  ah_count: number;
  er_count: number;
  hmm_count: number;
  like_count: number;
  so_count: number;
  well_count: number;
  okay_count: number;
  you_know_count: number;
  right_count: number;
  actually_count: number;
  basically_count: number;
  literally_count: number;
  i_mean_count: number;
  you_see_count: number;
  meeting_date: string;
  meeting_number: string;
  club_id: string;
  recorded_at: string;
  custom_filler_counts?: Record<string, number> | null;
}

interface FillerWordStat {
  word: string;
  count: number;
  color: string;
}

type TimePeriod = '3M' | '6M' | '1Y' | 'All';

export default function MyAhCounterRecords() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AhCounterRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AhCounterRecord[]>([]);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('6M');
  const [fillerStats, setFillerStats] = useState<FillerWordStat[]>([]);

  const timePeriods: { value: TimePeriod; label: string }[] = [
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: '1Y', label: '1Y' },
    { value: 'All', label: 'All' },
  ];

  const fillerWordColors: Record<string, string> = {
    'Um': '#ef4444',
    'Uh': '#f97316',
    'Ah': '#f59e0b',
    'Er': '#eab308',
    'Hmm': '#84cc16',
    'Like': '#22c55e',
    'So': '#10b981',
    'Well': '#14b8a6',
    'Okay': '#06b6d4',
    'You Know': '#0ea5e9',
    'Right': '#3b82f6',
    'Actually': '#6366f1',
    'Basically': '#8b5cf6',
    'Literally': '#a855f7',
    'I Mean': '#d946ef',
    'You See': '#ec4899',
  };

  useEffect(() => {
    if (user?.id) {
      loadAhCounterRecords();
    }
  }, [user]);

  useEffect(() => {
    if (records.length > 0) {
      filterRecordsByPeriod(timePeriod);
    }
  }, [timePeriod, records]);

  const loadAhCounterRecords = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: ahCounterData, error } = await supabase
        .from('ah_counter_reports')
        .select('*')
        .eq('speaker_user_id', user.id)
        .eq('is_published', true)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading ah counter records:', error);
        setLoading(false);
        return;
      }

      const formattedRecords: AhCounterRecord[] = (ahCounterData || []).map(record => ({
        id: record.id,
        speaker_name: record.speaker_name,
        um_count: record.um_count || 0,
        uh_count: record.uh_count || 0,
        ah_count: record.ah_count || 0,
        er_count: record.er_count || 0,
        hmm_count: record.hmm_count || 0,
        like_count: record.like_count || 0,
        so_count: record.so_count || 0,
        well_count: record.well_count || 0,
        okay_count: record.okay_count || 0,
        you_know_count: record.you_know_count || 0,
        right_count: record.right_count || 0,
        actually_count: record.actually_count || 0,
        basically_count: record.basically_count || 0,
        literally_count: record.literally_count || 0,
        i_mean_count: record.i_mean_count || 0,
        you_see_count: record.you_see_count || 0,
        meeting_date: record.meeting_date,
        meeting_number: record.meeting_number,
        club_id: record.club_id,
        recorded_at: record.recorded_at,
        custom_filler_counts:
          record.custom_filler_counts && typeof record.custom_filler_counts === 'object'
            ? (record.custom_filler_counts as Record<string, number>)
            : null,
      }));

      setRecords(formattedRecords);
    } catch (error) {
      console.error('Error loading ah counter records:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterRecordsByPeriod = (period: TimePeriod) => {
    const now = new Date();
    let cutoffDate: Date;

    switch (period) {
      case '3M':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6M':
        cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1Y':
        cutoffDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'All':
        cutoffDate = new Date(0);
        break;
    }

    const filtered = records.filter(record => {
      const recordDate = new Date(record.meeting_date);
      return recordDate >= cutoffDate;
    });

    setFilteredRecords(filtered);
    calculateFillerStats(filtered);
  };

  const calculateFillerStats = (recordsToAnalyze: AhCounterRecord[]) => {
    const stats: Record<string, number> = {
      Um: 0,
      Uh: 0,
      Ah: 0,
      Er: 0,
      Hmm: 0,
      Like: 0,
      So: 0,
      Well: 0,
      Okay: 0,
      'You Know': 0,
      Right: 0,
      Actually: 0,
      Basically: 0,
      Literally: 0,
      'I Mean': 0,
      'You See': 0,
    };

    recordsToAnalyze.forEach((record) => {
      stats['Um'] += record.um_count;
      stats['Uh'] += record.uh_count;
      stats['Ah'] += record.ah_count;
      stats['Er'] += record.er_count;
      stats['Hmm'] += record.hmm_count;
      stats['Like'] += record.like_count;
      stats['So'] += record.so_count;
      stats['Well'] += record.well_count;
      stats['Okay'] += record.okay_count;
      stats['You Know'] += record.you_know_count;
      stats['Right'] += record.right_count;
      stats['Actually'] += record.actually_count;
      stats['Basically'] += record.basically_count;
      stats['Literally'] += record.literally_count;
      stats['I Mean'] += record.i_mean_count;
      stats['You See'] += record.you_see_count;

      const c = record.custom_filler_counts;
      if (c && typeof c === 'object') {
        for (const [slug, v] of Object.entries(c)) {
          const n = typeof v === 'number' ? v : 0;
          if (n <= 0) continue;
          const label = slug.replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
          stats[label] = (stats[label] || 0) + n;
        }
      }
    });

    const fillerArray: FillerWordStat[] = Object.entries(stats)
      .filter(([_, count]) => count > 0)
      .map(([word, count]) => ({
        word,
        count,
        color: fillerWordColors[word] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);

    setFillerStats(fillerArray);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading ah counter records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const maxCount = fillerStats.length > 0 ? Math.max(...fillerStats.map(s => s.count)) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter Reports</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Volume2 size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Ah Counter Reports Yet
            </Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your ah counter reports will appear here once speeches have been evaluated for filler words.
            </Text>
          </View>
        ) : (
          <>
            {/* Time Period Filters */}
            <View style={styles.filtersContainer}>
              {timePeriods.map((period) => (
                <TouchableOpacity
                  key={period.value}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: timePeriod === period.value
                        ? theme.colors.primary
                        : theme.colors.surface,
                    },
                  ]}
                  onPress={() => setTimePeriod(period.value)}
                >
                  <Text style={[
                      styles.filterButtonText,
                      {
                        color: timePeriod === period.value
                          ? '#ffffff'
                          : theme.colors.textSecondary,
                        fontWeight: timePeriod === period.value ? '600' : '500',
                      },
                    ]} maxFontSizeMultiplier={1.3}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Filler Words Graph */}
            {fillerStats.length > 0 ? (
              <View style={[styles.graphCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.graphHeader}>
                  <View style={styles.graphTitleContainer}>
                    <BarChart3 size={20} color={theme.colors.primary} />
                    <Text style={[styles.graphTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Filler Words Usage
                    </Text>
                  </View>
                  <Text style={[styles.graphSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {filteredRecords.length} {filteredRecords.length === 1 ? 'speech' : 'speeches'}
                  </Text>
                </View>

                <View style={styles.graphContent}>
                  {fillerStats.slice(0, 10).map((stat, index) => (
                    <View key={stat.word} style={styles.barContainer}>
                      <View style={styles.barLabelContainer}>
                        <Text style={[styles.barLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          {stat.word}
                        </Text>
                        <Text style={[styles.barValue, { color: stat.color }]} maxFontSizeMultiplier={1.3}>
                          {stat.count}
                        </Text>
                      </View>
                      <View style={styles.barWrapper}>
                        <View
                          style={[
                            styles.bar,
                            {
                              backgroundColor: stat.color + '20',
                              width: `${(stat.count / maxCount) * 100}%`,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.barFill,
                              {
                                backgroundColor: stat.color,
                                width: '100%',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {fillerStats.length > 10 && (
                  <Text style={[styles.moreStats, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    +{fillerStats.length - 10} more filler words tracked
                  </Text>
                )}
              </View>
            ) : (
              <View style={[styles.noDataCard, { backgroundColor: theme.colors.surface }]}>
                <BarChart3 size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.noDataTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Data for Selected Period
                </Text>
                <Text style={[styles.noDataText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Try selecting a different time period
                </Text>
              </View>
            )}

            {/* Summary Stats */}
            {filteredRecords.length > 0 && (
              <View style={styles.summaryContainer}>
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Total Speeches
                  </Text>
                  <Text style={[styles.summaryValue, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                    {filteredRecords.length}
                  </Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Total Fillers
                  </Text>
                  <Text style={[styles.summaryValue, { color: '#ef4444' }]} maxFontSizeMultiplier={1.3}>
                    {fillerStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </Text>
                </View>
              </View>
            )}

            {/* Recent Records */}
            {filteredRecords.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Recent Reports
                </Text>

                {filteredRecords.slice(0, 5).map((record) => (
                  <View key={record.id} style={[styles.recordCard, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.recordHeader}>
                      <View style={styles.recordTitleRow}>
                        <Text style={[styles.meetingNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Meeting #{record.meeting_number}
                        </Text>
                        <View style={styles.dateContainer}>
                          <Calendar size={12} color={theme.colors.textSecondary} />
                          <Text style={[styles.recordDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {formatDate(record.meeting_date)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.recordStats}>
                      {[
                        { label: 'Um', count: record.um_count, color: '#ef4444' },
                        { label: 'Uh', count: record.uh_count, color: '#f97316' },
                        { label: 'Ah', count: record.ah_count, color: '#f59e0b' },
                        { label: 'Like', count: record.like_count, color: '#22c55e' },
                      ].map((item) => (
                        item.count > 0 && (
                          <View key={item.label} style={[styles.statChip, { backgroundColor: item.color + '15' }]}>
                            <Text style={[styles.statLabel, { color: item.color }]} maxFontSizeMultiplier={1.3}>
                              {item.label}
                            </Text>
                            <Text style={[styles.statCount, { color: item.color }]} maxFontSizeMultiplier={1.3}>
                              {item.count}
                            </Text>
                          </View>
                        )
                      ))}
                    </View>
                  </View>
                ))}

                {filteredRecords.length > 5 && (
                  <Text style={[styles.moreRecords, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    +{filteredRecords.length - 5} more reports in this period
                  </Text>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
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
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 120,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: 14,
  },
  graphCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  graphHeader: {
    marginBottom: 20,
  },
  graphTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  graphTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  graphSubtitle: {
    fontSize: 13,
  },
  graphContent: {
    gap: 16,
  },
  barContainer: {
    gap: 6,
  },
  barLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  barValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  barWrapper: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
    justifyContent: 'center',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  moreStats: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  noDataCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 14,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  recentSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  recordCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  recordHeader: {
    marginBottom: 10,
  },
  recordTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meetingNumber: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recordDate: {
    fontSize: 12,
  },
  recordStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  moreRecords: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, BookOpen, Calendar } from 'lucide-react-native';

interface GrammarianRecord {
  id: string;
  wotd: string | null;
  wotd_usage_count: number;
  good_language_user: string | null;
  reported_at: string;
  meeting: {
    meeting_title: string;
    meeting_date: string;
  } | null;
}

export default function MyGrammarianRecords() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<GrammarianRecord[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadGrammarianRecords();
    }
  }, [user]);

  const loadGrammarianRecords = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: grammarianData, error } = await supabase
        .from('grammarian_reports')
        .select('*')
        .eq('reported_by', user.id)
        .order('reported_at', { ascending: false });

      if (error) {
        console.error('Error loading grammarian records:', error);
        setLoading(false);
        return;
      }

      const meetingIds = [...new Set(grammarianData?.map(r => r.meeting_id) || [])];

      let meetingsMap = new Map();

      if (meetingIds.length > 0) {
        const { data: meetingsData } = await supabase
          .from('app_club_meeting')
          .select('id, meeting_title, meeting_date')
          .in('id', meetingIds);

        meetingsMap = new Map(meetingsData?.map(m => [m.id, m]) || []);
      }

      const formattedRecords: GrammarianRecord[] = (grammarianData || []).map(record => ({
        id: record.id,
        wotd: record.wotd,
        wotd_usage_count: record.wotd_usage_count || 0,
        good_language_user: record.good_language_user,
        reported_at: record.reported_at,
        meeting: meetingsMap.get(record.meeting_id) || null,
      }));

      setRecords(formattedRecords);
    } catch (error) {
      console.error('Error loading grammarian records:', error);
    } finally {
      setLoading(false);
    }
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
            Loading grammarian records...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Grammarian Reports</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <BookOpen size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Grammarian Reports Yet
            </Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your grammarian reports will appear here once you've recorded them.
            </Text>
          </View>
        ) : (
          <View style={styles.recordsList}>
            <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.statsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Total Reports</Text>
              <Text style={[styles.statsValue, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>{records.length}</Text>
            </View>

            {records.map((record) => (
              <View key={record.id} style={[styles.recordCard, { backgroundColor: theme.colors.surface }]}>
                {record.meeting && (
                  <View style={styles.recordHeader}>
                    <Text style={[styles.meetingTitle, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                      {record.meeting.meeting_title}
                    </Text>
                    <View style={styles.dateContainer}>
                      <Calendar size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.meetingDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {formatDate(record.meeting.meeting_date)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.recordContent}>
                  {record.wotd && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Word of the Day:</Text>
                      <Text style={[styles.value, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{record.wotd}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>WOTD Usage Count:</Text>
                    <View style={[styles.badge, { backgroundColor: theme.colors.primary + '20' }]}>
                      <Text style={[styles.badgeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                        {record.wotd_usage_count}
                      </Text>
                    </View>
                  </View>

                  {record.good_language_user && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Good Language User:</Text>
                      <Text style={[styles.value, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{record.good_language_user}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  recordsList: {
    padding: 16,
    gap: 16,
  },
  statsCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  recordCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetingDate: {
    fontSize: 13,
  },
  recordContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

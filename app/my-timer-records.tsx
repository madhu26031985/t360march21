import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Clock, Calendar, Mic, MessageSquare, Award, BookOpen } from 'lucide-react-native'; 

interface TimerRecord {
  id: string;
  speaker_name: string;
  speech_category: string;
  speech_title: string | null;
  actual_time_display: string;
  time_qualification: boolean;
  recorded_at: string;
  meeting: {
    meeting_title: string;
    meeting_date: string;
  } | null;
}

interface CategoryGroup {
  category: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  records: TimerRecord[];
}

export default function MyTimerRecords() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimerRecord[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);

  const speechCategories = [
    {
      value: 'prepared_speaker',
      label: 'Prepared Speeches',
      color: '#3b82f6',
      icon: <Mic size={20} color="#3b82f6" />
    },
    {
      value: 'table_topic_speaker',
      label: 'Table Topics',
      color: '#f97316',
      icon: <MessageSquare size={20} color="#f97316" />
    },
    {
      value: 'evaluation',
      label: 'Evaluations',
      color: '#10b981',
      icon: <Award size={20} color="#10b981" />
    },
    {
      value: 'educational_session',
      label: 'Educational Speeches',
      color: '#8b5cf6',
      icon: <BookOpen size={20} color="#8b5cf6" />
    },
  ];

  useEffect(() => {
    if (user?.id) {
      loadTimerRecords();
    }
  }, [user]);

  const loadTimerRecords = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: timerData, error } = await supabase
        .from('timer_reports')
        .select(`
          id,
          speaker_name,
          speech_category,
          speech_title,
          actual_time_display,
          time_qualification,
          recorded_at,
          app_club_meeting (
            id,
            meeting_title,
            meeting_date
          )
        `)
        .eq('speaker_user_id', user.id)
        .order('recorded_at', { ascending: false });

      if (error) {
        console.error('Error loading timer records:', error);
        setLoading(false);
        return;
      }

      const formattedRecords: TimerRecord[] = (timerData || []).map(record => ({
        id: record.id,
        speaker_name: record.speaker_name,
        speech_category: record.speech_category,
        speech_title: record.speech_title,
        actual_time_display: record.actual_time_display,
        time_qualification: record.time_qualification,
        recorded_at: record.recorded_at,
        meeting: (record as any).app_club_meeting || null,
      }));

      setRecords(formattedRecords);
      groupRecordsByCategory(formattedRecords);
    } catch (error) {
      console.error('Error loading timer records:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupRecordsByCategory = (records: TimerRecord[]) => {
    const groups = speechCategories.map(category => ({
      category: category.value,
      label: category.label,
      color: category.color,
      icon: category.icon,
      records: records.filter(r => r.speech_category === category.value),
    })).filter(group => group.records.length > 0);

    setCategoryGroups(groups);
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
            Loading timer records...
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer Records</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Timer Records
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your speech timing records will appear here when your speeches are timed
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={[styles.summaryIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Clock size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.summaryContent}>
                <Text style={[styles.summaryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Total Records
                </Text>
                <Text style={[styles.summaryValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {records.length}
                </Text>
              </View>
            </View>

            {categoryGroups.map((group) => (
              <View key={group.category} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: group.color + '20' }]}>
                    {group.icon}
                  </View>
                  <Text style={[styles.categoryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {group.label}
                  </Text>
                  <View style={[styles.categoryBadge, { backgroundColor: group.color + '20' }]}>
                    <Text style={[styles.categoryBadgeText, { color: group.color }]} maxFontSizeMultiplier={1.3}>
                      {group.records.length}
                    </Text>
                  </View>
                </View>

                <View style={styles.recordsList}>
                  {group.records.map((record) => (
                    <View
                      key={record.id}
                      style={[
                        styles.recordCard,
                        {
                          backgroundColor: theme.colors.surface,
                          borderLeftColor: group.color,
                        }
                      ]}
                    >
                      <View style={styles.recordHeader}>
                        <Text style={[styles.speakerName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                          {record.speaker_name}
                        </Text>
                        <View style={[styles.timeChip, { backgroundColor: group.color + '15' }]}>
                          <Clock size={14} color={group.color} />
                          <Text style={[styles.timeText, { color: group.color }]} maxFontSizeMultiplier={1.3}>
                            {record.actual_time_display}
                          </Text>
                        </View>
                      </View>

                      {record.speech_title && (
                        <Text style={[styles.speechTitle, { color: theme.colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                          {record.speech_title}
                        </Text>
                      )}

                      <View style={styles.recordFooter}>
                        {record.meeting && (
                          <View style={styles.meetingInfo}>
                            <Calendar size={12} color={theme.colors.textSecondary} />
                            <Text style={[styles.meetingText, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                              {record.meeting.meeting_title} • {formatDate(record.meeting.meeting_date)}
                            </Text>
                          </View>
                        )}
                        <View style={[
                          styles.qualificationBadge,
                          { backgroundColor: record.time_qualification ? '#10b981' + '15' : '#64748b' + '15' }
                        ]}>
                          <Text style={[
                            styles.qualificationText,
                            { color: record.time_qualification ? '#10b981' : '#64748b' }
                          ]} maxFontSizeMultiplier={1.3}>
                            {record.time_qualification ? 'Qualified' : 'Not Qualified'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
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
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  recordCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  speakerName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    flexShrink: 0,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  speechTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 18,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meetingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  meetingText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  qualificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  qualificationText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

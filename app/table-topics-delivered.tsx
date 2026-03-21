import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, Calendar, Building2, Hash, Clock, CheckCircle2, XCircle, MessageSquare, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface TableTopic {
  id: string;
  meeting_date: string;
  meeting_number: string;
  club_name: string;
  role_name: string;
  completed_at: string;
  actual_time_display: string | null;
  time_qualification: boolean | null;
  table_topic_question: string | null;
  table_topics_master_name: string | null;
}

export default function TableTopicsDelivered() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tableTopics, setTableTopics] = useState<TableTopic[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadTableTopics();
    }
  }, [user]);

  const loadTableTopics = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_table_topics_delivered', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error loading table topics:', error);
        return;
      }

      const formattedTableTopics = (data || []).map((item: any) => ({
        id: item.id,
        meeting_date: item.meeting_date,
        meeting_number: item.meeting_number,
        club_name: item.club_name,
        role_name: item.role_name,
        completed_at: item.completed_at,
        actual_time_display: item.actual_time_display,
        time_qualification: item.time_qualification,
        table_topic_question: item.table_topic_question,
        table_topics_master_name: item.table_topics_master_name,
      }));

      setTableTopics(formattedTableTopics);
    } catch (error) {
      console.error('Error loading table topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const TableTopicCard = ({ tableTopic }: { tableTopic: TableTopic }) => {
    return (
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.dateContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={[styles.dateText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {formatDate(tableTopic.meeting_date)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.roleNameTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {tableTopic.role_name}
          </Text>

          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Building2 size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {tableTopic.club_name}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Hash size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Meeting
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                #{tableTopic.meeting_number}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <MessageSquare size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Question Assigned
                </Text>
              </View>
              <Text style={[
                tableTopic.table_topic_question ? styles.questionValue : styles.detailValueEmpty,
                { color: tableTopic.table_topic_question ? theme.colors.text : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {tableTopic.table_topic_question || 'Not assigned'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Clock size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Timing
                </Text>
              </View>
              <Text style={[
                tableTopic.actual_time_display ? styles.detailValue : styles.detailValueEmpty,
                { color: tableTopic.actual_time_display ? theme.colors.text : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {tableTopic.actual_time_display || 'Not recorded'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                {tableTopic.time_qualification === true ? (
                  <CheckCircle2 size={14} color={theme.colors.success || '#10b981'} />
                ) : tableTopic.time_qualification === false ? (
                  <XCircle size={14} color={theme.colors.error || '#ef4444'} />
                ) : (
                  <CheckCircle2 size={14} color={theme.colors.textSecondary} />
                )}
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Qualified
                </Text>
              </View>
              <Text style={[
                tableTopic.time_qualification !== null ? styles.detailValue : styles.detailValueEmpty,
                {
                  color: tableTopic.time_qualification === true
                    ? (theme.colors.success || '#10b981')
                    : tableTopic.time_qualification === false
                    ? (theme.colors.error || '#ef4444')
                    : theme.colors.textSecondary
                }
              ]} maxFontSizeMultiplier={1.3}>
                {tableTopic.time_qualification === true ? 'Yes' : tableTopic.time_qualification === false ? 'No' : 'Not recorded'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <User size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Table Topics Master
                </Text>
              </View>
              <Text style={[
                tableTopic.table_topics_master_name ? styles.detailValue : styles.detailValueEmpty,
                { color: tableTopic.table_topics_master_name ? theme.colors.text : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {tableTopic.table_topics_master_name || 'Not assigned'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Table Topics</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading your table topics...
            </Text>
          </View>
        ) : tableTopics.length > 0 ? (
          <View style={styles.list}>
            {tableTopics.map((tableTopic) => (
              <TableTopicCard key={tableTopic.id} tableTopic={tableTopic} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MessageSquare size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Table Topics Yet
            </Text>
            <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your table topics sessions will appear here once you complete On-the-Spot Speaking roles
            </Text>
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  list: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardContent: {
    padding: 16,
  },
  roleNameTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 24,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    gap: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    paddingLeft: 20,
  },
  detailValueEmpty: {
    fontSize: 15,
    fontWeight: '400',
    fontStyle: 'italic',
    paddingLeft: 20,
  },
  questionValue: {
    fontSize: 15,
    fontWeight: '500',
    paddingLeft: 20,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, Calendar, Building2, Hash, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface SpeechEvaluation {
  id: string;
  meeting_date: string;
  meeting_number: string;
  club_name: string;
  role_name: string;
  completed_at: string;
  evaluatee_name: string | null;
}

interface TableTopicEvaluation {
  id: string;
  meeting_date: string;
  meeting_number: string;
  club_name: string;
  role_name: string;
  completed_at: string;
}

interface MasterEvaluation {
  id: string;
  meeting_date: string;
  meeting_number: string;
  club_name: string;
  role_name: string;
  completed_at: string;
}

type TabType = 'speech' | 'table_topic' | 'master';

export default function EvaluationsGiven() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('speech');
  const [evaluationData, setEvaluationData] = useState<{
    speech: SpeechEvaluation[];
    table_topic: TableTopicEvaluation[];
    master: MasterEvaluation[];
  }>({
    speech: [],
    table_topic: [],
    master: [],
  });

  useEffect(() => {
    if (user?.id) {
      loadEvaluationData();
    }
  }, [user]);

  const loadEvaluationData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const [speechResult, tableTopicResult, masterResult] = await Promise.all([
        supabase.rpc('get_speech_evaluations', { p_user_id: user.id }),
        supabase.rpc('get_table_topic_evaluations', { p_user_id: user.id }),
        supabase.rpc('get_master_evaluations', { p_user_id: user.id }),
      ]);

      if (speechResult.error) throw speechResult.error;
      if (tableTopicResult.error) throw tableTopicResult.error;
      if (masterResult.error) throw masterResult.error;

      setEvaluationData({
        speech: speechResult.data || [],
        table_topic: tableTopicResult.data || [],
        master: masterResult.data || [],
      });
    } catch (error) {
      console.error('Error loading evaluation data:', error);
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

  const getTabData = () => {
    return evaluationData[activeTab];
  };

  const getTabColor = (tab: TabType) => {
    switch (tab) {
      case 'speech':
        return '#8b5cf6';
      case 'table_topic':
        return '#3b82f6';
      case 'master':
        return '#10b981';
    }
  };

  const renderSpeechEvaluationCard = (evaluation: SpeechEvaluation) => {
    return (
      <View
        key={evaluation.id}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.dateContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={[styles.dateText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {formatDate(evaluation.meeting_date)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.roleNameTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {evaluation.role_name}
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
                {evaluation.club_name}
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
                #{evaluation.meeting_number}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <User size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Speaker
                </Text>
              </View>
              <Text style={[
                evaluation.evaluatee_name ? styles.detailValue : styles.detailValueEmpty,
                { color: evaluation.evaluatee_name ? theme.colors.text : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {evaluation.evaluatee_name || 'Not assigned'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTableTopicEvaluationCard = (evaluation: TableTopicEvaluation) => {
    return (
      <View
        key={evaluation.id}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.dateContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={[styles.dateText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {formatDate(evaluation.meeting_date)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.roleNameTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {evaluation.role_name}
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
                {evaluation.club_name}
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
                #{evaluation.meeting_number}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderMasterEvaluationCard = (evaluation: MasterEvaluation) => {
    return (
      <View
        key={evaluation.id}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.dateContainer, { backgroundColor: theme.colors.primary + '15' }]}>
            <Calendar size={16} color={theme.colors.primary} />
            <Text style={[styles.dateText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {formatDate(evaluation.meeting_date)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.roleNameTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {evaluation.role_name}
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
                {evaluation.club_name}
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
                #{evaluation.meeting_number}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCard = (evaluation: any) => {
    if (activeTab === 'speech') {
      return renderSpeechEvaluationCard(evaluation);
    } else if (activeTab === 'table_topic') {
      return renderTableTopicEvaluationCard(evaluation);
    } else {
      return renderMasterEvaluationCard(evaluation);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluations Given</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'speech' && { borderBottomColor: getTabColor('speech'), borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('speech')}
        >
          <Text style={[
              styles.tabText,
              { color: activeTab === 'speech' ? getTabColor('speech') : theme.colors.textSecondary },
              activeTab === 'speech' && styles.tabTextActive,
            ]} maxFontSizeMultiplier={1.3}>
            Speech
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: getTabColor('speech') + '20' },
            ]}
          >
            <Text style={[styles.badgeText, { color: getTabColor('speech') }]} maxFontSizeMultiplier={1.3}>
              {evaluationData.speech.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'table_topic' && { borderBottomColor: getTabColor('table_topic'), borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('table_topic')}
        >
          <Text style={[
              styles.tabText,
              { color: activeTab === 'table_topic' ? getTabColor('table_topic') : theme.colors.textSecondary },
              activeTab === 'table_topic' && styles.tabTextActive,
            ]} maxFontSizeMultiplier={1.3}>
            Table Topic
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: getTabColor('table_topic') + '20' },
            ]}
          >
            <Text style={[styles.badgeText, { color: getTabColor('table_topic') }]} maxFontSizeMultiplier={1.3}>
              {evaluationData.table_topic.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'master' && { borderBottomColor: getTabColor('master'), borderBottomWidth: 2 },
          ]}
          onPress={() => setActiveTab('master')}
        >
          <Text style={[
              styles.tabText,
              { color: activeTab === 'master' ? getTabColor('master') : theme.colors.textSecondary },
              activeTab === 'master' && styles.tabTextActive,
            ]} maxFontSizeMultiplier={1.3}>
            Master
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: getTabColor('master') + '20' },
            ]}
          >
            <Text style={[styles.badgeText, { color: getTabColor('master') }]} maxFontSizeMultiplier={1.3}>
              {evaluationData.master.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading evaluations...
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {getTabData().length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <Calendar size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Evaluations Found
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Your {activeTab === 'speech' ? 'speech' : activeTab === 'table_topic' ? 'table topic' : 'master'} evaluations will appear here
                </Text>
              </View>
            ) : (
              getTabData().map(renderCard)
            )}
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
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
  listContainer: {
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
  emptyState: {
    marginTop: 24,
    padding: 32,
    borderRadius: 12,
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
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
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

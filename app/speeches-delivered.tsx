import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, Calendar, Building2, Hash, BookOpen, Award, Target, MessageSquare, Clock, CheckCircle2, XCircle, User, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface DeliveredSpeech {
  id: string;
  meeting_date: string;
  meeting_number: string;
  club_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  pathway_level: number | null;
  project_title: string | null;
  project_number: string | null;
  role_name: string;
  completed_at: string;
  actual_time_display: string | null;
  time_qualification: boolean | null;
  evaluator_name: string | null;
}

export default function SpeechesDelivered() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [speeches, setSpeeches] = useState<DeliveredSpeech[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadDeliveredSpeeches();
    }
  }, [user]);

  const loadDeliveredSpeeches = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('get_delivered_speeches', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error loading delivered speeches:', error);
        return;
      }

      const formattedSpeeches = (data || []).map((item: any) => ({
        id: item.id,
        meeting_date: item.meeting_date,
        meeting_number: item.meeting_number,
        club_name: item.club_name,
        speech_title: item.speech_title,
        pathway_name: item.pathway_name,
        pathway_level: item.pathway_level,
        project_title: item.project_title,
        project_number: item.project_number,
        role_name: item.role_name,
        completed_at: item.completed_at,
        actual_time_display: item.actual_time_display,
        time_qualification: item.time_qualification,
        evaluator_name: item.evaluator_name,
      }));

      setSpeeches(formattedSpeeches);
    } catch (error) {
      console.error('Error loading delivered speeches:', error);
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

  const SpeechCard = ({ speech }: { speech: DeliveredSpeech }) => {
    return (
      <View style={[styles.speechCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.dateContainer}>
          <Calendar size={16} color="#2563EB" />
          <Text style={styles.dateText} maxFontSizeMultiplier={1.3}>
            {formatDate(speech.meeting_date)}
          </Text>
        </View>

        <View style={styles.speechContent}>
          <Text style={styles.roleNameTitle} maxFontSizeMultiplier={1.3}>
            {speech.role_name}
          </Text>

          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <Building2 size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>CLUB</Text>
                <Text style={styles.detailValue} maxFontSizeMultiplier={1.3}>{speech.club_name}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <Hash size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>MEETING</Text>
                <Text style={styles.detailValue} maxFontSizeMultiplier={1.3}>#{speech.meeting_number}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <MessageSquare size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>SPEECH TITLE</Text>
                <Text style={speech.speech_title ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.speech_title || 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <BookOpen size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>PATHWAY NAME</Text>
                <Text style={speech.pathway_name ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.pathway_name || 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <Award size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>LEVEL</Text>
                <Text style={speech.pathway_level ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.pathway_level ? `Level ${speech.pathway_level}` : 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <Target size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>PROJECT NAME</Text>
                <Text style={speech.project_title ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.project_title || 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <FileText size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>PROJECT NUMBER</Text>
                <Text style={speech.project_number ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.project_number || 'Not specified'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <Clock size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>TIMING</Text>
                <Text style={speech.actual_time_display ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.actual_time_display || 'Not recorded'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: speech.time_qualification === true ? '#10b98110' : speech.time_qualification === false ? '#ef444410' : theme.colors.primary + '10' }]}>
                {speech.time_qualification === true ? (
                  <CheckCircle2 size={16} color="#10b981" />
                ) : speech.time_qualification === false ? (
                  <XCircle size={16} color="#ef4444" />
                ) : (
                  <CheckCircle2 size={16} color={theme.colors.primary} />
                )}
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>QUALIFIED</Text>
                <Text style={[
                  speech.time_qualification !== null ? styles.detailValue : styles.detailValueEmpty,
                  {
                    color: speech.time_qualification === true
                      ? '#10b981'
                      : speech.time_qualification === false
                      ? '#ef4444'
                      : '#9CA3AF'
                  }
                ]} maxFontSizeMultiplier={1.3}>
                  {speech.time_qualification === true ? 'Yes' : speech.time_qualification === false ? 'No' : 'Not recorded'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '10' }]}>
                <User size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel} maxFontSizeMultiplier={1.3}>EVALUATOR</Text>
                <Text style={speech.evaluator_name ? styles.detailValue : styles.detailValueEmpty} maxFontSizeMultiplier={1.3}>
                  {speech.evaluator_name || 'Not assigned'}
                </Text>
              </View>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches Delivered</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading your speeches...
            </Text>
          </View>
        ) : speeches.length > 0 ? (
          <View style={styles.speechesList}>
            {speeches.map((speech) => (
              <SpeechCard key={speech.id} speech={speech} />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <BookOpen size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Speeches Yet
            </Text>
            <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Your delivered speeches will appear here once you complete Prepared Speaker roles
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
    lineHeight: 24,
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
  speechesList: {
    padding: 16,
    gap: 16,
  },
  speechCard: {
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
    padding: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
    marginBottom: 10,
    backgroundColor: '#E0E7FF',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2563EB',
  },
  speechContent: {
  },
  roleNameTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  detailsGrid: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6B7280',
    lineHeight: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 17,
    color: '#111827',
  },
  detailValueEmpty: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    lineHeight: 17,
    color: '#9CA3AF',
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

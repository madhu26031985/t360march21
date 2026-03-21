import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Hash, Calendar, MessageSquare, User } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface TableTopicQuestion {
  question: string;
  assignedUserName: string;
  assignedUserId: string;
}

interface TTMasterSession {
  id: string;
  meetingId: string;
  clubName: string;
  meetingNumber: string;
  meetingDate: string;
  questions: TableTopicQuestion[];
}

export default function TableTopicsMasterDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<TTMasterSession[]>([]);

  useEffect(() => {
    if (user) {
      fetchTTMasterSessions();
    }
  }, [user]);

  const fetchTTMasterSessions = async () => {
    try {
      setLoading(true);

      // Get all meetings where user was Table Topics Master
      const { data: ttMasterRoles, error: rolesError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          meeting_id,
          app_club_meeting!inner(
            id,
            meeting_number,
            meeting_date,
            clubs!inner(
              name
            )
          )
        `)
        .eq('assigned_user_id', user?.id)
        .eq('role_name', 'Table Topics Master')
        .eq('is_completed', true)
        .order('app_club_meeting(meeting_date)', { ascending: false });

      if (rolesError) throw rolesError;

      if (!ttMasterRoles || ttMasterRoles.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      // For each TT Master session, fetch all table topics questions from that meeting
      const sessionsData: TTMasterSession[] = [];

      for (const role of ttMasterRoles) {
        const meeting = role.app_club_meeting;

        // Get all table topic speakers for this meeting
        const { data: speakers, error: speakersError } = await supabase
          .from('app_meeting_roles_management')
          .select(`
            id,
            table_topic_question,
            assigned_user_id,
            app_user_profiles!inner(
              full_name
            )
          `)
          .eq('meeting_id', role.meeting_id)
          .eq('role_classification', 'On-the-Spot Speaking')
          .not('table_topic_question', 'is', null)
          .order('id');

        if (speakersError) throw speakersError;

        const questions: TableTopicQuestion[] = speakers?.map(speaker => ({
          question: speaker.table_topic_question || 'No question recorded',
          assignedUserName: speaker.app_user_profiles.full_name,
          assignedUserId: speaker.assigned_user_id,
        })) || [];

        sessionsData.push({
          id: role.id,
          meetingId: role.meeting_id,
          clubName: meeting.clubs.name,
          meetingNumber: meeting.meeting_number,
          meetingDate: meeting.meeting_date,
          questions,
        });
      }

      setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching TT Master sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Date not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Table Topics Master</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Sessions Yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              You haven't served as Table Topics Master yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sessionsList}>
              {sessions.map((session) => (
                <View
                  key={session.id}
                  style={[
                    styles.sessionCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <View style={styles.clubNameRow}>
                    <View style={styles.clubIconContainer}>
                      <FileText size={20} color="#6b7280" />
                    </View>
                    <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {session.clubName}
                    </Text>
                  </View>

                  <View style={styles.meetingDetailsRow}>
                    <View style={styles.meetingDetailColumn}>
                      <View style={styles.detailHeader}>
                        <Hash size={16} color="#f59e0b" />
                        <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Meeting No
                        </Text>
                      </View>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {session.meetingNumber}
                      </Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.meetingDetailColumn}>
                      <View style={styles.detailHeader}>
                        <Calendar size={16} color="#8b5cf6" />
                        <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Date
                        </Text>
                      </View>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {formatDate(session.meetingDate)}
                      </Text>
                    </View>
                  </View>

                  {session.questions.length > 0 ? (
                    <View style={styles.questionsSection}>
                      <View style={styles.questionsSectionHeader}>
                        <MessageSquare size={18} color="#3b82f6" />
                        <Text style={[styles.questionsSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Table Topics Questions ({session.questions.length})
                        </Text>
                      </View>

                      <View style={styles.questionsList}>
                        {session.questions.map((item, index) => (
                          <View
                            key={index}
                            style={[
                              styles.questionCard,
                              { backgroundColor: theme.colors.background, borderColor: theme.colors.border }
                            ]}
                          >
                            <View style={styles.questionHeader}>
                              <View style={styles.questionNumberBadge}>
                                <Text style={styles.questionNumberText} maxFontSizeMultiplier={1.3}>Q{index + 1}</Text>
                              </View>
                            </View>

                            <Text style={[styles.questionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                              {item.question}
                            </Text>

                            <View style={styles.assignedUserRow}>
                              <User size={14} color={theme.colors.textSecondary} />
                              <Text style={[styles.assignedUserLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                                Asked to:
                              </Text>
                              <Text style={[styles.assignedUserName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                                {item.assignedUserName}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.noQuestionsContainer, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.noQuestionsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No questions were recorded for this session
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
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
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  sessionsList: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  sessionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  meetingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  meetingDetailColumn: {
    flex: 1,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  divider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  questionsSection: {
    gap: 12,
  },
  questionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionsSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  questionsList: {
    gap: 12,
  },
  questionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
  },
  questionNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  assignedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  assignedUserLabel: {
    fontSize: 13,
  },
  assignedUserName: {
    fontSize: 13,
    fontWeight: '600',
  },
  noQuestionsContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  noQuestionsText: {
    fontSize: 13,
    textAlign: 'center',
  },
});

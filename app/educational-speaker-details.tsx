import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Hash, Calendar, BookOpen, GraduationCap } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface EducationalSpeakerSession {
  id: string;
  meetingId: string;
  clubName: string;
  meetingNumber: string;
  meetingDate: string;
  speechTitle: string | null;
  summary: string | null;
  speakerName: string;
  speakerAvatar: string | null;
}

export default function EducationalSpeakerDetails() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<EducationalSpeakerSession[]>([]);

  useEffect(() => {
    if (user) {
      fetchEducationalSpeakerSessions();
    }
  }, [user]);

  const fetchEducationalSpeakerSessions = async () => {
    try {
      setLoading(true);

      // Get all completed educational speaker roles for the user
      const { data: roles, error: rolesError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          meeting_id,
          club_id
        `)
        .eq('assigned_user_id', user?.id)
        .eq('role_classification', 'Educational speaker')
        .eq('is_completed', true)
        .order('completed_at', { ascending: false });

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionsData = await Promise.all(
        roles.map(async (role) => {
          const [meetingResult, clubResult, educationalContentResult, profileResult] = await Promise.all([
            supabase
              .from('app_club_meeting')
              .select('meeting_date, meeting_number')
              .eq('id', role.meeting_id)
              .single(),
            supabase
              .from('club_profiles')
              .select('club_name')
              .eq('club_id', role.club_id)
              .single(),
            supabase
              .from('app_meeting_educational_speaker')
              .select('speech_title, summary')
              .eq('meeting_id', role.meeting_id)
              .eq('speaker_user_id', user?.id)
              .maybeSingle(),
            supabase
              .from('app_user_profiles')
              .select('full_name, avatar_url')
              .eq('id', user?.id)
              .single(),
          ]);

          return {
            id: role.id,
            meetingId: role.meeting_id,
            clubName: clubResult.data?.club_name || 'Unknown Club',
            meetingNumber: meetingResult.data?.meeting_number || 'N/A',
            meetingDate: meetingResult.data?.meeting_date || '',
            speechTitle: educationalContentResult.data?.speech_title || null,
            summary: educationalContentResult.data?.summary || null,
            speakerName: profileResult.data?.full_name || 'Unknown',
            speakerAvatar: profileResult.data?.avatar_url || null,
          };
        })
      );

      setSessions(sessionsData);
    } catch (error) {
      console.error('Error fetching educational speaker sessions:', error);
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
        >
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Speaker</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading your sessions...
            </Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Sessions Yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              You haven't served as Educational Speaker yet.
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

                  {session.speechTitle && session.summary ? (
                    <View style={[styles.educationalDisplayCard, { backgroundColor: theme.colors.surface }]}>
                      {/* Header with emoji */}
                      <View style={styles.educationalDisplayHeader}>
                        <Text style={styles.decorativeSparkle} maxFontSizeMultiplier={1.3}>✨</Text>
                        <Text style={[styles.educationalDisplayHeaderText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          EDUCATIONAL SPEECH
                        </Text>
                        <Text style={styles.educationalHeaderEmoji} maxFontSizeMultiplier={1.3}>🎓</Text>
                        <Text style={styles.decorativeSparkle} maxFontSizeMultiplier={1.3}>✨</Text>
                      </View>

                      <View style={styles.educationalDisplayDivider} />

                      {/* Speech Title */}
                      <Text style={[styles.educationalDisplayTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {session.speechTitle}
                      </Text>

                      {/* Summary */}
                      <Text style={[styles.educationalDisplaySummary, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {session.summary}
                      </Text>

                      <View style={styles.educationalDisplayDivider} />

                      {/* Speaker Info at Bottom */}
                      <View style={styles.educationalDisplaySpeaker}>
                        <View style={styles.educationalDisplaySpeakerAvatar}>
                          {session.speakerAvatar ? (
                            <Image
                              source={{ uri: session.speakerAvatar }}
                              style={styles.educationalDisplayAvatarImage}
                            />
                          ) : (
                            <GraduationCap size={24} color="#f97316" />
                          )}
                        </View>
                        <View style={styles.educationalDisplaySpeakerInfo}>
                          <Text style={[styles.educationalDisplaySpeakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {session.speakerName}
                          </Text>
                          <Text style={[styles.educationalDisplaySpeakerRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            Educational Speaker
                          </Text>
                          <Text style={[styles.educationalDisplayClubName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                            {session.clubName}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.noContentContainer, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.noContentText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No educational content was recorded for this session
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
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
  educationalDisplayCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  educationalDisplayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  educationalDisplayHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  decorativeSparkle: {
    fontSize: 16,
  },
  educationalHeaderEmoji: {
    fontSize: 18,
  },
  educationalDisplayDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  educationalDisplayTitle: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 40,
  },
  educationalDisplaySummary: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'left',
    marginBottom: 0,
  },
  educationalDisplaySpeaker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  educationalDisplaySpeakerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#f97316',
  },
  educationalDisplayAvatarImage: {
    width: '100%',
    height: '100%',
  },
  educationalDisplaySpeakerInfo: {
    flex: 1,
  },
  educationalDisplaySpeakerName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  educationalDisplaySpeakerRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  educationalDisplayClubName: {
    fontSize: 13,
    fontWeight: '500',
  },
  noContentContainer: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noContentText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, Calendar, Hash, Lightbulb, FileText } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ToastmasterSession {
  id: string;
  meetingId: string;
  clubName: string;
  meetingNumber: string;
  meetingDate: string;
  themeOfTheDay: string | null;
  themeSummary: string | null;
  meetingTitle: string;
}

export default function ToastmasterOfTheDayDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ToastmasterSession[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadToastmasterSessions();
    }
  }, [user]);

  const loadToastmasterSessions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const { data: roles, error: rolesError } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          meeting_id,
          club_id,
          created_at
        `)
        .eq('assigned_user_id', user.id)
        .eq('role_name', 'Toastmaster of the Day')
        .eq('is_completed', true)
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const sessionsData = await Promise.all(
        roles.map(async (role) => {
          const [meetingResult, clubResult, notesResult] = await Promise.all([
            supabase
              .from('app_club_meeting')
              .select('meeting_title, meeting_date, meeting_number')
              .eq('id', role.meeting_id)
              .single(),
            supabase
              .from('club_profiles')
              .select('club_name')
              .eq('club_id', role.club_id)
              .single(),
            supabase
              .from('app_meeting_toastmaster_notes')
              .select('theme_of_the_day, theme_summary')
              .eq('meeting_id', role.meeting_id)
              .maybeSingle(),
          ]);

          return {
            id: role.id,
            meetingId: role.meeting_id,
            clubName: clubResult.data?.club_name || 'Unknown Club',
            meetingNumber: meetingResult.data?.meeting_number || 'N/A',
            meetingDate: meetingResult.data?.meeting_date || '',
            themeOfTheDay: notesResult.data?.theme_of_the_day || null,
            themeSummary: notesResult.data?.theme_summary || null,
            meetingTitle: meetingResult.data?.meeting_title || 'Meeting',
          };
        })
      );

      setSessions(sessionsData);
    } catch (error) {
      console.error('Error loading toastmaster sessions:', error);
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Toastmaster of the Day</Text>
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
            <Lightbulb size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Sessions Yet
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              You haven't served as Toastmaster of the Day yet.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.sessionsList}>
              {sessions.map((session, index) => (
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

                  {session.themeOfTheDay ? (
                    <View style={styles.themeSection}>
                      <View style={styles.themeHeader}>
                        <Lightbulb size={18} color="#ef4444" />
                        <Text style={styles.themeLabel} maxFontSizeMultiplier={1.3}>
                          Theme of the Day
                        </Text>
                      </View>
                      <Text style={styles.themeTitle} maxFontSizeMultiplier={1.3}>
                        {session.themeOfTheDay}
                      </Text>
                      {session.themeSummary && (
                        <Text style={styles.themeSummary} maxFontSizeMultiplier={1.3}>
                          {session.themeSummary}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={[styles.noThemeContainer, { backgroundColor: theme.colors.background }]}>
                      <Text style={[styles.noThemeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        No theme was set for this meeting
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
  themeSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    gap: 12,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  themeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 24,
  },
  themeSummary: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
  },
  noThemeContainer: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  noThemeText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

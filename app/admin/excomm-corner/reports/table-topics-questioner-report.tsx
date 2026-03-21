import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, HelpCircle, Calendar, Users, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react-native';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface QuestionEntry {
  participant_name: string | null;
  question_text: string | null;
}

interface MeetingGroup {
  meeting_id: string;
  meeting_number: number;
  meeting_date: string;
  tt_master_name: string | null;
  entries: QuestionEntry[];
  expanded: boolean;
}

export default function TableTopicsQuestionerReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingGroups, setMeetingGroups] = useState<MeetingGroup[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [clubName, setClubName] = useState('');
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentClubId) {
      loadData();
    } else {
      setLoading(false);
      setError('No club selected');
    }
  }, [user?.currentClubId]);

  const loadData = async () => {
    if (!user?.currentClubId) return;
    try {
      setLoading(true);
      setError(null);

      const [clubRes, profileRes] = await Promise.all([
        supabase.from('clubs').select('name').eq('id', user.currentClubId).maybeSingle(),
        supabase.from('club_profiles').select('banner_color').eq('club_id', user.currentClubId).maybeSingle(),
      ]);

      if (clubRes.data?.name) setClubName(clubRes.data.name);
      setBannerColor(profileRes.data?.banner_color || '#1e3a5f');

      const { data: ttData, error: ttError } = await supabase
        .from('app_meeting_tabletopicscorner')
        .select(`
          question_text,
          participant_name,
          meeting_id,
          app_club_meeting!inner(meeting_date, meeting_number)
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_active', true)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      if (ttError) throw ttError;

      const meetingIds = [...new Set((ttData || []).map((r: any) => r.meeting_id))];

      const ttMasterMap = new Map<string, string>();
      if (meetingIds.length > 0) {
        const { data: roleData } = await supabase
          .from('app_meeting_roles_management')
          .select('meeting_id, app_user_profiles(full_name)')
          .in('meeting_id', meetingIds)
          .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%')
          .eq('booking_status', 'booked');

        (roleData || []).forEach((r: any) => {
          if (!ttMasterMap.has(r.meeting_id)) {
            ttMasterMap.set(r.meeting_id, r.app_user_profiles?.full_name || '');
          }
        });
      }

      const groupMap = new Map<string, MeetingGroup>();
      (ttData || []).forEach((row: any) => {
        const meeting = row.app_club_meeting;
        const mid = row.meeting_id;
        if (!groupMap.has(mid)) {
          groupMap.set(mid, {
            meeting_id: mid,
            meeting_number: meeting?.meeting_number || 0,
            meeting_date: meeting?.meeting_date || '',
            tt_master_name: ttMasterMap.get(mid) || null,
            entries: [],
            expanded: false,
          });
        }
        groupMap.get(mid)!.entries.push({
          participant_name: row.participant_name,
          question_text: row.question_text,
        });
      });

      const groups = Array.from(groupMap.values()).sort((a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
      );

      let total = 0;
      groups.forEach(g => { total += g.entries.length; });

      setMeetingGroups(groups);
      setTotalQuestions(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (meetingId: string) => {
    setMeetingGroups(prev =>
      prev.map(g => g.meeting_id === meetingId ? { ...g, expanded: !g.expanded } : g)
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Table Topics Questioner Report
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading report...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <HelpCircle size={56} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Error</Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={loadData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
            <Text style={styles.heroClub} maxFontSizeMultiplier={1.2}>{clubName}</Text>
            <Text style={styles.heroSub} maxFontSizeMultiplier={1.2}>Table Topics Questioner Report</Text>
          </View>

          <View style={[styles.statsRow, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#0ea5e9' + '18' }]}>
                <Calendar size={22} color="#0ea5e9" />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                {meetingGroups.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Meetings
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#f97316' + '18' }]}>
                <HelpCircle size={22} color="#f97316" />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                {totalQuestions}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Questions
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: '#10b981' + '18' }]}>
                <Users size={22} color="#10b981" />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                {meetingGroups.length > 0 ? (totalQuestions / meetingGroups.length).toFixed(1) : '0'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Avg / Meeting
              </Text>
            </View>
          </View>

          <View style={styles.listContainer}>
            {meetingGroups.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <HelpCircle size={56} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  No Published Questions
                </Text>
                <Text style={[styles.emptyDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  Questions will appear here once the Table Topics Master publishes them after a meeting.
                </Text>
              </View>
            ) : (
              meetingGroups.map(group => (
                <View key={group.meeting_id} style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
                  <TouchableOpacity
                    style={styles.meetingCardHeader}
                    onPress={() => toggleGroup(group.meeting_id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.meetingIconBg, { backgroundColor: '#0ea5e9' + '18' }]}>
                      <MessageCircle size={20} color="#0ea5e9" />
                    </View>
                    <View style={styles.meetingCardInfo}>
                      <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                        Meeting #{group.meeting_number}
                      </Text>
                      <Text style={[styles.meetingCardDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        {formatDate(group.meeting_date)}
                      </Text>
                      {group.tt_master_name ? (
                        <Text style={[styles.ttMasterLabel, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
                          TT Master: {group.tt_master_name}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.meetingCardRight}>
                      <View style={[styles.countBadge, { backgroundColor: '#0ea5e9' + '18' }]}>
                        <Text style={[styles.countBadgeText, { color: '#0ea5e9' }]} maxFontSizeMultiplier={1.2}>
                          {group.entries.length} {group.entries.length === 1 ? 'question' : 'questions'}
                        </Text>
                      </View>
                      {group.expanded
                        ? <ChevronUp size={18} color={theme.colors.textSecondary} />
                        : <ChevronDown size={18} color={theme.colors.textSecondary} />}
                    </View>
                  </TouchableOpacity>

                  {group.expanded && (
                    <View style={[styles.entriesList, { borderTopColor: theme.colors.border }]}>
                      {group.entries.map((entry, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.entryRow,
                            idx < group.entries.length - 1 && { borderBottomColor: theme.colors.border, borderBottomWidth: 0.5 },
                          ]}
                        >
                          <View style={styles.entryNumberCircle}>
                            <Text style={[styles.entryNumber, { color: '#0ea5e9' }]} maxFontSizeMultiplier={1.2}>
                              {idx + 1}
                            </Text>
                          </View>
                          <View style={styles.entryContent}>
                            <Text style={[styles.entryParticipant, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                              {entry.participant_name || 'Unknown Participant'}
                            </Text>
                            {entry.question_text ? (
                              <Text style={[styles.entryQuestion, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                                {entry.question_text}
                              </Text>
                            ) : (
                              <Text style={[styles.entryQuestion, { color: theme.colors.textSecondary, fontStyle: 'italic' }]} maxFontSizeMultiplier={1.2}>
                                No question recorded
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={[styles.colorBar, { backgroundColor: '#0ea5e9' }]} />
                </View>
              ))
            )}
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: { width: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },
  errorTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  errorMessage: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  heroBanner: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroClub: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2, textAlign: 'center' },
  statDivider: { width: 1, marginHorizontal: 8 },
  listContainer: { padding: 16, gap: 12 },
  emptyState: {
    borderRadius: 14,
    padding: 40,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  meetingCard: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  meetingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  meetingIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingCardInfo: { flex: 1 },
  meetingCardTitle: { fontSize: 15, fontWeight: '700' },
  meetingCardDate: { fontSize: 12, marginTop: 2 },
  ttMasterLabel: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  meetingCardRight: { alignItems: 'flex-end', gap: 6 },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countBadgeText: { fontSize: 11, fontWeight: '600' },
  entriesList: { borderTopWidth: 0.5, paddingHorizontal: 16, paddingBottom: 12 },
  entryRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  entryNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0ea5e918',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  entryNumber: { fontSize: 12, fontWeight: '700' },
  entryContent: { flex: 1 },
  entryParticipant: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  entryQuestion: { fontSize: 13, lineHeight: 18 },
  colorBar: {
    height: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  bottomSpacing: { height: 40 },
});

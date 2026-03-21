import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Mic, Target, FileText, CheckCircle2, Circle } from 'lucide-react-native';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type TimeFilter = '3months' | '6months';

type MeetingData = {
  id: string;
  meeting_number: number;
  meeting_date: string;
  toastmaster_name: string | null;
  theme_name: string | null;
  theme_summary: string | null;
};

export default function TMODReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('3months');
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clubName, setClubName] = useState<string>('');
  const [clubNumber, setClubNumber] = useState<string | null>(null);
  const [bannerColor, setBannerColor] = useState<string | null>(null);

  useEffect(() => {
    if (user?.currentClubId) {
      loadClubInfo();
      loadMeetings();
    }
  }, [user?.currentClubId, timeFilter]);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;
    try {
      const [clubRes, profileRes] = await Promise.all([
        supabase.from('clubs').select('name, club_number').eq('id', user.currentClubId).maybeSingle(),
        supabase.from('club_profiles').select('banner_color').eq('club_id', user.currentClubId).maybeSingle(),
      ]);
      if (clubRes.data) { setClubName(clubRes.data.name); setClubNumber(clubRes.data.club_number); }
      setBannerColor(profileRes.data?.banner_color || '#1e3a5f');
    } catch {}
  };

  const loadMeetings = async () => {
    if (!user?.currentClubId) return;
    setIsLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let startDate: Date;
      let endDate: Date;

      if (timeFilter === '3months') {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        endDate = new Date(today);
      } else {
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 6);
        endDate = new Date(today);
        endDate.setMonth(today.getMonth() - 3);
        endDate.setDate(endDate.getDate() - 1);
      }

      const { data, error } = await supabase
        .from('app_club_meeting')
        .select(`
          id,
          meeting_number,
          meeting_date,
          app_meeting_roles_management (
            role_name,
            assigned_user_id,
            app_user_profiles (
              full_name
            )
          ),
          toastmaster_meeting_data (
            theme_of_the_day,
            theme_summary,
            toastmaster_user_id
          )
        `)
        .eq('club_id', user.currentClubId)
        .gte('meeting_date', toLocalDateStr(startDate))
        .lte('meeting_date', toLocalDateStr(endDate))
        .order('meeting_date', { ascending: false });

      if (error) {
        Alert.alert('Error', 'Failed to load meeting data');
        return;
      }

      const formattedMeetings: MeetingData[] = (data || []).map((meeting: any) => {
        let toastmasterName = null;
        let themeName = null;
        let themeSummary = null;
        let tmodUserId = null;

        if (Array.isArray(meeting.app_meeting_roles_management)) {
          const tmodRole = meeting.app_meeting_roles_management.find(
            (role: any) => role.role_name === 'Toastmaster of the Day'
          );
          if (tmodRole && tmodRole.app_user_profiles) {
            toastmasterName = tmodRole.app_user_profiles.full_name;
            tmodUserId = tmodRole.assigned_user_id;
          }
        }

        if (tmodUserId && Array.isArray(meeting.toastmaster_meeting_data) && meeting.toastmaster_meeting_data.length > 0) {
          const sorted = [...meeting.toastmaster_meeting_data].sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const bookedTmodEntry = sorted.find((tmd: any) => tmd.toastmaster_user_id === tmodUserId);
          const entry = bookedTmodEntry || sorted[0];
          themeName = entry?.theme_of_the_day || null;
          themeSummary = entry?.theme_summary || null;
        }

        return {
          id: meeting.id,
          meeting_number: meeting.meeting_number,
          meeting_date: meeting.meeting_date,
          toastmaster_name: toastmasterName,
          theme_name: themeName,
          theme_summary: themeSummary,
        };
      });

      setMeetings(formattedMeetings);
    } catch {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDoneCount = (meeting: MeetingData): number => {
    let count = 0;
    if (meeting.theme_name) count++;
    if (meeting.theme_summary) count++;
    return count;
  };

  const TOTAL_ITEMS = 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          TMOD Report
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.clubBanner, { backgroundColor: bannerColor ?? 'transparent' }]}>
          <Text style={styles.clubBannerName} maxFontSizeMultiplier={1.3}>{clubName}</Text>
          {clubNumber ? (
            <Text style={styles.clubBannerNumber} maxFontSizeMultiplier={1.3}>Club #{clubNumber}</Text>
          ) : null}
        </View>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: timeFilter === '3months' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setTimeFilter('3months')}
          >
            <Text style={[styles.filterButtonText, { color: timeFilter === '3months' ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              0-3 Months
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: timeFilter === '6months' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={() => setTimeFilter('6months')}
          >
            <Text style={[styles.filterButtonText, { color: timeFilter === '6months' ? '#ffffff' : theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              4-6 Months
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading meetings...
            </Text>
          </View>
        ) : meetings.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface }]}>
            <Calendar size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Meetings Found
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No meetings found in the selected time period
            </Text>
          </View>
        ) : (
          <View style={styles.meetingsContainer}>
            <Text style={[styles.resultCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found
            </Text>

            {meetings.map((meeting) => {
              const doneCount = getDoneCount(meeting);
              const progress = doneCount / TOTAL_ITEMS;
              const themeCompleted = !!meeting.theme_name;
              const summaryCompleted = !!meeting.theme_summary;
              const summaryChars = meeting.theme_summary?.length ?? 0;

              return (
                <TouchableOpacity
                  key={meeting.id}
                  style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => router.push({ pathname: '/toastmaster-corner', params: { meetingId: meeting.id } })}
                  activeOpacity={0.7}
                >
                  {/* Card header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.meetingNumberBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                        <Text style={[styles.meetingNumberText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                          #{meeting.meeting_number}
                        </Text>
                      </View>
                      <View style={styles.dateRow}>
                        <Calendar size={13} color={theme.colors.textSecondary} />
                        <Text style={[styles.dateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {formatDate(meeting.meeting_date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.doneCountContainer}>
                      <Text style={[styles.doneCountBold, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {doneCount}/{TOTAL_ITEMS}
                      </Text>
                      <Text style={[styles.doneCountLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {' '}done
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: doneCount === TOTAL_ITEMS ? '#16a34a' : theme.colors.primary,
                          width: `${progress * 100}%` as any,
                        },
                      ]}
                    />
                  </View>

                  {/* TMOD row */}
                  <View style={styles.tmodRow}>
                    <View style={[styles.tmodAvatar, { backgroundColor: theme.colors.primary }]}>
                      <Mic size={20} color="#ffffff" />
                    </View>
                    <View style={styles.tmodInfo}>
                      <Text style={[styles.tmodRoleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Toastmaster of the Day
                      </Text>
                      <Text style={[styles.tmodName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {meeting.toastmaster_name || 'Not assigned'}
                      </Text>
                    </View>
                  </View>

                  {/* Checklist items */}
                  <View style={[styles.checklistContainer, { borderColor: theme.colors.border }]}>
                    {/* Theme row */}
                    <View style={[styles.checklistRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={[styles.checklistLabelPill, { backgroundColor: theme.colors.background }]}>
                        <Target size={14} color={theme.colors.text} />
                        <Text style={[styles.checklistLabelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Theme
                        </Text>
                      </View>
                      <View style={styles.checklistRight}>
                        {themeCompleted ? (
                          <View style={styles.statusBadge}>
                            <CheckCircle2 size={15} color="#16a34a" />
                            <Text style={[styles.statusTextDone]} maxFontSizeMultiplier={1.3}>Completed</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadge}>
                            <Circle size={15} color={theme.colors.textSecondary} />
                            <Text style={[styles.statusTextPending, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pending</Text>
                          </View>
                        )}
                        <Text style={[styles.themeNameText, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                          {meeting.theme_name || '—'}
                        </Text>
                      </View>
                    </View>

                    {/* Theme Summary row */}
                    <View style={styles.checklistRow}>
                      <View style={[styles.checklistLabelPill, { backgroundColor: theme.colors.background }]}>
                        <FileText size={14} color={theme.colors.text} />
                        <Text style={[styles.checklistLabelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Theme Summary
                        </Text>
                      </View>
                      <View style={styles.checklistRight}>
                        {summaryCompleted ? (
                          <View style={styles.statusBadge}>
                            <CheckCircle2 size={15} color="#16a34a" />
                            <Text style={styles.statusTextDone} maxFontSizeMultiplier={1.3}>Completed</Text>
                          </View>
                        ) : (
                          <View style={styles.statusBadge}>
                            <Circle size={15} color={theme.colors.textSecondary} />
                            <Text style={[styles.statusTextPending, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pending</Text>
                          </View>
                        )}
                        <Text style={[styles.charCountPill, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {summaryChars} characters
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: { width: 40 },
  content: { flex: 1 },
  clubBanner: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  clubBannerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  clubBannerNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterButtonText: { fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: { marginTop: 16, fontSize: 14 },
  emptyContainer: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyDescription: { fontSize: 14, textAlign: 'center' },
  meetingsContainer: { paddingHorizontal: 16 },
  resultCount: { fontSize: 13, marginBottom: 12 },
  meetingCard: {
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meetingNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  meetingNumberText: { fontSize: 13, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { fontSize: 13 },
  doneCountContainer: { flexDirection: 'row', alignItems: 'baseline' },
  doneCountBold: { fontSize: 15, fontWeight: '700' },
  doneCountLabel: { fontSize: 13 },
  progressTrack: {
    height: 3,
    marginHorizontal: 0,
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  tmodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  tmodAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmodInfo: { flex: 1 },
  tmodRoleLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  tmodName: { fontSize: 14 },
  checklistContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  checklistLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  checklistLabelText: { fontSize: 13, fontWeight: '600' },
  checklistRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusTextDone: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  statusTextPending: {
    fontSize: 13,
    fontWeight: '500',
  },
  themeNameText: {
    fontSize: 12,
    maxWidth: 180,
  },
  charCountPill: {
    fontSize: 12,
  },
  bottomSpacing: { height: 40 },
});

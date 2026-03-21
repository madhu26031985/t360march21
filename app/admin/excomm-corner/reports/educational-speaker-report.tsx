import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, BookOpen, FileText, CheckCircle2, Circle } from 'lucide-react-native';

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
  educational_speaker_name: string | null;
  speech_title: string | null;
  summary: string | null;
  notes: string | null;
};

export default function EducationalSpeakerReport() {
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
          app_meeting_educational_speaker (
            speech_title,
            summary,
            notes,
            booking_status,
            speaker_user_id
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
        let educationalSpeakerName = null;
        let speechTitle = null;
        let summary = null;
        let notes = null;

        if (Array.isArray(meeting.app_meeting_roles_management)) {
          const esRole = meeting.app_meeting_roles_management.find(
            (role: any) => role.role_name === 'Educational Speaker'
          );
          if (esRole && esRole.app_user_profiles) {
            educationalSpeakerName = esRole.app_user_profiles.full_name;
          }
        }

        if (Array.isArray(meeting.app_meeting_educational_speaker)) {
          const bookedSpeaker = meeting.app_meeting_educational_speaker.find(
            (s: any) => s.booking_status === 'booked'
          );
          const entry = bookedSpeaker || meeting.app_meeting_educational_speaker[0];
          if (entry) {
            speechTitle = entry.speech_title || null;
            summary = entry.summary || null;
            notes = entry.notes || null;
          }
        }

        return {
          id: meeting.id,
          meeting_number: meeting.meeting_number,
          meeting_date: meeting.meeting_date,
          educational_speaker_name: educationalSpeakerName,
          speech_title: speechTitle,
          summary,
          notes,
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
    if (meeting.speech_title) count++;
    if (meeting.summary) count++;
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
          Educational Speaker Report
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
              const titleCompleted = !!meeting.speech_title;
              const summaryCompleted = !!meeting.summary;
              const summaryChars = meeting.summary?.length ?? 0;

              return (
                <TouchableOpacity
                  key={meeting.id}
                  style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting.id } })}
                  activeOpacity={0.7}
                >
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

                  <View style={styles.speakerRow}>
                    <View style={[styles.speakerAvatar, { backgroundColor: theme.colors.primary }]}>
                      <BookOpen size={20} color="#ffffff" />
                    </View>
                    <View style={styles.speakerInfo}>
                      <Text style={[styles.speakerRoleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        Educational Speaker
                      </Text>
                      <Text style={[styles.speakerName, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {meeting.educational_speaker_name || 'Not assigned'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.checklistContainer, { borderColor: theme.colors.border }]}>
                    <View style={[styles.checklistRow, { borderBottomColor: theme.colors.border }]}>
                      <View style={[styles.checklistLabelPill, { backgroundColor: theme.colors.background }]}>
                        <BookOpen size={14} color={theme.colors.text} />
                        <Text style={[styles.checklistLabelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Title
                        </Text>
                      </View>
                      <View style={styles.checklistRight}>
                        {titleCompleted ? (
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
                        <Text style={[styles.itemValueText, { color: theme.colors.textSecondary }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                          {meeting.speech_title ? `Title: ${meeting.speech_title}` : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.checklistRow}>
                      <View style={[styles.checklistLabelPill, { backgroundColor: theme.colors.background }]}>
                        <FileText size={14} color={theme.colors.text} />
                        <Text style={[styles.checklistLabelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Summary
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
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  speakerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerInfo: { flex: 1 },
  speakerRoleLabel: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  speakerName: { fontSize: 14 },
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
  itemValueText: {
    fontSize: 12,
    maxWidth: 180,
  },
  charCountPill: {
    fontSize: 12,
  },
  bottomSpacing: { height: 40 },
});

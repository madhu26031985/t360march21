import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar } from 'lucide-react-native';

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
            booking_status,
            app_user_profiles (
              full_name
            )
          ),
          app_meeting_educational_speaker (
            speech_title,
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

      const formattedMeetings: MeetingData[] = (data || [])
        .map((meeting: any) => {
          let educationalSpeakerName: string | null = null;
          let speechTitle: string | null = null;
          let assignedUserId: string | null = null;

          if (Array.isArray(meeting.app_meeting_roles_management)) {
            const esRole = meeting.app_meeting_roles_management.find(
              (role: any) => role.role_name === 'Educational Speaker'
            );
            if (
              esRole?.assigned_user_id &&
              esRole.booking_status === 'booked' &&
              esRole.app_user_profiles?.full_name
            ) {
              assignedUserId = esRole.assigned_user_id;
              educationalSpeakerName = esRole.app_user_profiles.full_name;
            }
          }

          if (Array.isArray(meeting.app_meeting_educational_speaker)) {
            const entry = assignedUserId
              ? meeting.app_meeting_educational_speaker.find(
                  (s: any) => s.speaker_user_id === assignedUserId
                )
              : null;
            const title = entry?.speech_title?.trim();
            if (title) {
              speechTitle = title;
            } else {
              const fallback = meeting.app_meeting_educational_speaker.find(
                (s: any) => typeof s.speech_title === 'string' && s.speech_title.trim()
              );
              speechTitle = fallback?.speech_title?.trim() || null;
            }
          }

          return {
            id: meeting.id,
            meeting_number: meeting.meeting_number,
            meeting_date: meeting.meeting_date,
            educational_speaker_name: educationalSpeakerName,
            speech_title: speechTitle,
          };
        })
        .filter((meeting) => !!meeting.educational_speaker_name?.trim());

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
              No meetings with a booked Educational Speaker in this period
            </Text>
          </View>
        ) : (
          <View style={styles.meetingsContainer}>
            <Text style={[styles.resultCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found
            </Text>

            <View style={[styles.table, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.tableHeaderCell, styles.colMeeting, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Meeting Number
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Title
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colSpeaker, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Speaker
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colDate, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Date
                </Text>
              </View>

              {meetings.map((meeting, index) => {
                const isLast = index === meetings.length - 1;
                return (
                  <TouchableOpacity
                    key={meeting.id}
                    style={[
                      styles.tableRow,
                      !isLast && { borderBottomColor: theme.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
                    onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting.id } })}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.tableCell, styles.colMeeting, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      #{meeting.meeting_number}
                    </Text>
                    <Text
                      style={[styles.tableCell, styles.colTitle, { color: theme.colors.text }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                    >
                      {meeting.speech_title || '—'}
                    </Text>
                    <Text
                      style={[styles.tableCell, styles.colSpeaker, { color: theme.colors.text }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.2}
                    >
                      {meeting.educational_speaker_name || '—'}
                    </Text>
                    <Text style={[styles.tableCell, styles.colDate, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {formatDate(meeting.meeting_date)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
  table: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderCell: {
    fontSize: 13,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  tableCell: {
    fontSize: 14,
    fontWeight: '400',
  },
  colMeeting: { flex: 1.1 },
  colTitle: { flex: 2.2, paddingRight: 8 },
  colSpeaker: { flex: 1.4, paddingRight: 8 },
  colDate: { flex: 1.3 },
  bottomSpacing: { height: 40 },
});

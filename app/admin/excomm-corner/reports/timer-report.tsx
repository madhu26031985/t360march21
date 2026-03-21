import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, User, ChevronRight, Clock, CheckCircle } from 'lucide-react-native';

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
  timer_name: string | null;
  has_report: boolean;
};

export default function TimerReport() {
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
          timer_reports ( id )
        `)
        .eq('club_id', user.currentClubId)
        .gte('meeting_date', toLocalDateStr(startDate))
        .lte('meeting_date', toLocalDateStr(endDate))
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        return;
      }

      const formattedMeetings: MeetingData[] = (data || []).map((meeting: any) => {
        let timerName = null;
        if (Array.isArray(meeting.app_meeting_roles_management)) {
          const timerRole = meeting.app_meeting_roles_management.find(
            (role: any) => role.role_name === 'Timer'
          );
          if (timerRole?.app_user_profiles) {
            timerName = timerRole.app_user_profiles.full_name;
          }
        }

        const hasReport = Array.isArray(meeting.timer_reports) && meeting.timer_reports.length > 0;

        return {
          id: meeting.id,
          meeting_number: meeting.meeting_number,
          meeting_date: meeting.meeting_date,
          timer_name: timerName,
          has_report: hasReport,
        };
      });

      setMeetings(formattedMeetings);
    } catch (error) {
      console.error('Error loading meetings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Timer Report
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
          {(['3months', '6months'] as TimeFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterButton,
                {
                  backgroundColor: timeFilter === f ? theme.colors.primary : theme.colors.surface,
                  borderColor: timeFilter === f ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setTimeFilter(f)}
            >
              <Text
                style={[styles.filterButtonText, { color: timeFilter === f ? '#fff' : theme.colors.text }]}
                maxFontSizeMultiplier={1.3}
              >
                {f === '3months' ? '0-3 Months' : '4-6 Months'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading meetings...
            </Text>
          </View>
        ) : meetings.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Calendar size={40} color={theme.colors.textSecondary} />
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

            {meetings.map((meeting) => (
              <TouchableOpacity
                key={meeting.id}
                style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
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
                  <ChevronRight size={18} color={theme.colors.textSecondary} />
                </View>

                <View style={[styles.timerRow, { borderTopColor: theme.colors.border }]}>
                  <View style={[styles.timerIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                    <User size={14} color={theme.colors.primary} />
                  </View>
                  <View style={styles.timerInfo}>
                    <Text style={[styles.timerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Timer
                    </Text>
                    <Text style={[styles.timerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {meeting.timer_name || 'Not assigned'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: meeting.has_report ? '#16a34a18' : '#f59e0b18',
                        borderColor: meeting.has_report ? '#16a34a40' : '#f59e0b40',
                      },
                    ]}
                  >
                    {meeting.has_report ? (
                      <CheckCircle size={12} color="#16a34a" />
                    ) : (
                      <Clock size={12} color="#f59e0b" />
                    )}
                    <Text
                      style={[
                        styles.statusText,
                        { color: meeting.has_report ? '#16a34a' : '#f59e0b' },
                      ]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {meeting.has_report ? 'Completed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
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
    paddingVertical: 14,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  emptyContainer: {
    marginHorizontal: 16,
    marginTop: 32,
    padding: 40,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  meetingsContainer: {
    paddingHorizontal: 16,
  },
  resultCount: {
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  meetingCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  meetingNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  meetingNumberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 13,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 0.5,
  },
  timerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  timerInfo: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 11,
    marginBottom: 1,
  },
  timerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});

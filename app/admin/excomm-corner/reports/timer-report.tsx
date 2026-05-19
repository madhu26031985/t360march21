import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { mapTimerReportSpeechCategoryToAggregate } from '@/lib/timerReportSpeechCategory';
import { ArrowLeft, Calendar } from 'lucide-react-native';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type TimeFilter = '3months' | '6months';

type ReportRow = {
  meetingId: string;
  meeting_number: number;
  meeting_date: string;
  timer_name: string | null;
  prepared_speaker_count: number;
  evaluator_count: number;
  table_topic_speaker_count: number;
  educational_speaker_count: number;
};

const cell = (value: string | null | undefined, fallback = '—') => {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

const countCell = (n: number) => (n > 0 ? String(n) : '0');

export default function TimerReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('3months');
  const [rows, setRows] = useState<ReportRow[]>([]);
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
      if (clubRes.data) {
        setClubName(clubRes.data.name);
        setClubNumber(clubRes.data.club_number);
      }
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

      const startStr = toLocalDateStr(startDate);
      const endStr = toLocalDateStr(endDate);

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
          timer_reports (
            speech_category
          )
        `)
        .eq('club_id', user.currentClubId)
        .gte('meeting_date', startStr)
        .lte('meeting_date', endStr)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        return;
      }

      const reportRows: ReportRow[] = (data || []).map((meeting: any) => {
        let timerName: string | null = null;
        if (Array.isArray(meeting.app_meeting_roles_management)) {
          const timerRole = meeting.app_meeting_roles_management.find(
            (role: any) => role.role_name === 'Timer'
          );
          if (timerRole?.booking_status === 'booked' && timerRole.assigned_user_id) {
            timerName = timerRole.app_user_profiles?.full_name?.trim() || null;
          } else if (timerRole?.app_user_profiles?.full_name) {
            timerName = timerRole.app_user_profiles.full_name.trim();
          }
        }

        const counts = {
          prepared_speeches: 0,
          evaluation: 0,
          table_topic_speakers: 0,
          educational_speech: 0,
        };

        if (Array.isArray(meeting.timer_reports)) {
          meeting.timer_reports.forEach((report: { speech_category?: string }) => {
            const bucket = mapTimerReportSpeechCategoryToAggregate(report.speech_category || '');
            if (bucket) counts[bucket] += 1;
          });
        }

        return {
          meetingId: meeting.id,
          meeting_number: meeting.meeting_number,
          meeting_date: meeting.meeting_date,
          timer_name: timerName,
          prepared_speaker_count: counts.prepared_speeches,
          evaluator_count: counts.evaluation,
          table_topic_speaker_count: counts.table_topic_speakers,
          educational_speaker_count: counts.educational_speech,
        };
      });

      setRows(reportRows);
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

  const columns: { key: string; label: string; width: number; render: (row: ReportRow) => string }[] = [
    { key: 'meeting', label: 'Meeting No', width: 88, render: (r) => `#${r.meeting_number}` },
    { key: 'date', label: 'Date', width: 108, render: (r) => formatDate(r.meeting_date) },
    { key: 'timer', label: 'Timer', width: 120, render: (r) => cell(r.timer_name) },
    { key: 'prepared', label: 'Prepared', width: 72, render: (r) => countCell(r.prepared_speaker_count) },
    { key: 'evaluator', label: 'Evaluator', width: 72, render: (r) => countCell(r.evaluator_count) },
    { key: 'tt', label: 'Table Topics', width: 88, render: (r) => countCell(r.table_topic_speaker_count) },
    { key: 'edu', label: 'Educational', width: 88, render: (r) => countCell(r.educational_speaker_count) },
  ];

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
        ) : rows.length === 0 ? (
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
          <View style={styles.tableSection}>
            <Text style={[styles.resultCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {rows.length} meeting{rows.length !== 1 ? 's' : ''} found
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.table, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.tableHeader, { borderBottomColor: theme.colors.border }]}>
                  {columns.map((col) => (
                    <Text
                      key={col.key}
                      style={[styles.tableHeaderCell, { width: col.width, color: theme.colors.text }]}
                      maxFontSizeMultiplier={1.2}
                    >
                      {col.label}
                    </Text>
                  ))}
                </View>
                {rows.map((row, index) => {
                  const isLast = index === rows.length - 1;
                  return (
                    <TouchableOpacity
                      key={row.meetingId}
                      style={[
                        styles.tableRow,
                        !isLast && {
                          borderBottomColor: theme.colors.border,
                          borderBottomWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      onPress={() =>
                        router.push({ pathname: '/timer-report-details', params: { meetingId: row.meetingId } })
                      }
                      activeOpacity={0.6}
                    >
                      {columns.map((col) => (
                        <Text
                          key={col.key}
                          style={[styles.tableCell, { width: col.width, color: theme.colors.text }]}
                          numberOfLines={col.key === 'timer' ? 2 : 1}
                          maxFontSizeMultiplier={1.2}
                        >
                          {col.render(row)}
                        </Text>
                      ))}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
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
  tableSection: { paddingHorizontal: 16 },
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
    fontSize: 12,
    fontWeight: '700',
    paddingRight: 8,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  tableCell: {
    fontSize: 13,
    fontWeight: '400',
    paddingRight: 8,
  },
  bottomSpacing: { height: 40 },
});

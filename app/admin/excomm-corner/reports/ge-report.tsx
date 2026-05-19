import { useState, useEffect, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { computeGeRatingSummary, formatGeStarRating, type GeOverallRatingLabel } from '@/lib/generalEvaluatorRating';
import { GeFiveStarRow } from '@/components/GeFiveStarRow';
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
  general_evaluator_name: string | null;
  star_rating: number | null;
  rating_label: GeOverallRatingLabel | null;
};

type TableColumn = {
  key: string;
  label: string;
  width: number;
  render: (row: ReportRow) => ReactNode;
};

const cell = (value: string | null | undefined, fallback = '—') => {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

export default function GEReport() {
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
          app_meeting_ge (
            evaluator_user_id,
            evaluation_data,
            booking_status
          )
        `)
        .eq('club_id', user.currentClubId)
        .gte('meeting_date', toLocalDateStr(startDate))
        .lte('meeting_date', toLocalDateStr(endDate))
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        Alert.alert('Error', 'Failed to load meeting data');
        return;
      }

      const reportRows: ReportRow[] = (data || []).map((meeting: any) => {
        let generalEvaluatorName: string | null = null;
        let evaluatorUserId: string | null = null;

        if (Array.isArray(meeting.app_meeting_roles_management)) {
          const geRole = meeting.app_meeting_roles_management.find(
            (role: any) => role.role_name === 'General Evaluator'
          );
          if (geRole?.assigned_user_id && geRole.app_user_profiles?.full_name) {
            evaluatorUserId = geRole.assigned_user_id;
            generalEvaluatorName = geRole.app_user_profiles.full_name.trim();
          }
        }

        let starRating: number | null = null;
        let ratingLabel: GeOverallRatingLabel | null = null;
        if (Array.isArray(meeting.app_meeting_ge)) {
          const geRows = meeting.app_meeting_ge as {
            evaluator_user_id?: string;
            evaluation_data?: unknown;
            booking_status?: string;
          }[];
          const match =
            (evaluatorUserId
              ? geRows.find((g) => g.evaluator_user_id === evaluatorUserId)
              : null) ||
            geRows.find((g) => g.booking_status === 'booked') ||
            geRows[0];
          if (match?.evaluation_data) {
            const summary = computeGeRatingSummary(match.evaluation_data);
            if (summary) {
              starRating = summary.stars;
              ratingLabel = summary.label;
            }
          }
        }

        return {
          meetingId: meeting.id,
          meeting_number: meeting.meeting_number,
          meeting_date: meeting.meeting_date,
          general_evaluator_name: generalEvaluatorName,
          star_rating: starRating,
          rating_label: ratingLabel,
        };
      });

      setRows(reportRows);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred');
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

  const columns: TableColumn[] = [
    {
      key: 'meeting',
      label: 'Meeting No',
      width: 88,
      render: (r) => (
        <Text style={[styles.tableCellText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
          #{r.meeting_number}
        </Text>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      width: 108,
      render: (r) => (
        <Text style={[styles.tableCellText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
          {formatDate(r.meeting_date)}
        </Text>
      ),
    },
    {
      key: 'ge',
      label: 'General Evaluator',
      width: 132,
      render: (r) => (
        <Text style={[styles.tableCellText, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {cell(r.general_evaluator_name)}
        </Text>
      ),
    },
    {
      key: 'stars',
      label: 'Stars',
      width: 118,
      render: (r) =>
        r.star_rating != null && r.star_rating > 0 ? (
          <View style={styles.starsCell}>
            {r.rating_label ? (
              <Text style={[styles.ratingLabelText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                {r.rating_label}
              </Text>
            ) : null}
            <GeFiveStarRow rating={r.star_rating} size={14} />
          </View>
        ) : (
          <Text style={[styles.tableCellText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            —
          </Text>
        ),
    },
    {
      key: 'rating',
      label: 'Rating',
      width: 72,
      render: (r) =>
        r.star_rating != null && r.star_rating > 0 ? (
          <View style={[styles.ratingPill, { borderColor: theme.colors.primary + '55', backgroundColor: theme.colors.primary + '12' }]}>
            <Text style={[styles.ratingPillText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>
              {formatGeStarRating(r.star_rating)}
            </Text>
          </View>
        ) : (
          <Text style={[styles.tableCellText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
            —
          </Text>
        ),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          General Evaluator Report
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
            <Text
              style={[styles.filterButtonText, { color: timeFilter === '3months' ? '#ffffff' : theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
            >
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
            <Text
              style={[styles.filterButtonText, { color: timeFilter === '6months' ? '#ffffff' : theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
            >
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
        ) : rows.length === 0 ? (
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
                        router.push({ pathname: '/general-evaluator-report', params: { meetingId: row.meetingId } })
                      }
                      activeOpacity={0.6}
                    >
                      {columns.map((col) => (
                        <View key={col.key} style={[styles.tableCell, { width: col.width }]}>
                          {col.render(row)}
                        </View>
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
    paddingRight: 8,
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 13,
    fontWeight: '400',
  },
  starsCell: {
    gap: 4,
  },
  ratingLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ratingPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  ratingPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomSpacing: { height: 40 },
});

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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

type ReportRow = {
  meetingId: string;
  meeting_number: number;
  meeting_date: string;
  grammarian_name: string | null;
  word_of_the_day: string | null;
  quote_of_the_day: string | null;
  idiom_of_the_day: string | null;
  wotd_usage_count: number;
};

const cell = (value: string | null | undefined, fallback = '—') => {
  const v = typeof value === 'string' ? value.trim() : value;
  if (v === null || v === undefined || v === '') return fallback;
  return String(v);
};

export default function GrammarianReport() {
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

      const [meetingsRes, rolesRes, wordsRes, quotesRes, idiomsRes, usageRes] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select('id, meeting_number, meeting_date')
          .eq('club_id', user.currentClubId)
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr)
          .order('meeting_date', { ascending: false }),
        supabase
          .from('app_meeting_roles_management')
          .select('meeting_id, assigned_user_id, booking_status, app_user_profiles(full_name)')
          .eq('club_id', user.currentClubId)
          .eq('role_name', 'Grammarian'),
        supabase
          .from('grammarian_word_of_the_day')
          .select('meeting_id, word, is_published')
          .eq('club_id', user.currentClubId),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('meeting_id, quote, is_published')
          .eq('club_id', user.currentClubId),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('meeting_id, idiom, is_published')
          .eq('club_id', user.currentClubId),
        supabase
          .from('grammarian_word_of_the_day_member_usage')
          .select('usage_count, grammarian_word_of_the_day!inner(meeting_id, club_id)')
          .eq('grammarian_word_of_the_day.club_id', user.currentClubId),
      ]);

      if (meetingsRes.error) {
        console.error('Error loading meetings:', meetingsRes.error);
        return;
      }

      const meetingIds = new Set((meetingsRes.data || []).map((m) => m.id));

      const pickPublishedText = (
        items: { meeting_id: string; is_published?: boolean | null; [key: string]: unknown }[],
        field: string
      ) => {
        const map = new Map<string, string>();
        for (const row of items) {
          if (!meetingIds.has(row.meeting_id)) continue;
          const raw = row[field];
          const text = typeof raw === 'string' ? raw.trim() : '';
          if (!text) continue;
          const existing = map.get(row.meeting_id);
          if (!existing || row.is_published) {
            map.set(row.meeting_id, text);
          }
        }
        return map;
      };

      const wordsByMeeting = pickPublishedText(wordsRes.data || [], 'word');
      const quotesByMeeting = pickPublishedText(quotesRes.data || [], 'quote');
      const idiomsByMeeting = pickPublishedText(idiomsRes.data || [], 'idiom');

      const usageByMeeting = new Map<string, number>();
      (usageRes.data || []).forEach((row: any) => {
        const meetingId = row.grammarian_word_of_the_day?.meeting_id;
        if (!meetingId || !meetingIds.has(meetingId)) return;
        const count = typeof row.usage_count === 'number' ? row.usage_count : 0;
        usageByMeeting.set(meetingId, (usageByMeeting.get(meetingId) || 0) + count);
      });

      const grammarianByMeeting = new Map<string, string>();
      for (const role of (rolesRes.data || []) as any[]) {
        if (!meetingIds.has(role.meeting_id)) continue;
        const name = role.app_user_profiles?.full_name?.trim();
        if (!name) continue;
        if (role.booking_status === 'booked' && role.assigned_user_id) {
          grammarianByMeeting.set(role.meeting_id, name);
        } else if (!grammarianByMeeting.has(role.meeting_id)) {
          grammarianByMeeting.set(role.meeting_id, name);
        }
      }

      const reportRows: ReportRow[] = (meetingsRes.data || []).map((meeting) => ({
        meetingId: meeting.id,
        meeting_number: meeting.meeting_number,
        meeting_date: meeting.meeting_date,
        grammarian_name: grammarianByMeeting.get(meeting.id) ?? null,
        word_of_the_day: wordsByMeeting.get(meeting.id) ?? null,
        quote_of_the_day: quotesByMeeting.get(meeting.id) ?? null,
        idiom_of_the_day: idiomsByMeeting.get(meeting.id) ?? null,
        wotd_usage_count: usageByMeeting.get(meeting.id) ?? 0,
      }));

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
    { key: 'grammarian', label: 'Grammarian', width: 120, render: (r) => cell(r.grammarian_name) },
    { key: 'word', label: 'Word of the Day', width: 140, render: (r) => cell(r.word_of_the_day) },
    { key: 'quote', label: 'Quote of the Day', width: 140, render: (r) => cell(r.quote_of_the_day) },
    { key: 'idiom', label: 'Idiom of the Day', width: 140, render: (r) => cell(r.idiom_of_the_day) },
    {
      key: 'usage',
      label: 'WOTD Usage',
      width: 72,
      render: (r) => (r.wotd_usage_count > 0 ? String(r.wotd_usage_count) : '—'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Grammarian Report
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
                      onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: row.meetingId } })}
                      activeOpacity={0.6}
                    >
                      {columns.map((col) => (
                        <Text
                          key={col.key}
                          style={[styles.tableCell, { width: col.width, color: theme.colors.text }]}
                          numberOfLines={col.key === 'word' || col.key === 'quote' || col.key === 'idiom' ? 2 : 1}
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

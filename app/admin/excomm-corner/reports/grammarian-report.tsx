import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, User, BookOpen, Quote, Lightbulb, ThumbsUp, TrendingUp, BarChart2, ChevronRight } from 'lucide-react-native';

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
  grammarian_name: string | null;
  has_word: boolean;
  has_quote: boolean;
  has_idiom: boolean;
  has_good_usage: boolean;
  has_improvements: boolean;
  has_stats: boolean;
};

export default function GrammarianReport() {
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

      const startStr = toLocalDateStr(startDate);
      const endStr = toLocalDateStr(endDate);

      const [meetingsRes, rolesRes, wordsRes, quotesRes, idiomsRes, goodUsageRes, improvementsRes, statsRes] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select('id, meeting_number, meeting_date')
          .eq('club_id', user.currentClubId)
          .gte('meeting_date', startStr)
          .lte('meeting_date', endStr)
          .order('meeting_date', { ascending: false }),
        supabase
          .from('app_meeting_roles_management')
          .select('meeting_id, role_name, app_user_profiles(full_name)')
          .eq('club_id', user.currentClubId)
          .eq('role_name', 'Grammarian'),
        supabase
          .from('grammarian_word_of_the_day')
          .select('meeting_id, is_published')
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('grammarian_quote_of_the_day')
          .select('meeting_id, is_published')
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('grammarian_idiom_of_the_day')
          .select('meeting_id, is_published')
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('grammarian_live_good_usage')
          .select('meeting_id, is_published')
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('grammarian_live_improvements')
          .select('meeting_id, is_published')
          .eq('club_id', user.currentClubId)
          .eq('is_published', true),
        supabase
          .from('grammarian_word_of_the_day_member_usage')
          .select('grammarian_word_of_the_day(meeting_id)'),
      ]);

      if (meetingsRes.error) {
        console.error('Error loading meetings:', meetingsRes.error);
        return;
      }

      const wordMeetingIds = new Set((wordsRes.data || []).map((r: any) => r.meeting_id));
      const quoteMeetingIds = new Set((quotesRes.data || []).map((r: any) => r.meeting_id));
      const idiomMeetingIds = new Set((idiomsRes.data || []).map((r: any) => r.meeting_id));
      const goodUsageMeetingIds = new Set((goodUsageRes.data || []).map((r: any) => r.meeting_id));
      const improvementsMeetingIds = new Set((improvementsRes.data || []).map((r: any) => r.meeting_id));
      const statsMeetingIds = new Set((statsRes.data || []).map((r: any) => (r.grammarian_word_of_the_day as any)?.meeting_id).filter(Boolean));

      const rolesByMeeting = new Map<string, string | null>();
      for (const role of (rolesRes.data || []) as any[]) {
        rolesByMeeting.set(role.meeting_id, role.app_user_profiles?.full_name ?? null);
      }

      const formattedMeetings: MeetingData[] = (meetingsRes.data || []).map((meeting: any) => ({
        id: meeting.id,
        meeting_number: meeting.meeting_number,
        meeting_date: meeting.meeting_date,
        grammarian_name: rolesByMeeting.get(meeting.id) ?? null,
        has_word: wordMeetingIds.has(meeting.id),
        has_quote: quoteMeetingIds.has(meeting.id),
        has_idiom: idiomMeetingIds.has(meeting.id),
        has_good_usage: goodUsageMeetingIds.has(meeting.id),
        has_improvements: improvementsMeetingIds.has(meeting.id),
        has_stats: statsMeetingIds.has(meeting.id),
      }));

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

  const completionScore = (meeting: MeetingData): number => {
    const flags = [
      meeting.has_word,
      meeting.has_quote,
      meeting.has_idiom,
      meeting.has_good_usage,
      meeting.has_improvements,
      meeting.has_stats,
    ];
    return flags.filter(Boolean).length;
  };

  const indicators = [
    { key: 'has_word', label: 'Word', icon: BookOpen },
    { key: 'has_quote', label: 'Quote', icon: Quote },
    { key: 'has_idiom', label: 'Idiom', icon: Lightbulb },
    { key: 'has_good_usage', label: 'Good Usage', icon: ThumbsUp },
    { key: 'has_improvements', label: 'Improvements', icon: TrendingUp },
    { key: 'has_stats', label: 'Stats', icon: BarChart2 },
  ] as const;

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

            {meetings.map((meeting) => {
              const score = completionScore(meeting);
              const total = 6;
              const pct = Math.round((score / total) * 100);

              return (
                <TouchableOpacity
                  key={meeting.id}
                  style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting.id } })}
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

                  <View style={[styles.grammarianRow, { borderTopColor: theme.colors.border }]}>
                    <View style={[styles.grammarianIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                      <User size={14} color={theme.colors.primary} />
                    </View>
                    <View style={styles.grammarianInfo}>
                      <Text style={[styles.grammarianLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Grammarian
                      </Text>
                      <Text style={[styles.grammarianName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {meeting.grammarian_name || 'Not assigned'}
                      </Text>
                    </View>
                    <View style={styles.completionBadge}>
                      <Text style={[styles.completionText, { color: pct === 100 ? '#16a34a' : pct > 0 ? theme.colors.primary : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {score}/{total}
                      </Text>
                      <Text style={[styles.completionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        done
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.progressBarTrack, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${pct}%` as any,
                          backgroundColor: pct === 100 ? '#16a34a' : theme.colors.primary,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.indicatorsGrid}>
                    {indicators.map(({ key, label, icon: Icon }) => {
                      const active = meeting[key as keyof MeetingData] as boolean;
                      return (
                        <View
                          key={key}
                          style={[
                            styles.indicatorChip,
                            {
                              backgroundColor: active
                                ? theme.colors.primary + '12'
                                : theme.colors.background,
                              borderColor: active
                                ? theme.colors.primary + '40'
                                : theme.colors.border,
                            },
                          ]}
                        >
                          <Icon
                            size={12}
                            color={active ? theme.colors.primary : theme.colors.textSecondary}
                          />
                          <Text
                            style={[
                              styles.indicatorLabel,
                              { color: active ? theme.colors.primary : theme.colors.textSecondary },
                            ]}
                            maxFontSizeMultiplier={1.3}
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
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
  grammarianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 0.5,
    marginBottom: 12,
  },
  grammarianIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  grammarianInfo: {
    flex: 1,
  },
  grammarianLabel: {
    fontSize: 11,
    marginBottom: 1,
  },
  grammarianName: {
    fontSize: 14,
    fontWeight: '600',
  },
  completionBadge: {
    alignItems: 'center',
  },
  completionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  completionLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  indicatorLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
});

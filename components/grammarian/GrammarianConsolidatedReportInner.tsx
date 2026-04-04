import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, User, CheckCircle2, AlertTriangle, TrendingUp, X, BookOpen } from 'lucide-react-native';
import { Image } from 'react-native';

export type GrammarianExportMeta = {
  clubName: string;
  meetingNumber: string | null;
  meetingDate: string | null;
};

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  club_info_banner_color?: string;
  datetime_banner_color?: string;
}

interface AssignedGrammarian {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface ClubInfo {
  id: string;
  club_name: string;
  club_number: string | null;
  district: string | null;
  division: string | null;
  area: string | null;
}

interface DailyElements {
  word_of_the_day: string | null;
  idiom_of_the_day: string | null;
  phrase_of_the_day: string | null;
  quote_of_the_day: string | null;
}

interface LiveGoodUsage {
  id: string;
  observation: string;
  sequence_order: number;
  created_at: string;
}

interface LiveImprovement {
  id: string;
  incorrect_usage: string;
  correct_usage: string;
  sequence_order: number;
  created_at: string;
}

interface MemberUsageStats {
  id?: string;
  member_name: string;
  usage_count: number;
}

function isGrammarianSummaryVisibilityTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return error.code === '42P01' || msg.includes('grammarian_meeting_summary_visibility') || msg.includes('does not exist');
}

export type GrammarianConsolidatedReportInnerProps = {
  meetingId: string | undefined;
  /** `embedded` = Grammarian Summary → Reports tab (inside parent ScrollView). */
  variant?: 'standalone' | 'embedded';
  /** Web PDF capture target id on the printable root `View`. */
  contentNativeID?: string;
  /** Standalone screen only: metadata for export filename. */
  onExportMeta?: (meta: GrammarianExportMeta | null) => void;
};

export function GrammarianConsolidatedReportInner({
  meetingId,
  variant = 'standalone',
  contentNativeID,
  onExportMeta,
}: GrammarianConsolidatedReportInnerProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const embedded = variant === 'embedded';

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [assignedGrammarian, setAssignedGrammarian] = useState<AssignedGrammarian | null>(null);
  const [dailyElements, setDailyElements] = useState<DailyElements>({
    word_of_the_day: null,
    idiom_of_the_day: null,
    phrase_of_the_day: null,
    quote_of_the_day: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [liveGoodUsage, setLiveGoodUsage] = useState<LiveGoodUsage[]>([]);
  const [liveImprovements, setLiveImprovements] = useState<LiveImprovement[]>([]);
  const [wordMemberStats, setWordMemberStats] = useState<MemberUsageStats[]>([]);
  const [idiomMemberStats, setIdiomMemberStats] = useState<MemberUsageStats[]>([]);
  const [quoteMemberStats, setQuoteMemberStats] = useState<MemberUsageStats[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  /** When "Show report to member" is off — no report body for anyone (including Grammarian/VPE). */
  const [reportWithheld, setReportWithheld] = useState(false);

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      setReportWithheld(false);
      return;
    }
    try {
      setReportWithheld(false);

      const { data: visEarly, error: visEarlyErr } = await supabase
        .from('grammarian_meeting_summary_visibility')
        .select('summary_visible_to_members')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (visEarlyErr && !isGrammarianSummaryVisibilityTableMissing(visEarlyErr)) {
        console.error('grammarian_meeting_summary_visibility:', visEarlyErr);
      } else if (visEarly && visEarly.summary_visible_to_members === false) {
        setReportWithheld(true);
        setMeeting(null);
        setClubInfo(null);
        setAssignedGrammarian(null);
        setLiveGoodUsage([]);
        setLiveImprovements([]);
        setWordMemberStats([]);
        setIdiomMemberStats([]);
        setQuoteMemberStats([]);
        setPublishedAt(null);
        setIsLoading(false);
        return;
      }

      const loadMeeting = async () => {
        const { data } = await supabase
          .from('app_club_meeting')
          .select(
            'id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, club_info_banner_color, datetime_banner_color'
          )
          .eq('id', meetingId)
          .single();
        if (data) setMeeting(data);
      };

      const loadClubInfoLocal = async () => {
        if (!user?.currentClubId) return;
        const { data } = await supabase
          .from('club_profiles')
          .select('id, club_name, club_number, district, division, area')
          .eq('club_id', user.currentClubId)
          .single();
        if (data) setClubInfo({ ...data, id: data.id || user.currentClubId });
      };

      const loadAssignedGrammarianLocal = async () => {
        const { data } = await supabase
          .from('app_meeting_roles_management')
          .select(
            `
            assigned_user_id,
            app_user_profiles (
              id,
              full_name,
              email,
              avatar_url
            )
          `
          )
          .eq('meeting_id', meetingId)
          .ilike('role_name', '%grammarian%')
          .eq('booking_status', 'booked')
          .not('assigned_user_id', 'is', null)
          .maybeSingle();

        if (data && (data as any).app_user_profiles) {
          const profile = (data as any).app_user_profiles;
          setAssignedGrammarian({
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            avatar_url: profile.avatar_url,
          });
        }
      };

      const loadDailyElementsLocal = async () => {
        const [wordResult, idiomResult, quoteResult] = await Promise.all([
          supabase.from('grammarian_word_of_the_day').select('word').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle(),
          supabase.from('grammarian_idiom_of_the_day').select('idiom').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle(),
          supabase.from('grammarian_quote_of_the_day').select('quote').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle(),
        ]);

        const elements: DailyElements = {
          word_of_the_day: wordResult.data?.word || null,
          idiom_of_the_day: idiomResult.data?.idiom || null,
          phrase_of_the_day: null,
          quote_of_the_day: quoteResult.data?.quote || null,
        };

        if (!elements.word_of_the_day && !elements.idiom_of_the_day && !elements.quote_of_the_day) {
          const { data } = await supabase
            .from('app_grammarian_daily_elements')
            .select('word_of_the_day, idiom_of_the_day, phrase_of_the_day, quote_of_the_day')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          if (data) {
            setDailyElements(data);
            return;
          }
        }
        setDailyElements(elements);
      };

      const loadPublishedObservationsLocal = async () => {
        const [goodUsageResult, improvementsResult] = await Promise.all([
          supabase
            .from('grammarian_live_good_usage')
            .select('id, observation, sequence_order, created_at')
            .eq('meeting_id', meetingId)
            .eq('is_published', true)
            .order('sequence_order', { ascending: true }),
          supabase
            .from('grammarian_live_improvements')
            .select('id, incorrect_usage, correct_usage, sequence_order, created_at')
            .eq('meeting_id', meetingId)
            .eq('is_published', true)
            .order('sequence_order', { ascending: true }),
        ]);

        if (goodUsageResult.data) {
          setLiveGoodUsage(goodUsageResult.data);
          if (goodUsageResult.data.length > 0) {
            const latest = goodUsageResult.data.reduce((a, b) =>
              new Date(a.created_at) > new Date(b.created_at) ? a : b
            );
            setPublishedAt(latest.created_at);
          }
        } else {
          setLiveGoodUsage([]);
        }
        if (improvementsResult.data) {
          setLiveImprovements(improvementsResult.data);
        } else {
          setLiveImprovements([]);
        }
      };

      const loadMemberUsageStatsLocal = async () => {
        const [wordStats, idiomStats, quoteStats] = await Promise.all([
          supabase
            .from('grammarian_word_of_the_day_member_usage')
            .select(
              'id, usage_count, member_name_manual, app_user_profiles (full_name), app_meeting_visiting_guests (display_name), grammarian_word_of_the_day!inner (meeting_id, is_published)'
            )
            .eq('grammarian_word_of_the_day.meeting_id', meetingId)
            .eq('grammarian_word_of_the_day.is_published', true)
            .gt('usage_count', 0),
          supabase
            .from('grammarian_idiom_of_the_day_member_usage')
            .select('usage_count, app_user_profiles!inner (full_name), grammarian_idiom_of_the_day!inner (meeting_id, is_published)')
            .eq('grammarian_idiom_of_the_day.meeting_id', meetingId)
            .eq('grammarian_idiom_of_the_day.is_published', true)
            .gt('usage_count', 0),
          supabase
            .from('grammarian_quote_of_the_day_member_usage')
            .select('usage_count, app_user_profiles!inner (full_name), grammarian_quote_of_the_day!inner (meeting_id, is_published)')
            .eq('grammarian_quote_of_the_day.meeting_id', meetingId)
            .eq('grammarian_quote_of_the_day.is_published', true)
            .gt('usage_count', 0),
        ]);

        if (wordStats.data) {
          setWordMemberStats(
            wordStats.data.map((item: any) => {
              const profileName = item.app_user_profiles?.full_name?.trim();
              const guestName = item.app_meeting_visiting_guests?.display_name?.trim();
              const manual = item.member_name_manual?.trim();
              const member_name = profileName || guestName || manual || 'Guest';
              return { id: item.id as string, member_name, usage_count: item.usage_count as number };
            })
          );
        }
        if (idiomStats.data)
          setIdiomMemberStats(idiomStats.data.map((item: any) => ({ member_name: item.app_user_profiles.full_name, usage_count: item.usage_count })));
        if (quoteStats.data)
          setQuoteMemberStats(quoteStats.data.map((item: any) => ({ member_name: item.app_user_profiles.full_name, usage_count: item.usage_count })));
      };

      await Promise.all([
        loadMeeting(),
        loadClubInfoLocal(),
        loadAssignedGrammarianLocal(),
        loadDailyElementsLocal(),
        loadPublishedObservationsLocal(),
        loadMemberUsageStatsLocal(),
      ]);
    } catch (error) {
      console.error('Error loading grammarian consolidated report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      setIsLoading(true);
      setReportWithheld(false);
      void loadData();
    } else {
      setIsLoading(false);
      setReportWithheld(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when meeting or club context changes
  }, [meetingId, user?.currentClubId]);

  useEffect(() => {
    if (!onExportMeta || embedded) return;
    if (reportWithheld) {
      onExportMeta(null);
      return;
    }
    if (!isLoading && meeting && clubInfo) {
      onExportMeta({
        clubName: clubInfo.club_name,
        meetingNumber: meeting.meeting_number,
        meetingDate: meeting.meeting_date,
      });
    } else if (!isLoading && !meeting) {
      onExportMeta(null);
    }
  }, [isLoading, meeting, clubInfo, onExportMeta, embedded, reportWithheld]);

  useEffect(() => {
    if (!onExportMeta || embedded) return undefined;
    return () => {
      onExportMeta(null);
    };
  }, [onExportMeta, embedded]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const formatTimeShort = (timeStr: string | null) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  const chipColors = [
    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
    { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534' },
    { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E' },
    { bg: '#FDF2F8', border: '#FBCFE8', text: '#9D174D' },
    { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' },
    { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
    { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412' },
    { bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E' },
  ];

  if (!meetingId) {
    if (embedded) return null;
    return (
      <View style={styles.centeredBlock}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Meeting not found</Text>
        <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: theme.colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingWrap, embedded && styles.loadingWrapEmbedded]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary, marginTop: 10 }]}>Loading report…</Text>
      </View>
    );
  }

  if (reportWithheld) {
    const inner = (
      <View
        style={[styles.withheldBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
      >
        <Text style={[styles.withheldTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
          Report is yet to be published..
        </Text>
      </View>
    );
    if (embedded) {
      return <View style={local.embeddedOuter}>{inner}</View>;
    }
    return <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>{inner}</View>;
  }

  if (!meeting) {
    if (embedded) {
      return (
        <View style={[local.embeddedCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Could not load this meeting.</Text>
        </View>
      );
    }
    return (
      <View style={styles.centeredBlock}>
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>Meeting not found</Text>
        <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: theme.colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalWordUses = wordMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const totalIdiomUses = idiomMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const totalQuoteUses = quoteMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const hasStats = totalWordUses > 0 || totalIdiomUses > 0 || totalQuoteUses > 0;
  const hasReportSections = liveGoodUsage.length > 0 || liveImprovements.length > 0 || hasStats;
  const bannerColor1 = meeting.club_info_banner_color || '#0ea5e9';
  const bannerColor2 = meeting.datetime_banner_color || '#f97316';

  const reportInner = (
    <View
      nativeID={contentNativeID}
      style={[styles.reportContent, { backgroundColor: embedded ? theme.colors.background : '#f8f9fa' }]}
    >
      <View style={[styles.clubBanner, { backgroundColor: bannerColor1 }]}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerClubName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>
            {clubInfo?.club_name || 'Club Name'}
          </Text>
          <View style={styles.bannerMetaRow}>
            {(clubInfo as any)?.district && (
              <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>
                District {(clubInfo as any).district}
              </Text>
            )}
            {(clubInfo as any)?.division && (
              <>
                <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>
                  |
                </Text>
                <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>
                  Division {(clubInfo as any).division}
                </Text>
              </>
            )}
            {(clubInfo as any)?.area && (
              <>
                <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>
                  |
                </Text>
                <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>
                  Area {(clubInfo as any).area}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.meetingBanner, { backgroundColor: bannerColor2 }]}>
        <View style={styles.bannerChips}>
          <Calendar size={16} color="#ffffff" />
          <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
            {formatDateShort(meeting.meeting_date)}
          </Text>
          <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>
            |
          </Text>
          <Clock size={16} color="#ffffff" />
          <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
            {formatTimeShort(meeting.meeting_start_time)} - {formatTimeShort(meeting.meeting_end_time)}
          </Text>
          <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>
            |
          </Text>
          <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
            Meeting #{meeting.meeting_number}
          </Text>
        </View>
      </View>

      <View style={styles.reportBody}>
        {liveGoodUsage.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#059669' + '18' }]}>
                <CheckCircle2 size={16} color="#059669" />
              </View>
              <Text style={styles.sectionTitle}>GOOD USAGE</Text>
            </View>
            <View style={styles.chipWrap}>
              {liveGoodUsage.map((item, index) => {
                const c = chipColors[index % chipColors.length];
                return (
                  <View key={item.id} style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <Text style={[styles.chipText, { color: c.text }]} maxFontSizeMultiplier={1.3}>
                      {item.observation}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {liveImprovements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#D97706' + '18' }]}>
                <AlertTriangle size={16} color="#D97706" />
              </View>
              <Text style={styles.sectionTitle}>IMPROVEMENT AREAS</Text>
            </View>
            <View style={styles.improvGrid}>
              {liveImprovements.map((item, index) => (
                <View key={item.id} style={styles.improvCard}>
                  <View style={[styles.improvBadge, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.improvBadgeText} maxFontSizeMultiplier={1.2}>
                      #{index + 1}
                    </Text>
                  </View>
                  <View style={styles.incorrectRow}>
                    <X size={11} color="#DC2626" />
                    <Text style={styles.incorrectText} maxFontSizeMultiplier={1.2}>
                      {item.incorrect_usage}
                    </Text>
                  </View>
                  <View style={styles.correctRow}>
                    <CheckCircle2 size={11} color="#16A34A" />
                    <Text style={styles.correctText} maxFontSizeMultiplier={1.2}>
                      {item.correct_usage}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {hasStats && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#2563EB' + '18' }]}>
                <TrendingUp size={16} color="#2563EB" />
              </View>
              <Text style={styles.sectionTitle}>USAGE STATS</Text>
            </View>
            <View style={styles.statsGrid}>
              {dailyElements.word_of_the_day && totalWordUses > 0 && (
                <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.statCardLabel, { color: '#1E40AF' }]} maxFontSizeMultiplier={1.2}>
                    WORD OF THE DAY
                  </Text>
                  <Text style={[styles.statCardValue, { color: '#1E3A8A' }]} maxFontSizeMultiplier={1.2}>
                    {dailyElements.word_of_the_day}
                  </Text>
                  <View style={[styles.statCardCount, { backgroundColor: '#2563EB' }]}>
                    <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>
                      {totalWordUses} uses
                    </Text>
                  </View>
                  {wordMemberStats.map((stat, i) => (
                    <View key={stat.id ?? `${stat.member_name}-${i}`} style={styles.statMemberRow}>
                      <User size={11} color="#2563EB" />
                      <Text style={[styles.statMemberName, { color: '#1e3a8a' }]} maxFontSizeMultiplier={1.2}>
                        {stat.member_name}
                      </Text>
                      <View style={[styles.statMemberBadge, { backgroundColor: '#2563EB' }]}>
                        <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>
                          {stat.usage_count}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {dailyElements.quote_of_the_day && totalQuoteUses > 0 && (
                <View style={[styles.statCard, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}>
                  <Text style={[styles.statCardLabel, { color: '#854D0E' }]} maxFontSizeMultiplier={1.2}>
                    QUOTE OF THE DAY
                  </Text>
                  <Text style={[styles.statCardValue, { color: '#713F12', fontStyle: 'italic' }]} maxFontSizeMultiplier={1.2}>
                    "{dailyElements.quote_of_the_day}"
                  </Text>
                  <View style={[styles.statCardCount, { backgroundColor: '#EAB308' }]}>
                    <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>
                      {totalQuoteUses} uses
                    </Text>
                  </View>
                  {quoteMemberStats.map((stat, i) => (
                    <View key={i} style={styles.statMemberRow}>
                      <User size={11} color="#CA8A04" />
                      <Text style={[styles.statMemberName, { color: '#713F12' }]} maxFontSizeMultiplier={1.2}>
                        {stat.member_name}
                      </Text>
                      <View style={[styles.statMemberBadge, { backgroundColor: '#EAB308' }]}>
                        <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>
                          {stat.usage_count}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {dailyElements.idiom_of_the_day && totalIdiomUses > 0 && (
                <View style={[styles.statCard, { backgroundColor: '#F8F9FA', borderColor: '#DEE2E6' }]}>
                  <Text style={[styles.statCardLabel, { color: '#495057' }]} maxFontSizeMultiplier={1.2}>
                    IDIOM OF THE DAY
                  </Text>
                  <Text style={[styles.statCardValue, { color: '#212529' }]} maxFontSizeMultiplier={1.2}>
                    {dailyElements.idiom_of_the_day}
                  </Text>
                  <View style={[styles.statCardCount, { backgroundColor: '#6C757D' }]}>
                    <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>
                      {totalIdiomUses} uses
                    </Text>
                  </View>
                  {idiomMemberStats.map((stat, i) => (
                    <View key={i} style={styles.statMemberRow}>
                      <User size={11} color="#6C757D" />
                      <Text style={[styles.statMemberName, { color: '#343A40' }]} maxFontSizeMultiplier={1.2}>
                        {stat.member_name}
                      </Text>
                      <View style={[styles.statMemberBadge, { backgroundColor: '#6C757D' }]}>
                        <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>
                          {stat.usage_count}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {embedded && !hasReportSections && (
          <View style={[styles.section, { alignItems: 'center', paddingVertical: 22 }]}>
            <BookOpen size={32} color="#94a3b8" />
            <Text style={[styles.emptyEmbedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
              No published report sections yet
            </Text>
            <Text style={[styles.emptyEmbedSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Good usage, opportunity notes, or usage stats appear here once published from Grammarian Corner.
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.footer, { backgroundColor: bannerColor1 }]}>
        <View style={styles.footerLeft}>
          {assignedGrammarian?.avatar_url ? (
            <Image source={{ uri: assignedGrammarian.avatar_url }} style={styles.footerAvatar} />
          ) : (
            <View style={[styles.footerAvatar, styles.footerAvatarFallback]}>
              <User size={18} color="#ffffff" />
            </View>
          )}
          <View style={styles.footerInfo}>
            <Text style={styles.footerName} maxFontSizeMultiplier={1.2}>
              {assignedGrammarian?.full_name || 'Grammarian'}
            </Text>
            <Text style={styles.footerRole} maxFontSizeMultiplier={1.2}>
              Grammarian
            </Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerPublishedLabel} maxFontSizeMultiplier={1.2}>
            Published
          </Text>
          <Text style={styles.footerPublishedDate} maxFontSizeMultiplier={1.2}>
            {publishedAt ? formatDate(publishedAt) : formatDate(meeting.meeting_date)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (embedded) {
    return (
      <View
        style={[
          local.embeddedOuter,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
        ]}
      >
        {reportInner}
      </View>
    );
  }

  return reportInner;
}

const local = StyleSheet.create({
  embeddedOuter: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  embeddedCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
});

const styles = StyleSheet.create({
  withheldBox: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  withheldTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  centeredBlock: {
    flex: 1,
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  loadingWrap: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingWrapEmbedded: {
    minHeight: 120,
  },
  loadingText: { fontSize: 16, fontWeight: '500' },
  goBackBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  goBackBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  reportContent: {},

  clubBanner: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 20,
  },
  bannerContent: {
    gap: 6,
    alignItems: 'center',
  },
  bannerClubName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
    textAlign: 'center',
    flexShrink: 1,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  bannerMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
  bannerMetaSep: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },

  meetingBanner: {
    paddingHorizontal: Platform.OS === 'web' ? 16 : 24,
    paddingVertical: 16,
  },
  bannerChips: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bannerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  bannerSeparator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },

  reportBody: {
    padding: 16,
    gap: 0,
  },

  emptyEmbedTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyEmbedSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 8,
  },

  section: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#111827',
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  improvGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  improvCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 7,
  },
  improvBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  improvBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  incorrectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 6,
  },
  incorrectText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
    lineHeight: 16,
  },
  correctRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
  },
  correctText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#16A34A',
    lineHeight: 16,
  },

  statsGrid: { gap: 12 },
  statCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  statCardCount: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statCardCountText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statMemberName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  statMemberBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
  },
  statMemberCount: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  footerAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerInfo: { gap: 2 },
  footerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  footerRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  footerRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  footerPublishedLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footerPublishedDate: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, User, CheckCircle2, AlertTriangle, TrendingUp, X, Download } from 'lucide-react-native';
import { Image } from 'react-native';
import { exportAgendaToPDF } from '@/lib/pdfExportUtils';

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
  member_name: string;
  usage_count: number;
}

export default function GrammarianConsolidatedReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

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
  const [isExporting, setIsExporting] = useState(false);
  const [liveGoodUsage, setLiveGoodUsage] = useState<LiveGoodUsage[]>([]);
  const [liveImprovements, setLiveImprovements] = useState<LiveImprovement[]>([]);
  const [wordMemberStats, setWordMemberStats] = useState<MemberUsageStats[]>([]);
  const [idiomMemberStats, setIdiomMemberStats] = useState<MemberUsageStats[]>([]);
  const [quoteMemberStats, setQuoteMemberStats] = useState<MemberUsageStats[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    try {
      await Promise.all([
        loadMeeting(),
        loadClubInfo(),
        loadAssignedGrammarian(),
        loadDailyElements(),
        loadPublishedObservations(),
        loadMemberUsageStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;
    const { data } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, club_info_banner_color, datetime_banner_color')
      .eq('id', meetingId)
      .single();
    if (data) setMeeting(data);
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;
    const { data } = await supabase
      .from('club_profiles')
      .select('id, club_name, club_number, district, division, area')
      .eq('club_id', user.currentClubId)
      .single();
    if (data) setClubInfo({ ...data, id: data.id || user.currentClubId });
  };

  const loadAssignedGrammarian = async () => {
    if (!meetingId || !user?.currentClubId) return;
    const { data } = await supabase
      .from('app_meeting_roles_management')
      .select(`
        assigned_user_id,
        app_user_profiles (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
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

  const loadDailyElements = async () => {
    if (!meetingId) return;
    const [wordResult, idiomResult, quoteResult] = await Promise.all([
      supabase.from('grammarian_word_of_the_day').select('word').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle(),
      supabase.from('grammarian_idiom_of_the_day').select('idiom').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle(),
      supabase.from('grammarian_quote_of_the_day').select('quote').eq('meeting_id', meetingId).eq('is_published', true).maybeSingle()
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

  const loadPublishedObservations = async () => {
    if (!meetingId) return;
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
        .order('sequence_order', { ascending: true })
    ]);

    if (goodUsageResult.data) {
      setLiveGoodUsage(goodUsageResult.data);
      if (goodUsageResult.data.length > 0) {
        const latest = goodUsageResult.data.reduce((a, b) =>
          new Date(a.created_at) > new Date(b.created_at) ? a : b
        );
        setPublishedAt(latest.created_at);
      }
    }
    if (improvementsResult.data) setLiveImprovements(improvementsResult.data);
  };

  const loadMemberUsageStats = async () => {
    if (!meetingId) return;
    const [wordStats, idiomStats, quoteStats] = await Promise.all([
      supabase
        .from('grammarian_word_of_the_day_member_usage')
        .select('usage_count, app_user_profiles!inner (full_name), grammarian_word_of_the_day!inner (meeting_id, is_published)')
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
        .gt('usage_count', 0)
    ]);

    if (wordStats.data) setWordMemberStats(wordStats.data.map((item: any) => ({ member_name: item.app_user_profiles.full_name, usage_count: item.usage_count })));
    if (idiomStats.data) setIdiomMemberStats(idiomStats.data.map((item: any) => ({ member_name: item.app_user_profiles.full_name, usage_count: item.usage_count })));
    if (quoteStats.data) setQuoteMemberStats(quoteStats.data.map((item: any) => ({ member_name: item.app_user_profiles.full_name, usage_count: item.usage_count })));
  };

  const handleExportPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is available on the web version of this app.');
      return;
    }
    setIsExporting(true);
    try {
      const clubName = (clubInfo?.club_name || 'Club').replace(/[^a-z0-9]/gi, '_');
      const meetingNum = meeting?.meeting_number || 'X';
      const date = meeting?.meeting_date ? new Date(meeting.meeting_date).toISOString().split('T')[0] : 'date';
      const filename = `${clubName}_Meeting_${meetingNum}_Grammarian_Report_${date}.pdf`;
      await exportAgendaToPDF('grammarian-report-content', filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Export Failed', 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Meeting not found</Text>
          <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: theme.colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalWordUses = wordMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const totalIdiomUses = idiomMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const totalQuoteUses = quoteMemberStats.reduce((s, m) => s + m.usage_count, 0);
  const hasStats = totalWordUses > 0 || totalIdiomUses > 0 || totalQuoteUses > 0;
  const bannerColor1 = meeting.club_info_banner_color || '#0ea5e9';
  const bannerColor2 = meeting.datetime_banner_color || '#f97316';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Nav Header */}
      <View style={[styles.navHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Grammarian Review
        </Text>
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: theme.colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            onPress={handleExportPDF}
            disabled={isExporting}
          >
            <Download size={16} color="#ffffff" />
            <Text style={styles.downloadBtnText} maxFontSizeMultiplier={1.2}>
              {isExporting ? 'Exporting...' : 'PDF'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PDF-exportable content wrapper */}
        <View nativeID="grammarian-report-content" style={[styles.reportContent, { backgroundColor: '#f8f9fa' }]}>

          {/* Banner 1: Club Name + District/Division/Area */}
          <View style={[styles.clubBanner, { backgroundColor: bannerColor1 }]}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerClubName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>
                {clubInfo?.club_name || 'Club Name'}
              </Text>
              <View style={styles.bannerMetaRow}>
                {(clubInfo as any)?.district && (
                  <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>District {(clubInfo as any).district}</Text>
                )}
                {(clubInfo as any)?.division && (
                  <>
                    <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>|</Text>
                    <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>Division {(clubInfo as any).division}</Text>
                  </>
                )}
                {(clubInfo as any)?.area && (
                  <>
                    <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>|</Text>
                    <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>Area {(clubInfo as any).area}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Banner 2: Date / Time / Meeting Number */}
          <View style={[styles.meetingBanner, { backgroundColor: bannerColor2 }]}>
            <View style={styles.bannerChips}>
              <Calendar size={16} color="#ffffff" />
              <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>{formatDateShort(meeting.meeting_date)}</Text>
              <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>|</Text>
              <Clock size={16} color="#ffffff" />
              <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
                {formatTimeShort(meeting.meeting_start_time)} - {formatTimeShort(meeting.meeting_end_time)}
              </Text>
              <Text style={styles.bannerSeparator} maxFontSizeMultiplier={1.2}>|</Text>
              <Text style={styles.bannerChipText} maxFontSizeMultiplier={1.2}>
                Meeting #{meeting.meeting_number}
              </Text>
            </View>
          </View>


          {/* Report Body */}
          <View style={styles.reportBody}>

            {/* Section 1: Good Usage — only shown if there is published content */}
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

            {/* Section 2: Improvement Areas — only shown if there is published content */}
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
                        <Text style={styles.improvBadgeText} maxFontSizeMultiplier={1.2}>#{index + 1}</Text>
                      </View>
                      <View style={styles.incorrectRow}>
                        <X size={11} color="#DC2626" />
                        <Text style={styles.incorrectText} maxFontSizeMultiplier={1.2}>{item.incorrect_usage}</Text>
                      </View>
                      <View style={styles.correctRow}>
                        <CheckCircle2 size={11} color="#16A34A" />
                        <Text style={styles.correctText} maxFontSizeMultiplier={1.2}>{item.correct_usage}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Section 3: Usage Stats — only shown if there is published content */}
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
                      <Text style={[styles.statCardLabel, { color: '#1E40AF' }]} maxFontSizeMultiplier={1.2}>WORD OF THE DAY</Text>
                      <Text style={[styles.statCardValue, { color: '#1E3A8A' }]} maxFontSizeMultiplier={1.2}>{dailyElements.word_of_the_day}</Text>
                      <View style={[styles.statCardCount, { backgroundColor: '#2563EB' }]}>
                        <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>{totalWordUses} uses</Text>
                      </View>
                      {wordMemberStats.map((stat, i) => (
                        <View key={i} style={styles.statMemberRow}>
                          <User size={11} color="#2563EB" />
                          <Text style={[styles.statMemberName, { color: '#1e3a8a' }]} maxFontSizeMultiplier={1.2}>{stat.member_name}</Text>
                          <View style={[styles.statMemberBadge, { backgroundColor: '#2563EB' }]}>
                            <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>{stat.usage_count}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  {dailyElements.quote_of_the_day && totalQuoteUses > 0 && (
                    <View style={[styles.statCard, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}>
                      <Text style={[styles.statCardLabel, { color: '#854D0E' }]} maxFontSizeMultiplier={1.2}>QUOTE OF THE DAY</Text>
                      <Text style={[styles.statCardValue, { color: '#713F12', fontStyle: 'italic' }]} maxFontSizeMultiplier={1.2}>"{dailyElements.quote_of_the_day}"</Text>
                      <View style={[styles.statCardCount, { backgroundColor: '#EAB308' }]}>
                        <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>{totalQuoteUses} uses</Text>
                      </View>
                      {quoteMemberStats.map((stat, i) => (
                        <View key={i} style={styles.statMemberRow}>
                          <User size={11} color="#CA8A04" />
                          <Text style={[styles.statMemberName, { color: '#713F12' }]} maxFontSizeMultiplier={1.2}>{stat.member_name}</Text>
                          <View style={[styles.statMemberBadge, { backgroundColor: '#EAB308' }]}>
                            <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>{stat.usage_count}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                  {dailyElements.idiom_of_the_day && totalIdiomUses > 0 && (
                    <View style={[styles.statCard, { backgroundColor: '#F8F9FA', borderColor: '#DEE2E6' }]}>
                      <Text style={[styles.statCardLabel, { color: '#495057' }]} maxFontSizeMultiplier={1.2}>IDIOM OF THE DAY</Text>
                      <Text style={[styles.statCardValue, { color: '#212529' }]} maxFontSizeMultiplier={1.2}>{dailyElements.idiom_of_the_day}</Text>
                      <View style={[styles.statCardCount, { backgroundColor: '#6C757D' }]}>
                        <Text style={styles.statCardCountText} maxFontSizeMultiplier={1.2}>{totalIdiomUses} uses</Text>
                      </View>
                      {idiomMemberStats.map((stat, i) => (
                        <View key={i} style={styles.statMemberRow}>
                          <User size={11} color="#6C757D" />
                          <Text style={[styles.statMemberName, { color: '#343A40' }]} maxFontSizeMultiplier={1.2}>{stat.member_name}</Text>
                          <View style={[styles.statMemberBadge, { backgroundColor: '#6C757D' }]}>
                            <Text style={styles.statMemberCount} maxFontSizeMultiplier={1.2}>{stat.usage_count}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

          </View>

          {/* Footer: Grammarian + Published Date */}
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
                <Text style={styles.footerRole} maxFontSizeMultiplier={1.2}>Grammarian</Text>
              </View>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerPublishedLabel} maxFontSizeMultiplier={1.2}>Published</Text>
              <Text style={styles.footerPublishedDate} maxFontSizeMultiplier={1.2}>
                {publishedAt ? formatDate(publishedAt) : formatDate(meeting.meeting_date)}
              </Text>
            </View>
          </View>

        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '500' },
  goBackBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  goBackBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  navBack: { padding: 8, width: 40 },
  navTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  scroll: { flex: 1 },

  reportContent: {
    margin: Platform.OS === 'web' ? 0 : 0,
  },

  // Banners
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

  reportTitleBlock: {
    paddingVertical: 11,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  reportTitleText: {
    fontSize: 17,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  // Body
  reportBody: {
    padding: 16,
    gap: 0,
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

  // Good usage chips
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

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyBoxText: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },

  // Improvement cards
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

  // Stats
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

  // Footer
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

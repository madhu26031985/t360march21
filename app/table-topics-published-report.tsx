import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, User, Download, Mic } from 'lucide-react-native';
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

interface ClubInfo {
  id: string;
  club_name: string;
  club_number: string | null;
  district: string | null;
  division: string | null;
  area: string | null;
}

interface TableTopicMaster {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface PublishedQuestion {
  id: string;
  question_text: string;
  participant_id: string | null;
  participant_name: string | null;
  participant_avatar?: string | null;
}

const ACCENT_COLORS = [
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', dot: '#3B82F6' },
  { bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', dot: '#22C55E' },
  { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  { bg: '#FDF2F8', border: '#FBCFE8', text: '#9D174D', dot: '#EC4899' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6', dot: '#8B5CF6' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', dot: '#10B981' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', dot: '#F97316' },
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E', dot: '#0EA5E9' },
];

export default function TableTopicsPublishedReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [tableTopicMaster, setTableTopicMaster] = useState<TableTopicMaster | null>(null);
  const [publishedQuestions, setPublishedQuestions] = useState<PublishedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [tableTopicSummaryVisibleToMembers, setTableTopicSummaryVisibleToMembers] = useState<boolean>(true);
  const [isVPEClub, setIsVPEClub] = useState<boolean>(false);

  useEffect(() => {
    if (meetingId && user?.currentClubId) {
      loadData();
    }
  }, [meetingId, user?.currentClubId]);

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    try {
      await Promise.all([
        loadMeeting(),
        loadClubInfo(),
        loadTableTopicMaster(),
        loadTableTopicSummaryVisibility(),
        loadPublishedQuestions(),
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
      .select('id, club_name, club_number, district, division, area, vpe_id')
      .eq('club_id', user.currentClubId)
      .single();
    if (data) {
      setClubInfo({
        id: data.id || user.currentClubId,
        club_name: data.club_name,
        club_number: data.club_number,
        district: data.district,
        division: data.division,
        area: data.area,
      });
      setIsVPEClub(Boolean(user?.id && data.vpe_id === user.id));
    }
  };

  const loadTableTopicSummaryVisibility = async () => {
    if (!meetingId) return;
    const { data, error } = await supabase
      .from('table_topic_corner_visibility')
      .select('summary_visible_to_members')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    if (error) {
      console.error('Error loading Table Topic Summary visibility:', error);
      setTableTopicSummaryVisibleToMembers(true);
      return;
    }

    if (data && typeof (data as any).summary_visible_to_members === 'boolean') {
      setTableTopicSummaryVisibleToMembers(Boolean((data as any).summary_visible_to_members));
    } else {
      setTableTopicSummaryVisibleToMembers(true);
    }
  };

  const loadTableTopicMaster = async () => {
    if (!meetingId) return;
    const { data } = await supabase
      .from('app_meeting_roles_management')
      .select(`
        assigned_user_id,
        app_user_profiles (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('meeting_id', meetingId)
      .or('role_name.ilike.%Table Topics Master%,role_name.ilike.%Table Topic Master%')
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .maybeSingle();

    if (data && (data as any).app_user_profiles) {
      const profile = (data as any).app_user_profiles;
      setTableTopicMaster({
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      });
    }
  };

  const loadPublishedQuestions = async () => {
    if (!meetingId || !user?.currentClubId) return;
    const { data, error } = await supabase
      .from('app_meeting_tabletopicscorner')
      .select('id, question_text, participant_id, participant_name, created_at')
      .eq('meeting_id', meetingId)
      .eq('club_id', user.currentClubId)
      .eq('is_active', true)
      .eq('is_published', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading questions:', error);
      return;
    }

    const questions = data || [];

    if (questions.length > 0) {
      const latest = questions.reduce((a: any, b: any) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      );
      setPublishedAt(latest.created_at);
    }

    const participantIds = questions.filter((q: any) => q.participant_id).map((q: any) => q.participant_id);
    if (participantIds.length > 0) {
      const { data: profiles } = await supabase
        .from('app_user_profiles')
        .select('id, avatar_url')
        .in('id', participantIds);

      if (profiles) {
        const profileMap = new Map(profiles.map((p: any) => [p.id, p.avatar_url]));
        setPublishedQuestions(questions.map((q: any) => ({
          ...q,
          participant_avatar: q.participant_id ? profileMap.get(q.participant_id) : null,
        })));
        return;
      }
    }
    setPublishedQuestions(questions);
  };

  const handleExportPDF = async () => {
    const canViewSummary = tableTopicSummaryVisibleToMembers || isVPEClub || tableTopicMaster?.id === user?.id;
    if (!canViewSummary) {
      Alert.alert('Not available', 'Table Topic Summary is hidden for members for this meeting.');
      return;
    }
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is available on the web version of this app.');
      return;
    }
    setIsExporting(true);
    try {
      const clubName = (clubInfo?.club_name || 'Club').replace(/[^a-z0-9]/gi, '_');
      const meetingNum = meeting?.meeting_number || 'X';
      const date = meeting?.meeting_date ? new Date(meeting.meeting_date).toISOString().split('T')[0] : 'date';
      const filename = `${clubName}_Meeting_${meetingNum}_TableTopics_Report_${date}.pdf`;
      await exportAgendaToPDF('tt-report-content', filename);
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

  const bannerColor1 = meeting.club_info_banner_color || '#0f172a';
  const bannerColor2 = meeting.datetime_banner_color || '#e11d48';
  const canViewSummary = tableTopicSummaryVisibleToMembers || isVPEClub || tableTopicMaster?.id === user?.id;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Nav Header */}
      <View style={[styles.navHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Table Topics Report
        </Text>
        {Platform.OS === 'web' ? (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: theme.colors.primary, opacity: isExporting || !canViewSummary ? 0.6 : 1 }]}
            onPress={handleExportPDF}
            disabled={isExporting || !canViewSummary}
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
        <View nativeID="tt-report-content" style={[styles.reportContent, { backgroundColor: '#f8f9fa' }]}>

          {/* Banner 1: Club Name */}
          <View style={[styles.clubBanner, { backgroundColor: bannerColor1 }]}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerClubName} numberOfLines={1} ellipsizeMode="tail" maxFontSizeMultiplier={1.2}>
                {clubInfo?.club_name || 'Club Name'}
              </Text>
              <View style={styles.bannerMetaRow}>
                {clubInfo?.district && (
                  <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>District {clubInfo.district}</Text>
                )}
                {clubInfo?.division && (
                  <>
                    <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>|</Text>
                    <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>Division {clubInfo.division}</Text>
                  </>
                )}
                {clubInfo?.area && (
                  <>
                    <Text style={styles.bannerMetaSep} maxFontSizeMultiplier={1.2}>|</Text>
                    <Text style={styles.bannerMetaText} maxFontSizeMultiplier={1.2}>Area {clubInfo.area}</Text>
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

            {/* Section: Table Topics */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, { backgroundColor: '#e11d4818' }]}>
                  <Mic size={16} color="#e11d48" />
                </View>
                <Text style={styles.sectionTitle}>TABLE TOPICS</Text>
                <View style={[styles.countBadge, { backgroundColor: bannerColor2 }]}>
                  <Text style={styles.countBadgeText} maxFontSizeMultiplier={1.2}>{publishedQuestions.length}</Text>
                </View>
              </View>

              {!canViewSummary ? (
                <View style={styles.emptyBox}>
                  <Mic size={28} color="#d1d5db" />
                  <Text style={styles.emptyBoxText}>Table Topic Summary is hidden from members</Text>
                </View>
              ) : publishedQuestions.length > 0 ? (
                <View style={styles.questionsList}>
                  {publishedQuestions.map((question, index) => {
                    const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
                    return (
                      <View key={question.id} style={[styles.questionCard, { borderLeftColor: accent.dot }]}>
                        <View style={styles.questionNumberRow}>
                          <View style={[styles.questionNumberBadge, { backgroundColor: accent.dot }]}>
                            <Text style={styles.questionNumberText} maxFontSizeMultiplier={1.2}>
                              {String(index + 1).padStart(2, '0')}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.questionText, { color: '#111827' }]} maxFontSizeMultiplier={1.3}>
                          {question.question_text}
                        </Text>
                        <View style={styles.speakerRow}>
                          {question.participant_avatar ? (
                            <Image
                              source={{ uri: question.participant_avatar }}
                              style={[styles.speakerAvatar, { borderColor: accent.dot }]}
                            />
                          ) : (
                            <View style={[styles.speakerAvatarFallback, { backgroundColor: accent.dot }]}>
                              <Text style={styles.speakerAvatarInitials} maxFontSizeMultiplier={1.2}>
                                {question.participant_name
                                  ? question.participant_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                  : 'TT'}
                              </Text>
                            </View>
                          )}
                          <Text style={[styles.speakerName, { color: '#374151' }]} maxFontSizeMultiplier={1.2}>
                            {question.participant_name || 'To Be Announced'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Mic size={28} color="#d1d5db" />
                  <Text style={styles.emptyBoxText}>No questions published yet</Text>
                </View>
              )}
            </View>

          </View>

          {/* Footer: TT Master + Published Date */}
          <View style={[styles.footer, { backgroundColor: bannerColor1 }]}>
            <View style={styles.footerLeft}>
              {tableTopicMaster?.avatar_url ? (
                <Image source={{ uri: tableTopicMaster.avatar_url }} style={styles.footerAvatar} />
              ) : (
                <View style={[styles.footerAvatar, styles.footerAvatarFallback]}>
                  <User size={18} color="#ffffff" />
                </View>
              )}
              <View style={styles.footerInfo}>
                <Text style={styles.footerName} maxFontSizeMultiplier={1.2}>
                  {tableTopicMaster?.full_name || 'Table Topics Master'}
                </Text>
                <Text style={styles.footerRole} maxFontSizeMultiplier={1.2}>Table Topics Master</Text>
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
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },

  reportBody: {
    padding: 16,
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
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#111827',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },

  questionsList: {
    gap: 12,
  },
  questionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    gap: 8,
  },
  questionNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionNumberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  questionNumberText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  speakerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  speakerAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakerAvatarInitials: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  speakerName: {
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

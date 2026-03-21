import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  MicVocal,
  Snowflake,
  MessageSquare,
  Mic,
  BookOpen,
  Download,
  HelpCircle,
  X,
  FileText,
  FileBarChart,
  Upload,
  Lightbulb,
} from 'lucide-react-native';
import { Image, Alert } from 'react-native';
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

interface AssignedTimer {
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

interface TimerRecord {
  id: string;
  speaker_name: string;
  speech_category: string;
  actual_time_display: string;
  actual_time_seconds: number;
  time_qualification: boolean;
  recorded_at: string;
}

interface SectionSummary {
  category: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  records: TimerRecord[];
}

const SECTIONS = [
  { value: 'prepared_speaker', label: 'Prepared Speech', color: '#3b82f6' },
  { value: 'ice_breaker', label: 'Ice Breaker', color: '#06b6d4' },
  { value: 'evaluation', label: 'Evaluation', color: '#10b981' },
  { value: 'table_topic_speaker', label: 'Table Topics', color: '#f97316' },
  { value: 'educational_session', label: 'Educational Speaker', color: '#8b5cf6' },
];

function formatTotalTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function SectionIcon({ category, color, size = 16 }: { category: string; color: string; size?: number }) {
  if (category === 'prepared_speaker') return <MicVocal size={size} color={color} />;
  if (category === 'ice_breaker') return <Snowflake size={size} color={color} />;
  if (category === 'evaluation') return <MessageSquare size={size} color={color} />;
  if (category === 'table_topic_speaker') return <Mic size={size} color={color} />;
  if (category === 'educational_session') return <BookOpen size={size} color={color} />;
  return <Clock size={size} color={color} />;
}

function TimerSectionCard({ section }: { section: SectionSummary }) {
  const totalSeconds = section.records.reduce((acc, r) => acc + r.actual_time_seconds, 0);
  const qualified = section.records.filter(r => r.time_qualification).length;
  const disqualified = section.records.length - qualified;

  if (section.records.length === 0) return null;

  return (
    <View style={styles.sectionCard}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconWrap, { backgroundColor: section.color + '18' }]}>
            <SectionIcon category={section.category} color={section.color} size={15} />
          </View>
          <Text style={styles.sectionTitle}>{section.label.toUpperCase()} SUMMARY</Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          <View style={styles.participantBadge}>
            <Clock size={11} color="#6b7280" />
            <Text style={styles.participantBadgeText}>
              {section.records.length} Participant{section.records.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.badgeSep}>|</Text>
            <Text style={[styles.disqualifiedText, disqualified === 0 && styles.disqualifiedZero]}>
              {disqualified} Disqualified
            </Text>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>
            {section.category === 'prepared_speaker' || section.category === 'ice_breaker'
              ? 'PREPARED SPEAKER'
              : section.category === 'evaluation'
              ? 'EVALUATOR'
              : section.category === 'table_topic_speaker'
              ? 'TABLE TOPIC SPEAKER'
              : 'SPEAKER'}
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>TIME</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center' }]}>QUALIFIED</Text>
        </View>

        {/* Rows */}
        {section.records.map((record, index) => {
          const isLast = index === section.records.length - 1;
          return (
            <View
              key={record.id}
              style={[styles.tableRow, !isLast && styles.tableRowBorder, !record.time_qualification && styles.tableRowDisqualified]}
            >
              <View style={[{ flex: 3 }]}>
                <Text style={styles.speakerName} numberOfLines={1}>{record.speaker_name}</Text>
              </View>
              <Text style={[styles.timeText, { flex: 1, color: '#2563eb' }]}>
                {record.actual_time_display}
              </Text>
              <View style={[{ flex: 1.2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }]}>
                <Text style={[styles.qualifiedText, { color: record.time_qualification ? '#10b981' : '#ef4444' }]}>
                  {record.time_qualification ? 'Yes' : 'No'}
                </Text>
                {record.time_qualification ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <XCircle size={14} color="#ef4444" />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getCategoryDisplayLabel(category: string): string {
  switch (category) {
    case 'prepared_speaker': return 'Prepared Speaker';
    case 'ice_breaker': return 'Ice Breaker';
    case 'evaluation': return 'Evaluator';
    case 'table_topic_speaker': return 'Table Topics Speaker';
    case 'educational_session': return 'Educational Speaker';
    default: return category;
  }
}

export default function TimerReview() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [assignedTimer, setAssignedTimer] = useState<AssignedTimer | null>(null);
  const [timerRecords, setTimerRecords] = useState<TimerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);

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
      const filename = `${clubName}_Meeting_${meetingNum}_Timer_Report_${date}.pdf`;
      await exportAgendaToPDF('timer-review-content', filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Export Failed', 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      loadData();
    } else {
      setIsLoading(false);
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
        loadAssignedTimer(),
        loadTimerRecords(),
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

  const loadAssignedTimer = async () => {
    if (!meetingId) return;
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
      .eq('role_name', 'Timer')
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .maybeSingle();

    if (data && (data as any).app_user_profiles) {
      const profile = (data as any).app_user_profiles;
      setAssignedTimer({
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        avatar_url: profile.avatar_url,
      });
    }
  };

  const loadTimerRecords = async () => {
    if (!meetingId) return;
    const { data } = await supabase
      .from('timer_reports')
      .select('id, speaker_name, speech_category, actual_time_display, actual_time_seconds, time_qualification, recorded_at')
      .eq('meeting_id', meetingId)
      .order('recorded_at', { ascending: true });
    if (data) setTimerRecords(data);
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTimeShort = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    return `${parts[0]}:${parts[1]}`;
  };

  const bannerColor1 = meeting?.club_info_banner_color || '#7C1D30';
  const bannerColor2 = meeting?.datetime_banner_color || '#5A1520';

  const sections: SectionSummary[] = SECTIONS.map(s => ({
    category: s.value,
    label: s.label,
    color: s.color,
    icon: null,
    records: timerRecords.filter(r => r.speech_category === s.value),
  }));

  const hasAnyRecords = sections.some(s => s.records.length > 0);

  const navHeader = (
    <View style={[styles.navHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity style={styles.navBack} onPress={() => router.back()}>
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.navTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Timer Review
      </Text>
      <View style={styles.navActions}>
        <TouchableOpacity
          style={styles.navActionBtn}
          onPress={() => setShowHowToModal(true)}
        >
          <HelpCircle size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navActionBtn, { opacity: isExporting ? 0.5 : 1 }]}
          onPress={handleExportPDF}
          disabled={isExporting}
        >
          <Download size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {navHeader}
        <View style={styles.centered}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {navHeader}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.reportContent, { backgroundColor: '#f0f2f5' }]} nativeID="timer-review-content">

          {/* Banner 1: Club Name + District/Division/Area */}
          {meeting && (
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
          )}

          {/* Banner 2: Date / Time / Meeting Number */}
          {meeting && (
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
          )}

          {/* Report Body */}
          <View style={styles.reportBody}>
            {hasAnyRecords ? (
              sections.map(section => (
                <TimerSectionCard key={section.category} section={section} />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Clock size={40} color="#F59E0B" />
                </View>
                <Text style={styles.emptyTitle}>No Timer Records</Text>
                <Text style={styles.emptySub}>No timer data has been recorded for this meeting yet.</Text>
              </View>
            )}
          </View>

          {/* Footer: Timer + Published Date */}
          {meeting && (
            <View style={[styles.footer, { backgroundColor: bannerColor1 }]}>
              <View style={styles.footerLeft}>
                {assignedTimer?.avatar_url ? (
                  <Image source={{ uri: assignedTimer.avatar_url }} style={styles.footerAvatar} />
                ) : (
                  <View style={[styles.footerAvatar, styles.footerAvatarFallback]}>
                    <User size={18} color="#ffffff" />
                  </View>
                )}
                <View style={styles.footerInfo}>
                  <Text style={styles.footerName} maxFontSizeMultiplier={1.2}>
                    {assignedTimer?.full_name || 'Timer'}
                  </Text>
                  <Text style={styles.footerRole} maxFontSizeMultiplier={1.2}>Timer</Text>
                </View>
              </View>
              <View style={styles.footerRight}>
                <Text style={styles.footerPublishedLabel} maxFontSizeMultiplier={1.2}>Published</Text>
                <Text style={styles.footerPublishedDate} maxFontSizeMultiplier={1.2}>
                  {formatDateLong(meeting.meeting_date)}
                </Text>
              </View>
            </View>
          )}

        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* How To Modal */}
      <Modal visible={showHowToModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.howToOverlay}
          activeOpacity={1}
          onPress={() => setShowHowToModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.howToContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.howToHeader}>
              <Text style={[styles.howToTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer – How to Log Timing</Text>
              <TouchableOpacity onPress={() => setShowHowToModal(false)} style={styles.howToClose}>
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.howToScroll} showsVerticalScrollIndicator={false}>
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF' }]}>
                <FileText size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Log Time Tab</Text>
              </View>
              {[
                { num: 1, color: '#F59E0B', title: 'Select Category', desc: 'Choose the category. Speech / Ice Breaker / Table Topics / Evaluation.' },
                { num: 2, color: '#06B6D4', title: 'Select the Speaker', desc: "Choose the speaker's name from the dropdown." },
                { num: 3, color: '#10B981', title: 'Use the Stopwatch', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Start</Text> when the speech begins and <Text style={{ fontWeight: '700' }}>Stop</Text> when it ends.</Text> },
                { num: 4, color: '#6366F1', title: 'Enter the Final Time', desc: <Text maxFontSizeMultiplier={1.3}>The time can be entered or adjusted in <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add Time</Text>.</Text> },
                { num: 5, color: '#8B5CF6', title: 'Mark Qualification', desc: <Text maxFontSizeMultiplier={1.3}>Select <Text style={{ color: '#10B981', fontWeight: '700' }}>Yes</Text> if the speech met the required time range.{'\n'}Select <Text style={{ fontWeight: '700' }}>No</Text> if the speech was under or over time.</Text> },
                { num: 6, color: '#EC4899', title: 'Save the Record', desc: <Text maxFontSizeMultiplier={1.3}>Tap <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Save</Text> to store the timing entry.</Text> },
              ].map(({ num, color, title, desc }) => (
                <View key={num} style={styles.howToStep}>
                  <View style={[styles.howToStepNum, { backgroundColor: color }]}>
                    <Text style={styles.howToStepNumText} maxFontSizeMultiplier={1.2}>{num}</Text>
                  </View>
                  <View style={styles.howToStepContent}>
                    <Text style={[styles.howToStepTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
                    {typeof desc === 'string'
                      ? <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{desc}</Text>
                      : <Text style={[styles.howToStepDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>
                    }
                  </View>
                </View>
              ))}
              <View style={[styles.howToSectionBadge, { backgroundColor: '#EEF2FF', marginTop: 8 }]}>
                <FileBarChart size={14} color='#4F46E5' />
                <Text style={[styles.howToSectionBadgeText, { color: '#4F46E5' }]} maxFontSizeMultiplier={1.3}>Summary Tab</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                In the <Text style={{ fontWeight: '700' }}>Summary</Text> tab you can:
              </Text>
              <View style={styles.howToBulletList}>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} Review all recorded speech timings</Text>
                <Text style={[styles.howToBullet, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{'\u2022'} View the <Text style={{ fontWeight: '700', color: theme.colors.text }}>Timer Review</Text> report</Text>
              </View>
              <View style={[styles.howToSectionBadge, { backgroundColor: '#FFF7ED', marginTop: 8 }]}>
                <Upload size={14} color='#EA580C' />
                <Text style={[styles.howToSectionBadgeText, { color: '#EA580C' }]} maxFontSizeMultiplier={1.3}>Exporting the Report</Text>
              </View>
              <Text style={[styles.howToBodyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Timing reports can be exported as PDF from the web portal. Steps:
              </Text>
              <View style={styles.howToNumberedList}>
                {[
                  <Text maxFontSizeMultiplier={1.3}>Go to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Settings {'→'} Web Login</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Open the web portal</Text>,
                  <Text maxFontSizeMultiplier={1.3}>Navigate to <Text style={{ fontWeight: '700', color: theme.colors.text }}>Meeting {'→'} Timer</Text></Text>,
                  <Text maxFontSizeMultiplier={1.3}>Click <Text style={{ fontWeight: '700', color: theme.colors.text }}>Download PDF</Text></Text>,
                ].map((item, i) => (
                  <Text key={i} style={[styles.howToNumberedItem, { color: theme.colors.textSecondary }]}>
                    {i + 1}. {item}
                  </Text>
                ))}
              </View>
              <View style={[styles.howToTipBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Lightbulb size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.howToTipText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  <Text style={{ fontWeight: '700' }}>Tips:</Text> Help Tap the{' '}
                  <HelpCircle size={12} color={theme.colors.textSecondary} />{' '}
                  icon anytime to view these instructions.
                </Text>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, fontWeight: '500' },

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
    padding: 14,
    gap: 14,
  },

  // Section card
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 2,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    flexWrap: 'wrap',
    gap: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#111827',
  },
  sectionHeaderRight: {},
  participantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  participantBadgeText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  badgeSep: {
    fontSize: 11,
    color: '#9ca3af',
  },
  disqualifiedText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  disqualifiedZero: {
    color: '#6b7280',
  },

  totalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fafafa',
  },
  totalTimeLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  totalTimeValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  table: {
    paddingHorizontal: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.7,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 52,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tableRowDisqualified: {
    backgroundColor: '#fff9f9',
  },
  speakerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  notQualifiedBadge: {
    marginTop: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  notQualifiedText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  qualifiedText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emptySub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
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
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navActionBtn: {
    padding: 8,
  },
  howToOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  howToContainer: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  howToHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  howToTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginRight: 8,
  },
  howToClose: {
    padding: 4,
  },
  howToScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  howToSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14,
  },
  howToSectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  howToStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  howToStepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  howToStepNumText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  howToStepContent: {
    flex: 1,
  },
  howToStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  howToStepDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToBodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  howToBulletList: {
    gap: 4,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToBullet: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToNumberedList: {
    gap: 6,
    marginBottom: 8,
    paddingLeft: 4,
  },
  howToNumberedItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  howToTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  howToTipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});

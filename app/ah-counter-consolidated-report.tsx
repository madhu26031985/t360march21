import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ChartBar as BarChart3, Calendar, User, Users, Download } from 'lucide-react-native';
import { RefreshCw } from 'lucide-react-native';
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
}

interface AssignedAhCounter {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

function mergeCustomFillerCounts(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    const n = typeof v === 'number' ? v : 0;
    if (n > 0) out[k] = (out[k] || 0) + n;
  }
  return Object.keys(out).length ? out : undefined;
}

interface AhCounterReport {
  id: string;
  speaker_name: string;
  speaker_user_id: string | null;
  um_count: number;
  uh_count: number;
  ah_count: number;
  er_count: number;
  hmm_count: number;
  like_count: number;
  so_count: number;
  well_count: number;
  okay_count: number;
  you_know_count: number;
  right_count: number;
  actually_count: number;
  basically_count: number;
  literally_count: number;
  i_mean_count: number;
  you_see_count: number;
  unnecessary_short_pause: number;
  unnecessary_medium_pause: number;
  unnecessary_long_pause: number;
  repeated_words: string | null;
  comments: string | null;
  recorded_at: string;
  custom_filler_counts?: Record<string, number> | null;
}

interface FillerWordSummary {
  label: string;
  total: number;
  color: string;
  speakers: Array<{
    name: string;
    count: number;
  }>;
}

interface PauseSummary {
  label: string;
  description: string;
  total: number;
  color: string;
  speakers: Array<{
    name: string;
    count: number;
  }>;
}

export default function AhCounterConsolidatedReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignedAhCounter, setAssignedAhCounter] = useState<AssignedAhCounter | null>(null);
  const [reports, setReports] = useState<AhCounterReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fillerWords = [
    { key: 'um_count', label: 'Um', color: '#ef4444' },
    { key: 'uh_count', label: 'Uh', color: '#f97316' },
    { key: 'ah_count', label: 'Ah', color: '#eab308' },
    { key: 'er_count', label: 'Er', color: '#22c55e' },
    { key: 'hmm_count', label: 'Hmm', color: '#06b6d4' },
    { key: 'like_count', label: 'Like', color: '#8b5cf6' },
    { key: 'so_count', label: 'So', color: '#ec4899' },
    { key: 'well_count', label: 'Well', color: '#f59e0b' },
    { key: 'okay_count', label: 'Okay', color: '#10b981' },
    { key: 'you_know_count', label: 'You Know', color: '#6366f1' },
    { key: 'right_count', label: 'Right', color: '#ff7f50' },
    { key: 'actually_count', label: 'Actually', color: '#6a5acd' },
    { key: 'basically_count', label: 'Basically', color: '#20b2aa' },
    { key: 'literally_count', label: 'Literally', color: '#ba55d3' },
    { key: 'i_mean_count', label: 'I Mean', color: '#8b0000' },
    { key: 'you_see_count', label: 'You See', color: '#008b8b' },
  ];

  const pauseTypes = [
    { key: 'unnecessary_short_pause', label: 'Short Pause', description: '0-2 sec', color: '#fbbf24' },
    { key: 'unnecessary_medium_pause', label: 'Medium Pause', description: '2-4 sec', color: '#f97316' },
    { key: 'unnecessary_long_pause', label: 'Long Pause', description: 'Above 4 sec', color: '#dc2626' },
  ];

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (meetingId && user?.currentClubId) {
        loadData();
      }
    }, [meetingId, user?.currentClubId])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportPDF = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('PDF Export', 'PDF export is available on the web version of this app.');
      return;
    }
    setIsExporting(true);
    try {
      const clubName = (meeting?.meeting_title || 'Club').replace(/[^a-z0-9]/gi, '_');
      const meetingNum = meeting?.meeting_number || 'X';
      const date = meeting?.meeting_date ? new Date(meeting.meeting_date).toISOString().split('T')[0] : 'date';
      const filename = `${clubName}_Meeting_${meetingNum}_AhCounter_Report_${date}.pdf`;
      await exportAgendaToPDF('ah-counter-report-content', filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      Alert.alert('Export Failed', 'Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadAssignedAhCounter(),
        loadAhCounterReports()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadAssignedAhCounter = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
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
        .ilike('role_name', '%ah counter%')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .maybeSingle();

      if (error) {
        console.error('Error loading assigned Ah Counter:', error);
        return;
      }

      if (data && (data as any).app_user_profiles) {
        const profile = (data as any).app_user_profiles;
        setAssignedAhCounter({
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });
      }
    } catch (error) {
      console.error('Error loading assigned Ah Counter:', error);
    }
  };

  const loadAhCounterReports = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      console.log('🔄 Loading Ah Counter reports for meeting:', meetingId);

      // Get all published reports and aggregate by speaker
      const { data: rawData, error } = await supabase
        .from('ah_counter_reports')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('is_published', true)
        .order('speaker_name');

      if (error) {
        console.error('Error loading Ah Counter reports:', error);
        return;
      }

      // Aggregate reports by speaker
      const aggregatedData = rawData?.reduce((acc: any[], report) => {
        const existingSpeaker = acc.find(r => r.speaker_user_id === report.speaker_user_id);

        if (existingSpeaker) {
          // Sum up all the counts
          existingSpeaker.um_count += report.um_count || 0;
          existingSpeaker.uh_count += report.uh_count || 0;
          existingSpeaker.ah_count += report.ah_count || 0;
          existingSpeaker.er_count += report.er_count || 0;
          existingSpeaker.hmm_count += report.hmm_count || 0;
          existingSpeaker.like_count += report.like_count || 0;
          existingSpeaker.so_count += report.so_count || 0;
          existingSpeaker.well_count += report.well_count || 0;
          existingSpeaker.okay_count += report.okay_count || 0;
          existingSpeaker.you_know_count += report.you_know_count || 0;
          existingSpeaker.right_count += report.right_count || 0;
          existingSpeaker.actually_count += report.actually_count || 0;
          existingSpeaker.basically_count += report.basically_count || 0;
          existingSpeaker.literally_count += report.literally_count || 0;
          existingSpeaker.i_mean_count += report.i_mean_count || 0;
          existingSpeaker.you_see_count += report.you_see_count || 0;
          existingSpeaker.long_pause_count += report.long_pause_count || 0;
          existingSpeaker.medium_pause_count += report.medium_pause_count || 0;
          existingSpeaker.awkward_pause_count += report.awkward_pause_count || 0;
          const mergedCustom = mergeCustomFillerCounts(
            existingSpeaker.custom_filler_counts ?? undefined,
            report.custom_filler_counts ?? undefined
          );
          if (mergedCustom) existingSpeaker.custom_filler_counts = mergedCustom;
          else delete existingSpeaker.custom_filler_counts;

          // Concatenate comments and repeated words
          if (report.comments) {
            existingSpeaker.comments = existingSpeaker.comments
              ? `${existingSpeaker.comments}; ${report.comments}`
              : report.comments;
          }
          if (report.repeated_words) {
            existingSpeaker.repeated_words = existingSpeaker.repeated_words
              ? `${existingSpeaker.repeated_words}; ${report.repeated_words}`
              : report.repeated_words;
          }
        } else {
          // Add new speaker entry
          acc.push({ ...report });
        }

        return acc;
      }, []) || [];

      console.log('📊 Ah Counter reports aggregated:', {
        rawCount: rawData?.length || 0,
        uniqueSpeakers: aggregatedData.length,
        speakers: aggregatedData.map(r => r.speaker_name)
      });

      setReports(aggregatedData);
    } catch (error) {
      console.error('Error loading Ah Counter reports:', error);
    }
  };

  const getFillerWordsSummary = (): FillerWordSummary[] => {
    const base = fillerWords
      .map((word) => {
        const speakers = reports
          .map((report) => ({
            name: report.speaker_name,
            count: (report as any)[word.key] || 0,
          }))
          .filter((speaker) => speaker.count > 0)
          .sort((a, b) => b.count - a.count);

        const total = speakers.reduce((sum, speaker) => sum + speaker.count, 0);

        return {
          label: word.label,
          total,
          color: word.color,
          speakers,
        };
      })
      .filter((summary) => summary.total > 0);

    const customSlugs = new Set<string>();
    reports.forEach((r) => {
      const c = r.custom_filler_counts;
      if (c && typeof c === 'object') Object.keys(c).forEach((k) => customSlugs.add(k));
    });

    const customSummaries: FillerWordSummary[] = [...customSlugs].map((slug) => {
      const speakers = reports
        .map((report) => ({
          name: report.speaker_name,
          count: report.custom_filler_counts?.[slug] || 0,
        }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count);
      const total = speakers.reduce((sum, s) => sum + s.count, 0);
      return {
        label: slug.replace(/(^|\s)\S/g, (ch) => ch.toUpperCase()),
        total,
        color: '#64748b',
        speakers,
      };
    });

    return [...base, ...customSummaries.filter((s) => s.total > 0)];
  };

  const getPausesSummary = (): PauseSummary[] => {
    return pauseTypes.map(pause => {
      const speakers = reports
        .map(report => ({
          name: report.speaker_name,
          count: (report as any)[pause.key] || 0
        }))
        .filter(speaker => speaker.count > 0)
        .sort((a, b) => b.count - a.count);

      const total = speakers.reduce((sum, speaker) => sum + speaker.count, 0);

      return {
        label: pause.label,
        description: pause.description,
        total,
        color: pause.color,
        speakers
      };
    }).filter(summary => summary.total > 0);
  };

  const getTotalFillerWords = () => {
    return getFillerWordsSummary().reduce((sum, word) => sum + word.total, 0);
  };

  const getTotalPauses = () => {
    return getPausesSummary().reduce((sum, pause) => sum + pause.total, 0);
  };

  const getCategorySummaries = () => {
    const fillerWordsTotal = getTotalFillerWords();
    const pausesTotal = getTotalPauses();
    const additionalNotesCount = reports.filter(r => r.repeated_words || r.comments).length;
    
    // Debug logging to check data
    console.log('🔍 Ah Counter Debug Data:');
    console.log('Total reports loaded:', reports.length);
    reports.forEach(report => {
      console.log(`Speaker: ${report.speaker_name}`);
      console.log('Filler word counts:', {
        um: report.um_count,
        uh: report.uh_count,
        ah: report.ah_count,
        er: report.er_count,
        hmm: report.hmm_count,
        like: report.like_count,
        so: report.so_count,
        well: report.well_count,
        okay: report.okay_count,
        you_know: report.you_know_count,
        right: report.right_count,
        actually: report.actually_count,
        basically: report.basically_count,
        literally: report.literally_count,
        i_mean: report.i_mean_count,
        you_see: report.you_see_count,
      });
      
      // Calculate individual speaker total
      const speakerTotal = fillerWords.reduce((sum, word) => {
        return sum + ((report as any)[word.key] || 0);
      }, 0);
      console.log(`${report.speaker_name} total filler words:`, speakerTotal);
    });
    
    console.log('Calculated totals:', {
      fillerWordsTotal,
      pausesTotal,
      additionalNotesCount
    });
    
    return [
      {
        category: 'filler_words',
        label: 'Filler Words',
        color: '#3b82f6',
        count: fillerWordsTotal,
        description: `${fillerWordsTotal} total occurrences`
      },
      {
        category: 'pauses',
        label: 'Pauses',
        color: '#f97316',
        count: pausesTotal,
        description: `${pausesTotal} total pauses`
      },
      {
        category: 'additional_notes',
        label: 'Additional Notes',
        color: '#8b5cf6',
        count: additionalNotesCount,
        description: `${additionalNotesCount} speakers with notes`
      }
    ];
  };

  const getFilteredContent = () => {
    switch (selectedCategory) {
      case 'filler_words':
        return { type: 'filler_words', data: getFillerWordsSummary() };
      case 'pauses':
        return { type: 'pauses', data: getPausesSummary() };
      case 'additional_notes':
        return { type: 'additional_notes', data: reports.filter(r => r.repeated_words || r.comments) };
      default:
        return { type: 'all', data: null };
    }
  };


  const CategorySummaryCard = ({ summary }: { summary: any }) => (
    <TouchableOpacity
      style={[
        styles.categorySummaryCard,
        {
          backgroundColor: selectedCategory === summary.category ? summary.color : theme.colors.surface,
          borderColor: selectedCategory === summary.category ? summary.color : theme.colors.border,
        }
      ]}
      onPress={() => setSelectedCategory(summary.category)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryIcon, { backgroundColor: summary.color }]}>
        <Text style={styles.categoryIconText} maxFontSizeMultiplier={1.3}>
          {summary.category === 'filler_words' ? 'F' : 
           summary.category === 'pauses' ? 'P' : 'N'}
        </Text>
      </View>
      <View style={styles.categoryInfo}>
        <Text style={[
          styles.categoryTitle,
          { color: selectedCategory === summary.category ? '#ffffff' : theme.colors.text }
        ]} maxFontSizeMultiplier={1.3}>
          {summary.label}
        </Text>
        <Text style={[
          styles.categoryDescription,
          { color: selectedCategory === summary.category ? '#ffffff' : theme.colors.textSecondary }
        ]} maxFontSizeMultiplier={1.3}>
          {summary.description}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getSpeakerSummary = () => {
    return reports.map(report => {
      const fillerWordsTotal = fillerWords.reduce((sum, word) => {
        return sum + ((report as any)[word.key] || 0);
      }, 0);

      const pausesTotal = pauseTypes.reduce((sum, pause) => {
        return sum + ((report as any)[pause.key] || 0);
      }, 0);

      // Debug individual speaker calculation
      console.log(`🔍 Speaker ${report.speaker_name} calculation:`, {
        fillerWordsTotal,
        pausesTotal,
        total: fillerWordsTotal + pausesTotal
      });

      return {
        name: report.speaker_name,
        fillerWords: fillerWordsTotal,
        pauses: pausesTotal,
        total: fillerWordsTotal + pausesTotal,
      };
    }).sort((a, b) => b.total - a.total);
  };

  const FillerWordSummaryCard = ({ summary }: { summary: FillerWordSummary }) => (
    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.summaryHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: summary.color + '20' }]}>
          <Text style={[styles.summaryIconText, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
            {summary.label.charAt(0)}
          </Text>
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {summary.label}
          </Text>
          <Text style={[styles.summaryTotal, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
            {summary.total} total occurrences
          </Text>
        </View>
      </View>
      
      <View style={styles.speakersList}>
        {summary.speakers.map((speaker, index) => (
          <View key={index} style={styles.speakerItem}>
            <Text style={[styles.speakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {speaker.name}
            </Text>
            <View style={[styles.speakerCount, { backgroundColor: summary.color + '20' }]}>
              <Text style={[styles.speakerCountText, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
                {speaker.count}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const PauseSummaryCard = ({ summary }: { summary: PauseSummary }) => (
    <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.summaryHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: summary.color + '20' }]}>
          <Text style={[styles.summaryIconText, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
            ⏸
          </Text>
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {summary.label}
          </Text>
          <Text style={[styles.summaryDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {summary.description}
          </Text>
          <Text style={[styles.summaryTotal, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
            {summary.total} total occurrences
          </Text>
        </View>
      </View>
      
      <View style={styles.speakersList}>
        {summary.speakers.map((speaker, index) => (
          <View key={index} style={styles.speakerItem}>
            <Text style={[styles.speakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {speaker.name}
            </Text>
            <View style={[styles.speakerCount, { backgroundColor: summary.color + '20' }]}>
              <Text style={[styles.speakerCountText, { color: summary.color }]} maxFontSizeMultiplier={1.3}>
                {speaker.count}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const SpeakerSummaryCard = ({ speaker }: { speaker: any }) => (
    <View style={[styles.speakerSummaryCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.speakerSummaryHeader}>
        <View style={styles.speakerSummaryAvatar}>
          <User size={20} color="#ffffff" />
        </View>
        <View style={styles.speakerSummaryInfo}>
          <Text style={[styles.speakerSummaryName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {speaker.name}
          </Text>
          <View style={styles.speakerSummaryStats}>
            <View style={[styles.statItem, { backgroundColor: '#3b82f6' + '20' }]}>
              <Text style={[styles.statLabel, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>Filler Words</Text>
              <Text style={[styles.statValue, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>{speaker.fillerWords}</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: '#f97316' + '20' }]}>
              <Text style={[styles.statLabel, { color: '#f97316' }]} maxFontSizeMultiplier={1.3}>Pauses</Text>
              <Text style={[styles.statValue, { color: '#f97316' }]} maxFontSizeMultiplier={1.3}>{speaker.pauses}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.totalBadge, { backgroundColor: '#6b7280' + '20' }]}>
          <Text style={[styles.totalBadgeText, { color: '#6b7280' }]} maxFontSizeMultiplier={1.3}>
            {speaker.total}
          </Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading consolidated report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fillerWordsSummary = getFillerWordsSummary();
  const pausesSummary = getPausesSummary();
  const speakersSummary = getSpeakerSummary();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter Report</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Platform.OS === 'web' && (
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
          )}
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: theme.colors.success + '20' }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={20} color={theme.colors.success} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View nativeID="ah-counter-report-content">
          {/* Meeting Info Card */}
          <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.meetingHeader}>
              <View style={[styles.meetingIcon, { backgroundColor: '#06b6d4' + '20' }]}>
                <BarChart3 size={20} color="#06b6d4" />
              </View>
              <View style={styles.meetingInfo}>
                <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_title}
                </Text>
                <View style={styles.meetingMeta}>
                  <View style={styles.meetingDate}>
                    <Calendar size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.meetingDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {new Date(meeting.meeting_date).toLocaleDateString()}
                    </Text>
                  </View>
                  {meeting.meeting_number && (
                    <Text style={[styles.meetingNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      #{meeting.meeting_number}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Assigned Ah Counter */}
          {assignedAhCounter && (
            <View style={[styles.assignedCounterSection, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Report by</Text>
              <View style={styles.assignedCounterCard}>
                <View style={styles.assignedCounterAvatar}>
                  {assignedAhCounter.avatar_url ? (
                    <Image source={{ uri: assignedAhCounter.avatar_url }} style={styles.assignedCounterAvatarImage} />
                  ) : (
                    <User size={24} color="#ffffff" />
                  )}
                </View>
                <View style={styles.assignedCounterInfo}>
                  <Text style={[styles.assignedCounterName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {assignedAhCounter.full_name}
                  </Text>
                  <Text style={[styles.assignedCounterRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Ah Counter
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Category Summary */}
          <View style={styles.categorySummarySection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Category Summary
            </Text>
            <View style={styles.categorySummaryGrid}>
              <TouchableOpacity
                style={[
                  styles.allCategoryCard,
                  {
                    backgroundColor: selectedCategory === 'all' ? '#10b981' : theme.colors.surface,
                    borderColor: selectedCategory === 'all' ? '#10b981' : theme.colors.border,
                  }
                ]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[
                  styles.allCategoryText,
                  { color: selectedCategory === 'all' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  All Categories
                </Text>
                <Text style={[
                  styles.allCategoryCount,
                  { color: selectedCategory === 'all' ? '#ffffff' : theme.colors.textSecondary }
                ]} maxFontSizeMultiplier={1.3}>
                  {reports.length} speakers
                </Text>
              </TouchableOpacity>
              
              {getCategorySummaries().map((summary) => (
                <CategorySummaryCard key={summary.category} summary={summary} />
              ))}
            </View>
          </View>

        {/* Speaker Summary */}
        {selectedCategory === 'all' && speakersSummary.length > 0 && (
          <View style={[styles.speakerSummarySection, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Speaker Summary ({speakersSummary.length})
            </Text>
            {speakersSummary.map((speaker, index) => (
              <SpeakerSummaryCard key={index} speaker={speaker} />
            ))}
          </View>
        )}

        {/* Filler Words Breakdown */}
        {(selectedCategory === 'all' || selectedCategory === 'filler_words') && fillerWordsSummary.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={[styles.breakdownTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Filler Words Breakdown
            </Text>
            {fillerWordsSummary.map((summary, index) => (
              <FillerWordSummaryCard key={index} summary={summary} />
            ))}
          </View>
        )}

        {/* Pauses Breakdown */}
        {(selectedCategory === 'all' || selectedCategory === 'pauses') && pausesSummary.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={[styles.breakdownTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Pauses Breakdown
            </Text>
            {pausesSummary.map((summary, index) => (
              <PauseSummaryCard key={index} summary={summary} />
            ))}
          </View>
        )}

        {/* Additional Notes Section */}
        {(selectedCategory === 'all' || selectedCategory === 'additional_notes') && reports.some(report => report.repeated_words || report.comments) && (
          <View style={styles.notesSection}>
            <Text style={[styles.notesTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Additional Notes
            </Text>
            {reports
              .filter(report => report.repeated_words || report.comments)
              .map((report, index) => (
                <View key={index} style={[styles.noteCard, { backgroundColor: theme.colors.surface }]}>
                  <View style={styles.noteHeader}>
                    <View style={styles.noteAvatar}>
                      <User size={16} color="#ffffff" />
                    </View>
                    <Text style={[styles.noteSpeakerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {report.speaker_name}
                    </Text>
                  </View>
                  
                  {report.repeated_words && (
                    <View style={styles.noteItem}>
                      <View style={[styles.noteTypeTag, { backgroundColor: '#fbbf24' + '20' }]}>
                        <Text style={[styles.noteTypeText, { color: '#fbbf24' }]} maxFontSizeMultiplier={1.3}>Repeated Words</Text>
                      </View>
                      <Text style={[styles.noteContent, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {report.repeated_words}
                      </Text>
                    </View>
                  )}
                  
                  {report.comments && (
                    <View style={styles.noteItem}>
                      <View style={[styles.noteTypeTag, { backgroundColor: '#06b6d4' + '20' }]}>
                        <Text style={[styles.noteTypeText, { color: '#06b6d4' }]} maxFontSizeMultiplier={1.3}>Comments</Text>
                      </View>
                      <Text style={[styles.noteContent, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {report.comments}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
          </View>
        )}
        {/* Empty State */}
        {reports.length === 0 && (
          <View style={styles.emptyState}>
            <BarChart3 size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Reports Available
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Ah Counter reports will appear here once speakers have been tracked
            </Text>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginLeft: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  downloadBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  meetingCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingNumber: {
    fontSize: 12,
  },
  assignedCounterSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  assignedCounterCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedCounterAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assignedCounterAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  assignedCounterInfo: {
    flex: 1,
  },
  assignedCounterName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  assignedCounterRole: {
    fontSize: 14,
    fontWeight: '500',
  },
  categorySummarySection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  categorySummaryGrid: {
    gap: 12,
  },
  allCategoryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  allCategoryText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  allCategoryCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  categorySummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    fontWeight: '500',
  },
  overallStatsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overallStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  overallStatCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  overallStatValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  overallStatLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  speakerSummarySection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  speakerSummaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  speakerSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  speakerSummaryAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  speakerSummaryInfo: {
    flex: 1,
  },
  speakerSummaryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  speakerSummaryStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    fontSize: 16,
    fontWeight: '900',
  },
  breakdownSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryDescription: {
    fontSize: 12,
    marginBottom: 2,
  },
  summaryTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  speakersList: {
    gap: 8,
  },
  speakerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  speakerName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  speakerCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  speakerCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  notesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  noteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noteSpeakerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteItem: {
    marginBottom: 12,
  },
  noteTypeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  noteTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: 8,
    fontStyle: 'italic',
  },
});
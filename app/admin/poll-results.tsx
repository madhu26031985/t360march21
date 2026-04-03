import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ChartBar as BarChart3, Users, Vote, Calendar, Building2, Clock } from 'lucide-react-native';

/** Notion-like neutrals (aligned with voting-operations); pair with theme for surfaces in dark mode. */
const N = {
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.12)',
  pageLight: '#FBFBFA',
};

const QUESTION_STRIPE = ['#2383E2', '#EA580C', '#7C3AED', '#0D9488', '#DB2777'] as const;

function stripeForQuestion(index: number): string {
  return QUESTION_STRIPE[index % QUESTION_STRIPE.length];
}

interface PollResult {
  uuid: string;
  poll_title: string;
  poll_created_at: string;
  question_text: string;
  option_text: string;
  votes: number;
  percentage: number;
  question_order: number;
  option_order: number;
}

interface Poll {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  end_time: string | null;
  club_id: string;
}

interface ClubProfileRow {
  club_name: string | null;
  club_number: string | null;
}

interface MeetingSummary {
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
}

function isoDateKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = iso.indexOf('T');
  if (t > 0) return iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  return null;
}

function dateKeyFromTitle(title: string): string | null {
  const m = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function pickMeetingForPoll(
  poll: Poll,
  meetings: MeetingSummary[] | null | undefined
): MeetingSummary | null {
  if (!meetings?.length) return null;
  const keys = new Set<string>();
  const kEnd = isoDateKey(poll.end_time);
  const kCreated = isoDateKey(poll.created_at);
  if (kEnd) keys.add(kEnd);
  if (kCreated) keys.add(kCreated);
  const kTitle = dateKeyFromTitle(poll.title);
  if (kTitle) keys.add(kTitle);

  for (const key of keys) {
    const hit = meetings.find((m) => {
      const md = isoDateKey(m.meeting_date) || m.meeting_date.slice(0, 10);
      return md === key;
    });
    if (hit) return hit;
  }
  return null;
}

function formatMeetingDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function PollResults() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const pollId = typeof params.pollId === 'string' ? params.pollId : params.pollId?.[0];

  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);
  const [club, setClub] = useState<ClubProfileRow | null>(null);
  const [meeting, setMeeting] = useState<MeetingSummary | null>(null);

  const pageBg = theme.dark ? theme.colors.background : N.pageLight;
  const border = theme.colors.border;
  const surface = theme.colors.surface;
  const text = theme.colors.text;
  const textSecondary = theme.colors.textSecondary;

  useEffect(() => {
    if (pollId) {
      void loadPollResults();
    }
  }, [pollId]);

  const loadPollResults = async () => {
    if (!pollId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('id, title, description, created_at, end_time, club_id')
        .eq('id', pollId)
        .single();

      if (pollError || !pollData) {
        console.error('Error loading poll:', pollError);
        setPoll(null);
        return;
      }

      const p = pollData as Poll;
      setPoll(p);

      const [clubRes, meetingsRes, resultsRes] = await Promise.all([
        supabase
          .from('club_profiles')
          .select('club_name, club_number')
          .eq('club_id', p.club_id)
          .maybeSingle(),
        supabase
          .from('app_club_meeting')
          .select(
            'meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location'
          )
          .eq('club_id', p.club_id)
          .order('meeting_date', { ascending: false })
          .limit(48),
        supabase.from('poll_results_repository').select('*').eq('poll_id', pollId).order('question_order'),
      ]);

      if (clubRes.data) {
        setClub(clubRes.data as ClubProfileRow);
      } else {
        setClub(null);
      }

      const meetingList = (meetingsRes.data || []) as MeetingSummary[];
      setMeeting(pickMeetingForPoll(p, meetingList));

      if (resultsRes.error) {
        console.error('Error loading poll results:', resultsRes.error);
        setResults([]);
        setTotalVotes(0);
        return;
      }

      const resultsData = resultsRes.data || [];
      setResults(resultsData as PollResult[]);
      const total = resultsData.reduce((sum, result) => sum + ((result as PollResult).votes || 0), 0);
      setTotalVotes(total);
    } catch (error) {
      console.error('Error loading poll results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupResultsByQuestion = () => {
    const grouped: { [key: number]: PollResult[] } = {};

    results.forEach((result) => {
      if (!grouped[result.question_order]) {
        grouped[result.question_order] = [];
      }
      grouped[result.question_order].push(result);
    });

    return Object.keys(grouped)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((key) => ({
        questionOrder: parseInt(key, 10),
        results: grouped[parseInt(key, 10)].sort((a, b) => (b.votes || 0) - (a.votes || 0)),
      }));
  };

  const getBarWidth = (percentage: number) => {
    return Math.max(percentage, 5);
  };

  const getBarColor = (index: number) => {
    const colors = ['#2383E2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0D9488'];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
        <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]} maxFontSizeMultiplier={1.3}>
            Poll Results
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!poll) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
        <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: text }]} maxFontSizeMultiplier={1.3}>
            Poll Results
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: text }]} maxFontSizeMultiplier={1.3}>
            Poll not found
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryBtnText} maxFontSizeMultiplier={1.3}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const grouped = groupResultsByQuestion();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: surface, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]} maxFontSizeMultiplier={1.3}>
          Poll Results
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.singlePanel, { backgroundColor: surface, borderColor: border }]}>
          {/* Club + meeting */}
          <View style={styles.section}>
            <View style={styles.clubRow}>
              <View style={[styles.iconTile, { backgroundColor: N.accentSoft }]}>
                <Building2 size={18} color={N.accent} />
              </View>
              <View style={styles.clubTextCol}>
                <Text style={[styles.clubName, { color: text }]} maxFontSizeMultiplier={1.3}>
                  {club?.club_name?.trim() || 'Club'}
                </Text>
                {club?.club_number ? (
                  <Text style={[styles.clubMeta, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Club #{club.club_number}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: textSecondary }]} maxFontSizeMultiplier={1.2}>
              Meeting details
            </Text>
            {meeting ? (
              <View style={styles.meetingBlock}>
                <Text style={[styles.meetingTitle, { color: text }]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_number != null && String(meeting.meeting_number).trim() !== ''
                    ? `Meeting ${meeting.meeting_number}: ${meeting.meeting_title}`
                    : meeting.meeting_title}
                </Text>
                <View style={styles.meetingMetaRow}>
                  <Calendar size={13} color={textSecondary} />
                  <Text style={[styles.meetingMetaText, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {formatMeetingDate(meeting.meeting_date)}
                  </Text>
                </View>
                {(meeting.meeting_start_time || meeting.meeting_end_time) && (
                  <View style={styles.meetingMetaRow}>
                    <Clock size={13} color={textSecondary} />
                    <Text style={[styles.meetingMetaText, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {[meeting.meeting_start_time, meeting.meeting_end_time].filter(Boolean).join(' · ') ||
                        meeting.meeting_mode}
                    </Text>
                  </View>
                )}
                {meeting.meeting_location ? (
                  <Text style={[styles.meetingLocation, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {meeting.meeting_location}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.meetingFallback, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                No matching club meeting was found for this poll’s dates. Title and poll dates below still describe
                the session.
              </Text>
            )}
          </View>

          <View style={[styles.hairline, { backgroundColor: border }]} />

          {/* Poll summary */}
          <View style={styles.section}>
            <View style={styles.pollTitleRow}>
              <View style={[styles.iconTile, { backgroundColor: N.accentSoft }]}>
                <BarChart3 size={18} color={N.accent} />
              </View>
              <Text style={[styles.pollTitle, { color: text }]} maxFontSizeMultiplier={1.25}>
                {poll.title}
              </Text>
            </View>
            {poll.description ? (
              <Text style={[styles.pollDescription, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                {poll.description}
              </Text>
            ) : null}
            <View style={styles.pollDates}>
              <View style={styles.pollDateRow}>
                <Calendar size={12} color={textSecondary} />
                <Text style={[styles.pollDateText, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Created {poll.created_at ? new Date(poll.created_at).toLocaleDateString() : '—'}
                </Text>
              </View>
              {poll.end_time ? (
                <View style={styles.pollDateRow}>
                  <Vote size={12} color={textSecondary} />
                  <Text style={[styles.pollDateText, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Closed {new Date(poll.end_time).toLocaleDateString()}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={[styles.totalVotesRow, { borderTopColor: border }]}>
              <Users size={16} color={theme.colors.primary} />
              <Text style={[styles.totalVotesText, { color: text }]} maxFontSizeMultiplier={1.3}>
                {totalVotes} total votes
              </Text>
            </View>
          </View>

          <View style={[styles.hairline, { backgroundColor: border }]} />

          {/* Results */}
          <View style={styles.section}>
            <Text style={[styles.resultsHeading, { color: text }]} maxFontSizeMultiplier={1.2}>
              Results
            </Text>

            {results.length === 0 ? (
              <View style={styles.noResultsState}>
                <Vote size={40} color={textSecondary} />
                <Text style={[styles.noResultsText, { color: text }]} maxFontSizeMultiplier={1.3}>
                  No results yet
                </Text>
                <Text style={[styles.noResultsSubtext, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                  This poll may not have received votes, or results are still processing.
                </Text>
              </View>
            ) : (
              grouped.map(({ questionOrder, results: questionResults }, qi) => {
                if (questionResults.length === 0) return null;
                const questionText = questionResults[0].question_text;
                const questionTotalVotes = questionResults.reduce((sum, r) => sum + (r.votes || 0), 0);
                const stripe = stripeForQuestion(qi);

                return (
                  <View
                    key={questionOrder}
                    style={[styles.questionBlock, { borderLeftColor: stripe }]}
                  >
                    <Text style={[styles.questionTitle, { color: text }]} maxFontSizeMultiplier={1.3}>
                      {questionText}
                    </Text>
                    <Text style={[styles.questionVoteCount, { color: textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {questionTotalVotes} votes
                    </Text>
                    <View style={styles.optionList}>
                      {questionResults.map((result, index) => (
                        <View key={result.uuid} style={styles.optionRow}>
                          <View style={styles.optionHeader}>
                            <Text
                              style={[styles.optionLabel, { color: text }]}
                              maxFontSizeMultiplier={1.3}
                            >
                              {result.option_text}
                            </Text>
                            <Text style={[styles.optionVotes, { color: text }]} maxFontSizeMultiplier={1.3}>
                              {result.votes || 0}
                            </Text>
                          </View>
                          <View style={[styles.progressTrack, { backgroundColor: theme.colors.background }]}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  backgroundColor: getBarColor(index),
                                  width: `${getBarWidth(result.percentage || 0)}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    ...Platform.select({
      web: {
        maxWidth: 720,
        alignSelf: 'center',
        width: '100%',
      },
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  singlePanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  clubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubTextCol: {
    flex: 1,
    gap: 2,
  },
  clubName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  clubMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  meetingBlock: {
    gap: 6,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  meetingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meetingMetaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  meetingLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  meetingFallback: {
    fontSize: 13,
    lineHeight: 19,
  },
  pollTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  pollTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  pollDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  pollDates: {
    gap: 6,
    marginBottom: 12,
  },
  pollDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pollDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  totalVotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalVotesText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultsHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  questionBlock: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 20,
  },
  questionTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 4,
  },
  questionVoteCount: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionList: {
    gap: 12,
  },
  optionRow: {
    marginBottom: 2,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  optionVotes: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 8,
    borderRadius: 0,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
  },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 0,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  noResultsState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 12,
  },
  noResultsText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
});

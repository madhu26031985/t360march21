import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ChartBar as BarChart3, Users, Vote, Calendar } from 'lucide-react-native';

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
}

export default function PollResults() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const pollId = typeof params.pollId === 'string' ? params.pollId : params.pollId?.[0];
  
  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    if (pollId) {
      loadPollResults();
    }
  }, [pollId]);

  const loadPollResults = async () => {
    if (!pollId) {
      setIsLoading(false);
      return;
    }

    try {
      // Load poll info
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('id, title, description, created_at, end_time')
        .eq('id', pollId)
        .single();

      if (pollError) {
        console.error('Error loading poll:', pollError);
        return;
      }

      setPoll(pollData);

      // Load poll results
      const { data: resultsData, error: resultsError } = await supabase
        .from('poll_results_repository')
        .select('*')
        .eq('poll_id', pollId)
        .order('question_order');

      if (resultsError) {
        console.error('Error loading poll results:', resultsError);
        return;
      }

      setResults(resultsData || []);
      const total = resultsData?.reduce((sum, result) => sum + ((result as any).votes || 0), 0) || 0;
      setTotalVotes(total);
    } catch (error) {
      console.error('Error loading poll results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupResultsByQuestion = () => {
    const grouped: { [key: number]: PollResult[] } = {};
    
    results.forEach(result => {
      if (!grouped[result.question_order]) {
        grouped[result.question_order] = [];
      }
      grouped[result.question_order].push(result);
    });

    return Object.keys(grouped)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => ({
        questionOrder: parseInt(key),
        results: grouped[parseInt(key)].sort((a, b) => (b.votes || 0) - (a.votes || 0))
      }));
  };

  const getBarWidth = (percentage: number) => {
    return Math.max(percentage, 5); // Minimum 5% width for visibility
  };

  const getBarColor = (index: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading poll results...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!poll) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Poll not found</Text>
          <TouchableOpacity 
            style={[styles.backToVotingButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backToVotingButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Poll Results</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Poll Info Card */}
        <View style={[styles.pollInfoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.pollInfoHeader}>
            <View style={[styles.resultsIcon, { backgroundColor: '#3b82f6' + '20' }]}>
              <BarChart3 size={20} color="#3b82f6" />
            </View>
            <View style={styles.pollInfoContent}>
              <Text style={[styles.pollInfoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {poll.title}
              </Text>
              {poll.description && (
                <Text style={[styles.pollInfoDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {poll.description}
                </Text>
              )}
              <View style={styles.pollInfoMeta}>
                <View style={styles.pollInfoDate}>
                  <Calendar size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.pollInfoDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Created {new Date(poll.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {poll.end_time && (
                  <View style={styles.pollInfoDate}>
                    <Vote size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.pollInfoDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Closed {new Date(poll.end_time).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          
          <View style={[styles.totalVotesCard, { backgroundColor: theme.colors.background }]}>
            <Users size={16} color={theme.colors.primary} />
            <Text style={[styles.totalVotesText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {totalVotes} Total Votes
            </Text>
          </View>
        </View>

        {/* Results */}
        <View style={styles.resultsSection}>
          {results.length === 0 ? (
            <View style={styles.noResultsState}>
              <Vote size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noResultsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No Results Available
              </Text>
              <Text style={[styles.noResultsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                This poll may not have received any votes yet, or results are still being processed.
              </Text>
            </View>
          ) : (
            groupResultsByQuestion().map(({ questionOrder, results: questionResults }) => {
              if (questionResults.length === 0) return null;
              
              const questionText = questionResults[0].question_text;
              const questionTotalVotes = questionResults.reduce((sum, r) => sum + (r.votes || 0), 0);

              return (
                <View key={questionOrder} style={[styles.questionResultCard, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.questionResultTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {questionText}
                  </Text>
                  
                  <View style={styles.questionVotesInfo}>
                    <Text style={[styles.questionVotesText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {questionTotalVotes} votes
                    </Text>
                  </View>

                  <View style={styles.optionResults}>
                    {questionResults.map((result, index) => (
                      <View key={result.uuid} style={styles.optionResult}>
                        <View style={styles.optionResultHeader}>
                          <Text style={[styles.optionResultText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {result.option_text}
                          </Text>
                          <Text style={[styles.optionVotes, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                            {result.votes || 0}
                          </Text>
                        </View>
                        
                        <View style={[styles.progressBar, { backgroundColor: theme.colors.background }]}>
                          <View 
                            style={[
                              styles.progressFill,
                              { 
                                backgroundColor: getBarColor(index),
                                width: `${getBarWidth(result.percentage || 0)}%`
                              }
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  pollInfoCard: {
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
  pollInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pollInfoContent: {
    flex: 1,
  },
  pollInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  pollInfoDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  pollInfoMeta: {
    gap: 8,
  },
  pollInfoDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pollInfoDateText: {
    fontSize: 12,
    marginLeft: 4,
  },
  totalVotesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  totalVotesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  questionResultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 22,
  },
  questionVotesInfo: {
    marginBottom: 16,
  },
  questionVotesText: {
    fontSize: 13,
    fontWeight: '500',
  },
  optionResults: {
    gap: 12,
  },
  optionResult: {
    marginBottom: 8,
  },
  optionResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  optionResultText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  optionVotes: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  backToVotingButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToVotingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  noResultsState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
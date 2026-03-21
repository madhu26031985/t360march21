import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Vote, CircleCheck as CheckCircle, Calendar, Clock, Building2, Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';

interface Poll {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface PollItem {
  id: string;
  poll_id: string;
  question_id: string;
  option_id: string;
  option_text: string;
  question_text: string;
  question_order: number;
  option_order: number;
  vote_count: number;
  avatar_url?: string | null;
}

interface UserVote {
  poll_id: string;
  question_id: string;
  option_id: string;
}

export default function LiveVoting() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [activePolls, setActivePolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [pollItems, setPollItems] = useState<PollItem[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadActivePolls();
  }, []);

  useEffect(() => {
    if (selectedPoll) {
      loadPollItems();
      loadUserVotes();
      checkIfUserHasVoted();
    }
  }, [selectedPoll]);

  const loadActivePolls = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('polls')
        .select('id, title, description, status, created_at')
        .eq('club_id', user.currentClubId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading active polls:', error);
        return;
      }

      setActivePolls(data || []);
      
      // Auto-select first poll if available
      if (data && data.length > 0) {
        setSelectedPoll(data[0]);
      }
    } catch (error) {
      console.error('Error loading active polls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPollItems = async () => {
    if (!selectedPoll) return;

    try {
      const { data, error } = await supabase
        .from('poll_items')
        .select('*')
        .eq('poll_id', selectedPoll.id)
        .eq('is_active', true)
        .order('question_order')
        .order('option_order');

      if (error) {
        console.error('Error loading poll items:', error);
        return;
      }

      // Fetch avatars for each option by matching option_text with full_name
      const itemsWithAvatars = await Promise.all(
        (data || []).map(async (item) => {
          if (item.option_text) {
            const { data: profileData } = await supabase
              .from('app_user_profiles')
              .select('avatar_url')
              .ilike('full_name', item.option_text)
              .maybeSingle();

            return { ...item, avatar_url: profileData?.avatar_url || null };
          }
          return item;
        })
      );

      setPollItems(itemsWithAvatars);
    } catch (error) {
      console.error('Error loading poll items:', error);
    }
  };

  const loadUserVotes = async () => {
    if (!selectedPoll || !user) return;

    try {
      const { data, error } = await supabase
        .from('simple_poll_votes')
        .select('poll_id, question_id, option_id')
        .eq('poll_id', selectedPoll.id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading user votes:', error);
        return;
      }

      setUserVotes(data || []);
    } catch (error) {
      console.error('Error loading user votes:', error);
    }
  };

  const checkIfUserHasVoted = async () => {
    if (!selectedPoll || !user) return;

    try {
      const { data, error } = await supabase
        .from('simple_poll_votes')
        .select('poll_id')
        .eq('poll_id', selectedPoll.id)
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking if user has voted:', error);
        return;
      }

      const hasVotedForThisPoll = data && data.length > 0;
      setHasVoted(hasVotedForThisPoll);
      
      if (hasVotedForThisPoll) {
        setVotedPolls(prev => new Set([...prev, selectedPoll.id]));
      }
    } catch (error) {
      console.error('Error checking if user has voted:', error);
    }
  };
  const handleVote = async (questionId: string, optionId: string) => {
    if (!selectedPoll || !user || hasVoted) return;

    try {
      // Update local state
      setUserVotes(prev => {
        const filtered = prev.filter(v => v.question_id !== questionId);
        return [...filtered, { poll_id: selectedPoll.id, question_id: questionId, option_id: optionId }];
      });
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const getUserVoteForQuestion = (questionId: string) => {
    return userVotes.find(v => v.question_id === questionId);
  };

  const getAllQuestionIds = () => {
    const ids = new Set<string>();
    pollItems.forEach(item => ids.add(item.question_id));
    return ids;
  };

  const allQuestionsAnswered = () => {
    const allIds = getAllQuestionIds();
    return [...allIds].every(qId => userVotes.some(v => v.question_id === qId));
  };

  const handleSubmitVotes = async () => {
    if (!selectedPoll || !user || userVotes.length === 0) return;

    const allIds = getAllQuestionIds();
    const unansweredCount = [...allIds].filter(qId => !userVotes.some(v => v.question_id === qId)).length;

    if (unansweredCount > 0) {
      Alert.alert(
        'Answer All Questions',
        `Please answer all ${allIds.size} questions before submitting. You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}.`
      );
      return;
    }

    setIsVoting(true);
    
    try {
      // Submit all votes to database
      for (const vote of userVotes) {
        // Create new vote (one-time only)
        const { error } = await supabase
          .from('simple_poll_votes')
          .insert({
            poll_id: vote.poll_id,
            question_id: vote.question_id,
            option_id: vote.option_id,
            user_id: user.id,
          } as any);

        if (error) {
          console.error('Error creating vote:', error);
          throw error;
        }
      }

      // Mark this poll as voted
      setHasVoted(true);
      setVotedPolls(prev => new Set([...prev, selectedPoll.id]));
      
      // Clear local votes
      setUserVotes([]);
    } catch (error) {
      console.error('Error submitting votes:', error);
      Alert.alert('Error', 'Failed to submit votes. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  const groupQuestionsByOrder = () => {
    const grouped: { [key: number]: PollItem[] } = {};
    
    pollItems.forEach(item => {
      if (!grouped[item.question_order]) {
        grouped[item.question_order] = [];
      }
      grouped[item.question_order].push(item);
    });

    return Object.keys(grouped)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => ({
        questionOrder: parseInt(key),
        items: grouped[parseInt(key)].sort((a, b) => a.option_order - b.option_order)
      }));
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return '#8b5cf6';
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading polls...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Vote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Access Required</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to participate in voting.
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Switcher */}
        <ClubSwitcher showRole={true} />

        {/* Check if user has voted for current poll */}
        {selectedPoll && hasVoted ? (
          <View style={styles.thankYouSection}>
            <View style={[styles.thankYouCard, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.thankYouIcon, { backgroundColor: theme.colors.success + '20' }]}>
                <CheckCircle size={32} color={theme.colors.success} />
              </View>
              <Text style={[styles.thankYouTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Thanks for Voting!
              </Text>
              <Text style={[styles.thankYouMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Your votes for "{selectedPoll.title}" have been submitted successfully.
              </Text>
              
              {/* Show other available polls */}
              {activePolls.filter(p => !votedPolls.has(p.id)).length > 0 && (
                <View style={styles.otherPollsSection}>
                  <Text style={[styles.otherPollsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Other Available Polls:
                  </Text>
                  {activePolls.filter(p => !votedPolls.has(p.id)).map((poll) => (
                    <TouchableOpacity
                      key={poll.id}
                      style={[styles.otherPollButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => setSelectedPoll(poll)}
                    >
                      <Vote size={16} color="#ffffff" />
                      <Text style={styles.otherPollButtonText} maxFontSizeMultiplier={1.3}>{poll.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : activePolls.length > 0 ? (
          <>
            {/* Poll Selection */}
            {activePolls.length > 1 && (
              <View style={[styles.pollSelectionCard, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.pollSelectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Select Poll to Vote
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {activePolls.map((poll) => (
                    <TouchableOpacity
                      key={poll.id}
                      style={[
                        styles.pollTab,
                        {
                          backgroundColor: selectedPoll?.id === poll.id ? theme.colors.primary : theme.colors.background,
                          borderColor: selectedPoll?.id === poll.id ? theme.colors.primary : theme.colors.border,
                        }
                      ]}
                      onPress={() => setSelectedPoll(poll)}
                    >
                      <Text style={[
                        styles.pollTabText,
                        { color: selectedPoll?.id === poll.id ? '#ffffff' : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {poll.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Current Poll */}
            {selectedPoll && (
              <View style={[styles.currentPollCard, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.pollHeader}>
                  <View style={[styles.pollIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Vote size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.pollInfo}>
                    <Text style={[styles.currentPollTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {selectedPoll.title}
                    </Text>
                    {selectedPoll.description && (
                      <Text style={[styles.currentPollDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {selectedPoll.description}
                      </Text>
                    )}
                    <View style={styles.pollStatus}>
                      <View style={[styles.liveIndicator, { backgroundColor: theme.colors.success }]} />
                      <Text style={[styles.liveText, { color: theme.colors.success }]} maxFontSizeMultiplier={1.3}>Live Poll</Text>
                    </View>
                  </View>
                </View>

                {/* Questions */}
                <View style={styles.questionsSection}>
                  {groupQuestionsByOrder().map(({ questionOrder, items }) => {
                    if (items.length === 0) return null;
                    
                    const questionText = items[0].question_text;
                    const questionId = items[0].question_id;
                    const userVote = getUserVoteForQuestion(questionId);

                    return (
                      <View key={questionId} style={[styles.questionCard, { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: userVote ? theme.colors.success + '40' : theme.colors.border }]}>
                        <View style={styles.questionHeader}>
                          <Text style={[styles.questionText, { color: theme.colors.text, flex: 1 }]} maxFontSizeMultiplier={1.3}>
                            {questionOrder + 1}. {questionText}
                          </Text>
                          {userVote ? (
                            <CheckCircle size={18} color={theme.colors.success} />
                          ) : (
                            <View style={[styles.requiredBadge, { backgroundColor: theme.colors.error + '15', borderColor: theme.colors.error + '40' }]}>
                              <Text style={[styles.requiredText, { color: theme.colors.error }]} maxFontSizeMultiplier={1.3}>Required</Text>
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.optionsContainer}>
                          {items.map((item) => {
                            const isSelected = userVote?.option_id === item.option_id;
                            
                            return (
                              <TouchableOpacity
                                key={item.option_id}
                                style={[
                                  styles.optionButton,
                                  {
                                    backgroundColor: isSelected ? theme.colors.primary + '20' : theme.colors.surface,
                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                  }
                                ]}
                                onPress={() => handleVote(questionId, item.option_id)}
                                disabled={isVoting || hasVoted}
                              >
                                <View style={[
                                  styles.optionRadio,
                                  {
                                    backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                                  }
                                ]}>
                                  {isSelected && (
                                    <CheckCircle size={12} color="#ffffff" />
                                  )}
                                </View>
                                {item.avatar_url ? (
                                  <Image
                                    source={{ uri: item.avatar_url }}
                                    style={styles.optionAvatar}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View style={[styles.optionAvatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                                    <User size={14} color="#ffffff" />
                                  </View>
                                )}
                                <Text style={[
                                  styles.optionText,
                                  { color: isSelected ? theme.colors.primary : theme.colors.text }
                                ]} maxFontSizeMultiplier={1.3}>
                                  {item.option_text}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Vote size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Active Polls
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              There are currently no active polls available for voting. Check back later or contact your ExComm.
            </Text>
          </View>
        )}
      </ScrollView>

        {/* Submit Button - only show if user hasn't voted yet */}
        {selectedPoll && pollItems.length > 0 && !hasVoted && (
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: allQuestionsAnswered() ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={handleSubmitVotes}
              disabled={userVotes.length === 0 || isVoting}
            >
              <CheckCircle size={18} color={allQuestionsAnswered() ? "#ffffff" : theme.colors.textSecondary} />
              <Text
                style={[
                  styles.submitButtonText,
                  { color: allQuestionsAnswered() ? "#ffffff" : theme.colors.textSecondary }
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {isVoting ? 'Submitting...' : allQuestionsAnswered() ? `Submit Votes` : `${userVotes.length} of ${getAllQuestionIds().size} answered`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  signInButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  pollSelectionCard: {
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
  pollSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pollTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  pollTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentPollCard: {
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
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pollIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pollInfo: {
    flex: 1,
  },
  currentPollTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  currentPollDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  pollStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionsSection: {
    gap: 16,
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  requiredBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  optionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  optionAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  submitSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  thankYouSection: {
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  thankYouCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  thankYouIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  thankYouMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  otherPollsSection: {
    width: '100%',
    alignItems: 'center',
  },
  otherPollsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  otherPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
  },
  otherPollButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
});
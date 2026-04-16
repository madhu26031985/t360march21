import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  fetchLiveVotingSnapshot,
  getCachedLiveVotingSnapshot,
} from '@/lib/liveVotingSnapshot';
import { ArrowLeft, Vote, CircleCheck as CheckCircle, User, Home, Users, Calendar, Settings, Shield } from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';

/** Notion-style neutrals (no red required badge; muted live state) */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  accentSoftBorder: 'rgba(35, 131, 226, 0.28)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  success: '#0F7B6C',
  successSoft: 'rgba(15, 123, 108, 0.12)',
  pillBg: '#F0EFED',
};

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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const hasClub = Boolean(user?.currentClubId);
  const isExComm = user?.clubs?.find((c) => c.id === user.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;
  const FOOTER_NAV_ICON_SIZE = 16;
  
  const cached = user?.currentClubId ? getCachedLiveVotingSnapshot(user.currentClubId) : null;
  const cachedFirstPoll = cached?.polls?.[0] ?? null;
  const [activePolls, setActivePolls] = useState<Poll[]>((cached?.polls as Poll[]) || []);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>((cachedFirstPoll as Poll) || null);
  const [pollItems, setPollItems] = useState<PollItem[]>((cached?.firstPollBundle?.poll_items as PollItem[]) || []);
  const [userVotes, setUserVotes] = useState<UserVote[]>((cached?.firstPollBundle?.user_votes as UserVote[]) || []);
  const [isLoading, setIsLoading] = useState(!cached);
  const [isVoting, setIsVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(!!cached?.firstPollBundle?.has_voted);
  const [votedPolls, setVotedPolls] = useState<Set<string>>(
    () =>
      cached?.firstPollBundle?.has_voted && cachedFirstPoll?.id
        ? new Set([cachedFirstPoll.id])
        : new Set()
  );

  useEffect(() => {
    loadActivePolls();
  }, []);

  useEffect(() => {
    if (!selectedPoll || !user?.id) {
      setPollItems([]);
      setUserVotes([]);
      setHasVoted(false);
      return;
    }

    let cancelled = false;

    const loadBundle = async () => {
      setPollItems([]);
      setUserVotes([]);
      setHasVoted(false);

      try {
        const { data, error } = await (supabase as any).rpc('get_live_voting_poll_bundle', {
          p_poll_id: selectedPoll.id,
        });

        if (cancelled) return;

        if (error) {
          console.error('Error loading poll bundle:', error);
          return;
        }

        if (data == null || typeof data !== 'object') {
          return;
        }

        const bundle = data as {
          poll_items?: PollItem[];
          user_votes?: UserVote[];
          has_voted?: boolean;
        };

        const items = Array.isArray(bundle.poll_items) ? bundle.poll_items : [];
        const votes = Array.isArray(bundle.user_votes) ? bundle.user_votes : [];
        const voted = !!bundle.has_voted;

        setPollItems(items);
        setUserVotes(votes);
        setHasVoted(voted);

        if (voted) {
          setVotedPolls((prev) => new Set([...prev, selectedPoll.id]));
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error loading poll bundle:', e);
        }
      }
    };

    void loadBundle();
    return () => {
      cancelled = true;
    };
  }, [selectedPoll, user?.id]);

  const loadActivePolls = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const snapshot = await fetchLiveVotingSnapshot(user.currentClubId);
      setActivePolls(snapshot.polls as Poll[]);

      if (snapshot.polls.length > 0) {
        setSelectedPoll((prev) =>
          prev && snapshot.polls.some((poll) => poll.id === prev.id) ? prev : (snapshot.polls[0] as Poll)
        );
        if ((!selectedPoll || selectedPoll.id === snapshot.polls[0].id) && snapshot.firstPollBundle) {
          setPollItems(snapshot.firstPollBundle.poll_items as PollItem[]);
          setUserVotes(snapshot.firstPollBundle.user_votes as UserVote[]);
          setHasVoted(snapshot.firstPollBundle.has_voted);
          if (snapshot.firstPollBundle.has_voted) {
            setVotedPolls((prev) => new Set([...prev, snapshot.polls[0].id]));
          }
        }
      } else {
        setSelectedPoll(null);
        setPollItems([]);
        setUserVotes([]);
        setHasVoted(false);
      }
    } catch (error) {
      console.error('Error loading active polls:', error);
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading polls…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.accessDeniedContainer}>
          <Vote size={48} color={N.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.accessDeniedTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Club access required
          </Text>
          <Text style={[styles.accessDeniedMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to participate in voting.
          </Text>
          <TouchableOpacity style={[styles.signInButton, { backgroundColor: N.text }]} onPress={() => router.replace('/login')}>
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Live voting
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ClubSwitcher showRole variant="notion" />

        {/* Check if user has voted for current poll */}
        {selectedPoll && hasVoted ? (
          <View style={styles.thankYouSection}>
            <View style={[styles.thankYouCard, { backgroundColor: N.surface, borderColor: N.border }]}>
              <View style={[styles.thankYouIcon, { backgroundColor: N.successSoft }]}>
                <CheckCircle size={28} color={N.success} strokeWidth={2} />
              </View>
              <Text style={[styles.thankYouTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Thanks for voting
              </Text>
              <Text style={[styles.thankYouMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Your votes for "{selectedPoll.title}" have been submitted successfully.
              </Text>

              {activePolls.filter((p) => !votedPolls.has(p.id)).length > 0 && (
                <View style={styles.otherPollsSection}>
                  <Text style={[styles.otherPollsTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    Other polls
                  </Text>
                  {activePolls
                    .filter((p) => !votedPolls.has(p.id))
                    .map((poll) => (
                      <TouchableOpacity
                        key={poll.id}
                        style={[styles.otherPollButton, { backgroundColor: N.text, borderColor: N.text }]}
                        onPress={() => setSelectedPoll(poll)}
                        activeOpacity={0.85}
                      >
                        <Vote size={16} color={N.surface} strokeWidth={2} />
                        <Text style={styles.otherPollButtonText} maxFontSizeMultiplier={1.3}>
                          {poll.title}
                        </Text>
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
              <View style={[styles.pollSelectionCard, { backgroundColor: N.surface, borderColor: N.border, borderWidth: 1 }]}>
                <Text style={[styles.pollSelectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  Select poll
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {activePolls.map((poll) => (
                    <TouchableOpacity
                      key={poll.id}
                      style={[
                        styles.pollTab,
                        {
                          backgroundColor: selectedPoll?.id === poll.id ? N.text : N.page,
                          borderColor: selectedPoll?.id === poll.id ? N.text : N.border,
                        },
                      ]}
                      onPress={() => setSelectedPoll(poll)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.pollTabText, { color: selectedPoll?.id === poll.id ? N.surface : N.text }]}
                        maxFontSizeMultiplier={1.3}
                      >
                        {poll.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Current Poll */}
            {selectedPoll && (
              <View style={[styles.currentPollCard, { backgroundColor: N.surface, borderColor: N.border }]}>
                <View style={styles.pollHeader}>
                  <View style={[styles.pollIcon, { backgroundColor: N.iconTile }]}>
                    <Vote size={20} color={N.accent} strokeWidth={1.75} />
                  </View>
                  <View style={styles.pollInfo}>
                    <Text style={[styles.currentPollTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      {selectedPoll.title}
                    </Text>
                    {selectedPoll.description && (
                      <Text style={[styles.currentPollDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {selectedPoll.description}
                      </Text>
                    )}
                    <View style={styles.pollStatus}>
                      <View style={[styles.liveIndicator, { backgroundColor: N.textTertiary }]} />
                      <Text style={[styles.liveText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        Live poll
                      </Text>
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
                      <View
                        key={questionId}
                        style={[
                          styles.questionCard,
                          {
                            backgroundColor: N.surface,
                            borderWidth: 1,
                            borderColor: userVote ? N.accentSoftBorder : N.border,
                          },
                        ]}
                      >
                        <View style={styles.questionHeader}>
                          <Text style={[styles.questionText, { color: N.text, flex: 1 }]} maxFontSizeMultiplier={1.3}>
                            {questionOrder + 1}. {questionText}
                          </Text>
                          {userVote ? (
                            <CheckCircle size={18} color={N.success} strokeWidth={2} />
                          ) : (
                            <View style={[styles.requiredBadge, { backgroundColor: N.pillBg, borderColor: N.border }]}>
                              <Text style={[styles.requiredText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                                Required
                              </Text>
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
                                    backgroundColor: isSelected ? N.accentSoft : N.surface,
                                    borderColor: isSelected ? N.accentSoftBorder : N.border,
                                  },
                                ]}
                                onPress={() => handleVote(questionId, item.option_id)}
                                disabled={isVoting || hasVoted}
                              >
                                <View
                                  style={[
                                    styles.optionRadio,
                                    {
                                      backgroundColor: isSelected ? N.accent : 'transparent',
                                      borderColor: isSelected ? N.accent : N.border,
                                    },
                                  ]}
                                >
                                  {isSelected && <CheckCircle size={12} color="#ffffff" strokeWidth={2} />}
                                </View>
                                {item.avatar_url ? (
                                  <Image source={{ uri: item.avatar_url }} style={styles.optionAvatar} resizeMode="cover" />
                                ) : (
                                  <View style={[styles.optionAvatarPlaceholder, { backgroundColor: N.iconTile }]}>
                                    <User size={14} color={N.iconMuted} strokeWidth={2} />
                                  </View>
                                )}
                                <Text
                                  style={[styles.optionText, { color: isSelected ? N.accent : N.text }]}
                                  maxFontSizeMultiplier={1.3}
                                >
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
            <Vote size={44} color={N.iconMuted} strokeWidth={1.5} />
            <Text style={[styles.emptyStateText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              No active polls
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              There are no published polls right now. Check back later or ask your club admin.
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
                  backgroundColor: allQuestionsAnswered() ? N.text : N.surface,
                  borderColor: N.border,
                },
              ]}
              onPress={handleSubmitVotes}
              disabled={userVotes.length === 0 || isVoting}
              activeOpacity={0.85}
            >
              <CheckCircle
                size={18}
                color={allQuestionsAnswered() ? N.surface : N.textTertiary}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.submitButtonText,
                  { color: allQuestionsAnswered() ? N.surface : N.textSecondary },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                {isVoting
                  ? 'Submitting…'
                  : allQuestionsAnswered()
                    ? 'Submit votes'
                    : `${userVotes.length} of ${getAllQuestionIds().size} answered`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        <View
          style={[
            styles.geBottomDock,
            {
              borderTopColor: N.border,
              backgroundColor: N.surface,
              width: windowWidth,
              paddingBottom:
                Platform.OS === 'web'
                  ? Math.min(Math.max(insets.bottom, 8), 14)
                  : Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View style={styles.tabBarRow}>
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
              </View>
              <Text style={[styles.footerNavLabel, { color: N.text }]}>Home</Text>
            </TouchableOpacity>
            {hasClub ? (
              <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
                </View>
                <Text style={[styles.footerNavLabel, { color: N.text }]}>Club</Text>
              </TouchableOpacity>
            ) : null}
            {hasClub ? (
              <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
                </View>
                <Text style={[styles.footerNavLabel, { color: N.text }]}>Meeting</Text>
              </TouchableOpacity>
            ) : null}
            {isExComm ? (
              <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
                <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                  <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
                </View>
                <Text style={[styles.footerNavLabel, { color: N.text }]}>Admin</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
              </View>
              <Text style={[styles.footerNavLabel, { color: N.text }]}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
    letterSpacing: -0.2,
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
    borderRadius: 4,
    padding: 14,
  },
  pollSelectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  pollTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
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
    borderRadius: 4,
    padding: 16,
    borderWidth: 1,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  pollIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pollInfo: {
    flex: 1,
  },
  currentPollTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
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
    borderRadius: 4,
    padding: 14,
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
    borderWidth: 1,
    borderRadius: 4,
    padding: 11,
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
    paddingTop: 16,
    paddingBottom: 28,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    paddingVertical: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.15,
  },
  thankYouSection: {
    paddingHorizontal: 16,
    paddingTop: 32,
  },
  thankYouCard: {
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  thankYouIcon: {
    width: 64,
    height: 64,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 8,
    width: '100%',
    justifyContent: 'center',
    borderWidth: 1,
  },
  otherPollButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
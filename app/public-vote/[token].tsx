import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, CircleCheck as CheckCircle, Vote } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';

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
  success: '#0F7B6C',
  successSoft: 'rgba(15, 123, 108, 0.12)',
};

const GUEST_SESSION_KEY = 'public-voting-guest-session-id';

interface PublicPoll {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_public: boolean;
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
}

interface PublicPollBundle {
  poll?: PublicPoll | null;
  poll_items?: PollItem[];
  has_voted?: boolean;
  is_open?: boolean;
  error?: string | null;
}

function makeGuestSessionId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

async function ensureGuestSessionId(): Promise<string> {
  const existing = (await AsyncStorage.getItem(GUEST_SESSION_KEY))?.trim();
  if (existing) return existing;
  const next = makeGuestSessionId();
  await AsyncStorage.setItem(GUEST_SESSION_KEY, next);
  return next;
}

export default function PublicVoteScreen() {
  const params = useLocalSearchParams();
  const token = typeof params.token === 'string' ? params.token : params.token?.[0] || '';

  const [guestSessionId, setGuestSessionId] = useState('');
  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [pollItems, setPollItems] = useState<PollItem[]>([]);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string>>({});
  const [hasVoted, setHasVoted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setErrorState('invalid_link');
        setIsLoading(false);
        return;
      }

      try {
        const sessionId = await ensureGuestSessionId();
        if (cancelled) return;
        setGuestSessionId(sessionId);

        const { data, error } = await (supabase as any).rpc('get_public_poll_bundle', {
          p_public_token: token,
          p_guest_session_id: sessionId,
        });

        if (cancelled) return;

        if (error) {
          console.error('Error loading public poll:', error);
          setErrorState('load_failed');
          return;
        }

        const bundle = (data || {}) as PublicPollBundle;
        const nextPoll = bundle.poll || null;

        setPoll(nextPoll);
        setPollItems(Array.isArray(bundle.poll_items) ? bundle.poll_items : []);
        setHasVoted(!!bundle.has_voted);
        setIsOpen(!!bundle.is_open);
        setErrorState(bundle.error || (!nextPoll ? 'not_found' : null));
        setSelectedVotes({});
      } catch (e) {
        console.error('Error loading public poll:', e);
        if (!cancelled) setErrorState('load_failed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const groupedQuestions = useMemo(() => {
    const grouped: Record<string, { questionOrder: number; questionText: string; items: PollItem[] }> = {};

    pollItems.forEach((item) => {
      if (!grouped[item.question_id]) {
        grouped[item.question_id] = {
          questionOrder: item.question_order,
          questionText: item.question_text,
          items: [],
        };
      }
      grouped[item.question_id].items.push(item);
    });

    return Object.entries(grouped)
      .map(([questionId, value]) => ({
        questionId,
        questionOrder: value.questionOrder,
        questionText: value.questionText,
        items: value.items.sort((a, b) => a.option_order - b.option_order),
      }))
      .sort((a, b) => a.questionOrder - b.questionOrder);
  }, [pollItems]);

  const allAnswered =
    groupedQuestions.length > 0 &&
    groupedQuestions.every((question) => Boolean(selectedVotes[question.questionId]));

  const disabled = hasVoted || !isOpen || isSubmitting;

  const selectVote = (questionId: string, optionId: string) => {
    if (disabled) return;
    setSelectedVotes((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const submitVotes = async () => {
    if (!poll || !guestSessionId || disabled) return;

    if (!allAnswered) {
      Alert.alert('Answer all questions', 'Please select one option for every question before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const votes = groupedQuestions.map((question) => ({
        question_id: question.questionId,
        option_id: selectedVotes[question.questionId],
      }));

      const { data, error } = await (supabase as any).rpc('submit_public_poll_votes', {
        p_public_token: token,
        p_guest_session_id: guestSessionId,
        p_votes: votes,
      });

      if (error) {
        console.error('Error submitting public votes:', error);
        Alert.alert('Unable to submit', 'Please try again.');
        return;
      }

      const result = (data || {}) as { ok?: boolean; error?: string };

      if (!result.ok) {
        if (result.error === 'already_voted') {
          setHasVoted(true);
          Alert.alert('Already submitted', 'This device has already voted for this poll.');
          return;
        }

        if (result.error === 'closed') {
          setIsOpen(false);
          Alert.alert('Poll closed', 'This poll is no longer accepting votes.');
          return;
        }

        Alert.alert('Unable to submit', 'Please try again.');
        return;
      }

      setHasVoted(true);
      Alert.alert('Vote submitted', 'Thanks for participating.');
    } catch (e) {
      console.error('Error submitting public votes:', e);
      Alert.alert('Unable to submit', 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderEmptyState = (title: string, message: string) => (
    <View style={styles.centerState}>
      <View style={[styles.stateIconWrap, { backgroundColor: N.accentSoft }]}>
        <Vote size={28} color={N.accent} strokeWidth={1.8} />
      </View>
      <Text style={[styles.stateTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <Text style={[styles.stateMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
        {message}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={N.accent} />
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading poll...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorState === 'invalid_link' || errorState === 'not_found' || !poll) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color={N.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Public voting
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {renderEmptyState('Poll unavailable', 'This voting link is invalid or no longer available.')}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={N.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Public voting
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: N.surface, borderColor: N.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: hasVoted ? N.successSoft : N.accentSoft }]}>
            {hasVoted ? (
              <CheckCircle size={22} color={N.success} strokeWidth={2} />
            ) : (
              <Vote size={22} color={N.accent} strokeWidth={1.8} />
            )}
          </View>
          <Text style={[styles.pollTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            {poll.title}
          </Text>
          {poll.description ? (
            <Text style={[styles.pollDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {poll.description}
            </Text>
          ) : null}
          <Text style={[styles.pollMeta, { color: N.textTertiary }]} maxFontSizeMultiplier={1.2}>
            {hasVoted ? 'Anonymous vote received' : isOpen ? 'Anonymous voting is open' : 'This poll is closed'}
          </Text>
        </View>

        {hasVoted ? (
          renderEmptyState(
            'Thanks for voting',
            'This browser/device session has already submitted an anonymous response for this poll.'
          )
        ) : !isOpen ? (
          renderEmptyState('Poll closed', 'This public voting link is no longer accepting responses.')
        ) : groupedQuestions.length === 0 ? (
          renderEmptyState('No questions', 'This poll does not have any active questions yet.')
        ) : (
          <>
            {groupedQuestions.map((question, index) => (
              <View key={question.questionId} style={[styles.questionCard, { backgroundColor: N.surface, borderColor: N.border }]}>
                <View style={styles.questionHeader}>
                  <Text style={[styles.questionEyebrow, { color: N.textTertiary }]} maxFontSizeMultiplier={1.2}>
                    Question {index + 1}
                  </Text>
                  <Text style={[styles.questionText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {question.questionText}
                  </Text>
                </View>

                <View style={styles.optionList}>
                  {question.items.map((item) => {
                    const selected = selectedVotes[question.questionId] === item.option_id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.optionButton,
                          {
                            backgroundColor: selected ? N.accentSoft : N.surface,
                            borderColor: selected ? N.accentSoftBorder : N.border,
                          },
                        ]}
                        onPress={() => selectVote(question.questionId, item.option_id)}
                        activeOpacity={0.85}
                        disabled={disabled}
                      >
                        <View
                          style={[
                            styles.optionDot,
                            {
                              backgroundColor: selected ? N.accent : 'transparent',
                              borderColor: selected ? N.accent : N.border,
                            },
                          ]}
                        >
                          {selected ? <Check size={12} color="#ffffff" strokeWidth={2.5} /> : null}
                        </View>
                        <Text
                          style={[styles.optionText, { color: selected ? N.accent : N.text }]}
                          maxFontSizeMultiplier={1.3}
                        >
                          {item.option_text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: allAnswered ? N.accent : '#cbd5e1',
                  opacity: isSubmitting ? 0.8 : 1,
                },
              ]}
              onPress={submitVotes}
              activeOpacity={0.85}
              disabled={!allAnswered || disabled}
            >
              <Text style={styles.submitButtonText} maxFontSizeMultiplier={1.3}>
                {isSubmitting ? 'Submitting...' : 'Submit anonymous vote'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  pollDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  pollMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  questionHeader: {
    gap: 6,
  },
  questionEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  optionList: {
    gap: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  stateIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
});


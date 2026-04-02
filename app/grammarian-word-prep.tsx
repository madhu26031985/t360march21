import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, BookOpen, Lightbulb, MessageSquareQuote, AlertCircle, X, Info, Save } from 'lucide-react-native';
import { grammarianDailyPrepStyles as styles } from '@/components/grammarian/grammarianDailyPrepStyles';

interface GrammarianOfDay {
  id: string;
  assigned_user_id: string | null;
}

interface WordOfTheDayData {
  id: string;
  word: string;
  part_of_speech: string | null;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
  updated_at: string;
}

type WordPrepSnapshot = {
  assigned_grammarian_user_id: string | null;
  is_vpe_for_club: boolean;
  word_of_the_day: WordOfTheDayData | null;
};

export default function GrammarianWordPrepScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [grammarianOfDay, setGrammarianOfDay] = useState<GrammarianOfDay | null>(null);
  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDayData | null>(null);
  const [word, setWord] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [meaning, setMeaning] = useState('');
  const [usage, setUsage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadAtRef = useRef<number>(0);

  const isAssignedGrammarian = () => grammarianOfDay?.assigned_user_id === user?.id;
  const canEditWordPrep = () => isAssignedGrammarian() || isVPEClub;
  const effectiveGrammarianUserId = grammarianOfDay?.assigned_user_id || user?.id || null;
  const firstName = (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'there';

  const showSavedPopup = () => {
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 1200);
  };

  const loadGrammarianRole = async (): Promise<string | null> => {
    if (!meetingId) return;
    const { data, error } = await supabase
      .from('app_meeting_roles_management')
      .select('id, assigned_user_id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%grammarian%')
      .eq('booking_status', 'booked')
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading grammarian role:', error);
      return null;
    }
    setGrammarianOfDay(data);
    return data?.assigned_user_id || null;
  };

  const loadIsVPEClub = async () => {
    if (!user?.currentClubId || !user?.id) {
      setIsVPEClub(false);
      return;
    }
    const { data, error } = await supabase
      .from('club_profiles')
      .select('vpe_id')
      .eq('club_id', user.currentClubId)
      .maybeSingle();
    if (error) {
      console.error('Error loading club VPE:', error);
      setIsVPEClub(false);
      return;
    }
    setIsVPEClub(data?.vpe_id === user.id);
  };

  const loadWord = useCallback(async (targetGrammarianUserId?: string | null) => {
    const grammarianUserId = targetGrammarianUserId ?? effectiveGrammarianUserId;
    if (!meetingId || !grammarianUserId) return;
    const { data, error } = await supabase
      .from('grammarian_word_of_the_day')
      .select('id, word, part_of_speech, meaning, usage, is_published, updated_at')
      .eq('meeting_id', meetingId)
      .eq('grammarian_user_id', grammarianUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading word of the day:', error);
      return;
    }

    if (data) {
      setWordOfTheDay(data);
      setWord((data.word || '').slice(0, 50));
      setPartOfSpeech((data.part_of_speech || '').slice(0, 50));
      setMeaning((data.meaning || '').slice(0, 150));
      setUsage((data.usage || '').slice(0, 150));
    } else {
      setWordOfTheDay(null);
      setWord('');
      setPartOfSpeech('');
      setMeaning('');
      setUsage('');
    }
  }, [meetingId, effectiveGrammarianUserId]);

  const loadAll = useCallback(async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    if (loadInFlightRef.current) return loadInFlightRef.current;
    if (Date.now() - lastLoadAtRef.current < 1000) return;

    const run = (async () => {
      setIsLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc('get_grammarian_word_prep_snapshot', {
          p_meeting_id: meetingId,
        });

        if (!error && data && typeof data === 'object' && !Array.isArray(data)) {
          const snap = data as WordPrepSnapshot;
          setGrammarianOfDay(
            snap.assigned_grammarian_user_id
              ? { id: 'snapshot', assigned_user_id: snap.assigned_grammarian_user_id }
              : null
          );
          setIsVPEClub(Boolean(snap.is_vpe_for_club));

          if (snap.word_of_the_day) {
            const w = snap.word_of_the_day;
            setWordOfTheDay(w);
            setWord((w.word || '').slice(0, 50));
            setPartOfSpeech((w.part_of_speech || '').slice(0, 50));
            setMeaning((w.meaning || '').slice(0, 150));
            setUsage((w.usage || '').slice(0, 150));
          } else {
            setWordOfTheDay(null);
            setWord('');
            setPartOfSpeech('');
            setMeaning('');
            setUsage('');
          }
        } else {
          const [assignedGrammarianUserId] = await Promise.all([
            loadGrammarianRole(),
            loadIsVPEClub(),
          ]);
          await loadWord(assignedGrammarianUserId || user?.id || null);
        }
      } finally {
        lastLoadAtRef.current = Date.now();
        setIsLoading(false);
        loadInFlightRef.current = null;
      }
    })();
    loadInFlightRef.current = run;
    return run;
  }, [meetingId, user?.currentClubId, user?.id, loadWord]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleSaveWord = async () => {
    if (!canEditWordPrep()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian or club VPE can save word of the day.');
      return;
    }
    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);
    try {
      if (wordOfTheDay) {
        const { error } = await supabase
          .from('grammarian_word_of_the_day')
          .update({
            word: word.trim() || null,
            part_of_speech: partOfSpeech.trim() || null,
            meaning: meaning.trim() || null,
            usage: usage.trim() || null,
            is_published: !!word.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', wordOfTheDay.id);

        if (error) {
          console.error('Error updating word of the day:', error);
          Alert.alert('Error', 'Failed to update word of the day');
          return;
        }
        showSavedPopup();
      } else {
        if (!word.trim()) {
          return;
        }
        const { error } = await supabase.from('grammarian_word_of_the_day').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_user_id: effectiveGrammarianUserId,
          word: word.trim(),
          part_of_speech: partOfSpeech.trim() || null,
          meaning: meaning.trim() || null,
          usage: usage.trim() || null,
          is_published: true,
        });

        if (error) {
          console.error('Error creating word of the day:', error);
          Alert.alert('Error', 'Failed to save word of the day');
          return;
        }
        showSavedPopup();
      }
      await loadWord();
    } catch (e) {
      console.error('Error saving word of the day:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearWord = async () => {
    if (!canEditWordPrep()) return;
    setWord('');
    setPartOfSpeech('');
    setMeaning('');
    setUsage('');
    if (wordOfTheDay) {
      await supabase
        .from('grammarian_word_of_the_day')
        .update({
          word: null,
          part_of_speech: null,
          meaning: null,
          usage: null,
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', wordOfTheDay.id);
      await loadWord();
    }
  };

  if (!meetingId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: theme.colors.text }}>Missing meeting</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!canEditWordPrep()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Word of the Day</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <AlertCircle size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]}>
            Only the assigned Grammarian or club VPE can edit Word of the Day.
          </Text>
          <TouchableOpacity
            style={[localStyles.goBackBtn, { backgroundColor: theme.colors.primary, marginTop: 24 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Word of the Day</Text>
        <TouchableOpacity style={styles.headerSpacer} onPress={() => setShowInfoModal(true)} activeOpacity={0.8}>
          <Info size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.preMeetingContainer}>
            <View style={styles.formContainer}>
              <View style={[localStyles.notionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={localStyles.notionRow}>
                <View style={styles.fieldHeader}>
                  <View style={styles.fieldLabelContainer}>
                    <BookOpen size={18} color="#3b82f6" />
                    <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Word</Text>
                  </View>
                  <Text style={[styles.charCount, { color: word.length >= 50 ? '#ef4444' : theme.colors.textSecondary }]}>
                    {word.length}/50
                  </Text>
                </View>
                <TextInput
                  style={[styles.fieldInput, localStyles.compactInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder=""
                  placeholderTextColor={theme.colors.textSecondary}
                  value={word}
                  onChangeText={(t) => t.length <= 50 && setWord(t)}
                  maxLength={50}
                  returnKeyType="next"
                />
              </View>
              <View style={[localStyles.notionDivider, { backgroundColor: theme.colors.border }]} />

              <View style={localStyles.notionRow}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <BookOpen size={18} color="#3b82f6" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Part of Speech</Text>
                </View>
                <Text style={[styles.charCount, { color: partOfSpeech.length >= 50 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {partOfSpeech.length}/50
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInput, localStyles.compactInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder=""
                placeholderTextColor={theme.colors.textSecondary}
                value={partOfSpeech}
                onChangeText={(t) => t.length <= 50 && setPartOfSpeech(t)}
                maxLength={50}
              />
              </View>
              <View style={[localStyles.notionDivider, { backgroundColor: theme.colors.border }]} />

              <View style={localStyles.notionRow}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <Lightbulb size={18} color="#f59e0b" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Meaning</Text>
                </View>
                <Text style={[styles.charCount, { color: meaning.length >= 150 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {meaning.length}/150
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, localStyles.compactMultilineInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder=""
                placeholderTextColor={theme.colors.textSecondary}
                value={meaning}
                onChangeText={(t) => t.length <= 150 && setMeaning(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
              </View>
              <View style={[localStyles.notionDivider, { backgroundColor: theme.colors.border }]} />

              <View style={localStyles.notionRow}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <MessageSquareQuote size={18} color="#8b5cf6" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Usage</Text>
                </View>
                <Text style={[styles.charCount, { color: usage.length >= 150 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {usage.length}/150
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, localStyles.compactMultilineInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder=""
                placeholderTextColor={theme.colors.textSecondary}
                value={usage}
                onChangeText={(t) => t.length <= 150 && setUsage(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
              </View>
              </View>

            <View style={styles.actionButtons}>
              {(word || partOfSpeech || meaning || usage) ? (
                <TouchableOpacity
                  style={[styles.clearButton, { borderColor: theme.colors.border }]}
                  onPress={handleClearWord}
                  disabled={isSaving}
                >
                  <X size={18} color={theme.colors.textSecondary} />
                  <Text style={[styles.clearButtonText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.saveDraftButton, { backgroundColor: isSaving ? '#9ca3af' : theme.colors.primary, flex: 1 }]}
                onPress={handleSaveWord}
                disabled={isSaving}
              >
                <Save size={18} color="#ffffff" />
                <Text style={styles.saveDraftButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            {wordOfTheDay && (
              <Text style={[styles.lastSaved, { color: theme.colors.textSecondary }]}>
                Last saved:{' '}
                {new Date(wordOfTheDay.updated_at).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </Text>
            )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSaveConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSaveConfirmation(false)}
      >
        <View style={localStyles.confirmOverlay}>
          <View style={[localStyles.confirmCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[localStyles.confirmTitle, { color: theme.colors.text }]}>Saved</Text>
            <Text style={[localStyles.confirmBody, { color: theme.colors.textSecondary }]}>
              Word of the Day saved successfully.
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={localStyles.confirmOverlay}>
          <View style={[localStyles.confirmCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[localStyles.confirmTitle, { color: theme.colors.text }]}>How this works</Text>
            <Text style={[localStyles.confirmBody, { color: theme.colors.textSecondary }]}>
              {`Hello ${firstName}, you are the Grammarian of the Day!\n\nAfter entering the Word of the Day details, tap Save to publish your updates. All members will be able to view it in the Grammarian Summary.`}
            </Text>
            <TouchableOpacity
              style={[localStyles.infoOkBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
              activeOpacity={0.85}
            >
              <Text style={localStyles.infoOkBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  notionCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  notionRow: {
    paddingVertical: 6,
  },
  notionDivider: {
    height: 1,
    opacity: 0.55,
  },
  compactInput: {
    minHeight: 32,
    paddingVertical: 6,
    fontSize: 13,
  },
  compactMultilineInput: {
    minHeight: 54,
    paddingVertical: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  goBackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoOkBtn: {
    marginTop: 14,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  infoOkBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

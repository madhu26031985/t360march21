import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, BookOpen, Lightbulb, MessageSquareQuote, AlertCircle, X } from 'lucide-react-native';
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

  const isGrammarianOfDay = () => grammarianOfDay?.assigned_user_id === user?.id;

  const loadGrammarianRole = async () => {
    if (!meetingId) return;
    const { data, error } = await supabase
      .from('app_meeting_roles_management')
      .select('id, assigned_user_id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%grammarian%')
      .eq('role_status', 'Available')
      .eq('booking_status', 'booked')
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.error('Error loading grammarian role:', error);
      return;
    }
    setGrammarianOfDay(data);
  };

  const loadWord = useCallback(async () => {
    if (!meetingId || !user?.id) return;
    const { data, error } = await supabase
      .from('grammarian_word_of_the_day')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('grammarian_user_id', user.id)
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
  }, [meetingId, user?.id]);

  const loadAll = useCallback(async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    await loadGrammarianRole();
    await loadWord();
    setIsLoading(false);
  }, [meetingId, user?.currentClubId, loadWord]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleSaveWord = async () => {
    if (!isGrammarianOfDay()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian can save word of the day.');
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
        Alert.alert('Success', 'Word of the day saved successfully');
      } else {
        if (!word.trim()) {
          return;
        }
        const { error } = await supabase.from('grammarian_word_of_the_day').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_user_id: user.id,
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
        Alert.alert('Success', 'Word of the day saved successfully');
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
    if (!isGrammarianOfDay()) return;
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

  if (!isGrammarianOfDay()) {
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
            Only the assigned Grammarian can edit Word of the Day.
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
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.preMeetingContainer}>
          <View style={styles.formContainer}>
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
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
                style={[styles.fieldInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter word of the day"
                placeholderTextColor={theme.colors.textSecondary}
                value={word}
                onChangeText={(t) => t.length <= 50 && setWord(t)}
                maxLength={50}
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
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
                style={[styles.fieldInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., Adjective"
                placeholderTextColor={theme.colors.textSecondary}
                value={partOfSpeech}
                onChangeText={(t) => t.length <= 50 && setPartOfSpeech(t)}
                maxLength={50}
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
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
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Good at convincing someone to believe or do something through reasoning or emotion."
                placeholderTextColor={theme.colors.textSecondary}
                value={meaning}
                onChangeText={(t) => t.length <= 150 && setMeaning(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
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
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="His persuasive speech motivated the audience to take action."
                placeholderTextColor={theme.colors.textSecondary}
                value={usage}
                onChangeText={(t) => t.length <= 150 && setUsage(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
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
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  goBackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
});

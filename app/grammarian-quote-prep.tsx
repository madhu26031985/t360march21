import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, MessageSquareQuote, Lightbulb, AlertCircle, X } from 'lucide-react-native';
import { grammarianDailyPrepStyles as styles } from '@/components/grammarian/grammarianDailyPrepStyles';

interface GrammarianOfDay {
  id: string;
  assigned_user_id: string | null;
}

interface QuoteOfTheDayData {
  id: string;
  quote: string;
  meaning: string | null;
  is_published: boolean;
  updated_at: string;
}

export default function GrammarianQuotePrepScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [grammarianOfDay, setGrammarianOfDay] = useState<GrammarianOfDay | null>(null);
  const [quoteOfTheDay, setQuoteOfTheDay] = useState<QuoteOfTheDayData | null>(null);
  const [quote, setQuote] = useState('');
  const [quoteMeaning, setQuoteMeaning] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);

  const isAssignedGrammarian = () => grammarianOfDay?.assigned_user_id === user?.id;
  const canEditQuotePrep = () => isAssignedGrammarian() || isVPEClub;
  const effectiveGrammarianUserId = grammarianOfDay?.assigned_user_id || user?.id || null;

  const showSavedPopup = () => {
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 1200);
  };

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

  const loadQuote = useCallback(async () => {
    if (!meetingId || !effectiveGrammarianUserId) return;
    const { data, error } = await supabase
      .from('grammarian_quote_of_the_day')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('grammarian_user_id', effectiveGrammarianUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading quote of the day:', error);
      return;
    }

    if (data) {
      setQuoteOfTheDay(data);
      setQuote((data.quote || '').slice(0, 150));
      setQuoteMeaning((data.meaning || '').slice(0, 400));
    } else {
      setQuoteOfTheDay(null);
      setQuote('');
      setQuoteMeaning('');
    }
  }, [meetingId, effectiveGrammarianUserId]);

  const loadAll = useCallback(async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    await loadGrammarianRole();
    await loadIsVPEClub();
    await loadQuote();
    setIsLoading(false);
  }, [meetingId, user?.currentClubId, loadQuote]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleSave = async () => {
    if (!canEditQuotePrep()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian or club VPE can save quote of the day.');
      return;
    }
    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);
    try {
      if (quoteOfTheDay) {
        const { error } = await supabase
          .from('grammarian_quote_of_the_day')
          .update({
            quote: quote.trim() || null,
            meaning: quoteMeaning.trim() || null,
            is_published: !!quote.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', quoteOfTheDay.id);

        if (error) {
          console.error('Error updating quote of the day:', error);
          Alert.alert('Error', 'Failed to update quote of the day');
          return;
        }
        showSavedPopup();
      } else {
        if (!quote.trim()) {
          return;
        }
        const { error } = await supabase.from('grammarian_quote_of_the_day').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_user_id: effectiveGrammarianUserId,
          quote: quote.trim(),
          meaning: quoteMeaning.trim() || null,
          is_published: true,
        });

        if (error) {
          console.error('Error creating quote of the day:', error);
          Alert.alert('Error', 'Failed to save quote of the day');
          return;
        }
        showSavedPopup();
      }
      await loadQuote();
    } catch (e) {
      console.error('Error saving quote:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!canEditQuotePrep()) return;
    setQuote('');
    setQuoteMeaning('');
    if (quoteOfTheDay) {
      await supabase
        .from('grammarian_quote_of_the_day')
        .update({
          quote: null,
          meaning: null,
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteOfTheDay.id);
      await loadQuote();
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

  if (!canEditQuotePrep()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Quote of the Day</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <AlertCircle size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]}>
            Only the assigned Grammarian or club VPE can edit Quote of the Day.
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Quote of the Day</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.preMeetingContainer}>
          <View style={styles.formContainer}>
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <MessageSquareQuote size={18} color="#8b5cf6" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Quote</Text>
                </View>
                <Text style={[styles.charCount, { color: quote.length >= 150 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {quote.length}/150
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter quote of the day"
                placeholderTextColor={theme.colors.textSecondary}
                value={quote}
                onChangeText={(t) => t.length <= 150 && setQuote(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <Lightbulb size={18} color="#f59e0b" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Meaning</Text>
                </View>
                <Text style={[styles.charCount, { color: quoteMeaning.length >= 400 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {quoteMeaning.length}/400
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Explain the meaning"
                placeholderTextColor={theme.colors.textSecondary}
                value={quoteMeaning}
                onChangeText={(t) => t.length <= 400 && setQuoteMeaning(t)}
                multiline
                maxLength={400}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.actionButtons}>
              {(quote || quoteMeaning) ? (
                <TouchableOpacity
                  style={[styles.clearButton, { borderColor: theme.colors.border }]}
                  onPress={handleClear}
                  disabled={isSaving}
                >
                  <X size={18} color={theme.colors.textSecondary} />
                  <Text style={[styles.clearButtonText, { color: theme.colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[styles.saveDraftButton, { backgroundColor: isSaving ? '#9ca3af' : theme.colors.primary, flex: 1 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Save size={18} color="#ffffff" />
                <Text style={styles.saveDraftButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>

            {quoteOfTheDay && (
              <Text style={[styles.lastSaved, { color: theme.colors.textSecondary }]}>
                Last saved:{' '}
                {new Date(quoteOfTheDay.updated_at).toLocaleString('en-US', {
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
              Quote of the Day saved successfully.
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
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
});

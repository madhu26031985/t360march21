import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Lightbulb, MessageSquareQuote, AlertCircle, X } from 'lucide-react-native';
import { grammarianDailyPrepStyles as styles } from '@/components/grammarian/grammarianDailyPrepStyles';

interface GrammarianOfDay {
  id: string;
  assigned_user_id: string | null;
}

interface IdiomOfTheDayData {
  id: string;
  idiom: string;
  meaning: string | null;
  usage: string | null;
  is_published: boolean;
  updated_at: string;
}

export default function GrammarianIdiomPrepScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [grammarianOfDay, setGrammarianOfDay] = useState<GrammarianOfDay | null>(null);
  const [idiomOfTheDay, setIdiomOfTheDay] = useState<IdiomOfTheDayData | null>(null);
  const [idiom, setIdiom] = useState('');
  const [idiomMeaning, setIdiomMeaning] = useState('');
  const [idiomUsage, setIdiomUsage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [isVPEClub, setIsVPEClub] = useState(false);

  const isAssignedGrammarian = () => grammarianOfDay?.assigned_user_id === user?.id;
  const canEditIdiomPrep = () => isAssignedGrammarian() || isVPEClub;
  const effectiveGrammarianUserId = grammarianOfDay?.assigned_user_id || user?.id || null;

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

  const loadIdiom = useCallback(async (targetGrammarianUserId?: string | null) => {
    const grammarianUserId = targetGrammarianUserId ?? effectiveGrammarianUserId;
    if (!meetingId || !grammarianUserId) return;
    const { data, error } = await supabase
      .from('grammarian_idiom_of_the_day')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('grammarian_user_id', grammarianUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading idiom of the day:', error);
      return;
    }

    if (data) {
      setIdiomOfTheDay(data);
      setIdiom(data.idiom || '');
      setIdiomMeaning((data.meaning || '').slice(0, 150));
      setIdiomUsage((data.usage || '').slice(0, 150));
    } else {
      setIdiomOfTheDay(null);
      setIdiom('');
      setIdiomMeaning('');
      setIdiomUsage('');
    }
  }, [meetingId, effectiveGrammarianUserId]);

  const loadAll = useCallback(async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const assignedGrammarianUserId = await loadGrammarianRole();
    await loadIsVPEClub();
    await loadIdiom(assignedGrammarianUserId || user?.id || null);
    setIsLoading(false);
  }, [meetingId, user?.currentClubId, user?.id, loadIdiom]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleSave = async () => {
    if (!canEditIdiomPrep()) {
      Alert.alert('Access Denied', 'Only the assigned Grammarian or club VPE can save idiom of the day.');
      return;
    }
    if (!meetingId || !user?.currentClubId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setIsSaving(true);
    try {
      if (idiomOfTheDay) {
        const { error } = await supabase
          .from('grammarian_idiom_of_the_day')
          .update({
            idiom: idiom.trim() || null,
            meaning: idiomMeaning.trim() || null,
            usage: idiomUsage.trim() || null,
            is_published: !!idiom.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', idiomOfTheDay.id);

        if (error) {
          console.error('Error updating idiom of the day:', error);
          Alert.alert('Error', 'Failed to update idiom of the day');
          return;
        }
        showSavedPopup();
      } else {
        if (!idiom.trim()) {
          return;
        }
        const { error } = await supabase.from('grammarian_idiom_of_the_day').insert({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          grammarian_user_id: effectiveGrammarianUserId,
          idiom: idiom.trim(),
          meaning: idiomMeaning.trim() || null,
          usage: idiomUsage.trim() || null,
          is_published: true,
        });

        if (error) {
          console.error('Error creating idiom of the day:', error);
          Alert.alert('Error', 'Failed to save idiom of the day');
          return;
        }
        showSavedPopup();
      }
      await loadIdiom();
    } catch (e) {
      console.error('Error saving idiom:', e);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!canEditIdiomPrep()) return;
    setIdiom('');
    setIdiomMeaning('');
    setIdiomUsage('');
    if (idiomOfTheDay) {
      await supabase
        .from('grammarian_idiom_of_the_day')
        .update({
          idiom: null,
          meaning: null,
          usage: null,
          is_published: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', idiomOfTheDay.id);
      await loadIdiom();
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

  if (!canEditIdiomPrep()) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Idiom of the Day</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <AlertCircle size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]}>
            Only the assigned Grammarian or club VPE can edit Idiom of the Day.
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Idiom of the Day</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.preMeetingContainer}>
          <View style={styles.formContainer}>
            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <Lightbulb size={18} color="#f59e0b" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Idiom</Text>
                </View>
                <Text style={[styles.charCount, { color: idiom.length >= 200 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {idiom.length}/200
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter idiom of the day"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiom}
                onChangeText={(t) => t.length <= 200 && setIdiom(t)}
                maxLength={200}
              />
            </View>

            <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }]}>
              <View style={styles.fieldHeader}>
                <View style={styles.fieldLabelContainer}>
                  <Lightbulb size={18} color="#f59e0b" />
                  <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Meaning</Text>
                </View>
                <Text style={[styles.charCount, { color: idiomMeaning.length >= 150 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {idiomMeaning.length}/150
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Explain the meaning"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiomMeaning}
                onChangeText={(t) => t.length <= 150 && setIdiomMeaning(t)}
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
                <Text style={[styles.charCount, { color: idiomUsage.length >= 150 ? '#ef4444' : theme.colors.textSecondary }]}>
                  {idiomUsage.length}/150
                </Text>
              </View>
              <TextInput
                style={[styles.fieldInputMultiline, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Provide example usage"
                placeholderTextColor={theme.colors.textSecondary}
                value={idiomUsage}
                onChangeText={(t) => t.length <= 150 && setIdiomUsage(t)}
                multiline
                maxLength={150}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.actionButtons}>
              {(idiom || idiomMeaning || idiomUsage) ? (
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

            {idiomOfTheDay && (
              <Text style={[styles.lastSaved, { color: theme.colors.textSecondary }]}>
                Last saved:{' '}
                {new Date(idiomOfTheDay.updated_at).toLocaleString('en-US', {
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
              Idiom of the Day saved successfully.
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

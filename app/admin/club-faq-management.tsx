import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, HelpCircle, ChevronRight, X, Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';

interface ClubFaqItem {
  id: string;
  club_id: string;
  sort_order: number;
  question: string;
  answer: string;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function ClubFaqManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<ClubFaqItem[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [editItem, setEditItem] = useState<ClubFaqItem | null>(null);
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');

  const loadClubInfo = useCallback(async () => {
    if (!user?.currentClubId) return;
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name, club_number')
      .eq('id', user.currentClubId)
      .single();
    if (!error && data) setClubInfo(data);
  }, [user?.currentClubId]);

  const loadFaqs = useCallback(async () => {
    if (!user?.currentClubId) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('club_faq_items')
        .select('id, club_id, sort_order, question, answer')
        .eq('club_id', user.currentClubId)
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Club FAQ load error:', error);
        Alert.alert('Error', error.message || 'Failed to load Club FAQ.');
        setItems([]);
        return;
      }
      setItems((data as ClubFaqItem[]) || []);
    } finally {
      setIsLoading(false);
    }
  }, [user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      void loadClubInfo();
      void loadFaqs();
    }, [loadClubInfo, loadFaqs])
  );

  const openEdit = (row: ClubFaqItem) => {
    setEditItem(row);
    setDraftQuestion(row.question);
    setDraftAnswer(row.answer);
  };

  const closeEdit = () => {
    setEditItem(null);
    setDraftQuestion('');
    setDraftAnswer('');
  };

  const saveEdit = async () => {
    if (!editItem) return;
    const q = draftQuestion.trim();
    const a = draftAnswer.trim();
    if (!q || !a) {
      Alert.alert('Missing fields', 'Please enter both a question and an answer.');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('club_faq_items')
        .update({ question: q, answer: a, updated_at: new Date().toISOString() })
        .eq('id', editItem.id);
      if (error) {
        Alert.alert('Error', error.message || 'Could not save.');
        return;
      }
      setItems((prev) =>
        prev.map((it) => (it.id === editItem.id ? { ...it, question: q, answer: a } : it))
      );
      closeEdit();
    } finally {
      setIsSaving(false);
    }
  };

  const loadDefaults = async () => {
    if (!user?.currentClubId) return;
    setIsSeeding(true);
    try {
      const { error } = await supabase.rpc('ensure_club_faq_defaults_for_my_club', {
        p_club_id: user.currentClubId,
      });
      if (error) {
        Alert.alert('Error', error.message || 'Could not load defaults.');
        return;
      }
      await loadFaqs();
    } finally {
      setIsSeeding(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return EXCOMM_UI.solidBg;
      case 'visiting_tm':
        return '#10b981';
      case 'club_leader':
        return '#f59e0b';
      case 'guest':
        return '#6b7280';
      case 'member':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm':
        return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader':
        return <Shield size={12} color="#ffffff" />;
      case 'guest':
        return <Eye size={12} color="#ffffff" />;
      case 'member':
        return <User size={12} color="#ffffff" />;
      default:
        return <User size={12} color="#ffffff" />;
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return 'ExComm';
      case 'visiting_tm':
        return 'Visiting TM';
      case 'club_leader':
        return 'Club Leader';
      case 'guest':
        return 'Guest';
      case 'member':
        return 'Member';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading Club FAQ…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Club FAQ
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {clubInfo && (
            <View style={[styles.clubCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                {clubInfo.name}
              </Text>
              {user?.clubRole && (
                <View style={[styles.rolePill, { backgroundColor: getRoleColor(user.clubRole) }]}>
                  {getRoleIcon(user.clubRole)}
                  <Text style={styles.rolePillText} maxFontSizeMultiplier={1.2}>
                    {formatRole(user.clubRole)}
                  </Text>
                </View>
              )}
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Default answers are created for new clubs. Edit any question or answer to match your club.
              </Text>
            </View>
          )}

          {items.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <HelpCircle size={36} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                No FAQ entries yet
              </Text>
              <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Load the standard Toastmasters FAQ set (50 items), or confirm your database migration has been applied.
              </Text>
              <TouchableOpacity
                style={[styles.seedButton, { backgroundColor: EXCOMM_UI.solidBg }]}
                onPress={() => void loadDefaults()}
                disabled={isSeeding}
                activeOpacity={0.85}
              >
                {isSeeding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.seedButtonText} maxFontSizeMultiplier={1.2}>
                    Load default questions
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {items.map((row, index) => (
            <TouchableOpacity
              key={row.id}
              style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => openEdit(row)}
              activeOpacity={0.7}
            >
              <View style={styles.rowMain}>
                <Text style={[styles.rowIndex, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {index + 1}.
                </Text>
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.rowQuestion, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                    {row.question}
                  </Text>
                  <Text style={[styles.rowAnswerPreview, { color: theme.colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.15}>
                    {row.answer}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!editItem} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEdit}>
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
              Edit FAQ
            </Text>
            <TouchableOpacity onPress={closeEdit} hitSlop={12} accessibilityLabel="Close">
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
              Question
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
              value={draftQuestion}
              onChangeText={setDraftQuestion}
              multiline
              placeholder="Question"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
              Answer
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.inputTall,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
              value={draftAnswer}
              onChangeText={setDraftAnswer}
              multiline
              placeholder="Answer"
              placeholderTextColor={theme.colors.textSecondary}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: EXCOMM_UI.solidBg }]}
              onPress={() => void saveEdit()}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.2}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 8, width: 44 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  headerRightSpacer: { width: 44 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 10 },
  clubCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  clubName: { fontSize: 17, fontWeight: '600' },
  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rolePillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  seedButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, minWidth: 200, alignItems: 'center' },
  seedButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  rowIndex: { fontSize: 13, fontWeight: '600', width: 28, paddingTop: 2 },
  rowTextWrap: { flex: 1, minWidth: 0, gap: 4 },
  rowQuestion: { fontSize: 15, fontWeight: '600' },
  rowAnswerPreview: { fontSize: 13, lineHeight: 18 },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: 16, paddingBottom: 40 },
  inputLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 48,
  },
  inputTall: { minHeight: 140 },
  saveButton: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, AlertCircle, HelpCircle, ChevronRight, Hash, UserX, Users, Trash2, Plus } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_number: number;
  meeting_status: string;
}

interface ClubMember {
  id: string;
  full_name: string;
}

interface TopicEntry {
  id?: string;
  participant_id: string | null;
  participant_name: string;
  question: string;
}

export default function TableTopicsQuestionerPlaceholder() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isVPE, setIsVPE] = useState(false);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [entries, setEntries] = useState<TopicEntry[]>([]);
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id || !user?.currentClubId) { setLoading(false); return; }
      setLoading(true);
      try {
        await checkVPEStatus();
        await fetchMeetings();
        await fetchMembers();
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.currentClubId, user?.id]);

  const checkVPEStatus = async () => {
    if (!user?.id || !user?.currentClubId) return;
    const { data } = await supabase
      .from('club_profiles')
      .select('vpe_id')
      .eq('club_id', user.currentClubId)
      .maybeSingle();
    setIsVPE(data?.vpe_id === user.id);
  };

  const fetchMeetings = async () => {
    if (!user?.currentClubId) return;
    const { data } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_date, meeting_number, meeting_status')
      .eq('club_id', user.currentClubId)
      .order('meeting_date', { ascending: false });
    setMeetings(data || []);
  };

  const fetchMembers = async () => {
    if (!user?.currentClubId) return;
    const { data: rels } = await supabase
      .from('app_club_user_relationship')
      .select('user_id')
      .eq('club_id', user.currentClubId)
      .eq('is_authenticated', true);
    if (!rels || rels.length === 0) return;
    const ids = rels.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('app_user_profiles')
      .select('id, full_name')
      .in('id', ids)
      .order('full_name');
    setMembers(profiles || []);
  };

  const handleMeetingSelect = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setLoadingMeeting(true);
    setEntries([]);
    try {
      const { data } = await supabase
        .from('app_table_topics_corner')
        .select('id, participant_id, participant_name, table_topic_question')
        .eq('meeting_id', meeting.id)
        .eq('club_id', user!.currentClubId!);
      if (data && data.length > 0) {
        setEntries(data.map((r: any) => ({
          id: r.id,
          participant_id: r.participant_id,
          participant_name: r.participant_name || '',
          question: r.table_topic_question || '',
        })));
      } else {
        setEntries([{ participant_id: null, participant_name: '', question: '' }]);
      }
    } catch (err) {
      console.error('Error loading meeting data:', err);
      setEntries([{ participant_id: null, participant_name: '', question: '' }]);
    } finally {
      setLoadingMeeting(false);
    }
  };

  const addEntry = () => {
    setEntries(prev => [...prev, { participant_id: null, participant_name: '', question: '' }]);
  };

  const removeEntry = (idx: number) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, field: keyof TopicEntry, value: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    if (!selectedMeeting || !user?.id || !user?.currentClubId) return;
    const validEntries = entries.filter(e => e.participant_name.trim());
    if (validEntries.length === 0) {
      Alert.alert('Error', 'At least one participant name is required');
      return;
    }
    try {
      setSaving(true);
      const existingIds = validEntries.filter(e => e.id).map(e => e.id!);
      const newEntries = validEntries.filter(e => !e.id);

      for (const entry of validEntries.filter(e => e.id)) {
        await supabase.from('app_table_topics_corner').update({
          participant_name: entry.participant_name.trim(),
          participant_id: entry.participant_id,
          table_topic_question: entry.question.trim() || null,
        }).eq('id', entry.id!);
      }

      if (newEntries.length > 0) {
        await supabase.from('app_table_topics_corner').insert(
          newEntries.map(e => ({
            meeting_id: selectedMeeting.id,
            club_id: user.currentClubId,
            participant_id: e.participant_id,
            participant_name: e.participant_name.trim(),
            table_topic_question: e.question.trim() || null,
          }))
        );
      }

      Alert.alert('Success', 'Table topics data saved successfully');
      await handleMeetingSelect(selectedMeeting);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  const renderHeader = (showSave = false) => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => selectedMeeting ? setSelectedMeeting(null) : router.back()}
      >
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Backdoor - TT Questioner
      </Text>
      {showSave ? (
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isVPE) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        <View style={styles.centered}>
          <AlertCircle size={64} color={theme.colors.error || '#ef4444'} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Access Denied</Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
            Only the VPE can access this backdoor placeholder entry.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedMeeting) {
    const meetingDate = new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    if (loadingMeeting) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading meeting data...</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {renderHeader(true)}
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.meetingBadge, { backgroundColor: selectedMeeting.meeting_status === 'open' ? '#10b981' + '15' : theme.colors.border }]}>
              <Calendar size={14} color={selectedMeeting.meeting_status === 'open' ? '#10b981' : theme.colors.textSecondary} />
              <Text style={[styles.meetingBadgeText, { color: selectedMeeting.meeting_status === 'open' ? '#10b981' : theme.colors.textSecondary }]}>
                {selectedMeeting.meeting_status === 'open' ? 'Open Meeting' : 'Closed Meeting'}
              </Text>
            </View>
            <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting #{selectedMeeting.meeting_number}
            </Text>
            <Text style={[styles.meetingDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meetingDate}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#0ea5e9' + '10', borderColor: '#0ea5e9' + '30' }]}>
            <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              VPE backdoor: Add or edit table topics questions on behalf of the Table Topics Master.
            </Text>
          </View>

          {entries.map((entry, idx) => (
            <View key={idx} style={[styles.entryCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.entryCardHeader}>
                <View style={[styles.entryBadge, { backgroundColor: '#0ea5e9' + '18' }]}>
                  <Text style={[styles.entryBadgeText, { color: '#0ea5e9' }]} maxFontSizeMultiplier={1.2}>
                    Participant {idx + 1}
                  </Text>
                </View>
                {entries.length > 1 && (
                  <TouchableOpacity onPress={() => removeEntry(idx)} style={styles.removeBtn}>
                    <Trash2 size={16} color={theme.colors.error || '#ef4444'} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                Participant Name <Text style={{ color: theme.colors.error || '#ef4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Enter participant name"
                placeholderTextColor={theme.colors.textSecondary}
                value={entry.participant_name}
                onChangeText={v => updateEntry(idx, 'participant_name', v)}
              />

              <Text style={[styles.fieldLabel, { color: theme.colors.text, marginTop: 12 }]} maxFontSizeMultiplier={1.2}>
                Table Topic Question
              </Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                placeholder="Enter the table topic question (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={entry.question}
                onChangeText={v => updateEntry(idx, 'question', v)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addEntryBtn, { borderColor: '#0ea5e9', backgroundColor: '#0ea5e9' + '0d' }]}
            onPress={addEntry}
            activeOpacity={0.7}
          >
            <Plus size={18} color="#0ea5e9" />
            <Text style={[styles.addEntryText, { color: '#0ea5e9' }]} maxFontSizeMultiplier={1.2}>Add Another Participant</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacing} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {renderHeader()}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.heroIcon, { backgroundColor: '#0ea5e9' + '18' }]}>
            <HelpCircle size={40} color="#0ea5e9" />
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Table Topics Questioner
          </Text>
          <Text style={[styles.heroDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Select a meeting to enter or update table topics questions
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Select a Meeting</Text>

        {meetings.length === 0 ? (
          <View style={styles.centered}>
            <Calendar size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.errorTitle, { color: theme.colors.text }]}>No Meetings Found</Text>
          </View>
        ) : (
          meetings.map(meeting => {
            const date = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            });
            const isOpen = meeting.meeting_status === 'open';
            return (
              <TouchableOpacity
                key={meeting.id}
                style={[styles.meetingListCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleMeetingSelect(meeting)}
                activeOpacity={0.7}
              >
                <View style={[styles.meetingListIcon, { backgroundColor: isOpen ? '#10b981' + '15' : theme.colors.border + '60' }]}>
                  <Hash size={20} color={isOpen ? '#10b981' : theme.colors.textSecondary} />
                </View>
                <View style={styles.meetingListInfo}>
                  <View style={styles.meetingListRow}>
                    <Text style={[styles.meetingListNumber, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      Meeting #{meeting.meeting_number}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: isOpen ? '#10b981' + '20' : theme.colors.border }]}>
                      <Text style={[styles.statusBadgeText, { color: isOpen ? '#10b981' : theme.colors.textSecondary }]}>
                        {isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meetingListDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {date}
                  </Text>
                </View>
                <ChevronRight size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: { width: 72 },
  saveBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },
  errorTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  errorMessage: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  heroDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  meetingListCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  meetingListIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingListInfo: { flex: 1 },
  meetingListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  meetingListNumber: { fontSize: 16, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  meetingListDate: { fontSize: 13 },
  meetingCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    marginBottom: 10,
  },
  meetingBadgeText: { fontSize: 12, fontWeight: '600' },
  meetingTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  meetingDate: { fontSize: 14 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
  },
  infoText: { fontSize: 13, lineHeight: 19 },
  entryCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  entryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  entryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  entryBadgeText: { fontSize: 12, fontWeight: '600' },
  removeBtn: { padding: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
  },
  addEntryText: { fontSize: 14, fontWeight: '600' },
  bottomSpacing: { height: 40 },
});

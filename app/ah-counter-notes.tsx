import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, StickyNote, Users, X, CheckCheck, Save, CircleCheck } from 'lucide-react-native';

type TabType = 'members' | 'notes';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
}

interface ClubMember {
  user_id: string;
  full_name: string;
}

interface AhCounterNotesData {
  id: string;
  meeting_id: string;
  club_id: string;
  ah_counter_user_id: string;
  personal_notes: string | null;
}

export default function AhCounterNotes() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [activeTab, setActiveTab] = useState<TabType>('members');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigned, setIsAssigned] = useState(false);

  // Member selection
  const [allMembers, setAllMembers] = useState<ClubMember[]>([]);
  const [attendingIds, setAttendingIds] = useState<Set<string>>(new Set());
  const [savedAttendingIds, setSavedAttendingIds] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersSaving, setMembersSaving] = useState(false);
  const [membersSaved, setMembersSaved] = useState(false);

  // Notes
  const [notesData, setNotesData] = useState<AhCounterNotesData | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [personalNotes, setPersonalNotes] = useState('');
  const [savedNotes, setSavedNotes] = useState('');

  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const notesSavedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (meetingId && user?.currentClubId) {
      loadAll();
    } else {
      setIsLoading(false);
    }
  }, [meetingId, user?.currentClubId]);

  const loadAll = async () => {
    try {
      await Promise.all([loadMeeting(), loadAssignment()]);
    } catch (e) {
      console.error('Error loading ah counter notes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;
    const { data } = await supabase
      .from('app_club_meeting')
      .select('id, meeting_title, meeting_date, meeting_number')
      .eq('id', meetingId)
      .single();
    if (data) setMeeting(data);
  };

  const loadAssignment = async () => {
    if (!meetingId || !user?.id) return;
    const { data } = await supabase
      .from('app_meeting_roles_management')
      .select('assigned_user_id')
      .eq('meeting_id', meetingId)
      .ilike('role_name', '%Ah Counter%')
      .eq('booking_status', 'booked')
      .not('assigned_user_id', 'is', null)
      .maybeSingle();
    const assigned = data?.assigned_user_id === user.id;
    setIsAssigned(assigned);
    if (assigned) {
      await Promise.all([loadMembers(), loadNotes()]);
    }
  };

  const loadMembers = async () => {
    if (!user?.currentClubId) return;
    setMembersLoading(true);
    try {
      const { data: relationships } = await supabase
        .from('app_club_user_relationship')
        .select('user_id')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      const userIds = (relationships || []).map((r: any) => r.user_id);
      if (userIds.length === 0) { setAllMembers([]); return; }

      const { data: profiles } = await supabase
        .from('app_user_profiles')
        .select('id, full_name')
        .in('id', userIds)
        .order('full_name');

      setAllMembers((profiles || []).map((p: any) => ({ user_id: p.id, full_name: p.full_name })));

      if (meetingId) {
        const { data: tracked } = await supabase
          .from('ah_counter_tracked_members')
          .select('user_id, is_unavailable')
          .eq('meeting_id', meetingId)
          .eq('club_id', user.currentClubId);

        const attending = new Set<string>(
          (tracked || []).filter((t: any) => !t.is_unavailable).map((t: any) => t.user_id as string)
        );
        setAttendingIds(attending);
        setSavedAttendingIds(new Set(attending));
      }
    } catch (e) {
      console.error('Error loading members:', e);
    } finally {
      setMembersLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!meetingId || !user?.id) return;
    const { data } = await supabase
      .from('ah_counter_notes')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('ah_counter_user_id', user.id)
      .maybeSingle();
    if (data) {
      setNotesData(data);
      setPersonalNotes(data.personal_notes || '');
      setSavedNotes(data.personal_notes || '');
    }
  };

  const hasUnsavedMemberChanges = () => {
    if (attendingIds.size !== savedAttendingIds.size) return true;
    for (const id of attendingIds) {
      if (!savedAttendingIds.has(id)) return true;
    }
    return false;
  };

  const hasUnsavedNotesChanges = () => personalNotes !== savedNotes;

  const saveMembers = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) return;
    setMembersSaving(true);
    try {
      const deleteResult = await supabase
        .from('ah_counter_tracked_members')
        .delete()
        .eq('meeting_id', meetingId)
        .eq('club_id', user.currentClubId);

      if (deleteResult.error) throw deleteResult.error;

      if (attendingIds.size > 0) {
        const rows = Array.from(attendingIds).map(uid => ({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          user_id: uid,
          created_by: user.id,
          is_unavailable: false,
        }));
        const insertResult = await supabase
          .from('ah_counter_tracked_members')
          .insert(rows);
        if (insertResult.error) throw insertResult.error;
      }

      setSavedAttendingIds(new Set(attendingIds));
      setMembersSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setMembersSaved(false), 3000);
    } catch (e) {
      console.error('Error saving members:', e);
      Alert.alert('Error', 'Failed to save member selection. Please try again.');
    } finally {
      setMembersSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) return;
    setNotesSaving(true);
    try {
      if (notesData) {
        const { error } = await supabase
          .from('ah_counter_notes')
          .update({ personal_notes: personalNotes.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', notesData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ah_counter_notes')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            ah_counter_user_id: user.id,
            personal_notes: personalNotes.trim() || null,
          })
          .select()
          .single();
        if (error) throw error;
        if (data) setNotesData(data);
      }
      setSavedNotes(personalNotes);
      setNotesSaved(true);
      if (notesSavedTimerRef.current) clearTimeout(notesSavedTimerRef.current);
      notesSavedTimerRef.current = setTimeout(() => setNotesSaved(false), 3000);
    } catch (e) {
      console.error('Error saving notes:', e);
      Alert.alert('Error', 'Failed to save notes. Please try again.');
    } finally {
      setNotesSaving(false);
    }
  };

  const toggleMember = (userId: string) => {
    setAttendingIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    setMembersSaved(false);
  };

  const selectAll = () => {
    setAttendingIds(new Set(allMembers.map(m => m.user_id)));
    setMembersSaved(false);
  };

  const unselectAll = () => {
    setAttendingIds(new Set());
    setMembersSaved(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: theme.colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAssigned) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.center}>
          <StickyNote size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.deniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.deniedMsg, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Personal prep space is only accessible to the assigned Ah Counter.
          </Text>
          <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: theme.colors.primary, marginTop: 24 }]} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const attendingMembers = allMembers.filter(m => attendingIds.has(m.user_id));
  const unsavedMembers = hasUnsavedMemberChanges();
  const unsavedNotes = hasUnsavedNotesChanges();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Space</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && { borderBottomColor: theme.colors.primary }]}
          onPress={() => setActiveTab('members')}
        >
          <Users size={16} color={activeTab === 'members' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'members' ? theme.colors.primary : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Member Selection
          </Text>
          {unsavedMembers && activeTab !== 'members' && (
            <View style={[styles.unsavedDot, { backgroundColor: '#f59e0b' }]} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notes' && { borderBottomColor: theme.colors.primary }]}
          onPress={() => setActiveTab('notes')}
        >
          <StickyNote size={16} color={activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'notes' ? theme.colors.primary : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Notes
          </Text>
          {unsavedNotes && activeTab !== 'notes' && (
            <View style={[styles.unsavedDot, { backgroundColor: '#f59e0b' }]} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Member Selection Tab ── */}
        {activeTab === 'members' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>

            {/* Saved confirmation banner */}
            {membersSaved && (
              <View style={[styles.savedBanner, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                <CircleCheck size={18} color="#16a34a" />
                <Text style={[styles.savedBannerText, { color: '#16a34a' }]} maxFontSizeMultiplier={1.3}>
                  Member selection saved successfully!
                </Text>
              </View>
            )}

            {/* All Members section */}
            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>All Members</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Tap to mark as attending
                  </Text>
                </View>
                <View style={styles.bulkBtns}>
                  <TouchableOpacity style={[styles.bulkBtn, { borderColor: theme.colors.primary }]} onPress={selectAll}>
                    <CheckCheck size={14} color={theme.colors.primary} />
                    <Text style={[styles.bulkBtnText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bulkBtn, { borderColor: theme.colors.textSecondary }]} onPress={unselectAll}>
                    <X size={14} color={theme.colors.textSecondary} />
                    <Text style={[styles.bulkBtnText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>None</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {membersLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 16 }} />
              ) : (
                <View style={{ marginTop: 12 }}>
                  {allMembers.map((member, idx) => {
                    const isAttending = attendingIds.has(member.user_id);
                    return (
                      <TouchableOpacity
                        key={member.user_id}
                        style={[
                          styles.memberRow,
                          idx < allMembers.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                          isAttending && { backgroundColor: theme.colors.primary + '08' },
                        ]}
                        onPress={() => toggleMember(member.user_id)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checkBox,
                          isAttending
                            ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                            : { backgroundColor: 'transparent', borderColor: theme.colors.border }
                        ]}>
                          {isAttending && (
                            <View style={styles.checkMark}>
                              <Text style={styles.checkMarkText}>✓</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[
                          styles.memberRowName,
                          { color: isAttending ? theme.colors.text : theme.colors.textSecondary,
                            fontWeight: isAttending ? '600' : '400' }
                        ]} maxFontSizeMultiplier={1.3}>
                          {member.full_name}
                        </Text>
                        {isAttending && (
                          <View style={[styles.attendingBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                            <Text style={[styles.attendingBadgeText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.2}>Attending</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Save button */}
            {unsavedMembers && (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: membersSaving ? theme.colors.border : theme.colors.primary }
                ]}
                onPress={saveMembers}
                disabled={membersSaving}
                activeOpacity={0.8}
              >
                {membersSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Save size={18} color="#ffffff" />
                )}
                <Text style={styles.saveBtnText} maxFontSizeMultiplier={1.3}>
                  {membersSaving ? 'Saving...' : `Save Selection (${attendingIds.size} attending)`}
                </Text>
              </TouchableOpacity>
            )}

            {/* Member Attending summary */}
            {attendingMembers.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface, marginTop: 16 }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 4 }]} maxFontSizeMultiplier={1.3}>
                  Members Attending ({attendingMembers.length})
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary, marginBottom: 12 }]} maxFontSizeMultiplier={1.3}>
                  {unsavedMembers ? 'Unsaved changes — tap Save above to confirm' : 'These members will appear in your audit list'}
                </Text>
                {attendingMembers.map((member, idx) => (
                  <View
                    key={member.user_id}
                    style={[
                      styles.attendingRow,
                      idx < attendingMembers.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                    ]}
                  >
                    <View style={[styles.attendingDot, { backgroundColor: unsavedMembers ? '#f59e0b' : theme.colors.primary }]} />
                    <Text style={[styles.attendingRowName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {member.full_name}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Notes Tab ── */}
        {activeTab === 'notes' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>

            {/* Saved confirmation banner */}
            {notesSaved && (
              <View style={[styles.savedBanner, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
                <CircleCheck size={18} color="#16a34a" />
                <Text style={[styles.savedBannerText, { color: '#16a34a' }]} maxFontSizeMultiplier={1.3}>
                  Notes saved successfully!
                </Text>
              </View>
            )}

            <View style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: '#FFF4E6' }]}>
                  <StickyNote size={20} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Your Prep Notes</Text>
                  <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Private notes for your session. Only you can see this.
                  </Text>
                </View>
              </View>

              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: '#6B7280' }]} maxFontSizeMultiplier={1.3}>NOTES</Text>
                {personalNotes.length > 0 && (
                  <TouchableOpacity
                    style={[styles.clearBtn, { backgroundColor: theme.colors.border }]}
                    onPress={() => setPersonalNotes('')}
                  >
                    <X size={14} color={theme.colors.text} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: unsavedNotes ? '#f59e0b' : theme.colors.border,
                  color: theme.colors.text,
                }]}
                placeholder="Jot down observations, strategies, members to watch, reminders..."
                placeholderTextColor={theme.colors.textSecondary}
                value={personalNotes}
                onChangeText={text => { if (text.length <= 1000) setPersonalNotes(text); }}
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={[styles.charCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {personalNotes.length}/1000
              </Text>

              <Text style={[styles.visibilityNote, { color: theme.colors.textSecondary, marginTop: 6, marginBottom: 16 }]} maxFontSizeMultiplier={1.3}>
                Visible only to you
              </Text>

              {/* Save notes button */}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: notesSaving ? theme.colors.border : unsavedNotes ? theme.colors.primary : '#e5e7eb' }
                ]}
                onPress={saveNotes}
                disabled={notesSaving || !unsavedNotes}
                activeOpacity={0.8}
              >
                {notesSaving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Save size={18} color={unsavedNotes ? '#ffffff' : '#9ca3af'} />
                )}
                <Text style={[styles.saveBtnText, { color: unsavedNotes ? '#ffffff' : '#9ca3af' }]} maxFontSizeMultiplier={1.3}>
                  {notesSaving ? 'Saving...' : unsavedNotes ? 'Save Notes' : 'Notes Saved'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  loadingText: { fontSize: 16, fontWeight: '500' },
  deniedTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  deniedMsg: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  goBackBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, marginTop: 12 },
  goBackBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1 },
  headerSpacer: { width: 40 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 3, borderBottomColor: 'transparent', marginRight: 16,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  unsavedDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },
  scroll: { flex: 1 },
  savedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  savedBannerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  sectionCard: {
    borderRadius: 16, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  sectionSubtitle: { fontSize: 13, lineHeight: 18 },
  bulkBtns: { flexDirection: 'row', gap: 8 },
  bulkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5,
  },
  bulkBtnText: { fontSize: 12, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 4, gap: 12,
  },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { alignItems: 'center', justifyContent: 'center' },
  checkMarkText: { color: '#ffffff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  memberRowName: { flex: 1, fontSize: 15 },
  attendingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  attendingBadgeText: { fontSize: 11, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginTop: 16, paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  attendingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4, gap: 10,
  },
  attendingDot: { width: 8, height: 8, borderRadius: 4 },
  attendingRowName: { fontSize: 14, fontWeight: '500' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  labelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  clearBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, minHeight: 180, lineHeight: 23,
    textAlignVertical: 'top', marginBottom: 6,
  },
  charCount: { fontSize: 12, textAlign: 'right', fontWeight: '600' },
  visibilityNote: { fontSize: 13 },
});

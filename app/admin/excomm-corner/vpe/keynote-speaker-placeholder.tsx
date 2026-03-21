import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, Save, AlertCircle, UserX, Building2, ChevronRight, Hash } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Meeting {
  id: string;
  meeting_date: string;
  meeting_number: number;
  meeting_status: string;
}

interface KeynoteSpeakerData {
  id: string;
  meeting_id: string;
  speech_title: string | null;
  summary: string | null;
  speaker_user_id: string;
}

interface AssignedUser {
  id: string;
  full_name: string;
}

export default function KeynoteSpeakerPlaceholder() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [speakerData, setSpeakerData] = useState<KeynoteSpeakerData | null>(null);
  const [speechTitle, setSpeechTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [isVPE, setIsVPE] = useState(false);
  const [assignedUser, setAssignedUser] = useState<AssignedUser | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id || !user?.currentClubId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        await checkVPEStatus();
        await fetchMeetings();
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.currentClubId, user?.id]);

  const checkVPEStatus = async () => {
    if (!user?.id || !user?.currentClubId) return;
    try {
      const { data: clubProfile, error } = await supabase
        .from('club_profiles')
        .select('vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();
      if (error) throw error;
      setIsVPE(clubProfile?.vpe_id === user.id);
    } catch (error) {
      console.error('Error checking VPE status:', error);
      setIsVPE(false);
    }
  };

  const fetchMeetings = async () => {
    if (!user?.currentClubId) return;
    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('id, meeting_date, meeting_number, meeting_status')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: false });
      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    }
  };

  const handleMeetingSelect = async (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setLoadingMeeting(true);
    setAssignedUser(null);
    setSpeakerData(null);
    setSpeechTitle('');
    setSummary('');

    try {
      const { data: keynoteRoleData, error: roleError } = await supabase
        .from('app_meeting_roles_management')
        .select('assigned_user_id, app_user_profiles(id, full_name)')
        .eq('meeting_id', meeting.id)
        .ilike('role_name', '%keynote%')
        .eq('booking_status', 'booked')
        .maybeSingle();

      if (roleError && roleError.code !== 'PGRST116') throw roleError;

      if (keynoteRoleData?.assigned_user_id) {
        const assignedUserProfile = keynoteRoleData.app_user_profiles as any;
        setAssignedUser({
          id: keynoteRoleData.assigned_user_id,
          full_name: assignedUserProfile?.full_name || 'Unknown',
        });

        const { data: existingData, error: dataError } = await supabase
          .from('app_meeting_keynote_speaker')
          .select('*')
          .eq('meeting_id', meeting.id)
          .eq('speaker_user_id', keynoteRoleData.assigned_user_id)
          .maybeSingle();

        if (dataError && dataError.code !== 'PGRST116') throw dataError;

        if (existingData) {
          setSpeakerData(existingData);
          setSpeechTitle(existingData.speech_title || '');
          setSummary(existingData.summary || '');
        }
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setLoadingMeeting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedMeeting || !user?.id || !user?.currentClubId) return;

    if (!speechTitle.trim()) {
      Alert.alert('Error', 'Keynote speech title is required');
      return;
    }

    try {
      setSaving(true);

      const { data: keynoteRoleData } = await supabase
        .from('app_meeting_roles_management')
        .select('assigned_user_id')
        .eq('meeting_id', selectedMeeting.id)
        .ilike('role_name', '%keynote%')
        .eq('booking_status', 'booked')
        .maybeSingle();

      const speakerUserId = keynoteRoleData?.assigned_user_id || user.id;

      if (speakerData) {
        const { error: updateError } = await supabase
          .from('app_meeting_keynote_speaker')
          .update({
            speech_title: speechTitle.trim(),
            summary: summary.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', speakerData.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('app_meeting_keynote_speaker')
          .insert({
            meeting_id: selectedMeeting.id,
            club_id: user.currentClubId,
            speaker_user_id: speakerUserId,
            speech_title: speechTitle.trim(),
            summary: summary.trim() || null,
          });
        if (insertError) throw insertError;
      }

      Alert.alert('Success', 'Keynote speech data saved successfully');
      await handleMeetingSelect(selectedMeeting);
    } catch (error: any) {
      console.error('Error saving keynote data:', error);
      Alert.alert('Error', error.message || 'Failed to save keynote speech data');
    } finally {
      setSaving(false);
    }
  };

  const currentClub = user?.clubs?.find(club => club.id === user?.currentClubId);
  const clubName = currentClub?.name || 'Unknown Club';

  const renderHeader = (showSave = false) => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => selectedMeeting ? setSelectedMeeting(null) : router.back()}
      >
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
        Backdoor - Keynote Speaker
      </Text>
      {showSave ? (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Save size={20} color="#ffffff" />
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
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
        <View style={styles.loadingContainer}>
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
        <View style={styles.centerContainer}>
          <AlertCircle size={64} color={theme.colors.error} />
          <Text style={[styles.errorTitle, { color: theme.colors.text }]}>Access Denied</Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
            Only VPE can access this backdoor placeholder entry.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedMeeting) {
    const meetingDate = new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (loadingMeeting) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading meeting data...</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (!assignedUser) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          <View style={styles.centerContainer}>
            <UserX size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Keynote Speaker is not booked.</Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              No one has been assigned as Keynote Speaker for Meeting #{selectedMeeting.meeting_number}.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {renderHeader(true)}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.meetingBadge, { backgroundColor: selectedMeeting.meeting_status === 'open' ? '#10b981' + '15' : theme.colors.border }]}>
              <Calendar size={16} color={selectedMeeting.meeting_status === 'open' ? '#10b981' : theme.colors.textSecondary} />
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

          <View style={[styles.assignedUserCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.assignedUserLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Assigned Keynote Speaker
            </Text>
            <Text style={[styles.assignedUserName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {assignedUser.full_name}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: '#3b82f6' + '10', borderColor: '#3b82f6' + '30' }]}>
            <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              This is a backdoor entry for VPE to manage keynote speaker data if the speaker forgets to enter it.
            </Text>
          </View>

          <View style={[styles.formCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Keynote Speech Details
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Speech Title <Text style={{ color: theme.colors.error }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                }]}
                placeholder="Enter keynote speech title"
                placeholderTextColor={theme.colors.textSecondary}
                value={speechTitle}
                onChangeText={(text) => text.length <= 200 && setSpeechTitle(text)}
                multiline
                numberOfLines={2}
                maxLength={200}
              />
              <Text style={[styles.charCount, { color: speechTitle.length >= 200 ? theme.colors.error : theme.colors.textSecondary }]}>
                {speechTitle.length}/200
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Summary
              </Text>
              <TextInput
                style={[styles.textArea, {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                }]}
                placeholder="Include key themes, takeaways, and how this keynote will inspire the audience (optional)"
                placeholderTextColor={theme.colors.textSecondary}
                value={summary}
                onChangeText={(text) => text.length <= 600 && setSummary(text)}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={600}
              />
              <Text style={[styles.charCount, { color: summary.length >= 600 ? theme.colors.error : theme.colors.textSecondary }]}>
                {summary.length}/600
              </Text>
            </View>
          </View>

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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {user?.currentClubId && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary }]}>
            <View style={[styles.clubIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Building2 size={24} color="#FFFFFF" />
            </View>
            <View style={styles.clubInfo}>
              <Text style={[styles.clubLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Current Club
              </Text>
              <Text style={[styles.clubNameText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {clubName}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Select a Meeting</Text>

        {meetings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Meetings Found</Text>
            <Text style={[styles.emptyMessage, { color: theme.colors.textSecondary }]}>
              No meetings have been created yet for this club.
            </Text>
          </View>
        ) : (
          meetings.map((meeting) => {
            const date = new Date(meeting.meeting_date).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const isOpen = meeting.meeting_status === 'open';
            return (
              <TouchableOpacity
                key={meeting.id}
                style={[styles.meetingListCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleMeetingSelect(meeting)}
                activeOpacity={0.7}
              >
                <View style={[styles.meetingListIconContainer, { backgroundColor: isOpen ? '#10b981' + '15' : theme.colors.border + '50' }]}>
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
  container: {
    flex: 1,
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
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 40,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  clubNameText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
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
  meetingListIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingListInfo: {
    flex: 1,
  },
  meetingListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  meetingListNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meetingListDate: {
    fontSize: 13,
  },
  meetingCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  meetingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meetingTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  meetingDate: {
    fontSize: 14,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  assignedUserCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  assignedUserLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  assignedUserName: {
    fontSize: 18,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
});

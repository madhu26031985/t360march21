import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, UserPlus, X, Check, UserX, AlertCircle } from 'lucide-react-native';

interface Member {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface MentorAssignment {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
  assigned_at: string;
  mentor: Member;
  mentee: Member;
}

export default function MentorAssignment() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<MentorAssignment[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMentee, setSelectedMentee] = useState<Member | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<Member | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (user?.currentClubId) {
      loadData();
    } else {
      setLoading(false);
      setError('No club selected');
    }
  }, [user?.currentClubId]);

  const loadData = async () => {
    if (!user?.currentClubId) {
      setError('No club selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: relationships, error: relError } = await supabase
        .from('app_club_user_relationship')
        .select('user_id')
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true)
        .in('role', ['member', 'excomm']);

      if (relError) throw new Error('Failed to load club members');

      if (!relationships || relationships.length === 0) {
        setMembers([]);
        setAssignments([]);
        setLoading(false);
        return;
      }

      const memberIds = relationships.map(r => r.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from('app_user_profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', memberIds)
        .order('full_name');

      if (profilesError) throw new Error('Failed to load member profiles');

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('mentor_assignments')
        .select(`
          id,
          mentor_id,
          mentee_id,
          status,
          notes,
          assigned_at
        `)
        .eq('club_id', user.currentClubId)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw new Error('Failed to load mentor assignments');

      const enrichedAssignments: MentorAssignment[] = assignmentsData?.map(assignment => ({
        ...assignment,
        mentor: profiles?.find(p => p.id === assignment.mentor_id)!,
        mentee: profiles?.find(p => p.id === assignment.mentee_id)!,
      })) || [];

      setMembers(profiles || []);
      setAssignments(enrichedAssignments);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getMentorForMember = (memberId: string) => {
    const assignment = assignments.find(
      a => a.mentee_id === memberId && a.status === 'active'
    );
    return assignment?.mentor;
  };

  const getMenteesForMentor = (mentorId: string) => {
    return assignments.filter(
      a => a.mentor_id === mentorId && a.status === 'active'
    );
  };

  const handleAssignMentor = async () => {
    if (!selectedMentee || !selectedMentor || !user?.currentClubId) return;

    if (selectedMentee.id === selectedMentor.id) {
      Alert.alert('Error', 'A member cannot be their own mentor');
      return;
    }

    try {
      setSaving(true);

      const existingAssignment = assignments.find(
        a => a.mentee_id === selectedMentee.id && a.status === 'active'
      );

      if (existingAssignment) {
        const { error: updateError } = await supabase
          .from('mentor_assignments')
          .update({ status: 'cancelled' })
          .eq('id', existingAssignment.id);

        if (updateError) throw updateError;
      }

      const { error: insertError } = await supabase
        .from('mentor_assignments')
        .insert({
          club_id: user.currentClubId,
          mentor_id: selectedMentor.id,
          mentee_id: selectedMentee.id,
          assigned_by: user.id,
          notes: notes.trim() || null,
          status: 'active',
        });

      if (insertError) throw insertError;

      setShowAssignModal(false);
      setSelectedMentee(null);
      setSelectedMentor(null);
      setNotes('');
      loadData();
    } catch (err) {
      console.error('Error assigning mentor:', err);
      Alert.alert('Error', 'Failed to assign mentor. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    setAssignmentToRemove(assignmentId);
    setShowRemoveModal(true);
  };

  const confirmRemoveAssignment = async () => {
    if (!assignmentToRemove) return;

    try {
      setRemoving(true);

      const { error } = await supabase
        .from('mentor_assignments')
        .update({ status: 'cancelled' })
        .eq('id', assignmentToRemove);

      if (error) {
        console.error('Error removing assignment:', error);
        throw error;
      }

      setShowRemoveModal(false);
      setAssignmentToRemove(null);
      await loadData();
    } catch (err) {
      console.error('Error removing assignment:', err);
      setError('Failed to remove assignment. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMemberCard = (member: Member) => {
    const mentor = getMentorForMember(member.id);
    const mentees = getMenteesForMentor(member.id);
    const assignment = assignments.find(
      a => a.mentee_id === member.id && a.status === 'active'
    );

    return (
      <View
        key={member.id}
        style={[styles.memberCard, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {getInitials(member.full_name)}
            </Text>
          </View>

          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {member.full_name}
            </Text>
            <Text style={[styles.memberEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {member.email}
            </Text>
          </View>
        </View>

        {mentor ? (
          <View style={styles.assignmentSection}>
            <View style={[styles.mentorBadge, { backgroundColor: '#10b981' + '15' }]}>
              <Users size={16} color="#10b981" />
              <Text style={[styles.badgeLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Mentor:
              </Text>
              <Text style={[styles.badgeValue, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                {mentor.full_name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => assignment && handleRemoveAssignment(assignment.id)}
              style={styles.removeButton}
            >
              <UserX size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.assignButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setSelectedMentee(member);
              setShowAssignModal(true);
            }}
          >
            <UserPlus size={18} color="#ffffff" />
            <Text style={styles.assignButtonText} maxFontSizeMultiplier={1.3}>Assign Mentor</Text>
          </TouchableOpacity>
        )}

        {mentees.length > 0 && (
          <View style={[styles.menteesSection, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.menteesLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Mentoring {mentees.length} member{mentees.length > 1 ? 's' : ''}:
            </Text>
            {mentees.map(menteeAssignment => (
              <Text key={menteeAssignment.id}
                style={[styles.menteeeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • {menteeAssignment.mentee.full_name}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Mentor Assignment
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Manage mentor-mentee relationships
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading members...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={[styles.errorIcon, { backgroundColor: '#ef4444' + '15' }]}>
            <Text style={styles.errorEmoji} maxFontSizeMultiplier={1.3}>⚠️</Text>
          </View>
          <Text style={[styles.errorTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Error Loading Data
          </Text>
          <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={loadData}
          >
            <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.3}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#10b981' + '15' }]}>
                <Users size={24} color="#10b981" />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {assignments.filter(a => a.status === 'active').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Active Mentorships
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                <UserPlus size={24} color={theme.colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {members.length - assignments.filter(a => a.status === 'active').length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Without Mentor
              </Text>
            </View>
          </View>

          <View style={styles.listContainer}>
            {members.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <Users size={64} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Members Found
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  There are no members in this club yet
                </Text>
              </View>
            ) : (
              members.map(renderMemberCard)
            )}
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      )}

      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Assign Mentor
              </Text>
              <TouchableOpacity
                onPress={() => setShowAssignModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedMentee && (
              <View style={[styles.selectedMenteeCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.selectedLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Mentee:
                </Text>
                <Text style={[styles.selectedName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedMentee.full_name}
                </Text>
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Select Mentor:
            </Text>

            <ScrollView style={styles.mentorList} showsVerticalScrollIndicator={false}>
              {members
                .filter(m => m.id !== selectedMentee?.id)
                .map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      styles.mentorOption,
                      {
                        backgroundColor: selectedMentor?.id === member.id
                          ? theme.colors.primary + '15'
                          : theme.colors.background,
                      },
                    ]}
                    onPress={() => setSelectedMentor(member)}
                  >
                    <View style={[styles.optionAvatar, { backgroundColor: theme.colors.primary + '20' }]}>
                      <Text style={[styles.optionAvatarText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                        {getInitials(member.full_name)}
                      </Text>
                    </View>
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {member.full_name}
                      </Text>
                      <Text style={[styles.optionEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {member.email}
                      </Text>
                    </View>
                    {selectedMentor?.id === member.id && (
                      <Check size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.colors.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowAssignModal(false)}
                disabled={saving}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: selectedMentor ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={handleAssignMentor}
                disabled={!selectedMentor || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>Assign Mentor</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRemoveModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRemoveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.confirmIcon, { backgroundColor: '#ef4444' + '15' }]}>
              <AlertCircle size={48} color="#ef4444" />
            </View>

            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Remove Mentor Assignment?
            </Text>

            <Text style={[styles.confirmMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to remove this mentor assignment? This action cannot be undone.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmCancelButton, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  setShowRemoveModal(false);
                  setAssignmentToRemove(null);
                }}
                disabled={removing}
              >
                <Text style={[styles.confirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmRemoveButton, { backgroundColor: '#ef4444' }]}
                onPress={confirmRemoveAssignment}
                disabled={removing}
              >
                {removing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmRemoveText} maxFontSizeMultiplier={1.3}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorEmoji: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  memberCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  memberEmail: {
    fontSize: 13,
    fontWeight: '500',
  },
  assignmentSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mentorBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  removeButton: {
    padding: 8,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  menteesSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  menteesLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  menteeeName: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  emptyState: {
    padding: 48,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  selectedMenteeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  selectedName: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  mentorList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  mentorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionAvatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionEmail: {
    fontSize: 13,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmRemoveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmRemoveText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

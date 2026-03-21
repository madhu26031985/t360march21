import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, ClipboardCheck, User, Info, X, FileText, Bell, Users, Calendar, BookOpen, Star, Mic, CheckSquare, Clock, MessageSquare, Award, FileBarChart } from 'lucide-react-native';
import { Image } from 'react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
}

interface RoleAssignment {
  id: string;
  role_name: string;
  role_classification: string | null;
  assigned_user_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completion_notes: string | null;
  assigned_user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function RoleCompletionReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    if (meetingId) {
      loadRoleCompletionData();
    }
  }, [meetingId]);

  const loadRoleCompletionData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadRoleAssignments()
      ]);
    } catch (error) {
      console.error('Error loading role completion data:', error);
      Alert.alert('Error', 'Failed to load role completion data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadRoleAssignments = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          role_classification,
          assigned_user_id,
          is_completed,
          completed_at,
          completion_notes,
          assigned_user:app_user_profiles!fk_meeting_roles_management_assigned_user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_status', 'Available')
        .not('assigned_user_id', 'is', null)
        .order('order_index');

      if (error) {
        console.error('Error loading role assignments:', error);
        return;
      }

      setRoleAssignments(data || []);
    } catch (error) {
      console.error('Error loading role assignments:', error);
    }
  };

  const handleToggleCompletion = async (roleId: string, currentStatus: boolean) => {
    const role = roleAssignments.find(r => r.id === roleId);
    const isExComm = user?.isAuthenticated && user?.clubRole?.toLowerCase() === 'excomm';
    const isAssignedUser = role?.assigned_user_id === user?.id;
    
    if (!user?.isAuthenticated || (!isExComm && !isAssignedUser)) {
      Alert.alert('Access Denied', 'You can only mark completion for your own assigned roles, or if you are an ExComm member.');
      return;
    }

    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          is_completed: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : null,
          completion_notes: !currentStatus ? `Marked as completed by ${user.fullName}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('Error updating role completion:', error);
        Alert.alert('Error', 'Failed to update role completion status');
        return;
      }

      // Update local state
      setRoleAssignments(prev => prev.map(role =>
        role.id === roleId
          ? {
              ...role,
              is_completed: !currentStatus,
              completed_at: !currentStatus ? new Date().toISOString() : null,
              completion_notes: !currentStatus ? `Marked as completed by ${user.fullName}` : null,
            }
          : role
      ));
    } catch (error) {
      console.error('Error updating role completion:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const RoleCard = ({ role }: { role: RoleAssignment }) => {
    const isExComm = user?.isAuthenticated && user?.clubRole?.toLowerCase() === 'excomm';
    const isAssignedUser = role.assigned_user_id === user?.id;
    const canEdit = user?.isAuthenticated && (isExComm || isAssignedUser);

    return (
      <View style={[styles.roleCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.roleCardContent}>
          {/* Avatar */}
          <View style={styles.userAvatar}>
            {role.assigned_user?.avatar_url ? (
              <Image
                source={{ uri: role.assigned_user.avatar_url }}
                style={styles.userAvatarImage}
              />
            ) : (
              <View style={[styles.userAvatarPlaceholder, { backgroundColor: '#6366f1' }]}>
                <User size={19} color="#ffffff" />
              </View>
            )}
          </View>

          {/* Role and User info */}
          <View style={styles.roleInfo}>
            <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {role.role_name}
            </Text>
            {role.assigned_user && (
              <Text style={[styles.userName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {role.assigned_user.full_name}
              </Text>
            )}
            {role.is_completed && role.completion_notes && (
              <Text style={[styles.markedByText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                ✏️ {role.completion_notes}
              </Text>
            )}
          </View>

          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            { backgroundColor: role.is_completed ? '#10b981' + '15' : '#f59e0b' + '15' }
          ]}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: role.is_completed ? '#10b981' : '#f59e0b' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: role.is_completed ? '#10b981' : '#f59e0b' }
            ]} maxFontSizeMultiplier={1.3}>
              {role.is_completed ? 'Completed' : 'Incomplete'}
            </Text>
          </View>
        </View>

        {/* Completion Buttons - Only for ExComm or assigned user */}
        {canEdit && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.completeButton,
                { opacity: role.is_completed ? 0.5 : 1 }
              ]}
              onPress={() => handleToggleCompletion(role.id, role.is_completed)}
              disabled={role.is_completed}
            >
              <Text style={[styles.actionButtonText, styles.completeButtonText]} maxFontSizeMultiplier={1.3}>
                Complete
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.incompleteButton,
                { opacity: !role.is_completed ? 0.5 : 1 }
              ]}
              onPress={() => handleToggleCompletion(role.id, role.is_completed)}
              disabled={!role.is_completed}
            >
              <Text style={[styles.actionButtonText, styles.incompleteButtonText]} maxFontSizeMultiplier={1.3}>
                Incomplete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading role completion report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
        </View>
      </SafeAreaView>
    );
  }

  const totalRoles = roleAssignments.length;
  const completedRoles = roleAssignments.filter(r => r.is_completed).length;
  const completionPercentage = totalRoles > 0 ? Math.round((completedRoles / totalRoles) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={19} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Information Card */}
        <View style={[styles.meetingCard, {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border
        }]}>
          <View style={styles.meetingCardContent}>
            <View style={[styles.dateBox, {
              backgroundColor: theme.colors.primary + '15'
            }]}>
              <Text style={[styles.dateDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).getDate()}
              </Text>
              <Text style={[styles.dateMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingDetails}>
              <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_title}
              </Text>
              <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Day: {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              {meeting.meeting_start_time && (
                <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Time: {meeting.meeting_start_time}
                  {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                </Text>
              )}
              <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Mode: {meeting.meeting_mode === 'in_person' ? 'In Person' :
                       meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
              </Text>
            </View>
          </View>
          <View style={styles.meetingCardDecoration} />
        </View>

        {/* Overall Progress */}
        <View style={[styles.progressCard, { backgroundColor: theme.colors.background }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Overall Completion
            </Text>
            <Text style={[styles.progressPercentage, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {completionPercentage}%
            </Text>
          </View>

          <View style={[styles.progressBar, { backgroundColor: '#e5e7eb' }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: `${completionPercentage}%`
                }
              ]}
            />
          </View>

          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {completedRoles} of {totalRoles} roles completed
          </Text>
        </View>

        {/* Role Completion by Category */}
        <View style={styles.classificationsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Role Completion by Category
          </Text>

          {roleAssignments.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}

          {roleAssignments.length === 0 && (
            <View style={styles.noRolesState}>
              <ClipboardCheck size={38} color={theme.colors.textSecondary} />
              <Text style={[styles.noRolesText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No Role Assignments
              </Text>
              <Text style={[styles.noRolesSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                There are no assigned roles for this meeting yet. Contact your ExComm to assign roles.
              </Text>
            </View>
          )}
        </View>

        {/* Navigation Quick Actions */}
        <View style={[styles.quickActionsBoxContainer, { backgroundColor: '#ffffff' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                <Bell size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={24} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                <Calendar size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                <BookOpen size={24} color="#f97316" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-report', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Star size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                <FileText size={24} color="#8b5cf6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Mic size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                <CheckSquare size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                <ClipboardCheck size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                <Award size={24} color="#10b981" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                <Clock size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId: meeting?.id } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MessageSquare size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>TTM</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Information Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <View style={[styles.infoModalIcon, { backgroundColor: '#3b82f6' + '20' }]}>
                <Info size={19} color="#3b82f6" />
              </View>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Role Completion Report
              </Text>
              <TouchableOpacity
                style={styles.closeInfoButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={19} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoModalContent}>
              <Text style={[styles.infoModalDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                The Role Completion Report helps track and visualize your Toastmasters journey and progress.
              </Text>
              
              <View style={styles.infoModalPoints}>
                <View style={styles.infoModalPoint}>
                  <View style={[styles.infoModalBullet, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.infoModalPointText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    The report is tied to a specific meeting.
                  </Text>
                </View>
                
                <View style={styles.infoModalPoint}>
                  <View style={[styles.infoModalBullet, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.infoModalPointText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    ExComm members can mark role completion for all users.
                  </Text>
                </View>
                
                <View style={styles.infoModalPoint}>
                  <View style={[styles.infoModalBullet, { backgroundColor: '#3b82f6' }]} />
                  <Text style={[styles.infoModalPointText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Individual members can update completion status only for their own assigned roles.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    padding: 13,
    minHeight: 77,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  dateBox: {
    width: 45,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 22,
  },
  dateMonth: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  meetingCardDateTime: {
    fontSize: 9,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingCardMode: {
    fontSize: 9,
    fontWeight: '500',
  },
  meetingCardDecoration: {
    position: 'absolute',
    right: -32,
    bottom: -32,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
  },
  infoButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressCard: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    padding: 13,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  classificationsSection: {
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 13,
    letterSpacing: -0.3,
  },
  roleCard: {
    borderRadius: 10,
    padding: 13,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  userAvatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  userName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  markedByText: {
    fontSize: 10,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  incompleteButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completeButtonText: {
    color: '#ffffff',
  },
  incompleteButtonText: {
    color: '#ffffff',
  },
  noRolesState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 26,
  },
  noRolesText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 13,
    textAlign: 'center',
  },
  noRolesSubtext: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 17,
  },
  bottomPadding: {
    height: 32,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  infoModal: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
    padding: 19,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoModalIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    letterSpacing: -0.3,
  },
  closeInfoButton: {
    padding: 4,
  },
  infoModalContent: {
    flex: 1,
  },
  infoModalDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  infoModalPoints: {
    gap: 13,
  },
  infoModalPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoModalBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    marginRight: 10,
  },
  infoModalPointText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  quickActionsBoxContainer: {
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionsContent: {
    paddingHorizontal: 10,
    gap: 10,
  },
  quickActionItem: {
    alignItems: 'center',
    marginRight: 3,
  },
  quickActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 9.5,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 70,
  },
});
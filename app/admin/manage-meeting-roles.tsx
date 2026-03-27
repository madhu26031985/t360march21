import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, User, Crown, Shield, Eye, UserCheck, Building2, Calendar, Clock, MapPin, Search, X, Trash2, UserRoundCog, UserPlus, Info } from 'lucide-react-native';
import { Image } from 'react-native';
import React from 'react';
 
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

interface AvailableRole {
  id: string;
  meeting_role_name: string;
  meeting_role_metric: string;
}

interface MeetingRoleAssignment {
  id: string;
  meeting_id: string;
  role_id: string;
  role_name: string;
  role_metric: string;
  assigned_user_id: string | null;
  booking_status: string;
  booked_at: string | null;
  withdrawn_at: string | null;
  speech_title: string | null;
  speech_objectives: string | null;
  role_status: string;
  role_classification: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
  };
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
}

interface ClassificationTab {
  value: string;
  label: string;
  count: number;
  color: string;
}

export default function ManageMeetingRoles() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [meetingRoles, setMeetingRoles] = useState<MeetingRoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showRolesInfoModal, setShowRolesInfoModal] = useState(false);
  const [selectedRoleForAssignment, setSelectedRoleForAssignment] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'available' | 'deleted'>('available');
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  // Memoize filtered roles by tab
  const rolesByTab = useMemo(() => {
    return selectedTab === 'available'
      ? meetingRoles.filter(role => role.role_status === 'Available')
      : meetingRoles.filter(role => role.role_status === 'Deleted');
  }, [meetingRoles, selectedTab]);

  // Memoize classification tabs
  const classificationTabs = useMemo(() => {
    const classificationCounts = rolesByTab.reduce((acc, role) => {
      const classification = role.role_classification || 'Others';
      acc[classification] = (acc[classification] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tabs: ClassificationTab[] = [];
    const classificationDefinitions = [
      { key: 'Key Speakers', label: 'Key Speakers', color: '#ef4444' },
      { key: 'Keynote Speaker', label: 'Keynote Speaker', color: '#dc2626' },
      { key: 'Ice Breaker', label: 'Ice Breaker', color: '#10b981' },
      { key: 'Prepared Speaker', label: 'Prepared Speaker', color: '#3b82f6' },
      { key: 'Club Speakers', label: 'Club Speakers', color: '#8b5cf6' },
      { key: 'Educational speaker', label: 'Educational', color: '#f59e0b' },
      { key: 'Speech evaluvator', label: 'Speech Evaluator', color: '#06b6d4' },
      { key: 'Master evaluvator', label: 'Master Evaluator', color: '#84cc16' },
      { key: 'TT _ Evaluvator', label: 'TT Evaluator', color: '#ec4899' },
      { key: 'On-the-Spot Speaking', label: 'Table Topics', color: '#f97316' },
      { key: 'Tag roles', label: 'Tag Roles', color: '#6366f1' },
      { key: 'Ancillary Speaker', label: 'Ancillary', color: '#14b8a6' },
      { key: 'Judge', label: 'Judge', color: '#6b7280' },
      { key: 'Others', label: 'Others', color: '#9ca3af' },
    ];

    classificationDefinitions.forEach(classDef => {
      const count = classificationCounts[classDef.key] || 0;
      if (count > 0) {
        tabs.push({
          value: classDef.key,
          label: classDef.label,
          count: count,
          color: classDef.color
        });
      }
    });

    return tabs;
  }, [rolesByTab]);

  // Auto-select first classification when tabs change
  useEffect(() => {
    if (classificationTabs.length > 0 && (!selectedClassification || !classificationTabs.find(t => t.value === selectedClassification))) {
      setSelectedClassification(classificationTabs[0].value);
    }
  }, [classificationTabs]);

  // Memoize filtered roles by classification
  const filteredRoles = useMemo(() => {
    if (!selectedClassification) {
      return rolesByTab;
    }
    return rolesByTab.filter(role => role.role_classification === selectedClassification);
  }, [rolesByTab, selectedClassification]);

  // Memoize filtered members
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim()) {
      return clubMembers;
    }
    const query = memberSearchQuery.toLowerCase().trim();
    return clubMembers.filter(member =>
      member.full_name.toLowerCase().includes(query) ||
      member.email.toLowerCase().includes(query)
    );
  }, [clubMembers, memberSearchQuery]);

  const loadData = async () => {
    if (!meetingId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadMeetingRoles(),
        loadClubMembers(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
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
        Alert.alert('Error', 'Failed to load meeting details');
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadMeetingRoles = useCallback(async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          *,
          app_user_profiles (
            full_name,
            email
          )
        `)
        .eq('meeting_id', meetingId)
        .order('order_index');

      if (error) {
        console.error('Error loading meeting roles:', error);
        Alert.alert('Error', 'Failed to load meeting roles: ' + error.message);
        return;
      }

      setMeetingRoles(data || []);
    } catch (error) {
      console.error('Error loading meeting roles:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading roles');
    }
  }, [meetingId]);

  const loadClubMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          app_user_profiles (
            id,
            full_name,
            email
          ),
          role
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading club members:', error);
        return;
      }

      const members = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        avatar_url: null,
        role: (item as any).role,
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));

      setClubMembers(members);
    } catch (error) {
      console.error('Error loading club members:', error);
    }
  };


  const handleAssignMember = useCallback(async (roleName: string, memberId: string | null) => {
    try {
      const existingAssignment = meetingRoles.find(ra => ra.role_name === roleName);

      if (existingAssignment) {
        const updateData = {
          assigned_user_id: memberId,
          booking_status: memberId ? 'booked' : 'open',
          booked_at: memberId ? new Date().toISOString() : null,
          withdrawn_at: !memberId && existingAssignment.assigned_user_id ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('app_meeting_roles_management')
          .update(updateData)
          .eq('id', existingAssignment.id);

        if (error) {
          console.error('Error updating role assignment:', error);
          Alert.alert('Error', 'Failed to update role assignment');
          return;
        }
      } else {
        Alert.alert('Error', 'Role not found in meeting');
        return;
      }

      setShowMemberModal(false);
      setSelectedRoleForAssignment(null);
      setMemberSearchQuery('');

      const memberName = memberId ? clubMembers.find(m => m.id === memberId)?.full_name : 'No one';
      Alert.alert('Success', `${roleName} assigned to ${memberName}`);

      loadMeetingRoles();
    } catch (error) {
      console.error('Error assigning member:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  }, [meetingRoles, clubMembers, loadMeetingRoles]);

  const handleDeleteRole = (roleName: string) => {
    updateRoleStatus(roleName, 'Deleted');
  };

  const handleRestoreRole = (roleName: string) => {
    updateRoleStatus(roleName, 'Available');
  };

  const updateRoleStatus = useCallback(async (roleName: string, newStatus: 'Available' | 'Deleted') => {
    try {
      const updateData: any = {
        role_status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'Deleted') {
        updateData.assigned_user_id = null;
        updateData.booking_status = 'open';
        updateData.booked_at = null;
        updateData.withdrawn_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update(updateData)
        .eq('meeting_id', meetingId)
        .eq('role_name', roleName);

      if (error) {
        console.error('Error updating role status:', error);
        Alert.alert('Error', 'Failed to update role status');
        return;
      }

      await loadMeetingRoles();

      const action = newStatus === 'Deleted' ? 'deleted and moved to deleted roles' : 'restored to available roles';
      Alert.alert('Success', `${roleName} ${action}`);
    } catch (error) {
      console.error('Error updating role status:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  }, [meetingId, loadMeetingRoles]);

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return '#8b5cf6';
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  const RoleCard = React.memo(({ role }: { role: MeetingRoleAssignment }) => {
    const isAssigned = role.assigned_user_id;
    const assignedMember = isAssigned ? clubMembers.find(m => m.id === role.assigned_user_id) : null;

    const handleCardPress = useCallback(() => {
      setSelectedRoleForAssignment(role.role_name);
      setShowMemberModal(true);
    }, [role.role_name]);

    const handleDelete = useCallback(() => {
      handleDeleteRole(role.role_name);
    }, [role.role_name]);

    const handleRestore = useCallback(() => {
      handleRestoreRole(role.role_name);
    }, [role.role_name]);

    return (
      <TouchableOpacity
        style={[styles.roleCard, { backgroundColor: theme.colors.surface }]}
        onPress={handleCardPress}
        activeOpacity={0.7}
      >
        <View style={styles.roleHeader}>
          <View style={styles.roleInfo}>
            <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {role.role_name}
            </Text>

            {/* Show assignment status */}
            {role && (
              <View style={[
                styles.statusTag,
                { backgroundColor: '#f3f4f6' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: '#374151' }
                ]} maxFontSizeMultiplier={1.3}>
                  {role.booking_status === 'booked' && assignedMember
                    ? `Booked by: ${assignedMember.full_name}`
                    : role.booking_status === 'booked'
                    ? 'Booked'
                    : role.booking_status === 'withdrawn'
                    ? 'Withdrawn'
                    : 'Open'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.roleActions}>
            {selectedTab === 'available' ? (
              <>
                <TouchableOpacity
                  style={[styles.deleteRoleButton, { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }]}
                  onPress={handleDelete}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.assignButton, { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }]}
                  onPress={handleCardPress}
                  activeOpacity={0.7}
                >
                  {isAssigned ? (
                    <UserRoundCog size={18} color={theme.colors.textSecondary} />
                  ) : (
                    <UserPlus size={18} color={theme.colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.restoreButton, { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }]}
                onPress={handleRestore}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.restoreButtonText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Restore</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting roles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity 
            style={[styles.backToMeetingButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backToMeetingButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Manage Meeting Roles</Text>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowRolesInfoModal(true)}
            accessibilityLabel="Manage roles information"
            accessibilityHint="Learn how available and deleted roles work"
          >
            <Info size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.rolesMasterBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {/* Meeting Info Card */}
        <View style={[styles.meetingCard, { backgroundColor: 'transparent' }]}>
          <View style={styles.meetingHeader}>
            <View style={[styles.meetingIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Building2 size={24} color={theme.colors.primary} />
            </View>
            <View style={styles.meetingInfo}>
              <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_title}
              </Text>
              <View style={styles.meetingMeta}>
                <View style={styles.meetingDate}>
                  <Calendar size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.meetingDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {new Date(meeting.meeting_date).toLocaleDateString()}
                  </Text>
                </View>
                {meeting.meeting_number && (
                  <Text style={[styles.meetingNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    #{meeting.meeting_number}
                  </Text>
                )}
              </View>
              {meeting.meeting_start_time && (
                <View style={styles.meetingTime}>
                  <Clock size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.meetingTimeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {meeting.meeting_start_time}
                    {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                  </Text>
                </View>
              )}
              <View style={styles.meetingMode}>
                <MapPin size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.meetingModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_mode === 'in_person' ? 'In Person' : 
                   meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'available' ? theme.colors.background : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('available')}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Available Roles
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: theme.colors.border }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {meetingRoles.filter(role => role.role_status === 'Available').length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'deleted' ? theme.colors.background : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('deleted')}
          >
            <Text style={[
              styles.tabText,
              { color: theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Deleted Roles
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: theme.colors.border }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {meetingRoles.filter(role => role.role_status === 'Deleted').length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Two Column Layout: Filters and Roles */}
        {classificationTabs.length > 0 ? (
          <View style={styles.twoColumnContainer}>
            {/* Left Column: Filter Categories with Vertical Scroll */}
            <View style={[styles.filterSidebar, { backgroundColor: 'transparent' }]}>
              <ScrollView
                style={styles.filterScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                {classificationTabs.map((tab) => {
                  const isSelected = selectedClassification === tab.value;

                  return (
                    <TouchableOpacity
                      key={tab.value}
                      style={[
                        styles.categoryTile,
                        {
                          backgroundColor: isSelected ? theme.colors.background : theme.colors.surface,
                          borderColor: theme.colors.border,
                        }
                      ]}
                      onPress={() => setSelectedClassification(tab.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                          styles.categoryLabel,
                          {
                            color: theme.colors.text,
                          }
                        ]}
                        numberOfLines={2} maxFontSizeMultiplier={1.3}>
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.categoryCount,
                          {
                            backgroundColor: theme.colors.border,
                          }
                        ]}
                      >
                        <Text style={[
                            styles.categoryCountText,
                            {
                              color: theme.colors.textSecondary,
                            }
                          ]} maxFontSizeMultiplier={1.3}>
                          {tab.count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Right Column: Roles List with Scroll */}
            <View style={styles.rolesColumn}>
              <ScrollView
                style={styles.rolesScrollView}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
              >
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedClassification
                    ? `${classificationTabs.find(t => t.value === selectedClassification)?.label}(${filteredRoles.length})`
                    : `${selectedTab === 'available' ? 'Available Roles' : 'Deleted Roles'} (${filteredRoles.length})`
                  }
                </Text>

                {filteredRoles.map((role) => (
                  <RoleCard key={role.id} role={role} />
                ))}

                {filteredRoles.length === 0 && (
                  <View style={styles.emptyState}>
                    <Users size={48} color={theme.colors.textSecondary} />
                    <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {selectedTab === 'available' ? 'No available roles' : 'No deleted roles'}
                    </Text>
                    <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {selectedTab === 'available'
                        ? 'All roles have been deleted'
                        : 'Deleted roles will appear here'
                      }
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={styles.rolesSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {selectedTab === 'available' ? 'Available Meeting Roles' : 'Deleted Meeting Roles'}
              ({filteredRoles.length})
            </Text>

            {filteredRoles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}

            {filteredRoles.length === 0 && (
              <View style={styles.emptyState}>
                <Users size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available' ? 'No available roles' : 'No deleted roles'}
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available'
                    ? 'All roles have been deleted'
                    : 'Deleted roles will appear here'
                  }
                </Text>
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Member Assignment Modal */}
      <Modal
        visible={showMemberModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.memberModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {selectedRoleForAssignment} Assignment
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowMemberModal(false);
                  setMemberSearchQuery('');
                }}
              >
                <X size={17} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Box */}
            <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Search size={13} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search members by name or email..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={memberSearchQuery}
                  onChangeText={setMemberSearchQuery}
                  autoCapitalize="none"
                />
              </View>
              <Text style={[styles.searchResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''} found
              </Text>
            </View>

            <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
              {/* Unassign Option */}
              <TouchableOpacity
                style={[styles.memberOption, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => handleAssignMember(selectedRoleForAssignment!, null)}
              >
                <View style={[styles.memberOptionAvatar, { backgroundColor: '#e5e7eb' }]}>
                  <User size={14} color="#6b7280" />
                </View>
                <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Unassign role
                </Text>
              </TouchableOpacity>

              {filteredMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberOption, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => handleAssignMember(selectedRoleForAssignment!, member.id)}
                >
                  <View style={styles.memberOptionAvatar}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                    ) : (
                      <User size={14} color="#6b7280" />
                    )}
                  </View>
                  <Text style={[styles.memberOptionName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {member.full_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Roles Info Modal */}
      <Modal
        visible={showRolesInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRolesInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModal, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.infoModalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Manage Roles
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowRolesInfoModal(false)}
              >
                <X size={17} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoModalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                This section allows you to manage which roles are available for members to book for a meeting.
              </Text>

              <Text style={[styles.infoSectionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                Available Roles
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                These are roles that members can view and book for the selected meeting.
              </Text>

              <Text style={[styles.infoSectionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                Deleted Roles
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                These roles are not available for booking but can be restored anytime.
              </Text>

              <Text style={[styles.infoSectionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                What You Can Do (as ExComm)
              </Text>

              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Delete a role
              </Text>
              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Move a role from Available to Deleted if it's not needed.
              </Text>

              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary, marginTop: 6 }]} maxFontSizeMultiplier={1.2}>
                Restore a role
              </Text>
              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Bring back any deleted role to make it available again.
              </Text>

              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary, marginTop: 6 }]} maxFontSizeMultiplier={1.2}>
                Assign a role
              </Text>
              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Assign a role to a member on their behalf.
              </Text>

              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary, marginTop: 6 }]} maxFontSizeMultiplier={1.2}>
                Unassign a role
              </Text>
              <Text style={[styles.infoListItem, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Remove a member from an assigned role if needed.
              </Text>
            </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  rolesMasterBox: {
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  meetingCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  meetingNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  meetingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTimeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingModeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
  },
  roleCard: {
    borderRadius: 10,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roleInfo: {
    flex: 1,
    marginRight: 10,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  roleMetric: {
    fontSize: 11,
  },
  roleActions: {
    flexDirection: 'column',
    gap: 6,
  },
  deleteRoleButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRoleButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  assignButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  assignButtonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  restoreButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  restoreButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  assignmentStatus: {
    marginTop: 6,
    gap: 3,
  },
  statusTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  assignedMemberText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  memberModal: {
    borderRadius: 16,
    borderWidth: 1,
    width: '100%',
    maxWidth: 350,
    maxHeight: '63%',
    minHeight: '52%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },

  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoModal: {
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 18,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  infoModalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  infoModalBody: {
    paddingHorizontal: 17,
    paddingVertical: 14,
  },
  infoSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  infoText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoListItem: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 17,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  searchContainer: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  searchResultsText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  membersList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
  },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  memberOptionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  memberOptionAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  memberOptionName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  backToMeetingButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToMeetingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  tabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  twoColumnContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
    minHeight: 500,
  },
  filterSidebar: {
    width: '18%',
    minWidth: 60,
    maxWidth: 105,
    paddingRight: 0,
    alignSelf: 'flex-start',
    maxHeight: 336,
  },
  filterScrollView: {
    flex: 1,
  },
  categoryTile: {
    aspectRatio: 1,
    borderRadius: 7,
    marginBottom: 4,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  categoryLabel: {
    fontSize: 6.3,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 7,
  },
  categoryCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  categoryCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rolesColumn: {
    flex: 1,
  },
  rolesScrollView: {
    flex: 1,
  },
});
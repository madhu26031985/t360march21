import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  Users,
  User,
  Crown,
  Shield,
  Eye,
  UserCheck,
  Building2,
  Calendar,
  Search,
  X,
  Trash2,
  UserRoundCog,
  UserPlus,
  Info,
  Home,
  Settings,
  Filter,
  Check,
  Layers,
  Tag,
  Mic,
  Briefcase,
  Star,
  MessageSquare,
  GraduationCap,
  ChevronDown,
} from 'lucide-react-native';
import { Image } from 'react-native';
import React from 'react';

const BOOK_ROLE_DOCK_ICON_SIZE = 15;

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

function isHiddenIceBreakerAdminRole(role: MeetingRoleAssignment): boolean {
  const cls = (role.role_classification || '').trim().toLowerCase();
  if (cls === 'ice breaker') return true;
  const value = (role.role_name || '').trim().toLowerCase();
  const m = value.match(/ice\s*breaker(?:\s*speech)?\s*(\d+)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return n >= 1 && n <= 5;
  }
  return false;
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
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showCategoryFilterModal, setShowCategoryFilterModal] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  const visibleRoles = useMemo(
    () => meetingRoles.filter((r) => !isHiddenIceBreakerAdminRole(r)),
    [meetingRoles]
  );

  const rolesByTab = useMemo(() => {
    return selectedTab === 'available'
      ? visibleRoles.filter((role) => (role.role_status ?? 'Available') !== 'Deleted')
      : visibleRoles.filter((role) => (role.role_status ?? 'Available') === 'Deleted');
  }, [visibleRoles, selectedTab]);

  const classificationTabs = useMemo(() => {
    if (!rolesByTab.length) return [];

    const classificationCounts = rolesByTab.reduce((acc, role) => {
      const classification = role.role_classification || 'Others';
      acc[classification] = (acc[classification] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const classificationDefinitions = [
      { key: 'Key Speakers', label: 'Key Speakers', color: '#ef4444' },
      { key: 'Keynote Speaker', label: 'Keynote Speaker', color: '#dc2626' },
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

    const tabs: ClassificationTab[] = [
      { value: 'all', label: 'All Roles', count: rolesByTab.length, color: '#6b7280' },
    ];

    classificationDefinitions.forEach((classDef) => {
      const count = classificationCounts[classDef.key] || 0;
      if (count > 0) {
        tabs.push({
          value: classDef.key,
          label: classDef.label,
          count,
          color: classDef.color,
        });
      }
    });

    Object.entries(classificationCounts).forEach(([classification, count]) => {
      if (!classificationDefinitions.some((def) => def.key === classification) && count > 0) {
        tabs.push({
          value: classification,
          label: classification,
          count,
          color: '#3b82f6',
        });
      }
    });

    return tabs;
  }, [rolesByTab]);

  // Auto-select first classification when tabs change
  useEffect(() => {
    if (selectedTab !== 'available' && selectedTab !== 'deleted') return;
    setShowCategoryFilterModal(false);
  }, [selectedTab]);

  useEffect(() => {
    if (classificationTabs.length === 0) return;
    if (!classificationTabs.some((t) => t.value === selectedClassification)) {
      setSelectedClassification('all');
    }
  }, [classificationTabs, selectedClassification]);

  const filteredRoles = useMemo(() => {
    if (selectedClassification === 'all' || !selectedClassification) return rolesByTab;
    return rolesByTab.filter((role) => (role.role_classification || 'Others') === selectedClassification);
  }, [rolesByTab, selectedClassification]);

  const availableVisibleCount = useMemo(
    () => visibleRoles.filter((r) => (r.role_status ?? 'Available') !== 'Deleted').length,
    [visibleRoles]
  );
  const deletedVisibleCount = useMemo(
    () => visibleRoles.filter((r) => (r.role_status ?? 'Available') === 'Deleted').length,
    [visibleRoles]
  );

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
    const parsePreparedOrIceSlot = (name: string): { kind: 'prepared' | 'ice'; slot: number } | null => {
      const value = (name || '').trim().toLowerCase();
      const preparedMatch = value.match(/^prepared\s*(?:speaker|speech)\s*(\d+)$/i);
      if (preparedMatch) {
        const slot = Number(preparedMatch[1]);
        if (slot >= 1 && slot <= 5) return { kind: 'prepared', slot };
        return null;
      }
      const iceMatch = value.match(/^ice\s*breaker(?:\s*speech)?\s*(\d+)$/i);
      if (iceMatch) {
        const slot = Number(iceMatch[1]);
        if (slot >= 1 && slot <= 5) return { kind: 'ice', slot };
        return null;
      }
      return null;
    };

    const hasSpeechDetails = (row: any) =>
      !!(
        (row?.speech_title || '').trim() ||
        (row?.pathway_name || '').trim() ||
        (row?.project_name || '').trim() ||
        (row?.project_number || '').trim() ||
        row?.level != null ||
        (row?.evaluation_form || '').trim() ||
        (row?.comments_for_evaluator || '').trim()
      );

    const transferSpeechDetailsForAdminSlotMove = async (
      newRoleName: string,
      targetMeetingId: string,
      targetUserId: string
    ) => {
      const targetSlot = parsePreparedOrIceSlot(newRoleName);
      if (!targetSlot) return;

      try {
        const { data: targetRow, error: targetErr } = await supabase
          .from('app_evaluation_pathway')
          .select(`
            id,
            speech_title,
            pathway_name,
            level,
            project_name,
            project_number,
            evaluation_form,
            comments_for_evaluator
          `)
          .eq('meeting_id', targetMeetingId)
          .eq('user_id', targetUserId)
          .eq('role_name', newRoleName)
          .maybeSingle();

        if (targetErr) {
          console.error('Error checking target pathway row:', targetErr);
          return;
        }

        const { data: candidates, error: sourceErr } = await supabase
          .from('app_evaluation_pathway')
          .select(`
            id,
            role_name,
            speech_title,
            pathway_name,
            level,
            project_name,
            project_number,
            evaluation_form,
            comments_for_evaluator,
            evaluation_title,
            table_topics_title,
            updated_at
          `)
          .eq('meeting_id', targetMeetingId)
          .eq('user_id', targetUserId)
          .or('role_name.ilike.%prepared%speaker%,role_name.ilike.%prepared%speech%,role_name.ilike.%ice%breaker%')
          .neq('role_name', newRoleName)
          .order('updated_at', { ascending: false });

        if (sourceErr) {
          console.error('Error loading source pathway rows:', sourceErr);
          return;
        }
        if (!candidates?.length) return;

        const scopedCandidates = candidates.filter((item: any) => !!parsePreparedOrIceSlot(item.role_name));
        if (!scopedCandidates.length) return;

        const source = scopedCandidates.find(hasSpeechDetails) || scopedCandidates[0];
        if (!source?.id) return;

        if (targetRow?.id) {
          if (hasSpeechDetails(targetRow)) return;

          const { error: mergeErr } = await supabase
            .from('app_evaluation_pathway')
            .update({
              speech_title: source.speech_title,
              pathway_name: source.pathway_name,
              level: source.level,
              project_name: source.project_name,
              project_number: source.project_number,
              evaluation_form: source.evaluation_form,
              comments_for_evaluator: source.comments_for_evaluator,
              evaluation_title: source.evaluation_title,
              table_topics_title: source.table_topics_title,
              updated_at: new Date().toISOString(),
              updated_by: targetUserId,
            })
            .eq('id', targetRow.id);

          if (mergeErr) {
            console.error('Error merging speech details to target slot:', mergeErr);
          }
          return;
        }

        const { error: moveErr } = await supabase
          .from('app_evaluation_pathway')
          .update({
            role_name: newRoleName,
            updated_at: new Date().toISOString(),
            updated_by: targetUserId,
          })
          .eq('id', source.id);

        if (moveErr) {
          console.error('Error moving speech details to new slot:', moveErr);
        }
      } catch (transferError) {
        console.error('Error in admin slot transfer flow:', transferError);
      }
    };

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

        if (memberId && meetingId) {
          await transferSpeechDetailsForAdminSlotMove(roleName, meetingId, memberId);
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
      case 'excomm': return EXCOMM_UI.solidBg;
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

  const currentClub = user?.clubs?.find((c) => c.id === user.currentClubId) || user?.clubs?.[0];
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const getCategoryIcon = (classification: string, isLarge: boolean = false, isSelected: boolean = false) => {
    const iconProps = {
      size: isLarge ? 15 : 7,
      color: isSelected ? '#ffffff' : '#3b82f6',
      strokeWidth: isLarge ? 2 : 1.3,
    };
    const k = classification.toLowerCase();
    switch (k) {
      case 'all':
      case 'all roles':
        return <Layers {...iconProps} />;
      case 'tag roles':
      case 'tag role':
        return <Tag {...iconProps} />;
      case 'educational speaker':
      case 'educational':
        return <GraduationCap {...iconProps} />;
      case 'speech evaluator':
      case 'speech evaluvator':
      case 'evaluator':
        return <Mic {...iconProps} />;
      case 'functionary roles':
      case 'functionary role':
        return <Briefcase {...iconProps} />;
      case 'key speakers':
      case 'prepared speaker':
        return <User {...iconProps} />;
      case 'keynote speaker':
        return <Star {...iconProps} />;
      case 'master evaluator':
      case 'master evaluvator':
      case 'general evaluator':
        return <Star {...iconProps} />;
      case 'ancillary speaker':
      case 'ancillary':
        return <MessageSquare {...iconProps} />;
      case 'club speakers':
        return <Users {...iconProps} />;
      case 'tt evaluator':
      case 'tt _ evaluvator':
        return <Mic {...iconProps} />;
      case 'on-the-spot speaking':
      case 'table topics':
        return <MessageSquare {...iconProps} />;
      case 'judge':
        return <Shield {...iconProps} />;
      case 'others':
        return <Layers {...iconProps} />;
      default:
        return <Building2 {...iconProps} />;
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
        style={[styles.roleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.manageMain}>
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

      <ScrollView
        style={styles.manageScroll}
        contentContainerStyle={styles.manageScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.notionSheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {currentClub && (
            <View
              style={[
                styles.notionClubBlock,
                { backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#fffbeb' },
              ]}
            >
              <View style={styles.clubHeader}>
                <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Building2 size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.clubInfo}>
                  <View style={styles.clubNameRow}>
                    <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {currentClub.name}
                    </Text>
                  </View>
                  <View style={styles.clubMeta}>
                    {currentClub.club_number && (
                      <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Club #{currentClub.club_number}
                      </Text>
                    )}
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(currentClub.role) }]}>
                      {getRoleIcon(currentClub.role)}
                      <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>
                        {formatRole(currentClub.role)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

          {currentClub ? <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} /> : null}

          <View style={styles.notionMeetingBlock}>
            <View style={styles.meetingCardContent}>
              <View style={[styles.dateBox, { backgroundColor: theme.colors.primary + '15' }]}>
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
                {meeting.meeting_number ? (
                  <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Meeting #{meeting.meeting_number}
                  </Text>
                ) : null}
                {meeting.meeting_start_time && (
                  <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Time: {meeting.meeting_start_time}
                    {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                  </Text>
                )}
                <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Mode:{' '}
                  {meeting.meeting_mode === 'in_person'
                    ? 'In Person'
                    : meeting.meeting_mode === 'online'
                      ? 'Online'
                      : 'Hybrid'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

          <View style={styles.notionTabsRow}>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: selectedTab === 'available' ? theme.colors.primary : 'transparent',
                  borderColor: selectedTab === 'available' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setSelectedTab('available')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: selectedTab === 'available' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Available
              </Text>
              <View
                style={[
                  styles.notionTabCount,
                  {
                    backgroundColor:
                      selectedTab === 'available' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.notionTabCountText,
                    { color: selectedTab === 'available' ? '#ffffff' : theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {availableVisibleCount}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: selectedTab === 'deleted' ? theme.colors.primary : 'transparent',
                  borderColor: selectedTab === 'deleted' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setSelectedTab('deleted')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: selectedTab === 'deleted' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Deleted
              </Text>
              <View
                style={[
                  styles.notionTabCount,
                  {
                    backgroundColor:
                      selectedTab === 'deleted' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.notionTabCountText,
                    { color: selectedTab === 'deleted' ? '#ffffff' : theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {deletedVisibleCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {classificationTabs.length > 1 ? (
            <>
              <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />
              <TouchableOpacity
                style={[
                  styles.categoryFilterBar,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.primary,
                  },
                ]}
                onPress={() => setShowCategoryFilterModal(true)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Filter roles by category"
              >
                <Filter size={20} color={theme.colors.primary} strokeWidth={2.2} />
                <Text
                  style={[styles.categoryFilterBarText, { color: theme.colors.text }]}
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.25}
                >
                  {selectedClassification === 'all'
                    ? selectedTab === 'available'
                      ? `Showing all ${classificationTabs.find((t) => t.value === 'all')?.count ?? rolesByTab.length} available roles`
                      : `Showing all ${classificationTabs.find((t) => t.value === 'all')?.count ?? rolesByTab.length} deleted roles`
                    : (() => {
                        const t = classificationTabs.find((x) => x.value === selectedClassification);
                        return t ? `Showing ${t.label} (${t.count})` : 'Showing filtered roles';
                      })()}
                </Text>
                <ChevronDown size={20} color={theme.colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </>
          ) : null}

          <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

          <View style={styles.notionRolesSection}>
            <View style={styles.rolesHeader}>
              <Text style={[styles.rolesHeaderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {selectedTab === 'available'
                  ? selectedClassification === 'all'
                    ? 'Available roles'
                    : classificationTabs.find((t) => t.value === selectedClassification)?.label || 'Roles'
                  : selectedClassification === 'all'
                    ? 'Deleted roles'
                    : classificationTabs.find((t) => t.value === selectedClassification)?.label || 'Roles'}
              </Text>
              <View style={[styles.rolesCountBadge, { backgroundColor: theme.colors.primary + '16' }]}>
                <Text style={[styles.rolesCountText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  {filteredRoles.length}
                </Text>
              </View>
            </View>

            {filteredRoles.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}

            {filteredRoles.length === 0 && (
              <View style={styles.emptyState}>
                <Users size={40} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available' ? 'No available roles' : 'No deleted roles'}
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available'
                    ? 'All roles have been deleted'
                    : 'Deleted roles will appear here'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.footerNavigationContent}
        >
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Home size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={BOOK_ROLE_DOCK_ICON_SIZE} color="#d97706" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push('/(tabs)/meetings')}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0ea5e9" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting
            </Text>
          </TouchableOpacity>
          {isExComm ? (
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/admin')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={BOOK_ROLE_DOCK_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={BOOK_ROLE_DOCK_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Settings
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </View>

      <Modal
        visible={showCategoryFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.categoryFilterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryFilterModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.categoryFilterModalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.categoryFilterModalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.categoryFilterModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                Roles by category
              </Text>
              <TouchableOpacity
                onPress={() => setShowCategoryFilterModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel="Close"
              >
                <X size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.categoryFilterModalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {classificationTabs.map((tab) => {
                const isSel = selectedClassification === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[
                      styles.categoryFilterModalRow,
                      {
                        backgroundColor: isSel ? theme.colors.primary + '14' : 'transparent',
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedClassification(tab.value);
                      setShowCategoryFilterModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.categoryFilterModalRowIcon,
                        {
                          backgroundColor: isSel ? theme.colors.primary + '30' : theme.colors.primary + '12',
                        },
                      ]}
                    >
                      {getCategoryIcon(tab.label, true, isSel)}
                    </View>
                    <View style={styles.categoryFilterModalRowText}>
                      <Text
                        style={[styles.categoryFilterModalRowLabel, { color: theme.colors.text }]}
                        numberOfLines={2}
                        maxFontSizeMultiplier={1.25}
                      >
                        {tab.label}
                      </Text>
                      <Text
                        style={[styles.categoryFilterModalRowMeta, { color: theme.colors.textSecondary }]}
                        maxFontSizeMultiplier={1.2}
                      >
                        {tab.count} {tab.count === 1 ? 'role' : 'roles'}
                      </Text>
                    </View>
                    {isSel ? (
                      <Check size={22} color={theme.colors.primary} strokeWidth={2.5} />
                    ) : (
                      <View style={styles.categoryFilterModalCheckSpacer} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  manageMain: {
    flex: 1,
    minHeight: 0,
  },
  manageScroll: {
    flex: 1,
  },
  manageScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionClubBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notionHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  notionMeetingBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  meetingCardDateTime: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingCardMode: {
    fontSize: 10,
    fontWeight: '500',
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 0,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  notionTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  notionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  notionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notionTabCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 0,
    minWidth: 22,
    alignItems: 'center',
  },
  notionTabCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 0,
    borderWidth: 2,
    gap: 12,
  },
  categoryFilterBarText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  categoryFilterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryFilterModalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '72%',
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  categoryFilterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryFilterModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 8,
  },
  categoryFilterModalList: {
    maxHeight: 420,
  },
  categoryFilterModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  categoryFilterModalRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFilterModalRowText: {
    flex: 1,
    minWidth: 0,
  },
  categoryFilterModalRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryFilterModalRowMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  categoryFilterModalCheckSpacer: {
    width: 22,
    height: 22,
  },
  notionRolesSection: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 18,
  },
  rolesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rolesHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  rolesCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
  },
  rolesCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
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
    borderRadius: 0,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 0,
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
    borderRadius: 0,
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
    borderRadius: 0,
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
    borderRadius: 0,
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
});
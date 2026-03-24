import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, User, BookOpen, GraduationCap, Target, MessageSquare, CreditCard as Edit, Save, X, ChevronDown, Plus, Info, FileText, Bell, Users, Star, Mic, CheckSquare, FileBarChart, Clock, CheckCircle } from 'lucide-react-native';
import { RefreshCw, RotateCcw } from 'lucide-react-native';
import { Image } from 'react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
  meeting_day: string | null;
}

interface RoleBooking {
  id: string;
  user_id: string;
  role_name: string;
  role_metric: string;
  booking_status: string;
  role_classification: string | null;
  app_user_profiles: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface ExistingEvaluationPathway {
  id: string;
  meeting_id: string;
  club_id: string;
  user_id: string;
  role_name: string;
  speech_title: string | null;
  pathway_name: string | null;
  level: number | null;
  project_name: string | null;
  evaluation_form: string | null;
  comments_for_evaluator: string | null;
  evaluation_title: string | null;
  table_topics_title: string | null;
  assigned_evaluator_id: string | null;
  completed_evaluation_form: string | null;
  comments_by_evaluator: string | null;
  project_number: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
  vpe_approval_requested: boolean | null;
  vpe_approval_requested_at: string | null;
  vpe_approval_request_id: string | null;
  vpe_approved: boolean | null;
  vpe_approved_at: string | null;
  vpe_approved_by: string | null;
  vpe_approval_decision_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export default function EvaluationCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [roleBookings, setRoleBookings] = useState<RoleBooking[]>([]);
  const [availableRoles, setAvailableRoles] = useState<RoleBooking[]>([]);
  const [existingEvaluationPathways, setExistingEvaluationPathways] = useState<Record<string, ExistingEvaluationPathway>>({});
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('speeches_delivered');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<RoleBooking | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editForm, setEditForm] = useState({
    speech_title: '',
    pathway_name: '',
    level: '',
    project_name: '',
    project_number: '',
    evaluation_title: '',
    table_topics_title: '',
    evaluation_form: '',
    comments_for_evaluator: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [speakerCategoryTab, setSpeakerCategoryTab] = useState<'prepared' | 'ice_breaker'>('prepared');

  const tabs = [
    {
      key: 'speeches_delivered',
      title: 'Prepared Speakers',
      metric: 'speeches_delivered',
      color: theme.colors.textSecondary,
    }
  ];

  useEffect(() => {
    if (meetingId) {
      loadData();
    }
  }, [meetingId]);

  // Refresh data when screen comes into focus (after navigating back from pathway form)
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Evaluation corner page focused, refreshing data...');
      if (meetingId) {
        loadData();
      }
    }, [meetingId])
  );

  const showPreparedSpeakerInfo = () => {
    setShowInfoModal(true);
  };

  const loadData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadRoleBookings(),
        loadExistingEvaluationPathways(),
        loadUserProfiles()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load evaluation data');
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

  const loadRoleBookings = async () => {
    if (!meetingId || !user?.currentClubId) return;

    try {
      // Load all roles with speeches_delivered metric
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          assigned_user_id,
          role_name,
          role_metric,
          booking_status,
          role_classification,
          role_status,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_status', 'Available')
        .eq('role_metric', 'speeches_delivered');

      if (error) {
        console.error('Error loading role bookings:', error);
        return;
      }

      // Separate booked and available roles
      const booked: RoleBooking[] = [];
      const available: RoleBooking[] = [];

      (data || []).forEach(role => {
        const roleData = {
          id: role.id,
          user_id: role.assigned_user_id || '',
          role_name: role.role_name,
          role_metric: role.role_metric,
          booking_status: role.booking_status,
          role_classification: role.role_classification,
          app_user_profiles: (role as any).app_user_profiles
        };

        if (role.booking_status === 'booked' && role.assigned_user_id) {
          booked.push(roleData);
        } else if (role.booking_status === 'open') {
          available.push(roleData);
        }
      });

      setRoleBookings(booked);
      setAvailableRoles(available);
    } catch (error) {
      console.error('Error loading role bookings:', error);
    }
  };

  const loadExistingEvaluationPathways = async () => {
    if (!meetingId || !user) return;

    try {
      console.log('🔄 Refreshing evaluation pathways data...');
      console.log('Loading existing evaluation pathways for meeting:', meetingId);
      
      const { data, error } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          meeting_id,
          club_id,
          user_id,
          role_name,
          speech_title,
          pathway_name,
          level,
          project_name,
          evaluation_form,
          comments_for_evaluator,
          evaluation_title,
          table_topics_title,
          assigned_evaluator_id,
          completed_evaluation_form,
          comments_by_evaluator,
          project_number,
          created_at,
          updated_at,
          updated_by,
          vpe_approval_requested,
          vpe_approval_requested_at,
          vpe_approval_request_id,
          vpe_approved,
          vpe_approved_at,
          vpe_approved_by,
          vpe_approval_decision_id,
          is_locked,
          locked_at
        `)
        .eq('meeting_id', meetingId);

      console.log('Evaluation pathways query result:', { count: data?.length || 0, error });

      if (error) {
        console.error('Error loading existing evaluation pathways:', error);
        return;
      }

      // Group by user_id and role_name
      const pathways: Record<string, ExistingEvaluationPathway> = {};
      (data || []).forEach(pathway => {
        const key = `${pathway.user_id}_${pathway.role_name}`;
        pathways[key] = pathway as ExistingEvaluationPathway;
        console.log('✅ Loaded pathway for key:', key, {
          speechTitle: pathway.speech_title,
          pathwayName: pathway.pathway_name,
          level: pathway.level,
          projectName: pathway.project_name,
          projectNumber: pathway.project_number,
          evaluationForm: pathway.evaluation_form,
          assignedEvaluatorId: pathway.assigned_evaluator_id
        });
      });

      setExistingEvaluationPathways(pathways);
      console.log('✅ Total pathways loaded:', Object.keys(pathways).length);
      console.log('✅ All pathways:', JSON.stringify(pathways, null, 2));
    } catch (error) {
      console.error('Error loading existing evaluation pathways:', error);
    }
  };

  const loadUserProfiles = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true);

      if (error) {
        console.error('Error loading user profiles:', error);
        return;
      }

      const profiles: Record<string, UserProfile> = {};
      (data || []).forEach(item => {
        const profile = (item as any).app_user_profiles;
        profiles[profile.id] = profile;
      });

      setUserProfiles(profiles);
    } catch (error) {
      console.error('Error loading user profiles:', error);
    }
  };

  const getFilteredBookings = () => {
    const currentTab = tabs.find(t => t.key === selectedTab);
    if (!currentTab) return [];

    // Filter by role_metric first
    let filtered = roleBookings.filter(booking => booking.role_metric === currentTab.metric);

    // Then filter by speaker category (Prepared Speaker vs Ice Breaker)
    if (speakerCategoryTab === 'prepared') {
      filtered = filtered.filter(booking =>
        booking.role_classification === 'Prepared Speaker'
      );
    } else if (speakerCategoryTab === 'ice_breaker') {
      filtered = filtered.filter(booking =>
        booking.role_classification === 'Ice Breaker'
      );
    }

    // Sort by role name to maintain sequence (Prepared Speaker 1, 2, 3, etc.)
    return filtered.sort((a, b) => {
      // Extract numbers from role names for proper sorting
      const getSequenceNumber = (roleName: string) => {
        const match = roleName.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const aNumber = getSequenceNumber(a.role_name);
      const bNumber = getSequenceNumber(b.role_name);

      // Same role type, sort by number
      return aNumber - bNumber;
    });
  };

  const getFilteredAvailableRoles = () => {
    const currentTab = tabs.find(t => t.key === selectedTab);
    if (!currentTab) return [];

    // Filter by role_metric first
    let filtered = availableRoles.filter(role => role.role_metric === currentTab.metric);

    // Then filter by speaker category (Prepared Speaker vs Ice Breaker)
    if (speakerCategoryTab === 'prepared') {
      filtered = filtered.filter(role =>
        role.role_classification === 'Prepared Speaker'
      );
    } else if (speakerCategoryTab === 'ice_breaker') {
      filtered = filtered.filter(role =>
        role.role_classification === 'Ice Breaker'
      );
    }

    // Sort by role name to maintain sequence
    return filtered.sort((a, b) => {
      const getSequenceNumber = (roleName: string) => {
        const match = roleName.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      };

      const aNumber = getSequenceNumber(a.role_name);
      const bNumber = getSequenceNumber(b.role_name);

      return aNumber - bNumber;
    });
  };

  const getEvaluationPathwayKey = (userId: string, roleName: string) => {
    return `${userId}_${roleName}`;
  };

  const hasPathwayInfo = (booking: RoleBooking) => {
    const key = getEvaluationPathwayKey(booking.user_id, booking.role_name);
    const pathway = existingEvaluationPathways[key];
    
    if (!pathway) return false;
    
    const currentTab = tabs.find(t => t.key === selectedTab);
    if (!currentTab) return false;
    
    return !!(pathway.speech_title || pathway.pathway_name || pathway.level || pathway.project_name || pathway.evaluation_form || pathway.comments_for_evaluator);
  };

  const handleEditPathway = (booking: RoleBooking) => {
    const key = getEvaluationPathwayKey(booking.user_id, booking.role_name);
    const pathway = existingEvaluationPathways[key];

    if (pathway?.vpe_approval_requested) {
      Alert.alert(
        'Cannot Edit',
        'Speech details cannot be edited after requesting VPE approval.'
      );
      return;
    }

    router.push(`/pathway-form?meetingId=${meetingId}&roleId=${booking.id}`);
  };

  const handleSavePathway = async () => {
    if (!selectedBooking || !meetingId || !user?.currentClubId) return;

    // Validate mandatory evaluation form field
    if (!editForm.evaluation_form.trim()) {
      Alert.alert('Error', 'Evaluation form link is required');
      return;
    }

    setIsSaving(true);

    try {
      const currentTab = tabs.find(t => t.key === selectedTab);
      if (!currentTab) return;

      let saveData: any = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        user_id: selectedBooking.user_id,
        role_name: selectedBooking.role_name,
        pathway_name: editForm.pathway_name.trim() || null,
        level: editForm.level ? parseInt(editForm.level) : null,
        project_name: editForm.project_name.trim() || null,
        project_number: editForm.project_number.trim() || null,
        evaluation_form: editForm.evaluation_form.trim() || null,
        comments_for_evaluator: editForm.comments_for_evaluator.trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };

      // Add speech title
      saveData.speech_title = editForm.speech_title.trim() || null;

      // Check if pathway already exists
      const { data: existingData, error: checkError } = await supabase
        .from('app_evaluation_pathway')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('user_id', selectedBooking.user_id)
        .eq('role_name', selectedBooking.role_name)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing pathway:', checkError);
        Alert.alert('Error', 'Failed to check existing pathway');
        return;
      }

      if (existingData) {
        // Update existing pathway
        const { error } = await supabase
          .from('app_evaluation_pathway')
          .update(saveData)
          .eq('id', existingData.id);

        if (error) {
          console.error('Error updating evaluation pathway:', error);
          Alert.alert('Error', `Failed to update pathway information: ${error.message}`);
          return;
        }
      } else {
        // Create new pathway
        const { error } = await supabase
          .from('app_evaluation_pathway')
          .insert({
            ...saveData,
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating evaluation pathway:', error);
          Alert.alert('Error', `Failed to save pathway information: ${error.message}`);
          return;
        }
      }

      Alert.alert('Success', 'Pathway information saved successfully');
      setShowEditModal(false);
      setSelectedBooking(null);
      loadExistingEvaluationPathways();
    } catch (error) {
      console.error('Error saving pathway:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getUpdatedByUser = (pathway: ExistingEvaluationPathway) => {
    return userProfiles[pathway.updated_by];
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const updatedDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return updatedDate.toLocaleDateString();
  };

  const handleOpenEvaluationForm = async (url: string) => {
    try {
      // Validate and fix URL format
      let formattedUrl = url.trim();

      // Check if URL has a protocol, if not add https://
      if (!formattedUrl.match(/^https?:\/\//i)) {
        formattedUrl = 'https://' + formattedUrl;
      }

      // Validate it's a valid URL
      try {
        new URL(formattedUrl);
      } catch (e) {
        Alert.alert('Error', 'Invalid evaluation form URL. Please update the form link.');
        return;
      }

      const supported = await Linking.canOpenURL(formattedUrl);
      if (supported) {
        await Linking.openURL(formattedUrl);
      } else {
        Alert.alert('Error', 'Cannot open this evaluation form link');
      }
    } catch (error) {
      console.error('Error opening evaluation form:', error);
      Alert.alert('Error', 'Failed to open evaluation form');
    }
  };

  const isMeetingDay = () => {
    if (!meeting) return false;

    const today = new Date();
    const meetingDate = new Date(meeting.meeting_date);

    // Reset time parts to compare only dates
    today.setHours(0, 0, 0, 0);
    meetingDate.setHours(0, 0, 0, 0);

    return today.getTime() === meetingDate.getTime();
  };

  const handleRequestVPEApproval = async (pathway: ExistingEvaluationPathway) => {
    if (!user?.currentClubId) return;

    // Check if it's the meeting day
    if (!isMeetingDay()) {
      Alert.alert(
        'Not Available',
        'This feature will be enabled only on the day of the meeting.'
      );
      return;
    }

    // Validate all required fields are present
    const validationErrors: string[] = [];
    if (!pathway.speech_title?.trim()) validationErrors.push('Speech Title');
    if (!pathway.pathway_name?.trim()) validationErrors.push('Pathway');
    if (!pathway.level) validationErrors.push('Level');
    if (!pathway.project_name?.trim()) validationErrors.push('Project Name');
    if (!pathway.evaluation_form?.trim()) validationErrors.push('Evaluation Form');
    if (!pathway.assigned_evaluator_id) validationErrors.push('Evaluator');

    if (validationErrors.length > 0) {
      Alert.alert(
        'Missing Information',
        `Please complete the following before requesting VPE approval:\n\n${validationErrors.join('\n')}`
      );
      return;
    }

    Alert.alert(
      'Request VPE Approval',
      'Please verify all speech, pathway, and evaluator details. Once submitted, no changes can be made.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_evaluation_pathway')
                .update({
                  vpe_approval_requested: true,
                  vpe_approval_requested_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  updated_by: user.id
                })
                .eq('id', pathway.id);

              if (error) {
                console.error('Error requesting VPE approval:', error);
                Alert.alert('Error', 'Failed to submit approval request');
                return;
              }

              Alert.alert('Success', 'Your speech has been submitted for VPE approval');
              loadExistingEvaluationPathways();
            } catch (error) {
              console.error('Error requesting VPE approval:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const canRequestVPEApproval = (pathway: ExistingEvaluationPathway | undefined) => {
    if (!pathway) return false;
    if (pathway.vpe_approval_requested) return false;
    if (!isMeetingDay()) return false;

    return !!(
      pathway.speech_title?.trim() &&
      pathway.pathway_name?.trim() &&
      pathway.level &&
      pathway.project_name?.trim() &&
      pathway.evaluation_form?.trim() &&
      pathway.assigned_evaluator_id
    );
  };

  const ParticipantCard = ({ booking }: { booking: RoleBooking }) => {
    const key = getEvaluationPathwayKey(booking.user_id, booking.role_name);
    const pathway = existingEvaluationPathways[key];
    const hasInfo = hasPathwayInfo(booking);
    const currentTab = tabs.find(t => t.key === selectedTab);
    const updatedByUser = pathway ? getUpdatedByUser(pathway) : null;
    const assignedEvaluator = pathway?.assigned_evaluator_id ? userProfiles[pathway.assigned_evaluator_id] : null;

    console.log('🎯 ParticipantCard render for:', booking.app_user_profiles.full_name);
    console.log('   - Key:', key);
    console.log('   - Pathway found:', !!pathway);
    console.log('   - Evaluation form:', pathway?.evaluation_form);
    console.log('   - Assigned evaluator ID:', pathway?.assigned_evaluator_id);
    console.log('   - Assigned evaluator name:', assignedEvaluator?.full_name);

    return (
      <View style={[styles.participantCard, {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border
      }]}>
        {/* User Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.background }]}>
          <View style={styles.profileContent}>
            <View style={[styles.profileAvatar, { backgroundColor: theme.colors.border }]}>
              {booking.app_user_profiles.avatar_url ? (
                <Image
                  source={{ uri: booking.app_user_profiles.avatar_url }}
                  style={styles.profileAvatarImage}
                />
              ) : (
                <User size={32} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {booking.app_user_profiles.full_name}
              </Text>
              <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {booking.role_name}
              </Text>
            </View>
          </View>
        </View>

        {/* Speech Information Section */}
        {hasInfo && pathway && (pathway.speech_title || pathway.pathway_name || pathway.project_name) && (
          <View style={[styles.speechInfoSection, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.sectionTitleSubsection, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Speech Information
            </Text>

            {pathway.speech_title && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {pathway.speech_title}
                </Text>
              </View>
            )}

            {pathway.pathway_name && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {pathway.pathway_name}
                </Text>
              </View>
            )}

            {pathway.project_name && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project Name:</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {pathway.project_name}
                </Text>
              </View>
            )}

            {pathway.level && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Level:</Text>
                <View style={styles.infoValueRow}>
                  <View style={[styles.levelPill, { backgroundColor: '#3b82f6' }]}>
                    <Text style={styles.levelPillText} maxFontSizeMultiplier={1.3}>
                      L{pathway.level}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {pathway.project_number && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project Number:</Text>
                <View style={styles.infoValueRow}>
                  <View style={[styles.levelPill, { backgroundColor: '#10b981' }]}>
                    <Text style={styles.levelPillText} maxFontSizeMultiplier={1.3}>
                      P{pathway.project_number}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Evaluation Information Section */}
        <View style={[styles.evaluationInfoSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitleSubsection, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Evaluation Information
          </Text>

          {/* Evaluation Form */}
          <View style={styles.evaluationFormRow}>
            <View style={styles.evaluationFormLabel}>
              <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Evaluation Form:
              </Text>
            </View>
            {pathway?.evaluation_form ? (
              <TouchableOpacity
                style={[styles.openFormButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => handleOpenEvaluationForm(pathway.evaluation_form!)}
              >
                <Text style={[styles.openFormButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                  Open
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.infoValue, { color: theme.colors.textSecondary, fontStyle: 'italic' }]} maxFontSizeMultiplier={1.3}>
                Not added yet
              </Text>
            )}
          </View>

          {/* Evaluator */}
          <View style={styles.evaluatorRow}>
            {assignedEvaluator?.avatar_url ? (
              <Image
                source={{ uri: assignedEvaluator.avatar_url }}
                style={styles.evaluatorAvatarSmall}
              />
            ) : (
              <View style={[styles.evaluatorIconSmall, {
                backgroundColor: pathway?.assigned_evaluator_id ? '#a78bfa30' : theme.colors.border
              }]}>
                <User size={18} color={pathway?.assigned_evaluator_id ? '#a78bfa' : theme.colors.textSecondary} />
              </View>
            )}
            <View style={styles.evaluatorInfoInline}>
              <Text style={[styles.evaluatorLabelSmall, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Evaluator
              </Text>
              <Text style={[styles.evaluatorNameInline, {
                color: pathway?.assigned_evaluator_id ? theme.colors.text : theme.colors.textSecondary,
                fontStyle: pathway?.assigned_evaluator_id ? 'normal' : 'italic'
              }]} maxFontSizeMultiplier={1.3}>
                {pathway?.assigned_evaluator_id && assignedEvaluator
                  ? assignedEvaluator.full_name
                  : 'Unassigned'}
              </Text>
            </View>
          </View>
        </View>

        {/* Approval Status Badge */}
        {pathway?.vpe_approval_requested && (
          <View style={[styles.approvalStatusBadge, {
            backgroundColor: pathway.vpe_approved === true
              ? '#10b98130'
              : pathway.vpe_approved === false
              ? '#ef444430'
              : '#f59e0b30',
            borderWidth: 1,
            borderColor: pathway.vpe_approved === true
              ? '#10b981'
              : pathway.vpe_approved === false
              ? '#ef4444'
              : '#f59e0b'
          }]}>
            <CheckCircle size={18} color={
              pathway.vpe_approved === true
                ? '#10b981'
                : pathway.vpe_approved === false
                ? '#ef4444'
                : '#f59e0b'
            } />
            <View style={{ flex: 1, flexDirection: 'column' }}>
              <Text style={[styles.approvalStatusText, {
                color: pathway.vpe_approved === true
                  ? '#10b981'
                  : pathway.vpe_approved === false
                  ? '#ef4444'
                  : '#f59e0b'
              }]} maxFontSizeMultiplier={1.3}>
                {pathway.vpe_approved === true
                  ? 'VPE Approved'
                  : pathway.vpe_approved === false
                  ? 'VPE Denied'
                  : 'Pending VPE Approval'}
              </Text>
              {pathway.is_locked && (
                <Text style={[styles.lockedSubtext, {
                  color: theme.colors.textSecondary,
                  fontSize: 11,
                  fontStyle: 'italic',
                  marginTop: 2
                }]} maxFontSizeMultiplier={1.3}>
                  Record locked - No changes allowed
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, {
              backgroundColor: pathway?.is_locked
                ? theme.colors.textSecondary + '40'
                : theme.colors.primary,
              opacity: pathway?.is_locked ? 0.6 : 1
            }]}
            onPress={() => handleEditPathway(booking)}
            disabled={pathway?.is_locked === true}
          >
            <Text style={[styles.actionButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
              {pathway?.is_locked
                ? 'Locked - No Edits Allowed'
                : hasInfo ? 'Edit Speech Details' : 'Add Speech Details'}
            </Text>
          </TouchableOpacity>

          {/* VPE Approval Request Button */}
          {hasInfo && !pathway?.vpe_approval_requested && !pathway?.is_locked && (
            <TouchableOpacity
              style={[styles.approvalButton, {
                backgroundColor: canRequestVPEApproval(pathway) ? '#10b981' : theme.colors.textSecondary + '40',
                opacity: canRequestVPEApproval(pathway) ? 1 : 0.6
              }]}
              onPress={() => pathway && handleRequestVPEApproval(pathway)}
              disabled={!canRequestVPEApproval(pathway)}
            >
              <CheckCircle size={20} color="#ffffff" />
              <Text style={[styles.approvalButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                Speech completed — requesting VPE approval.
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading pathway progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredBookings = getFilteredBookings();
  const filteredAvailableRoles = getFilteredAvailableRoles();
  const currentTab = tabs.find(t => t.key === selectedTab);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
      }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {speakerCategoryTab === 'prepared' ? 'Prepared Speaker' : 'Ice Breaker Speaker'}
        </Text>
        <TouchableOpacity style={styles.infoButton} onPress={showPreparedSpeakerInfo}>
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Info Card */}
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

        {/* Speaker Category Tabs */}
        <View style={styles.categoryTabsContainer}>
          <TouchableOpacity
            style={[
              styles.categoryTab,
              speakerCategoryTab === 'prepared' && styles.categoryTabActive,
              {
                backgroundColor: speakerCategoryTab === 'prepared' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setSpeakerCategoryTab('prepared')}
          >
            <Text
              style={[
                styles.categoryTabText,
                { color: speakerCategoryTab === 'prepared' ? '#ffffff' : theme.colors.text }
              ]}
              maxFontSizeMultiplier={1.3}
            >
              Prepared Speakers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryTab,
              speakerCategoryTab === 'ice_breaker' && styles.categoryTabActive,
              {
                backgroundColor: speakerCategoryTab === 'ice_breaker' ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setSpeakerCategoryTab('ice_breaker')}
          >
            <Text
              style={[
                styles.categoryTabText,
                { color: speakerCategoryTab === 'ice_breaker' ? '#ffffff' : theme.colors.text }
              ]}
              maxFontSizeMultiplier={1.3}
            >
              Ice Breaker Speakers
            </Text>
          </TouchableOpacity>
        </View>

        {/* Participants Section */}
        <View style={styles.participantsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {speakerCategoryTab === 'prepared' ? 'Prepared Speakers' : 'Ice Breaker Speakers'} ({filteredBookings.length})
            </Text>
          </View>

          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <ParticipantCard key={booking.id} booking={booking} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyStateIcon, { backgroundColor: theme.colors.surface }]}>
                <User size={48} color={theme.colors.textSecondary} />
              </View>
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {speakerCategoryTab === 'prepared'
                  ? 'Your next speech opportunity awaits 🎤🌟'
                  : 'Your speaking journey begins today 🎤🔥🚀'} 
              </Text>
              <TouchableOpacity
                style={[styles.bookRoleButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push(`/book-a-role?meetingId=${meetingId}`)}
              >
                <Text style={styles.bookRoleButtonText} maxFontSizeMultiplier={1.3}>Book the Role</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Available Slots Section */}
          {filteredAvailableRoles.length > 0 && (
            <View style={styles.availableSlotsSection}>
              <View style={styles.availableHeader}>
                <Text style={[styles.availableTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Available Slots ({filteredAvailableRoles.length})
                </Text>
              </View>

              {filteredAvailableRoles.map((role) => (
                <View
                  key={role.id}
                  style={[
                    styles.availableSlotCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                    }
                  ]}
                >
                  <View style={styles.availableSlotContent}>
                    <View style={[styles.availableSlotIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                      <User size={24} color={theme.colors.primary} />
                    </View>
                    <View style={styles.availableSlotInfo}>
                      <Text style={[styles.availableSlotName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {role.role_name}
                      </Text>
                      <Text style={[styles.availableSlotSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Available to book
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.bookSlotButton, { backgroundColor: theme.colors.primary }]}
                      onPress={() => router.push(`/book-a-role?meetingId=${meetingId}`)}
                    >
                      <Text style={styles.bookSlotButtonText} maxFontSizeMultiplier={1.3}>Book</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Navigation Quick Actions */}
        <View style={[styles.quickActionsBoxContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsContent}>
            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/meeting-agenda-view', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3E7' }]}>
                <FileText size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Agenda</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/ah-counter-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5E5' }]}>
                <Bell size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Ah Counter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/attendance-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                <Users size={24} color="#ec4899" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F4FD' }]}>
                <Calendar size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/educational-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFE5D9' }]}>
                <BookOpen size={24} color="#f97316" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Educational Corner</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/general-evaluator-notes', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Star size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>General Evaluator</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/grammarian', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F3E8FF' }]}>
                <FileText size={24} color="#8b5cf6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Grammarian</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/keynote-speaker-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                <Mic size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Keynote Speaker</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/live-voting', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E9D5FF' }]}>
                <CheckSquare size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Live Voting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/quick-overview', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Quick Overview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/role-completion-report', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                <CheckSquare size={24} color="#3b82f6" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role Completion</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/prepared-speech-evaluations', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FECACA' }]}>
                <FileBarChart size={24} color="#dc2626" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Evaluation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/timer-report-details', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F0E7FE' }]}>
                <Clock size={24} color="#9333ea" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Timer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/table-topic-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FEE2E2' }]}>
                <MessageSquare size={24} color="#ef4444" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Table Topics</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {speakerCategoryTab === 'prepared' ? 'Prepared Speaker 🎤' : 'Ice Breaker Speaker ❄️'}
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                All the best for your speech! 🎤
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Click Add Speech Details and enter your speech title, pathway, level, and project information, then upload your evaluation form. Your VPE will assign an evaluator for your speech.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Connect with your mentor for guidance and rehearsal, and feel free to reach out to the VPE for any support you may need.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {speakerCategoryTab === 'prepared'
                  ? 'Prepared speeches are 5 to 7 minutes, with an additional 30 seconds grace time. This typically means your script should be around 450–550 words.'
                  : 'Ice Breaker speeches are 4 to 6 minutes, designed to introduce yourself to the club. Share your background, interests, and what brought you to Toastmasters.'}
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                After completing your speech, go to Role Completion and mark your role as complete. Also, check the Timer Report for qualification details. You can also mark your attendance under the Attendance Report.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                Your evaluator will share feedback on your speech. You can view your final evaluation form under Prepared Speech Evaluation. Please coordinate with your VPE and evaluator to ensure all steps are completed on time.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
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
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    letterSpacing: -0.5,
  },
  infoButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    minHeight: 96,
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
    gap: 13,
    zIndex: 1,
  },
  dateBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
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
  meetingCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabActive: {
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  participantsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  participantCard: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  speechInfoSection: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionTitleSubsection: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  evaluatorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  evaluatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  evaluatorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  evaluatorInfo: {
    flex: 1,
  },
  evaluatorLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  evaluatorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  evaluationInfoSection: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  evaluationFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  evaluationFormLabel: {
    flex: 1,
  },
  evaluatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  evaluatorIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  evaluatorAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  evaluatorInfoInline: {
    flex: 1,
  },
  evaluatorLabelSmall: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  evaluatorNameInline: {
    fontSize: 15,
    fontWeight: '600',
  },
  openFormButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  openFormButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
  },
  approvalStatusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonsContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  approvalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  approvalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyStateSubtext: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  bookRoleButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  bookRoleButtonText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  availableSlotsSection: {
    marginTop: 24,
  },
  availableHeader: {
    marginBottom: 12,
  },
  availableTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  availableSlotCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  availableSlotContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  availableSlotIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableSlotInfo: {
    flex: 1,
  },
  availableSlotName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  availableSlotSubtext: {
    fontSize: 14,
  },
  bookSlotButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookSlotButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  infoModalText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoModalButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  quickActionsBoxContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 13,
    borderWidth: 1,
  },
  quickActionsContent: {
    gap: 16,
    paddingHorizontal: 4,
  },
  quickActionItem: {
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
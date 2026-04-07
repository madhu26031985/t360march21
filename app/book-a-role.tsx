import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Animated, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Calendar, Users, User, Crown, Shield, Eye, UserCheck, Building2, X, Save, BookOpen, GraduationCap, MessageSquare, Lightbulb, CreditCard as Edit, Clock, MapPin, FileText, CreditCard as Edit2, ChevronDown, Layers, Tag, Mic, Briefcase, Star, MousePointerClick, Filter, Check, Home, Settings } from 'lucide-react-native';

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

interface MeetingRole {
  id: string;
  meeting_id: string;
  role_id: string;
  role_name: string;
  role_metric: string;
  assigned_user_id: string | null;
  booking_status: string;
  role_classification: string | null;
  booked_at: string | null;
  withdrawn_at: string | null;
  speech_title: string | null;
  speech_objectives: string | null;
  app_user_profiles?: {
    full_name: string;
    email: string;
  };
}

// Updated ExistingCollaboration interface to reflect new database columns
// interface ExistingCollaboration {
//   id: string;
//   user_id: string;
//   role_name: string;
//   collaboration_type: string;
//   // Theme fields
//   theme_of_the_day: string | null;
//   theme_summary: string | null;
//   // Speech fields
//   speech_title: string | null;
//   speech_objectives: string | null;
//   pathway: string | null;
//   project: string | null;
//   level: number | null;
//   evaluation_form: string | null;
//   duration: number | null; // For educational speeches
//   comments: string | null; // For educational speeches
//   // Grammarian fields
//   word_of_the_day: string | null;
//   idiom_of_the_day: string | null;
//   phrase_of_the_day: string | null;
//   quote_of_the_day: string | null;
//   // General Evaluator fields
//   evaluation_summary: string | null;
//   what_went_well: string | null;
//   what_needs_improvement: string | null;
//   personal_notes: string | null;
// }

// Removed SpeechForm, EvaluationForm, ThemeForm, WordForm interfaces

interface ClassificationTab {
  value: string;
  label: string;
  count: number;
  color: string;
}

/** Front-end only: hide Ice Breaker category and named slots 1–5 on Book a Role */
function isHiddenIceBreakerBookRole(role: MeetingRole): boolean {
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

export default function BookARole() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingIdParam = params.meetingId as string;
  const initialTabParam = params.initialTab as string | undefined;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [availableRoles, setAvailableRoles] = useState<MeetingRole[]>([]); // Keep this for filtering
  const [myBookings, setMyBookings] = useState<MeetingRole[]>([]);
  const [existingCollaborations, setExistingCollaborations] = useState<Record<string, any>>({});
  // Removed isEditMode state
  const [bookedByOthers, setBookedByOthers] = useState<MeetingRole[]>([]);
  // Removed showMeetingInfo state
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'available' | 'my_bookings' | 'booked_by_others'>('available');
  const [selectedClassification, setSelectedClassification] = useState('all');
  const [classificationTabs, setClassificationTabs] = useState<ClassificationTab[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<MeetingRole[]>([]);
  const [withdrawConfirmRole, setWithdrawConfirmRole] = useState<MeetingRole | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showCategoryFilterModal, setShowCategoryFilterModal] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // Removed all speech, evaluation, theme, word form modal states and their associated form states

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    if (meetingIdParam && meetings.length > 0) {
      const targetMeeting = meetings.find(m => m.id === meetingIdParam);
      if (targetMeeting && targetMeeting.id !== selectedMeeting?.id) {
        setSelectedMeeting(targetMeeting);
      }
    }
  }, [meetingIdParam, meetings]);

  useEffect(() => {
    if (!initialTabParam) return;
    if (initialTabParam === 'my_bookings' || initialTabParam === 'available' || initialTabParam === 'booked_by_others') {
      setSelectedTab(initialTabParam);
    }
  }, [initialTabParam]);

  useEffect(() => {
    if (selectedMeeting) {
      loadMeetingRoles(); // Keep this
      // loadExistingCollaborations(); // Commented out
    }
  }, [selectedMeeting]);

  useEffect(() => {
    filterRolesByTab();
    updateClassificationTabs();
  }, [availableRoles, myBookings, bookedByOthers, selectedTab]);

  useEffect(() => {
    filterRolesByClassification();
  }, [selectedClassification]);

  useEffect(() => {
    if (selectedTab !== 'available') setShowCategoryFilterModal(false);
  }, [selectedTab]);

  useEffect(() => {
    if (
      classificationTabs.length > 0 &&
      !classificationTabs.some((t) => t.value === selectedClassification)
    ) {
      setSelectedClassification('all');
    }
  }, [classificationTabs, selectedClassification]);

  const loadMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const fourHoursAgo = new Date();
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
      const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'open')
        .gte('meeting_date', cutoffDate)
        .order('meeting_date', { ascending: true });

      if (error) {
        console.error('Error loading meetings:', error);
        Alert.alert('Error', `Failed to load meetings: ${error.message}`);
        return;
      }

      const now = new Date();
      const filteredMeetings = (data || []).filter(meeting => {
        const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
        const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceMeetingEnd < 4;
      });

      setMeetings(filteredMeetings);

      // Auto-select meeting based on URL parameter or default to first
      if (filteredMeetings.length > 0) {
        if (meetingIdParam) {
          const targetMeeting = filteredMeetings.find(m => m.id === meetingIdParam);
          setSelectedMeeting(targetMeeting || filteredMeetings[0]);
        } else {
          setSelectedMeeting(filteredMeetings[0]);
        }
      }
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeetingRoles = async () => {
    if (!selectedMeeting || !user) return;

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
        .eq('meeting_id', selectedMeeting.id)
        .order('order_index');

      if (error) {
        console.error('Error loading meeting roles:', error);
        Alert.alert('Error', 'Failed to load meeting roles');
        return;
      }

      // Some environments have `role_status` NULL for normal roles.
      // Treat NULL as "Available" and only exclude explicit "Deleted".
      const roles = (data || []).filter((r: any) => (r?.role_status ?? 'Available') !== 'Deleted');
      
      // Separate roles into categories
      const available = roles.filter(role => !role.assigned_user_id && !isHiddenIceBreakerBookRole(role));
      const myRoles = roles.filter(
        (role) => role.assigned_user_id === user.id && !isHiddenIceBreakerBookRole(role)
      );
      const othersRoles = roles.filter(
        (role) =>
          role.assigned_user_id && role.assigned_user_id !== user.id && !isHiddenIceBreakerBookRole(role)
      );

      setAvailableRoles(available);
      setMyBookings(myRoles);
      setBookedByOthers(othersRoles);
    } catch (error) {
      console.error('Error loading meeting roles:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // const loadExistingCollaborations = async () => {
  //   if (!selectedMeeting || !user) return;

  //   try {
  //     const { data, error } = await supabase
  //       .from('app_meeting_collaboration')
  //       .select(`
  //         id,
  //         user_id,
  //         role_name,
  //         collaboration_type,
  //         theme_of_the_day,
  //         theme_summary,
  //         speech_title,
  //         speech_objectives,
  //         pathway,
  //         project,
  //         level,
  //         evaluation_form,
  //         duration,
  //         comments,
  //         word_of_the_day,
  //         idiom_of_the_day,
  //         phrase_of_the_day,
  //         quote_of_the_day,
  //         evaluation_summary,
  //         what_went_well,
  //         what_needs_improvement,
  //         personal_notes
  //       `)
  //       .eq('meeting_id', selectedMeeting.id)
  //       .eq('user_id', user.id);

  //     if (error) {
  //       console.error('Error loading existing collaborations:', error);
  //       return;
  //     }

  //     // Group by role name
  //     const collaborations: Record<string, ExistingCollaboration> = {};
  //     (data || []).forEach(collab => {
  //       collaborations[collab.role_name] = collab as ExistingCollaboration;
  //     });

  //     setExistingCollaborations(collaborations);
  //   } catch (error) {
  //     console.error('Error loading existing collaborations:', error);
  //   }
  // };

  const filterRolesByTab = () => {
    let roles: MeetingRole[] = [];
    
    switch (selectedTab) {
      case 'available':
        roles = availableRoles;
        break;
      case 'my_bookings':
        roles = myBookings;
        break;
      case 'booked_by_others':
        roles = bookedByOthers;
        break;
    }
    
    setFilteredRoles(roles);
  };

  const updateClassificationTabs = () => {
    let roles: MeetingRole[] = [];

    switch (selectedTab) {
      case 'available':
        roles = availableRoles;
        break;
      case 'my_bookings':
        roles = myBookings;
        break;
      case 'booked_by_others':
        roles = bookedByOthers;
        break;
    }

    const classificationCounts = roles.reduce((acc, role) => {
      const classification = role.role_classification || 'Others';
      acc[classification] = (acc[classification] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tabs: ClassificationTab[] = [
      {
        value: 'all',
        label: 'All Roles',
        count: roles.length,
        color: '#6b7280'
      }
    ];

    const orderedClassifications = [
      'Club Speakers',
      'Key Speakers',
      'Tag roles',
      'Prepared Speaker',
      'On-the-Spot Speaking',
      'Speech evaluvator',
      'Educational speaker',
      'Keynote speakers',
      'Ancillary Speaker',
      'Functionary Roles',
      'Master evaluvator',
      'General Evaluator'
    ];

    orderedClassifications.forEach(classification => {
      if (classificationCounts[classification]) {
        tabs.push({
          value: classification,
          label: normalizeRoleName(classification),
          count: classificationCounts[classification],
          color: '#3b82f6'
        });
      }
    });

    Object.entries(classificationCounts).forEach(([classification, count]) => {
      if (classification === 'Ice Breaker') return;
      if (!orderedClassifications.includes(classification)) {
        tabs.push({
          value: classification,
          label: normalizeRoleName(classification),
          count,
          color: '#3b82f6'
        });
      }
    });

    setClassificationTabs(tabs);
  };

  const getCategoryIcon = (classification: string, isLarge: boolean = false, isSelected: boolean = false) => {
    const iconProps = {
      size: isLarge ? 15 : 7,
      color: isSelected ? '#ffffff' : '#3b82f6',
      strokeWidth: isLarge ? 2 : 1.3,
    };

    switch (classification.toLowerCase()) {
      case 'all':
      case 'all roles':
        return <Layers {...iconProps} />;
      case 'tag roles':
      case 'tag role':
        return <Tag {...iconProps} />;
      case 'educational speaker':
        return <GraduationCap {...iconProps} />;
      case 'speech evaluator':
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
      case 'general evaluator':
        return <Star {...iconProps} />;
      case 'ancillary speaker':
        return <MessageSquare {...iconProps} />;
      case 'club speakers':
        return <Users {...iconProps} />;
      default:
        return <Building2 {...iconProps} />;
    }
  };

  const filterRolesByClassification = () => {
    let roles: MeetingRole[] = [];

    switch (selectedTab) {
      case 'available':
        roles = availableRoles;
        break;
      case 'my_bookings':
        roles = myBookings;
        break;
      case 'booked_by_others':
        roles = bookedByOthers;
        break;
    }

    if (selectedClassification === 'all') {
      setFilteredRoles(roles);
    } else {
      const classificationFiltered = roles.filter(role =>
        role.role_classification === selectedClassification
      );

      setFilteredRoles(classificationFiltered);
    }
  };

  const handleBookRole = async (role: MeetingRole) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: user.id,
          booking_status: 'booked',
          booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', role.id);

      if (error) {
        console.error('Error booking role:', error);
        Alert.alert('Error', 'Failed to book role');
        return;
      }

      if (role.role_classification === 'educational_speaker') {
        const { data: existingRecord } = await supabase
          .from('app_meeting_educational_speaker')
          .select('id')
          .eq('meeting_id', role.meeting_id)
          .eq('speaker_user_id', user.id)
          .maybeSingle();

        if (!existingRecord) {
          const { error: insertError } = await supabase
            .from('app_meeting_educational_speaker')
            .insert({
              meeting_id: role.meeting_id,
              club_id: role.club_id,
              speaker_user_id: user.id,
              booking_status: 'booked',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Error creating educational speaker record:', insertError);
          }
        }
      }

      // Keep speech details when switching Prepared/Ice slot numbers in same meeting.
      await transferSpeechDetailsToNewSpeakerSlot(role.role_name, role.meeting_id, user.id);

      setSelectedTab('my_bookings');
      loadMeetingRoles();

      const bookedToastmaster =
        role.role_name.toLowerCase().includes('toastmaster') &&
        !role.role_name.toLowerCase().includes('table topics master');
      if (bookedToastmaster) {
        router.push(`/toastmaster-corner?meetingId=${role.meeting_id}`);
        return;
      }

      Alert.alert('Success', 'Role booked successfully!');
    } catch (error) {
      console.error('Error booking role:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleWithdrawRole = (role: MeetingRole) => {
    if (!user) return;
    setWithdrawConfirmRole(role);
  };

  const confirmWithdrawRole = async () => {
    const role = withdrawConfirmRole;
    if (!role || !user) return;

    setIsWithdrawing(true);
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: null,
          booking_status: 'available',
          withdrawn_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', role.id);

      if (error) {
        console.error('Error withdrawing role:', error);
        setWithdrawConfirmRole(null);
        Alert.alert('Error', 'Failed to withdraw role');
        return;
      }

      if (role.role_classification === 'educational_speaker') {
        const { error: deleteError } = await supabase
          .from('app_meeting_educational_speaker')
          .delete()
          .eq('meeting_id', role.meeting_id)
          .eq('speaker_user_id', user.id);

        if (deleteError) {
          console.error('Error deleting educational speaker record:', deleteError);
        }
      }

      setWithdrawConfirmRole(null);
      loadMeetingRoles();
    } catch (error) {
      console.error('Error withdrawing role:', error);
      setWithdrawConfirmRole(null);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // const handleEditCollaboration = (role: MeetingRole) => {
  //   const collaboration = existingCollaborations[role.role_name];
  //   if (!collaboration) {
  //     Alert.alert('No Data', 'No existing collaboration data for this role.');
  //     return;
  //   }

  //   // Set the form data based on the collaboration type
  //   switch (collaboration.collaboration_type) {
  //     case 'speech':
  //       setSpeechForm({
  //         speech_title: collaboration.speech_title || '',
  //         pathway: collaboration.pathway || '',
  //         project: collaboration.project || '',
  //         level: collaboration.level || 1,
  //         evaluation_form: collaboration.evaluation_form || '',
  //         speech_objectives: collaboration.speech_objectives || '',
  //       });
  //       setShowSpeechModal(true);
  //       break;
  //     case 'evaluation':
  //       setEvaluationForm({
  //         evaluation_summary: collaboration.evaluation_summary || '',
  //         what_went_well: collaboration.what_went_well || '',
  //         what_needs_improvement: collaboration.what_needs_improvement || '',
  //         personal_notes: collaboration.personal_notes || '',
  //       });
  //       setShowEvaluationModal(true);
  //       break;
  //     case 'theme':
  //       setThemeForm({
  //         theme_of_the_day: collaboration.theme_of_the_day || '',
  //         theme_summary: collaboration.theme_summary || '',
  //       });
  //       setShowThemeModal(true);
  //       break;
  //     case 'word':
  //       setWordForm({
  //         word_of_the_day: collaboration.word_of_the_day || '',
  //         idiom_of_the_day: collaboration.idiom_of_the_day || '',
  //         phrase_of_the_day: collaboration.phrase_of_the_day || '',
  //         quote_of_the_day: collaboration.quote_of_the_day || '',
  //       });
  //       setShowWordModal(true);
  //       break;
  //     default:
  //       Alert.alert('Unknown Collaboration Type', 'Cannot edit this type of collaboration.');
  //   }
  // };

  // Helper functions
  const normalizeRoleName = (roleName: string) => {
    // Convert "Keynote speakers" to "Keynote speaker" for display
    if (roleName.toLowerCase() === 'keynote speakers') {
      return 'Keynote speaker';
    }
    return roleName;
  };

  const isToastmasterRole = (roleName: string) => {
    return roleName.toLowerCase().includes('toastmaster') &&
           !roleName.toLowerCase().includes('table topics master');
  };

  const isPathwayRelatedRole = (roleName: string) => {
    const lowerRoleName = roleName.toLowerCase();
    
    // Prepared Speech roles
    if (lowerRoleName.includes('prepared speaker') || 
        lowerRoleName.includes('prepared speech')) {
      return true;
    }
    
    // Ice Breaker Speech roles
    if (lowerRoleName.includes('ice breaker') || 
        lowerRoleName.includes('icebreaker')) {
      return true;
    }
    
    // Evaluator roles
    if (lowerRoleName.includes('evaluator') && 
        !lowerRoleName.includes('general evaluator')) {
      return true;
    }
    
    // Master Evaluator roles
    if (lowerRoleName.includes('master evaluator')) {
      return true;
    }
    
    // Table Topic Evaluator roles
    if (lowerRoleName.includes('table topic') && 
        lowerRoleName.includes('evaluator')) {
      return true;
    }
    
    return false;
  };

  const parsePreparedOrIceSlot = (roleName: string): { kind: 'prepared' | 'ice'; slot: number } | null => {
    const value = (roleName || '').trim().toLowerCase();
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

  const transferSpeechDetailsToNewSpeakerSlot = async (
    newRoleName: string,
    meetingId: string,
    userId: string
  ) => {
    const targetSlot = parsePreparedOrIceSlot(newRoleName);
    if (!targetSlot) return;

    try {
      // If the new slot already has pathway data, keep it untouched.
      const { data: existingTarget, error: targetErr } = await supabase
        .from('app_evaluation_pathway')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .eq('role_name', newRoleName)
        .maybeSingle();

      if (targetErr) {
        console.error('Error checking target pathway row:', targetErr);
        return;
      }
      if (existingTarget?.id) return;

      const { data: candidates, error: candidateErr } = await supabase
        .from('app_evaluation_pathway')
        .select(`
          id,
          role_name,
          speech_title,
          pathway_name,
          project_name,
          level,
          evaluation_form,
          comments_for_evaluator,
          updated_at,
          created_at
        `)
        .eq('meeting_id', meetingId)
        .eq('user_id', userId)
        .or('role_name.ilike.%prepared%speaker%,role_name.ilike.%prepared%speech%,role_name.ilike.%ice%breaker%')
        .neq('role_name', newRoleName)
        .order('updated_at', { ascending: false });

      if (candidateErr) {
        console.error('Error loading pathway transfer candidates:', candidateErr);
        return;
      }
      if (!candidates?.length) return;

      const hasDetails = (row: any) =>
        !!(
          (row.speech_title || '').trim() ||
          (row.pathway_name || '').trim() ||
          (row.project_name || '').trim() ||
          row.level != null ||
          (row.evaluation_form || '').trim() ||
          (row.comments_for_evaluator || '').trim()
        );

      const scopedCandidates = candidates.filter((item: any) => !!parsePreparedOrIceSlot(item.role_name));
      if (!scopedCandidates.length) return;

      const source = scopedCandidates.find(hasDetails) || scopedCandidates[0];
      if (!source?.id) return;

      const { error: moveErr } = await supabase
        .from('app_evaluation_pathway')
        .update({
          role_name: newRoleName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', source.id);

      if (moveErr) {
        console.error('Error transferring speech details to new slot:', moveErr);
      }
    } catch (error) {
      console.error('Error in speech detail transfer flow:', error);
    }
  };

  // Removed isPreparedSpeakerRole, isEvaluatorRole, isGrammarianRole helper functions

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

  const hasExistingCollaboration = (roleName: string) => {
    return existingCollaborations[roleName] !== undefined;
  };

  // Removed handleEditCollaboration function

  const getMeetingInfoData = () => {
    return [];
  };

  // // Removed isPreparedSpeakerRole, isEvaluatorRole, isGrammarianRole helper functions

  // const getMeetingInfoData = () => {
  //   const infoItems = [];
    
  //   // 1. Theme of the day
  //   const themeRoles = myBookings.filter(role => isToastmasterRole(role.role_name));
  //   themeRoles.forEach(role => {
  //     const themeData = existingCollaborations[role.role_name];
  //     if (themeData && themeData.theme_of_the_day) {
  //       infoItems.push({
  //         type: 'Theme of the Day',
  //         content: themeData.theme_of_the_day,
  //         icon: '🎯'
  //       });
  //     }
  //   });
    
  //   // 2. Word of the day, Idiom, Phrase, Quote
  //   // Removed logic for grammarian roles
    
  //   // 3. Prepared Speaker - speech title and pathway
  //   // Removed logic for prepared speaker roles
    
  //   // 4. Evaluator - title and pathway
  //   // Removed logic for evaluator roles
    
  //   // 5. Master Evaluator - evaluation title and pathway
  //   // Removed logic for master evaluator roles
    
  //   // 6. Table Topic Evaluator - pathway
  //   // Removed logic for TT evaluator roles
    
  //   return infoItems;
  // };

  const currentClub = user?.clubs?.find(c => c.id === user.currentClubId) || user?.clubs?.[0];
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';

  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  if (!user || !user.clubs || user.clubs.length === 0) {
    return null;
  }

  const RoleCard = ({ role, showBookButton = false, showWithdrawButton = false }: {
    role: MeetingRole;
    showBookButton?: boolean;
    showWithdrawButton?: boolean;
  }) => {
    const assignedMember = role.app_user_profiles;
    const isToastmaster = isToastmasterRole(role.role_name);
    const isGrammarian = role.role_name.toLowerCase().includes('grammarian');
    const isSpeechEvaluatorRole = /^evaluator [1-5]$/i.test(role.role_name.trim());
    // Animate all icons in Mine section to grab attention
    const shouldAnimate = showWithdrawButton;

    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (!shouldAnimate) {
        pulseAnim.setValue(1);
        return;
      }

      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );

      animation.start();

      return () => {
        animation.stop();
        pulseAnim.setValue(1);
      };
    }, [shouldAnimate, pulseAnim]);

    return (
      <View style={[styles.roleCard, {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border
      }]}>
        <View style={styles.roleInfo}>
          <Text style={[styles.roleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {normalizeRoleName(role.role_name)}
          </Text>

          {assignedMember && (
            <View style={styles.assignedInfo}>
              <Text style={[styles.assignedText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Assigned to: {assignedMember.full_name}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.roleActions}>
          {showBookButton && (
            <TouchableOpacity
              style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleBookRole(role)}
            >
              <Text style={styles.bookButtonText} maxFontSizeMultiplier={1.3}>Book</Text>
            </TouchableOpacity>
          )}
          
          {showWithdrawButton && (
            <View style={styles.myBookingActions}>
              {/* Speech Evaluator (Evaluator 1-5) */}
              {isSpeechEvaluatorRole && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/evaluation-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Prepared Speaker and other pathway roles */}
              {isPathwayRelatedRole(role.role_name) && !isSpeechEvaluatorRole && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/evaluation-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              {/* Toastmaster Corner */}
              {isToastmaster && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() =>
                      router.push(`/toastmaster-corner?meetingId=${selectedMeeting?.id}`)
                    }
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Grammarian — same action tile as Timer / Educational Speaker */}
              {isGrammarian && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/grammarian?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}
              
              {/* Timer */}
              {role.role_name.toLowerCase().includes('timer') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/timer-report-details?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Ah Counter */}
              {role.role_name.toLowerCase().includes('ah counter') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/ah-counter-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* General Evaluator */}
              {role.role_name.toLowerCase().includes('general evaluator') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/general-evaluator-report?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Table Topics Master */}
              {role.role_name.toLowerCase().includes('table topics master') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/table-topic-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Educational Speaker */}
              {role.role_name.toLowerCase().includes('educational speaker') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/educational-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              {/* Keynote Speaker */}
              {role.role_name.toLowerCase().includes('keynote speaker') && (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={[styles.educationCornerButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => router.push(`/keynote-speaker-corner?meetingId=${selectedMeeting?.id}`)}
                  >
                    <MousePointerClick size={14} color="#ffffff" />
                  </TouchableOpacity>
                </Animated.View>
              )}

              <TouchableOpacity
                style={[styles.withdrawButton, { backgroundColor: '#fef2f2' }]}
                onPress={() => handleWithdrawRole(role)}
              >
                <Text style={styles.withdrawButtonText} maxFontSizeMultiplier={1.3}>Withdraw</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meetings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Calendar size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Access Required</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to book roles.
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (meetings.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book a Role</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <View style={styles.noMeetingsContainer}>
          <Calendar size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.noMeetingsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>No Open Meetings</Text>
          <Text style={[styles.noMeetingsMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            There are currently no open meetings available for role booking.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.bookRoleMain}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Book a Role</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.bookRoleScroll}
        contentContainerStyle={styles.scrollContentContainer}
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

          {currentClub && selectedMeeting ? (
            <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />
          ) : null}

          {selectedMeeting && (
            <View style={styles.notionMeetingBlock}>
              <View style={styles.meetingCardContent}>
                <View style={[styles.dateBox, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={[styles.dateDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {new Date(selectedMeeting.meeting_date).getDate()}
                  </Text>
                  <Text style={[styles.dateMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.meetingDetails}>
                  <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {selectedMeeting.meeting_title}
                  </Text>
                  <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Day: {new Date(selectedMeeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
                  </Text>
                  {selectedMeeting.meeting_start_time && (
                    <Text style={[styles.meetingCardDateTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Time: {selectedMeeting.meeting_start_time}
                      {selectedMeeting.meeting_end_time && ` - ${selectedMeeting.meeting_end_time}`}
                    </Text>
                  )}
                  <Text style={[styles.meetingCardMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Mode:{' '}
                    {selectedMeeting.meeting_mode === 'in_person'
                      ? 'In Person'
                      : selectedMeeting.meeting_mode === 'online'
                        ? 'Online'
                        : 'Hybrid'}
                  </Text>
                </View>
              </View>
            </View>
          )}

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
                Open
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
                  {availableRoles.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: selectedTab === 'my_bookings' ? theme.colors.primary : 'transparent',
                  borderColor: selectedTab === 'my_bookings' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setSelectedTab('my_bookings')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: selectedTab === 'my_bookings' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Mine
              </Text>
              <View
                style={[
                  styles.notionTabCount,
                  {
                    backgroundColor:
                      selectedTab === 'my_bookings' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.notionTabCountText,
                    { color: selectedTab === 'my_bookings' ? '#ffffff' : theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {myBookings.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: selectedTab === 'booked_by_others' ? theme.colors.primary : 'transparent',
                  borderColor: selectedTab === 'booked_by_others' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setSelectedTab('booked_by_others')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: selectedTab === 'booked_by_others' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.3}
              >
                Taken
              </Text>
              <View
                style={[
                  styles.notionTabCount,
                  {
                    backgroundColor:
                      selectedTab === 'booked_by_others' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.notionTabCountText,
                    { color: selectedTab === 'booked_by_others' ? '#ffffff' : theme.colors.primary },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {bookedByOthers.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {selectedTab === 'available' && classificationTabs.length > 1 ? (
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
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.25}
                >
                  {selectedClassification === 'all'
                    ? `Showing all ${classificationTabs.find((t) => t.value === 'all')?.count ?? availableRoles.length} open roles`
                    : (() => {
                        const t = classificationTabs.find((x) => x.value === selectedClassification);
                        return t
                          ? `Showing ${t.label} (${t.count})`
                          : 'Showing filtered roles';
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
                    ? 'Open Roles'
                    : classificationTabs.find((t) => t.value === selectedClassification)?.label || 'Roles'
                  : selectedTab === 'my_bookings'
                    ? 'My Roles'
                    : 'Taken Roles'}
              </Text>
              <View style={[styles.rolesCountBadge, { backgroundColor: theme.colors.primary + '16' }]}>
                <Text style={[styles.rolesCountText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                  {filteredRoles.length}
                </Text>
              </View>
            </View>

            {filteredRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                showBookButton={selectedTab === 'available'}
                showWithdrawButton={selectedTab === 'my_bookings'}
              />
            ))}

            {filteredRoles.length === 0 && (
              <View style={styles.emptyState}>
                <Users size={40} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available'
                    ? 'No open roles'
                    : selectedTab === 'my_bookings'
                      ? 'No booked roles'
                      : 'No taken roles to show'}
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'available'
                    ? 'All roles have been booked'
                    : selectedTab === 'my_bookings'
                      ? 'Open roles will appear here after you book'
                      : 'Roles taken by others will appear here'}
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
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
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
        </View>
      </View>

      </View>

      {/* Removed Speech Form Modal */}
      {/* Removed Evaluation Form Modal */}
      {/* Removed Word Modal for Grammarian */}
      {/* Removed Theme Form Modal */}
      
      {/* Removed Meeting Information Modal */}

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
                Open roles by category
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

      {/* Withdraw confirmation modal - works on web (Alert.alert does not) */}
      <Modal
        visible={!!withdrawConfirmRole}
        transparent
        animationType="fade"
        onRequestClose={() => !isWithdrawing && setWithdrawConfirmRole(null)}
      >
        <TouchableOpacity
          style={styles.withdrawModalOverlay}
          activeOpacity={1}
          onPress={() => !isWithdrawing && setWithdrawConfirmRole(null)}
        >
          <TouchableOpacity
            style={[styles.withdrawModalContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.withdrawModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Withdraw Role
            </Text>
            <Text style={[styles.withdrawModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to withdraw from {withdrawConfirmRole?.role_name}?
            </Text>
            <View style={styles.withdrawModalButtons}>
              <TouchableOpacity
                style={[styles.withdrawModalCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => !isWithdrawing && setWithdrawConfirmRole(null)}
                disabled={isWithdrawing}
              >
                <Text style={[styles.withdrawModalCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.withdrawModalConfirmBtn, { backgroundColor: '#dc2626', marginLeft: 12 }]}
                onPress={confirmWithdrawRole}
                disabled={isWithdrawing}
              >
                <Text style={styles.withdrawModalConfirmText} maxFontSizeMultiplier={1.3}>
                  {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  signInButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  noMeetingsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noMeetingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noMeetingsMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
  bookRoleMain: {
    flex: 1,
    minHeight: 0,
  },
  bookRoleScroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
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
  /** Single Notion-style surface for club, meeting, filters, and roles — square corners */
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
  /** Notion-style single filter bar → opens category picker */
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
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 0,
    padding: 16,
    minHeight: 96,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
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
  meetingCardDecoration: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 24,
    flex: 1,
  },
  filterSidebar: {
    width: '20.7%',
    minWidth: 69,
    maxWidth: 121,
  },
  categoryTile: {
    aspectRatio: 1,
    borderRadius: 7,
    marginBottom: 4,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryIconContainer: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  categoryLabel: {
    fontSize: 8.4,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 0,
    lineHeight: 9.6,
  },
  categoryCount: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  categoryBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#ffffff',
  },
  rolesColumn: {
    flex: 1,
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  rolesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  rolesHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  rolesCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
  },
  rolesCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 0,
    padding: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  roleInfo: {
    flex: 1,
    marginRight: 12,
  },
  roleName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignedInfo: {
    marginTop: 4,
  },
  assignedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  roleActions: {
    alignItems: 'flex-end',
  },
  bookButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  myBookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  educationCornerButton: {
    width: 28,
    height: 28,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  addButtonText: {
    fontSize: 0,
    color: 'transparent',
  },
  withdrawButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
  },
  withdrawButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  withdrawModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  withdrawModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 0,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  withdrawModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  withdrawModalMessage: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  withdrawModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  withdrawModalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
    borderWidth: 1,
  },
  withdrawModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  withdrawModalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
  },
  withdrawModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
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
  speechModal: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    minHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  evaluationModal: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    minHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  themeModal: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '70%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  modalContainer: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  infoModal: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    padding: 4,
  },
  roleInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  roleInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  roleInfoSubtitle: {
    fontSize: 13,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldHelper: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  multilineInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  meetingInfoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  meetingInfoDate: {
    fontSize: 14,
  },
  infoItemsList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoItemIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  infoItemContent: {
    flex: 1,
  },
  infoItemType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  infoItemText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noInfoState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  noInfoText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noInfoSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
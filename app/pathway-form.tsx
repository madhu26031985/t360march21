import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Building2, User, BookOpen, GraduationCap, Target, MessageSquare, Save, Star, ChevronDown, X, Link as LinkIcon, Upload, FileText, Search } from 'lucide-react-native';
import { Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

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

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
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
  project_number: string | null;
  evaluation_form: string | null;
  comments_for_evaluator: string | null;
  evaluation_title: string | null;
  table_topics_title: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string;
  assigned_evaluator_id: string | null;
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

export default function PathwayForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const roleId = typeof params.roleId === 'string' ? params.roleId : params.roleId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [roleBooking, setRoleBooking] = useState<RoleBooking | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEvaluatorModal, setShowEvaluatorModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('speeches_delivered');
  const [evaluationFormType, setEvaluationFormType] = useState<'link' | 'pdf'>('link');
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [evaluatorSearchQuery, setEvaluatorSearchQuery] = useState('');
  const [vpeApprovalRequested, setVpeApprovalRequested] = useState(false);

  const [editForm, setEditForm] = useState({
    speech_title: '',
    pathway_name: '',
    level: '',
    project_name: '',
    project_number: '',
    evaluation_title: '',
    table_topics_title: '',
    evaluation_form: '',
    comments_for_evaluator: '',
    assigned_evaluator: ''
  });

  const tabs = [
    {
      key: 'speeches_delivered',
      title: 'Prepared Speakers',
      metric: 'speeches_delivered',
    }
  ];

  useEffect(() => {
    if (meetingId && roleId) {
      loadData();
    }
  }, [meetingId, roleId]);

  useEffect(() => {
    if (roleBooking) {
      loadExistingPathway();
    }
  }, [roleBooking]);

  const loadData = async () => {
    if (!meetingId || !roleId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      // Load meeting and role booking first
      await Promise.all([
        loadMeeting(),
        loadRoleBooking()
      ]);

      // Then load speech evaluators (depends on meetingId)
      await loadClubMembers();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load pathway data');
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

  const loadRoleBooking = async () => {
    if (!roleId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          assigned_user_id,
          role_name,
          role_metric,
          booking_status,
          role_classification,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('id', roleId)
        .single();

      if (error) {
        console.error('Error loading role booking:', error);
        return;
      }

      const booking = {
        id: data.id,
        user_id: data.assigned_user_id!,
        role_name: data.role_name,
        role_metric: data.role_metric,
        booking_status: data.booking_status,
        role_classification: data.role_classification,
        app_user_profiles: (data as any).app_user_profiles
      };

      setRoleBooking(booking);
      
      // Determine the tab based on role metric
      setSelectedTab(booking.role_metric);
      
      console.log('Role booking loaded, will trigger pathway loading');
    } catch (error) {
      console.error('Error loading role booking:', error);
    }
  };

  const loadClubMembers = async () => {
    if (!user?.currentClubId || !meetingId) return;

    try {
      // Load only users who have booked the "Speech Evaluvator" role (Evaluator 1-5) for this meeting
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          assigned_user_id,
          role_name,
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_classification', 'Speech evaluvator')
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null);

      if (error) {
        console.error('Error loading speech evaluators:', error);
        return;
      }

      console.log('📋 Loaded evaluators:', data?.length || 0);

      const members = (data || [])
        .filter(item => item.app_user_profiles)
        .map(item => ({
          id: (item as any).app_user_profiles.id,
          full_name: (item as any).app_user_profiles.full_name,
          email: (item as any).app_user_profiles.email,
          avatar_url: (item as any).app_user_profiles.avatar_url,
        }));

      setClubMembers(members);
      console.log('✅ Speech evaluators loaded:', members.length);
    } catch (error) {
      console.error('Error loading speech evaluators:', error);
    }
  };

  const loadExistingPathway = async () => {
    if (!meetingId || !roleBooking?.user_id || !roleBooking?.role_name) {
      console.log('Missing data for loading pathway:', { meetingId, userId: roleBooking?.user_id, roleName: roleBooking?.role_name });
      return;
    }

    try {
      console.log('Loading existing pathway for:', {
        meetingId,
        userId: roleBooking.user_id,
        roleName: roleBooking.role_name
      });
      
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
          project_number,
          evaluation_form,
          comments_for_evaluator,
          evaluation_title,
          table_topics_title,
          assigned_evaluator_id,
          created_at,
          updated_at,
          updated_by,
          vpe_approval_requested,
          vpe_approval_requested_at
        `)
        .eq('meeting_id', meetingId)
        .eq('user_id', roleBooking.user_id)
        .eq('role_name', roleBooking.role_name)
        .maybeSingle();

      console.log('Pathway query result:', { data, error });

      if (error) {
        console.error('Error loading existing pathway:', error);
        return;
      }

      if (data) {
        setVpeApprovalRequested(data.vpe_approval_requested || false);
        console.log('Found existing pathway data:', {
          id: data.id,
          speech_title: data.speech_title,
          pathway_name: data.pathway_name,
          level: data.level,
          project_name: data.project_name,
          project_number: data.project_number,
          evaluation_form: data.evaluation_form,
          comments_for_evaluator: data.comments_for_evaluator,
          assigned_evaluator_id: data.assigned_evaluator_id
        });

        const pathway = data as ExistingEvaluationPathway;
        setEditForm({
          speech_title: pathway.speech_title || '',
          pathway_name: pathway.pathway_name || '',
          level: pathway.level?.toString() || '',
          project_name: pathway.project_name || '',
          project_number: pathway.project_number?.toString() || '',
          evaluation_title: pathway.evaluation_title || '',
          table_topics_title: pathway.table_topics_title || '',
          evaluation_form: pathway.evaluation_form || '',
          comments_for_evaluator: pathway.comments_for_evaluator || '',
          assigned_evaluator: pathway.assigned_evaluator_id || ''
        });

        // Detect if existing form is a PDF or link
        if (pathway.evaluation_form) {
          if (pathway.evaluation_form.includes('/storage/v1/object/public/evaluation-forms/')) {
            setEvaluationFormType('pdf');
            const fileName = pathway.evaluation_form.split('/').pop();
            setUploadedFileName(fileName || null);
          } else {
            setEvaluationFormType('link');
          }
        }

        console.log('✅ Form populated with existing data:', {
          assigned_evaluator: pathway.assigned_evaluator_id || 'empty'
        });
      } else {
        console.log('No existing pathway found, using empty form');
      }
    } catch (error) {
      console.error('Error loading existing pathway:', error);
    }
  };

  const handleSavePathway = async () => {
    if (!roleBooking || !meetingId || !user?.currentClubId) return;

    // Check if record is locked
    const { data: checkData, error: checkError } = await supabase
      .from('app_evaluation_pathway')
      .select('is_locked, vpe_approved')
      .eq('meeting_id', meetingId)
      .eq('user_id', roleBooking.user_id)
      .eq('role_name', roleBooking.role_name)
      .maybeSingle();

    if (checkData?.is_locked) {
      const approvalStatus = checkData.vpe_approved === true ? 'approved' : 'denied';
      Alert.alert(
        'Record Locked',
        `This speech has been ${approvalStatus} by VPE and is now locked. No changes can be made.`
      );
      return;
    }

    // Check if VPE approval has been requested
    if (vpeApprovalRequested) {
      Alert.alert(
        'Cannot Edit',
        'Speech details cannot be edited after requesting VPE approval.'
      );
      return;
    }

    console.log('🚀 Starting save process with ALL form data:', editForm);

    // Validate mandatory evaluation form field
    if (!editForm.evaluation_form.trim()) {
      Alert.alert('Error', 'Evaluation form link is required');
      return;
    }

    // Validate evaluation form URL if it's a link (not a PDF upload)
    if (evaluationFormType === 'link') {
      let testUrl = editForm.evaluation_form.trim();

      // Add protocol if missing
      if (!testUrl.match(/^https?:\/\//i)) {
        testUrl = 'https://' + testUrl;
      }

      // Validate it's a valid URL
      try {
        new URL(testUrl);
        // Update the form with the properly formatted URL
        editForm.evaluation_form = testUrl;
      } catch (e) {
        Alert.alert('Invalid URL', 'Please enter a valid evaluation form URL (e.g., https://example.com/form)');
        return;
      }
    }

    // Validate project number if provided
    if (editForm.project_number.trim()) {
      const projectNumStr = editForm.project_number.trim();
      const projectNum = parseInt(projectNumStr);

      if (!/^[1-9][0-9]?$/.test(projectNumStr) || isNaN(projectNum) || projectNum < 1 || projectNum > 20) {
        Alert.alert('Invalid Project Number', 'Project number must be between 1 and 20 (no leading zeros or special characters)');
        return;
      }
    }

    setIsSaving(true);

    try {
      const currentTab = tabs.find(t => t.key === selectedTab);
      if (!currentTab) return;

      let saveData: any = {
        meeting_id: meetingId,
        club_id: user.currentClubId,
        user_id: roleBooking.user_id,
        role_name: roleBooking.role_name,
        pathway_name: editForm.pathway_name.trim() || null,
        level: editForm.level ? parseInt(editForm.level) : null,
        project_name: editForm.project_name.trim() || null,
        project_number: editForm.project_number.trim() || null,
        evaluation_form: editForm.evaluation_form.trim() || null,
        comments_for_evaluator: editForm.comments_for_evaluator.trim() || null,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      };

      // Add the new fields with proper null handling
      saveData.assigned_evaluator_id = editForm.assigned_evaluator.trim() || null;

      console.log('🔄 Final save data being sent to database:', saveData);

      // Add speech title
      saveData.speech_title = editForm.speech_title.trim() || null;

      // Check if pathway already exists
      const { data: existingData, error: checkError } = await supabase
        .from('app_evaluation_pathway')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('user_id', roleBooking.user_id)
        .eq('role_name', roleBooking.role_name)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing pathway:', checkError);
        Alert.alert('Error', 'Failed to check existing pathway');
        return;
      }

      if (existingData) {
        // Update existing pathway
        console.log('📝 Updating existing pathway with ID:', existingData.id);
        const { data: updateResult, error } = await supabase
          .from('app_evaluation_pathway')
          .update(saveData)
          .eq('id', existingData.id)
          .select();

        console.log('📝 Update result:', { updateResult, error });

        if (error) {
          console.error('Error updating evaluation pathway:', error);

          if (error.message && error.message.includes('chk_app_evaluation_pathway_project_number_valid')) {
            Alert.alert('Invalid Project Number', 'Project number must be between 1 and 20');
          } else {
            Alert.alert('Error', `Failed to update pathway information: ${error.message}`);
          }
          return;
        }
        
        console.log('✅ Successfully updated pathway');
      } else {
        // Create new pathway
        console.log('🆕 Creating new pathway');
        const { data: insertResult, error } = await supabase
          .from('app_evaluation_pathway')
          .insert({
            ...saveData,
            created_at: new Date().toISOString()
          })
          .select();

        console.log('🆕 Insert result:', { insertResult, error });

        if (error) {
          console.error('Error creating evaluation pathway:', error);

          if (error.message && error.message.includes('chk_app_evaluation_pathway_project_number_valid')) {
            Alert.alert('Invalid Project Number', 'Project number must be between 1 and 20');
          } else {
            Alert.alert('Error', `Failed to save pathway information: ${error.message}`);
          }
          return;
        }
        
        console.log('✅ Successfully created new pathway');
      }

      Alert.alert('Success', 'Pathway information saved successfully', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving pathway:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getSelectedEvaluatorName = () => {
    if (!editForm.assigned_evaluator) return 'Select evaluator';
    const evaluator = clubMembers.find(m => m.id === editForm.assigned_evaluator);
    return evaluator?.full_name || 'Unknown evaluator';
  };

  const getFilteredEvaluators = () => {
    if (!evaluatorSearchQuery.trim()) return clubMembers;

    const query = evaluatorSearchQuery.toLowerCase();
    return clubMembers.filter(member =>
      member.full_name.toLowerCase().includes(query)
    );
  };

  const handlePickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      if (!file.uri) {
        Alert.alert('Error', 'Could not read file');
        return;
      }

      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('Error', 'File size must be less than 10MB');
        return;
      }

      setIsUploadingPDF(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.currentClubId}/${Date.now()}.${fileExt}`;

      let fileBlob: Blob | Uint8Array;

      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        fileBlob = await response.blob();
      } else {
        const fileInfo = await FileSystem.getInfoAsync(file.uri);
        if (!fileInfo.exists) {
          Alert.alert('Error', 'File does not exist');
          setIsUploadingPDF(false);
          return;
        }

        const fileData = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        fileBlob = decode(fileData);
      }

      const { data, error } = await supabase.storage
        .from('evaluation-forms')
        .upload(fileName, fileBlob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        Alert.alert('Error', 'Failed to upload PDF');
        setIsUploadingPDF(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('evaluation-forms')
        .getPublicUrl(fileName);

      setEditForm(prev => ({ ...prev, evaluation_form: publicUrlData.publicUrl }));
      setUploadedFileName(file.name);
      Alert.alert('Success', 'PDF uploaded successfully');
    } catch (error) {
      console.error('Error picking PDF:', error);
      Alert.alert('Error', 'Failed to pick PDF file');
    } finally {
      setIsUploadingPDF(false);
    }
  };

  const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const handleRemovePDF = () => {
    setEditForm(prev => ({ ...prev, evaluation_form: '' }));
    setUploadedFileName(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading pathway form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting || !roleBooking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Data not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          Edit {currentTab?.title}
        </Text>
        <TouchableOpacity 
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSavePathway}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* VPE Approval Warning Banner */}
        {vpeApprovalRequested && (
          <View style={[styles.warningBanner, {
            backgroundColor: '#f59e0b30',
            borderColor: '#f59e0b',
          }]}>
            <Text style={[styles.warningBannerText, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
              This speech has been submitted for VPE approval and cannot be edited.
            </Text>
          </View>
        )}

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

        {/* Participant Info Card */}
        <View style={[styles.participantCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.participantHeader}>
            <View style={styles.participantInfo}>
              <View style={[styles.participantAvatar, { backgroundColor: theme.colors.border }]}>
                {roleBooking.app_user_profiles.avatar_url ? (
                  <Image 
                    source={{ uri: roleBooking.app_user_profiles.avatar_url }} 
                    style={styles.participantAvatarImage} 
                  />
                ) : (
                  <User size={20} color={theme.colors.textSecondary} />
                )}
              </View>
              <View style={styles.participantDetails}>
                <Text style={[styles.participantName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {roleBooking.app_user_profiles.full_name}
                </Text>
                <View style={[styles.roleTag, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.roleTagText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {roleBooking.role_name}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Form Section */}
        <View style={[styles.formSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Pathway Information
          </Text>

          {/* Title Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Speech Title *
            </Text>
            <TextInput
              style={[styles.textInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Enter speech title"
              placeholderTextColor="#BEBEBE"
              value={editForm.speech_title}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, speech_title: text }))}
            />
          </View>

          {/* Pathway Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Pathway Name *</Text>
            <TextInput
              style={[styles.textInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Enter pathway name"
              placeholderTextColor="#BEBEBE"
              value={editForm.pathway_name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, pathway_name: text }))}
            />
          </View>

          {/* Level and Project Number Row */}
          <View style={styles.formRow}>
            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Level Number *</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="1-5"
                placeholderTextColor="#BEBEBE"
                value={editForm.level}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, level: text }))}
                keyboardType="numeric"
                maxLength={1}
              />
            </View>

            <View style={[styles.formField, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Project Number *</Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="1-20"
                placeholderTextColor="#BEBEBE"
                value={editForm.project_number}
                onChangeText={(text) => {
                  const numericOnly = text.replace(/[^0-9]/g, '');
                  setEditForm(prev => ({ ...prev, project_number: numericOnly }));
                }}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>

          {/* Project Name Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Project Name *</Text>
            <TextInput
              style={[styles.textInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Enter project name"
              placeholderTextColor="#BEBEBE"
              value={editForm.project_name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, project_name: text }))}
            />
          </View>

          {/* Evaluation Form Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Evaluation Form *
            </Text>

            {/* Type Selector */}
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeSelectorButton,
                  evaluationFormType === 'link' && { backgroundColor: theme.colors.primary },
                  { borderColor: theme.colors.border }
                ]}
                onPress={() => {
                  setEvaluationFormType('link');
                  setEditForm(prev => ({ ...prev, evaluation_form: '' }));
                  setUploadedFileName(null);
                }}
              >
                <LinkIcon size={16} color={evaluationFormType === 'link' ? '#ffffff' : theme.colors.text} />
                <Text style={[
                  styles.typeSelectorText,
                  { color: evaluationFormType === 'link' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  Link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeSelectorButton,
                  evaluationFormType === 'pdf' && { backgroundColor: theme.colors.primary },
                  { borderColor: theme.colors.border }
                ]}
                onPress={() => {
                  setEvaluationFormType('pdf');
                  setEditForm(prev => ({ ...prev, evaluation_form: '' }));
                  setUploadedFileName(null);
                }}
              >
                <FileText size={16} color={evaluationFormType === 'pdf' ? '#ffffff' : theme.colors.text} />
                <Text style={[
                  styles.typeSelectorText,
                  { color: evaluationFormType === 'pdf' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  PDF
                </Text>
              </TouchableOpacity>
            </View>

            {/* Link Input */}
            {evaluationFormType === 'link' && (
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }]}
                placeholder="Enter evaluation form link"
                placeholderTextColor="#BEBEBE"
                value={editForm.evaluation_form}
                onChangeText={(text) => setEditForm(prev => ({ ...prev, evaluation_form: text }))}
                keyboardType="url"
                autoCapitalize="none"
              />
            )}

            {/* PDF Upload */}
            {evaluationFormType === 'pdf' && (
              <View>
                {!editForm.evaluation_form ? (
                  <TouchableOpacity
                    style={[styles.uploadButton, {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border
                    }]}
                    onPress={handlePickPDF}
                    disabled={isUploadingPDF}
                  >
                    {isUploadingPDF ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <>
                        <Upload size={20} color={theme.colors.primary} />
                        <Text style={[styles.uploadButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                          Upload PDF
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.uploadedFileContainer, {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }]}>
                    <FileText size={20} color={theme.colors.primary} />
                    <Text style={[styles.uploadedFileName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                      {uploadedFileName || 'Uploaded PDF'}
                    </Text>
                    <TouchableOpacity onPress={handleRemovePDF}>
                      <X size={20} color={theme.colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Comments for Evaluator Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              💬 Comments for Speech Evaluator
            </Text>
            <TextInput
              style={[styles.textAreaInput, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }]}
              placeholder="Enter comments for speech evaluator..."
              placeholderTextColor="#BEBEBE"
              value={editForm.comments_for_evaluator}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, comments_for_evaluator: text }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {editForm.comments_for_evaluator.length}/500 characters
            </Text>
          </View>

          {/* Assigned Evaluator Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              👤 Assigned Evaluator
            </Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => setShowEvaluatorModal(true)}
            >
              <Text style={[styles.dropdownText, { color: editForm.assigned_evaluator ? theme.colors.text : '#BEBEBE' }]} maxFontSizeMultiplier={1.3}>
                {getSelectedEvaluatorName()}
              </Text>
              <ChevronDown size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveFormButton, {
              backgroundColor: theme.colors.primary,
            }]}
            onPress={handleSavePathway}
            disabled={isSaving}
          >
            <Save size={16} color="#ffffff" />
            <Text style={styles.saveFormButtonText} maxFontSizeMultiplier={1.3}>
              {isSaving ? 'Saving...' : 'Save Information'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Evaluator Selection Modal */}
      <Modal
        visible={showEvaluatorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowEvaluatorModal(false);
          setEvaluatorSearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => {
            setShowEvaluatorModal(false);
            setEvaluatorSearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.evaluatorModal, { backgroundColor: theme.colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Evaluator</Text>

            {/* Search Box */}
            <View style={[styles.searchContainer, {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border
            }]}>
              <Search size={20} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search by name"
                placeholderTextColor={theme.colors.textSecondary}
                value={evaluatorSearchQuery}
                onChangeText={setEvaluatorSearchQuery}
              />
              {evaluatorSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setEvaluatorSearchQuery('')}>
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.evaluatorsList} showsVerticalScrollIndicator={false}>
              {/* None Option */}
              <TouchableOpacity
                style={[styles.evaluatorOption, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  setEditForm(prev => ({ ...prev, assigned_evaluator: '' }));
                  setShowEvaluatorModal(false);
                  setEvaluatorSearchQuery('');
                }}
              >
                <View style={[styles.evaluatorAvatar, { backgroundColor: theme.colors.textSecondary }]}>
                  <User size={20} color="#ffffff" />
                </View>
                <Text style={[styles.evaluatorName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No evaluator assigned
                </Text>
              </TouchableOpacity>

              {getFilteredEvaluators().map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[
                    styles.evaluatorOption,
                    {
                      backgroundColor: editForm.assigned_evaluator === member.id ? theme.colors.primary + '20' : theme.colors.background
                    }
                  ]}
                  onPress={() => {
                    setEditForm(prev => ({ ...prev, assigned_evaluator: member.id }));
                    setShowEvaluatorModal(false);
                    setEvaluatorSearchQuery('');
                  }}
                >
                  <View style={styles.evaluatorAvatar}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.evaluatorAvatarImage} />
                    ) : (
                      <User size={20} color="#ffffff" />
                    )}
                  </View>
                  <Text style={[
                    styles.evaluatorName,
                    { color: editForm.assigned_evaluator === member.id ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {member.full_name}
                  </Text>
                </TouchableOpacity>
              ))}

              {getFilteredEvaluators().length === 0 && (
                <View style={styles.noResultsContainer}>
                  <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    No evaluators found
                  </Text>
                </View>
              )}
            </ScrollView>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  warningBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningBannerText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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
  participantCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  participantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  participantAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  roleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleTagText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  formSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  formField: {
    marginBottom: 24,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  formRowThree: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  textInput: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  textAreaInput: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '500',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
    fontWeight: '500',
  },
  saveFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    marginTop: 8,
  },
  saveFormButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  evaluatorModal: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '70%',
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  evaluatorsList: {
    maxHeight: 400,
  },
  noResultsContainer: {
    padding: 24,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  evaluatorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  evaluatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  evaluatorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  evaluatorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  typeSelectorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  typeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
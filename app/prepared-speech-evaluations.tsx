import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ChevronLeft,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  Clock,
  Bell,
  Users,
  Calendar,
  BookOpen,
  Star,
  Mic,
  CheckSquare,
  FileBarChart,
  MessageSquare,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { bookMeetingRoleForCurrentUser } from '@/lib/bookMeetingRoleInline';
import { Image } from 'react-native';

interface PreparedSpeechEvaluation {
  id: string;
  evaluation_pathway_id: string;
  meeting_id: string;
  speaker_id: string;
  speaker_name: string;
  speaker_avatar: string | null;
  evaluator_id: string;
  evaluator_name: string;
  evaluator_avatar: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  project_name: string | null;
  project_number: string | null;
  level: number | null;
  evaluation_pdf_url: string | null;
  evaluation_status: 'pending' | 'uploaded' | 'completed';
  uploaded_at: string | null;
  evaluator_comments: string | null;
  meeting_date: string;
  meeting_title: string;
  created_at: string;
  speech_category: 'Prepared Speech' | 'Ice Breaker';
  speaker_role_name: string | null;
}

interface OpenEvaluatorRole {
  id: string;
  role_name: string;
  role_classification: string;
}

interface OpenSpeakerRole {
  id: string;
  role_name: string;
  role_classification: string | null;
}

interface BookedEvaluatorRole {
  id: string;
  role_name: string;
  role_classification: string;
  assigned_user_id: string;
  assigned_user_name: string;
  assigned_user_avatar: string | null;
}

export default function PreparedSpeechEvaluations() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<PreparedSpeechEvaluation[]>([]);
  const [openEvaluatorRoles, setOpenEvaluatorRoles] = useState<OpenEvaluatorRole[]>([]);
  const [bookedEvaluatorRoles, setBookedEvaluatorRoles] = useState<BookedEvaluatorRole[]>([]);
  const [bookedSpeakerRoles, setBookedSpeakerRoles] = useState<any[]>([]);
  const [openSpeakerRoles, setOpenSpeakerRoles] = useState<OpenSpeakerRole[]>([]);
  const [bookingRoleId, setBookingRoleId] = useState<string | null>(null);
  const [meetingInfo, setMeetingInfo] = useState<{
    title: string;
    date: string;
    startTime?: string;
    endTime?: string;
    mode?: string;
  } | null>(null);

  useEffect(() => {
    if (user?.id && meetingId) {
      loadMeetingInfo();
      loadEvaluations();
      loadOpenEvaluatorRoles();
      loadBookedEvaluatorRoles();
      loadBookedSpeakerRoles();
      loadOpenSpeakerRoles();
    }
  }, [user, meetingId]);

  // Refresh data when returning from upload page
  useEffect(() => {
    const unsubscribe = router.addListener?.('focus', () => {
      if (meetingId) {
        loadEvaluations();
        loadOpenEvaluatorRoles();
        loadBookedEvaluatorRoles();
        loadBookedSpeakerRoles();
        loadOpenSpeakerRoles();
      }
    });

    return unsubscribe;
  }, [meetingId]);

  const loadMeetingInfo = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('meeting_title, meeting_date, meeting_start_time, meeting_end_time, meeting_mode')
        .eq('id', meetingId)
        .maybeSingle();

      if (error) {
        console.error('Error loading meeting info:', error);
        return;
      }

      if (data) {
        setMeetingInfo({
          title: data.meeting_title,
          date: data.meeting_date,
          startTime: data.meeting_start_time,
          endTime: data.meeting_end_time,
          mode: data.meeting_mode
        });
      }
    } catch (error) {
      console.error('Error loading meeting info:', error);
    }
  };

  const loadEvaluations = async () => {
    if (!user?.id || !meetingId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('app_prepared_speech_evaluations')
        .select(`
          id,
          evaluation_pathway_id,
          meeting_id,
          speaker_id,
          evaluator_id,
          speech_title,
          pathway_name,
          project_name,
          project_number,
          level,
          evaluation_pdf_url,
          evaluation_status,
          uploaded_at,
          evaluator_comments,
          created_at,
          speech_category,
          speaker_role_name,
          speaker:app_user_profiles!app_prepared_speech_evaluations_speaker_id_fkey(
            full_name,
            avatar_url
          ),
          evaluator:app_user_profiles!app_prepared_speech_evaluations_evaluator_id_fkey(
            full_name,
            avatar_url
          ),
          meeting:app_club_meeting!app_prepared_speech_evaluations_meeting_id_fkey(
            meeting_title,
            meeting_date
          )
        `)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false});

      if (error) {
        console.error('Error loading evaluations:', error);
        Alert.alert('Error', `Failed to load evaluations: ${error.message}`);
        return;
      }

      const mappedEvaluations: PreparedSpeechEvaluation[] = (data || []).map((item: any) => ({
        id: item.id,
        evaluation_pathway_id: item.evaluation_pathway_id,
        meeting_id: item.meeting_id,
        speaker_id: item.speaker_id,
        speaker_name: item.speaker?.full_name || 'Unknown',
        speaker_avatar: item.speaker?.avatar_url || null,
        evaluator_id: item.evaluator_id,
        evaluator_name: item.evaluator?.full_name || 'Unknown',
        evaluator_avatar: item.evaluator?.avatar_url || null,
        speech_title: item.speech_title,
        pathway_name: item.pathway_name,
        project_name: item.project_name,
        project_number: item.project_number,
        level: item.level,
        evaluation_pdf_url: item.evaluation_pdf_url,
        evaluation_status: item.evaluation_status,
        uploaded_at: item.uploaded_at,
        evaluator_comments: item.evaluator_comments,
        meeting_date: item.meeting?.meeting_date || '',
        meeting_title: item.meeting?.meeting_title || '',
        created_at: item.created_at,
        speech_category: item.speech_category || 'Prepared Speech',
        speaker_role_name: item.speaker_role_name,
      }));

      setEvaluations(mappedEvaluations);
    } catch (error) {
      console.error('Error loading evaluations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOpenEvaluatorRoles = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select('id, role_name, role_classification')
        .eq('meeting_id', meetingId)
        .eq('role_classification', 'Speech evaluvator')
        .in('role_name', ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'])
        .is('assigned_user_id', null)
        .order('role_name', { ascending: true });

      if (error) {
        console.error('Error loading open evaluator roles:', error);
        return;
      }

      setOpenEvaluatorRoles(data || []);
    } catch (error) {
      console.error('Error loading open evaluator roles:', error);
    }
  };

  const loadBookedEvaluatorRoles = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          role_classification,
          assigned_user_id,
          app_user_profiles!inner(
            full_name,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_classification', 'Speech evaluvator')
        .in('role_name', ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'])
        .not('assigned_user_id', 'is', null)
        .order('role_name', { ascending: true });

      if (error) {
        console.error('Error loading booked evaluator roles:', error);
        return;
      }

      const mappedBookedRoles: BookedEvaluatorRole[] = (data || []).map((item: any) => ({
        id: item.id,
        role_name: item.role_name,
        role_classification: item.role_classification,
        assigned_user_id: item.assigned_user_id,
        assigned_user_name: item.app_user_profiles?.full_name || 'Unknown',
        assigned_user_avatar: item.app_user_profiles?.avatar_url || null,
      }));

      setBookedEvaluatorRoles(mappedBookedRoles);
    } catch (error) {
      console.error('Error loading booked evaluator roles:', error);
    }
  };

  const loadOpenSpeakerRoles = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select('id, role_name, role_classification')
        .eq('meeting_id', meetingId)
        .in('role_classification', ['Prepared speaker', 'Ice Breaker'])
        .eq('role_status', 'Available')
        .is('assigned_user_id', null)
        .order('role_name', { ascending: true });

      if (error) {
        console.error('Error loading open speaker roles:', error);
        return;
      }

      setOpenSpeakerRoles((data as OpenSpeakerRole[]) || []);
    } catch (error) {
      console.error('Error loading open speaker roles:', error);
    }
  };

  const loadBookedSpeakerRoles = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          role_classification,
          assigned_user_id,
          speech_title,
          pathway_name,
          project_name,
          project_number,
          level,
          app_user_profiles!inner(
            full_name,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .in('role_classification', ['Prepared speaker', 'Ice Breaker'])
        .not('assigned_user_id', 'is', null)
        .order('role_name', { ascending: true });

      if (error) {
        console.error('Error loading booked speaker roles:', error);
        return;
      }

      setBookedSpeakerRoles(data || []);
    } catch (error) {
      console.error('Error loading booked speaker roles:', error);
    }
  };

  const handleBookRoleInline = async (roleId: string) => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to book this role.');
      return;
    }
    setBookingRoleId(roleId);
    try {
      const result = await bookMeetingRoleForCurrentUser(user.id, roleId);
      if (result.ok) {
        await Promise.all([
          loadOpenEvaluatorRoles(),
          loadBookedEvaluatorRoles(),
          loadOpenSpeakerRoles(),
          loadBookedSpeakerRoles(),
          loadEvaluations(),
        ]);
      } else {
        Alert.alert('Could not book', result.message);
      }
    } finally {
      setBookingRoleId(null);
    }
  };

  const handleOpenEvaluation = (evaluation: PreparedSpeechEvaluation) => {
    router.push(`/evaluation-upload?evaluationId=${evaluation.id}`);
  };

  const handleViewPDF = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open PDF');
      }
    } catch (error) {
      console.error('Error opening PDF:', error);
      Alert.alert('Error', 'Failed to open PDF');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'uploaded':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'uploaded':
        return CheckCircle2;
      case 'completed':
        return CheckCircle2;
      default:
        return AlertCircle;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Speech Evaluation
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Meeting Card */}
      {meetingInfo && (
        <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.meetingCardContent}>
            <View style={[styles.meetingDateBox, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.meetingDay, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {new Date(meetingInfo.date).getDate()}
              </Text>
              <Text style={[styles.meetingMonth, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meetingInfo.date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingDetails}>
              <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {meetingInfo.title}
              </Text>
              <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Day: {new Date(meetingInfo.date).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              {meetingInfo.startTime && meetingInfo.endTime && (
                <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Time: {meetingInfo.startTime} - {meetingInfo.endTime}
                </Text>
              )}
              {meetingInfo.mode && (
                <Text style={[styles.meetingInfoText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Mode: {meetingInfo.mode === 'in_person' ? 'In Person' :
                         meetingInfo.mode === 'online' ? 'Online' : 'Hybrid'}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booked Evaluator Roles */}
        {bookedEvaluatorRoles.length > 0 && (
          <>
            <Text style={[styles.pageTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Booked Evaluators ({bookedEvaluatorRoles.length})
            </Text>
            {bookedEvaluatorRoles.map((role) => (
              <View
                key={role.id}
                style={[styles.evaluationCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <View style={styles.profileHeader}>
                  {role.assigned_user_avatar ? (
                    <Image source={{ uri: role.assigned_user_avatar }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '30' }]}>
                      <User size={32} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {role.assigned_user_name}
                    </Text>
                    <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {role.role_name}
                    </Text>
                  </View>
                  <View style={[styles.notebookIcon, { backgroundColor: theme.colors.border }]}>
                    <FileText size={24} color={theme.colors.textSecondary} />
                  </View>
                </View>

                <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Evaluation Information
                </Text>
                <View style={styles.speakerRow}>
                  <View style={[styles.speakerAvatarPlaceholderSmall, { backgroundColor: theme.colors.textSecondary + '30' }]}>
                    <User size={20} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.speakerDetails}>
                    <Text style={[styles.speakerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
                    <Text style={[styles.speakerNameText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Awaiting Assignment</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Open Evaluator Roles */}
        {openEvaluatorRoles.length > 0 && (
          <>
            <Text style={[styles.pageTitle, { color: theme.colors.text, marginTop: bookedEvaluatorRoles.length > 0 ? 24 : 0 }]} maxFontSizeMultiplier={1.3}>
              Open Evaluator Roles ({openEvaluatorRoles.length})
            </Text>
            {openEvaluatorRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[styles.openRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary }]}
                onPress={() => !bookingRoleId && handleBookRoleInline(role.id)}
                disabled={!!bookingRoleId}
              >
                <View style={styles.openRoleContent}>
                  <View style={[styles.openRoleIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <User size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.openRoleInfo}>
                    <Text style={[styles.openRoleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {role.role_name}
                    </Text>
                    <Text style={[styles.openRoleStatus, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Available - Tap to book
                    </Text>
                  </View>
                  <View style={[styles.bookButton, { backgroundColor: theme.colors.primary }]}>
                    {bookingRoleId === role.id ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={[styles.bookButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                        Book
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Open Prepared / Ice Breaker speaker slots */}
        {openSpeakerRoles.length > 0 && (
          <>
            <Text
              style={[
                styles.pageTitle,
                {
                  color: theme.colors.text,
                  marginTop:
                    openEvaluatorRoles.length > 0 || bookedEvaluatorRoles.length > 0 ? 24 : 0,
                },
              ]}
              maxFontSizeMultiplier={1.3}
            >
              Open speaker slots ({openSpeakerRoles.length})
            </Text>
            {openSpeakerRoles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[styles.openRoleCard, { backgroundColor: theme.colors.surface, borderColor: '#10b981' }]}
                onPress={() => !bookingRoleId && handleBookRoleInline(role.id)}
                disabled={!!bookingRoleId}
              >
                <View style={styles.openRoleContent}>
                  <View style={[styles.openRoleIcon, { backgroundColor: '#10b981' + '20' }]}>
                    <Mic size={24} color="#10b981" />
                  </View>
                  <View style={styles.openRoleInfo}>
                    <Text style={[styles.openRoleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {role.role_name}
                    </Text>
                    <Text style={[styles.openRoleStatus, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Book yourself as speaker — tap to book
                    </Text>
                  </View>
                  <View style={[styles.bookButton, { backgroundColor: '#10b981' }]}>
                    {bookingRoleId === role.id ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={[styles.bookButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                        Book
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={[styles.pageTitle, { color: theme.colors.text, marginTop: (openEvaluatorRoles.length > 0 || bookedEvaluatorRoles.length > 0 || openSpeakerRoles.length > 0) ? 24 : 0 }]} maxFontSizeMultiplier={1.3}>
          All Speakers ({bookedSpeakerRoles.length + evaluations.length})
        </Text>

        {/* Booked Speaker Roles - Show speakers who have booked slots */}
        {bookedSpeakerRoles.map((speaker) => {
            const userProfile = speaker.app_user_profiles;
            return (
              <View
                key={speaker.id}
                style={[styles.evaluationCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                {/* Speaker Profile */}
                <View style={styles.profileHeader}>
                  {userProfile?.avatar_url ? (
                    <Image source={{ uri: userProfile.avatar_url }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '30' }]}>
                      <User size={32} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {userProfile?.full_name || 'Unknown'}
                    </Text>
                    <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {speaker.role_name}
                    </Text>
                  </View>
                </View>

                {/* Speech Information Section */}
                {speaker.speech_title && (
                  <>
                    <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Speech Information
                    </Text>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title:</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{speaker.speech_title}</Text>
                    </View>
                    {speaker.pathway_name && (
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway:</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{speaker.pathway_name}</Text>
                      </View>
                    )}
                    {speaker.project_name && (
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project Name:</Text>
                        <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{speaker.project_name}</Text>
                      </View>
                    )}
                    {(speaker.level || speaker.project_number) && (
                      <View style={styles.badgesRow}>
                        {speaker.level && (
                          <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                            <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>L{speaker.level}</Text>
                          </View>
                        )}
                        {speaker.project_number && (
                          <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
                            <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>P{speaker.project_number}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}

                {/* Evaluation Information */}
                <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Evaluation Information
                </Text>
                <View style={styles.speakerRow}>
                  <View style={[styles.speakerAvatarPlaceholderSmall, { backgroundColor: theme.colors.textSecondary + '30' }]}>
                    <User size={20} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.speakerDetails}>
                    <Text style={[styles.speakerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Evaluator</Text>
                    <Text style={[styles.speakerNameText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Unassigned</Text>
                  </View>
                </View>
              </View>
            );
          })}

        {evaluations.length === 0 &&
         bookedEvaluatorRoles.length === 0 &&
         openEvaluatorRoles.length === 0 &&
         openSpeakerRoles.length === 0 &&
         bookedSpeakerRoles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No Speakers
            </Text>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No speakers assigned for this meeting
            </Text>
          </View>
        ) : (
          evaluations.map((evaluation) => {
            const statusColor = getStatusColor(evaluation.evaluation_status);
            const isUserEvaluator = evaluation.evaluator_id === user?.id;

            return (
              <TouchableOpacity
                key={evaluation.id}
                style={[styles.evaluationCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => handleOpenEvaluation(evaluation)}
              >
                {/* Evaluator Profile */}
                <View style={styles.profileHeader}>
                  {evaluation.evaluator_avatar ? (
                    <Image source={{ uri: evaluation.evaluator_avatar }} style={styles.profileAvatar} />
                  ) : (
                    <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.colors.primary + '30' }]}>
                      <User size={32} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {evaluation.evaluator_name}
                    </Text>
                    <Text style={[styles.profileRole, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Speech Evaluator ({evaluation.speech_category})
                    </Text>
                  </View>
                  <View style={[styles.notebookIcon, { backgroundColor: theme.colors.border }]}>
                    <FileText size={24} color={theme.colors.textSecondary} />
                  </View>
                </View>

                {/* Speech Information Section */}
                <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />

                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Speech Information
                </Text>

                {evaluation.speech_title && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Title:</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.speech_title}</Text>
                  </View>
                )}

                {evaluation.pathway_name && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Pathway:</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.pathway_name}</Text>
                  </View>
                )}

                {evaluation.project_name && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Project Name:</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.project_name}</Text>
                  </View>
                )}

                {(evaluation.level || evaluation.project_number) && (
                  <View style={styles.badgesRow}>
                    {evaluation.level && (
                      <View style={[styles.badge, { backgroundColor: '#3b82f6' }]}>
                        <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>L{evaluation.level}</Text>
                      </View>
                    )}
                    {evaluation.project_number && (
                      <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
                        <Text style={styles.badgeText} maxFontSizeMultiplier={1.3}>P{evaluation.project_number}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Speaker Section */}
                <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.speakerRow}>
                  {evaluation.speaker_avatar ? (
                    <Image source={{ uri: evaluation.speaker_avatar }} style={styles.speakerAvatarSmall} />
                  ) : (
                    <View style={[styles.speakerAvatarPlaceholderSmall, { backgroundColor: theme.colors.primary + '30' }]}>
                      <User size={20} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={styles.speakerDetails}>
                    <Text style={[styles.speakerLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Speaker</Text>
                    <Text style={[styles.speakerNameText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{evaluation.speaker_name}</Text>
                  </View>
                  {isUserEvaluator ? (
                    <TouchableOpacity
                      style={[styles.openFormButton, { backgroundColor: theme.colors.primary + '15' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenEvaluation(evaluation);
                      }}
                    >
                      <Text style={[styles.openFormText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Upload PDF</Text>
                    </TouchableOpacity>
                  ) : evaluation.evaluation_pdf_url ? (
                    <TouchableOpacity
                      style={[styles.openFormButton, { backgroundColor: theme.colors.primary + '15' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleViewPDF(evaluation.evaluation_pdf_url!);
                      }}
                    >
                      <Text style={[styles.openFormText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>View PDF</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Status */}
                <View style={[styles.statusRow, { backgroundColor: statusColor + '15' }]}>
                  <Text style={[styles.statusLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Status:</Text>
                  <Text style={[styles.statusValue, { color: statusColor }]} maxFontSizeMultiplier={1.3}>
                    {evaluation.evaluation_status === 'pending' && 'Pending'}
                    {evaluation.evaluation_status === 'uploaded' && 'Completed'}
                    {evaluation.evaluation_status === 'completed' && 'Completed'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

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
              onPress={() =>
                router.push({ pathname: '/book-a-role', params: { meetingId, initialTab: 'my_bookings' } })
              }
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                <RotateCcw size={24} color="#4F46E5" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Withdraw
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionItem}
              onPress={() => router.push({ pathname: '/book-a-role', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E0F0F7' }]}>
                <Calendar size={24} color="#004165" />
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
              <View style={[styles.quickActionIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
                <Sparkles size={24} color="#8b5cf6" />
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
              onPress={() => router.push({ pathname: '/evaluation-corner', params: { meetingId } })}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E7F5EF' }]}>
                <FileBarChart size={24} color="#10b981" />
              </View>
              <Text style={[styles.quickActionLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speeches</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  meetingCard: {
    marginHorizontal: 13,
    marginTop: 13,
    borderRadius: 13,
    padding: 16,
    minHeight: 96,
    borderWidth: 1,
  },
  meetingCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meetingDateBox: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetingDay: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  meetingMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  meetingDetails: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  meetingInfoText: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  evaluationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profileAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
  },
  notebookIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    width: 120,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  speakerAvatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  speakerAvatarPlaceholderSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speakerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  speakerLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  speakerNameText: {
    fontSize: 16,
    fontWeight: '600',
  },
  openFormButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openFormText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  openRoleCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  openRoleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  openRoleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openRoleInfo: {
    flex: 1,
  },
  openRoleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  openRoleStatus: {
    fontSize: 13,
  },
  bookButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickActionsBoxContainer: {
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    marginBottom: 16,
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

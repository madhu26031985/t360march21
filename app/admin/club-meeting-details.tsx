import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { clubInfoManagementQueryKeys, type ClubInfoManagementMeetingSchedule } from '@/lib/clubInfoManagementQuery';
import { ArrowLeft, Save, Calendar, ChevronDown, Crown, User, Shield, Eye, UserCheck, Info } from 'lucide-react-native';
import SmartTimeInput from '@/components/SmartTimeinput';

interface ClubMeetingDetails {
  meeting_day: string | null;
  meeting_frequency: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_type: string | null;
  online_meeting_link: string | null;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

const emptyMeetingDetails = (): ClubMeetingDetails => ({
  meeting_day: null,
  meeting_frequency: null,
  meeting_start_time: null,
  meeting_end_time: null,
  meeting_type: null,
  online_meeting_link: null,
});

export function ClubMeetingDetailsContent({
  embedded = false,
  prefetchedMeetingDetails,
}: {
  embedded?: boolean;
  /** When set (e.g. from Club Info bundle), embedded tab skips the extra loading fetch. */
  prefetchedMeetingDetails?: ClubInfoManagementMeetingSchedule | null;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<ClubMeetingDetails>(() =>
    prefetchedMeetingDetails != null ? { ...prefetchedMeetingDetails } : emptyMeetingDetails()
  );

  const [isLoading, setIsLoading] = useState(() => {
    if (!embedded) return true;
    return prefetchedMeetingDetails == null;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [tempSelectedDay, setTempSelectedDay] = useState<string | null>(null);
  const [tempSelectedFrequency, setTempSelectedFrequency] = useState<string | null>(null);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [tempSelectedType, setTempSelectedType] = useState<string | null>(null);

  const dayOptions = [
    { value: 'Monday', label: 'Monday' },
    { value: 'Tuesday', label: 'Tuesday' },
    { value: 'Wednesday', label: 'Wednesday' },
    { value: 'Thursday', label: 'Thursday' },
    { value: 'Friday', label: 'Friday' },
    { value: 'Saturday', label: 'Saturday' },
    { value: 'Sunday', label: 'Sunday' },
  ];

  const frequencyOptions = [
    { value: 'Weekly', label: 'Weekly', description: 'Every week' },
    { value: 'Bi-weekly', label: 'Fortnightly', description: 'Every 2 weeks' },
    { value: 'Every 3 weeks', label: '3 weeks', description: 'Every 3 weeks' },
    { value: 'Monthly', label: 'Monthly', description: 'Once a month' },
  ];

  const typeOptions = [
    { value: 'in_person', label: 'In Person', description: 'Physical meeting at club location' },
    { value: 'online', label: 'Online', description: 'Virtual meeting via video call' },
    { value: 'hybrid', label: 'Hybrid Meeting', description: 'Both online and offline attendance' },
  ];

  useEffect(() => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }
    if (!embedded) {
      void loadClubInfo();
      void loadClubMeetingDetails();
      return;
    }
    if (prefetchedMeetingDetails != null) {
      setMeetingDetails({ ...prefetchedMeetingDetails });
      setIsLoading(false);
      return;
    }
    void loadClubMeetingDetails();
  }, [user?.currentClubId, embedded, prefetchedMeetingDetails]);

  const loadClubMeetingDetails = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading club meeting details for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('club_profiles')
        .select('meeting_day, meeting_frequency, meeting_start_time, meeting_end_time, meeting_type, online_meeting_link')
        .eq('club_id', user.currentClubId)
        .single();

      console.log('Meeting details query result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading club meeting details:', error);
        Alert.alert('Error', 'Failed to load club meeting details');
        return;
      }

      if (data) {
        setMeetingDetails(data as any);
      }
    } catch (error) {
      console.error('Error loading club meeting details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data as any);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const updateField = (field: keyof ClubMeetingDetails, value: string | null) => {
    setMeetingDetails(prev => ({ ...prev, [field]: value }));
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return 'Select time';
    try {
      const raw = String(timeString).trim();
      const hhmm = raw.match(/^(\d{1,2}):(\d{2})/);
      if (!hhmm) return raw;
      let hours = parseInt(hhmm[1], 10);
      const minutes = hhmm[2];
      if (Number.isNaN(hours)) return raw;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours || 12;
      return `${hours}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const getDayLabel = () => {
    const option = dayOptions.find(opt => opt.value === meetingDetails.meeting_day);
    return option?.label || 'Select day';
  };

  const getFrequencyLabel = () => {
    const option = frequencyOptions.find(opt => opt.value === meetingDetails.meeting_frequency);
    return option?.label || 'Select frequency';
  };

  const getTypeLabel = () => {
    const option = typeOptions.find(opt => opt.value === meetingDetails.meeting_type);
    return option?.label || 'Select type';
  };

  const validateForm = (): boolean => {
    if (!meetingDetails.meeting_day) {
      Alert.alert('Error', 'Please select a meeting day');
      return false;
    }

    if (!meetingDetails.meeting_frequency) {
      Alert.alert('Error', 'Please select meeting frequency');
      return false;
    }

    if (!meetingDetails.meeting_start_time) {
      Alert.alert('Error', 'Please select a start time');
      return false;
    }

    if (!meetingDetails.meeting_type) {
      Alert.alert('Error', 'Please select meeting type');
      return false;
    }

    if (meetingDetails.meeting_end_time && meetingDetails.meeting_start_time && meetingDetails.meeting_end_time <= meetingDetails.meeting_start_time) {
      Alert.alert('Error', 'End time must be after start time');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.currentClubId) return;

    setIsSaving(true);

    try {
      console.log('Saving club meeting details...');
      
      const updateData = {
        meeting_day: meetingDetails.meeting_day,
        meeting_frequency: meetingDetails.meeting_frequency,
        meeting_start_time: meetingDetails.meeting_start_time,
        meeting_end_time: meetingDetails.meeting_end_time,
        meeting_type: meetingDetails.meeting_type,
        updated_at: new Date().toISOString(),
      };

      // Check if club profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        // Create new club profile
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...updateData,
            created_at: new Date().toISOString(),
          });

        if (createError) {
          console.error('Error creating club profile:', createError);
          Alert.alert('Error', 'Failed to save meeting details');
          return;
        }
        void queryClient.invalidateQueries({ queryKey: clubInfoManagementQueryKeys.detail(user.currentClubId) });
      } else if (checkError) {
        console.error('Error checking club profile:', checkError);
        Alert.alert('Error', 'Database error occurred');
        return;
      } else {
        // Update existing club profile
        const { error: updateError } = await supabase
          .from('club_profiles')
          .update(updateData)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          Alert.alert('Error', 'Failed to save meeting details');
          return;
        }
        void queryClient.invalidateQueries({ queryKey: clubInfoManagementQueryKeys.detail(user.currentClubId) });
      }

      Alert.alert('Success', 'Club meeting details saved successfully!');
    } catch (error) {
      console.error('Error saving meeting details:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

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

  if (isLoading) {
    if (embedded) {
      return (
        <View
          style={[
            styles.meetingDetailsPanel,
            {
              borderColor: theme.colors.border,
              marginHorizontal: 0,
              marginTop: 0,
              backgroundColor: 'transparent',
              minHeight: 120,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!embedded && (
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Club Meeting Details
          </Text>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Save size={16} color="#ffffff" />
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!embedded && clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.clubHeader}>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                      {getRoleIcon(user.clubRole)}
                      <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {!embedded && (
          <View style={styles.infoBox}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconContainer}>
                <Info size={20} color="#3B82F6" />
              </View>
              <Text style={styles.infoTitle} maxFontSizeMultiplier={1.3}>Why set this?</Text>
            </View>
            <Text style={styles.infoText} maxFontSizeMultiplier={1.3}>
              Your meeting schedule helps members & guests know your regular timings.
            </Text>
            <Text style={styles.infoText} maxFontSizeMultiplier={1.3}>
              This will be visible under <Text style={styles.infoLink} maxFontSizeMultiplier={1.3}>Club → Club Info</Text>.
            </Text>
          </View>
        )}

        {/* Single flat panel: schedule grid + meeting type */}
        <View
          style={[
            styles.meetingDetailsPanel,
            {
              backgroundColor: embedded ? 'transparent' : theme.colors.surface,
              borderColor: theme.colors.border,
              marginHorizontal: embedded ? 0 : 16,
              marginTop: embedded ? 0 : 16,
            },
          ]}
        >
          <View style={[styles.meetingDetailsPanelHeader, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.meetingDetailsPanelIcon, { backgroundColor: theme.colors.primary + '14' }]}>
              <Calendar size={20} color={theme.colors.primary} strokeWidth={2} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meeting details
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Regular schedule, times, and how members attend.
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.meetingGridRow}>
              <TouchableOpacity
                style={[
                  styles.meetingGridCell,
                  {
                    borderColor: theme.colors.border,
                    borderRightWidth: StyleSheet.hairlineWidth,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => {
                  setTempSelectedDay(meetingDetails.meeting_day);
                  setShowDayModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.meetingScheduleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Day
                </Text>
                <View style={styles.meetingScheduleValueWrap}>
                  <Text style={[styles.meetingScheduleValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {getDayLabel()}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.meetingGridCell,
                  {
                    borderColor: theme.colors.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => {
                  setTempSelectedFrequency(meetingDetails.meeting_frequency);
                  setShowFrequencyModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.meetingScheduleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Frequency
                </Text>
                <View style={styles.meetingScheduleValueWrap}>
                  <Text style={[styles.meetingScheduleValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {getFrequencyLabel()}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.primary} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.meetingGridRow}>
              <TouchableOpacity
                style={[
                  styles.meetingGridCell,
                  {
                    borderColor: theme.colors.border,
                    borderRightWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => setShowStartTimeModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.meetingScheduleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Start Time
                </Text>
                <View style={styles.meetingScheduleValueWrap}>
                  <Text style={[styles.meetingScheduleValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {formatTime(meetingDetails.meeting_start_time)}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.primary} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.meetingGridCell} onPress={() => setShowEndTimeModal(true)} activeOpacity={0.7}>
                <Text style={[styles.meetingScheduleLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  End Time
                </Text>
                <View style={styles.meetingScheduleValueWrap}>
                  <Text style={[styles.meetingScheduleValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {formatTime(meetingDetails.meeting_end_time)}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.primary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.meetingTypeRow, { borderTopColor: theme.colors.border }]}
            onPress={() => {
              setTempSelectedType(meetingDetails.meeting_type);
              setShowTypeModal(true);
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.meetingScheduleLabel, { color: theme.colors.textSecondary, marginBottom: 0, alignSelf: 'center' }]}
              maxFontSizeMultiplier={1.2}
            >
              Type
            </Text>
            <View style={styles.settingValueWrap}>
              <Text style={[styles.meetingScheduleValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                {getTypeLabel()}
              </Text>
              <ChevronDown size={16} color={theme.colors.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Day Selection Modal */}
      <Modal
        visible={showDayModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTempSelectedDay(null);
          setShowDayModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setTempSelectedDay(null);
            setShowDayModal(false);
          }}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={[
                styles.typeDropdownModal,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.typeModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                Select Meeting Day
              </Text>
              <View style={[styles.typeOptionsListBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                {dayOptions.map((option, idx) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor:
                          (tempSelectedDay || meetingDetails.meeting_day) === option.value ? theme.colors.primary + '20' : 'transparent',
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth: idx === dayOptions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      },
                    ]}
                    onPress={() => {
                      setTempSelectedDay(option.value);
                    }}
                  >
                    <Text style={[
                      styles.typeOptionTitle,
                      { color: (tempSelectedDay || meetingDetails.meeting_day) === option.value ? theme.colors.primary : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.2}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                </ScrollView>
              </View>
              <View style={[styles.modalActions, styles.typeModalActions]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setTempSelectedDay(null);
                    setShowDayModal(false);
                  }}
                >
                  <Text style={[styles.typeModalButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.confirmButton,
                    { backgroundColor: tempSelectedDay ? theme.colors.primary : '#94A3B8' }
                  ]}
                  onPress={() => {
                    if (tempSelectedDay) {
                      updateField('meeting_day', tempSelectedDay);
                      setTempSelectedDay(null);
                      setShowDayModal(false);
                    }
                  }}
                  disabled={!tempSelectedDay}
                >
                  <Text style={styles.typeModalConfirmButtonText} maxFontSizeMultiplier={1.3}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Frequency Selection Modal */}
      <Modal
        visible={showFrequencyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTempSelectedFrequency(null);
          setShowFrequencyModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setTempSelectedFrequency(null);
            setShowFrequencyModal(false);
          }}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={[
                styles.typeDropdownModal,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.typeModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                Select Meeting Frequency
              </Text>
              <View style={[styles.typeOptionsListBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                {frequencyOptions.map((option, idx) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.typeOption,
                      {
                        backgroundColor:
                          (tempSelectedFrequency || meetingDetails.meeting_frequency) === option.value
                            ? theme.colors.primary + '20'
                            : 'transparent',
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth: idx === frequencyOptions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                      },
                    ]}
                    onPress={() => {
                      setTempSelectedFrequency(option.value);
                    }}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.typeOptionTitle,
                        { color: (tempSelectedFrequency || meetingDetails.meeting_frequency) === option.value ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.2}>
                        {option.label}
                      </Text>
                      <Text style={[styles.selectorOptionDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                        {option.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                </ScrollView>
              </View>
              <View style={[styles.modalActions, styles.typeModalActions]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setTempSelectedFrequency(null);
                    setShowFrequencyModal(false);
                  }}
                >
                  <Text style={[styles.typeModalButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.confirmButton,
                    { backgroundColor: tempSelectedFrequency ? theme.colors.primary : '#94A3B8' }
                  ]}
                  onPress={() => {
                    if (tempSelectedFrequency) {
                      updateField('meeting_frequency', tempSelectedFrequency);
                      setTempSelectedFrequency(null);
                      setShowFrequencyModal(false);
                    }
                  }}
                  disabled={!tempSelectedFrequency}
                >
                  <Text style={styles.typeModalConfirmButtonText} maxFontSizeMultiplier={1.3}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setTempSelectedType(null);
          setShowTypeModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setTempSelectedType(null);
            setShowTypeModal(false);
          }}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={[
                styles.typeDropdownModal,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.typeModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Select Meeting Type
              </Text>
              <View style={[styles.typeOptionsListBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                {typeOptions.map((option, idx) => {
                  const isSelected = (tempSelectedType || meetingDetails.meeting_type) === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor: isSelected ? theme.colors.primary + '20' : 'transparent',
                          borderBottomColor: theme.colors.border,
                          borderBottomWidth: idx === typeOptions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                        }
                      ]}
                      onPress={() => setTempSelectedType(option.value)}
                    >
                      <Text style={[
                        styles.typeOptionTitle,
                        { color: isSelected ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.modalActions, styles.typeModalActions]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setTempSelectedType(null);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={[styles.typeModalButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.confirmButton,
                    { backgroundColor: tempSelectedType ? theme.colors.primary : '#94A3B8' }
                  ]}
                  onPress={() => {
                    if (tempSelectedType) {
                      updateField('meeting_type', tempSelectedType);
                      setTempSelectedType(null);
                      setShowTypeModal(false);
                    }
                  }}
                  disabled={!tempSelectedType}
                >
                  <Text style={styles.typeModalConfirmButtonText} maxFontSizeMultiplier={1.3}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Start Time Picker Modal */}
      <SmartTimeInput
        visible={showStartTimeModal}
        onClose={() => setShowStartTimeModal(false)}
        onTimeSelect={(time) => {
          updateField('meeting_start_time', time);
          setShowStartTimeModal(false);
        }}
        initialTime={meetingDetails.meeting_start_time || undefined}
      />

      {/* End Time Picker Modal */}
      <SmartTimeInput
        visible={showEndTimeModal}
        onClose={() => setShowEndTimeModal(false)}
        onTimeSelect={(time) => {
          updateField('meeting_end_time', time);
          setShowEndTimeModal(false);
        }}
        initialTime={meetingDetails.meeting_end_time || undefined}
      />
    </SafeAreaView>
  );
}

export default function ClubMeetingDetailsPage() {
  return <ClubMeetingDetailsContent embedded={false} />;
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
  backButtonPlaceholder: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 0,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
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
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
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
  infoBox: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 0,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoLink: {
    fontWeight: '600',
    color: '#2563EB',
  },
  meetingDetailsPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  meetingDetailsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  meetingDetailsPanelIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  meetingGridRow: {
    flexDirection: 'row',
  },
  meetingGridCell: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  meetingTypeRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  meetingScheduleLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  meetingScheduleValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meetingScheduleValue: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
    flexShrink: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValueChip: {
    minWidth: 110,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  settingDivider: {
    height: 1,
    marginLeft: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  formField: {
    flex: 1,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  dropdownText: {
    fontSize: 14,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeDropdownModal: {
    borderRadius: 0,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 14,
    marginHorizontal: 8,
    width: '98%',
    maxWidth: 483,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  typeModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'left',
  },
  typeOptionsListBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  optionsList: {
    marginBottom: 0,
    maxHeight: 280,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 0,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionContent: {
    flex: 1,
  },
  selectorOptionDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  typeOption: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  typeOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  typeModalActions: {
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  confirmButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeModalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeModalConfirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
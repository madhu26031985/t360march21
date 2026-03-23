import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Calendar, Clock, MapPin, ChevronDown, Building2, Crown, User, Shield, Eye, UserCheck, Repeat, Info, Video, Monitor } from 'lucide-react-native';
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

export default function ClubMeetingDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [meetingDetails, setMeetingDetails] = useState<ClubMeetingDetails>({
    meeting_day: null,
    meeting_frequency: null,
    meeting_start_time: null,
    meeting_end_time: null,
    meeting_type: null,
    online_meeting_link: null,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showFrequencyModal, setShowFrequencyModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
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
    loadClubMeetingDetails();
    loadClubInfo();
  }, []);

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

    // Convert HH:MM:SS or HH:MM format to 12-hour format with AM/PM
    const timeParts = timeString.split(':');
    if (timeParts.length < 2) return timeString;

    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12

    return `${hours}:${minutes} ${ampm}`;
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

  if (isLoading) {
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Meeting Details</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
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

        {/* Info Box */}
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

        {/* Meeting Schedule Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Calendar size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Schedule</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Your schedule helps members know your regular meeting time.
              </Text>
            </View>
          </View>

          <View style={[styles.settingsList, { borderColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.settingRow} onPress={() => setShowDayModal(true)}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Day</Text>
              <View style={styles.settingValueWrap}>
                <Text style={[styles.settingValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{getDayLabel()}</Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            <View style={[styles.settingDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => setShowFrequencyModal(true)}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Frequency</Text>
              <View style={styles.settingValueWrap}>
                <Text style={[styles.settingValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{getFrequencyLabel()}</Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            <View style={[styles.settingDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => setShowStartTimeModal(true)}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Start Time</Text>
              <View style={styles.settingValueWrap}>
                <Text style={[styles.settingValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatTime(meetingDetails.meeting_start_time)}
                </Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
            <View style={[styles.settingDivider, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity style={styles.settingRow} onPress={() => setShowEndTimeModal(true)}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>End Time</Text>
              <View style={styles.settingValueWrap}>
                <Text style={[styles.settingValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatTime(meetingDetails.meeting_end_time)}
                </Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Meeting Format Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <MapPin size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Format</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Choose how your members attend each meeting.
              </Text>
            </View>
          </View>

          <View style={[styles.settingsList, { borderColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setTempSelectedType(meetingDetails.meeting_type);
                setShowTypeModal(true);
              }}
            >
              <Text style={[styles.settingLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Type</Text>
              <View style={styles.settingValueWrap}>
                <Text style={[styles.settingValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{getTypeLabel()}</Text>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Day Selection Modal */}
      <Modal
        visible={showDayModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDayModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDayModal(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Meeting Day</Text>
              <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                {dayOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      meetingDetails.meeting_day === option.value && { backgroundColor: theme.colors.primary + '20' }
                    ]}
                    onPress={() => {
                      updateField('meeting_day', option.value);
                      setShowDayModal(false);
                    }}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: meetingDetails.meeting_day === option.value ? theme.colors.primary : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Frequency Selection Modal */}
      <Modal
        visible={showFrequencyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFrequencyModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFrequencyModal(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Meeting Frequency</Text>
              <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
                {frequencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.option,
                      meetingDetails.meeting_frequency === option.value && { backgroundColor: theme.colors.primary + '20' }
                    ]}
                    onPress={() => {
                      updateField('meeting_frequency', option.value);
                      setShowFrequencyModal(false);
                    }}
                  >
                    <View style={styles.optionContent}>
                      <Text style={[
                        styles.optionTitle,
                        { color: meetingDetails.meeting_frequency === option.value ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {option.label}
                      </Text>
                      <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {option.description}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
            <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Meeting Type</Text>
              <View style={styles.optionsList}>
                {typeOptions.map((option) => {
                  const isSelected = (tempSelectedType || meetingDetails.meeting_type) === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor: isSelected ? theme.colors.primary : '#F8FAFC',
                          borderWidth: isSelected ? 0 : 1,
                          borderColor: '#E2E8F0',
                        }
                      ]}
                      onPress={() => setTempSelectedType(option.value)}
                    >
                      <Text style={[
                        styles.typeOptionTitle,
                        { color: isSelected ? '#FFFFFF' : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setTempSelectedType(null);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
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
                  <Text style={styles.confirmButtonText} maxFontSizeMultiplier={1.3}>Confirm</Text>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
  clubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 16,
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
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  settingsList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: '600',
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
    borderRadius: 8,
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
    borderRadius: 8,
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
  dropdownModal: {
    borderRadius: 16,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    marginHorizontal: 16,
    maxHeight: '75%',
    width: '92%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsList: {
    marginBottom: 4,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  optionContent: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
  },
  typeOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  confirmButton: {
    shadowColor: '#3B82F6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
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
});
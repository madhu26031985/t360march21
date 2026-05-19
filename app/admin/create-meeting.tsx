import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Modal, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface MeetingForm {
  title: string;
  date: Date;
  number: string;
  startTime: Date;
  endTime: Date;
  mode: string;
  location: string;
  link: string;
}

export default function CreateMeeting() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'mode' | 'datetime'>('info');

  const [meetingForm, setMeetingForm] = useState<MeetingForm>(() => {
    const startTime = new Date();
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    return {
      title: '',
      date: new Date(),
      number: '',
      startTime,
      endTime,
      mode: 'in_person',
      location: '',
      link: '',
    };
  });

  const modeOptions = [
    { value: 'in_person', label: 'In Person' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
  ];

  // Load club address on mount
  useEffect(() => {
    const loadClubAddress = async () => {
      if (!user?.currentClubId) return;

      try {
        const { data, error } = await supabase
          .from('club_profiles')
          .select('address')
          .eq('club_id', user.currentClubId)
          .maybeSingle();

        if (error) {
          console.error('Error loading club address:', error);
          return;
        }

        if (data?.address) {
          setMeetingForm(prev => ({ ...prev, location: data.address }));
        }
      } catch (error) {
        console.error('Error loading club address:', error);
      }
    };

    loadClubAddress();
  }, [user?.currentClubId]);

  const updateFormField = (field: keyof MeetingForm, value: any) => {
    setMeetingForm(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeDisplay = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  /** HTML `<input type="time">` requires HH:mm (24h), not locale strings */
  const formatTimeForWebInput = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDateForDb = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  /** Postgres `time` — explicit 24h */
  const formatTimeForDb = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${min}:${s}`;
  };

  const timeToMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

  const applyWebTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    const [hours, minutes] = value.split(':');
    if (hours === undefined || minutes === undefined) return;
    const next = new Date(meetingForm.date);
    next.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    if (!Number.isNaN(next.getTime())) {
      updateFormField(field, next);
    }
  };

  const alertWebSafe = (title: string, message?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      return;
    }
    Alert.alert(title, message || '');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      updateFormField('date', selectedDate);
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }
    if (selectedTime) {
      updateFormField('startTime', selectedTime);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }
    if (selectedTime) {
      updateFormField('endTime', selectedTime);
    }
  };

  const validateForm = (): boolean => {
    if (!meetingForm.title.trim()) {
      alertWebSafe('Error', 'Please enter a meeting title');
      return false;
    }

    if (!meetingForm.number.trim()) {
      alertWebSafe('Error', 'Please enter a meeting number');
      return false;
    }

    if (timeToMinutes(meetingForm.endTime) <= timeToMinutes(meetingForm.startTime)) {
      alertWebSafe(
        'Time Error',
        'The end time must be after the start time. Please update Start Time or End Time on the Date & Time tab.'
      );
      return false;
    }

    if (meetingForm.mode === 'online' && !meetingForm.link.trim()) {
      alertWebSafe('Error', 'Please provide a meeting link for online meetings');
      return false;
    }

    if (meetingForm.mode === 'in_person' && !meetingForm.location.trim()) {
      alertWebSafe('Error', 'Please provide a location for in-person meetings');
      return false;
    }

    if (meetingForm.mode === 'hybrid') {
      if (!meetingForm.location.trim()) {
        alertWebSafe('Error', 'Please provide a location for hybrid meetings');
        return false;
      }
      if (!meetingForm.link.trim()) {
        alertWebSafe('Error', 'Please provide a meeting link for hybrid meetings');
        return false;
      }
    }

    return true;
  };

  const handleSaveMeeting = async () => {
    if (!validateForm()) return;

    if (!user?.currentClubId) {
      alertWebSafe(
        'Error',
        'No active club selected. Open the app from your club context or switch clubs, then try again.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const saveData = {
        club_id: user.currentClubId,
        meeting_title: meetingForm.title.trim(),
        meeting_date: formatDateForDb(meetingForm.date),
        meeting_number: meetingForm.number.trim() || null,
        meeting_start_time: formatTimeForDb(meetingForm.startTime),
        meeting_end_time: formatTimeForDb(meetingForm.endTime),
        meeting_mode: meetingForm.mode,
        meeting_location: meetingForm.mode === 'in_person' || meetingForm.mode === 'hybrid'
          ? meetingForm.location.trim() || null
          : null,
        meeting_link: meetingForm.mode === 'online' || meetingForm.mode === 'hybrid'
          ? meetingForm.link.trim() || null
          : null,
        meeting_status: 'open',
      };

      const { error } = await supabase
        .from('app_club_meeting')
        .insert(saveData);

      if (error) {
        console.error('Error creating meeting:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));

        const notifySlack = async () => {
          try {
            const { data: profile } = await supabase
              .from('app_user_profiles')
              .select('email, full_name')
              .eq('user_id', user?.id)
              .maybeSingle();

            const { data: club } = await supabase
              .from('clubs')
              .select('club_name')
              .eq('club_id', user?.currentClubId)
              .maybeSingle();

            const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/notify-slack-meeting-error`;

            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: user?.id,
                userEmail: profile?.email,
                userName: profile?.full_name,
                clubId: user?.currentClubId,
                clubName: club?.club_name,
                errorMessage: error.message || 'Unknown error',
                errorDetails: error,
                meetingData: saveData,
              }),
            });
          } catch (notifyError) {
            console.error('Failed to send Slack notification:', notifyError);
          }
        };

        notifySlack();

        if (error.message && (error.message.includes('time') || error.message.includes('club_id'))) {
          if (error.message.includes('time')) {
            alertWebSafe('Time Error', 'Looks like the time is incorrect—please update it.');
          } else if (error.message.includes('club_id')) {
            alertWebSafe('Error', 'Club information is missing. Please try logging out and back in.');
          } else {
            alertWebSafe('Error', `Failed to create meeting: ${error.message}`);
          }
        } else {
          alertWebSafe('Error', `Failed to create meeting: ${error.message || 'Unknown error'}`);
        }
        return;
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving meeting:', error);
      alertWebSafe('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create New Meeting</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'info' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('info')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'info' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Meeting Info
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'mode' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('mode')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'mode' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Meeting Mode
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'datetime' && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setActiveTab('datetime')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'datetime' ? theme.colors.primary : theme.colors.textSecondary }
          ]} maxFontSizeMultiplier={1.3}>
            Date & Time
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tab 1: Meeting Info */}
        {activeTab === 'info' && (
          <View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter meeting title"
                placeholderTextColor={theme.colors.textSecondary}
                value={meetingForm.title}
                onChangeText={(text) => updateFormField('title', text)}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Number *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., 123"
                placeholderTextColor={theme.colors.textSecondary}
                value={meetingForm.number}
                onChangeText={(text) => updateFormField('number', text)}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setActiveTab('mode')}
            >
              <Text style={styles.nextButtonText} maxFontSizeMultiplier={1.3}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab 2: Meeting Mode */}
        {activeTab === 'mode' && (
          <View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Mode *</Text>
              <View style={styles.compactModeOptions}>
                {modeOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.compactModeOption,
                      {
                        backgroundColor: meetingForm.mode === option.value ? theme.colors.primary : theme.colors.surface,
                        borderColor: meetingForm.mode === option.value ? theme.colors.primary : theme.colors.border,
                      }
                    ]}
                    onPress={() => updateFormField('mode', option.value)}
                  >
                    <Text style={[
                      styles.compactModeOptionText,
                      { color: meetingForm.mode === option.value ? '#ffffff' : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {(meetingForm.mode === 'in_person' || meetingForm.mode === 'hybrid') && (
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Location *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter meeting location"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={meetingForm.location}
                  onChangeText={(text) => updateFormField('location', text)}
                />
              </View>
            )}

            {(meetingForm.mode === 'online' || meetingForm.mode === 'hybrid') && (
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Link *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                  placeholder="Enter meeting link"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={meetingForm.link}
                  onChangeText={(text) => updateFormField('link', text)}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setActiveTab('datetime')}
            >
              <Text style={styles.nextButtonText} maxFontSizeMultiplier={1.3}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab 3: Date & Time */}
        {activeTab === 'datetime' && (
          <View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text, alignSelf: 'center', width: '80%' }]} maxFontSizeMultiplier={1.3}>Meeting Date *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={formatDateForDb(meetingForm.date)}
                  onChange={(e: any) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (y && m && d) {
                      const newDate = new Date(y, m - 1, d);
                      if (!Number.isNaN(newDate.getTime())) {
                        updateFormField('date', newDate);
                      }
                    }
                  }}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 10,
                    border: `1.5px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    minHeight: 38,
                    width: '80%',
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                    alignSelf: 'center',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatDate(meetingForm.date)}
                    </Text>
                  </TouchableOpacity>
                  {(showDatePicker || Platform.OS === 'ios') && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={meetingForm.date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleDateChange}
                        textColor={theme.colors.text}
                        themeVariant={theme.isDark ? 'dark' : 'light'}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.doneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text, alignSelf: 'center', width: '80%' }]} maxFontSizeMultiplier={1.3}>Start Time *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTimeForWebInput(meetingForm.startTime)}
                  onChange={(e: any) => applyWebTimeChange('startTime', e.target.value)}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 10,
                    border: `1.5px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    minHeight: 38,
                    width: '80%',
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                    alignSelf: 'center',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatTimeDisplay(meetingForm.startTime)}
                    </Text>
                  </TouchableOpacity>
                  {(showStartTimePicker || Platform.OS === 'ios') && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={meetingForm.startTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleStartTimeChange}
                        textColor={theme.colors.text}
                        themeVariant={theme.isDark ? 'dark' : 'light'}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                          onPress={() => setShowStartTimePicker(false)}
                        >
                          <Text style={styles.doneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text, alignSelf: 'center', width: '80%' }]} maxFontSizeMultiplier={1.3}>End Time *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTimeForWebInput(meetingForm.endTime)}
                  onChange={(e: any) => applyWebTimeChange('endTime', e.target.value)}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 10,
                    border: `1.5px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                    minHeight: 38,
                    width: '80%',
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                    alignSelf: 'center',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatTimeDisplay(meetingForm.endTime)}
                    </Text>
                  </TouchableOpacity>
                  {(showEndTimePicker || Platform.OS === 'ios') && (
                    <View style={styles.pickerContainer}>
                      <DateTimePicker
                        value={meetingForm.endTime}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleEndTimeChange}
                        textColor={theme.colors.text}
                        themeVariant={theme.isDark ? 'dark' : 'light'}
                      />
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                          onPress={() => setShowEndTimePicker(false)}
                        >
                          <Text style={styles.doneButtonText} maxFontSizeMultiplier={1.3}>Done</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: isSaving ? 0.7 : 1,
                }
              ]}
              onPress={handleSaveMeeting}
              disabled={isSaving}
            >
              <Save size={18} color="#ffffff" />
              <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
                {isSaving ? 'Creating...' : 'Create Meeting'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.replace('/admin/meeting-management');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#e8f5e9' }]}>
              <CheckCircle size={36} color="#2e7d32" />
            </View>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting successfully created
            </Text>
            <Text style={[styles.modalBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Club users will be able to access the meeting from both Home tab and Meeting tab.
            </Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/admin/meeting-management');
              }}
            >
              <Text style={styles.modalButtonText} maxFontSizeMultiplier={1.3}>
                Go to create and manage meeting tab
              </Text>
              <Text style={styles.modalButtonHint} maxFontSizeMultiplier={1.2}>
                If you want to make changes
              </Text>
            </TouchableOpacity>
            <View style={styles.modalTabButtonRow}>
              <TouchableOpacity
                style={[styles.modalTabButton, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace('/(tabs)');
                }}
              >
                <Text style={[styles.modalTabButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Home tab
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalTabButton, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace('/(tabs)/meetings');
                }}
              >
                <Text style={[styles.modalTabButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  Meeting tab
                </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  formField: {
    marginBottom: 18,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 38,
    width: '80%',
    alignSelf: 'center',
  },
  dateTimeButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
    width: '80%',
    alignSelf: 'center',
  },
  dateTimeText: {
    fontSize: 15,
  },
  pickerContainer: {
    marginTop: 8,
  },
  doneButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  compactModeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactModeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  compactModeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 20,
    width: '80%',
    alignSelf: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 20,
    width: '80%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalButtonHint: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  modalTabButtonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  modalTabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

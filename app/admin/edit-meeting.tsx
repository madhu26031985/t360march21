import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  Save,
  Home,
  Users,
  Calendar,
  Settings,
  Shield,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const FOOTER_NAV_ICON_SIZE = 15;

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

function normalizeRouteParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0] && String(value[0]).trim()) return String(value[0]).trim();
  return undefined;
}

export default function EditMeeting() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  /** Web / Expo Router can pass query params as string | string[] */
  const meetingId = normalizeRouteParam(params.meetingId as string | string[] | undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'mode' | 'datetime'>('info');
  const [showUpdateConfirmModal, setShowUpdateConfirmModal] = useState(false);

  const [meetingForm, setMeetingForm] = useState<MeetingForm>({
    title: '',
    date: new Date(),
    number: '',
    startTime: new Date(),
    endTime: new Date(),
    mode: 'in_person',
    location: '',
    link: '',
  });

  const modeOptions = [
    { value: 'in_person', label: 'In Person' },
    { value: 'online', label: 'Online' },
    { value: 'hybrid', label: 'Hybrid' },
  ];

  useEffect(() => {
    loadMeeting();
  }, [meetingId]);

  const loadMeeting = async () => {
    if (!meetingId) {
      Alert.alert('Error', 'Meeting ID not provided');
      router.back();
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        Alert.alert('Error', 'Failed to load meeting');
        router.back();
        return;
      }

      if (data) {
        const meetingDate = new Date(data.meeting_date);
        const startTime = parseTime(data.meeting_start_time);
        const endTime = parseTime(data.meeting_end_time);

        setMeetingForm({
          title: data.meeting_title,
          date: meetingDate,
          number: data.meeting_number || '',
          startTime: startTime,
          endTime: endTime,
          mode: data.meeting_mode,
          location: data.meeting_location || '',
          link: data.meeting_link || '',
        });
      }
    } catch (error) {
      console.error('Error loading meeting:', error);
      Alert.alert('Error', 'An unexpected error occurred');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const parseTime = (timeString: string | null): Date => {
    if (!timeString) return new Date();

    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  /** Local calendar date — avoid `toISOString().split('T')[0]` (UTC) shifting the day for non-UTC users */
  const formatDateForDb = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  /** Postgres `time` — explicit 24h, avoids locale quirks in `toLocaleTimeString` on web */
  const formatTimeForDb = (date: Date) => {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${min}:${s}`;
  };

  const alertWebSafe = (title: string, message?: string, onOk?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
      onOk?.();
      return;
    }
    if (onOk) {
      Alert.alert(title, message || '', [{ text: 'OK', onPress: onOk }]);
    } else {
      Alert.alert(title, message || '');
    }
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

    if (meetingForm.endTime <= meetingForm.startTime) {
      alertWebSafe(
        'Time Error',
        'Looks like the time is incorrect—please update it. The end time must be after the start time.'
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

  const handleUpdateMeeting = async () => {
    if (!validateForm()) return;

    if (!meetingId) {
      alertWebSafe('Error', 'Meeting ID is missing. Go back and open Edit Meeting again.');
      return;
    }

    if (!user?.currentClubId) {
      alertWebSafe('Error', 'No active club selected. Open the app from your club context and try again.');
      return;
    }

    setIsSaving(true);

    try {
      const updateData = {
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
      };

      const { data: updatedRows, error } = await supabase
        .from('app_club_meeting')
        .update(updateData)
        .eq('id', meetingId)
        .select('id');

      if (error) {
        console.error('Error updating meeting:', error);

        const notifySlack = async () => {
          try {
            const { data: profile } = await supabase
              .from('app_user_profiles')
              .select('email, full_name')
              .eq('user_id', user?.id)
              .maybeSingle();

            const { data: club } = await supabase
              .from('clubs')
              .select('name')
              .eq('id', user?.currentClubId)
              .maybeSingle();

            const apiUrl = `${supabaseUrl}/functions/v1/notify-slack-meeting-error`;

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
                clubName: club?.name,
                errorMessage: `Meeting Update Failed: ${error.message || 'Unknown error'}`,
                errorDetails: error,
                meetingData: { ...updateData, meetingId },
              }),
            });
          } catch (notifyError) {
            console.error('Failed to send Slack notification:', notifyError);
          }
        };

        notifySlack();

        if (error.message && error.message.includes('time')) {
          alertWebSafe('Time Error', 'Looks like the time is incorrect—please update it.');
        } else {
          alertWebSafe(
            'Error',
            `Failed to update meeting: ${error.message || 'Unknown error'}${error.code ? ` (code: ${error.code})` : ''}`
          );
        }
        return;
      }

      if (!updatedRows || updatedRows.length === 0) {
        alertWebSafe(
          'Update Failed',
          'No row was updated. This usually means the meeting ID did not match, or your account does not have ExComm/Club Leader permission for this club. Refresh the list and try again.'
        );
        return;
      }

      alertWebSafe('Success', 'Meeting updated successfully', () => router.replace('/admin/meeting-management'));
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      alertWebSafe('Error', `An unexpected error occurred: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmUpdateMeeting = () => {
    if (isSaving) return;
    if (!validateForm()) return;
    setShowUpdateConfirmModal(true);
  };

  const commitUpdateMeeting = () => {
    setShowUpdateConfirmModal(false);
    void handleUpdateMeeting();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const inputSurfaceStyle = {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.pageMain}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit Meeting</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
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
          <View style={styles.notionTabsRow}>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: activeTab === 'info' ? theme.colors.primary : 'transparent',
                  borderColor: activeTab === 'info' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveTab('info')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.notionTabText, { color: activeTab === 'info' ? '#ffffff' : theme.colors.text }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.25}
              >
                Info
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: activeTab === 'mode' ? theme.colors.primary : 'transparent',
                  borderColor: activeTab === 'mode' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveTab('mode')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.notionTabText, { color: activeTab === 'mode' ? '#ffffff' : theme.colors.text }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.25}
              >
                Mode
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: activeTab === 'datetime' ? theme.colors.primary : 'transparent',
                  borderColor: activeTab === 'datetime' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveTab('datetime')}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.notionTabText, { color: activeTab === 'datetime' ? '#ffffff' : theme.colors.text }]}
                numberOfLines={2}
                maxFontSizeMultiplier={1.25}
              >
                Date & time
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

          <View style={styles.notionFormSection}>
        {/* Tab 1: Meeting Info */}
        {activeTab === 'info' && (
          <View>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Title *</Text>
              <TextInput
                style={[styles.textInput, inputSurfaceStyle]}
                placeholder="Enter meeting title"
                placeholderTextColor={theme.colors.textSecondary}
                value={meetingForm.title}
                onChangeText={(text) => updateFormField('title', text)}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Number *</Text>
              <TextInput
                style={[styles.textInput, inputSurfaceStyle]}
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
                        backgroundColor: meetingForm.mode === option.value ? theme.colors.primary : theme.colors.background,
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
                  style={[styles.textInput, inputSurfaceStyle]}
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
                  style={[styles.textInput, inputSurfaceStyle]}
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
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Date *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={meetingForm.date.toISOString().split('T')[0]}
                  onChange={(e: any) => {
                    const newDate = new Date(e.target.value);
                    if (!isNaN(newDate.getTime())) {
                      updateFormField('date', newDate);
                    }
                  }}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 0,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    minHeight: 40,
                    width: '100%',
                    boxSizing: 'border-box' as const,
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, inputSurfaceStyle]}
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
                        themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
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
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Start Time *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTime(meetingForm.startTime)}
                  onChange={(e: any) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newTime = new Date();
                    newTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                    updateFormField('startTime', newTime);
                  }}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 0,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    minHeight: 40,
                    width: '100%',
                    boxSizing: 'border-box' as const,
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, inputSurfaceStyle]}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatTime(meetingForm.startTime)}
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
                        themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
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
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>End Time *</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={formatTime(meetingForm.endTime)}
                  onChange={(e: any) => {
                    const [hours, minutes] = e.target.value.split(':');
                    const newTime = new Date();
                    newTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));
                    updateFormField('endTime', newTime);
                  }}
                  style={{
                    fontSize: 15,
                    padding: 10,
                    borderRadius: 0,
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    minHeight: 40,
                    width: '100%',
                    boxSizing: 'border-box' as const,
                    fontWeight: '400',
                    fontFamily: 'system-ui',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateTimeButton, inputSurfaceStyle]}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={[styles.dateTimeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {formatTime(meetingForm.endTime)}
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
                        themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
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
              onPress={confirmUpdateMeeting}
              disabled={isSaving}
            >
              <Save size={18} color="#ffffff" />
              <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
                {isSaving ? 'Updating...' : 'Update Meeting'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
          </View>
        </View>

        <View style={styles.bottomSpacing} />
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
                <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
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
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
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
                  <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
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
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Settings
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={showUpdateConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setShowUpdateConfirmModal(false)}
      >
        <View style={styles.updateConfirmOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !isSaving && setShowUpdateConfirmModal(false)}
          />
          <View style={[styles.updateConfirmCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.updateConfirmIconWrap, { backgroundColor: '#e3f2fd' }]}>
              <Save size={32} color={theme.colors.primary} />
            </View>
            <Text style={[styles.updateConfirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Update meeting?
            </Text>
            <Text style={[styles.updateConfirmBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to update this meeting? Your changes will be saved for all members.
            </Text>
            <View style={styles.updateConfirmActions}>
              <TouchableOpacity
                style={[styles.updateConfirmCancelBtn, { borderColor: theme.colors.border }]}
                onPress={() => !isSaving && setShowUpdateConfirmModal(false)}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={[styles.updateConfirmCancelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.updateConfirmOkBtn, { backgroundColor: theme.colors.primary }]}
                onPress={commitUpdateMeeting}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                <Text style={styles.updateConfirmOkText} maxFontSizeMultiplier={1.3}>
                  Update Meeting
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
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  notionTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  notionTabText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  notionHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  notionFormSection: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 44,
    width: '100%',
    alignSelf: 'stretch',
  },
  dateTimeButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
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
    borderRadius: 0,
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
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 0,
    paddingVertical: 16,
    marginTop: 20,
    width: '100%',
    alignSelf: 'stretch',
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
    borderRadius: 0,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 16,
  },
  updateConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  updateConfirmCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 0,
    padding: 28,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  updateConfirmIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  updateConfirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  updateConfirmBody: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  updateConfirmActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  updateConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateConfirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  updateConfirmOkBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateConfirmOkText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

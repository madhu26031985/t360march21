import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, X } from 'lucide-react-native';

interface ThemeForm {
  theme: string;
  summary: string;
}

interface ToastmasterMeetingData {
  id: string;
  meeting_id: string;
  club_id: string;
  toastmaster_user_id: string;
  personal_notes: string | null;
  theme_of_the_day: string | null;
  theme_summary: string | null;
  created_at: string;
  updated_at: string;
}

export default function ToastmasterThemeFormScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = params.meetingId as string;
  const clubId = params.clubId as string;

  const [themeForm, setThemeForm] = useState<ThemeForm>({
    theme: '',
    summary: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastmasterMeetingData, setToastmasterMeetingData] = useState<ToastmasterMeetingData | null>(null);

  useEffect(() => {
    loadToastmasterMeetingData();
  }, []);

  const loadToastmasterMeetingData = async () => {
    if (!user?.id || !meetingId) return;

    try {
      const { data, error } = await supabase
        .from('toastmaster_meeting_data')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (error) throw error;

      setToastmasterMeetingData(data);

      if (data) {
        setThemeForm({
          theme: data.theme_of_the_day || '',
          summary: data.theme_summary || '',
        });
      }
    } catch (error) {
      console.error('Error loading toastmaster meeting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormField = (field: keyof ThemeForm, value: string) => {
    setThemeForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveTheme = async () => {
    if (!user?.id || !meetingId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    const charCount = themeForm.summary.trim().length;
    if (charCount > 600) {
      Alert.alert('Validation Error', `Theme Summary must not exceed 600 characters. Current count: ${charCount} characters.`);
      return;
    }

    setIsSaving(true);
    try {
      if (toastmasterMeetingData?.id) {
        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .update({
            theme_of_the_day: themeForm.theme.trim() || null,
            theme_summary: themeForm.summary.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', toastmasterMeetingData.id);

        if (error) throw error;
        Alert.alert('Success', 'Theme updated successfully');
      } else {
        const { data: meetingRoleData } = await supabase
          .from('app_meeting_roles')
          .select('user_id')
          .eq('meeting_id', meetingId)
          .eq('role_classification', 'toastmaster')
          .maybeSingle();

        const dataToSave = {
          meeting_id: meetingId,
          club_id: clubId,
          toastmaster_user_id: meetingRoleData?.user_id || user.id,
          theme_of_the_day: themeForm.theme.trim() || null,
          theme_summary: themeForm.summary.trim() || null,
        };

        const { error } = await supabase
          .from('toastmaster_meeting_data')
          .insert([dataToSave]);

        if (error) throw error;
        Alert.alert('Success', 'Theme added successfully');
      }

      router.back();
    } catch (error) {
      console.error('Error saving theme:', error);
      Alert.alert('Error', 'Failed to save theme. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {toastmasterMeetingData ? 'Edit Theme' : 'Add Theme'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {toastmasterMeetingData?.theme_of_the_day || toastmasterMeetingData?.theme_summary ? 'Edit Theme' : 'Add Theme of the Day'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Theme of the Day</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  paddingRight: themeForm.theme ? 40 : 16,
                }
              ]}
              placeholder="Theme (e.g., Innovation)"
              placeholderTextColor={theme.dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              value={themeForm.theme}
              onChangeText={(text) => updateFormField('theme', text)}
              autoCapitalize="words"
            />
            {themeForm.theme.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => updateFormField('theme', '')}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.formField}>
          <View style={styles.summaryHeader}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Theme Summary</Text>
            <Text
              style={[
                styles.wordCount,
                {
                  color: themeForm.summary.length > 600
                    ? '#dc2626'
                    : theme.colors.textSecondary
                }
              ]}
              maxFontSizeMultiplier={1.3}
            >
              {themeForm.summary.length}/600
            </Text>
          </View>
          <Text style={[styles.wordCountHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Maximum 600 characters
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textAreaInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  paddingRight: themeForm.summary ? 40 : 16,
                }
              ]}
              placeholder="Briefly describe the theme and its link to today's meeting."
              placeholderTextColor={theme.dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              value={themeForm.summary}
              onChangeText={(text) => {
                if (text.length <= 600) {
                  updateFormField('summary', text);
                }
              }}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={600}
            />
            {themeForm.summary.length > 0 && (
              <TouchableOpacity
                style={[styles.clearButton, styles.clearButtonMultiline]}
                onPress={() => updateFormField('summary', '')}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: isSaving ? 0.7 : 1,
            }
          ]}
          onPress={handleSaveTheme}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
          <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
            {isSaving ? 'Saving...' : (toastmasterMeetingData?.theme_of_the_day || toastmasterMeetingData?.theme_summary ? 'Update Theme' : 'Save Theme')}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
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
  headerSpacer: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  wordCountHint: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 180,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  clearButtonMultiline: {
    top: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, X } from 'lucide-react-native';

export default function KeynoteSpeakerForm(): JSX.Element {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const initialTitle = typeof params.speechTitle === 'string' ? params.speechTitle : params.speechTitle?.[0] || '';
  const initialSummary = typeof params.summary === 'string' ? params.summary : params.summary?.[0] || '';

  const [speechTitle, setSpeechTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [isSaving, setIsSaving] = useState(false);

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleClearField = async (field: 'title' | 'summary'): Promise<void> => {
    if (!meetingId || !user?.currentClubId || !user?.id) {
      return;
    }

    try {
      const { data: existingRecord, error: checkError } = await supabase
        .from('app_meeting_keynote_speaker')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing keynote speaker record:', checkError);
        return;
      }

      if (existingRecord) {
        const updateData = field === 'title'
          ? { speech_title: null, updated_at: new Date().toISOString() }
          : { summary: null, updated_at: new Date().toISOString() };

        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
          .update(updateData)
          .eq('id', existingRecord.id);

        if (error) {
          console.error('Error clearing field:', error);
          Alert.alert('Error', 'Failed to clear field');
          return;
        }

        if (field === 'title') {
          setSpeechTitle('');
        } else {
          setSummary('');
        }
      } else {
        if (field === 'title') {
          setSpeechTitle('');
        } else {
          setSummary('');
        }
      }
    } catch (error) {
      console.error('Error clearing field:', error);
    }
  };

  const handleSave = async (): Promise<void> => {
    const trimmedTitle = speechTitle.trim();
    const trimmedSummary = summary.trim();

    if (summary.length > 2500) {
      Alert.alert('Error', 'Summary cannot exceed 500 words (approx. 2500 characters)');
      return;
    }

    setIsSaving(true);

    try {
      if (!meetingId || !user?.currentClubId || !user?.id) {
        Alert.alert('Error', 'Missing required information');
        setIsSaving(false);
        return;
      }

      const saveData = {
        speech_title: trimmedTitle || null,
        summary: trimmedSummary || null,
        updated_at: new Date().toISOString(),
      };

      const { data: existingRecord, error: checkError } = await supabase
        .from('app_meeting_keynote_speaker')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('speaker_user_id', user.id)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing keynote speaker record:', checkError);
        Alert.alert('Error', 'Failed to check existing record');
        setIsSaving(false);
        return;
      }

      // If both fields are empty and no existing record AND no initial data, nothing to save
      const hadInitialData = initialTitle || initialSummary;
      if (!existingRecord && !trimmedTitle && !trimmedSummary && !hadInitialData) {
        Alert.alert('Info', 'Please enter a title or summary to save');
        setIsSaving(false);
        return;
      }

      if (existingRecord) {
        // Update existing record (allows clearing data by setting to null)
        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
          .update(saveData)
          .eq('id', existingRecord.id);

        if (error) {
          console.error('Error updating keynote content:', error);
          Alert.alert('Error', 'Failed to update keynote content');
          setIsSaving(false);
          return;
        }
      } else if (trimmedTitle || trimmedSummary) {
        // Create new record only if there's actual content
        const { error } = await supabase
          .from('app_meeting_keynote_speaker')
          .insert({
            meeting_id: meetingId,
            club_id: user.currentClubId,
            speaker_user_id: user.id,
            ...saveData,
            created_at: new Date().toISOString(),
            is_completed: false,
          });

        if (error) {
          console.error('Error creating keynote content:', error);
          Alert.alert('Error', 'Failed to save keynote content');
          setIsSaving(false);
          return;
        }
      }
      // If no existing record and both empty, just show success (user cleared unsaved data)

      const message = (!trimmedTitle && !trimmedSummary)
        ? 'Keynote content cleared successfully'
        : 'Keynote content saved successfully';

      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error saving keynote content:', error);
      Alert.alert('Error', 'Failed to save keynote content');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {initialTitle || initialSummary ? 'Edit Keynote Content' : 'Add Keynote Content'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formField}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Keynote Speech Title
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  paddingRight: speechTitle.length > 0 ? 40 : 16,
                },
              ]}
              placeholder="Enter your keynote speech title"
              placeholderTextColor={theme.dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              value={speechTitle}
              onChangeText={setSpeechTitle}
              autoCapitalize="words"
            />
            {speechTitle.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => handleClearField('title')}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.formField}>
          <View style={styles.detailsHeader}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Summary</Text>
            <Text style={[styles.wordCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {summary.trim().length}/600 chars
            </Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.detailsTextInput,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                  paddingRight: summary.length > 0 ? 40 : 16,
                },
              ]}
              placeholder="Include key learning points, practical applications, and how members can benefit from this keynote content."
              placeholderTextColor={theme.dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              value={summary}
              onChangeText={(text) => {
                const wordCount = countWords(text);
                if (wordCount <= 500) {
                  setSummary(text);
                }
              }}
              multiline
              numberOfLines={10}
              textAlignVertical="top"
            />
            {summary.length > 0 && (
              <TouchableOpacity
                style={[styles.clearButton, styles.clearButtonMultiline]}
                onPress={() => handleClearField('summary')}
              >
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.fieldNote, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Maximum 500 words (approx. 2500 characters)
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: isSaving ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
          <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
            {isSaving ? 'Saving...' : initialTitle || initialSummary ? 'Update Content' : 'Save Content'}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  wordCount: {
    fontSize: 14,
    fontWeight: '500',
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
  detailsTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 180,
    lineHeight: 22,
  },
  fieldNote: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  bottomSpacing: {
    height: 40,
  },
});

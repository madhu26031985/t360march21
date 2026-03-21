import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, X, Save } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUESTION_UPDATE_KEY = '@table_topic_question_update';

export default function TableTopicQuestionEdit() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const slotIndex = parseInt(params.slotIndex as string);
  const initialText = (params.questionText as string) || '';
  const meetingId = params.meetingId as string;

  const [questionText, setQuestionText] = useState<string>(initialText);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSave = async () => {
    if (!questionText.trim()) {
      Alert.alert('Empty Question', 'Please enter a question before saving.');
      return;
    }
    setIsSaving(true);
    try {
      await AsyncStorage.setItem(QUESTION_UPDATE_KEY, JSON.stringify({
        slotIndex,
        questionText: questionText.trim(),
        timestamp: Date.now()
      }));
      router.back();
    } catch (error) {
      setIsSaving(false);
      Alert.alert('Error', 'Failed to save question. Please try again.');
    }
  };

  const handleClear = () => {
    setQuestionText('');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {initialText ? 'Edit Question' : 'Add Question'}
        </Text>
        <TouchableOpacity
          style={[styles.saveHeaderButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveHeaderButtonText} maxFontSizeMultiplier={1.3}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.inputCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.inputCardHeader}>
            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              QUESTION
            </Text>
            {questionText.length > 0 && (
              <TouchableOpacity style={[styles.clearButton, { backgroundColor: '#FEE2E2' }]} onPress={handleClear}>
                <X size={14} color="#EF4444" />
                <Text style={styles.clearButtonText} maxFontSizeMultiplier={1.3}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.textInput, { color: theme.colors.text }]}
            placeholder="Write an engaging table topic question..."
            placeholderTextColor={theme.colors.textSecondary}
            value={questionText}
            onChangeText={(text) => {
              if (text.length <= 500) setQuestionText(text);
            }}
            multiline
            textAlignVertical="top"
            maxLength={500}
            autoFocus
          />
          <Text style={[styles.charCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {questionText.length} / 500
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Save size={18} color="#ffffff" />
              <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>Save Question</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={handleBack}
        >
          <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
        </TouchableOpacity>
      </View>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  inputCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    fontSize: 15,
    lineHeight: 24,
    minHeight: 180,
    padding: 0,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 10,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

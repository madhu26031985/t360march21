import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Youtube, Save } from 'lucide-react-native';

export default function AddYoutubeResource() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a resource title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a resource description');
      return;
    }

    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a YouTube URL');
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      Alert.alert('Error', 'Please enter a valid YouTube URL');
      return;
    }

    if (!user?.currentClubId) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('resources')
        .insert({
          club_id: user.currentClubId,
          title: title.trim(),
          description: description.trim(),
          resource_type: 'youtube',
          url: url.trim(),
          file_data: null,
          created_by: user.id,
        } as any);

      if (error) {
        console.error('Error creating resource:', error);
        Alert.alert('Error', 'Failed to create resource');
        return;
      }

      Alert.alert(
        'Success',
        'YouTube resource added successfully.\n\nMembers will be able to see the video in Club → Club Resources.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/admin/club-operations'),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving resource:', error);
      Alert.alert('Error', 'An unexpected error occurred');
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Add YouTube Video</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.typeHeader, { backgroundColor: '#ff0000' + '15' }]}>
          <View style={[styles.typeIcon, { backgroundColor: '#ff0000' }]}>
            <Youtube size={32} color="#ffffff" />
          </View>
          <Text style={[styles.typeLabel, { color: '#ff0000' }]} maxFontSizeMultiplier={1.3}>YouTube Video</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Resource Title *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Enter resource title"
              placeholderTextColor={theme.colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Description *</Text>
            <TextInput
              style={[styles.textAreaInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="Enter resource description"
              placeholderTextColor={theme.colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>YouTube URL *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor={theme.colors.textSecondary}
              value={url}
              onChangeText={setUrl}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Save size={20} color="#ffffff" />
            <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
              {isSaving ? 'Saving...' : 'Add Resource'}
            </Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
  },
  typeHeader: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  typeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
});

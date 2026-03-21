import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Save } from 'lucide-react-native';

export default function AddEvaluationResource() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [pathwayName, setPathwayName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [levelNumber, setLevelNumber] = useState('');
  const [url, setUrl] = useState('');


  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please provide an evaluation link');
      return;
    }

    if (url.trim()) {
      try {
        new URL(url.trim());
      } catch {
        Alert.alert('Error', 'Please enter a valid URL');
        return;
      }
    }

    if (!user?.currentClubId) return;

    setIsSaving(true);

    try {
      // Generate title and description from pathway/project info
      let generatedTitle = 'Evaluation Form';
      let generatedDescription = 'Evaluation form resource';

      if (pathwayName.trim() || projectName.trim()) {
        const parts = [];
        if (pathwayName.trim()) parts.push(pathwayName.trim());
        if (projectName.trim()) parts.push(projectName.trim());
        if (levelNumber.trim()) parts.push(`Level ${levelNumber.trim()}`);
        if (projectNumber.trim()) parts.push(`Project ${projectNumber.trim()}`);

        generatedTitle = parts.join(' - ') || 'Evaluation Form';
        generatedDescription = `Evaluation form for ${parts.join(', ')}`;
      }

      const { error } = await supabase
        .from('resources')
        .insert({
          club_id: user.currentClubId,
          title: generatedTitle,
          description: generatedDescription,
          pathway_name: pathwayName.trim() || null,
          project_name: projectName.trim() || null,
          project_number: projectNumber.trim() ? parseInt(projectNumber.trim()) : null,
          level_number: levelNumber.trim() ? parseInt(levelNumber.trim()) : null,
          resource_type: 'evaluation_form',
          url: url.trim(),
          file_data: null,
          created_by: user.id,
        } as any);

      if (error) {
        console.error('Error creating resource:', error);
        Alert.alert('Error', `Failed to create resource: ${error.message || JSON.stringify(error)}`);
        return;
      }

      Alert.alert(
        'Success',
        'Evaluation form added successfully.\n\nMembers will be able to see the file in Club → Club Resources.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/admin/club-operations'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving resource:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message || String(error)}`);
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Add Evaluation Form</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.typeHeader, { backgroundColor: '#f59e0b' + '15' }]}>
          <View style={[styles.typeIcon, { backgroundColor: '#f59e0b' }]}>
            <FileText size={32} color="#ffffff" />
          </View>
          <Text style={[styles.typeLabel, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>Evaluation Form</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Pathway Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="e.g., Engaging Humor"
              placeholderTextColor={theme.colors.textSecondary}
              value={pathwayName}
              onChangeText={setPathwayName}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Project Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="e.g., Ice Breaker"
              placeholderTextColor={theme.colors.textSecondary}
              value={projectName}
              onChangeText={setProjectName}
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Project Number</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="e.g., 1"
              placeholderTextColor={theme.colors.textSecondary}
              value={projectNumber}
              onChangeText={setProjectNumber}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Level Number</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="e.g., 1"
              placeholderTextColor={theme.colors.textSecondary}
              value={levelNumber}
              onChangeText={setLevelNumber}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Evaluation Link *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
              placeholder="https://example.com/evaluation.pdf"
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

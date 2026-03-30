import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Youtube, BookOpen, FileText, Save } from 'lucide-react-native';

interface Resource {
  id: string;
  title: string;
  resource_type: string;
  url: string | null;
  file_data: string | null;
}

export default function EditResource() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resource, setResource] = useState<Resource | null>(null);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    loadResource();
  }, [id]);

  const loadResource = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error loading resource:', error);
        Alert.alert('Error', 'Failed to load resource');
        router.back();
        return;
      }

      if (data) {
        const resourceData = data as Resource;
        setResource(resourceData);
        setTitle(resourceData.title);
        setUrl(resourceData.url || '');
      }
    } catch (error) {
      console.error('Error loading resource:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };


  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a resource title');
      return;
    }

    if (resource?.resource_type === 'youtube') {
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
    }

    if ((resource?.resource_type === 'magazine' || resource?.resource_type === 'evaluation_form' || resource?.resource_type === 'other_pdf')) {
      if (!url.trim()) {
        Alert.alert('Error', 'Please provide a resource link');
        return;
      }
      try {
        new URL(url.trim());
      } catch {
        Alert.alert('Error', 'Please enter a valid URL');
        return;
      }
    }

    if (!user?.currentClubId || !id) return;

    setIsSaving(true);

    try {
      const updateData = {
        title: title.trim(),
        url: url.trim(),
        file_data: null as string | null,
      };

      const { error } = await supabase
        .from('resources')
        .update(updateData as any)
        .eq('id', Array.isArray(id) ? id[0] : id);

      if (error) {
        console.error('Error updating resource:', error);
        Alert.alert('Error', `Failed to update resource: ${error.message || JSON.stringify(error)}`);
        return;
      }

      Alert.alert(
        'Success',
        'Resource updated successfully.\n\nMembers will be able to see the updated resource in Club → Club Resources.',
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

  const getResourceIcon = () => {
    switch (resource?.resource_type) {
      case 'youtube':
        return { icon: <Youtube size={32} color="#ffffff" />, color: '#ff0000', label: 'YouTube Video' };
      case 'magazine':
        return { icon: <BookOpen size={32} color="#ffffff" />, color: '#10b981', label: 'Magazine/Article' };
      case 'evaluation_form':
        return { icon: <FileText size={32} color="#ffffff" />, color: '#f59e0b', label: 'Evaluation Form' };
      case 'other_pdf':
        return { icon: <FileText size={32} color="#ffffff" />, color: '#8b5cf6', label: 'Other PDF' };
      default:
        return { icon: <FileText size={32} color="#ffffff" />, color: '#6b7280', label: 'Resource' };
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Loading resource...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const resourceInfo = getResourceIcon();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit Resource</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.typeHeader, { backgroundColor: resourceInfo.color + '15' }]}>
          <View style={[styles.typeIcon, { backgroundColor: resourceInfo.color }]}>
            {resourceInfo.icon}
          </View>
          <Text style={[styles.typeLabel, { color: resourceInfo.color }]} maxFontSizeMultiplier={1.3}>{resourceInfo.label}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Resource Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter resource title"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {resource?.resource_type === 'youtube' ? (
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>YouTube URL *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={url}
                onChangeText={setUrl}
                placeholder="https://www.youtube.com/watch?v=..."
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          ) : (
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Resource Link *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/resource.pdf"
                placeholderTextColor={theme.colors.textSecondary}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: isSaving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Save size={20} color="#ffffff" />
              <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>Update Resource</Text>
            </>
          )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    gap: 16,
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    fontSize: 20,
    fontWeight: '700',
  },
  form: {
    padding: 16,
    gap: 20,
  },
  formField: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

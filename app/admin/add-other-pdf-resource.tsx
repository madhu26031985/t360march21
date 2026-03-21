import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FileText, Save, Upload, Link as LinkIcon, X } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function AddOtherPdfResource() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<{name: string, size: number, uri: string} | null>(null);
  const [inputMode, setInputMode] = useState<'link' | 'upload'>('link');
  const handlePickDocument = async () => {
    try {
      setIsUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        setIsUploading(false);
        return;
      }

      const file = result.assets[0];

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size && file.size > maxSize) {
        Alert.alert('Error', 'File size must be less than 10MB');
        setIsUploading(false);
        return;
      }

      setSelectedFile({
        name: file.name,
        size: file.size || 0,
        uri: file.uri,
      });
      setIsUploading(false);
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a resource title');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a resource description');
      return;
    }

    // Validate based on input mode
    if (inputMode === 'link') {
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
    } else {
      if (!selectedFile) {
        Alert.alert('Error', 'Please select a PDF file to upload');
        return;
      }
    }

    if (!user?.currentClubId) return;

    setIsSaving(true);

    try {
      let pdfUrl = url.trim();
      let fileData = null;

      // If uploading file, upload to Supabase Storage
      if (inputMode === 'upload' && selectedFile) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const fileName = `${timestamp}_${selectedFile.name}`;
          const filePath = `${user.currentClubId}/${fileName}`;

          let fileToUpload: Blob | ArrayBuffer;

          if (Platform.OS === 'web') {
            // Web: Use fetch to get the blob
            const response = await fetch(selectedFile.uri);
            fileToUpload = await response.blob();
          } else {
            // Native: Read file as base64 and convert to ArrayBuffer
            const base64 = await FileSystem.readAsStringAsync(selectedFile.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            // Convert base64 to ArrayBuffer
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            fileToUpload = bytes.buffer;
          }

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('other-pdfs')
            .upload(filePath, fileToUpload, {
              contentType: 'application/pdf',
              upsert: false,
            });

          if (uploadError) {
            console.error('Error uploading file:', uploadError);
            Alert.alert('Error', `Failed to upload file: ${uploadError.message}`);
            setIsSaving(false);
            return;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from('other-pdfs')
            .getPublicUrl(filePath);

          pdfUrl = urlData.publicUrl;
          fileData = null; // Don't store file_data when using storage
        } catch (error) {
          console.error('Error uploading file:', error);
          Alert.alert('Error', 'Failed to upload the selected file');
          setIsSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('resources')
        .insert({
          club_id: user.currentClubId,
          title: title.trim(),
          description: description.trim(),
          resource_type: 'other_pdf',
          url: pdfUrl,
          file_data: fileData,
          created_by: user.id,
        } as any);

      if (error) {
        console.error('Error creating resource:', error);
        Alert.alert('Error', `Failed to create resource: ${error.message || JSON.stringify(error)}`);
        return;
      }

      Alert.alert(
        'Success',
        'PDF resource added successfully.\n\nMembers will be able to see the file in Club → Club Resources.',
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Add Other PDF</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.typeHeader, { backgroundColor: '#8b5cf6' + '15' }]}>
          <View style={[styles.typeIcon, { backgroundColor: '#8b5cf6' }]}>
            <FileText size={32} color="#ffffff" />
          </View>
          <Text style={[styles.typeLabel, { color: '#8b5cf6' }]} maxFontSizeMultiplier={1.3}>Other PDF</Text>
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

          {/* Mode Selector */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Choose Input Method *</Text>
            <View style={styles.modeSelector}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  inputMode === 'link' && styles.modeButtonActive,
                  {
                    backgroundColor: inputMode === 'link' ? theme.colors.primary : theme.colors.surface,
                    borderColor: inputMode === 'link' ? theme.colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => {
                  setInputMode('link');
                  setSelectedFile(null);
                }}
              >
                <LinkIcon size={18} color={inputMode === 'link' ? '#ffffff' : theme.colors.text} />
                <Text style={[
                  styles.modeButtonText,
                  { color: inputMode === 'link' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  Provide Link
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeButton,
                  inputMode === 'upload' && styles.modeButtonActive,
                  {
                    backgroundColor: inputMode === 'upload' ? theme.colors.primary : theme.colors.surface,
                    borderColor: inputMode === 'upload' ? theme.colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => {
                  setInputMode('upload');
                  setUrl('');
                }}
              >
                <Upload size={18} color={inputMode === 'upload' ? '#ffffff' : theme.colors.text} />
                <Text style={[
                  styles.modeButtonText,
                  { color: inputMode === 'upload' ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  Upload PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resource Link Input */}
          {inputMode === 'link' && (
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Resource Link *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="https://example.com/document.pdf"
                placeholderTextColor={theme.colors.textSecondary}
                value={url}
                onChangeText={setUrl}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* PDF Upload */}
          {inputMode === 'upload' && (
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Upload PDF File *</Text>

              {!selectedFile ? (
                <TouchableOpacity
                  style={[styles.uploadButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={handlePickDocument}
                  disabled={isUploading}
                >
                  <Upload size={24} color={theme.colors.primary} />
                  <Text style={[styles.uploadButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {isUploading ? 'Loading...' : 'Choose PDF File'}
                  </Text>
                  <Text style={[styles.uploadButtonHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Max size: 10MB
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.selectedFileCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  <View style={styles.selectedFileInfo}>
                    <View style={[styles.fileIcon, { backgroundColor: '#10b981' + '20' }]}>
                      <FileText size={20} color="#10b981" />
                    </View>
                    <View style={styles.fileDetails}>
                      <Text style={[styles.fileName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                        {selectedFile.name}
                      </Text>
                      <Text style={[styles.fileSize, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {formatFileSize(selectedFile.size)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.removeFileButton, { backgroundColor: '#ef4444' + '20' }]}
                    onPress={handleRemoveFile}
                  >
                    <X size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

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
  modeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  modeButtonActive: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  uploadButtonHint: {
    fontSize: 13,
    marginTop: 4,
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectedFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
  },
  removeFileButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

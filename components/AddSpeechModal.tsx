import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FileText, Save, X } from 'lucide-react-native';

interface SpeechForm {
  title: string;
  document_type: 'google_doc';
  document_url: string;
}

interface AddSpeechModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (speechData: SpeechForm) => Promise<void>;
}

export default function AddSpeechModal({ visible, onClose, onSave }: AddSpeechModalProps) {
  const { theme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [speechForm, setSpeechForm] = useState<SpeechForm>({
    title: '',
    document_type: 'google_doc',
    document_url: '',
  });

  const resetForm = () => {
    setSpeechForm({
      title: '',
      document_type: 'google_doc',
      document_url: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = (): boolean => {
    if (!speechForm.title.trim()) {
      Alert.alert('Error', 'Please enter a speech title');
      return false;
    }

    if (!speechForm.document_url.trim()) {
      Alert.alert('Error', 'Please enter a Google Doc URL');
      return false;
    }
    
    try {
      new URL(speechForm.document_url.trim());
    } catch {
      Alert.alert('Error', 'Please enter a valid Google Doc URL');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await onSave(speechForm);
      resetForm();
    } catch (error) {
      console.error('Error saving speech:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.speechModal, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Add New Speech
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Speech Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter speech title"
                placeholderTextColor={theme.colors.textSecondary}
                value={speechForm.title}
                onChangeText={(text) => setSpeechForm(prev => ({ ...prev, title: text }))}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Doc URL *</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <FileText size={16} color="#4285f4" />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="https://docs.google.com/document/d/..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={speechForm.document_url}
                  onChangeText={(text) => setSpeechForm(prev => ({ ...prev, document_url: text }))}
                  keyboardType="url"
                  autoCapitalize="none"
                />
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
              onPress={handleSave}
              disabled={isSaving}
            >
              <Save size={16} color="#ffffff" />
              <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
                {isSaving ? 'Saving...' : 'Add Speech'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  speechModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
});
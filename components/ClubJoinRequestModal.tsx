import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { X, Phone, FileText } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ClubJoinRequestModalProps {
  visible: boolean;
  clubName: string;
  clubNumber?: string | null;
  onClose: () => void;
  onSubmit: (phoneNumber: string, reason: string) => Promise<void>;
}

export default function ClubJoinRequestModal({
  visible,
  clubName,
  clubNumber,
  onClose,
  onSubmit
}: ClubJoinRequestModalProps) {
  const { theme } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!phoneNumber.trim() || !reason.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(phoneNumber.trim(), reason.trim());
      setPhoneNumber('');
      setReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setPhoneNumber('');
    setReason('');
    onClose();
  };

  const isValid = phoneNumber.trim().length >= 10 && reason.trim().length >= 10;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />

        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Request to Join
              </Text>
              <Text style={[styles.clubName, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                {clubName}
              </Text>
              {clubNumber && (
                <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club #{clubNumber}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Phone Number Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Phone Number <Text style={styles.required} maxFontSizeMultiplier={1.3}>*</Text>
              </Text>
              <View style={[styles.inputContainer, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }]}>
                <Phone size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Enter your phone number"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={15}
                />
              </View>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Include country code (e.g., +1234567890)
              </Text>
            </View>

            {/* Reason Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Why do you want to join? <Text style={styles.required} maxFontSizeMultiplier={1.3}>*</Text>
              </Text>
              <View style={[styles.textAreaContainer, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }]}>
                <FileText size={20} color={theme.colors.textSecondary} style={styles.textAreaIcon} />
                <TextInput
                  style={[styles.textArea, { color: theme.colors.text }]}
                  placeholder="Tell us why you'd like to join this club..."
                  placeholderTextColor={theme.colors.textSecondary}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {reason.length}/500 characters (minimum 10)
              </Text>
            </View>

            {/* Info Box */}
            <View style={[styles.infoBox, {
              backgroundColor: theme.colors.primary + '10',
              borderColor: theme.colors.primary + '30'
            }]}>
              <Text style={[styles.infoTitle, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Important Information
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • Your request will expire after 24 hours if not reviewed
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • You can have a maximum of 2 active requests
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • You can withdraw your request at any time
              </Text>
              <Text style={[styles.infoText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                • If approved, you'll be added as a Guest member
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                { backgroundColor: theme.colors.primary },
                (!isValid || isSubmitting) && styles.buttonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              <Text style={[styles.buttonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  clubNumber: {
    fontSize: 14,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    maxHeight: 500,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  textAreaIcon: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  textArea: {
    fontSize: 16,
    minHeight: 100,
    paddingLeft: 32,
  },
  hint: {
    fontSize: 13,
    marginTop: 6,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  submitButton: {
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

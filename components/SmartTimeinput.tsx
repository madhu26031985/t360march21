import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { Clock } from 'lucide-react-native';

interface SmartTimeInputProps {
  visible: boolean;
  onClose: () => void;
  onTimeSelect: (time: string) => void;
  initialTime?: string;
}

export default function SmartTimeInput({
  visible,
  onClose,
  onTimeSelect,
  initialTime
}: SmartTimeInputProps) {
  const { theme } = useTheme();

  const parseInitialTime = (timeString?: string): Date => {
    const now = new Date();
    if (!timeString) return now;

    const parts = timeString.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      now.setHours(hours, minutes, 0, 0);
    }
    return now;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitialTime(initialTime));
  const [showPicker, setShowPicker] = useState(false);

  React.useEffect(() => {
    if (!visible) return;

    // Keep picker value in sync with latest field value whenever modal opens.
    setSelectedDate(parseInitialTime(initialTime));

    if (Platform.OS === 'android') {
      setShowPicker(true);
    }
  }, [visible, initialTime]);

  const formatTimeToHHMM = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
        onTimeSelect(formatTimeToHHMM(date));
        onClose();
      } else {
        onClose();
      }
    } else {
      if (date) {
        setSelectedDate(date);
      }
    }
  };

  const handleConfirm = () => {
    onTimeSelect(formatTimeToHHMM(selectedDate));
    onClose();
  };

  if (Platform.OS === 'android') {
    return showPicker ? (
      <DateTimePicker
        value={selectedDate}
        mode="time"
        is24Hour={false}
        display="default"
        onChange={handleChange}
      />
    ) : null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
          <View style={[styles.pickerContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Clock size={24} color={theme.colors.primary} />
              </View>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Time</Text>
            </View>

            <View style={styles.pickerWrapper}>
              <DateTimePicker
                value={selectedDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleChange}
                {...(Platform.OS === 'ios' ? { textColor: theme.colors.text } : {})}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.confirmButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText} maxFontSizeMultiplier={1.3}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerIcon: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerWrapper: {
    paddingVertical: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  visible: boolean;
  roleLabel: string;
  action?: 'booked' | 'withdrawn';
  onClose: () => void;
};

export default function PremiumBookingSuccessModal({
  visible,
  roleLabel,
  action = 'booked',
  onClose,
}: Props): JSX.Element {
  const { theme } = useTheme();
  const isWithdrawn = action === 'withdrawn';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '18' }]}>
            <CheckCircle2 size={26} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {isWithdrawn ? 'Withdrawal Confirmed' : 'Booking Confirmed'}
          </Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
            {roleLabel} has been {isWithdrawn ? 'withdrawn' : 'booked'} successfully.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText} maxFontSizeMultiplier={1.3}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    minWidth: 140,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Props = {
  visible: boolean;
  message: string;
  onLater: () => void;
  onOpenAdmin: () => void;
};

export default function ClubProfileIncompleteModal({
  visible,
  message,
  onLater,
  onOpenAdmin,
}: Props) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View
          style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Complete your club profile
          </Text>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
            {message}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.buttonSecondary, { borderColor: theme.colors.border }]}
              onPress={onLater}
              activeOpacity={0.85}
            >
              <Text style={[styles.buttonSecondaryText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                Later
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonPrimary, { backgroundColor: theme.colors.primary }]}
              onPress={onOpenAdmin}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonPrimaryText} maxFontSizeMultiplier={1.2}>
                Open Admin panel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  buttonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

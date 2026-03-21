import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Linking, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect } from 'react';

interface UpdatePromptProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  message?: string;
  storeUrl?: string;
  onDismiss?: () => void;
}

export default function UpdatePrompt({
  visible,
  currentVersion,
  latestVersion,
  forceUpdate,
  message,
  storeUrl,
  onDismiss,
}: UpdatePromptProps) {
  const { theme } = useTheme();

  useEffect(() => {
    console.log('🎭 [UPDATE PROMPT] Component mounted/updated with props:', {
      visible,
      currentVersion,
      latestVersion,
      forceUpdate,
      message,
      storeUrl,
    });
  }, [visible, currentVersion, latestVersion, forceUpdate, message, storeUrl]);

  const handleUpdate = async () => {
    if (!storeUrl) return;

    try {
      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      }
    } catch (error) {
      console.error('Error opening store URL:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={forceUpdate ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.icon}
            resizeMode="contain"
          />

          <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            A Better Experience Awaits
          </Text>

          <View style={styles.versionInfo}>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Current Version:
              </Text>
              <Text style={[styles.versionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {currentVersion}
              </Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Latest Version:
              </Text>
              <Text style={[styles.versionValue, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                {latestVersion}
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: '#3b82f6' }]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText} maxFontSizeMultiplier={1.3}>
                Update Now
              </Text>
            </TouchableOpacity>

            {!forceUpdate && onDismiss && (
              <TouchableOpacity
                style={[styles.dismissButton, { backgroundColor: theme.colors.background }]}
                onPress={onDismiss}
              >
                <Text style={[styles.dismissButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  versionInfo: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  dismissButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

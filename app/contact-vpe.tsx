import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function ContactVpe() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{
    vpeFirstName?: string;
    vpePhone?: string;
    yourFirstName?: string;
    clubName?: string;
  }>();

  const vpeFirstName = (params.vpeFirstName || 'VPE').toString();
  const yourFirstName = (params.yourFirstName || 'Member').toString();
  const clubName = (params.clubName || 'Your Club').toString();

  const message = `Hi ${vpeFirstName} 👋
Hope you're doing well.

Could you please assign me a mentor?

Thanks in advance 😊

${yourFirstName}
${clubName}`;

  const handleSendWhatsapp = async () => {
    try {
      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open WhatsApp', 'Please ensure WhatsApp is installed and try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Contact VPE
        </Text>
        <View style={styles.rightSpacer} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          WhatsApp message preview
        </Text>
        <View style={[styles.messageBox, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Text style={[styles.messageText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
            {message}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSendWhatsapp}
          activeOpacity={0.85}
        >
          <MessageCircle size={18} color="#ffffff" />
          <Text style={styles.sendButtonText} maxFontSizeMultiplier={1.2}>
            Send via WhatsApp
          </Text>
        </TouchableOpacity>
      </View>
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
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  rightSpacer: {
    width: 40,
    height: 40,
  },
  card: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  sendButton: {
    marginTop: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, UserCog, Settings } from 'lucide-react-native';

export default function SAACorner() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>SAA Corner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.heroIcon, { backgroundColor: '#0891b2' + '20' }]}>
            <UserCog size={48} color="#0891b2" />
          </View>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>SAA Corner</Text>
          <Text style={[styles.heroDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Sergeant at Arms - Meeting setup, logistics, and technical support
          </Text>
        </View>

        <View style={[styles.comingSoonCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.comingSoonIcon, { backgroundColor: '#f59e0b' + '20' }]}>
            <Settings size={32} color="#f59e0b" />
          </View>
          <Text style={[styles.comingSoonTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Coming Soon</Text>
          <Text style={[styles.comingSoonDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            The SAA Corner is under development and will include tools for meeting logistics, equipment checklists, and venue management.
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  comingSoonCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 40,
  },
});

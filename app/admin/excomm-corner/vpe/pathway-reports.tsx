import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, TrendingUp, Clock } from 'lucide-react-native';

export default function PathwayReports() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Pathway Reports
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Member pathway progress
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: '#84cc16' + '15' }]}>
          <TrendingUp size={56} color="#84cc16" />
        </View>
        <Text style={[styles.comingSoon, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          Coming Soon
        </Text>
        <View style={[styles.badge, { backgroundColor: theme.colors.surface }]}>
          <Clock size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            This feature is under development
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 8, width: 40 },
  headerContent: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  iconContainer: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoon: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  badgeText: { fontSize: 14, fontWeight: '500' },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrowLeft, Heart } from 'lucide-react-native';

export default function Values() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Our Values</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.valuesHeader}>
            <View style={[styles.valuesIcon, { backgroundColor: '#10b981' + '20' }]}>
              <Heart size={24} color="#10b981" />
            </View>
            <Text style={[styles.valuesTitle, { color: theme.colors.text }]}>Core Values</Text>
          </View>

          <View style={styles.valuesGrid}>
            <View style={styles.valueItem}>
              <View style={[styles.valueBox, { backgroundColor: '#0f4c75' }]}>
                <Text style={styles.valueTitle}>INTEGRITY</Text>
              </View>
            </View>
            <View style={styles.valueItem}>
              <View style={[styles.valueBox, { backgroundColor: '#8b2635' }]}>
                <Text style={styles.valueTitle}>RESPECT</Text>
              </View>
            </View>
            <View style={styles.valueItem}>
              <View style={[styles.valueBox, { backgroundColor: '#9ca3af' }]}>
                <Text style={styles.valueTitle}>SERVICE</Text>
              </View>
            </View>
            <View style={styles.valueItem}>
              <View style={[styles.valueBox, { backgroundColor: '#6b93d6' }]}>
                <Text style={styles.valueTitle}>EXCELLENCE</Text>
              </View>
            </View>
          </View>
        </View>
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
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  valuesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  valuesIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  valuesTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  valuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  valueItem: {
    flex: 1,
    minWidth: '45%',
  },
  valueBox: {
    width: '100%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  valueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

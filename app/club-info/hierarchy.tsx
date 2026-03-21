import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Target } from 'lucide-react-native';

export default function Hierarchy() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [clubData, setClubData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClubData();
  }, []);

  const loadClubData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select('district, division, area, region')
        .eq('club_id', user.currentClubId)
        .single();

      if (data) {
        setClubData(data);
      }
    } catch (error) {
      console.error('Error loading club data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Toastmasters Hierarchy</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Toastmasters Hierarchy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
              <Target size={20} color="#8b5cf6" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Organizational Structure</Text>
          </View>

          <View style={styles.hierarchyGrid}>
            <View style={styles.hierarchyItem}>
              <Text style={[styles.hierarchyLabel, { color: theme.colors.textSecondary }]}>District</Text>
              <Text style={[styles.hierarchyValue, { color: theme.colors.text }]}>
                {clubData?.district || 'Not set'}
              </Text>
            </View>
            <View style={styles.hierarchyItem}>
              <Text style={[styles.hierarchyLabel, { color: theme.colors.textSecondary }]}>Division</Text>
              <Text style={[styles.hierarchyValue, { color: theme.colors.text }]}>
                {clubData?.division || 'Not set'}
              </Text>
            </View>
            <View style={styles.hierarchyItem}>
              <Text style={[styles.hierarchyLabel, { color: theme.colors.textSecondary }]}>Area</Text>
              <Text style={[styles.hierarchyValue, { color: theme.colors.text }]}>
                {clubData?.area || 'Not set'}
              </Text>
            </View>
            <View style={styles.hierarchyItem}>
              <Text style={[styles.hierarchyLabel, { color: theme.colors.textSecondary }]}>Region</Text>
              <Text style={[styles.hierarchyValue, { color: theme.colors.text }]}>
                {clubData?.region || 'Not set'}
              </Text>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  hierarchyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hierarchyItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  hierarchyLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  hierarchyValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

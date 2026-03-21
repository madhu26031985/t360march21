import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Users, Calendar, Building2 } from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_status: string;
}

export default function ManageMeetingRolesPlaceholder() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Placeholder: Load meetings would go here
    setIsLoading(false);
  }, []);

  const handleMeetingPress = (meeting: Meeting) => {
    Alert.alert('Feature Coming Soon', 'Meeting role management will be available in a future update.');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Manage Meeting Roles</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Switcher */}
        <ClubSwitcher showRole={true} />

        {/* Placeholder Content */}
        <View style={[styles.placeholderCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.placeholderIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Users size={32} color={theme.colors.primary} />
          </View>
          <Text style={[styles.placeholderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting Role Management
          </Text>
          <Text style={[styles.placeholderDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            This feature allows ExComm members to manage meeting roles, assign members to roles, and track role completion status.
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Assign members to meeting roles
              </Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Track role completion status
              </Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Manage role availability
              </Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureBullet, { backgroundColor: theme.colors.primary }]} />
              <Text style={[styles.featureText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Filter roles by classification
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.comingSoonButton, { backgroundColor: theme.colors.warning }]}
            onPress={() => Alert.alert('Coming Soon', 'This feature is currently under development and will be available in a future update.')}
          >
            <Calendar size={16} color="#ffffff" />
            <Text style={styles.comingSoonText} maxFontSizeMultiplier={1.3}>Coming Soon</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>What's Coming</Text>
          <Text style={[styles.infoDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            The meeting role management feature will provide comprehensive tools for ExComm members to:
          </Text>
          
          <View style={styles.upcomingFeatures}>
            <Text style={[styles.upcomingFeature, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              • View all meetings with role assignments
            </Text>
            <Text style={[styles.upcomingFeature, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              • Assign and reassign members to specific roles
            </Text>
            <Text style={[styles.upcomingFeature, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              • Mark roles as completed or incomplete
            </Text>
            <Text style={[styles.upcomingFeature, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              • Filter roles by classification and status
            </Text>
            <Text style={[styles.upcomingFeature, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              • Track member participation and performance
            </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
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
  placeholderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  placeholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  placeholderDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresList: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  comingSoonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  comingSoonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
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
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  infoDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  upcomingFeatures: {
    gap: 8,
  },
  upcomingFeature: {
    fontSize: 15,
    lineHeight: 22,
  },
});
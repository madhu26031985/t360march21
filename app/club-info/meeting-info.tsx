import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, Globe, Link } from 'lucide-react-native';

export default function MeetingInfo() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [meetingData, setMeetingData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMeetingData();
  }, []);

  const loadMeetingData = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('club_profiles')
        .select('meeting_day, meeting_frequency, meeting_start_time, meeting_end_time, meeting_type, online_meeting_link, time_zone')
        .eq('club_id', user.currentClubId)
        .single();

      if (data) {
        setMeetingData(data);
      }
    } catch (error) {
      console.error('Error loading meeting data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMeetingType = (type: string | null) => {
    if (!type) return 'Not set';
    switch (type) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return type;
    }
  };

  const formatMeetingFrequency = (frequency: string | null) => {
    if (!frequency) return 'Not set';
    switch (frequency) {
      case 'Bi-weekly': return 'Fortnightly';
      case 'Every 3 weeks': return 'Every 3 weeks';
      default: return frequency;
    }
  };

  const handleMeetingLinkPress = async () => {
    try {
      const url = meetingData?.online_meeting_link;
      if (!url) {
        Alert.alert('Error', 'No meeting link available');
        return;
      }

      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open meeting link');
      }
    } catch (error) {
      console.error('Error opening meeting link:', error);
      Alert.alert('Error', 'Failed to open meeting link');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meeting Information</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Meeting Information</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.meetingSchedule}>
            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: '#3b82f6' + '20' }]}>
                <Calendar size={20} color="#3b82f6" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: theme.colors.textSecondary }]}>When</Text>
                <Text style={[styles.scheduleValue, { color: theme.colors.text }]}>
                  {meetingData?.meeting_day ? `Every ${meetingData.meeting_day}` : 'Not scheduled'}
                </Text>
                <Text style={[styles.scheduleSubtext, { color: theme.colors.textSecondary }]}>
                  {formatMeetingFrequency(meetingData?.meeting_frequency)}
                </Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: '#f59e0b' + '20' }]}>
                <Clock size={20} color="#f59e0b" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: theme.colors.textSecondary }]}>Time</Text>
                <Text style={[styles.scheduleValue, { color: theme.colors.text }]}>
                  {meetingData?.meeting_start_time || 'Not set'}
                  {meetingData?.meeting_end_time && ` - ${meetingData.meeting_end_time}`}
                </Text>
                <Text style={[styles.scheduleSubtext, { color: theme.colors.textSecondary }]}>
                  {meetingData?.time_zone || 'Local time'}
                </Text>
              </View>
            </View>

            <View style={styles.scheduleItem}>
              <View style={[styles.scheduleIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
                <Globe size={20} color="#8b5cf6" />
              </View>
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleLabel, { color: theme.colors.textSecondary }]}>Format</Text>
                <Text style={[styles.scheduleValue, { color: theme.colors.text }]}>
                  {formatMeetingType(meetingData?.meeting_type)}
                </Text>
                <Text style={[styles.scheduleSubtext, { color: theme.colors.textSecondary }]}>
                  {meetingData?.meeting_type === 'online' ? 'Virtual meeting' :
                   meetingData?.meeting_type === 'hybrid' ? 'In-person & virtual' : 'Physical meeting'}
                </Text>
              </View>
            </View>
          </View>

          {(meetingData?.meeting_type === 'online' || meetingData?.meeting_type === 'hybrid') && meetingData?.online_meeting_link && (
            <TouchableOpacity
              style={[styles.joinMeetingButton, { backgroundColor: '#10b981' }]}
              onPress={handleMeetingLinkPress}
            >
              <Link size={18} color="#ffffff" />
              <Text style={styles.joinMeetingText}>Join Online Meeting</Text>
            </TouchableOpacity>
          )}
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
  meetingSchedule: {
    gap: 20,
    marginBottom: 24,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scheduleValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  scheduleSubtext: {
    fontSize: 14,
    fontWeight: '500',
  },
  joinMeetingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  joinMeetingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
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

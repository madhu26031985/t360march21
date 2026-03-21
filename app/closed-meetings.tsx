import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Lock, Calendar, Clock, MapPin, ChevronRight } from 'lucide-react-native';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_location: string | null;
  meeting_link: string | null;
  meeting_status: string;
  meeting_day: string | null;
}

export default function ClosedMeetings() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClosedMeetings();
  }, []);

  const loadClosedMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'close')
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading closed meetings:', error);
        Alert.alert('Error', `Failed to load closed meetings: ${error.message}`);
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading closed meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading closed meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMeetingPress = (meeting: Meeting) => {
    router.push(`/meeting-details?meetingId=${meeting.id}`);
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
    <TouchableOpacity
      style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleMeetingPress(meeting)}
      activeOpacity={0.7}
    >
      <View style={styles.meetingHeader}>
        <View style={[styles.meetingIcon, { backgroundColor: '#6b7280' + '20' }]}>
          <Lock size={24} color="#6b7280" />
        </View>
        <View style={styles.meetingCardInfo}>
          <Text style={[styles.meetingCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {meeting.meeting_title}
          </Text>
          <View style={styles.meetingCardMeta}>
            <View style={styles.meetingCardDate}>
              <Calendar size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.meetingCardDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString()}
              </Text>
            </View>
            {meeting.meeting_number && (
              <Text style={[styles.meetingCardNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                #{meeting.meeting_number}
              </Text>
            )}
            <View style={[styles.statusBadge, { backgroundColor: '#6b7280' + '20' }]}>
              <Text style={[styles.statusText, { color: '#6b7280' }]} maxFontSizeMultiplier={1.3}>Closed</Text>
            </View>
          </View>
          {meeting.meeting_start_time && (
            <View style={styles.meetingCardTime}>
              <Clock size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.meetingCardTimeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_start_time}
                {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
              </Text>
            </View>
          )}
          <View style={styles.meetingCardMode}>
            <MapPin size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingCardModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {formatMeetingMode(meeting.meeting_mode)}
            </Text>
          </View>

          {meeting.meeting_day && (
            <View style={styles.meetingCardDay}>
              <Calendar size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.meetingCardDayText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_day}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.meetingCardArrow}>
          <ChevronRight size={20} color={theme.colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Closed Meetings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading closed meetings...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Closed Meetings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.meetingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Closed Meetings ({meetings.length})
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Completed meetings that have been closed
          </Text>

          {meetings.length > 0 ? (
            <View style={styles.meetingsList}>
              {meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </View>
          ) : (
            <View style={styles.noMeetingsState}>
              <Lock size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No Closed Meetings
              </Text>
              <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                There are no closed meetings to display
              </Text>
            </View>
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
  meetingsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  meetingsList: {
    gap: 12,
  },
  meetingCard: {
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meetingCardInfo: {
    flex: 1,
  },
  meetingCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  meetingCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  meetingCardDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingCardDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  meetingCardNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  meetingCardTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingCardTimeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingCardMode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingCardModeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingCardDay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingCardDayText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingCardArrow: {
    marginLeft: 12,
  },
  noMeetingsState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noMeetingsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noMeetingsSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

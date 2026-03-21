import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Clock, Calendar, MapPin, ChevronRight, FileText, Timer, ChartBar as BarChart3, BookOpen, Star, MessageSquare, ClipboardCheck, UserCheck, Award, Book, MessageCircle } from 'lucide-react-native';

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

interface TabItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  route?: string;
  comingSoon?: boolean;
}

export default function OpenMeetings() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  useEffect(() => {
    loadOpenMeetings();
  }, []);

  const loadOpenMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const thirtysixHoursAgo = new Date();
      thirtysixHoursAgo.setHours(thirtysixHoursAgo.getHours() - 36);
      const cutoffDate = thirtysixHoursAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'open')
        .gte('meeting_date', cutoffDate)
        .order('meeting_date', { ascending: true });

      if (error) {
        console.error('Error loading open meetings:', error);
        Alert.alert('Error', `Failed to load open meetings: ${error.message}`);
        return;
      }

      const now = new Date();
      const filteredMeetings = (data || []).filter(meeting => {
        const meetingEndDateTime = new Date(`${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`);
        const hoursSinceMeetingEnd = (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
        return hoursSinceMeetingEnd < 36;
      });

      setMeetings(filteredMeetings);
    } catch (error) {
      console.error('Error loading open meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading open meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMeetingPress = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
  };

  const handleBackToList = () => {
    setSelectedMeeting(null);
  };

  const handleTabPress = (tab: TabItem, meetingId: string) => {
    if (tab.route) {
      const routeWithId = tab.route.replace('meetingId=undefined', `meetingId=${meetingId}`);
      router.push(routeWithId);
      return;
    }

    if (tab.comingSoon) {
      Alert.alert('Coming Soon', `${tab.title} will be available in a future update.`);
      return;
    }

    if (tab.id === 'overview') {
      router.push(`/quick-overview?meetingId=${meetingId}`);
      return;
    }
  };

  const getTabsForMeeting = (meetingId: string): TabItem[] => [
    {
      id: 'overview',
      title: 'Quick Overview',
      icon: <FileText size={18} color="#ffffff" />,
      color: '#3b82f6'
    },
    {
      id: 'agenda',
      title: 'Meeting Agenda',
      icon: <FileText size={18} color="#ffffff" />,
      color: '#10b981',
      route: `/meeting-agenda-view?meetingId=${meetingId}`
    },
    {
      id: 'timer',
      title: 'Timer',
      icon: <Timer size={18} color="#ffffff" />,
      color: '#f59e0b',
      route: `/timer-report-details?meetingId=${meetingId}`
    },
    {
      id: 'ah_counter',
      title: 'Ah Counter',
      icon: <BarChart3 size={18} color="#ffffff" />,
      color: '#06b6d4',
      route: `/ah-counter-corner?meetingId=${meetingId}`
    },
    {
      id: 'grammarian',
      title: 'Grammarian',
      icon: <BookOpen size={18} color="#ffffff" />,
      color: '#8b5cf6',
      route: `/grammarian?meetingId=${meetingId}`
    },
    {
      id: 'general_evaluator',
      title: 'General Evaluator Report',
      icon: <Star size={18} color="#ffffff" />,
      color: '#ef4444',
      route: `/general-evaluator-report?meetingId=${meetingId}`
    },
    {
      id: 'toastmaster_corner',
      title: 'Toastmaster Corner',
      icon: <MessageSquare size={18} color="#ffffff" />,
      color: '#84cc16',
      route: `/toastmaster-corner?meetingId=${meetingId}`
    },
    {
      id: 'table_topic_corner',
      title: 'Table Topic Corner',
      icon: <MessageSquare size={18} color="#ffffff" />,
      color: '#f97316',
      route: `/table-topic-corner?meetingId=${meetingId}`,
      comingSoon: false
    },
    {
      id: 'role_completion',
      title: 'Role Completion Report',
      icon: <ClipboardCheck size={18} color="#ffffff" />,
      color: '#6366f1',
      route: `/role-completion-report?meetingId=${meetingId}`
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      icon: <UserCheck size={18} color="#ffffff" />,
      color: '#ec4899',
      route: `/attendance-report?meetingId=${meetingId}`
    },
    {
      id: 'evaluation_corner',
      title: 'Prepared Speaker',
      icon: <Award size={18} color="#ffffff" />,
      color: '#14b8a6',
      route: `/evaluation-corner?meetingId=${meetingId}`
    },
    {
      id: 'educational_corner',
      title: 'Educational Corner',
      icon: <Book size={18} color="#ffffff" />,
      color: '#f97316',
      route: `/educational-corner?meetingId=${meetingId}`
    },
    {
      id: 'feedback_corner',
      title: 'Feedback Corner',
      icon: <MessageCircle size={18} color="#ffffff" />,
      color: '#a855f7',
      route: `/feedback-corner?meetingId=${meetingId}`
    }
  ];

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
        <View style={[styles.meetingIcon, { backgroundColor: '#10b981' + '20' }]}>
          <Clock size={24} color="#10b981" />
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
            <View style={[styles.statusBadge, { backgroundColor: '#10b981' + '20' }]}>
              <Text style={[styles.statusText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>Open</Text>
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Open Meetings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading open meetings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedMeeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Open Meetings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.meetingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Open Meetings ({meetings.length})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Currently active meetings where members can participate
            </Text>

            {meetings.length > 0 ? (
              <View style={styles.meetingsList}>
                {meetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </View>
            ) : (
              <View style={styles.noMeetingsState}>
                <Clock size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Open Meetings
                </Text>
                <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  There are currently no open meetings available
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tabs = getTabsForMeeting(selectedMeeting.id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToList}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {selectedMeeting.meeting_title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.meetingHeaderCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.meetingHeaderContent}>
            <View style={[styles.meetingHeaderIcon, { backgroundColor: '#10b981' + '20' }]}>
              <Calendar size={24} color="#10b981" />
            </View>
            <View style={styles.meetingHeaderInfo}>
              <Text style={[styles.meetingHeaderTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {selectedMeeting.meeting_title}
              </Text>
              <View style={styles.meetingHeaderMeta}>
                <Text style={[styles.meetingHeaderDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {new Date(selectedMeeting.meeting_date).toLocaleDateString()}
                </Text>
                {selectedMeeting.meeting_number && (
                  <Text style={[styles.meetingHeaderNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    #{selectedMeeting.meeting_number}
                  </Text>
                )}
                <View style={[styles.meetingHeaderStatus, { backgroundColor: '#10b981' + '20' }]}>
                  <Text style={[styles.meetingHeaderStatusText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                    Open
                  </Text>
                </View>
              </View>
              {selectedMeeting.meeting_start_time && (
                <View style={styles.meetingHeaderTimeRow}>
                  <Clock size={12} color={theme.colors.textSecondary} />
                  <Text style={[styles.meetingHeaderTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {selectedMeeting.meeting_start_time}
                    {selectedMeeting.meeting_end_time && ` - ${selectedMeeting.meeting_end_time}`}
                  </Text>
                </View>
              )}
              <View style={styles.meetingHeaderModeRow}>
                <MapPin size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.meetingHeaderMode, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {formatMeetingMode(selectedMeeting.meeting_mode)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tabsGrid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => handleTabPress(tab, selectedMeeting.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIcon, { backgroundColor: tab.color }]}>
                {tab.icon}
              </View>
              <Text style={[styles.tabTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {tab.title}
              </Text>
              {tab.comingSoon && (
                <View style={[styles.comingSoonBadge, { backgroundColor: '#f59e0b' }]}>
                  <Text style={styles.comingSoonText} maxFontSizeMultiplier={1.3}>Soon</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
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
  meetingHeaderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meetingHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  meetingHeaderInfo: {
    flex: 1,
  },
  meetingHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  meetingHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  meetingHeaderDate: {
    fontSize: 14,
  },
  meetingHeaderNumber: {
    fontSize: 14,
  },
  meetingHeaderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  meetingHeaderStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  meetingHeaderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingHeaderTime: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingHeaderModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingHeaderMode: {
    fontSize: 13,
    marginLeft: 4,
  },
  tabsGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabCard: {
    width: '31%',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 85,
    justifyContent: 'center',
    marginBottom: 4,
  },
  tabIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  tabTitle: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  comingSoonBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#ffffff',
  },
});

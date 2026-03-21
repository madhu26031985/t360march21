import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, FileText, Timer, ChartBar as BarChart3, BookOpen, Star, MessageSquare, Users, ClipboardCheck, UserCheck, Mic, Vote, HelpCircle, Ear, UserPlus, MessageCircleMore, FileCheck, Trophy, UserCircle } from 'lucide-react-native';
import { Award, MessageCircle, Book } from 'lucide-react-native';

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

export default function MeetingDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  const tabs: TabItem[] = [
    {
      id: 'overview',
      title: 'Quick Overview',
      icon: <Building2 size={18} color="#ffffff" />,
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
      title: 'Timer Summary',
      icon: <Timer size={18} color="#ffffff" />,
      color: '#f59e0b',
      route: `/timer-report-details?meetingId=${meetingId}`
    },
    {
      id: 'ah_counter',
      title: 'Ah Counter Summary',
      icon: <BarChart3 size={18} color="#ffffff" />,
      color: '#06b6d4',
      route: `/ah-counter-corner?meetingId=${meetingId}`
    },
    {
      id: 'grammarian',
      title: 'Grammarian Summary',
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
    },
    {
      id: 'keynote_speaker',
      title: 'Keynote Speaker',
      icon: <Mic size={18} color="#ffffff" />,
      color: '#f59e0b',
      route: `/keynote-speaker-corner?meetingId=${meetingId}`
    },
    {
      id: 'live_voting',
      title: 'Live Voting',
      icon: <Vote size={18} color="#ffffff" />,
      color: '#7c3aed',
      route: `/live-voting?meetingId=${meetingId}`
    },
    {
      id: 'quiz_master',
      title: 'Quiz Master',
      icon: <HelpCircle size={18} color="#ffffff" />,
      color: '#7c3aed',
      comingSoon: true
    },
    {
      id: 'listener',
      title: 'Listener',
      icon: <Ear size={18} color="#ffffff" />,
      color: '#06b6d4',
      comingSoon: true
    },
    {
      id: 'guest_introduce',
      title: 'Guest Introduce',
      icon: <UserPlus size={18} color="#ffffff" />,
      color: '#10b981',
      comingSoon: true
    },
    {
      id: 'table_topics_evaluation',
      title: 'Table Topics Evaluation',
      icon: <MessageCircleMore size={18} color="#ffffff" />,
      color: '#f97316',
      comingSoon: true
    },
    {
      id: 'master_evaluation',
      title: 'Master Evaluation',
      icon: <Trophy size={18} color="#ffffff" />,
      color: '#eab308',
      comingSoon: true
    },
    {
      id: 'meeting_minutes',
      title: 'Meeting Minutes',
      icon: <Book size={18} color="#ffffff" />,
      color: '#6b7280',
      route: `/meeting-minutes?meetingId=${meetingId}`
    }
  ];

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
    }
  }, [meetingId]);

  const loadMeeting = async () => {
    if (!meetingId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        Alert.alert('Error', 'Failed to load meeting details');
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabPress = (tab: TabItem) => {
    if (tab.route) {
      router.push(tab.route);
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
    
    setSelectedTab(tab.id);
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const QuickOverview = () => {
    if (!meeting) return null;

    return (
      <View style={styles.overviewContent}>
        <Text style={[styles.overviewPlaceholder, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
          
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {meeting.meeting_title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Meeting Header Card */}
      <View style={[styles.meetingHeaderCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.meetingHeaderContent}>
          <View style={[styles.meetingIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Calendar size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.meetingHeaderInfo}>
            <Text style={[styles.meetingHeaderTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {meeting.meeting_title}
            </Text>
            <View style={styles.meetingHeaderMeta}>
              <Text style={[styles.meetingHeaderDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString()}
              </Text>
              {meeting.meeting_number && (
                <Text style={[styles.meetingHeaderNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  #{meeting.meeting_number}
                </Text>
              )}
              <View style={[
                styles.meetingHeaderStatus,
                { backgroundColor: meeting.meeting_status === 'open' ? '#10b981' + '20' : '#6b7280' + '20' }
              ]}>
                <Text style={[
                  styles.meetingHeaderStatusText,
                  { color: meeting.meeting_status === 'open' ? '#10b981' : '#6b7280' }
                ]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_status === 'open' ? 'Open' : 'Closed'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.tabsGrid}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabCard,
                {
                  backgroundColor: selectedTab === tab.id ? tab.color + '20' : theme.colors.surface,
                  borderColor: selectedTab === tab.id ? tab.color : theme.colors.border,
                }
              ]}
              onPress={() => handleTabPress(tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIcon, { backgroundColor: tab.color }]}>
                {tab.icon}
              </View>
              <Text style={[
                styles.tabTitle,
                { color: selectedTab === tab.id ? tab.color : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                {tab.title}
              </Text>
              {tab.comingSoon && (
                <View style={[styles.comingSoonBadge, { backgroundColor: theme.colors.warning }]}>
                  <Text style={styles.comingSoonText} maxFontSizeMultiplier={1.3}>Soon</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Content Area */}
        <View style={styles.contentArea}>
          {selectedTab === 'overview' && <QuickOverview />}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  meetingHeaderCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  meetingHeaderContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meetingIcon: {
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
  content: {
    flex: 1,
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
  contentArea: {
    padding: 16,
  },
  overviewContent: {
    gap: 16,
  },
  overviewPlaceholder: {
    fontSize: 16,
    textAlign: 'center',
    padding: 32,
    fontStyle: 'italic',
  },
});
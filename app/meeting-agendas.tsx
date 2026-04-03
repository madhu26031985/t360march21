import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, FileText, Calendar, Clock, MapPin, ChevronRight, ExternalLink, Building2, Crown, User, Shield, Eye, UserCheck } from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';

interface Meeting {
  id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_number: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_mode: string;
  meeting_status: string;
}

interface MeetingAgenda {
  id: string;
  meeting_id: string;
  title: string;
  document_type: 'google_doc' | 'pdf_url' | 'pdf_file' | 'website_url';
  document_url: string | null;
  pdf_data: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface MeetingWithAgenda extends Meeting {
  agenda?: MeetingAgenda;
}

export default function MeetingAgendas() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState<MeetingWithAgenda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'open' | 'closed'>('open');
  const [filteredMeetings, setFilteredMeetings] = useState<MeetingWithAgenda[]>([]);

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    filterMeetings();
  }, [meetings, selectedTab]);

  const loadMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      // Load meetings
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading open meetings:', error);
        Alert.alert('Error', `Failed to load meetings: ${error.message}`);
        return;
      }

      const meetingsData = data || [];

      // Load agendas for all meetings
      const { data: agendasData, error: agendasError } = await supabase
        .from('meeting_agendas')
        .select('*')
        .in('meeting_id', meetingsData.map(m => m.id));

      if (agendasError) {
        console.error('Error loading agendas:', agendasError);
      }

      // Combine meetings with their agendas
      const meetingsWithAgendas = meetingsData.map(meeting => ({
        ...meeting,
        agenda: agendasData?.find(agenda => agenda.meeting_id === meeting.id)
      }));

      setMeetings(meetingsWithAgendas);
    } catch (error) {
      console.error('Error loading open meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const filterMeetings = () => {
    if (selectedTab === 'open') {
      setFilteredMeetings(meetings.filter(m => m.meeting_status === 'open'));
    } else {
      setFilteredMeetings(meetings.filter(m => m.meeting_status === 'close'));
    }
  };

  const handleMeetingPress = (meeting: Meeting) => {
    const meetingWithAgenda = meeting as MeetingWithAgenda;
    if (meetingWithAgenda.agenda) {
      handleViewAgenda(meetingWithAgenda.agenda);
    } else {
      Alert.alert('No Agenda', 'No agenda has been uploaded for this meeting yet.');
    }
  };

  const handleViewAgenda = async (agenda: MeetingAgenda) => {
    try {
      if (agenda.document_type === 'pdf_file') {
        Alert.alert('PDF File', 'PDF file viewing is not yet supported. Please contact your ExComm for assistance.');
      } else if (agenda.document_url) {
        if (WebBrowser && WebBrowser.openBrowserAsync) {
          await WebBrowser.openBrowserAsync(agenda.document_url);
        } else {
          await Linking.openURL(agenda.document_url);
        }
      } else {
        Alert.alert('Error', 'No agenda URL available');
      }
    } catch (error) {
      console.error('Error opening agenda:', error);
      Alert.alert('Error', 'Failed to open agenda');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#ffffff" />;
      case 'visiting_tm': return <UserCheck size={12} color="#ffffff" />;
      case 'club_leader': return <Shield size={12} color="#ffffff" />;
      case 'guest': return <Eye size={12} color="#ffffff" />;
      case 'member': return <User size={12} color="#ffffff" />;
      default: return <User size={12} color="#ffffff" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return EXCOMM_UI.solidBg;
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return 'ExComm';
      case 'visiting_tm': return 'Visiting TM';
      case 'club_leader': return 'Club Leader';
      case 'guest': return 'Guest';
      case 'member': return 'Member';
      default: return role;
    }
  };

  const MeetingCard = ({ meeting }: { meeting: MeetingWithAgenda }) => (
    <TouchableOpacity 
      style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleMeetingPress(meeting)}
      activeOpacity={0.7}
    >
      <View style={styles.meetingHeader}>
        <View style={[styles.meetingIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          {meeting.agenda ? (
            <FileText size={24} color="#10b981" />
          ) : (
            <FileText size={24} color={theme.colors.textSecondary} />
          )}
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
          
          {/* Agenda Status */}
          <View style={styles.agendaStatus}>
            {meeting.agenda ? (
              <View style={[styles.agendaAvailable, { backgroundColor: '#10b981' + '20' }]}>
                <FileText size={12} color="#10b981" />
                <Text style={[styles.agendaStatusText, { color: '#10b981' }]} maxFontSizeMultiplier={1.3}>
                  Agenda Available
                </Text>
              </View>
            ) : (
              <View style={[styles.agendaNotAvailable, { backgroundColor: theme.colors.textSecondary + '20' }]}>
                <FileText size={12} color={theme.colors.textSecondary} />
                <Text style={[styles.agendaStatusText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No Agenda
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.meetingCardMode}>
            <MapPin size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingCardModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meeting.meeting_mode === 'in_person' ? 'In Person' : 
               meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
            </Text>
          </View>
        </View>
        <View style={styles.meetingCardActions}>
          {meeting.agenda ? (
            <View style={[styles.viewAgendaButton, { backgroundColor: '#10b981' }]}>
              <ExternalLink size={14} color="#ffffff" />
            </View>
          ) : (
            <View style={[styles.noAgendaButton, { backgroundColor: theme.colors.textSecondary + '20' }]}>
              <FileText size={14} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting agendas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <FileText size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Access Required</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to access meeting agendas.
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Agendas</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Switcher */}
        <ClubSwitcher showRole={true} />

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.infoHeader}>
            <FileText size={20} color={theme.colors.primary} />
            <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Agendas</Text>
          </View>
          <Text style={[styles.infoDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            View and access agendas for club meetings. Agendas are uploaded by your Executive Committee.
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'open' ? '#10b981' : theme.colors.surface,
                borderColor: selectedTab === 'open' ? '#10b981' : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('open')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'open' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Open Meetings
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'open' ? 'rgba(255, 255, 255, 0.2)' : '#10b981' + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'open' ? '#ffffff' : '#10b981' }
              ]} maxFontSizeMultiplier={1.3}>
                {meetings.filter(m => m.meeting_status === 'open').length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              {
                backgroundColor: selectedTab === 'closed' ? '#6b7280' : theme.colors.surface,
                borderColor: selectedTab === 'closed' ? '#6b7280' : theme.colors.border,
              }
            ]}
            onPress={() => setSelectedTab('closed')}
          >
            <Text style={[
              styles.tabText,
              { color: selectedTab === 'closed' ? '#ffffff' : theme.colors.text }
            ]} maxFontSizeMultiplier={1.3}>
              Closed Meetings
            </Text>
            <View style={[
              styles.tabCount,
              { backgroundColor: selectedTab === 'closed' ? 'rgba(255, 255, 255, 0.2)' : '#6b7280' + '20' }
            ]}>
              <Text style={[
                styles.tabCountText,
                { color: selectedTab === 'closed' ? '#ffffff' : '#6b7280' }
              ]} maxFontSizeMultiplier={1.3}>
                {meetings.filter(m => m.meeting_status === 'close').length}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Meetings Section */}
        <View style={styles.meetingsSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {selectedTab === 'open' ? 'Open' : 'Closed'} Meetings ({filteredMeetings.length})
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {selectedTab === 'open' 
              ? 'View agendas for upcoming meetings'
              : 'Access agendas from past meetings'
            }
          </Text>
          
          {filteredMeetings.length > 0 ? (
            <View style={styles.meetingsList}>
              {filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </View>
          ) : (
            <View style={styles.noMeetingsState}>
              <FileText size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.noMeetingsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No {selectedTab === 'open' ? 'Open' : 'Closed'} Meetings
              </Text>
              <Text style={[styles.noMeetingsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {selectedTab === 'open' 
                  ? 'There are currently no open meetings available'
                  : 'There are no closed meetings to display'
                }
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  signInButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
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
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  tabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '600',
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
  },
  meetingCardModeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingCardArrow: {
    marginLeft: 12,
  },
  agendaStatus: {
    marginBottom: 4,
  },
  agendaAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  agendaNotAvailable: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  agendaStatusText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  meetingCardActions: {
    marginLeft: 12,
  },
  viewAgendaButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAgendaButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
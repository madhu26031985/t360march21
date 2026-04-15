import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, type Href } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { MeetingRolesTabPanel } from '@/components/MeetingRolesTabPanel';
import { MeetingActionsTabPanel } from '@/components/MeetingActionsTabPanel';
import { MeetingEvaluationTabPanel } from '@/components/MeetingEvaluationTabPanel';
import type { MeetingFlowTab } from '@/lib/meetingTabsCatalog';
import { ArrowLeft, Calendar, Clock, MapPin, ChevronRight, ChevronDown, ChevronUp, Building2, Crown, User, Shield, Eye, UserCheck, Lock, Home, Users, Settings } from 'lucide-react-native';
import { Search, Filter } from 'lucide-react-native';
import { TextInput, Modal } from 'react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  surfaceSoft: '#F7F6F3',
  border: 'rgba(55, 53, 47, 0.10)',
  text: '#37352F',
  textSecondary: '#787774',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
};
const BOOK_ROLE_DOCK_ICON_SIZE = 15;

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

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function MeetingRecords() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<'actions' | 'roles' | 'evaluation'>('actions');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<'last_30' | 'last_90' | 'last_6_months' | 'last_1_year' | 'all_time'>('last_30');
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    loadMeetings();
    loadClubInfo();
  }, []);

  useEffect(() => {
    filterMeetings();
  }, [meetings, searchQuery, dateFilter, customStartDate, customEndDate]);

  const loadMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading meetings:', error);
        Alert.alert('Error', `Failed to load meetings: ${error.message}`);
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const filterMeetings = () => {
    let filtered = meetings;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(meeting => 
        meeting.meeting_title?.toLowerCase().includes(query) ||
        (meeting.meeting_number && meeting.meeting_number.toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    const now = new Date();
    
    switch (dateFilter) {
      case 'last_30':
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= thirtyDaysAgo);
        break;
      case 'last_90':
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= ninetyDaysAgo);
        break;
      case 'last_6_months':
        const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= sixMonthsAgo);
        break;
      case 'last_1_year':
        const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= oneYearAgo);
        break;
      case 'all_time':
      default:
        // No date filtering
        break;
    }
    
    // Only show closed meetings
    filtered = filtered.filter((m) => m.meeting_status === 'close');
    
    setFilteredMeetings(filtered);
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'last_30': return 'Last 30 days';
      case 'last_90': return 'Last 90 days';
      case 'last_6_months': return 'Last 6 months';
      case 'last_1_year': return 'Last 1 year';
      case 'all_time': return 'All time';
      default: return 'Last 30 days';
    }
  };

  // (Open/Closed tabs removed; this screen shows closed meetings only.)

  const handleMeetingPress = (meeting: Meeting) => {
    if (expandedMeetingId === meeting.id) {
      setExpandedMeetingId(null);
      return;
    }
    setExpandedMeetingId(meeting.id);
    setExpandedTab('actions');
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const handleHistoryMeetingTabPress = (tab: MeetingFlowTab, meetingId: string) => {
    if (tab.route) {
      const routeWithId = tab.route.replace('meetingId=undefined', `meetingId=${meetingId}`);
      router.push(routeWithId as Href);
      return;
    }
    if (tab.comingSoon) {
      Alert.alert('Coming Soon', `${tab.title} will be available in a future update.`);
      return;
    }
    if (tab.id === 'overview') {
      router.push(`/quick-overview?meetingId=${meetingId}` as Href);
      return;
    }
    if (tab.id === 'book_role') {
      router.push(`/book-a-role?meetingId=${meetingId}` as Href);
      return;
    }
    if (tab.id === 'live_voting') {
      router.push(`/live-voting?meetingId=${meetingId}` as Href);
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

  const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
    <View style={[styles.meetingCard, { backgroundColor: N.surface, borderColor: N.border }]}>
      <View style={styles.meetingHeader}>
        <View style={[styles.meetingIcon, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
          <Lock size={20} color={N.iconMuted} />
        </View>
        <View style={styles.meetingCardInfo}>
          <Text style={[styles.meetingCardTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            {meeting.meeting_title}
          </Text>
          <View style={styles.meetingCardMeta}>
            <View style={styles.meetingCardDate}>
              <Calendar size={12} color={N.textSecondary} />
              <Text style={[styles.meetingCardDateText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {new Date(meeting.meeting_date).toLocaleDateString()}
              </Text>
            </View>
            {meeting.meeting_number && (
              <Text style={[styles.meetingCardNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                #{meeting.meeting_number}
              </Text>
            )}
          </View>
          {meeting.meeting_start_time && (
            <View style={styles.meetingCardTime}>
              <Clock size={12} color={N.textSecondary} />
              <Text style={[styles.meetingCardTimeText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_start_time}
                {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
              </Text>
            </View>
          )}
          <View style={styles.meetingCardMode}>
            <MapPin size={12} color={N.textSecondary} />
            <Text style={[styles.meetingCardModeText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {formatMeetingMode(meeting.meeting_mode)}
            </Text>
          </View>
          
          {/* Meeting Day */}
          {meeting.meeting_day && (
            <View style={styles.meetingCardDay}>
              <Calendar size={12} color={N.textSecondary} />
              <Text style={[styles.meetingCardDayText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_day}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.openCloseBtn}
          onPress={() => handleMeetingPress(meeting)}
          activeOpacity={0.85}
        >
          <Text style={styles.openCloseBtnText} maxFontSizeMultiplier={1.2}>
            {expandedMeetingId === meeting.id ? 'Close' : 'Open'}
          </Text>
          {expandedMeetingId === meeting.id ? (
            <ChevronUp size={14} color="#ffffff" />
          ) : (
            <ChevronDown size={14} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {expandedMeetingId === meeting.id && (
        <View style={[styles.expandedCardWrap, { borderTopColor: N.border }]}>
          <View style={[styles.expandedTabs, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
            {(['actions', 'roles', 'evaluation'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.expandedTab,
                  expandedTab === tab && [styles.expandedTabActive, { backgroundColor: N.surface }],
                ]}
                onPress={() => setExpandedTab(tab)}
              >
                <Text style={[styles.expandedTabText, { color: expandedTab === tab ? N.text : N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {tab === 'actions' ? 'Actions' : tab === 'roles' ? 'Roles' : 'Evaluation'}
                </Text>
                {expandedTab === tab && <View style={styles.expandedTabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>

          {expandedTab === 'actions' && (
            <View style={styles.expandedSection}>
              <MeetingActionsTabPanel
                meetingId={meeting.id}
                bookRoleShowAttention={false}
                disableBookRole={true}
                onTabPress={(tab) => handleHistoryMeetingTabPress(tab, meeting.id)}
                onOpenClubReports={() => router.push({ pathname: '/(tabs)/meetings', params: { section: 'reports' } } as Href)}
              />
            </View>
          )}

          {expandedTab === 'roles' && (
            <View style={styles.expandedSection}>
              <MeetingRolesTabPanel
                meetingId={meeting.id}
                onTabPress={(tab) => handleHistoryMeetingTabPress(tab, meeting.id)}
              />
            </View>
          )}

          {expandedTab === 'evaluation' && (
            <View style={styles.expandedSection}>
              <MeetingEvaluationTabPanel
                meetingId={meeting.id}
                onTabPress={(tab) => handleHistoryMeetingTabPress(tab, meeting.id)}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.text }]} maxFontSizeMultiplier={1.3}>Loading meeting records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.accessDeniedContainer}>
          <Calendar size={48} color={N.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Club Access Required</Text>
          <Text style={[styles.accessDeniedMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to access meeting records.
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: N.text }]}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.signInButtonText} maxFontSizeMultiplier={1.3}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Completed Meetings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.masterContentBox, { backgroundColor: N.surface, borderColor: N.border }]}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: N.surface, borderColor: N.border }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
                <Building2 size={20} color={N.textSecondary} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{clubInfo.club_number}
                    </Text>
                  )}
                  {user?.clubRole && (
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                      {getRoleIcon(user.clubRole)}
                      <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Search and Filter Section */}
        <View style={styles.searchFilterSection}>
          {/* Search Box */}
          <View style={[styles.searchContainer, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Search size={16} color={N.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: N.text }]}
              placeholder="Search by meeting number or title..."
              placeholderTextColor={N.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          {/* Date Filter */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: N.surface, borderColor: N.border }]}
              onPress={() => setShowDateFilter(true)}
            >
              <Filter size={16} color={N.textSecondary} />
              <Text style={[styles.filterButtonText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                {getDateFilterLabel()}
              </Text>
              <ChevronDown size={14} color={N.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Meetings Section */}
        <View style={styles.meetingsSection}>
          <Text style={[styles.sectionTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Completed Meetings ({filteredMeetings.length})
          </Text>
          <Text style={[styles.sectionSubtitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Browse completed meeting records
          </Text>
          
          {filteredMeetings.length > 0 ? (
            <View style={styles.meetingsList}>
              {filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </View>
          ) : (
            <View style={styles.noMeetingsState}>
              <Lock size={48} color={N.textSecondary} />
              <Text style={[styles.noMeetingsText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                No Completed Meetings
              </Text>
              <Text style={[styles.noMeetingsSubtext, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                There are no closed meetings to display
              </Text>
            </View>
          )}
        </View>

        <View style={styles.navSpacer} />
        </View>
      </ScrollView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Home size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={BOOK_ROLE_DOCK_ICON_SIZE} color="#d97706" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push('/(tabs)/meetings')}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={BOOK_ROLE_DOCK_ICON_SIZE} color="#0ea5e9" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting
            </Text>
          </TouchableOpacity>
          {isExComm ? (
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/(tabs)/admin')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={BOOK_ROLE_DOCK_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.footerNavItem}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.75}
          >
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={BOOK_ROLE_DOCK_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <TouchableOpacity 
          style={styles.dateFilterOverlay}
          onPress={() => setShowDateFilter(false)}
        >
          <View style={[styles.dateFilterModal, { backgroundColor: theme.colors.surface, borderColor: N.border }]}>
            <Text style={[styles.dateFilterTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Filter by Date</Text>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_30' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_30');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_30' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_90' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_90');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_90' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 90 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_6_months' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_6_months');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_6_months' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 6 Months
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'last_1_year' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('last_1_year');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'last_1_year' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Last 1 Year
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'all_time' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('all_time');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'all_time' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                All Time
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      </KeyboardAvoidingView>
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
  masterContentBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
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
  searchFilterSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterRow: {
    flexDirection: 'row',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 6,
  },
  dateFilterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateFilterModal: {
    borderRadius: 0,
    borderWidth: 1,
    padding: 20,
    margin: 20,
    minWidth: 300,
  },
  dateFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateFilterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  dateFilterOptionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
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
    marginHorizontal: 6,
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
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  scrollContent: {
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
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
    borderRadius: 0,
    borderWidth: 1,
    padding: 16,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meetingIcon: {
    width: 50,
    height: 50,
    borderRadius: 0,
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
  openCloseBtn: {
    marginLeft: 12,
    alignSelf: 'flex-start',
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 0,
    backgroundColor: '#2874F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  openCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  expandedCardWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  expandedTabs: {
    flexDirection: 'row',
    borderRadius: 0,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  expandedTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 0,
  },
  expandedTabActive: {
    borderWidth: 1,
    borderColor: '#DCDCDC',
  },
  expandedTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  expandedTabIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0ea5e9',
  },
  expandedSection: {
    gap: 8,
  },
  expandedSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  expandedSectionDivider: {
    height: 1,
    marginBottom: 4,
  },
  expandedRowCard: {
    borderRadius: 0,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandedGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  expandedGridCard: {
    flex: 1,
    borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 96,
  },
  expandedGridIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  expandedGridTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  expandedRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  expandedRowTextWrap: {
    flex: 1,
  },
  expandedRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  expandedRowSub: {
    fontSize: 12,
    marginTop: 2,
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
  clubCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    padding: 16,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 0,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, ChevronRight, Building2, Crown, User, Shield, Eye, UserCheck, Clock as Unlock, Lock, Home, Users, Settings } from 'lucide-react-native';
import { Search, Filter, ChevronDown } from 'lucide-react-native';
import { TextInput, Modal } from 'react-native';

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
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'open' | 'closed'>('open');
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<'upcoming' | 'last_30' | 'last_90' | 'last_6_months' | 'last_1_year' | 'all_time'>('last_30');
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
  }, [meetings, selectedTab, searchQuery, dateFilter, customStartDate, customEndDate]);

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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'upcoming':
        filtered = filtered.filter(meeting => new Date(meeting.meeting_date) >= today);
        break;
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
    
    // Apply tab filter
    if (selectedTab === 'open') {
      filtered = filtered.filter(m => m.meeting_status === 'open');
    } else {
      filtered = filtered.filter(m => m.meeting_status === 'close');
    }
    
    setFilteredMeetings(filtered);
  };

  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case 'upcoming': return 'Upcoming';
      case 'last_30': return 'Last 30 days';
      case 'last_90': return 'Last 90 days';
      case 'last_6_months': return 'Last 6 months';
      case 'last_1_year': return 'Last 1 year';
      case 'all_time': return 'All time';
      default: return 'Last 30 days';
    }
  };

  const getFilterCount = (tabValue: string) => {
    // Apply search and date filters first
    let baseFiltered = meetings;
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      baseFiltered = baseFiltered.filter(meeting => 
        meeting.meeting_title?.toLowerCase().includes(query) ||
        (meeting.meeting_number && meeting.meeting_number.toLowerCase().includes(query))
      );
    }
    
    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'upcoming':
        baseFiltered = baseFiltered.filter(meeting => new Date(meeting.meeting_date) >= today);
        break;
      case 'last_30':
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        baseFiltered = baseFiltered.filter(meeting => new Date(meeting.meeting_date) >= thirtyDaysAgo);
        break;
      case 'last_90':
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        baseFiltered = baseFiltered.filter(meeting => new Date(meeting.meeting_date) >= ninetyDaysAgo);
        break;
      case 'last_6_months':
        const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
        baseFiltered = baseFiltered.filter(meeting => new Date(meeting.meeting_date) >= sixMonthsAgo);
        break;
      case 'last_1_year':
        const oneYearAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        baseFiltered = baseFiltered.filter(meeting => new Date(meeting.meeting_date) >= oneYearAgo);
        break;
      case 'all_time':
      default:
        // No date filtering
        break;
    }
    
    // Then apply tab filter
    if (tabValue === 'open') return baseFiltered.filter(m => m.meeting_status === 'open').length;
    return baseFiltered.filter(m => m.meeting_status === 'close').length;
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
      case 'excomm': return '#8b5cf6';
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
    <TouchableOpacity 
      style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleMeetingPress(meeting)}
      activeOpacity={0.7}
    >
      <View style={styles.meetingHeader}>
        <View style={[
          styles.meetingIcon, 
          { backgroundColor: meeting.meeting_status === 'open' ? '#10b981' + '20' : '#6b7280' + '20' }
        ]}>
          {meeting.meeting_status === 'open' ? (
            <Unlock size={24} color="#10b981" />
          ) : (
            <Lock size={24} color="#6b7280" />
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
          <View style={styles.meetingCardMode}>
            <MapPin size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingCardModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {formatMeetingMode(meeting.meeting_mode)}
            </Text>
          </View>
          
          {/* Meeting Day */}
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
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting records...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Calendar size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Access Required</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need to be an authenticated club member to access meeting records.
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

  const openCount = meetings.filter(m => m.meeting_status === 'open').length;
  const closedCount = meetings.filter(m => m.meeting_status === 'close').length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Records</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.clubInfo}>
                <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubInfo.name}
                </Text>
                <View style={styles.clubMeta}>
                  {clubInfo.club_number && (
                    <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
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
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search by meeting number or title..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Date Filter */}
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            onPress={() => setShowDateFilter(true)}
          >
            <Filter size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.filterButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {getDateFilterLabel()}
            </Text>
            <ChevronDown size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
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
            <Unlock size={16} color={selectedTab === 'open' ? '#ffffff' : theme.colors.text} />
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
                {getFilterCount('open')}
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
            <Lock size={16} color={selectedTab === 'closed' ? '#ffffff' : theme.colors.text} />
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
                {getFilterCount('closed')}
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
              ? 'Currently active meetings where members can participate'
              : 'Completed meetings that have been closed'
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
              {selectedTab === 'open' ? (
                <Unlock size={48} color={theme.colors.textSecondary} />
              ) : (
                <Lock size={48} color={theme.colors.textSecondary} />
              )}
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

        {/* Navigation Icons - inside scroll, pushes to bottom when content is short */}
        <View style={styles.navSpacer} />
        <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                <Home size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/club')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                <Users size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/meetings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                <Calendar size={16} color="#0ea5e9" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                <Settings size={16} color="#8b5cf6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            {user?.clubRole === 'excomm' && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#FFE5E5' }]}>
                  <Settings size={16} color="#dc2626" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

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
          <View style={[styles.dateFilterModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.dateFilterTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Filter by Date</Text>
            
            <TouchableOpacity
              style={[
                styles.dateFilterOption,
                dateFilter === 'upcoming' && { backgroundColor: theme.colors.primary + '20' }
              ]}
              onPress={() => {
                setDateFilter('upcoming');
                setShowDateFilter(false);
              }}
            >
              <Text style={[
                styles.dateFilterOptionText,
                { color: dateFilter === 'upcoming' ? theme.colors.primary : theme.colors.text }
              ]} maxFontSizeMultiplier={1.3}>
                Upcoming
              </Text>
            </TouchableOpacity>

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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
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
    borderRadius: 8,
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
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  navigationSection: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
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
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
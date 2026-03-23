import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Calendar, Clock, MapPin, Users, CreditCard as Edit3, X, Building2, Crown, User, Shield, Eye, UserCheck, Home, Settings } from 'lucide-react-native';
import { RotateCcw } from 'lucide-react-native';
import { Platform } from 'react-native';

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
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function MeetingManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'open' | 'closed'>('open');
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);

  const showAlert = (
    title: string,
    message?: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
        if (confirmed) {
          const confirmButton = buttons.find(b => b.style !== 'cancel');
          confirmButton?.onPress?.();
        } else {
          const cancelButton = buttons.find(b => b.style === 'cancel');
          cancelButton?.onPress?.();
        }
      } else {
        window.alert(message ? `${title}\n\n${message}` : title);
        buttons?.[0]?.onPress?.();
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  useEffect(() => {
    loadMeetings();
    loadClubInfo();
  }, []);

  useEffect(() => {
    filterMeetings();
  }, [meetings, selectedTab]);

  useFocusEffect(
    useCallback(() => {
      loadMeetings();
    }, [user?.currentClubId])
  );

  const loadMeetings = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading meetings for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('club_id', user.currentClubId)
        .order('meeting_date', { ascending: true });

      if (error) {
        console.error('Error loading meetings:', error);
        showAlert('Error', `Failed to load meetings: ${error.message}`);
        return;
      }

      setMeetings(data || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      showAlert('Error', 'An unexpected error occurred while loading meetings');
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
    if (selectedTab === 'open') {
      setFilteredMeetings(meetings.filter(m => m.meeting_status === 'open'));
      return;
    }

    // Closed: show latest closed meeting on top.
    const closed = meetings.filter(m => m.meeting_status === 'close');

    const parseTimePartToHMS = (timeStr?: string): { hh: number; mm: number; ss: number } => {
      const t = String(timeStr || '00:00:00').trim();
      const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!match) return { hh: 0, mm: 0, ss: 0 };
      return {
        hh: parseInt(match[1], 10),
        mm: parseInt(match[2], 10),
        ss: parseInt(match[3] || '0', 10),
      };
    };

    const getSortValue = (m: Meeting) => {
      // Use JS's date parsing like the UI does for rendering.
      const base = new Date(m.meeting_date);
      if (Number.isNaN(base.getTime())) return 0;

      // Prefer end time (close), fallback to start time.
      const time = m.meeting_end_time || m.meeting_start_time || '00:00:00';
      const { hh, mm, ss } = parseTimePartToHMS(time);

      base.setHours(hh, mm, ss, 0);
      return base.getTime();
    };

    closed.sort((a, b) => getSortValue(b) - getSortValue(a));
    setFilteredMeetings(closed);
  };

  const handleAddMeeting = () => {
    // Check if club already has 3 open meetings
    const openMeetingsCount = meetings.filter(m => m.meeting_status === 'open').length;
    if (openMeetingsCount >= 3) {
      showAlert(
        'Maximum Open Meetings Reached',
        'You can only have a maximum of 3 open meetings at a time. Please close an existing meeting before creating a new one.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push('/admin/create-meeting');
  };

  const handleEditMeeting = (meeting: Meeting) => {
    router.push(`/admin/edit-meeting?meetingId=${meeting.id}`);
  };

  const handleCloseMeeting = async (meeting: Meeting) => {
    showAlert(
      'Close Meeting',
      `This meeting will be closed. You can still reopen it later from Closed Meetings.\n\nMeeting: "${meeting.meeting_title}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Close Meeting', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_club_meeting')
                .update({ 
                  meeting_status: 'close',
                  updated_at: new Date().toISOString()
                })
                .eq('id', meeting.id);

              if (error) {
                console.error('Error closing meeting:', error);
                showAlert('Error', 'Failed to close meeting');
                return;
              }

              showAlert('Success', 'Meeting closed successfully');
              loadMeetings();
            } catch (error) {
              console.error('Error closing meeting:', error);
              showAlert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const handleReopenMeeting = async (meeting: Meeting) => {
    showAlert(
      'Reopen Meeting',
      `Are you sure you want to reopen "${meeting.meeting_title}"? This will move it back to open meetings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reopen Meeting', 
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_club_meeting')
                .update({ 
                  meeting_status: 'open',
                  updated_at: new Date().toISOString()
                })
                .eq('id', meeting.id);

              if (error) {
                console.error('Error reopening meeting:', error);
                showAlert('Error', 'Failed to reopen meeting');
                return;
              }

              showAlert('Success', 'Meeting reopened successfully');
              loadMeetings();
            } catch (error) {
              console.error('Error reopening meeting:', error);
              showAlert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
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

  const getOpenMeetingStatusBadge = (meeting: Meeting) => {
    if (meeting.meeting_status !== 'open') {
      return {
        text: 'Closed',
        textColor: '#6b7280',
        backgroundColor: '#6b7280' + '20',
      };
    }

    if (!meeting.meeting_date) {
      return {
        text: 'Open',
        textColor: '#10b981',
        backgroundColor: '#10b981' + '20',
      };
    }

    const now = new Date();
    const meetingDateMidnight = new Date(`${meeting.meeting_date}T00:00:00`);
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysToGo = Math.ceil((meetingDateMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24));

    if (daysToGo > 0) {
      return {
        text: `In ${daysToGo} days`,
        textColor: '#ca8a04',
        backgroundColor: '#fef3c7',
      };
    }

    if (daysToGo < 0) {
      return {
        text: 'Completed',
        textColor: '#16a34a',
        backgroundColor: '#dcfce7',
      };
    }

    // Same day (Today): if end time has passed, mark completed.
    if (meeting.meeting_end_time) {
      const endParts = meeting.meeting_end_time.split(':').map(Number);
      const meetingEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        endParts[0] || 0,
        endParts[1] || 0,
        0
      );

      if (now > meetingEnd) {
        return {
          text: 'Completed',
          textColor: '#16a34a',
          backgroundColor: '#dcfce7',
        };
      }
    }

    return {
      text: 'Today',
      textColor: '#dc2626',
      backgroundColor: '#fee2e2',
    };
  };

  const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
    <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
      {/* Meeting Information */}
      <View style={styles.meetingInfo}>
        <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {meeting.meeting_title}
        </Text>
        
        <View style={styles.meetingMeta}>
          <View style={styles.meetingDate}>
            <Calendar size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {new Date(meeting.meeting_date).toLocaleDateString()}
            </Text>
          </View>
          {meeting.meeting_number && (
            <Text style={[styles.meetingNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              #{meeting.meeting_number}
            </Text>
          )}
          {(() => {
            const badge = getOpenMeetingStatusBadge(meeting);
            return (
              <View style={[styles.statusTag, { backgroundColor: badge.backgroundColor }]}>
                <Text style={[styles.statusText, { color: badge.textColor }]} maxFontSizeMultiplier={1.3}>
                  {badge.text}
                </Text>
              </View>
            );
          })()}
        </View>
        
        {meeting.meeting_start_time && (
          <View style={styles.meetingTime}>
            <Clock size={12} color={theme.colors.textSecondary} />
            <Text style={[styles.meetingTimeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {meeting.meeting_start_time}
              {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
            </Text>
          </View>
        )}
        
        <View style={styles.meetingMode}>
          <MapPin size={12} color={theme.colors.textSecondary} />
          <Text style={[styles.meetingModeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {meeting.meeting_mode === 'in_person' ? 'In Person' : 
             meeting.meeting_mode === 'online' ? 'Online' : 'Hybrid'}
          </Text>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View style={styles.meetingActions}>
        {meeting.meeting_status === 'open' ? (
          <>
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#f0f9ff' }]}
                onPress={() => router.push(`/admin/manage-meeting-roles?meetingId=${meeting.id}`)}
                activeOpacity={0.7}
              >
                <Users size={16} color="#3b82f6" />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Manage Roles
              </Text>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#f0fdf4' }]}
                onPress={() => handleEditMeeting(meeting)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color="#10b981" />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Edit Meeting
              </Text>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#fef2f2' }]}
                onPress={() => handleCloseMeeting(meeting)}
                activeOpacity={0.7}
              >
                <X size={16} color="#ef4444" />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Close Meeting
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#f0fdf4' }]}
              onPress={() => handleReopenMeeting(meeting)}
              activeOpacity={0.7}
            >
              <RotateCcw size={16} color="#10b981" />
            </TouchableOpacity>
            <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Reopen
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meetings...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Management</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Open Meetings Limit Warning */}
        {meetings.filter(m => m.meeting_status === 'open').length >= 2 && (
          <View style={[styles.warningCard, { backgroundColor: '#fef3c7' }]}>
            <View style={styles.warningContent}>
              <Text style={[styles.warningTitle, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.3}>
                {meetings.filter(m => m.meeting_status === 'open').length === 3 ? 'Maximum Limit Reached' : 'Approaching Limit'}
              </Text>
              <Text style={[styles.warningText, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                {meetings.filter(m => m.meeting_status === 'open').length === 3 
                  ? 'You have reached the maximum of 3 open meetings. Close a meeting to create a new one.'
                  : `You have ${meetings.filter(m => m.meeting_status === 'open').length} open meetings. Maximum allowed is 3.`
                }
              </Text>
            </View>
          </View>
        )}

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

        {/* Create Meeting Hero */}
        <View style={[styles.createMeetingHeroWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[
              styles.createMeetingHeroButton,
              {
                backgroundColor:
                  meetings.filter(m => m.meeting_status === 'open').length >= 3
                    ? theme.colors.surface
                    : '#0ea5e9' + '15',
                borderColor:
                  meetings.filter(m => m.meeting_status === 'open').length >= 3
                    ? theme.colors.border
                    : '#0ea5e9' + '40',
              },
            ]}
            onPress={handleAddMeeting}
            disabled={meetings.filter(m => m.meeting_status === 'open').length >= 3}
            activeOpacity={0.8}
            accessibilityLabel="Create meeting"
            accessibilityHint="Create a new meeting"
          >
            <View style={styles.createMeetingHeroRow}>
              <View style={[styles.createMeetingHeroIconCircle, { backgroundColor: '#0ea5e9' + '2a' }]}>
                <Plus size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.createMeetingHeroTextCol}>
                <Text style={[styles.createMeetingHeroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                  Create meeting
                </Text>
                <Text style={[styles.createMeetingHeroSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1} numberOfLines={2}>
                  {meetings.filter(m => m.meeting_status === 'open').length >= 3
                    ? 'Close an open meeting to create a new one.'
                    : 'Add a new meeting for your club.'}
                </Text>
              </View>
              <View style={{ justifyContent: 'center', paddingHorizontal: 2 }}>
                <Text style={[styles.createMeetingHeroArrow, { color: theme.colors.textSecondary }]}>></Text>
              </View>
            </View>
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
          
          {filteredMeetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}

          {filteredMeetings.length === 0 && (
            <View style={styles.emptyState}>
              <Calendar size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No {selectedTab === 'open' ? 'open' : 'closed'} meetings
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {selectedTab === 'open'
                  ? 'Create your first meeting to get started'
                  : 'Closed meetings will appear here'
                }
              </Text>
            </View>
          )}
        </View>

        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },

  createMeetingHeroWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 16,
    padding: 1,
  },
  createMeetingHeroButton: {
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  createMeetingHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createMeetingHeroIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMeetingHeroTextCol: {
    flex: 1,
  },
  createMeetingHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  createMeetingHeroSubtext: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 3,
  },
  createMeetingHeroArrow: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 26,
  },
  content: {
    flex: 1,
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
  warningCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  meetingCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingInfo: {
    marginBottom: 16,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingNumber: {
    fontSize: 12,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  meetingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTimeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingModeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  meetingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButtonContainer: {
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  reopenButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  navigationSection: {
    marginHorizontal: 16,
    marginBottom: 16,
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

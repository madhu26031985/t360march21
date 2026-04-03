import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Users,
  CreditCard as Edit3,
  X,
  Building2,
  Crown,
  User,
  Shield,
  Eye,
  UserCheck,
  Home,
  Settings,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';

const FOOTER_NAV_ICON_SIZE = 15;

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

/** List view only — avoids select * overhead on clubs with long meeting notes / future columns */
const MEETING_LIST_COLUMNS =
  'id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location, meeting_link, meeting_status';

export default function MeetingManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'open' | 'closed'>('open');
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);

  const openMeetingsCount = useMemo(
    () => meetings.filter((m) => m.meeting_status === 'open').length,
    [meetings]
  );
  const closedMeetingsCount = useMemo(
    () => meetings.filter((m) => m.meeting_status === 'close').length,
    [meetings]
  );

  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

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
    filterMeetings();
  }, [meetings, selectedTab]);

  const refreshMeetingsOnly = async () => {
    const clubId = user?.currentClubId;
    if (!clubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select(MEETING_LIST_COLUMNS)
        .eq('club_id', clubId)
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
    }
  };

  useFocusEffect(
    useCallback(() => {
      const clubId = user?.currentClubId;
      if (!clubId) {
        setIsLoading(false);
        return;
      }

      let active = true;

      (async () => {
        setIsLoading(true);
        try {
          const [meetingsRes, clubRes] = await Promise.all([
            supabase
              .from('app_club_meeting')
              .select(MEETING_LIST_COLUMNS)
              .eq('club_id', clubId)
              .order('meeting_date', { ascending: true }),
            supabase.from('clubs').select('id, name, club_number').eq('id', clubId).single(),
          ]);

          if (!active) return;

          if (meetingsRes.error) {
            console.error('Error loading meetings:', meetingsRes.error);
            showAlert('Error', `Failed to load meetings: ${meetingsRes.error.message}`);
            return;
          }

          setMeetings(meetingsRes.data || []);

          if (clubRes.error) {
            console.error('Error loading club info:', clubRes.error);
          } else if (clubRes.data) {
            setClubInfo(clubRes.data);
          }
        } catch (error) {
          if (!active) return;
          console.error('Error loading meeting management:', error);
          showAlert('Error', 'An unexpected error occurred while loading meetings');
        } finally {
          if (active) setIsLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [user?.currentClubId])
  );

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
              refreshMeetingsOnly();
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
              refreshMeetingsOnly();
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
        textColor: '#374151',
        backgroundColor: '#f3f4f6',
      };
    }

    const now = new Date();
    const meetingDateMidnight = new Date(`${meeting.meeting_date}T00:00:00`);
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysToGo = Math.ceil((meetingDateMidnight.getTime() - nowMidnight.getTime()) / (1000 * 60 * 60 * 24));

    if (daysToGo > 0) {
      return {
        text: `In ${daysToGo} days`,
        textColor: '#374151',
        backgroundColor: '#f3f4f6',
      };
    }

    if (daysToGo < 0) {
      return {
        text: 'Completed',
        textColor: '#374151',
        backgroundColor: '#f3f4f6',
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
          textColor: '#374151',
          backgroundColor: '#f3f4f6',
        };
      }
    }

    return {
      text: 'Today',
      textColor: '#374151',
      backgroundColor: '#f3f4f6',
    };
  };

  const MeetingCard = ({ meeting }: { meeting: Meeting }) => (
    <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
      <View style={[styles.meetingActions, { borderTopColor: theme.colors.border }]}>
        {meeting.meeting_status === 'open' ? (
          <>
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => router.push(`/admin/manage-meeting-roles?meetingId=${meeting.id}`)}
                activeOpacity={0.7}
              >
                <Users size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Manage Roles
              </Text>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => handleEditMeeting(meeting)}
                activeOpacity={0.7}
              >
                <Edit3 size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Edit Meeting
              </Text>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => handleCloseMeeting(meeting)}
                activeOpacity={0.7}
              >
                <X size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.actionButtonLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Close Meeting
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => handleReopenMeeting(meeting)}
              activeOpacity={0.7}
            >
              <RotateCcw size={16} color={theme.colors.textSecondary} />
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.pageMain}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Meeting Management
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>

        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={styles.pageScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.notionSheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {clubInfo && (
              <View
                style={[
                  styles.notionClubBlock,
                  { backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#fffbeb' },
                ]}
              >
                <View style={styles.clubHeader}>
                  <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Building2 size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.clubInfo}>
                    <View style={styles.clubNameRow}>
                      <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {clubInfo.name}
                      </Text>
                    </View>
                    <View style={styles.clubMeta}>
                      {clubInfo.club_number && (
                        <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Club #{clubInfo.club_number}
                        </Text>
                      )}
                      {user?.clubRole && (
                        <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
                          {getRoleIcon(user.clubRole)}
                          <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>
                            {formatRole(user.clubRole)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

            <TouchableOpacity
              style={styles.notionCreateRow}
              onPress={handleAddMeeting}
              disabled={openMeetingsCount >= 3}
              activeOpacity={0.85}
              accessibilityLabel="Create meeting"
              accessibilityHint="Create a new meeting"
            >
              <View style={[styles.notionCreateIcon, { backgroundColor: theme.colors.primary + '14' }]}>
                <Plus size={20} color={theme.colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.notionCreateTextCol}>
                <Text style={[styles.notionCreateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
                  Create meeting
                </Text>
                <Text
                  style={[styles.notionCreateSubtext, { color: theme.colors.textSecondary }]}
                  maxFontSizeMultiplier={1.1}
                  numberOfLines={2}
                >
                  {openMeetingsCount >= 3
                    ? 'Close an open meeting to create a new one.'
                    : 'Add a new meeting for your club.'}
                </Text>
              </View>
              <ChevronRight size={22} color={theme.colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

            <View style={styles.notionTabsRow}>
              <TouchableOpacity
                style={[
                  styles.notionTab,
                  {
                    backgroundColor: selectedTab === 'open' ? theme.colors.primary : 'transparent',
                    borderColor: selectedTab === 'open' ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedTab('open')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.notionTabText,
                    { color: selectedTab === 'open' ? '#ffffff' : theme.colors.text },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  Open
                </Text>
                <View
                  style={[
                    styles.notionTabCount,
                    {
                      backgroundColor:
                        selectedTab === 'open' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notionTabCountText,
                      { color: selectedTab === 'open' ? '#ffffff' : theme.colors.primary },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {openMeetingsCount}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.notionTab,
                  {
                    backgroundColor: selectedTab === 'closed' ? theme.colors.primary : 'transparent',
                    borderColor: selectedTab === 'closed' ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedTab('closed')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.notionTabText,
                    { color: selectedTab === 'closed' ? '#ffffff' : theme.colors.text },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  Closed
                </Text>
                <View
                  style={[
                    styles.notionTabCount,
                    {
                      backgroundColor:
                        selectedTab === 'closed' ? 'rgba(255,255,255,0.22)' : theme.colors.primary + '18',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.notionTabCountText,
                      { color: selectedTab === 'closed' ? '#ffffff' : theme.colors.primary },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {closedMeetingsCount}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />

            <View style={styles.notionListSection}>
              <View style={styles.listHeaderRow}>
                <Text style={[styles.listHeaderTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedTab === 'open' ? 'Open meetings' : 'Closed meetings'}
                </Text>
                <View style={[styles.listCountBadge, { backgroundColor: theme.colors.primary + '16' }]}>
                  <Text style={[styles.listCountText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                    {filteredMeetings.length}
                  </Text>
                </View>
              </View>

              {filteredMeetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}

              {filteredMeetings.length === 0 && (
                <View style={styles.emptyState}>
                  <Calendar size={40} color={theme.colors.textSecondary} />
                  <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    No {selectedTab === 'open' ? 'open' : 'closed'} meetings
                  </Text>
                  <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {selectedTab === 'open'
                      ? 'Create your first meeting to get started'
                      : 'Closed meetings will appear here'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.geBottomDock,
            {
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.footerNavigationContent}
          >
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Home
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
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
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
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
                  <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
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
                <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Settings
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
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
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionClubBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notionHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  notionCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 14,
  },
  notionCreateIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notionCreateTextCol: {
    flex: 1,
    minWidth: 0,
  },
  notionCreateTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  notionCreateSubtext: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 4,
  },
  notionTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  notionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  notionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notionTabCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 0,
    minWidth: 22,
    alignItems: 'center',
  },
  notionTabCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notionListSection: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 18,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  listCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
  },
  listCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 8,
  },
  footerNavigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  footerNavItem: {
    alignItems: 'center',
    minWidth: 62,
    paddingVertical: 2,
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
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
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
  meetingCard: {
    borderRadius: 0,
    padding: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
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
    borderRadius: 0,
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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButtonContainer: {
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
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
});

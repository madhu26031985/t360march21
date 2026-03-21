import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, Building2, FileText, Link, MessageSquare, Users } from 'lucide-react-native';
import { Image } from 'react-native';

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
  charter_date: string | null;
}

interface MeetingCollaboration {
  id: string;
  user_id: string;
  role_name: string;
  collaboration_type: string;
  title: string;
  content_data: any;
  app_user_profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

interface BookedRole {
  id: string;
  role_name: string;
  assigned_user_id: string;
  booking_status: string;
  booked_at: string | null;
  role_classification: string | null;
  app_user_profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export default function QuickOverview() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [collaborations, setCollaborations] = useState<MeetingCollaboration[]>([]);
  const [bookedRoles, setBookedRoles] = useState<BookedRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isGoogleMapsLink = (location: string | null): boolean => {
    if (!location) return false;
    const lowerLocation = location.toLowerCase();
    return lowerLocation.includes('maps.google.com') || 
           lowerLocation.includes('goo.gl/maps') || 
           lowerLocation.includes('maps.app.goo.gl');
  };

  const handleLocationPress = async () => {
    if (!meeting?.meeting_location) return;

    try {
      const supported = await Linking.canOpenURL(meeting.meeting_location);
      if (supported) {
        await Linking.openURL(meeting.meeting_location);
      } else {
        Alert.alert('Error', 'Cannot open this location link');
      }
    } catch (error) {
      console.error('Error opening location link:', error);
      Alert.alert('Error', 'Failed to open location link');
    }
  };

  useEffect(() => {
    if (meetingId) {
      loadQuickOverviewData();
    }
  }, [meetingId]);

  const loadQuickOverviewData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadClubInfo(),
        loadMeetingCollaborations(),
        loadBookedRoles()
      ]);
    } catch (error) {
      console.error('Error loading quick overview data:', error);
      Alert.alert('Error', 'Failed to load meeting overview');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMeeting = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_meeting')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error loading meeting:', error);
        return;
      }

      setMeeting(data);
    } catch (error) {
      console.error('Error loading meeting:', error);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number, charter_date')
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

  const loadMeetingCollaborations = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_collaboration')
        .select(`
          *,
          app_user_profiles (
            full_name,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('booking_status', 'booked')
        .eq('booking_status', 'booked')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading meeting collaborations:', error);
        return;
      }

      setCollaborations(data || []);
    } catch (error) {
      console.error('Error loading meeting collaborations:', error);
    }
  };

  const loadBookedRoles = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          assigned_user_id,
          booking_status,
          booked_at,
          role_classification,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('booking_status', 'booked')
        .not('assigned_user_id', 'is', null)
        .order('booked_at', { ascending: true });

      if (error) {
        console.error('Error loading booked roles:', error);
        return;
      }

      setBookedRoles(data || []);
    } catch (error) {
      console.error('Error loading booked roles:', error);
    }
  };

  const formatMeetingMode = (mode: string) => {
    switch (mode) {
      case 'in_person': return 'In Person';
      case 'online': return 'Online';
      case 'hybrid': return 'Hybrid';
      default: return mode;
    }
  };

  const handleMeetingLinkPress = async () => {
    if (!meeting?.meeting_link) return;

    try {
      const supported = await Linking.canOpenURL(meeting.meeting_link);
      if (supported) {
        await Linking.openURL(meeting.meeting_link);
      } else {
        Alert.alert('Error', 'Cannot open this meeting link');
      }
    } catch (error) {
      console.error('Error opening meeting link:', error);
      Alert.alert('Error', 'Failed to open meeting link');
    }
  };

  const renderCollaborationSequence = () => {
    const collaborationItems: Array<{
      id: string;
      emoji: string;
      title: string;
      content: string;
      assignedUser: {
        full_name: string;
        avatar_url: string | null;
      };
    }> = [];

    // Track processed items to avoid duplicates
    const processedItems = new Set<string>();

    // 1. Theme of the Day (collaboration_type = 'theme')
    const themeCollabs = collaborations.filter(collab => 
      collab.collaboration_type === 'theme' && collab.title
    );
    
    themeCollabs.forEach((collab, index) => {
      const uniqueKey = `theme-${collab.title}-${collab.user_id}`;
      if (!processedItems.has(uniqueKey)) {
        processedItems.add(uniqueKey);
        collaborationItems.push({
          id: `theme-${collab.user_id}-${index}-${Date.now()}`,
          emoji: '🎯',
          title: 'Theme of the Day',
          content: collab.title,
          assignedUser: {
            full_name: collab.app_user_profiles.full_name,
            avatar_url: collab.app_user_profiles.avatar_url,
          },
        });
      }
    });

    // 2. Grammarian items (collaboration_type = 'word')
    const wordCollabs = collaborations.filter(collab => 
      collab.collaboration_type === 'word' && collab.content_data
    );
    
    wordCollabs.forEach((collab, index) => {
      const contentData = collab.content_data || {};
      
      if (contentData.wordOfTheDay) {
        const uniqueKey = `word-${contentData.wordOfTheDay}-${collab.user_id}`;
        if (!processedItems.has(uniqueKey)) {
          processedItems.add(uniqueKey);
          collaborationItems.push({
            id: `word-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
            emoji: '📝',
            title: 'Word of the Day',
            content: contentData.wordOfTheDay,
            assignedUser: {
              full_name: collab.app_user_profiles.full_name,
              avatar_url: collab.app_user_profiles.avatar_url,
            },
          });
        }
      }

      if (contentData.idiomOfTheDay) {
        const uniqueKey = `idiom-${contentData.idiomOfTheDay}-${collab.user_id}`;
        if (!processedItems.has(uniqueKey)) {
          processedItems.add(uniqueKey);
          collaborationItems.push({
            id: `idiom-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
            emoji: '💭',
            title: 'Idiom of the Day',
            content: contentData.idiomOfTheDay,
            assignedUser: {
              full_name: collab.app_user_profiles.full_name,
              avatar_url: collab.app_user_profiles.avatar_url,
            },
          });
        }
      }

      if (contentData.phraseOfTheDay) {
        const uniqueKey = `phrase-${contentData.phraseOfTheDay}-${collab.user_id}`;
        if (!processedItems.has(uniqueKey)) {
          processedItems.add(uniqueKey);
          collaborationItems.push({
            id: `phrase-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
            emoji: '💬',
            title: 'Phrase of the Day',
            content: contentData.phraseOfTheDay,
            assignedUser: {
              full_name: collab.app_user_profiles.full_name,
              avatar_url: collab.app_user_profiles.avatar_url,
            },
          });
        }
      }

      if (contentData.quoteOfTheDay) {
        const uniqueKey = `quote-${contentData.quoteOfTheDay}-${collab.user_id}`;
        if (!processedItems.has(uniqueKey)) {
          processedItems.add(uniqueKey);
          collaborationItems.push({
            id: `quote-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
            emoji: '💡',
            title: 'Quote of the Day',
            content: contentData.quoteOfTheDay,
            assignedUser: {
              full_name: collab.app_user_profiles.full_name,
              avatar_url: collab.app_user_profiles.avatar_url,
            },
          });
        }
      }
    });

    // 3. Prepared Speeches (collaboration_type = 'speech')
    const speechCollabs = collaborations.filter(collab => 
      collab.collaboration_type === 'speech' && collab.title
    );
    
    speechCollabs.forEach((collab, index) => {
      const uniqueKey = `speech-${collab.title}-${collab.user_id}`;
      if (!processedItems.has(uniqueKey)) {
        processedItems.add(uniqueKey);
        collaborationItems.push({
          id: `speech-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
          emoji: '🎤',
          title: 'Prepared Speaker - Speech',
          content: collab.title,
          assignedUser: {
            full_name: collab.app_user_profiles.full_name,
            avatar_url: collab.app_user_profiles.avatar_url,
          },
        });
      }
    });

    // 4. Educational Speaker (collaboration_type = 'education')
    const educationCollabs = collaborations.filter(collab => 
      collab.collaboration_type === 'education' && collab.title
    );
    
    educationCollabs.forEach((collab, index) => {
      const uniqueKey = `education-${collab.title}-${collab.user_id}`;
      if (!processedItems.has(uniqueKey)) {
        processedItems.add(uniqueKey);
        collaborationItems.push({
          id: `education-${collab.user_id}-${index}-${Date.now()}-${Math.random()}`,
          emoji: '🎓',
          title: 'Educational Speaker - Education Speech',
          content: collab.title,
          assignedUser: {
            full_name: collab.app_user_profiles.full_name,
            avatar_url: collab.app_user_profiles.avatar_url,
          },
        });
      }
    });

    return (
      <View style={styles.collaborationList}>
        {collaborationItems.length > 0 ? (
          collaborationItems.map((item) => (
            <View key={item.id} style={[styles.collaborationItem, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.collaborationLeft}>
                <Text style={styles.collaborationEmoji} maxFontSizeMultiplier={1.3}>{item.emoji}</Text>
                <View style={styles.collaborationContent}>
                  <Text style={[styles.collaborationTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {item.title}
                  </Text>
                  <Text style={[styles.collaborationText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {item.content}
                  </Text>
                </View>
              </View>
              <View style={styles.collaborationRight}>
                <View style={styles.collaborationAuthor}>
                  <View style={styles.authorAvatar}>
                    {item.assignedUser.avatar_url ? (
                      <Image 
                        source={{ uri: item.assignedUser.avatar_url }} 
                        style={styles.authorAvatarImage}
                      />
                    ) : (
                      <Text style={styles.authorInitials} maxFontSizeMultiplier={1.3}>
                        {item.assignedUser.full_name
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.authorName, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                    {item.assignedUser.full_name}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCollaborations}>
            <MessageSquare size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyCollaborationsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              No collaboration content yet
            </Text>
            <Text style={[styles.emptyCollaborationsSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Collaboration content will appear here when members add their contributions
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading meeting overview...</Text>
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
          Quick Overview
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={24} color={theme.colors.primary} />
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
                  {clubInfo.charter_date && (
                    <Text style={[styles.charterDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Est. {new Date(clubInfo.charter_date).getFullYear()}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Meeting Information Card */}
        <View style={[styles.meetingInfoSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.meetingInfoHeader}>
            <View style={[styles.meetingInfoIcon, { backgroundColor: '#3b82f6' + '20' }]}>
              <Calendar size={16} color="#3b82f6" />
            </View>
            <Text style={[styles.meetingInfoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meeting Information</Text>
          </View>
          
          <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {meeting.meeting_title}
          </Text>
          
          <View style={styles.meetingInfoList}>
            {/* Date */}
            <View style={styles.meetingInfoItem}>
              <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#3b82f6' }]}>
                <Calendar size={13} color="#ffffff" />
              </View>
              <View style={styles.meetingInfoItemContent}>
                <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Date</Text>
                <Text style={[styles.meetingInfoItemValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            </View>

            {/* Time */}
            {meeting.meeting_start_time && (
              <View style={styles.meetingInfoItem}>
                <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#f59e0b' }]}>
                  <Clock size={13} color="#ffffff" />
                </View>
                <View style={styles.meetingInfoItemContent}>
                  <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Time</Text>
                  <Text style={[styles.meetingInfoItemValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {meeting.meeting_start_time}
                    {meeting.meeting_end_time && ` - ${meeting.meeting_end_time}`}
                  </Text>
                </View>
              </View>
            )}

            {/* Meeting Number */}
            {meeting.meeting_number && (
              <View style={styles.meetingInfoItem}>
                <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#8b5cf6' }]}>
                  <FileText size={13} color="#ffffff" />
                </View>
                <View style={styles.meetingInfoItemContent}>
                  <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting Number</Text>
                  <Text style={[styles.meetingInfoItemValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    #{meeting.meeting_number}
                  </Text>
                </View>
              </View>
            )}

            {/* Meeting Link (for online and hybrid meetings) */}
            {(meeting.meeting_mode === 'online' || meeting.meeting_mode === 'hybrid') && meeting.meeting_link && (
              <View style={styles.meetingInfoItem}>
                <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#06b6d4' }]}>
                  <Link size={13} color="#ffffff" />
                </View>
                <View style={styles.meetingInfoItemContent}>
                  <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting Link</Text>
                  <TouchableOpacity onPress={handleMeetingLinkPress} activeOpacity={0.7}>
                    <Text style={[styles.meetingInfoItemLink, { color: '#06b6d4' }]} maxFontSizeMultiplier={1.3}>
                      Click here to join
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Format */}
            <View style={styles.meetingInfoItem}>
              <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#10b981' }]}>
                <MapPin size={13} color="#ffffff" />
              </View>
              <View style={styles.meetingInfoItemContent}>
                <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Format</Text>
                <Text style={[styles.meetingInfoItemValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatMeetingMode(meeting.meeting_mode)}
                </Text>
              </View>
            </View>

            {/* Location (for in-person and hybrid meetings) */}
            {(meeting.meeting_mode === 'in_person' || meeting.meeting_mode === 'hybrid') && meeting.meeting_location && (
              <View style={styles.meetingInfoItem}>
                <View style={[styles.meetingInfoItemIcon, { backgroundColor: '#ef4444' }]}>
                  <MapPin size={13} color="#ffffff" />
                </View>
                <View style={styles.meetingInfoItemContent}>
                  <Text style={[styles.meetingInfoItemLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Location</Text>
                  {isGoogleMapsLink(meeting.meeting_location) ? (
                    <TouchableOpacity onPress={handleLocationPress} activeOpacity={0.7}>
                      <Text style={[styles.meetingInfoItemLink, { color: '#ef4444' }]} maxFontSizeMultiplier={1.3}>
                        {meeting.meeting_location}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.meetingInfoItemValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {meeting.meeting_location}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: meeting.meeting_status === 'open' ? '#10b981' : '#6b7280' }
            ]}>
              <Text style={styles.statusText} maxFontSizeMultiplier={1.3}>
                {meeting.meeting_status === 'open' ? 'Open Meeting' : 'Closed Meeting'}
              </Text>
            </View>
          </View>
        </View>

        {/* Booked Roles Section */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#10b981' + '20' }]}>
              <Users size={20} color="#10b981" />
            </View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Booked Roles</Text>
          </View>
          
          {bookedRoles.length > 0 ? (
            <View style={styles.bookedRolesList}>
              {bookedRoles.map((role) => (
                <View key={role.id} style={[styles.bookedRoleItem, { backgroundColor: theme.colors.background }]}>
                  <View style={styles.bookedRoleLeft}>
                    <View style={styles.bookedRoleAvatar}>
                      {role.app_user_profiles.avatar_url ? (
                        <Image 
                          source={{ uri: role.app_user_profiles.avatar_url }} 
                          style={styles.bookedRoleAvatarImage}
                        />
                      ) : (
                        <Text style={styles.bookedRoleInitials} maxFontSizeMultiplier={1.3}>
                          {role.app_user_profiles.full_name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.bookedRoleInfo}>
                      <Text style={[styles.bookedRoleName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                        {role.role_name}
                      </Text>
                      <Text style={[styles.bookedRoleUser, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {role.app_user_profiles.full_name}
                      </Text>
                      {role.role_classification && (
                        <Text style={[styles.bookedRoleClassification, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {role.role_classification}
                        </Text>
                      )}
                    </View>
                  </View>
                  {role.booked_at && (
                    <View style={styles.bookedRoleRight}>
                      <Text style={[styles.bookedRoleTime, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Booked {new Date(role.booked_at).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyBookedRoles}>
              <Users size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyBookedRolesText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No roles booked yet
              </Text>
              <Text style={[styles.emptyBookedRolesSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Booked roles will appear here when members sign up for roles
              </Text>
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
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
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clubNumber: {
    fontSize: 14,
    fontWeight: '500',
  },
  charterDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  meetingInfoSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 13,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  meetingInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },
  meetingInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  meetingInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 19,
    letterSpacing: -0.5,
  },
  meetingInfoList: {
    gap: 13,
  },
  meetingInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  meetingInfoItemIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  meetingInfoItemContent: {
    flex: 1,
  },
  meetingInfoItemLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  meetingInfoItemValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  meetingInfoItemLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  statusContainer: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  bookedRolesList: {
    gap: 12,
  },
  bookedRoleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bookedRoleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bookedRoleAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookedRoleAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  bookedRoleInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  bookedRoleInfo: {
    flex: 1,
  },
  bookedRoleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  bookedRoleUser: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  bookedRoleClassification: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  bookedRoleRight: {
    alignItems: 'flex-end',
  },
  bookedRoleTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyBookedRoles: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyBookedRolesText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBookedRolesSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 40,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
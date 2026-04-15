import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Calendar, Clock, MapPin, Star, MessageSquare, CreditCard as Edit3, User } from 'lucide-react-native';
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
}

interface MeetingFeedback {
  id: string;
  meeting_id: string;
  club_id: string;
  user_id: string;
  overall_rating: number;
  engagement_rating: number;
  organization_rating: number;
  environment_rating: number;
  recommendation_rating: number;
  comments: string | null;
  created_at: string;
  updated_at: string;
  app_user_profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export default function FeedbackCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [allFeedback, setAllFeedback] = useState<MeetingFeedback[]>([]);
  const [userFeedback, setUserFeedback] = useState<MeetingFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (meetingId) {
      loadFeedbackCornerData();
    }
  }, [meetingId]);

  // Refresh data when screen comes into focus (e.g., returning from edit)
  useFocusEffect(
    useCallback(() => {
      if (meetingId) {
        console.log('Screen focused, refreshing feedback data...');
        loadFeedbackCornerData();
      }
    }, [meetingId])
  );

  const loadFeedbackCornerData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadAllFeedback(),
        loadUserFeedback()
      ]);
    } catch (error) {
      console.error('Error loading feedback corner data:', error);
      Alert.alert('Error', 'Failed to load feedback corner data');
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

  const loadAllFeedback = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_feedbackcorner')
        .select(`
          *,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading all feedback:', error);
        return;
      }

      setAllFeedback(data || []);
    } catch (error) {
      console.error('Error loading all feedback:', error);
    }
  };

  const loadUserFeedback = async () => {
    if (!meetingId || !user) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_feedbackcorner')
        .select(`
          *,
          app_user_profiles (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user feedback:', error);
        return;
      }

      if (data) {
        setUserFeedback(data);
      }
    } catch (error) {
      console.error('Error loading user feedback:', error);
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

  const handleGiveFeedback = () => {
    router.push(`/feedback-form?meetingId=${meetingId}`);
  };

  const StarRating = ({ rating, size = 16 }: { rating: number; size?: number }) => (
    <View style={styles.starRating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= rating ? '#fbbf24' : '#d1d5db'}
          fill={star <= rating ? '#fbbf24' : 'transparent'}
        />
      ))}
    </View>
  );

  const FeedbackCard = ({ feedback }: { feedback: MeetingFeedback }) => (
    <View style={[styles.feedbackCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={styles.feedbackHeader}>
        <View style={styles.feedbackUser}>
          <View style={styles.userAvatar}>
            {feedback.app_user_profiles.avatar_url ? (
              <Image
                source={{ uri: feedback.app_user_profiles.avatar_url }}
                style={styles.userAvatarImage}
              />
            ) : (
              <Text style={styles.userInitials} maxFontSizeMultiplier={1.3}>
                {feedback.app_user_profiles.full_name
                  .split(' ')
                  .map(name => name[0])
                  .join('')
                  .toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {feedback.app_user_profiles.full_name}
            </Text>
            <Text style={[styles.feedbackDate, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {new Date(feedback.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        {/* Edit button for user's own feedback */}
        {feedback.user_id === user?.id && (
          <TouchableOpacity
            style={[styles.editFeedbackButton, { backgroundColor: '#f0f9ff' }]}
            onPress={() => router.push(`/feedback-form?meetingId=${meetingId}&edit=true`)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit3 size={16} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.ratingsGrid}>
        <View style={styles.ratingItem}>
          <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Overall experience</Text>
          <StarRating rating={feedback.overall_rating} size={16} />
        </View>
        <View style={styles.ratingItem}>
          <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting engagement</Text>
          <StarRating rating={feedback.engagement_rating} size={16} />
        </View>
        <View style={styles.ratingItem}>
          <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting execution</Text>
          <StarRating rating={feedback.organization_rating} size={16} />
        </View>
        <View style={styles.ratingItem}>
          <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Club environment</Text>
          <StarRating rating={feedback.environment_rating} size={16} />
        </View>
        <View style={styles.ratingItem}>
          <Text style={[styles.ratingLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Recommend the club</Text>
          <StarRating rating={feedback.recommendation_rating} size={16} />
        </View>
      </View>

      {feedback.comments && (
        <View style={[styles.commentsSection, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.commentsLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Comments</Text>
          <Text style={[styles.commentsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {feedback.comments}
          </Text>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading feedback corner...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Feedback Corner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.masterBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Meeting */}
          <View style={styles.meetingCard}>
            <View style={styles.meetingHeader}>
              <View style={[styles.meetingIcon, { backgroundColor: '#a855f7' + '20' }]}>
                <MessageSquare size={20} color="#a855f7" />
              </View>
              <View style={styles.meetingInfo}>
                <Text style={[styles.meetingTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {meeting.meeting_title}
                </Text>
                <View style={styles.meetingMeta}>
                  <View style={styles.meetingDate}>
                    <Calendar size={12} color={theme.colors.textSecondary} />
                    <Text style={[styles.meetingDateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Text>
                  </View>
                  {meeting.meeting_number && (
                    <Text style={[styles.meetingNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      #{meeting.meeting_number}
                    </Text>
                  )}
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
                    {formatMeetingMode(meeting.meeting_mode)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />

          {/* All Feedback */}
          <View style={styles.allFeedbackSection}>
            <View style={styles.allFeedbackHeader}>
              <Text style={[styles.allFeedbackTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                All Feedback ({allFeedback.length})
              </Text>
              {!userFeedback && (
                <TouchableOpacity
                  style={[styles.giveFeedbackButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleGiveFeedback}
                >
                  <Star size={16} color="#ffffff" />
                  <Text style={styles.giveFeedbackButtonText} maxFontSizeMultiplier={1.3}>Give Feedback</Text>
                </TouchableOpacity>
              )}
            </View>

            {allFeedback.length > 0 ? (
              allFeedback.map((feedback) => (
                <FeedbackCard key={feedback.id} feedback={feedback} />
              ))
            ) : (
              <View style={styles.noFeedbackState}>
                <MessageSquare size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.noFeedbackStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No feedback yet
                </Text>
                <Text style={[styles.noFeedbackStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Be the first to share your thoughts about this meeting
                </Text>
              </View>
            )}
          </View>
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
  masterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionDivider: {
    height: 1,
  },
  meetingCard: {
    padding: 20,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingIcon: {
    width: 50,
    height: 50,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  meetingDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingDateText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  meetingNumber: {
    fontSize: 13,
    fontWeight: '500',
  },
  meetingTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingTimeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  meetingMode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingModeText: {
    fontSize: 13,
    marginLeft: 4,
  },
  allFeedbackSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  allFeedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  allFeedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  giveFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 0,
  },
  giveFeedbackButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  feedbackCard: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedbackUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 0,
  },
  userInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  feedbackDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  editFeedbackButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  ratingItem: {
    alignItems: 'center',
    minWidth: '30%',
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  starRating: {
    flexDirection: 'row',
    gap: 2,
  },
  commentsSection: {
    borderRadius: 0,
    padding: 12,
    marginTop: 8,
  },
  commentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  commentsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  noFeedbackState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noFeedbackStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noFeedbackStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
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
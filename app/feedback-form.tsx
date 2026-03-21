import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Star, Calendar, Clock, MapPin } from 'lucide-react-native';

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

interface FeedbackForm {
  overall_rating: number;
  engagement_rating: number;
  organization_rating: number;
  environment_rating: number;
  recommendation_rating: number;
  comments: string;
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
}

interface RatingQuestion {
  key: keyof FeedbackForm;
  question: string;
  labels: string[];
}

export default function FeedbackForm() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const isEditing = params.edit === 'true';
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [userFeedback, setUserFeedback] = useState<MeetingFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    overall_rating: 0,
    engagement_rating: 0,
    organization_rating: 0,
    environment_rating: 0,
    recommendation_rating: 0,
    comments: '',
  });

  const ratingQuestions: RatingQuestion[] = [
    {
      key: 'overall_rating',
      question: 'Overall, how satisfied are you with the Toastmasters meeting?',
      labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent']
    },
    {
      key: 'engagement_rating',
      question: 'How engaging were the speeches and evaluations?',
      labels: ['Not Engaging', 'Slightly Engaging', 'Moderately Engaging', 'Very Engaging', 'Extremely Engaging']
    },
    {
      key: 'organization_rating',
      question: 'How well was the meeting organized and run on time?',
      labels: ['Very Poor', 'Needs Improvement', 'Average', 'Good', 'Excellent']
    },
    {
      key: 'environment_rating',
      question: 'How welcoming and supportive was the club environment?',
      labels: ['Not Welcoming', 'Slightly Welcoming', 'Neutral', 'Welcoming', 'Very Welcoming']
    },
    {
      key: 'recommendation_rating',
      question: 'How likely are you to recommend our club to others?',
      labels: ['Not Likely', 'Unlikely', 'Neutral', 'Likely', 'Very Likely']
    }
  ];

  useEffect(() => {
    if (meetingId) {
      loadFeedbackData();
    }
  }, [meetingId]);

  const loadFeedbackData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadUserFeedback()
      ]);
    } catch (error) {
      console.error('Error loading feedback data:', error);
      Alert.alert('Error', 'Failed to load feedback data');
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

  const loadUserFeedback = async () => {
    if (!meetingId || !user) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_feedbackcorner')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user feedback:', error);
        return;
      }

      if (data) {
        setUserFeedback(data);
        setFeedbackForm({
          overall_rating: data.overall_rating,
          engagement_rating: data.engagement_rating,
          organization_rating: data.organization_rating,
          environment_rating: data.environment_rating,
          recommendation_rating: data.recommendation_rating,
          comments: data.comments || '',
        });
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error loading user feedback:', error);
    }
  };

  const updateRating = (key: keyof FeedbackForm, rating: number) => {
    setFeedbackForm(prev => ({ ...prev, [key]: rating }));
    if (!hasChanges) {
      setHasChanges(true);
    }
  };

  const updateComments = (text: string) => {
    if (text.length <= 1000) {
      setFeedbackForm(prev => ({ ...prev, comments: text }));
      if (!hasChanges) {
        setHasChanges(true);
      }
    }
  };

  const validateForm = (): boolean => {
    if (feedbackForm.overall_rating === 0) {
      Alert.alert('Error', 'Please rate the overall meeting');
      return false;
    }
    if (feedbackForm.engagement_rating === 0) {
      Alert.alert('Error', 'Please rate the engagement level');
      return false;
    }
    if (feedbackForm.organization_rating === 0) {
      Alert.alert('Error', 'Please rate the organization');
      return false;
    }
    if (feedbackForm.environment_rating === 0) {
      Alert.alert('Error', 'Please rate the club environment');
      return false;
    }
    if (feedbackForm.recommendation_rating === 0) {
      Alert.alert('Error', 'Please rate your likelihood to recommend');
      return false;
    }
    if (feedbackForm.comments.length > 1000) {
      Alert.alert('Error', 'Comments cannot exceed 1000 characters');
      return false;
    }
    return true;
  };

  const handleSaveFeedback = async () => {
    if (!validateForm() || !meetingId || !user?.currentClubId) return;

    setIsSaving(true);
    
    try {
      if (userFeedback) {
        // Update existing feedback
        const { error } = await supabase
          .from('app_meeting_feedbackcorner')
          .update({
            overall_rating: feedbackForm.overall_rating,
            engagement_rating: feedbackForm.engagement_rating,
            organization_rating: feedbackForm.organization_rating,
            environment_rating: feedbackForm.environment_rating,
            recommendation_rating: feedbackForm.recommendation_rating,
            comments: feedbackForm.comments.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userFeedback.id);

        if (error) {
          console.error('Error updating feedback:', error);
          Alert.alert('Error', 'Failed to update feedback');
          return;
        }

        Alert.alert('Success', 'Your feedback has been updated successfully!', [
          { text: 'OK', onPress: () => {
            // Force refresh by replacing the route to trigger useFocusEffect
            router.replace(`/feedback-corner?meetingId=${meetingId}`);
          }}
        ]);
      } else {
        // Create new feedback
        const { error } = await supabase
          .from('app_meeting_feedbackcorner')
          .insert([{
            meeting_id: meetingId,
            club_id: user.currentClubId,
            user_id: user.id,
            overall_rating: feedbackForm.overall_rating,
            engagement_rating: feedbackForm.engagement_rating,
            organization_rating: feedbackForm.organization_rating,
            environment_rating: feedbackForm.environment_rating,
            recommendation_rating: feedbackForm.recommendation_rating,
            comments: feedbackForm.comments.trim() || null,
          }]);

        if (error) {
          console.error('Error creating feedback:', error);
          Alert.alert('Error', 'Failed to save feedback');
          return;
        }

        Alert.alert('Success', 'Thank you for your feedback!', [
          { text: 'OK', onPress: () => {
            // Force refresh by replacing the route to trigger useFocusEffect
            router.replace(`/feedback-corner?meetingId=${meetingId}`);
          }}
        ]);
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
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

  const StarRating = ({ rating, onPress, size = 24 }: { 
    rating: number; 
    onPress: (rating: number) => void; 
    size?: number;
  }) => (
    <View style={styles.starRating}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          style={styles.starButton}
          onPress={() => onPress(star)}
        >
          <Star 
            size={size} 
            color={star <= rating ? '#f59e0b' : '#e5e7eb'} 
            fill={star <= rating ? '#f59e0b' : 'transparent'}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading feedback form...</Text>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {isEditing ? 'Edit Feedback' : 'Give Feedback'}
        </Text>
        <TouchableOpacity 
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: isSaving ? 0.7 : 1,
            }
          ]}
          onPress={handleSaveFeedback}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Meeting Information Card */}
        <View style={[styles.meetingCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.meetingHeader}>
            <View style={[styles.meetingIcon, { backgroundColor: '#a855f7' + '20' }]}>
              <Star size={20} color="#a855f7" />
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

        {/* Rating Questions */}
        <View style={[styles.ratingsSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Rate Your Experience
          </Text>
          
          {ratingQuestions.map((question, index) => (
            <View key={question.key} style={styles.questionSection}>
              <Text style={[styles.questionText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {index + 1}. {question.question}
              </Text>
              
              <View style={styles.ratingOptions}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <TouchableOpacity
                    key={rating}
                    style={[
                      styles.ratingOption,
                      {
                        backgroundColor: feedbackForm[question.key] === rating ? '#f59e0b' + '20' : theme.colors.background,
                        borderColor: feedbackForm[question.key] === rating ? '#f59e0b' : theme.colors.border,
                      }
                    ]}
                    onPress={() => updateRating(question.key, rating)}
                  >
                    <Star 
                      size={20} 
                      color={feedbackForm[question.key] === rating ? '#f59e0b' : '#e5e7eb'} 
                      fill={feedbackForm[question.key] === rating ? '#f59e0b' : 'transparent'}
                    />
                    <Text style={[
                      styles.ratingNumber,
                      { color: feedbackForm[question.key] === rating ? '#f59e0b' : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {rating}
                    </Text>
                    <Text style={[
                      styles.ratingLabel,
                      { color: feedbackForm[question.key] === rating ? '#f59e0b' : theme.colors.textSecondary }
                    ]} maxFontSizeMultiplier={1.3}>
                      {question.labels[rating - 1]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Comments Section */}
        <View style={[styles.commentsSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.commentsHeader}>
            <Text style={[styles.commentsTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Additional Comments (Optional)
            </Text>
            <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {feedbackForm.comments.length}/1000
            </Text>
          </View>
          <TextInput
            style={[styles.commentsInput, { 
              backgroundColor: theme.colors.background, 
              borderColor: theme.colors.border,
              color: theme.colors.text 
            }]}
            placeholder="Share any additional thoughts, suggestions, or specific feedback about the meeting..."
            placeholderTextColor={theme.colors.textSecondary}
            value={feedbackForm.comments}
            onChangeText={updateComments}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomPadding} />
      </ScrollView>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  meetingCard: {
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
  ratingsSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  questionSection: {
    marginBottom: 32,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 24,
  },
  ratingOptions: {
    gap: 8,
  },
  ratingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  ratingNumber: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 20,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  starRating: {
    flexDirection: 'row',
    gap: 2,
  },
  starButton: {
    padding: 2,
  },
  commentsSection: {
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
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  characterCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  commentsInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
    lineHeight: 22,
    textAlignVertical: 'top',
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
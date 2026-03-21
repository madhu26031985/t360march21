import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Phone, FileText, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react-native';

const REASON_OPTIONS = [
  'To improve public speaking skills',
  'To build confidence',
  'To develop leadership abilities',
  'To enhance communication and presentation skills',
  'To network and meet like-minded people',
];

export default function ClubJoinRequestScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();

  const clubId = params.clubId as string;
  const clubName = params.clubName as string;
  const clubNumber = params.clubNumber as string;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const getFinalReason = () => {
    return selectedReasons.join('\n');
  };

  const isValid = phoneNumber.trim().length >= 10 &&
                  selectedReasons.length > 0 &&
                  acceptedTerms;

  const handleSubmit = async () => {
    if (!user || !isValid) return;

    setIsSubmitting(true);
    try {
      const finalReason = getFinalReason();

      const { error } = await supabase
        .from('club_join_requests')
        .insert({
          user_id: user.id,
          club_id: clubId,
          phone_number: phoneNumber.trim(),
          reason: finalReason,
          status: 'pending',
        });

      if (error) {
        if (error.message.includes('2 active join requests')) {
          Alert.alert('Limit Reached', 'You can only have 2 active join requests at a time. Please withdraw an existing request first.');
        } else if (error.message.includes('already a member')) {
          Alert.alert('Already Member', 'You are already a member of this club or have a pending invitation.');
        } else {
          Alert.alert('Error', error.message);
        }
        return;
      }

      Alert.alert(
        'Request Submitted',
        `Your request to join ${clubName} has been submitted successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace({
                pathname: '/my-club-relationships',
                params: { tab: 'requests', refresh: Date.now().toString() }
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error submitting request:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Request to Join Club</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Club Info */}
          <View style={[styles.clubInfoCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.clubName, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
              {clubName}
            </Text>
            {clubNumber && (
              <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Club #{clubNumber}
              </Text>
            )}
          </View>

          {/* Important Notice */}
          <View style={[styles.noticeCard, { backgroundColor: '#fef3c7', borderColor: '#fbbf24' }]}>
            <View style={styles.noticeHeader}>
              <AlertCircle size={24} color="#92400e" />
              <Text style={[styles.noticeTitle, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                Important Information
              </Text>
            </View>
            <View style={styles.noticeContent}>
              <View style={styles.noticeItem}>
                <CheckCircle size={16} color="#92400e" />
                <Text style={[styles.noticeText, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                  You may receive a call or email from the Executive Committee of the club
                </Text>
              </View>
              <View style={styles.noticeItem}>
                <CheckCircle size={16} color="#92400e" />
                <Text style={[styles.noticeText, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                  Once the club ExComm reviews your request, they will add you to the club if approved
                </Text>
              </View>
              <View style={styles.noticeItem}>
                <CheckCircle size={16} color="#92400e" />
                <Text style={[styles.noticeText, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                  Requests expire after 4 days if not reviewed
                </Text>
              </View>
              <View style={styles.noticeItem}>
                <XCircle size={16} color="#92400e" />
                <Text style={[styles.noticeText, { color: '#92400e' }]} maxFontSizeMultiplier={1.3}>
                  To disconnect from the club later, click the red X next to the club name
                </Text>
              </View>
            </View>
          </View>

          {/* Request Details Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Request Details
            </Text>

            {/* Phone Number Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Phone Number <Text style={styles.required} maxFontSizeMultiplier={1.3}>*</Text>
              </Text>
              <View style={[styles.inputContainer, {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }]}>
                <Phone size={20} color={theme.colors.textSecondary} />
                <TextInput
                  style={[styles.input, { color: theme.colors.text }]}
                  placeholder="Enter your phone number"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  maxLength={15}
                  editable={!isSubmitting}
                />
              </View>
              <Text style={[styles.hint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Include country code (e.g., +1234567890)
              </Text>
            </View>

            {/* Reason Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Why do you want to join? <Text style={styles.required} maxFontSizeMultiplier={1.3}>*</Text>
              </Text>
              <Text style={[styles.hint, { color: theme.colors.textSecondary, marginBottom: 12 }]} maxFontSizeMultiplier={1.3}>
                Select one or more options below
              </Text>

              {/* Reason Options */}
              {REASON_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.reasonOption,
                    {
                      backgroundColor: selectedReasons.includes(option)
                        ? theme.colors.primary + '15'
                        : theme.colors.background,
                      borderColor: selectedReasons.includes(option)
                        ? theme.colors.primary
                        : theme.colors.border,
                    }
                  ]}
                  onPress={() => toggleReason(option)}
                  disabled={isSubmitting}
                >
                  <View style={[
                    styles.reasonCheckbox,
                    {
                      backgroundColor: selectedReasons.includes(option)
                        ? theme.colors.primary
                        : 'transparent',
                      borderColor: selectedReasons.includes(option)
                        ? theme.colors.primary
                        : theme.colors.border,
                    }
                  ]}>
                    {selectedReasons.includes(option) && (
                      <CheckCircle size={16} color="#ffffff" />
                    )}
                  </View>
                  <Text style={[
                    styles.reasonOptionText,
                    {
                      color: selectedReasons.includes(option)
                        ? theme.colors.text
                        : theme.colors.textSecondary
                    }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}

            </View>
          </View>

          {/* Terms Acceptance */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            disabled={isSubmitting}
          >
            <View style={[styles.checkbox, {
              backgroundColor: acceptedTerms ? theme.colors.primary : theme.colors.background,
              borderColor: theme.colors.border
            }]}>
              {acceptedTerms && <CheckCircle size={18} color="#ffffff" />}
            </View>
            <Text style={[styles.termsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              By clicking Submit, I agree that the club's Executive Committee may contact me, and I confirm that all the information provided above is accurate. I am also willing to share my phone number and email address with the club for communication purposes.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border
        }]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border
            }]}
            onPress={() => router.back()}
            disabled={isSubmitting}
          >
            <Text style={[styles.buttonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.submitButton,
              { backgroundColor: theme.colors.primary },
              (!isValid || isSubmitting) && styles.buttonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            <Text style={[styles.buttonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  clubInfoCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  clubName: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  clubNumber: {
    fontSize: 16,
    textAlign: 'center',
  },
  noticeCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 24,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  noticeContent: {
    gap: 12,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
  },
  textAreaIcon: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  textArea: {
    fontSize: 16,
    minHeight: 120,
    paddingLeft: 32,
  },
  hint: {
    fontSize: 13,
    marginTop: 6,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  reasonCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonOptionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1.5,
  },
  submitButton: {
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Linking, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Calendar, Hash, Save, CircleCheck as CheckCircle, Crown, Video, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import { Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ClubForm {
  name: string;
  club_number: string;
  charter_date: string;
}

export default function CreateClub() {
  const { theme } = useTheme();
  const { user, refreshUserProfile } = useAuth();

  const [clubForm, setClubForm] = useState<ClubForm>({
    name: '',
    club_number: '',
    charter_date: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const updateFormField = (field: keyof ClubForm, value: string) => {
    setClubForm(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const parseDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Handle different input formats
    if (dateString.includes('/')) {
      // MM/DD/YYYY format
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    } else if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Already in YYYY-MM-DD format
      return dateString;
    } else if (dateString.match(/^\d{8}$/)) {
      // YYYYMMDD format
      return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
    }
    
    return dateString;
  };

  const handleDateInput = (dateString: string) => {
    if (Platform.OS === 'web') {
      // Web date input gives us YYYY-MM-DD format directly
      updateFormField('charter_date', dateString);
    } else {
      // Mobile input - handle YYYYMMDD format and convert to YYYY-MM-DD
      const numbersOnly = dateString.replace(/\D/g, '');

      if (numbersOnly.length === 8) {
        // Convert YYYYMMDD to YYYY-MM-DD
        const year = numbersOnly.slice(0, 4);
        const month = numbersOnly.slice(4, 6);
        const day = numbersOnly.slice(6, 8);
        const formattedDate = `${year}-${month}-${day}`;
        updateFormField('charter_date', formattedDate);
      } else if (numbersOnly.length < 8) {
        // Show partial input as user types
        updateFormField('charter_date', numbersOnly);
      }
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (date) {
      setSelectedDate(date);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      updateFormField('charter_date', formattedDate);
    }
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Select date';

    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const validateForm = (): boolean => {
    if (!clubForm.name.trim()) {
      Alert.alert('Error', 'Please enter a club name');
      return false;
    }

    if (!clubForm.club_number.trim()) {
      Alert.alert('Error', 'Please enter a club number');
      return false;
    }

    if (!clubForm.charter_date) {
      Alert.alert('Error', 'Please select a charter date');
      return false;
    }

    // Validate club number is numeric
    if (!/^\d+$/.test(clubForm.club_number.trim())) {
      Alert.alert('Error', 'Club number must contain only numbers');
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    setShowConfirmModal(true);
  };

  const handleConfirmCreation = async () => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsLoading(true);
    setShowConfirmModal(false);

    try {
      console.log('Creating new club with data:', clubForm);

      // Ensure user profile exists in app_user_profiles before creating club
      console.log('Checking if user profile exists in app_user_profiles...');
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('app_user_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileCheckError) {
        console.error('Error checking user profile:', profileCheckError);
        Alert.alert('Error', 'Failed to verify user profile. Please try again.');
        setIsLoading(false);
        return;
      }

      if (!existingProfile) {
        console.log('User profile does not exist, creating it now...');

        // Create the user profile
        const { error: createProfileError } = await supabase
          .from('app_user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.fullName || 'User',
            role: 'new_user',
            is_active: true,
          });

        if (createProfileError) {
          console.error('Error creating user profile:', createProfileError);
          Alert.alert('Error', 'Failed to create user profile. Please contact support.');
          setIsLoading(false);
          return;
        }

        console.log('User profile created successfully');
      } else {
        console.log('User profile already exists');
      }

      // Create the club
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .insert({
          name: clubForm.name.trim(),
          club_number: clubForm.club_number.trim(),
          charter_date: parseDate(clubForm.charter_date),
          created_by: user.id,
          active: true, // Club is active immediately
        })
        .select()
        .single();

      if (clubError) {
        console.error('Error creating club:', clubError);
        
        if (clubError.code === '23505') {
          Alert.alert('Error', 'A club with this number already exists. Please use a different club number.');
        } else if (clubError.code === '42501') {
          Alert.alert('Error', 'You do not have permission to create clubs. Please contact your administrator.');
        } else {
          Alert.alert('Error', `Failed to create club: ${clubError.message}`);
        }
        return;
      }

      console.log('Club created successfully:', clubData);

      // Add the user as ExComm member of the new club
      console.log('Creating club relationship with data:', {
        user_id: user.id,
        club_id: clubData.id,
        role: 'excomm',
        is_authenticated: true,
      });

      const { error: relationshipError, data: relationshipData } = await supabase
        .from('app_club_user_relationship')
        .insert({
          user_id: user.id,
          club_id: clubData.id,
          role: 'excomm',
          is_authenticated: true,
        })
        .select();

      if (relationshipError) {
        console.error('Error creating club relationship:', relationshipError);
        console.error('Error details:', {
          message: relationshipError.message,
          code: relationshipError.code,
          details: relationshipError.details,
          hint: relationshipError.hint,
        });
        Alert.alert('Error', `Club created but failed to assign membership: ${relationshipError.message}. Please contact support.`);
        return;
      }

      console.log('Club relationship created successfully:', relationshipData);

      console.log('Club relationship created successfully');

      // Show success modal
      setShowSuccessModal(true);

      // Refresh user profile to update club list
      setTimeout(() => {
        refreshUserProfile();
      }, 1000);

    } catch (error) {
      console.error('Error creating club:', error);
      Alert.alert('Error', 'An unexpected error occurred while creating the club');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = async () => {
    setShowSuccessModal(false);
    await refreshUserProfile();
    router.replace('/(tabs)/admin');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Create New Club</Text>
        <View style={styles.helpButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: theme.colors.surface }]}>
          <Image
            source={require('@/assets/images/yy.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Club automation tool
          </Text>
          <Text style={[styles.heroTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Start Your Journey
          </Text>
        </View>

        {/* Form Section */}
        <View style={[styles.formSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Information</Text>
          
          {/* Club Name */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Name *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Building2 size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter club name"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubForm.name}
                onChangeText={(text) => updateFormField('name', text)}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Club Number */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Number *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Hash size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter club number"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubForm.club_number}
                onChangeText={(text) => updateFormField('club_number', text)}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Charter Date */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Charter Date *</Text>
            {Platform.OS === 'web' ? (
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Calendar size={16} color={theme.colors.textSecondary} />
                <input
                  type="date"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: theme.colors.text,
                    fontSize: 16,
                    fontWeight: '500',
                    padding: 0,
                    margin: 0,
                  }}
                  value={clubForm.charter_date.match(/^\d{4}-\d{2}-\d{2}$/) ? clubForm.charter_date : ''}
                  onChange={(e) => updateFormField('charter_date', e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color={theme.colors.textSecondary} />
                <Text style={[
                  styles.datePickerText,
                  { color: clubForm.charter_date ? theme.colors.text : theme.colors.textSecondary }
                ]} maxFontSizeMultiplier={1.3}>
                  {formatDisplayDate(clubForm.charter_date)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              {
                backgroundColor: '#3b82f6',
                borderColor: '#3b82f6',
                opacity: (clubForm.name.trim() && clubForm.club_number.trim() && clubForm.charter_date) ? 1 : 0.5,
              }
            ]}
            onPress={handleSubmit}
            disabled={!clubForm.name.trim() || !clubForm.club_number.trim() || !clubForm.charter_date}
          >
            <Save size={16} color="#ffffff" />
            <Text style={[
              styles.submitButtonText,
              { color: "#ffffff" }
            ]} maxFontSizeMultiplier={1.3}>
              Create Club
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={[styles.infoSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.congratsText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            🚀 Congratulations on taking your first step towards a smarter, fully digital club experience! 🌟🤝📱
          </Text>

          <View style={styles.infoHeader}>
            <View style={[styles.infoIcon, { backgroundColor: '#8b5cf6' + '20' }]}>
              <Crown size={20} color="#8b5cf6" />
            </View>
            <Text style={[styles.infoTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>What happens next?</Text>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>1</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Your club will be created in the system
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>2</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                You'll become the ExCom of this club
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>3</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Explore the Admin Panel to get started
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>4</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Update your club details in Club Operations. These details will be visible to members in the Club tab
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>5</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Add users using Manage Club Members
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>6</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Create meetings using Meeting Operations. Meetings will appear under the Meetings tab for members
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>7</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Seamlessly manage meetings from the Meeting tab
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>8</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Create polls using Voting Operations. Members can participate through Live Voting during the meeting
              </Text>
            </View>

            <View style={styles.infoItem}>
              <View style={[styles.stepNumber, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.stepNumberText} maxFontSizeMultiplier={1.3}>9</Text>
              </View>
              <Text style={[styles.infoItemText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Close the voting and publish results instantly
              </Text>
            </View>
          </View>

          <Text style={[styles.helpTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Need help getting started?
          </Text>

          <View style={styles.supportLinks}>
            <TouchableOpacity
              style={[styles.supportLink, { backgroundColor: theme.colors.background }]}
              onPress={() => Linking.openURL('https://calendly.com/t360-support/demo')}
            >
              <Calendar size={20} color={theme.colors.primary} />
              <Text style={[styles.supportLinkText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Book an onboarding call
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportLink, { backgroundColor: theme.colors.background }]}
              onPress={() => Linking.openURL('https://t360.in/demo')}
            >
              <Video size={20} color={theme.colors.primary} />
              <Text style={[styles.supportLinkText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                Watch product demo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.supportLink, { backgroundColor: theme.colors.background }]}
              onPress={() => Linking.openURL('https://api.whatsapp.com/send/?phone=9597491113&text&type=phone_number&app_absent=0')}
            >
              <MessageCircle size={20} color={theme.colors.primary} />
              <Text style={[styles.supportLinkText, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>
                WhatsApp support
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.confirmIconWrapper}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.confirmLogo}
                resizeMode="contain"
              />
            </View>

            <Text style={[styles.confirmTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Confirm Club Creation
            </Text>

            <Text style={[styles.confirmMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Please verify all information is correct:
            </Text>

            <View style={[styles.confirmDetails, { backgroundColor: theme.colors.background }]}>
              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Club Name:</Text>
                <Text style={[styles.confirmValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{clubForm.name}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Club Number:</Text>
                <Text style={[styles.confirmValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>#{clubForm.club_number}</Text>
              </View>

              <View style={styles.confirmRow}>
                <Text style={[styles.confirmLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Charter Date:</Text>
                <Text style={[styles.confirmValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{clubForm.charter_date}</Text>
              </View>
            </View>

            <View style={[styles.roleNotice, { backgroundColor: '#8b5cf6' + '10' }]}>
              <Crown size={16} color="#8b5cf6" />
              <Text style={[styles.roleNoticeText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                You will become the Executive Committee member of this club
              </Text>
            </View>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelButtonText} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, styles.createButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleConfirmCreation}
                disabled={isLoading}
              >
                <Text style={styles.createButtonText} maxFontSizeMultiplier={1.3}>
                  {isLoading ? 'Creating...' : 'Create Club'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.successModal, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.successIcon, { backgroundColor: theme.colors.success + '20' }]}>
              <CheckCircle size={32} color={theme.colors.success} />
            </View>
            
            <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club Created Successfully!
            </Text>
            
            <Text style={[styles.successMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Congratulations! {clubForm.name} has been created and you are now the Executive Committee member.
            </Text>

            <View style={[styles.successDetails, { backgroundColor: theme.colors.background }]}>
              <View style={styles.successRow}>
                <Building2 size={16} color={theme.colors.primary} />
                <Text style={[styles.successDetailText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {clubForm.name}
                </Text>
              </View>
              
              <View style={styles.successRow}>
                <Hash size={16} color={theme.colors.primary} />
                <Text style={[styles.successDetailText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Club #{clubForm.club_number}
                </Text>
              </View>
              
              <View style={styles.successRow}>
                <Crown size={16} color="#8b5cf6" />
                <Text style={[styles.successDetailText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Executive Committee Member
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSuccessClose}
            >
              <Text style={styles.continueButtonText} maxFontSizeMultiplier={1.3}>Continue to Admin panel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker for Mobile */}
      {showDatePicker && Platform.OS !== 'web' && (
        Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerModalOverlay}>
              <View style={[styles.datePickerModal, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.datePickerHeader, { borderBottomColor: theme.colors.border }]}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={[styles.datePickerDoneButton, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.3}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor={theme.colors.text}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )
      )}
      </KeyboardAvoidingView>
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
  helpButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 90,
    height: 90,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  formSection: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  formField: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 18,
    borderWidth: 1,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  infoSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoList: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoItemText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  congratsText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'left',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'left',
  },
  supportLinks: {
    gap: 12,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  supportLinkText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'left',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  confirmIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmLogo: {
    width: 70,
    height: 70,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  confirmMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmDetails: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  roleNoticeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  cancelButton: {
    backgroundColor: '#E2E8F0',
  },
  createButton: {
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successModal: {
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  successDetails: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successDetailText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  continueButton: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  datePickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  datePickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  datePickerDoneButton: {
    fontSize: 17,
    fontWeight: '600',
  },
});
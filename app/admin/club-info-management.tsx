import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Animated, Easing, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useRef } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, Building2, Crown, User, Shield, Eye, UserCheck, ChevronDown, MapPin, Info } from 'lucide-react-native';
import { useWindowDimensions } from 'react-native';
import CountryPicker from '@/components/CountryPicker';
import TimezonePicker from '@/components/TimezonePicker';

interface ClubInfoData {
  // Read-only fields from clubs table
  club_name: string;
  club_number: string | null;
  charter_date: string | null;
  
  // Editable fields from club_profiles table
  club_status: string | null;
  club_type: string | null;
  club_mission: string | null;
  banner_color: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  division: string | null;
  area: string | null;
  time_zone: string | null;
  address: string | null;
  pin_code: string | null;
  google_location_link: string | null;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
  charter_date: string | null;
}

export default function ClubInfoManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [clubData, setClubData] = useState<ClubInfoData>({
    club_name: '',
    club_number: null,
    charter_date: null,
    club_status: null,
    club_type: null,
    club_mission: null,
    banner_color: null,
    city: null,
    country: null,
    region: null,
    district: null,
    division: null,
    area: null,
    time_zone: null,
    address: null,
    pin_code: null,
    google_location_link: null,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showClubTypeModal, setShowClubTypeModal] = useState(false);
  const [showClubStatusModal, setShowClubStatusModal] = useState(false);
  const [showBannerColorModal, setShowBannerColorModal] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'location' | 'moreInfo'>('info');
  const tabTransition = useRef(new Animated.Value(1)).current;
  const tabOrder: Array<'info' | 'location' | 'moreInfo'> = ['info', 'location', 'moreInfo'];

  const clubTypeOptions = [
    { value: 'community', label: 'Community' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'others', label: 'Others' },
  ];

  const clubStatusOptions = [
    { value: 'Active', label: 'Active' },
    { value: 'Inactive', label: 'Inactive' },
    { value: 'Suspended', label: 'Suspended' },
    { value: 'Closed', label: 'Closed' },
  ];

  const bannerColorOptions = [
    {
      value: '#A9B2B1',
      label: 'Cool Gray',
      hex: '#A9B2B1',
      pantone: 'Pantone 7543',
      cmyk: 'C30 M16 Y14 K0',
      rgb: 'R169 G178 B177'
    },
    { 
      value: '#772432', 
      label: 'True Maroon', 
      hex: '#772432',
      pantone: 'Pantone 188',
      cmyk: 'C12 M95 Y59 K54',
      rgb: 'R119 G36 B50'
    },
    { 
      value: '#004165', 
      label: 'Loyal Blue', 
      hex: '#004165',
      pantone: 'Pantone 302',
      cmyk: 'C100 M43 Y12 K56',
      rgb: 'R0 G65 B101'
    },
    {
      value: '#F2DF74',
      label: 'Happy Yellow',
      hex: '#F2DF74',
      pantone: 'Pantone 127',
      cmyk: 'C0 M8 Y66 K0',
      rgb: 'R242 G223 B116'
    },
    {
      value: '#000000',
      label: 'Black',
      hex: '#000000',
      pantone: 'Pantone Black',
      cmyk: 'C0 M0 Y0 K100',
      rgb: 'R0 G0 B0'
    },
    {
      value: '#FFFFFF',
      label: 'White',
      hex: '#FFFFFF',
      pantone: 'White',
      cmyk: 'C0 M0 Y0 K0',
      rgb: 'R255 G255 B255'
    },
  ];

  useEffect(() => {
    console.log('ClubInfoManagement mounted, loading data...');
    loadClubData();
  }, []);

  const loadClubData = async () => {
    console.log('Starting loadClubData...');
    
    if (!user?.currentClubId) {
      console.log('No current club ID found');
      setIsLoading(false);
      return;
    }

    console.log('Loading data for club ID:', user.currentClubId);

    try {
      // Load basic club info from clubs table
      console.log('Fetching club data...');
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('id, name, club_number, charter_date')
        .eq('id', user.currentClubId)
        .single();

      console.log('Club data result:', { clubData, clubError });

      if (clubError) {
        console.error('Error loading club info:', clubError);
        Alert.alert('Error', 'Failed to load club information');
        setIsLoading(false);
        return;
      }

      setClubInfo(clubData);

      // Load extended club profile data
      console.log('Fetching club profile data...');
      const { data: profileData, error: profileError } = await supabase
        .from('club_profiles')
        .select(`
          club_status, club_type, club_mission, city, country, region,
          district, division, area, time_zone, address, pin_code,
          google_location_link, club_name, club_number, charter_date, banner_color
        `)
        .eq('club_id', user.currentClubId)
        .single();

      console.log('Profile data result:', { profileData, profileError });

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading club profile:', profileError);
      }

      // Combine data from both tables
      const combinedData: ClubInfoData = {
        club_name: (clubData as any).name,
        club_number: (clubData as any).club_number,
        charter_date: (clubData as any).charter_date,
        club_status: (profileData as any)?.club_status || null,
        club_type: (profileData as any)?.club_type || null,
        club_mission: (profileData as any)?.club_mission || null,
        banner_color: (profileData as any)?.banner_color || null,
        city: (profileData as any)?.city || null,
        country: (profileData as any)?.country || null,
        region: (profileData as any)?.region || null,
        district: (profileData as any)?.district || null,
        division: (profileData as any)?.division || null,
        area: (profileData as any)?.area || null,
        time_zone: (profileData as any)?.time_zone || null,
        address: (profileData as any)?.address || null,
        pin_code: (profileData as any)?.pin_code || null,
        google_location_link: (profileData as any)?.google_location_link || null,
      };

      console.log('Setting combined club data:', combinedData);
      setClubData(combinedData);
    } catch (error) {
      console.error('Error loading club data:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      console.log('Setting loading to false');
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof ClubInfoData, value: string) => {
    setClubData(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getClubTypeLabel = () => {
    const option = clubTypeOptions.find(opt => opt.value === clubData.club_type);
    return option?.label || 'Select club type';
  };

  const getClubStatusLabel = () => {
    const option = clubStatusOptions.find(opt => opt.value === clubData.club_status);
    return option?.label || 'Select club status';
  };

  const getBannerColorLabel = () => {
    const option = bannerColorOptions.find(opt => opt.value === clubData.banner_color);
    return option?.label || 'Select banner color';
  };

  const switchTab = (nextTab: 'info' | 'location' | 'moreInfo') => {
    if (nextTab === activeTab) return;
    Animated.timing(tabTransition, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(nextTab);
      Animated.timing(tabTransition, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  };

  const tabPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 && Math.abs(gesture.dy) < 12,
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 60) return;
          const currentIndex = tabOrder.indexOf(activeTab);
          if (gesture.dx < 0 && currentIndex < tabOrder.length - 1) {
            switchTab(tabOrder[currentIndex + 1]);
          } else if (gesture.dx > 0 && currentIndex > 0) {
            switchTab(tabOrder[currentIndex - 1]);
          }
        },
      }),
    [activeTab]
  );

  const handleSave = async () => {
    if (!user?.currentClubId) {
      Alert.alert('Error', 'No club selected');
      return;
    }

    console.log('Starting save process...');
    setIsSaving(true);

    try {
      // Prepare update data for club_profiles (excluding read-only fields)
      const updateData = {
        club_status: clubData.club_status?.trim() || null,
        club_type: clubData.club_type || null,
        club_mission: clubData.club_mission?.trim() || null,
        banner_color: clubData.banner_color || null,
        city: clubData.city?.trim() || null,
        country: clubData.country?.trim() || null,
        region: clubData.region?.trim() || null,
        district: clubData.district?.trim() || null,
        division: clubData.division?.trim() || null,
        area: clubData.area?.trim() || null,
        time_zone: clubData.time_zone?.trim() || null,
        address: clubData.address?.trim() || null,
        pin_code: clubData.pin_code?.trim() || null,
        google_location_link: clubData.google_location_link?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      console.log('Update data prepared:', updateData);

      // Check if club profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      console.log('Existing profile check:', { existingProfile, checkError });

      if (checkError && checkError.code === 'PGRST116') {
        // Create new club profile
        console.log('Creating new club profile...');
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...updateData,
            created_at: new Date().toISOString(),
          });

        if (createError) {
          console.error('Error creating club profile:', createError);
          Alert.alert('Error', 'Failed to save club information');
          return;
        }
        console.log('Club profile created successfully');
      } else if (checkError) {
        console.error('Error checking club profile:', checkError);
        Alert.alert('Error', 'Database error occurred');
        return;
      } else {
        // Update existing club profile
        console.log('Updating existing club profile...');
        const { error: updateError } = await supabase
          .from('club_profiles')
          .update(updateData)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          Alert.alert('Error', 'Failed to save club information');
          return;
        }
        console.log('Club profile updated successfully');
      }

      Alert.alert('Success', 'Club information saved successfully!');
    } catch (error) {
      console.error('Error saving club info:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
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

  if (isLoading) {
    console.log('Rendering loading state');
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading club information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log('Rendering main component with data:', {
    hasClubInfo: !!clubInfo,
    clubName: clubData.club_name,
    clubType: clubData.club_type
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Info Management</Text>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={16} color="#ffffff" />
          <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.3}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={clubInfo ? [1] : []}
        >
        {clubInfo && (
          <View style={[styles.clubCardPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.clubCard}>
              <View style={styles.clubHeader}>
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
          </View>
        )}

        {clubInfo && (
            <View style={[styles.stickyTabWrap, { backgroundColor: theme.colors.surface, borderBottomColor: '#E5E7EB' }]}>
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'info' && styles.activeTab,
                  activeTab === 'info' && { borderBottomColor: theme.colors.primary }
                ]}
                onPress={() => switchTab('info')}
              >
                <Building2 size={16} color={activeTab === 'info' ? theme.colors.primary : '#9CA3AF'} />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'info' ? '#111827' : '#6B7280' },
                  activeTab === 'info' && styles.activeTabText
                ]} maxFontSizeMultiplier={1.3}>
                  Club Info
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'location' && styles.activeTab,
                  activeTab === 'location' && { borderBottomColor: theme.colors.primary }
                ]}
                onPress={() => switchTab('location')}
              >
                <MapPin size={16} color={activeTab === 'location' ? theme.colors.primary : '#9CA3AF'} />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'location' ? '#111827' : '#6B7280' },
                  activeTab === 'location' && styles.activeTabText
                ]} maxFontSizeMultiplier={1.3}>
                  Location
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'moreInfo' && styles.activeTab,
                  activeTab === 'moreInfo' && { borderBottomColor: theme.colors.primary }
                ]}
                onPress={() => switchTab('moreInfo')}
              >
                <Info size={16} color={activeTab === 'moreInfo' ? theme.colors.primary : '#9CA3AF'} />
                <Text style={[
                  styles.tabText,
                  { color: activeTab === 'moreInfo' ? '#111827' : '#6B7280' },
                  activeTab === 'moreInfo' && styles.activeTabText
                ]} maxFontSizeMultiplier={1.3}>
                  More Info
                </Text>
              </TouchableOpacity>
            </View>
            </View>
        )}

        {clubInfo && (
          <Animated.View
            style={[
              styles.tabContentWrap,
              {
                opacity: tabTransition,
                transform: [
                  {
                    translateX: tabTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
            {...(Platform.OS !== 'web' ? tabPanResponder.panHandlers : {})}
          >

            {/* Club Information Tab */}
            {activeTab === 'info' && (
              <View style={styles.unifiedCard}>
            {/* Club Name */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Name</Text>
              <View style={[styles.readOnlyField, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {clubData.club_name}
                </Text>
              </View>
              <Text style={[styles.fieldNote, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>This field cannot be edited</Text>
            </View>

            <View style={styles.sectionDivider} />

            {/* Club Number and Charter Date */}
            <View style={[styles.formRow, isCompact && styles.formRowStacked]}>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Number</Text>
                <View style={[styles.readOnlyField, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {clubData.club_number || 'Not set'}
                  </Text>
                </View>
                <Text style={[styles.fieldNote, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>This field cannot be edited</Text>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Charter Date</Text>
                <View style={[styles.readOnlyField, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {formatDate(clubData.charter_date)}
                  </Text>
                </View>
                <Text style={[styles.fieldNote, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>This field cannot be edited</Text>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            {/* Club Status and Club Type */}
            <View style={[styles.formRow, isCompact && styles.formRowStacked]}>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Status</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowClubStatusModal(true)}
                >
                  <Text style={[styles.dropdownText, { color: clubData.club_status ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {getClubStatusLabel()}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Type</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowClubTypeModal(true)}
                >
                  <Text style={[styles.dropdownText, { color: clubData.club_type ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {getClubTypeLabel()}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionDivider} />

            {/* Club Mission */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Mission</Text>
              <TextInput
                style={[styles.textAreaInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter your club's mission statement..."
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.club_mission || ''}
                onChangeText={(text) => {
                  if (text.length <= 250) {
                    updateField('club_mission', text);
                  }
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={250}
              />
              <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {(clubData.club_mission || '').length}/250 characters
              </Text>
            </View>

            <View style={styles.sectionDivider} />

            {/* Banner Color Selection */}
            <View style={[styles.formField, styles.lastFormField]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Banner Color</Text>
              <TouchableOpacity
                style={[styles.colorSelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                onPress={() => setShowBannerColorModal(true)}
              >
                <View style={styles.colorSelectorContent}>
                  <View style={[
                    styles.colorPreview, 
                    { backgroundColor: clubData.banner_color || '#6b7280' }
                  ]} />
                  <Text style={[styles.colorSelectorText, { color: clubData.banner_color ? theme.colors.text : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {getBannerColorLabel()}
                  </Text>
                </View>
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.bannerHelperText} maxFontSizeMultiplier={1.3}>
                The selected banner color will be applied to the Club tab in the Member Reports section.
              </Text>
            </View>
              </View>
            )}

            {/* Location Information Tab */}
            {activeTab === 'location' && (
              <View style={styles.locationTabWrap}>
                <View style={[styles.locationCard, { borderColor: '#E5E7EB' }]}>
                  <Text style={[styles.locationCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Location</Text>

                  <View style={[styles.formRow, isCompact && styles.formRowStacked, styles.sectionBlock]}>
                    <View style={styles.formField}>
                      <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>City</Text>
                      <TextInput
                        style={[
                          styles.locationInput,
                          { backgroundColor: theme.colors.surface, borderColor: focusedField === 'city' ? theme.colors.primary : '#E5E7EB', color: theme.colors.text }
                        ]}
                        placeholder="e.g., Chennai"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={clubData.city || ''}
                        onChangeText={(text) => updateField('city', text)}
                        onFocus={() => setFocusedField('city')}
                        onBlur={() => setFocusedField(null)}
                      />
                    </View>

                    <View style={styles.formField}>
                      <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Country</Text>
                      <CountryPicker
                        value={clubData.country}
                        onChange={(countryName) => updateField('country', countryName)}
                        placeholder="Select country"
                        textColor={theme.colors.text}
                        placeholderColor={theme.colors.textSecondary}
                        borderColor="#E5E7EB"
                        focusColor={theme.colors.primary}
                        backgroundColor={theme.colors.surface}
                      />
                    </View>
                  </View>

                  <View style={[styles.formField, styles.sectionBlock]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Time Zone</Text>
                    <TimezonePicker
                      value={clubData.time_zone}
                      onChange={(timezone) => updateField('time_zone', timezone)}
                      placeholder="Select timezone"
                      textColor={theme.colors.text}
                      placeholderColor={theme.colors.textSecondary}
                      borderColor="#E5E7EB"
                      focusColor={theme.colors.primary}
                      backgroundColor={theme.colors.surface}
                    />
                  </View>
                </View>

                <View style={[styles.locationCard, { borderColor: '#E5E7EB' }]}>
                  <Text style={[styles.locationCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Address</Text>

                  <View style={[styles.formField, styles.sectionBlock]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Address</Text>
                    <TextInput
                      style={[
                        styles.locationTextArea,
                        { backgroundColor: theme.colors.surface, borderColor: focusedField === 'address' ? theme.colors.primary : '#E5E7EB', color: theme.colors.text }
                      ]}
                      placeholder="Enter full address"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={clubData.address || ''}
                      onChangeText={(text) => updateField('address', text)}
                      onFocus={() => setFocusedField('address')}
                      onBlur={() => setFocusedField(null)}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View style={[styles.formRow, isCompact && styles.formRowStacked, styles.sectionBlock]}>
                    <View style={styles.formField}>
                      <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>ZIP Code</Text>
                      <TextInput
                        style={[
                          styles.locationInput,
                          { backgroundColor: theme.colors.surface, borderColor: focusedField === 'pin' ? theme.colors.primary : '#E5E7EB', color: theme.colors.text }
                        ]}
                        placeholder="e.g., 600100"
                        placeholderTextColor={theme.colors.textSecondary}
                        value={clubData.pin_code || ''}
                        onChangeText={(text) => updateField('pin_code', text)}
                        onFocus={() => setFocusedField('pin')}
                        onBlur={() => setFocusedField(null)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={styles.formField}>
                      <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Location Map Link</Text>
                      <TextInput
                        style={[
                          styles.locationInput,
                          { backgroundColor: theme.colors.surface, borderColor: focusedField === 'maps' ? theme.colors.primary : '#E5E7EB', color: theme.colors.text }
                        ]}
                        placeholder="https://maps.google.com/..."
                        placeholderTextColor={theme.colors.textSecondary}
                        value={clubData.google_location_link || ''}
                        onChangeText={(text) => updateField('google_location_link', text)}
                        onFocus={() => setFocusedField('maps')}
                        onBlur={() => setFocusedField(null)}
                        keyboardType="url"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* More Info Tab */}
            {activeTab === 'moreInfo' && (
              <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#f59e0b' + '20' }]}>
                <Info size={20} color="#f59e0b" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Additional Information</Text>
            </View>

          {/* Region/State and District */}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Region/State</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., 13"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.region || ''}
                onChangeText={(text) => updateField('region', text)}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>District</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., 120"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.district || ''}
                onChangeText={(text) => updateField('district', text)}
              />
            </View>
          </View>

          {/* Division and Area */}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Division</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., C"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.division || ''}
                onChangeText={(text) => updateField('division', text)}
              />
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Area</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="e.g., 04"
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.area || ''}
                onChangeText={(text) => updateField('area', text)}
              />
            </View>
          </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Club Type Selection Modal */}
      <Modal
        visible={showClubStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClubStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowClubStatusModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Club Status</Text>
            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {clubStatusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    clubData.club_status === option.value && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    updateField('club_status', option.value);
                    setShowClubStatusModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { color: clubData.club_status === option.value ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Club Type Selection Modal */}
      <Modal
        visible={showClubTypeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowClubTypeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowClubTypeModal(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Club Type</Text>
            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {clubTypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    clubData.club_type === option.value && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => {
                    updateField('club_type', option.value);
                    setShowClubTypeModal(false);
                  }}
                >
                  <Text style={[
                    styles.optionText,
                    { color: clubData.club_type === option.value ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Banner Color Selection Modal */}
      <Modal
        visible={showBannerColorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBannerColorModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowBannerColorModal(false)}
        >
          <View style={[styles.colorModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Banner Color</Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Choose a banner color for your club
            </Text>
            
            <ScrollView style={styles.colorOptionsList} showsVerticalScrollIndicator={false}>
              {bannerColorOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.colorOption,
                    {
                      borderColor: clubData.banner_color === option.value ? option.value : theme.colors.border,
                      borderWidth: clubData.banner_color === option.value ? 3 : 1,
                    }
                  ]}
                  onPress={() => {
                    updateField('banner_color', option.value);
                    setShowBannerColorModal(false);
                  }}
                >
                  <View style={[styles.colorSwatch, { backgroundColor: option.value }]} />
                  <View style={styles.colorDetails}>
                    <Text style={[styles.colorName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {option.label}
                    </Text>
                  </View>
                  {clubData.banner_color === option.value && (
                    <View style={[styles.selectedIndicator, { backgroundColor: option.value }]}>
                      <Text style={styles.checkmark} maxFontSizeMultiplier={1.3}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
  keyboardAvoidingView: {
    flex: 1,
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  managementPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clubCardPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  clubCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
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
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 0,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 44,
    maxHeight: 48,
  },
  stickyTabWrap: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    fontWeight: '700',
  },
  tabContentWrap: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  unifiedCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 20,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },
  section: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 20,
  },
  locationTabWrap: {
    padding: 20,
    gap: 16,
  },
  locationCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  locationCardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  locationInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 48,
  },
  locationTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 96,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
    alignItems: 'flex-start',
  },
  sectionBlock: {
    marginBottom: 18,
  },
  formRowStacked: {
    flexDirection: 'column',
  },
  formField: {
    flex: 1,
    marginBottom: 0,
    minWidth: 0,
  },
  lastFormField: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 54,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 100,
    lineHeight: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  readOnlyField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    minHeight: 54,
  },
  readOnlyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  fieldNote: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
    letterSpacing: -0.1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 54,
  },
  dropdownText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    borderRadius: 12,
    padding: 16,
    margin: 20,
    maxHeight: '60%',
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
  },
  characterCount: {
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 18,
    fontWeight: '500',
    alignSelf: 'flex-end',
  },
  colorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  colorSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  colorSelectorText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  bannerHelperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 16,
  },
  colorModal: {
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxHeight: '78%',
    minWidth: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  colorOptionsList: {
    maxHeight: 420,
  },
  colorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    position: 'relative',
    marginBottom: 12,
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  colorDetails: {
    flex: 1,
  },
  colorName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  colorSpecs: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomSpacing: {
    height: 40,
  },
});
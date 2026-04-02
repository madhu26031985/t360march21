import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView, Animated, Image, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useRef, useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Home, User, Mail, MapPin, Camera, X, Facebook, Twitter, Linkedin, Instagram, Youtube, ChevronRight, Phone, Lock, Info, Users, Calendar, Settings, ArrowLeft, Shield, Coffee, MessageCircle, Globe } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

const FOOTER_NAV_ICON_SIZE = 15;
const T360_WEB_LOGIN_URL = 'https://t360.in/weblogin';
const T360_WHATSAPP_SUPPORT_URL = 'https://wa.me/9597491113';

interface ProfileData {
  full_name: string;
  email: string;
  phone_number: string;
  location: string;
  'About': string;
  avatar_url: string | null;
  facebook_url: string;
  linkedin_url: string;
  instagram_url: string;
  twitter_url: string;
  youtube_url: string;
}

export default function Profile() {
  const { theme } = useTheme();
  const { user, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone_number: '',
    location: '',
    'About': '',
    avatar_url: null,
    facebook_url: '',
    linkedin_url: '',
    instagram_url: '',
    twitter_url: '',
    youtube_url: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState<string | null>(null);
  const [tempSocialUrl, setTempSocialUrl] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const infoIconBlinkOpacity = useRef(new Animated.Value(1)).current;
  const infoIconPulseScale = useRef(new Animated.Value(1)).current;
  const [infoAnimRunKey, setInfoAnimRunKey] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    loadProfile();
  }, [user?.id]);

  useEffect(() => {
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    let blinkAnimation: Animated.CompositeAnimation | null = null;
    let scaleAnimation: Animated.CompositeAnimation | null = null;
    const aboutMissing = !profileData['About']?.trim();
    const avatarMissing = !profileData.avatar_url;

    if (!isLoading && aboutMissing && avatarMissing) {
      infoIconBlinkOpacity.setValue(1);
      infoIconPulseScale.setValue(1);
      blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(infoIconBlinkOpacity, {
            toValue: 0.25,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(infoIconBlinkOpacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
        ])
      );
      blinkAnimation.start();
      scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(infoIconPulseScale, {
            toValue: 1.08,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(infoIconPulseScale, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
        ])
      );
      scaleAnimation.start();

      stopTimer = setTimeout(() => {
        blinkAnimation?.stop();
        scaleAnimation?.stop();
        Animated.timing(infoIconBlinkOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
        Animated.timing(infoIconPulseScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }, 5000);
    } else {
      infoIconBlinkOpacity.setValue(1);
      infoIconPulseScale.setValue(1);
    }

    return () => {
      if (stopTimer) clearTimeout(stopTimer);
      blinkAnimation?.stop();
      scaleAnimation?.stop();
      infoIconBlinkOpacity.setValue(1);
      infoIconPulseScale.setValue(1);
    };
  }, [isLoading, profileData.avatar_url, profileData['About'], infoIconBlinkOpacity, infoIconPulseScale, infoAnimRunKey]);

  useFocusEffect(
    useCallback(() => {
      setInfoAnimRunKey((k) => k + 1);
    }, [])
  );

  const loadProfile = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch only the fields we need, excluding large base64 avatar initially
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('full_name, email, phone_number, location, About, facebook_url, linkedin_url, instagram_url, twitter_url, youtube_url')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile data');
        setIsLoading(false);
        return;
      }

      if (data) {
        setProfileData({
          full_name: data.full_name || '',
          email: data.email || '',
          phone_number: data.phone_number || '',
          location: data.location || '',
          'About': data['About'] || '',
          avatar_url: null, // Load separately
          facebook_url: data.facebook_url || '',
          linkedin_url: data.linkedin_url || '',
          instagram_url: data.instagram_url || '',
          twitter_url: data.twitter_url || '',
          youtube_url: data.youtube_url || '',
        });

        // Load avatar separately to avoid blocking the initial load
        loadAvatar();
      } else {
        setProfileData({
          full_name: user.fullName || '',
          email: user.email || '',
          phone_number: '',
          location: '',
          'About': '',
          avatar_url: null,
          facebook_url: '',
          linkedin_url: '',
          instagram_url: '',
          twitter_url: '',
          youtube_url: '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvatar = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('app_user_profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data?.avatar_url) {
        setProfileData(prev => ({ ...prev, avatar_url: data.avatar_url }));
      }
    } catch (error) {
      console.error('Error loading avatar:', error);
    }
  };

  const openWhatsAppSupport = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WHATSAPP_SUPPORT_URL);
      if (supported) await Linking.openURL(T360_WHATSAPP_SUPPORT_URL);
      else Alert.alert('Error', 'Cannot open WhatsApp');
    } catch {
      Alert.alert('Error', 'Failed to open WhatsApp');
    }
  }, []);

  const openWebLogin = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(T360_WEB_LOGIN_URL);
      if (supported) await Linking.openURL(T360_WEB_LOGIN_URL);
      else Alert.alert('Error', 'Cannot open web login');
    } catch {
      Alert.alert('Error', 'Failed to open web login');
    }
  }, []);

  const updateField = (field: keyof ProfileData, value: string) => {
    const characterLimits: Partial<Record<keyof ProfileData, number>> = {
      location: 50,
      phone_number: 20,
      'About': 300,
      facebook_url: 200,
      linkedin_url: 200,
      instagram_url: 200,
      twitter_url: 200,
      youtube_url: 200,
    };

    const limit = characterLimits[field];
    if (limit && value.length > limit) {
      return;
    }

    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const performSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('app_user_profiles')
        .update({
          phone_number: profileData.phone_number.trim() || null,
          location: profileData.location.trim() || null,
          'About': profileData['About'].trim() || null,
          facebook_url: profileData.facebook_url.trim() || null,
          linkedin_url: profileData.linkedin_url.trim() || null,
          instagram_url: profileData.instagram_url.trim() || null,
          twitter_url: profileData.twitter_url.trim() || null,
          youtube_url: profileData.youtube_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        if (Platform.OS === 'web') {
          // eslint-disable-next-line no-alert
          alert('Failed to update profile. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to update profile');
        }
        return;
      }

      if (Platform.OS === 'web') {
        // Native Alert is unreliable on web; use browser dialog for result feedback.
        // eslint-disable-next-line no-alert
        alert('Profile updated successfully');
      } else {
        Alert.alert('Success', 'Profile updated successfully');
      }
      setHasUnsavedChanges(false);
      await refreshUserProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        alert('An unexpected error occurred. Please try again.');
      } else {
        Alert.alert('Error', 'An unexpected error occurred');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!user || isSaving || !hasUnsavedChanges) return;
    // Alert.alert with multiple buttons is unreliable on React Native Web (no dialog / focus issues).
    setShowSaveConfirmModal(true);
  };

  const confirmSaveFromModal = () => {
    setShowSaveConfirmModal(false);
    void performSaveProfile();
  };

  const checkAndRequestPermissions = async (useCamera: boolean): Promise<boolean> => {
    try {
      if (useCamera) {
        const { status: existingStatus } = await ImagePicker.getCameraPermissionsAsync();
        if (existingStatus === 'granted') return true;

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please enable camera access in your device settings to take photos.'
          );
          return false;
        }
        return true;
      } else {
        const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (existingStatus === 'granted') return true;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo Library Permission Required',
            'Please enable photo library access in your device settings to select images.'
          );
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      Alert.alert('Error', 'Failed to check permissions');
      return false;
    }
  };

  const uploadToSupabaseStorage = async (uri: string, userId: string): Promise<string | null> => {
    try {
      const fileName = `${userId}/${Date.now()}.jpg`;
      const response = await fetch(uri);
      const blob = await response.blob();

      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });

      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Error uploading to storage:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error in uploadToSupabaseStorage:', error);
      return null;
    }
  };

  const handleImagePicker = async (useCamera: boolean = false) => {
    try {
      setIsUploadingImage(true);

      const hasPermission = await checkAndRequestPermissions(useCamera);
      if (!hasPermission) {
        setIsUploadingImage(false);
        return;
      }

      let result;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];

        const maxSize = 5 * 1024 * 1024;
        if (asset.fileSize && asset.fileSize > maxSize) {
          Alert.alert('File Too Large', 'Please select an image smaller than 5MB');
          setIsUploadingImage(false);
          return;
        }

        // Use Supabase Storage for both iOS and Android (performance optimization)
        const publicUrl = await uploadToSupabaseStorage(asset.uri, user?.id || '');

        if (!publicUrl) {
          Alert.alert('Upload Failed', 'Failed to upload image. Please try again.');
          setIsUploadingImage(false);
          return;
        }

        const { error } = await supabase
          .from('app_user_profiles')
          .update({
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user?.id);

        if (error) {
          console.error('Error updating avatar:', error);
          Alert.alert('Error', 'Failed to update profile picture');
          return;
        }

        setProfileData(prev => ({ ...prev, avatar_url: publicUrl }));
        Alert.alert('Success', 'Profile picture updated successfully');
        await refreshUserProfile();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Error', `Failed to update profile picture: ${errorMessage}`);
    } finally {
      setIsUploadingImage(false);
      setShowImagePicker(false);
    }
  };

  const handleSocialMediaClick = async (platform: string) => {
    const url = profileData[platform as keyof ProfileData] as string;

    if (url && url.trim()) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open this URL');
        }
      } catch (error) {
        console.error('Error opening URL:', error);
        Alert.alert('Error', 'Failed to open social media link');
      }
    } else {
      handleSocialMediaEdit(platform);
    }
  };

  const handleSocialMediaEdit = (platform: string) => {
    setSelectedSocialPlatform(platform);
    setTempSocialUrl(profileData[platform as keyof ProfileData] as string || '');
    setShowSocialModal(true);
  };

  const handleSaveSocialMedia = () => {
    if (selectedSocialPlatform) {
      updateField(selectedSocialPlatform as keyof ProfileData, tempSocialUrl);
      setShowSocialModal(false);
      setSelectedSocialPlatform(null);
      setTempSocialUrl('');
    }
  };

  const getSocialMediaIcon = (platform: string) => {
    switch (platform) {
      case 'facebook_url': return <Facebook size={20} color="#ffffff" />;
      case 'twitter_url': return <Twitter size={20} color="#ffffff" />;
      case 'linkedin_url': return <Linkedin size={20} color="#ffffff" />;
      case 'instagram_url': return <Instagram size={20} color="#ffffff" />;
      case 'youtube_url': return <Youtube size={20} color="#ffffff" />;
      default: return null;
    }
  };

  const getSocialMediaColor = (platform: string) => {
    switch (platform) {
      case 'facebook_url': return '#1877F2';
      case 'twitter_url': return '#1DA1F2';
      case 'linkedin_url': return '#0A66C2';
      case 'instagram_url': return '#E4405F';
      case 'youtube_url': return '#FF0000';
      default: return '#6B7280';
    }
  };

  const getSocialMediaLabel = (platform: string) => {
    switch (platform) {
      case 'facebook_url': return 'Facebook';
      case 'twitter_url': return 'Twitter';
      case 'linkedin_url': return 'LinkedIn';
      case 'instagram_url': return 'Instagram';
      case 'youtube_url': return 'YouTube';
      default: return 'Social Media';
    }
  };

  const getCharacterCount = (): string => {
    const current = (profileData['About'] as string)?.length || 0;
    return `${current}/300`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.surface,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit Profile</Text>
          <Animated.View style={[styles.infoButtonPulseWrap, { opacity: infoIconBlinkOpacity, transform: [{ scale: infoIconPulseScale }] }]}>
            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: '#E8EEF5', borderColor: '#D4DEE9' }]}
              onPress={() => setShowInfoModal(true)}
              activeOpacity={0.8}
            >
              <Info size={18} color="#6E839F" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={styles.pageMain}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContentContainer,
            { paddingBottom: 24 + 72 + Math.max(insets.bottom, 10) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.contentCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            {/* Profile Picture */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {profileData.avatar_url ? (
                  <Image
                    source={{ uri: profileData.avatar_url }}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={48} color="#6B7280" />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={() => setShowImagePicker(true)}
                  disabled={isUploadingImage}
                >
                  <Camera size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setShowImagePicker(true)}>
                <Text style={styles.changePhotoText} maxFontSizeMultiplier={1.3}>
                  {isUploadingImage ? 'Uploading...' : 'Change Photo'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Full Name - Read Only */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Full Name</Text>
              <View
                style={[
                  styles.inputContainerReadOnly,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.mode === 'dark' ? theme.colors.backgroundSecondary : '#F9FAFB',
                  },
                ]}
              >
                <User size={18} color="#6B7280" />
                <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {profileData.full_name || 'Not set'}
                </Text>
                <Lock size={16} color="#6B7280" />
              </View>
              <Text style={styles.fieldNote} maxFontSizeMultiplier={1.3}>Contact support to update</Text>
            </View>

            {/* Email - Read Only */}
            <View style={styles.formField}>
              <View
                style={[
                  styles.inputContainerReadOnly,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.mode === 'dark' ? theme.colors.backgroundSecondary : '#F9FAFB',
                  },
                ]}
              >
                <Mail size={18} color="#6B7280" />
                <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {profileData.email || 'Not set'}
                </Text>
              </View>
              <Text style={styles.fieldNote} maxFontSizeMultiplier={1.3}>Contact support to update</Text>
            </View>

            {/* Phone Number */}
            <View style={styles.formField}>
              <View
                style={[
                  styles.inputContainer,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <Phone size={18} color="#6B7280" />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#9CA3AF"
                  value={profileData.phone_number}
                  onChangeText={(text) => updateField('phone_number', text)}
                  keyboardType="phone-pad"
                />
                <ChevronRight size={18} color="#6B7280" />
              </View>
            </View>

            {/* Location */}
            <View style={styles.formField}>
              <View
                style={[
                  styles.inputContainer,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <MapPin size={18} color="#6B7280" />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text }]}
                  placeholder="Enter your location"
                  placeholderTextColor="#9CA3AF"
                  value={profileData.location}
                  onChangeText={(text) => updateField('location', text)}
                />
              </View>
            </View>

            {/* About */}
            <View style={styles.formField}>
              <View style={styles.fieldHeader}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>About</Text>
                <Text style={[styles.characterCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {getCharacterCount()}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textAreaInput,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.text },
                ]}
                placeholder="Tell us about yourself..."
                placeholderTextColor="#9CA3AF"
                value={profileData['About']}
                onChangeText={(text) => updateField('About', text)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>

            {/* Social Media */}
            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Social Media</Text>
              <View style={styles.socialMediaGrid}>
                {['linkedin_url', 'twitter_url', 'instagram_url', 'youtube_url'].map((platform) => {
                  return (
                    <TouchableOpacity
                      key={platform}
                      style={[
                        styles.socialMediaIcon,
                        { backgroundColor: getSocialMediaColor(platform) }
                      ]}
                      onPress={() => handleSocialMediaClick(platform)}
                      onLongPress={() => handleSocialMediaEdit(platform)}
                      activeOpacity={0.8}
                    >
                      {getSocialMediaIcon(platform)}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButtonBottom,
                {
                  backgroundColor: hasUnsavedChanges ? '#3B82F6' : '#E5E7EB',
                }
              ]}
              onPress={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.saveButtonBottomText,
                { color: hasUnsavedChanges ? "#FFFFFF" : "#9CA3AF" }
              ]} maxFontSizeMultiplier={1.3}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>

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
                  <Shield size={FOOTER_NAV_ICON_SIZE} color="#7c3aed" />
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
            <TouchableOpacity
              style={styles.footerNavItem}
              onPress={() => router.push('/buy-us-a-coffee')}
              activeOpacity={0.75}
            >
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Coffee size={FOOTER_NAV_ICON_SIZE} color="#92400e" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Coffee
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={openWhatsAppSupport} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <MessageCircle size={FOOTER_NAV_ICON_SIZE} color="#22c55e" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Support
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerNavItem} onPress={openWebLogin} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Globe size={FOOTER_NAV_ICON_SIZE} color="#334155" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Web
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowImagePicker(false);
          setIsUploadingImage(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowImagePicker(false);
            setIsUploadingImage(false);
          }}
        >
          <TouchableOpacity
            style={styles.modal}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>
                Update Profile Picture
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowImagePicker(false);
                  setIsUploadingImage(false);
                }}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleImagePicker(true)}
                disabled={isUploadingImage}
              >
                <Camera size={24} color="#3B82F6" />
                <Text style={styles.modalOptionText} maxFontSizeMultiplier={1.3}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => handleImagePicker(false)}
                disabled={isUploadingImage}
              >
                <User size={24} color="#3B82F6" />
                <Text style={styles.modalOptionText} maxFontSizeMultiplier={1.3}>
                  Choose from Gallery
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Social Media Edit Modal */}
      <Modal
        visible={showSocialModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowSocialModal(false);
          setSelectedSocialPlatform(null);
          setTempSocialUrl('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowSocialModal(false);
            setSelectedSocialPlatform(null);
            setTempSocialUrl('');
          }}
        >
          <TouchableOpacity
            style={styles.modal}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>
                Edit {getSocialMediaLabel(selectedSocialPlatform || '')}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowSocialModal(false);
                  setSelectedSocialPlatform(null);
                  setTempSocialUrl('');
                }}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={`Enter your ${getSocialMediaLabel(selectedSocialPlatform || '')} URL`}
              placeholderTextColor="#9CA3AF"
              value={tempSocialUrl}
              onChangeText={setTempSocialUrl}
              keyboardType="url"
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}
                onPress={() => {
                  setShowSocialModal(false);
                  setSelectedSocialPlatform(null);
                  setTempSocialUrl('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#111827' }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                onPress={handleSaveSocialMedia}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={1.3}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Save confirmation — Modal works on web; multi-button Alert.alert often does not */}
      <Modal
        visible={showSaveConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setShowSaveConfirmModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !isSaving && setShowSaveConfirmModal(false)}
        >
          <TouchableOpacity
            style={styles.modal}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>
                Save changes?
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                disabled={isSaving}
                onPress={() => setShowSaveConfirmModal(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.saveConfirmMessage} maxFontSizeMultiplier={1.3}>
              Your profile will be updated with the information you entered.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }]}
                disabled={isSaving}
                onPress={() => setShowSaveConfirmModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: '#111827' }]} maxFontSizeMultiplier={1.3}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
                disabled={isSaving}
                onPress={confirmSaveFromModal}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={1.3}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <TouchableOpacity
            style={[styles.modal, styles.infoModal]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} maxFontSizeMultiplier={1.3}>Your Profile</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.infoHeaderDivider} />

            <ScrollView style={styles.infoContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.infoTitle} maxFontSizeMultiplier={1.3}>Your story, your identity ✨</Text>

              <Text style={styles.infoText} maxFontSizeMultiplier={1.3}>
                Let people know who you are beyond meetings.
              </Text>

              <Text style={styles.infoBullet} maxFontSizeMultiplier={1.3}>📸  Add your photo</Text>
              <Text style={styles.infoBullet} maxFontSizeMultiplier={1.3}>📍  Update contact & location</Text>
              <Text style={styles.infoBullet} maxFontSizeMultiplier={1.3}>✍️  Write about yourself</Text>
              <Text style={styles.infoBullet} maxFontSizeMultiplier={1.3}>🔗  Add social links</Text>

              <Text style={styles.infoText} maxFontSizeMultiplier={1.3}>
                Your About section is your quick intro.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: '#3B82F6', borderColor: '#3B82F6', marginTop: 16 }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </TouchableOpacity>
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
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 0,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#93A7BF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  infoButtonPulseWrap: {
    borderRadius: 18,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingTop: 16,
  },
  contentCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    overflow: 'hidden',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
  },
  formField: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '400',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  inputContainerReadOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  readOnlyText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  fieldNote: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 4,
  },
  textAreaInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    fontWeight: '400',
    minHeight: 100,
  },
  socialMediaGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  socialMediaIcon: {
    width: 48,
    height: 48,
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonBottom: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  saveButtonBottomText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  modalOptions: {
    gap: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  modalInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 15,
    color: '#111827',
    marginBottom: 20,
  },
  saveConfirmMessage: {
    fontSize: 15,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoModal: {
    maxHeight: '80%',
  },
  infoContent: {
    maxHeight: 400,
  },
  infoHeaderDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoBullet: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 6,
    paddingLeft: 8,
  },
  infoFooter: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 4,
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
});

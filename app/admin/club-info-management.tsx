import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Animated, Easing, PanResponder, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  clubInfoManagementQueryKeys,
  fetchClubInfoManagementBundle,
  type ClubInfoManagementClubInfo,
  type ClubInfoManagementFormData,
} from '@/lib/clubInfoManagementQuery';
import { ArrowLeft, Building2, Crown, User, Shield, Eye, UserCheck, ChevronDown, MapPin, Info, Navigation, Calendar } from 'lucide-react-native';
import moment from 'moment-timezone';
import CountryPicker from '@/components/CountryPicker';
import { ClubMeetingDetailsContent } from './club-meeting-details';

/** When a country has many IANA zones, pick a stable default (user can override in the picker). */
const COUNTRY_PREFERRED_TIMEZONE: Partial<Record<string, string>> = {
  US: 'America/New_York',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  MX: 'America/Mexico_City',
  BR: 'America/Sao_Paulo',
  ID: 'Asia/Jakarta',
  RU: 'Europe/Moscow',
  CN: 'Asia/Shanghai',
};

function defaultTimezoneForCountryIsoCode(isoCode: string | null | undefined): string | null {
  if (!isoCode) return null;
  const code = isoCode.toUpperCase();
  try {
    const zones = moment.tz.zonesForCountry(code);
    if (!zones?.length) return null;
    if (zones.length === 1) return zones[0];
    const preferred = COUNTRY_PREFERRED_TIMEZONE[code];
    if (preferred && zones.includes(preferred)) return preferred;
    return [...zones].sort((a, b) => a.localeCompare(b))[0];
  } catch {
    return null;
  }
}

/** Tab icons: Notion-style accents (visible for active + inactive). */
const CLUB_INFO_TAB_ICON_COLORS = {
  info: '#2383E2',
  location: '#EA580C',
  meetingDetails: '#7C3AED',
  moreInfo: '#0D9488',
} as const;

function timezoneLabelFromValue(timezoneValue: string | null | undefined): string {
  if (!timezoneValue) return '';
  try {
    const offsetMinutes = moment.tz(timezoneValue).utcOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    const gmt = `GMT${sign}${hh}:${mm}`;

    const tzNamePart = new Intl.DateTimeFormat('en-US', {
      timeZone: timezoneValue,
      timeZoneName: 'long',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;

    const tzName = tzNamePart || timezoneValue;
    return `(${gmt}) ${tzName}`;
  } catch {
    return timezoneValue;
  }
}

type ClubInfoData = ClubInfoManagementFormData;
type ClubInfo = ClubInfoManagementClubInfo;

export default function ClubInfoManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clubId = user?.currentClubId ?? null;
  const params = useLocalSearchParams<{ tab?: string | string[] }>();

  const tabParamRaw = params.tab;
  const tabParam = Array.isArray(tabParamRaw) ? tabParamRaw[0] : tabParamRaw;
  const normalizedTab = (tabParam ?? '').toString();
  const computedInitialTab: 'info' | 'location' | 'meetingDetails' | 'moreInfo' =
    normalizedTab === 'location'
      ? 'location'
      : normalizedTab === 'meetingDetails'
        ? 'meetingDetails'
        : normalizedTab === 'moreInfo'
          ? 'moreInfo'
          : 'info';

  const {
    data: bundle,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: clubInfoManagementQueryKeys.detail(clubId ?? '__none__'),
    queryFn: () => fetchClubInfoManagementBundle(clubId!),
    enabled: !!clubId,
    staleTime: 5 * 60 * 1000,
  });

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
  
  const [isSaving, setIsSaving] = useState(false);
  const [showClubTypeModal, setShowClubTypeModal] = useState(false);
  const [showClubStatusModal, setShowClubStatusModal] = useState(false);
  const [showBannerColorModal, setShowBannerColorModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'location' | 'meetingDetails' | 'moreInfo'>(computedInitialTab);
  const tabTransition = useRef(new Animated.Value(1)).current;
  const tabOrder: Array<'info' | 'location' | 'meetingDetails' | 'moreInfo'> = [
    'info',
    'location',
    'meetingDetails',
    'moreInfo',
  ];
  const lastSavedSnapshotRef = useRef<string>('');

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
    lastSavedSnapshotRef.current = '';
  }, [clubId]);

  useLayoutEffect(() => {
    if (!bundle) return;
    setClubInfo(bundle.clubInfo);
    setClubData(bundle.clubData);
  }, [bundle]);

  const updateField = (field: keyof ClubInfoData, value: string) => {
    setClubData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationCountryChange = (countryName: string, countryCode: string) => {
    const tz = defaultTimezoneForCountryIsoCode(countryCode);
    setClubData((prev) => ({
      ...prev,
      country: countryName,
      time_zone: tz ?? '',
    }));
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

  const switchTab = (nextTab: 'info' | 'location' | 'meetingDetails' | 'moreInfo') => {
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

  const handleOpenDirections = async () => {
    const raw = (clubData.google_location_link || '').trim();
    if (!raw) {
      Alert.alert('No map link', 'Add a Google Maps or map link above, then try again.');
      return;
    }
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Cannot open link', 'This link could not be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open link', 'Check that the map link is a valid URL.');
    }
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

  const getUpdatePayload = () => ({
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
  });

  const persistClubProfile = async () => {
    if (!user?.currentClubId) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...getUpdatePayload(),
        updated_at: new Date().toISOString(),
      };

      const { data: existingProfile, error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...payload,
            created_at: new Date().toISOString(),
          });

        if (createError) {
          console.error('Error creating club profile:', createError);
          return;
        }
      } else if (checkError) {
        console.error('Error checking club profile:', checkError);
        return;
      } else {
        const { error: updateError } = await supabase
          .from('club_profiles')
          .update(payload)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          return;
        }
      }

      lastSavedSnapshotRef.current = JSON.stringify(getUpdatePayload());
      if (user?.currentClubId) {
        void queryClient.invalidateQueries({
          queryKey: clubInfoManagementQueryKeys.detail(user.currentClubId),
        });
      }
    } catch (error) {
      console.error('Error saving club info:', error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!bundle || !clubInfo || !user?.currentClubId || isSaving) return;
    const currentSnapshot = JSON.stringify(getUpdatePayload());
    if (!lastSavedSnapshotRef.current) {
      lastSavedSnapshotRef.current = currentSnapshot;
      return;
    }
    if (currentSnapshot === lastSavedSnapshotRef.current) return;

    const timeout = setTimeout(() => {
      persistClubProfile();
    }, 700);

    return () => clearTimeout(timeout);
  }, [clubData, bundle, clubInfo, user?.currentClubId, isSaving]);

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

  if (!clubId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Info</Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Select a club to manage club information.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'Something went wrong';
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Info</Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text, textAlign: 'center', marginBottom: 16 }]} maxFontSizeMultiplier={1.2}>
            {message}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => refetch()}
            activeOpacity={0.85}
          >
            <Text style={styles.retryButtonText} maxFontSizeMultiplier={1.2}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isPending && !bundle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Info</Text>
          <View style={[styles.headerRightSpacer, isFetching && styles.headerSpinnerWrap]}>
            {isFetching ? <Text style={[styles.headerFetchingDot, { color: theme.colors.primary }]}>●</Text> : null}
          </View>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.notionPanel, styles.skeletonPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.skeletonHeaderBlock}>
              <View style={[styles.skeletonLine, styles.skeletonTitle, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.skeletonLine, styles.skeletonMeta, { backgroundColor: theme.colors.border }]} />
            </View>
            <View style={[styles.skeletonTabGrid, { borderTopColor: theme.colors.border, borderLeftColor: theme.colors.border }]}>
              {[1, 2, 3, 4].map((k) => (
                <View
                  key={k}
                  style={[
                    styles.skeletonTabCell,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.notionPanelBody}>
              <View style={[styles.skeletonLine, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.skeletonBox, { backgroundColor: theme.colors.border }]} />
              <View style={styles.skeletonRow}>
                <View style={[styles.skeletonHalf, { backgroundColor: theme.colors.border }]} />
                <View style={[styles.skeletonHalf, { backgroundColor: theme.colors.border }]} />
              </View>
              <View style={[styles.skeletonBox, styles.skeletonTall, { backgroundColor: theme.colors.border }]} />
              <View style={styles.skeletonRow}>
                <View style={[styles.skeletonHalf, { backgroundColor: theme.colors.border }]} />
                <View style={[styles.skeletonHalf, { backgroundColor: theme.colors.border }]} />
              </View>
            </View>
          </View>
          <View style={styles.bottomSpacing} />
        </ScrollView>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Info</Text>
        <View style={[styles.headerRightSpacer, isFetching && styles.headerSpinnerWrap]}>
          {isFetching ? <Text style={[styles.headerFetchingDot, { color: theme.colors.primary }]}>●</Text> : null}
        </View>
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
          stickyHeaderIndices={[]}
        >
        {clubInfo && (
          <View style={[styles.notionPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={[styles.notionPanelHeader, { borderBottomColor: theme.colors.border }]}>
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

            <View style={[styles.notionTabStrip, { borderBottomColor: theme.colors.border }]}>
              <View style={[styles.tabGrid, { borderTopColor: theme.colors.border, borderLeftColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={[
                    styles.tabCell,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: activeTab === 'info' ? theme.colors.primary + '14' : theme.colors.surface,
                    },
                  ]}
                  onPress={() => switchTab('info')}
                  activeOpacity={0.75}
                >
                  <Building2 size={20} color={CLUB_INFO_TAB_ICON_COLORS.info} strokeWidth={2} />
                  <Text
                    style={[styles.tabCellText, { color: theme.colors.text }, activeTab === 'info' && styles.tabCellTextActive]}
                    maxFontSizeMultiplier={1.25}
                    numberOfLines={2}
                  >
                    Club Info
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabCell,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: activeTab === 'location' ? theme.colors.primary + '14' : theme.colors.surface,
                    },
                  ]}
                  onPress={() => switchTab('location')}
                  activeOpacity={0.75}
                >
                  <MapPin size={20} color={CLUB_INFO_TAB_ICON_COLORS.location} strokeWidth={2} />
                  <Text
                    style={[styles.tabCellText, { color: theme.colors.text }, activeTab === 'location' && styles.tabCellTextActive]}
                    maxFontSizeMultiplier={1.25}
                    numberOfLines={2}
                  >
                    Club Location
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabCell,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: activeTab === 'meetingDetails' ? theme.colors.primary + '14' : theme.colors.surface,
                    },
                  ]}
                  onPress={() => switchTab('meetingDetails')}
                  activeOpacity={0.75}
                >
                  <Calendar size={20} color={CLUB_INFO_TAB_ICON_COLORS.meetingDetails} strokeWidth={2} />
                  <Text
                    style={[styles.tabCellText, { color: theme.colors.text }, activeTab === 'meetingDetails' && styles.tabCellTextActive]}
                    maxFontSizeMultiplier={1.25}
                    numberOfLines={2}
                  >
                    Club Meeting Details
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tabCell,
                    {
                      borderRightColor: theme.colors.border,
                      borderBottomColor: theme.colors.border,
                      backgroundColor: activeTab === 'moreInfo' ? theme.colors.primary + '14' : theme.colors.surface,
                    },
                  ]}
                  onPress={() => switchTab('moreInfo')}
                  activeOpacity={0.75}
                >
                  <Info size={20} color={CLUB_INFO_TAB_ICON_COLORS.moreInfo} strokeWidth={2} />
                  <Text
                    style={[styles.tabCellText, { color: theme.colors.text }, activeTab === 'moreInfo' && styles.tabCellTextActive]}
                    maxFontSizeMultiplier={1.25}
                    numberOfLines={2}
                  >
                    Club More Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

          <Animated.View
            style={[
              styles.notionPanelBody,
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
              <View style={[styles.unifiedCard, styles.notionClubInfoStack]}>
            {/* Club Name */}
            <View style={styles.clubInfoNameBlock}>
              <View style={styles.formField}>
                <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Name</Text>
                <View style={[styles.readOnlyField, styles.clubInfoCompactReadOnly, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Text style={[styles.readOnlyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {clubData.club_name}
                  </Text>
                </View>
                <Text style={[styles.fieldNote, styles.clubInfoNameFieldNote, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>This field cannot be edited</Text>
              </View>
            </View>

            {/* Club Number and Charter Date */}
            <View style={styles.clubInfoNumberCharterBlock}>
              <View style={[styles.formRow, styles.clubInfoCompactRow]}>
                <View style={styles.formField}>
                  <Text style={[styles.clubInfoPairedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Number</Text>
                  <View style={[styles.readOnlyField, styles.clubInfoCompactReadOnly, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text
                      style={[styles.clubInfoPairedReadOnlyText, { color: theme.colors.textSecondary }]}
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                    >
                      {clubData.club_number || 'Not set'}
                    </Text>
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={[styles.clubInfoPairedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Charter Date</Text>
                  <View style={[styles.readOnlyField, styles.clubInfoCompactReadOnly, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text
                      style={[styles.clubInfoPairedReadOnlyText, { color: theme.colors.textSecondary }]}
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                    >
                      {formatDate(clubData.charter_date)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.fieldNote, styles.clubInfoPairedFieldNote, styles.clubInfoPairedNoteTightTop, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>This field cannot be edited</Text>
            </View>

            {/* Club Mission */}
            <View style={[styles.formField, styles.clubInfoMissionField]}>
              <View style={styles.clubMissionLabelRow}>
                <Text style={[styles.fieldLabel, styles.clubMissionLabelText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Club Mission
                </Text>
                <Text style={[styles.characterCountInline, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
                  {(clubData.club_mission || '').length} / 200 characters
                </Text>
              </View>
              <TextInput
                style={[styles.textAreaInput, styles.clubInfoCompactTextArea, { backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }]}
                placeholder="Enter your club's mission statement..."
                placeholderTextColor={theme.colors.textSecondary}
                value={clubData.club_mission || ''}
                onChangeText={(text) => {
                  if (text.length <= 200) {
                    updateField('club_mission', text);
                  }
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>

            {/* Club Status and Club Type */}
            <View style={[styles.formRow, styles.clubInfoStatusTypeRow]}>
              <View style={styles.formField}>
                <Text style={[styles.clubInfoPairedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Status</Text>
                <TouchableOpacity
                  style={[styles.dropdown, styles.clubInfoCompactDropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowClubStatusModal(true)}
                >
                  <Text
                    style={[styles.clubInfoPairedDropdownText, { color: clubData.club_status ? theme.colors.text : theme.colors.textSecondary }]}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                  >
                    {getClubStatusLabel()}
                  </Text>
                  <ChevronDown size={14} color="#2383E2" />
                </TouchableOpacity>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.clubInfoPairedLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Type</Text>
                <TouchableOpacity
                  style={[styles.dropdown, styles.clubInfoCompactDropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  onPress={() => setShowClubTypeModal(true)}
                >
                  <Text
                    style={[styles.clubInfoPairedDropdownText, { color: clubData.club_type ? theme.colors.text : theme.colors.textSecondary }]}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                  >
                    {getClubTypeLabel()}
                  </Text>
                  <ChevronDown size={14} color="#2383E2" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Banner Color Selection */}
            <View style={[styles.formField, styles.lastFormField]}>
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Banner Colour</Text>
              <TouchableOpacity
                style={[styles.colorSelector, styles.clubInfoCompactDropdown, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
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
                <ChevronDown size={16} color="#2383E2" />
              </TouchableOpacity>
            </View>
              </View>
            )}

            {/* Location Information Tab */}
            {activeTab === 'location' && (
              <View style={styles.locationTabWrap}>
                <View style={[styles.locationNotionPanel, { borderColor: theme.colors.border }]}>
                  <View style={[styles.locationNotionRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Country
                    </Text>
                    <CountryPicker
                      flat
                      value={clubData.country}
                      onChange={handleLocationCountryChange}
                      placeholder="Select country"
                      textColor={theme.colors.text}
                      placeholderColor={theme.colors.textSecondary}
                      borderColor={theme.colors.border}
                      focusColor={theme.colors.primary}
                      backgroundColor={theme.colors.surface}
                    />
                  </View>

                  <View style={[styles.locationNotionRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Time zone
                    </Text>
                    {clubData.country ? (
                      <Text style={[styles.locationNotionValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                        {clubData.time_zone
                          ? timezoneLabelFromValue(clubData.time_zone)
                          : 'Time zone not available for this country'}
                      </Text>
                    ) : (
                      <Text style={[styles.locationNotionValue, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        Select a country to set the time zone.
                      </Text>
                    )}
                  </View>

                  <View style={[styles.locationNotionRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club Address
                    </Text>
                    <TextInput
                      style={[styles.locationNotionInput, { color: theme.colors.text }]}
                      placeholder="Type full address (e.g., No 19, 7B, 1st Main Rd...)"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={clubData.address || ''}
                      onChangeText={(text) => updateField('address', text)}
                    />
                  </View>

                  <View style={[styles.locationNotionRow, { borderBottomColor: theme.colors.border }]}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      City
                    </Text>
                    <TextInput
                      style={[styles.locationNotionInput, { color: theme.colors.text }]}
                      placeholder="Type city (e.g., Chennai)"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={clubData.city || ''}
                      onChangeText={(text) => updateField('city', text)}
                    />
                  </View>

                  <View style={styles.locationNotionRowLast}>
                    <Text style={[styles.locationLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Location Map Link
                    </Text>
                    <TextInput
                      style={[styles.locationNotionInput, { color: theme.colors.text }]}
                      placeholder="https://maps.google.com/..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={clubData.google_location_link || ''}
                      onChangeText={(text) => updateField('google_location_link', text)}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={[styles.directionsBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleOpenDirections}
                    activeOpacity={0.85}
                  >
                    <Navigation size={14} color="#ffffff" />
                    <Text style={styles.directionsBtnText} maxFontSizeMultiplier={1.15}>
                      Get Directions
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* More Info Tab */}
            {activeTab === 'moreInfo' && (
              <View style={styles.notionMoreInfo}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: '#3b82f6' + '20' }]}>
                <Info size={20} color="#3b82f6" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club More Details</Text>
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
          <View style={[styles.formRow, styles.moreInfoSecondRow]}>
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

            {/* Club Meeting Details Tab */}
            {activeTab === 'meetingDetails' && (
              <View style={{ marginBottom: 24 }}>
                <ClubMeetingDetailsContent embedded prefetchedMeetingDetails={bundle?.meetingSchedule ?? null} />
              </View>
            )}
          </Animated.View>
          </View>
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
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
          <View style={[styles.dropdownModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
          <View style={[styles.colorModal, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
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
    fontSize: 14,
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
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
  },
  headerSpinnerWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerFetchingDot: {
    fontSize: 10,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 0,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  skeletonPanel: {
    paddingBottom: 8,
  },
  skeletonHeaderBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 0,
    opacity: 0.35,
  },
  skeletonTitle: {
    width: '55%',
    height: 16,
  },
  skeletonMeta: {
    width: '40%',
  },
  skeletonTabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  skeletonTabCell: {
    width: '50%',
    height: 72,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    opacity: 0.35,
  },
  skeletonBox: {
    height: 48,
    borderRadius: 0,
    opacity: 0.35,
    marginTop: 8,
  },
  skeletonTall: {
    height: 100,
    marginTop: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  skeletonHalf: {
    flex: 1,
    height: 48,
    borderRadius: 0,
    opacity: 0.35,
  },
  content: {
    flex: 1,
  },
  /** Single Notion-style surface: club summary + tabs + tab content */
  notionPanel: {
    marginHorizontal: 10,
    marginTop: 16,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  notionPanelHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionTabStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notionPanelBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notionClubInfoStack: {
    gap: 0,
  },
  /** ~2 lines (13px × ~2) between name → number/charter → mission */
  clubInfoNameBlock: {
    marginBottom: 26,
  },
  clubInfoNameFieldNote: {
    marginTop: 4,
    marginBottom: 0,
  },
  clubInfoNumberCharterBlock: {
    marginBottom: 26,
  },
  clubInfoPairedNoteTightTop: {
    marginTop: 4,
  },
  clubInfoMissionField: {
    marginBottom: 20,
  },
  clubInfoStatusTypeRow: {
    marginBottom: 20,
  },
  notionMoreInfo: {
    gap: 18,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
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
  clubName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 11,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  tabCell: {
    width: '50%',
    minHeight: 78,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  tabCellText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  tabCellTextActive: {
    fontWeight: '700',
  },
  unifiedCard: {
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    padding: 0,
  },
  locationTabWrap: {
    padding: 0,
    gap: 0,
  },
  locationNotionPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  locationNotionRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationNotionRowLast: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 0,
  },
  locationNotionInput: {
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginTop: 2,
    fontSize: 13,
    fontWeight: '400',
    minHeight: 40,
  },
  locationNotionValue: {
    fontSize: 13,
    fontWeight: '400',
    paddingVertical: 6,
    marginTop: 2,
    lineHeight: 20,
  },
  locationActions: {
    paddingTop: 16,
    alignItems: 'center',
  },
  locationSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  locationTimezonePlaceholder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    borderStyle: 'dashed',
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  locationTimezonePlaceholderText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 18,
  },
  locationInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '400',
    minHeight: 48,
  },
  locationTextArea: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '400',
    minHeight: 96,
    lineHeight: 20,
  },
  addressCard: {
    marginTop: 0,
  },
  addressFull: {
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  addressRowStacked: {
    flexDirection: 'column',
  },
  mapBox: {
    flex: 1,
    minWidth: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    overflow: 'hidden',
  },
  mapPreview: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLinkRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  mapLinkLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  mapLinkInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 11,
    fontWeight: '400',
  },
  mapFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  mapFooterTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  mapFooterTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  mapFooterSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 16,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 0,
    flexShrink: 0,
  },
  directionsBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  pinBox: {
    width: 132,
    flexShrink: 0,
  },
  pinBoxFullWidth: {
    width: '100%',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
    alignItems: 'flex-start',
  },
  clubInfoCompactRow: {
    marginBottom: 2,
  },
  moreInfoSecondRow: {
    marginTop: 10,
  },
  sectionBlock: {
    marginBottom: 18,
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
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  clubMissionLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  clubMissionLabelText: {
    flex: 1,
    marginBottom: 0,
  },
  characterCountInline: {
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '500',
    flexShrink: 0,
  },
  /** ~10% smaller type for side-by-side Club # / charter and status / type */
  clubInfoPairedLabel: {
    fontSize: 11.7,
    fontWeight: '600',
    marginBottom: 9,
    letterSpacing: -0.2,
  },
  clubInfoPairedReadOnlyText: {
    fontSize: 11.7,
    fontWeight: '500',
  },
  clubInfoPairedDropdownText: {
    fontSize: 11.7,
    flex: 1,
    fontWeight: '500',
    marginRight: 8,
  },
  clubInfoPairedFieldNote: {
    fontSize: 9.9,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 13,
    minHeight: 54,
  },
  textAreaInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 14,
    minHeight: 100,
    lineHeight: 24,
  },
  readOnlyField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 54,
  },
  clubInfoCompactReadOnly: {
    minHeight: 49,
    paddingVertical: 14,
  },
  readOnlyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  fieldNote: {
    fontSize: 11,
    marginTop: 5,
    fontStyle: 'italic',
    letterSpacing: -0.1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 54,
  },
  clubInfoCompactDropdown: {
    minHeight: 49,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 13,
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
    borderRadius: 0,
    padding: 16,
    margin: 20,
    maxHeight: '60%',
    minWidth: 250,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 14,
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
    borderRadius: 0,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 13,
    fontWeight: '400',
    flex: 1,
  },
  colorSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  clubInfoCompactTextArea: {
    minHeight: 90,
    paddingVertical: 14,
  },
  colorSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 0,
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  colorSelectorText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  bannerHelperText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 16,
  },
  colorModal: {
    borderRadius: 0,
    padding: 24,
    margin: 20,
    maxHeight: '78%',
    minWidth: 320,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalSubtitle: {
    fontSize: 12,
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
    borderRadius: 0,
    padding: 14,
    position: 'relative',
    marginBottom: 12,
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: 0,
    marginRight: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  colorDetails: {
    flex: 1,
  },
  colorName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  colorSpecs: {
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  bottomSpacing: {
    height: 40,
  },
});
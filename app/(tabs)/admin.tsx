import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Vote,
  UserPlus,
  Users,
  Building2,
  CalendarPlus,
  Crown,
  Share2,
  ChevronRight,
  HelpCircle,
  BookOpen,
  Calendar,
} from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { useCallback, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { prefetchClubInfoManagement } from '@/lib/prefetchClubInfoManagement';
import { prefetchExcommManagement } from '@/lib/prefetchExcommManagement';
import T360ClubOnboardingBox from '@/components/T360ClubOnboardingBox';
import {
  EMPTY_T360_CLUB_ONBOARDING,
  fetchT360ClubOnboardingProgress,
  shouldShowT360ClubOnboarding,
  type T360ClubOnboardingProgress,
} from '@/lib/t360ClubOnboarding';

/** Notion-like neutrals — flat blocks, hairline borders */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  borderStrong: 'rgba(55, 53, 47, 0.16)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  accentSoftBorder: 'rgba(35, 131, 226, 0.28)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  success: '#0F7B6C',
  successSoft: 'rgba(15, 123, 108, 0.12)',
};

const SETTING_UP_CLUB_SUB_PAGES = [
  {
    title: 'Club Info',
    route: '/admin/club-info-management' as const,
    Icon: Settings,
  },
  {
    title: 'Club Social Media',
    route: '/admin/social-media-management' as const,
    Icon: Share2,
  },
  {
    title: 'Club FAQ',
    route: '/admin/club-faq-management' as const,
    Icon: HelpCircle,
  },
];

function NotionRow({
  label,
  icon,
  onPress,
  isLast,
  iconBackgroundColor,
}: {
  label: string;
  icon?: ReactNode | null;
  onPress: () => void;
  isLast?: boolean;
  iconBackgroundColor?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.notionRow, !isLast && { borderBottomWidth: 1, borderBottomColor: N.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {icon ? (
        <View style={[styles.notionRowIconWrap, { backgroundColor: iconBackgroundColor || N.iconTile }]}>{icon}</View>
      ) : (
        <View style={styles.notionRowIconSpacer} />
      )}
      <Text style={[styles.notionRowLabel, { color: N.text }]} maxFontSizeMultiplier={1.25} numberOfLines={2}>
        {label}
      </Text>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function NotionActionList({
  items,
}: {
  items: {
    key: string;
    label: string;
    icon?: ReactNode | null;
    onPress: () => void;
    iconBackgroundColor?: string;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <View style={[styles.notionGroup, { borderColor: N.border, backgroundColor: N.surface }]}>
      {items.map((item, i) => (
        <NotionRow
          key={item.key}
          label={item.label}
          icon={item.icon}
          onPress={item.onPress}
          iconBackgroundColor={item.iconBackgroundColor}
          isLast={i === items.length - 1}
        />
      ))}
    </View>
  );
}

export default function AdminPanel() {
  const { user, isAuthenticated, refreshUserProfile } = useAuth();
  const queryClient = useQueryClient();

  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<T360ClubOnboardingProgress>(
    EMPTY_T360_CLUB_ONBOARDING
  );
  const [openMeetingCount, setOpenMeetingCount] = useState(0);

  const loadOpenMeetingCount = useCallback(async () => {
    const clubId = user?.currentClubId;
    if (!clubId) {
      setOpenMeetingCount(0);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('app_club_meeting')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('meeting_status', 'open');
      if (error) {
        console.error('Admin: open meeting count', error);
        setOpenMeetingCount(0);
        return;
      }
      setOpenMeetingCount(count ?? 0);
    } catch (e) {
      console.error('Admin: open meeting count', e);
      setOpenMeetingCount(0);
    }
  }, [user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserProfile();
      }
      void loadOpenMeetingCount();
    }, [isAuthenticated, refreshUserProfile, loadOpenMeetingCount])
  );

  const loadOnboarding = useCallback(async () => {
    const clubId = user?.currentClubId;
    const userId = user?.id;

    if (!clubId || !userId) return;
    setOnboardingLoading(true);

    try {
      const showForClub = await shouldShowT360ClubOnboarding(clubId, userId);
      if (!showForClub) {
        setShouldShowOnboarding(false);
        setOnboardingProgress(EMPTY_T360_CLUB_ONBOARDING);
        return;
      }

      const progress = await fetchT360ClubOnboardingProgress(clubId, userId);
      setOnboardingProgress(progress);
      setShouldShowOnboarding(!progress.isComplete);
    } catch (e) {
      console.error('Onboarding: unexpected error:', e);
    } finally {
      setOnboardingLoading(false);
    }
  }, [user?.currentClubId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      loadOnboarding();
    }, [isAuthenticated, loadOnboarding])
  );

  const getUserRole = () => {
    // Use club role if available and authenticated, otherwise fall back to user role
    if (user?.isAuthenticated && user?.clubRole) {
      return user.clubRole.toLowerCase();
    }
    return user?.role?.toLowerCase() || '';
  };
  
  const canSeeAdminFeature = (feature: string) => {
    const role = getUserRole();
    
    // Only excomm can see admin panel
    if (role !== 'excomm') {
      return false;
    }
    
    switch (feature) {
      case 'meeting_operations':
        return role === 'excomm'; // Only excomm can manage meeting operations
      case 'user_management':
        return role === 'excomm'; // Only excomm can manage users
      case 'club_operations':
        return role === 'excomm'; // Only excomm can manage club operations
      case 'voting_operations':
        return role === 'excomm'; // Only excomm can manage voting operations
      case 'excomm_corner':
        return role === 'excomm'; // Only excomm can access excomm corner
      default:
        return false;
    }
  };
  
  // If user doesn't have excomm access, show access denied with create club option
  if (!isAuthenticated || getUserRole() !== 'excomm') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.accessDeniedContainer}>
          <Settings size={40} color={N.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.accessDeniedTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>Access restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Executive Committee (ExComm) access is required for the Admin panel.
          </Text>
          <TouchableOpacity
            style={[styles.createClubButton, { backgroundColor: N.text, borderColor: N.text }]}
            onPress={() => router.push('/create-club')}
            activeOpacity={0.85}
          >
            <Building2 size={18} color={N.surface} strokeWidth={2} />
            <Text style={[styles.createClubButtonText, { color: N.surface }]} maxFontSizeMultiplier={1.3}>Create a club</Text>
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: N.textTertiary }]} maxFontSizeMultiplier={1.3}>
            Or ask your ExComm to invite you
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const meetingManagementItems = [
    ...(canSeeAdminFeature('meeting_operations')
      ? [
          {
            key: 'meeting',
            label: 'Create and Manage Meetings',
            icon: <CalendarPlus size={18} color="#2563EB" strokeWidth={1.75} />,
            iconBackgroundColor: '#EFF6FF',
            onPress: () => router.push('/admin/meeting-management'),
          },
        ]
      : []),
    ...(canSeeAdminFeature('voting_operations')
      ? [
          {
            key: 'voting',
            label: 'Voting operations',
            icon: <Vote size={18} color="#D97706" strokeWidth={1.75} />,
            iconBackgroundColor: '#FEF3C7',
            onPress: () => router.push('/admin/voting-operations'),
          },
        ]
      : []),
  ];

  const clubUserManagementItems = [
    ...(canSeeAdminFeature('user_management')
      ? [
          {
            key: 'invite-club-users',
            label: 'Invite Club Users',
            icon: <UserPlus size={18} color="#16A34A" strokeWidth={1.75} />,
            iconBackgroundColor: '#ECFDF5',
            onPress: () => router.push('/admin/invite-new-user'),
          },
          {
            key: 'manage-club-users',
            label: 'Manage Club Users',
            icon: <Users size={18} color="#EA580C" strokeWidth={1.75} />,
            iconBackgroundColor: '#FFF7ED',
            onPress: () => router.push('/admin/manage-existing-users'),
          },
        ]
      : []),
    ...(canSeeAdminFeature('club_operations')
      ? [
          {
            key: 'excomm',
            label: 'Manage ExComm Roles',
            icon: <Crown size={18} color={EXCOMM_UI.pillFg} strokeWidth={1.75} />,
            iconBackgroundColor: EXCOMM_UI.pillBg,
            onPress: () => {
              prefetchExcommManagement(queryClient, user?.currentClubId);
              router.push('/admin/excomm-management');
            },
          },
        ]
      : []),
  ];

  const settingUpClubItems = SETTING_UP_CLUB_SUB_PAGES.map(({ title, route, Icon }) => {
    const tilePalette =
      title === 'Club Info'
        ? { icon: '#334155', bg: '#F1F5F9' }
        : title === 'Club Social Media'
          ? { icon: '#0891B2', bg: '#ECFEFF' }
          : title === 'Club FAQ'
            ? { icon: '#7C3AED', bg: '#F5F3FF' }
            : { icon: '#475569', bg: '#F8FAFC' };

    return {
      key: route,
      label: title,
      icon: <Icon size={18} color={tilePalette.icon} strokeWidth={1.75} />,
      iconBackgroundColor: tilePalette.bg,
      onPress: () => {
      if (route.startsWith('/admin/club-info-management')) {
        prefetchClubInfoManagement(queryClient, user?.currentClubId);
      }
      if (route.startsWith('/admin/excomm-management')) {
        prefetchExcommManagement(queryClient, user?.currentClubId);
      }
      router.push(route);
      },
    };
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Admin
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.adminPageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
          <ClubSwitcher
            showRole={true}
            embedded
            variant="notion"
            clubIconBackgroundColor="#F1F5F9"
            clubIconColor="#334155"
          />
          <View style={[styles.adminMasterDivider, { backgroundColor: N.border }]} />
          {shouldShowOnboarding ? (
            <T360ClubOnboardingBox progress={onboardingProgress} loading={onboardingLoading} />
          ) : null}

          {canSeeAdminFeature('club_operations') ? (
            <>
              {shouldShowOnboarding ? (
                <View style={[styles.sectionSpacer, { backgroundColor: 'transparent' }]} />
              ) : null}
              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                T360 user guide
              </Text>
              <NotionActionList
                items={[
                  {
                    key: 't360-user-guide',
                    label: 'T360 user guide',
                    icon: <BookOpen size={18} color="#2383E2" strokeWidth={1.75} />,
                    iconBackgroundColor: N.accentSoft,
                    onPress: () => router.push('/t360-training'),
                  },
                  {
                    key: 't360-setup-help',
                    label: 'Need help setting up T360?',
                    icon: <Calendar size={18} color="#D97706" strokeWidth={1.75} />,
                    iconBackgroundColor: '#FEF3C7',
                    onPress: () => {
                      void Linking.openURL('https://calendly.com/t360-support/demo');
                    },
                  },
                ]}
              />
              <View style={[styles.sectionSpacer, { backgroundColor: 'transparent' }]} />
              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Setting Up the Club
              </Text>
              <NotionActionList items={settingUpClubItems} />
            </>
          ) : null}

          {(canSeeAdminFeature('user_management') || canSeeAdminFeature('club_operations')) &&
          clubUserManagementItems.length > 0 ? (
            <>
              {shouldShowOnboarding || canSeeAdminFeature('club_operations') ? (
                <View style={[styles.sectionSpacer, { backgroundColor: 'transparent' }]} />
              ) : null}
              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Club User Management
              </Text>
              <NotionActionList items={clubUserManagementItems} />
            </>
          ) : null}

          {meetingManagementItems.length > 0 ? (
            <>
              {shouldShowOnboarding ||
              canSeeAdminFeature('club_operations') ||
              ((canSeeAdminFeature('user_management') || canSeeAdminFeature('club_operations')) &&
                clubUserManagementItems.length > 0) ? (
                <View style={[styles.sectionSpacer, { backgroundColor: 'transparent' }]} />
              ) : null}
              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Create and Manage Meetings
              </Text>
              <NotionActionList items={meetingManagementItems} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  adminPageInset: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  adminMasterSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 8,
    marginTop: 4,
  },
  adminMasterDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionSpacer: {
    height: 8,
  },
  notionGroup: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  notionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  notionRowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notionRowIconSpacer: {
    width: 32,
    height: 32,
  },
  notionRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginTop: 16,
    gap: 8,
    borderWidth: 1,
  },
  createClubButtonText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },

});
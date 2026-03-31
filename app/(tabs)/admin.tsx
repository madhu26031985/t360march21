import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Vote,
  UserPlus,
  Building2,
  CalendarPlus,
  Crown,
  FileText,
  Share2,
  ChevronRight,
} from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';
import { useCallback, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { prefetchClubInfoManagement } from '@/lib/prefetchClubInfoManagement';
import { prefetchExcommManagement } from '@/lib/prefetchExcommManagement';

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

const CLUB_OPERATIONS_SUB_PAGES = [
  {
    title: 'Club Info',
    route: '/admin/club-info-management' as const,
    Icon: Settings,
  },
  {
    title: 'Club ExComm',
    route: '/admin/excomm-management' as const,
    Icon: Crown,
  },
  {
    title: 'Club Social Media',
    route: '/admin/social-media-management' as const,
    Icon: Share2,
  },
  {
    title: 'Club Resources',
    route: '/admin/member-resources-management' as const,
    Icon: FileText,
  },
];

function NotionRow({
  label,
  icon,
  onPress,
  isLast,
}: {
  label: string;
  icon?: ReactNode | null;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.notionRow, !isLast && { borderBottomWidth: 1, borderBottomColor: N.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {icon ? (
        <View style={[styles.notionRowIconWrap, { backgroundColor: N.iconTile }]}>{icon}</View>
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
  items: { key: string; label: string; icon?: ReactNode | null; onPress: () => void }[];
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
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2 | 3>(0);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
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
      // Show onboarding only for clubs created by the current user.
      const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('id, created_by')
        .eq('id', clubId)
        .maybeSingle();

      if (clubError) {
        console.error('Onboarding: failed to load club:', clubError);
        return;
      }

      if (!club || club.created_by !== userId) {
        setOnboardingStep(0);
        setShouldShowOnboarding(false);
        return;
      }

      // Step completion is derived from existing records.
      const [meetingRow, roleBookedRow, closedMeetingRow] = await Promise.all([
        supabase
          .from('app_club_meeting')
          .select('id')
          .eq('club_id', clubId)
          .limit(1),
        supabase
          .from('app_meeting_roles_management')
          .select('id')
          .eq('club_id', clubId)
          .eq('booking_status', 'booked')
          .limit(1),
        supabase
          .from('app_club_meeting')
          .select('id')
          .eq('club_id', clubId)
          .eq('meeting_status', 'close')
          .limit(1),
      ]);

      const step1Done = Boolean(meetingRow.data?.length);
      const step2Done = Boolean(roleBookedRow.data?.length);
      const step3Done = Boolean(closedMeetingRow.data?.length);

      const completedStep = step3Done ? 3 : step2Done ? 2 : step1Done ? 1 : 0;
      setOnboardingStep(completedStep);
      setShouldShowOnboarding(completedStep < 3);
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

  const startHereItems = [
    ...(canSeeAdminFeature('user_management')
      ? [
          {
            key: 'users',
            label: 'Invite new club members',
            icon: <UserPlus size={18} color={N.iconMuted} strokeWidth={1.75} />,
            onPress: () => router.push('/admin/manage-club-users'),
          },
        ]
      : []),
    ...(canSeeAdminFeature('meeting_operations')
      ? [
          {
            key: 'meeting',
            label: openMeetingCount > 0 ? 'Manage meetings' : 'Create meetings',
            icon: <CalendarPlus size={18} color={N.iconMuted} strokeWidth={1.75} />,
            onPress: () => router.push('/admin/meeting-management'),
          },
        ]
      : []),
    ...(canSeeAdminFeature('voting_operations')
      ? [
          {
            key: 'voting',
            label: 'Voting operations',
            icon: <Vote size={18} color={N.iconMuted} strokeWidth={1.75} />,
            onPress: () => router.push('/admin/voting-operations'),
          },
        ]
      : []),
  ];

  const clubOpsItems = CLUB_OPERATIONS_SUB_PAGES.map(({ title, route, Icon }) => ({
    key: route,
    label: title,
    icon: <Icon size={18} color={N.iconMuted} strokeWidth={1.75} />,
    onPress: () => {
      if (route.startsWith('/admin/club-info-management')) {
        prefetchClubInfoManagement(queryClient, user?.currentClubId);
      }
      if (route.startsWith('/admin/excomm-management')) {
        prefetchExcommManagement(queryClient, user?.currentClubId);
      }
      router.push(route);
    },
  }));

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
          <ClubSwitcher showRole={true} embedded />
          <View style={[styles.adminMasterDivider, { backgroundColor: N.border }]} />
          {(canSeeAdminFeature('meeting_operations') ||
            canSeeAdminFeature('user_management') ||
            canSeeAdminFeature('voting_operations')) && (
            <>
              {shouldShowOnboarding && onboardingStep < 3 && (
                <View style={[styles.onboardingCard, { backgroundColor: N.page, borderColor: N.border }]}>
                  <View style={styles.onboardingHeaderRow}>
                    <View style={[styles.onboardingBadge, { backgroundColor: N.accentSoft, borderColor: N.accentSoftBorder }]}>
                      <Text style={[styles.onboardingBadgeText, { color: N.accent }]} maxFontSizeMultiplier={1.2}>
                        {Math.min(3, onboardingStep + 1)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.onboardingTitle, { color: N.text }]} maxFontSizeMultiplier={1.2}>
                        Getting started
                      </Text>
                      <Text style={[styles.onboardingSubtitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        {onboardingLoading ? 'Loading…' : 'Complete each step in order.'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.timeline}>
                    {[
                      { n: 1 as const, label: 'Create meeting' },
                      { n: 2 as const, label: 'Book a role' },
                      { n: 3 as const, label: 'Close meeting' },
                    ].map((step) => {
                      const done = onboardingStep >= step.n;
                      const isActive = onboardingStep < 3 && step.n === onboardingStep + 1;
                      const circleBackground = done ? N.success : isActive ? N.accent : N.surface;
                      const circleText = done ? '✓' : String(step.n);
                      const circleTextColor = done || isActive ? N.surface : N.textSecondary;

                      return (
                        <View key={step.n} style={styles.timelineRow}>
                          <View style={styles.timelineIconCol}>
                            <View
                              style={[
                                styles.timelineCircle,
                                { backgroundColor: circleBackground },
                                !done && !isActive && {
                                  borderWidth: 1,
                                  borderColor: N.borderStrong,
                                },
                              ]}
                            >
                              <Text style={[styles.timelineCircleText, { color: circleTextColor }]} maxFontSizeMultiplier={1.3}>
                                {circleText}
                              </Text>
                            </View>
                            {step.n !== 3 && (
                              <View
                                style={[
                                  styles.timelineLine,
                                  { backgroundColor: onboardingStep >= step.n ? N.accent : N.border },
                                ]}
                              />
                            )}
                          </View>
                          <View style={styles.timelineTextCol}>
                            <Text
                              style={[
                                styles.timelineLabel,
                                {
                                  color: done ? N.success : isActive ? N.text : N.textSecondary,
                                  fontWeight: isActive ? '600' : '500',
                                },
                              ]}
                              maxFontSizeMultiplier={1.2}
                              numberOfLines={2}
                            >
                              {step.label}
                            </Text>
                            <Text style={[styles.timelineMeta, { color: N.textTertiary }]} maxFontSizeMultiplier={1.2}>
                              {done ? 'Done' : step.n === onboardingStep + 1 ? 'In progress' : 'Not started'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Start here
              </Text>
              <NotionActionList items={startHereItems} />
            </>
          )}
          {canSeeAdminFeature('club_operations') && (
            <>
              {(canSeeAdminFeature('meeting_operations') ||
                canSeeAdminFeature('user_management') ||
                canSeeAdminFeature('voting_operations')) && (
                <View style={[styles.sectionSpacer, { backgroundColor: 'transparent' }]} />
              )}
              <Text style={[styles.adminMasterSectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Club operations
              </Text>
              <NotionActionList items={clubOpsItems} />
            </>
          )}
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

  onboardingCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  onboardingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  onboardingBadge: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  onboardingTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  onboardingSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },

  timeline: {
    gap: 10,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineIconCol: {
    width: 30,
    alignItems: 'center',
  },
  timelineCircle: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCircleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  timelineLine: {
    width: 3,
    height: 18,
    borderRadius: 2,
    marginTop: 2,
  },
  timelineTextCol: {
    flex: 1,
    paddingTop: 1,
  },
  timelineLabel: {
    fontSize: 14,
    letterSpacing: -0.15,
  },
  timelineMeta: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
});
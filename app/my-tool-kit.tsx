import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  CalendarPlus,
  Vote,
  ChevronRight,
  Settings,
  Crown,
  Building2,
  Share2,
  FileText,
  HelpCircle,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useState, useMemo, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { prefetchClubInfoManagement } from '@/lib/prefetchClubInfoManagement';
import { prefetchExcommManagement } from '@/lib/prefetchExcommManagement';

const CLUB_OPERATIONS_SUB_PAGES = [
  { title: 'Club Info', route: '/admin/club-info-management' as const, Icon: Settings },
  { title: 'Club ExComm', route: '/admin/excomm-management' as const, Icon: Crown },
  { title: 'Club Social Media', route: '/admin/social-media-management' as const, Icon: Share2 },
  { title: 'Club Resources', route: '/admin/member-resources-management' as const, Icon: FileText },
  { title: 'Club FAQ', route: '/admin/club-faq-management' as const, Icon: HelpCircle },
] as const;

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  accent: '#2563EB',
};

type ToolkitTab = 'admin';

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

export default function MyToolKitScreen() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ToolkitTab>('admin');
  const [openMeetingCount, setOpenMeetingCount] = useState(0);

  const isExComm = useMemo(() => {
    const fromList = user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
    const fromField = user?.clubRole?.toLowerCase() === 'excomm';
    return fromList || fromField;
  }, [user?.clubs, user?.currentClubId, user?.clubRole]);

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
        console.error('My tool kit: open meeting count', error);
        setOpenMeetingCount(0);
        return;
      }
      setOpenMeetingCount(count ?? 0);
    } catch (e) {
      console.error('My tool kit: open meeting count', e);
      setOpenMeetingCount(0);
    }
  }, [user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      void loadOpenMeetingCount();
    }, [loadOpenMeetingCount])
  );

  const adminItems = useMemo(
    () => [
      {
        key: 'invite',
        label: 'Invite new club members',
        icon: <UserPlus size={18} color="#16A34A" strokeWidth={1.75} />,
        iconBackgroundColor: '#ECFDF5',
        onPress: () => router.push('/admin/manage-club-users'),
      },
      {
        key: 'meetings',
        label: openMeetingCount > 0 ? 'Manage meetings' : 'Create meetings',
        icon: <CalendarPlus size={18} color="#2563EB" strokeWidth={1.75} />,
        iconBackgroundColor: '#EFF6FF',
        onPress: () => router.push('/admin/meeting-management'),
      },
      {
        key: 'voting',
        label: 'Voting operations',
        icon: <Vote size={18} color="#D97706" strokeWidth={1.75} />,
        iconBackgroundColor: '#FEF3C7',
        onPress: () => router.push('/admin/voting-operations'),
      },
    ],
    [openMeetingCount]
  );

  const clubOpsItems = useMemo(
    () =>
      CLUB_OPERATIONS_SUB_PAGES.map(({ title, route, Icon }) => {
        const tilePalette =
          title === 'Club Info'
            ? { icon: '#334155', bg: '#F1F5F9' }
            : title === 'Club ExComm'
              ? { icon: EXCOMM_UI.pillFg, bg: EXCOMM_UI.pillBg }
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
      }),
    [queryClient, user?.currentClubId]
  );

  if (!user?.currentClubId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <ArrowLeft size={24} color={N.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Excomm Quick access
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={[styles.deniedText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Join a club to use Excomm Quick access.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !isExComm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
            <ArrowLeft size={24} color={N.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Excomm Quick access
          </Text>
          <View style={styles.headerRightSpacer} />
        </View>
        <View style={styles.accessDeniedContainer}>
          <Settings size={40} color={N.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.accessDeniedTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            ExComm only
          </Text>
          <Text style={[styles.accessDeniedMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Excomm Quick access is available to Executive Committee members for this club.
          </Text>
          <TouchableOpacity
            style={[styles.createClubButton, { backgroundColor: N.text, borderColor: N.text }]}
            onPress={() => router.push('/create-club')}
            activeOpacity={0.85}
          >
            <Building2 size={18} color={N.surface} strokeWidth={2} />
            <Text style={[styles.createClubButtonText, { color: N.surface }]} maxFontSizeMultiplier={1.2}>
              Create a club
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={N.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Excomm Quick access
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <View style={[styles.segmentOuter, { borderColor: '#BFDBFE', backgroundColor: '#F8FAFC' }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.segmentScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[
              styles.segmentTab,
              tab === 'admin' && [styles.segmentTabActive, { backgroundColor: N.accent, borderColor: '#1D4ED8' }],
            ]}
            onPress={() => setTab('admin')}
            activeOpacity={0.85}
          >
            <Crown size={13} color={tab === 'admin' ? '#ffffff' : N.textSecondary} />
            <Text
              style={[
                styles.segmentTabText,
                { color: tab === 'admin' ? '#ffffff' : N.textSecondary, fontWeight: tab === 'admin' ? '700' : '500' },
              ]}
              maxFontSizeMultiplier={1.15}
              numberOfLines={1}
            >
              Admin
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        {tab === 'admin' ? (
          <>
            <Text style={[styles.sectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Start here
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border, backgroundColor: N.surface }]}>
              {adminItems.map((item, i) => (
                <NotionRow
                  key={item.key}
                  label={item.label}
                  icon={item.icon}
                  onPress={item.onPress}
                  iconBackgroundColor={item.iconBackgroundColor}
                  isLast={i === adminItems.length - 1}
                />
              ))}
            </View>
            <View style={styles.sectionSpacer} />
            <Text style={[styles.sectionTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
              Club operations
            </Text>
            <View style={[styles.notionGroup, { borderColor: N.border, backgroundColor: N.surface }]}>
              {clubOpsItems.map((item, i) => (
                <NotionRow
                  key={item.key}
                  label={item.label}
                  icon={item.icon}
                  onPress={item.onPress}
                  iconBackgroundColor={item.iconBackgroundColor}
                  isLast={i === clubOpsItems.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 44,
  },
  segmentOuter: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    overflow: 'hidden',
  },
  segmentScrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minWidth: '100%',
    gap: 0,
  },
  segmentTab: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentTabActive: {},
  segmentTabText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionSpacer: {
    height: 8,
  },
  notionGroup: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  notionRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notionRowIconSpacer: {
    width: 36,
    height: 36,
  },
  notionRowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deniedText: {
    fontSize: 15,
    textAlign: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  accessDeniedMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  createClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  createClubButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

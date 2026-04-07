import { View, Text, StyleSheet, ScrollView, TouchableOpacity, type ReactNode, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  UserPlus,
  Building2,
  Crown,
  User,
  Shield,
  Eye,
  UserCheck,
  Users,
  ChevronRight,
  Home,
  Calendar,
  Settings,
} from 'lucide-react-native';

/** Notion-like neutrals (match admin panel) */
const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  pillBg: '#F0EFED',
};

/** Colored icon tiles (Notion / Book-a-Role style — soft fill + saturated glyph). */
const ICON_TILE = {
  club: { bg: 'rgba(35, 131, 226, 0.14)', fg: '#2383E2' },
  invite: { bg: 'rgba(4, 120, 87, 0.12)', fg: '#047857' },
  manage: { bg: 'rgba(234, 88, 12, 0.12)', fg: '#EA580C' },
} as const;

const FOOTER_NAV_ICON_SIZE = 15;
const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

function NotionActionRow({
  title,
  description,
  icon,
  iconBackground,
  onPress,
  isLast,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  iconBackground: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.notionRow, !isLast && { borderBottomWidth: 1, borderBottomColor: N.border }]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={[styles.notionRowIconWrap, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.notionRowTextCol}>
        <Text style={[styles.notionRowTitle, { color: N.text }]} maxFontSizeMultiplier={1.25} numberOfLines={2}>
          {title}
        </Text>
        {description ? (
          <Text style={[styles.notionRowDesc, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

export default function ManageClubUsers() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const hasClub = user?.currentClubId != null;
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';

  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClubInfo();
  }, []);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('id, name, club_number')
        .eq('id', user.currentClubId)
        .single();

      if (error) {
        console.error('Error loading club info:', error);
        return;
      }

      setClubInfo(data);
    } catch (error) {
      console.error('Error loading club info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: string, iconColor: string = N.text) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={12} color={iconColor} />;
      case 'visiting_tm':
        return <UserCheck size={12} color={iconColor} />;
      case 'club_leader':
        return <Shield size={12} color={iconColor} />;
      case 'guest':
        return <Eye size={12} color={iconColor} />;
      case 'member':
        return <User size={12} color={iconColor} />;
      default:
        return <User size={12} color={iconColor} />;
    }
  };

  const notionRolePill = (role: string): { bg: string; fg: string } => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return { bg: EXCOMM_UI.pillBg, fg: EXCOMM_UI.pillFg };
      case 'visiting_tm':
        return { bg: 'rgba(16, 185, 129, 0.12)', fg: '#047857' };
      case 'club_leader':
        return { bg: 'rgba(245, 158, 11, 0.14)', fg: '#B45309' };
      case 'guest':
        return { bg: N.pillBg, fg: N.textSecondary };
      case 'member':
        return { bg: N.accentSoft, fg: N.accent };
      default:
        return { bg: N.pillBg, fg: N.textSecondary };
    }
  };

  const formatRole = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return 'ExComm';
      case 'visiting_tm':
        return 'Visiting TM';
      case 'club_leader':
        return 'Club Leader';
      case 'guest':
        return 'Guest';
      case 'member':
        return 'Member';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]} edges={['top']}>
      <View style={styles.pageMain}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Club members
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.pageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
          {clubInfo && (
            <>
              <View style={styles.clubBlock}>
                <View style={styles.clubHeader}>
                  <View style={[styles.clubIcon, { backgroundColor: ICON_TILE.club.bg }]}>
                    <Building2 size={18} color={ICON_TILE.club.fg} strokeWidth={1.75} />
                  </View>
                  <View style={styles.clubInfo}>
                    <Text style={[styles.clubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                      {clubInfo.name}
                    </Text>
                    <View style={styles.clubMeta}>
                      {clubInfo.club_number && (
                        <Text style={[styles.clubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Club #{clubInfo.club_number}
                        </Text>
                      )}
                      {user?.clubRole && (() => {
                        const pill = notionRolePill(user.clubRole);
                        return (
                          <View style={[styles.roleTag, { backgroundColor: pill.bg }]}>
                            {getRoleIcon(user.clubRole, pill.fg)}
                            <Text style={[styles.roleText, { color: pill.fg }]} maxFontSizeMultiplier={1.3}>
                              {formatRole(user.clubRole)}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.insetDivider, { backgroundColor: N.border }]} />
            </>
          )}

          <Text style={[styles.sectionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Actions
          </Text>

          <View style={[styles.notionGroup, { borderColor: N.border }]}>
            <NotionActionRow
              title="Invite new club members"
              description="Send invites and grow your club community."
              icon={<UserPlus size={18} color={ICON_TILE.invite.fg} strokeWidth={1.75} />}
              iconBackground={ICON_TILE.invite.bg}
              onPress={() => router.push('/admin/invite-new-user')}
            />
            <NotionActionRow
              title="Manage club members"
              description="Organize members, roles, and access in one place."
              icon={<Users size={18} color={ICON_TILE.manage.fg} strokeWidth={1.75} />}
              iconBackground={ICON_TILE.manage.bg}
              onPress={() => router.push('/admin/manage-existing-users')}
              isLast
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
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
          {hasClub ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Meeting
              </Text>
            </TouchableOpacity>
          ) : null}
          {isExComm ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
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
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 38,
  },
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
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
  pageInset: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  clubBlock: {
    marginBottom: 0,
  },
  insetDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 8,
  },
  notionGroup: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: N.surface,
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
  notionRowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  notionRowTitle: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  notionRowDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    fontWeight: '400',
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});

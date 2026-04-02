import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
  Platform,
  Image,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCoffeePromptEligibility } from '@/lib/coffeePromptEligibility';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  ClipboardCheck,
  User,
  Users,
  Calendar,
  Shield,
  Home,
  Settings,
  Coffee,
  MessageCircle,
  Globe,
} from 'lucide-react-native';

/** Notion-like neutrals + accent (no red/green on completion UI). */
const N = {
  canvas: '#F7F7F5',
  shell: '#FFFFFF',
  ink: '#37352F',
  muted: '#787774',
  faint: 'rgba(55, 53, 47, 0.08)',
  hairline: 'rgba(55, 53, 47, 0.09)',
  segment: '#E3E2E0',
  inset: '#FAFAF8',
  accent: '#6BA8F0',
  accentSoft: 'rgba(107, 168, 240, 0.18)',
};

const T360_WEB_LOGIN_URL = 'https://t360.in/weblogin';
const T360_WHATSAPP_SUPPORT_URL = 'https://wa.me/9597491113';
const ROLE_COMPLETION_DOCK_ICON_SIZE = 15;

type RoleTabId = 'my_role' | 'all_roles';

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

interface RoleAssignment {
  id: string;
  role_name: string;
  role_classification: string | null;
  assigned_user_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completion_notes: string | null;
  assigned_user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function RoleCompletionReport() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { shouldShowCoffee } = useCoffeePromptEligibility();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRoleTab, setActiveRoleTab] = useState<RoleTabId>('my_role');
  const isExComm =
    user?.clubs?.find((c) => c.id === user?.currentClubId)?.role?.toLowerCase() === 'excomm';
  const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

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

  useEffect(() => {
    if (meetingId) {
      loadRoleCompletionData();
    }
  }, [meetingId]);

  const loadRoleCompletionData = async () => {
    if (!meetingId || !user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      await Promise.all([
        loadMeeting(),
        loadRoleAssignments()
      ]);
    } catch (error) {
      console.error('Error loading role completion data:', error);
      Alert.alert('Error', 'Failed to load role completion data');
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

  const loadRoleAssignments = async () => {
    if (!meetingId) return;

    try {
      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          id,
          role_name,
          role_classification,
          assigned_user_id,
          is_completed,
          completed_at,
          completion_notes,
          assigned_user:app_user_profiles!fk_meeting_roles_management_assigned_user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('meeting_id', meetingId)
        .eq('role_status', 'Available')
        .not('assigned_user_id', 'is', null)
        .order('order_index');

      if (error) {
        console.error('Error loading role assignments:', error);
        return;
      }

      setRoleAssignments(data || []);
    } catch (error) {
      console.error('Error loading role assignments:', error);
    }
  };

  const handleToggleCompletion = async (roleId: string, currentStatus: boolean) => {
    const role = roleAssignments.find(r => r.id === roleId);
    const isExComm = user?.isAuthenticated && user?.clubRole?.toLowerCase() === 'excomm';
    const isAssignedUser = role?.assigned_user_id === user?.id;
    
    if (!user?.isAuthenticated || (!isExComm && !isAssignedUser)) {
      Alert.alert('Access Denied', 'You can only mark completion for your own assigned roles, or if you are an ExComm member.');
      return;
    }

    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          is_completed: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : null,
          completion_notes: !currentStatus ? `Marked as completed by ${user.fullName}` : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('Error updating role completion:', error);
        Alert.alert('Error', 'Failed to update role completion status');
        return;
      }

      // Update local state
      setRoleAssignments(prev => prev.map(role =>
        role.id === roleId
          ? {
              ...role,
              is_completed: !currentStatus,
              completed_at: !currentStatus ? new Date().toISOString() : null,
              completion_notes: !currentStatus ? `Marked as completed by ${user.fullName}` : null,
            }
          : role
      ));
    } catch (error) {
      console.error('Error updating role completion:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const myRoles = useMemo(
    () => roleAssignments.filter((r) => r.assigned_user_id === user?.id),
    [roleAssignments, user?.id]
  );

  const displayedRoles = activeRoleTab === 'my_role' ? myRoles : roleAssignments;
  const totalRoles = displayedRoles.length;
  const completedRoles = displayedRoles.filter((r) => r.is_completed).length;
  const completionPercentage = totalRoles > 0 ? Math.round((completedRoles / totalRoles) * 100) : 0;

  const RoleRow = ({ role }: { role: RoleAssignment }) => {
    const isExComm = user?.isAuthenticated && user?.clubRole?.toLowerCase() === 'excomm';
    const isAssignedUser = role.assigned_user_id === user?.id;
    const canEdit = user?.isAuthenticated && (isExComm || isAssignedUser);

    return (
      <View style={[styles.roleRow, { borderBottomColor: N.hairline }]}>
        <View style={styles.roleRowTop}>
          <View style={styles.userAvatar}>
            {role.assigned_user?.avatar_url ? (
              <Image source={{ uri: role.assigned_user.avatar_url }} style={styles.userAvatarImage} />
            ) : (
              <View style={[styles.userAvatarPlaceholder, { backgroundColor: N.segment }]}>
                <User size={18} color={N.muted} />
              </View>
            )}
          </View>
          <View style={styles.roleInfo}>
            <Text style={[styles.roleName, { color: N.ink }]} maxFontSizeMultiplier={1.25}>
              {role.role_name}
            </Text>
            {role.assigned_user && (
              <Text style={[styles.userName, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                {role.assigned_user.full_name}
              </Text>
            )}
            {role.is_completed && role.completion_notes && (
              <Text style={[styles.markedByText, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                {role.completion_notes}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: role.is_completed ? 'rgba(37, 99, 235, 0.20)' : 'rgba(55, 53, 47, 0.10)',
              },
            ]}
          >
            <Text
              style={[styles.statusPillText, { color: role.is_completed ? '#1d4ed8' : '#525252' }]}
              maxFontSizeMultiplier={1.15}
            >
              {role.is_completed ? 'Done' : 'Pending'}
            </Text>
          </View>
        </View>
        {canEdit && (
          <View style={styles.roleActionsRow}>
            <Pressable
              onPress={() => !role.is_completed && handleToggleCompletion(role.id, role.is_completed)}
              disabled={role.is_completed}
              style={({ pressed }) => [
                styles.actionPill,
                {
                  borderColor: role.is_completed ? 'rgba(55, 53, 47, 0.14)' : 'rgba(55, 53, 47, 0.24)',
                  backgroundColor: role.is_completed ? 'rgba(55, 53, 47, 0.09)' : 'rgba(55, 53, 47, 0.13)',
                  opacity: pressed ? 0.88 : role.is_completed ? 0.45 : 1,
                },
              ]}
            >
              <Text style={[styles.actionPillText, { color: '#4b5563' }]} maxFontSizeMultiplier={1.15}>
                Mark complete
              </Text>
            </Pressable>
            <Pressable
              onPress={() => role.is_completed && handleToggleCompletion(role.id, role.is_completed)}
              disabled={!role.is_completed}
              style={({ pressed }) => [
                styles.actionPill,
                {
                  borderColor: role.is_completed ? '#2563eb' : 'rgba(55, 53, 47, 0.24)',
                  backgroundColor: role.is_completed ? 'rgba(37, 99, 235, 0.20)' : 'rgba(55, 53, 47, 0.13)',
                  opacity: pressed ? 0.88 : !role.is_completed ? 0.45 : 1,
                },
              ]}
            >
              <Text
                style={[styles.actionPillText, { color: role.is_completed ? '#2563eb' : '#4b5563' }]}
                maxFontSizeMultiplier={1.15}
              >
                Mark pending
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.ink }]} maxFontSizeMultiplier={1.3}>
            Loading role completion…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
        <View style={styles.loadingContainer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.bookRoleMain}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          Role completion
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.bookRoleScroll}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.notionShell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.meetingMetaRow}>
            <View style={[styles.dateChip, { backgroundColor: N.inset }]}>
              <Text style={[styles.dateChipDay, { color: N.ink }]} maxFontSizeMultiplier={1.2}>
                {new Date(meeting.meeting_date).getDate()}
              </Text>
              <Text style={[styles.dateChipMonth, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meetingMetaText}>
              <Text style={[styles.meetingMetaTitle, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                {meeting.meeting_title}
              </Text>
              <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long' })}
                {meeting.meeting_number != null && String(meeting.meeting_number).trim() !== ''
                  ? ` · Meeting ${meeting.meeting_number}`
                  : ''}
              </Text>
              {meeting.meeting_start_time ? (
                <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                  {meeting.meeting_start_time}
                  {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
                  {' · '}
                  {meeting.meeting_mode === 'in_person'
                    ? 'In person'
                    : meeting.meeting_mode === 'online'
                      ? 'Online'
                      : 'Hybrid'}
                </Text>
              ) : (
                <Text style={[styles.meetingMetaLine, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                  {meeting.meeting_mode === 'in_person'
                    ? 'In person'
                    : meeting.meeting_mode === 'online'
                      ? 'Online'
                      : 'Hybrid'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.notionTabsRow}>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: activeRoleTab === 'my_role' ? theme.colors.primary : 'transparent',
                  borderColor: activeRoleTab === 'my_role' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveRoleTab('my_role')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: activeRoleTab === 'my_role' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.12}
              >
                My role
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.notionTab,
                {
                  backgroundColor: activeRoleTab === 'all_roles' ? theme.colors.primary : 'transparent',
                  borderColor: activeRoleTab === 'all_roles' ? theme.colors.primary : theme.colors.border,
                },
              ]}
              onPress={() => setActiveRoleTab('all_roles')}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.notionTabText,
                  { color: activeRoleTab === 'all_roles' ? '#ffffff' : theme.colors.text },
                ]}
                maxFontSizeMultiplier={1.12}
              >
                All roles
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.notionDivider, { backgroundColor: theme.colors.border }]} />

          {activeRoleTab === 'all_roles' ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                Meeting progress
              </Text>
              <Text style={[styles.progressPercentage, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.15}>
                {completionPercentage}%
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View style={[styles.progressFill, { backgroundColor: theme.colors.primary, width: `${completionPercentage}%` }]} />
            </View>
            <Text style={[styles.progressText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
              {completedRoles} of {totalRoles} roles complete
            </Text>
          </View>
          ) : null}

          <View style={[styles.notionDivider, { backgroundColor: theme.colors.border }]} />

          <Text style={[styles.listCaption, { color: N.muted }]} maxFontSizeMultiplier={1.1}>
            {activeRoleTab === 'my_role' ? 'Your bookings' : 'Everyone booked'}
          </Text>

          {displayedRoles.length === 0 ? (
            <View style={styles.noRolesState}>
              <ClipboardCheck size={32} color={N.muted} />
              <Text style={[styles.noRolesText, { color: N.ink }]} maxFontSizeMultiplier={1.2}>
                {activeRoleTab === 'my_role' ? 'No roles assigned to you' : 'No role assignments'}
              </Text>
              <Text style={[styles.noRolesSubtext, { color: N.muted }]} maxFontSizeMultiplier={1.15}>
                {activeRoleTab === 'my_role'
                  ? 'Book a role for this meeting or ask your VPE if you expected an assignment.'
                  : 'Assigned roles will appear here once members book them.'}
              </Text>
            </View>
          ) : (
            displayedRoles.map((role) => <RoleRow key={role.id} role={role} />)
          )}

          <View style={styles.bottomPadding} />
        </View>
        {/* /notionShell */}
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
              <Home size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Home
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Users size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#d97706" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Calendar size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#0ea5e9" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Meeting
            </Text>
          </TouchableOpacity>
          {isExComm ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Shield size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#7c3aed" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Settings size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#6b7280" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Settings
            </Text>
          </TouchableOpacity>
          {shouldShowCoffee ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/buy-us-a-coffee')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle]}>
                <Coffee size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#92400e" />
              </View>
              <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Coffee
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.footerNavItem} onPress={openWhatsAppSupport} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <MessageCircle size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#22c55e" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Support
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerNavItem} onPress={openWebLogin} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle]}>
              <Globe size={ROLE_COMPLETION_DOCK_ICON_SIZE} color="#334155" />
            </View>
            <Text style={[styles.footerNavLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Web
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      </View>
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
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  bookRoleMain: {
    flex: 1,
    minHeight: 0,
  },
  bookRoleScroll: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  notionShell: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    ...Platform.select({
      web: {
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      },
      default: {},
    }),
  },
  meetingMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  dateChip: {
    width: 48,
    height: 48,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipDay: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  dateChipMonth: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: -1,
  },
  meetingMetaText: {
    flex: 1,
    minWidth: 0,
  },
  meetingMetaTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  meetingMetaLine: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
  },
  notionTabsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 8,
  },
  notionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  notionTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  progressBlock: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    borderRadius: 0,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  listCaption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  roleRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  roleRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfo: {
    flex: 1,
    minWidth: 0,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  userName: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 2,
  },
  markedByText: {
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  roleActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginLeft: 54,
  },
  actionPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noRolesState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  noRolesText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  noRolesSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
  bottomPadding: {
    height: 8,
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


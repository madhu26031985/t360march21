import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { excommManagementQueryKeys, fetchExcommManagementBundle } from '@/lib/excommManagementQuery';
import {
  ArrowLeft,
  Crown,
  User,
  X,
  Building2,
  Shield,
  Eye,
  UserCheck,
  GraduationCap,
  Users,
  Megaphone,
  FileText,
  Wallet,
  History,
  Search,
  Calendar,
  Info,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone_number: string | null;
  role: string;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

interface ExCommRole {
  key: string;
  title: string;
  description: string;
  member_id: string | null;
  term_start: string | null;
  term_end: string | null;
}

interface ClubProfile {
  president_id: string | null;
  president_term_start: string | null;
  president_term_end: string | null;
  vpe_id: string | null;
  vpe_term_start: string | null;
  vpe_term_end: string | null;
  vpm_id: string | null;
  vpm_term_start: string | null;
  vpm_term_end: string | null;
  vppr_id: string | null;
  vppr_term_start: string | null;
  vppr_term_end: string | null;
  secretary_id: string | null;
  secretary_term_start: string | null;
  secretary_term_end: string | null;
  treasurer_id: string | null;
  treasurer_term_start: string | null;
  treasurer_term_end: string | null;
  saa_id: string | null;
  saa_term_start: string | null;
  saa_term_end: string | null;
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  president: Crown,
  vpe: GraduationCap,
  vpm: Users,
  vppr: Megaphone,
  secretary: FileText,
  treasurer: Wallet,
  saa: Shield,
  ipp: History,
};

function getRoleIconForKey(key: string): LucideIcon {
  return ROLE_ICONS[key] ?? Building2;
}

function serializeAssignments(roles: ExCommRole[]) {
  return JSON.stringify(
    roles.map((r) => ({
      k: r.key,
      m: r.member_id,
      s: r.term_start,
      e: r.term_end,
    }))
  );
}

const EXCOMM_ROLE_DEFINITIONS: Omit<ExCommRole, 'member_id' | 'term_start' | 'term_end'>[] = [
  { key: 'president', title: 'President', description: 'Chief executive officer of the club' },
  { key: 'vpe', title: 'VP Education', description: 'Oversees educational programs and member development' },
  { key: 'vpm', title: 'VP Membership', description: 'Manages membership growth and retention' },
  { key: 'vppr', title: 'VP Public Relations', description: 'Handles club marketing and public relations' },
  { key: 'secretary', title: 'Secretary', description: 'Maintains club records and correspondence' },
  { key: 'treasurer', title: 'Treasurer', description: 'Manages club finances and dues' },
  { key: 'saa', title: 'Sergeant at Arms', description: 'Maintains order and manages club property' },
  { key: 'ipp', title: 'Immediate Past President', description: 'Former president providing guidance and continuity' },
];

function emptyRolesFromDefinitions(): ExCommRole[] {
  return EXCOMM_ROLE_DEFINITIONS.map((d) => ({
    ...d,
    member_id: null,
    term_start: null,
    term_end: null,
  }));
}

function mapClubProfileToExcommRoles(clubProfile: Record<string, unknown> | null | undefined): ExCommRole[] {
  const p = clubProfile || {};
  return EXCOMM_ROLE_DEFINITIONS.map((role) => ({
    key: role.key,
    title: role.title,
    description: role.description,
    member_id: (p[`${role.key}_id`] as string | null | undefined) || null,
    term_start: (p[`${role.key}_term_start`] as string | null | undefined) || null,
    term_end: (p[`${role.key}_term_end`] as string | null | undefined) || null,
  }));
}

const EXCOMM_MANAGEMENT_INFO_MESSAGE =
  'Go ahead and configure your leadership team using ExCom Management.\n\nIt helps your members and guests know your ExCom and their responsibilities under Club → Leadership.';

type ExCommTheme = ReturnType<typeof useTheme>['theme'];

interface ExCommRoleCardProps {
  role: ExCommRole;
  theme: ExCommTheme;
  assignedMember: ClubMember | undefined;
  isLast: boolean;
  onAssignMember: () => void;
  onChangeMember: () => void;
  onRemoveMember: () => void;
  onTermFieldPress: (which: 'start' | 'end') => void;
  formatDate: (dateString: string | null) => string;
}

function ExCommRoleCard({
  role,
  theme,
  assignedMember,
  isLast,
  onAssignMember,
  onChangeMember,
  onRemoveMember,
  onTermFieldPress,
  formatDate,
}: ExCommRoleCardProps) {
  const isAssigned = !!role.member_id;
  const Icon = getRoleIconForKey(role.key);
  const iconTint = theme.colors.textSecondary;

  return (
    <View
      style={
        !isLast
          ? {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.colors.border,
            }
          : undefined
      }
    >
      <View style={styles.notionRoleCardRow}>
        <View
          style={[
            styles.notionIconBox,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Icon size={18} color={iconTint} strokeWidth={2} />
        </View>
        <View style={styles.notionRoleMain}>
          <Text style={[styles.roleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {role.title}
          </Text>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabelMuted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              {isAssigned ? 'Assigned' : 'Open'}
            </Text>
            {isAssigned && assignedMember && (
              <>
                <Text style={[styles.metaSep, { color: theme.colors.textSecondary }]}>·</Text>
                <Text style={[styles.assigneeName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {assignedMember.full_name}
                </Text>
              </>
            )}
          </View>

            {!isAssigned && (
              <TouchableOpacity
                onPress={onAssignMember}
                activeOpacity={0.85}
                style={[
                  styles.assignMemberPill,
                  { backgroundColor: theme.colors.text },
                  Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null,
                ]}
              >
                <Text style={[styles.assignMemberPillLabel, { color: theme.colors.textInverse }]} maxFontSizeMultiplier={1.2}>
                  Assign ExComm
                </Text>
              </TouchableOpacity>
            )}

          {isAssigned && (
            <View style={styles.actionsBelowStatus}>
              <TouchableOpacity onPress={onChangeMember} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} activeOpacity={0.7}>
                <Text style={[styles.notionLink, { color: theme.colors.text }]}>Change</Text>
              </TouchableOpacity>
              <Text style={[styles.actionSeparator, { color: theme.colors.textSecondary }]}>·</Text>
              <TouchableOpacity onPress={onRemoveMember} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} activeOpacity={0.7}>
                <Text style={[styles.notionLinkMuted, { color: theme.colors.textSecondary }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {isAssigned && assignedMember && (
            <View style={styles.termBlock}>
              <TouchableOpacity
                onPress={() => onTermFieldPress('start')}
                activeOpacity={0.75}
                style={[
                  styles.termFieldRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.background,
                  },
                  Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null,
                ]}
              >
                <Calendar size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                <View style={styles.termFieldTexts}>
                  <Text style={[styles.termFieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                    Term start
                  </Text>
                  <Text style={[styles.termFieldValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {formatDate(role.term_start)}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onTermFieldPress('end')}
                activeOpacity={0.75}
                style={[
                  styles.termFieldRow,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.background,
                  },
                  Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null,
                ]}
              >
                <Calendar size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                <View style={styles.termFieldTexts}>
                  <Text style={[styles.termFieldLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                    Term end
                  </Text>
                  <Text style={[styles.termFieldValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {formatDate(role.term_end)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ExCommManagement() {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
  const [excommRoles, setExcommRoles] = useState<ExCommRole[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<ClubMember[]>([]);
  const [memberModalRoleKey, setMemberModalRoleKey] = useState<string | null>(null);
  const [excommDataReady, setExcommDataReady] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showTermModal, setShowTermModal] = useState(false);
  const [termType, setTermType] = useState<'start' | 'end'>('start');
  const [tempDate, setTempDate] = useState(new Date());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineSerializedRef = useRef<string>('');
  const baselineReadyRef = useRef(false);
  const excommRolesRef = useRef<ExCommRole[]>([]);
  /** Web: which role/field the hidden date input is editing (avoids stale state in onChange). */
  const pendingTermEditRef = useRef<{ roleKey: string; which: 'start' | 'end' } | null>(null);
  const webTermDateInputRef = useRef<any>(null);

  useEffect(() => {
    excommRolesRef.current = excommRoles;
  }, [excommRoles]);

  const clubId = user?.currentClubId ?? '';

  const {
    data: bundle,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: excommManagementQueryKeys.snapshot(clubId),
    queryFn: () => fetchExcommManagementBundle(clubId),
    enabled: Boolean(clubId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useLayoutEffect(() => {
    setExcommDataReady(false);
  }, [clubId]);

  useLayoutEffect(() => {
    if (!bundle) return;
    baselineReadyRef.current = false;
    if (bundle.club) setClubInfo(bundle.club);
    const roles = mapClubProfileToExcommRoles(bundle.excomm);
    setExcommRoles(roles);
    excommRolesRef.current = roles;
    baselineSerializedRef.current = serializeAssignments(roles);
    baselineReadyRef.current = true;
    setClubMembers(
      bundle.members.map((m) => ({
        id: m.id,
        full_name: m.full_name,
        email: m.email,
        avatar_url: m.avatar_url ?? null,
        phone_number: m.phone_number ?? null,
        role: m.role,
      }))
    );
    setExcommDataReady(true);
  }, [bundle]);

  const seededClub = useMemo((): ClubInfo | null => {
    const cid = user?.currentClubId;
    if (!cid || !user?.clubs?.length) return null;
    const c = user.clubs.find((x) => x.id === cid);
    return c ? { id: c.id, name: c.name, club_number: c.club_number ?? null } : null;
  }, [user?.currentClubId, user?.clubs]);

  const displayClub = clubInfo ?? seededClub;
  const showRolesSkeleton = Boolean(clubId) && !excommDataReady && !isError;
  const showRolesErrorPlaceholder = Boolean(clubId) && !excommDataReady && isError;

  useEffect(() => {
    filterMembers();
  }, [clubMembers, memberSearchQuery]);

  useEffect(() => {
    if (!memberModalRoleKey) setMemberSearchQuery('');
  }, [memberModalRoleKey]);

  const performSave = useCallback(async (showSuccessAlert: boolean) => {
    if (!user?.currentClubId) {
      if (showSuccessAlert) Alert.alert('Error', 'No club selected');
      return;
    }

    const roles = excommRolesRef.current;
    const snapshot = serializeAssignments(roles);
    if (snapshot === baselineSerializedRef.current) {
      return;
    }

    setSaveState('saving');

    try {
      const updateData: Partial<ClubProfile> = {};

      roles.forEach((role) => {
        (updateData as any)[`${role.key}_id`] = role.member_id;
        (updateData as any)[`${role.key}_term_start`] = role.term_start;
        (updateData as any)[`${role.key}_term_end`] = role.term_end;
      });

      const { error: checkError } = await supabase
        .from('club_profiles')
        .select('id')
        .eq('club_id', user.currentClubId)
        .single();

      if (checkError && checkError.code === 'PGRST116') {
        const { error: createError } = await supabase
          .from('club_profiles')
          .insert({
            club_id: user.currentClubId,
            ...updateData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any);

        if (createError) {
          console.error('Error creating club profile:', createError);
          setSaveState('error');
          if (showSuccessAlert) Alert.alert('Error', 'Failed to save ExComm assignments');
          return;
        }
      } else if (checkError) {
        console.error('Error checking club profile:', checkError);
        setSaveState('error');
        if (showSuccessAlert) Alert.alert('Error', 'Database error occurred');
        return;
      } else {
        const payload = {
          ...updateData,
          updated_at: new Date().toISOString(),
        };
        const { error: updateError } = await supabase
          .from('club_profiles')
          // @ts-expect-error Supabase generated Update type is narrow for dynamic role keys
          .update(payload)
          .eq('club_id', user.currentClubId);

        if (updateError) {
          console.error('Error updating club profile:', updateError);
          setSaveState('error');
          if (showSuccessAlert) Alert.alert('Error', 'Failed to save ExComm assignments');
          return;
        }
      }

      baselineSerializedRef.current = snapshot;
      setSaveState('saved');
      if (showSuccessAlert) {
        Alert.alert('Success', 'ExComm assignments saved successfully!');
      }
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (error) {
      console.error('Error saving excomm roles:', error);
      setSaveState('error');
      if (showSuccessAlert) Alert.alert('Error', 'An unexpected error occurred');
    }
  }, [user?.currentClubId]);

  const scheduleAutoSave = useCallback(() => {
    if (!baselineReadyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void performSave(false);
    }, 900);
  }, [performSave]);

  const filterMembers = () => {
    if (!memberSearchQuery.trim()) {
      setFilteredMembers(clubMembers);
    } else {
      const query = memberSearchQuery.toLowerCase().trim();
      setFilteredMembers(
        clubMembers.filter(
          (member) =>
            member.full_name.toLowerCase().includes(query) || member.email.toLowerCase().includes(query)
        )
      );
    }
  };

  const updateRole = (roleKey: string, field: string, value: string | null) => {
    setExcommRoles((prev) => {
      const base = prev.length > 0 ? prev : emptyRolesFromDefinitions();
      return base.map((role) => (role.key === roleKey ? { ...role, [field]: value } : role));
    });
    scheduleAutoSave();
  };

  const handleMemberSelect = (roleKey: string, memberId: string | null) => {
    updateRole(roleKey, 'member_id', memberId);
    setMemberModalRoleKey(null);
    setMemberSearchQuery('');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleIcon = (role: string, iconColor: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={10} color={iconColor} />;
      case 'visiting_tm':
        return <UserCheck size={10} color={iconColor} />;
      case 'club_leader':
        return <Shield size={10} color={iconColor} />;
      case 'guest':
        return <Eye size={10} color={iconColor} />;
      case 'member':
        return <User size={10} color={iconColor} />;
      default:
        return <User size={10} color={iconColor} />;
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

  const orderedRoles = useMemo(() => {
    return [...excommRoles].sort((a, b) => {
      const ia = EXCOMM_ROLE_DEFINITIONS.findIndex((d) => d.key === a.key);
      const ib = EXCOMM_ROLE_DEFINITIONS.findIndex((d) => d.key === b.key);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [excommRoles]);

  const displayRoles = useMemo(() => {
    if (orderedRoles.length > 0) return orderedRoles;
    return emptyRolesFromDefinitions();
  }, [orderedRoles]);

  const memberModalRole = useMemo(
    () => (memberModalRoleKey ? displayRoles.find((r) => r.key === memberModalRoleKey) : undefined),
    [displayRoles, memberModalRoleKey]
  );
  if (!user?.currentClubId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            No club selected
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={19} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Club ExComm
            </Text>
            {saveState === 'saving' && (
              <Text style={[styles.saveHint, { color: theme.colors.textSecondary }]}>Saving…</Text>
            )}
            {saveState === 'saved' && (
              <Text style={[styles.saveHint, { color: theme.colors.textSecondary }]}>Saved</Text>
            )}
            {saveState === 'error' && (
              <Text style={[styles.saveHint, { color: theme.colors.textSecondary }]}>Save failed — check connection</Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.backButton, Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : null]}
            onPress={() => setShowInfoModal(true)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel="About Club ExComm"
          >
            <Info size={21} color={theme.colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isError && (
            <View style={[styles.inlineErrorBanner, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Text style={[styles.inlineErrorText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Couldn&apos;t load ExComm data.
              </Text>
              <TouchableOpacity onPress={() => refetch()} style={styles.inlineRetry}>
                <Text style={[styles.inlineRetryText, { color: theme.colors.text }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          {displayClub && (
            <View style={[styles.notionClubPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.clubHeader}>
                <View
                  style={[
                    styles.clubIconWell,
                    { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                  ]}
                >
                  <Building2 size={20} color={theme.colors.textSecondary} strokeWidth={2} />
                </View>
                <View style={styles.clubInfo}>
                  <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {displayClub.name}
                  </Text>
                  <View style={styles.clubMeta}>
                    {displayClub.club_number && (
                      <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Club #{displayClub.club_number}
                      </Text>
                    )}
                    {user?.clubRole && (
                      <View
                        style={[
                          styles.roleTagNeutral,
                          { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                        ]}
                      >
                        {getRoleIcon(user.clubRole, theme.colors.textSecondary)}
                        <Text style={[styles.roleTextNeutral, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          {formatRole(user.clubRole)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={styles.rolesSection}>
            <Text style={[styles.rolesSectionHeading, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              Executive Committee Roles
            </Text>
            <View
              style={[
                styles.rolesNotionPanel,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {showRolesSkeleton && (
                <View style={styles.skeletonPanelInner}>
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                  <Text style={[styles.skeletonHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Loading roles…
                  </Text>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.skeletonRow,
                        i < 4 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
                      ]}
                    >
                      <View style={[styles.skeletonBar, { backgroundColor: theme.colors.border }]} />
                      <View style={[styles.skeletonBarShort, { backgroundColor: theme.colors.border }]} />
                    </View>
                  ))}
                </View>
              )}
              {showRolesErrorPlaceholder && (
                <View style={styles.skeletonPanelInner}>
                  <Text style={[styles.skeletonHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Roles couldn't be loaded. Use Retry above or pull to refresh.
                  </Text>
                </View>
              )}
              {excommDataReady &&
                displayRoles.map((role, index) => {
                  const assignedMember = clubMembers.find((m) => m.id === role.member_id);
                  return (
                    <ExCommRoleCard
                      key={role.key}
                      role={role}
                      theme={theme}
                      assignedMember={assignedMember}
                      isLast={index === displayRoles.length - 1}
                      onAssignMember={() => setMemberModalRoleKey(role.key)}
                      onChangeMember={() => setMemberModalRoleKey(role.key)}
                      onRemoveMember={() => handleMemberSelect(role.key, null)}
                      onTermFieldPress={(which) => {
                        const d =
                          which === 'start'
                            ? role.term_start
                              ? new Date(role.term_start)
                              : new Date()
                            : role.term_end
                              ? new Date(role.term_end)
                              : new Date();
                        pendingTermEditRef.current = { roleKey: role.key, which };
                        setSelectedRole(role.key);
                        setTermType(which);
                        setTempDate(d);

                        if (Platform.OS === 'web') {
                          const el = webTermDateInputRef.current;
                          const iso = d.toISOString().split('T')[0];
                          if (el) {
                            el.value = iso;
                            try {
                              if (typeof el.showPicker === 'function') {
                                el.showPicker();
                              } else {
                                el.click();
                              }
                            } catch {
                              el.click();
                            }
                          }
                        } else {
                          setShowTermModal(true);
                        }
                      }}
                      formatDate={formatDate}
                    />
                  );
                })}
            </View>
          </View>
        </ScrollView>

        <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={() => setShowInfoModal(false)}>
          <TouchableOpacity
            style={styles.centerModalOverlay}
            activeOpacity={1}
            onPress={() => setShowInfoModal(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.infoModalSheet,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Club ExComm
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowInfoModal(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.infoModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.35}>
                  {EXCOMM_MANAGEMENT_INFO_MESSAGE}
                </Text>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={memberModalRoleKey !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setMemberModalRoleKey(null);
            setMemberSearchQuery('');
          }}
        >
          <TouchableOpacity
            style={styles.centerModalOverlay}
            activeOpacity={1}
            onPress={() => {
              setMemberModalRoleKey(null);
              setMemberSearchQuery('');
            }}
          >
            <TouchableOpacity
              style={[
                styles.centerMemberModal,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {memberModalRole ? `Assign ExComm — ${memberModalRole.title}` : 'Assign ExComm'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setMemberModalRoleKey(null);
                    setMemberSearchQuery('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.searchContainer, { borderBottomColor: theme.colors.border }]}>
                <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                  <Search size={16} color={theme.colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    placeholder="Search members"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <ScrollView
                style={styles.membersList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <TouchableOpacity
                  style={[
                    styles.memberOption,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  onPress={() => memberModalRoleKey && handleMemberSelect(memberModalRoleKey, null)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.memberOptionAvatar, { backgroundColor: theme.colors.surface }]}>
                    <User size={16} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.memberOptionInfo}>
                    <Text style={[styles.memberOptionName, { color: theme.colors.textSecondary }]}>No assignment</Text>
                  </View>
                </TouchableOpacity>
                {filteredMembers.map((member) => {
                  const selected = memberModalRole?.member_id === member.id;
                  return (
                    <TouchableOpacity
                      key={member.id}
                      style={[
                        styles.memberOption,
                        {
                          backgroundColor: selected ? theme.colors.background : theme.colors.surface,
                          borderColor: theme.colors.border,
                          borderWidth: StyleSheet.hairlineWidth,
                        },
                      ]}
                      onPress={() => memberModalRoleKey && handleMemberSelect(memberModalRoleKey, member.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.memberOptionAvatar, { backgroundColor: theme.colors.background }]}>
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.memberOptionAvatarImage} />
                        ) : (
                          <User size={16} color={theme.colors.textSecondary} />
                        )}
                      </View>
                      <View style={styles.memberOptionInfo}>
                        <Text style={[styles.memberOptionName, { color: theme.colors.text }]} numberOfLines={1}>
                          {member.full_name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {Platform.OS === 'web' && (
          <input
            ref={webTermDateInputRef}
            type="date"
            aria-hidden
            tabIndex={-1}
            onChange={(e: any) => {
              const p = pendingTermEditRef.current;
              const v = e?.target?.value;
              if (!p || !v) return;
              const newDate = new Date(v);
              if (!isNaN(newDate.getTime())) {
                updateRole(p.roleKey, `term_${p.which}`, newDate.toISOString().split('T')[0]);
              }
              pendingTermEditRef.current = null;
              setSelectedRole(null);
            }}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
        )}

        {Platform.OS !== 'web' && showTermModal && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (event.type === 'set' && selectedDate && selectedRole) {
                const formattedDate = selectedDate.toISOString().split('T')[0];
                updateRole(selectedRole, `term_${termType}`, formattedDate);
              }
              setShowTermModal(false);
              setSelectedRole(null);
            }}
            textColor={theme.colors.text}
            themeVariant="light"
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 12.8, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 14.4, fontWeight: '700' },
  saveHint: { fontSize: 8.8, fontWeight: '500', marginTop: 2 },
  infoModalSheet: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
  },
  infoModalBody: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  infoModalText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
  },
  content: { flex: 1 },
  notionClubPanel: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  clubIconWell: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubHeader: { flexDirection: 'row', alignItems: 'center' },
  clubInfo: { flex: 1 },
  clubName: { fontSize: 13.6, fontWeight: '600', marginBottom: 6 },
  clubMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  clubNumber: { fontSize: 10.4 },
  roleTagNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  roleTextNeutral: { fontSize: 9, fontWeight: '600' },
  rolesSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  rolesSectionHeading: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    opacity: 0.65,
  },
  /** One Notion-style surface: all roles separated by hairline dividers */
  rolesNotionPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  inlineErrorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  inlineErrorText: { flex: 1, fontSize: 12.8, fontWeight: '500' },
  inlineRetry: { paddingVertical: 6, paddingHorizontal: 10 },
  inlineRetryText: { fontSize: 13, fontWeight: '600' },
  skeletonPanelInner: { paddingVertical: 16, paddingHorizontal: 14, alignItems: 'center', gap: 10 },
  skeletonHint: { fontSize: 12.5, fontWeight: '500', textAlign: 'center', marginBottom: 4 },
  skeletonRow: { width: '100%', paddingVertical: 12, gap: 8 },
  skeletonBar: { height: 12, borderRadius: 4, width: '55%' },
  skeletonBarShort: { height: 10, borderRadius: 4, width: '35%' },
  notionRoleCardRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 14 },
  notionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notionRoleMain: { flex: 1, minWidth: 0 },
  assignMemberPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignMemberPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  actionsBelowStatus: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notionLink: { fontSize: 13, fontWeight: '500' },
  notionLinkMuted: { fontSize: 13, fontWeight: '500' },
  metaSep: { fontSize: 12.5 },
  actionSeparator: { fontSize: 12, fontWeight: '400' },
  termBlock: { marginTop: 10, gap: 8 },
  termFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  termFieldTexts: { flex: 1, minWidth: 0 },
  termFieldLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  termFieldValue: { fontSize: 13, fontWeight: '500' },
  roleTextCol: { flex: 1, minWidth: 0 },
  roleTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, letterSpacing: -0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  statusLabelMuted: { fontSize: 12.5, fontWeight: '400' },
  assigneeName: { fontSize: 12.5, fontWeight: '400', flex: 1, flexShrink: 1 },
  memberDetailBox: { marginBottom: 16 },
  memberDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10 },
  detailAvatarPlaceholder: { backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  detailName: { fontSize: 12.8, fontWeight: '700' },
  detailEmail: { fontSize: 11.2, marginTop: 2 },
  changeRemoveRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 11.2, fontWeight: '600' },
  hintMuted: { fontSize: 10.4, marginBottom: 10 },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerMemberModal: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  closeButton: { padding: 4 },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 12.8, marginLeft: 6 },
  searchResultsText: { fontSize: 9.6, fontWeight: '500', textAlign: 'center' },
  membersList: { flexGrow: 0, maxHeight: 280, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  memberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  memberOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberOptionAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  memberOptionInfo: { flex: 1 },
  memberOptionName: { fontSize: 12.8, fontWeight: '600' },
});

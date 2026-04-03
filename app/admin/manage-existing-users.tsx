import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import {
  ArrowLeft,
  CreditCard as Edit3,
  Trash2,
  Users,
  User,
  Crown,
  Shield,
  Eye,
  UserCheck,
  Building2,
  CircleCheck as CheckCircle,
} from 'lucide-react-native';
import { Image } from 'react-native';
import React from 'react';

/** Notion-like neutrals (match manage-club-users / invite-new-user) */
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
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  success: '#0F7B6C',
  successSoft: 'rgba(15, 123, 108, 0.12)',
  danger: '#E03E3E',
  dangerSoft: 'rgba(224, 62, 62, 0.1)',
  pillBg: '#F0EFED',
};

interface ClubUser {
  id: string;
  user_id: string;
  club_id: string;
  role: string;
  is_authenticated: boolean;
  created_at: string;
  app_user_profiles: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    is_active: boolean;
  };
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

/** RPC get_manage_existing_users_rows (slim payload; avoids slow PostgREST embed). */
interface ManageExistingUsersRpcRow {
  club_user_id: string;
  user_id: string;
  club_id: string;
  role: string;
  is_authenticated: boolean;
  created_at: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  is_active: boolean;
}

type TabVariant = 'all' | 'excomm' | 'member' | 'other';

interface RoleTab {
  value: string;
  label: string;
  count: number;
  variant: TabVariant;
}

export default function ManageExistingUsers() {
  const { user } = useAuth();

  const [clubUsers, setClubUsers] = useState<ClubUser[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ClubUser | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [filteredUsers, setFilteredUsers] = useState<ClubUser[]>([]);
  const [roleTabs, setRoleTabs] = useState<RoleTab[]>([]);

  useEffect(() => {
    loadClubUsers();
  }, []);

  useEffect(() => {
    filterUsers();
    updateRoleTabs();
  }, [clubUsers, selectedRoleFilter]);

  const filterUsers = () => {
    if (selectedRoleFilter === 'all') {
      setFilteredUsers(clubUsers);
    } else {
      setFilteredUsers(
        clubUsers.filter((u) => u.role.toLowerCase() === selectedRoleFilter.toLowerCase())
      );
    }
  };

  const updateRoleTabs = () => {
    const roleCounts = clubUsers.reduce(
      (acc, u) => {
        const role = u.role.toLowerCase();
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const primary: RoleTab[] = [
      { value: 'all', label: 'All', count: clubUsers.length, variant: 'all' },
      { value: 'excomm', label: 'ExComm', count: roleCounts.excomm || 0, variant: 'excomm' },
      { value: 'member', label: 'Members', count: roleCounts.member || 0, variant: 'member' },
    ];

    const otherDefs = [
      { key: 'visiting_tm', label: 'Visiting TM' },
      { key: 'club_leader', label: 'Club Leaders' },
      { key: 'guest', label: 'Guests' },
    ];

    const secondary: RoleTab[] = otherDefs
      .filter((d) => (roleCounts[d.key] || 0) > 0)
      .map((d) => ({
        value: d.key,
        label: d.label,
        count: roleCounts[d.key] || 0,
        variant: 'other' as const,
      }));

    setRoleTabs([...primary, ...secondary]);
  };

  const loadClubUsers = async () => {
    const clubId = user?.currentClubId;
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    try {
      const [rpcResult, clubInfoResult] = await Promise.all([
        supabase.rpc('get_manage_existing_users_rows', { target_club_id: clubId }),
        clubInfo
          ? Promise.resolve({ data: clubInfo, error: null })
          : supabase.from('clubs').select('id, name, club_number').eq('id', clubId).single(),
      ]);

      if (clubInfoResult.data && !clubInfo) {
        setClubInfo(clubInfoResult.data);
      }

      const { data: rpcData, error: rpcError } = rpcResult;

      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        const mapped: ClubUser[] = (rpcData as ManageExistingUsersRpcRow[]).map((row) => ({
          id: row.club_user_id,
          user_id: row.user_id,
          club_id: row.club_id,
          role: row.role,
          is_authenticated: row.is_authenticated,
          created_at: row.created_at ?? '',
          app_user_profiles: {
            id: row.user_id,
            full_name: row.full_name,
            email: row.email,
            avatar_url: row.avatar_url,
            is_active: row.is_active,
          },
        }));
        setClubUsers(mapped);
        return;
      }

      if (rpcError) {
        console.warn('get_manage_existing_users_rows failed, falling back to embed query:', rpcError);
      }

      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(
          `
          id,
          user_id,
          club_id,
          role,
          is_authenticated,
          created_at,
          app_user_profiles!inner (
            id,
            full_name,
            email,
            avatar_url,
            is_active
          )
        `
        )
        .eq('club_id', clubId)
        .eq('is_authenticated', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading club users:', error);
        Alert.alert('Error', 'Failed to load club users');
        return;
      }

      setClubUsers(data || []);
    } catch (error) {
      console.error('Error loading club users:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (clubUser: ClubUser) => {
    router.push(`/admin/edit-user?userId=${clubUser.user_id}&clubUserId=${clubUser.id}`);
  };

  const handleDeleteUser = (clubUser: ClubUser) => {
    setUserToDelete(clubUser);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      confirmDeleteUser(userToDelete);
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const confirmDeleteUser = async (clubUser: ClubUser) => {
    try {
      setClubUsers((prev) => prev.filter((u) => u.id !== clubUser.id));

      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({
          is_authenticated: false,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', clubUser.id);

      if (error) {
        console.error('Error soft deleting user:', error);
        loadClubUsers();
        Alert.alert('Error', 'Failed to remove user from club');
        return;
      }

      setSuccessMessage(`${clubUser.app_user_profiles.full_name} removed from club`);
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (error) {
      console.error('Error soft deleting user:', error);
      loadClubUsers();
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const getRoleIcon = (role: string, iconColor: string = N.text) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={12} color={iconColor} strokeWidth={2} />;
      case 'visiting_tm':
        return <UserCheck size={12} color={iconColor} strokeWidth={2} />;
      case 'club_leader':
        return <Shield size={12} color={iconColor} strokeWidth={2} />;
      case 'guest':
        return <Eye size={12} color={iconColor} strokeWidth={2} />;
      case 'member':
        return <User size={12} color={iconColor} strokeWidth={2} />;
      default:
        return <User size={12} color={iconColor} strokeWidth={2} />;
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

  const segmentStyle = (tab: RoleTab, selected: boolean) => {
    if (!selected) {
      return {
        bg: 'transparent' as const,
        fg: N.textSecondary,
        countBg: N.iconTile,
        countFg: N.textTertiary,
      };
    }
    switch (tab.variant) {
      case 'all':
        return { bg: N.pillBg, fg: N.text, countBg: 'rgba(55, 53, 47, 0.08)', countFg: N.text };
      case 'excomm':
        return {
          bg: EXCOMM_UI.pillBg,
          fg: EXCOMM_UI.pillFg,
          countBg: 'rgba(4, 120, 87, 0.18)',
          countFg: EXCOMM_UI.pillFg,
        };
      case 'member':
        return {
          bg: N.accentSoft,
          fg: N.accent,
          countBg: 'rgba(35, 131, 226, 0.2)',
          countFg: N.accent,
        };
      default:
        return { bg: N.pillBg, fg: N.text, countBg: 'rgba(55, 53, 47, 0.08)', countFg: N.text };
    }
  };

  const segmentIcon = (tab: RoleTab, color: string) => {
    const size = 14;
    switch (tab.variant) {
      case 'all':
        return <Users size={size} color={color} strokeWidth={2} />;
      case 'excomm':
        return <Crown size={size} color={color} strokeWidth={2} />;
      case 'member':
        return <User size={size} color={color} strokeWidth={2} />;
      default:
        return <User size={size} color={color} strokeWidth={2} />;
    }
  };

  const UserCard = ({ clubUser }: { clubUser: ClubUser }) => {
    const pill = notionRolePill(clubUser.role);
    return (
      <View style={[styles.userCard, { backgroundColor: N.surface, borderColor: N.border }]}>
        <View style={styles.userInfo}>
          <View style={[styles.userAvatar, { backgroundColor: N.iconTile }]}>
            {clubUser.app_user_profiles.avatar_url ? (
              <Image source={{ uri: clubUser.app_user_profiles.avatar_url }} style={styles.userAvatarImage} />
            ) : (
              <User size={20} color={N.iconMuted} strokeWidth={2} />
            )}
          </View>

          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              {clubUser.app_user_profiles.full_name}
            </Text>
            <Text style={[styles.userEmail, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {clubUser.app_user_profiles.email}
            </Text>
            <View style={[styles.roleTag, { backgroundColor: pill.bg }]}>
              {getRoleIcon(clubUser.role, pill.fg)}
              <Text style={[styles.roleText, { color: pill.fg }]} maxFontSizeMultiplier={1.3}>
                {formatRole(clubUser.role)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: N.accentSoft }]}
            onPress={() => handleEditUser(clubUser)}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.65}
          >
            <Edit3 size={16} color={N.accent} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: N.dangerSoft }]}
            onPress={() => handleDeleteUser(clubUser)}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            activeOpacity={0.65}
          >
            <Trash2 size={16} color={N.danger} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const SuccessPopup = () => (
    <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
      <View style={styles.successOverlay}>
        <View style={[styles.successPopup, { backgroundColor: N.surface, borderColor: N.border }]}>
          <View style={[styles.successIcon, { backgroundColor: N.successSoft }]}>
            <CheckCircle size={24} color={N.success} strokeWidth={2} />
          </View>
          <Text style={[styles.successTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Changes saved
          </Text>
          <Text style={[styles.successText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {successMessage}
          </Text>
        </View>
      </View>
    </Modal>
  );

  const DeleteConfirmationModal = () => (
    <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={handleCancelDelete}>
      <View style={styles.deleteModalOverlay}>
        <View style={[styles.deleteModal, { backgroundColor: N.surface, borderColor: N.border }]}>
          <Text style={[styles.deleteModalTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Remove user
          </Text>
          <Text style={[styles.deleteModalMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Remove {userToDelete?.app_user_profiles.full_name} from this club? They will lose access until invited
            again.
          </Text>

          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.cancelButton, { borderColor: N.border }]}
              onPress={handleCancelDelete}
            >
              <Text style={[styles.cancelButtonText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.deleteModalButton, styles.removeButton]} onPress={handleConfirmDelete}>
              <Text style={styles.removeButtonText} maxFontSizeMultiplier={1.3}>
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const primaryTabs = roleTabs.slice(0, 3);
  const secondaryTabs = roleTabs.slice(3);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading club users…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Manage existing users
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={[styles.pageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
          {clubInfo && (
            <>
              <View style={styles.clubBlock}>
                <View style={styles.clubHeader}>
                  <View style={[styles.clubIcon, { backgroundColor: N.iconTile }]}>
                    <Building2 size={18} color={N.iconMuted} strokeWidth={1.75} />
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

          <Text style={[styles.hint, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Organize members, roles, and access in one place.
          </Text>

          <Text style={[styles.sectionLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            Filter by role
          </Text>

          <View style={[styles.segmentShell, { borderColor: N.border, backgroundColor: N.iconTile }]}>
            <View style={styles.segmentRow}>
              {primaryTabs.map((tab, index) => {
                const selected = selectedRoleFilter === tab.value;
                const s = segmentStyle(tab, selected);
                const showDivider = index < primaryTabs.length - 1;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[
                      styles.segmentCell,
                      showDivider && { borderRightWidth: 1, borderRightColor: N.border },
                      { backgroundColor: s.bg },
                    ]}
                    onPress={() => setSelectedRoleFilter(tab.value)}
                    activeOpacity={0.7}
                  >
                    {segmentIcon(tab, s.fg)}
                    <Text style={[styles.segmentLabel, { color: s.fg }]} maxFontSizeMultiplier={1.2}>
                      {tab.label}
                    </Text>
                    <View style={[styles.segmentCount, { backgroundColor: s.countBg }]}>
                      <Text style={[styles.segmentCountText, { color: s.countFg }]} maxFontSizeMultiplier={1.15}>
                        {tab.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {secondaryTabs.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.secondaryTabsContent}
              style={styles.secondaryTabsScroll}
            >
              {secondaryTabs.map((tab) => {
                const selected = selectedRoleFilter === tab.value;
                const s = segmentStyle(tab, selected);
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[
                      styles.secondaryTab,
                      { borderColor: selected ? N.borderStrong : N.border, backgroundColor: s.bg },
                    ]}
                    onPress={() => setSelectedRoleFilter(tab.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.secondaryTabText, { color: s.fg }]} maxFontSizeMultiplier={1.2}>
                      {tab.label}
                    </Text>
                    <View style={[styles.segmentCount, { backgroundColor: s.countBg }]}>
                      <Text style={[styles.segmentCountText, { color: s.countFg }]} maxFontSizeMultiplier={1.15}>
                        {tab.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          <View style={styles.usersHeader}>
            <Text style={[styles.usersCount, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </Text>
          </View>

          <View style={styles.usersList}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((clubUser) => <UserCard key={clubUser.id} clubUser={clubUser} />)
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: N.iconTile }]}>
                  <Users size={28} color={N.iconMuted} strokeWidth={1.75} />
                </View>
                <Text style={[styles.emptyStateText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  No users found
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedRoleFilter === 'all'
                    ? 'There are no authenticated users in this club yet.'
                    : `No users with the role "${formatRole(selectedRoleFilter)}".`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <SuccessPopup />
      <DeleteConfirmationModal />
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
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
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '400',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 8,
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
  segmentShell: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  segmentCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  segmentCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  secondaryTabsScroll: {
    marginTop: 10,
    maxHeight: 40,
  },
  secondaryTabsContent: {
    gap: 8,
    paddingRight: 4,
  },
  secondaryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  secondaryTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  usersHeader: {
    paddingTop: 20,
    paddingBottom: 8,
  },
  usersCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  usersList: {
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 18,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyStateSubtext: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successPopup: {
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 40,
    borderWidth: 1,
    maxWidth: 320,
  },
  successIcon: {
    width: 52,
    height: 52,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteModal: {
    borderRadius: 4,
    padding: 22,
    borderWidth: 1,
    width: '100%',
    maxWidth: 360,
  },
  deleteModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  deleteModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  removeButton: {
    backgroundColor: N.danger,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

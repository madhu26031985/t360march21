import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Save,
  User,
  Crown,
  Shield,
  Eye,
  UserCheck,
  Building2,
  CircleCheck as CheckCircle,
} from 'lucide-react-native';
import { Image } from 'react-native';

/** Notion-like neutrals (match manage-existing-users / invite-new-user) */
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
  pillExCommBg: '#F4F0FA',
  pillExCommText: '#6940A5',
  pillBg: '#F0EFED',
  /** Saturated circles for role picker (readable at small size) */
  roleMember: '#2383E2',
  roleExComm: '#6940A5',
  roleVisiting: '#0D9488',
  roleLeader: '#D97706',
  roleGuest: '#787774',
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

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member', description: 'Regular club member' },
  { value: 'excomm', label: 'ExComm', description: 'Executive Committee member' },
  { value: 'visiting_tm', label: 'Visiting Toastmaster', description: 'Visiting member from another club' },
  { value: 'club_leader', label: 'Club Leader', description: 'Club leadership role' },
  { value: 'guest', label: 'Guest', description: 'Guest member' },
] as const;

export default function EditUser() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const userId = typeof params.userId === 'string' ? params.userId : params.userId?.[0];
  const clubUserId = typeof params.clubUserId === 'string' ? params.clubUserId : params.clubUserId?.[0];

  const [clubUser, setClubUser] = useState<ClubUser | null>(null);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    if (userId && clubUserId) {
      loadUserData();
      loadClubInfo();
    }
  }, [userId, clubUserId]);

  const loadUserData = async () => {
    if (!clubUserId) return;

    try {
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
          app_user_profiles (
            id,
            full_name,
            email,
            avatar_url,
            is_active
          )
        `
        )
        .eq('id', clubUserId)
        .single();

      if (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load user data');
        return;
      }

      setClubUser(data);
      setSelectedRole((data.role || '').toLowerCase());
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClubInfo = async () => {
    if (!user?.currentClubId) return;

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
    }
  };

  const handleSaveRole = async () => {
    if (!clubUser || !selectedRole) return;

    if (selectedRole.toLowerCase() === clubUser.role.toLowerCase()) {
      Alert.alert('No changes', 'The role is already set to this value.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({
          role: selectedRole,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', clubUser.id);

      if (error) {
        console.error('Error updating user role:', error);
        Alert.alert('Error', 'Failed to update user role');
        return;
      }

      setClubUser((prev) => (prev ? { ...prev, role: selectedRole } : null));
      setShowSuccessMessage(true);

      setTimeout(() => {
        setShowSuccessMessage(false);
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Error updating user role:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleIcon = (role: string, iconColor = '#ffffff') => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={14} color={iconColor} strokeWidth={2} />;
      case 'visiting_tm':
        return <UserCheck size={14} color={iconColor} strokeWidth={2} />;
      case 'club_leader':
        return <Shield size={14} color={iconColor} strokeWidth={2} />;
      case 'guest':
        return <Eye size={14} color={iconColor} strokeWidth={2} />;
      case 'member':
        return <User size={14} color={iconColor} strokeWidth={2} />;
      default:
        return <User size={14} color={iconColor} strokeWidth={2} />;
    }
  };

  const getRoleCircleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return N.roleExComm;
      case 'visiting_tm':
        return N.roleVisiting;
      case 'club_leader':
        return N.roleLeader;
      case 'guest':
        return N.roleGuest;
      case 'member':
        return N.roleMember;
      default:
        return N.roleGuest;
    }
  };

  const notionRolePill = (role: string): { bg: string; fg: string } => {
    switch (role.toLowerCase()) {
      case 'excomm':
        return { bg: N.pillExCommBg, fg: N.pillExCommText };
      case 'visiting_tm':
        return { bg: 'rgba(13, 148, 136, 0.12)', fg: '#0F766E' };
      case 'club_leader':
        return { bg: 'rgba(217, 119, 6, 0.14)', fg: '#B45309' };
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

  const canSave =
    !!selectedRole &&
    clubUser &&
    selectedRole.toLowerCase() !== clubUser.role.toLowerCase() &&
    !isSaving;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading user…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!clubUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            User not found
          </Text>
          <TouchableOpacity
            style={[styles.primaryGhostButton, { borderColor: N.border, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.primaryGhostButtonText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          Edit user role
        </Text>
        <TouchableOpacity
          style={[
            styles.saveIconWrap,
            {
              backgroundColor: canSave ? N.accent : N.surface,
              borderColor: canSave ? N.accent : N.border,
            },
          ]}
          onPress={handleSaveRole}
          disabled={!canSave}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Save size={18} color={canSave ? '#FFFFFF' : N.textTertiary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
          {clubInfo ? (
            <View style={[styles.infoCard, { borderColor: N.border }]}>
              <View style={styles.clubHeader}>
                <View style={[styles.clubIcon, { backgroundColor: N.accentSoft }]}>
                  <Building2 size={20} color={N.accent} strokeWidth={1.75} />
                </View>
                <View style={styles.clubInfo}>
                  <Text style={[styles.clubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {clubInfo.name}
                  </Text>
                  <View style={styles.clubMeta}>
                    {clubInfo.club_number ? (
                      <Text style={[styles.clubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        Club #{clubInfo.club_number}
                      </Text>
                    ) : null}
                    {user?.clubRole ? (() => {
                      const pill = notionRolePill(user.clubRole);
                      return (
                        <View style={[styles.rolePill, { backgroundColor: pill.bg }]}>
                          {getRoleIcon(user.clubRole, pill.fg)}
                          <Text style={[styles.rolePillText, { color: pill.fg }]} maxFontSizeMultiplier={1.2}>
                            {formatRole(user.clubRole)}
                          </Text>
                        </View>
                      );
                    })() : null}
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          <View style={[styles.infoCard, { borderColor: N.border, marginTop: clubInfo ? 12 : 0 }]}>
            <View style={styles.userHeader}>
              <View style={[styles.userAvatar, { backgroundColor: N.iconTile }]}>
                {clubUser.app_user_profiles.avatar_url ? (
                  <Image source={{ uri: clubUser.app_user_profiles.avatar_url }} style={styles.userAvatarImage} />
                ) : (
                  <User size={24} color={N.iconMuted} strokeWidth={2} />
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  {clubUser.app_user_profiles.full_name}
                </Text>
                <Text style={[styles.userEmail, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {clubUser.app_user_profiles.email}
                </Text>
                {(() => {
                  const pill = notionRolePill(clubUser.role);
                  return (
                    <View style={[styles.rolePill, styles.currentRolePill, { backgroundColor: pill.bg }]}>
                      {getRoleIcon(clubUser.role, pill.fg)}
                      <Text style={[styles.rolePillText, { color: pill.fg }]} maxFontSizeMultiplier={1.2}>
                        Current: {formatRole(clubUser.role)}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            </View>
          </View>

          <View style={[styles.insetDivider, { backgroundColor: N.border }]} />

          <Text style={[styles.sectionTitle, { color: N.text }]} maxFontSizeMultiplier={1.25}>
            Select new role
          </Text>

          <View style={styles.rolesList}>
            {ROLE_OPTIONS.map((option) => {
              const selected = selectedRole.toLowerCase() === option.value.toLowerCase();
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: selected ? N.accentSoft : N.surface,
                      borderColor: selected ? N.accentSoftBorder : N.border,
                    },
                  ]}
                  onPress={() => setSelectedRole(option.value)}
                  activeOpacity={0.65}
                >
                  <View style={styles.roleOptionHeader}>
                    <View style={[styles.roleOptionIcon, { backgroundColor: getRoleCircleColor(option.value) }]}>
                      {getRoleIcon(option.value, '#FFFFFF')}
                    </View>
                    <Text
                      style={[styles.roleOptionTitle, { color: selected ? N.accent : N.text }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <Text style={[styles.roleOptionDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {option.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {showSuccessMessage ? (
            <View style={[styles.successBanner, { backgroundColor: N.successSoft, borderColor: N.border }]}>
              <CheckCircle size={20} color={N.success} strokeWidth={2} />
              <Text style={[styles.successText, { color: N.success }]} maxFontSizeMultiplier={1.3}>
                Role updated successfully
              </Text>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
  headerIconButton: {
    padding: 8,
    width: 38,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    letterSpacing: -0.2,
  },
  saveIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  infoCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    backgroundColor: N.surface,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  clubInfo: {
    flex: 1,
    minWidth: 0,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
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
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  currentRolePill: {
    marginTop: 10,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontSize: 14,
    lineHeight: 20,
  },
  insetDivider: {
    height: 1,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  rolesList: {
    gap: 10,
  },
  roleOption: {
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
  },
  roleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  roleOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
  },
  roleOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 48,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryGhostButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 4,
    borderWidth: 1,
  },
  primaryGhostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

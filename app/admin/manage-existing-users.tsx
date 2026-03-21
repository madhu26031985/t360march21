import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, CreditCard as Edit3, Trash2, Users, User, Crown, Shield, Eye, UserCheck, Building2, X, Save, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Image } from 'react-native';
import React from 'react';

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

interface RoleTab {
  value: string;
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

export default function ManageExistingUsers() {
  const { theme } = useTheme();
  const { user } = useAuth();
  
  const [clubUsers, setClubUsers] = useState<ClubUser[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ClubUser | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
  const [filteredUsers, setFilteredUsers] = useState<ClubUser[]>([]);
  const [roleTabs, setRoleTabs] = useState<RoleTab[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClubUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const roleOptions = [
    { value: 'member', label: 'Member', description: 'Regular club member with standard access' },
    { value: 'excomm', label: 'ExComm', description: 'Executive committee member with administrative privileges' },
    { value: 'club_leader', label: 'Club Leader', description: 'Club leadership role with management access' },
    { value: 'visiting_tm', label: 'Visiting TM', description: 'Visiting Toastmaster from another club' },
    { value: 'guest', label: 'Guest', description: 'Guest attendee with limited access' },
  ];

  useEffect(() => {
    loadClubUsers();
  }, []);

  useEffect(() => {
    if (isRefreshing) return; // Skip filtering during refresh
    filterUsers();
    updateRoleTabs();
  }, [clubUsers, selectedRoleFilter]);

  const filterUsers = () => {
    if (selectedRoleFilter === 'all') {
      setFilteredUsers(clubUsers);
    } else {
      setFilteredUsers(clubUsers.filter(user => user.role.toLowerCase() === selectedRoleFilter.toLowerCase()));
    }
  };

  const updateRoleTabs = () => {
    const roleCounts = clubUsers.reduce((acc, user) => {
      const role = user.role.toLowerCase();
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tabs: RoleTab[] = [
      { 
        value: 'all', 
        label: 'All', 
        count: clubUsers.length, 
        color: '#10b981',
        icon: <Users size={14} color="#ffffff" />
      }
    ];

    // Define role order and styling
    const roleDefinitions = [
      { key: 'excomm', label: 'ExComm', color: '#8b5cf6', icon: <Crown size={14} color="#ffffff" /> },
      { key: 'member', label: 'Members', color: '#3b82f6', icon: <User size={14} color="#ffffff" /> },
      { key: 'visiting_tm', label: 'Visiting TM', color: '#10b981', icon: <UserCheck size={14} color="#ffffff" /> },
      { key: 'club_leader', label: 'Club Leaders', color: '#f59e0b', icon: <Shield size={14} color="#ffffff" /> },
      { key: 'guest', label: 'Guests', color: '#6b7280', icon: <Eye size={14} color="#ffffff" /> },
    ];

    roleDefinitions.forEach(roleDef => {
      const count = roleCounts[roleDef.key] || 0;
      if (count > 0) {
        tabs.push({
          value: roleDef.key,
          label: roleDef.label,
          count: count,
          color: roleDef.color,
          icon: roleDef.icon
        });
      }
    });

    setRoleTabs(tabs);
  };

  const loadClubUsers = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading club users for club:', user.currentClubId);

      // Use Promise.all to load club info and users in parallel
      const [usersResult, clubInfoResult] = await Promise.all([
        supabase
          .from('app_club_user_relationship')
          .select(`
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
          `)
          .eq('club_id', user.currentClubId)
          .eq('is_authenticated', true)
          .order('created_at', { ascending: false }),
        clubInfo ? Promise.resolve({ data: clubInfo, error: null }) : supabase
          .from('clubs')
          .select('id, name, club_number')
          .eq('id', user.currentClubId)
          .single()
      ]);

      const { data, error } = usersResult;

      if (error) {
        console.error('Error loading club users:', error);
        Alert.alert('Error', 'Failed to load club users');
        return;
      }

      // Set club info if we loaded it
      if (clubInfoResult.data && !clubInfo) {
        setClubInfo(clubInfoResult.data);
      }

      setClubUsers(data || []);
    } catch (error) {
      console.error('Error loading club users:', error);
      Alert.alert('Error', 'An unexpected error occurred while loading users');
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

  const handleSaveRole = async () => {
    if (!selectedUser || !selectedRole || selectedRole === selectedUser.role) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({ role: selectedRole })
        .eq('id', selectedUser.id);

      if (error) {
        console.error('Error updating user role:', error);
        Alert.alert('Error', 'Failed to update user role');
        return;
      }

      // Update local state
      setClubUsers(prev => prev.map(user => 
        user.id === selectedUser.id ? { ...user, role: selectedRole } : user
      ));

      setSuccessMessage(`${selectedUser.app_user_profiles.full_name}'s role updated to ${formatRole(selectedRole)}`);
      setShowSuccessModal(true);
      setShowEditModal(false);
      
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error('Error updating user role:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteUser = async (clubUser: ClubUser) => {
    try {
      console.log('Soft deleting user from club:', clubUser.app_user_profiles.full_name);
      
      // Optimistic update - remove user immediately from UI
      setClubUsers(prev => prev.filter(u => u.id !== clubUser.id));
      
      // Soft delete by setting is_authenticated to false instead of hard delete
      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({ 
          is_authenticated: false,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', clubUser.id);

      if (error) {
        console.error('Error soft deleting user:', error);
        // Revert optimistic update on error
        loadClubUsers();
        Alert.alert('Error', 'Failed to remove user from club');
        return;
      }

      // Show success popup
      setSuccessMessage(`${clubUser.app_user_profiles.full_name} removed from club`);
      setShowSuccessModal(true);
      
      // Auto-hide success popup after 2 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error('Error soft deleting user:', error);
      // Revert optimistic update on error
      loadClubUsers();
      Alert.alert('Error', 'An unexpected error occurred');
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

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return '#8b5cf6';
      case 'visiting_tm': return '#10b981';
      case 'club_leader': return '#f59e0b';
      case 'guest': return '#6b7280';
      case 'member': return '#3b82f6';
      default: return '#6b7280';
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

  const UserCard = ({ clubUser }: { clubUser: ClubUser }) => (
    <View style={[styles.userCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.userInfo}>
        <View style={styles.userAvatar}>
          {clubUser.app_user_profiles.avatar_url ? (
            <Image source={{ uri: clubUser.app_user_profiles.avatar_url }} style={styles.userAvatarImage} />
          ) : (
            <User size={20} color="#ffffff" />
          )}
        </View>
        
        <View style={styles.userDetails}>
          <Text style={[styles.userName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {clubUser.app_user_profiles.full_name}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {clubUser.app_user_profiles.email}
          </Text>
          <View style={[styles.roleTag, { backgroundColor: getRoleColor(clubUser.role) }]}>
            {getRoleIcon(clubUser.role)}
            <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(clubUser.role)}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEditUser(clubUser)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          activeOpacity={0.6}
        >
          <Edit3 size={16} color="#3b82f6" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(clubUser)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          activeOpacity={0.6}
        >
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const SuccessPopup = () => (
    <Modal
      visible={showSuccessModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowSuccessModal(false)}
    >
      <View style={styles.successOverlay}>
        <View style={[styles.successPopup, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.successIcon, { backgroundColor: theme.colors.success + '20' }]}>
            <CheckCircle size={24} color={theme.colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Changes Saved</Text>
          <Text style={[styles.successText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {successMessage}
          </Text>
        </View>
      </View>
    </Modal>
  );

  const DeleteConfirmationModal = () => (
    <Modal
      visible={showDeleteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCancelDelete}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={[styles.deleteModal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.deleteModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Remove User</Text>
          <Text style={[styles.deleteModalMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Are you sure you want to remove {userToDelete?.app_user_profiles.full_name} from the club?
          </Text>
          
          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.cancelButton, { borderColor: theme.colors.border }]}
              onPress={handleCancelDelete}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteModalButton, styles.removeButton]}
              onPress={handleConfirmDelete}
            >
              <Text style={styles.removeButtonText} maxFontSizeMultiplier={1.3}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const EditRoleModal = () => (
    <Modal
      visible={showEditModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowEditModal(false)}
    >
      <View style={styles.centerModalOverlay}>
        <View style={[styles.centerEditModal, { backgroundColor: theme.colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit User Role</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowEditModal(false)}
            >
              <X size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* User Info */}
          {selectedUser && (
            <View style={[styles.modalUserInfo, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.modalUserAvatar}>
                {selectedUser.app_user_profiles.avatar_url ? (
                  <Image source={{ uri: selectedUser.app_user_profiles.avatar_url }} style={styles.modalUserAvatarImage} />
                ) : (
                  <User size={24} color="#ffffff" />
                )}
              </View>
              <View style={styles.modalUserDetails}>
                <Text style={[styles.modalUserName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {selectedUser.app_user_profiles.full_name}
                </Text>
                <Text style={[styles.modalUserEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {selectedUser.app_user_profiles.email}
                </Text>
              </View>
            </View>
          )}

          {/* Role Selection */}
          <View style={styles.modalContent}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select New Role</Text>
            
            <ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: selectedRole === option.value ? theme.colors.primary + '20' : theme.colors.surface,
                      borderColor: selectedRole === option.value ? theme.colors.primary : theme.colors.border,
                    }
                  ]}
                  onPress={() => setSelectedRole(option.value)}
                >
                  <View style={styles.roleOptionContent}>
                    <View style={styles.roleOptionHeader}>
                      <View style={[styles.roleOptionIcon, { backgroundColor: getRoleColor(option.value) }]}>
                        {getRoleIcon(option.value)}
                      </View>
                      <Text style={[
                        styles.roleOptionTitle,
                        { color: selectedRole === option.value ? theme.colors.primary : theme.colors.text }
                      ]} maxFontSizeMultiplier={1.3}>
                        {option.label}
                      </Text>
                    </View>
                    <Text style={[styles.roleOptionDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: selectedRole && selectedRole !== selectedUser?.role ? theme.colors.primary : theme.colors.surface,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={handleSaveRole}
              disabled={!selectedRole || selectedRole === selectedUser?.role || isSaving}
            >
              <Save size={16} color={selectedRole && selectedRole !== selectedUser?.role ? "#ffffff" : theme.colors.textSecondary} />
              <Text style={[
                styles.saveButtonText,
                { color: selectedRole && selectedRole !== selectedUser?.role ? "#ffffff" : theme.colors.textSecondary }
              ]} maxFontSizeMultiplier={1.3}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading club users...</Text>
        </View>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Manage Existing Users</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
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
        )}

        {/* Role Tabs */}
        <View style={styles.roleTabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleTabsContent}>
            {roleTabs.map((tab) => (
              <TouchableOpacity
                key={tab.value}
                style={[
                  styles.roleTab,
                  {
                    backgroundColor: selectedRoleFilter === tab.value ? tab.color : theme.colors.surface,
                    borderColor: selectedRoleFilter === tab.value ? tab.color : theme.colors.border,
                  }
                ]}
                onPress={() => setSelectedRoleFilter(tab.value)}
              >
                <View style={[styles.roleTabIcon, { backgroundColor: tab.color }]}>
                  {tab.icon}
                </View>
                <Text style={[
                  styles.roleTabText,
                  { color: selectedRoleFilter === tab.value ? '#ffffff' : theme.colors.text }
                ]} maxFontSizeMultiplier={1.3}>
                  {tab.label}
                </Text>
                <View style={[
                  styles.roleTabCount,
                  { backgroundColor: selectedRoleFilter === tab.value ? 'rgba(255,255,255,0.2)' : theme.colors.primary + '20' }
                ]}>
                  <Text style={[
                    styles.roleTabCountText,
                    { color: selectedRoleFilter === tab.value ? '#ffffff' : theme.colors.primary }
                  ]} maxFontSizeMultiplier={1.3}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Users Count */}
        <View style={styles.usersHeader}>
          <Text style={[styles.usersCount, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
          </Text>
        </View>

        {/* Users List */}
        <View style={styles.usersList}>
          {filteredUsers.length > 0 ? (
            filteredUsers.map((clubUser) => (
              <UserCard key={clubUser.id} clubUser={clubUser} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Users size={48} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                No users found
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {selectedRoleFilter === 'all' 
                  ? 'There are no authenticated users in this club yet.'
                  : `No users with the role "${formatRole(selectedRoleFilter)}" found.`
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      <SuccessPopup />
      <DeleteConfirmationModal />
      <EditRoleModal />
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
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubNumber: {
    fontSize: 13,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  usersHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  usersCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  roleTabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  roleTabsContent: {
    paddingHorizontal: 0,
    gap: 8,
  },
  roleTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 2,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleTabIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  roleTabCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  roleTabCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  usersList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    marginBottom: 6,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#eff6ff',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centerEditModal: {
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    minHeight: '60%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  modalUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  modalUserAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  modalUserDetails: {
    flex: 1,
  },
  modalUserName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 14,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  rolesList: {
    maxHeight: 300,
    marginBottom: 24,
  },
  roleOption: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleOptionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successPopup: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    minWidth: 300,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  removeButton: {
    backgroundColor: '#ef4444',
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
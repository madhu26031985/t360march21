import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Save, User, Crown, Shield, Eye, UserCheck, Building2, CircleCheck as CheckCircle } from 'lucide-react-native';
import { Image } from 'react-native';

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

export default function EditUser() {
  const { theme } = useTheme();
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

  const roleOptions = [
    { value: 'member', label: 'Member', description: 'Regular club member' },
    { value: 'excomm', label: 'ExComm', description: 'Executive Committee member' },
    { value: 'visiting_tm', label: 'Visiting Toastmaster', description: 'Visiting member from another club' },
    { value: 'club_leader', label: 'Club Leader', description: 'Club leadership role' },
    { value: 'guest', label: 'Guest', description: 'Guest member' },
  ];

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
        .select(`
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
        `)
        .eq('id', clubUserId)
        .single();

      if (error) {
        console.error('Error loading user data:', error);
        Alert.alert('Error', 'Failed to load user data');
        return;
      }

      setClubUser(data);
      setSelectedRole(data.role);
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

    if (selectedRole === clubUser.role) {
      Alert.alert('No Changes', 'The role is already set to this value.');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log('Updating user role:', {
        userId: clubUser.app_user_profiles.full_name,
        oldRole: clubUser.role,
        newRole: selectedRole
      });
      
      const oldRole = clubUser.role;
      
      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({ 
          role: selectedRole,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', clubUser.id);

      if (error) {
        console.error('Error updating user role:', error);
        Alert.alert('Error', 'Failed to update user role');
        return;
      }

      // Update local state
      setClubUser(prev => prev ? { ...prev, role: selectedRole } : null);

      // Show success message
      setShowSuccessMessage(true);
      
      // Auto-hide success message and navigate back
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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading user data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!clubUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>User not found</Text>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: theme.colors.primary, marginTop: 16 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText} maxFontSizeMultiplier={1.3}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Edit User Role</Text>
        <TouchableOpacity 
          style={[
            styles.saveButton,
            {
              backgroundColor: selectedRole && selectedRole !== clubUser.role ? theme.colors.primary : theme.colors.surface,
              borderColor: theme.colors.border,
            }
          ]}
          onPress={handleSaveRole}
          disabled={!selectedRole || selectedRole === clubUser.role || isSaving}
        >
          <Save size={16} color={selectedRole && selectedRole !== clubUser.role ? "#ffffff" : theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Club Card */}
        {clubInfo && (
          <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.clubHeader}>
              <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                <Building2 size={20} color={theme.colors.primary} />
              </View>
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

        {/* User Info Card */}
        <View style={[styles.userInfoCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.userHeader}>
            <View style={styles.userAvatar}>
              {clubUser.app_user_profiles.avatar_url ? (
                <Image source={{ uri: clubUser.app_user_profiles.avatar_url }} style={styles.userAvatarImage} />
              ) : (
                <User size={24} color="#ffffff" />
              )}
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {clubUser.app_user_profiles.full_name}
              </Text>
              <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {clubUser.app_user_profiles.email}
              </Text>
              <View style={[styles.currentRoleTag, { backgroundColor: getRoleColor(clubUser.role) }]}>
                {getRoleIcon(clubUser.role)}
                <Text style={styles.currentRoleText} maxFontSizeMultiplier={1.3}>Current: {formatRole(clubUser.role)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Role Selection */}
        <View style={[styles.roleSelectionCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select New Role</Text>
          
          <View style={styles.rolesList}>
            {roleOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.roleOption,
                  {
                    backgroundColor: selectedRole === option.value ? theme.colors.primary + '20' : theme.colors.background,
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
          </View>
        </View>

        {/* Success Message */}
        {showSuccessMessage && (
          <View style={[styles.successCard, { backgroundColor: theme.colors.success + '20' }]}>
            <View style={styles.successContent}>
              <CheckCircle size={24} color={theme.colors.success} />
              <Text style={[styles.successText, { color: theme.colors.success }]} maxFontSizeMultiplier={1.3}>
                Role updated successfully!
              </Text>
            </View>
          </View>
        )}
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  clubCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIcon: {
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
  userInfoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  currentRoleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  currentRoleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  roleSelectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  rolesList: {
    gap: 12,
  },
  roleOption: {
    borderRadius: 12,
    padding: 16,
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
  successCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
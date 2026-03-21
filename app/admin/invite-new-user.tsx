import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Mail, User, Crown, Shield, Eye, UserCheck, Clock, Send, Trash2, CircleCheck as CheckCircle, X, Building2 } from 'lucide-react-native';
import Constants from 'expo-constants';

interface InviteForm {
  email: string;
  fullName: string;
  role: string;
}

interface PendingInvite {
  id: string;
  invite_token: string;
  club_id: string;
  invitee_email: string;
  invitee_full_name: string;
  invitee_role: string;
  invited_by: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_user_id: string | null;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

export default function InviteNewUser() {
  const { theme } = useTheme();
  const { user, refreshUserProfile } = useAuth();
  const params = useLocalSearchParams();

  const [inviteForm, setInviteForm] = useState<InviteForm>({
    email: (params.prefillEmail as string) || '',
    fullName: (params.prefillName as string) || '',
    role: (params.prefillRole as string) || 'member'
  });
  
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvites, setIsLoadingInvites] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);

  const roleOptions = [
    { value: 'member', label: 'Member', description: 'Regular club member', icon: <User size={16} color="#ffffff" />, color: '#3b82f6' },
    { value: 'excomm', label: 'ExComm', description: 'Executive Committee member', icon: <Crown size={16} color="#ffffff" />, color: '#8b5cf6' },
    { value: 'visiting_tm', label: 'Visiting Toastmaster', description: 'Visiting member from another club', icon: <UserCheck size={16} color="#ffffff" />, color: '#10b981' },
    { value: 'club_leader', label: 'Club Leader', description: 'Club leadership role', icon: <Shield size={16} color="#ffffff" />, color: '#f59e0b' },
    { value: 'guest', label: 'Guest', description: 'Guest member', icon: <Eye size={16} color="#ffffff" />, color: '#6b7280' },
  ];

  useEffect(() => {
    loadPendingInvites();
    loadClubInfo();
  }, []);

  const loadPendingInvites = async () => {
    if (!user?.currentClubId) {
      setIsLoadingInvites(false);
      return;
    }

    try {
      console.log('Loading pending invitations for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('app_user_invitation')
        .select('*')
        .eq('club_id', user.currentClubId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pending invites:', error);
        Alert.alert('Error', 'Failed to load pending invitations');
        return;
      }

      setPendingInvites(data || []);
    } catch (error) {
      console.error('Error loading pending invites:', error);
    } finally {
      setIsLoadingInvites(false);
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

      setClubInfo(data as any);
    } catch (error) {
      console.error('Error loading club info:', error);
    }
  };

  const updateFormField = (field: keyof InviteForm, value: string) => {
    setInviteForm(prev => ({ ...prev, [field]: value }));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const checkIfUserExists = async (email: string): Promise<{ exists: boolean; isAuthenticated?: boolean; userId?: string }> => {
    try {
      // Check if user exists in app_user_profiles
      const { data: userProfiles, error } = await supabase
        .from('app_user_profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking user existence:', error);
        return { exists: false };
      }

      if (!userProfiles || userProfiles.length === 0) {
        return { exists: false };
      }

      const userProfile = userProfiles[0] as any;

      // Check if user is already in this club (including soft-deleted records)
      const { data: clubRelation, error: clubError } = await supabase
        .from('app_club_user_relationship')
        .select('id, is_authenticated')
        .eq('user_id', userProfile.id)
        .eq('club_id', user?.currentClubId || '')
        .limit(1);

      if (clubError && clubError.code !== 'PGRST116') {
        console.error('Error checking club relationship:', clubError);
        return { exists: true, isAuthenticated: false, userId: userProfile.id };
      }

      const relation = clubRelation && clubRelation.length > 0 ? (clubRelation[0] as any) : null;

      return { 
        exists: true, 
        isAuthenticated: relation ? relation.is_authenticated : false,
        userId: userProfile.id 
      };
    } catch (error) {
      console.error('Error in checkIfUserExists:', error);
      return { exists: false };
    }
  };

  const handleSendInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.fullName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!validateEmail(inviteForm.email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!user?.currentClubId) {
      Alert.alert('Error', 'No club selected');
      return;
    }

    console.log('Starting invite process for:', inviteForm.email);
    setIsLoading(true);

    try {
      const email = inviteForm.email.toLowerCase().trim();
      
      // Check if user already exists
      const userCheck = await checkIfUserExists(email);
      console.log('User check result:', userCheck);
      
      if (userCheck.exists && userCheck.isAuthenticated) {
        Alert.alert(
          'User Already in Club',
          'This user is already an authenticated member of your club.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }

      if (userCheck.exists) {
        // User exists - either add them or reactivate them
        console.log('Adding existing user to club:', userCheck.userId);
        const { error: addError } = await supabase
          .from('app_club_user_relationship')
          .upsert({
            user_id: userCheck.userId,
            club_id: user.currentClubId,
            role: inviteForm.role,
            is_authenticated: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as any, {
            onConflict: 'user_id,club_id'
          });

        if (addError) {
          console.error('Error adding existing user to club:', addError);
          Alert.alert('Error', 'Failed to add user to club');
          setIsLoading(false);
          return;
        }

        // If this came from a join request, update the request status
        if (params.fromJoinRequest === 'true' && params.requestId) {
          const { error: updateRequestError } = await supabase
            .from('club_join_requests')
            .update({
              status: 'approved'
            })
            .eq('id', params.requestId as string);

          if (updateRequestError) {
            console.error('Error updating join request:', updateRequestError);
            Alert.alert('Warning', 'User added successfully but failed to update join request status');
          }
        }

        setSuccessMessage(`${inviteForm.fullName} has been ${userCheck.isAuthenticated ? 'updated' : 'added'} in the club as ${formatRole(inviteForm.role)}`);
        setShowSuccessModal(true);

        // Refresh user data to update ClubSwitcher
        if (user && user.id === userCheck.userId) {
          // If the current user was re-added, refresh their auth context
          console.log('Current user was re-added, refreshing auth context...');
          setTimeout(() => {
            refreshUserProfile();
          }, 500);
        }

        // Reset form
        setInviteForm({ email: '', fullName: '', role: 'member' });

        setTimeout(() => {
          setShowSuccessModal(false);
          // If from join request, go back to join requests screen
          if (params.fromJoinRequest === 'true') {
            router.back();
          }
        }, 3000);

        setIsLoading(false);
        return;
      }

      // User doesn't exist - send invitation via edge function
      console.log('Sending invitation to new user...');
      
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
      const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        Alert.alert('Error', 'Configuration error. Please try again later.');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-user-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: email,
          fullName: inviteForm.fullName.trim(),
          role: inviteForm.role,
          clubId: user.currentClubId,
          invitedBy: user.id
        }),
      });

      const result = await response.json();
      console.log('Invitation response:', result);

      if (result.success) {
        // If this came from a join request, update the request status
        if (params.fromJoinRequest === 'true' && params.requestId) {
          const { error: updateRequestError } = await supabase
            .from('club_join_requests')
            .update({
              status: 'approved'
            })
            .eq('id', params.requestId as string);

          if (updateRequestError) {
            console.error('Error updating join request:', updateRequestError);
            Alert.alert('Warning', 'Invitation sent successfully but failed to update join request status');
          }
        }

        setSuccessMessage(`Invitation sent to ${inviteForm.fullName} (${email})`);
        setShowSuccessModal(true);

        // Reset form
        setInviteForm({ email: '', fullName: '', role: 'member' });

        // Reload pending invitations
        loadPendingInvites();

        setTimeout(() => {
          setShowSuccessModal(false);
          // If from join request, go back to join requests screen
          if (params.fromJoinRequest === 'true') {
            router.back();
          }
        }, 3000);
      } else {
        Alert.alert('Error', result.message || 'Failed to send invitation');
      }
      
    } catch (error) {
      console.error('Error sending invite:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string, inviteeName: string, event?: any) => {
    // Prevent event bubbling
    if (event) {
      event.stopPropagation();
    }

    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${inviteeName}?`,
      [
        {
          text: 'No',
          style: 'cancel'
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting invitation:', inviteId);

              const { error } = await supabase
                .from('app_user_invitation')
                .update({
                  status: 'rejected',
                  updated_at: new Date().toISOString()
                } as any)
                .eq('id', inviteId);

              if (error) {
                console.error('Error cancelling invitation:', error);
                Alert.alert('Error', 'Failed to cancel invitation');
                return;
              }

              // Remove from local state
              setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));

              setSuccessMessage(`Invitation to ${inviteeName} has been cancelled`);
              setShowSuccessModal(true);

              setTimeout(() => {
                setShowSuccessModal(false);
              }, 2000);
            } catch (error) {
              console.error('Error deleting invite:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const getRoleIcon = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.icon || <User size={16} color="#ffffff" />;
  };

  const getRoleColor = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.color || '#6b7280';
  };

  const formatRole = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.label || role;
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours <= 0) return 'Expired';
    if (diffInHours === 1) return '1 hour left';
    return `${diffInHours} hours left`;
  };

  const RoleSelectionModal = () => (
    <Modal
      visible={showRoleModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowRoleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.roleModal, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Select Role</Text>
          <ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
            {roleOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.roleOption,
                  {
                    backgroundColor: inviteForm.role === option.value ? theme.colors.primary + '20' : 'transparent',
                    borderColor: inviteForm.role === option.value ? theme.colors.primary : theme.colors.border,
                  }
                ]}
                onPress={() => {
                  updateFormField('role', option.value);
                  setShowRoleModal(false);
                }}
              >
                <View style={[styles.roleOptionIcon, { backgroundColor: option.color }]}>
                  {option.icon}
                </View>
                <View style={styles.roleOptionContent}>
                  <Text style={[
                    styles.roleOptionTitle,
                    { color: inviteForm.role === option.value ? theme.colors.primary : theme.colors.text }
                  ]} maxFontSizeMultiplier={1.3}>
                    {option.label}
                  </Text>
                  <Text style={[styles.roleOptionDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const SuccessModal = () => (
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
          <Text style={[styles.successTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Success</Text>
          <Text style={[styles.successText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {successMessage}
          </Text>
        </View>
      </View>
    </Modal>
  );

  const InviteCard = ({ invite }: { invite: PendingInvite }) => (
    <View style={[styles.inviteCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.inviteInfo}>
        <View style={styles.inviteAvatar}>
          <User size={20} color="#ffffff" />
        </View>
        
        <View style={styles.inviteDetails}>
          <Text style={[styles.inviteName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {invite.invitee_full_name}
          </Text>
          <Text style={[styles.inviteEmail, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {invite.invitee_email}
          </Text>
          <View style={styles.inviteMeta}>
            <View style={[styles.roleTag, { backgroundColor: getRoleColor(invite.invitee_role) }]}>
              {getRoleIcon(invite.invitee_role)}
              <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(invite.invitee_role)}</Text>
            </View>
            <View style={styles.timeRemaining}>
              <Clock size={12} color={theme.colors.textSecondary} />
              <Text style={[styles.timeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                {getTimeRemaining(invite.expires_at)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.deleteInviteButton, { backgroundColor: '#fef2f2' }]}
        onPress={(e) => {
          e?.stopPropagation();
          handleDeleteInvite(invite.id, invite.invitee_full_name, e);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Invite New User</Text>
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

        {/* Invite Form */}
        <View style={[styles.inviteFormCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.formTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Send Invitation</Text>

          {/* Full Name Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Full Name *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <User size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter full name"
                placeholderTextColor={theme.colors.textSecondary}
                value={inviteForm.fullName}
                onChangeText={(text) => updateFormField('fullName', text)}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email Field */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Email Address *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <Mail size={16} color={theme.colors.textSecondary} />
              <TextInput
                style={[styles.textInput, { color: theme.colors.text }]}
                placeholder="Enter email address"
                placeholderTextColor={theme.colors.textSecondary}
                value={inviteForm.email}
                onChangeText={(text) => updateFormField('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Role Selection */}
          <View style={styles.formField}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Role *</Text>
            <TouchableOpacity
              style={[styles.roleSelector, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
              onPress={() => setShowRoleModal(true)}
            >
              <View style={styles.roleSelectorContent}>
                <View style={[styles.selectedRoleIcon, { backgroundColor: getRoleColor(inviteForm.role) }]}>
                  {getRoleIcon(inviteForm.role)}
                </View>
                <Text style={[styles.selectedRoleText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {formatRole(inviteForm.role)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Send Invite Button */}
          <TouchableOpacity
            style={[
              styles.sendInviteButton,
              {
                backgroundColor: (inviteForm.email.trim() && inviteForm.fullName.trim()) ? theme.colors.primary : theme.colors.surface,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={handleSendInvite}
            disabled={!inviteForm.email.trim() || !inviteForm.fullName.trim() || isLoading}
          >
            <Send size={16} color={(inviteForm.email.trim() && inviteForm.fullName.trim()) ? "#ffffff" : theme.colors.textSecondary} />
            <Text style={[
              styles.sendInviteButtonText,
              { color: (inviteForm.email.trim() && inviteForm.fullName.trim()) ? "#ffffff" : theme.colors.textSecondary }
            ]} maxFontSizeMultiplier={1.3}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Pending Invitations */}
        <View style={[styles.pendingSection, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Pending Invitations ({pendingInvites.length})
          </Text>
          
          {isLoadingInvites ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Loading invitations...</Text>
            </View>
          ) : pendingInvites.length > 0 ? (
            <View style={styles.invitesList}>
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.id} invite={invite} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyInvites}>
              <Mail size={32} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyInvitesText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                No pending invitations
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Role Selection Modal */}
      <RoleSelectionModal />

      {/* Success Modal */}
      <SuccessModal />
      </KeyboardAvoidingView>
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
  inviteFormCard: {
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
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
  },
  roleSelector: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  roleSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedRoleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  selectedRoleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sendInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    marginTop: 8,
  },
  sendInviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pendingSection: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
  },
  invitesList: {
    gap: 8,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inviteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteDetails: {
    flex: 1,
  },
  inviteName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteEmail: {
    fontSize: 12,
    marginBottom: 6,
  },
  inviteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 3,
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  deleteInviteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInvites: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyInvitesText: {
    fontSize: 14,
    marginTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleModal: {
    borderRadius: 12,
    padding: 16,
    margin: 20,
    maxHeight: '70%',
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  rolesList: {
    maxHeight: 400,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  roleOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleOptionContent: {
    flex: 1,
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  roleOptionDescription: {
    fontSize: 12,
    lineHeight: 16,
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
});
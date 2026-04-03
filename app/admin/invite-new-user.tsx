import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUrl } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Mail, User, Crown, Shield, Eye, UserCheck, Clock, Send, Trash2, CircleCheck as CheckCircle, Building2 } from 'lucide-react-native';

/** Notion-like neutrals */
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
  pillBg: '#F0EFED',
};

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

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member', description: 'Regular club member', Icon: User },
  { value: 'excomm', label: 'ExComm', description: 'Executive Committee member', Icon: Crown },
  { value: 'visiting_tm', label: 'Visiting Toastmaster', description: 'Visiting member from another club', Icon: UserCheck },
  { value: 'club_leader', label: 'Club Leader', description: 'Club leadership role', Icon: Shield },
  { value: 'guest', label: 'Guest', description: 'Guest member', Icon: Eye },
] as const;

export default function InviteNewUser() {
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
      
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        Alert.alert('Error', 'Configuration error. Please try again later.');
        setIsLoading(false);
        return;
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/send-user-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${accessToken || supabaseAnonKey}`,
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
    const r = (role || '').toLowerCase();
    const roleOption = ROLE_OPTIONS.find((x) => x.value === r);
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
        <View style={[styles.roleModal, { backgroundColor: N.surface, borderColor: N.border }]}>
          <Text style={[styles.modalTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Select role
          </Text>
          <ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
            {ROLE_OPTIONS.map((option) => {
              const selected = (inviteForm.role || '').toLowerCase() === option.value;
              const pill = notionRolePill(option.value);
              const IconC = option.Icon;
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
                  onPress={() => {
                    updateFormField('role', option.value);
                    setShowRoleModal(false);
                  }}
                >
                  <View style={[styles.roleOptionIconTile, { backgroundColor: pill.bg }]}>
                    <IconC size={16} color={pill.fg} strokeWidth={2} />
                  </View>
                  <View style={styles.roleOptionContent}>
                    <Text
                      style={[styles.roleOptionTitle, { color: selected ? N.accent : N.text }]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {option.label}
                    </Text>
                    <Text style={[styles.roleOptionDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
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
        <View style={[styles.successPopup, { backgroundColor: N.surface, borderColor: N.border }]}>
          <View style={[styles.successIcon, { backgroundColor: N.successSoft }]}>
            <CheckCircle size={22} color={N.success} strokeWidth={2} />
          </View>
          <Text style={[styles.successTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Done
          </Text>
          <Text style={[styles.successText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            {successMessage}
          </Text>
        </View>
      </View>
    </Modal>
  );

  const InviteCard = ({ invite, isLast }: { invite: PendingInvite; isLast?: boolean }) => {
    const pill = notionRolePill(invite.invitee_role);
    const opt = ROLE_OPTIONS.find((r) => r.value === (invite.invitee_role || '').toLowerCase());
    const RoleIcon = opt?.Icon ?? User;
    return (
      <View style={[styles.inviteCard, !isLast && { borderBottomWidth: 1, borderBottomColor: N.border }]}>
        <View style={styles.inviteInfo}>
          <View style={[styles.inviteAvatar, { backgroundColor: N.iconTile }]}>
            <User size={18} color={N.iconMuted} strokeWidth={1.75} />
          </View>

          <View style={styles.inviteDetails}>
            <Text style={[styles.inviteName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              {invite.invitee_full_name}
            </Text>
            <Text style={[styles.inviteEmail, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {invite.invitee_email}
            </Text>
            <View style={styles.inviteMeta}>
              <View style={[styles.inviteRolePill, { backgroundColor: pill.bg }]}>
                <RoleIcon size={11} color={pill.fg} strokeWidth={2} />
                <Text style={[styles.inviteRolePillText, { color: pill.fg }]} maxFontSizeMultiplier={1.3}>
                  {formatRole(invite.invitee_role)}
                </Text>
              </View>
              <View style={styles.timeRemaining}>
                <Clock size={12} color={N.textTertiary} strokeWidth={2} />
                <Text style={[styles.timeText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  {getTimeRemaining(invite.expires_at)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.deleteInviteButton, { borderColor: N.border, backgroundColor: N.page }]}
          onPress={(e) => {
            e?.stopPropagation();
            handleDeleteInvite(invite.id, invite.invitee_full_name, e);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={N.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    );
  };

  const canSend = Boolean(inviteForm.email.trim() && inviteForm.fullName.trim());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.page }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <View style={[styles.header, { backgroundColor: N.surface, borderBottomColor: N.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={N.iconMuted} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            Invite members
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.pageInset, { backgroundColor: N.surface, borderColor: N.border }]}>
            {clubInfo && (
              <>
                <View style={styles.clubBlock}>
                  <View style={styles.clubHeader}>
                    <View style={[styles.clubIconWrap, { backgroundColor: N.iconTile }]}>
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
                          const opt = ROLE_OPTIONS.find(
                            (r) => r.value === (user.clubRole || '').toLowerCase()
                          );
                          const ClubRoleIcon = opt?.Icon ?? User;
                          return (
                            <View style={[styles.clubRolePill, { backgroundColor: pill.bg }]}>
                              <ClubRoleIcon size={11} color={pill.fg} strokeWidth={2} />
                              <Text style={[styles.clubRolePillText, { color: pill.fg }]} maxFontSizeMultiplier={1.3}>
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
              Send invitation
            </Text>
            <Text style={[styles.sectionHint, { color: N.textTertiary }]} maxFontSizeMultiplier={1.2}>
              Send invites and grow your club community.
            </Text>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Full name
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: N.page, borderColor: N.border }]}>
                <User size={16} color={N.iconMuted} strokeWidth={1.75} />
                <TextInput
                  style={[styles.textInput, { color: N.text }]}
                  placeholder="Name"
                  placeholderTextColor={N.textTertiary}
                  value={inviteForm.fullName}
                  onChangeText={(text) => updateFormField('fullName', text)}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Email
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: N.page, borderColor: N.border }]}>
                <Mail size={16} color={N.iconMuted} strokeWidth={1.75} />
                <TextInput
                  style={[styles.textInput, { color: N.text }]}
                  placeholder="email@example.com"
                  placeholderTextColor={N.textTertiary}
                  value={inviteForm.email}
                  onChangeText={(text) => updateFormField('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={[styles.fieldLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                Role
              </Text>
              <TouchableOpacity
                style={[styles.roleSelector, { backgroundColor: N.page, borderColor: N.border }]}
                onPress={() => setShowRoleModal(true)}
                activeOpacity={0.7}
              >
                <View style={styles.roleSelectorContent}>
                  {(() => {
                    const pill = notionRolePill(inviteForm.role);
                    const opt = ROLE_OPTIONS.find((r) => r.value === (inviteForm.role || '').toLowerCase());
                    const SelIcon = opt?.Icon ?? User;
                    return (
                      <View style={[styles.selectedRoleIconTile, { backgroundColor: pill.bg }]}>
                        <SelIcon size={16} color={pill.fg} strokeWidth={2} />
                      </View>
                    );
                  })()}
                  <Text style={[styles.selectedRoleText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {formatRole(inviteForm.role)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendInviteButton,
                {
                  backgroundColor: canSend ? N.text : N.surface,
                  borderColor: canSend ? N.text : N.border,
                },
              ]}
              onPress={handleSendInvite}
              disabled={!canSend || isLoading}
              activeOpacity={0.85}
            >
              <Send size={16} color={canSend ? N.surface : N.textTertiary} strokeWidth={2} />
              <Text
                style={[styles.sendInviteButtonText, { color: canSend ? N.surface : N.textSecondary }]}
                maxFontSizeMultiplier={1.3}
              >
                {isLoading ? 'Sending…' : 'Send invitation'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.insetDivider, { backgroundColor: N.border, marginTop: 20 }]} />

            <Text style={[styles.sectionLabel, { color: N.textSecondary, marginTop: 4 }]} maxFontSizeMultiplier={1.2}>
              Pending · {pendingInvites.length}
            </Text>

            {isLoadingInvites ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Loading…
                </Text>
              </View>
            ) : pendingInvites.length > 0 ? (
              <View style={[styles.invitesGroup, { borderColor: N.border }]}>
                {pendingInvites.map((invite, index) => (
                  <InviteCard
                    key={invite.id}
                    invite={invite}
                    isLast={index === pendingInvites.length - 1}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyInvites}>
                <Mail size={26} color={N.textTertiary} strokeWidth={1.5} />
                <Text style={[styles.emptyInvitesText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  No pending invitations
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <RoleSelectionModal />
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
  scrollContent: {
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
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubIconWrap: {
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
  clubRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  clubRolePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  insetDivider: {
    height: 1,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.04,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  formField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  roleSelector: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  roleSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedRoleIconTile: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRoleText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  sendInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    paddingVertical: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  sendInviteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  invitesGroup: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  inviteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteDetails: {
    flex: 1,
    minWidth: 0,
  },
  inviteName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  inviteEmail: {
    fontSize: 12,
    marginBottom: 6,
  },
  inviteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  inviteRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  inviteRolePillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  deleteInviteButton: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 8,
  },
  emptyInvites: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyInvitesText: {
    fontSize: 14,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  roleModal: {
    borderRadius: 4,
    padding: 16,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  rolesList: {
    maxHeight: 400,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  roleOptionIconTile: {
    width: 32,
    height: 32,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleOptionContent: {
    flex: 1,
    minWidth: 0,
  },
  roleOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.1,
  },
  roleOptionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successPopup: {
    borderRadius: 4,
    padding: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
  },
  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Building2, Crown, Shield, Eye, UserCheck, User, X, Mail, Check, Clock, Info } from 'lucide-react-native';

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
  club?: {
    name: string;
    club_number: string | null;
  };
}

export default function MyClubRelationships() {
  const { user, refreshUserProfile } = useAuth();
  const N = {
    bg: '#F7F6F3',
    surface: '#FFFFFF',
    surfaceSoft: '#F1EFEB',
    border: '#E6E1D8',
    text: '#2F2A25',
    textSecondary: '#6B635C',
    accent: '#8B6F4E',
  };

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [clubToDisconnect, setClubToDisconnect] = useState<any>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);


  const loadPendingInvites = async () => {
    if (!user) return;

    setIsLoadingInvites(true);
    try {
      const { data, error } = await supabase
        .from('app_user_invitation')
        .select(`
          *,
          club:clubs(name, club_number)
        `)
        .or(`invitee_email.eq.${user.email},accepted_user_id.eq.${user.id}`)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading invites:', error);
        return;
      }

      setPendingInvites((data as any) || []);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleAcceptInvite = async (invite: PendingInvite) => {
    if (!user) return;

    try {
      console.log('Accepting invitation:', invite.id);
      console.log('User ID:', user.id);
      console.log('Club ID:', invite.club_id);
      console.log('Role:', invite.invitee_role);

      const { data: existingRelation, error: checkError } = await supabase
        .from('app_club_user_relationship')
        .select('id, is_authenticated')
        .eq('user_id', user.id)
        .eq('club_id', invite.club_id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing relationship:', checkError);
        Alert.alert('Error', `Failed to check membership: ${checkError.message}`);
        return;
      }

      if (existingRelation && (existingRelation as any).is_authenticated) {
        console.log('User already a member, updating invitation status only');
        Alert.alert('Already a Member', 'You are already a member of this club.');
        const { error: updateError } = await supabase
          .from('app_user_invitation')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_user_id: user.id,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', invite.id);

        if (updateError) {
          console.error('Error updating invitation:', updateError);
        }
        loadPendingInvites();
        return;
      }

      console.log('Creating club relationship...');
      const { data: relationshipData, error: relationshipError } = await supabase
        .from('app_club_user_relationship')
        .upsert({
          user_id: user.id,
          club_id: invite.club_id,
          role: invite.invitee_role,
          is_authenticated: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any, {
          onConflict: 'user_id,club_id'
        })
        .select();

      if (relationshipError) {
        console.error('Error creating relationship:', relationshipError);
        console.error('Error details:', JSON.stringify(relationshipError, null, 2));
        Alert.alert('Error', `Failed to join club: ${relationshipError.message}\n\nPlease try again or contact support.`);
        return;
      }

      console.log('Relationship created successfully:', relationshipData);
      console.log('Updating invitation status...');

      const { error: acceptError } = await supabase
        .from('app_user_invitation')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_user_id: user.id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', invite.id);

      if (acceptError) {
        console.error('Error accepting invite:', acceptError);
        console.error('Accept error details:', JSON.stringify(acceptError, null, 2));
      } else {
        console.log('Invitation status updated successfully');
      }

      Alert.alert('Success', `You've joined ${invite.club?.name || 'the club'}!`);
      console.log('Refreshing user profile...');
      await refreshUserProfile();
      loadPendingInvites();
    } catch (error) {
      console.error('Error accepting invite:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Error', `Failed to accept invitation: ${errorMessage}\n\nPlease try again or contact support.`);
    }
  };

  const handleRejectInvite = async (invite: PendingInvite) => {
    Alert.alert(
      'Reject Invitation',
      `Are you sure you want to reject the invitation from ${invite.club?.name || 'this club'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('app_user_invitation')
                .update({
                  status: 'rejected',
                  updated_at: new Date().toISOString(),
                } as any)
                .eq('id', invite.id);

              if (error) {
                console.error('Error rejecting invite:', error);
                Alert.alert('Error', 'Failed to reject invitation');
                return;
              }

              loadPendingInvites();
            } catch (error) {
              console.error('Error rejecting invite:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            }
          }
        }
      ]
    );
  };

  const handleDisconnectClub = (club: any) => {
    setClubToDisconnect(club);
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async () => {
    if (!clubToDisconnect || !user) return;

    try {
      const { error } = await supabase
        .from('app_club_user_relationship')
        .update({ is_authenticated: false } as any)
        .eq('user_id', user.id)
        .eq('club_id', clubToDisconnect.id);

      if (error) {
        console.error('Error disconnecting from club:', error);
        Alert.alert('Error', 'Failed to disconnect from club');
        return;
      }

      Alert.alert('Success', `Disconnected from ${clubToDisconnect.name}`);
      setShowDisconnectModal(false);
      setClubToDisconnect(null);

      await refreshUserProfile();
    } catch (error) {
      console.error('Error disconnecting from club:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };


  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={14} color="#6B635C" />;
      case 'visiting_tm': return <UserCheck size={14} color="#6B635C" />;
      case 'club_leader': return <Shield size={14} color="#6B635C" />;
      case 'guest': return <Eye size={14} color="#6B635C" />;
      case 'member': return <User size={14} color="#6B635C" />;
      default: return <User size={14} color="#6B635C" />;
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


  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffInHours = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (diffInHours <= 0) return 'Expired';
    if (diffInHours < 24) return `${diffInHours}h left`;
    const days = Math.ceil(diffInHours / 24);
    return `${days}d left`;
  };

  const renderJoinedTab = () => (
    <>
      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: N.surface, borderColor: N.border }]}>
        <Text style={[styles.summaryCount, { color: N.text }]} maxFontSizeMultiplier={1.3}>
          {user?.clubs?.length || 0}
        </Text>
        <Text style={[styles.summaryLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
          {user?.clubs?.length === 1 ? 'Active Club' : 'Active Clubs'}
        </Text>
      </View>

      {/* Club Cards */}
      <View style={styles.clubsSection}>
        {user?.clubs && user.clubs.length > 0 ? (
          user.clubs.map((club) => (
            <View key={club.id} style={[styles.clubCard, { backgroundColor: N.surface, borderColor: N.border }]}>
              {/* Club Header */}
              <View style={styles.clubHeader}>
                <View style={[styles.clubIconContainer, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
                  <Building2 size={20} color={N.textSecondary} />
                </View>
                <View style={styles.clubInfo}>
                  <Text style={[styles.clubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {club.name}
                  </Text>
                  {club.club_number && (
                    <Text style={[styles.clubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                      Club #{club.club_number}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.disconnectButton, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}
                  onPress={() => handleDisconnectClub(club)}
                >
                  <X size={16} color={N.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Club Details */}
              <View style={styles.clubDetails}>
                {/* Role Badge */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Role
                  </Text>
                  <View style={[styles.roleBadge, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
                    {getRoleIcon(club.role)}
                    <Text style={[styles.roleBadgeText, { color: N.text }]} maxFontSizeMultiplier={1.3}>{formatRole(club.role)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyState, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Building2 size={48} color={N.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              No Joined Clubs
            </Text>
            <Text style={[styles.emptyStateDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              You haven't joined any clubs yet. Contact your club administrator for an invitation.
            </Text>
          </View>
        )}
      </View>
    </>
  );

  const renderInvitesTab = () => (
    <View style={styles.invitesSection}>
      {isLoadingInvites ? (
        <View style={[styles.emptyState, { backgroundColor: N.surface, borderColor: N.border }]}>
          <Text style={[styles.emptyStateDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Loading invitations...
          </Text>
        </View>
      ) : pendingInvites.length > 0 ? (
        pendingInvites.map((invite) => (
          <View key={invite.id} style={[styles.inviteCard, { backgroundColor: N.surface, borderColor: N.border }]}>
            <View style={styles.inviteHeader}>
              <View style={[styles.inviteIconContainer, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
                <Mail size={20} color={N.textSecondary} />
              </View>
              <View style={styles.inviteInfo}>
                <Text style={[styles.inviteClubName, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                  {invite.club?.name || 'Unknown Club'}
                </Text>
                {invite.club?.club_number && (
                  <Text style={[styles.inviteClubNumber, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                    Club #{invite.club.club_number}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.inviteDetails}>
              <View style={styles.inviteDetailRow}>
                <Text style={[styles.inviteDetailLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Role Offered
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}>
                  {getRoleIcon(invite.invitee_role)}
                  <Text style={[styles.roleBadgeText, { color: N.text }]} maxFontSizeMultiplier={1.3}>{formatRole(invite.invitee_role)}</Text>
                </View>
              </View>

              <View style={styles.inviteDetailRow}>
                <Text style={[styles.inviteDetailLabel, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Expires
                </Text>
                <View style={styles.detailValue}>
                  <Clock size={14} color={N.textSecondary} />
                  <Text style={[styles.detailText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                    {getTimeRemaining(invite.expires_at)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={[styles.inviteActionButton, styles.rejectButton, { borderColor: N.border, backgroundColor: N.surfaceSoft }]}
                onPress={() => handleRejectInvite(invite)}
              >
                <X size={16} color={N.textSecondary} />
                <Text style={[styles.inviteActionText, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.inviteActionButton, styles.acceptButton, { backgroundColor: N.text, borderColor: N.text }]}
                onPress={() => handleAcceptInvite(invite)}
              >
                <Check size={16} color="#ffffff" />
                <Text style={[styles.inviteActionText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View style={[styles.emptyState, { backgroundColor: N.surface, borderColor: N.border }]}>
          <Mail size={48} color={N.textSecondary} />
          <Text style={[styles.emptyStateTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
            No Pending Invites
          </Text>
          <Text style={[styles.emptyStateDescription, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You don't have any pending club invitations at the moment.
          </Text>
        </View>
      )}
    </View>
  );


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: N.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: N.bg, borderBottomColor: N.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={N.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>My Club Relationships</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowInfoModal(true)}>
          <Info size={22} color={N.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {renderJoinedTab()}

        <View style={styles.navSpacer} />
      </ScrollView>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.infoModalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: N.surface, borderColor: N.border }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                My Club Relationships
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={N.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: N.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                🤝 My Club Relationships
              </Text>

              <Text style={[styles.infoModalText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Your choice, your community 🌍 View the clubs you're part of and the role you hold in each one 🎯
              </Text>

              <Text style={[styles.infoModalText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Each card shows a club you selected. You can disconnect anytime 🔄 and remain in full control of your memberships.
              </Text>

              <Text style={[styles.infoModalText, { color: N.text }]} maxFontSizeMultiplier={1.3}>
                Want to rejoin a club later? 📩 Reach out to that club's ExCom team.
              </Text>

              <Text style={[styles.infoModalText, { color: N.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                Your network. Your growth. 🌱
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: N.text }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Disconnect Confirmation Modal */}
      <Modal
        visible={showDisconnectModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDisconnectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: N.surface, borderColor: N.border }]}>
            <Text style={[styles.modalTitle, { color: N.text }]} maxFontSizeMultiplier={1.3}>
              Disconnect from Club
            </Text>
            <Text style={[styles.modalMessage, { color: N.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Are you sure you want to disconnect from {clubToDisconnect?.name}? You will lose access to this club's features and data.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: N.surfaceSoft, borderColor: N.border }]}
                onPress={() => setShowDisconnectModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: N.text }]} maxFontSizeMultiplier={1.3}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#ef4444', borderColor: '#ef4444' }]}
                onPress={handleConfirmDisconnect}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]} maxFontSizeMultiplier={1.3}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 16,
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
  contentContainer: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 6,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  summaryCount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  clubsSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  clubCard: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  clubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  clubIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
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
    marginBottom: 2,
  },
  clubNumber: {
    fontSize: 12,
  },
  disconnectButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invitesSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  inviteCard: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteInfo: {
    flex: 1,
  },
  inviteClubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  inviteClubNumber: {
    fontSize: 12,
  },
  inviteDetails: {
    gap: 12,
    marginBottom: 16,
  },
  inviteDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteDetailLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  inviteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
  },
  acceptButton: {
    borderWidth: 1,
  },
  inviteActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 6,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    borderRadius: 6,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    borderRadius: 6,
    borderWidth: 1,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  infoModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  infoModalCloseButton: {
    padding: 4,
  },
  infoModalContent: {
    padding: 20,
    maxHeight: 500,
  },
  infoModalText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  infoModalButton: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoModalButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

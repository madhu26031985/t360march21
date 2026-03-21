import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ChevronDown, Crown, User, Shield, Eye, UserCheck, Building2 } from 'lucide-react-native';

interface ClubSwitcherProps {
  showRole?: boolean;
  /** When true, renders without card chrome for use inside a parent container (e.g. masterBox) */
  embedded?: boolean;
}

export default function ClubSwitcher({ showRole = true, embedded = false }: ClubSwitcherProps) {
  const { theme } = useTheme();
  const { user, switchClub, refreshUserProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const refreshClubData = async () => {
      if (user?.currentClubId && (!user.clubs || user.clubs.length === 0) && !isRefreshing) {
        setIsRefreshing(true);
        await refreshUserProfile();
        setIsRefreshing(false);
      }
    };

    refreshClubData();
  }, [user?.currentClubId, user?.clubs?.length]);

  if (!user || !user.clubs || user.clubs.length === 0) {
    return null;
  }

  const currentClub = user.clubs.find(c => c.id === user.currentClubId) || user.clubs[0];

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'excomm': return <Crown size={12} color="#8b5cf6" />;
      case 'visiting_tm': return <UserCheck size={12} color="#10b981" />;
      case 'club_leader': return <Shield size={12} color="#f59e0b" />;
      case 'guest': return <Eye size={12} color="#6b7280" />;
      case 'member': return <User size={12} color="#3b82f6" />;
      default: return <User size={12} color="#6b7280" />;
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

  const handleClubSwitch = async (clubId: string) => {
    await switchClub(clubId);
    setShowModal(false);
  };

  return (
    <>
      <TouchableOpacity 
        style={[
          embedded ? styles.clubCardEmbedded : styles.clubCard,
          embedded ? { backgroundColor: 'transparent' } : { backgroundColor: '#fffbeb' }
        ]}
        onPress={() => user.clubs && user.clubs.length > 1 && setShowModal(true)}
      >
        <View style={styles.clubHeader}>
          <View style={[styles.clubIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Building2 size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.clubInfo}>
            <View style={styles.clubNameRow}>
              <Text style={[styles.clubName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                {currentClub.name}
              </Text>
              {user.clubs.length > 1 && (
                <ChevronDown size={16} color={theme.colors.textSecondary} />
              )}
            </View>
            <View style={styles.clubMeta}>
              {currentClub.club_number && (
                <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  Club #{currentClub.club_number}
                </Text>
              )}
              {showRole && (
                <View style={[
                  styles.roleTag,
                  { backgroundColor: getRoleColor(currentClub.role) }
                ]}>
                  {getRoleIcon(currentClub.role)}
                  <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>
                    {formatRole(currentClub.role)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Club Switcher Modal */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}
        >
          <View style={[styles.clubModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Switch Club</Text>
            <ScrollView style={styles.clubsList} showsVerticalScrollIndicator={false}>
              {user.clubs?.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={[
                    styles.clubOption,
                    club.id === currentClub.id && { backgroundColor: theme.colors.primary + '20' }
                  ]}
                  onPress={() => handleClubSwitch(club.id)}
                >
                  <View style={styles.clubOptionInfo}>
                    <Text style={[
                      styles.clubOptionName, 
                      { color: club.id === currentClub.id ? theme.colors.primary : theme.colors.text }
                    ]} maxFontSizeMultiplier={1.3}>
                      {club.name}
                    </Text>
                    <View style={styles.clubOptionMeta}>
                      {club.club_number && (
                        <Text style={[styles.clubOptionId, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                          Club #{club.club_number}
                        </Text>
                      )}
                      <View style={[styles.roleTag, { backgroundColor: getRoleColor(club.role) + '20' }]}>
                        {getRoleIcon(club.role)}
                        <Text style={[styles.roleText, { color: getRoleColor(club.role) }]} maxFontSizeMultiplier={1.3}>
                          {formatRole(club.role)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  clubCardEmbedded: {
    paddingVertical: 4,
    paddingHorizontal: 0,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
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
  clubNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubModal: {
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
  clubsList: {
    maxHeight: 400,
  },
  clubOption: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  clubOptionInfo: {
    flex: 1,
  },
  clubOptionName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubOptionId: {
    fontSize: 11,
  },
});
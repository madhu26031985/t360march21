import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ChevronDown, Crown, User, Shield, Eye, UserCheck, Building2 } from 'lucide-react-native';

/** Notion-like neutrals (no saturated purple on role pills) */
const N = {
  surface: '#FFFFFF',
  page: '#FBFBFA',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  iconMuted: 'rgba(55, 53, 47, 0.45)',
  iconTile: 'rgba(55, 53, 47, 0.06)',
  pillBg: '#F0EFED',
};

function notionRolePill(role: string): { bg: string; fg: string } {
  switch (role.toLowerCase()) {
    case 'excomm':
      return { bg: N.pillBg, fg: N.text };
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
}

function RoleIcon({ role, color }: { role: string; color: string }) {
  const p = { size: 12 as const, color, strokeWidth: 1.75 as const };
  switch (role.toLowerCase()) {
    case 'excomm':
      return <Crown {...p} />;
    case 'visiting_tm':
      return <UserCheck {...p} />;
    case 'club_leader':
      return <Shield {...p} />;
    case 'guest':
      return <Eye {...p} />;
    case 'member':
      return <User {...p} />;
    default:
      return <User {...p} />;
  }
}

interface ClubSwitcherProps {
  showRole?: boolean;
  /** When true, renders without card chrome for use inside a parent container (e.g. masterBox) */
  embedded?: boolean;
  /** Flat borders, muted role pills (no violet ExComm chip) */
  variant?: 'default' | 'notion';
}

export default function ClubSwitcher({ showRole = true, embedded = false, variant = 'default' }: ClubSwitcherProps) {
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
    if (variant === 'notion') {
      const pill = notionRolePill(role);
      return <RoleIcon role={role} color={pill.fg} />;
    }
    switch (role.toLowerCase()) {
      case 'excomm':
        return <Crown size={12} color="#8b5cf6" />;
      case 'visiting_tm':
        return <UserCheck size={12} color="#10b981" />;
      case 'club_leader':
        return <Shield size={12} color="#f59e0b" />;
      case 'guest':
        return <Eye size={12} color="#6b7280" />;
      case 'member':
        return <User size={12} color="#3b82f6" />;
      default:
        return <User size={12} color="#6b7280" />;
    }
  };

  const getRoleColor = (role: string) => {
    if (variant === 'notion') {
      return notionRolePill(role).bg;
    }
    switch (role.toLowerCase()) {
      case 'excomm':
        return '#8b5cf6';
      case 'visiting_tm':
        return '#10b981';
      case 'club_leader':
        return '#f59e0b';
      case 'guest':
        return '#6b7280';
      case 'member':
        return '#3b82f6';
      default:
        return '#6b7280';
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

  const isNotion = variant === 'notion';

  return (
    <>
      <TouchableOpacity 
        style={[
          embedded ? styles.clubCardEmbedded : styles.clubCard,
          embedded
            ? { backgroundColor: 'transparent' }
            : isNotion
              ? { backgroundColor: N.surface, borderWidth: 1, borderColor: N.border, shadowOpacity: 0, elevation: 0 }
              : { backgroundColor: '#fffbeb' },
        ]}
        onPress={() => user.clubs && user.clubs.length > 1 && setShowModal(true)}
      >
        <View style={styles.clubHeader}>
          <View
            style={[
              styles.clubIcon,
              {
                backgroundColor: isNotion ? N.iconTile : theme.colors.primary + '20',
                borderRadius: isNotion ? 4 : 20,
              },
            ]}
          >
            <Building2 size={20} color={isNotion ? N.iconMuted : theme.colors.primary} strokeWidth={1.75} />
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
                <View
                  style={[
                    styles.roleTag,
                    isNotion
                      ? {
                          backgroundColor: notionRolePill(currentClub.role).bg,
                          borderRadius: 4,
                          paddingVertical: 3,
                        }
                      : { backgroundColor: getRoleColor(currentClub.role) },
                  ]}
                >
                  {getRoleIcon(currentClub.role)}
                  <Text
                    style={[
                      styles.roleText,
                      isNotion && {
                        color: notionRolePill(currentClub.role).fg,
                        marginLeft: 4,
                      },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
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
          <View
            style={[
              styles.clubModal,
              {
                backgroundColor: isNotion ? N.surface : theme.colors.surface,
                borderWidth: isNotion ? 1 : 0,
                borderColor: isNotion ? N.border : undefined,
                borderRadius: isNotion ? 4 : 12,
              },
            ]}
          >
            <Text
              style={[styles.modalTitle, { color: isNotion ? N.text : theme.colors.text }]}
              maxFontSizeMultiplier={1.3}
            >
              Switch Club
            </Text>
            <ScrollView style={styles.clubsList} showsVerticalScrollIndicator={false}>
              {user.clubs?.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={[
                    styles.clubOption,
                    club.id === currentClub.id && {
                      backgroundColor: isNotion ? N.accentSoft : theme.colors.primary + '20',
                    },
                  ]}
                  onPress={() => handleClubSwitch(club.id)}
                >
                  <View style={styles.clubOptionInfo}>
                    <Text
                      style={[
                        styles.clubOptionName,
                        {
                          color: club.id === currentClub.id ? (isNotion ? N.accent : theme.colors.primary) : isNotion ? N.text : theme.colors.text,
                        },
                      ]}
                      maxFontSizeMultiplier={1.3}
                    >
                      {club.name}
                    </Text>
                    <View style={styles.clubOptionMeta}>
                      {club.club_number && (
                        <Text
                          style={[styles.clubOptionId, { color: isNotion ? N.textSecondary : theme.colors.textSecondary }]}
                          maxFontSizeMultiplier={1.3}
                        >
                          Club #{club.club_number}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.roleTag,
                          isNotion
                            ? {
                                backgroundColor: notionRolePill(club.role).bg,
                                borderRadius: 4,
                                paddingVertical: 3,
                              }
                            : { backgroundColor: getRoleColor(club.role) + '20' },
                        ]}
                      >
                        {isNotion ? <RoleIcon role={club.role} color={notionRolePill(club.role).fg} /> : getRoleIcon(club.role)}
                        <Text
                          style={[
                            styles.roleText,
                            isNotion
                              ? { color: notionRolePill(club.role).fg, marginLeft: 4 }
                              : { color: getRoleColor(club.role) },
                          ]}
                          maxFontSizeMultiplier={1.3}
                        >
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
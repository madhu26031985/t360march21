import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { prefetchClubInfoManagement } from '@/lib/prefetchClubInfoManagement';
import { prefetchExcommManagement } from '@/lib/prefetchExcommManagement';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Settings, Building2, Crown, ArrowLeft, Share2, FileText, Calendar, User, Shield, Eye, UserCheck, Info, X, Home, Users } from 'lucide-react-native';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}

interface ClubInfo {
  id: string;
  name: string;
  club_number: string | null;
}

function FeatureCard({ title, description, icon, onPress }: FeatureCardProps) {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.featureCard, { backgroundColor: theme.colors.surface }]} onPress={onPress}>
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.featureTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={[styles.featureDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ClubOperations() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [clubInfo, setClubInfo] = useState<ClubInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    loadClubInfo();
  }, []);

  const loadClubInfo = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

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
    } finally {
      setIsLoading(false);
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
          <Text style={[styles.loadingText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Loading...</Text>
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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Operations</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => setShowInfoModal(true)}>
          <Info size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
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

        <View style={styles.featuresGrid}>
          <FeatureCard
            title="Club Info Management"
            description="Update club information and preferences"
            icon={<Settings size={20} color="#0a66c2" />}
            onPress={() => {
              prefetchClubInfoManagement(queryClient, user?.currentClubId);
              router.push('/admin/club-info-management');
            }}
          />
          
          <FeatureCard
            title="ExComm Management"
            description="Manage Executive Committee roles and assignments"
            icon={<Crown size={20} color="#0a66c2" />}
            onPress={() => {
              prefetchExcommManagement(queryClient, user?.currentClubId);
              router.push('/admin/excomm-management');
            }}
          />
          
          <FeatureCard
            title="Member Resources"
            description="Manage educational resources for club members"
            icon={<FileText size={20} color="#0a66c2" />}
            onPress={() => router.push('/admin/member-resources-management')}
          />
          
          <FeatureCard
            title="Social Media Management"
            description="Manage club's social media links and online presence"
            icon={<Share2 size={20} color="#0a66c2" />}
            onPress={() => router.push('/admin/social-media-management')}
          />
          
          <FeatureCard
            title="Club Meeting Details"
            description="Configure meeting schedule, frequency, and format"
            icon={<Calendar size={20} color="#0a66c2" />}
            onPress={() => router.push('/admin/club-meeting-details')}
          />
        </View>


        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
        <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationBar}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                <Home size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/club')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                <Users size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/meetings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                <Calendar size={16} color="#0ea5e9" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/(tabs)/settings')}
            >
              <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                <Settings size={16} color="#8b5cf6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            {user?.clubRole === 'excomm' && (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/(tabs)/admin')}
              >
                <View style={[styles.navIcon, { backgroundColor: '#FFE5E5' }]}>
                  <Settings size={16} color="#dc2626" />
                </View>
                <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </ScrollView>

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.infoModalContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.infoModalHeader}>
              <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Club Operations
              </Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.infoModalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                🏛️ Club Operations — The Heart of Your Club
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Behind every confident speaker and every powerful meeting,
                there is a team quietly shaping the experience.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                This page is your club's control room —
                the place where ideas turn into systems,
                and systems turn into great meetings.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Each section here plays a role in your club's story:
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                Club Info Management
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                The identity of your club — who you are and how the world sees you.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                ExComm Management
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                The leaders who guide, support, and keep the club moving forward.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                Member Resources
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                The learning tools that help every member grow.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                Social Media Management
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Your club's voice beyond the meeting room.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, fontWeight: '600' }]} maxFontSizeMultiplier={1.3}>
                Club Meeting Details
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                The rhythm of your club — when and how you meet.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                This is not just settings.
                It is the foundation of every successful meeting.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                When you manage this space,
                you are not just running a club —
                you are building a legacy. 🌟
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowInfoModal(false)}
            >
              <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.3}>Got it</Text>
            </TouchableOpacity>
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
  contentContainer: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
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
  featuresGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  featureCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e7f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContainer: {
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    fontSize: 20,
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
    fontSize: 15,
    lineHeight: 24,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  navigationSection: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
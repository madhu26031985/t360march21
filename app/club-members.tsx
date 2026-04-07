import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Users, User, Search, Home, Calendar, Settings, Shield } from 'lucide-react-native';
const FOOTER_NAV_ICON_SIZE = 15;
const footerIconTileStyle = { borderWidth: 0, backgroundColor: 'transparent' } as const;

interface Club {
  id: string;
  name: string;
  club_number: string | null;
}

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  About: string | null;
  'Toastmaster since': string | null;
  'Mentor Name': string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  avatar_url: string | null;
}

export default function ClubMembers() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  const hasClub = user?.currentClubId != null;

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<ClubMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [clubInfo, setClubInfo] = useState<Club | null>(null);
  const [isExComm, setIsExComm] = useState(false);

  useEffect(() => {
    loadClubMembers();
    loadClubInfo();
    loadUserRole();
  }, []);

  useEffect(() => {
    filterMembers();
  }, [searchQuery, members]);

  const loadClubMembers = async () => {
    if (!user?.currentClubId) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('Loading club members for club:', user.currentClubId);
      
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select(`
          id,
          role,
          is_authenticated,
          created_at,
          app_user_profiles (
            id,
            full_name,
            email,
            is_active,
            "About",
            "Toastmaster since",
            "Mentor Name",
            facebook_url,
            linkedin_url,
            instagram_url,
            twitter_url
          )
        `)
        .eq('club_id', user.currentClubId)
        .eq('is_authenticated', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error loading club members (non-critical):', error.message);
        Alert.alert('Error', 'Failed to load club members');
        return;
      }

      const transformedMembers = (data || []).map(item => ({
        id: (item as any).app_user_profiles.id,
        full_name: (item as any).app_user_profiles.full_name,
        email: (item as any).app_user_profiles.email,
        role: (item as any).role,
        is_active: (item as any).app_user_profiles.is_active,
        created_at: (item as any).created_at,
        About: (item as any).app_user_profiles.About,
        'Toastmaster since': (item as any).app_user_profiles['Toastmaster since'],
        'Mentor Name': (item as any).app_user_profiles['Mentor Name'],
        facebook_url: (item as any).app_user_profiles.facebook_url,
        linkedin_url: (item as any).app_user_profiles.linkedin_url,
        instagram_url: (item as any).app_user_profiles.instagram_url,
        twitter_url: (item as any).app_user_profiles.twitter_url,
        avatar_url: null,
      }));

      // Sort alphabetically by full_name
      transformedMembers.sort((a, b) => a.full_name.localeCompare(b.full_name));

      setMembers(transformedMembers);
    } catch (error) {
      console.error('Error loading club members:', error);
      setMembers([]);
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

  const loadUserRole = async () => {
    if (!user?.id || !user?.currentClubId) return;

    try {
      const { data, error } = await supabase
        .from('app_club_user_relationship')
        .select('role')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (error) {
        console.error('Error loading user role:', error);
        return;
      }

      setIsExComm(data?.role === 'excomm');
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };

  const filterMembers = () => {
    if (!searchQuery.trim()) {
      setFilteredMembers(members);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = members.filter(member =>
        member.full_name.toLowerCase().includes(query)
      );
      setFilteredMembers(filtered);
    }
  };

  const handleViewProfile = (member: ClubMember) => {
    router.push(`/member-profile?memberId=${member.id}`);
  };

  const MemberCard = ({ member }: { member: ClubMember }) => (
    <View style={[styles.memberCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.memberAvatar}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }} style={styles.memberAvatarImage} resizeMode="cover" />
        ) : (
          <User size={24} color="#ffffff" />
        )}
      </View>
      
      <Text style={[styles.memberName, { color: theme.colors.text }]} numberOfLines={1}>
        {member.full_name}
      </Text>
      
      <TouchableOpacity 
        style={[styles.viewProfileButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => handleViewProfile(member)}
      >
        <Text style={styles.viewProfileText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );

  const ClubInfoCard = () => {
    if (!clubInfo) return null;

    return (
      <View style={[styles.clubCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.clubHeader}>
          <View style={styles.clubInfo}>
            <Text style={[styles.clubName, { color: theme.colors.text }]}>
              {clubInfo.name}
            </Text>
            <View style={styles.clubMeta}>
              {clubInfo.club_number && (
                <Text style={[styles.clubNumber, { color: theme.colors.textSecondary }]}>
                  Club #{clubInfo.club_number}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading members...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isTabFocused = (route: 'index' | 'club' | 'meetings' | 'admin' | 'settings') =>
    Boolean(pathname?.includes('club-members') && route === 'club');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.pageMain}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>My Club Members</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Club Info Card */}
        <ClubInfoCard />

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Search size={16} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search members by name..."
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={[styles.clearButton, { color: theme.colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Members Count */}
        <View style={styles.membersHeader}>
          <Text style={[styles.membersCount, { color: theme.colors.textSecondary }]}>
            {filteredMembers.length} {searchQuery ? 'result(s)' : 'members'}
          </Text>
        </View>

        {/* Members Grid */}
        <View style={styles.membersGrid}>
          {filteredMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </View>

        {/* Empty State */}
        {filteredMembers.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Users size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
              {searchQuery ? 'No members found' : 'No members in this club'}
            </Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary }]}>
              {searchQuery
                ? `No results for "${searchQuery}"`
                : 'Members will appear here once they join the club'
              }
            </Text>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={[
          styles.geBottomDock,
          {
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            width: windowWidth,
            paddingBottom:
              Platform.OS === 'web'
                ? Math.min(Math.max(insets.bottom, 8), 14)
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.tabBarRow}>
          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: isTabFocused('index') ? 1 : 0.5 }]}>
              <Home size={FOOTER_NAV_ICON_SIZE} color="#0a66c2" />
            </View>
            <Text
              style={[
                styles.footerNavLabel,
                { color: isTabFocused('index') ? theme.colors.primary : theme.colors.textSecondary },
              ]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/club')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: isTabFocused('club') ? 1 : 0.5 }]}>
              <Users size={FOOTER_NAV_ICON_SIZE} color="#d97706" />
            </View>
            <Text
              style={[
                styles.footerNavLabel,
                { color: isTabFocused('club') ? theme.colors.primary : theme.colors.textSecondary },
              ]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              Club
            </Text>
          </TouchableOpacity>

          {hasClub ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/meetings')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: isTabFocused('meetings') ? 1 : 0.5 }]}>
                <Calendar size={FOOTER_NAV_ICON_SIZE} color="#0ea5e9" />
              </View>
              <Text
                style={[
                  styles.footerNavLabel,
                  { color: isTabFocused('meetings') ? theme.colors.primary : theme.colors.textSecondary },
                ]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                Meeting
              </Text>
            </TouchableOpacity>
          ) : null}

          {isExComm ? (
            <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/admin')} activeOpacity={0.75}>
              <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: isTabFocused('admin') ? 1 : 0.5 }]}>
                <Shield size={FOOTER_NAV_ICON_SIZE} color={EXCOMM_UI.adminTabIcon} />
              </View>
              <Text
                style={[
                  styles.footerNavLabel,
                  { color: isTabFocused('admin') ? theme.colors.primary : theme.colors.textSecondary },
                ]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                Admin
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.footerNavItem} onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
            <View style={[styles.footerNavIcon, footerIconTileStyle, { opacity: isTabFocused('settings') ? 1 : 0.5 }]}>
              <Settings size={FOOTER_NAV_ICON_SIZE} color="#6b7280" />
            </View>
            <Text
              style={[
                styles.footerNavLabel,
                { color: isTabFocused('settings') ? theme.colors.primary : theme.colors.textSecondary },
              ]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              Settings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </View>
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
  pageMain: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  geBottomDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 4,
    width: '100%',
    alignSelf: 'stretch',
  },
  tabBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  footerNavItem: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  footerNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  footerNavLabel: {
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
    paddingVertical: 0,
  },
  clearButton: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  membersHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  membersCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 32,
  },
  memberCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 140,
  },
  memberAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  viewProfileButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
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
  slideModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  slideProfileModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 16,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'relative',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  onlineIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  modalRoleTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  modalRoleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollableModalContent: {
    flex: 1,
  },
  scrollableContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 60,
    flexGrow: 1,
  },
  modalSection: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  socialMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  socialIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  socialMediaLinkStyle: {
    marginRight: 8,
    marginBottom: 8,
  },
});
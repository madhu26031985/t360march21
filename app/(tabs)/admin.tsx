import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings,
  Vote,
  Users,
  Building2,
  CalendarPlus,
  UserPlus,
  Archive,
  GraduationCap,
  Crown,
  FileText,
  Share2,
  Calendar,
  ChevronRight,
} from 'lucide-react-native';
import ClubSwitcher from '@/components/ClubSwitcher';
import { useCallback } from 'react';

const CLUB_OPERATIONS_SUB_PAGES = [
  {
    title: 'Club Info Management',
    route: '/admin/club-info-management' as const,
    Icon: Settings,
    accentColor: '#0a66c2',
  },
  {
    title: 'ExComm Management',
    route: '/admin/excomm-management' as const,
    Icon: Crown,
    accentColor: '#0a66c2',
  },
  {
    title: 'Member Resources',
    route: '/admin/member-resources-management' as const,
    Icon: FileText,
    accentColor: '#0a66c2',
  },
  {
    title: 'Social Media Management',
    route: '/admin/social-media-management' as const,
    Icon: Share2,
    accentColor: '#0a66c2',
  },
  {
    title: 'Club Meeting Details',
    route: '/admin/club-meeting-details' as const,
    Icon: Calendar,
    accentColor: '#0a66c2',
  },
];

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  accentColor: string;
}

function QuickActionTile({ label, icon, onPress, accentColor }: QuickActionProps) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.quickActionCard,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIconCircle, { backgroundColor: accentColor }]}>
        {icon}
      </View>
      <Text style={[styles.quickActionCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25} numberOfLines={3}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AdminPanel() {
  const { theme } = useTheme();
  const { user, isAuthenticated, refreshUserProfile } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshUserProfile();
      }
    }, [isAuthenticated, refreshUserProfile])
  );

  const getUserRole = () => {
    // Use club role if available and authenticated, otherwise fall back to user role
    if (user?.isAuthenticated && user?.clubRole) {
      return user.clubRole.toLowerCase();
    }
    return user?.role?.toLowerCase() || '';
  };
  
  const canSeeAdminFeature = (feature: string) => {
    const role = getUserRole();
    
    // Only excomm can see admin panel
    if (role !== 'excomm') {
      return false;
    }
    
    switch (feature) {
      case 'meeting_operations':
        return role === 'excomm'; // Only excomm can manage meeting operations
      case 'user_management':
        return role === 'excomm'; // Only excomm can manage users
      case 'club_operations':
        return role === 'excomm'; // Only excomm can manage club operations
      case 'voting_operations':
        return role === 'excomm'; // Only excomm can manage voting operations
      case 'excomm_corner':
        return role === 'excomm'; // Only excomm can access excomm corner
      default:
        return false;
    }
  };
  
  // If user doesn't have excomm access, show access denied with create club option
  if (!isAuthenticated || getUserRole() !== 'excomm') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.accessDeniedContainer}>
          <Settings size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.accessDeniedTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Access Restricted</Text>
          <Text style={[styles.accessDeniedMessage, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            You need Executive Committee (ExComm) privileges to access the Admin Panel.
          </Text>
          <TouchableOpacity
            style={[styles.createClubButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/create-club')}
          >
            <Building2 size={20} color="#ffffff" />
            <Text style={styles.createClubButtonText} maxFontSizeMultiplier={1.3}>Create a Club</Text>
          </TouchableOpacity>
          <Text style={[styles.helpText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Or reach out to your ExComm to get invited
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin Panel</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.adminMasterBox, { backgroundColor: theme.colors.surface }]}>
          {/* Club Switcher - integrated into master box (premium design like Journey) */}
          <ClubSwitcher showRole={true} embedded />
          <View style={[styles.adminMasterDivider, { backgroundColor: theme.colors.border }]} />
          {(canSeeAdminFeature('meeting_operations') ||
            canSeeAdminFeature('user_management') ||
            canSeeAdminFeature('voting_operations') ||
            canSeeAdminFeature('excomm_corner')) && (
            <>
              <Text style={[styles.adminMasterSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Start Here
              </Text>
              <View style={styles.quickActionsGrid}>
                {canSeeAdminFeature('meeting_operations') && (
                  <QuickActionTile
                    label="Create meetings"
                    accentColor="#0a66c2"
                    icon={<CalendarPlus size={18} color="#ffffff" />}
                    onPress={() => router.push('/admin/meeting-management')}
                  />
                )}
                {canSeeAdminFeature('user_management') && (
                  <QuickActionTile
                    label="Invite users"
                    accentColor="#7c3aed"
                    icon={<UserPlus size={18} color="#ffffff" />}
                    onPress={() => router.push('/admin/invite-new-user')}
                  />
                )}
                {canSeeAdminFeature('voting_operations') && (
                  <QuickActionTile
                    label="Voting operations"
                    accentColor="#059669"
                    icon={<Vote size={18} color="#ffffff" />}
                    onPress={() => router.push('/admin/voting-operations')}
                  />
                )}
                {canSeeAdminFeature('meeting_operations') && (
                  <QuickActionTile
                    label="Meeting history"
                    accentColor="#f97316"
                    icon={<Archive size={18} color="#ffffff" />}
                    onPress={() => router.push('/meeting-records')}
                  />
                )}
                {canSeeAdminFeature('user_management') && (
                  <QuickActionTile
                    label="Manage existing users"
                    accentColor="#06b6d4"
                    icon={<Users size={18} color="#ffffff" />}
                    onPress={() => router.push('/admin/manage-club-users')}
                  />
                )}
                {canSeeAdminFeature('excomm_corner') && (
                  <QuickActionTile
                    label="Vpe corner"
                    accentColor="#db2777"
                    icon={<GraduationCap size={18} color="#ffffff" />}
                    onPress={() => router.push('/admin/excomm-corner/vpe')}
                  />
                )}
              </View>
            </>
          )}
          {canSeeAdminFeature('club_operations') && (
            <>
              {(canSeeAdminFeature('meeting_operations') ||
                canSeeAdminFeature('user_management') ||
                canSeeAdminFeature('voting_operations') ||
                canSeeAdminFeature('excomm_corner')) && (
                <View style={[styles.adminMasterDivider, { backgroundColor: theme.colors.border }]} />
              )}
              <Text style={[styles.adminMasterSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                Club Operations
              </Text>
              <View style={styles.clubOpsList}>
                {CLUB_OPERATIONS_SUB_PAGES.map(({ title, route, Icon, accentColor }, index) => (
                  <View key={route}>
                    {index > 0 && <View style={[styles.clubOpsRowDivider, { backgroundColor: theme.colors.border }]} />}
                    <TouchableOpacity
                      style={styles.clubOpsRow}
                      onPress={() => router.push(route)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.clubOpsRowIcon, { backgroundColor: accentColor + '20' }]}>
                        <Icon size={20} color={accentColor} />
                      </View>
                      <Text style={[styles.clubOpsRowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                        {title}
                      </Text>
                      <ChevronRight size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  adminMasterBox: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  adminMasterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  adminMasterDivider: {
    height: 1,
    marginVertical: 18,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  quickActionCard: {
    width: '31%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 102,
    justifyContent: 'center',
  },
  quickActionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionCardTitle: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
  clubOpsList: {
    marginTop: 4,
  },
  clubOpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  clubOpsRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubOpsRowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  clubOpsRowDivider: {
    height: 1,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createClubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  createClubButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
});
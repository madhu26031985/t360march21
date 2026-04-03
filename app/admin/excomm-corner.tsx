import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { EXCOMM_UI } from '@/lib/excommUiTokens';
import { ArrowLeft, Crown, User, Shield, Eye, UserCheck, Award, TrendingUp, Megaphone, DollarSign, UserCog, FileText } from 'lucide-react-native';

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
}

function RoleCard({ title, description, icon, color, onPress }: RoleCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.roleCard, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.roleIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.roleContent}>
        <Text style={[styles.roleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={[styles.roleDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>{description}</Text>
      </View>
      <ArrowLeft size={20} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
    </TouchableOpacity>
  );
}

export default function ExCommCorner() {
  const { theme } = useTheme();
  const { user } = useAuth();

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
      case 'excomm': return EXCOMM_UI.solidBg;
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>ExComm Corner</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Card */}
        <View style={[styles.welcomeCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.welcomeIcon, { backgroundColor: EXCOMM_UI.pillBg }]}>
            <Crown size={32} color={EXCOMM_UI.solidBg} />
          </View>
          <Text style={[styles.welcomeTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            ExComm Corner
          </Text>
          <Text style={[styles.welcomeDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Access role-specific resources, reports, and management tools for each Executive Committee position.
          </Text>
          {user?.clubRole && (
            <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.clubRole) }]}>
              {getRoleIcon(user.clubRole)}
              <Text style={styles.roleText} maxFontSizeMultiplier={1.3}>{formatRole(user.clubRole)}</Text>
            </View>
          )}
        </View>

        {/* Role-Specific Sections */}
        <View style={styles.rolesSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            ExComm Roles
          </Text>

          <RoleCard
            title="President Corner"
            description="Club leadership, strategy, and oversight"
            icon={<Crown size={24} color="#dc2626" />}
            color="#dc2626"
            onPress={() => router.push('/admin/excomm-corner/president')}
          />

          <RoleCard
            title="VPE Corner"
            description="Vice President Education - Programs and education"
            icon={<Award size={24} color="#ea580c" />}
            color="#ea580c"
            onPress={() => router.push('/admin/excomm-corner/vpe')}
          />

          <RoleCard
            title="VPM Corner"
            description="Vice President Membership - Growth and retention"
            icon={<TrendingUp size={24} color="#16a34a" />}
            color="#16a34a"
            onPress={() => router.push('/admin/excomm-corner/vpm')}
          />

          <RoleCard
            title="VPPR Corner"
            description="Vice President Public Relations - Marketing and outreach"
            icon={<Megaphone size={24} color="#2563eb" />}
            color="#2563eb"
            onPress={() => router.push('/admin/excomm-corner/vppr')}
          />

          <RoleCard
            title="Treasurer Corner"
            description="Financial management and reporting"
            icon={<DollarSign size={24} color="#059669" />}
            color="#059669"
            onPress={() => router.push('/admin/excomm-corner/treasurer')}
          />

          <RoleCard
            title="Secretary Corner"
            description="Records, minutes, and documentation"
            icon={<FileText size={24} color="#7c3aed" />}
            color="#7c3aed"
            onPress={() => router.push('/admin/excomm-corner/secretary')}
          />

          <RoleCard
            title="SAA Corner"
            description="Sergeant at Arms - Meeting logistics and setup"
            icon={<UserCog size={24} color="#0891b2" />}
            color="#0891b2"
            onPress={() => router.push('/admin/excomm-corner/saa')}
          />

        </View>

        <View style={styles.bottomSpacing} />
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
  welcomeCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 6,
  },
  rolesSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  roleContent: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 40,
  },
});

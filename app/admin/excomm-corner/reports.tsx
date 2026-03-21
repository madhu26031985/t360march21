import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Mic, MessageSquare, UserCheck, Clock, AlertCircle, BookOpen, Users, GraduationCap, Shield, UserCircle, HelpCircle, TrendingUp, Home, Calendar, Settings } from 'lucide-react-native';

type ReportCard = {
  id: string;
  title: string;
  description: string;
  icon: typeof Mic;
  color: string;
  route?: string;
};

export default function ClubReports() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;
  const [clubName, setClubName] = useState('');
  const [clubNumber, setClubNumber] = useState('');
  const [bannerColor, setBannerColor] = useState('#1e3a5f');

  useEffect(() => {
    if (!user?.currentClubId) return;
    (async () => {
      const { data } = await supabase
        .from('clubs')
        .select('name, club_number')
        .eq('id', user.currentClubId)
        .maybeSingle();
      if (data) {
        setClubName(data.name || '');
        setClubNumber(data.club_number || '');
      }
      const { data: profileData } = await supabase
        .from('club_profiles')
        .select('banner_color')
        .eq('club_id', user.currentClubId)
        .maybeSingle();
      if (profileData?.banner_color) setBannerColor(profileData.banner_color);
    })();
  }, [user?.currentClubId]);

  const reports: ReportCard[] = [
    {
      id: 'member',
      title: 'Member Report',
      description: 'Individual member progress and participation summary',
      icon: UserCircle,
      color: '#14b8a6',
      route: '/admin/excomm-corner/reports/member-report',
    },
    {
      id: 'role',
      title: 'Roles Report',
      description: 'Track roles performed by members across meetings',
      icon: Shield,
      color: '#8b5cf6',
      route: '/admin/excomm-corner/reports/role-report',
    },
    {
      id: 'tmod',
      title: 'TMOD Report',
      description: 'Toastmaster of the Day meeting reports and summaries',
      icon: Mic,
      color: '#6366f1',
      route: '/admin/excomm-corner/reports/tmod-report',
    },
    {
      id: 'prepared-speech',
      title: 'Prepared Speeches Report',
      description: 'Track all prepared speeches delivered in meetings',
      icon: MessageSquare,
      color: '#0ea5e9',
      route: '/admin/excomm-corner/reports/prepared-speech-report',
    },
    {
      id: 'grammarian',
      title: 'Grammarian Report',
      description: 'Language usage and grammar observations',
      icon: BookOpen,
      color: '#10b981',
      route: '/admin/excomm-corner/reports/grammarian-report',
    },
    {
      id: 'timer',
      title: 'Timer Report',
      description: 'Speech timing records and analytics',
      icon: Clock,
      color: '#f59e0b',
      route: '/admin/excomm-corner/reports/timer-report',
    },
    {
      id: 'educational-speaker',
      title: 'Educational Report',
      description: 'Educational sessions and speaker performance',
      icon: GraduationCap,
      color: '#f97316',
      route: '/admin/excomm-corner/reports/educational-speaker-report',
    },
    {
      id: 'general-evaluator',
      title: 'General Evaluator Report',
      description: 'Comprehensive evaluation reports and feedback',
      icon: UserCheck,
      color: '#ec4899',
      route: '/admin/excomm-corner/reports/ge-report',
    },
    {
      id: 'ah-counter',
      title: 'Ah Counter Report',
      description: 'Track filler words and speech patterns',
      icon: AlertCircle,
      color: '#ef4444',
      route: '/admin/excomm-corner/reports/ah-counter-report',
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Member attendance records and statistics',
      icon: Users,
      color: '#06b6d4',
      route: '/admin/excomm-corner/reports/attendance-report',
    },
    {
      id: 'table-topics-questioner',
      title: 'Table Topics Report',
      description: 'Questions asked, topics covered and participant responses',
      icon: HelpCircle,
      color: '#0ea5e9',
      route: '/admin/excomm-corner/reports/table-topics-questioner-report',
    },
    {
      id: 'pathways',
      title: 'Pathways Report',
      description: 'Member pathway progress, levels and speech completion',
      icon: TrendingUp,
      color: '#84cc16',
      route: '/admin/excomm-corner/vpe/pathway-reports',
    },
  ];

  const rows: ReportCard[][] = [];
  for (let i = 0; i < reports.length; i += 2) {
    rows.push(reports.slice(i, i + 2));
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club Reports</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroBanner, { backgroundColor: bannerColor }]}>
          <Text style={styles.heroClubName} maxFontSizeMultiplier={1.2}>{clubName}</Text>
          {clubNumber ? <Text style={styles.heroClubNumber} maxFontSizeMultiplier={1.2}>Club #{clubNumber}</Text> : null}
        </View>

        <View style={styles.reportsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Available Reports</Text>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((report) => {
                const IconComponent = report.icon;
                return (
                  <TouchableOpacity
                    key={report.id}
                    style={[
                      styles.reportCard,
                      { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, width: cardWidth },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (report.route) {
                        router.push(report.route as any);
                      }
                    }}
                  >
                    <View style={[styles.reportIconContainer, { backgroundColor: report.color }]}>
                      <IconComponent size={20} color="#ffffff" />
                    </View>
                    <Text style={[styles.reportTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      {report.title}
                    </Text>
                    {!report.route && (
                      <View style={[styles.comingSoonBadge, { backgroundColor: '#f59e0b' + '20' }]}>
                        <Text style={[styles.comingSoonText, { color: '#f59e0b' }]} maxFontSizeMultiplier={1.2}>
                          Coming Soon
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {row.length === 1 && <View style={{ width: cardWidth }} />}
            </View>
          ))}
        </View>

        <View style={styles.navSpacer} />

        {/* Navigation Icons */}
        <View style={[styles.navigationSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.navigationBar}>
            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)')}>
              <View style={[styles.navIcon, { backgroundColor: '#E8F4FD' }]}>
                <Home size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Journey</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/club')}>
              <View style={[styles.navIcon, { backgroundColor: '#FEF3E7' }]}>
                <Users size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Club</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/meetings')}>
              <View style={[styles.navIcon, { backgroundColor: '#E0F2FE' }]}>
                <Calendar size={16} color="#0ea5e9" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Meetings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/settings')}>
              <View style={[styles.navIcon, { backgroundColor: '#F3E8FF' }]}>
                <Settings size={16} color="#8b5cf6" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/admin')}>
              <View style={[styles.navIcon, { backgroundColor: '#FFE5E5' }]}>
                <Settings size={16} color="#dc2626" />
              </View>
              <Text style={[styles.navLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Admin</Text>
            </TouchableOpacity>
          </View>
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
  heroBanner: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroClubName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  heroClubNumber: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  reportsContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportCard: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  reportTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  colorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  bottomSpacing: {
    height: 40,
  },
  navSpacer: {
    minHeight: 8,
  },
  navigationSection: {
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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

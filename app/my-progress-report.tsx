import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, Mic, Users2, MessageSquare, FileText, Award, Clock, BookOpen, Volume2, Info, X, Home, Users, Settings } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue
} from 'react-native-reanimated';

type TimePeriod = '3months' | '6months' | '1year' | 'all';

interface SubItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  route?: string;
  count?: number;
  roles?: {
    id: string;
    title: string;
    count: number;
    route?: string;
  }[];
}

interface ProgressStats {
  meetingsAttended: number;
  rolesCompleted: number;
  speechesDelivered: number;
  evaluationsGiven: number;
  attendanceActivities: number;
  speakingActivities: number;
  leadershipActivities: number;
  evaluationActivities: number;
  reportActivities: number;
  timerReports: number;
  grammarianReports: number;
  ahCounterReports: number;
  tableTopicsDelivered: number;
  speechEvaluations: number;
  generalEvaluations: number;
  meetingsPresent: number;
  meetingsAbsent: number;
  keySpeakerRoles: number;
  clubSpeakerRoles: number;
  educationalSpeakerRoles: number;
  ancillarySpeakerRoles: number;
  tagRoles: number;
  evaluationsReceived: number;
}

export default function MyProgressReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('6months');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [roleDetails, setRoleDetails] = useState<Record<string, number>>({});
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [stats, setStats] = useState<ProgressStats>({
    meetingsAttended: 0,
    rolesCompleted: 0,
    speechesDelivered: 0,
    evaluationsGiven: 0,
    attendanceActivities: 0,
    speakingActivities: 0,
    leadershipActivities: 0,
    evaluationActivities: 0,
    reportActivities: 0,
    timerReports: 0,
    grammarianReports: 0,
    ahCounterReports: 0,
    tableTopicsDelivered: 0,
    speechEvaluations: 0,
    generalEvaluations: 0,
    meetingsPresent: 0,
    meetingsAbsent: 0,
    keySpeakerRoles: 0,
    clubSpeakerRoles: 0,
    educationalSpeakerRoles: 0,
    ancillarySpeakerRoles: 0,
    tagRoles: 0,
    evaluationsReceived: 0,
  });

  useEffect(() => {
    if (user?.id) {
      loadProgressStats();
    }
  }, [user, selectedPeriod]);

  const getDateFilter = () => {
    const now = new Date();
    let startDate = new Date();

    switch (selectedPeriod) {
      case '3months':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        return null;
    }

    return startDate.toISOString();
  };

  const getPeriodLabel = () => {
    switch (selectedPeriod) {
      case '3months':
        return 'Last 3 months';
      case '6months':
        return 'Last 6 months';
      case '1year':
        return 'Last 1 year';
      case 'all':
        return 'All time';
    }
  };

  const loadProgressStats = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const dateFilter = getDateFilter();

      let meetingsQuery = supabase
        .from('app_meeting_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('attendance_status', 'present');

      if (dateFilter) {
        meetingsQuery = meetingsQuery.gte('created_at', dateFilter);
      }

      let rolesQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true);

      if (dateFilter) {
        rolesQuery = rolesQuery.gte('created_at', dateFilter);
      }

      let speechesQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Prepared Speaker');

      if (dateFilter) {
        speechesQuery = speechesQuery.gte('created_at', dateFilter);
      }

      let evaluationsQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .in('role_classification', ['Speech evaluvator', 'Master evaluvator']);

      if (dateFilter) {
        evaluationsQuery = evaluationsQuery.gte('created_at', dateFilter);
      }

      let speakingQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .in('role_classification', ['Prepared Speaker', 'On-the-Spot Speaking']);

      if (dateFilter) {
        speakingQuery = speakingQuery.gte('created_at', dateFilter);
      }

      let leadershipQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .in('role_classification', ['Key Speakers', 'Club Speakers', 'Educational speaker', 'Ancillary Speaker', 'Tag roles']);

      if (dateFilter) {
        leadershipQuery = leadershipQuery.gte('created_at', dateFilter);
      }

      let evaluationActivityQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .in('role_classification', ['Speech evaluvator', 'Master evaluvator', 'TT _ Evaluvator']);

      if (dateFilter) {
        evaluationActivityQuery = evaluationActivityQuery.gte('created_at', dateFilter);
      }

      let timerQuery = supabase
        .from('timer_reports')
        .select('id', { count: 'exact', head: true })
        .eq('speaker_user_id', user.id);

      if (dateFilter) {
        timerQuery = timerQuery.gte('created_at', dateFilter);
      }

      let grammarianQuery = supabase
        .from('grammarian_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reported_by', user.id);

      if (dateFilter) {
        grammarianQuery = grammarianQuery.gte('created_at', dateFilter);
      }

      let ahCounterQuery = supabase
        .from('ah_counter_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reported_by', user.id);

      if (dateFilter) {
        ahCounterQuery = ahCounterQuery.gte('created_at', dateFilter);
      }

      let tableTopicsQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'On-the-Spot Speaking');

      if (dateFilter) {
        tableTopicsQuery = tableTopicsQuery.gte('created_at', dateFilter);
      }

      let speechEvaluationsQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Speech evaluvator');

      if (dateFilter) {
        speechEvaluationsQuery = speechEvaluationsQuery.gte('created_at', dateFilter);
      }

      let generalEvaluationsQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Master evaluvator');

      if (dateFilter) {
        generalEvaluationsQuery = generalEvaluationsQuery.gte('created_at', dateFilter);
      }

      let meetingsAbsentQuery = supabase
        .from('app_meeting_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('attendance_status', 'absent');

      if (dateFilter) {
        meetingsAbsentQuery = meetingsAbsentQuery.gte('created_at', dateFilter);
      }

      let keySpeakerQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Key Speakers');

      if (dateFilter) {
        keySpeakerQuery = keySpeakerQuery.gte('created_at', dateFilter);
      }

      let clubSpeakerQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Club Speakers');

      if (dateFilter) {
        clubSpeakerQuery = clubSpeakerQuery.gte('created_at', dateFilter);
      }

      let educationalSpeakerQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Educational speaker');

      if (dateFilter) {
        educationalSpeakerQuery = educationalSpeakerQuery.gte('created_at', dateFilter);
      }

      let ancillarySpeakerQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Ancillary Speaker');

      if (dateFilter) {
        ancillarySpeakerQuery = ancillarySpeakerQuery.gte('created_at', dateFilter);
      }

      let tagRolesQuery = supabase
        .from('app_meeting_roles_management')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true)
        .eq('role_classification', 'Tag roles');

      if (dateFilter) {
        tagRolesQuery = tagRolesQuery.gte('created_at', dateFilter);
      }

      let allRolesQuery = supabase
        .from('app_meeting_roles_management')
        .select('role_name, role_classification')
        .eq('assigned_user_id', user.id)
        .eq('is_completed', true);

      if (dateFilter) {
        allRolesQuery = allRolesQuery.gte('created_at', dateFilter);
      }

      const [
        meetingsResult,
        rolesResult,
        speechesResult,
        evaluationsResult,
        speakingResult,
        leadershipResult,
        evaluationActivityResult,
        timerResult,
        grammarianResult,
        ahCounterResult,
        tableTopicsResult,
        speechEvaluationsResult,
        generalEvaluationsResult,
        meetingsAbsentResult,
        keySpeakerResult,
        clubSpeakerResult,
        educationalSpeakerResult,
        ancillarySpeakerResult,
        tagRolesResult,
        allRolesResult,
      ] = await Promise.all([
        meetingsQuery,
        rolesQuery,
        speechesQuery,
        evaluationsQuery,
        speakingQuery,
        leadershipQuery,
        evaluationActivityQuery,
        timerQuery,
        grammarianQuery,
        ahCounterQuery,
        tableTopicsQuery,
        speechEvaluationsQuery,
        generalEvaluationsQuery,
        meetingsAbsentQuery,
        keySpeakerQuery,
        clubSpeakerQuery,
        educationalSpeakerQuery,
        ancillarySpeakerQuery,
        tagRolesQuery,
        allRolesQuery,
      ]);

      const roleCountsMap: Record<string, number> = {};
      if (allRolesResult.data) {
        allRolesResult.data.forEach((role) => {
          roleCountsMap[role.role_name] = (roleCountsMap[role.role_name] || 0) + 1;
        });
      }
      setRoleDetails(roleCountsMap);

      const reportActivities = (timerResult.count || 0) + (grammarianResult.count || 0) + (ahCounterResult.count || 0);
      const attendanceActivities = (meetingsResult.count || 0) + (meetingsAbsentResult.count || 0);

      setStats({
        meetingsAttended: meetingsResult.count || 0,
        rolesCompleted: rolesResult.count || 0,
        speechesDelivered: speechesResult.count || 0,
        evaluationsGiven: evaluationsResult.count || 0,
        attendanceActivities,
        speakingActivities: speakingResult.count || 0,
        leadershipActivities: leadershipResult.count || 0,
        evaluationActivities: evaluationActivityResult.count || 0,
        reportActivities,
        timerReports: timerResult.count || 0,
        grammarianReports: grammarianResult.count || 0,
        ahCounterReports: ahCounterResult.count || 0,
        tableTopicsDelivered: tableTopicsResult.count || 0,
        speechEvaluations: speechEvaluationsResult.count || 0,
        generalEvaluations: generalEvaluationsResult.count || 0,
        meetingsPresent: meetingsResult.count || 0,
        meetingsAbsent: meetingsAbsentResult.count || 0,
        keySpeakerRoles: keySpeakerResult.count || 0,
        clubSpeakerRoles: clubSpeakerResult.count || 0,
        educationalSpeakerRoles: educationalSpeakerResult.count || 0,
        ancillarySpeakerRoles: ancillarySpeakerResult.count || 0,
        tagRoles: tagRolesResult.count || 0,
        evaluationsReceived: 0,
      });
    } catch (error) {
      console.error('Error loading progress stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    {
      id: 'attendance',
      title: 'Attendance & Participation',
      count: stats.attendanceActivities,
      icon: <Calendar size={16} color="#10b981" />,
      color: '#10b981',
      route: '/attendance-details',
      subItems: [
        {
          id: 'meetings-present',
          title: 'Meetings Present',
          icon: <Calendar size={18} color="#10b981" />,
          route: '/attendance-details',
          count: stats.meetingsPresent,
        },
        {
          id: 'meetings-absent',
          title: 'Meetings Absent',
          icon: <Calendar size={18} color="#10b981" />,
          route: '/attendance-details',
          count: stats.meetingsAbsent,
        },
      ],
    },
    {
      id: 'speaking',
      title: 'Speaking Roles',
      count: stats.speakingActivities,
      icon: <Mic size={16} color="#f59e0b" />,
      color: '#f59e0b',
      route: '/speeches-delivered',
      subItems: [
        {
          id: 'speeches',
          title: 'Speeches Delivered',
          icon: <Mic size={18} color="#f59e0b" />,
          route: '/speeches-delivered',
          count: stats.speechesDelivered,
        },
        {
          id: 'table-topics',
          title: 'Table Topics Speeches',
          icon: <MessageSquare size={18} color="#f59e0b" />,
          route: '/table-topics-delivered',
          count: stats.tableTopicsDelivered,
        },
      ],
    },
    {
      id: 'leadership',
      title: 'Leadership & Meeting Roles',
      count: stats.leadershipActivities,
      icon: <Users2 size={16} color="#3b82f6" />,
      color: '#3b82f6',
      route: '/roles-completed',
      subItems: [
        {
          id: 'key-speaker',
          title: 'Key Speaker Roles',
          icon: <Users2 size={18} color="#3b82f6" />,
          count: stats.keySpeakerRoles,
          roles: [
            { id: 'toastmaster', title: 'Toastmaster of the Day', count: roleDetails['Toastmaster of the Day'] || 0, route: '/toastmaster-of-the-day-details' },
            { id: 'general-evaluator', title: 'General Evaluator', count: roleDetails['General Evaluator'] || 0 },
            { id: 'table-topics-master', title: 'Table Topics Master', count: roleDetails['Table Topics Master'] || 0, route: '/table-topics-master-details' },
          ],
        },
        {
          id: 'club-speaker',
          title: 'Club Speaker Roles',
          icon: <Users2 size={18} color="#3b82f6" />,
          count: stats.clubSpeakerRoles,
          roles: [
            { id: 'presiding-officer', title: 'Presiding Officer', count: roleDetails['Presiding Officer'] || 0 },
            { id: 'sergeant-at-arms', title: 'Sergeant at Arms', count: roleDetails['Sergeant at Arms'] || 0 },
          ],
        },
        {
          id: 'educational-speaker',
          title: 'Educational Speaker Roles',
          icon: <Users2 size={18} color="#3b82f6" />,
          count: stats.educationalSpeakerRoles,
          roles: [
            { id: 'educational-speaker', title: 'Educational Speaker', count: roleDetails['Educational Speaker'] || 0, route: '/educational-speaker-details' },
          ],
        },
        {
          id: 'ancillary-speaker',
          title: 'Ancillary Speaker Roles',
          icon: <Users2 size={18} color="#3b82f6" />,
          count: stats.ancillarySpeakerRoles,
          roles: [
            { id: 'quiz-master', title: 'Quiz Master', count: roleDetails['Quiz Master'] || 0 },
            { id: 'listener', title: 'Listener', count: roleDetails['Listener'] || 0 },
          ],
        },
        {
          id: 'tag-roles',
          title: 'Tag Roles',
          icon: <Users2 size={18} color="#3b82f6" />,
          count: stats.tagRoles,
          roles: [
            { id: 'timer', title: 'Timer', count: roleDetails['Timer'] || 0 },
            { id: 'ah-counter', title: 'Ah Counter', count: roleDetails['Ah Counter'] || 0 },
            { id: 'grammarian', title: 'Grammarian', count: roleDetails['Grammarian'] || 0 },
          ],
        },
      ],
    },
    {
      id: 'evaluation',
      title: 'Evaluation',
      count: stats.evaluationActivities,
      icon: <MessageSquare size={16} color="#8b5cf6" />,
      color: '#8b5cf6',
      route: '/evaluations-given',
      subItems: [
        {
          id: 'evaluations-given',
          title: 'Evaluations Given',
          icon: <MessageSquare size={18} color="#8b5cf6" />,
          route: '/evaluations-given',
          count: stats.evaluationsGiven,
        },
        {
          id: 'evaluations-received',
          title: 'Evaluations Received',
          icon: <Award size={18} color="#8b5cf6" />,
          route: '/evaluations-given',
          count: stats.evaluationsReceived,
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      count: stats.reportActivities,
      icon: <FileText size={16} color="#ef4444" />,
      color: '#ef4444',
      subItems: [
        {
          id: 'timer',
          title: 'Timer Reports',
          icon: <Clock size={18} color="#ef4444" />,
          route: '/my-timer-records',
          count: stats.timerReports,
        },
        {
          id: 'grammarian',
          title: 'Grammarian Reports',
          icon: <BookOpen size={18} color="#ef4444" />,
          route: '/my-grammarian-records',
          count: stats.grammarianReports,
        },
        {
          id: 'ah-counter',
          title: 'Ah Counter Reports',
          icon: <Volume2 size={18} color="#ef4444" />,
          route: '/my-ah-counter-records',
          count: stats.ahCounterReports,
        },
      ],
    },
  ];

  const maxActivityCount = Math.max(...categories.map(c => c.count), 1);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  const handleCategoryPress = (category: typeof categories[0]) => {
    if (category.subItems.length > 0) {
      toggleCategory(category.id);
    } else if (category.route) {
      router.push(category.route);
    }
  };

  const handleSubcategoryPress = (subItem: SubItem) => {
    if (subItem.roles && subItem.roles.length > 0) {
      toggleSubcategory(subItem.id);
    } else if (subItem.route) {
      router.push(subItem.route);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>My Progress Report</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading your progress...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.comingSoonContainer}>
              <Text style={[styles.comingSoonText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                🚀 Coming Soon!
              </Text>
              <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                A more powerful and personalized 📊 Progress Report is on its way — designed just for you!
              </Text>
              <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary, marginTop: 16 }]} maxFontSizeMultiplier={1.3}>
                For now, you can access your Club Level Reports under the Club tab. 📁✨
              </Text>
              <Text style={[styles.comingSoonSubtext, { color: theme.colors.textSecondary, marginTop: 16 }]} maxFontSizeMultiplier={1.3}>
                Stay tuned — something smarter, clearer, and more insightful is coming soon! 💡🔥
              </Text>
            </View>
          </>
        )}

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
                Your Toastmaster Journey
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
                🌟 Your Toastmaster Journey — A Story in Numbers
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Every meeting is a chapter in your growth story. This screen is your timeline, showing your roles, speeches, and evaluations 📈
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Use the tabs (3M, 6M, 1Y, All) to track your progress over time ⏳ Each number reflects a moment you showed up and improved.
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                You'll see your impact across:{'\n'}
                🎤 Speaking roles{'\n'}
                🧭 Leadership roles{'\n'}
                ✅ Attendance and participation
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                Not just a report — your journey in motion 💫
              </Text>

              <Text style={[styles.infoModalText, { color: theme.colors.text, marginBottom: 0 }]} maxFontSizeMultiplier={1.3}>
                ⚠️ Note: These are preliminary reports, not the full version. A more robust data view is planned for release by end of March 2026.
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
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  navSpacer: {
    flex: 1,
    minHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  periodFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    marginTop: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 6,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  periodButtonTextActive: {
    fontWeight: '600',
  },
  snapshotSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  snapshotTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  snapshotSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  snapshotGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  snapshotCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  snapshotIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  snapshotLabel: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 14,
  },
  snapshotValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  categoryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  categoryRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryRowContent: {
    flex: 1,
  },
  categoryRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  categoryRowMeta: {
    gap: 6,
  },
  categoryRowMetaText: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  categoryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  categoryRowCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  subItemsContainer: {
    paddingTop: 8,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingLeft: 68,
    borderTopWidth: 0.5,
  },
  subItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subItemContent: {
    flex: 1,
  },
  subItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  subItemCount: {
    fontSize: 12,
  },
  rolesContainer: {
    paddingLeft: 68,
    paddingRight: 16,
    paddingBottom: 8,
    gap: 6,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  roleCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  roleCountText: {
    fontSize: 12,
    fontWeight: '700',
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
  comingSoonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  comingSoonText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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

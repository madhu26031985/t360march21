import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft, Calendar, Building2, Hash, MoreVertical } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface AttendanceRecord {
  id: string;
  meeting_date: string;
  meeting_title: string;
  meeting_number: string | null;
  attendance_status: string;
  club_id: string;
}

interface ClubInfo {
  name: string;
}

interface AttendanceWithClub extends AttendanceRecord {
  club?: ClubInfo;
}

type TabType = 'present' | 'absent';

export default function AttendanceDetails() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('present');
  const [attendanceData, setAttendanceData] = useState<{
    present: AttendanceWithClub[];
    absent: AttendanceWithClub[];
  }>({
    present: [],
    absent: [],
  });

  useEffect(() => {
    if (user?.id) {
      loadAttendanceData();
    }
  }, [user]);

  const loadAttendanceData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get today's date at midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('app_meeting_attendance')
        .select(`
          id,
          meeting_date,
          meeting_title,
          meeting_number,
          attendance_status,
          club_id,
          clubs:club_id (
            name
          )
        `)
        .eq('user_id', user.id)
        .lte('meeting_date', todayString)
        .order('meeting_date', { ascending: false });

      if (error) throw error;

      const grouped = {
        present: data?.filter(r => r.attendance_status === 'present') || [],
        absent: data?.filter(r => r.attendance_status === 'absent') || [],
      };

      setAttendanceData(grouped);
    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTabData = () => {
    return attendanceData[activeTab];
  };

  const getTabColor = (tab: TabType) => {
    switch (tab) {
      case 'present':
        return '#10b981';
      case 'absent':
        return '#ef4444';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <Text style={{ fontSize: 28 }} maxFontSizeMultiplier={1.3}>✅</Text>;
      case 'absent':
        return <Text style={{ fontSize: 28 }} maxFontSizeMultiplier={1.3}>❌</Text>;
      default:
        return <Text style={{ fontSize: 28 }} maxFontSizeMultiplier={1.3}>✅</Text>;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present':
        return 'Present';
      case 'absent':
        return 'Absent';
      case 'not_applicable':
        return 'N/A';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return '#10b981';
      case 'absent':
        return '#ef4444';
      case 'not_applicable':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const renderAttendanceCard = (record: AttendanceWithClub) => {
    const clubName = Array.isArray(record.clubs) ? record.clubs[0]?.name : record.clubs?.name;

    return (
      <View
        key={record.id}
        style={[styles.card, { backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardHeader}>
            {getStatusIcon(record.attendance_status)}
            <Text style={[styles.cardDate, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {formatDate(record.meeting_date)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.attendance_status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(record.attendance_status) }]} maxFontSizeMultiplier={1.3}>
              {getStatusLabel(record.attendance_status)}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Building2 size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.cardLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Club</Text>
            <Text style={[styles.cardValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {clubName || 'N/A'}
            </Text>
          </View>

          <View style={styles.cardRow}>
            <Calendar size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.cardLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>Meeting</Text>
            <Text style={[styles.cardValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {record.meeting_number || record.meeting_title}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>Attendance Details</Text>
        <TouchableOpacity style={styles.backButton}>
          <MoreVertical size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'present' && [
              styles.tabActive,
              { backgroundColor: getTabColor('present') + '15' },
            ],
          ]}
          onPress={() => setActiveTab('present')}
        >
          <Text style={[
              styles.tabText,
              { color: activeTab === 'present' ? getTabColor('present') : theme.colors.textSecondary },
              activeTab === 'present' && styles.tabTextActive,
            ]} maxFontSizeMultiplier={1.3}>
            Present
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: activeTab === 'present' ? getTabColor('present') + '30' : getTabColor('present') + '15' },
            ]}
          >
            <Text style={[styles.badgeText, { color: activeTab === 'present' ? getTabColor('present') : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {attendanceData.present.length}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'absent' && [
              styles.tabActive,
              { backgroundColor: getTabColor('absent') + '15' },
            ],
          ]}
          onPress={() => setActiveTab('absent')}
        >
          <Text style={[
              styles.tabText,
              { color: activeTab === 'absent' ? getTabColor('absent') : theme.colors.textSecondary },
              activeTab === 'absent' && styles.tabTextActive,
            ]} maxFontSizeMultiplier={1.3}>
            Absent
          </Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: activeTab === 'absent' ? getTabColor('absent') + '30' : getTabColor('absent') + '15' },
            ]}
          >
            <Text style={[styles.badgeText, { color: activeTab === 'absent' ? getTabColor('absent') : theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              {attendanceData.absent.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading attendance records...
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {getTabData().length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.colors.surface }]}>
                <Calendar size={48} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  No Records Found
                </Text>
                <Text style={[styles.emptyStateDescription, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                  You don't have any {activeTab.replace('_', ' ')} attendance records
                </Text>
              </View>
            ) : (
              getTabData().map(renderAttendanceCard)
            )}
          </View>
        )}
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
    paddingBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
    borderRadius: 20,
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
  listContainer: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardDate: {
    fontSize: 17,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardContent: {
    gap: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '400',
    width: 90,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '400',
    flex: 1,
  },
  emptyState: {
    marginTop: 24,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});

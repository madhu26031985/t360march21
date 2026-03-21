import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, User, Calendar } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

type MemberEntry = {
  member_name: string;
  count: number;
  meetings: string[];
};

export default function RoleReportMembers() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ roleName: string; range: string }>();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberEntry[]>([]);

  const roleName = params.roleName || '';
  const range = (params.range || '0-3') as '0-3' | '4-6';

  useEffect(() => {
    loadMembers();
  }, []);

  const getRoleNameVariants = (name: string): string[] => {
    if (name === 'Prepared Speaker') {
      return ['Prepared Speaker 1', 'Prepared Speaker 2', 'Prepared Speaker 3', 'Prepared Speaker 4', 'Prepared Speaker 5',
              'Ice Breaker 1', 'Ice Breaker 2', 'Ice Breaker 3', 'Ice Breaker 4', 'Ice Breaker 5'];
    }
    if (name === 'Evaluator') {
      return ['Evaluator 1', 'Evaluator 2', 'Evaluator 3', 'Evaluator 4', 'Evaluator 5'];
    }
    if (name === 'Table Topics Speaker') {
      return ['Table Topics Speaker 1', 'Table Topics Speaker 2', 'Table Topics Speaker 3',
              'Table Topics Speaker 4', 'Table Topics Speaker 5', 'Table Topics Speaker 6',
              'Table Topics Speaker 7', 'Table Topics Speaker 8', 'Table Topics Speaker 9',
              'Table Topics Speaker 10', 'Table Topics Speaker 11', 'Table Topics Speaker 12'];
    }
    return [name];
  };

  const loadMembers = async () => {
    if (!user?.currentClubId) return;

    try {
      setLoading(true);

      const today = new Date();
      const startDate = new Date();
      const endDate = new Date();

      if (range === '0-3') {
        startDate.setMonth(today.getMonth() - 3);
      } else {
        startDate.setMonth(today.getMonth() - 6);
        endDate.setMonth(today.getMonth() - 3);
        endDate.setDate(endDate.getDate() - 1);
      }

      const roleVariants = getRoleNameVariants(roleName);

      const { data, error } = await supabase
        .from('app_meeting_roles_management')
        .select(`
          role_name,
          app_user_profiles ( full_name ),
          meeting:app_club_meeting!inner ( meeting_number, meeting_date, club_id )
        `)
        .eq('meeting.club_id', user.currentClubId)
        .in('role_name', roleVariants)
        .gte('meeting.meeting_date', toLocalDateStr(startDate))
        .lte('meeting.meeting_date', toLocalDateStr(endDate))
        .not('assigned_user_id', 'is', null)
        .order('meeting.meeting_date', { ascending: false });

      if (error) {
        console.error('Error loading members:', error);
        setLoading(false);
        return;
      }

      const memberMap: { [name: string]: { count: number; meetings: string[] } } = {};

      (data || []).forEach((record: any) => {
        const name = record.app_user_profiles?.full_name || 'Unknown';
        const meetingNum = record.meeting?.meeting_number
          ? `#${record.meeting.meeting_number}`
          : record.meeting?.meeting_date
            ? new Date(record.meeting.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';

        if (!memberMap[name]) {
          memberMap[name] = { count: 0, meetings: [] };
        }
        memberMap[name].count += 1;
        if (meetingNum && !memberMap[name].meetings.includes(meetingNum)) {
          memberMap[name].meetings.push(meetingNum);
        }
      });

      const sorted: MemberEntry[] = Object.entries(memberMap)
        .map(([member_name, { count, meetings }]) => ({ member_name, count, meetings }))
        .sort((a, b) => b.count - a.count);

      setMembers(sorted);
      setLoading(false);
    } catch (error) {
      console.error('Error loading members:', error);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {roleName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
            Role
          </Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            {roleName}
          </Text>
          <View style={[styles.rangeBadge, { backgroundColor: '#3b82f6' + '15' }]}>
            <Text style={[styles.rangeText, { color: '#3b82f6' }]} maxFontSizeMultiplier={1.3}>
              {range === '0-3' ? 'Last 3 months' : '3–6 months ago'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              Loading members...
            </Text>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
              No members found for this role
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
              {members.length} member{members.length !== 1 ? 's' : ''} · {members.reduce((s, m) => s + m.count, 0)} total
            </Text>

            {members.map((member, index) => (
              <View
                key={`${member.member_name}-${index}`}
                style={[styles.memberCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: '#3b82f6' + '20' }]}>
                  <User size={20} color="#3b82f6" />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                    {member.member_name}
                  </Text>
                  {member.meetings.length > 0 && (
                    <View style={styles.meetingsList}>
                      <Calendar size={12} color={theme.colors.textSecondary} />
                      <Text style={[styles.meetingsText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
                        {member.meetings.slice(0, 6).join(', ')}{member.meetings.length > 6 ? ` +${member.meetings.length - 6}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.countBadge, { backgroundColor: '#8b5cf6' + '20' }]}>
                  <Text style={[styles.countText, { color: '#8b5cf6' }]} maxFontSizeMultiplier={1.3}>
                    {member.count}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  rangeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  listContainer: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.7,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  meetingsList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meetingsText: {
    fontSize: 12,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 44,
    alignItems: 'center',
  },
  countText: {
    fontSize: 15,
    fontWeight: '700',
  },
  bottomSpacing: {
    height: 40,
  },
});

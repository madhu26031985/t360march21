import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Smartphone, Monitor, ChevronDown, ChevronUp, Users, Clock } from 'lucide-react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type VersionRecord = {
  user_id: string;
  app_version: string;
  platform: string;
  build_number: string | null;
  last_seen_at: string;
  first_seen_at: string;
  full_name: string;
  email: string;
};

type VersionGroup = {
  version: string;
  platform: string;
  count: number;
  users: VersionRecord[];
};

const platformLabel = (p: string) => {
  if (p === 'ios') return 'iOS';
  if (p === 'android') return 'Android';
  if (p === 'web') return 'Web';
  return p;
};

const platformColor = (p: string) => {
  if (p === 'ios') return '#007AFF';
  if (p === 'android') return '#3DDC84';
  if (p === 'web') return '#0ea5e9';
  return '#888';
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const daysSince = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

export default function AppVersionReport() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [records, setRecords] = useState<VersionRecord[]>([]);
  const [groups, setGroups] = useState<VersionGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const { data, error: err } = await supabase
        .from('user_app_versions')
        .select(`
          user_id,
          app_version,
          platform,
          build_number,
          last_seen_at,
          first_seen_at
        `)
        .order('last_seen_at', { ascending: false });

      if (err) throw err;

      if (!data || data.length === 0) {
        setRecords([]);
        setGroups([]);
        return;
      }

      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('app_user_profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap: Record<string, { full_name: string; email: string }> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = { full_name: p.full_name, email: p.email };
      });

      const enriched: VersionRecord[] = data.map((r: any) => ({
        ...r,
        full_name: profileMap[r.user_id]?.full_name ?? 'Unknown',
        email: profileMap[r.user_id]?.email ?? '',
      }));

      setRecords(enriched);

      const groupMap: Record<string, VersionGroup> = {};
      enriched.forEach((r) => {
        const key = `${r.platform}__${r.app_version}`;
        if (!groupMap[key]) {
          groupMap[key] = { version: r.app_version, platform: r.platform, count: 0, users: [] };
        }
        groupMap[key].count++;
        groupMap[key].users.push(r);
      });

      const sorted = Object.values(groupMap).sort((a, b) => {
        if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
        return b.version.localeCompare(a.version, undefined, { numeric: true });
      });

      setGroups(sorted);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const platforms = ['all', ...Array.from(new Set(groups.map(g => g.platform)))];

  const filteredGroups = selectedPlatform === 'all'
    ? groups
    : groups.filter(g => g.platform === selectedPlatform);

  const totalUsers = new Set(records.filter(r => selectedPlatform === 'all' || r.platform === selectedPlatform).map(r => r.user_id)).size;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          App Version Report
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
          <TouchableOpacity onPress={loadData} style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {/* Summary card */}
          <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Users size={18} color={theme.colors.primary} />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{totalUsers}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Users tracked</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.summaryItem}>
                <Smartphone size={18} color={theme.colors.primary} />
                <Text style={[styles.summaryValue, { color: theme.colors.text }]}>{filteredGroups.length}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Version groups</Text>
              </View>
            </View>
          </View>

          {/* Platform filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
            {platforms.map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selectedPlatform === p ? theme.colors.primary : theme.colors.surface,
                    borderColor: selectedPlatform === p ? theme.colors.primary : theme.colors.border,
                  },
                ]}
                onPress={() => setSelectedPlatform(p)}
              >
                <Text style={[styles.filterChipText, { color: selectedPlatform === p ? '#fff' : theme.colors.text }]}>
                  {p === 'all' ? 'All Platforms' : platformLabel(p)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredGroups.length === 0 ? (
            <View style={styles.emptyState}>
              <Monitor size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No version data recorded yet.</Text>
              <Text style={[styles.emptySubText, { color: theme.colors.textSecondary }]}>Data is captured when users log in.</Text>
            </View>
          ) : (
            <View style={styles.groupsContainer}>
              {filteredGroups.map((group) => {
                const key = `${group.platform}__${group.version}`;
                const isExpanded = expandedGroups[key] ?? false;
                const pColor = platformColor(group.platform);
                return (
                  <View key={key} style={[styles.groupCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                    <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(key)}>
                      <View style={[styles.platformBadge, { backgroundColor: pColor + '20', borderColor: pColor + '40' }]}>
                        <Text style={[styles.platformBadgeText, { color: pColor }]}>{platformLabel(group.platform)}</Text>
                      </View>
                      <View style={styles.groupTitleArea}>
                        <Text style={[styles.groupVersion, { color: theme.colors.text }]}>v{group.version}</Text>
                        <Text style={[styles.groupCount, { color: theme.colors.textSecondary }]}>
                          {group.count} {group.count === 1 ? 'user' : 'users'}
                        </Text>
                      </View>
                      {isExpanded
                        ? <ChevronUp size={18} color={theme.colors.textSecondary} />
                        : <ChevronDown size={18} color={theme.colors.textSecondary} />}
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[styles.userList, { borderTopColor: theme.colors.border }]}>
                        {group.users.map((u, idx) => (
                          <View
                            key={u.user_id}
                            style={[
                              styles.userRow,
                              idx < group.users.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.colors.border },
                            ]}
                          >
                            <View style={styles.userInfo}>
                              <Text style={[styles.userName, { color: theme.colors.text }]} numberOfLines={1}>{u.full_name}</Text>
                              <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]} numberOfLines={1}>{u.email}</Text>
                            </View>
                            <View style={styles.userMeta}>
                              <View style={styles.userMetaRow}>
                                <Clock size={11} color={theme.colors.textSecondary} />
                                <Text style={[styles.userMetaText, { color: theme.colors.textSecondary }]}>
                                  {daysSince(u.last_seen_at)}
                                </Text>
                              </View>
                              {u.build_number ? (
                                <Text style={[styles.buildNumber, { color: theme.colors.textSecondary }]}>
                                  Build {u.build_number}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: { padding: 4, width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  scroll: { flex: 1 },
  summaryCard: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryDivider: { width: 1, height: 40, marginHorizontal: 8 },
  summaryValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  summaryLabel: { fontSize: 12 },
  filterRow: { marginBottom: 8 },
  filterContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  emptySubText: { fontSize: 13 },
  groupsContainer: { paddingHorizontal: 16, gap: 10 },
  groupCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  platformBadgeText: { fontSize: 12, fontWeight: '600' },
  groupTitleArea: { flex: 1 },
  groupVersion: { fontSize: 15, fontWeight: '700' },
  groupCount: { fontSize: 12, marginTop: 1 },
  userList: { borderTopWidth: 0.5 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontWeight: '500' },
  userEmail: { fontSize: 12, marginTop: 1 },
  userMeta: { alignItems: 'flex-end', gap: 2 },
  userMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  userMetaText: { fontSize: 11 },
  buildNumber: { fontSize: 10 },
});

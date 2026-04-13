import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

type AttendanceStatus = 'present' | 'absent' | 'not_applicable';

type AttendanceRow = {
  meeting_date: string | null;
  attendance_status: AttendanceStatus | null;
};

type MonthStat = {
  key: string;
  label: string;
  present: number;
  absent: number;
  na: number;
  total: number;
  applicableTotal: number;
  attendanceRate: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000;
let attendanceCache: { key: string; at: number; rows: AttendanceRow[] } | null = null;

export async function prefetchMyAttendancePanel(userId?: string | null, clubId?: string | null) {
  if (!userId || !clubId) return;
  const cacheKey = `${clubId}:${userId}`;
  const isFresh =
    attendanceCache && attendanceCache.key === cacheKey && Date.now() - attendanceCache.at < CACHE_TTL_MS;
  if (isFresh) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('app_meeting_attendance')
      .select('meeting_date, attendance_status')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .lte('meeting_date', today)
      .order('meeting_date', { ascending: false });
    if (error) return;
    attendanceCache = { key: cacheKey, at: Date.now(), rows: (data || []) as AttendanceRow[] };
  } catch {
    // best-effort warmup only
  }
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function MyAttendancePanel() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);

  const load = useCallback(async () => {
    if (!user?.id || !user?.currentClubId) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    const cacheKey = `${user.currentClubId}:${user.id}`;
    const isFresh =
      attendanceCache && attendanceCache.key === cacheKey && Date.now() - attendanceCache.at < CACHE_TTL_MS;
    if (isFresh && attendanceCache) {
      setRows(attendanceCache.rows);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error: fetchError } = await supabase
        .from('app_meeting_attendance')
        .select('meeting_date, attendance_status')
        .eq('user_id', user.id)
        .eq('club_id', user.currentClubId)
        .lte('meeting_date', today)
        .order('meeting_date', { ascending: false });

      if (fetchError) throw fetchError;
      const nextRows = (data || []) as AttendanceRow[];
      attendanceCache = { key: cacheKey, at: Date.now(), rows: nextRows };
      setRows(nextRows);
    } catch (e) {
      console.error('MyAttendancePanel load failed:', e);
      setRows([]);
      setError('Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.currentClubId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const monthlyStats = useMemo<MonthStat[]>(() => {
    const grouped = new Map<string, MonthStat>();

    for (const r of rows) {
      if (!r.meeting_date) continue;
      const key = monthKey(r.meeting_date);
      const existing =
        grouped.get(key) ??
        ({
          key,
          label: monthLabel(key),
          present: 0,
          absent: 0,
          na: 0,
          total: 0,
          applicableTotal: 0,
          attendanceRate: 0,
        } as MonthStat);

      existing.total += 1;
      if (r.attendance_status === 'present') existing.present += 1;
      else if (r.attendance_status === 'absent') existing.absent += 1;
      else existing.na += 1;

      grouped.set(key, existing);
    }

    return [...grouped.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((s) => ({
        ...s,
        applicableTotal: s.present + s.absent,
        attendanceRate: s.present + s.absent > 0 ? Math.round((s.present / (s.present + s.absent)) * 100) : 0,
      }));
  }, [rows]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Loading attendance...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.helperText, { color: theme.colors.text }]}>{error}</Text>
      </View>
    );
  }

  if (monthlyStats.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>
          No attendance records yet.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {monthlyStats.map((m) => (
        <View
          key={m.key}
          style={[styles.monthCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={styles.monthHeader}>
            <Text style={[styles.monthTitle, { color: theme.colors.text }]}>{m.label}</Text>
            <Text style={[styles.ratePill, { color: '#166534', backgroundColor: '#DCFCE7' }]}>
              {m.attendanceRate}% attended
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: '#E5E7EB' }]}>
            <View style={[styles.progressFill, { width: `${m.attendanceRate}%`, backgroundColor: '#2563EB' }]} />
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>Present: {m.present}</Text>
            <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>Absent: {m.absent}</Text>
          </View>
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  helperText: {
    marginTop: 10,
    fontSize: 14,
  },
  monthCard: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ratePill: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 0,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

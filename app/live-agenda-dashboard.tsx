import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, LayoutPanelLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { initialsFromName, useShouldLoadNetworkAvatars } from '@/lib/networkAvatarPolicy';

type DashboardRoleRow = {
  id: string;
  role_name: string;
  assigned_user_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.10)',
  text: '#37352F',
  textSecondary: '#787774',
  iconTile: '#E8E7E4',
} as const;

export default function LiveAgendaDashboardScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ meetingId?: string | string[] }>();
  const meetingId = useMemo(() => {
    const raw = params.meetingId;
    if (typeof raw === 'string') return raw.trim();
    if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
    return '';
  }, [params.meetingId]);

  const loadAvatars = useShouldLoadNetworkAvatars();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DashboardRoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId) {
      setError('Missing meeting.');
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: roleRows, error: rolesErr } = await supabase
        .from('app_meeting_roles_management')
        .select('id, role_name, assigned_user_id')
        .eq('meeting_id', meetingId)
        .eq('booking_status', 'booked');

      if (rolesErr) {
        setError(rolesErr.message || 'Could not load roles.');
        setRows([]);
        return;
      }

      const list = (roleRows || []) as { id: string; role_name: string | null; assigned_user_id: string | null }[];
      const ids = [...new Set(list.map((r) => r.assigned_user_id).filter(Boolean))] as string[];

      const profileById = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      if (ids.length > 0) {
        const { data: profiles, error: pErr } = await supabase
          .from('app_user_profiles')
          .select('id, full_name, avatar_url')
          .in('id', ids);
        if (!pErr && profiles) {
          for (const p of profiles as { id: string; full_name: string | null; avatar_url: string | null }[]) {
            profileById.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
          }
        }
      }

      const merged: DashboardRoleRow[] = list
        .map((r) => {
          const uid = r.assigned_user_id;
          const prof = uid ? profileById.get(uid) : undefined;
          return {
            id: r.id,
            role_name: (r.role_name || 'Role').trim() || 'Role',
            assigned_user_id: uid,
            full_name: prof?.full_name?.trim() || null,
            avatar_url: prof?.avatar_url?.trim() || null,
          };
        })
        .sort((a, b) => a.role_name.localeCompare(b.role_name, undefined, { sensitivity: 'base' }));

      setRows(merged);
      setSelectedId((prev) => {
        if (prev && merged.some((m) => m.id === prev)) return prev;
        return merged[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const isWide = width >= 720;

  const assigneeDisplayName =
    selected?.full_name?.trim() ||
    (selected?.assigned_user_id ? 'Assigned member' : null);
  const showAvatarImage = Boolean(loadAvatars && selected?.avatar_url);
  const initialsSource = selected?.full_name?.trim() || selected?.role_name;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: N.page }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: N.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12} accessibilityRole="button">
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.25}>
            Live dashboard
          </Text>
          <Text style={styles.headerSubtitle} maxFontSizeMultiplier={1.2}>
            Toastmaster agenda — roles and assignees
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.colors.text }]}>{error}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No booked roles for this meeting.</Text>
        </View>
      ) : (
        <View style={[styles.body, isWide ? styles.bodyRow : styles.bodyColumn]}>
          <View style={[styles.leftCol, isWide ? styles.leftColWide : styles.leftColNarrow]}>
            <Text style={[styles.leftHeading, { color: theme.colors.textSecondary }]}>Roles</Text>
            <ScrollView
              style={styles.leftScroll}
              contentContainerStyle={styles.leftScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {rows.map((r) => {
                const active = r.id === selectedId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setSelectedId(r.id)}
                    style={[
                      styles.roleRow,
                      { borderColor: active ? theme.colors.primary : N.border, backgroundColor: active ? theme.colors.surface : N.surface },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.roleRowText, { color: theme.colors.text }]} numberOfLines={3} maxFontSizeMultiplier={1.15}>
                      {r.role_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View
            style={[styles.centerPanel, { borderColor: N.border, backgroundColor: N.surface }]}
            accessibilityRole="summary"
            accessibilityLabel="Assignee for selected role"
          >
            {selected ? (
              <>
                <Text style={[styles.centerHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                  {selected.role_name}
                </Text>
                <View style={styles.centerAvatarBlock}>
                  {showAvatarImage ? (
                    <Image
                      source={{ uri: selected.avatar_url! }}
                      style={styles.avatarImg}
                      accessibilityLabel={assigneeDisplayName || 'Assignee'}
                    />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: N.iconTile }]}>
                      <Text style={[styles.avatarFallbackText, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                        {initialsFromName(initialsSource)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.centerName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {assigneeDisplayName || 'Yet to be assigned'}
                </Text>
                <Text style={[styles.centerCaption, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.05}>
                  {selected.assigned_user_id ? 'Assigned to this role' : 'No one booked for this role yet'}
                </Text>
              </>
            ) : (
              <View style={styles.centerEmptyInner}>
                <LayoutPanelLeft size={40} color={N.textSecondary} />
                <Text style={[styles.centerEmptyTitle, { color: theme.colors.text }]}>Select a role</Text>
                <Text style={[styles.centerCaption, { color: theme.colors.textSecondary, textAlign: 'center' }]}>
                  Tap a role on the left to see who is doing it.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: N.text },
  headerSubtitle: { fontSize: 13, color: N.textSecondary, marginTop: 2 },
  body: { flex: 1, minHeight: 0, padding: 12 },
  bodyRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  bodyColumn: { flexDirection: 'column', gap: 12 },
  leftCol: { flexShrink: 0 },
  leftColWide: { width: 200, alignSelf: 'stretch', minHeight: 0 },
  leftColNarrow: { maxHeight: 220 },
  leftHeading: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  leftScroll: { flex: 1, minHeight: 0 },
  leftScrollContent: { paddingBottom: 16, gap: 8 },
  roleRow: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  roleRowText: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  centerPanel: {
    flex: 1,
    minHeight: 240,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerHint: { fontSize: 13, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  centerAvatarBlock: { marginBottom: 12 },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 32, fontWeight: '700' },
  centerName: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  centerCaption: { fontSize: 13, marginTop: 8, textAlign: 'center', maxWidth: 280 },
  centerEmptyInner: { alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  centerEmptyTitle: { fontSize: 17, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});

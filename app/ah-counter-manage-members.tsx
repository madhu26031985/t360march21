import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Check, Search, Users } from 'lucide-react-native';
import { Image } from 'react-native';

interface ClubMemberRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export default function AhCounterManageMembersScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<ClubMemberRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.full_name.toLowerCase().includes(q));
  }, [members, searchQuery]);

  const load = useCallback(async () => {
    if (!meetingId || !user?.currentClubId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: relData, error: relErr }, { data: tracked, error: trErr }] = await Promise.all([
        supabase
          .from('app_club_user_relationship')
          .select(
            `
          app_user_profiles (
            id,
            full_name,
            avatar_url
          )
        `
          )
          .eq('club_id', user.currentClubId)
          .eq('is_authenticated', true),
        supabase.from('ah_counter_tracked_members').select('user_id').eq('meeting_id', meetingId),
      ]);

      if (relErr) {
        console.error('load members', relErr);
        Alert.alert('Error', 'Could not load club members.');
        return;
      }
      if (trErr) {
        console.error('load tracked', trErr);
      }

      const rows: ClubMemberRow[] = (relData || [])
        .map((item: any) => {
          const p = item.app_user_profiles;
          if (!p?.id) return null;
          return {
            id: p.id,
            full_name: p.full_name || 'Member',
            avatar_url: p.avatar_url,
          };
        })
        .filter((m): m is ClubMemberRow => m !== null);
      rows.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setMembers(rows);

      const initial = new Set<string>();
      for (const t of tracked || []) {
        if ((t as any).user_id) initial.add((t as any).user_id);
      }
      setSelected(initial);
    } finally {
      setLoading(false);
    }
  }, [meetingId, user?.currentClubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelected(new Set(members.map((m) => m.id)));
  };

  const handleUnselectAll = () => {
    setSelected(new Set());
  };

  const handleSave = async () => {
    if (!meetingId || !user?.currentClubId || !user?.id) return;
    setSaving(true);
    try {
      const { error: delErr } = await supabase.from('ah_counter_tracked_members').delete().eq('meeting_id', meetingId);
      if (delErr) {
        console.error('delete tracked', delErr);
        Alert.alert('Error', 'Could not update selection. Check you are the Ah Counter or VPE.');
        return;
      }

      const ids = Array.from(selected);
      if (ids.length > 0) {
        const inserts = ids.map((userId) => ({
          meeting_id: meetingId,
          club_id: user.currentClubId,
          user_id: userId,
          created_by: user.id,
        }));
        const { error: insErr } = await supabase.from('ah_counter_tracked_members').insert(inserts);
        if (insErr) {
          console.error('insert tracked', insErr);
          Alert.alert('Error', 'Could not save member selection.');
          return;
        }
      }

      Alert.alert('Saved', ids.length === 0 ? 'No members are tracked for this meeting.' : `${ids.length} member(s) will appear on Ah Counter Corner.`);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!meetingId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Missing meeting.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]} maxFontSizeMultiplier={1.25}>
          Manage members
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
        Select who appears below Filler Words on Ah Counter Corner. Tap Save when done.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.searchWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Search size={18} color={theme.colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search by name"
              placeholderTextColor={theme.colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              maxFontSizeMultiplier={1.2}
            />
          </View>

          {members.length > 0 ? (
            <View style={styles.bulkRow}>
              <TouchableOpacity onPress={handleSelectAll} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={[styles.bulkLink, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.15}>
                  Select all
                </Text>
              </TouchableOpacity>
              <Text style={[styles.bulkSep, { color: theme.colors.textSecondary }]}>|</Text>
              <TouchableOpacity onPress={handleUnselectAll} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={[styles.bulkLink, { color: theme.colors.primary }]} maxFontSizeMultiplier={1.15}>
                  Unselect all
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {filteredMembers.length === 0 ? (
            <Text style={[styles.emptySearch, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
              {searchQuery.trim() ? 'No members match your search.' : 'No members to show.'}
            </Text>
          ) : null}

          {filteredMembers.map((m) => {
            const on = selected.has(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => toggle(m.id)}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '30' }]}>
                    {m.avatar_url ? (
                      <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Users size={20} color={theme.colors.primary} />
                    )}
                  </View>
                  <Text style={[styles.name, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                    {m.full_name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: on ? theme.colors.primary : theme.colors.border,
                      backgroundColor: on ? theme.colors.primary : 'transparent',
                    },
                  ]}
                >
                  {on ? <Check size={16} color="#ffffff" strokeWidth={3} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.colors.primary, opacity: saving ? 0.85 : 1 }]}
          onPress={() => void handleSave()}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  subtitle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
    minHeight: 22,
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  bulkLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  bulkSep: {
    fontSize: 14,
  },
  emptySearch: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  name: { fontSize: 15, fontWeight: '600', flex: 1 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});

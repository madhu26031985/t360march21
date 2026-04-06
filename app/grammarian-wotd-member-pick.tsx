import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Search, User, X } from 'lucide-react-native';
import {
  VISITING_GUEST_SLOT_COUNT,
  parseMeetingVisitingGuests,
  type MeetingVisitingGuest,
} from '@/lib/meetingVisitingGuests';
import { formatTimerGuestDisplayName } from '@/lib/timerGuestDisplayName';

type TabKey = 'guest' | 'member';

interface ClubMemberRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

function normManualName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function GrammarianWotdMemberPickScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const wordOfTheDayId =
    typeof params.wordOfTheDayId === 'string' ? params.wordOfTheDayId : params.wordOfTheDayId?.[0];

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [wordLabel, setWordLabel] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('guest');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubMembers, setClubMembers] = useState<ClubMemberRow[]>([]);
  const [visitingGuests, setVisitingGuests] = useState<MeetingVisitingGuest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
  const [existingVisitingGuestIds, setExistingVisitingGuestIds] = useState<Set<string>>(new Set());
  const [existingManualNorms, setExistingManualNorms] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!meetingId || !wordOfTheDayId || !user?.id || !user?.currentClubId) {
      setLoadError('Missing meeting or word of the day.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data: wordRow, error: wErr } = await supabase
        .from('grammarian_word_of_the_day')
        .select('id, meeting_id, club_id, word')
        .eq('id', wordOfTheDayId)
        .maybeSingle();

      if (wErr || !wordRow || wordRow.meeting_id !== meetingId || wordRow.club_id !== user.currentClubId) {
        setLoadError('This word of the day was not found for this meeting.');
        setLoading(false);
        return;
      }
      setWordLabel((wordRow.word || '').trim() || 'Word of the Day');

      const [{ data: vpeRow }, { data: grammarianRole }] = await Promise.all([
        supabase.from('club_profiles').select('vpe_id').eq('club_id', user.currentClubId).maybeSingle(),
        supabase
          .from('app_meeting_roles_management')
          .select('assigned_user_id')
          .eq('meeting_id', meetingId)
          .ilike('role_name', '%grammarian%')
          .eq('booking_status', 'booked')
          .maybeSingle(),
      ]);

      const isVpe = vpeRow?.vpe_id === user.id;
      const isGrammarian = grammarianRole?.assigned_user_id === user.id;
      setCanEdit(isVpe || isGrammarian);

      const { data: usageRows } = await supabase
        .from('grammarian_word_of_the_day_member_usage')
        .select('member_user_id, member_name_manual, visiting_guest_id')
        .eq('word_of_the_day_id', wordOfTheDayId);

      const mids = new Set<string>();
      const vgIds = new Set<string>();
      const manuals = new Set<string>();
      for (const r of usageRows || []) {
        const row = r as {
          member_user_id: string | null;
          member_name_manual: string | null;
          visiting_guest_id: string | null;
        };
        if (row.member_user_id) mids.add(row.member_user_id);
        if (row.visiting_guest_id) vgIds.add(row.visiting_guest_id);
        if (row.member_name_manual?.trim()) manuals.add(normManualName(row.member_name_manual));
      }
      setExistingMemberIds(mids);
      setExistingVisitingGuestIds(vgIds);
      setExistingManualNorms(manuals);

      const [{ data: rpcData, error: rpcError }, { data: vgData, error: vgErr }] = await Promise.all([
        supabase.rpc('get_club_member_directory', { target_club_id: user.currentClubId }),
        supabase
          .from('app_meeting_visiting_guests')
          .select('id, meeting_id, club_id, slot_number, display_name, created_at, updated_at')
          .eq('meeting_id', meetingId)
          .order('slot_number', { ascending: true }),
      ]);

      let members: ClubMemberRow[] = [];
      if (!rpcError && rpcData && Array.isArray(rpcData)) {
        members = (rpcData as { user_id: string; full_name: string; email: string; avatar_url: string | null }[])
          .map((row) => ({
            id: row.user_id,
            full_name: row.full_name || '',
            email: row.email || '',
            avatar_url: row.avatar_url ?? null,
          }))
          .filter((m) => m.id);
      } else {
        if (rpcError) console.warn('get_club_member_directory failed, falling back:', rpcError);
        const { data: relData, error: relErr } = await supabase
          .from('app_club_user_relationship')
          .select(
            `
            app_user_profiles (
              id,
              full_name,
              email,
              avatar_url
            )
          `
          )
          .eq('club_id', user.currentClubId)
          .eq('is_authenticated', true);
        if (!relErr && relData) {
          members = (relData || [])
            .map((item: { app_user_profiles?: { id: string; full_name: string; email: string; avatar_url: string | null } }) => {
              const p = item.app_user_profiles;
              if (!p?.id) return null;
              return {
                id: p.id,
                full_name: p.full_name || '',
                email: p.email || '',
                avatar_url: p.avatar_url ?? null,
              };
            })
            .filter((m): m is ClubMemberRow => m !== null);
        }
      }
      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setClubMembers(members);

      if (!vgErr && vgData) {
        setVisitingGuests(parseMeetingVisitingGuests(vgData));
      } else {
        setVisitingGuests([]);
      }
    } catch (e) {
      console.error(e);
      setLoadError('Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [meetingId, wordOfTheDayId, user?.id, user?.currentClubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchLower = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!searchLower) return clubMembers;
    const searchByEmail = searchLower.includes('@');
    return clubMembers.filter((m) => {
      const name = (m.full_name || '').toLowerCase();
      if (searchByEmail) {
        return (m.email || '').toLowerCase().includes(searchLower);
      }
      return name.includes(searchLower);
    });
  }, [clubMembers, searchLower]);

  const guestSlots = useMemo(() => {
    const bySlot = new Map<number, MeetingVisitingGuest>();
    for (const g of visitingGuests) {
      bySlot.set(g.slot_number, g);
    }
    return Array.from({ length: VISITING_GUEST_SLOT_COUNT }, (_, i) => {
      const slot = i + 1;
      const row = bySlot.get(slot);
      const formatted = row ? formatTimerGuestDisplayName(row.display_name) : '';
      return { slot, row, formatted };
    });
  }, [visitingGuests]);

  const filteredGuestSlots = useMemo(() => {
    if (!searchLower) return guestSlots;
    return guestSlots.filter(({ slot, formatted, row }) => {
      const label = `visiting guest ${slot}`;
      const raw = (row?.display_name ?? '').toLowerCase();
      return (
        label.includes(searchLower) ||
        formatted.toLowerCase().includes(searchLower) ||
        raw.includes(searchLower)
      );
    });
  }, [guestSlots, searchLower]);

  const assignMember = async (member: ClubMemberRow) => {
    if (!canEdit || !wordOfTheDayId) return;
    if (existingMemberIds.has(member.id)) {
      Alert.alert('Already added', 'This member is already tracking word-of-the-day usage.');
      return;
    }
    setAssigning(true);
    try {
      const { error } = await supabase.from('grammarian_word_of_the_day_member_usage').insert({
        word_of_the_day_id: wordOfTheDayId,
        member_user_id: member.id,
        usage_count: 0,
      });

      if (error) {
        console.error('grammarian wotd add member', error);
        if (error.code === '23505') {
          Alert.alert('Already added', 'This member is already on the list.');
        } else {
          Alert.alert('Error', 'Could not add this member.');
        }
        return;
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add this member.');
    } finally {
      setAssigning(false);
    }
  };

  const assignVisitingGuest = async (guest: MeetingVisitingGuest) => {
    if (!canEdit || !wordOfTheDayId) return;
    const trimmed = guest.display_name.trim();
    if (!trimmed) {
      Alert.alert(
        'Empty slot',
        'Add this person under Visiting Guest Management on the Timer or Grammarian report, save the roster, then try again.'
      );
      return;
    }
    const displayName = formatTimerGuestDisplayName(trimmed);
    if (!displayName) {
      Alert.alert('Invalid name', 'Could not use this visiting guest name. Edit it in Visiting Guest Management.');
      return;
    }
    if (existingVisitingGuestIds.has(guest.id)) {
      Alert.alert('Already added', 'This visiting guest is already tracking word-of-the-day usage.');
      return;
    }
    const key = normManualName(displayName);
    if (existingManualNorms.has(key)) {
      Alert.alert('Already added', 'This visiting guest is already tracking word-of-the-day usage.');
      return;
    }
    setAssigning(true);
    try {
      const { error } = await supabase.from('grammarian_word_of_the_day_member_usage').insert({
        word_of_the_day_id: wordOfTheDayId,
        member_user_id: null,
        visiting_guest_id: guest.id,
        member_name_manual: displayName,
        usage_count: 0,
      });

      if (error) {
        console.error('grammarian wotd add guest', error);
        if (error.code === '23505') {
          Alert.alert('Already added', 'This visiting guest is already on the list.');
        } else {
          Alert.alert('Error', 'Could not add this visiting guest.');
        }
        return;
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not add this visiting guest.');
    } finally {
      setAssigning(false);
    }
  };

  const tabRow = (
    <View style={styles.tabRow}>
      <TouchableOpacity
        style={[
          styles.tab,
          {
            borderColor: activeTab === 'guest' ? theme.colors.primary : theme.colors.border,
            backgroundColor: activeTab === 'guest' ? theme.colors.primary : theme.colors.surface,
          },
        ]}
        onPress={() => setActiveTab('guest')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'guest' }}
      >
        <Text
          style={[styles.tabTitle, { color: activeTab === 'guest' ? '#fff' : theme.colors.text }]}
          maxFontSizeMultiplier={1.2}
        >
          Visiting guest
        </Text>
        <Text
          style={[styles.tabSub, { color: activeTab === 'guest' ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary }]}
          maxFontSizeMultiplier={1.1}
        >
          Same roster as Timer Corner
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tab,
          {
            borderColor: activeTab === 'member' ? theme.colors.primary : theme.colors.border,
            backgroundColor: activeTab === 'member' ? theme.colors.primary : theme.colors.surface,
          },
        ]}
        onPress={() => setActiveTab('member')}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeTab === 'member' }}
      >
        <Text
          style={[styles.tabTitle, { color: activeTab === 'member' ? '#fff' : theme.colors.text }]}
          maxFontSizeMultiplier={1.2}
        >
          Club member
        </Text>
        <Text
          style={[styles.tabSub, { color: activeTab === 'member' ? 'rgba(255,255,255,0.85)' : theme.colors.textSecondary }]}
          maxFontSizeMultiplier={1.1}
        >
          Registered members
        </Text>
      </TouchableOpacity>
    </View>
  );

  const searchBar = (
    <View style={[styles.searchWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
      <Search size={20} color={theme.colors.textSecondary} />
      <TextInput
        style={[styles.searchInput, { color: theme.colors.text }]}
        placeholder="Search by name..."
        placeholderTextColor={theme.colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={12}>
          <X size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
            Add member
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>{loadError}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2} numberOfLines={2}>
          Word usage — {wordLabel}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!canEdit ? (
        <Text style={[styles.readOnlyNote, { color: theme.colors.textSecondary }]}>
          Only the assigned Grammarian or the club VPE can add members here.
        </Text>
      ) : null}

      {tabRow}
      {searchBar}

      {assigning ? (
        <View style={styles.assigningRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginLeft: 8 }}>Adding…</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'guest' ? (
          filteredGuestSlots.length === 0 ? (
            <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No visiting guests match your search.</Text>
          ) : (
            filteredGuestSlots.map(({ slot, row, formatted }) => {
              const hasName = !!row && formatted.length > 0;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                  disabled={!canEdit || assigning || !hasName}
                  onPress={() => void assignVisitingGuest(row!)}
                >
                  <View style={[styles.avatar, { backgroundColor: '#0ea5e9' }]}>
                    <User size={20} color="#fff" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      Visiting Guest {slot}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1} numberOfLines={2}>
                      {hasName ? formatted : 'Empty — add in Visiting Guest Management and save'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : filteredMembers.length === 0 ? (
          <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>No members match your search.</Text>
        ) : (
          filteredMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              disabled={!canEdit || assigning}
              onPress={() => void assignMember(member)}
            >
              <View style={styles.avatar}>
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <User size={20} color="#fff" />
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {member.full_name}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  headerSpacer: { width: 38 },
  readOnlyNote: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 14 },
  errorText: { padding: 24, fontSize: 15, textAlign: 'center' },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  tabSub: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  assigningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#64748b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
});

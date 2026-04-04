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
import { TIMER_GUEST_PREFIX, formatTimerGuestDisplayName } from '@/lib/timerGuestDisplayName';

type TabKey = 'guest' | 'member';

interface ClubMemberRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

export default function TimerRoleAssignScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const meetingId = typeof params.meetingId === 'string' ? params.meetingId : params.meetingId?.[0];
  const roleId = typeof params.roleId === 'string' ? params.roleId : params.roleId?.[0];

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('guest');
  const [searchQuery, setSearchQuery] = useState('');
  const [clubMembers, setClubMembers] = useState<ClubMemberRow[]>([]);
  const [visitingGuests, setVisitingGuests] = useState<MeetingVisitingGuest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!meetingId || !roleId || !user?.id || !user?.currentClubId) {
      setLoadError('Missing meeting or role.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data: mRow, error: mErr }, { data: roleRow, error: rErr }] = await Promise.all([
        supabase.from('app_club_meeting').select('id, club_id').eq('id', meetingId).maybeSingle(),
        supabase
          .from('app_meeting_roles_management')
          .select('id, meeting_id, role_name')
          .eq('id', roleId)
          .maybeSingle(),
      ]);

      if (mErr || !mRow?.id || mRow.club_id !== user.currentClubId) {
        setLoadError('This meeting was not found for your club.');
        setLoading(false);
        return;
      }
      if (rErr || !roleRow || roleRow.meeting_id !== meetingId) {
        setLoadError('This role was not found for this meeting.');
        setLoading(false);
        return;
      }
      setRoleName(roleRow.role_name || 'Role');

      const [{ data: vpeRow }, { data: timerRole }] = await Promise.all([
        supabase.from('club_profiles').select('vpe_id').eq('club_id', user.currentClubId).maybeSingle(),
        supabase
          .from('app_meeting_roles_management')
          .select('assigned_user_id')
          .eq('meeting_id', meetingId)
          .eq('role_name', 'Timer')
          .limit(1)
          .maybeSingle(),
      ]);

      const isVpe = vpeRow?.vpe_id === user.id;
      const isTimer = timerRole?.assigned_user_id === user.id;
      setCanEdit(isVpe || isTimer);

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
        if (rpcError) {
          console.warn('get_club_member_directory failed, falling back:', rpcError);
        }
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
  }, [meetingId, roleId, user?.id, user?.currentClubId]);

  useEffect(() => {
    void load();
  }, [load]);

  const searchLower = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    if (!searchLower) return clubMembers;
    return clubMembers.filter(
      (m) =>
        m.full_name.toLowerCase().includes(searchLower) || m.email.toLowerCase().includes(searchLower)
    );
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
    if (!canEdit || !roleId) return;
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: member.id,
          booking_status: 'booked',
          completion_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('assign member to role', error);
        Alert.alert('Error', 'Failed to assign this member to the role.');
        return;
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to assign this member to the role.');
    } finally {
      setAssigning(false);
    }
  };

  const assignVisitingGuest = async (rawDisplayName: string) => {
    if (!canEdit || !roleId) return;
    const trimmed = rawDisplayName.trim();
    if (!trimmed) {
      Alert.alert(
        'Empty slot',
        'Add this person under Visiting Guest Management on the Timer Report, save the roster, then assign here.'
      );
      return;
    }
    const displayName = formatTimerGuestDisplayName(trimmed);
    if (!displayName) {
      Alert.alert('Invalid name', 'Could not use this visiting guest name. Edit it in Visiting Guest Management.');
      return;
    }
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('app_meeting_roles_management')
        .update({
          assigned_user_id: null,
          booking_status: 'booked',
          completion_notes: `${TIMER_GUEST_PREFIX}${displayName}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roleId);

      if (error) {
        console.error('assign visiting guest to role', error);
        Alert.alert('Error', 'Failed to assign this visiting guest to the role.');
        return;
      }
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to assign this visiting guest to the role.');
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
          Not registered in the app
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
          Registered members of the club
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
            Assign role
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
          Assign {roleName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {!canEdit ? (
        <Text style={[styles.readOnlyNote, { color: theme.colors.textSecondary }]}>
          Only the assigned Timer or the club VPE can assign this role.
        </Text>
      ) : null}

      {tabRow}
      {searchBar}

      {assigning ? (
        <View style={styles.assigningRow}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.textSecondary, marginLeft: 8 }}>Assigning…</Text>
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
                  onPress={() => void assignVisitingGuest(row!.display_name)}
                >
                  <View style={[styles.avatar, { backgroundColor: '#0ea5e9' }]}>
                    <User size={20} color="#fff" />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                      Visiting Guest {slot}
                    </Text>
                    <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1} numberOfLines={2}>
                      {hasName ? formatted : 'Empty — add in Visiting Guest Management on Timer Report and save'}
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
                {member.email ? (
                  <Text style={[styles.rowSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1} numberOfLines={1}>
                    {member.email}
                  </Text>
                ) : null}
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
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

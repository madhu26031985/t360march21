import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  buildAllNudgeMessages,
  formatMeetingDateDisplay,
  localISODate,
  type VpeNudgeRoleRow,
} from '@/lib/vpeNudgeCopy';

const DAY_LABELS = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

const VPE_CARD_SUBTITLE = 'Nudge members to book the role';

export default function VPENudgesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ quickShare?: string }>();
  const quickShareConsumed = useRef(false);
  const prevQuickShareParam = useRef<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);

  const vpeFirstName =
    (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'VPE';

  const load = useCallback(async () => {
    if (!user?.id || !user?.currentClubId) {
      setAllowed(false);
      setLoading(false);
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data: clubRow, error: clubErr } = await supabase
        .from('club_profiles')
        .select('club_name, vpe_id')
        .eq('club_id', user.currentClubId)
        .maybeSingle();

      if (clubErr || !clubRow || (clubRow as { vpe_id?: string }).vpe_id !== user.id) {
        setAllowed(false);
        setMessages([]);
        setMeetingTitle(null);
        return;
      }

      setAllowed(true);

      const clubName = (clubRow as { club_name?: string | null }).club_name?.trim() || 'Our club';
      const today = localISODate(new Date());

      const { data: meetings, error: meetErr } = await supabase
        .from('app_club_meeting')
        .select('id, meeting_title, meeting_date, meeting_number')
        .eq('club_id', user.currentClubId)
        .eq('meeting_status', 'open')
        .gte('meeting_date', today)
        .order('meeting_date', { ascending: true })
        .order('meeting_start_time', { ascending: true })
        .limit(1);

      if (meetErr || !meetings?.length) {
        setMeetingTitle(null);
        setMessages([]);
        return;
      }

      const m = meetings[0] as {
        id: string;
        meeting_title: string | null;
        meeting_date: string;
        meeting_number: string | number | null;
      };

      setMeetingTitle(m.meeting_title || 'Open meeting');

      const { data: rolesRaw, error: rolesErr } = await supabase
        .from('app_meeting_roles_management')
        .select('role_name, role_metric, role_classification, booking_status, assigned_user_id')
        .eq('meeting_id', m.id);

      const roles: VpeNudgeRoleRow[] = (rolesRaw || []) as VpeNudgeRoleRow[];
      if (rolesErr) {
        console.error('VPE nudges roles:', rolesErr);
      }

      const ctx = {
        clubName,
        meetingDateDisplay: formatMeetingDateDisplay(m.meeting_date),
        meetingNumber: m.meeting_number != null ? String(m.meeting_number) : '—',
        vpeName: (user.fullName || '').trim() || vpeFirstName,
      };

      setMessages(buildAllNudgeMessages(ctx, roles));
    } catch (e) {
      console.error('VPE nudges load:', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.currentClubId, user?.fullName, vpeFirstName]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /**
   * Avoid `whatsapp://send?text=` — many platforms mishandle UTF-8 in URL params and show ⯑ for emojis.
   * System share passes the string as plain text so WhatsApp receives full Unicode (same as Copy).
   */
  const shareWhatsApp = useCallback(async (text: string) => {
    try {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share(
          {
            message: text,
            title: 'Share to WhatsApp',
          },
          { subject: 'Club meeting reminder' }
        );
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ text });
          return;
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'name' in e && (e as { name: string }).name === 'AbortError') {
            return;
          }
        }
      }

      await Linking.openURL(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert(
        'Share',
        'Could not open sharing. Use Copy and paste into WhatsApp — emojis will show correctly.'
      );
    }
  }, []);

  useEffect(() => {
    const q = params.quickShare;
    if (q === '1' && prevQuickShareParam.current !== '1') {
      quickShareConsumed.current = false;
    }
    prevQuickShareParam.current = q;
  }, [params.quickShare]);

  useEffect(() => {
    if (loading || messages.length === 0 || params.quickShare !== '1' || quickShareConsumed.current) {
      return;
    }
    quickShareConsumed.current = true;
    void (async () => {
      await shareWhatsApp(messages[0]);
      router.replace('/vpe-nudges');
    })();
  }, [loading, messages, params.quickShare, shareWhatsApp]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Sign in to continue.</Text>
      </SafeAreaView>
    );
  }

  if (!loading && !allowed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>VPE Nudge</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.deniedBox}>
          <Text style={[styles.deniedText, { color: theme.colors.textSecondary }]}>
            This area is only available to the Vice President Education for your club.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          VPE Nudge
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !meetingTitle || messages.length === 0 ? (
        <View style={styles.emptyPad}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No upcoming open meeting</Text>
          <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]}>
            Nudges apply to the next open meeting (by date) once it is scheduled. Open a meeting from club
            tools first.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((body, i) => (
            <View
              key={i}
              style={[
                styles.vpeMessageCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.vpeMessageHeader}>
                <View style={[styles.vpeMessageIconCircle, { backgroundColor: '#25D366' }]}>
                  <FontAwesome name="whatsapp" size={18} color="#ffffff" />
                </View>
                <Text style={[styles.vpeMessageDayTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {DAY_LABELS[i]}
                </Text>
              </View>
              <Text style={[styles.vpeMessageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                {VPE_CARD_SUBTITLE}
              </Text>
              <View style={[styles.vpeMessageBodyWrap, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                  {body}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.vpeMessageSendBtn}
                onPress={() => shareWhatsApp(body)}
                activeOpacity={0.85}
              >
                <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                  Send WhatsApp Message
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  vpeMessageCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  vpeMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  vpeMessageIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpeMessageDayTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  vpeMessageSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 2,
    marginBottom: 10,
  },
  vpeMessageBodyWrap: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  vpeMessageBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  vpeMessageSendBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpeMessageSendBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyPad: { padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, lineHeight: 20 },
  deniedBox: { padding: 24 },
  deniedText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

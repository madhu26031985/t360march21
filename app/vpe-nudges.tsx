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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Info, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  buildAllNudgeMessages,
  daysUntilMeeting,
  formatMeetingDateDisplay,
  formatMeetingStartsTitle,
  formatMeetingStartsTitleForMissedSlot,
  localISODate,
  missedNudgeIndices,
  todayNudgeIndex,
  type VpeNudgeRoleRow,
} from '@/lib/vpeNudgeCopy';

type HintTab = 'today' | 'missed';

const VPE_CARD_SUBTITLE = 'Nudge members to book the role';

const VPE_DAILY_HINT = `New message daily, powered by live data.
Sent today? Come back tomorrow.`;

const VPE_INTRO_BLURB = `VPE Nudge enables you to send smart daily reminders to your club based on open and filled roles.
Consistent nudges encourage members to act early and ensure seamless role booking.

Each message is intelligently crafted using real-time data, with a focus on key roles like TMOD, General Evaluator, Table Topics Master, Tag Roles, Speakers, and Evaluators.

Get a fresh, data-driven message every day.
Once today's message is sent, return tomorrow for the next update.`;

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
  const [meetingDateISO, setMeetingDateISO] = useState<string | null>(null);
  const [meetingNumberDisplay, setMeetingNumberDisplay] = useState<string>('—');
  const [hintTab, setHintTab] = useState<HintTab>('today');
  const [showInfoModal, setShowInfoModal] = useState(false);

  const vpeFirstName =
    (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'VPE';

  const hintSchedule = useMemo(() => {
    if (!meetingDateISO || messages.length === 0) {
      return { daysUntil: 0, todayIdx: 0, missed: [] as number[] };
    }
    const today = localISODate(new Date());
    const daysUntil = Math.max(0, daysUntilMeeting(meetingDateISO, today));
    const rawIdx = todayNudgeIndex(daysUntil);
    const todayIdx = Math.min(Math.max(0, rawIdx), messages.length - 1);
    const missed = missedNudgeIndices(daysUntil).filter((i) => i >= 0 && i < messages.length);
    return { daysUntil, todayIdx, missed };
  }, [meetingDateISO, messages]);

  const load = useCallback(async () => {
    if (!user?.id || !user?.currentClubId) {
      setAllowed(false);
      setLoading(false);
      setMessages([]);
      setMeetingTitle(null);
      setMeetingDateISO(null);
      setMeetingNumberDisplay('—');
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
        setMeetingDateISO(null);
        setMeetingNumberDisplay('—');
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
        setMeetingDateISO(null);
        setMeetingNumberDisplay('—');
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
      setMeetingDateISO(m.meeting_date);
      setMeetingNumberDisplay(m.meeting_number != null && String(m.meeting_number).trim() !== '' ? String(m.meeting_number) : '—');

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
    const idx = hintSchedule.todayIdx;
    void (async () => {
      await shareWhatsApp(messages[idx]);
      router.replace('/vpe-nudges');
    })();
  }, [loading, messages, params.quickShare, shareWhatsApp, hintSchedule.todayIdx]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Sign in to continue.</Text>
      </SafeAreaView>
    );
  }

  const infoModal = (
    <Modal
      visible={showInfoModal}
      animationType="fade"
      transparent
      onRequestClose={() => setShowInfoModal(false)}
    >
      <View style={styles.infoModalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInfoModal(false)} />
        <View
          style={[styles.infoModalSheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <View style={[styles.infoModalHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.infoModalTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
              About VPE Nudge
            </Text>
            <Pressable
              onPress={() => setShowInfoModal(false)}
              style={styles.infoModalClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={22} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.infoModalScroll}
            contentContainerStyle={styles.infoModalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <Text style={[styles.infoModalBody, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.25}>
              {VPE_INTRO_BLURB}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const headerInfoButton = (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={() => setShowInfoModal(true)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="About VPE Nudge"
    >
      <Info size={22} color={theme.colors.text} />
    </TouchableOpacity>
  );

  if (!loading && !allowed) {
    return (
      <>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>VPE Nudge</Text>
            {headerInfoButton}
          </View>
          <View style={styles.deniedBox}>
            <Text style={[styles.deniedText, { color: theme.colors.textSecondary }]}>
              This area is only available to the Vice President Education for your club.
            </Text>
          </View>
        </SafeAreaView>
        {infoModal}
      </>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
            VPE Nudge
          </Text>
          {headerInfoButton}
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
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setHintTab('today')}
                style={[
                  styles.tabBtn,
                  hintTab === 'today' && { borderBottomColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: hintTab === 'today' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {"Today's hint"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setHintTab('missed')}
                style={[
                  styles.tabBtn,
                  hintTab === 'missed' && { borderBottomColor: theme.colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: hintTab === 'missed' ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  Missed hint
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.vpeDailyHint, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
              {VPE_DAILY_HINT}
            </Text>
            {hintTab === 'today' ? (
              <View
                style={[
                  styles.vpeMessageCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.vpeMessageTitleOnly, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                  {formatMeetingStartsTitle(meetingNumberDisplay, hintSchedule.daysUntil)}
                </Text>
                <Text style={[styles.vpeMessageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {VPE_CARD_SUBTITLE}
                </Text>
                <View style={[styles.vpeMessageBodyWrap, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                    {messages[hintSchedule.todayIdx]}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.vpeMessageSendBtn}
                  onPress={() => shareWhatsApp(messages[hintSchedule.todayIdx])}
                  activeOpacity={0.85}
                >
                  <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                    Send WhatsApp Message
                  </Text>
                </TouchableOpacity>
              </View>
            ) : hintSchedule.missed.length === 0 ? (
              <View style={styles.missedEmpty}>
                <Text style={[styles.missedEmptyText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  {"No missed nudges — you're on track for this meeting."}
                </Text>
              </View>
            ) : (
              hintSchedule.missed.map((i) => (
                <View
                  key={i}
                  style={[
                    styles.vpeMessageCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={[styles.vpeMessageTitleOnly, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                    {formatMeetingStartsTitleForMissedSlot(meetingNumberDisplay, i)}
                  </Text>
                  <Text style={[styles.vpeMessageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    You may have missed sending this reminder
                  </Text>
                  <View style={[styles.vpeMessageBodyWrap, { backgroundColor: theme.colors.background }]}>
                    <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                      {messages[i]}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.vpeMessageSendBtn}
                    onPress={() => shareWhatsApp(messages[i])}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                      Send WhatsApp Message
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
      {infoModal}
    </>
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
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  vpeDailyHint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  missedEmpty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  missedEmptyText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  infoModalSheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  infoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoModalTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  infoModalClose: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  infoModalScroll: { maxHeight: 420 },
  infoModalScrollContent: { padding: 16, paddingBottom: 24 },
  infoModalBody: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 22,
  },
  vpeMessageCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  vpeMessageTitleOnly: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 8,
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

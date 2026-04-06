import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Info, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildAllNudgeMessages,
  daysUntilMeeting,
  formatMeetingDateDisplay,
  formatMeetingStartsTitle,
  localISODate,
  todayNudgeIndex,
  type VpeNudgeRoleRow,
} from '@/lib/vpeNudgeCopy';
import {
  isToastmasterOfTheDayRoleName,
  isWithinOneHourOfMeetingStart,
  shouldShowBookRoleNudge,
} from '@/lib/vpeNudgeMeetingWindow';
import {
  buildEducationalSpeakerTitleNudgeWhatsApp,
  buildEducationalVpeSelfReminderWhatsApp,
  buildEvaluatorPrepNudgeWhatsApp,
  buildKeynoteTitleNudgeWhatsApp,
  buildToastmasterThemeNudgeWhatsApp,
} from '@/lib/vpeNudgeWhatsAppTemplates';
import {
  buildPreparedSpeakerSpeechDetailsWhatsApp,
  firstNameFromFullName,
  pathwayRowHasSpeechDetails,
  type EvaluationPathwaySpeechRow,
} from '@/lib/vpePreparedSpeakerNudge';
import { fetchVpeNudgesSnapshot, vpeNudgesQueryKeys } from '@/lib/vpeNudgesSnapshot';

const VPE_CARD_SUBTITLE = 'Nudge members to book the role';

const VPE_SUBNOTE = 'Powered by T360 live data.';

const SCREEN_TITLE = 'Smart Daily Insights for VPE';

const VPE_INTRO_BLURB = `Smart Daily Insights for VPE

Stay ahead with smart, daily reminders tailored to your club.

• Lists refresh when you open the screen (live meeting data)
• Book-the-role WhatsApp message appears only within 7 calendar days of the next open meeting
• Nudge prepared speakers missing Pathway / title / evaluation form; Toastmaster missing theme; educational or keynote title missing; evaluators when the speaker has completed details
• From one hour before the scheduled meeting start, all nudges are hidden so you can focus on the session

⏳ Book-the-role copy rotates daily while that window is active; open again tomorrow for the next line.`;

type NudgeTabId = 'book_role' | 'prepared' | 'toastmaster' | 'educational' | 'keynote' | 'evaluator';

const NUDGE_TABS: { id: NudgeTabId; label: string }[] = [
  { id: 'book_role', label: 'Book role' },
  { id: 'prepared', label: 'Prepared' },
  { id: 'toastmaster', label: 'TMOD' },
  { id: 'educational', label: 'Educational' },
  { id: 'keynote', label: 'Keynote' },
  { id: 'evaluator', label: 'Evaluator' },
];

/** Notion-like neutrals (screen is light-first; works with current forced light theme). */
const N = {
  canvas: '#FFFFFF',
  shell: '#FFFFFF',
  ink: '#37352F',
  muted: '#787774',
  faint: 'rgba(55, 53, 47, 0.08)',
  hairline: 'rgba(55, 53, 47, 0.09)',
  segment: '#E3E2E0',
  inset: '#FAFAF8',
  quoteBg: '#FFFFFF',
  btn: '#37352F',
};

export default function VPENudgesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ quickShare?: string }>();
  const quickShareConsumed = useRef(false);
  const prevQuickShareParam = useRef<string | undefined>(undefined);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [meetingDateISO, setMeetingDateISO] = useState<string | null>(null);
  const [meetingNumberDisplay, setMeetingNumberDisplay] = useState<string>('—');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [preparedSpeakerNudges, setPreparedSpeakerNudges] = useState<
    { userId: string; fullName: string; message: string }[]
  >([]);
  const [toastmasterNudges, setToastmasterNudges] = useState<
    { userId: string; fullName: string; message: string }[]
  >([]);
  const [educationalNudges, setEducationalNudges] = useState<
    { userId: string; fullName: string; message: string }[]
  >([]);
  const [keynoteNudges, setKeynoteNudges] = useState<
    { userId: string; fullName: string; message: string }[]
  >([]);
  const [evaluatorNudges, setEvaluatorNudges] = useState<
    { key: string; evaluatorName: string; speakerName: string; message: string }[]
  >([]);
  const [nudgesHiddenFinalHour, setNudgesHiddenFinalHour] = useState(false);
  const [educationalVpeSelfNeedsTitle, setEducationalVpeSelfNeedsTitle] = useState(false);
  const [nudgeClubName, setNudgeClubName] = useState('Our club');
  const [activeNudgeTab, setActiveNudgeTab] = useState<NudgeTabId>('book_role');

  const vpeFirstName =
    (user?.fullName || '').trim().split(/\s+/).filter(Boolean)[0] || 'VPE';

  const hintSchedule = useMemo(() => {
    if (!meetingDateISO || messages.length === 0) {
      return { daysUntil: 0, todayIdx: 0 };
    }
    const today = localISODate(new Date());
    const daysUntil = Math.max(0, daysUntilMeeting(meetingDateISO, today));
    const rawIdx = todayNudgeIndex(daysUntil);
    const todayIdx = Math.min(Math.max(0, rawIdx), messages.length - 1);
    return { daysUntil, todayIdx };
  }, [meetingDateISO, messages]);

  const daysUntilOpenMeeting = useMemo(() => {
    if (!meetingDateISO) return null;
    const today = localISODate(new Date());
    return Math.max(0, daysUntilMeeting(meetingDateISO, today));
  }, [meetingDateISO]);

  const bookRoleNudgeVisible =
    !nudgesHiddenFinalHour &&
    daysUntilOpenMeeting !== null &&
    shouldShowBookRoleNudge(daysUntilOpenMeeting);

  const educationalSelfReminderMessage = useMemo(() => {
    if (!educationalVpeSelfNeedsTitle || !meetingDateISO) return '';
    return buildEducationalVpeSelfReminderWhatsApp({
      meetingDateDisplay: formatMeetingDateDisplay(meetingDateISO),
      meetingNumber: meetingNumberDisplay,
      vpeFirstName,
      clubName: nudgeClubName,
    });
  }, [
    educationalVpeSelfNeedsTitle,
    meetingDateISO,
    meetingNumberDisplay,
    vpeFirstName,
    nudgeClubName,
  ]);

  const load = useCallback(async () => {
    if (!user?.id || !user?.currentClubId) {
      setAllowed(false);
      setLoading(false);
      setMessages([]);
      setPreparedSpeakerNudges([]);
      setToastmasterNudges([]);
      setEducationalNudges([]);
      setKeynoteNudges([]);
      setEvaluatorNudges([]);
      setNudgesHiddenFinalHour(false);
      setEducationalVpeSelfNeedsTitle(false);
      setNudgeClubName('Our club');
      setMeetingTitle(null);
      setMeetingDateISO(null);
      setMeetingNumberDisplay('—');
      return;
    }

    if (loadInFlightRef.current) return loadInFlightRef.current;
    const run = async () => {
      setLoading(true);
      try {
        const snap = await queryClient.fetchQuery({
          queryKey: vpeNudgesQueryKeys.snapshot(user.currentClubId!, user.id || 'anon'),
          queryFn: () => fetchVpeNudgesSnapshot(user.currentClubId!),
          staleTime: 60 * 1000,
        });

        if (!snap?.allowed) {
          setAllowed(false);
          setMessages([]);
          setPreparedSpeakerNudges([]);
          setToastmasterNudges([]);
          setEducationalNudges([]);
          setKeynoteNudges([]);
          setEvaluatorNudges([]);
          setNudgesHiddenFinalHour(false);
          setEducationalVpeSelfNeedsTitle(false);
          setNudgeClubName('Our club');
          setMeetingTitle(null);
          setMeetingDateISO(null);
          setMeetingNumberDisplay('—');
          return;
        }

        setAllowed(true);
        const clubName = snap.club_name?.trim() || 'Our club';
        setNudgeClubName(clubName);

        const m = snap.meeting;
        if (!m) {
          setMeetingTitle(null);
          setMeetingDateISO(null);
          setMeetingNumberDisplay('—');
          setMessages([]);
          setPreparedSpeakerNudges([]);
          setToastmasterNudges([]);
          setEducationalNudges([]);
          setKeynoteNudges([]);
          setEvaluatorNudges([]);
          setNudgesHiddenFinalHour(false);
          setEducationalVpeSelfNeedsTitle(false);
          return;
        }

        const finalHour = isWithinOneHourOfMeetingStart(m.meeting_date, m.meeting_start_time);
        setNudgesHiddenFinalHour(finalHour);

        setMeetingTitle(m.meeting_title || 'Open meeting');
        setMeetingDateISO(m.meeting_date);
        setMeetingNumberDisplay(m.meeting_number != null && String(m.meeting_number).trim() !== '' ? String(m.meeting_number) : '—');

        const roles: VpeNudgeRoleRow[] = (snap.roles || []) as VpeNudgeRoleRow[];
        const ctx = {
          clubName,
          meetingDateDisplay: formatMeetingDateDisplay(m.meeting_date),
          meetingNumber: m.meeting_number != null ? String(m.meeting_number) : '—',
          vpeName: (user.fullName || '').trim() || vpeFirstName,
        };

        setMessages(buildAllNudgeMessages(ctx, roles));

        const clearRoleNudges = () => {
          setPreparedSpeakerNudges([]);
          setToastmasterNudges([]);
          setEducationalNudges([]);
          setKeynoteNudges([]);
          setEvaluatorNudges([]);
          setEducationalVpeSelfNeedsTitle(false);
        };

        if (finalHour) {
          clearRoleNudges();
          return;
        }

        const vpeUserId = user.id;
        const isBooked = (r: VpeNudgeRoleRow) =>
          r.booking_status === 'booked' && !!r.assigned_user_id;

        const tmodRows = roles.filter(
          (r) => isBooked(r) && isToastmasterOfTheDayRoleName(r.role_name)
        );
        const tmodUserIds = [...new Set(tmodRows.map((r) => r.assigned_user_id as string))];

        const eduRole = roles.find(
          (r) => isBooked(r) && r.role_name?.trim() === 'Educational Speaker'
        );
        const keynoteRole = roles.find(
          (r) => isBooked(r) && (r.role_name || '').toLowerCase().includes('keynote')
        );

        const psRoles = (snap.prepared_roles || []) as { role_name: string; assigned_user_id: string }[];
        const speakerUserIds = [...new Set(psRoles.map((r) => r.assigned_user_id))];
        if (speakerUserIds.length === 0) {
          setPreparedSpeakerNudges([]);
          setEvaluatorNudges([]);
        } else {
          const pathwayByUserRole = new Map<string, EvaluationPathwaySpeechRow>();
          for (const row of snap.pathways || []) {
            const r = row as EvaluationPathwaySpeechRow;
            const uid = String(r.user_id ?? '');
            const rn = String(r.role_name ?? '');
            pathwayByUserRole.set(`${uid}::${rn}`, r);
          }

          const nameById = new Map(
            (snap.profiles || []).map((p) => [
              p.id,
              (p.full_name || '').trim() || 'Member',
            ])
          );

          const needNudgeUserIds = new Set<string>();
          const evaluatorTuples: { evaluatorId: string; speakerId: string; roleName: string }[] = [];
          for (const r of psRoles) {
            const p = pathwayByUserRole.get(`${r.assigned_user_id}::${r.role_name}`) ?? null;
            const speakerId = r.assigned_user_id;
            const speakerIsVpe = speakerId === vpeUserId;
            if (!speakerIsVpe && !pathwayRowHasSpeechDetails(p)) {
              needNudgeUserIds.add(speakerId);
            }
            if (pathwayRowHasSpeechDetails(p)) {
              const ev = p?.assigned_evaluator_id?.trim();
              if (ev && ev !== vpeUserId) {
                evaluatorTuples.push({
                  evaluatorId: ev,
                  speakerId,
                  roleName: r.role_name,
                });
              }
            }
          }

          const prepNudges = [...needNudgeUserIds]
            .map((uid) => {
              const fullName = nameById.get(uid) || 'Member';
              const speakerFirstName = firstNameFromFullName(fullName);
              return {
                userId: uid,
                fullName,
                message: buildPreparedSpeakerSpeechDetailsWhatsApp({
                  speakerFirstName,
                  vpeName: ctx.vpeName,
                  clubName: ctx.clubName,
                  meetingDateDisplay: ctx.meetingDateDisplay,
                  meetingNumber: ctx.meetingNumber,
                }),
              };
            })
            .sort((a, b) => a.fullName.localeCompare(b.fullName));

          setPreparedSpeakerNudges(prepNudges);

          const evNudges = evaluatorTuples
            .map((t) => {
              const evaluatorName = nameById.get(t.evaluatorId) || 'Member';
              const speakerName = nameById.get(t.speakerId) || 'Member';
              return {
                key: `${t.evaluatorId}::${t.speakerId}::${t.roleName}`,
                evaluatorName,
                speakerName,
                message: buildEvaluatorPrepNudgeWhatsApp({
                  evaluatorFirstName: firstNameFromFullName(evaluatorName),
                  speakerFullName: speakerName,
                  vpeName: ctx.vpeName,
                  clubName: ctx.clubName,
                  meetingDateDisplay: ctx.meetingDateDisplay,
                  meetingNumber: ctx.meetingNumber,
                }),
              };
            })
            .sort((a, b) => a.evaluatorName.localeCompare(b.evaluatorName) || a.speakerName.localeCompare(b.speakerName));

          setEvaluatorNudges(evNudges);
        }
        const themeByTmod = new Map<string, string | null>();
        for (const row of snap.toastmaster_data || []) {
          themeByTmod.set(row.toastmaster_user_id, row.theme_of_the_day);
        }

        const tmNeedTheme = tmodUserIds.filter(
          (uid) => uid !== vpeUserId && !themeByTmod.get(uid)?.trim()
        );
        const eduNeedsTitle =
          !!eduRole?.assigned_user_id &&
          eduRole.assigned_user_id !== vpeUserId &&
          !snap.educational_content?.speech_title?.trim();
        const knNeedsTitle =
          !!keynoteRole?.assigned_user_id &&
          keynoteRole.assigned_user_id !== vpeUserId &&
          !snap.keynote_content?.speech_title?.trim();

        const tmEduKnNameById = new Map(
          (snap.profiles || []).map((p) => [p.id, (p.full_name || '').trim() || 'Member'])
        );

        const tmNudgesFinal: { userId: string; fullName: string; message: string }[] = [];
        for (const uid of tmNeedTheme) {
          const fullName = tmEduKnNameById.get(uid) || 'Member';
          tmNudgesFinal.push({
            userId: uid,
            fullName,
            message: buildToastmasterThemeNudgeWhatsApp({
              toastmasterFirstName: firstNameFromFullName(fullName),
              vpeName: ctx.vpeName,
              clubName: ctx.clubName,
              meetingDateDisplay: ctx.meetingDateDisplay,
              meetingNumber: ctx.meetingNumber,
            }),
          });
        }
        setToastmasterNudges(tmNudgesFinal.sort((a, b) => a.fullName.localeCompare(b.fullName)));

        const eduList: { userId: string; fullName: string; message: string }[] = [];
        if (eduNeedsTitle && eduRole?.assigned_user_id) {
          const fullName = tmEduKnNameById.get(eduRole.assigned_user_id) || 'Member';
          eduList.push({
            userId: eduRole.assigned_user_id,
            fullName,
            message: buildEducationalSpeakerTitleNudgeWhatsApp({
              speakerFirstName: firstNameFromFullName(fullName),
              vpeName: ctx.vpeName,
              clubName: ctx.clubName,
              meetingDateDisplay: ctx.meetingDateDisplay,
              meetingNumber: ctx.meetingNumber,
            }),
          });
        }
        setEducationalNudges(eduList);

        const eduVpeSelfNeedsTitle =
          !!eduRole?.assigned_user_id &&
          eduRole.assigned_user_id === vpeUserId &&
          !snap.educational_content?.speech_title?.trim();
        setEducationalVpeSelfNeedsTitle(eduVpeSelfNeedsTitle);

        const knList: { userId: string; fullName: string; message: string }[] = [];
        if (knNeedsTitle && keynoteRole?.assigned_user_id) {
          const fullName = tmEduKnNameById.get(keynoteRole.assigned_user_id) || 'Member';
          knList.push({
            userId: keynoteRole.assigned_user_id,
            fullName,
            message: buildKeynoteTitleNudgeWhatsApp({
              speakerFirstName: firstNameFromFullName(fullName),
              vpeName: ctx.vpeName,
              clubName: ctx.clubName,
              meetingDateDisplay: ctx.meetingDateDisplay,
              meetingNumber: ctx.meetingNumber,
            }),
          });
        }
        setKeynoteNudges(knList);
      } catch (e) {
        console.error('VPE nudges load:', e);
        setMessages([]);
        setPreparedSpeakerNudges([]);
        setToastmasterNudges([]);
        setEducationalNudges([]);
        setKeynoteNudges([]);
        setEvaluatorNudges([]);
        setNudgesHiddenFinalHour(false);
        setEducationalVpeSelfNeedsTitle(false);
      } finally {
        setLoading(false);
        loadInFlightRef.current = null;
      }
    };
    loadInFlightRef.current = run();
    return loadInFlightRef.current;
  }, [user?.id, user?.currentClubId, user?.fullName, vpeFirstName]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (loading || nudgesHiddenFinalHour || !meetingTitle) return;
    setActiveNudgeTab((prev) => {
      if (prev === 'book_role' && !bookRoleNudgeVisible) return 'prepared';
      return prev;
    });
  }, [loading, nudgesHiddenFinalHour, meetingTitle, bookRoleNudgeVisible]);

  const tabBadgeCount = useCallback(
    (id: NudgeTabId): number => {
      switch (id) {
        case 'book_role':
          return 0;
        case 'prepared':
          return preparedSpeakerNudges.length;
        case 'toastmaster':
          return toastmasterNudges.length;
        case 'educational':
          return educationalNudges.length + (educationalVpeSelfNeedsTitle ? 1 : 0);
        case 'keynote':
          return keynoteNudges.length;
        case 'evaluator':
          return evaluatorNudges.length;
        default:
          return 0;
      }
    },
    [
      preparedSpeakerNudges.length,
      toastmasterNudges.length,
      educationalNudges.length,
      educationalVpeSelfNeedsTitle,
      keynoteNudges.length,
      evaluatorNudges.length,
    ]
  );

  /**
   * Open WhatsApp directly with the prefilled text so VPE can send to any contact/group.
   */
  const shareWhatsApp = useCallback(async (text: string) => {
    try {
      await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } catch {
      Alert.alert(
        'WhatsApp',
        'Could not open WhatsApp. Use Copy and paste into WhatsApp.'
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
    if (
      loading ||
      messages.length === 0 ||
      params.quickShare !== '1' ||
      quickShareConsumed.current ||
      !bookRoleNudgeVisible
    ) {
      return;
    }
    quickShareConsumed.current = true;
    const idx = hintSchedule.todayIdx;
    void (async () => {
      await shareWhatsApp(messages[idx]);
      router.replace('/vpe-nudges');
    })();
  }, [
    loading,
    messages,
    params.quickShare,
    shareWhatsApp,
    hintSchedule.todayIdx,
    bookRoleNudgeVisible,
  ]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: N.canvas }]}>
        <Text style={{ color: N.ink }}>Sign in to continue.</Text>
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
          style={[styles.infoModalSheet, { backgroundColor: N.inset, borderColor: N.faint }]}
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
          <TouchableOpacity
            style={[styles.infoModalButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowInfoModal(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.infoModalButtonText} maxFontSizeMultiplier={1.2}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const headerInfoButton = (
    <TouchableOpacity
      style={[styles.notionGhostIconBtn, { borderColor: N.hairline, backgroundColor: N.shell }]}
      onPress={() => setShowInfoModal(true)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="About Smart Daily Insights"
      activeOpacity={0.75}
    >
      <Info size={18} color={N.muted} />
    </TouchableOpacity>
  );

  const notionTopBar = (
    <View style={[styles.notionTopBar, { backgroundColor: N.canvas }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
        <ArrowLeft size={22} color={N.ink} />
      </TouchableOpacity>
      <Text style={styles.topBarTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        Smart Daily Insights
      </Text>
      {headerInfoButton}
    </View>
  );

  if (!loading && !allowed) {
    return (
      <>
        <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
          {notionTopBar}
          <View style={styles.notionCanvasFlex}>
            <View style={[styles.notionShell, { backgroundColor: N.shell, borderColor: N.faint }]}>
              <Text style={styles.notionPageSub}>{VPE_SUBNOTE}</Text>
              <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />
              <Text style={[styles.deniedText, { color: N.muted, marginTop: 8 }]}>
                This area is only available to the Vice President Education for your club.
              </Text>
            </View>
          </View>
        </SafeAreaView>
        {infoModal}
      </>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: N.canvas }]}>
        {notionTopBar}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={N.ink} />
          </View>
        ) : !meetingTitle || messages.length === 0 ? (
          <View style={styles.notionCanvasFlex}>
            <View style={[styles.notionShell, { backgroundColor: N.shell, borderColor: N.faint }]}>
              <Text style={styles.notionPageSub}>{VPE_SUBNOTE}</Text>
              <View style={[styles.notionDivider, { backgroundColor: N.hairline }]} />
              <Text style={[styles.notionEmptyTitle, { color: N.ink }]}>No upcoming open meeting</Text>
              <Text style={[styles.notionEmptyBody, { color: N.muted }]}>
                Nudges apply to the next open meeting (by date) once it is scheduled. Open a meeting from club tools first.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.notionCanvasFlex}>
            <View style={[styles.notionShell, { backgroundColor: N.shell, borderColor: N.faint }]}>
              <Text style={styles.notionPageSub}>{VPE_SUBNOTE}</Text>

              {nudgesHiddenFinalHour ? (
                <View style={styles.notionPausedBlock}>
                  <Text style={[styles.notionSectionTitle, { color: N.ink }]} maxFontSizeMultiplier={1.15}>
                    Nudges paused
                  </Text>
                  <Text style={[styles.notionBodyMuted, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                    Within one hour of the scheduled meeting start, WhatsApp nudges are hidden so you can focus on running the
                    session. They return for the next meeting after this one.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.notionSegment, { backgroundColor: N.segment }]}>
                    <View style={styles.notionSegmentGrid}>
                      {NUDGE_TABS.map(({ id, label }) => {
                        const selected = activeNudgeTab === id;
                        const count = tabBadgeCount(id);
                        const suffix = count > 0 ? ` (${count})` : '';
                        return (
                          <Pressable
                            key={id}
                            onPress={() => setActiveNudgeTab(id)}
                            style={({ pressed }) => [
                              styles.notionSegPill,
                              selected && styles.notionSegPillActive,
                              { opacity: pressed ? 0.92 : 1 },
                            ]}
                            accessibilityRole="tab"
                            accessibilityState={{ selected }}
                          >
                            <Text
                              style={[styles.notionSegPillText, { color: selected ? N.ink : N.muted }]}
                              maxFontSizeMultiplier={1.12}
                              numberOfLines={1}
                            >
                              {label}
                              <Text style={{ fontWeight: '700' }}>{suffix}</Text>
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={[styles.notionDivider, { backgroundColor: N.hairline, marginTop: 16 }]} />

                  <ScrollView
                    style={styles.tabPanelScroll}
                    contentContainerStyle={styles.notionPanelContent}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                  >
                  {activeNudgeTab === 'book_role' ? (
                    bookRoleNudgeVisible ? (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.vpeMessageTitleOnly]} maxFontSizeMultiplier={1.15}>
                          {formatMeetingStartsTitle(meetingNumberDisplay, hintSchedule.daysUntil)}
                        </Text>
                        <Text style={[styles.vpeMessageSubtitle]} maxFontSizeMultiplier={1.2}>
                          {VPE_CARD_SUBTITLE}
                        </Text>
                        <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                          <Text style={[styles.vpeMessageBody]} selectable>
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
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          Book-the-role nudges show only when the next open meeting is within 7 calendar days and you are
                          outside the final hour before start. Check back closer to the meeting, or use another tab.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'prepared' ? (
                    preparedSpeakerNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Prepared speech — update app details
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          These members are booked for a prepared speech (or ice breaker) but have not added Pathway details,
                          speech title, or evaluation form. Use WhatsApp to nudge them the same day you see them here.
                        </Text>
                        {preparedSpeakerNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[
                              styles.vpeMessageCard,
                              styles.preparedNudgeCard,
                              { backgroundColor: N.inset, borderColor: N.faint },
                            ]}
                          >
                            <Text style={[styles.preparedNudgeName]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                              <Text style={[styles.vpeMessageBody]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.vpeMessageSendBtn}
                              onPress={() => shareWhatsApp(n.message)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                                Send WhatsApp to {firstNameFromFullName(n.fullName)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No prepared speakers need this nudge — everyone booked has added Pathway details, speech title, and
                          evaluation form (or no prepared / ice breaker roles are booked yet).
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'toastmaster' ? (
                    toastmasterNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Toastmaster of the Day — theme of the day
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          Booked Toastmaster has not added the theme in the app yet. Nudge them to complete it before the
                          meeting.
                        </Text>
                        {toastmasterNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[
                              styles.vpeMessageCard,
                              styles.preparedNudgeCard,
                              { backgroundColor: N.inset, borderColor: N.faint },
                            ]}
                          >
                            <Text style={[styles.preparedNudgeName]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                              <Text style={[styles.vpeMessageBody]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.vpeMessageSendBtn}
                              onPress={() => shareWhatsApp(n.message)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                                Send WhatsApp to {firstNameFromFullName(n.fullName)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No Toastmaster theme reminder needed — the theme is set, or no Toastmaster of the Day is booked for
                          this meeting yet.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'educational' ? (
                    educationalNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Educational speaker — session title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          The educational speaker is booked but has not added their session title in the app.
                        </Text>
                        {educationalNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[
                              styles.vpeMessageCard,
                              styles.preparedNudgeCard,
                              { backgroundColor: N.inset, borderColor: N.faint },
                            ]}
                          >
                            <Text style={[styles.preparedNudgeName]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                              <Text style={[styles.vpeMessageBody]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.vpeMessageSendBtn}
                              onPress={() => shareWhatsApp(n.message)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                                Send WhatsApp to {firstNameFromFullName(n.fullName)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : educationalVpeSelfNeedsTitle && educationalSelfReminderMessage ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Educational speaker — session title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          You are booked as Educational Speaker. We do not send a WhatsApp nudge to yourself — add your title in
                          the app. For reference, the note below matches what we send to other members.
                        </Text>
                        <View
                          style={[
                            styles.vpeMessageCard,
                            styles.preparedNudgeCard,
                            { backgroundColor: N.inset, borderColor: N.faint },
                          ]}
                        >
                          <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                            <Text style={[styles.vpeMessageBody]} selectable>
                              {educationalSelfReminderMessage}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No educational title reminder — the title is set, or the Educational Speaker role is not booked for
                          this meeting.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'keynote' ? (
                    keynoteNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Keynote speaker — title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          The keynote speaker is booked but has not added their keynote title in the app.
                        </Text>
                        {keynoteNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[
                              styles.vpeMessageCard,
                              styles.preparedNudgeCard,
                              { backgroundColor: N.inset, borderColor: N.faint },
                            ]}
                          >
                            <Text style={[styles.preparedNudgeName]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                              <Text style={[styles.vpeMessageBody]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.vpeMessageSendBtn}
                              onPress={() => shareWhatsApp(n.message)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                                Send WhatsApp to {firstNameFromFullName(n.fullName)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No keynote title reminder — the title is set, or no keynote role is booked for this meeting.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'evaluator' ? (
                    evaluatorNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle]} maxFontSizeMultiplier={1.15}>
                          Evaluator — review speaker details
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted }]} maxFontSizeMultiplier={1.2}>
                          The speaker has completed Pathway details, title, and evaluation form. Nudge the assigned evaluator to
                          review everything before the meeting.
                        </Text>
                        {evaluatorNudges.map((n) => (
                          <View
                            key={n.key}
                            style={[
                              styles.vpeMessageCard,
                              styles.preparedNudgeCard,
                              { backgroundColor: N.inset, borderColor: N.faint },
                            ]}
                          >
                            <Text style={[styles.preparedNudgeName]} maxFontSizeMultiplier={1.15}>
                              {n.evaluatorName}
                            </Text>
                            <Text style={[styles.evaluatorNudgeMeta]} maxFontSizeMultiplier={1.15}>
                              Prepared speech: {n.speakerName}
                            </Text>
                            <View style={[styles.vpeMessageBodyWrap, { backgroundColor: N.quoteBg }]}>
                              <Text style={[styles.vpeMessageBody]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.vpeMessageSendBtn}
                              onPress={() => shareWhatsApp(n.message)}
                              activeOpacity={0.85}
                            >
                              <Text style={styles.vpeMessageSendBtnText} maxFontSizeMultiplier={1.2}>
                                Send WhatsApp to {firstNameFromFullName(n.evaluatorName)}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.vpeMessageCard,
                          { backgroundColor: N.inset, borderColor: N.faint },
                        ]}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: N.muted, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No evaluator prep reminders — assigned evaluators either are not set yet, or speakers still need to
                          complete speech details first.
                        </Text>
                      </View>
                    )
                  ) : null}
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
      {infoModal}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notionTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#37352F',
    letterSpacing: -0.2,
  },
  notionGhostIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  notionCanvasFlex: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  notionShell: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    ...Platform.select({
      web: {
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      },
      default: {},
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  notionPageTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.35,
    color: '#37352F',
    lineHeight: 28,
    textAlign: 'center',
  },
  notionPageSub: {
    fontSize: 13,
    lineHeight: 18,
    color: '#787774',
    marginTop: 6,
    marginBottom: 12,
    textAlign: 'center',
  },
  notionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  notionSegment: {
    borderRadius: 12,
    padding: 4,
    alignSelf: 'stretch',
    marginTop: 8,
  },
  notionSegmentGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 4,
  },
  notionSegPill: {
    width: '32.3%',
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notionSegPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  notionSegPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notionPanelContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  notionPausedBlock: {
    marginTop: 4,
  },
  notionSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  notionBodyMuted: {
    fontSize: 14,
    lineHeight: 21,
  },
  notionEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notionEmptyBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  tabPanelScroll: {
    flex: 1,
    minHeight: 0,
  },
  preparedNudgeSection: {
    marginBottom: 20,
  },
  preparedNudgeSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: '#787774',
    marginBottom: 8,
  },
  preparedNudgeSectionSub: {
    fontSize: 14,
    lineHeight: 20,
    color: '#37352F',
    opacity: 0.92,
    marginBottom: 14,
  },
  preparedNudgeCard: {
    marginBottom: 12,
  },
  preparedNudgeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#37352F',
  },
  evaluatorNudgeMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
    color: '#787774',
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
  infoModalButton: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoModalButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  vpeMessageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 53, 47, 0.08)',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  vpeMessageTitleOnly: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 6,
    color: '#37352F',
  },
  vpeMessageSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 0,
    marginBottom: 12,
    color: '#787774',
  },
  vpeMessageBodyWrap: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 0,
  },
  vpeMessageBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#37352F',
  },
  vpeMessageSendBtn: {
    backgroundColor: '#6BA8F0',
    borderRadius: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpeMessageSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPad: { padding: 24 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 14, lineHeight: 20 },
  deniedBox: { padding: 24 },
  deniedText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});

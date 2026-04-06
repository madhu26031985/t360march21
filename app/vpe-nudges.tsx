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

const VPE_INTRO_BLURB = `VPE Smart Insights

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

const NUDGE_TAB_ROWS = [NUDGE_TABS.slice(0, 3), NUDGE_TABS.slice(3, 6)] as const;

const VPE_HEADER_TITLE = 'VPE Smart Insights';

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
              About VPE Smart Insights
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
      style={[styles.headerIconBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
      onPress={() => setShowInfoModal(true)}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="About VPE Smart Insights"
      activeOpacity={0.75}
    >
      <Info size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const notionTopBar = (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
        <ArrowLeft size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text
        style={[styles.headerTitle, { color: theme.colors.text }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
      >
        {VPE_HEADER_TITLE}
      </Text>
      {headerInfoButton}
    </View>
  );

  const tabHairline = StyleSheet.hairlineWidth;
  const tabGrid = (
    <View style={[styles.tabGridWrap, { borderColor: theme.colors.border }]}>
      {NUDGE_TAB_ROWS.map((row, ri) => (
        <View key={`nudge-tab-row-${ri}`} style={styles.tabGridRow}>
          {row.map((tab, ci) => {
            const selected = activeNudgeTab === tab.id;
            const count = tabBadgeCount(tab.id);
            const suffix = count > 0 ? ` (${count})` : '';
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveNudgeTab(tab.id)}
                style={({ pressed }) => [
                  styles.tabCell,
                  {
                    borderRightWidth: ci < row.length - 1 ? tabHairline : 0,
                    borderBottomWidth: ri < NUDGE_TAB_ROWS.length - 1 ? tabHairline : 0,
                    borderColor: theme.colors.border,
                    backgroundColor: selected
                      ? `${theme.colors.primary}22`
                      : pressed
                        ? theme.mode === 'dark'
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)'
                        : theme.colors.surface,
                  },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.tabCellText,
                    { color: selected ? theme.colors.text : theme.colors.textSecondary },
                  ]}
                  maxFontSizeMultiplier={1.12}
                  numberOfLines={1}
                >
                  {tab.label}
                  <Text style={{ fontWeight: '700' }}>{suffix}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  if (!loading && !allowed) {
    return (
      <>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
          {notionTopBar}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.scrollContentOuter}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.notionSheet,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.sheetMeta, { color: theme.colors.textSecondary }]}>{VPE_SUBNOTE}</Text>
              <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.notionEmptyTitle, { color: theme.colors.text }]}>
                This area is only available to the Vice President Education for your club.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
        {infoModal}
      </>
    );
  }

  const messageCardStyle = [styles.vpeMessageCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }];
  const messageBodyWrapStyle = [
    styles.vpeMessageBodyWrap,
    {
      backgroundColor: theme.mode === 'dark' ? theme.colors.background : '#F3F4F6',
      borderColor: theme.colors.border,
    },
  ];
  const sendBtnStyle = [styles.vpeMessageSendBtn, { backgroundColor: theme.colors.primary }];

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {notionTopBar}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.text} />
          </View>
        ) : !meetingTitle || messages.length === 0 ? (
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.scrollContentOuter}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.notionSheet,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.sheetMeta, { color: theme.colors.textSecondary }]}>{VPE_SUBNOTE}</Text>
              <View style={[styles.notionHairline, { backgroundColor: theme.colors.border }]} />
              <Text style={[styles.notionEmptyTitle, { color: theme.colors.text }]}>No upcoming open meeting</Text>
              <Text style={[styles.notionEmptyBody, { color: theme.colors.textSecondary }]}>
                Nudges apply to the next open meeting (by date) once it is scheduled. Open a meeting from club tools first.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.scrollContentOuter}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                styles.notionSheet,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <Text style={[styles.sheetMeta, { color: theme.colors.textSecondary }]}>{VPE_SUBNOTE}</Text>

              {nudgesHiddenFinalHour ? (
                <View style={styles.notionPausedBlock}>
                  <Text style={[styles.notionSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                    Nudges paused
                  </Text>
                  <Text style={[styles.notionBodyMuted, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                    Within one hour of the scheduled meeting start, WhatsApp nudges are hidden so you can focus on running the
                    session. They return for the next meeting after this one.
                  </Text>
                </View>
              ) : (
                <>
                  {tabGrid}

                  <View style={[styles.notionHairline, { backgroundColor: theme.colors.border, marginTop: 16 }]} />

                  <View style={styles.notionPanelContent}>
                  {activeNudgeTab === 'book_role' ? (
                    bookRoleNudgeVisible ? (
                      <View
                        style={messageCardStyle}
                      >
                        <Text style={[styles.vpeMessageTitleOnly, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                          {formatMeetingStartsTitle(meetingNumberDisplay, hintSchedule.daysUntil)}
                        </Text>
                        <Text style={[styles.vpeMessageSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          {VPE_CARD_SUBTITLE}
                        </Text>
                        <View style={messageBodyWrapStyle}>
                          <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                            {messages[hintSchedule.todayIdx]}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={sendBtnStyle}
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
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          Book-the-role nudges show only when the next open meeting is within 7 calendar days and you are
                          outside the final hour before start. Check back closer to the meeting, or use another tab.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'prepared' ? (
                    preparedSpeakerNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Prepared speech — update app details
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          These members are booked for a prepared speech (or ice breaker) but have not added Pathway details,
                          speech title, or evaluation form. Use WhatsApp to nudge them the same day you see them here.
                        </Text>
                        {preparedSpeakerNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[messageCardStyle, styles.preparedNudgeCard]}
                          >
                            <Text style={[styles.preparedNudgeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={messageBodyWrapStyle}>
                              <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={sendBtnStyle}
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
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No prepared speakers need this nudge — everyone booked has added Pathway details, speech title, and
                          evaluation form (or no prepared / ice breaker roles are booked yet).
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'toastmaster' ? (
                    toastmasterNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Toastmaster of the Day — theme of the day
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          Booked Toastmaster has not added the theme in the app yet. Nudge them to complete it before the
                          meeting.
                        </Text>
                        {toastmasterNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[messageCardStyle, styles.preparedNudgeCard]}
                          >
                            <Text style={[styles.preparedNudgeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={messageBodyWrapStyle}>
                              <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={sendBtnStyle}
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
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No Toastmaster theme reminder needed — the theme is set, or no Toastmaster of the Day is booked for
                          this meeting yet.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'educational' ? (
                    educationalNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Educational speaker — session title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          The educational speaker is booked but has not added their session title in the app.
                        </Text>
                        {educationalNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[messageCardStyle, styles.preparedNudgeCard]}
                          >
                            <Text style={[styles.preparedNudgeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={messageBodyWrapStyle}>
                              <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={sendBtnStyle}
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
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Educational speaker — session title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          You are booked as Educational Speaker. We do not send a WhatsApp nudge to yourself — add your title in
                          the app. For reference, the note below matches what we send to other members.
                        </Text>
                        <View
                          style={[messageCardStyle, styles.preparedNudgeCard]}
                        >
                          <View style={messageBodyWrapStyle}>
                            <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                              {educationalSelfReminderMessage}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No educational title reminder — the title is set, or the Educational Speaker role is not booked for
                          this meeting.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'keynote' ? (
                    keynoteNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Keynote speaker — title
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          The keynote speaker is booked but has not added their keynote title in the app.
                        </Text>
                        {keynoteNudges.map((n) => (
                          <View
                            key={n.userId}
                            style={[messageCardStyle, styles.preparedNudgeCard]}
                          >
                            <Text style={[styles.preparedNudgeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                              {n.fullName}
                            </Text>
                            <View style={messageBodyWrapStyle}>
                              <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={sendBtnStyle}
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
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No keynote title reminder — the title is set, or no keynote role is booked for this meeting.
                        </Text>
                      </View>
                    )
                  ) : null}

                  {activeNudgeTab === 'evaluator' ? (
                    evaluatorNudges.length > 0 ? (
                      <View style={styles.preparedNudgeSection}>
                        <Text style={[styles.preparedNudgeSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                          Evaluator — review speaker details
                        </Text>
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          The speaker has completed Pathway details, title, and evaluation form. Nudge the assigned evaluator to
                          review everything before the meeting.
                        </Text>
                        {evaluatorNudges.map((n) => (
                          <View
                            key={n.key}
                            style={[messageCardStyle, styles.preparedNudgeCard]}
                          >
                            <Text style={[styles.preparedNudgeName, { color: theme.colors.text }]} maxFontSizeMultiplier={1.15}>
                              {n.evaluatorName}
                            </Text>
                            <Text style={[styles.evaluatorNudgeMeta, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.15}>
                              Prepared speech: {n.speakerName}
                            </Text>
                            <View style={messageBodyWrapStyle}>
                              <Text style={[styles.vpeMessageBody, { color: theme.colors.text }]} selectable>
                                {n.message}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={sendBtnStyle}
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
                        style={messageCardStyle}
                      >
                        <Text style={[styles.preparedNudgeSectionSub, { color: theme.colors.textSecondary, marginBottom: 0 }]} maxFontSizeMultiplier={1.2}>
                          No evaluator prep reminders — assigned evaluators either are not set yet, or speakers still need to
                          complete speech details first.
                        </Text>
                      </View>
                    )
                  ) : null}
                  </View>
                </>
              )}
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    letterSpacing: -0.2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  mainScroll: {
    flex: 1,
  },
  scrollContentOuter: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    ...Platform.select({
      web: {
        maxWidth: 720,
        width: '100%',
        alignSelf: 'center',
      },
      default: {},
    }),
  },
  /** Matches Book a Role: square corners, hairline frame */
  notionSheet: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  notionHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  sheetMeta: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  tabGridWrap: {
    alignSelf: 'stretch',
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
  },
  tabGridRow: {
    flexDirection: 'row',
  },
  tabCell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tabCellText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  notionPanelContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  notionPausedBlock: {
    marginTop: 8,
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
    marginTop: 4,
  },
  notionEmptyBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  preparedNudgeSection: {
    marginBottom: 20,
  },
  preparedNudgeSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  preparedNudgeSectionSub: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  preparedNudgeCard: {
    marginBottom: 12,
  },
  preparedNudgeName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  evaluatorNudgeMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
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
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
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
    borderRadius: 0,
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
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  vpeMessageTitleOnly: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 6,
  },
  vpeMessageSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 0,
    marginBottom: 12,
  },
  vpeMessageBodyWrap: {
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  vpeMessageBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  vpeMessageSendBtn: {
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vpeMessageSendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

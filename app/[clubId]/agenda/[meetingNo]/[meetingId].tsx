import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { parseMemberPreparedAgenda } from '@/lib/preparedSpeechesAgendaParse';
import {
  extractMeetingNoFromRouteParam,
  extractUuidFromRouteParam,
} from '@/lib/agendaWebLink';
import {
  fetchPublicMeetingAgenda,
  type PublicAgendaItemRow,
  type PublicAgendaPayload,
} from '@/lib/publicAgendaQuery';

function formatMeetingDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function preparedSlotsForPublic(item: PublicAgendaItemRow) {
  const parsed = parseMemberPreparedAgenda(item.prepared_speeches_agenda);
  const str = (v: unknown) => (v != null && String(v).trim() !== '' ? 1 : 0);
  const hasContent = (s: (typeof parsed)[0]) => {
    if (s.booked) return true;
    return (
      str(s.speaker_name) +
        str(s.speech_title) +
        str(s.pathway_name) +
        str(s.project_name) +
        str(s.evaluator_name) +
        str(s.evaluation_form) +
        (s.level != null ? 1 : 0) +
        str(s.project_number) >
      0
    );
  };
  return parsed.filter((s) => s.is_visible && hasContent(s));
}

function roleDetailLines(rd: Record<string, unknown> | null): string[] {
  if (!rd) return [];
  const lines: string[] = [];
  const pick = (k: string) => {
    const v = rd[k];
    if (v != null && String(v).trim() !== '') lines.push(String(v));
  };
  pick('speech_title');
  pick('pathway_name');
  if (rd.pathway_level != null) lines.push(`Level ${rd.pathway_level}`);
  pick('project_title');
  pick('table_topic_question');
  pick('educational_topic');
  pick('summary');
  const g = rd.grammarian_corner as Record<string, unknown> | undefined;
  if (g && typeof g === 'object' && g.word_of_the_day != null && String(g.word_of_the_day).trim() !== '') {
    lines.push(`Word of the day: ${String(g.word_of_the_day)}`);
  }
  return lines;
}

export default function PublicMeetingAgendaPage() {
  const { theme } = useTheme();
  const { clubId, meetingNo, meetingId } = useLocalSearchParams<{
    clubId: string;
    meetingNo: string;
    meetingId: string;
  }>();

  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [payload, setPayload] = useState<PublicAgendaPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const cid = extractUuidFromRouteParam(clubId);
    const mid = extractUuidFromRouteParam(meetingId);
    const num = extractMeetingNoFromRouteParam(meetingNo);

    if (!cid || !num || !mid) {
      setState('empty');
      setMessage('This link is invalid or incomplete.');
      return;
    }

    setState('loading');
    setMessage(null);
    try {
      const data = await fetchPublicMeetingAgenda({
        meetingId: mid,
        clubId: cid,
        meetingNo: num,
      });
      if (!data) {
        setPayload(null);
        setState('empty');
        setMessage(
          'This agenda is not available. It may be private, the meeting may not exist, or the link may be incorrect.'
        );
        return;
      }
      setPayload(data);
      setState('ready');
    } catch (e) {
      console.error('Public agenda load:', e);
      setPayload(null);
      setState('error');
      setMessage('Something went wrong while loading the agenda. Please try again later.');
    }
  }, [clubId, meetingNo, meetingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const title =
      state === 'ready' && payload
        ? `${payload.club.club_name} — ${payload.meeting.meeting_title}`
        : 'Meeting agenda — T360';
    document.title = title;
  }, [state, payload]);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  if (state === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.muted, { color: theme.colors.textSecondary, marginTop: 12 }]}>
          Loading agenda…
        </Text>
      </SafeAreaView>
    );
  }

  if (state === 'empty' || state === 'error') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.colors.background, padding: 24 }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Meeting agenda</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
          {message}
        </Text>
      </SafeAreaView>
    );
  }

  if (!payload) return null;

  const { meeting, club, items } = payload;
  const clubBanner = meeting.club_info_banner_color || '#0ea5e9';
  const dateBanner = meeting.datetime_banner_color || '#f97316';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.banner, { backgroundColor: clubBanner }]}>
          <Text style={styles.bannerClub} numberOfLines={2}>
            {club.club_name}
          </Text>
          {club.club_number ? (
            <Text style={styles.bannerMeta}>Club #{club.club_number}</Text>
          ) : null}
        </View>

        <View style={[styles.banner, { backgroundColor: dateBanner, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <Text style={styles.bannerTitle} numberOfLines={3}>
            {meeting.meeting_title}
          </Text>
          <Text style={styles.bannerMeta}>{formatMeetingDate(meeting.meeting_date)}</Text>
          {meeting.meeting_start_time ? (
            <Text style={styles.bannerMeta}>
              {meeting.meeting_start_time}
              {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
            </Text>
          ) : null}
          {meeting.meeting_mode ? (
            <Text style={styles.bannerMeta} accessibilityLabel="Meeting mode">
              {meeting.meeting_mode.replace(/_/g, ' ')}
            </Text>
          ) : null}
          {meeting.meeting_location ? (
            <Text style={styles.bannerMeta}>{meeting.meeting_location}</Text>
          ) : null}
          {meeting.meeting_link ? (
            <Pressable onPress={() => openLink(meeting.meeting_link!)} style={styles.linkWrap}>
              <Text style={styles.linkText}>Join online</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.publicNote, { color: theme.colors.textTertiary }]}>
          Shared agenda — sign in to the T360 app to book roles or see member-only details.
        </Text>

        {items.map((item) => (
          <AgendaSectionCard key={`${item.section_order}-${item.section_name}`} item={item} theme={theme} />
        ))}

        <Text style={[styles.footer, { color: theme.colors.textTertiary }]}>
          © {new Date().getFullYear()} {club.club_name}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AgendaSectionCard({
  item,
  theme,
}: {
  item: PublicAgendaItemRow;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const rd = item.role_details && typeof item.role_details === 'object' ? item.role_details : null;
  const extraLines = roleDetailLines(rd);
  const slots = preparedSlotsForPublic(item);
  const tagParts = [item.timer_user_name, item.ah_counter_user_name, item.grammarian_user_name].filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderLight,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        {item.section_icon ? <Text style={styles.icon}>{item.section_icon}</Text> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{item.section_name}</Text>
          {item.duration_minutes != null ? (
            <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
              {item.duration_minutes} min
            </Text>
          ) : null}
        </View>
      </View>
      {item.section_description ? (
        <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>{item.section_description}</Text>
      ) : null}
      {item.assigned_user_name ? (
        <Text style={[styles.assignee, { color: theme.colors.text }]}>
          <Text style={{ fontWeight: '600' }}>Assigned: </Text>
          {item.assigned_user_name}
        </Text>
      ) : null}
      {tagParts.length > 0 ? (
        <Text style={[styles.assignee, { color: theme.colors.textSecondary }]}>
          Tag team: {tagParts.join(' · ')}
        </Text>
      ) : null}
      {item.educational_topic ? (
        <Text style={[styles.assignee, { color: theme.colors.text }]}>Topic: {item.educational_topic}</Text>
      ) : null}
      {extraLines.map((line, i) => (
        <Text key={`${i}-${line.slice(0, 24)}`} style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
          {line}
        </Text>
      ))}
      {slots.length > 0 ? (
        <View style={styles.slots}>
          {slots.map((s) => (
            <View key={s.slot} style={[styles.slotRow, { borderTopColor: theme.colors.borderLight }]}>
              <Text style={[styles.slotTitle, { color: theme.colors.text }]}>
                Speaker {s.slot}
                {s.speaker_name ? `: ${s.speaker_name}` : ''}
              </Text>
              {s.speech_title ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>{s.speech_title}</Text>
              ) : null}
              {(s.pathway_name || s.project_name) ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                  {[s.pathway_name, s.project_name].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {s.evaluator_name ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                  Evaluator: {s.evaluator_name}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {item.custom_notes ? (
        <Text style={[styles.notes, { color: theme.colors.textSecondary }]}>{item.custom_notes}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 15 },
  banner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  bannerClub: { color: '#fff', fontSize: 22, fontWeight: '800' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 15, marginTop: 4 },
  linkWrap: { marginTop: 10, alignSelf: 'flex-start' },
  linkText: { color: '#fff', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  publicNote: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 22, lineHeight: 26 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  duration: { fontSize: 13, marginTop: 2 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  assignee: { fontSize: 14, marginTop: 8 },
  detailLine: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  slots: { marginTop: 10 },
  slotRow: { paddingTop: 10, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  slotTitle: { fontSize: 15, fontWeight: '600' },
  notes: { fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 20, paddingHorizontal: 16 },
});

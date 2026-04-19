import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PublicMeetingAgendaLoadedView } from '@/components/PublicMeetingAgendaWebLayouts';
import { useTheme } from '@/contexts/ThemeContext';
import { usePublicAgendaSkinQuery } from '@/hooks/usePublicAgendaSkinQuery';
import { extractUuidFromRouteParam } from '@/lib/agendaWebLink';
import {
  normalizeStoredPublicAgendaSkin,
  publicAgendaSkinFromUrlParam,
} from '@/lib/publicAgendaSkin';
import {
  fetchPublicMeetingAgendaByMeetingId,
  type PublicAgendaPayload,
} from '@/lib/publicAgendaQuery';

export default function PublicMeetingAgendaPage() {
  const { theme } = useTheme();
  const { meetingId } = useLocalSearchParams<{
    clubId: string;
    meetingNo: string;
    meetingId: string;
  }>();
  const skinQuery = usePublicAgendaSkinQuery();

  const [state, setState] = useState<'loading' | 'error' | 'empty' | 'ready'>('loading');
  const [payload, setPayload] = useState<PublicAgendaPayload | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mid = extractUuidFromRouteParam(meetingId);
    // First segment may be club slug or legacy club UUID; only meeting UUID is used to load.
    if (!mid) {
      setState('empty');
      setMessage('This link is invalid or incomplete.');
      return;
    }

    setState('loading');
    setMessage(null);
    try {
      const res = await fetchPublicMeetingAgendaByMeetingId(mid);
      if (!res.ok) {
        setPayload(null);
        setState('empty');
        setMessage(res.message);
        return;
      }
      setPayload(res.data);
      setState('ready');
    } catch (e) {
      console.error('Public agenda load:', e);
      setPayload(null);
      setState('error');
      setMessage('Something went wrong while loading the agenda. Please try again later.');
    }
  }, [meetingId]);

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

  const skin =
    publicAgendaSkinFromUrlParam(skinQuery) ??
    normalizeStoredPublicAgendaSkin(payload.meeting.public_agenda_skin);

  return <PublicMeetingAgendaLoadedView skin={skin} payload={payload} theme={theme} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 15 },
});

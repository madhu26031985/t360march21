import { useLocalSearchParams } from 'expo-router';
import PublicMeetingAgendaByMeetingIdScreen from '@/components/PublicMeetingAgendaByMeetingIdScreen';

/** Branded short URL: /weblogin/{club-slug}/a/{meetingId} (slug is cosmetic; meeting UUID loads data). */
export default function PublicMeetingAgendaBrandedShortLinkPage() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  return <PublicMeetingAgendaByMeetingIdScreen meetingIdParam={meetingId} />;
}

import { useLocalSearchParams } from 'expo-router';
import PublicMeetingAgendaByMeetingIdScreen from '@/components/PublicMeetingAgendaByMeetingIdScreen';

/** Legacy short URL: /weblogin/a/{meetingId} */
export default function PublicMeetingAgendaShortLinkPage() {
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  return <PublicMeetingAgendaByMeetingIdScreen meetingIdParam={meetingId} />;
}

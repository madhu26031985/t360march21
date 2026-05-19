import { supabase } from '@/lib/supabase';
import type { MeetingsTabMeeting, MeetingsTabSnapshot } from '@/lib/meetingsTabSessionCache';
import { writeMeetingsTabSession } from '@/lib/meetingsTabSessionCache';

const MEETING_SELECT =
  'id, meeting_title, meeting_date, meeting_number, meeting_start_time, meeting_end_time, meeting_mode, meeting_location, meeting_link, meeting_status, meeting_day';

type RawMeeting = Omit<MeetingsTabMeeting, 'isPlaceholder'>;

function filterOpenWithinWindow(rows: RawMeeting[]): RawMeeting[] {
  const now = new Date();
  return rows.filter((meeting) => {
    const meetingEndDateTime = new Date(
      `${meeting.meeting_date}T${meeting.meeting_end_time || '23:59:59'}`
    );
    const hoursSinceMeetingEnd =
      (now.getTime() - meetingEndDateTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceMeetingEnd < 4;
  });
}

function buildOpenMeetingState(openMeetings: RawMeeting[]): Pick<
  MeetingsTabSnapshot,
  'currentMeeting' | 'nextMeetings' | 'hasOnlyOneOpenMeeting'
> {
  if (openMeetings.length === 0) {
    return { currentMeeting: null, nextMeetings: [], hasOnlyOneOpenMeeting: false };
  }

  const nextOpenMeetings = openMeetings.slice(1, 3);
  const totalMeetingsNeeded = 3;
  const placeholdersNeeded = Math.max(0, totalMeetingsNeeded - openMeetings.length);

  const placeholders: MeetingsTabMeeting[] = Array.from({ length: placeholdersNeeded }, (_, index) => ({
    id: `placeholder-${index}`,
    meeting_title: 'Coming Soon',
    meeting_date: '',
    meeting_number: null,
    meeting_start_time: null,
    meeting_end_time: null,
    meeting_mode: '',
    meeting_location: null,
    meeting_link: null,
    meeting_status: 'placeholder',
    meeting_day: null,
    isPlaceholder: true,
  }));

  return {
    currentMeeting: openMeetings[0],
    hasOnlyOneOpenMeeting: openMeetings.length === 1,
    nextMeetings: [...nextOpenMeetings, ...placeholders].slice(0, 2),
  };
}

async function fetchVpeName(clubId: string): Promise<string> {
  try {
    const { data: clubProfile, error } = await supabase
      .from('club_profiles')
      .select(
        `
          vpe_id,
          app_user_profiles!club_profiles_vpe_id_fkey (
            full_name
          )
        `
      )
      .eq('club_id', clubId)
      .maybeSingle();

    if (error) {
      console.error('Error loading VPE info:', error);
      return 'VPE';
    }

    const vpeProfile = clubProfile?.app_user_profiles as { full_name: string } | null;
    return vpeProfile?.full_name?.trim() || 'VPE';
  } catch (error) {
    console.error('Error loading VPE info:', error);
    return 'VPE';
  }
}

/** Loads open meetings, history, and VPE name for the Meetings tab. */
export async function fetchMeetingsTabSnapshot(clubId: string): Promise<MeetingsTabSnapshot> {
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
  const cutoffDate = fourHoursAgo.toISOString().split('T')[0];

  const [openRes, historyRes, vpeName] = await Promise.all([
    supabase
      .from('app_club_meeting')
      .select(MEETING_SELECT)
      .eq('club_id', clubId)
      .eq('meeting_status', 'open')
      .gte('meeting_date', cutoffDate)
      .order('meeting_date', { ascending: true })
      .order('meeting_start_time', { ascending: true }),
    supabase
      .from('app_club_meeting')
      .select(MEETING_SELECT)
      .eq('club_id', clubId)
      .eq('meeting_status', 'close')
      .order('meeting_date', { ascending: false })
      .order('meeting_start_time', { ascending: false })
      .limit(50),
    fetchVpeName(clubId),
  ]);

  const { data: openData, error: openError } = openRes;
  const { data: historyData, error: historyError } = historyRes;

  if (historyError) {
    console.error('Error loading meeting history:', historyError);
  }
  if (openError) {
    console.error('Error loading open meetings:', openError);
  }

  const openMeetings = openError ? [] : filterOpenWithinWindow((openData as RawMeeting[]) || []);
  const openState = buildOpenMeetingState(openMeetings);

  return {
    clubId,
    at: Date.now(),
    meetingHistory: historyError ? [] : ((historyData as MeetingsTabMeeting[]) || []),
    vpeName,
    ...openState,
  };
}

/** Fire-and-forget prefetch (e.g. from Home) before user opens Meetings tab. */
export function prefetchMeetingsTabSession(clubId: string | null | undefined): void {
  if (!clubId) return;
  void fetchMeetingsTabSnapshot(clubId)
    .then((snapshot) => writeMeetingsTabSession(snapshot))
    .catch(() => {
      /* ignore prefetch errors */
    });
}

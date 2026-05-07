export interface MeetingOgPayload {
  clubName: string;
  meetingTitle: string;
  meetingDate: string;
  meetingNumberLabel: string;
  meetingTime?: string;
}

/**
 * Load copy for OG art. Plug in Supabase/RPC next to mirror `get_public_meeting_agenda*` from your Expo app.
 * Keep this Edge-safe if your OG route uses `runtime = 'edge'`.
 */
export async function getMeetingOgPayload(meetingId: string): Promise<MeetingOgPayload> {
  const id = decodeURIComponent(meetingId).trim();
  // Example: swap for Supabase RPC + early return real rows.

  void id;

  return {
    clubName: 'Toastmasters Demo Club',
    meetingTitle: 'Club Meeting Agenda',
    meetingDate: 'Wednesday, Jun 25, 2025',
    meetingNumberLabel: 'Meeting 12',
    meetingTime: '20:30 - 21:30',
  };
}

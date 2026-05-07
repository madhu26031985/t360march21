export type OgTheme = 'default' | 'minimal' | 'vibrant';

export type MeetingOgInput = {
  id: string;
  formattedDate: string;
  formattedTime?: string | null;
  meetingNumber?: string | number | null;
};

export type ClubOgInput = {
  name: string;
};

export function generateOgImageUrl(
  meeting: MeetingOgInput,
  club: ClubOgInput,
  theme: OgTheme = 'default',
) {
  const baseUrl = `https://app.t360.in/api/og/meeting/${encodeURIComponent(meeting.id)}`;
  const params = new URLSearchParams({
    club: club.name || 'T-360 Training Club',
    date: meeting.formattedDate || 'May 7, 2026',
    time: meeting.formattedTime || '20:30 - 21:30',
    no: String(meeting.meetingNumber ?? '0205'),
    theme,
  });
  return `${baseUrl}?${params.toString()}`;
}

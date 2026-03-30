/** Public web host for shareable meeting agenda URLs (must match hosting / routing). */
export const AGENDA_WEB_HOST = 'https://app.t360.in';

/**
 * URL-safe club segment: lowercase alphanumerics only, e.g. "T-360 Training Club" → "t360trainingclub".
 */
export function slugifyClubNameForAgendaUrl(clubName: string): string {
  const s = clubName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 96);
  return s || 'club';
}

export function sanitizeMeetingNumberSegment(meetingNumber: string | null | undefined): string {
  if (meetingNumber == null || String(meetingNumber).trim() === '') return '0';
  const t = String(meetingNumber).trim().replace(/[^a-zA-Z0-9._-]/g, '');
  return t || '0';
}

export function buildAgendaWebUrl(params: {
  clubName: string;
  meetingNumber: string | null | undefined;
  meetingId: string;
}): string {
  const slug = slugifyClubNameForAgendaUrl(params.clubName);
  const num = sanitizeMeetingNumberSegment(params.meetingNumber);
  return `${AGENDA_WEB_HOST}/${slug}/${num}/${params.meetingId}`;
}

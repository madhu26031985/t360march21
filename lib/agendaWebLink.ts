/**
 * Shareable public agenda URLs (no login).
 * Path: /{clubId}/agenda/{meetingNo}/{meetingId}
 *
 * Default host is https://t360.in — point that domain at the same Netlify site as the app, or set
 * EXPO_PUBLIC_AGENDA_WEB_HOST (e.g. https://app.t360.in) at build time.
 */
function agendaWebHost(): string {
  const h = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.trim();
  if (h) return h.replace(/\/$/, '');
  return 'https://t360.in';
}

export function getAgendaWebHost(): string {
  return agendaWebHost();
}

export function sanitizeMeetingNumberSegment(meetingNumber: string | null | undefined): string {
  if (meetingNumber == null || String(meetingNumber).trim() === '') return '0';
  const t = String(meetingNumber).trim().replace(/[^a-zA-Z0-9._-]/g, '');
  return t || '0';
}

export function buildAgendaWebUrl(params: {
  clubId: string;
  meetingNumber: string | null | undefined;
  meetingId: string;
}): string {
  const num = sanitizeMeetingNumberSegment(params.meetingNumber);
  const path = `/${params.clubId}/agenda/${num}/${params.meetingId}`;
  return `${agendaWebHost()}${path}`;
}

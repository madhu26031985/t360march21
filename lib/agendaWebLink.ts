/**
 * Shareable public agenda URLs (no login).
 * Path includes Expo `experiments.baseUrl` so the link matches the real URL in the browser:
 * /weblogin/{clubId}/agenda/{meetingNo}/{meetingId}
 *
 * Shorter URLs without /weblogin still work: Netlify redirects them to this path.
 *
 * Default host is https://t360.in — or set EXPO_PUBLIC_AGENDA_WEB_HOST (e.g. https://app.t360.in).
 */
export const AGENDA_WEB_PATH_PREFIX = '/weblogin';
function agendaWebHost(): string {
  const h = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.trim();
  if (h) return h.replace(/\/$/, '');
  return 'https://t360.in';
}

export function getAgendaWebHost(): string {
  return agendaWebHost();
}

/** First UUID in a path/query segment (handles pasted URL + trailing junk). */
export function extractUuidFromRouteParam(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || String(s).trim() === '') return null;
  let decoded = String(s).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* already decoded or bad % */
  }
  const m = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

/** Meeting number segment only; strips spaces or pasted text after the number. */
export function extractMeetingNoFromRouteParam(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || String(s).trim() === '') return null;
  let decoded = String(s).trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    /* ignore */
  }
  const m = decoded.match(/^([a-zA-Z0-9._-]+)/);
  return m ? m[1] : null;
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
  const path = `${AGENDA_WEB_PATH_PREFIX}/${params.clubId}/agenda/${num}/${params.meetingId}`;
  return `${agendaWebHost()}${path}`;
}

/** Visual layout for the public (web) meeting agenda page. Use `?skin=` on the URL. */
export type PublicAgendaSkinId = 'default' | 'minimal' | 'vibrant';

export const PUBLIC_AGENDA_SKIN_IDS: PublicAgendaSkinId[] = ['default', 'minimal', 'vibrant'];

export function normalizePublicAgendaSkin(
  raw: string | string[] | undefined
): PublicAgendaSkinId {
  const v = String(Array.isArray(raw) ? raw[0] : raw ?? '')
    .toLowerCase()
    .trim();
  if (v === 'minimal' || v === 'vibrant') return v;
  return 'default';
}

/** Normalizes a DB value for meeting.public_agenda_skin. */
export function normalizeStoredPublicAgendaSkin(
  raw: string | null | undefined
): PublicAgendaSkinId {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'minimal' || v === 'vibrant') return v;
  return 'default';
}

/** `?skin=` in URL — returns null if absent so caller can use meeting default. */
export function publicAgendaSkinFromUrlParam(
  raw: string | string[] | undefined
): PublicAgendaSkinId | null {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || String(s).trim() === '') return null;
  return normalizePublicAgendaSkin(s);
}

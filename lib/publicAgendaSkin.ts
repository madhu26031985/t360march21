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

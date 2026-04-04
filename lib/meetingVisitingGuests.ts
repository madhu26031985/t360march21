/**
 * Meeting visiting guests: up to 5 name-only slots (no app account).
 * Backed by `app_meeting_visiting_guests`; included in Timer / Ah Counter / Grammarian snapshots.
 */

export type MeetingVisitingGuest = {
  id: string;
  meeting_id: string;
  club_id: string;
  slot_number: number;
  display_name: string;
  created_at?: string;
  updated_at?: string;
};

export function parseMeetingVisitingGuests(raw: unknown): MeetingVisitingGuest[] {
  if (!Array.isArray(raw)) return [];
  const out: MeetingVisitingGuest[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = o.id != null ? String(o.id) : '';
    const meeting_id = o.meeting_id != null ? String(o.meeting_id) : '';
    const club_id = o.club_id != null ? String(o.club_id) : '';
    const slot_number = Number(o.slot_number);
    const display_name = o.display_name != null ? String(o.display_name).trim() : '';
    if (!id || !meeting_id || !club_id || slot_number < 1 || slot_number > 5 || !display_name) continue;
    out.push({
      id,
      meeting_id,
      club_id,
      slot_number,
      display_name,
      created_at: o.created_at != null ? String(o.created_at) : undefined,
      updated_at: o.updated_at != null ? String(o.updated_at) : undefined,
    });
  }
  out.sort((a, b) => a.slot_number - b.slot_number);
  return out;
}

/** Five strings for slots 1–5 (UI draft). */
export function visitingGuestInputsFromRows(rows: MeetingVisitingGuest[]): string[] {
  const out = ['', '', '', '', ''];
  for (const r of rows) {
    const s = r.slot_number;
    if (s >= 1 && s <= 5) out[s - 1] = (r.display_name || '').trim();
  }
  return out;
}

export const VISITING_GUEST_SLOT_COUNT = 5;

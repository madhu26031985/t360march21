/** Shared parser for meeting_agenda_items.prepared_speeches_agenda (member + public web). */
export function parseMemberPreparedAgenda(raw: unknown): Array<{
  slot: number;
  booked: boolean;
  is_visible: boolean;
  speaker_user_id: string | null;
  speaker_name: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  level: number | null;
  project_number: string | null;
  project_name: string | null;
  evaluation_form: string | null;
  evaluator_user_id: string | null;
  evaluator_name: string | null;
}> {
  if (raw == null) return [];
  let arr: unknown[] = [];
  try {
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === 'string') arr = JSON.parse(raw) as unknown[];
  } catch {
    return [];
  }
  return arr
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map((s) => ({
      slot: Number(s.slot) || 0,
      booked: !!s.booked,
      is_visible: s.is_visible !== false,
      speaker_user_id: (s.speaker_user_id as string) || null,
      speaker_name: (s.speaker_name as string) || null,
      speech_title: (s.speech_title as string) || null,
      pathway_name: (s.pathway_name as string) || null,
      level: s.level != null ? Number(s.level) : null,
      project_number: s.project_number != null ? String(s.project_number) : null,
      project_name: (s.project_name as string) || null,
      evaluation_form: (s.evaluation_form as string) || null,
      evaluator_user_id: (s.evaluator_user_id as string) || null,
      evaluator_name: (s.evaluator_name as string) || null,
    }))
    .filter((s) => s.slot >= 1 && s.slot <= 5)
    .sort((a, b) => a.slot - b.slot);
}

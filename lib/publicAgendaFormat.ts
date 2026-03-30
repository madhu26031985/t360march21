import { parseMemberPreparedAgenda } from '@/lib/preparedSpeechesAgendaParse';
import type { PublicAgendaItemRow } from '@/lib/publicAgendaQuery';

export function formatPublicAgendaMeetingDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function preparedSlotsForPublic(item: PublicAgendaItemRow) {
  const parsed = parseMemberPreparedAgenda(item.prepared_speeches_agenda);
  const str = (v: unknown) => (v != null && String(v).trim() !== '' ? 1 : 0);
  const hasContent = (s: (typeof parsed)[0]) => {
    if (s.booked) return true;
    return (
      str(s.speaker_name) +
        str(s.speech_title) +
        str(s.pathway_name) +
        str(s.project_name) +
        str(s.evaluator_name) +
        str(s.evaluation_form) +
        (s.level != null ? 1 : 0) +
        str(s.project_number) >
      0
    );
  };
  return parsed.filter((s) => s.is_visible && hasContent(s));
}

export function publicAgendaRoleDetailLines(rd: Record<string, unknown> | null): string[] {
  if (!rd) return [];
  const lines: string[] = [];
  const pick = (k: string) => {
    const v = rd[k];
    if (v != null && String(v).trim() !== '') lines.push(String(v));
  };
  pick('speech_title');
  pick('pathway_name');
  if (rd.pathway_level != null) lines.push(`Level ${rd.pathway_level}`);
  pick('project_title');
  pick('table_topic_question');
  pick('educational_topic');
  pick('summary');
  const g = rd.grammarian_corner as Record<string, unknown> | undefined;
  if (g && typeof g === 'object' && g.word_of_the_day != null && String(g.word_of_the_day).trim() !== '') {
    lines.push(`Word of the day: ${String(g.word_of_the_day)}`);
  }
  return lines;
}

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

function lexiconText(val: unknown, objectKey: 'word' | 'quote' | 'idiom'): string {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object' && val !== null && objectKey in val) {
    const o = val as Record<string, unknown>;
    const raw = o[objectKey];
    return raw != null ? String(raw).trim() : '';
  }
  return '';
}

/** Labels for grammarian_corner JSON on agenda role_details (strings or nested objects from editor). */
export function grammarianCornerLinesFromRoleDetails(rd: Record<string, unknown> | null): string[] {
  if (!rd) return [];
  const g = rd.grammarian_corner as Record<string, unknown> | undefined;
  if (!g || typeof g !== 'object') return [];
  const lines: string[] = [];
  const vis = (k: string) => g[k] !== false;

  if (vis('word_visible')) {
    const w = lexiconText(g.word_of_the_day, 'word');
    if (w) lines.push(`Word of the day: ${w}`);
  }
  if (g.phrase_of_the_day != null && String(g.phrase_of_the_day).trim() !== '') {
    lines.push(`Phrase of the day: ${String(g.phrase_of_the_day).trim()}`);
  }
  if (vis('quote_visible')) {
    const q = lexiconText(g.quote_of_the_day, 'quote');
    if (q) lines.push(`Quote of the day: ${q}`);
  }
  if (vis('idiom_visible')) {
    const i = lexiconText(g.idiom_of_the_day, 'idiom');
    if (i) lines.push(`Idiom of the day: ${i}`);
  }
  return lines;
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
  lines.push(...grammarianCornerLinesFromRoleDetails(rd));
  return lines;
}

/**
 * Full description column for public minimal (Notion-style) agenda: section text,
 * theme, speech metadata, grammarian lexicon, prepared slots, notes.
 */
export function buildMinimalAgendaDescriptionLines(item: PublicAgendaItemRow): string[] {
  const out: string[] = [];
  if (item.section_description?.trim()) {
    out.push(item.section_description.trim());
  }
  const rd =
    item.role_details && typeof item.role_details === 'object'
      ? (item.role_details as Record<string, unknown>)
      : null;
  if (rd) {
    if (rd.theme_of_the_day != null && String(rd.theme_of_the_day).trim() !== '') {
      out.push(`Theme of the day: ${String(rd.theme_of_the_day).trim()}`);
    }
    if (rd.speech_title != null && String(rd.speech_title).trim() !== '') {
      out.push(`Speech title: ${String(rd.speech_title).trim()}`);
    }
    if (rd.pathway_name != null && String(rd.pathway_name).trim() !== '') {
      out.push(`Pathway: ${String(rd.pathway_name).trim()}`);
    }
    if (rd.pathway_level != null) {
      out.push(`Level: ${String(rd.pathway_level)}`);
    }
    if (rd.project_title != null && String(rd.project_title).trim() !== '') {
      out.push(`Project: ${String(rd.project_title).trim()}`);
    }
    if (rd.table_topic_question != null && String(rd.table_topic_question).trim() !== '') {
      out.push(`Table topic: ${String(rd.table_topic_question).trim()}`);
    }
    if (rd.educational_topic != null && String(rd.educational_topic).trim() !== '') {
      out.push(`Topic: ${String(rd.educational_topic).trim()}`);
    }
    if (rd.summary != null && String(rd.summary).trim() !== '') {
      out.push(String(rd.summary).trim());
    }
    out.push(...grammarianCornerLinesFromRoleDetails(rd));
  }
  if (item.educational_topic?.trim()) {
    const t = item.educational_topic.trim();
    if (!out.some((l) => l.endsWith(t) || l === `Topic: ${t}`)) {
      out.push(`Topic: ${t}`);
    }
  }
  const slots = preparedSlotsForPublic(item);
  for (const s of slots) {
    const block: string[] = [];
    block.push(
      s.speaker_name
        ? `Prepared Speaker ${s.slot}: ${s.speaker_name}`
        : `Prepared Speaker ${s.slot}`
    );
    if (s.speech_title?.trim()) block.push(`Title: ${s.speech_title.trim()}`);
    const pathProj = [s.pathway_name, s.project_name].filter(Boolean).join(' · ');
    if (pathProj) block.push(pathProj);
    if (s.level != null || s.project_number) {
      const lv = [
        s.level != null ? `L${s.level}` : '',
        s.project_number ? `P${s.project_number}` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (lv) block.push(lv);
    }
    if (s.evaluator_name?.trim()) block.push(`Evaluator: ${s.evaluator_name.trim()}`);
    out.push(block.join('\n'));
  }
  if (item.custom_notes?.trim()) {
    out.push(item.custom_notes.trim());
  }
  return out;
}

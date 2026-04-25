import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import {
  buildMinimalAgendaDescriptionLines,
  formatPublicAgendaBannerDateShort,
  formatPublicAgendaBannerTimePart,
  formatPublicAgendaMeetingDate,
  grammarianCornerLinesFromRoleDetails,
  preparedSlotsForPublic,
  publicAgendaRoleDetailLines,
} from '@/lib/publicAgendaFormat';
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';
import type { PublicAgendaItemRow, PublicAgendaPayload } from '@/lib/publicAgendaQuery';

type AppTheme = ReturnType<typeof useTheme>['theme'];

/** Minimal skin: avoid pure black (#000) and red accents; use neutral greys on light docs. */
type MinimalDocInk = { ink: string; inkMuted: string; inkSoft: string };

const IS_MOBILE = Platform.OS === 'ios' || Platform.OS === 'android';
/** Inter-first stack for minimal agenda header (wireframe typography). */
const MINIMAL_HEADER_FONT_FAMILY = Platform.select({
  ios: 'Inter',
  android: 'Inter',
  default: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});
const MINIMAL_AGENDA_FONT_FAMILY = Platform.select({
  ios: 'Avenir Next',
  android: 'Roboto',
  default:
    'Inter, Segoe UI, SF Pro Text, -apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif',
});
const MINIMAL_AGENDA_HEADING_TRACKING = Platform.select({
  ios: 0.2,
  android: 0.15,
  default: 0.25,
});
const MINIMAL_AGENDA_BODY_TRACKING = Platform.select({
  ios: 0.1,
  android: 0.05,
  default: 0.12,
});
const MINIMAL_FONT_SCALE = 1.02;
const ms = (size: number): number => Math.round(size * MINIMAL_FONT_SCALE * 100) / 100;

function minimalDocTextColors(theme: AppTheme): MinimalDocInk {
  const bg = theme.colors.background.toLowerCase();
  const isLightDoc = bg === '#ffffff' || bg === '#fff';
  if (!isLightDoc) {
    return {
      ink: theme.colors.text,
      inkMuted: theme.colors.textSecondary,
      inkSoft: theme.colors.textTertiary,
    };
  }
  return { ink: '#3a3a3a', inkMuted: '#6b6b6b', inkSoft: '#949494' };
}

function deLinkDigits(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  // Insert word joiners between digits to avoid mobile browser auto-link underlines.
  return raw.replace(/\d(?=\d)/g, '$&\u2060');
}

function formatClubMetaToken(value: string | null | undefined): string {
  const v = deLinkDigits(value).trim();
  if (!v) return '';
  return v.length === 1 ? v.toUpperCase() : v;
}

/** Premium soft shell — no fill color; web shadow + native elevation. */
function minimalHeaderShellShadow(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 1px 2px rgba(15,15,15,0.05), 0 10px 32px rgba(15,15,15,0.06)',
    } as ViewStyle;
  }
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    };
  }
  return { elevation: 2 };
}

function vibrantCardExtra(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
    } as ViewStyle;
  }
  return { elevation: 8 };
}

/** Time column: HH:mm–HH:mm (seconds stripped). */
function formatMinimalAgendaTimeRange(start: string | null, end: string | null): string {
  const a = start ? formatPublicAgendaBannerTimePart(start) : '';
  const b = end ? formatPublicAgendaBannerTimePart(end) : '';
  if (a && b) return `${a}–${b}`;
  if (a) return a;
  if (b) return b;
  return '';
}

/** Bottom-right duration copy: "15 minutes" / "1 minute". */
function formatMinimalDurationWords(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 'Duration : TBA';
  const n = Math.round(minutes);
  if (n === 1) return 'Duration : 1 min';
  return `Duration : ${n} mins`;
}

function sectionNameLower(sectionName: string): string {
  return (sectionName || '').toLowerCase();
}

function agendaRoleDetails(item: PublicAgendaItemRow): Record<string, unknown> | null {
  if (!item.role_details || typeof item.role_details !== 'object') return null;
  return item.role_details as Record<string, unknown>;
}

function rdTrim(rd: Record<string, unknown> | null, key: string): string {
  if (!rd) return '';
  const v = rd[key];
  if (v == null) return '';
  return String(v).trim();
}

function isLikelyTruncatedName(name: string): boolean {
  return /\.\.\.$/.test(name.trim());
}

function expandTruncatedName(
  name: string | null | undefined,
  knownFullNames: readonly string[]
): string | null {
  const raw = name?.trim();
  if (!raw) return null;
  if (!isLikelyTruncatedName(raw)) return raw;
  const prefix = raw.replace(/\.\.\.$/, '').trim().toLowerCase();
  if (!prefix) return raw;
  const match = knownFullNames.find((n) => n.toLowerCase().startsWith(prefix));
  return match || raw;
}

function collectKnownFullNames(items: readonly PublicAgendaItemRow[]): string[] {
  const out = new Set<string>();
  const push = (v: string | null | undefined) => {
    const t = v?.trim();
    if (!t || isLikelyTruncatedName(t)) return;
    out.add(t);
  };
  for (const item of items) {
    push(item.assigned_user_name);
    push(item.timer_user_name);
    push(item.ah_counter_user_name);
    push(item.grammarian_user_name);
    for (const slot of preparedSlotsForPublic(item)) {
      push(slot.speaker_name);
      push(slot.evaluator_name);
    }
  }
  return Array.from(out);
}

function normalizeAgendaNames(items: readonly PublicAgendaItemRow[]): PublicAgendaItemRow[] {
  const knownFullNames = collectKnownFullNames(items);
  return items.map((item) => ({
    ...item,
    assigned_user_name: expandTruncatedName(item.assigned_user_name, knownFullNames),
    timer_user_name: expandTruncatedName(item.timer_user_name, knownFullNames),
    ah_counter_user_name: expandTruncatedName(item.ah_counter_user_name, knownFullNames),
    grammarian_user_name: expandTruncatedName(item.grammarian_user_name, knownFullNames),
  }));
}

/** Role-style label before the assignee name (footer: label regular weight, name bold). */
function minimalRoleHeadingForSection(sectionName: string): string {
  const s = sectionNameLower(sectionName);
  if (s.includes('meet and greet') || s.includes('meet & greet')) return 'Everyone';
  if (s.includes('call to order')) return 'Serjeant-at-Arms';
  if (s.includes('presiding officer')) return 'President';
  if (s.includes('toastmaster')) return 'Toastmaster';
  if (s.includes('general evaluator')) return 'General Evaluator';
  if (s.includes('educational')) return 'Educational speaker';
  if (s.includes('prepared speeches') || s.includes('prepared speech')) return 'Speakers';
  if (s.includes('table topic')) return 'Table Topics';
  if (s.includes('ice breaker')) return 'Ice Breakers';
  if (s.includes('ah counter')) return 'Ah Counter';
  if (s.includes('grammarian')) return 'Grammarian';
  if (s.includes('timer')) return 'Timer';
  if (s.includes('speech evaluation')) return 'Evaluator';
  return 'Role';
}

function minimalAssignedHeading(): string {
  return 'Assigned :';
}

function isPreparedSpeechesMinimalSection(sectionName: string): boolean {
  return sectionNameLower(sectionName).includes('prepared speech');
}

function isSpeechEvaluationMinimalSection(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  if (s.includes('general evaluator')) return false;
  return s.includes('speech evaluation');
}

function isEducationalMinimalSection(sectionName: string): boolean {
  return sectionNameLower(sectionName).includes('educational');
}

function isKeynoteMinimalSection(sectionName: string): boolean {
  return sectionNameLower(sectionName).includes('keynote speaker');
}

function isThemeOnStackSection(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('toastmaster') || isEducationalMinimalSection(sectionName);
}

function isGrammarianMinimalSection(sectionName: string): boolean {
  return sectionNameLower(sectionName).includes('grammarian');
}

/** Toastmaster-of-the-Day style card (theme stack + avatar row); not used for generic "toastmaster" elsewhere if any. */
function isToastmasterStackSection(sectionName: string): boolean {
  return sectionNameLower(sectionName).includes('toastmaster');
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
}

/** Theme / topic text shown in the dedicated stack block (TMOD + educational). */
function themeOrTopicForStack(item: PublicAgendaItemRow, meetingTheme?: string | null): string {
  const rd = agendaRoleDetails(item);
  const fromRd = rdTrim(rd, 'theme_of_the_day');
  if (fromRd) return fromRd;
  if (isEducationalMinimalSection(item.section_name)) {
    return item.educational_topic?.trim() || '';
  }
  if (isToastmasterStackSection(item.section_name)) {
    return meetingTheme?.trim() || '';
  }
  return '';
}

function isMeetAndGreetSection(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('meet and greet') || s.includes('meet & greet');
}

function isTagTeamIntroductionSection(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('tag team');
}

function allowsTwoLineTitle(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('general evaluator opening');
}

/** People line: Meet and Greet → "All"; otherwise assigned and tag names (no role abbreviations). */
function buildMinimalPeopleLines(item: PublicAgendaItemRow): string[] {
  if (isMeetAndGreetSection(item.section_name)) {
    return ['All'];
  }

  const lines: string[] = [];
  const seen = new Set<string>();

  const pushName = (name: string | null | undefined) => {
    const n = name?.trim();
    if (!n || seen.has(n)) return;
    lines.push(n);
    seen.add(n);
  };

  pushName(item.assigned_user_name);
  pushName(item.timer_user_name);
  pushName(item.ah_counter_user_name);
  pushName(item.grammarian_user_name);

  const slots = preparedSlotsForPublic(item);
  for (const s of slots) {
    if (s.speaker_name?.trim()) {
      lines.push(`Speaker ${s.slot}: ${s.speaker_name.trim()}`);
    }
    if (s.evaluator_name?.trim()) {
      lines.push(`Evaluator ${s.slot}: ${s.evaluator_name.trim()}`);
    }
  }

  return lines;
}

/** Names / role lines for below description; no placeholder hyphens. */
function minimalCardPeopleLines(item: PublicAgendaItemRow): string[] {
  return buildMinimalPeopleLines(item)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '—' && s !== '–');
}

/** Prepared / evaluator lines from `buildMinimalPeopleLines` → heading + name (PDF-style rows). */
function parseSpeakerEvaluatorHeading(line: string): { heading: string; name: string } | null {
  const m = line.match(/^(speaker|evaluator)\s+(\d+)\s*:\s*(.+)$/i);
  if (!m) return null;
  const kind = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return { heading: `${kind} ${m[2]}`, name: m[3].trim() };
}

function lineLabelForMinimalFooterRow(item: PublicAgendaItemRow, line: string): string {
  if (item.timer_user_name?.trim() === line) return 'Timer';
  if (item.ah_counter_user_name?.trim() === line) return 'Ah Counter';
  if (item.grammarian_user_name?.trim() === line) return 'Grammarian';
  return minimalRoleHeadingForSection(item.section_name);
}

function minimalFooterRows(item: PublicAgendaItemRow): { heading: string; name: string }[] {
  if (isMeetAndGreetSection(item.section_name)) {
    return [{ heading: minimalAssignedHeading(), name: 'All' }];
  }
  if (isTagTeamIntroductionSection(item.section_name)) {
    const tagRows: { heading: string; name: string }[] = [];
    const timerName = item.timer_user_name?.trim();
    const ahName = item.ah_counter_user_name?.trim();
    const grammarianName = item.grammarian_user_name?.trim();
    tagRows.push({ heading: 'Timer :', name: timerName || 'TBA' });
    tagRows.push({ heading: 'Ah Counter :', name: ahName || 'TBA' });
    tagRows.push({ heading: 'Grammarian :', name: grammarianName || 'TBA' });
    return tagRows;
  }
  const skipSpeakerEvaluatorLines =
    isPreparedSpeechesMinimalSection(item.section_name) ||
    isSpeechEvaluationMinimalSection(item.section_name);
  const preparedSlotNames = (() => {
    if (!isPreparedSpeechesMinimalSection(item.section_name)) return new Set<string>();
    const set = new Set<string>();
    for (const s of preparedSlotsForPublic(item)) {
      if (s.speaker_name?.trim()) set.add(s.speaker_name.trim());
      if (s.evaluator_name?.trim()) set.add(s.evaluator_name.trim());
    }
    return set;
  })();
  const evalShapeForFooter = isSpeechEvaluationMinimalSection(item.section_name)
    ? speechEvalDisplayShape(item)
    : null;

  const lines = minimalCardPeopleLines(item);
  const out: { heading: string; name: string }[] = [];
  for (const line of lines) {
    const parsed = parseSpeakerEvaluatorHeading(line);
    if (parsed && skipSpeakerEvaluatorLines) {
      continue;
    }
    if (parsed) {
      out.push(parsed);
      continue;
    }
    if (preparedSlotNames.size > 0 && preparedSlotNames.has(line)) {
      continue;
    }
    if (evalShapeForFooter) {
      const sp = evalShapeForFooter.speaker_name?.trim();
      const ev = evalShapeForFooter.evaluator_name?.trim();
      if ((sp && line === sp) || (ev && line === ev)) {
        continue;
      }
    }
    out.push({ heading: minimalAssignedHeading(), name: line });
  }
  if (out.length === 0) {
    return [{ heading: minimalAssignedHeading(), name: 'TBA' }];
  }
  return out;
}

function shouldSuppressAssignedTba(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return (
    s.includes('grammarian') ||
    s.includes('prepared speech') ||
    s.includes('ancillary') ||
    s.includes('speech evaluation') ||
    s.includes('break') ||
    s.includes('voting') ||
    s.includes('listener') ||
    s.includes('listner')
  );
}

function shouldSuppressDurationTba(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('grammarian');
}

function shouldHideFooterTime(sectionName: string): boolean {
  const s = sectionNameLower(sectionName);
  return s.includes('grammarian corner');
}

function minimalCardDescriptionPreview(item: PublicAgendaItemRow, meetingTheme?: string | null): string {
  const stackTheme = themeOrTopicForStack(item, meetingTheme);
  const showThemeBlock =
    isToastmasterStackSection(item.section_name) ||
    (isThemeOnStackSection(item.section_name) && Boolean(stackTheme));
  const topicTrim = item.educational_topic?.trim();

  const rawLines = buildMinimalAgendaDescriptionLines(item);
  const filtered = rawLines.filter((l) => {
    const t = l.trim();
    if (showThemeBlock && /^theme of the day:/i.test(t)) return false;
    if (showThemeBlock && topicTrim && t === `Topic: ${topicTrim}`) return false;
    return true;
  });

  const normalize = (value: string): string =>
    value
      .replace(/\r\n/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  if (filtered.length > 0) return normalize(filtered[0]!);
  const fallback = item.section_description?.trim() || '';
  return fallback ? normalize(fallback) : '';
}

type MinimalSlotDisplay = {
  slot: number;
  speaker_name: string | null;
  evaluator_name: string | null;
  speech_title: string | null;
  pathway_name: string | null;
  project_name: string | null;
  level: number | null;
  project_number: string | null;
  evaluation_form: string | null;
};

function slotToDisplayShape(s: ReturnType<typeof preparedSlotsForPublic>[number]): MinimalSlotDisplay {
  return {
    slot: s.slot,
    speaker_name: s.speaker_name,
    evaluator_name: s.evaluator_name,
    speech_title: s.speech_title,
    pathway_name: s.pathway_name,
    project_name: s.project_name,
    level: s.level,
    project_number: s.project_number,
    evaluation_form: s.evaluation_form,
  };
}

function speechEvalDisplayShape(item: PublicAgendaItemRow): MinimalSlotDisplay | null {
  const slots = preparedSlotsForPublic(item);
  if (slots.length > 0) {
    const base = slotToDisplayShape(slots[0]!);
    const ev = slots[0]!.evaluator_name?.trim() || item.assigned_user_name?.trim() || null;
    return { ...base, evaluator_name: ev };
  }
  const rd = agendaRoleDetails(item);
  if (!rd) return null;
  const title = rdTrim(rd, 'speech_title');
  const speaker = rdTrim(rd, 'speaker_name');
  const evaluator =
    item.assigned_user_name?.trim() || rdTrim(rd, 'evaluator_name') || rdTrim(rd, 'evaluator');
  const pathway = rdTrim(rd, 'pathway_name');
  const project = rdTrim(rd, 'project_title') || rdTrim(rd, 'project_name');
  const levelRaw = rd.pathway_level;
  const level =
    levelRaw != null && Number.isFinite(Number(levelRaw)) ? Math.round(Number(levelRaw)) : null;
  const projNum = rdTrim(rd, 'project_number');
  const evalForm = rdTrim(rd, 'evaluation_form');
  if (!title && !speaker && !evaluator && !pathway && !project) return null;
  return {
    slot: 1,
    speaker_name: speaker || null,
    evaluator_name: evaluator || null,
    speech_title: title || null,
    pathway_name: pathway || null,
    project_name: project || null,
    level,
    project_number: projNum || null,
    evaluation_form: evalForm || null,
  };
}

function keynoteTitleForMinimal(item: PublicAgendaItemRow): string {
  const rd = agendaRoleDetails(item);
  const fromRoleDetails =
    rdTrim(rd, 'speech_title') || rdTrim(rd, 'keynote_title') || rdTrim(rd, 'title');
  if (fromRoleDetails) return fromRoleDetails;
  return '';
}

function evaluationFormUrl(raw: string | null | undefined): string | null {
  const u = raw?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return null;
}

function MinimalAgendaInnerSlotWell({
  slot,
  docInk,
  borderColor,
  wellBg,
  variant,
}: {
  slot: MinimalSlotDisplay;
  docInk: MinimalDocInk;
  borderColor: string;
  wellBg: string;
  variant: 'prepared' | 'evaluation';
}) {
  const speaker = slot.speaker_name?.trim() || '';
  const evaluator = slot.evaluator_name?.trim() || '';
  const formUrl = evaluationFormUrl(slot.evaluation_form);

  const preparedHasMeta =
    variant === 'prepared' &&
    (Boolean(slot.speech_title?.trim()) ||
      Boolean(slot.pathway_name?.trim()) ||
      Boolean(slot.project_name?.trim()) ||
      slot.level != null ||
      Boolean(slot.project_number?.trim()));

  const evalHasMeta =
    variant === 'evaluation' &&
    (Boolean(slot.pathway_name?.trim()) ||
      Boolean(slot.project_name?.trim()) ||
      slot.level != null ||
      Boolean(slot.project_number?.trim()));

  const personBlock = (role: string, name: string) => (
    <View style={styles.minItemInnerPersonCol}>
      <View style={styles.minItemInnerIdentityRow}>
        <View style={styles.minItemInnerIdentityBubble}>
          <Text style={styles.minItemInnerIdentityBubbleText}>{name ? initialsFromName(name) : '?'}</Text>
        </View>
        <View style={styles.minItemInnerIdentityTextCol}>
          {name ? (
            <Text style={[styles.minItemInnerPersonName, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
              {name}
            </Text>
          ) : (
            <Text style={[styles.minItemInnerPlaceholder, { color: docInk.inkSoft }]} maxFontSizeMultiplier={1.05}>
              TBA
            </Text>
          )}
          <Text style={[styles.minItemInnerRoleLabel, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
            {role}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.minItemInnerWell, { borderColor, backgroundColor: wellBg }]}>
      <View style={styles.minItemInnerSpeakerEvalRow}>
        {variant === 'evaluation' ? (
          <>
            {personBlock('Evaluator', evaluator)}
            <View style={[styles.minItemInnerVertRule, { backgroundColor: borderColor }]} />
            {personBlock('Speaker', speaker)}
          </>
        ) : (
          <>
            {personBlock('Speaker', speaker)}
            <View style={[styles.minItemInnerVertRule, { backgroundColor: borderColor }]} />
            {personBlock('Evaluator', evaluator)}
          </>
        )}
      </View>

      {variant === 'evaluation' && slot.speech_title?.trim() ? (
        <>
          <View style={[styles.minItemInnerHRule, { backgroundColor: borderColor }]} />
          <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
            <Text style={[styles.minItemInnerDetailPrefix, { color: docInk.inkMuted }]}>Title : </Text>
            <Text style={[styles.minItemInnerDetailValueStrong, { color: docInk.ink }]}>
              {slot.speech_title.trim()}
            </Text>
          </Text>
        </>
      ) : null}

      {preparedHasMeta ? (
        <View style={styles.minItemInnerDetailsBlock}>
          {slot.speech_title?.trim() ? (
            <View style={styles.minItemInnerDetailRow}>
              <Text
                style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
                maxFontSizeMultiplier={1.05}
              >
                <Text style={[styles.minItemInnerDetailPrefix, { color: docInk.inkMuted }]}>📄 Title : </Text>
                <Text style={[styles.minItemInnerDetailValueStrong, { color: docInk.ink }]}>
                  {slot.speech_title.trim()}
                </Text>
              </Text>
            </View>
          ) : null}
          {slot.pathway_name?.trim() ? (
            <View style={styles.minItemInnerDetailRow}>
              <Text style={[styles.minItemInnerDetailPrefix, { color: docInk.inkMuted }]}>🧭 Pathway: </Text>
              <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]}>{slot.pathway_name.trim()}</Text>
            </View>
          ) : null}
          {slot.project_name?.trim() ? (
            <View style={styles.minItemInnerDetailRow}>
              <Text style={[styles.minItemInnerDetailPrefix, { color: docInk.inkMuted }]}>📄 Project: </Text>
              <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]}>{slot.project_name.trim()}</Text>
            </View>
          ) : null}
          {(slot.level != null || slot.project_number?.trim()) ? (
            <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
              {slot.level != null ? `Level ${slot.level}` : ''}
              {slot.level != null && slot.project_number?.trim() ? '  ·  ' : ''}
              {slot.project_number?.trim() ? `Project ${slot.project_number.trim()}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {evalHasMeta ? (
        <View style={styles.minItemInnerDetailsBlock}>
          {(slot.pathway_name?.trim() || slot.project_name?.trim()) ? (
            <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
              {[slot.pathway_name?.trim(), slot.project_name?.trim()].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {(slot.level != null || slot.project_number?.trim()) ? (
            <Text style={[styles.minItemInnerDetailValue, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
              {slot.level != null ? `Level ${slot.level}` : ''}
              {slot.level != null && slot.project_number?.trim() ? '  ·  ' : ''}
              {slot.project_number?.trim() ? `Project ${slot.project_number.trim()}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {formUrl ? (
        <Pressable
          onPress={() => Linking.openURL(formUrl).catch(() => {})}
          style={({ pressed }) => [
            styles.minItemInnerFormBtn,
            {
              borderColor: '#1f6feb',
              backgroundColor: '#1f6feb',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.minItemInnerFormBtnText,
              { color: '#ffffff' },
            ]}
            maxFontSizeMultiplier={1.05}
          >
            📄 Evaluation form — Open
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function minimalCardWebShadow(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 1px 2px rgba(15,15,15,0.06), 0 4px 14px rgba(15,15,15,0.06)',
    } as ViewStyle;
  }
  return {};
}

function minimalCardWebPrintKeepTogether(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    } as ViewStyle;
  }
  return {};
}

function minimalCardWebPrintFlow(sectionName: string): ViewStyle {
  // Prepared Speeches can be long. Allow the outer card to flow across pages
  // to avoid orphaning heading/description with a large blank area.
  if (isPreparedSpeechesMinimalSection(sectionName)) {
    return {};
  }
  return minimalCardWebPrintKeepTogether();
}

function minimalInnerBlockWebPrintKeepTogether(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      breakInside: 'avoid',
      pageBreakInside: 'avoid',
    } as ViewStyle;
  }
  return {};
}

function MinimalAgendaItemCard({
  item,
  theme,
  meetingTheme,
  speechEvaluationFallbackSlots,
}: {
  item: PublicAgendaItemRow;
  theme: AppTheme;
  meetingTheme?: string | null;
  speechEvaluationFallbackSlots?: MinimalSlotDisplay[];
}) {
  const docInk = minimalDocTextColors(theme);
  const timeRangeOnly = formatMinimalAgendaTimeRange(item.start_time, item.end_time).trim();
  const descPreview = minimalCardDescriptionPreview(item, meetingTheme).trim();
  const footerRows = minimalFooterRows(item);
  const durationWords = formatMinimalDurationWords(item.duration_minutes);
  const visibleFooterRows = footerRows.filter(
    (row) =>
      !(
        row.heading.trim() === minimalAssignedHeading().trim() &&
        row.name.trim().toUpperCase() === 'TBA' &&
        shouldSuppressAssignedTba(item.section_name)
      )
  );
  const isDurationTba = /:\s*TBA\s*$/i.test(durationWords);
  const showDuration = Boolean(durationWords) && !(isDurationTba && shouldSuppressDurationTba(item.section_name));
  const hasTimeValue = Boolean(timeRangeOnly);
  const showFooterTime = !shouldHideFooterTime(item.section_name);
  const timeLabelValue = hasTimeValue ? timeRangeOnly : 'TBA';
  const hasMetaRight = showFooterTime || showDuration;
  const showFooter = hasMetaRight || visibleFooterRows.length > 0;

  const stackTheme = themeOrTopicForStack(item, meetingTheme);
  const isToastmasterStack = isToastmasterStackSection(item.section_name);
  const showThemeStack = isThemeOnStackSection(item.section_name);
  const stackThemeValue = stackTheme.trim() || 'TBA';
  const stackTitleLabel = isToastmasterStack ? 'Theme of the Day :' : 'Title :';

  const isLightDoc =
    theme.colors.background.toLowerCase() === '#ffffff' ||
    theme.colors.background.toLowerCase() === '#fff';
  const innerWellBorder = theme.colors.borderLight;
  const innerWellBg = isLightDoc ? '#fafafa' : theme.colors.surfaceSecondary;

  const preparedSlots = isPreparedSpeechesMinimalSection(item.section_name)
    ? preparedSlotsForPublic(item)
    : [];
  const evalShape = isSpeechEvaluationMinimalSection(item.section_name) ? speechEvalDisplayShape(item) : null;
  const keynoteTitle = isKeynoteMinimalSection(item.section_name) ? keynoteTitleForMinimal(item) : '';
  const grammarianLines = isGrammarianMinimalSection(item.section_name)
    ? grammarianCornerLinesFromRoleDetails(agendaRoleDetails(item))
    : [];
  const showDescPreview = Boolean(descPreview) && !isGrammarianMinimalSection(item.section_name);
  const evalFallbackShapes =
    isSpeechEvaluationMinimalSection(item.section_name) && !evalShape
      ? (speechEvaluationFallbackSlots ?? [])
      : [];
  const evalShapesToRender = evalShape ? [evalShape] : evalFallbackShapes;

  const hasStackAbovePrepared = showDescPreview || showThemeStack;
  const preparedSlotGapTop = (idx: number) =>
    idx > 0 ? 10 : hasStackAbovePrepared ? 12 : 0;
  const evalWellGapTop =
    preparedSlots.length > 0 ? 10 : hasStackAbovePrepared ? 12 : 0;

  const hasContentBeforeKeynote = showThemeStack || preparedSlots.length > 0 || evalShapesToRender.length > 0;
  const hasInnerStack = hasContentBeforeKeynote || Boolean(keynoteTitle);

  return (
    <View
      style={[
        styles.minItemCard,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.borderLight,
        },
        minimalCardWebShadow(),
        minimalCardWebPrintFlow(item.section_name),
        Platform.OS === 'android' ? { elevation: 2 } : {},
      ]}
    >
      <View style={styles.minItemCardHeaderRow}>
        <View style={styles.minItemTitleColumn}>
          <View style={styles.minItemTitleWithIcon}>
            {item.section_icon ? (
              <Text style={styles.minItemSectionIcon} maxFontSizeMultiplier={1.2}>
                {item.section_icon}
              </Text>
            ) : null}
            <Text
              style={[styles.minItemTitleLeft, { color: docInk.ink }]}
              maxFontSizeMultiplier={1.15}
              numberOfLines={allowsTwoLineTitle(item.section_name) ? 2 : 1}
              adjustsFontSizeToFit={!allowsTwoLineTitle(item.section_name)}
              minimumFontScale={0.72}
            >
              {item.section_name}
            </Text>
          </View>
        </View>
      </View>
      {showDescPreview ? (
        <Text
          style={[styles.minItemDesc, { color: docInk.inkMuted }]}
          numberOfLines={4}
          maxFontSizeMultiplier={1.1}
        >
          {descPreview}
        </Text>
      ) : null}
      {grammarianLines.map((line, idx) => (
        (() => {
          const parts = line.split(':');
          if (parts.length < 2) {
            return (
              <Text
                key={`grammarian-line-${idx}-${line.slice(0, 24)}`}
                style={[styles.minItemGrammarianLine, { color: docInk.inkMuted }]}
                maxFontSizeMultiplier={1.05}
              >
                {line}
              </Text>
            );
          }
          const label = `${parts[0]}:`;
          const value = parts.slice(1).join(':').trim();
          const isQuoteLine = /^quote of the day:/i.test(label);
          return (
            <Text
              key={`grammarian-line-${idx}-${line.slice(0, 24)}`}
              style={[styles.minItemGrammarianLine, { color: docInk.inkMuted }]}
              maxFontSizeMultiplier={1.05}
            >
              <Text style={[styles.minItemGrammarianLabel, { color: docInk.inkMuted }]}>{`${label} `}</Text>
              <Text style={[styles.minItemGrammarianValue, { color: docInk.ink }]}>{value}</Text>
            </Text>
          );
        })()
      ))}

      {showThemeStack ? (
        <Text
          style={[styles.minItemTitleInlineText, { color: docInk.ink }]}
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          <Text style={styles.minItemTitleInlineLabel}>{`${stackTitleLabel} `}</Text>
          <Text style={styles.minItemTitleInlineValue}>{stackThemeValue}</Text>
        </Text>
      ) : null}

      {preparedSlots.map((s, idx) => (
        <View
          key={`prep-${s.slot}`}
          style={[{ marginTop: preparedSlotGapTop(idx) }, minimalInnerBlockWebPrintKeepTogether()]}
        >
          <MinimalAgendaInnerSlotWell
            slot={slotToDisplayShape(s)}
            docInk={docInk}
            borderColor={innerWellBorder}
            wellBg={innerWellBg}
            variant="prepared"
          />
        </View>
      ))}

      {evalShapesToRender.map((slot, idx) => (
        <View
          key={`eval-${slot.slot}-${slot.speaker_name ?? 'speaker'}-${idx}`}
          style={[{ marginTop: idx === 0 ? evalWellGapTop : 10 }, minimalInnerBlockWebPrintKeepTogether()]}
        >
          <MinimalAgendaInnerSlotWell
            slot={slot}
            docInk={docInk}
            borderColor={innerWellBorder}
            wellBg={innerWellBg}
            variant="evaluation"
          />
        </View>
      ))}

      {isKeynoteMinimalSection(item.section_name) ? (
        <Text
          style={[
            styles.minItemTitleInlineText,
            { color: docInk.ink, marginTop: hasContentBeforeKeynote ? 12 : 0 },
          ]}
          maxFontSizeMultiplier={1.1}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          <Text style={styles.minItemTitleInlineLabel}>Title : </Text>
          <Text style={styles.minItemTitleInlineValue}>{keynoteTitle || 'TBA'}</Text>
        </Text>
      ) : null}

      {showFooter ? (
        <View
          style={[
            styles.minItemFooterRow,
            hasInnerStack ? styles.minItemFooterAfterStack : null,
            showThemeStack || Boolean(keynoteTitle) ? styles.minItemFooterAfterInlineTitle : null,
          ]}
        >
          <View style={styles.minItemFooterRowsBlock}>
            {visibleFooterRows.map((row, i) => (
              <View
                key={`${i}-${row.heading}-${row.name.slice(0, 24)}`}
                style={[styles.minItemFooterRoleRow, i > 0 ? styles.minItemFooterRoleRowSpaced : null]}
              >
                <Text style={[styles.minItemRoleHeading, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
                  {row.heading}
                  <Text style={[styles.minItemRoleName, { color: docInk.ink }]}>{` ${row.name}`}</Text>
                </Text>
              </View>
            ))}
          </View>
          {(showDuration || showFooterTime) ? (
            <View style={styles.minItemFooterMetaRow}>
              {showDuration ? (
                (() => {
                  const durationValue = durationWords.replace(/^Duration\s*:\s*/i, '').trim();
                  return (
                    <Text
                      style={[styles.minItemDurationBottom, styles.minItemMetaPlain, { color: docInk.inkMuted }]}
                      maxFontSizeMultiplier={1.05}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      <Text style={[styles.minItemDurationLabel, { color: docInk.inkMuted }]}>Duration : </Text>
                      <Text style={[styles.minItemDurationValue, { color: docInk.ink }]}>{durationValue}</Text>
                    </Text>
                  );
                })()
              ) : (
                <View />
              )}
              {showFooterTime ? (
                <Text
                  style={[styles.minItemMetaRightText, styles.minItemMetaPlain, { color: docInk.inkMuted }]}
                  maxFontSizeMultiplier={1.05}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  <Text style={[styles.minItemMetaRightLabel, { color: docInk.inkMuted }]}>Time : </Text>
                  <Text style={[styles.minItemMetaRightValue, { color: docInk.ink }]}>{timeLabelValue}</Text>
                </Text>
              ) : (
                <View />
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PublicMeetingAgendaLoadedView({
  skin,
  payload,
  theme,
}: {
  skin: PublicAgendaSkinId;
  payload: PublicAgendaPayload;
  theme: AppTheme;
}) {
  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  switch (skin) {
    case 'minimal':
      return <MinimalLayout payload={payload} theme={theme} openLink={openLink} />;
    case 'vibrant':
      return <VibrantLayout payload={payload} theme={theme} openLink={openLink} />;
    default:
      return <DefaultLayout payload={payload} theme={theme} openLink={openLink} />;
  }
}

function DefaultLayout({
  payload,
  theme,
  openLink,
}: {
  payload: PublicAgendaPayload;
  theme: AppTheme;
  openLink: (u: string) => void;
}) {
  const { meeting, club, items } = payload;
  const normalizedItems = normalizeAgendaNames(items);
  const coolGray = '#FAF9F6';
  const loyalBlue = '#004165';
  const softPanel = '#FAF9F6';
  const panelBorder = '#E6E3DE';
  const dateStr = formatPublicAgendaBannerDateShort(meeting.meeting_date);
  const timeStr =
    meeting.meeting_start_time || meeting.meeting_end_time
      ? `${formatPublicAgendaBannerTimePart(meeting.meeting_start_time)} - ${formatPublicAgendaBannerTimePart(meeting.meeting_end_time)}`
      : '';
  const meetingNumStr =
    meeting.meeting_number == null ? '' : String(meeting.meeting_number).trim();
  const meetingNoLabel = `Meeting ${meetingNumStr || '—'}`;
  const clubMetaText = [
    club.district ? `District ${deLinkDigits(club.district)}` : '',
    club.division ? `Division ${formatClubMetaToken(club.division)}` : '',
    club.area ? `Area ${formatClubMetaToken(club.area)}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  const meetingLink = meeting.meeting_link?.trim() || '';
  const meetingLocation = meeting.meeting_location?.trim() || '';
  const mapUrl = meetingLocation
    ? /^https?:\/\//i.test(meetingLocation)
      ? meetingLocation
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingLocation)}`
    : '';
  const preparedSpeechSlotsForSpeechEvalFallback = (() => {
    const preparedSection = normalizedItems.find((it) =>
      isPreparedSpeechesMinimalSection(it.section_name)
    );
    if (!preparedSection) return [];
    return preparedSlotsForPublic(preparedSection).map(slotToDisplayShape);
  })();
  const meetingTheme = meeting.theme?.trim() || null;
  const themedDefault = {
    ...theme,
    colors: {
      ...theme.colors,
      background: coolGray,
      surface: softPanel,
      borderLight: panelBorder,
      text: loyalBlue,
      textSecondary: loyalBlue,
      textTertiary: loyalBlue,
    },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: coolGray }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.defBannerTop, { backgroundColor: coolGray, borderBottomColor: panelBorder }]}>
          <Text style={[styles.defBannerClub, { color: loyalBlue }]} numberOfLines={2}>
            {club.club_name}
          </Text>
          {clubMetaText ? <Text style={[styles.defBannerSub, { color: loyalBlue }]}>{clubMetaText}</Text> : null}
          <View style={[styles.defHeaderDivider, { backgroundColor: panelBorder }]} />
          <View style={styles.defBannerMetaRow}>
            {dateStr ? <Text style={[styles.defBannerMeta, { color: loyalBlue }]}>🗓️ {dateStr}</Text> : null}
            {dateStr && timeStr ? <Text style={[styles.defBannerMetaSep, { color: loyalBlue }]}> | </Text> : null}
            {timeStr ? <Text style={[styles.defBannerMeta, { color: loyalBlue }]}>⏰ {timeStr}</Text> : null}
            {(dateStr || timeStr) && meetingNoLabel ? (
              <Text style={[styles.defBannerMetaSep, { color: loyalBlue }]}> | </Text>
            ) : null}
            {meetingNoLabel ? <Text style={[styles.defBannerMeta, { color: loyalBlue }]}>👥 {meetingNoLabel}</Text> : null}
          </View>
        </View>

        {normalizedItems.map((item) => (
          <MinimalAgendaItemCard
            key={`${item.section_order}-${item.section_name}`}
            item={item}
            theme={themedDefault}
            meetingTheme={meetingTheme}
            speechEvaluationFallbackSlots={preparedSpeechSlotsForSpeechEvalFallback}
          />
        ))}

        <View style={[styles.defFooterBlock, { backgroundColor: coolGray, borderColor: panelBorder }]}>
          <Text style={[styles.defFooterTitle, { color: loyalBlue }]}>
            {club.club_name} - {new Date().getFullYear()}
          </Text>
          {mapUrl ? (
            <Pressable onPress={() => openLink(mapUrl)} style={styles.defFooterLinkWrap}>
              <Text style={[styles.defFooterLink, { color: loyalBlue }]}>📍 Open map</Text>
            </Pressable>
          ) : null}
          {meetingLink ? (
            <Pressable onPress={() => openLink(meetingLink)} style={styles.defFooterLinkWrap}>
              <Text style={[styles.defFooterLink, { color: loyalBlue }]}>🔗 Online : Link</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MinimalLayout({
  payload,
  theme,
  openLink,
}: {
  payload: PublicAgendaPayload;
  theme: AppTheme;
  openLink: (u: string) => void;
}) {
  const { meeting, club, items } = payload;
  const normalizedItems = normalizeAgendaNames(items);
  const { width: layoutWidth } = useWindowDimensions();
  const isMinimalHeaderCompact = IS_MOBILE || layoutWidth < 640;
  const titleFontSize = Math.round((isMinimalHeaderCompact ? 22 : 28) * 0.9 * 100) / 100;
  const subtitleFontSize = Math.round((isMinimalHeaderCompact ? 13 : 16) * 0.9 * 100) / 100;
  const metaFontSize = Math.round((isMinimalHeaderCompact ? 13 : 15) * 0.85 * 100) / 100;
  const bg = theme.colors.backgroundSecondary;

  const clubMetaParts = [
    club.district ? `District ${deLinkDigits(club.district)}` : '',
    club.division ? `Division ${formatClubMetaToken(club.division)}` : '',
    club.area ? `Area ${formatClubMetaToken(club.area)}` : '',
  ].filter(Boolean);
  const clubMetaText = clubMetaParts.join(' | ');

  // Match original agenda banner style and keep mobile compact (no weekday).
  const dateStr = formatPublicAgendaBannerDateShort(meeting.meeting_date);
  const timeStr =
    meeting.meeting_start_time || meeting.meeting_end_time
      ? `${formatPublicAgendaBannerTimePart(meeting.meeting_start_time)} - ${formatPublicAgendaBannerTimePart(meeting.meeting_end_time)}`
      : '';
  const meetingNumStr =
    meeting.meeting_number == null ? '' : String(meeting.meeting_number).trim();
  const meetingNoLabel = `Meeting ${meetingNumStr || '—'}`;
  const docInk = minimalDocTextColors(theme);
  const chipMuted = docInk.inkMuted;
  const isLightDoc =
    theme.colors.background.toLowerCase() === '#ffffff' ||
    theme.colors.background.toLowerCase() === '#fff';

  const meetingLink = meeting.meeting_link?.trim() || '';
  const vpeName = club.vpe_name?.trim() || '';
  const vpeNumber = club.vpe_phone_number?.trim() || '';
  const vpmName = club.vpm_name?.trim() || '';
  const vpmNumber = club.vpm_phone_number?.trim() || '';
  const minFooterLine = `${club.club_name} - 2026`;
  const meetingLocation = meeting.meeting_location?.trim() || '';
  const mapUrl = meetingLocation
    ? /^https?:\/\//i.test(meetingLocation)
      ? meetingLocation
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingLocation)}`
    : '';
  const meetingTheme = meeting.theme?.trim() || null;
  const preparedSpeechSlotsForSpeechEvalFallback = (() => {
    const preparedSection = normalizedItems.find((it) =>
      isPreparedSpeechesMinimalSection(it.section_name)
    );
    if (!preparedSection) return [];
    return preparedSlotsForPublic(preparedSection).map(slotToDisplayShape);
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.minScroll} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.minFrame,
            {
              backgroundColor: theme.colors.background,
              borderLeftColor: theme.colors.borderLight,
              borderRightColor: theme.colors.borderLight,
            },
          ]}
        >
          <View
            style={[
              styles.minNotionBanner,
              {
                backgroundColor: 'transparent',
                borderBottomWidth: 0,
              },
              minimalHeaderShellShadow(),
            ]}
          >
            <View style={styles.minBannerWireHeader}>
              <Text
                style={[
                  styles.minBannerWireTitle,
                  {
                    color: docInk.ink,
                    fontFamily: MINIMAL_HEADER_FONT_FAMILY,
                    fontSize: titleFontSize,
                    lineHeight: Math.round(titleFontSize * 1.25),
                  },
                ]}
                numberOfLines={2}
              >
                {club.club_name}
              </Text>
              {clubMetaText ? (
                <Text
                  style={[
                    styles.minBannerWireSubtitle,
                    {
                      color: docInk.inkMuted,
                      fontFamily: MINIMAL_HEADER_FONT_FAMILY,
                      fontSize: subtitleFontSize,
                      lineHeight: Math.round(subtitleFontSize * 1.38),
                    },
                  ]}
                  numberOfLines={3}
                  accessibilityLabel={clubMetaText}
                >
                  {clubMetaText}
                </Text>
              ) : null}
            </View>

            <View
              style={[
                styles.minBannerWireMeta,
                { borderTopColor: theme.colors.borderLight },
              ]}
            >
              <View style={styles.minBannerWireMetaRow}>
                {dateStr ? (
                  <Text
                    style={[
                      styles.minBannerWireMetaItem,
                      {
                        color: chipMuted,
                        fontFamily: MINIMAL_HEADER_FONT_FAMILY,
                        fontSize: metaFontSize,
                        lineHeight: Math.round(metaFontSize * 1.35),
                      },
                    ]}
                    numberOfLines={2}
                  >
                    📅 {dateStr}
                  </Text>
                ) : null}
                {dateStr && timeStr ? (
                  <Text style={[styles.minBannerWireMetaSep, { color: docInk.inkSoft }]}> | </Text>
                ) : null}
                {timeStr ? (
                  <Text
                    style={[
                      styles.minBannerWireMetaItem,
                      {
                        color: chipMuted,
                        fontFamily: MINIMAL_HEADER_FONT_FAMILY,
                        fontSize: metaFontSize,
                        lineHeight: Math.round(metaFontSize * 1.35),
                      },
                    ]}
                    numberOfLines={2}
                  >
                    ⏰ {timeStr}
                  </Text>
                ) : null}
                {(dateStr || timeStr) && meetingNoLabel ? (
                  <Text style={[styles.minBannerWireMetaSep, { color: docInk.inkSoft }]}> | </Text>
                ) : null}
                {meetingNoLabel ? (
                  <Text
                    style={[
                      styles.minBannerWireMetaItem,
                      {
                        color: chipMuted,
                        fontFamily: MINIMAL_HEADER_FONT_FAMILY,
                        fontSize: metaFontSize,
                        lineHeight: Math.round(metaFontSize * 1.35),
                      },
                    ]}
                    numberOfLines={2}
                  >
                    👥 {meetingNoLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>

          <View
            style={[
              styles.minCardListSection,
              { backgroundColor: theme.colors.background },
            ]}
          >
            {normalizedItems.map((item) => (
              <MinimalAgendaItemCard
                key={`${item.section_order}-${item.section_name}`}
                item={item}
                theme={theme}
                meetingTheme={meetingTheme}
                speechEvaluationFallbackSlots={preparedSpeechSlotsForSpeechEvalFallback}
              />
            ))}
          </View>
          <View
            style={[
              styles.minFooterBanner,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.borderLight,
              },
            ]}
          >
            <Text style={[styles.minFooter, { color: docInk.inkSoft }]} numberOfLines={1}>
              {minFooterLine}
            </Text>
            {vpeName ? (
              <Text style={[styles.minFooterDetail, { color: docInk.inkMuted }]} numberOfLines={1}>
                <Text style={styles.minFooterDetailLabel}>VPE Name : </Text>
                <Text style={styles.minFooterDetailValue}>{vpeName}{vpeNumber ? ` : ${vpeNumber}` : ''}</Text>
              </Text>
            ) : null}
            {vpmName ? (
              <Text style={[styles.minFooterDetail, { color: docInk.inkMuted }]} numberOfLines={1}>
                <Text style={styles.minFooterDetailLabel}>VPM Name : </Text>
                <Text style={styles.minFooterDetailValue}>{vpmName}{vpmNumber ? ` : ${vpmNumber}` : ''}</Text>
              </Text>
            ) : null}
            {mapUrl ? (
              <Pressable
                onPress={() => openLink(mapUrl)}
                style={({ pressed }) => [styles.minFooterLinkWrap, { opacity: pressed ? 0.75 : 1 }]}
                accessibilityRole="link"
                accessibilityLabel="Open map location"
              >
                <Text style={[styles.minFooterLinkText, { color: docInk.inkMuted }]}>📍 Open map</Text>
              </Pressable>
            ) : null}
            {meetingLink ? (
              <Pressable
                onPress={() => openLink(meetingLink)}
                style={({ pressed }) => [styles.minFooterLinkWrap, { opacity: pressed ? 0.75 : 1 }]}
                accessibilityRole="link"
                accessibilityLabel="Open online meeting link"
              >
                <Text style={[styles.minFooterLinkText, { color: docInk.inkMuted }]}>🔗 Online : Link</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VibrantLayout({
  payload,
  theme,
  openLink,
}: {
  payload: PublicAgendaPayload;
  theme: AppTheme;
  openLink: (u: string) => void;
}) {
  const { meeting, club, items } = payload;
  const normalizedItems = normalizeAgendaNames(items);
  const headerColor = '#641327';
  const cardBg = '#0d0d0d';
  const cardBorder = '#262626';
  const cardText = '#f5f5f5';
  const cardMuted = '#c7c7c7';
  const cardSoft = '#a0a0a0';
  const dateStr = formatPublicAgendaBannerDateShort(meeting.meeting_date);
  const timeStr =
    meeting.meeting_start_time || meeting.meeting_end_time
      ? `${formatPublicAgendaBannerTimePart(meeting.meeting_start_time)} - ${formatPublicAgendaBannerTimePart(meeting.meeting_end_time)}`
      : '';
  const meetingNumStr =
    meeting.meeting_number == null ? '' : String(meeting.meeting_number).trim();
  const meetingNoLabel = `Meeting ${meetingNumStr || '—'}`;
  const meetingLink = meeting.meeting_link?.trim() || '';
  const meetingLocation = meeting.meeting_location?.trim() || '';
  const mapUrl = meetingLocation
    ? /^https?:\/\//i.test(meetingLocation)
      ? meetingLocation
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingLocation)}`
    : '';
  const preparedSpeechSlotsForSpeechEvalFallback = (() => {
    const preparedSection = normalizedItems.find((it) =>
      isPreparedSpeechesMinimalSection(it.section_name)
    );
    if (!preparedSection) return [];
    return preparedSlotsForPublic(preparedSection).map(slotToDisplayShape);
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.vibScroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.vibBannerTop, { backgroundColor: headerColor }]}>
          <Text style={styles.vibBannerClub} numberOfLines={2}>
            {club.club_name}
          </Text>
          <Text style={styles.vibBannerSub}>
            {[
              club.district ? `District ${deLinkDigits(club.district)}` : '',
              club.division ? `Division ${formatClubMetaToken(club.division)}` : '',
              club.area ? `Area ${formatClubMetaToken(club.area)}` : '',
            ]
              .filter(Boolean)
              .join(' | ')}
          </Text>
          <View style={styles.vibHeaderDivider} />
          <View style={styles.vibBannerMetaRow}>
            {dateStr ? <Text style={styles.vibBannerMeta}>🗓️ {dateStr}</Text> : null}
            {dateStr && timeStr ? <Text style={styles.vibBannerMetaSep}> | </Text> : null}
            {timeStr ? <Text style={styles.vibBannerMeta}>⏰ {timeStr}</Text> : null}
            {(dateStr || timeStr) && meetingNoLabel ? <Text style={styles.vibBannerMetaSep}> | </Text> : null}
            {meetingNoLabel ? <Text style={styles.vibBannerMeta}>👥 {meetingNoLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.vibCardStack}>
          {normalizedItems.map((item) => (
            <VibrantAgendaItemCard
              key={`${item.section_order}-${item.section_name}`}
              item={item}
              cardBg={cardBg}
              cardBorder={cardBorder}
              cardText={cardText}
              cardMuted={cardMuted}
              cardSoft={cardSoft}
              speechEvaluationFallbackSlots={preparedSpeechSlotsForSpeechEvalFallback}
            />
          ))}
        </View>

        <View style={[styles.vibFooterBlock, { backgroundColor: headerColor }]}>
          <Text style={styles.vibFooterTitle}>{club.club_name} - {new Date().getFullYear()}</Text>
          {mapUrl ? (
            <Pressable onPress={() => openLink(mapUrl)} style={styles.vibFooterLinkWrap}>
              <Text style={styles.vibFooterLink}>📍 Open map</Text>
            </Pressable>
          ) : null}
          {meetingLink ? (
            <Pressable onPress={() => openLink(meetingLink)} style={styles.vibFooterLinkWrap}>
              <Text style={styles.vibFooterLink}>🔗 Online : Link</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function VibrantAgendaItemCard({
  item,
  cardBg,
  cardBorder,
  cardText,
  cardMuted,
  cardSoft,
  speechEvaluationFallbackSlots,
}: {
  item: PublicAgendaItemRow;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMuted: string;
  cardSoft: string;
  speechEvaluationFallbackSlots?: MinimalSlotDisplay[];
}) {
  const timeRange = formatMinimalAgendaTimeRange(item.start_time, item.end_time);
  const preparedSlots = isPreparedSpeechesMinimalSection(item.section_name)
    ? preparedSlotsForPublic(item).map(slotToDisplayShape)
    : [];
  const evalShape = isSpeechEvaluationMinimalSection(item.section_name)
    ? speechEvalDisplayShape(item)
    : null;
  const evalFallbackShapes =
    isSpeechEvaluationMinimalSection(item.section_name) && !evalShape
      ? (speechEvaluationFallbackSlots ?? [])
      : [];
  const evalShapesToRender = evalShape ? [evalShape] : evalFallbackShapes;

  const slotBlock = (slot: MinimalSlotDisplay, variant: 'prepared' | 'evaluation') => {
    const formUrl = evaluationFormUrl(slot.evaluation_form);
    const speaker = slot.speaker_name?.trim() || 'TBA';
    const evaluator = slot.evaluator_name?.trim() || 'TBA';
    return (
      <View
        key={`${variant}-${slot.slot}-${speaker}-${evaluator}`}
        style={[styles.vibInnerWell, { borderColor: cardBorder }]}
      >
        <View style={styles.vibInnerPeopleRow}>
          <Text style={[styles.vibInnerPerson, { color: cardText }]}>
            {variant === 'prepared' ? 'Speaker' : 'Evaluator'}: {variant === 'prepared' ? speaker : evaluator}
          </Text>
          <Text style={[styles.vibInnerPerson, { color: cardText }]}>
            {variant === 'prepared' ? 'Evaluator' : 'Speaker'}: {variant === 'prepared' ? evaluator : speaker}
          </Text>
        </View>
        {slot.speech_title?.trim() ? (
          <Text style={[styles.vibInnerMeta, { color: cardMuted }]}>Title : {slot.speech_title.trim()}</Text>
        ) : null}
        {(slot.pathway_name?.trim() || slot.project_name?.trim()) ? (
          <Text style={[styles.vibInnerMeta, { color: cardMuted }]}>
            {[slot.pathway_name?.trim(), slot.project_name?.trim()].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {(slot.level != null || slot.project_number?.trim()) ? (
          <Text style={[styles.vibInnerMeta, { color: cardMuted }]}>
            {slot.level != null ? `Level ${slot.level}` : ''}
            {slot.level != null && slot.project_number?.trim() ? '  ·  ' : ''}
            {slot.project_number?.trim() ? `Project ${slot.project_number.trim()}` : ''}
          </Text>
        ) : null}
        {formUrl ? (
          <Pressable
            onPress={() => Linking.openURL(formUrl).catch(() => {})}
            style={({ pressed }) => [styles.vibEvalFormBtn, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.vibEvalFormBtnText}>📄 Evaluation form — Open</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };
  return (
    <View style={[styles.vibCardSimple, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.vibCardSimpleHeader}>
        {item.section_icon ? <Text style={styles.vibCardSimpleIcon}>{item.section_icon}</Text> : null}
        <Text style={[styles.vibCardSimpleTitle, { color: cardText }]}>{item.section_name}</Text>
      </View>
      {item.section_description ? (
        <Text style={[styles.vibCardSimpleDesc, { color: cardMuted }]}>{item.section_description}</Text>
      ) : null}
      {item.assigned_user_name ? (
        <Text style={[styles.vibCardSimpleLine, { color: cardMuted }]}>
          Assigned : <Text style={[styles.vibCardSimpleStrong, { color: cardText }]}>{item.assigned_user_name}</Text>
        </Text>
      ) : null}
      {preparedSlots.map((slot) => slotBlock(slot, 'prepared'))}
      {evalShapesToRender.map((slot) => slotBlock(slot, 'evaluation'))}
      <View style={styles.vibCardSimpleFooterRow}>
        <Text style={[styles.vibCardSimpleLine, { color: cardMuted }]}>
          Duration : <Text style={[styles.vibCardSimpleStrong, { color: cardText }]}>{`${item.duration_minutes ?? 0} mins`}</Text>
        </Text>
        {timeRange ? (
          <Text style={[styles.vibCardSimpleTime, { color: cardSoft }]}>
            Time : <Text style={[styles.vibCardSimpleStrong, { color: cardText }]}>{timeRange}</Text>
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function AgendaSectionCard({
  item,
  theme,
  skin,
  speechEvaluationFallbackSlots,
}: {
  item: PublicAgendaItemRow;
  theme: AppTheme;
  skin: PublicAgendaSkinId;
  speechEvaluationFallbackSlots?: MinimalSlotDisplay[];
}) {
  const rd = item.role_details && typeof item.role_details === 'object' ? item.role_details : null;
  const extraLines = publicAgendaRoleDetailLines(rd);
  const slots = preparedSlotsForPublic(item);
  const evalShape = isSpeechEvaluationMinimalSection(item.section_name)
    ? speechEvalDisplayShape(item)
    : null;
  const evalFallbackShapes =
    isSpeechEvaluationMinimalSection(item.section_name) && !evalShape
      ? (speechEvaluationFallbackSlots ?? [])
      : [];
  const evalShapesToRender = evalShape ? [evalShape] : evalFallbackShapes;
  const tagParts = [item.timer_user_name, item.ah_counter_user_name, item.grammarian_user_name].filter(Boolean);

  const body = (
    <>
      <View style={skin === 'minimal' ? styles.minCardHeader : styles.cardHeader}>
        {item.section_icon ? (
          <Text style={[styles.icon, skin === 'vibrant' && { fontSize: 26 }]}>{item.section_icon}</Text>
        ) : null}
        <View style={{ flex: 1 }}>
          {skin === 'vibrant' ? (
            <View style={styles.vibrantTitleRow}>
              <Text
                style={[
                  { fontSize: 18, fontWeight: '700', color: theme.colors.text, flexShrink: 1 },
                ]}
                numberOfLines={2}
              >
                {item.section_name}
              </Text>
              {item.duration_minutes != null ? (
                <Text style={[styles.duration, styles.vibrantDurationInline, { color: theme.colors.textSecondary }]}>
                  {item.duration_minutes} min
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text
                style={[
                  skin === 'minimal' && { fontSize: 16, fontWeight: '600' },
                  !(skin === 'minimal' || skin === 'vibrant') && styles.sectionTitle,
                  { color: theme.colors.text },
                ]}
              >
                {item.section_name}
              </Text>
              {item.duration_minutes != null ? (
                <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
                  {item.duration_minutes} min
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
      {item.section_description ? (
        <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>{item.section_description}</Text>
      ) : null}
      {item.assigned_user_name ? (
        <Text style={[styles.assignee, { color: theme.colors.text }]}>
          <Text style={{ fontWeight: '600' }}>Assigned: </Text>
          {item.assigned_user_name}
        </Text>
      ) : null}
      {tagParts.length > 0 ? (
        <Text style={[styles.assignee, { color: theme.colors.textSecondary }]}>
          Tag team: {tagParts.join(' · ')}
        </Text>
      ) : null}
      {item.educational_topic ? (
        <Text style={[styles.assignee, { color: theme.colors.text }]}>Topic: {item.educational_topic}</Text>
      ) : null}
      {extraLines.map((line, i) => (
        <Text key={`${i}-${line.slice(0, 24)}`} style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
          {line}
        </Text>
      ))}
      {slots.length > 0 ? (
        <View style={styles.slots}>
          {slots.map((s) => (
            <View key={s.slot} style={[styles.slotRow, { borderTopColor: theme.colors.borderLight }]}>
              <Text style={[styles.slotTitle, { color: theme.colors.text }]}>
                Speaker {s.slot}
                {s.speaker_name ? `: ${s.speaker_name}` : ''}
              </Text>
              {s.speech_title ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>{s.speech_title}</Text>
              ) : null}
              {(s.pathway_name || s.project_name) ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                  {[s.pathway_name, s.project_name].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {s.evaluator_name ? (
                <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                  Evaluator: {s.evaluator_name}
                </Text>
              ) : null}
              {evaluationFormUrl(s.evaluation_form) ? (
                <Pressable
                  onPress={() => Linking.openURL(evaluationFormUrl(s.evaluation_form)!).catch(() => {})}
                  style={({ pressed }) => [
                    styles.defEvalFormBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="link"
                  accessibilityLabel="Open evaluation form"
                >
                  <Text style={styles.defEvalFormBtnText}>📄 Evaluation form — Open</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      {evalShapesToRender.length > 0 ? (
        <View style={styles.slots}>
          {evalShapesToRender.map((slot, idx) => {
            const formUrl = evaluationFormUrl(slot.evaluation_form);
            return (
              <View key={`eval-${slot.slot}-${idx}`} style={[styles.slotRow, { borderTopColor: theme.colors.borderLight }]}>
                <Text style={[styles.slotTitle, { color: theme.colors.text }]}>
                  Evaluator
                  {slot.evaluator_name ? `: ${slot.evaluator_name}` : ''}
                </Text>
                {slot.speaker_name ? (
                  <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                    Speaker: {slot.speaker_name}
                  </Text>
                ) : null}
                {slot.speech_title ? (
                  <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                    Title: {slot.speech_title}
                  </Text>
                ) : null}
                {(slot.pathway_name || slot.project_name) ? (
                  <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                    {[slot.pathway_name, slot.project_name].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                {(slot.level != null || slot.project_number?.trim()) ? (
                  <Text style={[styles.detailLine, { color: theme.colors.textSecondary }]}>
                    {slot.level != null ? `Level ${slot.level}` : ''}
                    {slot.level != null && slot.project_number?.trim() ? ' · ' : ''}
                    {slot.project_number?.trim() ? `Project ${slot.project_number.trim()}` : ''}
                  </Text>
                ) : null}
                {formUrl ? (
                  <Pressable
                    onPress={() => Linking.openURL(formUrl).catch(() => {})}
                    style={({ pressed }) => [
                      styles.defEvalFormBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel="Open evaluation form"
                  >
                    <Text style={styles.defEvalFormBtnText}>📄 Evaluation form — Open</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      {item.custom_notes ? (
        <Text style={[styles.notes, { color: theme.colors.textSecondary }]}>{item.custom_notes}</Text>
      ) : null}
    </>
  );

  if (skin === 'minimal') {
    return <MinimalAgendaItemCard item={item} theme={theme} />;
  }

  if (skin === 'vibrant') {
    return (
      <View
        style={[
          styles.vibCard,
          {
            backgroundColor: theme.colors.surface,
            borderLeftColor: theme.colors.primary,
          },
          vibrantCardExtra(),
        ]}
      >
        {body}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderLight,
        },
      ]}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  banner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  bannerClub: { color: '#fff', fontSize: 22, fontWeight: '800' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bannerMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 15, marginTop: 4 },
  linkWrap: { marginTop: 10, alignSelf: 'flex-start' },
  linkText: { color: '#fff', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  defBannerTop: {
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignItems: 'center',
  },
  defBannerClub: {
    fontSize: ms(IS_MOBILE ? 22 : 24),
    lineHeight: IS_MOBILE ? 28 : 31,
    fontWeight: '700',
    fontFamily: MINIMAL_HEADER_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
    textAlign: 'center',
    width: '100%',
  },
  defBannerSub: {
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    marginTop: 6,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'center',
    width: '100%',
  },
  defHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
  },
  defBannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: IS_MOBILE ? 'nowrap' : 'wrap',
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  defBannerMeta: {
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    marginTop: 2,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  defBannerMetaSep: {
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    marginTop: 2,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  defFooterBlock: {
    marginTop: 2,
    marginHorizontal: 0,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  defFooterTitle: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'center',
  },
  defFooterLinkWrap: {
    marginTop: 4,
  },
  defFooterLink: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textDecorationLine: 'underline',
  },
  defEvalFormBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#2f74da',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  defEvalFormBtnText: {
    color: '#ffffff',
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    fontWeight: '700',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  publicNote: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 12 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 22, lineHeight: 26 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  duration: { fontSize: 13, marginTop: 2 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  assignee: { fontSize: 14, marginTop: 8 },
  detailLine: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  slots: { marginTop: 10 },
  slotRow: { paddingTop: 10, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  slotTitle: { fontSize: 15, fontWeight: '600' },
  notes: { fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 20, paddingHorizontal: 16 },

  minScroll: { paddingBottom: 48 },
  // Centered “document” look with visible left/right borders.
  minFrame: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  minNotionBanner: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 0,
    overflow: 'visible',
    ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
  },
  minBannerWireHeader: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 0,
  },
  minBannerWireTitle: {
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.25,
  },
  minBannerWireSubtitle: {
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.08,
  },
  minBannerWireMeta: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 2,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    alignItems: 'center',
  },
  minBannerWireMetaRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: '100%',
  },
  minBannerWireMetaItem: {
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.06,
  },
  minBannerWireMetaSep: {
    fontFamily: MINIMAL_HEADER_FONT_FAMILY,
    fontWeight: '400',
  },
  minBannerDetailsRowWrap: {
    marginTop: 14,
    alignSelf: 'center',
    maxWidth: '100%' as const,
  },
  minCardListSection: {
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 2,
  },
  minFooterBanner: {
    width: '100%',
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  minItemCard: {
    marginHorizontal: 14,
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  minItemCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  minItemTitleColumn: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  minItemTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  minItemSectionIcon: {
    fontSize: 18,
    lineHeight: 22,
    marginTop: 1,
  },
  minItemTitleLeft: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    flex: 1,
    flexShrink: 1,
    fontSize: ms(IS_MOBILE ? 13 : 13),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 18 : 18,
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
    paddingRight: 4,
  },
  minItemTimeBlock: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    flexShrink: 0,
    flexGrow: 0,
    minWidth: IS_MOBILE ? 98 : 108,
    marginLeft: 6,
  },
  /** Card time (top-right) and duration (bottom-right): always regular weight, never semibold/bold. */
  minItemMetaPlain: {
    fontWeight: '400',
    fontStyle: 'normal',
  },
  minItemTimeRight: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 12 : 13),
    lineHeight: IS_MOBILE ? 17 : 18,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'right',
  },
  minItemDesc: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 10,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemGrammarianLine: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 8,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemGrammarianLabel: {
    fontWeight: '400',
  },
  minItemGrammarianValue: {
    fontWeight: '700',
  },
  minItemThemeHeaderRule: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  minItemThemeStack: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
  minItemThemeStackLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(12),
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
  },
  minItemThemeStackPill: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
  minItemThemeStackPillCompact: {
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  minItemThemeStackPillText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 15 : 14),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 20 : 19,
    textAlign: 'left',
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
  },
  minItemThemeStackPillTextCompact: {
    fontSize: ms(13),
    lineHeight: 18,
  },
  minItemThemeAssigneeWell: {
    marginTop: 12,
  },
  minItemThemeAssigneeLine: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  minItemInnerWell: {
    marginTop: 0,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  minItemInnerSpeakerEvalRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  minItemInnerPersonCol: {
    flex: 1,
    minWidth: 0,
  },
  minItemInnerIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  minItemInnerIdentityBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  minItemInnerIdentityBubbleText: {
    fontSize: ms(16),
    lineHeight: 18,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  minItemInnerIdentityTextCol: {
    flex: 1,
    minWidth: 0,
  },
  minItemInnerVertRule: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    alignSelf: 'stretch',
  },
  minItemInnerHRule: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginTop: 14,
    marginBottom: 8,
  },
  minItemInnerRoleLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 12 : 11),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 16 : 15,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerPersonName: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 4,
    fontSize: ms(IS_MOBILE ? 14 : 13),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerPlaceholder: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 4,
    fontSize: ms(IS_MOBILE ? 14 : 13),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 19 : 17,
    fontStyle: 'italic',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerDetailLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 18 : 16,
    marginBottom: 6,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerTitlePillMint: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#bfe9e2',
  },
  minItemInnerTitlePillMintText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 15 : 14),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 20 : 19,
    textAlign: 'center',
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
  },
  minItemInnerTitlePillMintTextLeft: {
    textAlign: 'left',
  },
  minItemInnerDetailsBlock: {
    marginTop: 12,
    gap: 8,
  },
  minItemInnerDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  minItemInnerDetailPrefix: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 19 : 17,
    marginRight: 4,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerDetailValue: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 19 : 17,
    flexShrink: 1,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerDetailValueStrong: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 14 : 13),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 19 : 17,
    flexShrink: 1,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemInnerFormBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  minItemInnerFormBtnText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minItemFooterRow: {
    marginTop: 10,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 0,
  },
  minItemFooterAfterStack: {
    marginTop: 16,
  },
  minItemFooterAfterInlineTitle: {
    marginTop: 8,
  },
  minItemFooterRowsBlock: {
    minWidth: 0,
    width: '100%',
  },
  minItemFooterMetaRow: {
    marginTop: 6,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  minItemMetaRightText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 12 : 12),
    lineHeight: IS_MOBILE ? 17 : 17,
    textAlign: 'right',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const)
      : {}),
  },
  minItemMetaRightLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '400',
  },
  minItemMetaRightValue: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '700',
  },
  minItemFooterRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    minWidth: 0,
  },
  minItemFooterRoleRowSpaced: {
    marginTop: 6,
  },
  minItemRoleHeading: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const)
      : {}),
  },
  minItemRoleName: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const)
      : {}),
  },
  minItemTitleInlineText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 6,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    fontWeight: '400',
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const)
      : {}),
  },
  minItemTitleInlineLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '400',
  },
  minItemTitleInlineValue: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '700',
  },
  minItemDurationBottom: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    textAlign: 'left',
    marginTop: 0,
    alignSelf: 'flex-start',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    ...(Platform.OS === 'android'
      ? ({ includeFontPadding: false, textAlignVertical: 'center' } as const)
      : {}),
  },
  minItemDurationLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '400',
  },
  minItemDurationValue: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '700',
  },
  minBannerTopMeta: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  minBannerLocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  minBannerLocText: {
    flexShrink: 1,
    maxWidth: '92%',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
    textAlign: 'center',
  },
  minBannerTopLinkWell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  minBannerTopLinkText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    flexShrink: 1,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 18 : 17,
    fontWeight: '400',
    textAlign: 'left',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minBannerClub: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 24 : 22),
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: IS_MOBILE ? 29 : 27,
    letterSpacing: -0.35,
  },
  minBannerSub: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    marginTop: 8,
    textAlign: 'center',
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 18,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textDecorationLine: 'none',
    ...(Platform.OS === 'web'
      ? ({
          textDecorationColor: 'transparent',
        } as ViewStyle)
      : {}),
  },
  minBannerChipsRow: {
    flexDirection: 'row',
    flexWrap: IS_MOBILE ? 'nowrap' : 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: IS_MOBILE ? 0 : 8,
  },
  minBannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  minBannerChipText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    fontWeight: '400',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minBannerChipSep: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    fontWeight: '400',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minBannerLinkBtn: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  minBannerLinkBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },

  minHeader: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  minClub: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  minTitle: { fontSize: 34, fontWeight: '800', marginTop: 10, lineHeight: 40 },
  minMeta: { fontSize: 16, marginTop: 8, lineHeight: 22 },
  minLink: { fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
  minNote: { fontSize: 13, paddingHorizontal: 24, paddingVertical: 14 },
  minCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  minCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  // Notion-style minimal rows (time left, content middle, assignee right)
  minRowCard: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  minRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  minRowTimeCol: {
    width: 56,
    paddingTop: 2,
  },
  minRowTimeText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  minRowMid: {
    flex: 1,
    paddingRight: 10,
  },
  minRowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  minRowIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  minRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    flexShrink: 1,
  },
  minRowDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  minRowExtraLine: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  minRowRightCol: {
    minWidth: 170,
    paddingTop: 2,
    alignItems: 'flex-end',
  },
  minRowRightText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'right',
  },
  minRowRightTimeText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'right',
  },
  minFooter: {
    textAlign: 'center',
    fontSize: 11.5,
    marginTop: 0,
    paddingHorizontal: 24,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    fontWeight: '600',
  },
  minFooterDetail: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 15,
    paddingHorizontal: 16,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  minFooterDetailLabel: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '400',
  },
  minFooterDetailValue: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontWeight: '600',
  },
  minFooterLinkWrap: {
    marginTop: 6,
    alignSelf: 'center',
  },
  minFooterLinkText: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textDecorationLine: 'underline',
  },

  vibScroll: { paddingBottom: 40 },
  vibBannerTop: {
    marginHorizontal: 0,
    marginTop: 0,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    alignItems: 'center',
  },
  vibBannerClub: {
    color: '#fff',
    fontSize: ms(IS_MOBILE ? 22 : 24),
    lineHeight: IS_MOBILE ? 28 : 31,
    fontWeight: '700',
    fontFamily: MINIMAL_HEADER_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
    textAlign: 'center',
    width: '100%',
  },
  vibBannerSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    marginTop: 6,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'center',
    width: '100%',
  },
  vibHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
  },
  vibBannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: IS_MOBILE ? 'nowrap' : 'wrap',
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 4,
  },
  vibBannerMeta: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    marginTop: 2,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  vibBannerMetaSep: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: ms(IS_MOBILE ? 12.35 : 12.35),
    lineHeight: IS_MOBILE ? 18 : 16,
    marginTop: 2,
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  vibrantTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
  },
  vibrantDurationInline: {
    marginTop: 0,
  },
  vibCardStack: { paddingHorizontal: 0, gap: 0, marginTop: 8 },
  vibCardSimple: {
    marginHorizontal: 0,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  vibCardSimpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vibCardSimpleIcon: {
    fontSize: 20,
    lineHeight: 22,
  },
  vibCardSimpleTitle: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 13),
    fontWeight: '700',
    lineHeight: IS_MOBILE ? 18 : 18,
    letterSpacing: MINIMAL_AGENDA_HEADING_TRACKING,
    flexShrink: 1,
  },
  vibCardSimpleDesc: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    marginTop: 8,
  },
  vibCardSimpleLine: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    marginTop: 6,
  },
  vibCardSimpleStrong: {
    fontWeight: '700',
  },
  vibCardSimpleFooterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  vibCardSimpleTime: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'right',
  },
  vibInnerWell: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  vibInnerPeopleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  vibInnerPerson: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    fontWeight: '600',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    flex: 1,
  },
  vibInnerMeta: {
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    marginTop: 6,
  },
  vibEvalFormBtn: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#2f74da',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  vibEvalFormBtnText: {
    color: '#ffffff',
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: ms(IS_MOBILE ? 13 : 12),
    lineHeight: IS_MOBILE ? 19 : 17,
    fontWeight: '700',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
  },
  vibCard: {
    marginBottom: 14,
    borderRadius: 16,
    borderLeftWidth: 5,
    padding: 18,
  },
  vibFooterBlock: {
    marginTop: 2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  vibFooterTitle: {
    color: '#f3f3f3',
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textAlign: 'center',
  },
  vibFooterLinkWrap: {
    marginTop: 4,
  },
  vibFooterLink: {
    color: '#d9d9d9',
    fontFamily: MINIMAL_AGENDA_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: MINIMAL_AGENDA_BODY_TRACKING,
    textDecorationLine: 'underline',
  },
  vibFooter: { textAlign: 'center', fontSize: 12, marginTop: 8, paddingHorizontal: 16 },
});

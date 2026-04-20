import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import {
  buildMinimalAgendaDescriptionLines,
  formatPublicAgendaBannerTimePart,
  formatPublicAgendaMeetingDate,
  preparedSlotsForPublic,
  publicAgendaRoleDetailLines,
} from '@/lib/publicAgendaFormat';
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';
import type { PublicAgendaItemRow, PublicAgendaPayload } from '@/lib/publicAgendaQuery';
import { Calendar, Clock, Link2, Users } from 'lucide-react-native';

type AppTheme = ReturnType<typeof useTheme>['theme'];

/** Minimal skin: avoid pure black (#000) and red accents; use neutral greys on light docs. */
type MinimalDocInk = { ink: string; inkMuted: string; inkSoft: string };

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
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return '';
  const n = Math.round(minutes);
  if (n === 1) return '1 minute';
  return `${n} minutes`;
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
  if (isToastmasterStackSection(item.section_name)) {
    return [];
  }
  if (isMeetAndGreetSection(item.section_name)) {
    return [{ heading: 'Everyone', name: 'All' }];
  }
  if (isTagTeamIntroductionSection(item.section_name)) {
    const tagRows: { heading: string; name: string }[] = [];
    const timerName = item.timer_user_name?.trim();
    const ahName = item.ah_counter_user_name?.trim();
    const grammarianName = item.grammarian_user_name?.trim();
    if (timerName) tagRows.push({ heading: 'Timer', name: timerName });
    if (ahName) tagRows.push({ heading: 'Ah Counter', name: ahName });
    if (grammarianName) tagRows.push({ heading: 'Grammarian', name: grammarianName });
    if (tagRows.length > 0) return tagRows;
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
    out.push({ heading: lineLabelForMinimalFooterRow(item, line), name: line });
  }
  return out;
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

  if (filtered.length > 0) return filtered[0]!;
  return item.section_description?.trim() || '';
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
  evalTitlePillBg,
}: {
  slot: MinimalSlotDisplay;
  docInk: MinimalDocInk;
  borderColor: string;
  wellBg: string;
  variant: 'prepared' | 'evaluation';
  evalTitlePillBg?: string;
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
      {variant === 'prepared' ? (
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
                Yet to be assigned
              </Text>
            )}
            <Text style={[styles.minItemInnerRoleLabel, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
              {role}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.minItemInnerRoleLabel, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
            {role}
          </Text>
          {name ? (
            <Text style={[styles.minItemInnerPersonName, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
              {name}
            </Text>
          ) : (
            <Text style={[styles.minItemInnerPlaceholder, { color: docInk.inkSoft }]} maxFontSizeMultiplier={1.05}>
              Yet to be assigned
            </Text>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.minItemInnerWell, { borderColor, backgroundColor: wellBg }]}>
      <View style={styles.minItemInnerSpeakerEvalRow}>
        {personBlock('Speaker', speaker)}
        <View style={[styles.minItemInnerVertRule, { backgroundColor: borderColor }]} />
        {personBlock('Evaluator', evaluator)}
      </View>

      {variant === 'evaluation' && slot.speech_title?.trim() ? (
        <>
          <View style={[styles.minItemInnerHRule, { backgroundColor: borderColor }]} />
          <Text style={[styles.minItemInnerDetailLabel, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
            Speech title
          </Text>
          <View style={[styles.minItemInnerTitlePillMint, evalTitlePillBg ? { backgroundColor: evalTitlePillBg } : null]}>
            <Text
              style={[styles.minItemInnerTitlePillMintText, { color: docInk.ink }]}
              numberOfLines={3}
              maxFontSizeMultiplier={1.05}
            >
              {slot.speech_title.trim()}
            </Text>
          </View>
        </>
      ) : null}

      {preparedHasMeta ? (
        <View style={styles.minItemInnerDetailsBlock}>
          {slot.speech_title?.trim() ? (
            <View style={styles.minItemInnerDetailRow}>
              <Text style={[styles.minItemInnerDetailPrefix, { color: docInk.inkMuted }]}>📄 Speech title: </Text>
              <Text style={[styles.minItemInnerPersonName, { color: docInk.ink }]}>{slot.speech_title.trim()}</Text>
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
              borderColor: variant === 'prepared' ? '#1f6feb' : borderColor,
              backgroundColor: variant === 'prepared' ? '#1f6feb' : wellBg,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.minItemInnerFormBtnText,
              { color: variant === 'prepared' ? '#ffffff' : docInk.inkMuted },
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
  const hasTimeTop = Boolean(timeRangeOnly);
  const showFooter = Boolean(durationWords) || footerRows.length > 0;

  const stackTheme = themeOrTopicForStack(item, meetingTheme);
  const isToastmasterStack = isToastmasterStackSection(item.section_name);
  const showThemeStack =
    isToastmasterStack || (isThemeOnStackSection(item.section_name) && Boolean(stackTheme));
  const stackThemeLabel = stackTheme.trim() ? stackTheme.toUpperCase() : 'THEME TBD';
  const assigneeName = item.assigned_user_name?.trim() || '';
  const themeStackRoleLabel = minimalRoleHeadingForSection(item.section_name);
  const themeStackHeadingLabel = isEducationalMinimalSection(item.section_name)
    ? 'Title'
    : 'Theme of the Day';

  const isLightDoc =
    theme.colors.background.toLowerCase() === '#ffffff' ||
    theme.colors.background.toLowerCase() === '#fff';
  const innerWellBorder = theme.colors.borderLight;
  const innerWellBg = isLightDoc ? '#fafafa' : theme.colors.surfaceSecondary;
  const themePillBg = isLightDoc ? '#d8f3ef' : 'rgba(45,212,191,0.16)';
  const themePillText = isLightDoc ? '#0f766e' : theme.colors.textSecondary;

  const preparedSlots = isPreparedSpeechesMinimalSection(item.section_name)
    ? preparedSlotsForPublic(item)
    : [];
  const evalShape = isSpeechEvaluationMinimalSection(item.section_name) ? speechEvalDisplayShape(item) : null;
  const keynoteTitle = isKeynoteMinimalSection(item.section_name) ? keynoteTitleForMinimal(item) : '';
  const evalFallbackShapes =
    isSpeechEvaluationMinimalSection(item.section_name) && !evalShape
      ? (speechEvaluationFallbackSlots ?? [])
      : [];
  const evalShapesToRender = evalShape ? [evalShape] : evalFallbackShapes;

  const hasStackAbovePrepared =
    Boolean(descPreview) || showThemeStack || (showThemeStack && Boolean(assigneeName));
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
              numberOfLines={3}
            >
              {item.section_name}
            </Text>
          </View>
        </View>
        {hasTimeTop ? (
          <View style={styles.minItemTimeBlock}>
            <Text
              style={[styles.minItemTimeRight, styles.minItemMetaPlain, { color: docInk.inkMuted }]}
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {timeRangeOnly}
            </Text>
          </View>
        ) : null}
      </View>
      {descPreview ? (
        <Text
          style={[styles.minItemDesc, { color: docInk.inkMuted }]}
          numberOfLines={4}
          maxFontSizeMultiplier={1.1}
        >
          {descPreview}
        </Text>
      ) : null}

      {showThemeStack ? (
        <>
          {!isToastmasterStack ? (
            <View
              style={[
                styles.minItemThemeHeaderRule,
                { backgroundColor: innerWellBorder, marginTop: descPreview ? 14 : 4 },
              ]}
            />
          ) : null}
          <View style={styles.minItemThemeStack}>
            <Text style={[styles.minItemThemeStackLabel, { color: docInk.ink }]} maxFontSizeMultiplier={1.05}>
              {themeStackHeadingLabel}
            </Text>
            <View
              style={[
                styles.minItemThemeStackPill,
                isToastmasterStack ? styles.minItemThemeStackPillCompact : null,
                { backgroundColor: themePillBg },
              ]}
            >
              <Text
                style={[
                  styles.minItemThemeStackPillText,
                  isToastmasterStack ? styles.minItemThemeStackPillTextCompact : null,
                  { color: themePillText },
                ]}
                numberOfLines={4}
                maxFontSizeMultiplier={1.05}
              >
                {stackThemeLabel}
              </Text>
            </View>
          </View>
        </>
      ) : null}

      {showThemeStack && assigneeName && isToastmasterStack ? (
        (
          <View style={styles.minItemThemeAssigneeLine}>
            <Text style={[styles.minItemRoleHeading, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
              {themeStackRoleLabel}
            </Text>
            <Text style={[styles.minItemRoleName, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
              {` ${assigneeName}`}
            </Text>
          </View>
        )
      ) : null}

      {preparedSlots.map((s, idx) => (
        <View key={`prep-${s.slot}`} style={{ marginTop: preparedSlotGapTop(idx) }}>
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
          style={{ marginTop: idx === 0 ? evalWellGapTop : 10 }}
        >
          <MinimalAgendaInnerSlotWell
            slot={slot}
            docInk={docInk}
            borderColor={innerWellBorder}
            wellBg={innerWellBg}
            variant="evaluation"
            evalTitlePillBg={isLightDoc ? '#bfe9e2' : 'rgba(45,212,191,0.22)'}
          />
        </View>
      ))}

      {keynoteTitle ? (
        <View style={{ marginTop: hasContentBeforeKeynote ? 12 : 0 }}>
          <View style={[styles.minItemInnerWell, { borderColor: innerWellBorder, backgroundColor: innerWellBg }]}>
            <Text style={[styles.minItemInnerDetailLabel, { color: docInk.inkMuted }]} maxFontSizeMultiplier={1.05}>
              Keynote Title
            </Text>
            <View style={[styles.minItemInnerTitlePillMint, { backgroundColor: isLightDoc ? '#bfe9e2' : 'rgba(45,212,191,0.22)' }]}>
              <Text
                style={[styles.minItemInnerTitlePillMintText, { color: docInk.ink }]}
                numberOfLines={3}
                maxFontSizeMultiplier={1.05}
              >
                {keynoteTitle}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {showFooter ? (
        <View style={[styles.minItemFooterRow, hasInnerStack ? styles.minItemFooterAfterStack : null]}>
          <View style={styles.minItemFooterRowsBlock}>
            {footerRows.map((row, i) => (
              <View
                key={`${i}-${row.heading}-${row.name.slice(0, 24)}`}
                style={[styles.minItemFooterRoleRow, i > 0 ? styles.minItemFooterRoleRowSpaced : null]}
              >
                <Text style={[styles.minItemRoleHeading, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
                  {row.heading}
                </Text>
                <Text style={[styles.minItemRoleName, { color: docInk.ink }]} maxFontSizeMultiplier={1.1}>
                  {` ${row.name}`}
                </Text>
              </View>
            ))}
            {durationWords ? (
              <Text
                style={[styles.minItemDurationBottom, styles.minItemMetaPlain, { color: docInk.inkMuted }]}
                maxFontSizeMultiplier={1.05}
              >
                {durationWords}
              </Text>
            ) : null}
          </View>
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
  const clubBanner = meeting.club_info_banner_color || '#0ea5e9';
  const dateBanner = meeting.datetime_banner_color || '#f97316';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.banner, { backgroundColor: clubBanner }]}>
          <Text style={styles.bannerClub} numberOfLines={2}>
            {club.club_name}
          </Text>
          {club.club_number ? <Text style={styles.bannerMeta}>Club #{club.club_number}</Text> : null}
        </View>

        <View style={[styles.banner, { backgroundColor: dateBanner, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
          <Text style={styles.bannerTitle} numberOfLines={3}>
            {meeting.meeting_title}
          </Text>
          <Text style={styles.bannerMeta}>{formatPublicAgendaMeetingDate(meeting.meeting_date)}</Text>
          {meeting.meeting_start_time ? (
            <Text style={styles.bannerMeta}>
              {meeting.meeting_start_time}
              {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
            </Text>
          ) : null}
          {meeting.meeting_mode ? (
            <Text style={styles.bannerMeta} accessibilityLabel="Meeting mode">
              {meeting.meeting_mode.replace(/_/g, ' ')}
            </Text>
          ) : null}
          {meeting.meeting_location ? <Text style={styles.bannerMeta}>{meeting.meeting_location}</Text> : null}
          {meeting.meeting_link ? (
            <Pressable onPress={() => openLink(meeting.meeting_link!)} style={styles.linkWrap}>
              <Text style={styles.linkText}>Join online</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.publicNote, { color: theme.colors.textTertiary }]}>
          Shared agenda — sign in to the T360 app to book roles or see member-only details.
        </Text>

        {items.map((item) => (
          <AgendaSectionCard
            key={`${item.section_order}-${item.section_name}`}
            item={item}
            theme={theme}
            skin="default"
          />
        ))}

        <Text style={[styles.footer, { color: theme.colors.textTertiary }]}>
          © {new Date().getFullYear()} {club.club_name}
        </Text>
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
  const bg = theme.colors.backgroundSecondary;

  const clubMetaParts = [
    club.district ? `District ${club.district}` : '',
    club.division ? `Division ${club.division}` : '',
    club.area ? `Area ${club.area}` : '',
  ].filter(Boolean);
  const clubMetaText = clubMetaParts.join(' | ');

  const dateStr = formatPublicAgendaMeetingDate(meeting.meeting_date);
  const timeStr =
    meeting.meeting_start_time || meeting.meeting_end_time
      ? `${formatPublicAgendaBannerTimePart(meeting.meeting_start_time)} - ${formatPublicAgendaBannerTimePart(meeting.meeting_end_time)}`
      : '';
  const meetingNumStr =
    meeting.meeting_number == null ? '' : String(meeting.meeting_number).trim();
  const meetingNoLabel = `Meeting ${meetingNumStr || '—'}`;
  const docInk = minimalDocTextColors(theme);
  const chipMuted = docInk.inkMuted;
  const iconSize = 11;
  const isLightDoc =
    theme.colors.background.toLowerCase() === '#ffffff' ||
    theme.colors.background.toLowerCase() === '#fff';
  const notionBannerBg = theme.colors.background;
  const notionChipsWellBg = isLightDoc ? '#ffffff' : theme.colors.surfaceSecondary;
  const notionChipsWellBorder = isLightDoc ? '#e8e6e3' : theme.colors.borderLight;
  const bannerWebShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 0 rgba(15,15,15,0.06), 0 6px 20px rgba(15,15,15,0.04)',
        } as ViewStyle)
      : {};

  const meetingLink = meeting.meeting_link?.trim() || '';
  const showBannerTopMeta = Boolean(meetingLink);
  const linkIconSize = 13;
  const meetingTheme = meeting.theme?.trim() || null;
  const preparedSpeechSlotsForSpeechEvalFallback = (() => {
    const preparedSection = items.find((it) => isPreparedSpeechesMinimalSection(it.section_name));
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
                backgroundColor: notionBannerBg,
                borderBottomColor: theme.colors.borderLight,
              },
              bannerWebShadow,
            ]}
          >
            {showBannerTopMeta ? (
              <View style={styles.minBannerTopMeta}>
                {meetingLink ? (
                  <Pressable
                    onPress={() => openLink(meetingLink)}
                    style={({ pressed }) => [
                      styles.minBannerTopLinkWell,
                      {
                        borderColor: notionChipsWellBorder,
                        backgroundColor: notionChipsWellBg,
                        marginTop: 0,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel="Open online meeting link"
                  >
                    <Link2 size={linkIconSize} color={chipMuted} strokeWidth={2.25} />
                    <Text style={[styles.minBannerTopLinkText, { color: docInk.inkMuted }]} numberOfLines={2}>
                      Online meeting link
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.minBannerClub, { color: docInk.ink }]} numberOfLines={2}>
              {club.club_name}
            </Text>

            {clubMetaText ? (
              <Text
                style={[styles.minBannerSub, { color: docInk.inkMuted }]}
                numberOfLines={3}
                accessibilityLabel={clubMetaText}
              >
                {clubMetaText}
              </Text>
            ) : null}

            <View
              style={[
                styles.minNotionChipsWell,
                { backgroundColor: notionChipsWellBg, borderColor: notionChipsWellBorder },
              ]}
            >
              <View style={styles.minBannerChipsRow}>
                {dateStr ? (
                  <View style={styles.minBannerChip}>
                    <Calendar size={iconSize} color={chipMuted} strokeWidth={2.25} />
                    <Text
                      style={[styles.minBannerChipText, { color: chipMuted }]}
                      numberOfLines={3}
                    >
                      {dateStr}
                    </Text>
                  </View>
                ) : null}
                {dateStr && timeStr ? (
                  <Text style={[styles.minBannerChipSep, { color: docInk.inkSoft }]}> | </Text>
                ) : null}
                {timeStr ? (
                  <View style={styles.minBannerChip}>
                    <Clock size={iconSize} color={chipMuted} strokeWidth={2.25} />
                    <Text style={[styles.minBannerChipText, { color: chipMuted }]}>{timeStr}</Text>
                  </View>
                ) : null}
                {(dateStr || timeStr) && meetingNoLabel ? (
                  <Text style={[styles.minBannerChipSep, { color: docInk.inkSoft }]}> | </Text>
                ) : null}
                <View style={styles.minBannerChip}>
                  <Users size={iconSize} color={chipMuted} strokeWidth={2.25} />
                  <Text style={[styles.minBannerChipText, { color: chipMuted }]}>{meetingNoLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.minCardListSection,
              { backgroundColor: isLightDoc ? '#e8e7e4' : theme.colors.background },
            ]}
          >
            {items.map((item) => (
              <MinimalAgendaItemCard
                key={`${item.section_order}-${item.section_name}`}
                item={item}
                theme={theme}
                meetingTheme={meetingTheme}
                speechEvaluationFallbackSlots={preparedSpeechSlotsForSpeechEvalFallback}
              />
            ))}
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
  const clubBanner = meeting.club_info_banner_color || '#6366f1';
  const dateBanner = meeting.datetime_banner_color || '#ea580c';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.vibScroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.vibBannerTop, { backgroundColor: clubBanner }]}>
          <Text style={styles.vibBannerClub} numberOfLines={2}>
            {club.club_name}
          </Text>
          {club.club_number ? <Text style={styles.vibBannerSub}>Club #{club.club_number}</Text> : null}
        </View>
        <View style={[styles.vibBannerMid, { backgroundColor: dateBanner }]}>
          <Text style={styles.vibBannerTitle} numberOfLines={3}>
            {meeting.meeting_title}
          </Text>
          <Text style={styles.vibBannerMeta}>{formatPublicAgendaMeetingDate(meeting.meeting_date)}</Text>
          {meeting.meeting_start_time ? (
            <Text style={styles.vibBannerMeta}>
              {formatPublicAgendaBannerTimePart(meeting.meeting_start_time)}
              {meeting.meeting_end_time ? ` – ${formatPublicAgendaBannerTimePart(meeting.meeting_end_time)}` : ''}
            </Text>
          ) : null}
          {meeting.meeting_mode ? (
            <Text style={styles.vibBannerMeta}>{meeting.meeting_mode.replace(/_/g, ' ')}</Text>
          ) : null}
          {meeting.meeting_location ? <Text style={styles.vibBannerMeta}>{meeting.meeting_location}</Text> : null}
          {meeting.meeting_link ? (
            <Pressable onPress={() => openLink(meeting.meeting_link!)} style={{ marginTop: 12 }}>
              <Text style={styles.vibLink}>Join online →</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.vibCardStack}>
          {items.map((item) => (
            <AgendaSectionCard
              key={`${item.section_order}-${item.section_name}`}
              item={item}
              theme={theme}
              skin="vibrant"
            />
          ))}
        </View>

        <Text style={[styles.vibFooter, { color: theme.colors.textTertiary }]}>
          © {new Date().getFullYear()} {club.club_name}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AgendaSectionCard({
  item,
  theme,
  skin,
}: {
  item: PublicAgendaItemRow;
  theme: AppTheme;
  skin: PublicAgendaSkinId;
}) {
  const rd = item.role_details && typeof item.role_details === 'object' ? item.role_details : null;
  const extraLines = publicAgendaRoleDetailLines(rd);
  const slots = preparedSlotsForPublic(item);
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
            </View>
          ))}
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
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    ...(Platform.OS === 'android' ? { elevation: 1 } : {}),
  },
  minNotionChipsWell: {
    marginTop: 18,
    alignSelf: 'center',
    maxWidth: '100%' as const,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  minCardListSection: {
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 2,
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
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    paddingRight: 4,
  },
  minItemTimeBlock: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 108,
    marginLeft: 6,
  },
  /** Card time (top-right) and duration (bottom-right): always regular weight, never semibold/bold. */
  minItemMetaPlain: {
    fontWeight: '400',
    fontStyle: 'normal',
  },
  minItemTimeRight: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  minItemDesc: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
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
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
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
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    textAlign: 'left',
    letterSpacing: 0.4,
  },
  minItemThemeStackPillTextCompact: {
    fontSize: 13,
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
    fontSize: 16,
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
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 15,
  },
  minItemInnerPersonName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  minItemInnerPlaceholder: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  minItemInnerDetailLabel: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginBottom: 6,
  },
  minItemInnerTitlePillMint: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#bfe9e2',
  },
  minItemInnerTitlePillMintText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
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
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    marginRight: 4,
  },
  minItemInnerDetailValue: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    flexShrink: 1,
  },
  minItemInnerFormBtn: {
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  minItemInnerFormBtnText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  minItemFooterRow: {
    marginTop: 10,
  },
  minItemFooterAfterStack: {
    marginTop: 16,
  },
  minItemFooterRowsBlock: {
    minWidth: 0,
  },
  minItemFooterRoleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  minItemFooterRoleRowSpaced: {
    marginTop: 6,
  },
  minItemRoleHeading: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },
  minItemRoleName: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  minItemDurationBottom: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'left',
    marginTop: 6,
    alignSelf: 'flex-start',
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
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    textAlign: 'left',
  },
  minBannerClub: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 27,
    letterSpacing: -0.35,
  },
  minBannerSub: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  minBannerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 8,
  },
  minBannerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  minBannerChipText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
  },
  minBannerChipSep: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '400',
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
  minFooter: { textAlign: 'center', fontSize: 11, marginTop: 24, paddingHorizontal: 24 },

  vibScroll: { paddingBottom: 40 },
  vibBannerTop: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 22,
    borderRadius: 20,
  },
  vibBannerMid: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderRadius: 20,
  },
  vibBannerClub: { color: '#fff', fontSize: 24, fontWeight: '800' },
  vibBannerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 6 },
  vibBannerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  vibBannerMeta: { color: 'rgba(255,255,255,0.95)', fontSize: 15, marginTop: 6 },
  vibLink: { color: '#fff', fontSize: 16, fontWeight: '700', textDecorationLine: 'underline' },
  vibrantTitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 8,
  },
  vibrantDurationInline: {
    marginTop: 0,
  },
  vibCardStack: { paddingHorizontal: 12, gap: 0 },
  vibCard: {
    marginBottom: 14,
    borderRadius: 16,
    borderLeftWidth: 5,
    padding: 18,
  },
  vibFooter: { textAlign: 'center', fontSize: 12, marginTop: 8, paddingHorizontal: 16 },
});

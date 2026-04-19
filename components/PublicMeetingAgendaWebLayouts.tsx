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
import { Calendar, Clock, Users } from 'lucide-react-native';

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

/** Bold role-style label before the assignee name (see tag-team row pattern). */
function minimalRoleHeadingForSection(sectionName: string): string {
  const s = (sectionName || '').toLowerCase();
  if (s.includes('meet and greet') || s.includes('meet & greet')) return 'Everyone';
  if (s.includes('call to order')) return 'Serjeant-at-Arms';
  if (s.includes('presiding officer')) return 'President';
  if (s.includes('toastmaster')) return 'Toastmaster';
  if (s.includes('general evaluator')) return 'General Evaluator';
  if (s.includes('prepared speeches') || s.includes('prepared speech')) return 'Speakers';
  if (s.includes('table topic')) return 'Table Topics';
  if (s.includes('ice breaker')) return 'Ice Breakers';
  if (s.includes('ah counter')) return 'Ah Counter';
  if (s.includes('grammarian')) return 'Grammarian';
  if (s.includes('timer')) return 'Timer';
  return 'Role';
}

function isMeetAndGreetSection(sectionName: string): boolean {
  const s = (sectionName || '').toLowerCase();
  return s.includes('meet and greet') || s.includes('meet & greet');
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
    return [{ heading: 'Everyone', name: 'All' }];
  }
  const lines = minimalCardPeopleLines(item);
  const out: { heading: string; name: string }[] = [];
  for (const line of lines) {
    const parsed = parseSpeakerEvaluatorHeading(line);
    if (parsed) {
      out.push(parsed);
      continue;
    }
    out.push({ heading: lineLabelForMinimalFooterRow(item, line), name: line });
  }
  return out;
}

function minimalCardDescriptionPreview(item: PublicAgendaItemRow): string {
  const descLines = buildMinimalAgendaDescriptionLines(item);
  if (descLines.length > 0) return descLines[0]!;
  return item.section_description?.trim() || '';
}

function minimalCardWebShadow(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 1px 2px rgba(15,15,15,0.06), 0 4px 14px rgba(15,15,15,0.06)',
    } as ViewStyle;
  }
  return {};
}

function MinimalAgendaItemCard({ item, theme }: { item: PublicAgendaItemRow; theme: AppTheme }) {
  const docInk = minimalDocTextColors(theme);
  const timeRangeOnly = formatMinimalAgendaTimeRange(item.start_time, item.end_time).trim();
  const descPreview = minimalCardDescriptionPreview(item).trim();
  const footerRows = minimalFooterRows(item);
  const durationWords = formatMinimalDurationWords(item.duration_minutes);
  const hasTimeTop = Boolean(timeRangeOnly);
  const showFooter = Boolean(durationWords) || footerRows.length > 0;

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
      {showFooter ? (
        <View style={styles.minItemFooterRow}>
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
          </View>
          {durationWords ? (
            <Text
              style={[styles.minItemDurationBottom, styles.minItemMetaPlain, { color: docInk.inkMuted }]}
              maxFontSizeMultiplier={1.05}
            >
              {durationWords}
            </Text>
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
  const notionBannerBg = isLightDoc ? '#f5f4f1' : theme.colors.backgroundSecondary;
  const notionChipsWellBg = isLightDoc ? '#ffffff' : theme.colors.surfaceSecondary;
  const notionChipsWellBorder = isLightDoc ? '#e8e6e3' : theme.colors.borderLight;
  const bannerWebShadow =
    Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 0 rgba(15,15,15,0.06), 0 6px 20px rgba(15,15,15,0.04)',
        } as ViewStyle)
      : {};

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

            {meeting.meeting_link ? (
              <View style={{ marginTop: 16, alignItems: 'center' }}>
                <Pressable
                  onPress={() => openLink(meeting.meeting_link!)}
                  style={[
                    styles.minBannerLinkBtn,
                    {
                      backgroundColor: notionChipsWellBg,
                      borderColor: notionChipsWellBorder,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text style={[styles.minBannerLinkBtnText, { color: docInk.inkMuted }]}>Join online</Text>
                </Pressable>
              </View>
            ) : null}
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
    fontSize: 19,
    lineHeight: 23,
    marginTop: 1,
  },
  minItemTitleLeft: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
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
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'right',
  },
  minItemDesc: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  minItemFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  minItemFooterRowsBlock: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
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
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  minItemRoleName: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  minItemDurationBottom: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    flexShrink: 0,
    alignSelf: 'flex-end',
  },
  minBannerClub: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
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

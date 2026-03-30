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
  formatPublicAgendaMeetingDate,
  preparedSlotsForPublic,
  publicAgendaRoleDetailLines,
} from '@/lib/publicAgendaFormat';
import type { PublicAgendaSkinId } from '@/lib/publicAgendaSkin';
import type { PublicAgendaItemRow, PublicAgendaPayload } from '@/lib/publicAgendaQuery';

type AppTheme = ReturnType<typeof useTheme>['theme'];

function vibrantCardExtra(): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
    } as ViewStyle;
  }
  return { elevation: 8 };
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
          <View style={[styles.minHeader, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.minClub, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {club.club_name}
              {club.club_number ? ` · #${club.club_number}` : ''}
              {meeting.meeting_number ? ` · MEETING #${meeting.meeting_number}` : ''}
            </Text>
            <Text style={[styles.minTitle, { color: theme.colors.text }]} numberOfLines={3}>
              {meeting.meeting_title}
            </Text>
            <Text style={[styles.minMeta, { color: theme.colors.textSecondary }]}>
              {formatPublicAgendaMeetingDate(meeting.meeting_date)}
              {meeting.meeting_start_time
                ? ` · ${meeting.meeting_start_time}${meeting.meeting_end_time ? `–${meeting.meeting_end_time}` : ''}`
                : ''}
            </Text>
            {meeting.meeting_location ? (
              <Text style={[styles.minMeta, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                {meeting.meeting_mode ? `${meeting.meeting_mode.replace(/_/g, ' ')} · ` : ''}
                {meeting.meeting_location}
              </Text>
            ) : meeting.meeting_mode ? (
              <Text style={[styles.minMeta, { color: theme.colors.textSecondary, marginTop: 6 }]}>
                {meeting.meeting_mode.replace(/_/g, ' ')}
              </Text>
            ) : null}
            {meeting.meeting_link ? (
              <Pressable onPress={() => openLink(meeting.meeting_link!)} style={{ marginTop: 10 }}>
                <Text style={[styles.minLink, { color: theme.colors.primary }]}>Join online</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={[styles.minNote, { color: theme.colors.textTertiary }]}>
            Shared agenda — T360 app for booking and member details.
          </Text>

          {items.map((item) => (
            <AgendaSectionCard
              key={`${item.section_order}-${item.section_name}`}
              item={item}
              theme={theme}
              skin="minimal"
            />
          ))}

          <Text style={[styles.minFooter, { color: theme.colors.textTertiary }]}>
            © {new Date().getFullYear()} {club.club_name}
          </Text>
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
              {meeting.meeting_start_time}
              {meeting.meeting_end_time ? ` – ${meeting.meeting_end_time}` : ''}
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

        <Text style={[styles.vibNote, { color: theme.colors.textTertiary }]}>
          Shared agenda — open the T360 app to book roles.
        </Text>

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

  const minimalTimeText =
    item.start_time && item.end_time
      ? `${item.start_time} - ${item.end_time}`
      : item.start_time
        ? item.start_time
        : item.duration_minutes != null
          ? `${item.duration_minutes} min`
          : '';

  const minimalRightText =
    item.assigned_user_name ||
    item.timer_user_name ||
    item.ah_counter_user_name ||
    item.grammarian_user_name ||
    '';

  const body = (
    <>
      <View style={skin === 'minimal' ? styles.minCardHeader : styles.cardHeader}>
        {item.section_icon ? (
          <Text style={[styles.icon, skin === 'vibrant' && { fontSize: 26 }]}>{item.section_icon}</Text>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            style={[
              skin === 'minimal' && { fontSize: 16, fontWeight: '600' },
              skin === 'vibrant' && { fontSize: 18, fontWeight: '700' },
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
    return (
      <View
        style={[
          styles.minRowCard,
          {
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.borderLight,
          },
        ]}
      >
        <View style={styles.minRow}>
          <View style={styles.minRowTimeCol}>
            {minimalTimeText ? (
              <Text style={[styles.minRowTimeText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                {minimalTimeText}
              </Text>
            ) : null}
          </View>

          <View style={styles.minRowMid}>
            <View style={styles.minRowTitleLine}>
              {item.section_icon ? (
                <Text style={[styles.minRowIcon, { color: theme.colors.text }]}>{item.section_icon}</Text>
              ) : null}
              <Text style={[styles.minRowTitle, { color: theme.colors.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {item.section_name}
              </Text>
            </View>

            {item.section_description ? (
              <Text style={[styles.minRowDesc, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.1}>
                {item.section_description}
              </Text>
            ) : null}

            {extraLines.slice(0, 2).map((line, i) => (
              <Text
                key={`${i}-${line.slice(0, 24)}`}
                style={[styles.minRowExtraLine, { color: theme.colors.textSecondary }]}
                maxFontSizeMultiplier={1.0}
              >
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.minRowRightCol}>
            {minimalRightText ? (
              <Text style={[styles.minRowRightText, { color: theme.colors.textSecondary }]} numberOfLines={2} maxFontSizeMultiplier={1.1}>
                {minimalRightText}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
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
    width: 110,
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
    minWidth: 160,
    paddingTop: 2,
    alignItems: 'flex-end',
  },
  minRowRightText: {
    fontSize: 13,
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
  vibNote: { fontSize: 13, paddingHorizontal: 20, paddingVertical: 14 },
  vibCardStack: { paddingHorizontal: 12, gap: 0 },
  vibCard: {
    marginBottom: 14,
    borderRadius: 16,
    borderLeftWidth: 5,
    padding: 18,
  },
  vibFooter: { textAlign: 'center', fontSize: 12, marginTop: 8, paddingHorizontal: 16 },
});

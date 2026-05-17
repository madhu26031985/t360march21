import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { goBackOrReplace } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const FS = 0.9;
const GREEN = '#15803D';
const GREEN_PALE = '#F0FDF4';

const PILLARS = [
  { label: 'Word of the Day', sub: 'pre-meeting setup' },
  { label: 'Good Usage', sub: 'live tracking' },
  { label: 'Opportunities', sub: 'grammar corrections' },
  { label: 'Stats', sub: 'word of the day usage' },
];

const BOOKING_METHODS: { title: string; body: string }[] = [
  {
    title: 'Via Book a Role',
    body: 'Go to Home → Open Meeting → Meeting Actions → Book a Role and select the Grammarian role from the list.',
  },
  {
    title: 'Via Grammarian section',
    body: 'Open the dedicated Grammarian section inside the meeting page and click to book the role directly.',
  },
  {
    title: 'Via Admin Panel (EXCOMM)',
    body: 'VP or EXCOMM members can assign or reassign the role through Meetings → Manage Roles → Assign / Reassign.',
  },
];

const ACCESS_ROWS: { role: string; access: string; sections: string; full?: boolean }[] = [
  { role: 'VP of Education', access: 'Full access', sections: 'Grammarian Corner + Summary', full: true },
  { role: 'Assigned Grammarian', access: 'Full access', sections: 'Grammarian Corner + Summary', full: true },
  { role: 'All other members', access: 'View only', sections: 'Grammarian Summary only', full: false },
];

const PRE_MEETING_ITEMS: { title: string; desc: string; example: string }[] = [
  {
    title: 'Word of the Day',
    desc: 'Choose an interesting or uncommon word. Members are encouraged to use it throughout the meeting.',
    example: '"Ephemeral — lasting for a very short time"',
  },
  {
    title: 'Quote of the Day',
    desc: 'Select an inspiring or thought-provoking quote to set the tone for the meeting.',
    example: '"The limits of my language are the limits of my world."',
  },
  {
    title: 'Idiom of the Day',
    desc: "Share an idiom with its meaning to enrich members' vocabulary and expression.",
    example: '"Bite the bullet — endure a painful situation bravely"',
  },
];

const GOOD_USAGE_ITEMS = [
  'Good phrases and strong vocabulary choices',
  'Effective and well-constructed sentence usage',
  'Impressive communication styles used by members',
  'Correct use of the Word of the Day',
];

const OPPORTUNITY_ITEMS = [
  'Incorrect grammar usage observed',
  'Language corrections and misused words or phrases',
  'Better sentence structure recommendations',
];

const OPPORTUNITY_EXAMPLES: { said: string; correct: string }[] = [
  { said: '"He go to the meeting yesterday"', correct: '"He went to the meeting yesterday"' },
  { said: '"The datas shows that…"', correct: '"The data shows that…"' },
];

const STATS_ITEMS = [
  'Count how many times each member uses the Word of the Day',
  'Encourages active participation and vocabulary improvement',
  'Visible in the final Grammarian Summary report',
];

const PRE_PUBLISH = [
  'All observations are reviewed carefully — read through every Good Usage and Opportunity entry.',
  'Corrections are accurate — verify grammar corrections are correct and clearly worded.',
  'Good usages are properly captured — ensure all notable language moments are documented.',
  'Word of the Day statistics are verified — confirm usage counts per member are correct.',
];

function BulletList({ items, bulletColor }: { items: string[]; bulletColor?: string }) {
  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={[styles.bulletMark, bulletColor ? { color: bulletColor } : undefined]} maxFontSizeMultiplier={1.2}>
            ▸
          </Text>
          <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
            {item}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingGrammarianRoleScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace('/t360-training')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={Math.round(22 * FS)} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.25}>
          The Grammarian Role
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.kbBadge}>
            <Text style={styles.kbBadgeText} maxFontSizeMultiplier={1.2}>
              T360 · Knowledge base · Complete role guide
            </Text>
          </View>
          <Text style={styles.docTitle} maxFontSizeMultiplier={1.35}>
            The Grammarian Role
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Celebrate great language, correct grammar, and track vocabulary — helping every member communicate with
            precision and elegance.
          </Text>

          <View style={styles.pillarRow}>
            {PILLARS.map(({ label, sub }) => (
              <View key={label} style={styles.pillarChip}>
                <Text style={styles.pillarLabel} maxFontSizeMultiplier={1.15}>
                  {label}
                </Text>
                <Text style={styles.pillarSub} maxFontSizeMultiplier={1.1}>
                  {sub}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Booking the Grammarian role
          </Text>
          {BOOKING_METHODS.map(({ title, body }) => (
            <View key={title} style={styles.methodCard}>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.methodBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}
          <View style={[styles.callout, styles.calloutGreen]}>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Once booked, your name will appear as the Grammarian for that meeting. EXCOMM can manage assignments via
              the Admin Panel before or during the meeting.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Grammarian report — access control
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Grammarian Report has Grammarian Corner (editing) and Grammarian Summary (published view) with different
            access levels.
          </Text>
          {ACCESS_ROWS.map(({ role, access, sections, full }) => (
            <View key={role} style={styles.accessRow}>
              <Text style={styles.accessRole} maxFontSizeMultiplier={1.25}>
                {role}
              </Text>
              <Text style={[styles.accessBadge, full ? styles.accessFull : styles.accessLimited]} maxFontSizeMultiplier={1.1}>
                {access}
              </Text>
              <Text style={styles.accessSections} maxFontSizeMultiplier={1.2}>
                {sections}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Word, quote, and idiom of the day
          </Text>
          <View style={[styles.callout, styles.calloutGold]}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Complete before the meeting starts
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Update all three items in the Pre-Meeting section of Grammarian Corner. They automatically appear in the
              meeting agenda.
            </Text>
          </View>
          {PRE_MEETING_ITEMS.map(({ title, desc, example }) => (
            <View key={title} style={styles.preMeetingCard}>
              <Text style={styles.preMeetingTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.preMeetingDesc} maxFontSizeMultiplier={1.25}>
                {desc}
              </Text>
              <Text style={styles.preMeetingExample} maxFontSizeMultiplier={1.2}>
                {example}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Show / hide report
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Use the eye button to control when the Grammarian Summary is visible. Keep it hidden while marking during
            the meeting, then publish once verified.
          </Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCard}>
              <Text style={[styles.toggleState, { color: GREEN }]} maxFontSizeMultiplier={1.2}>
                Eye ON — report visible
              </Text>
              <Text style={styles.toggleDesc} maxFontSizeMultiplier={1.2}>
                All members can see the Grammarian Summary with full observations.
              </Text>
            </View>
            <View style={styles.toggleCard}>
              <Text style={[styles.toggleState, { color: '#9F1239' }]} maxFontSizeMultiplier={1.2}>
                Eye OFF — report hidden
              </Text>
              <Text style={styles.toggleDesc} maxFontSizeMultiplier={1.2}>
                Recommended while actively marking during the live meeting.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Good usage
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Capture and celebrate excellent language used by members during the meeting.
          </Text>
          <BulletList items={GOOD_USAGE_ITEMS} bulletColor={GREEN} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Opportunities
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Record grammar corrections — note what was said and the correct usage.
          </Text>
          <BulletList items={OPPORTUNITY_ITEMS} bulletColor={GREEN} />
          {OPPORTUNITY_EXAMPLES.map(({ said, correct }) => (
            <View key={said} style={styles.oppRow}>
              <View style={styles.oppCol}>
                <Text style={styles.oppLabelWrong} maxFontSizeMultiplier={1.1}>
                  What was said
                </Text>
                <Text style={styles.oppWrong} maxFontSizeMultiplier={1.2}>
                  {said}
                </Text>
              </View>
              <View style={styles.oppCol}>
                <Text style={styles.oppLabelRight} maxFontSizeMultiplier={1.1}>
                  Correct usage
                </Text>
                <Text style={styles.oppRight} maxFontSizeMultiplier={1.2}>
                  {correct}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Stats — Word of the Day
          </Text>
          <BulletList items={STATS_ITEMS} bulletColor={GREEN} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Grammarian summary report
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The published report includes Good Usage, Opportunities, and Word of the Day stats for each member.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Before you publish
          </Text>
          <BulletList items={PRE_PUBLISH} bulletColor={GREEN} />
          <View style={styles.finalNote}>
            <Text style={styles.finalNoteTitle} maxFontSizeMultiplier={1.25}>
              Ready to publish
            </Text>
            <Text style={styles.finalNoteBody} maxFontSizeMultiplier={1.25}>
              Turn ON Show Report to Members using the eye button. Members will see the complete Grammarian Summary —
              helping them grow as communicators.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: N.page,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: N.text,
    fontSize: 18 * FS,
    fontWeight: '700',
  },
  headerSpacer: { width: 36, height: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  card: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    padding: 20,
  },
  kbBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GREEN_PALE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: GREEN,
  },
  docTitle: {
    fontSize: 22 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 8,
    letterSpacing: -0.3 * FS,
  },
  lead: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.textSecondary,
    marginBottom: 14,
  },
  pillarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  pillarChip: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: GREEN_PALE,
  },
  pillarLabel: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 2,
  },
  pillarSub: {
    fontSize: 11 * FS,
    color: N.textSecondary,
  },
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 12,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  callout: {
    backgroundColor: GREEN_PALE,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  calloutGreen: {
    backgroundColor: GREEN_PALE,
    borderColor: '#BBF7D0',
  },
  calloutGold: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  calloutTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  calloutBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  methodCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  methodTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  methodBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  accessRow: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  accessRole: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  accessBadge: {
    alignSelf: 'flex-start',
    fontSize: 11 * FS,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  accessFull: {
    backgroundColor: GREEN_PALE,
    color: GREEN,
  },
  accessLimited: {
    backgroundColor: '#EFF6FF',
    color: '#1E40AF',
  },
  accessSections: {
    fontSize: 13 * FS,
    color: N.textSecondary,
  },
  preMeetingCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderTopWidth: 3,
    borderTopColor: GREEN,
  },
  preMeetingTitle: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 6,
  },
  preMeetingDesc: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
    marginBottom: 8,
  },
  preMeetingExample: {
    fontSize: 12 * FS,
    fontStyle: 'italic',
    color: GREEN,
    backgroundColor: GREEN_PALE,
    padding: 8,
    borderRadius: 6,
  },
  toggleRow: {
    gap: 10,
    marginBottom: 12,
  },
  toggleCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    backgroundColor: N.surface,
  },
  toggleState: {
    fontSize: 14 * FS,
    fontWeight: '700',
    marginBottom: 4,
  },
  toggleDesc: {
    fontSize: 13 * FS,
    color: N.textSecondary,
    lineHeight: 19 * FS,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletMark: {
    fontSize: 12 * FS,
    color: GREEN,
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  oppRow: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  oppCol: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
  },
  oppLabelWrong: {
    fontSize: 10 * FS,
    fontWeight: '600',
    color: '#9F1239',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  oppLabelRight: {
    fontSize: 10 * FS,
    fontWeight: '600',
    color: GREEN,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  oppWrong: {
    fontSize: 13 * FS,
    fontStyle: 'italic',
    color: '#9F1239',
  },
  oppRight: {
    fontSize: 13 * FS,
    fontWeight: '500',
    color: GREEN,
  },
  finalNote: {
    backgroundColor: 'rgba(15, 26, 18, 0.06)',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  finalNoteTitle: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 6,
  },
  finalNoteBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
});

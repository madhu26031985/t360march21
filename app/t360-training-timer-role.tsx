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
const AMBER = '#D97706';
const AMBER_PALE = '#FFFBEB';

const BOOKING_STEPS = [
  { title: 'Go to the Home Tab', body: 'Open the Home tab and look for an open meeting. Tap the meeting to enter the meeting page.' },
  {
    title: 'Access the Timer section',
    body: 'Under Meeting Actions, click Book a Role — or open the Timer Report section directly.',
  },
  { title: 'Click Book Timer Role', body: 'Inside the Timer page, click Book Timer Role. You will be assigned as the Timer for that meeting.' },
  {
    title: 'Confirm assignment',
    body: 'Your name will appear under the Timer role for that meeting. You can also assign the Timer role to another member if needed.',
  },
];

const TIMED_ROLES = ['Prepared Speakers', 'Table Topic Speakers', 'Speech Evaluators', 'Educational Speaker'];

const ACCESS_ROWS: { role: string; access: string; sections: string; full?: boolean }[] = [
  { role: 'VP of Education', access: 'Full access', sections: 'Timer Corner + Timer Summary', full: true },
  { role: 'Assigned Timer', access: 'Full access', sections: 'Timer Corner + Timer Summary', full: true },
  { role: 'All other members', access: 'View only', sections: 'Timer Summary Report only', full: false },
];

const GUEST_FLOW = [
  { step: 'Step 01', title: 'Add the guest', body: 'Use Visiting Guest Management to add guests attending who are not in the app.' },
  {
    step: 'Step 02',
    title: 'Guest is registered',
    body: "The guest's name is now available in Ah Counter, Grammarian, and Timer sections.",
  },
  { step: 'Result', title: 'Seamless tracking', body: 'Assign roles and track guests during the meeting just like registered members.' },
];

const MARKING_STEPS = [
  { title: "Click Open next to the member's name", body: 'Once assigned to a role, click Open next to their name to access the timer screen.' },
  { title: 'Start the stopwatch', body: 'When the speaker begins, click Start. The system captures speech duration in real time.' },
  {
    title: 'Stop the timer',
    body: 'When the speaker finishes, click Stop. Qualification status is usually calculated automatically from timing rules.',
  },
  {
    title: 'Review and edit qualification if needed',
    body: 'If needed, manually update qualification to Yes or No based on the timing rules.',
  },
  { title: 'Save the entry', body: 'Click Save to store the timing report. Repeat for every speaker in the session.' },
];

const EDIT_OPTIONS = ['Edit the timing', 'Delete the entry', 'Refill correct details'];

const REPORT_POINTS: { icon: string; title: string; desc: string }[] = [
  { icon: '🕐', title: 'Speech duration', desc: 'Exact time recorded for each speaker across all roles.' },
  { icon: '✅', title: 'Qualification status', desc: 'Whether the speaker met the required time window for their role.' },
  { icon: '🗳️', title: 'Voting eligibility', desc: 'Report directly determines who is eligible to be voted for awards.' },
  { icon: '👁️', title: 'Eye toggle to publish', desc: 'Turn ON the eye button to make the Timer Summary visible to all members.' },
];

const PRE_PUBLISH_CHECKS = [
  'Timings are marked accurately — verify duration matches what was observed for each speaker.',
  "Qualifications are verified correctly — confirm each speaker's Yes/No status aligns with their actual speaking duration.",
  'Check the full report at least two times before using the eye button to publish the final Timer Summary.',
  'Confirm all speakers are included — ensure no role was missed, including manually assigned or guest speakers.',
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

function NumberedSteps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <>
      {steps.map((step, i) => (
        <View key={step.title} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText} maxFontSizeMultiplier={1.1}>
              {i + 1}
            </Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle} maxFontSizeMultiplier={1.25}>
              {step.title}
            </Text>
            <Text style={styles.stepText} maxFontSizeMultiplier={1.25}>
              {step.body}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingTimerRoleScreen() {
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
          The Timer Role
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
            The Timer Role
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Everything you need to book, manage, and publish accurate timing reports for a fair and well-coordinated
            Toastmasters meeting.
          </Text>

          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum} maxFontSizeMultiplier={1.2}>
                4
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={1.1}>
                role types timed
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum} maxFontSizeMultiplier={1.2}>
                2×
              </Text>
              <Text style={styles.statLabel} maxFontSizeMultiplier={1.1}>
                verify before publishing
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Booking the Timer role
          </Text>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Two ways to book
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Book via Book a Role under Meeting Actions, or directly through the Timer Report section inside the
              meeting page.
            </Text>
          </View>
          <NumberedSteps steps={BOOKING_STEPS} />
          <View style={styles.pathBox}>
            <Text style={styles.pathText} maxFontSizeMultiplier={1.2}>
              Home › Open Meeting › Meeting Actions › Book a Role
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Timer Corner and access levels
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once assigned, you will see Timer Corner and Timer Summary. The Timer has full control over timing for all
            speaking roles.
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
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Timer tracks time for:
          </Text>
          <View style={styles.chipRow}>
            {TIMED_ROLES.map((role) => (
              <View key={role} style={styles.chip}>
                <Text style={styles.chipText} maxFontSizeMultiplier={1.15}>
                  {role}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.callout, styles.calloutBlue]}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Auto-population
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              If members have already booked roles, their names appear automatically. If a role is not booked, use
              Assign during the meeting to add the speaker manually.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Visiting guest management
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Add guests who attend but are not registered in T360 so they can be tracked and assigned roles.
          </Text>
          {GUEST_FLOW.map(({ step, title, body }) => (
            <View key={title} style={styles.guestCard}>
              <Text style={styles.guestStep} maxFontSizeMultiplier={1.1}>
                {step}
              </Text>
              <Text style={styles.guestTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.guestBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to mark timer for a role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Use the built-in stopwatch: Start when the speaker begins, Stop when they finish, then Save. Qualification
            is calculated automatically based on timing rules.
          </Text>
          <View style={styles.stopwatchCard}>
            <Text style={styles.stopwatchTime} maxFontSizeMultiplier={1.3}>
              02:14
            </Text>
            <Text style={styles.stopwatchHint} maxFontSizeMultiplier={1.2}>
              ▶ Start · ■ Stop · ✓ Save
            </Text>
          </View>
          <NumberedSteps steps={MARKING_STEPS} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Editing and corrections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            If you notice mistakes after saving, you can correct timing entries before publishing:
          </Text>
          <BulletList items={EDIT_OPTIONS} bulletColor={AMBER} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Qualification and timer report
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once all timings are complete, publish the report so members can view speech durations and qualification
            status. Use the eye toggle to show the Timer Summary to members.
          </Text>
          <View style={styles.whyGrid}>
            {REPORT_POINTS.map(({ icon, title, desc }) => (
              <View key={title} style={styles.whyChip}>
                <Text style={styles.whyIcon} maxFontSizeMultiplier={1.3}>
                  {icon}
                </Text>
                <Text style={styles.whyTitle} maxFontSizeMultiplier={1.2}>
                  {title}
                </Text>
                <Text style={styles.whyText} maxFontSizeMultiplier={1.15}>
                  {desc}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Before you publish
          </Text>
          <View style={[styles.callout, styles.calloutRed]}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Important — verify twice
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Voting is conducted based on the timing qualification report. Errors in timing or qualification directly
              affect fair voting and meeting outcomes.
            </Text>
          </View>
          <BulletList items={PRE_PUBLISH_CHECKS} bulletColor={AMBER} />
          <View style={styles.finalNote}>
            <Text style={styles.finalNoteTitle} maxFontSizeMultiplier={1.25}>
              Once ready — publish
            </Text>
            <Text style={styles.finalNoteBody} maxFontSizeMultiplier={1.25}>
              Turn ON Show Timer Report to Member using the eye button. Members will see the complete Timer Summary
              including durations, qualification status, and voting eligibility.
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
    backgroundColor: AMBER_PALE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: AMBER,
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
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    backgroundColor: AMBER_PALE,
  },
  statNum: {
    fontSize: 20 * FS,
    fontWeight: '800',
    color: AMBER,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11 * FS,
    color: N.textSecondary,
    textAlign: 'center',
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
    backgroundColor: AMBER_PALE,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  calloutBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  calloutRed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
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
  pathBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  pathText: {
    fontSize: 12 * FS,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AMBER_PALE,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: AMBER,
  },
  stepBody: { flex: 1 },
  stepTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  stepText: {
    fontSize: 13 * FS,
    lineHeight: 20 * FS,
    color: N.textSecondary,
  },
  accessRow: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: N.surface,
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
    overflow: 'hidden',
  },
  accessFull: {
    backgroundColor: AMBER_PALE,
    color: AMBER,
  },
  accessLimited: {
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
  },
  accessSections: {
    fontSize: 13 * FS,
    color: N.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: N.surface,
  },
  chipText: {
    fontSize: 12 * FS,
    color: N.text,
    fontWeight: '500',
  },
  guestCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: AMBER,
  },
  guestStep: {
    fontSize: 10 * FS,
    fontWeight: '700',
    color: AMBER,
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  guestTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  guestBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  stopwatchCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  stopwatchTime: {
    fontSize: 28 * FS,
    fontWeight: '600',
    color: AMBER,
    letterSpacing: 2,
    marginBottom: 8,
  },
  stopwatchHint: {
    fontSize: 13 * FS,
    color: 'rgba(255,255,255,0.45)',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletMark: {
    fontSize: 12 * FS,
    color: AMBER,
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  whyChip: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: N.surface,
  },
  whyIcon: {
    marginBottom: 6,
  },
  whyTitle: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  whyText: {
    fontSize: 12 * FS,
    lineHeight: 17 * FS,
    color: N.textSecondary,
  },
  finalNote: {
    backgroundColor: 'rgba(30, 41, 59, 0.06)',
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

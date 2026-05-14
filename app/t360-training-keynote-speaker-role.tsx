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

const PRIMARY = '#1a3a5c';
const ACCENT = '#b45309';

const OVERVIEW_ITEMS: { label: string; value: string }[] = [
  { label: 'Role name', value: 'Keynote Speaker' },
  { label: 'Found in', value: 'Meetings tab' },
  { label: 'Booking method', value: 'Book a Role / Roles tab' },
  { label: 'Required action', value: 'Add Keynote Title' },
];

const PATH1_STEPS: { title: string; body: string }[] = [
  {
    title: 'Open the Meetings tab',
    body: 'Tap the Meetings tab from the bottom navigation bar to open the meetings section.',
  },
  {
    title: 'Tap Book a Role',
    body: 'Inside the Meetings screen, tap Book a Role to view the available roles for the upcoming meeting.',
  },
  {
    title: 'Go to the Open section',
    body: 'Scroll to or tap the Open section to see roles that are currently available to be booked.',
  },
  {
    title: 'Find and book Keynote Speaker',
    body: 'Locate Keynote Speaker in the Open section and tap it to book the role. Confirm if prompted.',
  },
  {
    title: 'Add Keynote Title and Save',
    body: 'After booking, enter your Keynote Title when prompted and tap Save to confirm.',
  },
];

const PATH2_STEPS: { title: string; body: string }[] = [
  {
    title: 'Open the Meetings tab',
    body: 'Tap the Meetings tab from the bottom navigation bar.',
  },
  {
    title: 'Tap the Roles tab',
    body: 'Within the Meetings screen, switch to the Roles tab to view the full list of meeting roles.',
  },
  {
    title: 'Tap Keynote Speaker directly',
    body: 'Find and tap Keynote Speaker from the Roles list.',
  },
  {
    title: 'Book the role',
    body: 'Tap Book to reserve the Keynote Speaker role for the selected meeting.',
  },
  {
    title: 'Add Keynote Title and Save',
    body: 'Enter your Keynote Title in the provided field and tap Save to complete the booking.',
  },
];

const TITLE_STEPS: { title: string; body: string }[] = [
  {
    title: 'Enter your Keynote Title',
    body: 'In the Keynote Title field that appears after booking, type the title of your keynote speech or presentation.',
  },
  {
    title: 'Review the title',
    body: 'Double-check the title for accuracy — it will appear on the meeting agenda visible to all attendees.',
  },
  {
    title: 'Tap Save',
    body: 'Tap Save to confirm your keynote title and complete the role booking.',
  },
];

const RESPONSIBILITIES: string[] = [
  'Prepare and deliver a keynote speech or presentation on a relevant topic.',
  'Provide a clear and descriptive Keynote Title when booking the role.',
  'Aim for an engaging, informative presentation suited to the meeting audience.',
  'Arrive prepared and ready to present at the designated time in the meeting agenda.',
  'Coordinate with the meeting organiser if you need any special setup or time allocation.',
  'Update or amend your Keynote Title before the meeting if your topic changes.',
];

const TIPS: string[] = [
  'The Keynote Speaker role is only available via the Meetings tab — it does not appear on the Home tab.',
  'Use Navigation 1 (Book a Role → Open) if you prefer browsing available roles before committing.',
  'Use Navigation 2 (Roles tab → Keynote Speaker) for a quicker, direct booking experience.',
  'Your Keynote Title is displayed on the meeting agenda, so make it clear and descriptive.',
  'If the role appears greyed out or unavailable, it may already be booked — check with your meeting organiser.',
  'Contact support through the Help section if you encounter issues booking the role.',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where can I find the Keynote Speaker role in the app?',
    a: 'The Keynote Speaker role is available exclusively under the Meetings tab. It does not appear on the Home tab. Use Book a Role or the Roles tab to locate and book it.',
  },
  {
    q: 'Is the Keynote Title mandatory when booking the role?',
    a: 'Yes. The Keynote Title is required. Your booking cannot be saved without entering a title. Enter a clear, descriptive title before tapping Save.',
  },
  {
    q: 'Can I edit my Keynote Title after saving?',
    a: 'Yes. Return to the Meetings tab, find your booked role, and edit the title. Tap Save again after changes.',
  },
  {
    q: 'What is the difference between Navigation 1 and Navigation 2?',
    a: 'Both paths book the same role. Navigation 1 (Meetings → Book a Role → Open) lets you browse all open roles first. Navigation 2 (Meetings → Roles tab → Keynote Speaker) is faster if you already know the role you want.',
  },
  {
    q: 'The Keynote Speaker role is greyed out — what should I do?',
    a: 'A greyed-out role usually means it is already booked for that meeting. Check with your meeting organiser. If you suspect a technical issue, use Help / support in the app.',
  },
  {
    q: 'Can I cancel my Keynote Speaker booking?',
    a: 'Yes. In the Meetings tab, find your booked Keynote Speaker role and cancel or unbook. Cancel as early as possible so another member can take the slot; notify the organiser if it is close to the meeting date.',
  },
  {
    q: 'Will my Keynote Title be visible to other members?',
    a: 'Yes. Once saved, your Keynote Title appears on the meeting agenda for members who can view that meeting.',
  },
  {
    q: 'Can I book the Keynote Speaker role for a future meeting?',
    a: 'Yes. In the Meetings tab, select the correct upcoming meeting, then follow either navigation path. Confirm the meeting date before booking.',
  },
  {
    q: 'How long should my Keynote presentation be?',
    a: 'Duration varies by meeting format; often about 10–20 minutes. Confirm the time allocation with your meeting organiser in advance.',
  },
  {
    q: 'I am unable to save my booking — what could be wrong?',
    a: 'The most common cause is a blank Keynote Title — it is required. Also check your connection and that the meeting date has not passed. Restart the app or contact support via Help if it persists.',
  },
];

function BulletList({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={styles.bulletMark} maxFontSizeMultiplier={1.2}>
            ✓
          </Text>
          <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

function StepBlock({ title, body, index }: { title: string; body: string; index: number }) {
  return (
    <View style={styles.stepBlock}>
      <View style={styles.stepHead}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText} maxFontSizeMultiplier={1.15}>
            {index + 1}
          </Text>
        </View>
        <Text style={styles.stepTitle} maxFontSizeMultiplier={1.25}>
          {title}
        </Text>
      </View>
      <Text style={styles.stepBody} maxFontSizeMultiplier={1.25}>
        {body}
      </Text>
    </View>
  );
}

export default function T360TrainingKeynoteSpeakerRoleScreen() {
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
          Keynote Speaker
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
              T360 · Knowledge base
            </Text>
          </View>
          <Text style={styles.docTitle} maxFontSizeMultiplier={1.35}>
            Keynote Speaker
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Step-by-step guidance for booking the Keynote Speaker role, adding your keynote title, and saving it — all
            within the Meetings section of the app.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Overview
          </Text>
          <View style={styles.overviewGrid}>
            {OVERVIEW_ITEMS.map((it) => (
              <View key={it.label} style={styles.overviewCell}>
                <Text style={styles.overviewLabel} maxFontSizeMultiplier={1.05}>
                  {it.label}
                </Text>
                <Text style={styles.overviewValue} maxFontSizeMultiplier={1.2}>
                  {it.value}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.noteBox}>
            <Text style={styles.noteText} maxFontSizeMultiplier={1.25}>
              <Text style={styles.inlineBold}>Note:</Text> The Keynote Speaker role is only accessible via the{' '}
              <Text style={styles.inlineBold}>Meetings tab</Text>. It is not available on the Home tab. Use either
              navigation path below to book the role.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Navigation 1 — Book a Role
          </Text>
          <View style={styles.pathBadge}>
            <Text style={styles.pathBadgeText} maxFontSizeMultiplier={1.05}>
              Path 1 of 2
            </Text>
          </View>
          <Text style={styles.breadcrumb} maxFontSizeMultiplier={1.15}>
            Meetings Tab → Book a Role → Open Section → Keynote Speaker
          </Text>
          {PATH1_STEPS.map((s, i) => (
            <StepBlock key={s.title} title={s.title} body={s.body} index={i} />
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Navigation 2 — Roles tab
          </Text>
          <View style={styles.pathBadge}>
            <Text style={styles.pathBadgeText} maxFontSizeMultiplier={1.05}>
              Path 2 of 2
            </Text>
          </View>
          <Text style={styles.breadcrumb} maxFontSizeMultiplier={1.15}>
            Meetings Tab → Roles Tab → Keynote Speaker
          </Text>
          {PATH2_STEPS.map((s, i) => (
            <StepBlock key={`p2-${s.title}`} title={s.title} body={s.body} index={i} />
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Adding the Keynote Title
          </Text>
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredBadgeText} maxFontSizeMultiplier={1.05}>
              Required step
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            After booking through either path, you must add your Keynote Title before saving. The title is visible to
            other members and in the meeting agenda.
          </Text>
          {TITLE_STEPS.map((s, i) => (
            <StepBlock key={`t-${s.title}`} title={s.title} body={s.body} index={i} />
          ))}
          <View style={styles.warnBox}>
            <Text style={styles.warnText} maxFontSizeMultiplier={1.25}>
              <Text style={styles.inlineBold}>Important:</Text> The Keynote Title is a{' '}
              <Text style={styles.inlineBold}>required field</Text>. The booking will not be saved if the title is left
              blank. You can edit the title later by returning to your booked role in the Meetings tab.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Keynote Speaker responsibilities
          </Text>
          <BulletList lines={RESPONSIBILITIES} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Tips and notes
          </Text>
          <BulletList lines={TIPS} />

          <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
            Frequently asked questions
          </Text>
          {FAQS.map(({ q, a }, i) => (
            <View key={q} style={[styles.faqBlock, i > 0 && styles.faqBlockBorder]}>
              <View style={styles.faqQRow}>
                <View style={styles.faqQBadge}>
                  <Text style={styles.faqQBadgeText} maxFontSizeMultiplier={1.1}>
                    Q{i + 1}
                  </Text>
                </View>
                <Text style={styles.faqQ} maxFontSizeMultiplier={1.25}>
                  {q}
                </Text>
              </View>
              <Text style={styles.faqA} maxFontSizeMultiplier={1.25}>
                {a}
              </Text>
            </View>
          ))}
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
    backgroundColor: 'rgba(26, 58, 92, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: PRIMARY,
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
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: PRIMARY,
    marginTop: 10,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  inlineBold: { fontWeight: '800', color: N.text },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  overviewCell: {
    width: '47%',
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: '#f8f7f4',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 12,
  },
  overviewLabel: {
    fontSize: 10 * FS,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: N.textSecondary,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: PRIMARY,
  },
  noteBox: {
    backgroundColor: '#fff8f0',
    borderWidth: 1,
    borderColor: '#f0d8b8',
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#5c3810',
  },
  pathBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f0f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  pathBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  breadcrumb: {
    fontSize: 13 * FS,
    color: N.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  stepBlock: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#fef9f4',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: ACCENT,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stepNumText: {
    color: '#fff',
    fontSize: 12 * FS,
    fontWeight: '800',
  },
  stepTitle: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '700',
    color: PRIMARY,
  },
  stepBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    paddingLeft: 38,
  },
  requiredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  requiredBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warnBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  warnText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#9a3412',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletMark: {
    fontSize: 14 * FS,
    color: ACCENT,
    fontWeight: '800',
    width: 22,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  faqHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 12,
    marginBottom: 12,
  },
  faqBlock: { paddingVertical: 12 },
  faqBlockBorder: { borderTopWidth: 1, borderTopColor: N.border },
  faqQRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  faqQBadge: {
    backgroundColor: 'rgba(26, 58, 92, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: PRIMARY,
  },
  faqQ: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '700',
    lineHeight: 22 * FS,
    color: N.text,
  },
  faqA: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
});

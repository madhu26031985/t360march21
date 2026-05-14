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

const METHOD1_STEPS = [
  'Open the meeting',
  'Tap Book a Role',
  'Go to the Open section',
  'Find Toastmaster of the Day',
  'Tap Book',
];

const METHOD2_STEPS = [
  'Open the Home page',
  'Tap the Toastmaster of the Day tab',
  'If the role is available, tap Book',
];

const AFTER_CHIPS: { label: string; tone: 'green' | 'blue' }[] = [
  { label: 'Role reserved for you', tone: 'green' },
  { label: 'Appears under Mine', tone: 'green' },
  { label: 'Visible as Taken to others', tone: 'green' },
  { label: 'Toastmaster Corner unlocked', tone: 'blue' },
];

const WITHDRAW_STEPS = [
  'Go to the Mine section',
  'Open Toastmaster of the Day',
  'Tap Withdraw',
];

const WITHDRAW_CHIPS = [
  'Role becomes available again',
  'Moves back to Open section',
  'Others can now book it',
];

const THEME_CARDS: { emoji: string; body: string }[] = [
  { emoji: '👥', body: 'Visible to all club members' },
  { emoji: '📋', body: 'Automatically appears in the Meeting Agenda' },
  { emoji: '🎯', body: 'Helps speakers align with the meeting flow' },
  { emoji: '✨', body: 'Creates a more engaging meeting experience' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I book the Toastmaster of the Day role?',
    a: 'You can book it in two ways: Meeting → Open Meeting → Book a Role, or from the Toastmaster of the Day tab on the Home page.',
  },
  {
    q: 'Can I withdraw the role after booking it?',
    a: 'Yes. Use Withdraw at any time before the meeting if you change your mind. The role returns to the Open section for others to book.',
  },
  {
    q: 'What happens after I book the role?',
    a: 'The role is reserved for you, appears under Mine, is visible as Taken to other members, and unlocks access to the Toastmaster Corner.',
  },
  {
    q: 'What is Toastmaster Corner?',
    a: 'Toastmaster Corner is a dedicated workspace for the Toastmaster of the Day to manage meeting responsibilities, especially updating the Theme of the Day. It is opened via the blue arrow button that appears next to the role after booking.',
  },
  {
    q: 'What is the first responsibility of the Toastmaster of the Day?',
    a: 'The first responsibility is to update the Theme of the Day inside the Toastmaster Corner, as early as possible after booking.',
  },
  {
    q: 'Why is the Theme of the Day important?',
    a: 'The theme guides the meeting, automatically appears in the Meeting Agenda, helps speakers and participants align, and creates a more engaging experience for everyone.',
  },
  {
    q: 'Who can update the Theme of the Day?',
    a: 'Only the Toastmaster of the Day (who booked the role) and the Vice President Education (VPE) can update the theme.',
  },
  {
    q: 'Where can I find the Toastmaster Corner?',
    a: 'A blue arrow button appears next to the Toastmaster of the Day role after booking. Tapping it opens the Toastmaster Corner.',
  },
  {
    q: 'Can the VPE update the theme if the Toastmaster has not?',
    a: 'Yes. The VPE can access the Toastmaster Corner and update the Theme of the Day so meeting preparation continues smoothly.',
  },
  {
    q: 'Can more than one person book the Toastmaster of the Day role?',
    a: 'No. Only one member can reserve the Toastmaster of the Day role for a given meeting.',
  },
];

function NumberedMethodSteps({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <View key={line} style={styles.methodStepRow}>
          <Text style={styles.methodStepNum} maxFontSizeMultiplier={1.15}>
            {i + 1}
          </Text>
          <Text style={styles.methodStepText} maxFontSizeMultiplier={1.2}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

function Chip({ label, tone }: { label: string; tone: 'green' | 'blue' | 'amber' }) {
  return (
    <View style={[styles.chip, tone === 'green' && styles.chipGreen, tone === 'blue' && styles.chipBlue, tone === 'amber' && styles.chipAmber]}>
      <Text
        style={[styles.chipText, tone === 'green' && styles.chipTextGreen, tone === 'blue' && styles.chipTextBlue, tone === 'amber' && styles.chipTextAmber]}
        maxFontSizeMultiplier={1.15}
      >
        {label}
      </Text>
    </View>
  );
}

export default function T360TrainingToastmasterOfTheDayScreen() {
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
          Toastmaster of the Day
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
            Toastmaster of the Day
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            How to book, manage, and fulfil the Toastmaster of the Day role — from reserving your spot to updating the
            Theme of the Day.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to book the Toastmaster of the Day role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            You can book the Toastmaster of the Day role in <Text style={styles.inlineBold}>two ways</Text>:
          </Text>

          <View style={styles.methodCard}>
            <View style={styles.methodNumWrap}>
              <Text style={styles.methodNumText} maxFontSizeMultiplier={1.2}>
                1
              </Text>
            </View>
            <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
              From Book a Role
            </Text>
            <View style={styles.navPath}>
              <Text style={styles.navPathText} maxFontSizeMultiplier={1.1}>
                Meeting <Text style={styles.navSep}>→</Text> Open Meeting <Text style={styles.navSep}>→</Text> Book a
                Role
              </Text>
            </View>
            <NumberedMethodSteps lines={METHOD1_STEPS} />
          </View>

          <View style={styles.methodCard}>
            <View style={styles.methodNumWrap}>
              <Text style={styles.methodNumText} maxFontSizeMultiplier={1.2}>
                2
              </Text>
            </View>
            <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
              From the Home page
            </Text>
            <Text style={styles.methodIntro} maxFontSizeMultiplier={1.2}>
              A dedicated tab on the Home page for faster access.
            </Text>
            <NumberedMethodSteps lines={METHOD2_STEPS} />
            <View style={styles.calloutFast}>
              <Text style={styles.calloutFastText} maxFontSizeMultiplier={1.2}>
                This is a faster way to reserve the role without navigating to the full role booking page.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What happens after booking?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once you book the Toastmaster of the Day role, it is immediately reserved for you:
          </Text>
          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel} maxFontSizeMultiplier={1.05}>
                Open
              </Text>
              <Text style={styles.flowBody} maxFontSizeMultiplier={1.15}>
                Available for members
              </Text>
            </View>
            <Text style={styles.flowArrow} maxFontSizeMultiplier={1.2}>
              →
            </Text>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel} maxFontSizeMultiplier={1.05}>
                Mine
              </Text>
              <Text style={styles.flowBody} maxFontSizeMultiplier={1.15}>
                Reserved for you
              </Text>
            </View>
            <Text style={styles.flowArrow} maxFontSizeMultiplier={1.2}>
              →
            </Text>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel} maxFontSizeMultiplier={1.05}>
                Taken
              </Text>
              <Text style={styles.flowBody} maxFontSizeMultiplier={1.15}>
                Visible to others as booked
              </Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            {AFTER_CHIPS.map((c) => (
              <Chip key={c.label} label={`✓ ${c.label}`} tone={c.tone} />
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to withdraw the role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Changed your mind? You can withdraw the role at any time before the meeting.
          </Text>
          <View style={styles.withdrawBox}>
            <Text style={styles.withdrawTitle} maxFontSizeMultiplier={1.25}>
              Steps to withdraw
            </Text>
            {WITHDRAW_STEPS.map((step, i) => (
              <View key={step} style={styles.withdrawRow}>
                <Text style={styles.withdrawNum} maxFontSizeMultiplier={1.15}>
                  {i + 1}
                </Text>
                <Text style={styles.withdrawText} maxFontSizeMultiplier={1.2}>
                  {step}
                </Text>
              </View>
            ))}
            <View style={styles.chipRow}>
              {WITHDRAW_CHIPS.map((label) => (
                <Chip key={label} label={`✓ ${label}`} tone="amber" />
              ))}
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Toastmaster Corner
          </Text>
          <View style={styles.cornerBox}>
            <View style={styles.cornerHeader}>
              <View style={styles.cornerIcon}>
                <Text style={styles.cornerIconEmoji} maxFontSizeMultiplier={1.2}>
                  🔵
                </Text>
              </View>
              <Text style={styles.cornerHeading} maxFontSizeMultiplier={1.25}>
                What is Toastmaster Corner?
              </Text>
            </View>
            <Text style={styles.cornerBody} maxFontSizeMultiplier={1.25}>
              After booking the role, a <Text style={styles.inlineBold}>blue arrow button</Text> appears next to the
              Toastmaster of the Day role. Tapping it opens the <Text style={styles.inlineBold}>Toastmaster Corner</Text>{' '}
              — a dedicated workspace created specifically to help you manage your meeting responsibilities.
            </Text>
          </View>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.2}>
            Primary responsibility — Theme of the Day
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The first and most important responsibility of the Toastmaster of the Day is to{' '}
            <Text style={styles.inlineBold}>update the Theme of the Day</Text> inside the Toastmaster Corner. The theme
            sets the direction and tone of the entire meeting.
          </Text>
          <View style={styles.calloutCream}>
            <Text style={styles.calloutCreamText} maxFontSizeMultiplier={1.2}>
              It is recommended to update the theme <Text style={styles.inlineBold}>as early as possible</Text> after
              booking the role.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why is the theme important?
          </Text>
          <View style={styles.themeGrid}>
            {THEME_CARDS.map(({ emoji, body }) => (
              <View key={body} style={styles.themeCard}>
                <Text style={styles.themeEmoji} maxFontSizeMultiplier={1.2}>
                  {emoji}
                </Text>
                <Text style={styles.themeBody} maxFontSizeMultiplier={1.15}>
                  {body}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Who can update the theme?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Only two roles have permission to update the Theme of the Day:
          </Text>
          <View style={styles.whoGrid}>
            <View style={styles.whoCard}>
              <View style={styles.whoNumWrap}>
                <Text style={styles.whoNumText} maxFontSizeMultiplier={1.15}>
                  1
                </Text>
              </View>
              <View style={styles.whoTextCol}>
                <Text style={styles.whoStrong} maxFontSizeMultiplier={1.2}>
                  Toastmaster of the Day
                </Text>
                <Text style={styles.whoSpan} maxFontSizeMultiplier={1.15}>
                  The member who booked the role.
                </Text>
              </View>
            </View>
            <View style={styles.whoCard}>
              <View style={styles.whoNumWrap}>
                <Text style={styles.whoNumText} maxFontSizeMultiplier={1.15}>
                  2
                </Text>
              </View>
              <View style={styles.whoTextCol}>
                <Text style={styles.whoStrong} maxFontSizeMultiplier={1.2}>
                  Vice President Education (VPE)
                </Text>
                <Text style={styles.whoSpan} maxFontSizeMultiplier={1.15}>
                  Can access Toastmaster Corner and update the theme when support is needed.
                </Text>
              </View>
            </View>
          </View>

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
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: '#0369A1',
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
    marginBottom: 22,
  },
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 13 * FS,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: N.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  inlineBold: { fontWeight: '800', color: N.text },
  methodCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
    backgroundColor: N.surface,
  },
  methodNumWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B1F2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  methodNumText: {
    color: '#FFFFFF',
    fontSize: 16 * FS,
    fontWeight: '700',
  },
  methodTitle: {
    fontSize: 17 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 10,
  },
  methodIntro: {
    fontSize: 13 * FS,
    color: N.textSecondary,
    marginBottom: 10,
  },
  navPath: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1410',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  navPathText: {
    fontSize: 12 * FS,
    color: '#E3B870',
    fontFamily: 'Menlo',
  },
  navSep: { color: 'rgba(255,255,255,0.35)' },
  methodStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107,31,42,0.12)',
    borderStyle: 'dashed',
  },
  methodStepNum: {
    width: 20,
    fontSize: 13 * FS,
    fontWeight: '700',
    color: '#6B1F2A',
    marginRight: 8,
  },
  methodStepText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 20 * FS,
    color: N.text,
  },
  calloutFast: {
    marginTop: 12,
    backgroundColor: '#F2EBE0',
    borderLeftWidth: 4,
    borderLeftColor: '#C8963E',
    borderRadius: 8,
    padding: 12,
  },
  calloutFastText: {
    fontSize: 14 * FS,
    lineHeight: 20 * FS,
    color: '#4A3728',
    fontStyle: 'italic',
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  flowItem: {
    flex: 1,
    minWidth: 100,
    maxWidth: 200,
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  flowLabel: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#6B1F2A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  flowBody: {
    fontSize: 13 * FS,
    lineHeight: 18 * FS,
    color: N.textSecondary,
    textAlign: 'center',
  },
  flowArrow: {
    alignSelf: 'center',
    fontSize: 18 * FS,
    color: '#C8963E',
    paddingHorizontal: 2,
    marginVertical: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  chip: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  chipGreen: {
    backgroundColor: '#EFF8F0',
    borderColor: 'rgba(45, 122, 69, 0.2)',
  },
  chipBlue: {
    backgroundColor: '#EEF4FC',
    borderColor: 'rgba(29, 95, 173, 0.2)',
  },
  chipAmber: {
    backgroundColor: '#FDF3EC',
    borderColor: 'rgba(181, 84, 28, 0.2)',
  },
  chipText: { fontSize: 12 * FS, fontWeight: '600' },
  chipTextGreen: { color: '#2D7A45' },
  chipTextBlue: { color: '#1D5FAD' },
  chipTextAmber: { color: '#B5541C' },
  withdrawBox: {
    backgroundColor: '#FDF3EC',
    borderWidth: 1.5,
    borderColor: 'rgba(181, 84, 28, 0.25)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  withdrawTitle: {
    fontSize: 17 * FS,
    fontWeight: '700',
    color: '#B5541C',
    marginBottom: 12,
  },
  withdrawRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  withdrawNum: {
    width: 22,
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#B5541C',
    marginRight: 8,
  },
  withdrawText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  cornerBox: {
    backgroundColor: '#EEF4FC',
    borderWidth: 1.5,
    borderColor: 'rgba(29, 95, 173, 0.2)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
  },
  cornerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  cornerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1D5FAD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerIconEmoji: { fontSize: 18 },
  cornerHeading: {
    flex: 1,
    fontSize: 18 * FS,
    fontWeight: '700',
    color: '#1D5FAD',
  },
  cornerBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  calloutCream: {
    backgroundColor: '#FFF9EE',
    borderWidth: 1,
    borderColor: 'rgba(232, 212, 154, 0.9)',
    borderLeftWidth: 4,
    borderLeftColor: '#C8922A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  calloutCreamText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#5a4a1e',
    fontStyle: 'italic',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  themeCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    backgroundColor: N.surface,
  },
  themeEmoji: { fontSize: 22 * FS, marginBottom: 6 },
  themeBody: {
    fontSize: 13 * FS,
    lineHeight: 18 * FS,
    color: N.text,
    textAlign: 'center',
  },
  whoGrid: { gap: 12, marginBottom: 8 },
  whoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 10,
    backgroundColor: N.surface,
    gap: 12,
  },
  whoNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6B1F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoNumText: { color: '#FFFFFF', fontSize: 14 * FS, fontWeight: '700' },
  whoTextCol: { flex: 1 },
  whoStrong: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  whoSpan: { fontSize: 13 * FS, lineHeight: 19 * FS, color: N.textSecondary },
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
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#0369A1',
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

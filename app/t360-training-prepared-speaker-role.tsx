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
  'Go to the Home tab and open the live meeting.',
  'Under Meeting Actions, tap Book a Role.',
  'Select Prepared Speaker from the role list.',
  'Choose an available speaker slot and confirm your booking.',
];

const METHOD2_STEPS = [
  'Go to the Home tab and open the live meeting.',
  'Tap Prepared Speeches to see speaker slots.',
  'View slots such as Prepared Speaker 1, 2, and 3.',
  'Tap Book next to an available slot to confirm.',
];

const SPEECH_FIELDS: { label: string; value: string; example?: string }[] = [
  { label: 'Speech Title', value: 'Enter your speech title' },
  { label: 'Pathway Name', value: 'Your Toastmasters pathway', example: 'e.g. Presentation Mastery, Dynamic Leadership' },
  { label: 'Level Number', value: 'Your pathway level', example: 'e.g. Level 1 – Level 5' },
  { label: 'Project Number', value: 'Enter your project number' },
  { label: 'Project Name', value: 'Enter the project name', example: 'e.g. Ice Breaker, Researching and Presenting' },
];

const EVAL_OPTIONS: { title: string; body: string }[] = [
  { title: 'Link', body: 'Paste the evaluation form URL directly into the link field.' },
  { title: 'PDF', body: 'Upload the evaluation form as a PDF file for offline access.' },
];

const SAVE_OUTCOMES = [
  'Speech details automatically appear in the meeting agenda',
  'Evaluation form becomes available to the assigned evaluator',
  'No need to share forms separately through WhatsApp or email',
];

const BEST_PRACTICES = [
  'Book your speaker slot early',
  'Update speech details immediately after booking',
  'Upload the evaluation form before the meeting',
  'Add evaluator comments if you need targeted feedback',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Is booking the role enough?',
    a: 'No. You should also update your speech details and add the evaluation form after booking your slot.',
  },
  {
    q: 'Where do I update my speech information?',
    a: 'Tap the Notebook with Pen icon next to your speaker slot to open Edit Prepared Speakers.',
  },
  {
    q: 'Can I upload a PDF evaluation form?',
    a: 'Yes. You can add the evaluation form as either a Link (URL) or a PDF file upload.',
  },
  {
    q: 'Do I need to send the evaluation form separately?',
    a: 'No. Once added in T360, the evaluator can access it directly — no need to send via WhatsApp or email.',
  },
  {
    q: 'Will my speech details appear in the agenda?',
    a: 'Yes. Speech details are automatically added to the meeting agenda once you save the information in T360.',
  },
  {
    q: 'Who assigns the evaluator?',
    a: 'Usually the VP Education assigns the evaluator. Once assigned, they receive your speech details and evaluation form automatically.',
  },
];

function NumberedSteps({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <View key={line} style={styles.stepRow}>
          <View style={styles.stepNum}>
            <Text style={styles.stepNumText} maxFontSizeMultiplier={1.1}>
              {i + 1}
            </Text>
          </View>
          <Text style={styles.stepText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingPreparedSpeakerRoleScreen() {
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
          Prepared Speaker
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
            Prepared Speaker
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Learn how to book a Prepared Speaker role and update your speech details so they automatically appear in
            the agenda and become available to your evaluator.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to book a Prepared Speaker role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            You can book a Prepared Speaker role only when there is an active meeting on the Home screen. There are
            two ways to reserve your slot:
          </Text>

          <View style={styles.methodGrid}>
            <View style={styles.methodCard}>
              <Text style={styles.methodLabel} maxFontSizeMultiplier={1.15}>
                Method 01
              </Text>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
                Through Book a Role
              </Text>
              <Text style={styles.methodDesc} maxFontSizeMultiplier={1.25}>
                Use Meeting Actions on the Home tab to select and confirm your speaker slot.
              </Text>
            </View>
            <View style={styles.methodCard}>
              <Text style={styles.methodLabel} maxFontSizeMultiplier={1.15}>
                Method 02
              </Text>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
                Through Prepared Speeches
              </Text>
              <Text style={styles.methodDesc} maxFontSizeMultiplier={1.25}>
                Browse available speaker slots directly and tap Book next to your preferred slot.
              </Text>
            </View>
          </View>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.2}>
            Method 1 — Through Book a Role
          </Text>
          <NumberedSteps lines={METHOD1_STEPS} />

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.2}>
            Method 2 — Through Prepared Speeches
          </Text>
          <NumberedSteps lines={METHOD2_STEPS} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Update your speech details
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            After booking, tap the Notebook with Pen icon next to your speaker slot to open Edit Prepared Speakers and
            fill in:
          </Text>
          {SPEECH_FIELDS.map(({ label, value, example }) => (
            <View key={label} style={styles.fieldCard}>
              <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.15}>
                {label}
              </Text>
              <Text style={styles.fieldValue} maxFontSizeMultiplier={1.25}>
                {value}
              </Text>
              {example ? (
                <Text style={styles.fieldExample} maxFontSizeMultiplier={1.2}>
                  {example}
                </Text>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Add evaluation form
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Share your evaluation form in two ways — this allows evaluators to access your form directly from T360:
          </Text>
          {EVAL_OPTIONS.map(({ title, body }) => (
            <View key={title} style={styles.evalCard}>
              <Text style={styles.evalTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.evalBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Comments for speech evaluator (optional)
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Use this field if you want focused feedback from your evaluator. For example:
          </Text>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutInfoText} maxFontSizeMultiplier={1.25}>
              • Please focus on vocal variety{'\n'}• Looking for feedback on body language
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            After completing all details, tap Save Information. Once saved:
          </Text>
          <View style={styles.calloutOk}>
            {SAVE_OUTCOMES.map((line) => (
              <Text key={line} style={styles.calloutOkLine} maxFontSizeMultiplier={1.25}>
                ✓ {line}
              </Text>
            ))}
          </View>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.25}>
            Generally, the VP Education assigns the evaluator. Once assigned, the evaluator will receive your speech
            details and evaluation form automatically.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Best practices
          </Text>
          {BEST_PRACTICES.map((line) => (
            <View key={line} style={styles.checkItem}>
              <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
                {line}
              </Text>
            </View>
          ))}

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
    backgroundColor: 'rgba(59, 91, 219, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: '#3B5BDB',
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
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 12,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  bodyMuted: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    marginBottom: 12,
  },
  methodGrid: {
    gap: 10,
    marginBottom: 16,
  },
  methodCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(59, 91, 219, 0.04)',
    borderTopWidth: 3,
    borderTopColor: '#3B5BDB',
  },
  methodLabel: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: '#3B5BDB',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 91, 219, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 91, 219, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#3B5BDB',
  },
  stepText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  fieldCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: N.surface,
  },
  fieldLabel: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: N.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14 * FS,
    color: N.text,
  },
  fieldExample: {
    fontSize: 12 * FS,
    color: N.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  evalCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(47, 158, 68, 0.04)',
    borderLeftWidth: 3,
    borderLeftColor: '#2F9E44',
  },
  evalTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  evalBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  calloutInfo: {
    backgroundColor: 'rgba(59, 91, 219, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 91, 219, 0.22)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  calloutInfoText: {
    fontSize: 14 * FS,
    lineHeight: 22 * FS,
    color: '#1D4ED8',
  },
  calloutOk: {
    backgroundColor: 'rgba(47, 158, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(47, 158, 68, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  calloutOkLine: {
    fontSize: 14 * FS,
    lineHeight: 22 * FS,
    color: '#15803D',
    marginBottom: 4,
  },
  checkItem: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 9,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(47, 158, 68, 0.04)',
  },
  checkText: {
    fontSize: 14 * FS,
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
    backgroundColor: 'rgba(59, 91, 219, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#3B5BDB',
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

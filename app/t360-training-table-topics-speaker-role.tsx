import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
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
const TEAL = '#00B4A0';

const META_PILLS = ['2 booking methods', 'Book in advance', 'Build confidence', 'Auto timing update'];

const PURPOSE_CARDS: { label: string; desc: string }[] = [
  { label: 'Think quickly', desc: 'Learn to formulate and structure ideas on the spot under time pressure.' },
  { label: 'Organize spontaneously', desc: 'Practice structuring thoughts coherently without preparation time.' },
  { label: 'Communicate under pressure', desc: 'Improve your ability to deliver clear messages even when flustered.' },
  { label: 'Build stage confidence', desc: 'Reduce fear of public speaking through frequent, low-stakes practice.' },
  { label: 'Reduce stage fear', desc: 'Comfort in front of an audience grows with every participation.' },
];

const WHY_BOOK: { title: string; body: string; example?: string }[] = [
  {
    title: 'Table Topics Master can prepare better',
    body: 'Knowing the number of expected participants allows the Table Topics Master to craft exactly the right number of engaging questions.',
    example: 'If 10 members book, the Table Topics Master prepares exactly 10 tailored questions.',
  },
  {
    title: 'Timer can prepare the timing sheet',
    body: "The Timer can automatically populate the timing sheet for all expected participants, ensuring accurate tracking and smoother meeting execution.",
  },
  {
    title: 'Better meeting coordination',
    body: 'Early bookings help the ExComm team plan the meeting flow efficiently, avoiding last-minute scrambles.',
  },
];

const METHOD1_STEPS: { title: string; body: string; extras?: string[] }[] = [
  { title: 'Open the live meeting', body: 'Go to the Home tab and open the current live meeting.' },
  {
    title: 'Click on Table Topic',
    body: 'Inside the meeting page, locate and click on the Table Topic section.',
    extras: ['Home › Live Meeting › Table Topic'],
  },
  {
    title: 'Enter the Table Topic Corner',
    body: 'You will be taken to the Table Topic Corner — the dedicated section for managing Table Topics participation.',
  },
  {
    title: 'Find available speaker slots',
    body: "Under the Participant Section, you'll see available slots:",
    extras: ['TT Speaker 1', 'TT Speaker 2', 'TT Speaker 3', '+ additional slots if enabled'],
  },
  {
    title: 'Click Book',
    body: 'Click the Book button next to any available slot to confirm your participation.',
    extras: [
      'Your participation is confirmed',
      'Your name appears in the Table Topics session',
      'Table Topics Master and Timer are updated automatically',
    ],
  },
];

const METHOD2_STEPS: { title: string; body: string; extras?: string[] }[] = [
  { title: 'Open the live meeting', body: 'Go to the Home tab and open the current live meeting.' },
  {
    title: 'Click Book a Role',
    body: 'Under Meeting Actions, click the Book a Role option.',
    extras: ['Home › Live Meeting › Meeting Actions › Book a Role'],
  },
  {
    title: 'Select Table Topics Speaker',
    body: 'From the list of available meeting roles, select Table Topics Speaker.',
  },
  {
    title: 'Confirm your booking',
    body: 'Confirm your selection to complete the booking.',
    extras: ['Your role is reserved for the meeting', 'You are added to the Table Topics participant list'],
  },
];

const AFTER_BOOKING: { title: string; desc: string }[] = [
  { title: 'Participation confirmed', desc: 'Your slot is reserved and your name is officially added to the Table Topics list.' },
  { title: 'TT Master notified', desc: 'The Table Topics Master can plan and prepare questions based on the confirmed participant count.' },
  { title: 'Timing sheet updated', desc: "The Timer's timing sheet is automatically updated with your slot for accurate tracking." },
  { title: 'Agenda reflected', desc: 'Your participation may appear in the meeting agenda (if enabled by ExComm).' },
];

const BENEFITS: { title: string; desc: string }[] = [
  { title: 'Impromptu speaking skills', desc: 'Learn to speak confidently and cohesively without preparation or notes.' },
  { title: 'Build confidence', desc: 'Regular participation reduces hesitation and nervousness over time.' },
  { title: 'Think quickly under pressure', desc: 'Develop the reflex to organize and articulate thoughts instantly.' },
  { title: 'Reduce stage fear', desc: 'Frequent speaking in a safe environment steadily improves comfort on stage.' },
  { title: 'Better communication', desc: 'Express ideas clearly and confidently in every area of life, not just Toastmasters.' },
  { title: 'Support the team', desc: 'Booking early helps the TT Master, Timer, and ExComm prepare a better session for everyone.' },
];

const BEST_PRACTICES = [
  'Try to participate in Table Topics at every meeting you attend',
  'Book your role early to help the meeting team prepare',
  'Challenge yourself with impromptu speaking regularly — even when it feels uncomfortable',
  'Build confidence through consistent, repeated participation over time',
];

function BookingSteps({ steps }: { steps: { title: string; body: string; extras?: string[] }[] }) {
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
            {step.extras?.map((extra) =>
              extra.startsWith('Home') || extra.startsWith('Your') ? (
                <View
                  key={extra}
                  style={extra.startsWith('Your') ? styles.confirmBox : styles.pathBox}
                >
                  <Text
                    style={extra.startsWith('Your') ? styles.confirmText : styles.pathText}
                    maxFontSizeMultiplier={1.2}
                  >
                    {extra.startsWith('Your') ? `✓ ${extra}` : extra}
                  </Text>
                </View>
              ) : extra.startsWith('+') ? (
                <Text key={extra} style={styles.slotMore} maxFontSizeMultiplier={1.15}>
                  {extra}
                </Text>
              ) : (
                <View key={extra} style={styles.slotPill}>
                  <Text style={styles.slotPillText} maxFontSizeMultiplier={1.15}>
                    {extra}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingTableTopicsSpeakerRoleScreen() {
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
          Table Topics Speaker
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
            Table Topics Speaker Booking
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Learn how to reserve your spot for impromptu speaking and help your meeting team prepare for a smooth,
            well-coordinated session.
          </Text>

          <View style={styles.metaWrap}>
            {META_PILLS.map((pill) => (
              <View key={pill} style={styles.metaPill}>
                <Text style={styles.metaPillText} maxFontSizeMultiplier={1.15}>
                  {pill}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What is Table Topics?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The impromptu speaking segment of every Toastmasters meeting — designed to sharpen your thinking and build
            confidence one unexpected question at a time.
          </Text>
          <View style={styles.calloutTeal}>
            <Text style={styles.calloutTealTitle} maxFontSizeMultiplier={1.25}>
              The core idea
            </Text>
            <Text style={styles.calloutTealText} maxFontSizeMultiplier={1.25}>
              Participants are given an unexpected question or topic and speak for a short duration without any prior
              preparation. Even experienced speakers benefit greatly from regular Table Topics participation.
            </Text>
          </View>
          {PURPOSE_CARDS.map(({ label, desc }) => (
            <View key={label} style={styles.purposeCard}>
              <Text style={styles.purposeLabel} maxFontSizeMultiplier={1.25}>
                {label}
              </Text>
              <Text style={styles.purposeDesc} maxFontSizeMultiplier={1.25}>
                {desc}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why book early?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Booking your Table Topics Speaker slot in advance directly benefits your meeting team — and makes the
            session smoother for everyone.
          </Text>
          {WHY_BOOK.map(({ title, body, example }) => (
            <View key={title} style={styles.whyCard}>
              <Text style={styles.whyTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.whyBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
              {example ? (
                <Text style={styles.whyExample} maxFontSizeMultiplier={1.2}>
                  {example}
                </Text>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to book your role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            There are two ways to reserve a Table Topics Speaker slot. Choose whichever fits your workflow.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.2}>
            Method 1 — Table Topic section
          </Text>
          <View style={styles.calloutTeal}>
            <Text style={styles.calloutTealTitle} maxFontSizeMultiplier={1.25}>
              Quickest method
            </Text>
            <Text style={styles.calloutTealText} maxFontSizeMultiplier={1.25}>
              The fastest way to reserve your Table Topics participation — directly from the Table Topic Corner inside
              the live meeting.
            </Text>
          </View>
          <BookingSteps steps={METHOD1_STEPS} />

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.2}>
            Method 2 — Book a Role
          </Text>
          <View style={styles.calloutTeal}>
            <Text style={styles.calloutTealTitle} maxFontSizeMultiplier={1.25}>
              Alternative method
            </Text>
            <Text style={styles.calloutTealText} maxFontSizeMultiplier={1.25}>
              Use the general Book a Role option from Meeting Actions — useful when browsing all available roles for a
              meeting.
            </Text>
          </View>
          <BookingSteps steps={METHOD2_STEPS} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What happens after booking?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once you book, T360 handles the coordination automatically across the meeting team.
          </Text>
          {AFTER_BOOKING.map(({ title, desc }) => (
            <View key={title} style={styles.afterCard}>
              <Text style={styles.afterTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.afterDesc} maxFontSizeMultiplier={1.25}>
                {desc}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Benefits of participating
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Regular Table Topics practice is one of the fastest paths to becoming a confident, polished communicator.
          </Text>
          {BENEFITS.map(({ title, desc }) => (
            <View key={title} style={styles.benefitCard}>
              <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.benefitDesc} maxFontSizeMultiplier={1.25}>
                {desc}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Best practice
          </Text>
          <View style={styles.calloutNavy}>
            <Text style={styles.calloutNavyTitle} maxFontSizeMultiplier={1.25}>
              Quick tip
            </Text>
            <Text style={styles.calloutNavyText} maxFontSizeMultiplier={1.25}>
              Regular Table Topics participation is one of the fastest ways to improve public speaking, confidence, and
              communication skills. Book your slot early and show up ready to speak.
            </Text>
          </View>
          {BEST_PRACTICES.map((line) => (
            <View key={line} style={styles.bpItem}>
              <View style={styles.bpCheck}>
                <Text style={styles.bpCheckText} maxFontSizeMultiplier={1.1}>
                  ✓
                </Text>
              </View>
              <Text style={styles.bpText} maxFontSizeMultiplier={1.25}>
                {line}
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
    backgroundColor: 'rgba(0, 180, 160, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: TEAL,
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
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  metaPill: {
    backgroundColor: 'rgba(0, 180, 160, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 160, 0.25)',
  },
  metaPillText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: TEAL,
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
    marginTop: 16,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  calloutTeal: {
    backgroundColor: 'rgba(0, 180, 160, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 160, 0.22)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  calloutTealTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  calloutTealText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  purposeCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: N.surface,
  },
  purposeLabel: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  purposeDesc: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  whyCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 180, 160, 0.04)',
  },
  whyTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  whyBody: {
    fontSize: 13 * FS,
    lineHeight: 20 * FS,
    color: N.textSecondary,
  },
  whyExample: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.text,
    fontStyle: 'italic',
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
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
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumText: {
    fontSize: 12 * FS,
    fontWeight: '800',
    color: '#0D1B2A',
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
  pathBox: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D1B2A',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  pathText: {
    fontSize: 12 * FS,
    color: '#00D4BE',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  slotPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 180, 160, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 180, 160, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
    marginRight: 8,
  },
  slotPillText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: TEAL,
  },
  slotMore: {
    fontSize: 12 * FS,
    color: N.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  confirmBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
  },
  confirmText: {
    fontSize: 13 * FS,
    color: '#16A34A',
  },
  afterCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: N.surface,
  },
  afterTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  afterDesc: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  benefitCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: N.surface,
  },
  benefitTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  calloutNavy: {
    backgroundColor: '#0D1B2A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  calloutNavyTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  calloutNavyText: {
    fontSize: 13 * FS,
    lineHeight: 20 * FS,
    color: 'rgba(255,255,255,0.65)',
  },
  bpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    backgroundColor: N.surface,
  },
  bpCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bpCheckText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#0D1B2A',
  },
  bpText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
});

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

const FLOW_STEPS = [
  'Create poll',
  'Auto fill',
  'Edit',
  'Share link',
  'Voting live',
  'Close poll',
  'View results',
];

const AUTO_FILL_ITEMS: { title: string; body: string; timerOnly?: boolean }[] = [
  {
    title: 'Best role player',
    body: 'Auto-filled from booked roles: Toastmaster of the Day, General Evaluator, Table Topics Master.',
  },
  {
    title: 'Best ancillary speaker',
    body: 'Auto-filled from supporting roles: Timer, Grammarian, Ah-Counter, and other ancillary roles.',
  },
  {
    title: 'Best prepared speaker',
    body: 'Included only if qualified by the Timer based on Toastmasters timing rules.',
    timerOnly: true,
  },
  {
    title: 'Best speech evaluator',
    body: 'Evaluators are included only if qualified by the Timer. Disqualified evaluators are excluded automatically.',
    timerOnly: true,
  },
  {
    title: 'Best table topics speaker',
    body: 'Table topics speakers included only when qualified by the Timer. Disqualified speakers are excluded.',
    timerOnly: true,
  },
  {
    title: 'Overall meeting experience',
    body: 'Captures attendee feedback on meeting quality. Response options: Good / Bad.',
  },
];

const ADMIN_CONTROLS = [
  'Add nominees',
  'Remove nominees',
  'Edit auto-filled data',
  'Add guests',
  'Customize options',
];

const SHARE_CHANNELS = ['WhatsApp', 'Club groups', 'Email'];

const ANONYMOUS_POINTS = [
  'Who voted is never revealed',
  'Vote choices are private',
  'Voting patterns hidden',
  'Only final results shown',
];

const LIFECYCLE: { title: string; body: string }[] = [
  {
    title: 'Create a poll',
    body: 'Choose a meeting, add a custom title, select questions, and use Auto Fill or set nominees manually.',
  },
  {
    title: 'Share the link',
    body: 'Share via WhatsApp, club groups, or email. No login needed to vote.',
  },
  {
    title: 'Voting goes live',
    body: 'Members see a "Voting is Live" notification. The poll appears under the Active tab.',
  },
  {
    title: 'Close the poll',
    body: 'Click the X Close Poll button. Voting stops immediately and no further votes are accepted.',
  },
  {
    title: 'View results',
    body: 'Results appear under the Results tab — winners by category, voting outcomes, and meeting feedback, without revealing voter identity.',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I manually edit auto-filled nominees?',
    a: 'Yes. ExCom can add, remove, or edit nominees at any time before creating the poll.',
  },
  {
    q: 'Can guests participate in voting?',
    a: 'Yes. Anyone with the voting link can participate, even if they are not part of the app.',
  },
  {
    q: 'Why is a prepared speaker missing from the poll?',
    a: 'The participant may have been disqualified by the Timer based on Toastmasters timing rules.',
  },
  {
    q: 'Can I add someone who is not part of the club?',
    a: 'Yes. Manual entry allows adding guests or external participants.',
  },
  {
    q: 'Can members vote after the poll is closed?',
    a: 'No. Once closed, voting is permanently disabled and no additional votes are accepted.',
  },
  {
    q: 'Is voting anonymous?',
    a: 'Yes. Voting is completely confidential — no one can see who voted for whom.',
  },
  {
    q: 'Where can members find active voting?',
    a: 'Active voting appears in the Home Tab under "Voting live".',
  },
  {
    q: 'Can multiple polls remain active?',
    a: 'No. Only one poll can be active at a time.',
  },
];

function BulletList({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={styles.bulletMark} maxFontSizeMultiplier={1.25}>
            •
          </Text>
          <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingExcommVotingOperationsScreen() {
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Voting Operations
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
            Voting Operations
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Help clubs conduct fair, structured, and anonymous meeting voting with minimal manual effort — from poll
            creation to result viewing.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            At a glance
          </Text>
          <View style={styles.flowWrap}>
            {FLOW_STEPS.map((step, i) => (
              <View key={step} style={styles.flowChunk}>
                {i > 0 ? (
                  <Text style={styles.flowArrow} maxFontSizeMultiplier={1.2}>
                    →{' '}
                  </Text>
                ) : null}
                <View style={styles.flowPill}>
                  <Text style={styles.flowPillText} maxFontSizeMultiplier={1.2}>
                    {step}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Access
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Who can manage voting?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Only ExCom members can create or manage polls. Regular members and guests can participate in voting but
            cannot create or manage polls.
          </Text>
          <View style={styles.restrictBadge}>
            <Text style={styles.restrictBadgeText} maxFontSizeMultiplier={1.15}>
              ExCom members only
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Auto fill — smart poll creation
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Auto fill minimizes manual effort by automatically generating nominees based on meeting role bookings and
            Timer qualification.
          </Text>
          {AUTO_FILL_ITEMS.map(({ title, body, timerOnly }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
              {timerOnly ? (
                <View style={styles.timerBadge}>
                  <Text style={styles.timerBadgeText} maxFontSizeMultiplier={1.1}>
                    Timer-qualified only
                  </Text>
                </View>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Manual editing & flexibility
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Full admin control
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Even with Auto Fill, admins maintain complete control over the poll before publishing.
          </Text>
          {ADMIN_CONTROLS.map((line) => (
            <Text key={line} style={styles.checkLine} maxFontSizeMultiplier={1.25}>
              ✔ {line}
            </Text>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Poll sharing
          </Text>
          <View style={styles.shareRow}>
            {SHARE_CHANNELS.map((ch) => (
              <View key={ch} style={styles.shareChip}>
                <Text style={styles.shareChipText} maxFontSizeMultiplier={1.15}>
                  {ch}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutInfoText} maxFontSizeMultiplier={1.25}>
              No app login required — anyone with the link can participate in voting.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Anonymous voting & confidentiality
          </Text>
          <BulletList lines={ANONYMOUS_POINTS} />
          <View style={styles.calloutOk}>
            <Text style={styles.calloutOkText} maxFontSizeMultiplier={1.25}>
              Only one poll can be active at a time. Results appear under the Results tab after closure.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Poll lifecycle steps
          </Text>
          {LIFECYCLE.map(({ title, body }, i) => (
            <View key={title} style={styles.lifecycleBlock}>
              <View style={styles.lifecycleHead}>
                <View style={styles.lifecycleNum}>
                  <Text style={styles.lifecycleNumText} maxFontSizeMultiplier={1.2}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={styles.lifecycleTitle} maxFontSizeMultiplier={1.25}>
                  {title}
                </Text>
              </View>
              <Text style={styles.lifecycleBody} maxFontSizeMultiplier={1.25}>
                {body}
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
    fontSize: 20 * FS,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
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
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginTop: 4,
    marginBottom: 6,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  flowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 8,
  },
  flowChunk: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flowArrow: {
    fontSize: 14 * FS,
    color: N.textSecondary,
    marginRight: 2,
  },
  flowPill: {
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.border,
  },
  flowPillText: {
    fontSize: 13 * FS,
    fontWeight: '600',
    color: N.text,
  },
  restrictBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(190, 24, 93, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 16,
    marginTop: 4,
  },
  restrictBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#9D174D',
  },
  miniCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(55, 53, 47, 0.02)',
  },
  miniCardTitle: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 6,
  },
  miniCardBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  timerBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timerBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: '#A16207',
  },
  checkLine: {
    fontSize: 15 * FS,
    lineHeight: 24 * FS,
    color: N.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  shareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  shareChip: {
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: N.border,
    marginRight: 8,
    marginBottom: 8,
  },
  shareChipText: {
    fontSize: 13 * FS,
    fontWeight: '600',
    color: N.text,
  },
  calloutInfo: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  calloutInfoText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  calloutOk: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  calloutOkText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#15803D',
    fontWeight: '500',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletMark: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.textSecondary,
    minWidth: 18 * FS,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.text,
  },
  lifecycleBlock: {
    marginBottom: 16,
  },
  lifecycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  lifecycleNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lifecycleNumText: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: '#0369A1',
  },
  lifecycleTitle: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
  },
  lifecycleBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    paddingLeft: 38,
  },
  faqHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 12,
    marginBottom: 12,
  },
  faqBlock: {
    paddingVertical: 12,
  },
  faqBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
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
    paddingLeft: 0,
  },
});

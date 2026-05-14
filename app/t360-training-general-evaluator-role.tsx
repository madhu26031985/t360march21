import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { goBackOrReplace } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#111827',
  textSecondary: '#6b7280',
};

const FS = 0.9;
const ACCENT = '#1d4ed8';
const ACCENT_LIGHT = '#eff6ff';
const ACCENT_MID = '#bfdbfe';

const PATH_BOOK_ROLE = [
  'Open the meeting',
  'Tap Book a Role',
  'Go to the Open section',
  'Find General Evaluator',
  'Tap Book',
];

const PATH_HOME = [
  'Open the Home page',
  'Tap the General Evaluator tab',
  'If available, tap Book',
];

const AFTER_BOOKING: string[] = [
  'Your name appears under General Evaluator in the meeting agenda',
  'The General Evaluator Report page becomes available',
  'You gain access to two dedicated tabs: GE Corner and GE Summary',
];

const TWO_TABS: string[] = [
  'GE Corner — where you evaluate during the meeting',
  'GE Summary — the member-facing published report',
];

const EVAL_AREAS = [
  'Meeting Preparation & Setup',
  'Meeting Opening',
  'Guest Experience',
  'Meeting Leadership',
  'Flow & Transitions',
  'Overall Effectiveness',
];

const EYE_HIDDEN: string[] = [
  'Report remains private',
  'Members cannot view the evaluation',
  'GE Summary hidden from club members',
  'You can continue entering ratings freely',
];

const EYE_VISIBLE: string[] = [
  'Report visible in GE Summary',
  'Meeting attendees can view the evaluation',
  'Club users can refer to it anytime',
  'Saved under the Club tab for reference',
];

const BEST_PRACTICE: string[] = [
  'Keep the Eye button locked while evaluating during the meeting',
  'Only turn it ON once your evaluation is fully complete',
];

const GE_SUMMARY_POINTS: string[] = [
  'Members see the complete General Evaluator feedback',
  'Meeting strengths and improvement areas become visible',
  'The evaluation is preserved digitally for future learning',
  'Helps clubs maintain a historical record of meeting quality',
];

const WORKFLOW_STEPS: { title: string; body: string }[] = [
  { title: 'Book the role', body: 'Reserve the General Evaluator role via Book a Role or the Home page tab.' },
  { title: 'Open the report page', body: 'Access your dedicated reporting workspace after booking is confirmed.' },
  { title: 'Use GE Corner during the meeting', body: 'Capture ratings live while the meeting is in progress — in real time.' },
  { title: 'Keep the report private while preparing', body: 'Leave the Eye button locked until your full evaluation is complete.' },
  { title: 'Publish the report', body: 'Turn on Show GE Report to Members to make it visible.' },
  { title: 'Members view the report', body: 'The evaluation appears in GE Summary and is stored under the Club tab.' },
];

const BENEFITS: { icon: string; label: string }[] = [
  { icon: '⚡', label: 'Real-time meeting evaluation' },
  { icon: '📋', label: 'Structured feedback collection' },
  { icon: '📤', label: 'Instant sharing with members' },
  { icon: '🗂️', label: 'Historical reference for clubs' },
  { icon: '📱', label: 'Fully digital experience' },
];

function CheckList({ lines, checkColor }: { lines: string[]; checkColor?: string }) {
  const markColor = checkColor ?? '#10b981';
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.checkRow}>
          <Text style={[styles.checkMark, { color: markColor }]} maxFontSizeMultiplier={1.2}>
            ✓
          </Text>
          <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

function PathList({ items }: { items: string[] }) {
  return (
    <View style={styles.pathList}>
      {items.map((item) => (
        <View key={item} style={styles.pathRow}>
          <Text style={styles.pathArrow} maxFontSizeMultiplier={1.15}>
            →
          </Text>
          <Text style={styles.pathText} maxFontSizeMultiplier={1.2}>
            {item}
          </Text>
        </View>
      ))}
    </View>
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
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle} maxFontSizeMultiplier={1.25}>
            {title}
          </Text>
          <Text style={styles.stepBody} maxFontSizeMultiplier={1.25}>
            {body}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function T360TrainingGeneralEvaluatorRoleScreen() {
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
          General Evaluator
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
            General Evaluator
          </Text>
          <Text style={styles.docSubtitle} maxFontSizeMultiplier={1.2}>
            Report guide
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Everything you need to perform the General Evaluator role digitally — from booking to publishing.
          </Text>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Getting started
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to book the General Evaluator role
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Before you can submit a General Evaluator Report, you must first reserve the role. There are two ways to do
            this in T360.
          </Text>

          <View style={styles.methodGrid}>
            <View style={styles.methodCard}>
              <Text style={styles.methodNum} maxFontSizeMultiplier={1.2}>
                1
              </Text>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.2}>
                From Book a Role
              </Text>
              <PathList items={PATH_BOOK_ROLE} />
            </View>
            <View style={styles.methodCard}>
              <Text style={styles.methodNum} maxFontSizeMultiplier={1.2}>
                2
              </Text>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.2}>
                From the Home page
              </Text>
              <PathList items={PATH_HOME} />
              <Text style={styles.methodNote} maxFontSizeMultiplier={1.15}>
                Faster access — no need to navigate to the full role booking page.
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Confirmation
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What happens after booking?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once you book the General Evaluator role, the following immediately take effect:
          </Text>
          <View style={styles.calloutSuccess}>
            <Text style={styles.calloutSuccessTitle} maxFontSizeMultiplier={1.15}>
              Role confirmed
            </Text>
            <CheckList lines={AFTER_BOOKING} />
          </View>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Your workspace
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            The General Evaluator Report page
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            This is your dedicated workspace to capture meeting ratings and publish the final evaluation. After opening
            the role page, you will find two tabs that guide you through the entire process.
          </Text>
          <View style={styles.calloutBlue}>
            <Text style={styles.calloutBlueTitle} maxFontSizeMultiplier={1.15}>
              Two tabs, one workflow
            </Text>
            <CheckList lines={TWO_TABS} checkColor={ACCENT} />
          </View>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Tab 1
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            GE Corner
          </Text>
          <View style={styles.tabPanel}>
            <View style={styles.tabHeader}>
              <View style={styles.tabIcon}>
                <Text style={styles.tabIconText} maxFontSizeMultiplier={1.1}>
                  GE
                </Text>
              </View>
              <View style={styles.tabHeaderText}>
                <Text style={styles.tabTitle} maxFontSizeMultiplier={1.2}>
                  GE Corner
                </Text>
                <Text style={styles.tabSubtitle} maxFontSizeMultiplier={1.15}>
                  Live evaluation workspace
                </Text>
              </View>
            </View>
            <View style={styles.tabBody}>
              <Text style={styles.body} maxFontSizeMultiplier={1.25}>
                GE Corner is where you perform your evaluation during the meeting. It contains all evaluation questions
                covering different aspects of the session.
              </Text>
              <Text style={styles.bodyStrong} maxFontSizeMultiplier={1.2}>
                Evaluation areas include:
              </Text>
              <View style={styles.pillRow}>
                {EVAL_AREAS.map((p) => (
                  <View key={p} style={styles.pill}>
                    <Text style={styles.pillText} maxFontSizeMultiplier={1.1}>
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.body} maxFontSizeMultiplier={1.25}>
                For each question, select a rating and capture observations in real time — building the report
                progressively rather than relying on memory at the end.
              </Text>
            </View>
          </View>

          <Text style={styles.subSectionTitle} maxFontSizeMultiplier={1.25}>
            Show GE Report to Members
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            At the top of GE Corner, you will find the Show GE Report to Members toggle with an Eye button. This controls
            report visibility.
          </Text>
          <View style={styles.eyeGrid}>
            <View style={[styles.eyeCard, styles.eyeCardLocked]}>
              <Text style={styles.eyeEmoji} maxFontSizeMultiplier={1.2}>
                🔒
              </Text>
              <Text style={styles.eyeCardTitleLocked} maxFontSizeMultiplier={1.15}>
                Eye button locked — hidden
              </Text>
              {EYE_HIDDEN.map((t) => (
                <Text key={t} style={styles.eyeBullet} maxFontSizeMultiplier={1.2}>
                  • {t}
                </Text>
              ))}
            </View>
            <View style={[styles.eyeCard, styles.eyeCardVisible]}>
              <Text style={styles.eyeEmoji} maxFontSizeMultiplier={1.2}>
                👁️
              </Text>
              <Text style={styles.eyeCardTitleVisible} maxFontSizeMultiplier={1.15}>
                Eye button ON — published
              </Text>
              {EYE_VISIBLE.map((t) => (
                <Text key={t} style={styles.eyeBullet} maxFontSizeMultiplier={1.2}>
                  • {t}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.calloutAmber}>
            <Text style={styles.calloutAmberTitle} maxFontSizeMultiplier={1.15}>
              Best practice
            </Text>
            <CheckList lines={BEST_PRACTICE} checkColor="#d97706" />
          </View>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Tab 2
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            GE Summary
          </Text>
          <View style={styles.tabPanel}>
            <View style={styles.tabHeader}>
              <View style={[styles.tabIcon, styles.tabIconGreen]}>
                <Text style={styles.tabIconText} maxFontSizeMultiplier={1.1}>
                  ∑
                </Text>
              </View>
              <View style={styles.tabHeaderText}>
                <Text style={styles.tabTitle} maxFontSizeMultiplier={1.2}>
                  GE Summary
                </Text>
                <Text style={styles.tabSubtitle} maxFontSizeMultiplier={1.15}>
                  Member-facing published report
                </Text>
              </View>
            </View>
            <View style={styles.tabBody}>
              <Text style={styles.body} maxFontSizeMultiplier={1.25}>
                GE Summary is the member-facing version of the report. It becomes visible once you publish by turning on
                the Eye button.
              </Text>
              <CheckList lines={GE_SUMMARY_POINTS} />
            </View>
          </View>

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Full workflow
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to perform the role in T360
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The General Evaluator role in T360 is fully digital. Follow these six steps:
          </Text>
          {WORKFLOW_STEPS.map((s, i) => (
            <StepBlock key={s.title} title={s.title} body={s.body} index={i} />
          ))}

          <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.05}>
            Benefits
          </Text>
          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why this matters
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            T360 completely digitizes the General Evaluator process — no paper notes, no lost evaluations, no manual
            tracking.
          </Text>
          <View style={styles.benefitGrid}>
            {BENEFITS.map((b) => (
              <View key={b.label} style={styles.benefitCard}>
                <Text style={styles.benefitIcon} maxFontSizeMultiplier={1.2}>
                  {b.icon}
                </Text>
                <Text style={styles.benefitLabel} maxFontSizeMultiplier={1.15}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.footerNote} maxFontSizeMultiplier={1.1}>
            T360 Knowledge Base · General Evaluator Report Guide
          </Text>
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
    backgroundColor: 'rgba(29, 78, 216, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(29, 78, 216, 0.15)',
  },
  kbBadgeText: {
    fontSize: 10 * FS,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  docTitle: {
    fontSize: 22 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
    letterSpacing: -0.3 * FS,
  },
  docSubtitle: {
    fontSize: 16 * FS,
    fontStyle: 'italic',
    color: N.textSecondary,
    marginBottom: 10,
  },
  lead: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.textSecondary,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 10 * FS,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ACCENT,
    marginTop: 8,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 18 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subSectionTitle: {
    fontSize: 16 * FS,
    fontWeight: '600',
    color: N.text,
    marginTop: 20,
    marginBottom: 10,
  },
  body: {
    fontSize: 14 * FS,
    lineHeight: 22 * FS,
    color: '#374151',
    marginBottom: 12,
  },
  bodyStrong: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 8,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  methodCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 18,
    borderTopWidth: 3,
    borderTopColor: ACCENT,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  methodNum: {
    fontSize: 32 * FS,
    fontWeight: '400',
    color: ACCENT_MID,
    marginBottom: 8,
  },
  methodTitle: {
    fontSize: 14 * FS,
    fontWeight: '600',
    color: N.text,
    marginBottom: 12,
  },
  methodNote: {
    marginTop: 10,
    fontSize: 12.5 * FS,
    color: N.textSecondary,
    lineHeight: 18 * FS,
  },
  pathList: { gap: 0 },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  pathArrow: {
    color: ACCENT,
    fontWeight: '700',
    width: 18,
    marginTop: 1,
    fontSize: 13 * FS,
  },
  pathText: {
    flex: 1,
    fontSize: 13 * FS,
    color: '#4b5563',
    lineHeight: 19 * FS,
  },
  calloutSuccess: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 18,
    marginBottom: 20,
  },
  calloutSuccessTitle: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 10,
  },
  calloutBlue: {
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_MID,
    borderRadius: 10,
    padding: 18,
    marginBottom: 8,
  },
  calloutBlueTitle: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: ACCENT,
    marginBottom: 10,
  },
  calloutAmber: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 10,
    padding: 18,
    marginTop: 12,
    marginBottom: 8,
  },
  calloutAmberTitle: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  checkMark: {
    fontSize: 14 * FS,
    fontWeight: '700',
    width: 22,
    marginTop: 1,
  },
  checkText: {
    flex: 1,
    fontSize: 13.5 * FS,
    lineHeight: 20 * FS,
    color: '#374151',
  },
  tabPanel: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: N.surface,
  },
  tabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconGreen: {
    backgroundColor: '#065f46',
  },
  tabIconText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13 * FS,
  },
  tabHeaderText: { flex: 1 },
  tabTitle: {
    fontSize: 15 * FS,
    fontWeight: '600',
    color: N.text,
  },
  tabSubtitle: {
    fontSize: 12 * FS,
    color: N.textSecondary,
    marginTop: 2,
  },
  tabBody: {
    padding: 18,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  pill: {
    backgroundColor: ACCENT_LIGHT,
    borderWidth: 1,
    borderColor: ACCENT_MID,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 12 * FS,
    fontWeight: '500',
    color: ACCENT,
  },
  eyeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  eyeCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
  },
  eyeCardLocked: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  eyeCardVisible: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  eyeEmoji: {
    fontSize: 22 * FS,
    marginBottom: 8,
  },
  eyeCardTitleLocked: {
    fontSize: 13 * FS,
    fontWeight: '600',
    color: '#991b1b',
    marginBottom: 8,
  },
  eyeCardTitleVisible: {
    fontSize: 13 * FS,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 8,
  },
  eyeBullet: {
    fontSize: 12.5 * FS,
    color: '#374151',
    paddingVertical: 3,
    lineHeight: 18 * FS,
  },
  stepBlock: {
    marginBottom: 10,
  },
  stepHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: ACCENT_LIGHT,
  },
  stepNumText: {
    color: '#fff',
    fontSize: 14 * FS,
    fontWeight: '600',
  },
  stepContent: {
    flex: 1,
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14 * FS,
    fontWeight: '600',
    color: N.text,
    marginBottom: 4,
  },
  stepBody: {
    fontSize: 13.5 * FS,
    lineHeight: 20 * FS,
    color: N.textSecondary,
  },
  benefitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  benefitCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  benefitIcon: {
    fontSize: 22 * FS,
    marginBottom: 8,
  },
  benefitLabel: {
    fontSize: 12.5 * FS,
    fontWeight: '500',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 18 * FS,
  },
  footerNote: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12 * FS,
    color: N.textSecondary,
  },
});

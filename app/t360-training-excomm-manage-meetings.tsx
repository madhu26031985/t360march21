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

/** Match Club Set Up / Member Onboarding training typography. */
const FS = 0.9;

const BENEFIT_TITLES = [
  'Organized Meeting Planning',
  'Flexible Meeting Modes',
  'Role & Agenda Management',
  'Easy Meeting Updates',
  'Track Meeting History',
];

const TAB_LINES = [
  'Open Meetings – View active meetings, manage roles, edit meeting details, or close meetings.',
  'Closed Meetings – View completed meetings and reopen them anytime.',
];

const HOW_TO_BULLETS = [
  'Go to the Admin tab',
  'Click Manage Meetings',
  'Select Create Meeting',
  'Enter Meeting Title and Meeting Number',
  'Select meeting mode and venue',
  'Enter meeting date and time',
  'Review and Confirm Meeting',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can create or manage meetings?',
    a: 'Only users with Admin access.',
  },
  {
    q: 'Can I edit a meeting after creating it?',
    a: 'Yes, meetings can be edited while they remain open.',
  },
  {
    q: 'Can I change meeting roles later?',
    a: 'Yes, roles can be updated before the meeting is closed.',
  },
  {
    q: 'What happens when a meeting is closed?',
    a: 'The meeting moves to the Closed tab and becomes read-only.',
  },
  {
    q: 'Can I reopen a closed meeting?',
    a: 'Yes, go to the Closed tab and click Reopen.',
  },
  {
    q: 'What happens after reopening?',
    a: 'The meeting moves back to the Open tab and becomes editable again.',
  },
  {
    q: 'Can I delete a meeting?',
    a: 'No. Meetings cannot be deleted, but they can be closed and reopened.',
  },
  {
    q: 'Why can’t I see my meeting?',
    a: 'Check whether the meeting is under the Open or Closed tab.',
  },
];

export default function T360TrainingExcommManageMeetingsScreen() {
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
          Manage Meetings
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
          <Text style={styles.docTitle} maxFontSizeMultiplier={1.35}>
            Meeting Management
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Create, edit, close, and reopen meetings.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why Manage Meetings?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Managing meetings in T360 helps your club organize meetings efficiently by keeping schedules, roles,
            attendance, and meeting activities in one structured place.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Purpose of Meeting Management
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Meeting Management enables clubs to plan meetings, assign responsibilities, track progress, and ensure
            smooth execution.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Benefits of Managing Meetings
          </Text>
          {BENEFIT_TITLES.map((title) => (
            <View key={title} style={styles.benefitLineOnly}>
              <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.25}>
                ✔ {title}
              </Text>
            </View>
          ))}

          <Text style={styles.calloutLabel} maxFontSizeMultiplier={1.3}>
            ■ What You Gain
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Your club can run meetings in a more organized, professional, and structured way.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Understanding Meeting Management Tabs
          </Text>
          {TAB_LINES.map((line) => (
            <View key={line} style={styles.squareRow}>
              <Text style={styles.squareMark} maxFontSizeMultiplier={1.25}>
                ■
              </Text>
              <Text style={styles.squareText} maxFontSizeMultiplier={1.25}>
                {line}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to Create a Meeting
          </Text>
          {HOW_TO_BULLETS.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bulletMark} maxFontSizeMultiplier={1.25}>
                •
              </Text>
              <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
                {line}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Reopening a Closed Meeting
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Go to Closed tab → Find the required meeting → Click Reopen.
          </Text>

          <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
            Frequently Asked Questions
          </Text>
          {FAQS.map(({ q, a }) => (
            <View key={q} style={styles.faqBlock}>
              <Text style={styles.faqQ} maxFontSizeMultiplier={1.25}>
                {q}
              </Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    padding: 20,
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
    marginTop: 4,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 18,
  },
  benefitLineOnly: {
    marginBottom: 8,
    paddingLeft: 2,
  },
  benefitTitle: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
  },
  calloutLabel: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 6,
    marginBottom: 8,
  },
  squareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  squareMark: {
    fontSize: 14 * FS,
    lineHeight: 22 * FS,
    color: N.text,
    minWidth: 20 * FS,
    marginTop: 2,
  },
  squareText: {
    flex: 1,
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.text,
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
  faqHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 12,
  },
  faqBlock: {
    marginBottom: 14,
  },
  faqQ: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 4,
  },
  faqA: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
});

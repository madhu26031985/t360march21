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

const THEMES = ['Default', 'Minimal', 'Vibrant'];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Where can I access the Meeting Agenda?',
    a: 'The Meeting Agenda can be accessed through Home Tab → Meeting Agenda.',
  },
  {
    q: 'Who can edit the Meeting Agenda?',
    a: 'Only Admins have permission to create, edit, customize, and manage the Meeting Agenda.',
  },
  {
    q: 'Can all members edit the Meeting Agenda?',
    a: 'No. Non-admin members can only view the Meeting Agenda. They cannot edit, rearrange, or share it.',
  },
  {
    q: 'How is the Meeting Agenda populated?',
    a:
      'The Meeting Agenda automatically reflects the roles and details updated during role booking. Admins can also use "Auto Fill Entire Agenda" under Agenda Section to populate the agenda instantly.',
  },
  {
    q: 'Can I rearrange the order of agenda sections?',
    a: 'Yes. Admins can use the Up and Down arrows in Agenda Section to reorder meeting roles and agenda flow as needed.',
  },
  {
    q: 'Can agenda sections be edited individually?',
    a: 'Yes. Each agenda section includes an Edit option allowing Admins to modify agenda details.',
  },
  {
    q: 'Are there different agenda themes available?',
    a: `Yes. Admins can choose from three Meeting Agenda themes:\n\n${THEMES.map((t) => `• ${t}`).join('\n')}`,
  },
  {
    q: 'Who can share the Meeting Agenda link?',
    a: 'Only Admins can copy and share the Meeting Agenda link via WhatsApp or other platforms.',
  },
  {
    q: 'How can members view the Meeting Agenda?',
    a: 'Members can view the Meeting Agenda either through the link shared by the Admins or by navigating to Home Tab → Meeting Agenda.',
  },
  {
    q: 'Can Admins control agenda visibility?',
    a: 'Yes. Admins can show or hide the Meeting Agenda for all members from the Agenda Section settings.',
  },
  {
    q: 'Will members always see the latest agenda?',
    a: 'Yes. Members will always view the most recently updated and published Meeting Agenda by the Admins.',
  },
  {
    q: 'What happens if meeting roles are updated after agenda creation?',
    a: 'The agenda reflects updated role booking details, and Admins can re-auto-fill or edit the agenda to ensure it remains current.',
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

export default function T360TrainingExcommAgendaCreationScreen() {
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
          Agenda Creation
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
            Agenda Creation
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Create, customize, manage, and share meeting agendas with ease.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Home Tab – Meeting Agenda
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Meeting Agenda is available under the Home Tab → Meeting Agenda.
          </Text>
          <BulletList
            lines={[
              'Admins can create, edit, customize, and share the Meeting Agenda.',
              'All other members can only view the Meeting Agenda either through the agenda link shared by the Admins or by accessing it via Home Tab → Meeting Agenda.',
              'The Meeting Agenda automatically reflects the roles and details updated during role booking.',
              'Members will always view the latest agenda updated and published by the Admins.',
            ]}
          />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Access & Edit Meeting Agenda
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            To edit the Meeting Agenda, click the Edit button available at the top-right corner of the Meeting Agenda
            screen.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            <Text style={styles.noteLead}>Note: </Text>
            Editing the Meeting Agenda is available only to Admins. Other members will only have access to view the
            updated agenda.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Agenda Configuration
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Edit Agenda page contains the following tabs:
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            1. Agenda Settings
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage overall agenda preferences and meeting configurations.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            2. Agenda Section
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Customize and organize the structure of the Meeting Agenda.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Auto Fill Entire Agenda
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Under Agenda Section, click "Auto Fill Entire Agenda" to automatically populate the agenda using the assigned
            meeting roles and details.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Reorder Agenda Sections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Each agenda section includes Up and Down arrows, allowing Admins to rearrange agenda items and roles based
            on the preferred meeting flow.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Edit Individual Agenda Sections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Each section also includes an Edit option to modify agenda details as needed.
          </Text>

          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda Themes
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once the agenda is auto-filled and saved, return to Agenda Section to select from three agenda themes for
            sharing:
          </Text>
          {THEMES.map((t) => (
            <View key={t} style={styles.themeRow}>
              <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.25}>
                ✔ {t}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Share Meeting Agenda
          </Text>
          <BulletList
            lines={[
              'Only Admins can copy and share the Meeting Agenda link via WhatsApp or other platforms.',
              'Other members can only view the Meeting Agenda through the shared link provided by Admins or via Home Tab → Meeting Agenda.',
            ]}
          />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Show / Hide Meeting Agenda
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Under Agenda Section, Admins have the option to show or hide the Meeting Agenda for all members, giving
            complete control over agenda visibility.
          </Text>

          <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
            {'FAQ\'s – Meeting Agenda'}
          </Text>
          {FAQS.map(({ q, a }, i) => (
            <View key={q} style={styles.faqBlock}>
              <Text style={styles.faqQ} maxFontSizeMultiplier={1.25}>
                {i + 1}. {q}
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
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
  subHeading: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginTop: 10,
    marginBottom: 6,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 18,
  },
  noteLead: {
    fontWeight: '700',
  },
  themeRow: { marginBottom: 6, paddingLeft: 2 },
  benefitTitle: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 2,
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
  faqBlock: { marginBottom: 14 },
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

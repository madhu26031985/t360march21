import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTrainingKbBack } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const FS = 0.9;

const PURPOSE_CHECKS = [
  'Manage club operations efficiently',
  'Keep meetings organized and updated',
  'Maintain club information and resources',
  'Support smooth collaboration across the ExComm team',
];

const BENEFITS: { title: string; body: string }[] = [
  {
    title: 'Member Management',
    body: 'Invite and onboard members with role-based access.',
  },
  {
    title: 'Meeting Administration',
    body: 'Create, manage, update, close, and reopen meetings.',
  },
  {
    title: 'Centralized Club Operations',
    body: 'Manage important club details from one location.',
  },
  {
    title: 'Leadership Coordination',
    body: 'Keep Executive Committee roles updated and organized.',
  },
];

const INVITE_CHECKS = [
  'Add new members',
  'Assign roles during invitation',
  'Manage member onboarding',
  'Track pending invitations (if enabled)',
];

const MEETING_CHECKS = [
  'Create new meetings',
  'Edit meeting details',
  'Manage meeting roles',
  'Close completed meetings',
  'Reopen meetings when changes are required',
];

const VOTING_CHECKS = [
  'Create voting forms',
  'Add nominees and categories',
  'Manage voting processes',
  'View voting results',
];

const CLUB_INFO_CHECKS = [
  'Club name and details',
  'Club number',
  'Charter information',
  'Club description or mission',
];

const EXCOMM_CHECKS = [
  'Add or update ExComm members',
  'Maintain leadership positions',
  'Keep role ownership updated',
];

const EXCOMM_ROLES = [
  'President',
  'Vice President Education (VPE)',
  'Vice President Membership (VPM)',
  'Vice President Public Relations (VPPR)',
  'Secretary',
  'Treasurer',
  'Sergeant at Arms (SAA)',
];

const SOCIAL_CHECKS = ['Website links', 'Social media pages', 'YouTube or community links'];

const RESOURCE_ITEMS = ['Important documents', 'Reference materials', 'Club files and assets'];

const CLUB_FAQ_CHECKS = ['Add FAQs', 'Update responses', 'Help members quickly find answers'];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can access the Admin tab?',
    a: 'Only users with Admin or authorized ExComm access can view and use the Admin tab.',
  },
  {
    q: 'Why can’t I see the Admin tab?',
    a: 'The Admin tab is permission-based and is available only for users with administrative access.',
  },
  {
    q: 'Can I invite members from the Admin tab?',
    a: 'Yes. Use Invite Club Users to add members and assign roles.',
  },
  {
    q: 'Can I manage meetings here?',
    a: 'Yes. The Manage Meetings section helps create, edit, close, and manage meetings.',
  },
  {
    q: 'Can I update club information?',
    a: 'Yes. Club details can be updated under Club Info.',
  },
  {
    q: 'What is Club ExComm used for?',
    a: 'It helps manage Executive Committee members and leadership positions.',
  },
  {
    q: 'Can I manage club social links?',
    a: 'Yes. Social media and website links can be updated under Club Social Media.',
  },
];

function CheckList({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.checkRow}>
          <Text style={styles.checkMark} maxFontSizeMultiplier={1.25}>
            ✔
          </Text>
          <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

function DotList({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.dotRow}>
          <Text style={styles.dotMark} maxFontSizeMultiplier={1.25}>
            •
          </Text>
          <Text style={styles.dotText} maxFontSizeMultiplier={1.25}>
            {line}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingAdminOverviewScreen() {
  const onTrainingKbBack = useTrainingKbBack();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onTrainingKbBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={Math.round(22 * FS)} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Admin Overview
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
            Admin Overview
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Manage club operations, members, meetings, and settings from one central place.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Who Can Access the Admin Tab?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            🔒 The Admin tab is available only to Admins and authorized ExComm members.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            This section is not visible to regular members, as it contains tools used for managing club operations,
            meetings, member onboarding, and administrative settings.
          </Text>
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 If you do not see the Admin tab, it means your current role does not have admin access.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why the Admin Tab?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Admin tab acts as the club’s management center, helping Admins and ExComm teams efficiently handle club
            operations in a structured and organized manner.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            From inviting members to managing meetings and updating club information, everything can be handled from one
            place.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Purpose of the Admin Tab
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            The Admin tab helps club leaders:
          </Text>
          <CheckList lines={PURPOSE_CHECKS} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Benefits of Using the Admin Tab
          </Text>
          {BENEFITS.map(({ title, body }) => (
            <View key={title} style={styles.benefitBlock}>
              <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.25}>
                ✔ {title}
              </Text>
              <Text style={styles.benefitBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.calloutLabel} maxFontSizeMultiplier={1.3}>
            🚀 What You Gain
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Admin tab simplifies club management, reduces manual effort, and helps ExComm teams run club operations
            more effectively.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What You Can Access on the Admin Tab
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            👥 Invite Club Users
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Quickly invite members to join your club.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={INVITE_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Helps clubs grow and onboard members smoothly.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            📅 Create & Manage Meeting
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Create and manage club meetings with ease.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={MEETING_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Keeps meeting planning structured and organized.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🗳 Voting Operations
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage club voting activities efficiently.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={VOTING_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Useful for awards, recognitions, and club decision-making.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            ⚙ Club Info
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage essential club information.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can update:
          </Text>
          <CheckList lines={CLUB_INFO_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Ensures club information stays accurate and up to date.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            👑 Club ExComm
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage Executive Committee members and leadership roles.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={EXCOMM_CHECKS} />
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            Examples include:
          </Text>
          <DotList lines={EXCOMM_ROLES} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Helps maintain a well-organized leadership team.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🌐 Club Social Media
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage your club’s online presence.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can add or update:
          </Text>
          <CheckList lines={SOCIAL_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Helps members stay connected beyond meetings.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            📂 Club Resources
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage club-related resources and materials.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            Resources may include:
          </Text>
          <CheckList lines={RESOURCE_ITEMS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 A centralized place for storing useful club information.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            ❓ Club FAQ
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage frequently asked questions for members.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={CLUB_FAQ_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Reduces repetitive questions and improves member support.
          </Text>

          <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
            ❓ Frequently Asked Questions
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

          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 The Admin tab helps club leaders efficiently manage operations and keep everything organized in one place.
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
  featureHeading: {
    fontSize: 15 * FS,
    fontWeight: '700',
    lineHeight: 22 * FS,
    color: N.text,
    marginTop: 14,
    marginBottom: 6,
  },
  bodyLead: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 6,
    marginTop: 2,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 14,
  },
  benefitBlock: { marginBottom: 12, paddingLeft: 2 },
  benefitTitle: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 2,
  },
  benefitBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    paddingLeft: 18,
  },
  calloutLabel: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 2,
  },
  checkMark: {
    fontSize: 14 * FS,
    lineHeight: 22 * FS,
    color: N.text,
    minWidth: 20 * FS,
    marginTop: 1,
  },
  checkText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 4,
  },
  dotMark: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    minWidth: 16 * FS,
  },
  dotText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  tip: {
    marginTop: 8,
    marginBottom: 14,
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

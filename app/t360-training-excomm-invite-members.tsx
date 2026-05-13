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

/** Match Club Set Up training doc typography (10% smaller than base scale). */
const FS = 0.9;

const BENEFITS: { title: string; body: string }[] = [
  {
    title: 'Easy Member Onboarding',
    body: 'Invite members quickly using email.',
  },
  {
    title: 'Role-Based Access',
    body: 'Assign Member, ExComm, Guest, Visiting Toastmaster, or Club Leader roles.',
  },
  {
    title: 'Instant Access for Existing Users',
    body: 'Existing T360 users are added immediately.',
  },
  {
    title: 'Seamless Experience for New Users',
    body: 'New users receive guided email invitations.',
  },
  {
    title: 'Improved Club Collaboration',
    body: 'Members can participate in club activities.',
  },
];

const ROLES: { name: string; body: string }[] = [
  {
    name: 'Member',
    body: 'A regular club member who can participate in meetings, take roles, and track personal progress.',
  },
  {
    name: 'ExComm',
    body: 'An Executive Committee member responsible for managing club operations and administration.',
  },
  {
    name: 'Guest',
    body: 'A visitor who can attend meetings and explore club activities without full access.',
  },
  {
    name: 'Visiting Toastmaster',
    body: 'A Toastmaster from another club visiting for participation or networking.',
  },
  {
    name: 'Club Leader',
    body: 'A leadership role with elevated club-level responsibilities.',
  },
];

const HOW_TO_BULLETS = [
  'Go to Admin → Invite New Club Members',
  'Enter the member’s Full Name',
  'Enter the member’s Email ID',
  'Select the appropriate Role',
  'Tap Send Invitation',
];

const SCENARIOS: { title: string; body: string }[] = [
  {
    title: 'Scenario 1: Existing T360 User',
    body: 'If the invited user already belongs to any club in T360, they will be added instantly based on the selected role.',
  },
  {
    title: 'Scenario 2: New User',
    body: 'If the invited user is new to T360, an invitation email will be sent. The user must sign up using the same email address.',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can invite members?',
    a: 'Only users with ExComm access can invite members.',
  },
  {
    q: 'Can I assign roles while inviting?',
    a: 'Yes, roles such as Member, ExComm, Guest, Visiting Toastmaster, and Club Leader can be assigned.',
  },
  {
    q: 'Can I track invitations?',
    a: 'Yes, pending invitations are visible under the Invitation section.',
  },
  {
    q: 'Can I resend an invite?',
    a: 'Yes, invitations can be resent if the user has not joined.',
  },
  {
    q: 'What happens if the user already exists in T360?',
    a: 'They will be added instantly to your club.',
  },
  {
    q: 'What happens if the user is new to T360?',
    a: 'They will receive an email invitation and must sign up using the same email address.',
  },
];

export default function T360TrainingExcommInviteMembersScreen() {
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
          Member Onboarding
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
            Member Onboarding
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Invite members and assign the right roles.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why Invite Members?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Inviting members in T360 helps bring your club community together by giving members access to meetings,
            roles, attendance, voting, and club activities in one place.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Purpose of Inviting Members
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Member invitations allow your club to build collaboration, assign responsibilities, track participation, and
            ensure smooth club operations.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Benefits of Inviting Members
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
            ■ What You Gain
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            By inviting members, your club becomes more connected, organized, and collaborative.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Understanding Member Roles
          </Text>
          {ROLES.map(({ name, body }) => (
            <View key={name} style={styles.roleBlock}>
              <Text style={styles.roleName} maxFontSizeMultiplier={1.25}>
                {name}
              </Text>
              <Text style={styles.roleBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to Invite Club Members
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
            How Member Invitation Works
          </Text>
          {SCENARIOS.map(({ title, body }) => (
            <View key={title} style={styles.scenarioBlock}>
              <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.bodyTight} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

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
  bodyTight: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 14,
  },
  benefitBlock: {
    marginBottom: 12,
    paddingLeft: 2,
  },
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
    marginTop: 6,
    marginBottom: 8,
  },
  roleBlock: {
    marginBottom: 12,
  },
  roleName: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 2,
  },
  roleBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    marginBottom: 4,
    paddingLeft: 2,
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
  scenarioBlock: {
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 15 * FS,
    fontWeight: '600',
    lineHeight: 22 * FS,
    color: N.text,
    marginBottom: 4,
    marginTop: 2,
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

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

const WHAT_YOU_CAN_DO = [
  'Manage your profile information',
  'Access web login and sharing options',
  'Open in-app T360 User Guide',
  'Review privacy and security settings',
  'Stay updated with the latest app version',
];

const PROFILE_CHECKS = ['View your profile details', 'Edit your personal information', 'Update profile settings'];

const CREATE_CLUB_CHECKS = ['Create a new club', 'Begin club onboarding', 'Configure initial club setup'];

const SHARE_APP_CHECKS = ['Share app access', 'Invite members to join'];

const WEB_LOGIN_CHECKS = ['Log in through web access', 'Continue using the platform on desktop'];

const TRAINING_CHECKS = ['Explore training resources', 'Learn platform features', 'Improve product usage'];

const WHATSAPP_CHECKS = ['Get instant support through WhatsApp'];

const TALK_CHECKS = ['Schedule a call with the support team'];

const PRIVACY_CHECKS = ['Review privacy practices and policies'];

const DATA_CHECKS = ['Learn how your information is protected'];

const VERSION_CHECKS = ['Check for updates', 'Verify app version availability'];

const LINKEDIN_CHECKS = ['Follow and connect with the team'];

const WEBSITE_CHECKS = ['Visit the official website for updates and information'];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I edit my profile information?',
    a: 'Yes. Use Edit Profile to update your details.',
  },
  {
    q: 'Can I access T360 on a browser?',
    a: 'Yes. Use Web Login to continue using the platform on desktop.',
  },
  {
    q: 'How do I get support?',
    a: 'You can use WhatsApp Support or Talk to Us.',
  },
  {
    q: 'Can I check if I’m using the latest version?',
    a: 'Yes. Use App Version Check to verify updates.',
  },
  {
    q: 'Is account deletion permanent?',
    a: 'Yes. Once deleted, the account and related data cannot be recovered.',
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

export default function T360TrainingSettingsTabScreen() {
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
          Settings Tab Overview
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
            Settings Tab Overview
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Manage your profile, preferences, support options, and account settings in one place.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why the Settings Tab?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Settings tab gives you quick access to your profile, account preferences, support channels, and
            application settings — helping you personalize your experience and stay connected.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            You can update profile details, reach support via WhatsApp or Talk to Us, open T360 User Guide, manage privacy
            settings, and more.
          </Text>

          <Text style={styles.calloutLabel} maxFontSizeMultiplier={1.3}>
            🚀 What You Can Do in Settings
          </Text>
          {WHAT_YOU_CAN_DO.map((line) => (
            <View key={line} style={styles.checkRow}>
              <Text style={styles.checkMark} maxFontSizeMultiplier={1.25}>
                ✔
              </Text>
              <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
                {line}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            What You Can Access in Settings
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            👤 Profile Information
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            At the top of the screen, you can:
          </Text>
          <CheckList lines={PROFILE_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Keep your profile information up to date.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🏢 Club Management
          </Text>
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Create New Club
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Start and set up a new club directly from the Settings page.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={CREATE_CLUB_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Helpful for users planning to start a new community.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🤝 Share & Access
          </Text>
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Share App
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Invite others to explore and use the platform.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={SHARE_APP_CHECKS} />

          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Web Login
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Access the platform from your browser.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={WEB_LOGIN_CHECKS} />

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🎓 T360 User Guide
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Access learning materials and product guidance.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={TRAINING_CHECKS} />

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            💬 Support & Help
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Get help whenever needed.
          </Text>
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            WhatsApp Support 24/7
          </Text>
          <CheckList lines={WHATSAPP_CHECKS} />
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Talk to Us
          </Text>
          <CheckList lines={TALK_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Designed to help users quickly resolve questions and issues.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🔐 Privacy & Security
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Manage privacy-related information.
          </Text>
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Privacy Policy
          </Text>
          <CheckList lines={PRIVACY_CHECKS} />
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Data Protection
          </Text>
          <CheckList lines={DATA_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Helps users understand data privacy and platform security.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🔄 App Version Check
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Stay updated with the latest version.
          </Text>
          <Text style={styles.bodyLead} maxFontSizeMultiplier={1.25}>
            You can:
          </Text>
          <CheckList lines={VERSION_CHECKS} />
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Ensures you always have the latest features and improvements.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🌐 Connect With Us
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Stay connected outside the platform.
          </Text>
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            LinkedIn
          </Text>
          <CheckList lines={LINKEDIN_CHECKS} />
          <Text style={styles.subFeatureHeading} maxFontSizeMultiplier={1.25}>
            Website
          </Text>
          <CheckList lines={WEBSITE_CHECKS} />

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            🚪 Sign Out
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Securely sign out of your account whenever needed.
          </Text>
          <Text style={styles.tip} maxFontSizeMultiplier={1.25}>
            💡 Recommended when using shared devices.
          </Text>

          <Text style={styles.featureHeading} maxFontSizeMultiplier={1.25}>
            ⚠️ Danger Zone – Delete Account
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            If required, you can permanently delete your account.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            ⚠️ Important:{'\n'}Deleting your account is permanent and cannot be undone.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            You may also contact support if account assistance is needed.
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
            💡 The Settings tab helps you personalize your experience, access support, and manage your account
            efficiently.
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
  subFeatureHeading: {
    fontSize: 14 * FS,
    fontWeight: '600',
    lineHeight: 21 * FS,
    color: N.text,
    marginTop: 10,
    marginBottom: 4,
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
  calloutLabel: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 10,
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

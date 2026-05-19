import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info } from 'lucide-react-native';
import { useTrainingKbBack } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const FS = 0.9;

const NAVY = '#0F2942';
const NAVY_ACCENT = '#1E40AF';

const PATH_LINE = 'Admin Panel - Invite Club Users - Invite Club Users';

const ROLE_CARDS: { title: string; body: string }[] = [
  { title: 'Member', body: 'A paid Toastmaster and member of your club.' },
  { title: 'ExCom', body: 'A member of the Executive Committee of your club.' },
  { title: 'Visiting Toastmaster', body: 'A Toastmaster visiting from another club.' },
  { title: 'Club Leader', body: 'District leaders, division leaders, area directors, or other club leadership members.' },
];

const AFTER_INVITE_BULLETS = [
  'Click Accept Invitation',
  'Download the T360 app',
  'Sign in or create an account',
  'Access the club directly inside T360',
];

const EXISTING_USER_CHECKS = [
  'They will receive the club invitation via email',
  'After acceptance, they are immediately added to the club',
  'Their details will appear in the Manage Club Users section',
];

const SEND_BEFORE_BULLETS = [
  'Verify all entered details',
  'Confirm the correct role is selected',
  'Click Send Invitation',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can send invitations?',
    a: 'Only authorized ExCom users can invite members from Invite Club Users.',
  },
  {
    q: 'Which roles can I assign when inviting?',
    a: 'Member, ExCom, Guest, Visiting Toastmaster, and Club Leader — pick the role that matches how the person will use your club.',
  },
  {
    q: 'What if the email is wrong?',
    a: 'Review everything before sending. Use your club’s tools to correct or resend invitations if needed.',
  },
  {
    q: 'Do existing T360 users create a new account?',
    a: 'No. If they already use T360, they accept the invite and are added to your club without signing up again.',
  },
];

function BulletList({ lines, markColor }: { lines: string[]; markColor?: string }) {
  const mc = markColor ?? N.textSecondary;
  return (
    <>
      {lines.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={[styles.bulletMark, { color: mc }]} maxFontSizeMultiplier={1.25}>
            •
          </Text>
          <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
            {line === 'Click Send Invitation' ? (
              <>
                Click <Text style={styles.inlineBold}>Send Invitation</Text>
              </>
            ) : (
              line
            )}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingExcommInviteMembersScreen() {
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
          Invite Club Users
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
              T360 KNOWLEDGE BASE
            </Text>
          </View>

          <Text style={styles.docTitle} maxFontSizeMultiplier={1.35}>
            Invite Club Users
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Onboard members, guests, ExCom members, visiting Toastmasters, and club leaders so they can access club
            meetings, announcements, and schedules in T360.
          </Text>

          <View style={styles.pathStrip}>
            <Text style={styles.pathStripLabel} maxFontSizeMultiplier={1.05}>
              PATH
            </Text>
            <Text style={styles.pathStripMono} maxFontSizeMultiplier={1.15}>
              {PATH_LINE}
            </Text>
          </View>

          <View style={styles.noticeStrip}>
            <Text style={styles.noticeStripText} maxFontSizeMultiplier={1.25}>
              <Text style={styles.noticeBold}>Who can invite members?</Text> Only authorized ExCom users can invite
              members to the club.
            </Text>
          </View>

          <View style={styles.overviewCard}>
            <View style={styles.overviewHead}>
              <View style={styles.overviewIconWrap}>
                <Info size={16 * FS} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <Text style={styles.overviewTitle} maxFontSizeMultiplier={1.25}>
                Overview
              </Text>
            </View>
            <Text style={styles.overviewBody} maxFontSizeMultiplier={1.25}>
              The Invite Club Users section allows ExCom users to invite members, guests, ExCom members, visiting
              Toastmasters, and club leaders to join the club in T360. Once invited, the person receives an email
              invitation. After accepting and signing in to T360, they can access the club and all related content from
              the app.
            </Text>
          </View>

          <View style={styles.restrictBadge}>
            <Text style={styles.restrictBadgeText} maxFontSizeMultiplier={1.15}>
              ExCom members only
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            📋 How to Invite a New Member
          </Text>

          <View style={styles.lifecycleBlock}>
            <View style={styles.lifecycleHead}>
              <View style={styles.lifecycleNumNavy}>
                <Text style={styles.lifecycleNumNavyText} maxFontSizeMultiplier={1.2}>
                  1
                </Text>
              </View>
              <Text style={styles.lifecycleTitleNavy} maxFontSizeMultiplier={1.25}>
                Navigate to Invite Club Users
              </Text>
            </View>
            <View style={styles.lifecycleBodyPad}>
              <Text style={styles.bodyNoMb} maxFontSizeMultiplier={1.25}>
                Go to:
              </Text>
              <View style={styles.pathMonoBox}>
                <Text style={styles.pathMonoBoxText} maxFontSizeMultiplier={1.1}>
                  {PATH_LINE}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.lifecycleBlock}>
            <View style={styles.lifecycleHead}>
              <View style={styles.lifecycleNumNavy}>
                <Text style={styles.lifecycleNumNavyText} maxFontSizeMultiplier={1.2}>
                  2
                </Text>
              </View>
              <Text style={styles.lifecycleTitleNavy} maxFontSizeMultiplier={1.25}>
                Enter Member Details
              </Text>
            </View>
            <View style={styles.lifecycleBodyPad}>
              <Text style={styles.bodyNoMb} maxFontSizeMultiplier={1.25}>
                Fill in the required information:
              </Text>
              <BulletList lines={['Full Name', 'Email Address', 'Role']} />
            </View>
          </View>

          <View style={styles.lifecycleBlock}>
            <View style={styles.lifecycleHead}>
              <View style={styles.lifecycleNumNavy}>
                <Text style={styles.lifecycleNumNavyText} maxFontSizeMultiplier={1.2}>
                  3
                </Text>
              </View>
              <Text style={styles.lifecycleTitleNavy} maxFontSizeMultiplier={1.25}>
                Select the Appropriate Role
              </Text>
            </View>
            <View style={styles.lifecycleBodyPad}>
              <Text style={styles.bodyNoMb} maxFontSizeMultiplier={1.25}>
                Choose the correct role based on the person being invited.
              </Text>
              <View style={styles.roleGrid}>
                {ROLE_CARDS.map((r) => (
                  <View key={r.title} style={styles.roleTile}>
                    <Text style={styles.roleTileTitle} maxFontSizeMultiplier={1.15}>
                      {r.title}
                    </Text>
                    <Text style={styles.roleTileBody} maxFontSizeMultiplier={1.15}>
                      {r.body}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.guestBox}>
            <Text style={styles.guestBoxTitle} maxFontSizeMultiplier={1.15}>
              Guest
            </Text>
            <Text style={styles.guestBoxBody} maxFontSizeMultiplier={1.2}>
              A visitor or prospective member attending meetings.
            </Text>
          </View>

          <View style={styles.lifecycleBlock}>
            <View style={styles.lifecycleHead}>
              <View style={styles.lifecycleNumNavy}>
                <Text style={styles.lifecycleNumNavyText} maxFontSizeMultiplier={1.2}>
                  4
                </Text>
              </View>
              <Text style={styles.lifecycleTitleNavy} maxFontSizeMultiplier={1.25}>
                Send Invitation
              </Text>
            </View>
            <View style={styles.lifecycleBodyPad}>
              <Text style={styles.bodyNoMb} maxFontSizeMultiplier={1.25}>
                Before sending:
              </Text>
              <BulletList lines={SEND_BEFORE_BULLETS} />
              <Text style={styles.bodyTight} maxFontSizeMultiplier={1.2}>
                An invitation email will be sent to the person.
              </Text>
            </View>
          </View>

          <View style={styles.afterCard}>
            <View style={styles.afterCardHead}>
              <View style={styles.afterIconWrap}>
                <Text style={styles.afterIconGlyph} maxFontSizeMultiplier={1.1}>
                  ✉
                </Text>
              </View>
              <Text style={styles.afterCardTitle} maxFontSizeMultiplier={1.25}>
                What Happens After Sending an Invite?
              </Text>
            </View>
            <Text style={styles.bodyNoMb} maxFontSizeMultiplier={1.25}>
              The invited user receives an email invitation to join the club. They can then:
            </Text>
            <View style={styles.greenListBox}>
              <BulletList lines={AFTER_INVITE_BULLETS} markColor="#15803D" />
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            📲 Sharing the T360 App Download Link
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            ExCom users can quickly share the T360 app download link for faster onboarding. Navigate to:
          </Text>
          <View style={styles.pathMonoBox}>
            <Text style={styles.pathMonoBoxText} maxFontSizeMultiplier={1.1}>
              Settings - Share App
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            This lets you send Android and iOS download links directly to invited members.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            ✦ Existing T360 Users
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            If the invited person is already a registered T360 user, they do not need to create a new account.
          </Text>
          {EXISTING_USER_CHECKS.map((line) => (
            <View key={line} style={styles.checkRow}>
              <Text style={styles.checkMarkGreen} maxFontSizeMultiplier={1.15}>
                ✓
              </Text>
              <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
                {line.includes('Manage Users') ? (
                  <>
                    Their details will appear in the{' '}
                    <Text style={styles.manageHl}>Manage Club Users</Text> section
                  </>
                ) : (
                  line
                )}
              </Text>
            </View>
          ))}

          <View style={styles.tipBlue}>
            <Text style={styles.tipBlueLabel} maxFontSizeMultiplier={1.1}>
              TIP
            </Text>
            <Text style={styles.tipBlueText} maxFontSizeMultiplier={1.25}>
              This makes onboarding faster for existing Toastmasters who are already using T360.
            </Text>
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

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

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
    paddingHorizontal: 4,
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
    backgroundColor: NAVY,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  docTitle: {
    fontSize: 22 * FS,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 8,
    letterSpacing: -0.3 * FS,
  },
  lead: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.textSecondary,
    marginBottom: 16,
  },
  pathStrip: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  pathStripLabel: {
    fontSize: 10 * FS,
    fontWeight: '800',
    color: N.textSecondary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  pathStripMono: {
    fontFamily: mono,
    fontSize: 12 * FS,
    lineHeight: 18 * FS,
    color: NAVY,
    fontWeight: '600',
  },
  noticeStrip: {
    backgroundColor: '#FFF9E6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(120, 53, 15, 0.15)',
  },
  noticeStripText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#78350F',
  },
  noticeBold: {
    fontWeight: '800',
  },
  overviewCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(55, 53, 47, 0.02)',
  },
  overviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  overviewTitle: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: NAVY,
  },
  overviewBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
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
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: NAVY,
    marginTop: 8,
    marginBottom: 10,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  bodyNoMb: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 8,
  },
  bodyTight: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    marginTop: 4,
  },
  inlineBold: {
    fontWeight: '800',
    color: N.text,
  },
  pathMonoBox: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  pathMonoBoxText: {
    fontFamily: mono,
    fontSize: 12 * FS,
    lineHeight: 17 * FS,
    color: NAVY_ACCENT,
    fontWeight: '600',
  },
  lifecycleBlock: {
    marginBottom: 18,
  },
  lifecycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lifecycleNumNavy: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lifecycleNumNavyText: {
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  lifecycleTitleNavy: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '800',
    color: NAVY,
  },
  lifecycleBodyPad: {
    paddingLeft: 40,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  roleTile: {
    width: '47%',
    flexGrow: 1,
    minWidth: 130,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: N.surface,
  },
  roleTileTitle: {
    fontSize: 15 * FS,
    fontWeight: '800',
    color: NAVY_ACCENT,
    marginBottom: 6,
  },
  roleTileBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  guestBox: {
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    marginLeft: 40,
  },
  guestBoxTitle: {
    fontSize: 15 * FS,
    fontWeight: '800',
    color: N.text,
    marginBottom: 6,
  },
  guestBoxBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  afterCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(55, 53, 47, 0.02)',
  },
  afterCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  afterIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  afterIconGlyph: {
    color: '#FFFFFF',
    fontSize: 14 * FS,
    fontWeight: '700',
  },
  afterCardTitle: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '800',
    color: NAVY,
  },
  greenListBox: {
    marginTop: 10,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    borderRadius: 10,
    padding: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletMark: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    minWidth: 18 * FS,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.text,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkMarkGreen: {
    width: 22,
    fontSize: 14 * FS,
    color: '#16A34A',
    fontWeight: '800',
  },
  checkText: {
    flex: 1,
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.text,
  },
  manageHl: {
    fontWeight: '800',
    color: N.text,
  },
  tipBlue: {
    marginTop: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.22)',
    borderRadius: 10,
    padding: 14,
  },
  tipBlueLabel: {
    fontSize: 12 * FS,
    fontWeight: '800',
    color: NAVY,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tipBlueText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
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
  },
});

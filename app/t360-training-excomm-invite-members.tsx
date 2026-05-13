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

const GOLD = '#A16207';
const GOLD_BG = 'rgba(161, 98, 7, 0.12)';

const ROLE_CARDS: { title: string; body: string; dot: string }[] = [
  { title: 'Member', body: 'A paid Toastmaster / active member of your club.', dot: '#16A34A' },
  { title: 'ExCom', body: 'Part of the Executive Committee of your club.', dot: '#EA580C' },
  { title: 'Visiting Toastmaster', body: 'A Toastmaster from another club attending your meetings.', dot: '#0EA5E9' },
  { title: 'Club Leader', body: 'District leaders, division leaders, area directors, or other club leadership.', dot: '#7C3AED' },
  { title: 'Guest', body: 'A visitor or prospective member attending meetings.', dot: '#78716C' },
];

const AFTER_INVITE_LEADS = [
  { normalPrefix: 'Click ', bold: 'Accept Invitation', normalSuffix: ' in the email' },
  { normalPrefix: '', bold: 'Download the T360 app', normalSuffix: ' (Android or iOS)' },
  { normalPrefix: '', bold: 'Sign in or create a new account', normalSuffix: '' },
  { normalPrefix: '', bold: 'Access the club', normalSuffix: ' directly inside T360' },
];

const EXISTING_USER_CHECKS = [
  'They will receive the club invitation',
  'After acceptance, they are immediately added to the club',
  'Their details appear in Manage Users / Manage Club Members',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can send invitations?',
    a: 'Only authorized Admin / ExCom users can use Invite New Club Members.',
  },
  {
    q: 'Which roles can I assign when inviting?',
    a: 'Member, ExCom, Guest, Visiting Toastmaster, and Club Leader — choose the role that matches how the person will use the club.',
  },
  {
    q: 'What if the email is wrong?',
    a: 'Double-check before sending. You can resend or correct flow depending on your club’s pending-invitation tools in T360.',
  },
  {
    q: 'Do existing T360 users create a new account?',
    a: 'No. If they already have a T360 account, they accept the invite and are added to your club without new signup.',
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.2} numberOfLines={2}>
          Invite New Club Members
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.heroCrumb} maxFontSizeMultiplier={1.1}>
            T360 KNOWLEDGE BASE › ADMIN PANEL › CLUB MEMBERS
          </Text>
          <Text style={styles.heroTitleMain} maxFontSizeMultiplier={1.3}>
            Invite{' '}
            <Text style={styles.heroTitleAccent} maxFontSizeMultiplier={1.3}>
              New
            </Text>{' '}
            Club Members
          </Text>
          <Text style={styles.heroLead} maxFontSizeMultiplier={1.25}>
            Onboard members, guests, ExCom, and club leaders into T360 — quickly and correctly.
          </Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, styles.tagGold]}>
              <Text style={styles.tagGoldText} maxFontSizeMultiplier={1.05}>
                ADMIN / EXCOM ONLY
              </Text>
            </View>
            <View style={[styles.tag, styles.tagGreen]}>
              <Text style={styles.tagGreenText} maxFontSizeMultiplier={1.05}>
                T360 APP
              </Text>
            </View>
            <View style={[styles.tag, styles.tagGrey]}>
              <Text style={styles.tagGreyText} maxFontSizeMultiplier={1.05}>
                ONBOARDING
              </Text>
            </View>
          </View>
          <View style={styles.pathBox}>
            <Text style={styles.pathBoxText} maxFontSizeMultiplier={1.15}>
              Admin Panel → Club Members → Invite New Club Members
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.kbBadge}>
            <Text style={styles.kbBadgeText} maxFontSizeMultiplier={1.2}>
              T360 · Knowledge base
            </Text>
          </View>

          <View style={styles.introBar}>
            <Text style={styles.body} maxFontSizeMultiplier={1.25}>
              The Invite New Member section allows authorized users to invite members, guests, ExCom members, visiting
              Toastmasters, and club leaders to join the club in T360. Once invited, the person receives an email and —
              after accepting — can access club meetings, announcements, schedules, and club-related information through
              the T360 app.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.25}>
            🔐 Who can invite members?
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Only authorized Admin / ExCom users have permission to invite new members to the club. Regular members and
            guests cannot access this feature.
          </Text>

          <View style={styles.bigStep}>
            <View style={styles.bigStepBadge}>
              <Text style={styles.bigStepBadgeText} maxFontSizeMultiplier={1.15}>
                1
              </Text>
            </View>
            <Text style={styles.bigStepTitle} maxFontSizeMultiplier={1.25}>
              How to invite a new member
            </Text>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepKicker} maxFontSizeMultiplier={1.1}>
              STEP 1
            </Text>
            <Text style={styles.stepCardTitle} maxFontSizeMultiplier={1.2}>
              Navigate to Invite Members
            </Text>
            <Text style={styles.stepCardBody} maxFontSizeMultiplier={1.2}>
              Go to Admin Panel → Club Members → Invite New Club Members, then click Invite Member.
            </Text>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepKicker} maxFontSizeMultiplier={1.1}>
              STEP 2
            </Text>
            <Text style={styles.stepCardTitle} maxFontSizeMultiplier={1.2}>
              Enter member details
            </Text>
            <Text style={styles.stepCardBody} maxFontSizeMultiplier={1.2}>
              Fill in the following required information:
            </Text>
            <View style={styles.fieldRow}>
              {['Full Name', 'Email Address', 'Role'].map((f) => (
                <View key={f} style={styles.fieldBox}>
                  <Text style={styles.fieldLabel} maxFontSizeMultiplier={1}>
                    FIELD
                  </Text>
                  <Text style={styles.fieldName} maxFontSizeMultiplier={1.15}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepKicker} maxFontSizeMultiplier={1.1}>
              STEP 3
            </Text>
            <Text style={styles.stepCardTitle} maxFontSizeMultiplier={1.2}>
              Select the appropriate role
            </Text>
            <Text style={styles.stepCardBody} maxFontSizeMultiplier={1.2}>
              Choose the correct role based on who you are inviting. See the{' '}
              <Text style={styles.roleRefLink} maxFontSizeMultiplier={1.2}>
                Role Reference
              </Text>{' '}
              section below.
            </Text>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepKicker} maxFontSizeMultiplier={1.1}>
              STEP 4
            </Text>
            <Text style={styles.stepCardTitle} maxFontSizeMultiplier={1.2}>
              Send the invitation
            </Text>
            {['Verify the details are correct', 'Confirm the correct role is selected', 'Click Send Invitation'].map(
              (line) => (
                <View key={line} style={styles.checkRow}>
                  <Text style={styles.checkMark} maxFontSizeMultiplier={1.15}>
                    ✓
                  </Text>
                  <Text style={styles.checkText} maxFontSizeMultiplier={1.2}>
                    {line === 'Click Send Invitation' ? (
                      <>
                        Click <Text style={styles.sendBold}>Send Invitation</Text>
                      </>
                    ) : (
                      line
                    )}
                  </Text>
                </View>
              )
            )}
            <Text style={styles.stepFooter} maxFontSizeMultiplier={1.15}>
              An invitation email will be sent to the person immediately.
            </Text>
          </View>

          <View style={styles.roleRefHeader}>
            <View style={styles.roleRefNum}>
              <Text style={styles.roleRefNumText} maxFontSizeMultiplier={1.1}>
                2
              </Text>
            </View>
            <Text style={styles.roleRefTitle} maxFontSizeMultiplier={1.25}>
              Role Reference
            </Text>
          </View>
          <Text style={styles.roleRefSub} maxFontSizeMultiplier={1.2}>
            Select the role that best matches the person being invited:
          </Text>
          <View style={styles.roleGrid}>
            {ROLE_CARDS.map((r) => (
              <View key={r.title} style={styles.roleCard}>
                <View style={styles.roleCardTitleRow}>
                  <View style={[styles.roleDot, { backgroundColor: r.dot }]} />
                  <Text style={styles.roleCardTitle} maxFontSizeMultiplier={1.15}>
                    {r.title}
                  </Text>
                </View>
                <Text style={styles.roleCardBody} maxFontSizeMultiplier={1.15}>
                  {r.body}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.afterSection}>
            <View style={styles.afterNum}>
              <Text style={styles.afterNumText} maxFontSizeMultiplier={1.15}>
                3
              </Text>
            </View>
            <Text style={styles.afterTitle} maxFontSizeMultiplier={1.25}>
              What happens after sending an invite?
            </Text>
          </View>
          <Text style={styles.bodyTight} maxFontSizeMultiplier={1.2}>
            The invited user receives an email invitation. They can then follow these steps:
          </Text>
          {AFTER_INVITE_LEADS.map((s, i) => (
            <View key={s.bold} style={styles.numRow}>
              <View style={styles.numCircle}>
                <Text style={styles.numCircleText} maxFontSizeMultiplier={1.1}>
                  {i + 1}
                </Text>
              </View>
              <Text style={styles.numRowText} maxFontSizeMultiplier={1.2}>
                {s.normalPrefix ? <Text>{s.normalPrefix}</Text> : null}
                <Text style={styles.bold}>{s.bold}</Text>
                {s.normalSuffix ? <Text>{s.normalSuffix}</Text> : null}
              </Text>
            </View>
          ))}
          <Text style={styles.body} maxFontSizeMultiplier={1.2}>
            Once accepted, they will be able to view and participate in club activities based on their assigned role.
          </Text>

          <Text style={styles.subSectionTitle} maxFontSizeMultiplier={1.25}>
            📲 Sharing the app download link
          </Text>
          <Text style={styles.bodyTight} maxFontSizeMultiplier={1.2}>
            Admins can also share the T360 download links directly for faster onboarding.
          </Text>
          <View style={styles.pathPill}>
            <Text style={styles.pathPillText} maxFontSizeMultiplier={1.15}>
              Settings → Share App
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.2}>
            This option lets you send both the Android and iOS download links directly to invited members.
          </Text>

          <Text style={styles.subSectionTitle} maxFontSizeMultiplier={1.25}>
            ✦ Existing T360 users
          </Text>
          <Text style={styles.bodyTight} maxFontSizeMultiplier={1.2}>
            If the invited person is already registered on T360, they do not need to create a new account.
          </Text>
          {EXISTING_USER_CHECKS.map((line) => (
            <View key={line} style={styles.checkRow}>
              <Text style={styles.checkMarkGreen} maxFontSizeMultiplier={1.15}>
                ✓
              </Text>
              <Text style={styles.checkText} maxFontSizeMultiplier={1.2}>
                {line.includes('Manage Users') ? (
                  <>
                    Their details appear in <Text style={styles.manageHl}>Manage Users / Manage Club Members</Text>
                  </>
                ) : (
                  line
                )}
              </Text>
            </View>
          ))}

          <View style={styles.tipBox}>
            <Text style={styles.tipText} maxFontSizeMultiplier={1.2}>
              <Text style={styles.tipLead}>Tip:</Text> Onboarding is faster for existing Toastmasters already on T360
              — no new account setup required. Always check if the invitee already has a T360 account before walking them
              through account creation.
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
    marginBottom: 12,
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
    fontSize: 15 * FS,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  headerSpacer: {
    width: 36,
    height: 36,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  hero: {
    backgroundColor: '#FEFCF6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: N.border,
    padding: 18,
    marginBottom: 14,
  },
  heroCrumb: {
    fontSize: 10 * FS,
    fontWeight: '700',
    color: N.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  heroTitleMain: {
    fontSize: 24 * FS,
    fontWeight: '800',
    color: N.text,
    marginBottom: 8,
  },
  heroTitleAccent: {
    fontStyle: 'italic',
    color: GOLD,
    fontWeight: '700',
  },
  heroLead: {
    fontSize: 15 * FS,
    lineHeight: 22 * FS,
    color: N.textSecondary,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagGold: {
    borderColor: GOLD,
    backgroundColor: GOLD_BG,
  },
  tagGoldText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: GOLD,
  },
  tagGreen: {
    borderColor: '#16A34A',
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
  },
  tagGreenText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#15803D',
  },
  tagGrey: {
    borderColor: N.border,
    backgroundColor: 'rgba(55, 53, 47, 0.04)',
  },
  tagGreyText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: N.textSecondary,
  },
  pathBox: {
    backgroundColor: 'rgba(161, 98, 7, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(161, 98, 7, 0.2)',
  },
  pathBoxText: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: GOLD,
    textAlign: 'center',
  },
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
    marginBottom: 14,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: '#0369A1',
  },
  introBar: {
    borderLeftWidth: 4,
    borderLeftColor: GOLD,
    paddingLeft: 12,
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 6,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
  },
  bodyTight: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '800',
    color: N.text,
  },
  bigStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  bigStepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bigStepBadgeText: {
    color: '#FFFFFF',
    fontSize: 16 * FS,
    fontWeight: '800',
  },
  bigStepTitle: {
    flex: 1,
    fontSize: 17 * FS,
    fontWeight: '800',
    color: N.text,
  },
  stepCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(55, 53, 47, 0.02)',
  },
  stepKicker: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 1,
    marginBottom: 6,
  },
  stepCardTitle: {
    fontSize: 17 * FS,
    fontWeight: '800',
    color: N.text,
    marginBottom: 8,
  },
  stepCardBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
    marginBottom: 10,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  fieldBox: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: N.surface,
  },
  fieldLabel: {
    fontSize: 9 * FS,
    fontWeight: '700',
    color: N.textSecondary,
    marginBottom: 6,
  },
  fieldName: {
    fontSize: 13 * FS,
    fontWeight: '800',
    color: N.text,
    textAlign: 'center',
  },
  roleRefLink: {
    color: GOLD,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  checkMark: {
    width: 22,
    fontSize: 14 * FS,
    color: GOLD,
    fontWeight: '800',
  },
  checkMarkGreen: {
    width: 22,
    fontSize: 14 * FS,
    color: '#16A34A',
    fontWeight: '800',
  },
  checkText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  sendBold: {
    fontWeight: '800',
  },
  stepFooter: {
    marginTop: 8,
    fontSize: 13 * FS,
    color: N.textSecondary,
    fontStyle: 'italic',
  },
  roleRefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 6,
  },
  roleRefNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  roleRefNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14 * FS,
  },
  roleRefTitle: {
    fontSize: 18 * FS,
    fontWeight: '800',
    color: N.text,
  },
  roleRefSub: {
    fontSize: 14 * FS,
    color: N.text,
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: N.border,
  },
  roleCard: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: N.surface,
  },
  roleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  roleCardTitle: {
    fontSize: 14 * FS,
    fontWeight: '800',
    color: N.text,
    flex: 1,
  },
  roleCardBody: {
    fontSize: 12 * FS,
    lineHeight: 17 * FS,
    color: N.textSecondary,
  },
  afterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  afterNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  afterNumText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15 * FS,
  },
  afterTitle: {
    flex: 1,
    fontSize: 17 * FS,
    fontWeight: '800',
    color: N.text,
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  numCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(55, 53, 47, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  numCircleText: {
    fontSize: 13 * FS,
    fontWeight: '700',
    color: N.text,
  },
  numRowText: {
    flex: 1,
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  subSectionTitle: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: N.text,
    marginTop: 18,
    marginBottom: 8,
  },
  pathPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(161, 98, 7, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(161, 98, 7, 0.25)',
    marginBottom: 10,
  },
  pathPillText: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: GOLD,
  },
  manageHl: {
    fontWeight: '800',
    color: N.text,
  },
  tipBox: {
    marginTop: 14,
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
    borderRadius: 10,
    padding: 14,
  },
  tipText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  tipLead: {
    fontWeight: '800',
    color: '#15803D',
  },
  faqHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 20,
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
    backgroundColor: 'rgba(161, 98, 7, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: GOLD,
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

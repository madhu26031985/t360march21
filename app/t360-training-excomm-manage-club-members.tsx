import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Info,
  MessageCircle,
  RefreshCw,
  Settings,
  Trash2,
} from 'lucide-react-native';
import { goBackOrReplace } from '@/lib/trainingBackNavigation';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const FS = 0.9;

const PATH_LINE = 'Admin Panel - Manage Club Users - Manage Club Users';

const ROLE_PILLS = ['Member', 'ExCom', 'Guest', 'Visiting Toastmaster', 'Club Leader'];

const WHY_BULLETS = [
  'Accurate club records that reflect the current club structure',
  'Better visibility of who holds which role at any point in time',
  'Correct access levels for each member based on their role',
  'A clean, up-to-date member list free of inactive or outdated entries',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can manage club members in T360?',
    a: 'Only authorized ExCom users can view, manage roles, and remove members from the club.',
  },
  {
    q: "Can I change a member's role more than once?",
    a: "Yes. A user's role can be updated at any time to reflect their current involvement in the club.",
  },
  {
    q: 'What happens when a user is removed from the club?',
    a: 'Removing a user revokes their access to the club in T360. They will no longer be able to view club meetings, announcements, or schedules.',
  },
  {
    q: 'Can a removed user be re-invited to the club?',
    a: 'Yes. A removed user can be re-invited at any time using Invite Club User under the Admin Panel.',
  },
  {
    q: 'Where can I see all current club members and their roles?',
    a: 'All club members and their assigned roles are listed in Manage Club Users under Admin Panel – Club User Management – Manage Club Users.',
  },
];

const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export default function T360TrainingExcommManageClubMembersScreen() {
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
          Manage Club Users
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
          <View style={styles.heroKbPill}>
            <Text style={styles.heroKbPillText} maxFontSizeMultiplier={1.05}>
              T360 KNOWLEDGE BASE
            </Text>
          </View>
          <Text style={styles.heroTitle} maxFontSizeMultiplier={1.35}>
            Manage Club Users
          </Text>
          <Text style={styles.heroLead} maxFontSizeMultiplier={1.25}>
            View all club users, manage their roles, and remove members who are no longer associated with your club, all
            from one place.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.pathStrip}>
            <Text style={styles.pathStripLabel} maxFontSizeMultiplier={1.05}>
              PATH
            </Text>
            <Text style={styles.pathStripMono} maxFontSizeMultiplier={1.12}>
              {PATH_LINE}
            </Text>
          </View>

          <View style={styles.noticeStrip}>
            <Text style={styles.noticeStripText} maxFontSizeMultiplier={1.25}>
              <Text style={styles.noticeBold}>Who can manage club members?</Text> Only authorized ExCom users can
              manage members, update roles, and remove users from the club.
            </Text>
          </View>

          <View style={styles.restrictBadge}>
            <Text style={styles.restrictBadgeText} maxFontSizeMultiplier={1.15}>
              ExCom members only
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
              The Manage Club Users section helps ExCom members manage all club users in one place. Here, ExCom users
              can view everyone who belongs to the club along with their assigned roles.
            </Text>
            <View style={styles.pillRow}>
              {ROLE_PILLS.map((p) => (
                <View key={p} style={styles.rolePill}>
                  <Text style={styles.rolePillText} maxFontSizeMultiplier={1.05}>
                    {p}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.kbBadge}>
            <Text style={styles.kbBadgeText} maxFontSizeMultiplier={1.2}>
              T360 · Knowledge base
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.sectionTitleRow}>
              <Settings size={18 * FS} color="#1E40AF" strokeWidth={2} />
              <Text style={styles.sectionTitleBlue} maxFontSizeMultiplier={1.25}>
                Key Functionalities
              </Text>
            </View>
            <View style={styles.funcRow}>
              <View style={styles.funcBoxBlue}>
                <Text style={styles.funcKicker} maxFontSizeMultiplier={1}>
                  FUNCTIONALITY 1
                </Text>
                <Text style={styles.funcTitle} maxFontSizeMultiplier={1.15}>
                  Role Management
                </Text>
                <Text style={styles.funcBody} maxFontSizeMultiplier={1.15}>
                  ExCom members can change the role of any existing user whenever required, based on their current
                  involvement in the club.
                </Text>
              </View>
              <View style={styles.funcBoxRose}>
                <Text style={[styles.funcKicker, styles.funcKickerRose]} maxFontSizeMultiplier={1}>
                  FUNCTIONALITY 2
                </Text>
                <Text style={[styles.funcTitle, styles.funcTitleRose]} maxFontSizeMultiplier={1.15}>
                  User Removal
                </Text>
                <Text style={styles.funcBody} maxFontSizeMultiplier={1.15}>
                  If a person is no longer associated with the club, ExCom members can use the Delete option to remove
                  them from the club.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.subCard}>
            <View style={styles.sectionTitleRow}>
              <RefreshCw size={18 * FS} color="#1E40AF" strokeWidth={2} />
              <Text style={styles.sectionTitleBlue} maxFontSizeMultiplier={1.25}>
                Role Management
              </Text>
            </View>
            <Text style={styles.body} maxFontSizeMultiplier={1.25}>
              {`ExCom members can update a user's role at any time to reflect changes in their club involvement. Any role can be changed to any other available role.`}
            </Text>
          </View>

          <View style={styles.subCard}>
            <View style={styles.sectionTitleRow}>
              <Trash2 size={18 * FS} color="#1E40AF" strokeWidth={2} />
              <Text style={styles.sectionTitleBlue} maxFontSizeMultiplier={1.25}>
                User Removal
              </Text>
            </View>
            <Text style={styles.body} maxFontSizeMultiplier={1.25}>
              If a person is no longer part of the club, ExCom members can remove them using the{' '}
              <Text style={styles.inlineBold}>Delete</Text>
              {` option next to the user's record in the Manage Club Users section.`}
            </Text>
            <View style={styles.noteRose}>
              <Text style={styles.noteRoseText} maxFontSizeMultiplier={1.2}>
                <Text style={styles.noteRoseLead}>Note:</Text> Removing a user from the club will revoke their access to
                the club in T360.
              </Text>
            </View>
          </View>

          <View style={styles.subCard}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.whyIconTile}>
                <Text style={styles.whyCheckGlyph} maxFontSizeMultiplier={1.2}>
                  ✓
                </Text>
              </View>
              <Text style={styles.sectionTitleBlue} maxFontSizeMultiplier={1.25}>
                Why Keeping Records Updated Matters
              </Text>
            </View>
            <Text style={styles.body} maxFontSizeMultiplier={1.25}>
              Maintaining accurate club membership and role information helps ensure:
            </Text>
            {WHY_BULLETS.map((line) => (
              <View key={line} style={styles.checkRow}>
                <Text style={styles.checkMarkGreen} maxFontSizeMultiplier={1.15}>
                  ✓
                </Text>
                <Text style={styles.checkText} maxFontSizeMultiplier={1.25}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.faqTitleRow}>
            <MessageCircle size={20 * FS} color="#2563EB" strokeWidth={2} />
            <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
              Frequently Asked Questions
            </Text>
          </View>
          {FAQS.map(({ q, a }, i) => (
            <View key={q} style={[styles.faqBlock, i > 0 && styles.faqBlockBorder]}>
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
    fontSize: 20 * FS,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  headerSpacer: { width: 36, height: 36 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  hero: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
  },
  heroKbPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 12,
  },
  heroKbPillText: {
    color: '#FFFFFF',
    fontSize: 10 * FS,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26 * FS,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroLead: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
  },
  card: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    padding: 16,
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
    color: '#334155',
    fontWeight: '600',
  },
  noticeStrip: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.2)',
  },
  noticeStripText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#78350F',
  },
  noticeBold: {
    fontWeight: '800',
  },
  restrictBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(190, 24, 93, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 14,
  },
  restrictBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#9D174D',
  },
  overviewCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
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
    color: '#0F2942',
  },
  overviewBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },
  rolePillText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#1D4ED8',
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
  featureCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: N.surface,
  },
  subCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: N.surface,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitleBlue: {
    flex: 1,
    fontSize: 16 * FS,
    fontWeight: '800',
    color: '#0F2942',
  },
  whyIconTile: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyCheckGlyph: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: '#16A34A',
  },
  funcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  funcBoxBlue: {
    flex: 1,
    minWidth: 130,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  funcBoxRose: {
    flex: 1,
    minWidth: 130,
    backgroundColor: 'rgba(190, 24, 93, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(190, 24, 93, 0.22)',
  },
  funcKicker: {
    fontSize: 10 * FS,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  funcKickerRose: {
    color: '#9D174D',
  },
  funcTitle: {
    fontSize: 15 * FS,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 6,
  },
  funcTitleRose: {
    color: '#9D174D',
  },
  funcBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.text,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 4,
  },
  inlineBold: {
    fontWeight: '800',
    color: N.text,
  },
  noteRose: {
    marginTop: 12,
    backgroundColor: 'rgba(190, 24, 93, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(190, 24, 93, 0.28)',
    borderRadius: 10,
    padding: 12,
  },
  noteRoseText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
  noteRoseLead: {
    fontWeight: '800',
    color: '#9D174D',
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
  faqTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  faqHeading: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: '#0F2942',
  },
  faqBlock: {
    paddingVertical: 12,
  },
  faqBlockBorder: {
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  faqQ: {
    fontSize: 15 * FS,
    fontWeight: '800',
    lineHeight: 22 * FS,
    color: '#0F2942',
    marginBottom: 6,
  },
  faqA: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
  },
});

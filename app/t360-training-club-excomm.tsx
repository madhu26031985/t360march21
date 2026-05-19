import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  ArrowLeft,
  BookOpen,
  FolderOpen,
  Globe2,
  Lightbulb,
  Lock,
  Medal,
  Phone,
  Search,
  Users,
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

const EXCOMM_ROLES: { num: string; role: string; responsibility: string }[] = [
  { num: '1', role: 'President', responsibility: 'Overall club leadership & vision' },
  { num: '2', role: 'VP Education', responsibility: 'Member education pathways & meeting quality' },
  { num: '3', role: 'VP Membership', responsibility: 'Member recruitment & retention' },
  { num: '4', role: 'VP Public Relations', responsibility: 'Club branding, promotions & communications' },
  { num: '5', role: 'Secretary', responsibility: 'Records, correspondence & club documentation' },
  { num: '6', role: 'Treasurer', responsibility: 'Finances, dues collection & budgeting' },
  { num: '7', role: 'Sergeant at Arms', responsibility: 'Meeting setup, venue & member conduct' },
  { num: '8', role: 'Immediate Past President', responsibility: 'Advisory support & continuity' },
];

const BEST_PRACTICE_ITEMS = [
  'A new term starts',
  'Leadership changes happen',
  'A role becomes vacant',
  'A new member is assigned to an ExCom position',
];

const VISIBILITY_TAGS = ['Members', 'ExCom Members', 'Guests', 'Visiting Toastmasters'];

const WHY_IMPORTANT: { icon: 'users' | 'search' | 'phone' | 'globe' | 'folder'; text: string }[] = [
  { icon: 'users', text: 'Shows who manages the club' },
  { icon: 'search', text: 'Improves leadership transparency' },
  { icon: 'phone', text: 'Helps members know whom to approach' },
  { icon: 'globe', text: 'Gives guests visibility into leadership' },
  { icon: 'folder', text: 'Maintains accurate ExCom records' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is Club ExCom?',
    a: 'Club ExCom is the Executive Committee area where authorized leaders assign and update standard ExCom roles for your club in T360.',
  },
  {
    q: 'Who can update Club ExCom details?',
    a: 'Only authorized ExCom members with the right permissions can change assignments, terms, and related leadership records.',
  },
  {
    q: 'Where can members see ExCom details?',
    a: 'Updated ExCom information is visible in the Club experience so members, guests, and visiting Toastmasters can see who leads the club.',
  },
  {
    q: 'Why should ExCom information be kept updated?',
    a: 'Accurate records build trust, reduce confusion about contacts, and align the app with your club’s real leadership.',
  },
  {
    q: 'Can ExCom assignments be changed?',
    a: 'Yes. ExCom members can reassign roles when leadership changes, following your club’s governance practices.',
  },
  {
    q: 'Can a role remain vacant?',
    a: 'Yes, temporarily. You should still reflect vacancies honestly so members know which positions need filling.',
  },
  {
    q: 'Why are term start and end dates important?',
    a: 'They document each leadership period, support continuity, and help members understand when a new ExCom term begins.',
  },
];

function WhyIcon({ kind }: { kind: (typeof WHY_IMPORTANT)[number]['icon'] }) {
  const c = '#5B21B6';
  const s = Math.round(18 * FS);
  switch (kind) {
    case 'users':
      return <Users size={s} color={c} strokeWidth={2} />;
    case 'search':
      return <Search size={s} color={c} strokeWidth={2} />;
    case 'phone':
      return <Phone size={s} color={c} strokeWidth={2} />;
    case 'globe':
      return <Globe2 size={s} color={c} strokeWidth={2} />;
    default:
      return <FolderOpen size={s} color={c} strokeWidth={2} />;
  }
}

export default function T360TrainingClubExcommScreen() {
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
          Club ExComm
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
            <Text style={styles.heroKbPillText} maxFontSizeMultiplier={1.1}>
              KNOWLEDGE BASE
            </Text>
          </View>
          <Text style={styles.heroTitle} maxFontSizeMultiplier={1.35}>
            Club ExCom Management
          </Text>
          <Text style={styles.heroLead} maxFontSizeMultiplier={1.25}>
            A guide for ExCom members on managing Executive Committee roles within the club platform.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.kbBadge}>
            <Text style={styles.kbBadgeText} maxFontSizeMultiplier={1.2}>
              T360 · Knowledge base
            </Text>
          </View>

          <View style={styles.overviewHead}>
            <View style={styles.overviewIconTile}>
              <BookOpen size={18} color="#5B21B6" strokeWidth={2} />
            </View>
            <Text style={styles.overviewTitle} maxFontSizeMultiplier={1.2}>
              OVERVIEW
            </Text>
          </View>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The <Text style={styles.bold}>Club ExCom</Text> section is used to manage and update the Executive Committee
            members of the club. In every Toastmasters club, selected members take on leadership responsibilities covering
            operations, meetings, membership, education, and administration.
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Keeping this information current ensures leadership transparency and helps members, guests, and visiting
            Toastmasters know exactly who to contact for support.
          </Text>

          <View style={styles.purplePanel}>
            <View style={styles.purplePanelHead}>
              <View style={styles.purpleIconWrap}>
                <Lock size={16} color="#5B21B6" strokeWidth={2} />
              </View>
              <Text style={styles.purplePanelTitle} maxFontSizeMultiplier={1.15}>
                WHO CAN UPDATE THIS?
              </Text>
            </View>
            <Text style={styles.purplePanelBody} maxFontSizeMultiplier={1.2}>
              Only authorized <Text style={styles.boldPurple}>ExCom members</Text> can update Club ExComm details. Once
              updated, the information becomes visible to:
            </Text>
            <View style={styles.tagRow}>
              {VISIBILITY_TAGS.map((t) => (
                <View key={t} style={styles.visTag}>
                  <Text style={styles.visTagText} maxFontSizeMultiplier={1.1}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.tableSection}>
            <View style={styles.tableTitleRow}>
              <Medal size={18} color="#5B21B6" strokeWidth={2} />
              <Text style={styles.tableSectionTitle} maxFontSizeMultiplier={1.2}>
                STANDARD EXCOM ROLES
              </Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.thNum]} maxFontSizeMultiplier={1.1}>
                  #
                </Text>
                <Text style={[styles.th, styles.thRole]} maxFontSizeMultiplier={1.1}>
                  ROLE
                </Text>
                <Text style={[styles.th, styles.thResp]} maxFontSizeMultiplier={1.1}>
                  PRIMARY RESPONSIBILITY
                </Text>
              </View>
              {EXCOMM_ROLES.map((r) => (
                <View key={r.role} style={styles.tr}>
                  <Text style={[styles.td, styles.tdNum]} maxFontSizeMultiplier={1.15}>
                    {r.num}
                  </Text>
                  <Text style={[styles.td, styles.tdRole]} maxFontSizeMultiplier={1.15}>
                    {r.role}
                  </Text>
                  <Text style={[styles.td, styles.tdResp]} maxFontSizeMultiplier={1.15}>
                    {r.responsibility}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.bestPracticeBox}>
            <View style={styles.bestPracticeHead}>
              <View style={styles.bestPracticeIcon}>
                <Text style={styles.checkInCircle} maxFontSizeMultiplier={1.1}>
                  ✓
                </Text>
              </View>
              <Text style={styles.bestPracticeLabel} maxFontSizeMultiplier={1.15}>
                BEST PRACTICE
              </Text>
            </View>
            <Text style={styles.bestPracticeIntro} maxFontSizeMultiplier={1.2}>
              Ensure ExCom information is updated whenever any of the following occur:
            </Text>
            {BEST_PRACTICE_ITEMS.map((line, i) => (
              <View key={line} style={[styles.bpRow, i > 0 && styles.bpRowBorder]}>
                <Text style={styles.bpCheck} maxFontSizeMultiplier={1.15}>
                  ✓
                </Text>
                <Text style={styles.bpText} maxFontSizeMultiplier={1.2}>
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.whySection}>
            <View style={styles.whyTitleRow}>
              <Lightbulb size={18} color="#5B21B6" strokeWidth={2} />
              <Text style={styles.whySectionTitle} maxFontSizeMultiplier={1.2}>
                WHY IS THIS IMPORTANT?
              </Text>
            </View>
            <View style={styles.whyGrid}>
              {WHY_IMPORTANT.map((w) => (
                <View key={w.text} style={styles.whyCell}>
                  <View style={styles.whyIconWrap}>
                    <WhyIcon kind={w.icon} />
                  </View>
                  <Text style={styles.whyCellText} maxFontSizeMultiplier={1.15}>
                    {w.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.faqHeaderRow}>
            <View style={styles.faqHeaderIcon}>
              <Text style={styles.faqQmark} maxFontSizeMultiplier={1.2}>
                ?
              </Text>
            </View>
            <Text style={styles.faqHeaderTitle} maxFontSizeMultiplier={1.2}>
              FREQUENTLY ASKED QUESTIONS
            </Text>
          </View>
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
  hero: {
    backgroundColor: '#6D28D9',
    borderRadius: 14,
    padding: 20,
    marginBottom: 14,
  },
  heroKbPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  heroKbPillText: {
    color: '#FFFFFF',
    fontSize: 11 * FS,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24 * FS,
    fontWeight: '800',
    marginBottom: 10,
  },
  heroLead: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
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
  overviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewIconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(91, 33, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  overviewTitle: {
    fontSize: 15 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.6,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 14,
  },
  bold: {
    fontWeight: '800',
    color: N.text,
  },
  purplePanel: {
    backgroundColor: 'rgba(91, 33, 182, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(91, 33, 182, 0.2)',
    borderRadius: 12,
    padding: 14,
  },
  purplePanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  purpleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(91, 33, 182, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  purplePanelTitle: {
    flex: 1,
    fontSize: 12 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.5,
  },
  purplePanelBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
    marginBottom: 10,
  },
  boldPurple: {
    fontWeight: '800',
    color: '#5B21B6',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  visTag: {
    backgroundColor: 'rgba(91, 33, 182, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(91, 33, 182, 0.2)',
  },
  visTagText: {
    fontSize: 12 * FS,
    fontWeight: '700',
    color: '#4C1D95',
  },
  tableSection: {
    marginTop: 22,
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  tableSectionTitle: {
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.5,
  },
  table: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#5B21B6',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  thNum: { width: 28, textAlign: 'center' },
  thRole: { width: 110 },
  thResp: { flex: 1 },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: N.border,
    backgroundColor: N.surface,
  },
  td: {
    fontSize: 13 * FS,
    color: N.text,
    lineHeight: 18 * FS,
  },
  tdNum: { width: 28, textAlign: 'center', fontWeight: '700', color: N.textSecondary },
  tdRole: { width: 110, fontWeight: '700' },
  tdResp: { flex: 1, color: N.textSecondary },
  bestPracticeBox: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(55, 53, 47, 0.03)',
  },
  bestPracticeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  bestPracticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(91, 33, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkInCircle: {
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#16A34A',
  },
  bestPracticeLabel: {
    fontSize: 13 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.6,
  },
  bestPracticeIntro: {
    fontSize: 14 * FS,
    lineHeight: 20 * FS,
    color: N.text,
    marginBottom: 8,
  },
  bpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  bpRowBorder: {
    borderTopWidth: 1,
    borderTopColor: N.border,
  },
  bpCheck: {
    width: 24,
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#16A34A',
    textAlign: 'center',
  },
  bpText: {
    flex: 1,
    fontSize: 14 * FS,
    color: N.text,
    fontWeight: '600',
  },
  whySection: {
    marginTop: 22,
    backgroundColor: 'rgba(91, 33, 182, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 33, 182, 0.15)',
  },
  whyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  whySectionTitle: {
    fontSize: 14 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.4,
    flex: 1,
  },
  whyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  whyCell: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(91, 33, 182, 0.12)',
  },
  whyIconWrap: {
    marginBottom: 8,
  },
  whyCellText: {
    fontSize: 13 * FS,
    lineHeight: 18 * FS,
    color: N.text,
    fontWeight: '600',
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 12,
    gap: 10,
  },
  faqHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(236, 72, 153, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqQmark: {
    fontSize: 16 * FS,
    fontWeight: '800',
    color: '#9D174D',
  },
  faqHeaderTitle: {
    flex: 1,
    fontSize: 13 * FS,
    fontWeight: '800',
    color: '#5B21B6',
    letterSpacing: 0.5,
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
    backgroundColor: 'rgba(91, 33, 182, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#5B21B6',
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

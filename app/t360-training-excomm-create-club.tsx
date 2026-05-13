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

const hlStyle = {
  fontWeight: '700' as const,
  color: N.text,
  backgroundColor: 'rgba(249, 115, 22, 0.18)',
  paddingHorizontal: 4,
  borderRadius: 4,
  overflow: 'hidden' as const,
};

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Open Settings',
    body: (
      <>
        Navigate to the <Text style={hlStyle}>Settings</Text> tab from the main navigation bar.
      </>
    ),
  },
  {
    title: "Click 'Create Club'",
    body: (
      <>
        Locate and click the <Text style={hlStyle}>Create Club</Text> button on the Settings page.
      </>
    ),
  },
  {
    title: 'Fill in Club Details',
    body: (
      <>
        {"Enter your club's "}
        <Text style={hlStyle}>name</Text>, <Text style={hlStyle}>number</Text>, and <Text style={hlStyle}>charter date</Text>{' '}
        in the form provided.
      </>
    ),
  },
  {
    title: 'Confirm Creation',
    body: (
      <>
        Click <Text style={hlStyle}>Create</Text> to finalize. Your club is now live.
      </>
    ),
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I create multiple clubs?',
    a: 'Yes, when your account allows it. You can create additional clubs from Settings and manage each one separately.',
  },
  {
    q: 'How do I switch between different clubs?',
    a: 'Use the Club Switcher (club name / icon) in the app header to select the club you want to work in.',
  },
  {
    q: 'What should I do after creating a club?',
    a: 'Invite members, assign ExComm roles, configure club preferences, and schedule your first meeting.',
  },
  {
    q: 'Can the same person be an ExComm in multiple clubs?',
    a: 'Yes. ExComm (admin) access is per club, so you can hold that role in more than one club.',
  },
  {
    q: 'Can I be an ExComm in one club and a member in another?',
    a: 'Yes. Your role is defined separately in each club.',
  },
];

export default function T360TrainingExcommCreateClubScreen() {
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
          Create a Club
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
            Creating a Club
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Follow this quick guide to set up your club in T360, manage roles, and get your members onboard.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to Create a Club
          </Text>
          <Text style={styles.sectionSub} maxFontSizeMultiplier={1.2}>
            4 simple steps · Takes less than 2 minutes
          </Text>

          {STEPS.map(({ title, body }, i) => (
            <View key={title} style={styles.lifecycleBlock}>
              <View style={styles.lifecycleHead}>
                <View style={styles.lifecycleNum}>
                  <Text style={styles.lifecycleNumText} maxFontSizeMultiplier={1.2}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={styles.lifecycleTitle} maxFontSizeMultiplier={1.25}>
                  {title}
                </Text>
              </View>
              <Text style={styles.lifecycleBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <View style={styles.calloutExcomm}>
            <Text style={styles.calloutExcommText} maxFontSizeMultiplier={1.25}>
              {"You'll automatically be assigned as "}
              <Text style={styles.calloutExcommStrong}>ExComm (admin)</Text>
              {' of your newly created club.'}
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
  kbBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(234, 88, 12, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: '#C2410C',
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
    marginTop: 8,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13 * FS,
    lineHeight: 18 * FS,
    color: N.textSecondary,
    marginBottom: 14,
  },
  lifecycleBlock: {
    marginBottom: 16,
  },
  lifecycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  lifecycleNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(234, 88, 12, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lifecycleNumText: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: '#C2410C',
  },
  lifecycleTitle: {
    flex: 1,
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
  },
  lifecycleBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    paddingLeft: 38,
  },
  calloutExcomm: {
    backgroundColor: 'rgba(254, 215, 170, 0.35)',
    borderLeftWidth: 4,
    borderLeftColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  calloutExcommText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.text,
    fontWeight: '500',
  },
  calloutExcommStrong: {
    fontWeight: '800',
    color: '#C2410C',
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
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  faqQBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '800',
    color: '#C2410C',
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

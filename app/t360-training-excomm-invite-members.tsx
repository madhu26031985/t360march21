import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  text: '#37352F',
  textSecondary: '#787774',
};

const STEPS = [
  'Go to Admin → Invite new club members',
  'Enter Full Name',
  'Enter Email ID',
  'Select Role (Member / ExComm / Guest / Visiting Toastmaster / Club Leader)',
  'Tap Send invitation',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What happens after sending an invite?',
    a: 'The user receives an email invitation and can join your club.',
  },
  {
    q: 'Can I assign roles while inviting?',
    a: 'Yes, you can select roles like Member, ExComm, Guest, Visiting Toastmaster, Club Leader, etc.',
  },
  {
    q: 'Can I track invitations?',
    a: 'Yes, pending invites are shown under the invitation section.',
  },
  {
    q: 'Can I resend an invite?',
    a: 'You can send a new invite again if the user hasn’t joined.',
  },
  {
    q: 'Who can invite members?',
    a: 'Only users with ExComm access can invite members.',
  },
];

export default function T360TrainingExcommInviteMembersScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={N.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
          Invite members
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
          <Text style={styles.title} maxFontSizeMultiplier={1.35}>
            How to Invite Club Members?
          </Text>

          {STEPS.map((step, i) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNum} maxFontSizeMultiplier={1.25}>
                {i + 1}.
              </Text>
              <Text style={styles.stepText} maxFontSizeMultiplier={1.25}>
                {step}
              </Text>
            </View>
          ))}

          <Text style={styles.done} maxFontSizeMultiplier={1.25}>
            ✅ Invitation sent! The member will receive an email to join.
          </Text>

          <Text style={styles.faqHeading} maxFontSizeMultiplier={1.3}>
            ❓ FAQs
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
    fontSize: 20,
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
    paddingBottom: 24,
  },
  card: {
    backgroundColor: N.surface,
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 14,
    padding: 18,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: N.text,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    fontSize: 15,
    fontWeight: '600',
    color: N.textSecondary,
    minWidth: 22,
  },
  stepText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 15,
    lineHeight: 22,
    color: N.text,
  },
  done: {
    marginTop: 14,
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    color: N.text,
  },
  faqHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: N.text,
    marginBottom: 12,
  },
  faqBlock: {
    marginBottom: 14,
  },
  faqQ: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    color: N.text,
    marginBottom: 4,
  },
  faqA: {
    fontSize: 14,
    lineHeight: 21,
    color: N.textSecondary,
  },
});

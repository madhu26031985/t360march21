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

const AT_A_GLANCE = ['<5 min prep', '3 public layouts', 'Live link updates'];

const AGENDA_PARTS: { title: string; body: string; badge: string }[] = [
  {
    title: 'Agenda Settings',
    body: 'Controls visibility, public layout style, banner colors, and how the agenda is shared.',
    badge: 'Settings',
  },
  {
    title: 'Agenda Section',
    body: 'Where the actual meeting agenda is auto-generated and customized with full editorial control.',
    badge: 'Builder',
  },
];

const LAYOUTS: { title: string; body: string }[] = [
  {
    title: 'Default',
    body: 'Classic layout with banners, section cards, and structured presentation. Best for a traditional professional look.',
  },
  {
    title: 'Minimal',
    body: 'Clean, simplified list view. Best for clubs that prefer a lightweight, distraction-free agenda experience.',
  },
  {
    title: 'Vibrant',
    body: 'Visually rich card-based design with bold presentation. Best for a modern, engaging public agenda.',
  },
];

const BANNER_AREAS: { title: string; body: string }[] = [
  { title: 'Club Info Banner', body: 'Controls the banner color for club information displayed at the top of the agenda.' },
  { title: 'Date & Time Banner', body: 'Controls how the meeting date and timing section appears to viewers.' },
  { title: 'Footer Banner 1', body: 'Customize the color of the first footer section at the bottom of the agenda.' },
  { title: 'Footer Banner 2', body: 'Customize the color of the second footer section for additional information.' },
];

const AUTO_FILL_CHECKS = [
  'SAA (Sergeant at Arms) details',
  'Presiding Officer information',
  'Toastmaster of the Day (TMOD)',
  'Theme of the Day',
  'Speaker booking and speech info',
  'Evaluator assignments linked',
];

const MANUAL_ITEMS: { title: string; body: string }[] = [
  { title: 'Modify Content', body: 'Edit any text, name, title, or description in any agenda section.' },
  { title: 'Add Custom Notes', body: 'Append notes, announcements, or special instructions to any section.' },
  { title: 'Adjust Meeting Information', body: 'Update timing, location, or other meeting-level details as needed.' },
  { title: 'Save Changes Instantly', body: 'All edits are saved immediately and reflected live on the shared agenda link.' },
];

const SHOW_HIDE: { title: string; body: string; tone: 'hide' | 'show' }[] = [
  {
    title: 'Hide a Section',
    body: 'Click the Eye icon to remove a section from the public agenda. Examples: Meet & Greet, Break session, Educational segment, Special announcements.',
    tone: 'hide',
  },
  {
    title: 'Show a Section',
    body: 'Re-enable any hidden section at any time. Hidden sections are preserved and can be restored with one click.',
    tone: 'show',
  },
];

const SPEAKER_FEATURES: { title: string; body: string }[] = [
  { title: 'Speech Details', body: 'Displays the speech title and all relevant information for the prepared speech.' },
  {
    title: 'Pathway Information',
    body: "Shows the speaker's Toastmasters pathway details, helping evaluators and guests understand the speech context.",
  },
  {
    title: 'Embedded Evaluation Form',
    body: 'The evaluator form is embedded directly within the agenda link — no separate sharing needed. Accessible to evaluators, members, visiting Toastmasters, and guests.',
  },
];

const SHARE_CHANNELS = ['WhatsApp groups', 'Email', 'Social media', 'Any direct link'];

const LIVE_STEPS: { label: string; body: string }[] = [
  { label: 'Step 1', body: 'Prepare and publish the agenda using the Agenda Creator.' },
  { label: 'Step 2', body: 'Share the agenda link with members via WhatsApp, email, or any channel.' },
  { label: 'Last minute', body: 'A speaker cancels or a role changes — simply update the agenda in the editor.' },
  { label: 'Auto update', body: 'The same shared link instantly reflects all changes. No new link, no resending, no manual notifications required.' },
];

const BENEFITS = [
  'Generate a complete agenda in under 5 minutes',
  'Auto-fill based on role bookings',
  'Choose from three beautiful public layouts',
  'Customize Toastmasters-approved banner colors',
  'Hide or show any section with one click',
  'Reorder agenda flow in seconds',
  'Edit any section anytime after auto-generation',
  'Embed speech details and evaluation forms',
  'Share via WhatsApp, email, or social media',
  'Live agenda — no need to resend links after changes',
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Who can edit the agenda?',
    a: 'Only ExComm members can create or edit the agenda. Regular members and guests can only view the published version.',
  },
  {
    q: 'Can I hide the agenda while preparing it?',
    a: 'Yes. Turn Agenda Visibility OFF while editing. Members will see a message indicating the agenda is being prepared, preventing confusion over incomplete drafts.',
  },
  {
    q: 'Do I need to manually enter every role?',
    a: 'No. Use the Auto Fill Entire Agenda button and T360 will automatically populate all booked roles and meeting details based on current assignments.',
  },
  {
    q: 'Can I customize auto-filled sections?',
    a: 'Yes. Every section can still be manually edited after auto-generation. Auto-fill is a starting point, not a lock-in.',
  },
  {
    q: 'Can I remove sections from the agenda?',
    a: 'Yes. Use the Eye icon on any section to hide it from the published agenda. You can re-enable hidden sections at any time.',
  },
  {
    q: 'Can I rearrange the agenda order?',
    a: "Yes. Use the Up/Down arrow controls on each section to reorder the meeting flow in any sequence that fits your club's format.",
  },
  {
    q: 'Can members access evaluation forms through the agenda?',
    a: 'Yes. Prepared Speaker sections automatically include embedded evaluation forms. Anyone opening the agenda link can access the form directly without any separate sharing.',
  },
  {
    q: 'Can I share the agenda on WhatsApp?',
    a: 'Yes. Simply copy the agenda link and share it via WhatsApp, email, social media, or any other channel. The same link works everywhere.',
  },
  {
    q: 'What happens if I update the agenda after sharing?',
    a: 'No problem at all. The agenda is live. The same shared link automatically reflects the latest updates without any action required from you.',
  },
  {
    q: 'Do I need to resend the agenda link after making changes?',
    a: 'No. The shared link always shows the latest version of the agenda. You never need to create a new link or resend anything after making updates.',
  },
];

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
          Agenda Creator
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
            Agenda Creator
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Create a complete, professional Toastmasters meeting agenda in minutes. Replace 30–45 minutes of manual
            work with an automated, live, shareable agenda.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            At a glance
          </Text>
          <View style={styles.flowWrap}>
            {AT_A_GLANCE.map((step, i) => (
              <View key={step} style={styles.flowChunk}>
                {i > 0 ? (
                  <Text style={styles.flowArrow} maxFontSizeMultiplier={1.2}>
                    →{' '}
                  </Text>
                ) : null}
                <View style={styles.flowPill}>
                  <Text style={styles.flowPillText} maxFontSizeMultiplier={1.2}>
                    {step}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Overview
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            <Text style={styles.bodyStrong}>Agenda Creator</Text> is T360&apos;s flagship meeting preparation feature.
            It automatically generates your entire Toastmasters meeting agenda based on role bookings and assignments —
            drastically reducing the time ExComm members spend on agenda prep.
          </Text>
          <View style={styles.calloutOk}>
            <Text style={styles.calloutOkText} maxFontSizeMultiplier={1.25}>
              <Text style={styles.bodyStrong}>Time savings: </Text>
              What normally takes 30–45 minutes of manual effort can now be completed in under 5 minutes using the
              Auto Fill feature.
            </Text>
          </View>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.25}>
            The Agenda Creator consists of two major sections:
          </Text>
          {AGENDA_PARTS.map(({ title, body, badge }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
              <View style={styles.partBadge}>
                <Text style={styles.partBadgeText} maxFontSizeMultiplier={1.1}>
                  {badge}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Who can edit
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            ExComm members only
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Only ExComm (Executive Committee) members can access and edit the meeting agenda. Regular members can view
            the published agenda but cannot modify it.
          </Text>
          <View style={styles.restrictBadge}>
            <Text style={styles.restrictBadgeText} maxFontSizeMultiplier={1.15}>
              ExComm members only
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Opening the agenda editor
          </Text>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.25}>
            Navigate using this path:
          </Text>
          <View style={styles.flowWrap}>
            {['Meeting', 'Open Meeting', 'Edit Agenda'].map((step, i) => (
              <View key={step} style={styles.flowChunk}>
                {i > 0 ? (
                  <Text style={styles.flowArrow} maxFontSizeMultiplier={1.2}>
                    ›{' '}
                  </Text>
                ) : null}
                <View style={styles.flowPill}>
                  <Text style={styles.flowPillText} maxFontSizeMultiplier={1.2}>
                    {step}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutInfoText} maxFontSizeMultiplier={1.25}>
              Once inside the meeting view, tap <Text style={styles.bodyStrong}>Edit Agenda</Text> to begin preparing
              the meeting agenda.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Visibility control
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda settings · 1 of 3
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            While preparing the agenda, you may not want members to see an incomplete version. T360 lets you toggle
            visibility on or off at any point during editing.
          </Text>
          <View style={styles.miniCard}>
            <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
              Visibility OFF — draft mode
            </Text>
            <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
              Members cannot view the agenda. A message will indicate that the VP Education or ExComm is currently
              preparing the agenda, avoiding confusion during preparation.
            </Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
              Visibility ON — published
            </Text>
            <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
              Once the agenda is ready, toggle visibility ON to make it instantly available to all members and guests.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Public web layouts
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda settings · 2 of 3
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            T360 provides <Text style={styles.bodyStrong}>three beautiful web layouts</Text> for the public-facing
            agenda. You can switch between layouts anytime and preview the style instantly.
          </Text>
          {LAYOUTS.map(({ title, body }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Banner colors
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda settings · 3 of 3
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Customize your agenda with Toastmasters-approved color themes across four distinct banner areas.
          </Text>
          {BANNER_AREAS.map(({ title, body }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutInfoText} maxFontSizeMultiplier={1.25}>
              T360 includes multiple Toastmasters-approved color combinations to help clubs maintain consistent branding
              while making agendas visually appealing.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Auto fill entire agenda
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda builder · core feature
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            This is the most powerful feature of the Agenda Creator. With a single click, T360 checks all booked meeting
            roles and automatically fills every agenda section.
          </Text>
          <View style={styles.calloutOk}>
            <Text style={styles.calloutOkText} maxFontSizeMultiplier={1.25}>
              Tap <Text style={styles.bodyStrong}>Auto Fill Entire Agenda</Text> in the Agenda Section. T360 will
              instantly generate the complete agenda based on all current role bookings and assignments.
            </Text>
          </View>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.25}>
            The system auto-populates details for every booked role:
          </Text>
          {AUTO_FILL_CHECKS.map((line) => (
            <Text key={line} style={styles.checkLine} maxFontSizeMultiplier={1.25}>
              ✔ {line}
            </Text>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Manual editing
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Every agenda section can be customized even after auto-generation. As an ExComm member you have full
            editorial control over every field.
          </Text>
          {MANUAL_ITEMS.map(({ title, body }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Show / hide sections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Not every meeting follows the same format. Use the <Text style={styles.bodyStrong}>Eye icon</Text> on any
            agenda section to toggle its visibility in the published agenda.
          </Text>
          {SHOW_HIDE.map(({ title, body, tone }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
              <View style={tone === 'hide' ? styles.hideBadge : styles.showBadge}>
                <Text style={tone === 'hide' ? styles.hideBadgeText : styles.showBadgeText} maxFontSizeMultiplier={1.1}>
                  {tone === 'hide' ? 'Hidden' : 'Visible'}
                </Text>
              </View>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Reorder sections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Use the <Text style={styles.bodyStrong}>Up and Down arrow controls</Text> on each agenda section to
            rearrange the meeting flow in any order.
          </Text>
          <View style={styles.calloutInfo}>
            <Text style={styles.calloutInfoText} maxFontSizeMultiplier={1.25}>
              Example: move an Educational Session before Table Topics, place Networking after Evaluations, or insert a
              Special Event anywhere in the flow — everything reorders in seconds.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Prepared speaker details
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Agenda builder · smart feature
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Prepared Speaker section goes beyond basic agenda information. When speakers are added, the agenda
            automatically embeds rich details for everyone involved.
          </Text>
          {SPEAKER_FEATURES.map(({ title, body }) => (
            <View key={title} style={styles.miniCard}>
              <Text style={styles.miniCardTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.miniCardBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Share the agenda
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once published, the agenda can be shared through any channel. Copy the agenda link and distribute it
            anywhere — the same link works everywhere.
          </Text>
          <View style={styles.shareRow}>
            {SHARE_CHANNELS.map((ch) => (
              <View key={ch} style={styles.shareChip}>
                <Text style={styles.shareChipText} maxFontSizeMultiplier={1.15}>
                  {ch}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.25}>
            Members can instantly view the meeting flow, speaker details, role assignments, timing, and embedded
            evaluation forms — all in one link.
          </Text>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Live agenda
          </Text>
          <Text style={styles.subHeading} maxFontSizeMultiplier={1.25}>
            Live updates
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            One of the biggest challenges in Toastmasters is last-minute agenda changes. T360 solves this completely — the
            shared link always reflects the latest version automatically.
          </Text>
          {LIVE_STEPS.map(({ label, body }, i) => (
            <View key={label} style={styles.lifecycleBlock}>
              <View style={styles.lifecycleHead}>
                <View style={styles.lifecycleNum}>
                  <Text style={styles.lifecycleNumText} maxFontSizeMultiplier={1.2}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={styles.lifecycleTitle} maxFontSizeMultiplier={1.25}>
                  {label}
                </Text>
              </View>
              <Text style={styles.lifecycleBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}
          <View style={styles.calloutOk}>
            <Text style={styles.calloutOkText} maxFontSizeMultiplier={1.25}>
              You never need to create a new agenda link, resend the agenda, or inform everyone manually. The agenda
              updates itself.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Why clubs love Agenda Creator
          </Text>
          {BENEFITS.map((line) => (
            <Text key={line} style={styles.checkLine} maxFontSizeMultiplier={1.25}>
              ✔ {line}
            </Text>
          ))}

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
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: '#0369A1',
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
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 13 * FS,
    fontWeight: '600',
    lineHeight: 18 * FS,
    color: N.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
    marginBottom: 8,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  bodyMuted: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
    marginBottom: 10,
    fontWeight: '400',
  },
  bodyStrong: {
    fontWeight: '700',
    color: N.text,
  },
  flowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 16,
  },
  flowChunk: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flowArrow: {
    fontSize: 14 * FS,
    color: N.textSecondary,
    marginRight: 2,
  },
  flowPill: {
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.border,
  },
  flowPillText: {
    fontSize: 13 * FS,
    fontWeight: '600',
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
  miniCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: 'rgba(55, 53, 47, 0.02)',
  },
  miniCardTitle: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 6,
  },
  miniCardBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  partBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  partBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: '#0369A1',
  },
  hideBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(190, 24, 93, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hideBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: '#9D174D',
  },
  showBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  showBadgeText: {
    fontSize: 11 * FS,
    fontWeight: '700',
    color: '#15803D',
  },
  checkLine: {
    fontSize: 15 * FS,
    lineHeight: 24 * FS,
    color: N.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  shareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  shareChip: {
    backgroundColor: 'rgba(55, 53, 47, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: N.border,
    marginRight: 8,
    marginBottom: 8,
  },
  shareChipText: {
    fontSize: 13 * FS,
    fontWeight: '600',
    color: N.text,
  },
  calloutInfo: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  calloutInfoText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  calloutOk: {
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  calloutOkText: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: '#15803D',
    fontWeight: '500',
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
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  lifecycleNumText: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: '#0369A1',
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
    paddingLeft: 0,
  },
});

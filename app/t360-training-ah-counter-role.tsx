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
const VIOLET = '#7C3AED';
const VIOLET_PALE = '#F5F3FF';

const FILLER_WORDS = ['Ah', 'Um', 'You Know', 'So', 'Like', 'Basically', 'Right', 'Okay', 'Actually', 'Uh', 'Literally', 'Sort of'];

const BOOKING_METHODS: { title: string; body: string }[] = [
  {
    title: 'Book it yourself',
    body: 'Click the Book button in the Ah Counter section to assign the role to yourself for that meeting.',
  },
  {
    title: 'Book via Ah Counter Report tab',
    body: 'You can also book the Ah Counter role directly through the Ah Counter Report tab inside the meeting page.',
  },
];

const ACCESS_ROWS: { role: string; access: string; sections: string; full?: boolean }[] = [
  { role: 'VP of Education', access: 'Full access', sections: 'Ah Counter Corner + Summary', full: true },
  { role: 'Assigned Ah Counter', access: 'Full access', sections: 'Ah Counter Corner + Summary', full: true },
  { role: 'All other members', access: 'View only', sections: 'Ah Counter Summary only', full: false },
];

const GUEST_STEPS: { title: string; body: string; tags?: string[] }[] = [
  {
    title: 'Add the visiting guest',
    body: 'Use Visiting Guest Management to add guests attending the meeting but not registered in the app.',
  },
  {
    title: 'Guest appears under meeting attendees',
    body: "Once added, the guest's name is immediately available in all relevant meeting sections.",
    tags: ['Ah Counter', 'Timer', 'Grammarian'],
  },
  {
    title: 'Track and report seamlessly',
    body: 'Guests can be tracked for filler words and assigned speaking roles just like registered members.',
  },
];

const MARKING_FLOW = ['Click filler word', "Click member's name", 'Click Add', 'Auto-added to report'];

const EDIT_ACTIONS = ['Edit entries', 'Delete entries', 'Update counts', 'Modify filler words'];

const PRE_PUBLISH = [
  'Verify all attendees are included — confirm no attending member or guest was left out of the tracking list.',
  'Check counts are accurate — review filler word tallies for each member and correct any over- or under-counts.',
  'Review filler word entries — ensure the correct filler words are assigned to the correct members.',
  'Read through the full summary once more before turning on the visibility toggle to publish.',
];

function BulletList({ items, bulletColor }: { items: string[]; bulletColor?: string }) {
  return (
    <>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <Text style={[styles.bulletMark, bulletColor ? { color: bulletColor } : undefined]} maxFontSizeMultiplier={1.2}>
            ▸
          </Text>
          <Text style={styles.bulletText} maxFontSizeMultiplier={1.25}>
            {item}
          </Text>
        </View>
      ))}
    </>
  );
}

export default function T360TrainingAhCounterRoleScreen() {
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
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.25}>
          The Ah Counter Role
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
              T360 · Knowledge base · Complete role guide
            </Text>
          </View>
          <Text style={styles.docTitle} maxFontSizeMultiplier={1.35}>
            The Ah Counter Role
          </Text>
          <Text style={styles.lead} maxFontSizeMultiplier={1.3}>
            Track filler words, identify speech habits, and help every member become a more fluent and confident
            communicator.
          </Text>

          <View style={styles.chipRow}>
            {FILLER_WORDS.map((word) => (
              <View key={word} style={styles.chip}>
                <Text style={styles.chipText} maxFontSizeMultiplier={1.15}>
                  {word}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Booking the Ah Counter role
          </Text>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Where to find it
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Go to the Home tab, open the live meeting. Under the open meeting section, you will find a dedicated Ah
              Counter space where members can book the role directly.
            </Text>
          </View>
          {BOOKING_METHODS.map(({ title, body }) => (
            <View key={title} style={styles.methodCard}>
              <Text style={styles.methodTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.methodBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
            </View>
          ))}
          <View style={[styles.callout, styles.calloutGreen]}>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Once booked, the assigned member&apos;s name will appear under the Ah Counter role for that meeting.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Ah Counter Corner and access
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once assigned, you will have access to Ah Counter Corner and Ah Counter Summary for tracking and reporting.
          </Text>
          {ACCESS_ROWS.map(({ role, access, sections, full }) => (
            <View key={role} style={styles.accessRow}>
              <Text style={styles.accessRole} maxFontSizeMultiplier={1.25}>
                {role}
              </Text>
              <Text style={[styles.accessBadge, full ? styles.accessFull : styles.accessLimited]} maxFontSizeMultiplier={1.1}>
                {access}
              </Text>
              <Text style={styles.accessSections} maxFontSizeMultiplier={1.2}>
                {sections}
              </Text>
            </View>
          ))}
          <View style={styles.callout}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Role purpose
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              The Ah Counter improves members&apos; communication skills by tracking filler words and speech habits —
              helping speakers become more aware of their verbal patterns.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Manage members
          </Text>
          <View style={[styles.callout, styles.calloutOrange]}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Do this first
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              Ah Counter marking happens quickly during a live meeting. Click Manage Members before starting to exclude
              absent members so only active attendees appear in the tracking section.
            </Text>
          </View>
          <View style={styles.memberSplit}>
            <View style={styles.memberCol}>
              <Text style={styles.memberLabel} maxFontSizeMultiplier={1.1}>
                Total club members
              </Text>
              <Text style={styles.memberNum} maxFontSizeMultiplier={1.3}>
                15
              </Text>
              <Text style={styles.memberCaption} maxFontSizeMultiplier={1.15}>
                registered in the club
              </Text>
            </View>
            <Text style={styles.memberArrow} maxFontSizeMultiplier={1.2}>
              →
            </Text>
            <View style={styles.memberCol}>
              <Text style={styles.memberLabel} maxFontSizeMultiplier={1.1}>
                Meeting attendees
              </Text>
              <Text style={[styles.memberNum, { color: VIOLET }]} maxFontSizeMultiplier={1.3}>
                7
              </Text>
              <Text style={styles.memberCaption} maxFontSizeMultiplier={1.15}>
                selected as present — only these appear in Ah Counter tracking
              </Text>
            </View>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Visiting guest management
          </Text>
          {GUEST_STEPS.map(({ title, body, tags }, i) => (
            <View key={title} style={styles.guestCard}>
              <Text style={styles.guestStep} maxFontSizeMultiplier={1.1}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <Text style={styles.guestTitle} maxFontSizeMultiplier={1.25}>
                {title}
              </Text>
              <Text style={styles.guestBody} maxFontSizeMultiplier={1.25}>
                {body}
              </Text>
              {tags ? (
                <View style={styles.tagRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText} maxFontSizeMultiplier={1.1}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            How to mark filler words
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            The Ah Counter section displays all tracked filler words. Tap to log each occurrence in real time as
            members speak.
          </Text>
          <View style={styles.fillerPanel}>
            <Text style={styles.fillerPanelTitle} maxFontSizeMultiplier={1.15}>
              Filler word list · + Add custom word
            </Text>
            <View style={styles.chipRow}>
              {FILLER_WORDS.slice(0, 6).map((word) => (
                <View key={word} style={[styles.chip, styles.chipDark]}>
                  <Text style={styles.chipTextDark} maxFontSizeMultiplier={1.1}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.flowLabel} maxFontSizeMultiplier={1.1}>
              Marking flow
            </Text>
            <View style={styles.flowRow}>
              {MARKING_FLOW.map((step, i) => (
                <React.Fragment key={step}>
                  <View style={styles.flowStep}>
                    <Text style={styles.flowStepText} maxFontSizeMultiplier={1.1}>
                      {i + 1}. {step}
                    </Text>
                  </View>
                  {i < MARKING_FLOW.length - 1 ? (
                    <Text style={styles.flowArrow} maxFontSizeMultiplier={1.1}>
                      ›
                    </Text>
                  ) : null}
                </React.Fragment>
              ))}
            </View>
          </View>
          <View style={[styles.callout, styles.calloutBlue]}>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              You can add custom filler words to the list at any time if you notice speech habits not covered by the
              default list.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Edit and corrections
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            After adding an entry, you can always edit, delete, or update it — including changing counts or filler words
            — at any point during the meeting.
          </Text>
          <BulletList items={EDIT_ACTIONS} bulletColor={VIOLET} />

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Ah Counter summary report
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            Once the meeting is complete and the report is verified, publish the summary for all members to view. Use
            the eye toggle to show the Ah Counter Summary.
          </Text>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle} maxFontSizeMultiplier={1.25}>
              Purpose of the report
            </Text>
            <Text style={styles.calloutBody} maxFontSizeMultiplier={1.25}>
              The Ah Counter report is a developmental tool — it helps members become more aware of their speaking
              habits and improve fluency over time. It does not affect voting.
            </Text>
          </View>

          <Text style={styles.sectionHeading} maxFontSizeMultiplier={1.3}>
            Before you publish
          </Text>
          <BulletList items={PRE_PUBLISH} bulletColor={VIOLET} />
          <View style={styles.finalNote}>
            <Text style={styles.finalNoteTitle} maxFontSizeMultiplier={1.25}>
              Ready to publish
            </Text>
            <Text style={styles.finalNoteBody} maxFontSizeMultiplier={1.25}>
              Turn ON Show Ah Counter Report to Member using the eye button. Members will immediately see their filler
              word counts and speech habit patterns in the Ah Counter Summary.
            </Text>
          </View>
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
    fontSize: 18 * FS,
    fontWeight: '700',
  },
  headerSpacer: { width: 36, height: 36 },
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
    backgroundColor: VIOLET_PALE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  kbBadgeText: {
    fontSize: 12 * FS,
    fontWeight: '600',
    color: VIOLET,
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
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: VIOLET_PALE,
  },
  chipText: {
    fontSize: 11 * FS,
    color: VIOLET,
    fontWeight: '500',
  },
  chipDark: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  chipTextDark: {
    fontSize: 11 * FS,
    color: '#EDE9FE',
    fontWeight: '500',
  },
  sectionHeading: {
    fontSize: 16 * FS,
    fontWeight: '700',
    color: N.text,
    marginTop: 8,
    marginBottom: 12,
  },
  body: {
    fontSize: 15 * FS,
    lineHeight: 23 * FS,
    color: N.text,
    marginBottom: 12,
  },
  callout: {
    backgroundColor: VIOLET_PALE,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  calloutGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  calloutOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  calloutBlue: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  calloutTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  calloutBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
  methodCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  methodTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  methodBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  accessRow: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  accessRole: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  accessBadge: {
    alignSelf: 'flex-start',
    fontSize: 11 * FS,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 4,
  },
  accessFull: {
    backgroundColor: VIOLET_PALE,
    color: VIOLET,
  },
  accessLimited: {
    backgroundColor: '#F0F9FF',
    color: '#0369A1',
  },
  accessSections: {
    fontSize: 13 * FS,
    color: N.textSecondary,
  },
  memberSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  memberCol: {
    flex: 1,
    padding: 14,
    backgroundColor: N.surface,
  },
  memberArrow: {
    paddingHorizontal: 8,
    color: VIOLET,
    fontSize: 16 * FS,
    backgroundColor: VIOLET_PALE,
  },
  memberLabel: {
    fontSize: 10 * FS,
    fontWeight: '600',
    color: N.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  memberNum: {
    fontSize: 28 * FS,
    fontWeight: '800',
    color: N.text,
    marginBottom: 4,
  },
  memberCaption: {
    fontSize: 12 * FS,
    lineHeight: 17 * FS,
    color: N.textSecondary,
  },
  guestCard: {
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: VIOLET,
  },
  guestStep: {
    fontSize: 10 * FS,
    fontWeight: '700',
    color: VIOLET,
    marginBottom: 4,
  },
  guestTitle: {
    fontSize: 14 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 4,
  },
  guestBody: {
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tag: {
    backgroundColor: VIOLET_PALE,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11 * FS,
    color: VIOLET,
    fontWeight: '500',
  },
  fillerPanel: {
    backgroundColor: '#1A1423',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  fillerPanelTitle: {
    fontSize: 11 * FS,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  flowLabel: {
    fontSize: 10 * FS,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  flowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  flowStep: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  flowStepText: {
    fontSize: 11 * FS,
    color: 'rgba(255,255,255,0.7)',
  },
  flowArrow: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12 * FS,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletMark: {
    fontSize: 12 * FS,
    color: VIOLET,
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13 * FS,
    lineHeight: 19 * FS,
    color: N.textSecondary,
  },
  finalNote: {
    backgroundColor: 'rgba(26, 20, 35, 0.06)',
    borderWidth: 1,
    borderColor: N.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  finalNoteTitle: {
    fontSize: 15 * FS,
    fontWeight: '700',
    color: N.text,
    marginBottom: 6,
  },
  finalNoteBody: {
    fontSize: 14 * FS,
    lineHeight: 21 * FS,
    color: N.textSecondary,
  },
});

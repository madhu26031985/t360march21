import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { sectionItems, type T360ClubOnboardingProgress } from '@/lib/t360ClubOnboarding';

const N = {
  page: '#FBFBFA',
  surface: '#FFFFFF',
  border: 'rgba(55, 53, 47, 0.09)',
  borderStrong: 'rgba(55, 53, 47, 0.16)',
  text: '#37352F',
  textSecondary: '#787774',
  textTertiary: 'rgba(55, 53, 47, 0.45)',
  accent: '#2383E2',
  accentSoft: 'rgba(35, 131, 226, 0.1)',
  accentSoftBorder: 'rgba(35, 131, 226, 0.28)',
  success: '#0F7B6C',
  successSoft: 'rgba(15, 123, 108, 0.12)',
};

type Props = {
  progress: T360ClubOnboardingProgress;
  loading?: boolean;
};

export default function T360ClubOnboardingBox({ progress, loading }: Props) {
  const [listExpanded, setListExpanded] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    create_club: true,
    setting_up: true,
    user_management: false,
    manage_club_excomm: false,
    meeting_management: false,
    meeting_agenda: false,
    voting_operations: false,
  });

  const sectionStats = useMemo(
    () =>
      progress.sections.map((section) => {
        const items = sectionItems(section);
        const tasksDone = items.filter((i) => i.done).length;
        const tasksTotal = items.length;
        const percent =
          tasksTotal === 0 ? 0 : Math.round((tasksDone / tasksTotal) * 100);
        return { tasksDone, tasksTotal, percent };
      }),
    [progress.sections]
  );

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={[styles.card, { backgroundColor: N.page, borderColor: N.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: N.accentSoft, borderColor: N.accentSoftBorder }]}>
          <Text style={[styles.badgeText, { color: N.accent }]} maxFontSizeMultiplier={1.2}>
            {progress.percent}%
          </Text>
        </View>
        <View style={styles.headerTextCol}>
          <Text style={[styles.title, { color: N.text }]} maxFontSizeMultiplier={1.2}>
            T360 onboarding
          </Text>
          <Text style={[styles.subtitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
            {loading
              ? 'Loading progress…'
              : `${progress.completedCount} of ${progress.totalCount} tasks complete`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.toggleButton, { backgroundColor: N.surface, borderColor: N.borderStrong }]}
            onPress={() => setListExpanded((open) => !open)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={listExpanded ? 'Close onboarding checklist' : 'Open onboarding checklist'}
          >
            <Text style={[styles.toggleButtonText, { color: N.text }]} maxFontSizeMultiplier={1.15}>
              {listExpanded ? 'Close' : 'Open'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.guideButton, { backgroundColor: N.accentSoft, borderColor: N.accentSoftBorder }]}
            onPress={() => router.push('/t360-training')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open T360 User Guide onboarding guide"
          >
            <Text style={[styles.guideButtonText, { color: N.accent }]} maxFontSizeMultiplier={1.15}>
              Onboarding guide
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: N.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: progress.isComplete ? N.success : N.accent,
              width: `${Math.min(100, progress.percent)}%`,
            },
          ]}
        />
      </View>

      {listExpanded
        ? progress.sections.map((section, sectionIndex) => {
        const { tasksDone, tasksTotal, percent } = sectionStats[sectionIndex];
        const isOpen = expanded[section.id] ?? false;
        const sectionComplete = tasksDone === tasksTotal && tasksTotal > 0;

        return (
          <View key={section.id} style={[styles.sectionBlock, { borderTopColor: N.border }]}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection(section.id)}
              activeOpacity={0.7}
            >
              {isOpen ? (
                <ChevronDown size={16} color={N.textTertiary} strokeWidth={2} />
              ) : (
                <ChevronRight size={16} color={N.textTertiary} strokeWidth={2} />
              )}
              <Text
                style={[
                  styles.sectionTitle,
                  { color: sectionComplete ? N.success : N.text },
                ]}
                maxFontSizeMultiplier={1.2}
              >
                {section.title}
              </Text>
              <View style={styles.sectionCountWrap}>
                <Text
                  style={[
                    styles.sectionCount,
                    { color: sectionComplete ? N.success : N.textTertiary },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {tasksDone}/{tasksTotal}
                </Text>
                <Text
                  style={[
                    styles.sectionPercent,
                    { color: sectionComplete ? N.success : N.textTertiary },
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {percent}%
                </Text>
              </View>
            </TouchableOpacity>

            {isOpen
              ? (section.groups?.length
                  ? section.groups.map((group) => (
                      <View key={group.id} style={styles.groupBlock}>
                        <Text style={[styles.groupTitle, { color: N.textSecondary }]} maxFontSizeMultiplier={1.2}>
                          {group.title}
                        </Text>
                        {group.items.map((item) => (
                          <View key={item.id} style={styles.itemRow}>
                            <View
                              style={[
                                styles.check,
                                item.done
                                  ? { backgroundColor: N.success }
                                  : {
                                      backgroundColor: N.surface,
                                      borderWidth: 1,
                                      borderColor: N.borderStrong,
                                    },
                              ]}
                            >
                              <Text
                                style={[styles.checkText, { color: item.done ? N.surface : N.textTertiary }]}
                                maxFontSizeMultiplier={1.2}
                              >
                                {item.done ? '✓' : ''}
                              </Text>
                            </View>
                            <Text
                              style={[styles.itemLabel, { color: item.done ? N.success : N.text }]}
                              maxFontSizeMultiplier={1.2}
                            >
                              {item.label}{' '}
                              <Text style={[styles.itemProgress, { color: N.textTertiary }]}>
                                ({item.fieldsDone}/{item.fieldsTotal})
                              </Text>
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  : section.items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <View
                          style={[
                            styles.check,
                            item.done
                              ? { backgroundColor: N.success }
                              : { backgroundColor: N.surface, borderWidth: 1, borderColor: N.borderStrong },
                          ]}
                        >
                          <Text
                            style={[styles.checkText, { color: item.done ? N.surface : N.textTertiary }]}
                            maxFontSizeMultiplier={1.2}
                          >
                            {item.done ? '✓' : ''}
                          </Text>
                        </View>
                        <Text
                          style={[styles.itemLabel, { color: item.done ? N.success : N.text }]}
                          maxFontSizeMultiplier={1.2}
                        >
                          {item.label}{' '}
                          <Text style={[styles.itemProgress, { color: N.textTertiary }]}>
                            ({item.fieldsDone}/{item.fieldsTotal})
                          </Text>
                        </Text>
                      </View>
                    )))
              : null}
          </View>
        );
        })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flexShrink: 0,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  guideButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  guideButtonText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  badge: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 0,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionBlock: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  groupBlock: {
    marginTop: 4,
    marginBottom: 4,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.02,
    marginBottom: 4,
    paddingLeft: 24,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  sectionCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 24,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
    fontWeight: '500',
  },
  itemProgress: {
    fontWeight: '400',
  },
});

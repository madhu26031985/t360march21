import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { categorizeMeetingTabs, type MeetingFlowTab } from '@/lib/meetingTabsCatalog';
import {
  ClipboardList,
  Star,
  MessageSquareQuote,
  Search,
  UserPlus,
  ChevronRight,
} from 'lucide-react-native';

export function MeetingEvaluationTabPanel({
  meetingId,
  onTabPress,
}: {
  meetingId: string;
  onTabPress: (tab: MeetingFlowTab) => void;
}) {
  const { theme } = useTheme();
  const { evaluation, feedbackReports } = categorizeMeetingTabs(meetingId);
  const feedbackItems = [feedbackReports[0], feedbackReports[1], feedbackReports[2]].filter(Boolean) as MeetingFlowTab[];

  if (evaluation.length === 0 && feedbackItems.length === 0) {
    return (
      <View style={[styles.emptyTabState, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.emptyTabText, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.3}>
          Evaluation features coming soon
        </Text>
      </View>
    );
  }

  const descriptions: Record<string, string> = {
    prepared_speech_evaluation: 'Evaluate prepared speeches',
    master_evaluation: 'Master-level meeting evaluation',
    table_topics_evaluation: 'Evaluate table topics responses',
    feedback_corner: 'Share your meeting experience',
    member_feedback: 'Submit member feedback',
    guest_feedback: 'Collect feedback from guests',
  };

  const renderKeyRoleCard = (tab: MeetingFlowTab) => (
    <TouchableOpacity
      key={tab.id}
      style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => onTabPress(tab)}
      activeOpacity={0.7}
      disabled={!!tab.comingSoon}
    >
      <View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }]}>
        {tab.id === 'prepared_speech_evaluation' && <ClipboardList size={20} color={tab.color} />}
        {tab.id === 'master_evaluation' && <Star size={20} color={tab.color} />}
        {tab.id === 'table_topics_evaluation' && <MessageSquareQuote size={20} color={tab.color} />}
        {tab.id === 'feedback_corner' && <Search size={20} color={tab.color} />}
        {tab.id === 'member_feedback' && <Star size={20} color={tab.color} />}
        {tab.id === 'guest_feedback' && <UserPlus size={20} color={tab.color} />}
      </View>
      <View style={styles.keyRoleContent}>
        <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {tab.title}
        </Text>
        <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
          {descriptions[tab.id] || ''}
        </Text>
      </View>
      {!tab.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
      {tab.comingSoon && (
        <View style={styles.actionComingSoonBadge}>
          <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>
            Coming Soon
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.rolesTabContainer}>
      {evaluation.length > 0 && (
        <View style={styles.rolesSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Evaluation
          </Text>
          <View style={styles.keyRolesList}>{evaluation.map(renderKeyRoleCard)}</View>
        </View>
      )}
      {feedbackItems.length > 0 && (
        <View style={styles.rolesSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Feedback
          </Text>
          <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.keyRolesList}>{feedbackItems.map(renderKeyRoleCard)}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rolesTabContainer: {
    paddingBottom: 8,
  },
  rolesSection: {
    marginBottom: 20,
  },
  rolesSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  rolesSectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  keyRolesList: {
    gap: 10,
  },
  keyRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyRoleIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  keyRoleContent: {
    flex: 1,
  },
  keyRoleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  keyRoleSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
  emptyTabState: {
    padding: 24,
    borderRadius: 0,
    alignItems: 'center',
  },
  emptyTabText: {
    fontSize: 12,
  },
  actionComingSoonBadge: {
    marginTop: 4,
  },
  actionComingSoonText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#f59e0b',
  },
});

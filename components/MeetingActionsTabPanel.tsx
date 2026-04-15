import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { categorizeMeetingTabs, type MeetingFlowTab } from '@/lib/meetingTabsCatalog';
import { BookRoleCoreCard } from '@/components/BookRoleCoreCard';
import {
  Calendar,
  FileText,
  ChartBar as BarChart3,
  ClipboardCheck,
  ChevronRight,
  CheckCircle,
  RefreshCw,
  MonitorCheck,
  Search,
  Star,
  ScrollText,
  ClipboardList,
} from 'lucide-react-native';

function renderActionCard(
  tab: MeetingFlowTab,
  onPress: () => void,
  theme: ReturnType<typeof useTheme>['theme'],
  fullWidth?: boolean
) {
  return (
    <TouchableOpacity
      key={tab.id}
      style={[
        fullWidth ? styles.actionCardFull : styles.actionCardHalf,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!!tab.comingSoon}
    >
      <View style={[styles.actionCardIcon, { backgroundColor: tab.color + '25' }]}>
        {tab.id === 'book_role' && <Calendar size={20} color={tab.color} />}
        {tab.id === 'overview' && <RefreshCw size={20} color={tab.color} />}
        {tab.id === 'agenda' && <MonitorCheck size={20} color={tab.color} />}
        {tab.id === 'live_voting' && <CheckCircle size={20} color={tab.color} />}
        {tab.id === 'role_completion' && <ClipboardCheck size={20} color={tab.color} />}
        {tab.id === 'attendance' && <BarChart3 size={20} color={tab.color} />}
        {tab.id === 'feedback_corner' && <Search size={20} color={tab.color} />}
        {tab.id === 'member_feedback' && <Star size={20} color={tab.color} />}
        {tab.id === 'meeting_minutes' && <ScrollText size={20} color={tab.color} />}
        {!['book_role', 'overview', 'agenda', 'live_voting', 'role_completion', 'attendance', 'feedback_corner', 'member_feedback', 'meeting_minutes'].includes(tab.id) && (
          <FileText size={20} color={tab.color} />
        )}
      </View>
      <View style={styles.actionCardContent}>
        <Text style={[styles.actionCardTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
          {tab.title}
        </Text>
        {tab.comingSoon && (
          <View style={styles.actionComingSoonBadge}>
            <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>
              Coming Soon
            </Text>
          </View>
        )}
      </View>
      {!tab.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
    </TouchableOpacity>
  );
}

export function MeetingActionsTabPanel({
  meetingId,
  onTabPress,
  onOpenClubReports,
  bookRoleShowAttention = false,
  disableBookRole = false,
}: {
  meetingId: string;
  onTabPress: (tab: MeetingFlowTab) => void;
  onOpenClubReports: () => void;
  bookRoleShowAttention?: boolean;
  disableBookRole?: boolean;
}) {
  const { theme } = useTheme();
  const { core, operations, feedbackReports, others } = categorizeMeetingTabs(meetingId);
  const meetingMinutes = feedbackReports[3];

  return (
    <View style={styles.actionsTabContainer}>
      {core.length > 0 && (
        <View style={styles.actionsSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Core
          </Text>
          <View style={styles.keyRolesList}>
            {core.map((tab) => {
              const descriptions: Record<string, string> = {
                book_role: 'Book roles for this meeting',
                overview: 'View meeting overview and status',
                agenda: 'View and manage meeting agenda',
              };
              const description = descriptions[tab.id] || '';
              if (tab.id === 'book_role') {
                return (
                  <BookRoleCoreCard
                    key={tab.id}
                    tab={tab}
                    description={description}
                    showAttention={!disableBookRole && bookRoleShowAttention}
                    disabled={disableBookRole}
                    onPress={() => {
                      if (!disableBookRole) onTabPress(tab);
                    }}
                  />
                );
              }
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                  onPress={() => onTabPress(tab)}
                  activeOpacity={0.7}
                  disabled={!!tab.comingSoon}
                >
                  <View style={[styles.keyRoleIcon, { backgroundColor: tab.color + '25' }]}>
                    {tab.id === 'overview' && <RefreshCw size={20} color={tab.color} />}
                    {tab.id === 'agenda' && <MonitorCheck size={20} color={tab.color} />}
                  </View>
                  <View style={styles.keyRoleContent}>
                    <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                      {tab.title}
                    </Text>
                    {description ? (
                      <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                        {description}
                      </Text>
                    ) : null}
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
            })}
          </View>
        </View>
      )}

      {(operations[0] || operations[1] || operations[2]) && (
        <View style={styles.actionsSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Operations
          </Text>
          <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.speakingRolesGrid}>
            {operations.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.speakingRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                onPress={() => onTabPress(tab)}
                activeOpacity={0.7}
              >
                <View style={[styles.speakingRoleIcon, { backgroundColor: tab.color + '25' }]}>
                  {tab.id === 'live_voting' && <CheckCircle size={22} color={tab.color} />}
                  {tab.id === 'role_completion' && <ClipboardCheck size={22} color={tab.color} />}
                  {tab.id === 'attendance' && <BarChart3 size={22} color={tab.color} />}
                </View>
                <Text style={[styles.speakingRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {meetingMinutes && (
        <View style={styles.actionsSection}>
          <Text style={[styles.rolesSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Closing and reports
          </Text>
          <View style={[styles.rolesSectionDivider, { backgroundColor: theme.colors.border }]} />
          <View style={styles.keyRolesList}>
            <TouchableOpacity
              key={meetingMinutes.id}
              style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={() => onTabPress(meetingMinutes)}
              activeOpacity={0.7}
              disabled={!!meetingMinutes.comingSoon}
            >
              <View style={[styles.keyRoleIcon, { backgroundColor: (meetingMinutes.color || '#6b7280') + '25' }]}>
                <ScrollText size={20} color={meetingMinutes.color || '#6b7280'} />
              </View>
              <View style={styles.keyRoleContent}>
                <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  {meetingMinutes.title}
                </Text>
                <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  Record and review meeting minutes
                </Text>
              </View>
              {!meetingMinutes.comingSoon && <ChevronRight size={20} color={theme.colors.textSecondary} />}
              {meetingMinutes.comingSoon && (
                <View style={styles.actionComingSoonBadge}>
                  <Text style={styles.actionComingSoonText} maxFontSizeMultiplier={1.2}>
                    Coming Soon
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.keyRoleCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              onPress={onOpenClubReports}
              activeOpacity={0.7}
            >
              <View style={[styles.keyRoleIcon, { backgroundColor: '#3b82f625' }]}>
                <ClipboardList size={20} color="#3b82f6" />
              </View>
              <View style={styles.keyRoleContent}>
                <Text style={[styles.keyRoleTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
                  Club reports
                </Text>
                <Text style={[styles.keyRoleSubtitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
                  View member, roles, and attendance reports
                </Text>
              </View>
              <ChevronRight size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {others.length > 0 && (
        <View style={styles.actionsSection}>
          <Text style={[styles.actionsSectionTitle, { color: theme.colors.text }]} maxFontSizeMultiplier={1.3}>
            Others
          </Text>
          <View style={styles.actionsCardsRow}>
            {others.map((tab) => renderActionCard(tab, () => onTabPress(tab), theme, false))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsTabContainer: {
    paddingBottom: 8,
  },
  actionsSection: {
    marginBottom: 20,
  },
  actionsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  speakingRolesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  speakingRoleCard: {
    width: '30%',
    minWidth: 0,
    padding: 12,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    position: 'relative',
  },
  speakingRoleIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  speakingRoleTitle: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionsCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  actionCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardHalf: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '600',
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

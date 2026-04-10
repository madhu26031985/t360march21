import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  ChevronRight,
  UserCircle,
  Shield,
  Mic,
  MessageSquare,
  BookOpen,
  Clock,
  GraduationCap,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Users,
  TrendingUp,
} from 'lucide-react-native';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

export type ClubReportsTheme = {
  colors: { text: string; textSecondary: string; border: string };
};

interface ReportRowProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  theme: ClubReportsTheme;
}

function ReportRow({ title, icon, color, onPress, theme }: ReportRowProps) {
  return (
    <TouchableOpacity style={styles.reportsRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.reportsRowIcon, { backgroundColor: color + '20' }]}>{icon}</View>
      <Text style={[styles.reportsRowLabel, { color: theme.colors.text }]} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
}

type ClubReportsListProps = {
  theme: ClubReportsTheme;
  onReportPress: (path: string) => void;
  onSectionLayout?: (y: number) => void;
};

export function ClubReportsList({ theme, onReportPress, onSectionLayout }: ClubReportsListProps) {
  return (
    <View
      onLayout={(e) => {
        onSectionLayout?.(e.nativeEvent.layout.y);
      }}
    >
      <Text style={[styles.reportsSectionTitle, { color: theme.colors.textSecondary }]} maxFontSizeMultiplier={1.2}>
        Reports
      </Text>
      <ReportRow
        title="Member Report"
        icon={<UserCircle size={20} color="#14b8a6" />}
        color="#14b8a6"
        onPress={() => onReportPress('/admin/excomm-corner/reports/member-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Roles Report"
        icon={<Shield size={20} color={EXCOMM_UI.solidBg} />}
        color={EXCOMM_UI.solidBg}
        onPress={() => onReportPress('/admin/excomm-corner/reports/role-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="TMOD Report"
        icon={<Mic size={20} color="#6366f1" />}
        color="#6366f1"
        onPress={() => onReportPress('/admin/excomm-corner/reports/tmod-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Prepared Speeches"
        icon={<MessageSquare size={20} color="#10b981" />}
        color="#10b981"
        onPress={() => onReportPress('/admin/excomm-corner/reports/prepared-speech-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Grammarian"
        icon={<BookOpen size={20} color="#f59e0b" />}
        color="#f59e0b"
        onPress={() => onReportPress('/admin/excomm-corner/reports/grammarian-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Timer"
        icon={<Clock size={20} color="#f59e0b" />}
        color="#f59e0b"
        onPress={() => onReportPress('/admin/excomm-corner/reports/timer-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Educational"
        icon={<GraduationCap size={20} color="#f97316" />}
        color="#f97316"
        onPress={() => onReportPress('/admin/excomm-corner/reports/educational-speaker-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="General Evaluator"
        icon={<UserCheck size={20} color="#ec4899" />}
        color="#ec4899"
        onPress={() => onReportPress('/admin/excomm-corner/reports/ge-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Ah Counter"
        icon={<AlertCircle size={20} color="#ef4444" />}
        color="#ef4444"
        onPress={() => onReportPress('/admin/excomm-corner/reports/ah-counter-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Table Topics"
        icon={<HelpCircle size={20} color="#0ea5e9" />}
        color="#0ea5e9"
        onPress={() => onReportPress('/admin/excomm-corner/reports/table-topics-questioner-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Attendance"
        icon={<Users size={20} color="#06b6d4" />}
        color="#06b6d4"
        onPress={() => onReportPress('/admin/excomm-corner/reports/attendance-report')}
        theme={theme}
      />
      <View style={[styles.reportsRowDivider, { backgroundColor: theme.colors.border }]} />
      <ReportRow
        title="Pathways"
        icon={<TrendingUp size={20} color="#84cc16" />}
        color="#84cc16"
        onPress={() => onReportPress('/admin/excomm-corner/vpe/pathway-reports')}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  reportsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  reportsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  reportsRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportsRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  reportsRowDivider: {
    height: 1,
  },
});

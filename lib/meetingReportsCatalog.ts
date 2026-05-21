import type { LucideIcon } from 'lucide-react-native';
import {
  UserCircle,
  Shield,
  Mic,
  BookOpen,
  Clock,
  GraduationCap,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Users,
} from 'lucide-react-native';
import { EXCOMM_UI } from '@/lib/excommUiTokens';

export type MeetingReportItem = {
  id: string;
  title: string;
  description: string;
  path: string;
  color: string;
  Icon: LucideIcon;
};

export type MeetingReportCategory = {
  id: string;
  title: string;
  reports: MeetingReportItem[];
};

export const MEETING_REPORT_CATEGORIES: MeetingReportCategory[] = [
  {
    id: 'club',
    title: 'Club reports',
    reports: [
      {
        id: 'attendance',
        title: 'Attendance Report',
        description: 'Track attendance and member presence.',
        path: '/admin/excomm-corner/reports/attendance-report',
        color: '#06b6d4',
        Icon: Users,
      },
      {
        id: 'member',
        title: 'Member Report',
        description: 'View member details, activity and participation.',
        path: '/admin/excomm-corner/reports/member-report',
        color: '#14b8a6',
        Icon: UserCircle,
      },
      {
        id: 'roles',
        title: 'Roles Report',
        description: 'Analyze role assignments and performance.',
        path: '/admin/excomm-corner/reports/role-report',
        color: EXCOMM_UI.solidBg,
        Icon: Shield,
      },
    ],
  },
  {
    id: 'leadership',
    title: 'Leadership role reports',
    reports: [
      {
        id: 'tmod',
        title: 'TMOD Report',
        description: 'Track Toastmaster of the Day activities and feedback.',
        path: '/admin/excomm-corner/reports/tmod-report',
        color: '#6366f1',
        Icon: Mic,
      },
      {
        id: 'table_topics',
        title: 'Table Topics Report',
        description: 'View Table Topics performance and participation.',
        path: '/admin/excomm-corner/reports/table-topics-questioner-report',
        color: '#0ea5e9',
        Icon: HelpCircle,
      },
      {
        id: 'ge',
        title: 'General Evaluator Report',
        description: 'Evaluate overall meeting performance.',
        path: '/admin/excomm-corner/reports/ge-report',
        color: '#ec4899',
        Icon: UserCheck,
      },
      {
        id: 'educational',
        title: 'Educational Speaker Report',
        description: 'Track educational speaker sessions and feedback.',
        path: '/admin/excomm-corner/reports/educational-speaker-report',
        color: '#f97316',
        Icon: GraduationCap,
      },
    ],
  },
  {
    id: 'tag_team',
    title: 'Tag Team Reports',
    reports: [
      {
        id: 'timer',
        title: 'Timer Report',
        description: 'Review timing reports and speech durations.',
        path: '/admin/excomm-corner/reports/timer-report',
        color: '#f59e0b',
        Icon: Clock,
      },
      {
        id: 'ah',
        title: 'Ah Counter Report',
        description: 'Monitor filler words and speech quality.',
        path: '/admin/excomm-corner/reports/ah-counter-report',
        color: '#ef4444',
        Icon: AlertCircle,
      },
      {
        id: 'grammarian',
        title: 'Grammarian Report',
        description: 'Check grammar feedback and evaluations.',
        path: '/admin/excomm-corner/reports/grammarian-report',
        color: '#f59e0b',
        Icon: BookOpen,
      },
    ],
  },
];

export const ALL_MEETING_REPORTS = MEETING_REPORT_CATEGORIES.flatMap((c) => c.reports);

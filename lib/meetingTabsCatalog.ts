/**
 * Route-only meeting tab definitions (no React icons), shared by Journey Meetings
 * and Completed Meeting records so Actions / Evaluation / Roles stay aligned.
 */
export type MeetingFlowTab = {
  id: string;
  title: string;
  color: string;
  route?: string;
  comingSoon?: boolean;
};

const BUCKET_IDS = new Set([
  'book_role',
  'overview',
  'agenda',
  'live_voting',
  'role_completion',
  'attendance',
  'feedback_corner',
  'member_feedback',
  'guest_feedback',
  'meeting_minutes',
  'toastmaster_corner',
  'general_evaluator',
  'table_topic_corner',
  'evaluation_corner',
  'educational_corner',
  'keynote_speaker',
  'timer',
  'grammarian',
  'listener',
  'ah_counter',
  'quiz_master',
  'prepared_speech_evaluation',
  'master_evaluation',
  'table_topics_evaluation',
  'guest_introduce',
]);

export function getMeetingTabsCatalog(meetingId: string): MeetingFlowTab[] {
  const m = meetingId;
  return [
    { id: 'book_role', title: 'Book a Role', color: '#0a66c2' },
    { id: 'overview', title: 'Quick Overview', color: '#3b82f6' },
    {
      id: 'agenda',
      title: 'Meeting Agenda',
      color: '#10b981',
      route: `/meeting-agenda-view?meetingId=${m}`,
    },
    {
      id: 'toastmaster_corner',
      title: 'Toastmaster of the day',
      color: '#84cc16',
      route: `/toastmaster-corner?meetingId=${m}`,
    },
    {
      id: 'general_evaluator',
      title: 'General Evaluator',
      color: '#ef4444',
      route: `/general-evaluator-report?meetingId=${m}`,
    },
    {
      id: 'table_topic_corner',
      title: 'Table Topic Corner',
      color: '#f97316',
      route: `/table-topic-corner?meetingId=${m}`,
    },
    {
      id: 'timer',
      title: 'Timer',
      color: '#f59e0b',
      route: `/timer-report-details?meetingId=${m}`,
    },
    {
      id: 'ah_counter',
      title: 'Ah Counter',
      color: '#06b6d4',
      route: `/ah-counter-corner?meetingId=${m}`,
    },
    {
      id: 'grammarian',
      title: 'Grammarian',
      color: '#8b5cf6',
      route: `/grammarian?meetingId=${m}`,
    },
    {
      id: 'evaluation_corner',
      title: 'Prepared Speeches',
      color: '#14b8a6',
      route: `/evaluation-corner?meetingId=${m}`,
    },
    {
      id: 'educational_corner',
      title: 'Educational Corner',
      color: '#f97316',
      route: `/educational-corner?meetingId=${m}`,
    },
    {
      id: 'keynote_speaker',
      title: 'Keynote Speaker',
      color: '#f59e0b',
      route: `/keynote-speaker-corner?meetingId=${m}`,
    },
    {
      id: 'prepared_speech_evaluation',
      title: 'Speech Evaluation',
      color: '#ef4444',
      route: `/prepared-speech-evaluations?meetingId=${m}`,
      comingSoon: true,
    },
    { id: 'live_voting', title: 'Live Voting', color: '#8b5cf6' },
    {
      id: 'role_completion',
      title: 'Role Completion',
      color: '#6366f1',
      route: `/role-completion-report?meetingId=${m}`,
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      color: '#ec4899',
      route: `/attendance-report?meetingId=${m}`,
    },
    {
      id: 'feedback_corner',
      title: 'Meeting Feedback',
      color: '#a855f7',
      route: `/feedback-corner?meetingId=${m}`,
    },
    {
      id: 'quiz_master',
      title: 'Quiz Master',
      color: '#8b5cf6',
      comingSoon: true,
    },
    {
      id: 'listener',
      title: 'Listener',
      color: '#06b6d4',
      comingSoon: true,
    },
    {
      id: 'guest_introduce',
      title: 'Guest Introduce',
      color: '#10b981',
      comingSoon: true,
    },
    {
      id: 'table_topics_evaluation',
      title: 'Table Topics Evaluation',
      color: '#f97316',
      comingSoon: true,
    },
    {
      id: 'master_evaluation',
      title: 'Master Evaluation',
      color: '#fbbf24',
      comingSoon: true,
    },
    {
      id: 'member_feedback',
      title: 'Member Feedback',
      color: '#ec4899',
      comingSoon: true,
    },
    {
      id: 'guest_feedback',
      title: 'Guest Feedback',
      color: '#14b8a6',
      comingSoon: true,
    },
    {
      id: 'meeting_minutes',
      title: 'Meeting Minutes',
      color: '#3b82f6',
      comingSoon: true,
    },
  ];
}

export function categorizeMeetingTabs(meetingId: string) {
  const allTabs = getMeetingTabsCatalog(meetingId);
  const byId = new Map(allTabs.map((t) => [t.id, t]));
  const take = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as MeetingFlowTab[];
  return {
    core: take(['book_role', 'overview', 'agenda']),
    operations: take(['live_voting', 'role_completion', 'attendance']),
    feedbackReports: take(['feedback_corner', 'member_feedback', 'guest_feedback', 'meeting_minutes']),
    keyRoles: take(['toastmaster_corner', 'general_evaluator', 'table_topic_corner']),
    speakingRoles: take(['evaluation_corner', 'educational_corner', 'keynote_speaker']),
    supportRoles: take(['timer', 'ah_counter', 'grammarian', 'listener', 'quiz_master']),
    evaluation: take(['prepared_speech_evaluation', 'master_evaluation', 'table_topics_evaluation']),
    others: allTabs.filter((t) => !BUCKET_IDS.has(t.id)),
  };
}

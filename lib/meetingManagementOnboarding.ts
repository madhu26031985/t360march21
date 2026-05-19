import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';

export type MeetingRoleRow = {
  role_name: string;
  booking_status?: string | null;
  assigned_user_id?: string | null;
  role_status?: string | null;
  booked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  speech_title?: string | null;
};

export type MeetingRow = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MeetingManagementOnboardingInput = {
  meetings: MeetingRow[];
  roles: MeetingRoleRow[];
  /** Set when ExComm manually moves a role to Deleted in Manage Meeting Roles. */
  roleManuallyMovedToDeleted: boolean;
  /** Set when ExComm restores a role from Deleted to Available. */
  roleManuallyMovedToAvailable: boolean;
  timerReportCount: number;
  grammarianReportPublished: boolean;
  ahCounterReportCount: number;
  toastmasterThemeUpdated: boolean;
  preparedSpeechDetailsUpdated: boolean;
  wordOfTheDayUpdated: boolean;
  tableTopicsQuestionsUpdated: boolean;
};

export type MeetingManagementOnboardingProgress = Record<
  | 'oneMeetingCreated'
  | 'twoAdditionalMeetingsPlanned'
  | 'editMeetingUsedOnce'
  | 'excommAssignedRole'
  | 'excommReassignedRole'
  | 'roleMovedToDeleted'
  | 'roleMovedToAvailable'
  | 'fiveRolesFiveMembers'
  | 'bookRoleUsedFiveTimes'
  | 'toastmasterBooked'
  | 'preparedSpeakerBooked'
  | 'evaluatorBooked'
  | 'generalEvaluatorBooked'
  | 'tableTopicsMasterBooked'
  | 'tableTopicsSpeakerBooked'
  | 'timerBooked'
  | 'timerReportCaptured'
  | 'grammarianBooked'
  | 'grammarianReportPublished'
  | 'ahCounterBooked'
  | 'ahCounterReportCaptured'
  | 'toastmasterCornerThemeUpdated'
  | 'preparedSpeechDetailsUpdated'
  | 'wordOfTheDayUpdated'
  | 'tableTopicsQuestionsUpdated',
  FieldProgress
>;

function msBetween(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

function roleNameNorm(name: string): string {
  return name.trim().toLowerCase();
}

function isBookedRole(row: MeetingRoleRow): boolean {
  return (
    row.booking_status === 'booked' &&
    Boolean(row.assigned_user_id) &&
    (row.role_status ?? 'Available') !== 'Deleted'
  );
}

function hasBookedRole(roles: MeetingRoleRow[], match: (name: string) => boolean): boolean {
  return roles.some((r) => isBookedRole(r) && match(roleNameNorm(r.role_name)));
}

function countBookedRoles(roles: MeetingRoleRow[]): number {
  return roles.filter(isBookedRole).length;
}

function countDistinctBookedMembers(roles: MeetingRoleRow[]): number {
  return new Set(roles.filter(isBookedRole).map((r) => r.assigned_user_id)).size;
}

export function computeMeetingManagementOnboarding(
  input: MeetingManagementOnboardingInput
): MeetingManagementOnboardingProgress {
  const { meetings, roles } = input;
  const meetingCount = meetings.length;
  const additionalPlanned = Math.max(0, meetingCount - 1);
  const bookedCount = countBookedRoles(roles);
  const distinctBooked = countDistinctBookedMembers(roles);

  const excommAssigned = roles.some(
    (r) =>
      isBookedRole(r) &&
      r.updated_at &&
      r.created_at &&
      msBetween(r.updated_at, r.created_at) > 2_000
  );

  const excommReassigned = roles.some(
    (r) =>
      isBookedRole(r) &&
      r.booked_at &&
      r.updated_at &&
      msBetween(r.updated_at, r.booked_at) > 5_000
  );

  const meetingEdited = meetings.some(
    (m) => m.updated_at && m.created_at && msBetween(m.updated_at, m.created_at) > 10_000
  );

  return {
    oneMeetingCreated: cappedProgress(meetingCount >= 1 ? 1 : 0, 1),
    twoAdditionalMeetingsPlanned: cappedProgress(additionalPlanned, 2),
    editMeetingUsedOnce: cappedProgress(meetingEdited ? 1 : 0, 1),
    excommAssignedRole: cappedProgress(excommAssigned || bookedCount >= 1 ? 1 : 0, 1),
    excommReassignedRole: cappedProgress(excommReassigned ? 1 : 0, 1),
    roleMovedToDeleted: cappedProgress(input.roleManuallyMovedToDeleted ? 1 : 0, 1),
    roleMovedToAvailable: cappedProgress(input.roleManuallyMovedToAvailable ? 1 : 0, 1),
    fiveRolesFiveMembers: cappedProgress(distinctBooked, 5),
    bookRoleUsedFiveTimes: cappedProgress(bookedCount, 5),
    toastmasterBooked: cappedProgress(
      hasBookedRole(roles, (n) => n.includes('toastmaster') && !n.includes('general')) ? 1 : 0,
      1
    ),
    preparedSpeakerBooked: cappedProgress(
      hasBookedRole(roles, (n) => n.includes('prepared') && n.includes('speaker')) ? 1 : 0,
      1
    ),
    evaluatorBooked: cappedProgress(
      hasBookedRole(roles, (n) => n.includes('evaluator') && !n.includes('general')) ? 1 : 0,
      1
    ),
    generalEvaluatorBooked: cappedProgress(
      hasBookedRole(roles, (n) => n.includes('general') && n.includes('evaluator')) ? 1 : 0,
      1
    ),
    tableTopicsMasterBooked: cappedProgress(
      hasBookedRole(
        roles,
        (n) => (n.includes('table topic') || n.includes('table topics')) && n.includes('master')
      )
        ? 1
        : 0,
      1
    ),
    tableTopicsSpeakerBooked: cappedProgress(
      hasBookedRole(
        roles,
        (n) => (n.includes('table topic') || n.includes('table topics')) && n.includes('speaker')
      )
        ? 1
        : 0,
      1
    ),
    timerBooked: cappedProgress(
      hasBookedRole(roles, (n) => n === 'timer' || (n.includes('timer') && !n.includes('report'))) ? 1 : 0,
      1
    ),
    timerReportCaptured: cappedProgress(input.timerReportCount >= 1 ? 1 : 0, 1),
    grammarianBooked: cappedProgress(hasBookedRole(roles, (n) => n.includes('grammarian')) ? 1 : 0, 1),
    grammarianReportPublished: cappedProgress(input.grammarianReportPublished ? 1 : 0, 1),
    ahCounterBooked: cappedProgress(
      hasBookedRole(roles, (n) => n.includes('ah') && n.includes('counter')) ? 1 : 0,
      1
    ),
    ahCounterReportCaptured: cappedProgress(input.ahCounterReportCount >= 1 ? 1 : 0, 1),
    toastmasterCornerThemeUpdated: cappedProgress(input.toastmasterThemeUpdated ? 1 : 0, 1),
    preparedSpeechDetailsUpdated: cappedProgress(input.preparedSpeechDetailsUpdated ? 1 : 0, 1),
    wordOfTheDayUpdated: cappedProgress(input.wordOfTheDayUpdated ? 1 : 0, 1),
    tableTopicsQuestionsUpdated: cappedProgress(input.tableTopicsQuestionsUpdated ? 1 : 0, 1),
  };
}

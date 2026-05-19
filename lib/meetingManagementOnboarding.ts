import { supabase } from '@/lib/supabase';
import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';
import {
  pathwayRowHasSpeechDetails,
  type EvaluationPathwaySpeechRow,
} from '@/lib/vpePreparedSpeakerNudge';

export type MeetingRoleRow = {
  role_name: string;
  role_classification?: string | null;
  booking_status?: string | null;
  assigned_user_id?: string | null;
  role_status?: string | null;
  booked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  speech_title?: string | null;
  speech_objectives?: string | null;
  is_completed?: boolean | null;
};

export type MeetingRow = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MeetingManagementOnboardingInput = {
  meetings: MeetingRow[];
  roles: MeetingRoleRow[];
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

const CLUB_ROLES_PAGE_SIZE = 1000;

function msBetween(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b) return 0;
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

function roleNameNorm(name: string): string {
  return name.trim().toLowerCase();
}

function roleClassNorm(row: MeetingRoleRow): string {
  return (row.role_classification ?? '').trim().toLowerCase();
}

/** Assigned / completed role (includes legacy rows marked is_completed without booking_status). */
export function isFilledMeetingRole(row: MeetingRoleRow): boolean {
  if ((row.role_status ?? 'Available') === 'Deleted') return false;
  if (!row.assigned_user_id) return false;

  const status = (row.booking_status ?? '').toLowerCase();
  if (status === 'withdrawn') return false;
  if (status === 'open' && !row.booked_at && !row.is_completed) return false;

  return status === 'booked' || row.is_completed === true || Boolean(row.booked_at);
}

export function isPreparedSpeakerRoleName(roleName: string | null | undefined): boolean {
  const n = roleNameNorm(roleName ?? '');
  return n.includes('prepared') && n.includes('speaker');
}

/** True when any prepared speaker has speech title, pathway, or related details on file. */
export function hasPreparedSpeechDetailsCaptured(
  roles: MeetingRoleRow[],
  pathwayRows: EvaluationPathwaySpeechRow[]
): boolean {
  const roleHasDetails = roles.some((r) => {
    if (!isPreparedSpeakerRoleName(r.role_name) && roleClassNorm(r) !== 'prepared speaker') return false;
    return !!r.speech_title?.trim();
  });
  if (roleHasDetails) return true;

  return pathwayRows.some(
    (row) => isPreparedSpeakerRoleName(row.role_name) && pathwayRowHasSpeechDetails(row)
  );
}

function hasFilledRole(roles: MeetingRoleRow[], match: (row: MeetingRoleRow) => boolean): boolean {
  return roles.some((r) => isFilledMeetingRole(r) && match(r));
}

function countFilledRoles(roles: MeetingRoleRow[]): number {
  return roles.filter(isFilledMeetingRole).length;
}

function countDistinctFilledMembers(roles: MeetingRoleRow[]): number {
  return new Set(roles.filter(isFilledMeetingRole).map((r) => r.assigned_user_id)).size;
}

function matchesToastmaster(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  return n.includes('toastmaster') && !n.includes('general');
}

function matchesPreparedSpeaker(row: MeetingRoleRow): boolean {
  const cls = roleClassNorm(row);
  return (
    cls === 'prepared speaker' ||
    cls === 'ice breaker' ||
    isPreparedSpeakerRoleName(row.role_name)
  );
}

function matchesSpeechEvaluator(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  const cls = roleClassNorm(row);
  return cls === 'speech evaluvator' || (n.includes('evaluator') && !n.includes('general') && !n.includes('master'));
}

function matchesGeneralEvaluator(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  const cls = roleClassNorm(row);
  return cls === 'master evaluvator' || (n.includes('general') && n.includes('evaluator'));
}

function matchesTableTopicsMaster(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  return (n.includes('table topic') || n.includes('table topics')) && n.includes('master');
}

function matchesTableTopicsSpeaker(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  const cls = roleClassNorm(row);
  return cls === 'on-the-spot speaking' || ((n.includes('table topic') || n.includes('table topics')) && n.includes('speaker'));
}

function matchesTimer(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  return n === 'timer' || (n.includes('timer') && !n.includes('report'));
}

function matchesGrammarian(row: MeetingRoleRow): boolean {
  return roleNameNorm(row.role_name).includes('grammarian');
}

function matchesAhCounter(row: MeetingRoleRow): boolean {
  const n = roleNameNorm(row.role_name);
  return n.includes('ah') && n.includes('counter');
}

/** Load all meeting role rows for a club (PostgREST default cap is 1000). */
export async function fetchAllClubMeetingRoles(clubId: string): Promise<MeetingRoleRow[]> {
  const rows: MeetingRoleRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('app_meeting_roles_management')
      .select(
        'role_name, role_classification, assigned_user_id, booking_status, role_status, booked_at, created_at, updated_at, speech_title, is_completed'
      )
      .order('id', { ascending: true })
      .eq('club_id', clubId)
      .range(offset, offset + CLUB_ROLES_PAGE_SIZE - 1);

    if (error) {
      console.warn('fetchAllClubMeetingRoles page failed:', error.message);
      if (offset === 0) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('app_meeting_roles_management')
          .select(
            'role_name, role_classification, assigned_user_id, booking_status, role_status, booked_at, created_at, updated_at, speech_title, is_completed'
          )
          .eq('club_id', clubId)
          .limit(CLUB_ROLES_PAGE_SIZE);
        if (!fallbackError && fallback?.length) {
          rows.push(...(fallback as MeetingRoleRow[]));
        }
      }
      break;
    }

    const batch = (data ?? []) as MeetingRoleRow[];
    rows.push(...batch);
    if (batch.length < CLUB_ROLES_PAGE_SIZE) break;
    offset += CLUB_ROLES_PAGE_SIZE;
  }

  return rows;
}

export function computeMeetingManagementOnboarding(
  input: MeetingManagementOnboardingInput
): MeetingManagementOnboardingProgress {
  const { meetings, roles } = input;
  const meetingCount = meetings.length;
  const additionalPlanned = Math.max(0, meetingCount - 1);
  const filledCount = countFilledRoles(roles);
  const distinctFilled = countDistinctFilledMembers(roles);

  const excommAssignedHeuristic = roles.some(
    (r) =>
      isFilledMeetingRole(r) &&
      r.updated_at &&
      r.created_at &&
      msBetween(r.updated_at, r.created_at) > 2_000
  );

  const excommReassignedHeuristic = roles.some(
    (r) =>
      isFilledMeetingRole(r) &&
      r.booked_at &&
      r.updated_at &&
      msBetween(r.updated_at, r.booked_at) > 5_000
  );

  const meetingEdited = meetings.some(
    (m) => m.updated_at && m.created_at && msBetween(m.updated_at, m.created_at) > 10_000
  );

  const clubHasSubstantialRoleHistory = filledCount >= 5 || distinctFilled >= 5;

  return {
    oneMeetingCreated: cappedProgress(meetingCount >= 1 ? 1 : 0, 1),
    twoAdditionalMeetingsPlanned: cappedProgress(additionalPlanned, 2),
    editMeetingUsedOnce: cappedProgress(meetingEdited ? 1 : 0, 1),
    excommAssignedRole: cappedProgress(excommAssignedHeuristic || filledCount >= 1 ? 1 : 0, 1),
    excommReassignedRole: cappedProgress(
      excommReassignedHeuristic || clubHasSubstantialRoleHistory ? 1 : 0,
      1
    ),
    fiveRolesFiveMembers: cappedProgress(distinctFilled, 5),
    bookRoleUsedFiveTimes: cappedProgress(filledCount, 5),
    toastmasterBooked: cappedProgress(hasFilledRole(roles, matchesToastmaster) ? 1 : 0, 1),
    preparedSpeakerBooked: cappedProgress(hasFilledRole(roles, matchesPreparedSpeaker) ? 1 : 0, 1),
    evaluatorBooked: cappedProgress(hasFilledRole(roles, matchesSpeechEvaluator) ? 1 : 0, 1),
    generalEvaluatorBooked: cappedProgress(hasFilledRole(roles, matchesGeneralEvaluator) ? 1 : 0, 1),
    tableTopicsMasterBooked: cappedProgress(hasFilledRole(roles, matchesTableTopicsMaster) ? 1 : 0, 1),
    tableTopicsSpeakerBooked: cappedProgress(hasFilledRole(roles, matchesTableTopicsSpeaker) ? 1 : 0, 1),
    timerBooked: cappedProgress(hasFilledRole(roles, matchesTimer) ? 1 : 0, 1),
    timerReportCaptured: cappedProgress(input.timerReportCount >= 1 ? 1 : 0, 1),
    grammarianBooked: cappedProgress(hasFilledRole(roles, matchesGrammarian) ? 1 : 0, 1),
    grammarianReportPublished: cappedProgress(input.grammarianReportPublished ? 1 : 0, 1),
    ahCounterBooked: cappedProgress(hasFilledRole(roles, matchesAhCounter) ? 1 : 0, 1),
    ahCounterReportCaptured: cappedProgress(input.ahCounterReportCount >= 1 ? 1 : 0, 1),
    toastmasterCornerThemeUpdated: cappedProgress(input.toastmasterThemeUpdated ? 1 : 0, 1),
    preparedSpeechDetailsUpdated: cappedProgress(input.preparedSpeechDetailsUpdated ? 1 : 0, 1),
    wordOfTheDayUpdated: cappedProgress(input.wordOfTheDayUpdated ? 1 : 0, 1),
    tableTopicsQuestionsUpdated: cappedProgress(input.tableTopicsQuestionsUpdated ? 1 : 0, 1),
  };
}

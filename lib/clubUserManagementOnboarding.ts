import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';

export type ClubInviteRow = { invitee_role?: string | null };
export type ClubMemberRow = { role?: string | null };

const TARGETS = {
  invitesMember: 2,
  invitesExcomm: 1,
  invitesVisitingTm: 1,
  invitesGuest: 1,
  joinedMember: 2,
  joinedExcomm: 1,
  joinedVisitingTm: 1,
  joinedGuest: 1,
  shareApp: 1,
} as const;

function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().toLowerCase();
}

function countInvitesByRole(invites: ClubInviteRow[], role: string): number {
  return invites.filter((row) => normalizeRole(row.invitee_role) === role).length;
}

function countJoinedByRole(members: ClubMemberRow[], role: string): number {
  return members.filter((row) => normalizeRole(row.role) === role).length;
}

export type ClubUserManagementOnboardingProgress = {
  invitesMemberRole: FieldProgress;
  invitesExcommRole: FieldProgress;
  invitesVisitingTm: FieldProgress;
  invitesGuest: FieldProgress;
  joinedMember: FieldProgress;
  joinedExcomm: FieldProgress;
  joinedVisitingTm: FieldProgress;
  joinedGuest: FieldProgress;
  shareAppFromSettings: FieldProgress;
};

export function computeClubUserManagementOnboarding(
  invites: ClubInviteRow[],
  members: ClubMemberRow[],
  shareAppUsed: boolean
): ClubUserManagementOnboardingProgress {
  return {
    invitesMemberRole: cappedProgress(countInvitesByRole(invites, 'member'), TARGETS.invitesMember),
    invitesExcommRole: cappedProgress(countInvitesByRole(invites, 'excomm'), TARGETS.invitesExcomm),
    invitesVisitingTm: cappedProgress(countInvitesByRole(invites, 'visiting_tm'), TARGETS.invitesVisitingTm),
    invitesGuest: cappedProgress(countInvitesByRole(invites, 'guest'), TARGETS.invitesGuest),
    joinedMember: cappedProgress(countJoinedByRole(members, 'member'), TARGETS.joinedMember),
    joinedExcomm: cappedProgress(countJoinedByRole(members, 'excomm'), TARGETS.joinedExcomm),
    joinedVisitingTm: cappedProgress(countJoinedByRole(members, 'visiting_tm'), TARGETS.joinedVisitingTm),
    joinedGuest: cappedProgress(countJoinedByRole(members, 'guest'), TARGETS.joinedGuest),
    shareAppFromSettings: cappedProgress(shareAppUsed ? 1 : 0, TARGETS.shareApp),
  };
}

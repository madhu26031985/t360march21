/** Shared ExComm role check (matches Admin tab `getUserRole`). */
export function isUserExComm(
  user:
    | {
        clubRole?: string | null;
        role?: string | null;
        isAuthenticated?: boolean;
        currentClubId?: string | null;
        clubs?: { id: string; role?: string | null }[] | null;
      }
    | null
    | undefined
): boolean {
  if (!user) return false;

  if (user.isAuthenticated && user.clubRole) {
    return user.clubRole.toLowerCase() === 'excomm';
  }

  const fromClubs = user.clubs?.find((c) => c.id === user.currentClubId)?.role?.toLowerCase();
  if (fromClubs === 'excomm') return true;

  return (user.clubRole ?? user.role ?? '').toLowerCase() === 'excomm';
}

import { slugifyClubNameForAgendaUrl } from '@/lib/agendaWebLink';

const DEFAULT_WEB_HOST = 'https://app.t360.in';

function publicVoteWebHost(): string {
  const h = process.env.EXPO_PUBLIC_AGENDA_WEB_HOST?.trim();
  return (h || DEFAULT_WEB_HOST).replace(/\/$/, '');
}

export function buildPublicVoteUrl(params: {
  token: string;
  clubId?: string | null;
  clubDisplayName?: string | null;
}): string {
  const cleanToken = encodeURIComponent(String(params.token || '').trim());
  const trimmedName = params.clubDisplayName?.trim();
  const clubSegment =
    trimmedName && trimmedName.length > 0
      ? slugifyClubNameForAgendaUrl(trimmedName)
      : (params.clubId?.trim() || 'club');

  return `${publicVoteWebHost()}/weblogin/${clubSegment}/public-vote/${cleanToken}`;
}


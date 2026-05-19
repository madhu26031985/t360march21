import { cappedProgress, type FieldProgress } from '@/lib/clubInfoSetupCompletion';

const DEFAULT_CLUB_INFO_BANNER = '#3b82f6';

export type MeetingAgendaMeetingRow = {
  id: string;
  is_agenda_visible?: boolean | null;
  club_info_banner_color?: string | null;
};

export type MeetingAgendaOnboardingInput = {
  agendaItemCount: number;
  meetings: MeetingAgendaMeetingRow[];
  agendaBannerColorChanged: boolean;
};

export type MeetingAgendaOnboardingProgress = {
  agendaCreated: FieldProgress;
  agendaLinkShared: FieldProgress;
  agendaBannerColorChanged: FieldProgress;
};

function normalizeHex(color: string | null | undefined): string {
  return (color ?? '').trim().toLowerCase();
}

export function meetingHasCustomAgendaBanner(meetings: MeetingAgendaMeetingRow[]): boolean {
  return meetings.some((m) => {
    const color = normalizeHex(m.club_info_banner_color);
    return color.length > 0 && color !== DEFAULT_CLUB_INFO_BANNER;
  });
}

export function computeMeetingAgendaOnboarding(
  input: MeetingAgendaOnboardingInput
): MeetingAgendaOnboardingProgress {
  const agendaLinkShared = input.meetings.some((m) => m.is_agenda_visible === true);
  const bannerChanged =
    input.agendaBannerColorChanged || meetingHasCustomAgendaBanner(input.meetings);

  return {
    agendaCreated: cappedProgress(input.agendaItemCount > 0 ? 1 : 0, 1),
    agendaLinkShared: cappedProgress(agendaLinkShared ? 1 : 0, 1),
    agendaBannerColorChanged: cappedProgress(bannerChanged ? 1 : 0, 1),
  };
}

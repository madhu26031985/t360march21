import type { ClubInfoManagementBundle, ClubSocialUrlsRow } from '@/lib/clubInfoManagementQuery';
import {
  isClubLocationTabComplete,
  isClubMeetingDetailsTabComplete,
  type ClubProfileSetupFields,
} from '@/lib/clubInfoSetupCompletion';
import { DEFAULT_TOASTMASTERS_CLUB_MISSION } from '@/lib/defaultClubMission';

export type ClubProfileSectionId = 'mission' | 'meeting_schedule' | 'location' | 'social_media';

export const CLUB_PROFILE_SECTION_LABELS: Record<ClubProfileSectionId, string> = {
  mission: 'Mission',
  meeting_schedule: 'Meeting schedule',
  location: 'Location',
  social_media: 'Social media',
};

const SOCIAL_URL_KEYS: (keyof ClubSocialUrlsRow)[] = [
  'facebook_url',
  'twitter_url',
  'linkedin_url',
  'instagram_url',
  'whatsapp_url',
  'youtube_url',
  'website_url',
];

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Custom mission saved (not empty and not the default Toastmasters text). */
export function isClubMissionSet(mission: string | null | undefined): boolean {
  const trimmed = (mission ?? '').trim();
  if (!trimmed) return false;
  return trimmed !== DEFAULT_TOASTMASTERS_CLUB_MISSION.trim();
}

export function hasAnyClubSocialLink(social: ClubSocialUrlsRow | null | undefined): boolean {
  if (!social) return false;
  return SOCIAL_URL_KEYS.some((key) => filled(social[key]));
}

function profileFieldsFromBundle(bundle: ClubInfoManagementBundle): ClubProfileSetupFields {
  return {
    ...bundle.clubData,
    meeting_day: bundle.meetingSchedule.meeting_day,
    meeting_frequency: bundle.meetingSchedule.meeting_frequency,
    meeting_start_time: bundle.meetingSchedule.meeting_start_time,
    meeting_end_time: bundle.meetingSchedule.meeting_end_time,
    meeting_type: bundle.meetingSchedule.meeting_type,
    online_meeting_link: bundle.meetingSchedule.online_meeting_link,
    ...bundle.social,
  };
}

export function getMissingClubProfileSections(bundle: ClubInfoManagementBundle): ClubProfileSectionId[] {
  const profile = profileFieldsFromBundle(bundle);
  const missing: ClubProfileSectionId[] = [];

  if (!isClubMissionSet(bundle.clubData.club_mission)) {
    missing.push('mission');
  }
  if (!isClubMeetingDetailsTabComplete(profile)) {
    missing.push('meeting_schedule');
  }
  if (!isClubLocationTabComplete(profile)) {
    missing.push('location');
  }
  if (!hasAnyClubSocialLink(bundle.social)) {
    missing.push('social_media');
  }

  return missing;
}

export function formatClubProfileIncompleteMessage(missing: ClubProfileSectionId[]): string {
  if (missing.length === 0) return '';

  const labels = missing.map((id) => CLUB_PROFILE_SECTION_LABELS[id].toLowerCase());
  if (labels.length === 1) {
    return `Your club ${labels[0]} is not set up yet. Update it in the Admin panel so members see complete information.`;
  }
  const last = labels.pop()!;
  return `Your club ${labels.join(', ')} and ${last} are not set up yet. Update them in the Admin panel so members see complete information.`;
}

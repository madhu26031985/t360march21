/** Matches editable fields in Club Info management tabs (admin/club-info-management). */

export type ClubProfileSetupFields = {
  club_mission?: string | null;
  club_status?: string | null;
  club_type?: string | null;
  banner_color?: string | null;
  country?: string | null;
  time_zone?: string | null;
  address?: string | null;
  city?: string | null;
  google_location_link?: string | null;
  region?: string | null;
  district?: string | null;
  division?: string | null;
  area?: string | null;
  meeting_day?: string | null;
  meeting_frequency?: string | null;
  meeting_start_time?: string | null;
  meeting_end_time?: string | null;
  meeting_type?: string | null;
  online_meeting_link?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  whatsapp_url?: string | null;
  youtube_url?: string | null;
  website_url?: string | null;
};

const SOCIAL_URL_FIELDS = [
  'facebook_url',
  'twitter_url',
  'linkedin_url',
  'instagram_url',
  'whatsapp_url',
  'youtube_url',
  'website_url',
] as const;

/** Default FAQ entries seeded for every club (`default_club_faq_seed_json`). */
export const CLUB_FAQ_DEFAULT_ITEM_COUNT = 50;

export type ClubFaqSetupRow = {
  question?: string | null;
  answer?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type FieldProgress = { done: number; total: number };

function filled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function countProfileFields(
  profile: ClubProfileSetupFields | null | undefined,
  keys: readonly (keyof ClubProfileSetupFields)[]
): FieldProgress {
  const total = keys.length;
  if (!profile || total === 0) return { done: 0, total };
  const done = keys.filter((key) => filled(profile[key] as string | null | undefined)).length;
  return { done, total };
}

function cappedProgress(done: number, total: number): FieldProgress {
  return { done: Math.min(Math.max(0, done), total), total };
}

export function clubNameProgress(club: { name?: string | null } | null | undefined): FieldProgress {
  return { done: filled(club?.name) ? 1 : 0, total: 1 };
}

export function clubCharterDateProgress(club: { charter_date?: string | null } | null | undefined): FieldProgress {
  return { done: filled(club?.charter_date) ? 1 : 0, total: 1 };
}

export function clubNumberProgress(club: { club_number?: string | null } | null | undefined): FieldProgress {
  return { done: filled(club?.club_number) ? 1 : 0, total: 1 };
}

/** Club Info tab — 7 fields (3 read-only on `clubs` + 4 on `club_profiles`; 6 typically filled at creation). */
export function clubInfoTabProgress(
  club: { name?: string | null; club_number?: string | null; charter_date?: string | null } | null | undefined,
  profile: ClubProfileSetupFields | null | undefined
): FieldProgress {
  const total = 7;
  let done = 0;
  if (filled(club?.name)) done += 1;
  if (filled(club?.club_number)) done += 1;
  if (filled(club?.charter_date)) done += 1;
  if (filled(profile?.club_mission)) done += 1;
  if (filled(profile?.club_status)) done += 1;
  if (filled(profile?.club_type)) done += 1;
  if (filled(profile?.banner_color)) done += 1;
  return { done, total };
}

export function clubLocationTabProgress(profile: ClubProfileSetupFields | null | undefined): FieldProgress {
  return countProfileFields(profile, [
    'country',
    'time_zone',
    'address',
    'city',
    'google_location_link',
  ]);
}

export function clubMoreDetailsTabProgress(profile: ClubProfileSetupFields | null | undefined): FieldProgress {
  return countProfileFields(profile, ['region', 'district', 'division', 'area']);
}

export function clubMeetingDetailsTabProgress(profile: ClubProfileSetupFields | null | undefined): FieldProgress {
  return countProfileFields(profile, [
    'meeting_day',
    'meeting_frequency',
    'meeting_start_time',
    'meeting_end_time',
    'meeting_type',
  ]);
}

export function clubSocialMediaProgress(profile: ClubProfileSetupFields | null | undefined): FieldProgress {
  return countProfileFields(profile, SOCIAL_URL_FIELDS);
}

/** Club FAQ — 50 default Q&A rows; each counts when question and answer are filled. */
export function clubFaqProgress(rows: ClubFaqSetupRow[]): FieldProgress {
  const filledCount = rows.filter((row) => filled(row.question) && filled(row.answer)).length;
  return cappedProgress(filledCount, CLUB_FAQ_DEFAULT_ITEM_COUNT);
}

/** Club Info tab — all 7 fields filled (mission is the usual remaining item). */
export function isClubInfoTabComplete(
  club: { name?: string | null; club_number?: string | null; charter_date?: string | null } | null | undefined,
  profile: ClubProfileSetupFields | null | undefined
): boolean {
  const p = clubInfoTabProgress(club, profile);
  return p.done === p.total;
}

/** Club Location tab — country, time zone, address, city, map link. */
export function isClubLocationTabComplete(profile: ClubProfileSetupFields | null | undefined): boolean {
  if (!profile) return false;
  return (
    filled(profile.country) &&
    filled(profile.time_zone) &&
    filled(profile.address) &&
    filled(profile.city) &&
    filled(profile.google_location_link)
  );
}

/** Club More Details tab — region, district, division, area. */
export function isClubMoreDetailsTabComplete(profile: ClubProfileSetupFields | null | undefined): boolean {
  if (!profile) return false;
  return (
    filled(profile.region) &&
    filled(profile.district) &&
    filled(profile.division) &&
    filled(profile.area)
  );
}

/** Club Meeting Details tab — all schedule fields shown in the meeting details grid. */
export function isClubMeetingDetailsTabComplete(profile: ClubProfileSetupFields | null | undefined): boolean {
  if (!profile) return false;
  return (
    filled(profile.meeting_day) &&
    filled(profile.meeting_frequency) &&
    filled(profile.meeting_start_time) &&
    filled(profile.meeting_end_time) &&
    filled(profile.meeting_type)
  );
}

/** Club Social Media screen — every platform link field filled. */
export function isClubSocialMediaComplete(profile: ClubProfileSetupFields | null | undefined): boolean {
  if (!profile) return false;
  return SOCIAL_URL_FIELDS.every((key) => filled(profile[key]));
}

/** Club FAQ — defaults loaded and at least one entry saved after review/edit. */
export function isClubFaqComplete(rows: ClubFaqSetupRow[]): boolean {
  const p = clubFaqProgress(rows);
  return p.total > 0 && p.done === p.total;
}

export { cappedProgress };

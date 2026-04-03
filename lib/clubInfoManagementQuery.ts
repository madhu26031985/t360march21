import { supabase } from '@/lib/supabase';

export const clubInfoManagementQueryKeys = {
  all: ['clubInfoManagement'] as const,
  detail: (clubId: string) => [...clubInfoManagementQueryKeys.all, clubId] as const,
};

export interface ClubInfoManagementClubInfo {
  id: string;
  name: string;
  club_number: string | null;
  charter_date: string | null;
}

/** Meeting schedule fields from `club_profiles` (same shape as club-meeting-details). */
export interface ClubInfoManagementMeetingSchedule {
  meeting_day: string | null;
  meeting_frequency: string | null;
  meeting_start_time: string | null;
  meeting_end_time: string | null;
  meeting_type: string | null;
  online_meeting_link: string | null;
}

export interface ClubInfoManagementFormData {
  club_name: string;
  club_number: string | null;
  charter_date: string | null;
  club_status: string | null;
  club_type: string | null;
  club_mission: string | null;
  banner_color: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  district: string | null;
  division: string | null;
  area: string | null;
  time_zone: string | null;
  address: string | null;
  pin_code: string | null;
  google_location_link: string | null;
}

export interface ClubInfoManagementBundle {
  clubInfo: ClubInfoManagementClubInfo;
  clubData: ClubInfoManagementFormData;
  meetingSchedule: ClubInfoManagementMeetingSchedule;
}

export async function fetchClubInfoManagementBundle(clubId: string): Promise<ClubInfoManagementBundle> {
  const { data: row, error: clubError } = await supabase
    .from('clubs')
    .select(`
          id,
          name,
          club_number,
          charter_date,
          club_profiles (
            club_status,
            club_type,
            club_mission,
            city,
            country,
            region,
            district,
            division,
            area,
            time_zone,
            address,
            pin_code,
            google_location_link,
            club_name,
            club_number,
            charter_date,
            banner_color,
            meeting_day,
            meeting_frequency,
            meeting_start_time,
            meeting_end_time,
            meeting_type,
            online_meeting_link
          )
        `)
    .eq('id', clubId)
    .single();

  if (clubError) {
    throw clubError;
  }

  const clubRow = row as {
    id: string;
    name: string;
    club_number: string | null;
    charter_date: string | null;
    club_profiles: Record<string, unknown> | Record<string, unknown>[] | null;
  };

  const rawProfile = clubRow.club_profiles;
  const profileData = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
  const p = profileData as Record<string, string | null> | undefined;

  const clubData: ClubInfoManagementFormData = {
    club_name: clubRow.name,
    club_number: clubRow.club_number,
    charter_date: clubRow.charter_date,
    club_status: p?.club_status ?? null,
    club_type: p?.club_type ?? null,
    club_mission: p?.club_mission ?? null,
    banner_color: p?.banner_color ?? null,
    city: p?.city ?? null,
    country: p?.country ?? null,
    region: p?.region ?? null,
    district: p?.district ?? null,
    division: p?.division ?? null,
    area: p?.area ?? null,
    time_zone: p?.time_zone ?? null,
    address: p?.address ?? null,
    pin_code: p?.pin_code ?? null,
    google_location_link: p?.google_location_link ?? null,
  };

  const meetingSchedule: ClubInfoManagementMeetingSchedule = {
    meeting_day: (p?.meeting_day as string | null) ?? null,
    meeting_frequency: (p?.meeting_frequency as string | null) ?? null,
    meeting_start_time: (p?.meeting_start_time as string | null) ?? null,
    meeting_end_time: (p?.meeting_end_time as string | null) ?? null,
    meeting_type: (p?.meeting_type as string | null) ?? null,
    online_meeting_link: (p?.online_meeting_link as string | null) ?? null,
  };

  return {
    clubInfo: {
      id: clubRow.id,
      name: clubRow.name,
      club_number: clubRow.club_number,
      charter_date: clubRow.charter_date,
    },
    clubData,
    meetingSchedule,
  };
}

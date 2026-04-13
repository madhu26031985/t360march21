-- Club tab critical hero payload in one RPC round-trip.
-- Goal: reduce cold-load latency on constrained networks (e.g. slow 3G).

CREATE INDEX IF NOT EXISTS idx_cur_auth_role_club_user
  ON public.app_club_user_relationship (club_id, role, user_id)
  WHERE is_authenticated = true;

CREATE OR REPLACE FUNCTION public.get_club_landing_critical_snapshot(
  p_club_id uuid,
  p_member_limit integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_member_limit, 24), 80));
BEGIN
  IF p_club_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_club_user_relationship r
    WHERE r.club_id = p_club_id
      AND r.user_id = auth.uid()
      AND r.is_authenticated = true
  ) THEN
    RETURN NULL;
  END IF;

  RETURN (
    WITH c AS (
      SELECT c.id, c.name, c.club_number, c.charter_date
      FROM public.clubs c
      WHERE c.id = p_club_id
      LIMIT 1
    ),
    cp AS (
      SELECT
        cp.club_id,
        cp.club_status,
        cp.club_type,
        cp.club_mission,
        cp.city,
        cp.country,
        cp.region,
        cp.district,
        cp.division,
        cp.area,
        cp.time_zone,
        cp.address,
        cp.pin_code,
        cp.google_location_link,
        cp.banner_color,
        cp.meeting_day,
        cp.meeting_frequency,
        cp.meeting_start_time,
        cp.meeting_end_time,
        cp.meeting_type,
        cp.online_meeting_link,
        cp.president_id,
        cp.vpe_id,
        cp.vpm_id,
        cp.vppr_id,
        cp.secretary_id,
        cp.treasurer_id,
        cp.saa_id,
        cp.ipp_id,
        cp.facebook_url,
        cp.twitter_url,
        cp.linkedin_url,
        cp.instagram_url,
        cp.whatsapp_url,
        cp.youtube_url,
        cp.website_url
      FROM public.club_profiles cp
      WHERE cp.club_id = p_club_id
      LIMIT 1
    ),
    excomm_slots AS (
      SELECT
        t.slot_key,
        t.slot_title,
        t.user_id
      FROM cp
      CROSS JOIN LATERAL (
        VALUES
          ('president'::text, 'President'::text, cp.president_id),
          ('vpe', 'VP Education', cp.vpe_id),
          ('vpm', 'VP Membership', cp.vpm_id),
          ('vppr', 'VP Public Relations', cp.vppr_id),
          ('secretary', 'Secretary', cp.secretary_id),
          ('treasurer', 'Treasurer', cp.treasurer_id),
          ('saa', 'Sergeant at Arms', cp.saa_id),
          ('ipp', 'Immediate Past President', cp.ipp_id)
      ) AS t(slot_key, slot_title, user_id)
      WHERE t.user_id IS NOT NULL
    ),
    excomm AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', es.slot_key,
          'title', es.slot_title,
          'member', jsonb_build_object(
            'id', up.id,
            'full_name', COALESCE(up.full_name, 'Member'),
            'avatar_url', up.avatar_url
          )
        )
        ORDER BY es.slot_key
      ) AS rows
      FROM excomm_slots es
      INNER JOIN public.app_user_profiles up ON up.id = es.user_id
    ),
    members AS (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'full_name', m.full_name,
          'avatar_url', m.avatar_url,
          'clubRole', m.club_role
        )
        ORDER BY m.full_name
      ) AS rows
      FROM (
        SELECT DISTINCT ON (up.id)
          up.id,
          COALESCE(up.full_name, 'Member') AS full_name,
          up.avatar_url,
          CASE
            WHEN r.role = 'visiting_tm' THEN 'visiting_tm'
            WHEN r.role = 'guest' THEN 'guest'
            ELSE 'member'
          END AS club_role
        FROM public.app_club_user_relationship r
        INNER JOIN public.app_user_profiles up ON up.id = r.user_id
        WHERE r.club_id = p_club_id
          AND r.is_authenticated = true
          AND r.role IN ('member', 'visiting_tm', 'guest')
        ORDER BY up.id, up.full_name
        LIMIT v_limit
      ) m
    )
    SELECT jsonb_build_object(
      'bundle', jsonb_build_object(
        'clubInfo', jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'club_number', c.club_number,
          'charter_date', c.charter_date
        ),
        'clubData', jsonb_build_object(
          'club_name', c.name,
          'club_number', c.club_number,
          'charter_date', c.charter_date,
          'club_status', cp.club_status,
          'club_type', cp.club_type,
          'club_mission', cp.club_mission,
          'banner_color', cp.banner_color,
          'city', cp.city,
          'country', cp.country,
          'region', cp.region,
          'district', cp.district,
          'division', cp.division,
          'area', cp.area,
          'time_zone', cp.time_zone,
          'address', cp.address,
          'pin_code', cp.pin_code,
          'google_location_link', cp.google_location_link
        ),
        'meetingSchedule', jsonb_build_object(
          'meeting_day', cp.meeting_day,
          'meeting_frequency', cp.meeting_frequency,
          'meeting_start_time', cp.meeting_start_time,
          'meeting_end_time', cp.meeting_end_time,
          'meeting_type', cp.meeting_type,
          'online_meeting_link', cp.online_meeting_link
        ),
        'social', jsonb_build_object(
          'facebook_url', cp.facebook_url,
          'twitter_url', cp.twitter_url,
          'linkedin_url', cp.linkedin_url,
          'instagram_url', cp.instagram_url,
          'whatsapp_url', cp.whatsapp_url,
          'youtube_url', cp.youtube_url,
          'website_url', cp.website_url
        ),
        'excommSlots', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'key', es.slot_key,
                'title', es.slot_title,
                'userId', es.user_id
              )
              ORDER BY es.slot_key
            )
            FROM excomm_slots es
          ),
          '[]'::jsonb
        )
      ),
      'excomm', COALESCE((SELECT rows FROM excomm), '[]'::jsonb),
      'members', COALESCE((SELECT rows FROM members), '[]'::jsonb)
    )
    FROM c
    LEFT JOIN cp ON cp.club_id = c.id
  );
END;
$$;

COMMENT ON FUNCTION public.get_club_landing_critical_snapshot(uuid, integer) IS
  'Club tab critical payload (bundle + excomm + members) for one-round-trip cold loads.';

GRANT EXECUTE ON FUNCTION public.get_club_landing_critical_snapshot(uuid, integer) TO authenticated;
ALTER FUNCTION public.get_club_landing_critical_snapshot(uuid, integer) SET row_security = off;

ANALYZE public.app_club_user_relationship;
ANALYZE public.club_profiles;

/*
  ExComm Management: one round-trip for club header + club_profiles excomm columns + member roster.

  Replaces three separate PostgREST calls (and the slow embed on app_club_user_relationship)
  with a single SECURITY DEFINER query plan + one membership gate.
*/

CREATE OR REPLACE FUNCTION public.get_excomm_management_snapshot(p_club_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.app_club_user_relationship m
      WHERE m.club_id = p_club_id
        AND m.user_id = auth.uid()
        AND m.is_authenticated = true
    )
    THEN NULL
    ELSE (
      SELECT jsonb_build_object(
        'club',
        (
          SELECT jsonb_build_object('id', c.id, 'name', c.name, 'club_number', c.club_number)
          FROM public.clubs c
          WHERE c.id = p_club_id
        ),
        'excomm',
        (
          SELECT to_jsonb(s.*)
          FROM (
            SELECT
              president_id,
              president_term_start,
              president_term_end,
              ipp_id,
              ipp_term_start,
              ipp_term_end,
              vpe_id,
              vpe_term_start,
              vpe_term_end,
              vpm_id,
              vpm_term_start,
              vpm_term_end,
              vppr_id,
              vppr_term_start,
              vppr_term_end,
              secretary_id,
              secretary_term_start,
              secretary_term_end,
              treasurer_id,
              treasurer_term_start,
              treasurer_term_end,
              saa_id,
              saa_term_start,
              saa_term_end,
              area_director_id,
              area_director_term_start,
              area_director_term_end,
              division_director_id,
              division_director_term_start,
              division_director_term_end,
              district_director_id,
              district_director_term_start,
              district_director_term_end,
              program_quality_director_id,
              program_quality_director_term_start,
              program_quality_director_term_end,
              club_growth_director_id,
              club_growth_director_term_start,
              club_growth_director_term_end,
              immediate_past_district_director_id,
              immediate_past_district_director_term_start,
              immediate_past_district_director_term_end
            FROM public.club_profiles
            WHERE club_id = p_club_id
          ) s
        ),
        'members',
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',
                r.user_id,
                'full_name',
                COALESCE(p.full_name, ''),
                'email',
                COALESCE(p.email, ''),
                'avatar_url',
                p.avatar_url,
                'phone_number',
                p.phone_number,
                'role',
                r.role
              )
              ORDER BY COALESCE(p.full_name, '')
            )
            FROM public.app_club_user_relationship r
            INNER JOIN public.app_user_profiles p ON p.id = r.user_id
            WHERE r.club_id = p_club_id
              AND r.is_authenticated = true
          ),
          '[]'::jsonb
        )
      )
    )
  END;
$$;

COMMENT ON FUNCTION public.get_excomm_management_snapshot(uuid) IS
  'ExComm Management screen: club row, excomm columns from club_profiles, authenticated members with profiles in one call.';

GRANT EXECUTE ON FUNCTION public.get_excomm_management_snapshot(uuid) TO authenticated;

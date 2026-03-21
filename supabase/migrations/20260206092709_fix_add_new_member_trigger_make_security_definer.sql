/*
  # Fix add_new_member_to_future_meetings Trigger - Make SECURITY DEFINER

  ## Problem
  When a user is added to app_club_user_relationship, the trigger
  add_new_member_to_future_meetings fires and tries to INSERT into app_meeting_attendance.
  
  The RLS policies on app_meeting_attendance query app_club_user_relationship to check
  if the user is a club member, causing infinite recursion.

  ## Root Cause
  1. User INSERTs into app_club_user_relationship
  2. Trigger fires: add_new_member_to_future_meetings
  3. Trigger tries to INSERT into app_meeting_attendance
  4. RLS policy checks: "Is user a club member?" by querying app_club_user_relationship
  5. That query is still processing the original INSERT → infinite recursion

  ## Solution
  Make the trigger function SECURITY DEFINER so it bypasses RLS when inserting
  into app_meeting_attendance. This is safe because:
  - It's an automated system operation
  - It only adds attendance records for the user being added to the club
  - No user input is processed in the trigger

  ## Security
  - Function only runs during club membership creation
  - Data comes from verified sources (app_club_meeting, app_user_profiles)
  - Safe to bypass RLS for this automated operation
*/

CREATE OR REPLACE FUNCTION add_new_member_to_future_meetings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process if the member is being authenticated (added to club)
  IF NEW.is_authenticated = true AND (OLD IS NULL OR OLD.is_authenticated = false) THEN
    -- Add the new member to all future open meetings (today and onwards)
    INSERT INTO app_meeting_attendance (
      meeting_id,
      user_id,
      club_id,
      user_full_name,
      user_email,
      user_role,
      meeting_date,
      meeting_title,
      meeting_number,
      attendance_status,
      is_attendance_open,
      created_at,
      updated_at
    )
    SELECT 
      acm.id,
      NEW.user_id,
      NEW.club_id,
      aup.full_name,
      aup.email,
      NEW.role,
      acm.meeting_date,
      acm.meeting_title,
      acm.meeting_number,
      'not_applicable',
      true,
      now(),
      now()
    FROM app_club_meeting acm
    JOIN app_user_profiles aup ON aup.id = NEW.user_id
    WHERE acm.club_id = NEW.club_id
      AND acm.meeting_status = 'open'
      AND acm.meeting_date >= CURRENT_DATE
      AND aup.is_active = true
    ON CONFLICT (meeting_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

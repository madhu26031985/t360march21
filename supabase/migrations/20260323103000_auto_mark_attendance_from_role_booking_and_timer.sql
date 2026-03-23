/*
  # Auto-mark attendance: role booking + timer reporting

  Attendance rules:
  - Mark a user as `present` when:
    1) They are assigned a meeting role and the role's booking_status becomes `booked`
       during the meeting day while the meeting is `open`.
    2) They record timer time (timer_reports) during the meeting day while the meeting is `open`.
       Guests are ignored (timer_reports.speaker_user_id IS NULL).

  Manual override preserved:
  - Triggers only update attendance rows where `attendance_marked_by IS NULL`
    so if a member/excomm manually changes attendance, automation won't overwrite it.
*/

-- ------------------------------------------------------------
-- 1) Role booking -> auto-mark attendance as present
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_mark_attendance_on_role_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_meeting_status text;
  v_assigned_user_id uuid;
  v_action_date date;
BEGIN
  -- Only act when a role is booked
  IF NEW.booking_status IS DISTINCT FROM 'booked' THEN
    RETURN NEW;
  END IF;

  v_assigned_user_id := NEW.assigned_user_id;
  IF v_assigned_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_meeting_id := NEW.meeting_id;

  SELECT m.meeting_date, m.meeting_status
  INTO v_meeting_date, v_meeting_status
  FROM app_club_meeting m
  WHERE m.id = v_meeting_id;

  -- If meeting can't be found, exit gracefully
  IF v_meeting_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only mark while meeting is live
  IF v_meeting_status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  -- Only mark on the meeting day
  v_action_date := DATE(NEW.created_at);
  IF v_action_date IS DISTINCT FROM v_meeting_date THEN
    RETURN NEW;
  END IF;

  UPDATE app_meeting_attendance
  SET
    attendance_status = 'present',
    attendance_marked_at = COALESCE(NEW.created_at, now()),
    updated_at = now()
  WHERE
    meeting_id = v_meeting_id
    AND user_id = v_assigned_user_id
    AND attendance_marked_by IS NULL
    AND attendance_status IS DISTINCT FROM 'present';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block the booking; just log
  RAISE WARNING 'auto_mark_attendance_on_role_booking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_role_booking_insert ON app_meeting_roles_management;
CREATE TRIGGER trigger_auto_mark_attendance_on_role_booking_insert
  AFTER INSERT ON app_meeting_roles_management
  FOR EACH ROW
  WHEN (NEW.booking_status = 'booked')
EXECUTE FUNCTION auto_mark_attendance_on_role_booking();

DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_role_booking_update ON app_meeting_roles_management;
CREATE TRIGGER trigger_auto_mark_attendance_on_role_booking_update
  AFTER UPDATE OF booking_status ON app_meeting_roles_management
  FOR EACH ROW
  WHEN (
    NEW.booking_status = 'booked'
    AND (OLD.booking_status IS DISTINCT FROM NEW.booking_status)
  )
EXECUTE FUNCTION auto_mark_attendance_on_role_booking();


-- ------------------------------------------------------------
-- 2) Timer report -> auto-mark attendance as present
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_mark_attendance_on_timer_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meeting_id uuid;
  v_meeting_date date;
  v_meeting_status text;
  v_speaker_user_id uuid;
  v_report_date date;
BEGIN
  -- Ignore guests
  v_speaker_user_id := NEW.speaker_user_id;
  IF v_speaker_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_meeting_id := NEW.meeting_id;

  SELECT m.meeting_date, m.meeting_status
  INTO v_meeting_date, v_meeting_status
  FROM app_club_meeting m
  WHERE m.id = v_meeting_id;

  IF v_meeting_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only mark while meeting is live
  IF v_meeting_status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  -- Only mark on the meeting day (use recorded_at when available)
  v_report_date := DATE(COALESCE(NEW.recorded_at, NEW.created_at));
  IF v_report_date IS DISTINCT FROM v_meeting_date THEN
    RETURN NEW;
  END IF;

  UPDATE app_meeting_attendance
  SET
    attendance_status = 'present',
    attendance_marked_at = COALESCE(NEW.recorded_at, NEW.created_at, now()),
    updated_at = now()
  WHERE
    meeting_id = v_meeting_id
    AND user_id = v_speaker_user_id
    AND attendance_marked_by IS NULL
    AND attendance_status IS DISTINCT FROM 'present';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_attendance_on_timer_report failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_timer_report_insert ON timer_reports;
CREATE TRIGGER trigger_auto_mark_attendance_on_timer_report_insert
  AFTER INSERT ON timer_reports
  FOR EACH ROW
  WHEN (NEW.speaker_user_id IS NOT NULL)
EXECUTE FUNCTION auto_mark_attendance_on_timer_report();

DROP TRIGGER IF EXISTS trigger_auto_mark_attendance_on_timer_report_update ON timer_reports;
CREATE TRIGGER trigger_auto_mark_attendance_on_timer_report_update
  AFTER UPDATE ON timer_reports
  FOR EACH ROW
  WHEN (NEW.speaker_user_id IS NOT NULL)
EXECUTE FUNCTION auto_mark_attendance_on_timer_report();


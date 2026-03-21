/*
  # Drop Unused Indexes - Batch 2

  1. Cleanup Continuation
    - More unused indexes related to meetings, attendance, and user metrics
    - Further reduces database overhead
  
  2. Categories
    - Role completion indexes
    - Meeting collaboration indexes  
    - User invitation indexes
    - Attendance snapshot indexes
    - Meeting agenda indexes
*/

-- Drop unused role completion indexes
DROP INDEX IF EXISTS idx_role_completions_meeting_id;
DROP INDEX IF EXISTS idx_role_completions_club_id;
DROP INDEX IF EXISTS idx_role_completions_meeting_date;
DROP INDEX IF EXISTS idx_role_completions_assigned_user_id;
DROP INDEX IF EXISTS idx_role_completions_is_completed;
DROP INDEX IF EXISTS idx_role_completions_metric_type;
DROP INDEX IF EXISTS idx_role_completions_completion_notes;
DROP INDEX IF EXISTS idx_role_completions_completed_at;
DROP INDEX IF EXISTS idx_role_completions_role_booking_id;
DROP INDEX IF EXISTS idx_role_completions_meeting_user;

-- Drop unused meeting collaboration indexes
DROP INDEX IF EXISTS idx_app_meeting_collaboration_club_id;
DROP INDEX IF EXISTS idx_app_meeting_collaboration_created_at;
DROP INDEX IF EXISTS idx_app_meeting_collaboration_club_meeting;
DROP INDEX IF EXISTS idx_collaboration_speech_title;
DROP INDEX IF EXISTS idx_collaboration_pathway_level;
DROP INDEX IF EXISTS idx_collaboration_theme_of_the_day;
DROP INDEX IF EXISTS idx_collaboration_education_speech_title;

-- Drop unused user invitation indexes
DROP INDEX IF EXISTS idx_user_invitations_invitee_email;
DROP INDEX IF EXISTS idx_user_invitations_expires_at;
DROP INDEX IF EXISTS idx_user_invitations_accepted_user_id;

-- Drop unused attendance snapshot indexes
DROP INDEX IF EXISTS idx_app_attendance_snapshot_user_club_date;
DROP INDEX IF EXISTS idx_app_attendance_snapshot_club_id;
DROP INDEX IF EXISTS idx_app_attendance_snapshot_is_authenticated;
DROP INDEX IF EXISTS idx_app_attendance_snapshot_final_role;

-- Drop unused meeting agenda indexes
DROP INDEX IF EXISTS idx_meeting_agenda_items_educational_topic;
DROP INDEX IF EXISTS idx_meeting_agenda_items_assigned_user;
DROP INDEX IF EXISTS idx_meeting_agenda_items_timer_user;
DROP INDEX IF EXISTS idx_meeting_agenda_items_ah_counter_user;
DROP INDEX IF EXISTS idx_meeting_agenda_items_grammarian_user;
DROP INDEX IF EXISTS idx_meeting_agenda_items_template_id;
DROP INDEX IF EXISTS idx_agenda_templates_club;
DROP INDEX IF EXISTS idx_agenda_templates_order;

-- Drop unused user performance metrics indexes
DROP INDEX IF EXISTS idx_user_performance_metrics_award_notes;
DROP INDEX IF EXISTS idx_user_performance_metrics_attendance_type;

-- Drop unused user profile indexes
DROP INDEX IF EXISTS idx_app_user_profiles_location;
DROP INDEX IF EXISTS idx_app_user_profiles_occupation;

-- Drop unused club relationship index
DROP INDEX IF EXISTS idx_app_club_user_relationship_is_authenticated;

-- Drop unused ah counter indexes
DROP INDEX IF EXISTS idx_ah_counter_reports_meeting_date;
DROP INDEX IF EXISTS idx_ah_counter_reports_recorded_at;
DROP INDEX IF EXISTS idx_ah_counter_reports_club_meeting_date;
DROP INDEX IF EXISTS idx_ah_counter_tracked_user;

/*
  # Drop Unused Indexes - Batch 3 (Final)

  1. Cleanup Final Batch
    - Remaining unused indexes
    - Grammarian, mentor, and other feature indexes
  
  2. Categories
    - Grammarian word/idiom/quote indexes
    - Meeting minutes and agenda indexes
    - Educational speaker indexes
    - Mentor assignment indexes
    - Various feature-specific indexes
*/

-- Drop unused grammarian indexes
DROP INDEX IF EXISTS idx_grammarian_reports_meeting_date;
DROP INDEX IF EXISTS idx_word_of_the_day_published;
DROP INDEX IF EXISTS idx_quote_of_the_day_grammarian_id;
DROP INDEX IF EXISTS idx_quote_of_the_day_published;
DROP INDEX IF EXISTS idx_grammarian_daily_elements_meeting_id;
DROP INDEX IF EXISTS idx_word_member_usage_member_id;
DROP INDEX IF EXISTS idx_idiom_member_usage_member_id;
DROP INDEX IF EXISTS idx_quote_member_usage_member_id;
DROP INDEX IF EXISTS idx_live_good_usage_published;
DROP INDEX IF EXISTS idx_live_improvements_published;

-- Drop unused meeting management indexes
DROP INDEX IF EXISTS idx_app_agenda_management_status;
DROP INDEX IF EXISTS idx_app_agenda_management_created_at;
DROP INDEX IF EXISTS idx_app_minutes_management_status;
DROP INDEX IF EXISTS idx_app_minutes_management_created_at;

-- Drop unused meeting role indexes
DROP INDEX IF EXISTS idx_meeting_roles_withdrawn_at;
DROP INDEX IF EXISTS idx_meeting_roles_booked_at;
DROP INDEX IF EXISTS idx_app_meeting_roles_management_completed_at;
DROP INDEX IF EXISTS idx_meeting_roles_meeting_status_classification;

-- Drop unused attendance indexes
DROP INDEX IF EXISTS idx_app_meeting_attendance_open;

-- Drop unused timer report indexes
DROP INDEX IF EXISTS idx_timer_reports_recorded_at;

-- Drop unused educational speaker indexes
DROP INDEX IF EXISTS idx_educational_speaker_meeting_id;
DROP INDEX IF EXISTS idx_educational_speaker_club_id;
DROP INDEX IF EXISTS idx_educational_speaker_completed;
DROP INDEX IF EXISTS idx_educational_speaker_created_at;

-- Drop unused keynote speaker indexes
DROP INDEX IF EXISTS idx_keynote_speaker_meeting_id;
DROP INDEX IF EXISTS idx_keynote_speaker_user_id;

-- Drop unused general evaluator index
DROP INDEX IF EXISTS idx_app_meeting_ge_submitted_at;

-- Drop unused feedback indexes
DROP INDEX IF EXISTS idx_feedback_club_id;
DROP INDEX IF EXISTS idx_feedback_created_at;
DROP INDEX IF EXISTS idx_feedback_club_meeting;

-- Drop unused mentor assignment indexes
DROP INDEX IF EXISTS idx_mentor_assignments_status;
DROP INDEX IF EXISTS idx_mentor_assignments_assigned_by;

-- Drop unused theme activity index
DROP INDEX IF EXISTS idx_theme_activity_created_at;

-- Drop unused club join request index
DROP INDEX IF EXISTS idx_club_join_requests_reviewed_by;

-- Drop unused club association request indexes
DROP INDEX IF EXISTS idx_club_association_requests_status;
DROP INDEX IF EXISTS idx_club_association_requests_expires_at;
DROP INDEX IF EXISTS idx_club_association_requests_created_at;

-- Drop unused poll result indexes
DROP INDEX IF EXISTS idx_poll_results_repository_question_text;
DROP INDEX IF EXISTS idx_poll_results_repository_option_text;

-- Drop unused user pathway indexes
DROP INDEX IF EXISTS idx_user_pathways_pathway_id;
DROP INDEX IF EXISTS idx_user_pathways_user_id;

-- Drop unused app version index
DROP INDEX IF EXISTS idx_app_version_config_platform;

-- Drop unused shared agenda index
DROP INDEX IF EXISTS idx_shared_agendas_club;

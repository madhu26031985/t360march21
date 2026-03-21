/*
  # Fix Unindexed Foreign Keys

  1. Performance Improvements
    - Add indexes to all foreign key columns that are missing covering indexes
    - This prevents table scans and improves query performance significantly
  
  2. Tables Affected
    - ah_counter_tracked_members (created_by)
    - app_evaluation_pathway (vpe_approved_by)
    - app_meeting_timer_notes (timer_user_id)
    - app_prepared_speech_evaluations (uploaded_by)
    - app_timer_selected_members (selected_member_id, timer_user_id)
    - grammarian_live_good_usage (club_id, grammarian_id)
    - grammarian_live_improvements (club_id, grammarian_id)
    - shared_agendas (created_by)
    - toastmaster_theme_activity_log (user_id)
*/

-- Add index for ah_counter_tracked_members.created_by
CREATE INDEX IF NOT EXISTS idx_ah_counter_tracked_members_created_by 
  ON ah_counter_tracked_members(created_by);

-- Add index for app_evaluation_pathway.vpe_approved_by
CREATE INDEX IF NOT EXISTS idx_app_evaluation_pathway_vpe_approved_by 
  ON app_evaluation_pathway(vpe_approved_by);

-- Add index for app_meeting_timer_notes.timer_user_id
CREATE INDEX IF NOT EXISTS idx_app_meeting_timer_notes_timer_user_id 
  ON app_meeting_timer_notes(timer_user_id);

-- Add index for app_prepared_speech_evaluations.uploaded_by
CREATE INDEX IF NOT EXISTS idx_app_prepared_speech_evaluations_uploaded_by 
  ON app_prepared_speech_evaluations(uploaded_by);

-- Add indexes for app_timer_selected_members
CREATE INDEX IF NOT EXISTS idx_app_timer_selected_members_selected_member_id 
  ON app_timer_selected_members(selected_member_id);

CREATE INDEX IF NOT EXISTS idx_app_timer_selected_members_timer_user_id 
  ON app_timer_selected_members(timer_user_id);

-- Add indexes for grammarian_live_good_usage
CREATE INDEX IF NOT EXISTS idx_grammarian_live_good_usage_club_id 
  ON grammarian_live_good_usage(club_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_live_good_usage_grammarian_id 
  ON grammarian_live_good_usage(grammarian_id);

-- Add indexes for grammarian_live_improvements
CREATE INDEX IF NOT EXISTS idx_grammarian_live_improvements_club_id 
  ON grammarian_live_improvements(club_id);

CREATE INDEX IF NOT EXISTS idx_grammarian_live_improvements_grammarian_id 
  ON grammarian_live_improvements(grammarian_id);

-- Add index for shared_agendas.created_by
CREATE INDEX IF NOT EXISTS idx_shared_agendas_created_by 
  ON shared_agendas(created_by);

-- Add index for toastmaster_theme_activity_log.user_id
CREATE INDEX IF NOT EXISTS idx_toastmaster_theme_activity_log_user_id 
  ON toastmaster_theme_activity_log(user_id);

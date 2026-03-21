/*
  # Drop Unused Indexes - Batch 1

  1. Cleanup
    - Remove indexes that have not been used (confirmed by pg_stat_user_indexes)
    - Reduces database maintenance overhead
    - Frees up storage space
    - Improves write performance
  
  2. Categories of Unused Indexes
    - Club profile search indexes (city, vision, mission, etc.)
    - Poll-related indexes
    - User pathway indexes
    - Meeting role indexes
    
  3. Safety Notes
    - These indexes show zero usage in statistics
    - Can be recreated if needed later
    - Low risk operation
*/

-- Drop unused club profile indexes
DROP INDEX IF EXISTS idx_club_profiles_city;
DROP INDEX IF EXISTS idx_club_profiles_club_vision;
DROP INDEX IF EXISTS idx_club_profiles_club_mission;
DROP INDEX IF EXISTS idx_club_profiles_region;
DROP INDEX IF EXISTS idx_club_profiles_meeting_type;
DROP INDEX IF EXISTS idx_club_profiles_meeting_day;
DROP INDEX IF EXISTS idx_club_profiles_club_id;
DROP INDEX IF EXISTS idx_club_profiles_time_zone;
DROP INDEX IF EXISTS idx_club_profiles_meeting_frequency;

-- Drop unused executive committee grouping indexes  
DROP INDEX IF EXISTS idx_club_profiles_president_grouping;
DROP INDEX IF EXISTS idx_club_profiles_ipp_grouping;
DROP INDEX IF EXISTS idx_club_profiles_vpe_grouping;
DROP INDEX IF EXISTS idx_club_profiles_vpm_grouping;
DROP INDEX IF EXISTS idx_club_profiles_vppr_grouping;
DROP INDEX IF EXISTS idx_club_profiles_secretary_grouping;
DROP INDEX IF EXISTS idx_club_profiles_treasurer_grouping;
DROP INDEX IF EXISTS idx_club_profiles_saa_grouping;
DROP INDEX IF EXISTS idx_club_profiles_area_director_grouping;
DROP INDEX IF EXISTS idx_club_profiles_division_director_grouping;
DROP INDEX IF EXISTS idx_club_profiles_district_director_grouping;
DROP INDEX IF EXISTS idx_club_profiles_program_quality_director_grouping;
DROP INDEX IF EXISTS idx_club_profiles_club_growth_director_grouping;

-- Drop unused poll indexes
DROP INDEX IF EXISTS idx_polls_meeting_id;
DROP INDEX IF EXISTS idx_polls_created_by;
DROP INDEX IF EXISTS idx_poll_items_question_id;
DROP INDEX IF EXISTS idx_poll_items_is_active;
DROP INDEX IF EXISTS idx_poll_votes_poll_id;
DROP INDEX IF EXISTS idx_poll_votes_question_id;
DROP INDEX IF EXISTS idx_poll_votes_option_id;
DROP INDEX IF EXISTS idx_poll_votes_poll_question;
DROP INDEX IF EXISTS idx_poll_votes_created_at;
DROP INDEX IF EXISTS idx_polls_questions_active;
DROP INDEX IF EXISTS idx_polls_club_status;
DROP INDEX IF EXISTS idx_simple_poll_votes_question_id;

-- Drop unused evaluation pathway indexes
DROP INDEX IF EXISTS idx_app_evaluation_pathway_updated_by;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_evaluation_title;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_table_topics_title;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_meeting_evaluation_title;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_meeting_table_topics_title;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_assigned_evaluator_id;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_evaluator_comments;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_is_locked;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_vpe_approval_request_id;
DROP INDEX IF EXISTS idx_app_evaluation_pathway_vpe_approval_decision_id;

-- Drop unused table topic indexes
DROP INDEX IF EXISTS idx_table_topic_questions_is_published;
DROP INDEX IF EXISTS idx_table_topic_questions_is_used;
DROP INDEX IF EXISTS idx_tabletopicscorner_meeting_participant_active;
DROP INDEX IF EXISTS idx_tabletopics_created_at;

-- Drop unused prepared speech evaluation indexes
DROP INDEX IF EXISTS idx_prepared_speech_eval_status;

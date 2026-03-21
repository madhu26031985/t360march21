/*
  # Remove Duplicate Indexes

  1. Cleanup
    - Remove duplicate indexes that provide the same functionality
    - Keep the most descriptive or original index name
  
  2. Indexes Removed
    - idx_app_club_user_relationship_active_members (duplicate of idx_club_user_relationship_club_auth)
    - idx_app_evaluation_pathway_assigned_evaluator_id (duplicate of idx_evaluation_pathway_evaluator_id)
*/

-- Drop duplicate index for app_club_user_relationship
DROP INDEX IF EXISTS idx_app_club_user_relationship_active_members;

-- Drop duplicate index for app_evaluation_pathway
DROP INDEX IF EXISTS idx_app_evaluation_pathway_assigned_evaluator_id;

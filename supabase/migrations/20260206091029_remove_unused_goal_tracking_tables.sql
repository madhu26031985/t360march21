/*
  # Remove Unused Goal Tracking and Temporary Tables

  1. Tables to Remove
    - `user_goals` - Unused goal tracking table with 1 test record
    - `user_goal_progress` - Unused progress tracking table with 1 test record
    - `pallikaranai_users_temp` - Temporary bulk import table with 23 records
  
  2. Views to Remove
    - `user_goals_with_progress` - View dependent on unused goal tables
  
  3. Functions to Remove
    - `initialize_goal_progress()` - Auto-creates progress records for new goals
    - `update_user_goals_updated_at()` - Updates timestamps on goal changes
    - `sync_goal_progress_from_metrics()` - Syncs progress from metrics (broken - references non-existent pathway_projects table)
  
  4. Triggers to Remove
    - `trigger_initialize_goal_progress` - On user_goals table
    - `trigger_update_user_goals_updated_at` - On user_goals table
    - `trigger_sync_goal_progress_on_metrics_change` - On user_performance_metrics table
  
  ## Notes
  - No application code references these tables
  - No UI exists for goal tracking functionality
  - Tables only contain test/sample data
  - Safe to remove without data loss concerns
*/

-- Drop triggers first (only on existing tables)
DROP TRIGGER IF EXISTS trigger_sync_goal_progress_on_metrics_change ON user_performance_metrics;
DROP TRIGGER IF EXISTS trigger_initialize_goal_progress ON user_goals;
DROP TRIGGER IF EXISTS trigger_update_user_goals_updated_at ON user_goals;

-- Drop the view
DROP VIEW IF EXISTS user_goals_with_progress;

-- Drop the tables (this will cascade delete any remaining constraints)
DROP TABLE IF EXISTS user_goal_progress CASCADE;
DROP TABLE IF EXISTS user_goals CASCADE;
DROP TABLE IF EXISTS pallikaranai_users_temp CASCADE;

-- Drop the functions
DROP FUNCTION IF EXISTS initialize_goal_progress();
DROP FUNCTION IF EXISTS update_user_goals_updated_at();
DROP FUNCTION IF EXISTS sync_goal_progress_from_metrics();

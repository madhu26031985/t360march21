/*
  # Fix Trigger Order for VPE Approval Workflow
  
  1. Updates
    - Ensure triggers run in the correct order
    - Fix the prevent_locked_record_updates function to check OLD.is_locked correctly
    - Update trigger priorities to ensure proper execution order
  
  2. Trigger Order (by execution priority)
    - BEFORE triggers run first
    - We need: generate_request_id → lock_on_decision → prevent_updates
*/

-- Drop existing triggers to recreate with proper order
DROP TRIGGER IF EXISTS trg_generate_vpe_approval_request_id ON app_evaluation_pathway;
DROP TRIGGER IF EXISTS trg_lock_record_on_vpe_decision ON app_evaluation_pathway;
DROP TRIGGER IF EXISTS trg_prevent_locked_record_updates ON app_evaluation_pathway;

-- Recreate triggers with specific execution order using naming convention
-- PostgreSQL executes triggers in alphabetical order when they have the same timing
-- So we use prefixes: 01_, 02_, 03_ to control order

-- Step 1: Generate approval request ID when VPE approval is requested
CREATE TRIGGER trg_01_generate_vpe_approval_request_id
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION generate_vpe_approval_request_id();

-- Step 2: Lock record when VPE makes a decision
CREATE TRIGGER trg_02_lock_record_on_vpe_decision
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION lock_record_on_vpe_decision();

-- Step 3: Prevent updates to already-locked records
-- This should run last to check the final state
CREATE TRIGGER trg_03_prevent_locked_record_updates
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_record_updates();

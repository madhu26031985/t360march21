/*
  # Fix Existing Records with vpe_approved = false to NULL
  
  This migration updates existing speech records that were incorrectly set to 
  vpe_approved = false due to the DEFAULT false constraint. These should be 
  NULL (Open Request) instead.
*/

-- Temporarily disable the updated_by trigger
ALTER TABLE app_evaluation_pathway DISABLE TRIGGER trigger_update_app_evaluation_pathway_updated_by;

-- Update records that should be open requests (NULL) instead of false
UPDATE app_evaluation_pathway
SET 
  vpe_approved = NULL,
  updated_at = now()
WHERE vpe_approved = false 
  AND vpe_approval_decision_id IS NULL
  AND is_locked = false
  AND vpe_approval_requested = true;

-- Re-enable the trigger
ALTER TABLE app_evaluation_pathway ENABLE TRIGGER trigger_update_app_evaluation_pathway_updated_by;

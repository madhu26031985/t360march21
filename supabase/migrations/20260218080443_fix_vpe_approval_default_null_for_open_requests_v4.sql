/*
  # Fix VPE Approval Default - Should be NULL for Open Requests
  
  1. Problem
    - The `vpe_approved` column has `DEFAULT false` which causes new speech requests to be automatically marked as "Denied"
    - When a speaker requests VPE approval, the status should be "Open Request" (NULL) until VPE makes a decision
    - Only after VPE explicitly approves (true) or denies (false) should the value be set
    
  2. Changes
    - Remove the default value from `vpe_approved` column (make it nullable with no default)
    - Update the trigger to ensure proper locking behavior
    
  3. Expected Behavior After Fix
    - When speech is submitted for approval: `vpe_approved = NULL` (Open Request)
    - When VPE approves: `vpe_approved = true` (Approved, record locks)
    - When VPE denies: `vpe_approved = false` (Denied, record locks)
*/

-- Step 1: Remove the default value from vpe_approved column
ALTER TABLE app_evaluation_pathway 
ALTER COLUMN vpe_approved DROP DEFAULT;

-- Step 2: Update the trigger to ensure NULL is used for open requests
-- The trigger should only lock when VPE makes an explicit decision (not when default false is set)
CREATE OR REPLACE FUNCTION lock_record_on_vpe_decision()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If VPE has made a decision (approved = true or false, and it wasn't set before)
  -- This checks if vpe_approved is being changed FROM NULL TO a boolean value
  -- AND we don't already have a decision ID (to avoid duplicate locks)
  IF NEW.vpe_approved IS NOT NULL 
     AND OLD.vpe_approved IS NULL 
     AND NEW.vpe_approval_decision_id IS NULL THEN
    -- Generate unique decision ID
    NEW.vpe_approval_decision_id = gen_random_uuid();
    NEW.vpe_approved_at = now();
    
    -- Lock the record
    NEW.is_locked = true;
    NEW.locked_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Add comment for documentation
COMMENT ON COLUMN app_evaluation_pathway.vpe_approved IS 'NULL = Open Request (pending VPE decision), true = Approved by VPE, false = Denied by VPE. Must be NULL when no decision has been made yet.';

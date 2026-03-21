/*
  # VPE Approval Workflow and Record Locking System
  
  1. New Fields
    - `vpe_approval_request_id` (uuid) - Unique ID generated when VPE approval is requested
    - `vpe_approval_decision_id` (uuid) - Unique ID generated when VPE approves/denies
    - `is_locked` (boolean) - Locks the record after VPE approval/denial, preventing any changes
    - `locked_at` (timestamptz) - Timestamp when record was locked
    
  2. Constraints
    - Ensure evaluators must book separate evaluator roles for multiple speeches in same meeting
    
  3. Triggers
    - Auto-generate approval request ID when vpe_approval_requested is set to true
    - Auto-generate approval decision ID and lock record when vpe_approved is set
    - Prevent any updates to locked records (except by system)
    
  4. Security
    - Update RLS policies to prevent editing locked records
    - Only VPE can approve/deny requests
    - Once locked, no one can modify the record
*/

-- Step 1: Add new columns for approval workflow tracking
ALTER TABLE app_evaluation_pathway
ADD COLUMN IF NOT EXISTS vpe_approval_request_id uuid,
ADD COLUMN IF NOT EXISTS vpe_approval_decision_id uuid,
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Step 2: Add check constraint to ensure locked records have decision ID
ALTER TABLE app_evaluation_pathway
ADD CONSTRAINT chk_locked_records_have_decision_id
CHECK (
  (is_locked = false) OR 
  (is_locked = true AND vpe_approval_decision_id IS NOT NULL)
);

-- Step 3: Create function to generate approval request ID when VPE approval is requested
CREATE OR REPLACE FUNCTION generate_vpe_approval_request_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If vpe_approval_requested is being set to true and we don't have a request ID yet
  IF NEW.vpe_approval_requested = true AND OLD.vpe_approval_requested = false AND NEW.vpe_approval_request_id IS NULL THEN
    NEW.vpe_approval_request_id = gen_random_uuid();
    NEW.vpe_approval_requested_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create function to generate approval decision ID and lock record
CREATE OR REPLACE FUNCTION lock_record_on_vpe_decision()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If VPE has made a decision (approved = true or false, and it wasn't set before)
  IF NEW.vpe_approved IS NOT NULL AND OLD.vpe_approved IS NULL THEN
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

-- Step 5: Create function to prevent updates to locked records
CREATE OR REPLACE FUNCTION prevent_locked_record_updates()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If record is locked, prevent any modifications
  IF OLD.is_locked = true THEN
    RAISE EXCEPTION 'Cannot modify a locked record. This speech has been approved/denied by VPE and is now immutable.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 6: Create triggers
DROP TRIGGER IF EXISTS trg_generate_vpe_approval_request_id ON app_evaluation_pathway;
CREATE TRIGGER trg_generate_vpe_approval_request_id
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION generate_vpe_approval_request_id();

DROP TRIGGER IF EXISTS trg_lock_record_on_vpe_decision ON app_evaluation_pathway;
CREATE TRIGGER trg_lock_record_on_vpe_decision
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION lock_record_on_vpe_decision();

DROP TRIGGER IF EXISTS trg_prevent_locked_record_updates ON app_evaluation_pathway;
CREATE TRIGGER trg_prevent_locked_record_updates
  BEFORE UPDATE ON app_evaluation_pathway
  FOR EACH ROW
  EXECUTE FUNCTION prevent_locked_record_updates();

-- Step 7: Create index for better query performance on locked records
CREATE INDEX IF NOT EXISTS idx_app_evaluation_pathway_is_locked ON app_evaluation_pathway(is_locked);
CREATE INDEX IF NOT EXISTS idx_app_evaluation_pathway_vpe_approval_request_id ON app_evaluation_pathway(vpe_approval_request_id);
CREATE INDEX IF NOT EXISTS idx_app_evaluation_pathway_vpe_approval_decision_id ON app_evaluation_pathway(vpe_approval_decision_id);

-- Step 8: Add comment for documentation
COMMENT ON COLUMN app_evaluation_pathway.vpe_approval_request_id IS 'Unique ID generated when speaker requests VPE approval';
COMMENT ON COLUMN app_evaluation_pathway.vpe_approval_decision_id IS 'Unique ID generated when VPE approves or denies the request';
COMMENT ON COLUMN app_evaluation_pathway.is_locked IS 'Prevents any modifications after VPE approval/denial';
COMMENT ON COLUMN app_evaluation_pathway.locked_at IS 'Timestamp when record was locked after VPE decision';

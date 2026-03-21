/*
  # Add VPE Approval Fields to Evaluation Pathway
  
  1. Changes
    - Add `vpe_approval_requested` boolean field to track if the speaker has submitted their speech for VPE approval
    - Add `vpe_approval_requested_at` timestamp to track when the approval was requested
    - Add `vpe_approved` boolean field to track if VPE has approved the speech
    - Add `vpe_approved_at` timestamp to track when VPE approved
    - Add `vpe_approved_by` uuid field to track which VPE member approved
  
  2. Security
    - No RLS changes needed as the table already has proper policies
  
  3. Notes
    - Once `vpe_approval_requested` is true, speakers should not be able to edit speech details
    - VPE can approve speeches from the VPE Corner
    - This helps track the speech completion workflow
*/

-- Add VPE approval fields to app_evaluation_pathway
DO $$
BEGIN
  -- Add vpe_approval_requested field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_evaluation_pathway' AND column_name = 'vpe_approval_requested'
  ) THEN
    ALTER TABLE app_evaluation_pathway 
    ADD COLUMN vpe_approval_requested BOOLEAN DEFAULT false;
  END IF;

  -- Add vpe_approval_requested_at field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_evaluation_pathway' AND column_name = 'vpe_approval_requested_at'
  ) THEN
    ALTER TABLE app_evaluation_pathway 
    ADD COLUMN vpe_approval_requested_at TIMESTAMPTZ;
  END IF;

  -- Add vpe_approved field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_evaluation_pathway' AND column_name = 'vpe_approved'
  ) THEN
    ALTER TABLE app_evaluation_pathway 
    ADD COLUMN vpe_approved BOOLEAN DEFAULT false;
  END IF;

  -- Add vpe_approved_at field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_evaluation_pathway' AND column_name = 'vpe_approved_at'
  ) THEN
    ALTER TABLE app_evaluation_pathway 
    ADD COLUMN vpe_approved_at TIMESTAMPTZ;
  END IF;

  -- Add vpe_approved_by field
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_evaluation_pathway' AND column_name = 'vpe_approved_by'
  ) THEN
    ALTER TABLE app_evaluation_pathway 
    ADD COLUMN vpe_approved_by UUID REFERENCES app_user_profiles(id);
  END IF;
END $$;

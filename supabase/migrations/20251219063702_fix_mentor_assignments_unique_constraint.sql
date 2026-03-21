/*
  # Fix Mentor Assignments Unique Constraint

  ## Summary
  Removes the overly restrictive unique constraint that prevents multiple cancelled/completed
  assignments for the same mentee. We rely on the partial unique index instead, which only
  enforces uniqueness for active mentorships.

  ## Changes
  1. Drop the problematic UNIQUE constraint on (club_id, mentee_id, status)
  2. Keep the partial unique index that only applies to active status
  
  ## Notes
  - This allows a mentee to have multiple historical (cancelled/completed) mentor assignments
  - Only one active mentorship per mentee per club is enforced via the partial index
*/

-- Drop the overly restrictive unique constraint
ALTER TABLE mentor_assignments 
  DROP CONSTRAINT IF EXISTS one_active_mentee_per_club;

-- Verify the partial unique index exists (it should from the previous migration)
-- This ensures only one active mentorship per mentee per club
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_mentorship_per_mentee 
  ON mentor_assignments(club_id, mentee_id) 
  WHERE status = 'active';
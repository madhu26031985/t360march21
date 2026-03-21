/*
  # Update Voting Question to Role Classification Mapping

  Updates the mapping between voting questions and role classifications to match the new requirements:

  1. **Best Role Player**
     - Maps to: Key Speakers only
     - Includes: Toastmaster of the Day, General Evaluator, Table Topics Master

  2. **Best Prepared Speaker**
     - Maps to: Prepared Speaker
     - Includes: Ice Breaker Speeches, Prepared Speakers

  3. **Best Speech Evaluator**
     - Maps to: Speech evaluvator, Master evaluvator, TT _ Evaluvator
     - Includes: Evaluator 1-5, Master Evaluator 1-3, Table Topic Evaluator 1-3

  4. **Best Table Topics Speaker**
     - Maps to: On-the-Spot Speaking
     - Includes: Table Topics Speaker 1-12

  5. **Best Ancillary Speaker**
     - Maps to: Tag roles
     - Includes: Timer, Ah Counter, Grammarian

  ## Changes
  - Best Role Player now only includes Key Speakers (removed Tag roles, Club Speakers, Educational speaker)
  - Best Speech Evaluator now includes TT _ Evaluvator
  - Best Table Topics Speaker now only includes On-the-Spot Speaking (removed TT _ Evaluvator)
  - Best Ancillary Speaker now maps to Tag roles (changed from Ancillary Speaker)
*/

CREATE OR REPLACE FUNCTION get_role_classifications_for_voting_question(question_text TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Map voting questions to role classifications
  
  -- Best Prepared Speaker
  IF question_text ILIKE '%Best Prepared Speaker%' THEN
    RETURN ARRAY['Prepared Speaker'];
  
  -- Best Speech Evaluator (includes Speech evaluator, Master evaluator, and TT evaluators)
  ELSIF question_text ILIKE '%Best Speech Evaluator%' OR question_text ILIKE '%Best Evaluator%' THEN
    RETURN ARRAY['Speech evaluvator', 'Master evaluvator', 'TT _ Evaluvator'];
  
  -- Best Table Topics Speaker (only On-the-Spot Speaking)
  ELSIF question_text ILIKE '%Best Table Topics Speaker%' OR question_text ILIKE '%Table Topics Speaker%' THEN
    RETURN ARRAY['On-the-Spot Speaking'];
  
  -- Best Ancillary Speaker (Timer, Ah Counter, Grammarian)
  ELSIF question_text ILIKE '%Best Ancillary Speaker%' OR question_text ILIKE '%Ancillary%' THEN
    RETURN ARRAY['Tag roles'];
  
  -- Best Role Player (only Key Speakers: Toastmaster, General Evaluator, Table Topics Master)
  ELSIF question_text ILIKE '%Best Role Player%' OR question_text ILIKE '%Role Player%' THEN
    RETURN ARRAY['Key Speakers'];
  
  -- Default: return empty array if no match
  ELSE
    RETURN ARRAY[]::TEXT[];
  END IF;
END;
$$;

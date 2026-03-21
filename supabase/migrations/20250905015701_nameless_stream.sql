/*
  # Extend collaboration_type enum for Meeting Collaboration

  1. Schema Changes
    - Extend the collaboration_type enum in app_meeting_collaboration table
    - Add support for 'idiom', 'phrase', and 'quote' collaboration types
    - Update the check constraint to include new types

  2. New Collaboration Types
    - 'idiom' - For idiom of the day contributions
    - 'phrase' - For phrase of the day contributions  
    - 'quote' - For quote of the day contributions

  3. Security
    - No changes to existing RLS policies
    - Maintains existing access controls
*/

-- Add new collaboration types to the enum constraint
ALTER TABLE app_meeting_collaboration 
DROP CONSTRAINT IF EXISTS chk_app_meeting_collaboration_type;

ALTER TABLE app_meeting_collaboration 
ADD CONSTRAINT chk_app_meeting_collaboration_type 
CHECK (collaboration_type = ANY (ARRAY['speech'::text, 'evaluation'::text, 'word'::text, 'theme'::text, 'education'::text, 'idiom'::text, 'phrase'::text, 'quote'::text]));
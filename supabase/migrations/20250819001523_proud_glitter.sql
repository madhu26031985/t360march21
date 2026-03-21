/*
  # Fix Table Topics Speaker Ordering and Limit Count

  1. Updates
    - Fix the auto_populate_meeting_roles function to properly order Table Topics Speakers numerically
    - Limit Table Topics Speakers to a reasonable number (1-8 instead of 1-15)
    - Ensure proper sorting by extracting numeric part from role names

  2. Changes
    - Modified the function to use proper numeric ordering for Table Topics Speakers
    - Limited the maximum number of Table Topics Speakers to 8
    - Improved the ordering logic to handle numeric sorting correctly
*/

CREATE OR REPLACE FUNCTION auto_populate_meeting_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert meeting roles from role_types, excluding certain evaluator roles and limiting table topics
  INSERT INTO app_meeting_roles_management (
    meeting_id,
    role_id,
    role_name,
    role_metric,
    assigned_user_id,
    is_required,
    max_participants,
    order_index,
    club_id,
    role_classification
  )
  SELECT 
    NEW.id,
    rt.id,
    rt.display_name,
    rt.metric_type,
    NULL,
    rt.is_required,
    rt.max_participants,
    -- Custom ordering logic for proper numeric sorting
    CASE 
      -- Table Topics Speakers: extract number and sort numerically
      WHEN rt.display_name LIKE 'Table Topics Speaker %' THEN 
        1000 + CAST(REGEXP_REPLACE(rt.display_name, '[^0-9]', '', 'g') AS INTEGER)
      -- Evaluators: extract number and sort numerically  
      WHEN rt.display_name LIKE 'Evaluator %' THEN 
        2000 + CAST(REGEXP_REPLACE(rt.display_name, '[^0-9]', '', 'g') AS INTEGER)
      -- All other roles use their existing order_index
      ELSE rt.order_index
    END,
    NEW.club_id,
    rt.role_grouping
  FROM role_types rt
  WHERE rt.is_active = true
    -- Exclude Evaluator 4, 5, 6 and higher
    AND rt.display_name NOT LIKE 'Evaluator 4%'
    AND rt.display_name NOT LIKE 'Evaluator 5%' 
    AND rt.display_name NOT LIKE 'Evaluator 6%'
    AND rt.display_name NOT LIKE 'Evaluator 7%'
    AND rt.display_name NOT LIKE 'Evaluator 8%'
    AND rt.display_name NOT LIKE 'Evaluator 9%'
    -- Limit Table Topics Speakers to 1-8 only
    AND NOT (rt.display_name LIKE 'Table Topics Speaker %' AND 
             CAST(REGEXP_REPLACE(rt.display_name, '[^0-9]', '', 'g') AS INTEGER) > 8)
  ORDER BY 
    -- Custom ordering for proper numeric sorting
    CASE 
      WHEN rt.display_name LIKE 'Table Topics Speaker %' THEN 
        1000 + CAST(REGEXP_REPLACE(rt.display_name, '[^0-9]', '', 'g') AS INTEGER)
      WHEN rt.display_name LIKE 'Evaluator %' THEN 
        2000 + CAST(REGEXP_REPLACE(rt.display_name, '[^0-9]', '', 'g') AS INTEGER)
      ELSE rt.order_index
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
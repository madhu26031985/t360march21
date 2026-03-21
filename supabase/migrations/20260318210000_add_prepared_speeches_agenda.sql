-- Snapshot of Prepared Speaker slots (1–3) on the Prepared Speeches Session agenda row.
-- Populated from app_evaluation_pathway via admin Auto Fill; per-slot visibility for members.

ALTER TABLE meeting_agenda_items
ADD COLUMN IF NOT EXISTS prepared_speeches_agenda jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN meeting_agenda_items.prepared_speeches_agenda IS
  'Array of slots: speaker_name, speech_title, pathway, level, project, evaluation_form, evaluator, is_visible, booked, pathway_id, role_name.';

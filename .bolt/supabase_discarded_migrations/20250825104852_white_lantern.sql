@@ .. @@
 DO $$
 BEGIN
   -- Add club_verification_required to notifications type constraint if not exists
   IF NOT EXISTS (
-        SELECT 1 FROM information_schema.check_constraints 
-        WHERE constraint_name = 'chk_notifications_type'
-        AND table_name = 'notifications'
+        SELECT 1 FROM information_schema.constraint_column_usage 
+        WHERE constraint_name = 'chk_notifications_type'
+        AND table_name = 'notifications'
+        AND table_schema = 'public'
     ) THEN
         -- If constraint doesn't exist, we need to add it
         -- First check if the constraint exists with a different approach
         IF NOT EXISTS (
             SELECT 1 FROM pg_constraint c
             JOIN pg_class t ON c.conrelid = t.oid
             JOIN pg_namespace n ON t.relnamespace = n.oid
             WHERE c.conname = 'chk_notifications_type'
             AND t.relname = 'notifications'
             AND n.nspname = 'public'
         ) THEN
             ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
             CHECK (type = ANY (ARRAY['general'::text, 'club_added'::text, 'role_changed'::text, 'meeting_reminder'::text, 'award_received'::text, 'club_verification_required'::text]));
         ELSE
             -- Constraint exists, drop and recreate with new value
             ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
             ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
             CHECK (type = ANY (ARRAY['general'::text, 'club_added'::text, 'role_changed'::text, 'meeting_reminder'::text, 'award_received'::text, 'club_verification_required'::text]));
         END IF;
     ELSE
         -- Constraint exists, drop and recreate with new value
         ALTER TABLE notifications DROP CONSTRAINT chk_notifications_type;
         ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
         CHECK (type = ANY (ARRAY['general'::text, 'club_added'::text, 'role_changed'::text, 'meeting_reminder'::text, 'award_received'::text, 'club_verification_required'::text]));
     END IF;
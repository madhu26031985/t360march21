/*
  # Add Notification Trigger for Inactive Clubs

  1. New Functions
    - `send_inactive_club_notification()` - Sends verification reminder to ExComm
    - `schedule_inactive_club_notifications()` - Schedules recurring notifications

  2. New Triggers
    - Trigger on club creation when active = false
    - Trigger on club status change to inactive
    - Recurring notification system

  3. Security
    - Only sends to ExComm members of the specific club
    - Prevents spam by checking existing notifications
*/

-- Function to send notification to ExComm members of inactive clubs
CREATE OR REPLACE FUNCTION send_inactive_club_notification()
RETURNS TRIGGER AS $$
DECLARE
    excomm_member RECORD;
    club_name_var TEXT;
BEGIN
    -- Only proceed if club is inactive
    IF NEW.active = true THEN
        RETURN NEW;
    END IF;

    -- Get club name
    SELECT name INTO club_name_var FROM clubs WHERE id = NEW.id;
    
    -- Find all ExComm members for this club
    FOR excomm_member IN 
        SELECT DISTINCT aup.id, aup.full_name, aup.email
        FROM app_club_user_relationship acur
        JOIN app_user_profiles aup ON acur.user_id = aup.id
        WHERE acur.club_id = NEW.id 
        AND acur.role = 'excomm' 
        AND acur.is_authenticated = true
    LOOP
        -- Check if notification already exists in last 24 hours to prevent spam
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE user_id = excomm_member.id 
            AND type = 'club_verification_required'
            AND data->>'club_id' = NEW.id::text
            AND created_at > NOW() - INTERVAL '24 hours'
        ) THEN
            -- Insert notification
            INSERT INTO notifications (
                user_id,
                title,
                message,
                type,
                is_read,
                data,
                created_at
            ) VALUES (
                excomm_member.id,
                'Club Verification Required',
                'Contact support to complete your verification as ExComm of ' || COALESCE(club_name_var, 'your club') || '. Your club is currently inactive and needs verification.',
                'club_verification_required',
                false,
                jsonb_build_object(
                    'club_id', NEW.id,
                    'club_name', club_name_var,
                    'verification_required', true,
                    'contact_support', true
                ),
                NOW()
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send recurring notifications for inactive clubs
CREATE OR REPLACE FUNCTION send_recurring_inactive_notifications()
RETURNS void AS $$
DECLARE
    inactive_club RECORD;
    excomm_member RECORD;
BEGIN
    -- Find all inactive clubs
    FOR inactive_club IN 
        SELECT id, name FROM clubs WHERE active = false
    LOOP
        -- Find ExComm members for each inactive club
        FOR excomm_member IN 
            SELECT DISTINCT aup.id, aup.full_name, aup.email
            FROM app_club_user_relationship acur
            JOIN app_user_profiles aup ON acur.user_id = aup.id
            WHERE acur.club_id = inactive_club.id 
            AND acur.role = 'excomm' 
            AND acur.is_authenticated = true
        LOOP
            -- Check if notification already exists in last 24 hours
            IF NOT EXISTS (
                SELECT 1 FROM notifications 
                WHERE user_id = excomm_member.id 
                AND type = 'club_verification_required'
                AND data->>'club_id' = inactive_club.id::text
                AND created_at > NOW() - INTERVAL '24 hours'
            ) THEN
                -- Insert recurring notification
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    type,
                    is_read,
                    data,
                    created_at
                ) VALUES (
                    excomm_member.id,
                    'Club Verification Still Required',
                    'Your club "' || inactive_club.name || '" is still inactive. Please contact support to complete your ExComm verification process.',
                    'club_verification_required',
                    false,
                    jsonb_build_object(
                        'club_id', inactive_club.id,
                        'club_name', inactive_club.name,
                        'verification_required', true,
                        'contact_support', true,
                        'recurring_reminder', true
                    ),
                    NOW()
                );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new inactive clubs
DROP TRIGGER IF EXISTS trigger_notify_inactive_club_creation ON clubs;
CREATE TRIGGER trigger_notify_inactive_club_creation
    AFTER INSERT ON clubs
    FOR EACH ROW
    WHEN (NEW.active = false)
    EXECUTE FUNCTION send_inactive_club_notification();

-- Trigger for clubs becoming inactive
DROP TRIGGER IF EXISTS trigger_notify_club_deactivation ON clubs;
CREATE TRIGGER trigger_notify_club_deactivation
    AFTER UPDATE OF active ON clubs
    FOR EACH ROW
    WHEN (OLD.active = true AND NEW.active = false)
    EXECUTE FUNCTION send_inactive_club_notification();

-- Add new notification type to constraint if it doesn't exist
DO $$
BEGIN
    -- Check if the constraint exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_notifications_type'
        AND table_name = 'notifications'
    ) THEN
        -- Drop the existing constraint
        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_type;
        
        -- Add updated constraint with new type
        ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type 
        CHECK (type = ANY (ARRAY[
            'general'::text, 
            'club_added'::text, 
            'role_changed'::text, 
            'meeting_reminder'::text, 
            'award_received'::text,
            'club_verification_required'::text
        ]));
    END IF;
END $$;

-- Create a function to manually trigger recurring notifications (can be called periodically)
COMMENT ON FUNCTION send_recurring_inactive_notifications() IS 
'Call this function periodically (e.g., daily) to send reminder notifications to ExComm members of inactive clubs. Can be triggered by a cron job or scheduled task.';
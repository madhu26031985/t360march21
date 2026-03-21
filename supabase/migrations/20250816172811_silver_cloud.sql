/*
  # Migrate bio data from user_profiles to app_user_profiles

  1. Data Migration
    - Copy `bio` field from `user_profiles` table
    - Update `About` field in `app_user_profiles` table
    - Only update NULL or empty About fields to preserve existing data

  2. Safety Features
    - Non-destructive migration (preserves existing data)
    - Detailed logging for each record processed
    - Error handling for individual record failures
    - Final verification and statistics

  3. Migration Process
    - Match records by user ID between tables
    - Skip NULL or empty bio values
    - Update only when About field is empty
    - Log all operations for audit trail
*/

DO $$
DECLARE
    migration_record RECORD;
    migration_count INTEGER := 0;
    success_count INTEGER := 0;
    error_count INTEGER := 0;
    total_candidates INTEGER := 0;
    total_about_after INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Starting Bio to About Migration ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    
    -- Count total candidates for migration
    SELECT COUNT(*) INTO total_candidates
    FROM user_profiles up
    INNER JOIN app_user_profiles aup ON up.id = aup.id
    WHERE up.bio IS NOT NULL 
      AND TRIM(up.bio) != ''
      AND (aup."About" IS NULL OR TRIM(aup."About") = '');
    
    RAISE NOTICE 'Total candidates for bio migration: %', total_candidates;
    
    -- Perform the migration
    FOR migration_record IN
        SELECT 
            up.id,
            up.bio,
            aup."About" as current_about,
            aup.full_name
        FROM user_profiles up
        INNER JOIN app_user_profiles aup ON up.id = aup.id
        WHERE up.bio IS NOT NULL 
          AND TRIM(up.bio) != ''
          AND (aup."About" IS NULL OR TRIM(aup."About") = '')
    LOOP
        BEGIN
            migration_count := migration_count + 1;
            
            -- Update the About field
            UPDATE app_user_profiles 
            SET 
                "About" = migration_record.bio,
                updated_at = NOW()
            WHERE id = migration_record.id;
            
            success_count := success_count + 1;
            
            RAISE NOTICE 'SUCCESS [%/%]: Migrated bio for user % (ID: %)', 
                migration_count, total_candidates, migration_record.full_name, migration_record.id;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE 'ERROR [%/%]: Failed to migrate bio for user % (ID: %) - %', 
                migration_count, total_candidates, migration_record.full_name, migration_record.id, SQLERRM;
        END;
    END LOOP;
    
    -- Final verification
    SELECT COUNT(*) INTO total_about_after
    FROM app_user_profiles
    WHERE "About" IS NOT NULL AND TRIM("About") != '';
    
    -- Migration summary
    RAISE NOTICE '=== Bio to About Migration Summary ===';
    RAISE NOTICE 'Total candidates processed: %', migration_count;
    RAISE NOTICE 'Successful migrations: %', success_count;
    RAISE NOTICE 'Failed migrations: %', error_count;
    
    IF migration_count > 0 THEN
        RAISE NOTICE 'Success rate: %.1f%%', (success_count::DECIMAL / migration_count::DECIMAL) * 100;
    END IF;
    
    RAISE NOTICE 'Total About fields populated after migration: %', total_about_after;
    RAISE NOTICE 'Migration completed at: %', NOW();
    RAISE NOTICE '=== End Bio Migration ===';
    
END $$;
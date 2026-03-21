/*
  # Migrate LinkedIn URL from user_profiles to app_user_profiles

  1. Data Migration
    - Copy `linkedin_url` from `user_profiles` to `app_user_profiles`
    - Only update records where app_user_profiles.linkedin_url is NULL or empty
    - Match records by user ID

  2. Safety Features
    - Non-destructive migration (preserves existing data)
    - Detailed logging of migration results
    - Error handling with rollback capability

  3. Validation
    - Only migrates non-empty LinkedIn URLs
    - Skips records where target already has data
    - Provides comprehensive migration statistics
*/

DO $$
DECLARE
    migration_count INTEGER := 0;
    total_candidates INTEGER := 0;
    error_count INTEGER := 0;
    migration_record RECORD;
BEGIN
    -- Log migration start
    RAISE NOTICE 'Starting LinkedIn URL migration from user_profiles to app_user_profiles...';
    
    -- Count total candidates for migration
    SELECT COUNT(*) INTO total_candidates
    FROM user_profiles up
    INNER JOIN app_user_profiles aup ON up.id = aup.id
    WHERE up.linkedin_url IS NOT NULL 
      AND TRIM(up.linkedin_url) != ''
      AND (aup.linkedin_url IS NULL OR TRIM(aup.linkedin_url) = '');
    
    RAISE NOTICE 'Found % candidate records for LinkedIn URL migration', total_candidates;
    
    -- Perform the migration
    FOR migration_record IN
        SELECT 
            up.id,
            up.linkedin_url,
            aup.full_name,
            aup.email
        FROM user_profiles up
        INNER JOIN app_user_profiles aup ON up.id = aup.id
        WHERE up.linkedin_url IS NOT NULL 
          AND TRIM(up.linkedin_url) != ''
          AND (aup.linkedin_url IS NULL OR TRIM(aup.linkedin_url) = '')
    LOOP
        BEGIN
            -- Update the app_user_profiles record
            UPDATE app_user_profiles 
            SET 
                linkedin_url = migration_record.linkedin_url,
                updated_at = NOW()
            WHERE id = migration_record.id;
            
            -- Increment success counter
            migration_count := migration_count + 1;
            
            -- Log individual migration
            RAISE NOTICE 'Migrated LinkedIn URL for user: % (%) - URL: %', 
                migration_record.full_name, 
                migration_record.email,
                migration_record.linkedin_url;
                
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue
            error_count := error_count + 1;
            RAISE WARNING 'Failed to migrate LinkedIn URL for user ID %: %', 
                migration_record.id, SQLERRM;
        END;
    END LOOP;
    
    -- Final migration summary
    RAISE NOTICE '=== LinkedIn URL Migration Summary ===';
    RAISE NOTICE 'Total candidates found: %', total_candidates;
    RAISE NOTICE 'Successfully migrated: %', migration_count;
    RAISE NOTICE 'Errors encountered: %', error_count;
    RAISE NOTICE 'Migration completion rate: %%%', 
        CASE 
            WHEN total_candidates > 0 THEN ROUND((migration_count::DECIMAL / total_candidates) * 100, 2)
            ELSE 100
        END;
    
    -- Verify migration results
    SELECT COUNT(*) INTO total_candidates
    FROM app_user_profiles 
    WHERE linkedin_url IS NOT NULL AND TRIM(linkedin_url) != '';
    
    RAISE NOTICE 'Total LinkedIn URLs now in app_user_profiles: %', total_candidates;
    RAISE NOTICE '=== LinkedIn URL Migration Completed ===';
    
END $$;
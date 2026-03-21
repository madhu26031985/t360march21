/*
  # Migrate Instagram URLs from user_profiles to app_user_profiles

  1. Data Migration
    - Copy `instagram_url` from `user_profiles` to `instagram_url` in `app_user_profiles`
    - Only update NULL or empty fields in app_user_profiles
    - Preserve existing Instagram URLs in app_user_profiles

  2. Safety Features
    - Non-destructive migration (won't overwrite existing data)
    - Detailed logging of migration process
    - Error handling for individual record failures
    - Comprehensive statistics and verification

  3. Migration Process
    - Match records by user ID between tables
    - Skip NULL or empty Instagram URLs from source
    - Update only empty destination fields
    - Log each successful migration
*/

DO $$
DECLARE
    migration_record RECORD;
    migration_count INTEGER := 0;
    error_count INTEGER := 0;
    candidate_count INTEGER := 0;
    success_rate NUMERIC;
    total_before INTEGER;
    total_after INTEGER;
BEGIN
    RAISE NOTICE '=== Starting Instagram URL Migration ===';
    RAISE NOTICE 'Timestamp: %', NOW();
    
    -- Count total Instagram URLs before migration
    SELECT COUNT(*) INTO total_before 
    FROM app_user_profiles 
    WHERE instagram_url IS NOT NULL AND TRIM(instagram_url) != '';
    
    RAISE NOTICE 'Instagram URLs in app_user_profiles before migration: %', total_before;
    
    -- Count potential migration candidates
    SELECT COUNT(*) INTO candidate_count
    FROM user_profiles up
    INNER JOIN app_user_profiles aup ON up.id = aup.id
    WHERE up.instagram_url IS NOT NULL 
      AND TRIM(up.instagram_url) != ''
      AND (aup.instagram_url IS NULL OR TRIM(aup.instagram_url) = '');
    
    RAISE NOTICE 'Migration candidates found: %', candidate_count;
    
    -- Perform the migration
    FOR migration_record IN
        SELECT 
            up.id,
            up.instagram_url as source_instagram,
            aup.instagram_url as target_instagram,
            aup.full_name,
            aup.email
        FROM user_profiles up
        INNER JOIN app_user_profiles aup ON up.id = aup.id
        WHERE up.instagram_url IS NOT NULL 
          AND TRIM(up.instagram_url) != ''
          AND (aup.instagram_url IS NULL OR TRIM(aup.instagram_url) = '')
    LOOP
        BEGIN
            -- Update the Instagram URL in app_user_profiles
            UPDATE app_user_profiles 
            SET 
                instagram_url = migration_record.source_instagram,
                updated_at = NOW()
            WHERE id = migration_record.id;
            
            migration_count := migration_count + 1;
            
            RAISE NOTICE 'Migrated Instagram URL for user: % (%) - URL: %', 
                migration_record.full_name, 
                migration_record.email,
                migration_record.source_instagram;
                
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE 'ERROR migrating Instagram URL for user % (%): %', 
                migration_record.full_name,
                migration_record.email,
                SQLERRM;
        END;
    END LOOP;
    
    -- Calculate success rate
    IF candidate_count > 0 THEN
        success_rate := (migration_count::NUMERIC / candidate_count::NUMERIC) * 100;
    ELSE
        success_rate := 100;
    END IF;
    
    -- Count total Instagram URLs after migration
    SELECT COUNT(*) INTO total_after 
    FROM app_user_profiles 
    WHERE instagram_url IS NOT NULL AND TRIM(instagram_url) != '';
    
    -- Final migration summary
    RAISE NOTICE '=== Instagram URL Migration Summary ===';
    RAISE NOTICE 'Migration candidates: %', candidate_count;
    RAISE NOTICE 'Successful migrations: %', migration_count;
    RAISE NOTICE 'Failed migrations: %', error_count;
    RAISE NOTICE 'Success rate: %%%', ROUND(success_rate, 2);
    RAISE NOTICE 'Instagram URLs before migration: %', total_before;
    RAISE NOTICE 'Instagram URLs after migration: %', total_after;
    RAISE NOTICE 'Net increase: %', (total_after - total_before);
    RAISE NOTICE '=== Migration Completed ===';
    
    -- Raise an error if no migrations were performed and candidates existed
    IF candidate_count > 0 AND migration_count = 0 THEN
        RAISE EXCEPTION 'Migration failed: No Instagram URLs were migrated despite % candidates', candidate_count;
    END IF;
    
END $$;
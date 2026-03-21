# App Version Update Guide

## Current Status
Your app is configured for version **65.0.0** with mandatory updates enabled.

## How to Update the Version Configuration

### Option 1: Make Update Optional (Recommended after initial rollout)
Allow users to skip the update and continue using the app:

```sql
UPDATE app_version_config
SET force_update = false,
    update_message = 'A new version is available! Update now for the best experience.'
WHERE platform = 'android';
```

### Option 2: Change to a Different Version
If you release version 66:

```sql
UPDATE app_version_config
SET current_version = '66.0.0',
    minimum_version = '65.0.0',
    force_update = false,
    update_message = 'Version 66 is now available with exciting new features!'
WHERE platform = 'android';
```

### Option 3: Force Update for Critical Patches
For security updates or critical bug fixes:

```sql
UPDATE app_version_config
SET current_version = '65.0.1',
    minimum_version = '65.0.1',
    force_update = true,
    update_message = 'Important security update required. Please update immediately.'
WHERE platform = 'android';
```

### Option 4: Check Current Configuration

```sql
SELECT * FROM app_version_config WHERE platform = 'android';
```

## Version Comparison Logic

The system compares versions using semantic versioning (e.g., 65.0.0):
- **current_version**: The latest available version (what's in the Play Store)
- **minimum_version**: The oldest version that's still allowed to run
- **force_update**: If true, blocks app usage until update

### Examples:
| User Version | Current | Minimum | Force Update | Result |
|--------------|---------|---------|--------------|--------|
| 64.0.0 | 65.0.0 | 65.0.0 | true | Must update (blocked) |
| 64.0.0 | 65.0.0 | 64.0.0 | false | Can skip update |
| 65.0.0 | 65.0.0 | 64.0.0 | false | No prompt shown |

## Best Practices

1. **Initial Rollout**: Use `force_update = true` for the first 24-48 hours
2. **After Adoption**: Switch to `force_update = false` to allow gradual updates
3. **Critical Updates**: Always use `force_update = true` for security patches
4. **Clear Messages**: Update the `update_message` to explain what's new

## Custom Update Messages

Make your messages engaging:

```sql
-- For feature updates
UPDATE app_version_config
SET update_message = '🎉 New features just dropped! Update now to access enhanced voting, better reports, and improved performance.'
WHERE platform = 'android';

-- For bug fixes
UPDATE app_version_config
SET update_message = '🔧 We''ve squashed some bugs and improved stability. Update for the best experience!'
WHERE platform = 'android';

-- For UI improvements
UPDATE app_version_config
SET update_message = '✨ Beautiful new design and smoother navigation await! Update now to see what''s new.'
WHERE platform = 'android';
```

## Testing the Update Flow

Before each release:
1. Deploy the new version to Play Store (Internal Testing track)
2. Update the database configuration
3. Test with an older version to verify the prompt appears
4. Verify the Play Store link works correctly
5. Roll out to production

## Quick Reference

**Make update optional:**
```sql
UPDATE app_version_config SET force_update = false WHERE platform = 'android';
```

**Make update mandatory:**
```sql
UPDATE app_version_config SET force_update = true WHERE platform = 'android';
```

**Update to version 66:**
```sql
UPDATE app_version_config
SET current_version = '66.0.0', minimum_version = '65.0.0'
WHERE platform = 'android';
```

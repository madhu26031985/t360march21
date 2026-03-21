# Edge function secrets (Slack)

Set these in **Supabase Dashboard → Project Settings → Edge Functions → Secrets** (or via CLI):

| Secret | Used by |
|--------|---------|
| `SLACK_WEBHOOK_URL` | Default Slack notifications (meetings, voting, invitations, errors, new user) |
| `SLACK_WEBHOOK_NEW_CLUB_URL` | Optional; overrides for new-club notifications. Falls back to `SLACK_WEBHOOK_URL`. |
| `SLACK_WEBHOOK_DAILY_STATS_URL` | Optional; daily stats cron. Falls back to `SLACK_WEBHOOK_URL`. |

Use your Slack webhook URLs from the Slack app settings (never commit them to git).

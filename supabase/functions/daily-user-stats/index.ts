import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_DAILY_STATS_URL") ?? Deno.env.get("SLACK_WEBHOOK_URL");
    if (!slackWebhookUrl) {
      console.error("SLACK_WEBHOOK_DAILY_STATS_URL or SLACK_WEBHOOK_URL is not set");
      return new Response(JSON.stringify({ error: "Slack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: totalUsers } = await supabase
      .from("app_user_profiles")
      .select("*", { count: "exact", head: true });

    const { data: usersWithClubs } = await supabase
      .from("app_club_user_relationship")
      .select("user_id")
      .eq("is_authenticated", true);

    const uniqueUsersWithClubs = new Set(usersWithClubs?.map(u => u.user_id) || []).size;

    const { data: totalClubs } = await supabase
      .from("clubs")
      .select("club_id", { count: "exact" });

    const { data: newUsersToday } = await supabase
      .from("app_user_profiles")
      .select("user_id", { count: "exact" })
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

    const { data: allUsers } = await supabase
      .from("app_user_profiles")
      .select("user_id, email");

    const usersWithClubsSet = new Set(usersWithClubs?.map(u => u.user_id) || []);
    const usersWithoutClubs = allUsers?.filter(user => !usersWithClubsSet.has(user.user_id)) || [];
    const usersWithoutClubsEmails = usersWithoutClubs.map(u => u.email).join("\n");

    const slackMessage = {
      text: "📊 Daily User Statistics Report",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📊 Daily User Statistics Report",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Report Date:* ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Total Users:*\n${totalUsers || 0}`
            },
            {
              type: "mrkdwn",
              text: `*Users with Clubs:*\n${uniqueUsersWithClubs}`
            },
            {
              type: "mrkdwn",
              text: `*Total Clubs:*\n${totalClubs?.length || 0}`
            },
            {
              type: "mrkdwn",
              text: `*New Users Today:*\n${newUsersToday?.length || 0}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Conversion Rate:* ${totalUsers ? ((uniqueUsersWithClubs / totalUsers) * 100).toFixed(1) : 0}% of users have joined a club`
          }
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Users Without Clubs (${usersWithoutClubs.length}):*\n${usersWithoutClubsEmails || "None"}`
          }
        }
      ]
    };

    const slackResponse = await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage)
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      console.error("Slack API error:", errorText);
      throw new Error(`Slack API error: ${slackResponse.statusText}`);
    }

    console.log("Daily stats sent to Slack successfully");

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalUsers: totalUsers || 0,
          usersWithClubs: uniqueUsersWithClubs,
          totalClubs: totalClubs?.length || 0,
          newUsersToday: newUsersToday?.length || 0
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending daily stats:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

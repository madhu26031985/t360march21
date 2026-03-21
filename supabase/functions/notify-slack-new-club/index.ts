import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const { record } = await req.json();
    const { id, club_id, created_at } = record;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: clubProfile, error: clubError } = await supabase
      .from("club_profiles")
      .select("club_name, club_number, city, country, meeting_type, club_type")
      .eq("club_id", club_id)
      .maybeSingle();

    if (clubError) {
      console.error("Error fetching club profile:", clubError);
    }

    const { data: creatorRelationship } = await supabase
      .from("app_club_user_relationship")
      .select("user_id")
      .eq("club_id", club_id)
      .eq("role", "excomm")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let creatorName = "Unknown";
    let creatorEmail = "N/A";

    if (creatorRelationship?.user_id) {
      const { data: creator } = await supabase
        .from("app_user_profiles")
        .select("full_name, email")
        .eq("id", creatorRelationship.user_id)
        .maybeSingle();

      if (creator) {
        creatorName = creator.full_name || "Unknown";
        creatorEmail = creator.email || "N/A";
      }
    }

    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_NEW_CLUB_URL") ?? Deno.env.get("SLACK_WEBHOOK_URL");
    if (!slackWebhookUrl) {
      console.error("SLACK_WEBHOOK_NEW_CLUB_URL or SLACK_WEBHOOK_URL is not set");
      return new Response(JSON.stringify({ error: "Slack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slackMessage = {
      text: "🎉 New Club Created!",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 New Club Created"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Club Name:*\n${clubProfile?.club_name || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Club Number:*\n${clubProfile?.club_number || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Location:*\n${clubProfile?.city || 'N/A'}, ${clubProfile?.country || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Club Type:*\n${clubProfile?.club_type || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Meeting Type:*\n${clubProfile?.meeting_type || 'N/A'}`
            },
            {
              type: "mrkdwn",
              text: `*Created:*\n${new Date(created_at).toLocaleString()}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Created by:* ${creatorName} (${creatorEmail})`
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

    console.log("Slack notification sent successfully for club:", clubProfile?.club_name);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending Slack notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
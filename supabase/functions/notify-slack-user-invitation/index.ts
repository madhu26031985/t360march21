import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const formatRole = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'excomm': return 'Executive Committee Member';
    case 'visiting_tm': return 'Visiting Toastmaster';
    case 'club_leader': return 'Club Leader';
    case 'guest': return 'Guest';
    case 'member': return 'Member';
    default: return role;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { record } = await req.json();
    const {
      id,
      invitee_email,
      invitee_full_name,
      invitee_role,
      club_id,
      invited_by,
      created_at
    } = record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: clubData } = await supabase
      .from("clubs")
      .select("name, club_number")
      .eq("id", club_id)
      .maybeSingle();

    const { data: inviterData } = await supabase
      .from("app_user_profiles")
      .select("full_name, email")
      .eq("id", invited_by)
      .maybeSingle();

    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!slackWebhookUrl) {
      console.error("SLACK_WEBHOOK_URL is not set");
      return new Response(JSON.stringify({ error: "Slack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clubInfo = clubData
      ? `${clubData.name}${clubData.club_number ? ` (#${clubData.club_number})` : ''}`
      : 'Unknown Club';

    const inviterInfo = inviterData
      ? `${inviterData.full_name} (${inviterData.email})`
      : 'Unknown';

    const slackMessage = {
      text: "📧 New User Invitation Sent!",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📧 New User Invitation Sent"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Invitee Name:*\n${invitee_full_name}`
            },
            {
              type: "mrkdwn",
              text: `*Invitee Email:*\n${invitee_email}`
            },
            {
              type: "mrkdwn",
              text: `*Role:*\n${formatRole(invitee_role)}`
            },
            {
              type: "mrkdwn",
              text: `*Club:*\n${clubInfo}`
            },
            {
              type: "mrkdwn",
              text: `*Invited By:*\n${inviterInfo}`
            },
            {
              type: "mrkdwn",
              text: `*Invitation ID:*\n${id}`
            },
            {
              type: "mrkdwn",
              text: `*Sent At:*\n${new Date(created_at).toLocaleString()}`
            }
          ]
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

    console.log("Slack notification sent successfully for invitation:", invitee_email);

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

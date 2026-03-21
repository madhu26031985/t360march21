import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const formatMode = (mode: string): string => {
  switch (mode?.toLowerCase()) {
    case 'online': return '🌐 Online';
    case 'offline': return '🏢 In-Person';
    case 'hybrid': return '🔄 Hybrid';
    default: return mode || 'Not specified';
  }
};

const formatStatus = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'open': return '🟢 Open';
    case 'closed': return '🔴 Closed';
    case 'cancelled': return '❌ Cancelled';
    default: return status || 'Unknown';
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { record, old_record, operation } = await req.json();
    const {
      id,
      title,
      meeting_number,
      theme,
      meeting_date,
      meeting_time,
      mode,
      location,
      status,
      club_id,
      created_by,
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

    const { data: creatorData } = await supabase
      .from("app_user_profiles")
      .select("full_name, email")
      .eq("id", created_by)
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

    const creatorInfo = creatorData
      ? `${creatorData.full_name} (${creatorData.email})`
      : 'Unknown';

    const meetingDateTime = `${new Date(meeting_date).toLocaleDateString()} at ${meeting_time}`;

    let slackMessage;

    if (operation === 'INSERT') {
      slackMessage = {
        text: "📅 New Meeting Created!",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📅 New Meeting Created"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Meeting Title:*\n${title}`
              },
              {
                type: "mrkdwn",
                text: `*Meeting Number:*\n${meeting_number || 'Not assigned'}`
              },
              {
                type: "mrkdwn",
                text: `*Club:*\n${clubInfo}`
              },
              {
                type: "mrkdwn",
                text: `*Date & Time:*\n${meetingDateTime}`
              },
              {
                type: "mrkdwn",
                text: `*Mode:*\n${formatMode(mode)}`
              },
              {
                type: "mrkdwn",
                text: `*Location:*\n${location || 'Not specified'}`
              },
              {
                type: "mrkdwn",
                text: `*Theme:*\n${theme || 'Not set'}`
              },
              {
                type: "mrkdwn",
                text: `*Status:*\n${formatStatus(status)}`
              },
              {
                type: "mrkdwn",
                text: `*Created By:*\n${creatorInfo}`
              },
              {
                type: "mrkdwn",
                text: `*Meeting ID:*\n${id}`
              }
            ]
          }
        ]
      };
    } else if (operation === 'UPDATE') {
      const oldStatus = old_record?.status;
      const wasClosed = oldStatus !== 'closed' && status === 'closed';

      if (wasClosed) {
        slackMessage = {
          text: "🔴 Meeting Closed!",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🔴 Meeting Closed"
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Meeting Title:*\n${title}`
                },
                {
                  type: "mrkdwn",
                  text: `*Meeting Number:*\n${meeting_number || 'Not assigned'}`
                },
                {
                  type: "mrkdwn",
                  text: `*Club:*\n${clubInfo}`
                },
                {
                  type: "mrkdwn",
                  text: `*Date & Time:*\n${meetingDateTime}`
                },
                {
                  type: "mrkdwn",
                  text: `*Previous Status:*\n${formatStatus(oldStatus)}`
                },
                {
                  type: "mrkdwn",
                  text: `*New Status:*\n${formatStatus(status)}`
                },
                {
                  type: "mrkdwn",
                  text: `*Meeting ID:*\n${id}`
                }
              ]
            }
          ]
        };
      } else {
        const changes = [];
        if (old_record) {
          if (old_record.title !== title) changes.push(`*Title:* ${old_record.title} → ${title}`);
          if (old_record.meeting_date !== meeting_date) changes.push(`*Date:* ${new Date(old_record.meeting_date).toLocaleDateString()} → ${new Date(meeting_date).toLocaleDateString()}`);
          if (old_record.meeting_time !== meeting_time) changes.push(`*Time:* ${old_record.meeting_time} → ${meeting_time}`);
          if (old_record.mode !== mode) changes.push(`*Mode:* ${formatMode(old_record.mode)} → ${formatMode(mode)}`);
          if (old_record.location !== location) changes.push(`*Location:* ${old_record.location || 'None'} → ${location || 'None'}`);
          if (old_record.theme !== theme) changes.push(`*Theme:* ${old_record.theme || 'None'} → ${theme || 'None'}`);
          if (old_record.status !== status) changes.push(`*Status:* ${formatStatus(old_record.status)} → ${formatStatus(status)}`);
        }

        slackMessage = {
          text: "✏️ Meeting Updated!",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✏️ Meeting Updated"
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Meeting Title:*\n${title}`
                },
                {
                  type: "mrkdwn",
                  text: `*Meeting Number:*\n${meeting_number || 'Not assigned'}`
                },
                {
                  type: "mrkdwn",
                  text: `*Club:*\n${clubInfo}`
                },
                {
                  type: "mrkdwn",
                  text: `*Meeting ID:*\n${id}`
                }
              ]
            },
            ...(changes.length > 0 ? [{
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Changes Made:*\n${changes.join('\n')}`
              }
            }] : [])
          ]
        };
      }
    }

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

    console.log("Slack notification sent successfully for meeting:", id);

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

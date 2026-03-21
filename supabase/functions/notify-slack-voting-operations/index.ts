import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const formatStatus = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'active': return '🟢 Active';
    case 'completed': return '✅ Completed';
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
      description,
      status,
      club_id,
      meeting_id,
      created_by,
      start_time,
      end_time,
      is_anonymous,
      created_at
    } = record;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get club information
    const { data: clubData } = await supabase
      .from("clubs")
      .select("name, club_number")
      .eq("id", club_id)
      .maybeSingle();

    // Get creator information
    const { data: creatorData } = await supabase
      .from("app_user_profiles")
      .select("full_name, email")
      .eq("id", created_by)
      .maybeSingle();

    // Get meeting information if applicable
    let meetingInfo = null;
    if (meeting_id) {
      const { data: meetingData } = await supabase
        .from("app_club_meeting")
        .select("meeting_title, meeting_number")
        .eq("id", meeting_id)
        .maybeSingle();

      if (meetingData) {
        meetingInfo = `${meetingData.meeting_title}${meetingData.meeting_number ? ` (#${meetingData.meeting_number})` : ''}`;
      }
    }

    // Get poll items (options)
    const { data: pollItems } = await supabase
      .from("poll_items")
      .select("item_text")
      .eq("poll_id", id)
      .order("created_at");

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

    let slackMessage;

    if (operation === 'INSERT') {
      // New poll created
      const fields = [
        {
          type: "mrkdwn",
          text: `*Poll Title:*\n${title}`
        },
        {
          type: "mrkdwn",
          text: `*Club:*\n${clubInfo}`
        }
      ];

      if (description) {
        fields.push({
          type: "mrkdwn",
          text: `*Description:*\n${description}`
        });
      }

      if (meetingInfo) {
        fields.push({
          type: "mrkdwn",
          text: `*Meeting:*\n${meetingInfo}`
        });
      }

      fields.push(
        {
          type: "mrkdwn",
          text: `*Status:*\n${formatStatus(status)}`
        },
        {
          type: "mrkdwn",
          text: `*Anonymous:*\n${is_anonymous ? 'Yes' : 'No'}`
        },
        {
          type: "mrkdwn",
          text: `*Created By:*\n${creatorInfo}`
        },
        {
          type: "mrkdwn",
          text: `*Poll ID:*\n${id}`
        }
      );

      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🗳️ New Poll Created"
          }
        },
        {
          type: "section",
          fields: fields
        }
      ];

      // Add poll options if available
      if (pollItems && pollItems.length > 0) {
        const options = pollItems.map((item, index) => `${index + 1}. ${item.item_text}`).join('\n');
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Poll Options:*\n${options}`
          }
        });
      }

      slackMessage = {
        text: "🗳️ New Poll Created!",
        blocks: blocks
      };

    } else if (operation === 'UPDATE') {
      const oldStatus = old_record?.status;
      const wasClosed = oldStatus !== 'completed' && status === 'completed';

      if (wasClosed) {
        // Poll was closed
        // Get vote count
        const { count: voteCount } = await supabase
          .from("poll_votes")
          .select("*", { count: 'exact', head: true })
          .eq("poll_id", id);

        const fields = [
          {
            type: "mrkdwn",
            text: `*Poll Title:*\n${title}`
          },
          {
            type: "mrkdwn",
            text: `*Club:*\n${clubInfo}`
          }
        ];

        if (meetingInfo) {
          fields.push({
            type: "mrkdwn",
            text: `*Meeting:*\n${meetingInfo}`
          });
        }

        fields.push(
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
            text: `*Total Votes:*\n${voteCount || 0}`
          },
          {
            type: "mrkdwn",
            text: `*Poll ID:*\n${id}`
          }
        );

        slackMessage = {
          text: "✅ Poll Closed!",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✅ Poll Closed"
              }
            },
            {
              type: "section",
              fields: fields
            }
          ]
        };
      } else {
        // Other updates
        const changes = [];
        if (old_record) {
          if (old_record.title !== title) changes.push(`*Title:* ${old_record.title} → ${title}`);
          if (old_record.description !== description) changes.push(`*Description:* ${old_record.description || 'None'} → ${description || 'None'}`);
          if (old_record.status !== status) changes.push(`*Status:* ${formatStatus(old_record.status)} → ${formatStatus(status)}`);
        }

        // Skip if no meaningful changes
        if (changes.length === 0) {
          return new Response(
            JSON.stringify({ success: true, skipped: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        slackMessage = {
          text: "✏️ Poll Updated!",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✏️ Poll Updated"
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Poll Title:*\n${title}`
                },
                {
                  type: "mrkdwn",
                  text: `*Club:*\n${clubInfo}`
                },
                {
                  type: "mrkdwn",
                  text: `*Poll ID:*\n${id}`
                }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Changes Made:*\n${changes.join('\n')}`
              }
            }
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

    console.log("Slack notification sent successfully for poll:", id);

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

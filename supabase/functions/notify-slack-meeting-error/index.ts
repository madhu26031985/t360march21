import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { userId, userEmail, userName, clubId, clubName, errorMessage, errorDetails, meetingData } = await req.json();

    const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!slackWebhookUrl) {
      console.error("SLACK_WEBHOOK_URL is not set");
      return new Response(JSON.stringify({ error: "Slack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slackMessage = {
      text: "🚨 Meeting Creation Failed!",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 Meeting Creation Failed"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*User:*\n${userName || 'N/A'} (${userEmail})`
            },
            {
              type: "mrkdwn",
              text: `*User ID:*\n${userId}`
            },
            {
              type: "mrkdwn",
              text: `*Club:*\n${clubName || 'Unknown'} (ID: ${clubId || 'N/A'})`
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date().toLocaleString()}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Error Message:*\n\`\`\`${errorMessage}\`\`\``
          }
        }
      ]
    };

    if (errorDetails) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error Details:*\n\`\`\`${JSON.stringify(errorDetails, null, 2)}\`\`\``
        }
      });
    }

    if (meetingData) {
      slackMessage.blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Attempted Meeting Data:*\n\`\`\`${JSON.stringify(meetingData, null, 2)}\`\`\``
        }
      });
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

    console.log("Slack notification sent for meeting creation error");

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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InviteRequest {
  email: string;
  fullName: string;
  role: string;
  clubId: string;
  invitedBy: string;
}

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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, fullName, role, clubId, invitedBy }: InviteRequest = await req.json();

    console.log("Creating invitation for:", email);

    // Fetch club information
    const { data: clubData, error: clubError } = await supabase
      .from("clubs")
      .select("name, club_number")
      .eq("id", clubId)
      .maybeSingle();

    if (clubError || !clubData) {
      console.error("Error fetching club:", clubError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch club information",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch inviter information
    const { data: inviterData, error: inviterError } = await supabase
      .from("app_user_profiles")
      .select("full_name, email")
      .eq("id", invitedBy)
      .maybeSingle();

    if (inviterError || !inviterData) {
      console.error("Error fetching inviter:", inviterError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to fetch inviter information",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate invitation token
    const inviteToken = crypto.randomUUID();

    // Set expiration to 168 hours (7 days) from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 168);

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from("app_user_invitation")
      .insert({
        invite_token: inviteToken,
        club_id: clubId,
        invitee_email: email.toLowerCase(),
        invitee_full_name: fullName,
        invitee_role: role,
        invited_by: invitedBy,
        status: "pending",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invitation:", inviteError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create invitation",
          error: inviteError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Invitation created successfully, sending email...");

    // Send invitation email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to T360</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #F8FAFC;
            font-family: Arial, Helvetica, sans-serif;
            color: #2E2E2E;
          }
          table {
            border-spacing: 0;
          }
          img {
            border: 0;
          }
          .container {
            max-width: 600px;
            background-color: #FFFFFF;
            margin: 0 auto;
          }
          .header {
            background: linear-gradient(135deg, #0B3C5D, #1F6AE1);
            color: #FFFFFF;
            text-align: center;
            padding: 28px 14px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .header p {
            margin: 10px 0 0;
            font-size: 16px;
            color: #FFE7A3;
          }
          .content {
            padding: 30px 25px;
            font-size: 15px;
            line-height: 1.6;
          }
          .name {
            color: #1F6AE1;
            font-weight: bold;
          }
          .card {
            background-color: #F5F9FF;
            border-left: 5px solid #F2A900;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 6px;
          }
          .label {
            color: #1F6AE1;
            font-weight: bold;
          }
          .section-title {
            color: #1F6AE1;
            font-size: 18px;
            margin: 30px 0 15px;
            font-weight: bold;
          }
          .button {
            display: block;
            width: 100%;
            text-align: center;
            text-decoration: none;
            padding: 14px 0;
            border-radius: 30px;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 15px;
          }
          .btn-ios {
            background-color: #1F6AE1;
            color: #FFFFFF;
          }
          .btn-android {
            background-color: #F2A900;
            color: #0B3C5D;
          }
          .callout {
            background-color: #EAF2FF;
            border-left: 5px solid #1F6AE1;
            padding: 15px 20px;
            border-radius: 6px;
            margin-top: 20px;
          }
          .callout strong {
            color: #1F6AE1;
          }
          .highlight {
            color: #F2A900;
            font-weight: bold;
          }
          .footer {
            background-color: #F1F3F6;
            text-align: center;
            padding: 25px 20px;
            font-size: 13px;
            color: #6B7280;
          }
          .footer strong {
            color: #0B3C5D;
          }
        </style>
      </head>

      <body>
        <table width="100%">
          <tr>
            <td align="center">
              <table class="container" width="100%">

                <!-- Header -->
                <tr>
                  <td class="header">
                    <h1>Welcome to T360! 🎉</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td class="content">
                    <p><span class="name">Dear ${fullName},</span></p>

                    <p>Welcome to T360!</p>

                    <p>You have been invited to join the Toastmasters club:</p>

                    <div class="card">
                      <p><span class="label">Club Name:</span> ${clubData.name}${clubData.club_number ? ` (Club #${clubData.club_number})` : ''}</p>
                      <p><span class="label">Invited By:</span> ${inviterData.full_name}</p>
                    </div>

                    <div class="section-title">
                      To get started, please follow the steps below:
                    </div>

                    <p><strong>1. Download the T360 app</strong> using the links below:</p>

                    <a href="https://apps.apple.com/us/app/t-360/id6752499801" class="button btn-ios">📱 iOS: Download for iPhone</a>
                    <a href="https://play.google.com/store/apps/details?id=com.toastmaster360.mobile" class="button btn-android">🤖 Android: Download for Android</a>

                    <p>
                      <strong>2. Sign up with your email address:</strong>
                      <span class="highlight">${email}</span>
                    </p>

                    <div class="callout">
                      <p>
                        <strong>That's it!</strong> Once you sign up, you'll automatically be added
                        to the club as <span class="highlight">${formatRole(role)}</span>.
                        No additional steps required!
                      </p>
                    </div>

                    <p>If you did not expect this invite, you may safely ignore this email.</p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td class="footer">
                    <p><strong>Warm regards,</strong><br>The T360 Team</p>
                    <p>
                      This invitation was sent by ${clubData.name} through T360<br>
                      © ${new Date().getFullYear()} T360. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const emailText = `
Welcome to T360! Your Club Invitation Awaits

Dear ${fullName},

Welcome to T360!

You have been invited to join the Toastmasters club:

Club Name: ${clubData.name}${clubData.club_number ? ` (Club #${clubData.club_number})` : ''}
Invited By: ${inviterData.full_name}

To get started, please follow the steps below:

1. Download the T360 app using the links below:

   iOS: https://apps.apple.com/us/app/t-360/id6752499801

   Android: https://play.google.com/store/apps/details?id=com.toastmaster360.mobile

2. Sign up with your email address: ${email}

That's it! Once you sign up, you'll automatically be added to the club as ${formatRole(role)}. No additional steps required!

If you did not expect this invite, you may safely ignore this email.

We're excited to have you onboard.
Welcome to a smarter and smoother experience with T360!

Warm regards,
The T360 Team

---
This invitation was sent by ${clubData.name} through T360
© ${new Date().getFullYear()} T360. All rights reserved.
    `;

    try {
      // Send custom invitation email using Mailgun
      const mailgunApiKey = Deno.env.get("MAILGUN_API_KEY");
      const mailgunDomain = Deno.env.get("MAILGUN_DOMAIN");

      if (mailgunApiKey && mailgunDomain) {
        const formData = new FormData();
        formData.append("from", "T360 <noreply@" + mailgunDomain + ">");
        formData.append("to", email.toLowerCase());
        formData.append("subject", "Welcome to T360! Your Club Invitation Awaits");
        formData.append("html", emailHtml);
        formData.append("text", emailText);

        const mailgunResponse = await fetch(
          `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa("api:" + mailgunApiKey),
            },
            body: formData,
          }
        );

        if (!mailgunResponse.ok) {
          const mailgunError = await mailgunResponse.text();
          console.error("Mailgun API error:", mailgunError);
          console.log("Email sending failed, but invitation record was created");
        } else {
          const result = await mailgunResponse.json();
          console.log("Email sent successfully via Mailgun:", result.id);
        }
      } else {
        console.log("Mailgun not configured - email not sent");
        console.log("Note: Configure MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables to enable email notifications");
      }
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      console.log("Email sending failed, but invitation record was created");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation created and email sent successfully",
        invitationId: invitation.id,
        inviteToken: inviteToken,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-user-invitation:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
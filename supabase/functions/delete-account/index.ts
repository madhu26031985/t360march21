import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAccountRequest {
  userId: string;
}

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

    const { userId }: DeleteAccountRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "User ID is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Starting account deletion for user:", userId);

    // Step 1: Mark user as deleted in auth.users
    // This uses soft delete with deleted_at timestamp and bans the user permanently
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        ban_duration: "876000h", // Ban for 100 years (effectively permanent)
        user_metadata: { account_deleted: true, deleted_at: new Date().toISOString() }
      }
    );

    if (authError) {
      console.error("Error marking user as deleted:", authError);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to delete account",
          error: authError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Step 2: Update app_user_profiles to mark as deleted
    const { error: profileError } = await supabase
      .from("app_user_profiles")
      .update({
        email: `deleted_${userId}@deleted.com`,
        full_name: "Deleted User",
        avatar_url: null,
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Error updating user profile:", profileError);
    }

    // Step 3: Remove user from all clubs
    const { error: clubMemberError } = await supabase
      .from("club_members")
      .delete()
      .eq("user_id", userId);

    if (clubMemberError) {
      console.error("Error removing user from clubs:", clubMemberError);
    }

    // Step 4: Delete pending invitations
    const { error: inviteError } = await supabase
      .from("app_user_invitation")
      .delete()
      .eq("invitee_email", (await supabase
        .from("app_user_profiles")
        .select("email")
        .eq("id", userId)
        .single()).data?.email || "");

    if (inviteError) {
      console.error("Error deleting invitations:", inviteError);
    }

    console.log("Account deletion completed successfully for user:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account deleted successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in delete-account:", error);
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

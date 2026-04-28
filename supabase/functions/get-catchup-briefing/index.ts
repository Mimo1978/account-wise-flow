import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * "What did I miss?" briefing.
 * Returns the structured catch-up Jarvis (and the bell-CTA UI) needs to read out:
 *   - AI calls completed since the last check
 *   - Drafted / sent follow-up emails awaiting user attention
 *   - Pending follow-up emails (target.followup_email_pending = true)
 *   - Outreach responses needing reply
 *   - Diary events upcoming today / next 7 days
 *   - Unread notifications grouped by type
 *   - Booked meetings from AI calls in the window
 *
 * Usage:
 *   POST /get-catchup-briefing
 *   Auth: user JWT (Bearer)
 *   Body: { workspace_id: string, since?: ISO string (default: 24h ago) }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceCall = token === serviceKey;
    const { data: { user } } = isServiceCall ? { data: { user: null } } : await supabase.auth.getUser(token);
    const { workspace_id, since, user_id: bodyUserId } = await req.json().catch(() => ({}));
    const effectiveUserId = isServiceCall ? bodyUserId : user?.id;
    if (!effectiveUserId && !isServiceCall) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sinceIso = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    // Run independent queries in parallel
    const [
      callsRes,
      followupPendingRes,
      followupSentRes,
      respondedRes,
      diaryTodayRes,
      diaryWeekRes,
      notificationsRes,
      bookedRes,
    ] = await Promise.all([
      supabase
        .from("outreach_targets")
        .select("id, entity_name, entity_email, last_call_at, last_call_outcome, last_call_metadata, followup_email_pending")
        .eq("workspace_id", workspace_id)
        .gte("last_call_at", sinceIso)
        .order("last_call_at", { ascending: false })
        .limit(50),

      supabase
        .from("outreach_targets")
        .select("id, entity_name, entity_email, followup_email_topic, last_call_at")
        .eq("workspace_id", workspace_id)
        .eq("followup_email_pending", true)
        .order("last_call_at", { ascending: false })
        .limit(50),

      supabase
        .from("outreach_events")
        .select("id, target_id, subject, performed_at, metadata")
        .eq("workspace_id", workspace_id)
        .eq("event_type", "email_sent")
        .contains("metadata", { source: "ai_call_followup" })
        .gte("performed_at", sinceIso)
        .order("performed_at", { ascending: false })
        .limit(50),

      supabase
        .from("outreach_targets")
        .select("id, entity_name, state, next_action, last_contacted_at")
        .eq("workspace_id", workspace_id)
        .in("state", ["responded"])
        .order("last_contacted_at", { ascending: false })
        .limit(50),

      supabase
        .from("diary_events")
        .select("id, title, start_time, event_type, contact_id, candidate_id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("start_time", nowIso)
        .lte("start_time", in24h)
        .order("start_time", { ascending: true })
        .limit(20),

      supabase
        .from("diary_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .eq("status", "scheduled")
        .gte("start_time", nowIso)
        .lte("start_time", in7d),

      supabase
        .from("notifications")
        .select("id, type, title, body, link, created_at")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("outreach_targets")
        .select("id, entity_name, last_call_metadata, last_call_at")
        .eq("workspace_id", workspace_id)
        .eq("state", "booked")
        .gte("last_call_at", sinceIso)
        .order("last_call_at", { ascending: false })
        .limit(20),
    ]);

    const calls = callsRes.data || [];
    const followupPending = followupPendingRes.data || [];
    const followupSent = followupSentRes.data || [];
    const responded = respondedRes.data || [];
    const diaryToday = diaryTodayRes.data || [];
    const diaryWeekCount = diaryWeekRes.count || 0;
    const notifications = notificationsRes.data || [];
    const booked = bookedRes.data || [];

    // Group notifications by type
    const notifByType: Record<string, number> = {};
    notifications.forEach((n: any) => { notifByType[n.type] = (notifByType[n.type] || 0) + 1; });

    // Build a natural-language headline for Jarvis to read out
    const lines: string[] = [];
    if (calls.length) {
      const withInfo = calls.filter((c: any) => c.last_call_metadata?.notice_period || c.last_call_metadata?.availability).length;
      lines.push(`${calls.length} AI ${calls.length === 1 ? "call" : "calls"} completed${withInfo ? ` (${withInfo} with notice period or availability captured)` : ""}.`);
    }
    if (booked.length) {
      lines.push(`${booked.length} ${booked.length === 1 ? "meeting was" : "meetings were"} booked from AI calls.`);
    }
    if (followupPending.length) {
      lines.push(`${followupPending.length} follow-up ${followupPending.length === 1 ? "email is" : "emails are"} pending — the AI agent agreed to send information.`);
    }
    if (followupSent.length) {
      lines.push(`${followupSent.length} follow-up ${followupSent.length === 1 ? "email was" : "emails were"} sent automatically.`);
    }
    if (responded.length) {
      lines.push(`${responded.length} ${responded.length === 1 ? "person has" : "people have"} responded and need your attention.`);
    }
    if (diaryToday.length) {
      lines.push(`${diaryToday.length} diary ${diaryToday.length === 1 ? "event" : "events"} in the next 24 hours.`);
    }
    if (diaryWeekCount && diaryWeekCount !== diaryToday.length) {
      lines.push(`${diaryWeekCount} diary events in the next 7 days total.`);
    }
    if (notifications.length) {
      lines.push(`${notifications.length} unread ${notifications.length === 1 ? "notification" : "notifications"} in the bell.`);
    }

    const headline = lines.length
      ? `Here's what happened since ${new Date(sinceIso).toLocaleString()}: ${lines.join(" ")}`
      : `You're all caught up since ${new Date(sinceIso).toLocaleString()} — nothing requires your attention.`;

    return new Response(JSON.stringify({
      ok: true,
      since: sinceIso,
      headline,
      counts: {
        calls_completed: calls.length,
        meetings_booked: booked.length,
        followup_emails_pending: followupPending.length,
        followup_emails_sent: followupSent.length,
        responses_awaiting: responded.length,
        diary_next_24h: diaryToday.length,
        diary_next_7d: diaryWeekCount,
        unread_notifications: notifications.length,
        notifications_by_type: notifByType,
      },
      details: {
        calls,
        meetings_booked: booked,
        followup_pending: followupPending,
        followup_sent: followupSent,
        responses_awaiting: responded,
        diary_today: diaryToday,
        notifications: notifications.slice(0, 10),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("get-catchup-briefing error:", e);
    return new Response(JSON.stringify({ error: e?.message || "server_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

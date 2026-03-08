import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Get next N working days (Mon-Fri) from today
function getWorkingDays(count: number): Date[] {
  const days: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Start from tomorrow if past 17:00
  if (new Date().getHours() >= 17) d.setDate(d.getDate() + 1);

  while (days.length < count) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Generate 30-min slots 09:00-17:30 for a given day
function generateSlots(day: Date): { start: Date; end: Date }[] {
  const slots: { start: Date; end: Date }[] = [];
  for (let h = 9; h <= 17; h++) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) continue; // 17:30 is last start → 18:00 end
      const start = new Date(day);
      start.setHours(h, m, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);
      // Don't offer slots in the past
      if (start > new Date()) {
        slots.push({ start, end });
      }
    }
  }
  return slots;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, user_id, workspace_id, ...params } = await req.json();

    if (!user_id || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "user_id and workspace_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── FIND AVAILABLE SLOTS ───
    if (action === "find_slots") {
      const workingDays = getWorkingDays(5);
      const rangeStart = workingDays[0];
      const rangeEnd = new Date(workingDays[workingDays.length - 1]);
      rangeEnd.setHours(23, 59, 59, 999);

      // Fetch existing events for this user in range
      const { data: existingEvents } = await supabase
        .from("diary_events")
        .select("start_time, end_time")
        .eq("user_id", user_id)
        .eq("status", "scheduled")
        .gte("start_time", rangeStart.toISOString())
        .lte("end_time", rangeEnd.toISOString());

      const busy = (existingEvents || []).map((e: any) => ({
        start: new Date(e.start_time).getTime(),
        end: new Date(e.end_time).getTime(),
      }));

      // Find free slots across all working days
      const freeSlots: { start: string; end: string; label: string }[] = [];
      for (const day of workingDays) {
        const slots = generateSlots(day);
        for (const slot of slots) {
          const sStart = slot.start.getTime();
          const sEnd = slot.end.getTime();
          const overlaps = busy.some(
            (b: { start: number; end: number }) => sStart < b.end && sEnd > b.start
          );
          if (!overlaps) {
            const dayName = slot.start.toLocaleDateString("en-GB", { weekday: "long" });
            const dateStr = slot.start.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
            const timeStr = slot.start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            freeSlots.push({
              start: slot.start.toISOString(),
              end: slot.end.toISOString(),
              label: `${dayName}, ${dateStr} at ${timeStr}`,
            });
          }
          if (freeSlots.length >= (params.max_slots || 3)) break;
        }
        if (freeSlots.length >= (params.max_slots || 3)) break;
      }

      return new Response(
        JSON.stringify({ slots: freeSlots }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── BOOK EVENT ───
    if (action === "book") {
      const { title, description, start_time, end_time, event_type, contact_id, company_id, job_id, candidate_id } = params;

      if (!title || !start_time || !end_time) {
        return new Response(
          JSON.stringify({ error: "title, start_time, end_time required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("diary_events")
        .insert({
          workspace_id,
          user_id,
          title,
          description: description || null,
          start_time,
          end_time,
          event_type: event_type || "call",
          contact_id: contact_id || null,
          company_id: company_id || null,
          job_id: job_id || null,
          candidate_id: candidate_id || null,
          status: "scheduled",
        })
        .select("id, title, start_time, end_time")
        .single();

      if (error) {
        console.error("Book event error:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If job_id and candidate_id provided, update shortlist
      if (job_id && candidate_id) {
        await supabase
          .from("job_shortlist")
          .update({
            interview_booked_at: start_time,
            status: "interviewing",
          })
          .eq("job_id", job_id)
          .eq("candidate_id", candidate_id);
      }

      return new Response(
        JSON.stringify({ success: true, event: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── GET EVENTS FOR DATE RANGE ───
    if (action === "get_events") {
      const { date_from, date_to } = params;
      let q = supabase
        .from("diary_events")
        .select("id, title, description, start_time, end_time, event_type, status, contact_id, company_id, job_id, candidate_id")
        .eq("user_id", user_id)
        .eq("workspace_id", workspace_id)
        .order("start_time");

      if (date_from) q = q.gte("start_time", date_from);
      if (date_to) q = q.lte("start_time", date_to);

      const { data, error } = await q;
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ events: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CANCEL EVENT ───
    if (action === "cancel") {
      const { event_id } = params;
      if (!event_id) {
        return new Response(
          JSON.stringify({ error: "event_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("diary_events")
        .update({ status: "cancelled" })
        .eq("id", event_id)
        .eq("user_id", user_id)
        .select("id, title, candidate_id, job_id")
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, cancelled: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── RESCHEDULE EVENT ───
    if (action === "reschedule") {
      const { event_id, new_start_time, new_end_time } = params;
      if (!event_id || !new_start_time || !new_end_time) {
        return new Response(
          JSON.stringify({ error: "event_id, new_start_time, new_end_time required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data, error } = await supabase
        .from("diary_events")
        .update({ start_time: new_start_time, end_time: new_end_time })
        .eq("id", event_id)
        .eq("user_id", user_id)
        .select("id, title, start_time, end_time")
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, event: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("diary-booking error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

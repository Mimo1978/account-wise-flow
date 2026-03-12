import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES_WITH_SOFT_DELETE = [
  "crm_projects",
  "crm_deals",
  "crm_companies",
  "crm_contacts",
  "crm_invoices",
  "crm_documents",
  "companies",
  "contacts",
  "jobs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    let totalPurged = 0;

    for (const table of TABLES_WITH_SOFT_DELETE) {
      // Find records past their purge date
      const { data: expired } = await supabaseAdmin
        .from(table)
        .select("id")
        .not("deleted_at", "is", null)
        .not("deletion_scheduled_purge_at", "is", null)
        .lte("deletion_scheduled_purge_at", now)
        .limit(100);

      if (expired && expired.length > 0) {
        const ids = expired.map((r: any) => r.id);

        // Log each purge to audit
        for (const id of ids) {
          await supabaseAdmin.from("audit_log").insert({
            entity_type: table,
            entity_id: id,
            action: "record_purged",
            diff: { purge_type: "scheduled" },
            context: { source: "scheduled-purge" },
          });
        }

        // Hard delete
        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .in("id", ids);

        if (error) {
          console.error(`Error purging ${table}:`, error);
        } else {
          totalPurged += ids.length;
          console.log(`Purged ${ids.length} records from ${table}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, purged: totalPurged, timestamp: now }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Scheduled purge error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

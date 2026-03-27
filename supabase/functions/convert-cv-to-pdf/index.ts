import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id } = await req.json();

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document
    const { data: doc, error: docError } = await admin
      .from("talent_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already PDF, just mark done and return
    const isPDF = doc.file_name?.toLowerCase().endsWith('.pdf') ||
                  doc.file_type === 'PDF' ||
                  doc.file_type === 'application/pdf';
    if (isPDF) {
      await admin.from("talent_documents").update({
        pdf_storage_path: doc.file_path,
        pdf_conversion_status: 'not_needed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ success: true, pdf_path: doc.file_path }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get CloudConvert API key from integration_settings
    const { data: keyRow } = await admin
      .from("integration_settings")
      .select("key_value")
      .eq("service", "cloudconvert")
      .eq("key_name", "CLOUDCONVERT_API_KEY")
      .maybeSingle();

    if (!keyRow?.key_value) {
      // No API key — mark as failed with a message
      await admin.from("talent_documents").update({
        pdf_conversion_status: 'failed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "CloudConvert API key not configured. Add it in Admin > Integrations." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as converting
    await admin.from("talent_documents").update({
      pdf_conversion_status: 'converting'
    }).eq("id", document_id);

    // Download original file from storage
    const { data: fileBlob, error: downloadError } = await admin.storage
      .from("candidate_cvs")
      .download(doc.file_path);

    if (downloadError || !fileBlob) {
      await admin.from("talent_documents").update({
        pdf_conversion_status: 'failed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Could not download original file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to base64
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes));

    // Submit CloudConvert job
    const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyRow.key_value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "import": { operation: "import/base64", file: b64, filename: doc.file_name },
          "convert": { operation: "convert", input: "import", output_format: "pdf" },
          "export": { operation: "export/url", input: "convert" }
        }
      }),
    });

    const job = await jobRes.json();
    if (!jobRes.ok) {
      console.error("CloudConvert job creation failed:", job);
      await admin.from("talent_documents").update({
        pdf_conversion_status: 'failed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ error: job.message || "CloudConvert job creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Poll for completion (max ~60s)
    let pdfUrl: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const check = await fetch(
        `https://api.cloudconvert.com/v2/jobs/${job.data.id}`,
        { headers: { "Authorization": `Bearer ${keyRow.key_value}` } }
      );
      const status = await check.json();

      if (status.data.status === "finished") {
        const exp = status.data.tasks.find(
          (t: any) => t.operation === "export/url" && t.status === "finished"
        );
        pdfUrl = exp?.result?.files?.[0]?.url;
        break;
      }
      if (status.data.status === "error") {
        console.error("CloudConvert job failed:", status.data);
        break;
      }
    }

    if (!pdfUrl) {
      await admin.from("talent_documents").update({
        pdf_conversion_status: 'failed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Conversion timed out or failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the converted PDF
    const pdfResponse = await fetch(pdfUrl);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());

    // Upload to same storage bucket with _preview.pdf suffix
    const pdfPath = doc.file_path.replace(/\.[^.]+$/, '') + '_preview.pdf';

    const { error: uploadError } = await admin.storage
      .from("candidate_cvs")
      .upload(pdfPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      await admin.from("talent_documents").update({
        pdf_conversion_status: 'failed'
      }).eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Failed to store converted PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update record with PDF path
    await admin.from("talent_documents").update({
      pdf_storage_path: pdfPath,
      pdf_conversion_status: 'done'
    }).eq("id", document_id);

    console.log("CV converted successfully:", pdfPath);

    return new Response(
      JSON.stringify({ success: true, pdf_path: pdfPath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("convert-cv-to-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

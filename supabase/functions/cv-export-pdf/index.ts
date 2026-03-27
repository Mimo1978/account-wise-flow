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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      workspaceId,
      candidateId,
      jobSpecId,
      templateStyle,
      includeSections,
      executiveSummary,
      previewData,
    } = await req.json();

    console.log("Generating PDF for candidate:", candidateId);

    // Fetch branding
    const { data: brandingData } = await supabase
      .from('workspace_branding')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    // Convert logo_path to a signed URL so it works in HTML exports
    let logoUrl: string | null = null;
    if (brandingData?.logo_path) {
      const { data: signed } = await supabase.storage
        .from('workspace-branding')
        .createSignedUrl(brandingData.logo_path, 86400);
      logoUrl = signed?.signedUrl || null;
    }

    // Build branding object with resolved URL
    const branding = brandingData ? {
      ...brandingData,
      logo_url: logoUrl,
    } : null;

    // Merge branding into previewData
    const enrichedPreviewData = { ...previewData, branding };

    // Generate PDF content
    const pdfHtml = generatePDFHtml(enrichedPreviewData, templateStyle, executiveSummary);

    // Create a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeName = previewData.candidate.name.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${safeName}_CV_${timestamp}.html`;
    const storagePath = `${workspaceId}/${candidateId}/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("generated-exports")
      .upload(storagePath, new TextEncoder().encode(pdfHtml), {
        contentType: "text/html",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error(`Failed to upload: ${uploadError.message}`);
    }

    // Record the export in the database
    const { data: exportRecord, error: insertError } = await supabase
      .from("generated_exports")
      .insert({
        workspace_id: workspaceId,
        candidate_id: candidateId,
        job_spec_id: jobSpecId || null,
        template_style: templateStyle,
        storage_path: storagePath,
        file_type: "pdf",
        executive_summary: executiveSummary,
        included_sections: includeSections,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Failed to record export: ${insertError.message}`);
    }

    // Generate signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from("generated-exports")
      .createSignedUrl(storagePath, 3600);

    console.log("PDF generated successfully:", storagePath);

    return new Response(
      JSON.stringify({
        export: exportRecord,
        downloadUrl: signedUrl?.signedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("cv-export-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generatePDFHtml(
  data: any,
  templateStyle: string,
  executiveSummary: string
): string {
  const { candidate, branding, jobSpec } = data;
  const primaryColor = branding?.primary_color || "#2563eb";
  
  const isModern = templateStyle === "modern";
  const isCompact = templateStyle === "compact";

  // Format experience for display
  const experienceHtml = candidate.experience
    ?.slice(0, isCompact ? 4 : 6)
    ?.map((exp: any) => `
      <div class="experience-item">
        <div class="exp-header">
          <div>
            <div class="exp-title">${exp.title}</div>
            <div class="exp-company">${exp.company}</div>
          </div>
          <div class="exp-dates">${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || ''}</div>
        </div>
        ${!isCompact && exp.description ? `<div class="exp-description">${exp.description}</div>` : ''}
      </div>
    `).join('') || '';

  // Format skills
  const skillsHtml = candidate.skills
    ?.slice(0, isCompact ? 15 : 20)
    ?.map((skill: string) => `<span class="skill-tag">${skill}</span>`)
    .join('') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${candidate.name} - CV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: ${isModern ? 'system-ui, -apple-system, sans-serif' : 'Georgia, "Times New Roman", serif'};
      line-height: 1.5;
      color: #1f2937;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    @media print {
      body { padding: 20px; max-width: none; }
      .page-break { page-break-before: always; }
    }
    
    .header {
      ${isModern 
        ? `background: linear-gradient(135deg, #1e293b, #475569); color: white; padding: 30px; margin: -40px -40px 30px; border-radius: 0 0 8px 8px;`
        : `border-bottom: 4px solid ${primaryColor}; padding-bottom: 20px; margin-bottom: 30px;`
      }
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .name {
      font-size: ${isCompact ? '24px' : '28px'};
      font-weight: bold;
      color: ${isModern ? 'white' : primaryColor};
    }
    
    .title {
      font-size: 16px;
      color: ${isModern ? '#94a3b8' : '#6b7280'};
      margin-top: 4px;
    }
    
    .contact-info {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      font-size: 12px;
      color: ${isModern ? '#94a3b8' : '#6b7280'};
    }
    
    .logo {
      max-height: 50px;
      max-width: 120px;
    }
    
    .section {
      margin-bottom: ${isCompact ? '16px' : '24px'};
    }
    
    .section-title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${primaryColor};
      margin-bottom: 12px;
      border-bottom: 1px solid ${primaryColor}20;
      padding-bottom: 6px;
    }
    
    .summary {
      font-size: ${isCompact ? '13px' : '14px'};
      color: #374151;
      line-height: 1.7;
    }
    
    .job-spec-note {
      background: ${primaryColor}10;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    
    .skills-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .skill-tag {
      display: inline-block;
      padding: 4px 10px;
      font-size: 11px;
      ${isModern 
        ? 'background: #f1f5f9; color: #475569; border-radius: 4px;'
        : `border: 1px solid ${primaryColor}40; border-radius: 3px;`
      }
    }
    
    .experience-item {
      margin-bottom: ${isCompact ? '12px' : '18px'};
      padding-left: 14px;
      border-left: 2px solid ${primaryColor};
    }
    
    .exp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    
    .exp-title {
      font-weight: 600;
      font-size: ${isCompact ? '13px' : '14px'};
    }
    
    .exp-company {
      color: #6b7280;
      font-size: 13px;
    }
    
    .exp-dates {
      font-size: 11px;
      color: #9ca3af;
    }
    
    .exp-description {
      margin-top: 6px;
      font-size: 12px;
      color: #6b7280;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-content">
      <div>
        <div class="name">${candidate.name}</div>
        <div class="title">${candidate.currentTitle || ''}</div>
        <div class="contact-info">
          ${candidate.email ? `<span>${candidate.email}</span>` : ''}
          ${candidate.phone ? `<span>${candidate.phone}</span>` : ''}
          ${candidate.location ? `<span>${candidate.location}</span>` : ''}
        </div>
      </div>
      ${branding?.logo_path ? `<img src="${branding.logo_path}" alt="Logo" class="logo">` : ''}
    </div>
  </div>
  
  ${executiveSummary ? `
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="summary">${executiveSummary}</div>
  </div>
  ` : ''}
  
  ${jobSpec ? `
  <div class="job-spec-note">
    <strong>Prepared for:</strong> ${jobSpec.title}${jobSpec.company ? ` at ${jobSpec.company}` : ''}
  </div>
  ` : ''}
  
  ${candidate.skills?.length ? `
  <div class="section">
    <div class="section-title">Core Skills</div>
    <div class="skills-container">${skillsHtml}</div>
  </div>
  ` : ''}
  
  ${candidate.experience?.length ? `
  <div class="section">
    <div class="section-title">Professional Experience</div>
    ${experienceHtml}
  </div>
  ` : ''}
  
  <div class="footer">
    Generated by ${branding?.company_name || 'CV Export'} • ${new Date().toLocaleDateString()} • Page 1 of 4 max
  </div>
</body>
</html>`;
}

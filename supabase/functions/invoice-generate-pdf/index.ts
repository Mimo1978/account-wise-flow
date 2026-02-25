import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch invoice
    const { data: invoice, error: invErr } = await admin
      .from('invoices')
      .select('*, companies(name)')
      .eq('id', invoice_id)
      .single();
    if (invErr) throw invErr;

    // Fetch line items
    const { data: lineItems } = await admin
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('sort_order', { ascending: true });

    // Fetch workspace billing settings
    const { data: settings } = await admin
      .from('workspace_billing_settings')
      .select('*')
      .eq('workspace_id', invoice.workspace_id)
      .maybeSingle();

    // Fetch company billing profile
    const { data: profile } = await admin
      .from('company_billing_profiles')
      .select('*')
      .eq('workspace_id', invoice.workspace_id)
      .eq('company_id', invoice.company_id)
      .maybeSingle();

    // Generate HTML invoice
    const html = generateInvoiceHTML(invoice, lineItems ?? [], settings, profile);

    // For MVP, return the HTML directly (PDF generation would require a headless browser service)
    // Store as HTML for now
    const fileName = `${invoice.invoice_number || 'invoice'}.html`;
    const filePath = `${invoice.workspace_id}/${fileName}`;

    // Upload to storage
    const { error: uploadErr } = await admin.storage
      .from('invoices')
      .upload(filePath, new Blob([html], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      });

    // If bucket doesn't exist, create it and retry
    if (uploadErr?.message?.includes('not found') || uploadErr?.message?.includes('Bucket')) {
      // Just return the HTML directly for download
      return new Response(JSON.stringify({
        success: true,
        html,
        invoice_number: invoice.invoice_number,
        message: 'Invoice HTML generated. Storage bucket not configured — returning HTML directly.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (uploadErr) {
      // Return HTML anyway
      return new Response(JSON.stringify({
        success: true,
        html,
        invoice_number: invoice.invoice_number,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('invoices').getPublicUrl(filePath);

    // Update invoice with PDF URL
    await admin
      .from('invoices')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', invoice_id);

    return new Response(JSON.stringify({
      success: true,
      pdf_url: urlData.publicUrl,
      invoice_number: invoice.invoice_number,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateInvoiceHTML(invoice: any, lineItems: any[], settings: any, profile: any): string {
  const fromName = settings?.trading_name || settings?.legal_name || 'Your Company';
  const fromAddr = [settings?.address_line1, settings?.address_line2, settings?.city, settings?.postcode, settings?.country].filter(Boolean).join(', ');
  const toName = invoice.billing_to_name || invoice.companies?.name || 'Client';
  const toEmail = invoice.billing_to_email || profile?.billing_email || '';
  const toAddr = invoice.billing_to_address
    ? [invoice.billing_to_address.line1, invoice.billing_to_address.line2, invoice.billing_to_address.city, invoice.billing_to_address.postcode, invoice.billing_to_address.country].filter(Boolean).join(', ')
    : '';
  const taxLabel = settings?.tax_label || 'VAT';

  const rows = lineItems.length > 0
    ? lineItems.map((li: any) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;">${li.description}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${li.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;">${invoice.currency} ${Number(li.unit_price).toFixed(2)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;font-weight:600;">${invoice.currency} ${Number(li.line_total).toFixed(2)}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding:16px;text-align:center;color:#999;">No line items</td></tr>`;

  const bankDetails = settings?.bank_account_name
    ? `<div style="margin-top:32px;padding:16px;background:#f8f9fa;border-radius:8px;">
        <p style="font-weight:600;margin:0 0 8px;font-size:13px;color:#333;">Payment Details</p>
        <p style="margin:2px 0;font-size:13px;color:#555;">Account: ${settings.bank_account_name}</p>
        ${settings.bank_sort_code ? `<p style="margin:2px 0;font-size:13px;color:#555;">Sort Code: ${settings.bank_sort_code}</p>` : ''}
        ${settings.bank_account_number ? `<p style="margin:2px 0;font-size:13px;color:#555;">Account No: ${settings.bank_account_number}</p>` : ''}
        ${settings.bank_iban ? `<p style="margin:2px 0;font-size:13px;color:#555;">IBAN: ${settings.bank_iban}</p>` : ''}
        ${settings.bank_swift ? `<p style="margin:2px 0;font-size:13px;color:#555;">SWIFT: ${settings.bank_swift}</p>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;">
    <div>
      ${settings?.logo_url ? `<img src="${settings.logo_url}" alt="Logo" style="max-height:60px;margin-bottom:12px;">` : ''}
      <h1 style="font-size:28px;font-weight:700;margin:0;color:#111;">INVOICE</h1>
      <p style="font-size:16px;color:#666;margin:4px 0;">${invoice.invoice_number || ''}</p>
    </div>
    <div style="text-align:right;font-size:13px;color:#555;">
      <p style="font-weight:600;margin:0;">${fromName}</p>
      <p style="margin:2px 0;">${fromAddr}</p>
      ${settings?.vat_number ? `<p style="margin:2px 0;">${taxLabel} No: ${settings.vat_number}</p>` : ''}
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:36px;">
    <div>
      <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0 0 4px;">Bill To</p>
      <p style="font-weight:600;margin:0;font-size:15px;">${toName}</p>
      ${toEmail ? `<p style="margin:2px 0;font-size:13px;color:#555;">${toEmail}</p>` : ''}
      ${toAddr ? `<p style="margin:2px 0;font-size:13px;color:#555;">${toAddr}</p>` : ''}
      ${invoice.vat_number ? `<p style="margin:2px 0;font-size:13px;color:#555;">${taxLabel} No: ${invoice.vat_number}</p>` : ''}
      ${invoice.po_number ? `<p style="margin:2px 0;font-size:13px;color:#555;">PO: ${invoice.po_number}</p>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="margin-bottom:8px;">
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Issue Date</p>
        <p style="font-size:14px;margin:2px 0;">${invoice.issued_date || '—'}</p>
      </div>
      <div style="margin-bottom:8px;">
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Due Date</p>
        <p style="font-size:14px;margin:2px 0;font-weight:600;">${invoice.due_date || '—'}</p>
      </div>
      <div>
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Status</p>
        <p style="font-size:14px;margin:2px 0;text-transform:capitalize;">${invoice.status}</p>
      </div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">Subtotal</span>
        <span>${invoice.currency} ${Number(invoice.subtotal || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">${taxLabel}</span>
        <span>${invoice.currency} ${Number(invoice.tax_amount || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:8px;">
        <span>Total</span>
        <span>${invoice.currency} ${Number(invoice.total || invoice.amount || 0).toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${bankDetails}

  ${invoice.notes ? `<div style="margin-top:32px;padding:16px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;"><p style="font-size:13px;color:#555;margin:0;">${invoice.notes}</p></div>` : ''}

  <div style="margin-top:48px;padding-top:16px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:12px;color:#999;">Payment terms: ${settings?.payment_terms_days ?? 14} days</p>
  </div>
</body>
</html>`;
}

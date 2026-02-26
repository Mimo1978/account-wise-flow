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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: invoice, error: invErr } = await admin
      .from('crm_invoices')
      .select('*, crm_companies(name), crm_deals(title)')
      .eq('id', invoice_id)
      .single();
    if (invErr) throw invErr;

    const { data: lineItems } = await admin
      .from('crm_invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('id', { ascending: true });

    const html = generateInvoiceHTML(invoice, lineItems ?? []);

    // Store as HTML
    const fileName = `${invoice.invoice_number || 'invoice'}.html`;
    const storagePath = `invoices/${fileName}`;

    const { error: uploadErr } = await admin.storage
      .from('crm-invoices')
      .upload(storagePath, new Blob([html], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html',
      });

    if (uploadErr) {
      return new Response(JSON.stringify({
        success: true,
        html,
        invoice_number: invoice.invoice_number,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      storage_path: storagePath,
      invoice_number: invoice.invoice_number,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateInvoiceHTML(invoice: any, lineItems: any[]): string {
  const companyName = invoice.crm_companies?.name || 'Client';
  const cur = invoice.currency === 'GBP' ? '£' : invoice.currency === 'USD' ? '$' : '€';

  const rows = lineItems.map((li: any, idx: number) => `
    <tr style="background:${idx % 2 === 1 ? '#f8f9fa' : '#fff'};">
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:14px;">${li.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${li.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;">${cur}${Number(li.unit_price).toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${li.vat_rate}%</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;">${cur}${(Number(li.line_total) * li.vat_rate / 100).toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px;font-weight:600;">${cur}${Number(li.line_total).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoice.invoice_number}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;">
    <div>
      <h1 style="font-size:28px;font-weight:700;margin:0;color:#111;">INVOICE</h1>
      <p style="font-size:16px;color:#666;margin:4px 0;">${invoice.invoice_number || ''}</p>
    </div>
    <div style="text-align:right;font-size:13px;color:#555;">
      <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Status</p>
      <p style="font-size:14px;margin:2px 0;text-transform:capitalize;font-weight:600;">${invoice.status}</p>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:36px;">
    <div>
      <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0 0 4px;">Bill To</p>
      <p style="font-weight:600;margin:0;font-size:15px;">${companyName}</p>
    </div>
    <div style="text-align:right;">
      <div style="margin-bottom:8px;">
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Issue Date</p>
        <p style="font-size:14px;margin:2px 0;">${invoice.issue_date || '—'}</p>
      </div>
      <div>
        <p style="font-size:11px;text-transform:uppercase;color:#999;margin:0;">Due Date</p>
        <p style="font-size:14px;margin:2px 0;font-weight:600;">${invoice.due_date || '—'}</p>
      </div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <thead>
      <tr style="background:#f8f9fa;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Description</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Unit Price</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">VAT %</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">VAT</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;border-bottom:2px solid #e5e7eb;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">Subtotal</span>
        <span>${cur}${Number(invoice.subtotal || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
        <span style="color:#666;">VAT</span>
        <span>${cur}${Number(invoice.vat_amount || 0).toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:700;border-top:2px solid #111;margin-top:8px;">
        <span>Total</span>
        <span>${cur}${Number(invoice.total || 0).toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `<div style="margin-top:32px;padding:16px;background:#fffbeb;border-radius:8px;border-left:3px solid #f59e0b;"><p style="font-size:13px;color:#555;margin:0;white-space:pre-wrap;">${invoice.notes}</p></div>` : ''}
</body>
</html>`;
}

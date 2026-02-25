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
    const { workspace_id, mode = 'execute' } = body;

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Find due plans
    const { data: duePlans, error: plansErr } = await admin
      .from('invoice_plans')
      .select('*, companies(name)')
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')
      .lte('next_run_date', today);

    if (plansErr) throw plansErr;

    // Also find plans where next_run_date is null but start_date <= today
    const { data: newPlans, error: newErr } = await admin
      .from('invoice_plans')
      .select('*, companies(name)')
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')
      .is('next_run_date', null)
      .lte('start_date', today);

    if (newErr) throw newErr;

    const allPlans = [...(duePlans ?? []), ...(newPlans ?? [])];

    // Get workspace billing settings
    const { data: settings } = await admin
      .from('workspace_billing_settings')
      .select('*')
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    const errors: Record<string, string> = {};
    let invoicesCreated = 0;
    let invoicesSkipped = 0;
    const planResults: Array<{ plan_id: string; status: string; invoice_id?: string; error?: string }> = [];

    if (mode === 'dry_run') {
      // Just return what would happen
      for (const plan of allPlans) {
        const issues: string[] = [];
        if (!settings?.legal_name) issues.push('Missing workspace legal name');
        if (!settings?.invoice_prefix) issues.push('Missing invoice prefix');

        // Check company billing profile
        const { data: profile } = await admin
          .from('company_billing_profiles')
          .select('billing_email')
          .eq('workspace_id', workspace_id)
          .eq('company_id', plan.company_id)
          .maybeSingle();

        if (!profile?.billing_email) issues.push('Missing company billing email');

        planResults.push({
          plan_id: plan.id,
          status: issues.length > 0 ? 'blocked' : 'ready',
          error: issues.length > 0 ? issues.join('; ') : undefined,
        });
      }

      return new Response(JSON.stringify({
        mode: 'dry_run',
        plans_count: allPlans.length,
        results: planResults,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Execute mode
    for (const plan of allPlans) {
      try {
        // Validate settings
        const missingSettings: string[] = [];
        if (!settings) missingSettings.push('No billing settings configured');

        // Check company billing profile
        const { data: profile } = await admin
          .from('company_billing_profiles')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('company_id', plan.company_id)
          .maybeSingle();

        if (!profile?.billing_email) missingSettings.push('Missing billing email for ' + (plan.companies?.name ?? plan.company_id));

        if (missingSettings.length > 0) {
          errors[plan.id] = missingSettings.join('; ');
          invoicesSkipped++;
          planResults.push({ plan_id: plan.id, status: 'skipped', error: missingSettings.join('; ') });
          continue;
        }

        // Generate invoice number
        const prefix = settings!.invoice_prefix || 'INV';
        const nextNum = settings!.next_invoice_number || 1;
        const invoiceNumber = `${prefix}-${String(nextNum).padStart(6, '0')}`;

        // Calculate amounts
        let subtotal = 0;
        let lineDescription = plan.description || plan.name;

        if (plan.amount_mode === 'fixed' && plan.fixed_amount) {
          subtotal = plan.fixed_amount;
        } else if ((plan.amount_mode === 'days_x_rate' || plan.amount_mode === 'timesheet_estimate') && plan.rate_per_day && plan.estimated_days) {
          subtotal = plan.rate_per_day * plan.estimated_days;
          lineDescription = `${plan.name} — ${plan.estimated_days} days @ ${plan.currency} ${plan.rate_per_day}/day`;
        }

        const vatRate = plan.vat_rate ?? 0;
        const taxAmount = subtotal * vatRate;
        const total = subtotal + taxAmount;

        const paymentTerms = settings!.payment_terms_days || 14;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + paymentTerms);

        // Create invoice
        const { data: invoice, error: invErr } = await admin
          .from('invoices')
          .insert({
            workspace_id,
            company_id: plan.company_id,
            engagement_id: plan.engagement_id,
            invoice_number: invoiceNumber,
            status: 'draft',
            amount: total,
            currency: plan.currency,
            issued_date: today,
            due_date: dueDate.toISOString().split('T')[0],
            subtotal,
            tax_amount: taxAmount,
            total,
            billing_to_name: profile?.billing_address_line1 ? (plan.companies?.name ?? '') : (plan.companies?.name ?? ''),
            billing_to_email: profile?.billing_email,
            billing_to_address: profile ? {
              line1: profile.billing_address_line1,
              line2: profile.billing_address_line2,
              city: profile.billing_city,
              postcode: profile.billing_postcode,
              country: profile.billing_country,
            } : null,
            vat_number: profile?.vat_number,
            po_number: profile?.po_number,
            invoice_plan_id: plan.id,
          })
          .select()
          .single();

        if (invErr) throw invErr;

        // Create line item
        await admin
          .from('invoice_line_items')
          .insert({
            workspace_id,
            invoice_id: invoice.id,
            sort_order: 1,
            description: lineDescription,
            quantity: plan.amount_mode === 'days_x_rate' ? (plan.estimated_days ?? 1) : 1,
            unit_price: plan.amount_mode === 'days_x_rate' ? (plan.rate_per_day ?? 0) : subtotal,
            line_total: subtotal,
          });

        // Increment invoice number
        await admin
          .from('workspace_billing_settings')
          .update({ next_invoice_number: nextNum + 1 })
          .eq('workspace_id', workspace_id);

        // Advance next_run_date
        const nextRun = computeNextRunDate(plan);
        await admin
          .from('invoice_plans')
          .update({ next_run_date: nextRun, updated_at: new Date().toISOString() })
          .eq('id', plan.id);

        invoicesCreated++;
        planResults.push({ plan_id: plan.id, status: 'created', invoice_id: invoice.id });

      } catch (err: any) {
        errors[plan.id] = err.message;
        invoicesSkipped++;
        planResults.push({ plan_id: plan.id, status: 'failed', error: err.message });
      }
    }

    // Write invoice_runs record
    await admin.from('invoice_runs').insert({
      workspace_id,
      ran_at: new Date().toISOString(),
      due_date: today,
      plans_processed: allPlans.length,
      invoices_created: invoicesCreated,
      invoices_skipped: invoicesSkipped,
      errors,
      created_by: user.id,
      // Legacy columns with defaults
      billing_plan_id: allPlans[0]?.id ?? null,
      engagement_id: allPlans[0]?.engagement_id ?? null,
      dedupe_key: `${workspace_id}-${today}-bulk`,
      period_start: today,
      period_end: today,
      status: invoicesCreated > 0 ? 'created' : 'skipped',
    });

    return new Response(JSON.stringify({
      mode: 'execute',
      plans_processed: allPlans.length,
      invoices_created: invoicesCreated,
      invoices_skipped: invoicesSkipped,
      errors,
      results: planResults,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function computeNextRunDate(plan: any): string {
  const current = plan.next_run_date ? new Date(plan.next_run_date) : new Date();
  const next = new Date(current);

  switch (plan.frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7 * (plan.interval_count || 1));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + (plan.interval_count || 1));
      if (plan.invoice_day_of_month) {
        next.setDate(Math.min(plan.invoice_day_of_month, 28));
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3 * (plan.interval_count || 1));
      if (plan.invoice_day_of_month) {
        next.setDate(Math.min(plan.invoice_day_of_month, 28));
      }
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString().split('T')[0];
}

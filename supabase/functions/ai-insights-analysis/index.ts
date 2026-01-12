import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: track requests per user (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // 20 requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms

// Max payload size: 500KB
const MAX_PAYLOAD_SIZE = 500 * 1024;

interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  seniority: string;
  status: string;
  engagementScore?: number;
  role?: string;
  contactOwner?: string;
  lastContact?: string;
  notes?: { content: string; date: string; author: string }[];
  activities?: { type: string; date: string; description: string }[];
}

interface AccountContext {
  accountName: string;
  accountId?: string;
  industry: string;
  contacts: Contact[];
  importantNote?: string;
}

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  userLimit.count++;
  return { allowed: true };
}

function validatePayload(payload: unknown): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Invalid payload format' };
  }

  const p = payload as Record<string, unknown>;
  
  if (!p.accountContext || typeof p.accountContext !== 'object') {
    return { valid: false, error: 'Missing accountContext' };
  }

  const ctx = p.accountContext as Record<string, unknown>;
  
  if (typeof ctx.accountName !== 'string' || ctx.accountName.length > 200) {
    return { valid: false, error: 'Invalid accountName' };
  }

  if (typeof ctx.industry !== 'string' || ctx.industry.length > 100) {
    return { valid: false, error: 'Invalid industry' };
  }

  if (!Array.isArray(ctx.contacts) || ctx.contacts.length > 500) {
    return { valid: false, error: 'Invalid contacts array (max 500)' };
  }

  return { valid: true };
}

async function verifyCompanyAccess(supabase: any, companyId?: string): Promise<boolean> {
  if (!companyId) {
    return true;
  }

  // RLS will automatically filter based on demo isolation
  // If the query returns data, user has access
  const { data, error } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

// Check if user is in demo mode - demo users can only access demo data
async function checkDemoIsolation(supabase: any, userId: string): Promise<{ isDemo: boolean }> {
  const { data, error } = await supabase.rpc('is_demo_user', { _user_id: userId });
  
  if (error) {
    console.error('Failed to check demo status:', error);
    return { isDemo: false };
  }
  
  return { isDemo: !!data };
}

async function logAudit(
  supabase: any,
  userId: string,
  action: string,
  entityId: string | null,
  context: Record<string, unknown>
) {
  try {
    await supabase.from('audit_log').insert({
      entity_type: 'ai_function',
      entity_id: entityId || 'system',
      action,
      changed_by: userId,
      diff: {},
      context: {
        ...context,
        function: 'ai-insights-analysis',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    // 1. Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Payload too large (max 500KB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // 3. Validate JWT using getClaims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No user ID in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Rate limiting
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      await logAudit(supabase, userId, 'rate_limited', null, { retryAfter: rateCheck.retryAfter });
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60)
          } 
        }
      );
    }

    // 5. Parse and validate payload
    let payload: unknown;
    try {
      const text = await req.text();
      if (text.length > MAX_PAYLOAD_SIZE) {
        return new Response(
          JSON.stringify({ error: 'Payload too large' }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      payload = JSON.parse(text);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accountContext } = payload as { accountContext: AccountContext };

    // 6. Authorization - verify company access
    const hasAccess = await verifyCompanyAccess(supabase, accountContext.accountId);
    if (!hasAccess) {
      await logAudit(supabase, userId, 'access_denied', accountContext.accountId || null, {
        reason: 'No company access',
      });
      return new Response(
        JSON.stringify({ error: 'Forbidden - No access to this company data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Check demo isolation and log the request
    const demoStatus = await checkDemoIsolation(supabase, userId);
    
    await logAudit(supabase, userId, 'insights_analysis_request', accountContext.accountId || null, {
      accountName: accountContext.accountName,
      contactCount: accountContext.contacts.length,
      isDemoUser: demoStatus.isDemo,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextSummary = buildContextSummary(accountContext);

    const systemPrompt = `You are an AI analyst for enterprise account management. Analyze the account data and identify opportunity threads and organizational gaps.

ACCOUNT DATA:
${contextSummary}

ANALYSIS REQUIREMENTS:

1. **REPEATED PROJECT THEMES** - Identify recurring topics, concerns, or project themes mentioned across notes and activities. Look for patterns in discussions.

2. **MISSING STAKEHOLDERS** - Identify gaps where key decision-makers or influencers might be missing. Consider:
   - Technical decisions without technical evaluators
   - Budget discussions without economic buyers
   - Strategic initiatives without executive sponsors

3. **DEPARTMENTS WITHOUT OWNERS** - Find departments that have contacts but no clear ownership or champion for your solution.

4. **BLOCKERS WITHOUT COUNTERBALANCE** - Identify blockers who don't have corresponding champions or supporters to balance their influence.

5. **ENGAGEMENT GAPS** - Find areas where engagement is low or contacts haven't been reached recently.

RESPONSE FORMAT:
Return a JSON object with this exact structure:
{
  "repeatedThemes": [
    {
      "theme": "theme name",
      "description": "brief description of the pattern",
      "evidence": ["specific note or activity references"],
      "contactIds": ["ids of contacts involved"]
    }
  ],
  "missingStakeholders": [
    {
      "gap": "what's missing",
      "reason": "why this matters",
      "recommendation": "suggested action",
      "relatedContactIds": ["ids of related contacts"]
    }
  ],
  "departmentsWithoutOwners": [
    {
      "department": "department name",
      "issue": "what's lacking",
      "contactIds": ["ids of contacts in this department"],
      "recommendation": "suggested action"
    }
  ],
  "unbalancedBlockers": [
    {
      "blockerName": "name",
      "blockerId": "id",
      "concern": "their likely concern",
      "recommendation": "how to counterbalance"
    }
  ],
  "engagementGaps": [
    {
      "area": "description of the gap",
      "contactIds": ["affected contact ids"],
      "recommendation": "suggested action"
    }
  ],
  "summary": "2-3 sentence executive summary of the most critical insights"
}

Important:
- Be specific and reference actual contact names and data
- Include contact IDs in contactIds arrays for highlighting
- Provide actionable but non-prescriptive recommendations
- If a category has no findings, return an empty array`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Analyze this account and provide insights in the specified JSON format.' }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limits exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required, please add credits to your workspace.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    try {
      const insights = JSON.parse(jsonContent);
      
      // Log successful completion
      await logAudit(supabase, userId, 'insights_analysis_complete', accountContext.accountId || null, {
        accountName: accountContext.accountName,
        themesFound: insights.repeatedThemes?.length || 0,
      });
      
      return new Response(JSON.stringify(insights), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse insights',
        raw: content 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('AI insights analysis error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildContextSummary(context: AccountContext): string {
  const { accountName, industry, contacts, importantNote } = context;

  let summary = `Account: ${accountName}\nIndustry: ${industry}\n`;
  
  if (importantNote) {
    summary += `Important Note: ${importantNote}\n`;
  }

  summary += `\n--- CONTACTS (${contacts.length} total) ---\n\n`;

  const byDepartment: Record<string, Contact[]> = {};
  contacts.forEach(c => {
    if (!byDepartment[c.department]) byDepartment[c.department] = [];
    byDepartment[c.department].push(c);
  });

  summary += `Departments: ${Object.keys(byDepartment).join(', ')}\n\n`;

  for (const [dept, deptContacts] of Object.entries(byDepartment)) {
    summary += `## ${dept} (${deptContacts.length} contacts):\n`;
    for (const c of deptContacts) {
      summary += `[ID: ${c.id}] ${c.name} - ${c.title}\n`;
      summary += `  Status: ${c.status} | Engagement: ${c.engagementScore ?? 'N/A'}`;
      if (c.role) summary += ` | Role: ${c.role}`;
      if (c.contactOwner) summary += ` | Owner: ${c.contactOwner}`;
      if (c.lastContact) summary += ` | Last Contact: ${c.lastContact}`;
      summary += '\n';
      
      if (c.notes && c.notes.length > 0) {
        summary += `  Notes:\n`;
        c.notes.forEach(n => {
          summary += `    - [${n.date}] ${n.content}\n`;
        });
      }
      
      if (c.activities && c.activities.length > 0) {
        summary += `  Activities:\n`;
        c.activities.slice(0, 3).forEach(a => {
          summary += `    - [${a.date}] ${a.type}: ${a.description}\n`;
        });
      }
    }
    summary += '\n';
  }

  const roleDistribution: Record<string, string[]> = {};
  contacts.forEach(c => {
    if (c.role) {
      if (!roleDistribution[c.role]) roleDistribution[c.role] = [];
      roleDistribution[c.role].push(c.name);
    }
  });
  
  summary += `\n--- ROLE DISTRIBUTION ---\n`;
  for (const [role, names] of Object.entries(roleDistribution)) {
    summary += `${role}: ${names.join(', ')}\n`;
  }

  const statusDistribution: Record<string, number> = {};
  contacts.forEach(c => {
    statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
  });
  
  summary += `\n--- STATUS DISTRIBUTION ---\n`;
  for (const [status, count] of Object.entries(statusDistribution)) {
    summary += `${status}: ${count}\n`;
  }

  return summary;
}

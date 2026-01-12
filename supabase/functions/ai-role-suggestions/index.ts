import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 500KB
const MAX_PAYLOAD_SIZE = 500 * 1024;

interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  seniority: string;
  status: string;
  role?: string;
}

interface AccountContext {
  accountName: string;
  accountId?: string;
  industry: string;
  companySize?: string;
  contacts: Contact[];
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
        function: 'ai-role-suggestions',
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

    // 7. Log the request
    await logAudit(supabase, userId, 'role_suggestions_request', accountContext.accountId || null, {
      accountName: accountContext.accountName,
      contactCount: accountContext.contacts.length,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextSummary = buildContextSummary(accountContext);

    const systemPrompt = `You are an expert in enterprise B2B sales and organizational structures. Analyze the current org chart and suggest roles/positions that are likely to exist but are missing from our contact list.

CURRENT ORG CHART:
${contextSummary}

ANALYSIS REQUIREMENTS:

1. Identify MISSING ROLES that typically exist in a ${accountContext.industry} company of size "${accountContext.companySize || 'unknown'}"

2. Focus on roles that are:
   - Critical for decision-making in enterprise sales
   - Common in the departments already identified
   - Likely to influence or block deals
   - Often involved in technical evaluation, procurement, or implementation

3. For each suggested role, explain WHY it's relevant to our sales process

4. Prioritize by impact: which missing roles would be most valuable to identify?

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "suggestions": [
    {
      "id": "unique_id",
      "roleName": "VP of IT Security",
      "department": "Technology",
      "seniority": "director",
      "likelyInfluence": "high|medium|low",
      "reason": "Why this role is relevant to our deal",
      "typicalResponsibilities": ["responsibility 1", "responsibility 2"],
      "potentialConcerns": "What concerns they might have about our solution",
      "suggestedApproach": "How to engage this role if found",
      "relatedExistingContacts": ["names of contacts who might report to or work with this role"]
    }
  ],
  "departmentGaps": [
    {
      "department": "Legal",
      "reason": "No legal/compliance contacts identified - typically involved in contract review",
      "suggestedRoles": ["General Counsel", "Contract Manager"]
    }
  ],
  "hierarchyGaps": [
    {
      "gap": "No direct reports identified for CTO",
      "suggestedRoles": ["VP Engineering", "Director of Architecture"]
    }
  ]
}

Important:
- Suggest ROLES, not specific people
- Base suggestions on typical organizational structures
- Consider the industry context
- Maximum 8 role suggestions, prioritized by impact
- Be specific about why each role matters for sales`;

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
          { role: 'user', content: 'Analyze the org chart and suggest missing roles that should be identified.' }
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
        return new Response(JSON.stringify({ error: 'Payment required, please add credits.' }), {
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
      const suggestions = JSON.parse(jsonContent);
      
      await logAudit(supabase, userId, 'role_suggestions_complete', accountContext.accountId || null, {
        accountName: accountContext.accountName,
        suggestionsCount: suggestions.suggestions?.length || 0,
      });
      
      return new Response(JSON.stringify(suggestions), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(JSON.stringify({ 
        error: 'Failed to parse suggestions',
        raw: content 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('AI role suggestions error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildContextSummary(context: AccountContext): string {
  const { accountName, industry, companySize, contacts } = context;

  let summary = `Company: ${accountName}\nIndustry: ${industry}\nSize: ${companySize || 'Unknown'}\n\n`;
  
  const byDepartment: Record<string, Contact[]> = {};
  contacts.forEach(c => {
    if (!byDepartment[c.department]) byDepartment[c.department] = [];
    byDepartment[c.department].push(c);
  });

  summary += `DEPARTMENTS COVERED: ${Object.keys(byDepartment).join(', ')}\n\n`;
  summary += `TOTAL CONTACTS: ${contacts.length}\n\n`;

  summary += `CURRENT ORG CHART:\n`;
  for (const [dept, deptContacts] of Object.entries(byDepartment)) {
    summary += `\n${dept}:\n`;
    const sorted = deptContacts.sort((a, b) => {
      const order = { executive: 0, director: 1, manager: 2, senior: 3, mid: 4, junior: 5 };
      return (order[a.seniority as keyof typeof order] || 5) - (order[b.seniority as keyof typeof order] || 5);
    });
    sorted.forEach(c => {
      summary += `  - ${c.title} (${c.seniority})`;
      if (c.role) summary += ` [${c.role}]`;
      summary += `\n`;
    });
  }

  const seniorityCount: Record<string, number> = {};
  contacts.forEach(c => {
    seniorityCount[c.seniority] = (seniorityCount[c.seniority] || 0) + 1;
  });
  
  summary += `\nSENIORITY DISTRIBUTION:\n`;
  for (const [seniority, count] of Object.entries(seniorityCount)) {
    summary += `  ${seniority}: ${count}\n`;
  }

  const roleCount: Record<string, number> = {};
  contacts.forEach(c => {
    if (c.role) roleCount[c.role] = (roleCount[c.role] || 0) + 1;
  });
  
  summary += `\nIDENTIFIED BUYING ROLES:\n`;
  for (const [role, count] of Object.entries(roleCount)) {
    summary += `  ${role}: ${count}\n`;
  }

  return summary;
}

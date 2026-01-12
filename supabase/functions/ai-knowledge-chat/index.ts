import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30; // Chat can be more frequent
const RATE_LIMIT_WINDOW = 60 * 1000;

// Max payload size: 500KB
const MAX_PAYLOAD_SIZE = 500 * 1024;
const MAX_QUESTION_LENGTH = 2000;

interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  seniority: string;
  email: string;
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
  
  if (typeof p.question !== 'string' || p.question.length === 0) {
    return { valid: false, error: 'Missing question' };
  }

  if (p.question.length > MAX_QUESTION_LENGTH) {
    return { valid: false, error: `Question too long (max ${MAX_QUESTION_LENGTH} chars)` };
  }

  if (!p.accountContext || typeof p.accountContext !== 'object') {
    return { valid: false, error: 'Missing accountContext' };
  }

  const ctx = p.accountContext as Record<string, unknown>;
  
  if (typeof ctx.accountName !== 'string' || ctx.accountName.length > 200) {
    return { valid: false, error: 'Invalid accountName' };
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
        function: 'ai-knowledge-chat',
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

    const { question, accountContext } = payload as { question: string; accountContext: AccountContext };

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
    await logAudit(supabase, userId, 'knowledge_chat_request', accountContext.accountId || null, {
      accountName: accountContext.accountName,
      questionLength: question.length,
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const contextSummary = buildContextSummary(accountContext);

    const systemPrompt = `You are an AI knowledge assistant for account relationship management. You have access to all contacts, notes, engagement history, roles, and departments for the current account.

ACCOUNT CONTEXT:
${contextSummary}

INSTRUCTIONS:
1. Answer questions about contacts, relationships, engagement patterns, and themes
2. Always reference specific evidence: contact names, dates, notes, and activities
3. When identifying contacts relevant to the answer, include their IDs in a special format: [HIGHLIGHT:contact_id]
4. Never suggest changing any data - you are read-only
5. Be specific and cite your sources from the context provided
6. If asked about themes or patterns, analyze notes and activities across all contacts
7. If asked about ownership or responsibilities, reference contact roles and departments
8. For engagement gaps, look at lastContact dates and engagementScore values

When referencing contacts that are relevant to your answer, format them as [HIGHLIGHT:id] where id is the contact's id. This will highlight them on the org chart.

Example: "Based on the notes, [HIGHLIGHT:1] Robert Morrison has been discussing pricing concerns..."`;

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
          { role: 'user', content: question }
        ],
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('AI knowledge chat error:', error);
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

  for (const [dept, deptContacts] of Object.entries(byDepartment)) {
    summary += `\n## ${dept} Department:\n`;
    for (const c of deptContacts) {
      summary += `\n[ID: ${c.id}] ${c.name}\n`;
      summary += `  Title: ${c.title}\n`;
      summary += `  Seniority: ${c.seniority}\n`;
      summary += `  Status: ${c.status}\n`;
      summary += `  Engagement Score: ${c.engagementScore ?? 'N/A'}\n`;
      if (c.role) summary += `  Role: ${c.role}\n`;
      if (c.contactOwner) summary += `  Contact Owner: ${c.contactOwner}\n`;
      if (c.lastContact) summary += `  Last Contact: ${c.lastContact}\n`;
      
      if (c.notes && c.notes.length > 0) {
        summary += `  Notes:\n`;
        c.notes.forEach(n => {
          summary += `    - [${n.date}] ${n.author}: ${n.content}\n`;
        });
      }
      
      if (c.activities && c.activities.length > 0) {
        summary += `  Recent Activities:\n`;
        c.activities.slice(0, 5).forEach(a => {
          summary += `    - [${a.date}] ${a.type}: ${a.description}\n`;
        });
      }
    }
  }

  const champions = contacts.filter(c => c.status === 'champion');
  const blockers = contacts.filter(c => c.status === 'blocker');
  const lowEngagement = contacts.filter(c => (c.engagementScore ?? 100) < 50);
  
  summary += `\n--- ENGAGEMENT SUMMARY ---\n`;
  summary += `Champions: ${champions.map(c => c.name).join(', ') || 'None identified'}\n`;
  summary += `Blockers: ${blockers.map(c => c.name).join(', ') || 'None identified'}\n`;
  summary += `Low Engagement (<50): ${lowEngagement.map(c => `${c.name} (${c.engagementScore})`).join(', ') || 'None'}\n`;

  return summary;
}

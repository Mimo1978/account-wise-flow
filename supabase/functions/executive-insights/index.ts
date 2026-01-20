import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

interface ExecutiveQuery {
  query: string;
  queryType?: 'exposure_analysis' | 'next_action' | 'contract_review' | 'coverage_check' | 'risk_assessment' | 'general';
  companyId?: string;
  includeAllCompanies?: boolean;
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

// Classify the query type based on natural language
function classifyQuery(query: string): ExecutiveQuery['queryType'] {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('exposed') || lowerQuery.includes('risk') || lowerQuery.includes('vulnerable')) {
    return 'exposure_analysis';
  }
  if (lowerQuery.includes('next') || lowerQuery.includes('should') || lowerQuery.includes('talk to') || lowerQuery.includes('action')) {
    return 'next_action';
  }
  if (lowerQuery.includes('contract') || lowerQuery.includes('expir') || lowerQuery.includes('renew')) {
    return 'contract_review';
  }
  if (lowerQuery.includes('coverage') || lowerQuery.includes('penetration') || lowerQuery.includes('relationship')) {
    return 'coverage_check';
  }
  if (lowerQuery.includes('assessment') || lowerQuery.includes('health') || lowerQuery.includes('score')) {
    return 'risk_assessment';
  }
  return 'general';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    // Authentication required
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role - must be admin or manager for executive insights
    const { data: role } = await supabase.rpc('get_user_role', { _user_id: user.id });
    if (!role || !['admin', 'manager'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Executive insights require admin or manager role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    const rateCheck = checkRateLimit(user.id);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    const body: ExecutiveQuery = await req.json();
    const { query, companyId, includeAllCompanies } = body;

    if (!query || typeof query !== 'string' || query.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Invalid query' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's workspace
    const { data: workspaceId } = await supabase.rpc('get_user_team_id', { _user_id: user.id });
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'No workspace found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Classify the query
    const queryType = classifyQuery(query) || 'general';

    // Fetch relevant data based on query type
    const contextData = await gatherContextData(supabase, workspaceId, companyId, includeAllCompanies, queryType);

    // Call AI for analysis
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = buildExecutiveSystemPrompt(queryType, contextData);

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
          { role: 'user', content: query }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'executive_response',
              description: 'Structured response to executive query',
              parameters: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: 'Executive summary (2-3 sentences)' },
                  insights: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['risk', 'opportunity', 'gap', 'action', 'info'] },
                        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        companyName: { type: 'string' },
                        companyId: { type: 'string' },
                        contactNames: { type: 'array', items: { type: 'string' } },
                        recommendedAction: { type: 'string' }
                      },
                      required: ['type', 'severity', 'title', 'description']
                    }
                  },
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string' },
                        priority: { type: 'string', enum: ['immediate', 'this_week', 'this_month'] },
                        context: { type: 'string' }
                      },
                      required: ['action', 'priority']
                    }
                  },
                  metrics: {
                    type: 'object',
                    properties: {
                      companiesAtRisk: { type: 'number' },
                      coverageGaps: { type: 'number' },
                      upcomingRenewals: { type: 'number' },
                      missingRoles: { type: 'number' }
                    }
                  }
                },
                required: ['summary', 'insights', 'recommendations']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'executive_response' } }
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
      throw new Error('AI gateway error');
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let result;
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = { summary: 'Unable to parse AI response', insights: [], recommendations: [] };
      }
    } else {
      result = { summary: 'No structured response available', insights: [], recommendations: [] };
    }

    // Log the query
    await supabase.from('executive_queries').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      query_text: query,
      query_type: queryType,
      response_summary: result.summary,
      response_data: result,
    });

    return new Response(JSON.stringify({
      queryType,
      ...result,
      dataContext: {
        companiesAnalyzed: contextData.companies?.length || 0,
        contactsAnalyzed: contextData.totalContacts || 0,
        notesAnalyzed: contextData.totalNotes || 0,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Executive insights error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function gatherContextData(
  supabase: any, 
  workspaceId: string, 
  companyId?: string, 
  includeAllCompanies?: boolean,
  queryType?: string
) {
  const context: any = { companies: [], totalContacts: 0, totalNotes: 0 };

  // Fetch companies (RLS will filter based on access)
  let companiesQuery = supabase
    .from('companies')
    .select('id, name, industry, size, owner_id, created_at, updated_at')
    .eq('team_id', workspaceId);
    
  if (companyId && !includeAllCompanies) {
    companiesQuery = companiesQuery.eq('id', companyId);
  }
  
  const { data: companies } = await companiesQuery.limit(50);
  context.companies = companies || [];

  if (context.companies.length === 0) {
    return context;
  }

  const companyIds = context.companies.map((c: any) => c.id);

  // Fetch contacts for these companies
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, title, department, email, company_id, owner_id, created_at, updated_at')
    .in('company_id', companyIds)
    .limit(500);
  
  context.contacts = contacts || [];
  context.totalContacts = context.contacts.length;

  // Fetch notes for context
  const { data: notes } = await supabase
    .from('notes')
    .select('id, content, entity_type, entity_id, created_at, source, visibility')
    .in('entity_id', [...companyIds, ...(contacts || []).map((c: any) => c.id)])
    .order('created_at', { ascending: false })
    .limit(200);
  
  context.notes = notes || [];
  context.totalNotes = context.notes.length;

  // Fetch existing risk signals
  const { data: risks } = await supabase
    .from('risk_signals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_resolved', false)
    .limit(50);
  
  context.existingRisks = risks || [];

  // Fetch coverage data
  const { data: coverage } = await supabase
    .from('relationship_coverage')
    .select('*')
    .eq('workspace_id', workspaceId)
    .limit(100);
  
  context.coverage = coverage || [];

  return context;
}

function buildExecutiveSystemPrompt(queryType: string, contextData: any): string {
  const companySummary = contextData.companies.map((c: any) => 
    `- ${c.name} (${c.industry || 'Unknown industry'}, ${c.size || 'Unknown size'})`
  ).join('\n');

  const contactSummary = contextData.contacts?.slice(0, 100).map((c: any) => 
    `- ${c.name}: ${c.title || 'No title'} at ${contextData.companies.find((co: any) => co.id === c.company_id)?.name || 'Unknown company'} (${c.department || 'No dept'})`
  ).join('\n') || 'No contacts available';

  const recentNotes = contextData.notes?.slice(0, 50).map((n: any) => 
    `[${new Date(n.created_at).toLocaleDateString()}] ${n.content.substring(0, 200)}...`
  ).join('\n') || 'No recent notes';

  const existingRisks = contextData.existingRisks?.map((r: any) => 
    `- [${r.risk_level.toUpperCase()}] ${r.title}: ${r.description}`
  ).join('\n') || 'No active risk signals';

  return `You are an executive intelligence analyst for a CRM system. Your role is to help leadership understand:
- Revenue exposure and risk
- Growth opportunities
- Relationship coverage gaps
- Required actions

CURRENT PORTFOLIO DATA:
======================

COMPANIES (${contextData.companies.length}):
${companySummary}

KEY CONTACTS (${contextData.totalContacts} total):
${contactSummary}

RECENT ACTIVITY (${contextData.totalNotes} notes):
${recentNotes}

ACTIVE RISK SIGNALS:
${existingRisks}

COVERAGE DATA:
${contextData.coverage?.length || 0} coverage records available

QUERY CONTEXT: ${queryType}

RESPONSE REQUIREMENTS:
1. Be specific - reference actual company and contact names
2. Prioritize by business impact
3. Provide actionable recommendations
4. Quantify risks where possible (e.g., "3 accounts at risk", "2 contracts expiring")
5. Focus on the executive's question type: ${queryType}

Common executive questions and how to answer:
- "Where are we exposed?" → Identify accounts with low coverage, missing champions, or engagement decline
- "Who should we be talking to next?" → Prioritize by strategic value and engagement opportunity
- "What contracts are expiring?" → Surface renewal timelines and risk indicators
- "How healthy is our portfolio?" → Provide coverage scores and engagement metrics`;
}

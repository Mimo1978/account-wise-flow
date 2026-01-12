import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  accountId?: string; // Company ID for permission check
  industry: string;
  companySize?: string;
  contacts: Contact[];
}

// Verify user has access to the company data
async function verifyCompanyAccess(supabase: any, userId: string, companyId?: string): Promise<boolean> {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accountContext } = await req.json() as { accountContext: AccountContext };

    // Verify user has access to this company's data
    const hasAccess = await verifyCompanyAccess(supabase, user.id, accountContext.accountId);
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - No access to this company data' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    
    // Extract JSON from response
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    try {
      const suggestions = JSON.parse(jsonContent);
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
  
  // Group by department
  const byDepartment: Record<string, Contact[]> = {};
  contacts.forEach(c => {
    if (!byDepartment[c.department]) byDepartment[c.department] = [];
    byDepartment[c.department].push(c);
  });

  summary += `DEPARTMENTS COVERED: ${Object.keys(byDepartment).join(', ')}\n\n`;
  summary += `TOTAL CONTACTS: ${contacts.length}\n\n`;

  // List current org structure
  summary += `CURRENT ORG CHART:\n`;
  for (const [dept, deptContacts] of Object.entries(byDepartment)) {
    summary += `\n${dept}:\n`;
    // Sort by seniority
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

  // Seniority distribution
  const seniorityCount: Record<string, number> = {};
  contacts.forEach(c => {
    seniorityCount[c.seniority] = (seniorityCount[c.seniority] || 0) + 1;
  });
  
  summary += `\nSENIORITY DISTRIBUTION:\n`;
  for (const [seniority, count] of Object.entries(seniorityCount)) {
    summary += `  ${seniority}: ${count}\n`;
  }

  // Role distribution
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

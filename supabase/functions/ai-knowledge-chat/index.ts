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
  accountId?: string; // Company ID for permission check
  industry: string;
  contacts: Contact[];
  importantNote?: string;
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

    const { question, accountContext } = await req.json() as { 
      question: string; 
      accountContext: AccountContext 
    };

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

    // Build comprehensive context from account data
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

  // Group contacts by department
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

  // Add engagement analysis
  const champions = contacts.filter(c => c.status === 'champion');
  const blockers = contacts.filter(c => c.status === 'blocker');
  const lowEngagement = contacts.filter(c => (c.engagementScore ?? 100) < 50);
  
  summary += `\n--- ENGAGEMENT SUMMARY ---\n`;
  summary += `Champions: ${champions.map(c => c.name).join(', ') || 'None identified'}\n`;
  summary += `Blockers: ${blockers.map(c => c.name).join(', ') || 'None identified'}\n`;
  summary += `Low Engagement (<50): ${lowEngagement.map(c => `${c.name} (${c.engagementScore})`).join(', ') || 'None'}\n`;

  return summary;
}

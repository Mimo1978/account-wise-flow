import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  engagementScore?: number;
  role?: string;
  contactOwner?: string;
  lastContact?: string;
  notes?: { content: string; date: string; author: string }[];
  activities?: { type: string; date: string; description: string }[];
}

interface AccountContext {
  accountName: string;
  industry: string;
  contacts: Contact[];
  importantNote?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accountContext } = await req.json() as { accountContext: AccountContext };

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
    
    // Extract JSON from the response (handle markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    try {
      const insights = JSON.parse(jsonContent);
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

  // Group contacts by department
  const byDepartment: Record<string, Contact[]> = {};
  contacts.forEach(c => {
    if (!byDepartment[c.department]) byDepartment[c.department] = [];
    byDepartment[c.department].push(c);
  });

  // Department summary
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

  // Role distribution
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

  // Status distribution
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

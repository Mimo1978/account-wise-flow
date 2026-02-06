import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeneratedQuestion {
  id: string;
  question: string;
  reason: string;
  category: 'signal' | 'spec_gap' | 'clarification' | 'competency';
  signalId?: string;
  evidenceRefs: Array<{
    id: string;
    claimId: string;
    claimText: string;
    snippetText: string;
    snippetStart: number;
    snippetEnd: number;
    documentId: string;
    confidence: number;
    category: string;
  }>;
}

interface RequestBody {
  workspaceId: string;
  talentId: string;
  jobSpecId?: string;
  forceRegenerate?: boolean;
}

// Simple hash function for cache invalidation
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { workspaceId, talentId, jobSpecId, forceRegenerate = false } = body;

    if (!workspaceId || !talentId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-questions] Starting for talent=${talentId}, spec=${jobSpecId || 'none'}`);

    // Fetch candidate data
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', talentId)
      .single();

    if (candidateError || !candidate) {
      return new Response(JSON.stringify({ error: 'Candidate not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch job spec if provided
    let jobSpec = null;
    if (jobSpecId) {
      const { data: spec } = await supabase
        .from('job_specs')
        .select('*')
        .eq('id', jobSpecId)
        .single();
      jobSpec = spec;
    }

    // Fetch existing signals for this talent
    const { data: signals } = await supabase
      .from('talent_signals')
      .select('*')
      .eq('talent_id', talentId)
      .eq('is_dismissed', false);

    // Calculate hashes for cache invalidation
    const cvHash = simpleHash(candidate.raw_cv_text || candidate.name || '');
    const specHash = jobSpec ? simpleHash(JSON.stringify(jobSpec)) : null;

    // Check cache
    if (!forceRegenerate) {
      const { data: cached } = await supabase
        .from('talent_questions')
        .select('*')
        .eq('talent_id', talentId)
        .eq('job_spec_id', jobSpecId || null)
        .single();

      if (cached && cached.cv_hash === cvHash && cached.spec_hash === specHash) {
        console.log('[generate-questions] Returning cached questions');
        return new Response(JSON.stringify({
          success: true,
          questions: cached.questions,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Generate questions based on signals, CV, and spec
    const questions: GeneratedQuestion[] = [];
    let questionIndex = 0;

    const genId = () => `q-${questionIndex++}-${Date.now().toString(36)}`;

    // 1. Signal-based questions
    if (signals && signals.length > 0) {
      for (const signal of signals.slice(0, 5)) {
        const signalQuestions = generateSignalQuestions(signal, genId);
        questions.push(...signalQuestions);
      }
    }

    // 2. Spec gap questions (if job spec provided)
    if (jobSpec) {
      const specQuestions = generateSpecGapQuestions(candidate, jobSpec, genId);
      questions.push(...specQuestions);
    }

    // 3. Competency/clarification questions from experience
    const experience = Array.isArray(candidate.experience) ? candidate.experience : [];
    if (experience.length > 0) {
      const expQuestions = generateExperienceQuestions(experience, genId);
      questions.push(...expQuestions);
    }

    // Limit to 10 questions max
    const finalQuestions = questions.slice(0, 10);

    // Store in cache
    const { error: upsertError } = await supabase
      .from('talent_questions')
      .upsert({
        workspace_id: workspaceId,
        talent_id: talentId,
        job_spec_id: jobSpecId || null,
        questions: finalQuestions,
        cv_hash: cvHash,
        spec_hash: specHash,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'talent_id,job_spec_id',
      });

    if (upsertError) {
      console.error('[generate-questions] Cache upsert error:', upsertError);
    }

    console.log(`[generate-questions] Generated ${finalQuestions.length} questions`);

    return new Response(JSON.stringify({
      success: true,
      questions: finalQuestions,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[generate-questions] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateSignalQuestions(signal: any, genId: () => string): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const signalType = signal.signal_type;
  const evidence = signal.evidence || [];

  switch (signalType) {
    case 'short_tenure':
      questions.push({
        id: genId(),
        question: 'Can you walk me through the circumstances that led to your departure from your shorter roles?',
        reason: `Based on detected short tenure pattern: ${signal.title}`,
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      questions.push({
        id: genId(),
        question: 'Were any of these roles project-based or recovery assignments with defined end dates?',
        reason: 'Clarifying whether short tenures were intentional or circumstantial',
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      break;

    case 'unexplained_gap':
      questions.push({
        id: genId(),
        question: 'I noticed a gap in your employment history. What were you focused on during this period?',
        reason: `Based on detected gap: ${signal.title}`,
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      break;

    case 'role_mismatch':
      questions.push({
        id: genId(),
        question: 'This role requires senior-level experience. Can you describe your leadership scope in previous positions?',
        reason: `Based on role mismatch signal: ${signal.title}`,
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      questions.push({
        id: genId(),
        question: 'What was the largest team or budget you were responsible for?',
        reason: 'Exploring depth of seniority not explicitly stated in CV',
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      break;

    case 'contract_hopping':
      questions.push({
        id: genId(),
        question: 'What drives your decisions when choosing between contract opportunities?',
        reason: `Based on contract pattern: ${signal.title}`,
        category: 'signal',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
      break;

    default:
      questions.push({
        id: genId(),
        question: `Can you tell me more about: ${signal.description}`,
        reason: signal.title,
        category: 'clarification',
        signalId: signal.id,
        evidenceRefs: evidence,
      });
  }

  return questions;
}

function generateSpecGapQuestions(candidate: any, spec: any, genId: () => string): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const specSkills = spec.key_skills || [];
  const candidateSkillsRaw = candidate.skills;
  
  // Extract candidate skills
  let candidateSkills: string[] = [];
  if (Array.isArray(candidateSkillsRaw)) {
    candidateSkills = candidateSkillsRaw.map((s: any) => typeof s === 'string' ? s.toLowerCase() : '');
  } else if (candidateSkillsRaw?.primary_skills) {
    candidateSkills = candidateSkillsRaw.primary_skills.map((s: string) => s.toLowerCase());
  }

  // Find skills in spec not clearly evidenced in CV
  const missingSkills: string[] = [];
  for (const skill of specSkills) {
    const skillLower = skill.toLowerCase();
    const found = candidateSkills.some(cs => 
      cs.includes(skillLower) || skillLower.includes(cs)
    );
    if (!found) {
      missingSkills.push(skill);
    }
  }

  if (missingSkills.length > 0) {
    const skillsList = missingSkills.slice(0, 3).join(', ');
    questions.push({
      id: genId(),
      question: `The role requires experience with ${skillsList}. Can you share specific examples of working with these?`,
      reason: 'These skills are required but not clearly evidenced in the CV',
      category: 'spec_gap',
      evidenceRefs: [],
    });
  }

  // Sector alignment question
  if (spec.sector) {
    const cvText = (candidate.raw_cv_text || '').toLowerCase();
    if (!cvText.includes(spec.sector.toLowerCase())) {
      questions.push({
        id: genId(),
        question: `This role is in the ${spec.sector} sector. What relevant experience do you have in this industry?`,
        reason: `Sector "${spec.sector}" not prominently featured in CV`,
        category: 'spec_gap',
        evidenceRefs: [],
      });
    }
  }

  return questions;
}

function generateExperienceQuestions(experience: any[], genId: () => string): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];

  // Question about most recent role impact
  if (experience.length > 0) {
    const recent = experience[0];
    if (recent.company || recent.title) {
      questions.push({
        id: genId(),
        question: `In your role at ${recent.company || 'your current company'}, what was your biggest achievement or impact?`,
        reason: 'Understanding concrete outcomes from most recent position',
        category: 'competency',
        evidenceRefs: [],
      });
    }
  }

  // Look for interesting transitions
  if (experience.length >= 2) {
    const transitions = [];
    for (let i = 0; i < experience.length - 1 && i < 3; i++) {
      const current = experience[i];
      const previous = experience[i + 1];
      
      // Check for industry/role type changes
      if (current.title && previous.title) {
        const currentTitle = current.title.toLowerCase();
        const prevTitle = previous.title.toLowerCase();
        
        // If titles are significantly different
        if (!currentTitle.includes(prevTitle.split(' ')[0]) && 
            !prevTitle.includes(currentTitle.split(' ')[0])) {
          transitions.push({ from: previous.title, to: current.title });
        }
      }
    }

    if (transitions.length > 0) {
      const t = transitions[0];
      questions.push({
        id: genId(),
        question: `I noticed you transitioned from ${t.from} to ${t.to}. What prompted this career pivot?`,
        reason: 'Understanding career trajectory and motivations',
        category: 'clarification',
        evidenceRefs: [],
      });
    }
  }

  return questions;
}

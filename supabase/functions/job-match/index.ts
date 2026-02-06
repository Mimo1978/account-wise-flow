import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobSpec {
  id: string;
  workspace_id: string;
  title: string;
  description_text: string | null;
  key_skills: string[] | null;
  sector: string | null;
  location: string | null;
  type: 'permanent' | 'contract';
}

interface Candidate {
  id: string;
  name: string;
  email: string | null;
  current_title: string | null;
  current_company: string | null;
  location: string | null;
  headline: string | null;
  skills: any;
  experience: any;
  raw_cv_text: string | null;
}

interface TalentDocument {
  id: string;
  talent_id: string;
  parsed_text: string | null;
  parse_status: string;
}

interface EvidenceSnippet {
  id: string;
  claimId: string;
  claimText: string;
  snippetText: string;
  snippetStart: number;
  snippetEnd: number;
  documentId: string | null;
  confidence: number;
  category: 'skill' | 'experience' | 'company' | 'education' | 'certification' | 'other';
}

interface ClaimWithEvidence {
  id: string;
  text: string;
  category: 'skill_match' | 'sector' | 'tenure' | 'recency' | 'risk' | 'summary';
  evidence: EvidenceSnippet[];
}

interface MatchEvidence {
  claims: ClaimWithEvidence[];
  computedAt: string;
  version: string;
}

interface MatchResult {
  talent_id: string;
  overall_score: number;
  skill_match_score: number;
  sector_company_score: number;
  tenure_score: number;
  recency_score: number;
  score_breakdown: Record<string, any>;
  risk_flags: string[];
  suggested_questions: string[];
  top_evidence_snippets: string[];
  match_reasoning: string;
}

    // Fetch workspace settings for signal thresholds and company tiers
    const { data: wsSettings, error: wsError } = await supabase
      .from('workspace_settings')
      .select('short_tenure_threshold_months, gap_threshold_months, contract_hop_min_stints, contract_hop_lookback_months, top_tier_companies')
      .eq('workspace_id', spec.workspace_id)
      .single();

    // Use workspace settings or defaults
    const settings = wsSettings || {
      short_tenure_threshold_months: 9,
      gap_threshold_months: 6,
      contract_hop_min_stints: 3,
      contract_hop_lookback_months: 24,
      top_tier_companies: {},
    };

    // Merge workspace top-tier companies with defaults
    const SECTOR_TIERS: Record<string, string[]> = {
      'banking': ['Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Barclays', 'Deutsche Bank', 'HSBC', 'Citi', 'UBS', 'Credit Suisse'],
      'asset_management': ['BlackRock', 'Vanguard', 'Fidelity', 'State Street', 'PIMCO', 'Schroders', 'Aberdeen', 'Invesco'],
      'fintech': ['Stripe', 'Revolut', 'Monzo', 'Wise', 'Klarna', 'Checkout.com', 'Plaid', 'Robinhood'],
      'consulting': ['McKinsey', 'BCG', 'Bain', 'Deloitte', 'Accenture', 'EY', 'PwC', 'KPMG'],
      'technology': ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Salesforce', 'Oracle', 'IBM'],
      ...settings.top_tier_companies,
    };

/**
 * Extract snippet with context around a matched term
 */
function extractSnippetWithPosition(
  fullText: string,
  searchTerm: string,
  contextChars: number = 80
): { snippetText: string; start: number; end: number } | null {
  const lowerText = fullText.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const idx = lowerText.indexOf(lowerTerm);
  
  if (idx === -1) return null;
  
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(fullText.length, idx + searchTerm.length + contextChars);
  
  let snippet = fullText.substring(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < fullText.length) snippet = snippet + '...';
  
  return { snippetText: snippet, start: idx, end: idx + searchTerm.length };
}

/**
 * Generate unique claim ID
 */
function genClaimId(category: string, index: number): string {
  return `${category}-${index}-${Date.now().toString(36)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user auth
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service client for operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { jobSpecId } = await req.json();

    if (!jobSpecId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing jobSpecId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting match for job spec: ${jobSpecId}`);

    // Fetch job spec
    const { data: jobSpec, error: specError } = await supabase
      .from('job_specs')
      .select('*')
      .eq('id', jobSpecId)
      .single();

    if (specError || !jobSpec) {
      console.error('Job spec fetch error:', specError);
      return new Response(
        JSON.stringify({ success: false, error: 'Job spec not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const spec = jobSpec as JobSpec;
    console.log(`Job spec: ${spec.title}, workspace: ${spec.workspace_id}`);

    // Fetch all candidates in workspace
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('id, name, email, current_title, current_company, location, headline, skills, experience, raw_cv_text')
      .eq('tenant_id', spec.workspace_id);

    if (candidatesError) {
      console.error('Candidates fetch error:', candidatesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch candidates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, matchCount: 0, matches: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${candidates.length} candidates`);

    // Fetch parsed CV texts with document IDs
    const candidateIds = candidates.map(c => c.id);
    const { data: talentDocs } = await supabase
      .from('talent_documents')
      .select('id, talent_id, parsed_text, parse_status')
      .in('talent_id', candidateIds)
      .eq('parse_status', 'parsed');

    // Map talent_id to parsed text and document info
    const cvTextMap = new Map<string, { text: string; documentId: string }>();
    if (talentDocs) {
      for (const doc of talentDocs as TalentDocument[]) {
        if (doc.parsed_text) {
          const existing = cvTextMap.get(doc.talent_id);
          if (!existing) {
            cvTextMap.set(doc.talent_id, { text: doc.parsed_text, documentId: doc.id });
          } else {
            // Append but keep first document ID as primary
            cvTextMap.set(doc.talent_id, { 
              text: existing.text + ' ' + doc.parsed_text, 
              documentId: existing.documentId 
            });
          }
        }
      }
    }

    console.log(`Found parsed CVs for ${cvTextMap.size} candidates`);

    // Score each candidate
    const matchResults: MatchResult[] = [];

    for (const candidate of candidates as Candidate[]) {
      const cvData = cvTextMap.get(candidate.id);
      const cvText = cvData?.text || candidate.raw_cv_text || '';
      const documentId = cvData?.documentId || null;
      const candidateText = `${candidate.headline || ''} ${candidate.current_title || ''} ${candidate.current_company || ''} ${cvText}`.toLowerCase();
      const originalCVText = cvData?.text || candidate.raw_cv_text || ''; // Keep original case for snippets

      // === EVIDENCE COLLECTION ===
      const claims: ClaimWithEvidence[] = [];
      let claimIndex = 0;

      // === SKILL MATCHING ===
      const keySkills = spec.key_skills || [];
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      const skillEvidence: EvidenceSnippet[] = [];

      for (const skill of keySkills) {
        const skillLower = skill.toLowerCase();
        // Check for exact phrase match (higher priority) or word match
        if (candidateText.includes(skillLower)) {
          matchedSkills.push(skill);
          
          // Extract evidence snippet
          const snippetData = extractSnippetWithPosition(originalCVText, skill);
          if (snippetData) {
            skillEvidence.push({
              id: `skill-ev-${claimIndex++}`,
              claimId: `skill-${skill}`,
              claimText: skill,
              snippetText: snippetData.snippetText,
              snippetStart: snippetData.start,
              snippetEnd: snippetData.end,
              documentId,
              confidence: 0.9,
              category: 'skill',
            });
          }
        } else {
          // Check individual words for partial match
          const words = skillLower.split(/\s+/);
          const hasPartialMatch = words.some(word => word.length > 3 && candidateText.includes(word));
          if (hasPartialMatch) {
            matchedSkills.push(skill + ' (partial)');
            const matchedWord = words.find(w => w.length > 3 && candidateText.includes(w)) || '';
            const snippetData = extractSnippetWithPosition(originalCVText, matchedWord);
            if (snippetData) {
              skillEvidence.push({
                id: `skill-ev-${claimIndex++}`,
                claimId: `skill-${skill}`,
                claimText: `${skill} (partial: "${matchedWord}")`,
                snippetText: snippetData.snippetText,
                snippetStart: snippetData.start,
                snippetEnd: snippetData.end,
                documentId,
                confidence: 0.6,
                category: 'skill',
              });
            }
          } else {
            missingSkills.push(skill);
          }
        }
      }

      // Add skill claims with evidence
      if (matchedSkills.length > 0) {
        claims.push({
          id: genClaimId('skill_match', 0),
          text: `Matched ${matchedSkills.length}/${keySkills.length} key skills: ${matchedSkills.slice(0, 5).join(', ')}${matchedSkills.length > 5 ? '...' : ''}`,
          category: 'skill_match',
          evidence: skillEvidence.slice(0, 5), // Limit to top 5 evidence snippets
        });
      }

      const skillMatchScore = keySkills.length > 0
        ? Math.round((matchedSkills.length / keySkills.length) * 100)
        : 50; // Default if no skills specified

      // === SECTOR/COMPANY SCORING ===
      let sectorCompanyScore = 50; // Base score
      let sectorMatch = '';
      const sectorEvidence: EvidenceSnippet[] = [];
      const candidateCompanies = [candidate.current_company, ...(candidate.experience?.map((e: any) => e.company) || [])].filter(Boolean);

      for (const [sector, tierCompanies] of Object.entries(SECTOR_TIERS)) {
        for (const company of candidateCompanies) {
          if (company) {
            const companyLower = company.toLowerCase();
            for (const tierCompany of tierCompanies) {
              if (companyLower.includes(tierCompany.toLowerCase())) {
                sectorCompanyScore = 85;
                sectorMatch = `${tierCompany} (${sector})`;
                
                // Extract evidence
                const snippetData = extractSnippetWithPosition(originalCVText, tierCompany);
                if (snippetData) {
                  sectorEvidence.push({
                    id: `sector-ev-${claimIndex++}`,
                    claimId: `sector-${tierCompany}`,
                    claimText: `Tier-1 company: ${tierCompany}`,
                    snippetText: snippetData.snippetText,
                    snippetStart: snippetData.start,
                    snippetEnd: snippetData.end,
                    documentId,
                    confidence: 0.95,
                    category: 'company',
                  });
                }
                break;
              }
            }
          }
          if (sectorMatch) break;
        }
        if (sectorMatch) break;
      }

      // Check if spec sector matches candidate background
      if (spec.sector && candidateText.includes(spec.sector.toLowerCase())) {
        sectorCompanyScore = Math.max(sectorCompanyScore, 70);
        if (!sectorMatch) sectorMatch = spec.sector;
        
        const snippetData = extractSnippetWithPosition(originalCVText, spec.sector);
        if (snippetData) {
          sectorEvidence.push({
            id: `sector-ev-${claimIndex++}`,
            claimId: `sector-${spec.sector}`,
            claimText: `Sector match: ${spec.sector}`,
            snippetText: snippetData.snippetText,
            snippetStart: snippetData.start,
            snippetEnd: snippetData.end,
            documentId,
            confidence: 0.85,
            category: 'experience',
          });
        }
      }

      if (sectorMatch) {
        claims.push({
          id: genClaimId('sector', 0),
          text: `Sector alignment: ${sectorMatch}`,
          category: 'sector',
          evidence: sectorEvidence.slice(0, 3),
        });
      }

      // === TENURE ANALYSIS ===
      let tenureScore = 60;
      const riskFlags: string[] = [];
      const suggestedQuestions: string[] = [];
      let averageTenure = 0;
      let recentRoleTenure = 0;
      let shortTenureRoles = 0;
      const tenureEvidence: EvidenceSnippet[] = [];
      const riskEvidence: EvidenceSnippet[] = [];
      
      // Track for gap detection
      interface DatePair { start: Date | null; end: Date | null; company?: string; title?: string; }
      const roleDates: DatePair[] = [];
      let subSixMonthStints = 0;

      const experience = Array.isArray(candidate.experience) ? candidate.experience : [];
      if (experience.length > 0) {
        let totalMonths = 0;
        let roleCount = 0;

        for (let i = 0; i < experience.length; i++) {
          const exp = experience[i];
          const startDate = exp.start_date ? new Date(exp.start_date) : null;
          const endDate = exp.end_date ? new Date(exp.end_date) : new Date();

          if (startDate) {
            roleDates.push({ start: startDate, end: endDate, company: exp.company, title: exp.title });
            const months = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
            totalMonths += months;
            roleCount++;

            if (i === 0) {
              recentRoleTenure = months;
              
              // Add tenure evidence for current role
              if (exp.title || exp.company) {
                const searchTerm = exp.title || exp.company;
                const snippetData = extractSnippetWithPosition(originalCVText, searchTerm);
                if (snippetData) {
                  tenureEvidence.push({
                    id: `tenure-ev-${claimIndex++}`,
                    claimId: 'tenure-current',
                    claimText: `Current role: ${months} months at ${exp.company}`,
                    snippetText: snippetData.snippetText,
                    snippetStart: snippetData.start,
                    snippetEnd: snippetData.end,
                    documentId,
                    confidence: 0.9,
                    category: 'experience',
                  });
                }
              }
            }

            // Track sub-6-month stints in lookback window for contract hopping
            if (months < 6 && endDate >= new Date(Date.now() - settings.contract_hop_lookback_months * 30 * 24 * 60 * 60 * 1000)) {
              subSixMonthStints++;
            }

            // Check for short tenure using workspace threshold
            if (months < settings.short_tenure_threshold_months) {
              shortTenureRoles++;
              const title = (exp.title || '').toLowerCase();

              // PM/BA/DM roles with short tenure = risk flag
              if (title.includes('project manager') || 
                  title.includes('programme manager') || 
                  title.includes('program manager') ||
                  title.includes('delivery manager') ||
                  title.includes('business analyst')) {
                const riskText = `Short tenure (${months} months) in ${exp.title} role at ${exp.company}`;
                riskFlags.push(riskText);
                suggestedQuestions.push(`Why did the ${exp.title} engagement at ${exp.company} end after ${months} months?`);
                suggestedQuestions.push('Was this a recovery/turnaround assignment?');
                
                // Add risk evidence
                if (exp.company) {
                  const snippetData = extractSnippetWithPosition(originalCVText, exp.company);
                  if (snippetData) {
                    riskEvidence.push({
                      id: `risk-ev-${claimIndex++}`,
                      claimId: 'risk-short-tenure',
                      claimText: riskText,
                      snippetText: snippetData.snippetText,
                      snippetStart: snippetData.start,
                      snippetEnd: snippetData.end,
                      documentId,
                      confidence: 0.85,
                      category: 'experience',
                    });
                  }
                }
              }
            }
          }
        }

        averageTenure = roleCount > 0 ? Math.round(totalMonths / roleCount) : 0;

        // Score based on average tenure
        if (averageTenure >= 24) tenureScore = 85;
        else if (averageTenure >= 18) tenureScore = 75;
        else if (averageTenure >= 12) tenureScore = 65;
        else if (averageTenure >= 6) tenureScore = 50;
        else tenureScore = 35;

        // === CONTRACT HOPPING DETECTION ===
        if (subSixMonthStints >= settings.contract_hop_min_stints) {
          tenureScore = Math.max(tenureScore - 15, 20);
          const hoppingText = `Pattern of short engagements: ${subSixMonthStints} roles under 6 months in last ${settings.contract_hop_lookback_months} months`;
          riskFlags.push(hoppingText);
          suggestedQuestions.push('Can you walk me through your recent contract history?');
          suggestedQuestions.push('What drives your decisions to move between roles?');
          
          riskEvidence.push({
            id: `risk-ev-${claimIndex++}`,
            claimId: 'risk-contract-hopping',
            claimText: hoppingText,
            snippetText: `Multiple short-term roles detected in experience history`,
            snippetStart: 0,
            snippetEnd: 0,
            documentId,
            confidence: 0.8,
            category: 'experience',
          });
        }

        // === UNEXPLAINED GAP DETECTION ===
        // Sort by start date descending
        roleDates.sort((a, b) => (b.start?.getTime() || 0) - (a.start?.getTime() || 0));
        
        for (let i = 0; i < roleDates.length - 1; i++) {
          const current = roleDates[i];
          const previous = roleDates[i + 1];
          
          if (current.start && previous.end) {
            const gapMonths = Math.round(
              (current.start.getTime() - previous.end.getTime()) / (1000 * 60 * 60 * 24 * 30)
            );
            
            if (gapMonths >= settings.gap_threshold_months) {
              const gapText = `${gapMonths}-month gap between ${previous.company || 'previous role'} and ${current.company || 'next role'}`;
              riskFlags.push(gapText);
              suggestedQuestions.push(`What were you doing during the gap between ${previous.company} and ${current.company}?`);
              
              if (previous.company) {
                const snippetData = extractSnippetWithPosition(originalCVText, previous.company);
                if (snippetData) {
                  riskEvidence.push({
                    id: `risk-ev-${claimIndex++}`,
                    claimId: 'risk-gap',
                    claimText: gapText,
                    snippetText: snippetData.snippetText,
                    snippetStart: snippetData.start,
                    snippetEnd: snippetData.end,
                    documentId,
                    confidence: 0.75,
                    category: 'experience',
                  });
                }
              }
            }
          }
        }

        // === ROLE MISMATCH DETECTION ===
        // Check if job spec expects senior but CV shows junior experience
        const specTitle = (spec.title || '').toLowerCase();
        const isSeniorSpec = specTitle.includes('senior') || 
                            specTitle.includes('lead') || 
                            specTitle.includes('principal') ||
                            specTitle.includes('director') ||
                            specTitle.includes('head of');
        
        if (isSeniorSpec) {
          const candidateTitles = experience.map((e: any) => (e.title || '').toLowerCase());
          const hasSeniorExperience = candidateTitles.some((t: string) => 
            t.includes('senior') || 
            t.includes('lead') || 
            t.includes('principal') || 
            t.includes('director') ||
            t.includes('head')
          );
          
          if (!hasSeniorExperience && experience.length > 0) {
            const mismatchText = `Role seniority concern: Spec requires senior level but CV shows primarily junior/mid-level titles`;
            riskFlags.push(mismatchText);
            suggestedQuestions.push('Do you have experience leading teams or projects at a senior level?');
            suggestedQuestions.push('What scope of responsibility have you held in previous roles?');
            
            const recentTitle = experience[0]?.title;
            if (recentTitle) {
              const snippetData = extractSnippetWithPosition(originalCVText, recentTitle);
              if (snippetData) {
                riskEvidence.push({
                  id: `risk-ev-${claimIndex++}`,
                  claimId: 'risk-seniority-mismatch',
                  claimText: mismatchText,
                  snippetText: snippetData.snippetText,
                  snippetStart: snippetData.start,
                  snippetEnd: snippetData.end,
                  documentId,
                  confidence: 0.7,
                  category: 'experience',
                });
              }
            }
          }
        }

        // Penalty for multiple short tenures
        if (shortTenureRoles >= 3) {
          tenureScore = Math.max(tenureScore - 15, 20);
          riskFlags.push('Pattern of short tenure across multiple roles');
        }

        // Add tenure claim
        claims.push({
          id: genClaimId('tenure', 0),
          text: `Average tenure: ${averageTenure} months across ${experience.length} roles`,
          category: 'tenure',
          evidence: tenureEvidence.slice(0, 2),
        });
      }

      // Add risk claims if any
      if (riskFlags.length > 0) {
        claims.push({
          id: genClaimId('risk', 0),
          text: `${riskFlags.length} signal(s): ${riskFlags[0]}${riskFlags.length > 1 ? '...' : ''}`,
          category: 'risk',
          evidence: riskEvidence.slice(0, 3),
        });
      }

      // === RECENCY ANALYSIS ===
      let recencyScore = 50;
      let yearsSinceRelevant = 99;
      let hasRecentExperience = false;
      const recencyEvidence: EvidenceSnippet[] = [];

      if (experience.length > 0) {
        const recentExp = experience[0];
        const endDate = recentExp.end_date ? new Date(recentExp.end_date) : new Date();
        const yearsSince = (new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
        yearsSinceRelevant = Math.round(yearsSince * 10) / 10;

        if (yearsSinceRelevant <= 1) {
          recencyScore = 90;
          hasRecentExperience = true;
        } else if (yearsSinceRelevant <= 2) {
          recencyScore = 75;
          hasRecentExperience = true;
        } else if (yearsSinceRelevant <= 3) {
          recencyScore = 60;
          hasRecentExperience = true;
        } else if (yearsSinceRelevant <= 5) {
          recencyScore = 40;
        } else {
          recencyScore = 20;
          riskFlags.push(`No recent relevant experience (${yearsSinceRelevant.toFixed(1)} years since last role)`);
        }

        // Add recency evidence
        if (recentExp.title || recentExp.company) {
          const searchTerm = recentExp.title || recentExp.company;
          const snippetData = extractSnippetWithPosition(originalCVText, searchTerm);
          if (snippetData) {
            recencyEvidence.push({
              id: `recency-ev-${claimIndex++}`,
              claimId: 'recency-recent',
              claimText: `Most recent: ${recentExp.title} at ${recentExp.company}`,
              snippetText: snippetData.snippetText,
              snippetStart: snippetData.start,
              snippetEnd: snippetData.end,
              documentId,
              confidence: 0.9,
              category: 'experience',
            });
          }
        }

        claims.push({
          id: genClaimId('recency', 0),
          text: hasRecentExperience 
            ? `Recent experience: ${recentExp.title} at ${recentExp.company}`
            : `Experience may be dated (${yearsSinceRelevant.toFixed(1)} years since last role)`,
          category: 'recency',
          evidence: recencyEvidence,
        });
      }

      // === LEGACY EVIDENCE SNIPPETS (for backwards compatibility) ===
      const evidenceSnippets: string[] = [];

      // Find skill mentions in CV
      for (const skill of matchedSkills.slice(0, 3)) {
        const cleanSkill = skill.replace(' (partial)', '');
        const idx = candidateText.indexOf(cleanSkill.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(candidateText.length, idx + cleanSkill.length + 100);
          let snippet = candidateText.substring(start, end).trim();
          if (start > 0) snippet = '...' + snippet;
          if (end < candidateText.length) snippet = snippet + '...';
          evidenceSnippets.push(snippet);
        }
      }

      // === OVERALL SCORE ===
      // Weighted average
      const weights = {
        skill: 0.40,
        sector: 0.20,
        tenure: 0.20,
        recency: 0.20,
      };

      const overallScore = Math.round(
        skillMatchScore * weights.skill +
        sectorCompanyScore * weights.sector +
        tenureScore * weights.tenure +
        recencyScore * weights.recency
      );

      // === BUILD RESULT ===
      const matchReasoning = [
        `Skill match: ${matchedSkills.length}/${keySkills.length} key skills found.`,
        sectorMatch ? `Sector alignment: ${sectorMatch}` : 'No specific sector match.',
        `Average tenure: ${averageTenure} months across ${experience.length} roles.`,
        hasRecentExperience ? 'Has recent relevant experience.' : 'Experience may be dated.',
        riskFlags.length > 0 ? `${riskFlags.length} risk flag(s) identified.` : 'No significant risk flags.',
      ].join(' ');

      // Build evidence object
      const matchEvidence: MatchEvidence = {
        claims,
        computedAt: new Date().toISOString(),
        version: '1.0',
      };

      matchResults.push({
        talent_id: candidate.id,
        overall_score: overallScore,
        skill_match_score: skillMatchScore,
        sector_company_score: sectorCompanyScore,
        tenure_score: tenureScore,
        recency_score: recencyScore,
        score_breakdown: {
          matched_skills: matchedSkills,
          missing_skills: missingSkills,
          sector_match: sectorMatch,
          tenure_analysis: {
            average_tenure_months: averageTenure,
            recent_role_tenure_months: recentRoleTenure,
            short_tenure_roles: shortTenureRoles,
          },
          recency_analysis: {
            years_since_relevant_role: yearsSinceRelevant,
            has_recent_experience: hasRecentExperience,
          },
          // NEW: Structured evidence
          evidence: matchEvidence,
        },
        risk_flags: riskFlags,
        suggested_questions: suggestedQuestions,
        top_evidence_snippets: evidenceSnippets.slice(0, 5),
        match_reasoning: matchReasoning,
      });
    }

    // Sort by overall score descending
    matchResults.sort((a, b) => b.overall_score - a.overall_score);

    console.log(`Scored ${matchResults.length} candidates, top score: ${matchResults[0]?.overall_score}`);

    // Delete existing matches for this job spec
    await supabase
      .from('job_spec_matches')
      .delete()
      .eq('job_spec_id', jobSpecId);

    // Insert new matches
    const matchesToInsert = matchResults.map(m => ({
      job_spec_id: jobSpecId,
      talent_id: m.talent_id,
      workspace_id: spec.workspace_id,
      overall_score: m.overall_score,
      skill_match_score: m.skill_match_score,
      sector_company_score: m.sector_company_score,
      tenure_score: m.tenure_score,
      recency_score: m.recency_score,
      score_breakdown: m.score_breakdown,
      risk_flags: m.risk_flags,
      suggested_questions: m.suggested_questions,
      top_evidence_snippets: m.top_evidence_snippets,
      match_reasoning: m.match_reasoning,
      status: 'completed',
    }));

    const { error: insertError } = await supabase
      .from('job_spec_matches')
      .insert(matchesToInsert);

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save match results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch inserted matches with candidate data
    const { data: savedMatches, error: fetchError } = await supabase
      .from('job_spec_matches')
      .select(`
        *,
        candidate:candidates(id, name, email, current_title, current_company, location, headline)
      `)
      .eq('job_spec_id', jobSpecId)
      .order('overall_score', { ascending: false });

    if (fetchError) {
      console.error('Fetch saved matches error:', fetchError);
    }

    console.log(`Match complete: ${matchResults.length} candidates scored and saved`);

    return new Response(
      JSON.stringify({
        success: true,
        matchCount: matchResults.length,
        matches: savedMatches || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Match engine error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

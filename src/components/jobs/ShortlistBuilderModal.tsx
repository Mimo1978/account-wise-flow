import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sparkles, X, Plus, Loader2, ChevronDown, ChevronUp, UserPlus, Eye, Ban,
  Lock, Save, Upload, Users, Target, Check, Search, Zap, Brain, RefreshCw,
  AlertTriangle, Lightbulb, Bot, SlidersHorizontal, FileText, HelpCircle,
  Maximize2, Minimize2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

interface ShortlistBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  workspaceId?: string;
  projectId?: string | null;
  fullSpec: string | null;
  specSeniority?: string | null;
  specSectors?: string[] | null;
  specMustHaveSkills?: string[] | null;
  specWorkType?: string | null;
  specWorkLocation?: string | null;
}

interface SearchParams {
  titles: string[];
  secondary_titles: string[];
  skills: string[];
  nice_skills: string[];
  sectors: string[];
  seniority: string[];
  exclusions: string[];
}

interface ScoredCandidate {
  id: string;
  name: string;
  current_title: string | null;
  location: string | null;
  email: string | null;
  match_score: number;
  pass: number;
  breakdown: {
    title: number;
    skills: number;
    sector: number;
    seniority: number;
    availability: number;
    matched_skills: string[];
    missed_skills: string[];
    sector_match: string;
    title_match: string;
  };
}

interface CascadeResults {
  pass1: ScoredCandidate[];
  pass2: ScoredCandidate[];
  pass3: ScoredCandidate[];
  pass4: ScoredCandidate[];
  poolSize: number;
}

type SearchMode = 'cascade' | 'quick';
type ModalStep = 'config' | 'searching' | 'results';

/* ═══════════════════════════════════════════════════════════════
   SENIORITY SYNONYMS
   ═══════════════════════════════════════════════════════════════ */

const SENIORITY_MAP: Record<string, string[]> = {
  Junior: ['junior', 'graduate', 'associate', 'entry'],
  Mid: ['mid', 'mid-level', 'intermediate'],
  Senior: ['senior', 'sr.', 'sr'],
  Lead: ['lead', 'principal', 'staff'],
  Director: ['director', 'vp', 'head of', 'vice president'],
};

/* ═══════════════════════════════════════════════════════════════
   EXTRACT SEARCH PARAMS (fallback if AI unavailable)
   ═══════════════════════════════════════════════════════════════ */

function extractSearchParams(
  spec: string | null,
  jobTitle: string,
  seniority: string | null | undefined,
  sectors: string[] | null | undefined,
  skills: string[] | null | undefined,
): SearchParams {
  const params: SearchParams = {
    titles: [],
    secondary_titles: [],
    skills: skills?.filter(Boolean) || [],
    nice_skills: [],
    sectors: sectors?.filter(Boolean) || [],
    seniority: [],
    exclusions: [],
  };

  if (seniority) {
    const synonyms = SENIORITY_MAP[seniority] || [seniority.toLowerCase()];
    params.seniority = synonyms;
  }

  if (jobTitle && jobTitle !== 'Untitled Job') {
    params.titles.push(jobTitle);
  }

  if (!spec) return params;

  const seekingPatterns = /(?:seeking|looking\s+for|require)\s+(?:a|an)?\s*([A-Z][A-Za-z\s]+(?:Developer|Engineer|Architect|Manager|Analyst|Consultant|Designer|Director|Lead|Specialist|Coordinator|Administrator|Officer))/gi;
  let match;
  while ((match = seekingPatterns.exec(spec)) !== null) {
    const title = match[1].trim();
    if (title.length < 50 && !params.titles.includes(title)) {
      params.titles.push(title);
    }
  }

  const skillPatterns = /(?:experience|proficiency|knowledge|expertise|skilled|hands-on)\s+(?:in|with|of)\s+([A-Za-z\s,/&+.#]+?)(?:\.|,\s*(?:and|or)|$)/gi;
  while ((match = skillPatterns.exec(spec)) !== null) {
    const extracted = match[1].split(/[,/&]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
    extracted.forEach(s => {
      if (!params.skills.includes(s)) params.skills.push(s);
    });
  }

  params.skills = params.skills.slice(0, 10);
  return params;
}

/* ═══════════════════════════════════════════════════════════════
   BUILD BOOLEAN STRING FROM PARAMS
   ═══════════════════════════════════════════════════════════════ */

function buildSearchString(params: SearchParams): string {
  const parts: string[] = [];
  const allTitles = [...params.titles, ...params.secondary_titles].filter(Boolean);
  if (allTitles.length) parts.push(`(${allTitles.map(t => `"${t}"`).join(' OR ')})`);
  if (params.skills.length) parts.push(`(${params.skills.join(' OR ')})`);
  if (params.sectors.length) parts.push(`(${params.sectors.join(' OR ')})`);
  if (params.seniority.length) parts.push(`(${params.seniority.join(' OR ')})`);
  if (params.exclusions.length) parts.push(`NOT (${params.exclusions.join(' OR ')})`);
  return parts.join(' AND ') || 'No search criteria';
}

/* ═══════════════════════════════════════════════════════════════
   CHIP EDITOR
   ═══════════════════════════════════════════════════════════════ */

function ChipEditor({ items, onAdd, onRemove, placeholder, color = 'bg-primary/10 text-primary', tooltip }: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder: string;
  color?: string;
  tooltip?: string;
}) {
  const [input, setInput] = useState('');
  const handleAdd = () => {
    const val = input.trim();
    if (val && !items.includes(val)) { onAdd(val); setInput(''); }
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <Badge key={item} variant="secondary" className={`gap-1 text-xs ${color}`}>
            {item}
            <button type="button" onClick={() => onRemove(item)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder={placeholder} className="h-6 w-32 text-xs border-dashed" />
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleAdd}><Plus className="w-3 h-3" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INFO TOOLTIP
   ═══════════════════════════════════════════════════════════════ */

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex ml-1 text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[250px]">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PASS INFO
   ═══════════════════════════════════════════════════════════════ */

const PASS_CONFIG = [
  { num: 1, label: 'Precision', icon: Target, desc: 'Title + ALL skills + Sector', emoji: '🎯', color: 'text-emerald-600', tip: 'Strictest search: candidate must match the job title AND all must-have skills AND at least one sector keyword.' },
  { num: 2, label: 'Strong', icon: Check, desc: 'Title + must-have skills', emoji: '✅', color: 'text-blue-600', tip: 'Removes sector requirement. Finds candidates matching title and skills regardless of industry.' },
  { num: 3, label: 'Broad', icon: Search, desc: 'Title OR any skill keyword', emoji: '🔍', color: 'text-amber-600', tip: 'Widens the net: candidate matches the title OR any single skill. Catches specialists who don\'t match title exactly.' },
  { num: 4, label: 'Semantic', icon: Brain, desc: 'AI synonyms + related roles', emoji: '🤖', color: 'text-violet-600', tip: 'Widest search using AI-expanded synonyms and related role titles. Catches candidates using different terminology.' },
] as const;

/* ═══════════════════════════════════════════════════════════════
   SCORING HELPERS
   ═══════════════════════════════════════════════════════════════ */

function scoreCandidate(
  candidate: { name: string; current_title?: string | null; headline?: string | null; skills?: any; location?: string | null; raw_cv_text?: string | null; ai_overview?: string | null },
  params: SearchParams,
  pass: number,
): { score: number; breakdown: ScoredCandidate['breakdown'] } {
  const titleText = (candidate.current_title || candidate.headline || '').toLowerCase();
  const skillsText = extractSkillsText(candidate.skills);
  const overviewText = (candidate.ai_overview || candidate.headline || '').toLowerCase();
  const locText = (candidate.location || '').toLowerCase();
  const cvText = (candidate.raw_cv_text || '').toLowerCase();
  const allText = `${titleText} ${skillsText} ${overviewText} ${locText} ${cvText}`;

  const allTitles = [...params.titles, ...params.secondary_titles].map(t => t.toLowerCase());
  const titleMatch = allTitles.find(t => titleText.includes(t) || allText.includes(t)) || '';
  const titleScore = titleMatch ? 30 : (allTitles.some(t => allText.includes(t.split(' ')[0])) ? 15 : 0);

  const allSkills = [...params.skills, ...(pass >= 3 ? params.nice_skills : [])];
  const matchedSkills: string[] = [];
  const missedSkills: string[] = [];
  allSkills.forEach(s => {
    if (allText.includes(s.toLowerCase())) matchedSkills.push(s);
    else missedSkills.push(s);
  });
  const skillsScore = allSkills.length > 0 ? Math.round((matchedSkills.length / allSkills.length) * 25) : 0;

  const sectorMatch = params.sectors.find(s => allText.includes(s.toLowerCase())) || '';
  const sectorScore = sectorMatch ? 20 : 0;

  const seniorityScore = params.seniority.some(s => allText.includes(s.toLowerCase())) ? 15 : 0;
  const availScore = 10; // default available

  const total = Math.min(100, titleScore + skillsScore + sectorScore + seniorityScore + availScore);

  return {
    score: total,
    breakdown: {
      title: titleScore,
      skills: skillsScore,
      sector: sectorScore,
      seniority: seniorityScore,
      availability: availScore,
      matched_skills: matchedSkills,
      missed_skills: missedSkills,
      sector_match: sectorMatch,
      title_match: titleMatch,
    },
  };
}

function extractSkillsText(skills: any): string {
  if (!skills) return '';
  if (Array.isArray(skills)) return skills.join(' ').toLowerCase();
  if (typeof skills === 'object') {
    const arr = skills.primary_skills || skills.secondary_skills || [];
    return (Array.isArray(arr) ? arr : []).join(' ').toLowerCase();
  }
  return String(skills).toLowerCase();
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export function ShortlistBuilderModal({
  open, onOpenChange, jobId, jobTitle, workspaceId, projectId, fullSpec,
  specSeniority, specSectors, specMustHaveSkills, specWorkType, specWorkLocation,
}: ShortlistBuilderModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // State
  const [step, setStep] = useState<ModalStep>('config');
  const [searchMode, setSearchMode] = useState<SearchMode>('cascade');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickResults, setQuickResults] = useState<any[]>([]);
  const [quickSearching, setQuickSearching] = useState(false);
  const [boolExpanded, setBoolExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRationale, setAiRationale] = useState('');
  const [booleanString, setBooleanString] = useState('');
  const [cascadeResults, setCascadeResults] = useState<CascadeResults>({ pass1: [], pass2: [], pass3: [], pass4: [], poolSize: 0 });
  const [currentPass, setCurrentPass] = useState(0);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [locking, setLocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [minScore, setMinScore] = useState([40]);
  const [passFilters, setPassFilters] = useState({ pass1: true, pass2: true, pass3: false, pass4: false });
  const [specPreviewOpen, setSpecPreviewOpen] = useState(false);

  const [params, setParams] = useState<SearchParams>(() =>
    extractSearchParams(fullSpec, jobTitle, specSeniority, specSectors, specMustHaveSkills)
  );

  // Reset on open
  useEffect(() => {
    if (open) {
      const initial = extractSearchParams(fullSpec, jobTitle, specSeniority, specSectors, specMustHaveSkills);
      setParams(initial);
      setStep('config');
      setCascadeResults({ pass1: [], pass2: [], pass3: [], pass4: [], poolSize: 0 });
      setSelectedIds(new Set());
      setCurrentPass(0);
      setAiRationale('');
      setBooleanString(buildSearchString(initial));
      setMinScore([40]);
      setPassFilters({ pass1: true, pass2: true, pass3: false, pass4: false });

      // Fire AI generation
      generateAISearch(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const searchString = useMemo(() => buildSearchString(params), [params]);

  useEffect(() => {
    setBooleanString(searchString);
  }, [searchString]);

  /* ── AI SEARCH GENERATION ── */
  const generateAISearch = async (searchParams?: SearchParams) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-search-generator', {
        body: {
          spec_text: fullSpec,
          job_title: jobTitle,
          seniority: specSeniority,
          sectors: specSectors,
          must_have_skills: specMustHaveSkills,
          work_type: specWorkType,
          work_location: specWorkLocation,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Merge AI suggestions with existing params
      const currentParams = searchParams || params;
      const merged: SearchParams = {
        titles: dedup([...currentParams.titles, ...(data.primary_titles || [])]),
        secondary_titles: data.secondary_titles || [],
        skills: dedup([...currentParams.skills, ...(data.must_skills || [])]),
        nice_skills: data.nice_skills || [],
        sectors: dedup([...currentParams.sectors, ...(data.sector_terms || [])]),
        seniority: dedup([...currentParams.seniority, ...(data.seniority_terms || [])]),
        exclusions: dedup([...currentParams.exclusions, ...(data.exclude_terms || [])]),
      };
      setParams(merged);
      setAiRationale(data.search_rationale || '');
      if (data.boolean_string) setBooleanString(data.boolean_string);
    } catch (e: any) {
      console.warn('AI search generation failed, using manual extraction:', e.message);
      toast.info('Using manual search extraction. AI search unavailable.', { position: 'bottom-left' });
    } finally {
      setAiLoading(false);
    }
  };

  /* ── CASCADE SEARCH ── */
  const handleRunCascade = useCallback(async () => {
    setSearching(true);
    setStep('searching');
    setCurrentPass(0);

    try {
      // Save search params to job
      await supabase.from('jobs').update({
        shortlist_search_string: booleanString,
        shortlist_params: params as any,
        shortlist_run_at: new Date().toISOString(),
      } as any).eq('id', jobId);

      // Fetch all candidates from workspace
      const { data: allCandidates, error: fetchErr } = await supabase
        .from('candidates')
        .select('id, name, current_title, headline, skills, location, email, raw_cv_text, ai_overview')
        .eq('tenant_id', workspaceId || '')
        .limit(1000);

      if (fetchErr) throw fetchErr;
      const pool = allCandidates || [];
      const poolSize = pool.length;

      const seenIds = new Set<string>();
      const runPass = (passNum: number, filterFn: (c: any) => boolean): ScoredCandidate[] => {
        setCurrentPass(passNum);
        const results: ScoredCandidate[] = [];
        for (const c of pool) {
          if (seenIds.has(c.id)) continue;
          if (!filterFn(c)) continue;

          const { score, breakdown } = scoreCandidate(c, params, passNum);
          if (score > 0) {
            seenIds.add(c.id);
            results.push({
              id: c.id,
              name: c.name,
              current_title: c.current_title || c.headline,
              location: c.location,
              email: c.email,
              match_score: score,
              pass: passNum,
              breakdown,
            });
          }
        }
        return results.sort((a, b) => b.match_score - a.match_score);
      };

      const allTitles = [...params.titles, ...params.secondary_titles].map(t => t.toLowerCase());
      const mustSkills = params.skills.map(s => s.toLowerCase());
      const sectorTerms = params.sectors.map(s => s.toLowerCase());

      const getText = (c: any) => {
        const parts = [c.name, c.current_title, c.headline, c.ai_overview, c.location, c.raw_cv_text];
        if (c.skills) {
          if (Array.isArray(c.skills)) parts.push(c.skills.join(' '));
          else if (c.skills.primary_skills) parts.push((c.skills.primary_skills as string[]).join(' '));
        }
        return parts.filter(Boolean).join(' ').toLowerCase();
      };

      // Pass 1: Title + ALL skills + Sector
      const p1 = runPass(1, (c) => {
        const text = getText(c);
        const hasTitle = allTitles.some(t => text.includes(t));
        const hasAllSkills = mustSkills.length === 0 || mustSkills.every(s => text.includes(s));
        const hasSector = sectorTerms.length === 0 || sectorTerms.some(s => text.includes(s));
        return hasTitle && hasAllSkills && hasSector;
      });

      // Pass 2: Title + must-have skills only
      const p2 = runPass(2, (c) => {
        const text = getText(c);
        const hasTitle = allTitles.some(t => text.includes(t));
        const hasAllSkills = mustSkills.length === 0 || mustSkills.every(s => text.includes(s));
        return hasTitle && hasAllSkills;
      });

      // Pass 3: Title OR any skill
      const p3 = runPass(3, (c) => {
        const text = getText(c);
        const hasTitle = allTitles.some(t => text.includes(t));
        const hasAnySkill = mustSkills.some(s => text.includes(s));
        return hasTitle || hasAnySkill;
      });

      // Pass 4: Semantic — all terms loosely
      const allTerms = [...allTitles, ...mustSkills, ...params.nice_skills.map(s => s.toLowerCase()), ...sectorTerms];
      const p4 = runPass(4, (c) => {
        const text = getText(c);
        return allTerms.some(t => text.includes(t));
      });

      const results: CascadeResults = { pass1: p1, pass2: p2, pass3: p3, pass4: p4, poolSize };
      setCascadeResults(results);

      // Auto-select pass 1+2 candidates with score >= 50
      const autoSelect = new Set<string>();
      [...p1, ...p2].filter(c => c.match_score >= 50).slice(0, 15).forEach(c => autoSelect.add(c.id));
      setSelectedIds(autoSelect);
      setPassFilters({ pass1: true, pass2: true, pass3: p3.length > 0, pass4: p4.length > 0 });

      // Save search history
      if (workspaceId) {
        await supabase.from('job_searches' as any).insert({
          job_id: jobId,
          workspace_id: workspaceId,
          search_params: params,
          boolean_string: booleanString,
          ai_rationale: aiRationale,
          results_by_pass: { pass1: p1.length, pass2: p2.length, pass3: p3.length, pass4: p4.length },
          total_found: p1.length + p2.length + p3.length + p4.length,
          pool_size: poolSize,
        } as any);
      }

      setStep('results');
      setCurrentPass(0);

      const totalFound = p1.length + p2.length + p3.length + p4.length;
      if (totalFound === 0) {
        toast.info('No candidates matched. Try broadening your search terms.', { position: 'bottom-left' });
      }

      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
    } catch (e: any) {
      toast.error(e.message || 'Cascade search failed', { position: 'bottom-left' });
      setStep('config');
    } finally {
      setSearching(false);
      setCurrentPass(0);
    }
  }, [jobId, params, booleanString, workspaceId, aiRationale, qc]);

  /* ── LOCK SHORTLIST ── */
  const handleLockShortlist = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one candidate', { position: 'bottom-left' });
      return;
    }
    setLocking(true);
    try {
      const allResults = [...cascadeResults.pass1, ...cascadeResults.pass2, ...cascadeResults.pass3, ...cascadeResults.pass4];
      const selected = allResults.filter(c => selectedIds.has(c.id));

      for (const c of selected) {
        await supabase.from('job_shortlist').upsert({
          job_id: jobId,
          candidate_id: c.id,
          workspace_id: workspaceId || '',
          match_score: Math.round(c.match_score),
          match_reasons: c.breakdown.matched_skills,
          match_breakdown: c.breakdown as any,
          match_pass: c.pass,
          status: 'approved',
          priority: selected.indexOf(c) + 1,
        } as any, { onConflict: 'job_id,candidate_id' });
      }

      await supabase.from('jobs').update({
        shortlist_locked: true,
        shortlist_locked_at: new Date().toISOString(),
        shortlist_count: selected.length,
      } as any).eq('id', jobId);

      if (workspaceId) {
        const { data: campaign } = await supabase.from('outreach_campaigns').insert({
          name: `${jobTitle} — Candidate Outreach`,
          workspace_id: workspaceId,
          status: 'active',
          queued_count: selected.length,
        } as any).select('id').single();

        if (campaign) {
          for (const c of selected) {
            await supabase.from('outreach_targets').insert({
              campaign_id: campaign.id,
              candidate_id: c.id,
              status: 'queued',
              workspace_id: workspaceId,
            } as any);
          }
        }
      }

      qc.invalidateQueries({ queryKey: ['job_shortlist', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      qc.invalidateQueries({ queryKey: ['outreach_campaigns'] });
      toast.success(`Shortlist locked with ${selected.length} candidates. Outreach campaign created.`, { position: 'bottom-left' });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to lock shortlist', { position: 'bottom-left' });
    } finally {
      setLocking(false);
    }
  }, [selectedIds, cascadeResults, jobId, jobTitle, workspaceId, qc, onOpenChange]);

  /* ── SAVE DRAFT ── */
  const handleSaveDraft = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one candidate', { position: 'bottom-left' });
      return;
    }
    setSaving(true);
    try {
      const allResults = [...cascadeResults.pass1, ...cascadeResults.pass2, ...cascadeResults.pass3, ...cascadeResults.pass4];
      const selected = allResults.filter(c => selectedIds.has(c.id));

      for (const c of selected) {
        await supabase.from('job_shortlist').upsert({
          job_id: jobId,
          candidate_id: c.id,
          workspace_id: workspaceId || '',
          match_score: Math.round(c.match_score),
          match_reasons: c.breakdown.matched_skills,
          match_breakdown: c.breakdown as any,
          match_pass: c.pass,
          status: 'pending',
          priority: selected.indexOf(c) + 1,
        } as any, { onConflict: 'job_id,candidate_id' });
      }

      await supabase.from('jobs').update({
        shortlist_count: selected.length,
      } as any).eq('id', jobId);

      qc.invalidateQueries({ queryKey: ['job_shortlist', jobId] });
      toast.success(`${selected.length} candidates saved as draft shortlist`, { position: 'bottom-left' });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save draft', { position: 'bottom-left' });
    } finally {
      setSaving(false);
    }
  }, [selectedIds, cascadeResults, jobId, workspaceId, qc, onOpenChange]);

  /* ── HELPERS ── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateParam = (key: keyof SearchParams, items: string[]) => {
    setParams(prev => ({ ...prev, [key]: items }));
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-700 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const progressColor = (score: number) => {
    if (score >= 80) return '[&>div]:bg-emerald-500';
    if (score >= 50) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-muted-foreground';
  };

  const totalFound = cascadeResults.pass1.length + cascadeResults.pass2.length + cascadeResults.pass3.length + cascadeResults.pass4.length;

  // Filtered results based on score slider and pass toggles
  const visibleResults = useMemo(() => {
    const groups: { pass: number; label: string; emoji: string; color: string; candidates: ScoredCandidate[] }[] = [];
    const passData = [
      { key: 'pass1' as const, ...PASS_CONFIG[0] },
      { key: 'pass2' as const, ...PASS_CONFIG[1] },
      { key: 'pass3' as const, ...PASS_CONFIG[2] },
      { key: 'pass4' as const, ...PASS_CONFIG[3] },
    ];

    for (const p of passData) {
      if (!(passFilters as any)[p.key]) continue;
      const candidates = cascadeResults[p.key].filter(c => c.match_score >= minScore[0]);
      if (candidates.length > 0) {
        groups.push({ pass: p.num, label: p.label, emoji: p.emoji, color: p.color, candidates });
      }
    }
    return groups;
  }, [cascadeResults, minScore, passFilters]);

  const visibleCount = visibleResults.reduce((sum, g) => sum + g.candidates.length, 0);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Shortlist Builder — {jobTitle}
          </DialogTitle>
          <DialogDescription>
            {step === 'config'
              ? 'AI-powered search parameters. Review and run cascade search.'
              : step === 'searching'
              ? 'Running progressive search cascade...'
              : `${totalFound} candidates found across ${cascadeResults.poolSize} in database. ${selectedIds.size} selected.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* ═══ CONFIG STEP ═══ */}
          {step === 'config' && (
            <div className="space-y-4 pb-4">
              {/* Spec source preview — collapsible */}
              {fullSpec && (
                <div className="rounded-lg border border-border bg-muted/30">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 p-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSpecPreviewOpen(!specPreviewOpen)}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    📄 Source spec used for search generation
                    {specPreviewOpen ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>
                  {specPreviewOpen && (
                    <div className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto border-t border-border pt-2">
                      {fullSpec}
                    </div>
                  )}
                </div>
              )}

              {/* AI loading skeleton */}
              {aiLoading && (
                <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2 text-xs text-primary font-medium">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Reading your job spec and building search string…
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-5 w-2/3" />
                  </div>
                </div>
              )}

              {/* AI success banner */}
              {!aiLoading && aiRationale && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  Search string built from your job spec — review the terms below and adjust if needed, then run.
                </div>
              )}

              {/* No spec warning */}
              {!aiLoading && !fullSpec && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  No job spec found — add search terms manually above. Write a spec first for AI-powered search generation.
                </div>
              )}

              {/* Search param chips */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Primary Titles</label>
                <ChipEditor items={params.titles} onAdd={item => updateParam('titles', [...params.titles, item])} onRemove={item => updateParam('titles', params.titles.filter(t => t !== item))} placeholder="+ Add title" color="bg-blue-500/10 text-blue-700 dark:text-blue-400" />
              </div>

              {params.secondary_titles.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Related Titles (AI-suggested)</label>
                  <ChipEditor items={params.secondary_titles} onAdd={item => updateParam('secondary_titles', [...params.secondary_titles, item])} onRemove={item => updateParam('secondary_titles', params.secondary_titles.filter(t => t !== item))} placeholder="+ Add title" color="bg-blue-500/5 text-blue-600 dark:text-blue-300" />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Must-Have Skills</label>
                <ChipEditor items={params.skills} onAdd={item => updateParam('skills', [...params.skills, item])} onRemove={item => updateParam('skills', params.skills.filter(t => t !== item))} placeholder="+ Add skill" color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" />
              </div>

              {params.nice_skills.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nice-to-Have Skills (AI)</label>
                  <ChipEditor items={params.nice_skills} onAdd={item => updateParam('nice_skills', [...params.nice_skills, item])} onRemove={item => updateParam('nice_skills', params.nice_skills.filter(t => t !== item))} placeholder="+ Add skill" color="bg-emerald-500/5 text-emerald-600 dark:text-emerald-300" />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sector Keywords</label>
                <ChipEditor items={params.sectors} onAdd={item => updateParam('sectors', [...params.sectors, item])} onRemove={item => updateParam('sectors', params.sectors.filter(t => t !== item))} placeholder="+ Add sector" color="bg-amber-500/10 text-amber-700 dark:text-amber-400" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seniority</label>
                <ChipEditor items={params.seniority} onAdd={item => updateParam('seniority', [...params.seniority, item])} onRemove={item => updateParam('seniority', params.seniority.filter(t => t !== item))} placeholder="+ Add level" color="bg-violet-500/10 text-violet-700 dark:text-violet-400" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exclude Terms</label>
                <ChipEditor items={params.exclusions} onAdd={item => updateParam('exclusions', [...params.exclusions, item])} onRemove={item => updateParam('exclusions', params.exclusions.filter(t => t !== item))} placeholder="+ Add exclusion" color="bg-destructive/10 text-destructive" />
              </div>

              {/* Boolean string display */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Boolean Search String</label>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => generateAISearch()} disabled={aiLoading}>
                    <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
                <textarea
                  value={booleanString}
                  onChange={e => setBooleanString(e.target.value)}
                  className="w-full text-xs font-mono text-muted-foreground bg-muted/50 rounded-md p-2.5 border border-border resize-none min-h-[60px]"
                  rows={3}
                />
                {aiRationale && (
                  <p className="text-[11px] italic text-muted-foreground">
                    💡 {aiRationale}
                  </p>
                )}
              </div>

              {/* Cascade preview */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search Cascade Pipeline</label>
                <div className="space-y-1.5">
                  {PASS_CONFIG.map(p => (
                    <div key={p.num} className="flex items-center gap-3 text-xs p-2 rounded-md bg-muted/30 border border-border/50">
                      <span className="text-sm">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${p.color}`}>Pass {p.num} — {p.label}</span>
                        <span className="text-muted-foreground ml-2">{p.desc}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">—</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SEARCHING STEP ═══ */}
          {step === 'searching' && (
            <div className="space-y-4 py-10">
              <div className="text-center space-y-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                <p className="text-sm font-medium text-foreground">Running cascade search…</p>
                <div className="space-y-1.5 max-w-sm mx-auto">
                  {PASS_CONFIG.map(p => (
                    <div key={p.num} className={`flex items-center gap-3 text-xs p-2 rounded-md border ${currentPass >= p.num ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border/50'}`}>
                      <span className="text-sm">{p.emoji}</span>
                      <span className={`flex-1 font-medium ${currentPass >= p.num ? p.color : 'text-muted-foreground'}`}>
                        Pass {p.num} — {p.label}
                      </span>
                      {currentPass === p.num && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                      {currentPass > p.num && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ RESULTS STEP ═══ */}
          {step === 'results' && (
            <div className="space-y-4 pb-4">
              {/* Summary header */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Cascade Complete — {totalFound} candidates found across {cascadeResults.poolSize} in database
                  </span>
                </div>

                <div className="space-y-1.5">
                  {PASS_CONFIG.map((p, idx) => {
                    const count = cascadeResults[`pass${p.num}` as keyof CascadeResults] as ScoredCandidate[];
                    const pct = cascadeResults.poolSize > 0 ? (count.length / cascadeResults.poolSize) * 100 : 0;
                    return (
                      <div key={p.num} className="flex items-center gap-3 text-xs">
                        <span className="text-sm w-5">{p.emoji}</span>
                        <span className={`font-medium w-24 ${p.color}`}>Pass {p.num} ({p.label})</span>
                        <span className="w-16 text-muted-foreground">{count.length} {idx > 0 ? 'new' : 'candidates'}</span>
                        <div className="flex-1">
                          <Progress value={Math.max(pct, count.length > 0 ? 5 : 0)} className="h-2 [&>div]:bg-primary" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Smart suggestions */}
              {cascadeResults.pass1.length === 0 && totalFound > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">No precision matches found.</p>
                    <p className="text-muted-foreground mt-0.5">Consider removing sector requirement or broadening the title. Pass 2 found {cascadeResults.pass2.length} strong matches.</p>
                  </div>
                </div>
              )}

              {totalFound < 5 && totalFound > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                  <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-400">Only {totalFound} candidates matched.</p>
                    <p className="text-muted-foreground mt-0.5">Your talent pool may need expanding — consider posting this job externally to build pipeline.</p>
                  </div>
                </div>
              )}

              {cascadeResults.pass4.length > (cascadeResults.pass1.length + cascadeResults.pass2.length) && cascadeResults.pass4.length > 3 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-xs">
                  <Bot className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-violet-700 dark:text-violet-400">AI found {cascadeResults.pass4.length} additional semantic matches.</p>
                    <p className="text-muted-foreground mt-0.5">These candidates use different terminology but match the role profile. Review carefully.</p>
                  </div>
                </div>
              )}

              {/* Tuning controls */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground whitespace-nowrap">Min score: {minScore[0]}</span>
                  <Slider value={minScore} onValueChange={setMinScore} min={0} max={100} step={5} className="w-32" />
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setStep('config')}>
                  ← Adjust Terms
                </Button>
              </div>

              {/* Candidate cards grouped by pass */}
              {totalFound === 0 && (
                <div className="text-center py-10 space-y-4">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No candidates matched</p>
                    <p className="text-xs text-muted-foreground mt-1">Try broadening your search terms or import more candidates.</p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep('config')}>← Adjust Search</Button>
                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate('/talent'); }}><Upload className="w-3.5 h-3.5 mr-1.5" />Import CSV</Button>
                  </div>
                </div>
              )}

              {visibleResults.map(group => (
                <div key={group.pass} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <span>{group.emoji}</span> Pass {group.pass} — {group.label} Matches ({group.candidates.length})
                    </h4>
                  </div>

                  {group.candidates.map((c, idx) => {
                    const isExpanded = expandedId === c.id;
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <div key={c.id} className={`rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{c.name}</span>
                              <span className={`text-sm font-bold ${scoreColor(c.match_score)}`}>{Math.round(c.match_score)}%</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PASS_CONFIG[c.pass - 1].color}`}>
                                P{c.pass}
                              </Badge>
                            </div>
                            {c.current_title && (
                              <p className="text-xs text-muted-foreground">{c.current_title}{c.location ? ` · ${c.location}` : ''}</p>
                            )}
                            <Progress value={c.match_score} className={`h-1.5 mt-1 ${progressColor(c.match_score)}`} />
                            {/* Matched / Missed chips */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {c.breakdown.matched_skills.slice(0, 5).map(s => (
                                <span key={s} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                  {s} ✓
                                </span>
                              ))}
                              {c.breakdown.missed_skills.slice(0, 3).map(s => (
                                <span key={s} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground line-through">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant={isSelected ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => toggleSelect(c.id)}>
                              <UserPlus className="w-3 h-3 mr-1" />
                              {isSelected ? 'Selected' : 'Add'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate('/talent', { state: { highlightId: c.id, from: `/jobs/${jobId}`, fromLabel: `Back to ${jobTitle}` } })} title="View Profile">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
                            <div className="grid grid-cols-5 gap-2">
                              {[
                                { label: 'Title', score: c.breakdown.title, max: 30 },
                                { label: 'Skills', score: c.breakdown.skills, max: 25 },
                                { label: 'Sector', score: c.breakdown.sector, max: 20 },
                                { label: 'Seniority', score: c.breakdown.seniority, max: 15 },
                                { label: 'Availability', score: c.breakdown.availability, max: 10 },
                              ].map(({ label, score, max }) => (
                                <div key={label} className="text-center">
                                  <p className="font-medium text-foreground">{score}/{max}</p>
                                  <p className="text-muted-foreground">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ═══ FOOTER ═══ */}
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {step === 'config' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleRunCascade} disabled={searching || aiLoading} className="gap-1.5">
                {searching ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…</>
                ) : (
                  <><Zap className="w-3.5 h-3.5" /> Run Cascade Search</>
                )}
              </Button>
            </>
          ) : step === 'results' && totalFound > 0 ? (
            <div className="flex items-center justify-between w-full flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('config')}>← Adjust Search</Button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Pass selection for lock */}
                <div className="flex items-center gap-2 text-xs">
                  {PASS_CONFIG.map(p => {
                    const count = (cascadeResults[`pass${p.num}` as keyof CascadeResults] as ScoredCandidate[]).length;
                    if (count === 0) return null;
                    return (
                      <label key={p.num} className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={(passFilters as any)[`pass${p.num}`]}
                          onCheckedChange={(v) => setPassFilters(prev => ({ ...prev, [`pass${p.num}`]: !!v }))}
                          className="h-3.5 w-3.5"
                        />
                        <span className={`${p.color}`}>P{p.num} ({count})</span>
                      </label>
                    );
                  })}
                </div>

                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving || selectedIds.size === 0} className="gap-1.5">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </Button>
                <Button size="sm" onClick={handleLockShortlist} disabled={locking || selectedIds.size === 0} className="gap-1.5">
                  {locking ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locking…</>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" /> Lock Shortlist & Launch Campaign</>
                  )}
                </Button>
              </div>
            </div>
          ) : step === 'results' ? (
            <Button variant="outline" onClick={() => setStep('config')}>← Adjust Search</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Deduplicate array helper ── */
function dedup(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

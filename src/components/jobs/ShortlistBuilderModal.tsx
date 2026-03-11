import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, X, Plus, Loader2, ChevronDown, ChevronUp, UserPlus, Eye, Ban,
  Lock, Save, Upload, Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

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
}

interface SearchParams {
  titles: string[];
  skills: string[];
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
  breakdown: {
    title: number;
    skills: number;
    sector: number;
    seniority: number;
    availability: number;
    matched_skills: string[];
    sector_match: string;
    title_match: string;
  };
}

/* ── Seniority synonyms for search expansion ── */
const SENIORITY_MAP: Record<string, string[]> = {
  Junior: ['junior', 'graduate', 'associate', 'entry'],
  Mid: ['mid', 'mid-level', 'intermediate'],
  Senior: ['senior', 'sr.', 'sr'],
  Lead: ['lead', 'principal', 'staff'],
  Director: ['director', 'vp', 'head of', 'vice president'],
};

/* ── Extract search params from spec text + structured fields ── */
function extractSearchParams(
  spec: string | null,
  jobTitle: string,
  seniority: string | null | undefined,
  sectors: string[] | null | undefined,
  skills: string[] | null | undefined,
): SearchParams {
  const params: SearchParams = {
    titles: [],
    skills: skills?.filter(Boolean) || [],
    sectors: sectors?.filter(Boolean) || [],
    seniority: [],
    exclusions: [],
  };

  // Seniority mapping
  if (seniority) {
    const synonyms = SENIORITY_MAP[seniority] || [seniority.toLowerCase()];
    params.seniority = synonyms;
  }

  // Job title from the record itself
  if (jobTitle && jobTitle !== 'Untitled Job') {
    params.titles.push(jobTitle);
  }

  if (!spec) return params;

  // Extract likely job titles from first 3 lines or patterns: "seeking a X", "looking for X"
  const seekingPatterns = /(?:seeking|looking\s+for|require)\s+(?:a|an)?\s*([A-Z][A-Za-z\s]+(?:Developer|Engineer|Architect|Manager|Analyst|Consultant|Designer|Director|Lead|Specialist|Coordinator|Administrator|Officer))/gi;
  let match;
  while ((match = seekingPatterns.exec(spec)) !== null) {
    const title = match[1].trim();
    if (title.length < 50 && !params.titles.includes(title)) {
      params.titles.push(title);
    }
  }

  // If no titles found from patterns, use first heading line
  if (params.titles.length <= 1) {
    const lines = spec.split('\n').filter(l => l.trim());
    const firstLine = (lines[0] || '').replace(/[#*_]/g, '').trim();
    if (firstLine && firstLine.length < 60 && !params.titles.includes(firstLine)) {
      params.titles.push(firstLine);
    }
  }

  // Extract skills: "experience in X", "proficiency in X", "knowledge of X"
  const skillPatterns = /(?:experience|proficiency|knowledge|expertise|skilled|hands-on)\s+(?:in|with|of)\s+([A-Za-z\s,/&+.#]+?)(?:\.|,\s*(?:and|or)|$)/gi;
  while ((match = skillPatterns.exec(spec)) !== null) {
    const extracted = match[1].split(/[,/&]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
    extracted.forEach(s => {
      if (!params.skills.includes(s)) params.skills.push(s);
    });
  }

  // Extract "X experience required" patterns
  const requiredPatterns = /([A-Z][A-Za-z+#.]+(?:\s+[A-Za-z+#.]+)?)\s+(?:experience\s+)?(?:required|essential|mandatory)/gi;
  while ((match = requiredPatterns.exec(spec)) !== null) {
    const s = match[1].trim();
    if (s.length > 1 && s.length < 30 && !params.skills.includes(s)) {
      params.skills.push(s);
    }
  }

  // Extract sector terms: fintech, banking, NHS, Big 4, FTSE etc.
  const sectorTerms = ['fintech', 'banking', 'financial services', 'insurance', 'NHS', 'healthcare',
    'Big 4', 'FTSE', 'consulting', 'retail', 'e-commerce', 'media', 'telecoms', 'energy',
    'pharma', 'defence', 'government', 'public sector', 'proptech', 'edtech', 'SaaS'];
  sectorTerms.forEach(term => {
    if (spec.toLowerCase().includes(term.toLowerCase()) && !params.sectors.includes(term)) {
      params.sectors.push(term);
    }
  });

  // Cap skills at 10
  params.skills = params.skills.slice(0, 10);

  return params;
}

/* ── Generate human-readable search string ── */
function buildSearchString(params: SearchParams): string {
  const parts: string[] = [];
  if (params.titles.length > 0) {
    parts.push(`(${params.titles.join(' OR ')})`);
  }
  if (params.skills.length > 0) {
    parts.push(`(${params.skills.join(' OR ')})`);
  }
  if (params.sectors.length > 0) {
    parts.push(`(${params.sectors.join(' OR ')})`);
  }
  if (params.seniority.length > 0) {
    parts.push(`(${params.seniority.join(' OR ')})`);
  }
  if (params.exclusions.length > 0) {
    parts.push(`NOT (${params.exclusions.join(' OR ')})`);
  }
  return parts.join(' AND ') || 'No search criteria';
}

/* ── Chip Editor component ── */
function ChipEditor({ items, onAdd, onRemove, placeholder, color = 'bg-primary/10 text-primary' }: {
  items: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  placeholder: string;
  color?: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const val = input.trim();
    if (val && !items.includes(val)) {
      onAdd(val);
      setInput('');
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <Badge key={item} variant="secondary" className={`gap-1 text-xs ${color}`}>
            {item}
            <button type="button" onClick={() => onRemove(item)} className="ml-0.5 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={placeholder}
            className="h-6 w-32 text-xs border-dashed"
          />
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleAdd}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ShortlistBuilderModal({
  open, onOpenChange, jobId, jobTitle, workspaceId, projectId, fullSpec,
  specSeniority, specSectors, specMustHaveSkills,
}: ShortlistBuilderModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<'config' | 'results'>('config');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ScoredCandidate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [locking, setLocking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [params, setParams] = useState<SearchParams>(() =>
    extractSearchParams(fullSpec, jobTitle, specSeniority, specSectors, specMustHaveSkills)
  );

  // Re-extract when modal opens with different spec
  useEffect(() => {
    if (open) {
      setParams(extractSearchParams(fullSpec, jobTitle, specSeniority, specSectors, specMustHaveSkills));
      setStep('config');
      setResults([]);
      setSelectedIds(new Set());
    }
  }, [open, fullSpec, jobTitle, specSeniority, specSectors, specMustHaveSkills]);

  const searchString = useMemo(() => buildSearchString(params), [params]);

  const updateParam = (key: keyof SearchParams, items: string[]) => {
    setParams(prev => ({ ...prev, [key]: items }));
  };

  const handleRunSearch = useCallback(async () => {
    setSearching(true);
    try {
      // Save search params to job record
      await supabase.from('jobs').update({
        shortlist_search_string: searchString,
        shortlist_params: params as any,
        shortlist_run_at: new Date().toISOString(),
      } as any).eq('id', jobId);

      const { data, error } = await supabase.functions.invoke('run-shortlist', {
        body: {
          job_id: jobId,
          search_params: params,
          return_results: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const candidates = (data?.candidates || data?.results || []).map((c: any) => ({
        id: c.id || c.candidate_id,
        name: c.name || c.candidate_name || '—',
        current_title: c.current_title || c.title || null,
        location: c.location || null,
        email: c.email || null,
        match_score: c.match_score || c.score || 0,
        breakdown: {
          title: c.breakdown?.title || c.title_score || 0,
          skills: c.breakdown?.skills || c.skills_score || 0,
          sector: c.breakdown?.sector || c.sector_score || 0,
          seniority: c.breakdown?.seniority || c.seniority_score || 0,
          availability: c.breakdown?.availability || c.availability_score || 0,
          matched_skills: c.breakdown?.matched_skills || c.match_reasons || [],
          sector_match: c.breakdown?.sector_match || '',
          title_match: c.breakdown?.title_match || '',
        },
      }));

      setResults(candidates.slice(0, 20));
      // Auto-select top 10 candidates with score >= 50
      const autoSelected = new Set(
        candidates.filter((c: ScoredCandidate) => c.match_score >= 50).slice(0, 10).map((c: ScoredCandidate) => c.id)
      );
      setSelectedIds(autoSelected);
      setStep('results');

      qc.invalidateQueries({ queryKey: ['jobs', jobId] });

      if (candidates.length === 0) {
        toast.info('No candidates matched your search criteria. Try broadening your search.', { position: 'bottom-left' });
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to run shortlist search', { position: 'bottom-left' });
    } finally {
      setSearching(false);
    }
  }, [jobId, params, searchString, qc]);

  const handleSaveDraft = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one candidate', { position: 'bottom-left' });
      return;
    }
    setSaving(true);
    try {
      // Insert selected candidates into job_shortlist
      const selected = results.filter(c => selectedIds.has(c.id));
      for (const c of selected) {
        await supabase.from('job_shortlist').upsert({
          job_id: jobId,
          candidate_id: c.id,
          workspace_id: workspaceId || '',
          match_score: Math.round(c.match_score),
          match_reasons: c.breakdown.matched_skills,
          match_breakdown: c.breakdown as any,
          status: 'pending',
          priority: selected.indexOf(c) + 1,
        } as any, { onConflict: 'job_id,candidate_id' });
      }

      await supabase.from('jobs').update({
        shortlist_count: selected.length,
      } as any).eq('id', jobId);

      qc.invalidateQueries({ queryKey: ['job_shortlist', jobId] });
      qc.invalidateQueries({ queryKey: ['jobs', jobId] });
      toast.success(`${selected.length} candidates saved as draft shortlist`, { position: 'bottom-left' });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save draft', { position: 'bottom-left' });
    } finally {
      setSaving(false);
    }
  }, [selectedIds, results, jobId, workspaceId, qc, onOpenChange]);

  const handleLockShortlist = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one candidate to add to shortlist', { position: 'bottom-left' });
      return;
    }
    setLocking(true);
    try {
      const selected = results.filter(c => selectedIds.has(c.id));

      // Insert selected candidates into job_shortlist
      for (const c of selected) {
        await supabase.from('job_shortlist').upsert({
          job_id: jobId,
          candidate_id: c.id,
          workspace_id: workspaceId || '',
          match_score: Math.round(c.match_score),
          match_reasons: c.breakdown.matched_skills,
          match_breakdown: c.breakdown as any,
          status: 'approved',
          priority: selected.indexOf(c) + 1,
        } as any, { onConflict: 'job_id,candidate_id' });
      }

      // Update job with locked state
      await supabase.from('jobs').update({
        shortlist_locked: true,
        shortlist_locked_at: new Date().toISOString(),
        shortlist_count: selected.length,
      } as any).eq('id', jobId);

      // Create outreach campaign automatically
      if (workspaceId) {
        const campaignName = `${jobTitle} — Candidate Outreach`;
        const { data: campaign } = await supabase.from('outreach_campaigns').insert({
          name: campaignName,
          workspace_id: workspaceId,
          status: 'active',
          queued_count: selected.length,
        } as any).select('id').single();

        if (campaign) {
          // Create outreach targets for each candidate
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

      toast.success(
        `Shortlist locked with ${selected.length} candidates. Outreach campaign created.`,
        { position: 'bottom-left' }
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to lock shortlist', { position: 'bottom-left' });
    } finally {
      setLocking(false);
    }
  }, [selectedIds, results, jobId, jobTitle, workspaceId, qc, onOpenChange]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(results.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-700 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const progressColor = (score: number) => {
    if (score >= 80) return '[&>div]:bg-emerald-500';
    if (score >= 60) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Shortlist Builder — {jobTitle}
          </DialogTitle>
          <DialogDescription>
            {step === 'config'
              ? 'Search parameters auto-extracted from the job spec. Review and adjust before running.'
              : `${results.length} candidates found. ${selectedIds.size} selected for shortlist.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {step === 'config' ? (
            <div className="space-y-4 pb-4">
              {/* Section A: Search Parameters */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Titles</label>
                <ChipEditor
                  items={params.titles}
                  onAdd={item => updateParam('titles', [...params.titles, item])}
                  onRemove={item => updateParam('titles', params.titles.filter(t => t !== item))}
                  placeholder="+ Add title"
                  color="bg-blue-500/10 text-blue-700 dark:text-blue-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Must-Have Skills</label>
                <ChipEditor
                  items={params.skills}
                  onAdd={item => updateParam('skills', [...params.skills, item])}
                  onRemove={item => updateParam('skills', params.skills.filter(t => t !== item))}
                  placeholder="+ Add skill"
                  color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sector Keywords</label>
                <ChipEditor
                  items={params.sectors}
                  onAdd={item => updateParam('sectors', [...params.sectors, item])}
                  onRemove={item => updateParam('sectors', params.sectors.filter(t => t !== item))}
                  placeholder="+ Add sector"
                  color="bg-amber-500/10 text-amber-700 dark:text-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seniority</label>
                <ChipEditor
                  items={params.seniority}
                  onAdd={item => updateParam('seniority', [...params.seniority, item])}
                  onRemove={item => updateParam('seniority', params.seniority.filter(t => t !== item))}
                  placeholder="+ Add level"
                  color="bg-violet-500/10 text-violet-700 dark:text-violet-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Exclude Terms</label>
                <ChipEditor
                  items={params.exclusions}
                  onAdd={item => updateParam('exclusions', [...params.exclusions, item])}
                  onRemove={item => updateParam('exclusions', params.exclusions.filter(t => t !== item))}
                  placeholder="+ Add exclusion"
                  color="bg-destructive/10 text-destructive"
                />
              </div>

              {/* Generated Search String (read-only) */}
              <div className="space-y-1 pt-2 border-t border-border">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Generated Search String</label>
                <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-md p-2.5 break-all">
                  {searchString}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {/* Selection controls */}
              {results.length > 0 && (
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size}/{results.length} candidates selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAll}>Select All</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={deselectAll}>Deselect All</Button>
                  </div>
                </div>
              )}

              {results.map((c, idx) => {
                const isExpanded = expandedId === c.id;
                const isSelected = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted-foreground w-5">#{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{c.name}</span>
                          <span className={`text-sm font-bold ${scoreColor(c.match_score)}`}>{Math.round(c.match_score)}%</span>
                        </div>
                        {c.current_title && (
                          <p className="text-xs text-muted-foreground">{c.current_title}{c.location ? ` · ${c.location}` : ''}</p>
                        )}
                        <Progress value={c.match_score} className={`h-1.5 mt-1 ${progressColor(c.match_score)}`} />
                        {/* Matched chips */}
                        {c.breakdown.matched_skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.breakdown.matched_skills.slice(0, 5).map(s => (
                              <span key={s} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {s} ✓
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleSelect(c.id)}
                        >
                          <UserPlus className="w-3 h-3 mr-1" />
                          {isSelected ? 'Selected' : 'Add'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => navigate(`/talent`, { state: { highlightId: c.id } })}
                          title="View Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        >
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

              {results.length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Your talent database is empty</p>
                    <p className="text-xs text-muted-foreground mt-1">Import candidates or add them manually in the Talent tab.</p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate('/talent'); }}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate('/talent'); }}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Candidate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Section C: Footer actions */}
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {step === 'config' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleRunSearch} disabled={searching} className="gap-1.5">
                {searching ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" /> Run Search</>
                )}
              </Button>
            </>
          ) : results.length > 0 ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('config')}>← Adjust Search</Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={saving || selectedIds.size === 0}
                  className="gap-1.5"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  onClick={handleLockShortlist}
                  disabled={locking || selectedIds.size === 0}
                  className="gap-1.5"
                >
                  {locking ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locking…</>
                  ) : (
                    <><Lock className="w-3.5 h-3.5" /> Lock Shortlist & Launch Campaign</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setStep('config')}>← Adjust Search</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

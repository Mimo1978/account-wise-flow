import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ShortlistBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
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

function extractSearchParams(
  spec: string | null,
  seniority: string | null | undefined,
  sectors: string[] | null | undefined,
  skills: string[] | null | undefined,
): SearchParams {
  const params: SearchParams = {
    titles: [],
    skills: skills?.filter(Boolean) || [],
    sectors: sectors?.filter(Boolean) || [],
    seniority: seniority ? [seniority] : [],
    exclusions: [],
  };

  if (!spec) return params;

  // Extract likely job titles from first few lines
  const lines = spec.split('\n').filter(l => l.trim());
  const titleLine = lines[0] || '';
  // Common patterns: "Senior Java Developer", "Backend Engineer"
  const titleWords = titleLine.replace(/[#*_]/g, '').trim();
  if (titleWords && titleWords.length < 60) {
    params.titles.push(titleWords);
  }

  // Extract skills from bullet points mentioning tech
  const skillPatterns = /(?:experience|proficiency|knowledge|expertise)\s+(?:in|with)\s+([A-Za-z\s,/&]+)/gi;
  let match;
  while ((match = skillPatterns.exec(spec)) !== null) {
    const extracted = match[1].split(/[,/&]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
    extracted.forEach(s => {
      if (!params.skills.includes(s)) params.skills.push(s);
    });
  }

  return params;
}

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
  open, onOpenChange, jobId, jobTitle, fullSpec,
  specSeniority, specSectors, specMustHaveSkills,
}: ShortlistBuilderModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'config' | 'results'>('config');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ScoredCandidate[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [locking, setLocking] = useState(false);

  const [params, setParams] = useState<SearchParams>(() =>
    extractSearchParams(fullSpec, specSeniority, specSectors, specMustHaveSkills)
  );

  const updateParam = (key: keyof SearchParams, items: string[]) => {
    setParams(prev => ({ ...prev, [key]: items }));
  };

  const handleRunSearch = useCallback(async () => {
    setSearching(true);
    try {
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
        match_score: c.match_score || c.score || 0,
        breakdown: {
          title: c.breakdown?.title || c.title_score || 0,
          skills: c.breakdown?.skills || c.skills_score || 0,
          sector: c.breakdown?.sector || c.sector_score || 0,
          seniority: c.breakdown?.seniority || c.seniority_score || 0,
          availability: c.breakdown?.availability || c.availability_score || 0,
          matched_skills: c.breakdown?.matched_skills || c.match_reasons || [],
          sector_match: c.breakdown?.sector_match || 'unknown',
          title_match: c.breakdown?.title_match || 'unknown',
        },
      }));

      setResults(candidates.slice(0, 10));
      setStep('results');

      if (candidates.length === 0) {
        toast.info('No candidates matched your search criteria. Try broadening your search.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to run shortlist search');
    } finally {
      setSearching(false);
    }
  }, [jobId, params]);

  const handleLockShortlist = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error('Select at least one candidate to add to shortlist');
      return;
    }
    setLocking(true);
    try {
      // The run-shortlist function already saves to job_shortlist, so just refresh
      qc.invalidateQueries({ queryKey: ['job_shortlist', jobId] });
      toast.success(`${selectedIds.size} candidate${selectedIds.size !== 1 ? 's' : ''} added to shortlist`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to lock shortlist');
    } finally {
      setLocking(false);
    }
  }, [selectedIds, jobId, qc, onOpenChange]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
              ? 'Review and adjust search parameters before running the match.'
              : `${results.length} candidates matched. Select and add to shortlist.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {step === 'config' ? (
            <div className="space-y-4 pb-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Job Titles</label>
                <ChipEditor
                  items={params.titles}
                  onAdd={item => updateParam('titles', [...params.titles, item])}
                  onRemove={item => updateParam('titles', params.titles.filter(t => t !== item))}
                  placeholder="+ Add title"
                  color="bg-blue-500/10 text-blue-700 dark:text-blue-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Must-Have Skills</label>
                <ChipEditor
                  items={params.skills}
                  onAdd={item => updateParam('skills', [...params.skills, item])}
                  onRemove={item => updateParam('skills', params.skills.filter(t => t !== item))}
                  placeholder="+ Add skill"
                  color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Sector Keywords</label>
                <ChipEditor
                  items={params.sectors}
                  onAdd={item => updateParam('sectors', [...params.sectors, item])}
                  onRemove={item => updateParam('sectors', params.sectors.filter(t => t !== item))}
                  placeholder="+ Add sector"
                  color="bg-amber-500/10 text-amber-700 dark:text-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Seniority</label>
                <ChipEditor
                  items={params.seniority}
                  onAdd={item => updateParam('seniority', [...params.seniority, item])}
                  onRemove={item => updateParam('seniority', params.seniority.filter(t => t !== item))}
                  placeholder="+ Add level"
                  color="bg-violet-500/10 text-violet-700 dark:text-violet-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Exclude Terms</label>
                <ChipEditor
                  items={params.exclusions}
                  onAdd={item => updateParam('exclusions', [...params.exclusions, item])}
                  onRemove={item => updateParam('exclusions', params.exclusions.filter(t => t !== item))}
                  placeholder="+ Add exclusion"
                  color="bg-destructive/10 text-destructive"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
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
                          <span className={`text-sm font-bold ${scoreColor(c.match_score)}`}>{c.match_score}%</span>
                        </div>
                        {c.current_title && (
                          <p className="text-xs text-muted-foreground">{c.current_title}{c.location ? ` · ${c.location}` : ''}</p>
                        )}
                        <Progress value={c.match_score} className={`h-1.5 mt-1 ${progressColor(c.match_score)}`} />
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
                        {c.breakdown.matched_skills.length > 0 && (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Matched: </span>
                            {c.breakdown.matched_skills.join(', ')}
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          Sector: {c.breakdown.sector_match} | Title: {c.breakdown.title_match}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              {results.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No candidates matched. Try broadening your search criteria.
                </div>
              )}
            </div>
          )}
        </ScrollArea>

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
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('config')}>← Adjust Search</Button>
              <Button
                onClick={handleLockShortlist}
                disabled={locking || selectedIds.size === 0}
                className="gap-1.5"
              >
                {locking ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locking…</>
                ) : (
                  `Lock Shortlist (${selectedIds.size})`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

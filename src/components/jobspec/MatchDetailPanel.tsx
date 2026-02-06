import React, { useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  ChevronDown,
  MapPin,
  Building2,
  Briefcase,
  Star,
  TrendingUp,
  Clock,
  Target,
} from 'lucide-react';
import type { JobSpecMatch } from '@/lib/job-match-types';
import type { GeneratedQuestion } from '@/lib/question-types';
import { TopEvidenceSection } from './TopEvidenceSection';
import { EvidencePill } from '@/components/evidence/EvidencePill';
import { SignalBadge } from '@/components/signals/SignalBadge';
import { SignalsSection } from '@/components/signals/SignalsSection';
import { QuestionsSection } from '@/components/questions/QuestionsSection';
import { extractMatchSignals } from '@/hooks/use-signals';

interface MatchDetailPanelProps {
  match: JobSpecMatch;
  questions: GeneratedQuestion[];
  questionsLoading: boolean;
  onGenerateQuestions: (force: boolean) => void;
  isGenerating: boolean;
  cachedAt: string | null;
  onShortlist?: (match: JobSpecMatch) => void;
  onClose: () => void;
  onOpenCV?: (talentId: string) => void;
}

function ScoreBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
  const getColor = () => {
    if (score >= 80) return 'bg-primary/80';
    if (score >= 60) return 'bg-amber-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-destructive/80';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function MatchDetailPanel({
  match,
  questions,
  questionsLoading,
  onGenerateQuestions,
  isGenerating,
  cachedAt,
  onShortlist,
  onClose,
  onOpenCV,
}: MatchDetailPanelProps) {
  // Extract signals from match breakdown (no extra fetch needed)
  const signals = useMemo(
    () => extractMatchSignals(match.score_breakdown as unknown as Record<string, unknown>),
    [match.score_breakdown]
  );

  // Calculate max severity for badge
  const maxSeverity = useMemo(() => {
    if (signals.some(s => s.severity === 'high')) return 'high';
    if (signals.some(s => s.severity === 'med')) return 'med';
    return 'low';
  }, [signals]);

  // Handle CV viewer open
  const handleOpenCV = useCallback(() => {
    if (onOpenCV && match.talent_id) {
      onOpenCV(match.talent_id);
    }
  }, [onOpenCV, match.talent_id]);

  // Limit questions to 5 for display
  const displayQuestions = useMemo(() => questions.slice(0, 5), [questions]);

  return (
    <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto">
      <SheetHeader>
        <div className="flex items-center justify-between">
          <SheetTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Match Details
          </SheetTitle>
          {signals.length > 0 && (
            <SignalBadge count={signals.length} maxSeverity={maxSeverity} />
          )}
        </div>
      </SheetHeader>

      <div className="mt-6 space-y-6">
        {/* Candidate Info */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{match.candidate?.name}</h3>
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {match.candidate?.current_title && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" />
                {match.candidate.current_title}
              </span>
            )}
            {match.candidate?.current_company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {match.candidate.current_company}
              </span>
            )}
            {match.candidate?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {match.candidate.location}
              </span>
            )}
          </div>
        </div>

        {/* Overall Score */}
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <div className="text-4xl font-bold">{match.overall_score}</div>
          <div className="text-sm text-muted-foreground">Overall Match Score</div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-4">
          <h4 className="font-medium">Score Breakdown</h4>
          <ScoreBar score={match.skill_match_score} label="Skills" icon={Target} />
          <ScoreBar score={match.sector_company_score} label="Sector/Company" icon={Building2} />
          <ScoreBar score={match.tenure_score} label="Tenure" icon={TrendingUp} />
          <ScoreBar score={match.recency_score} label="Recency" icon={Clock} />
        </div>

        <Separator />

        {/* TOP EVIDENCE SECTION - Primary focus */}
        <TopEvidenceSection
          snippets={match.top_evidence_snippets}
          maxSnippets={3}
          onOpenCV={onOpenCV ? handleOpenCV : undefined}
          candidateName={match.candidate?.name}
        />

        {/* Matched Skills */}
        {match.score_breakdown?.matched_skills && match.score_breakdown.matched_skills.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Matched Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {match.score_breakdown.matched_skills.map((skill, i) => {
                  // Find evidence for this skill
                  const skillClaim = match.score_breakdown?.evidence?.claims?.find(
                    c => c.category === 'skill_match'
                  );
                  const skillEvidence = skillClaim?.evidence?.filter(
                    e => e.claimText.toLowerCase().includes(skill.replace(' (partial)', '').toLowerCase())
                  );

                  return (
                    <div key={i} className="inline-flex items-center gap-0.5">
                      <Badge variant="secondary" className="bg-primary/10">
                        {skill}
                      </Badge>
                      {skillEvidence && skillEvidence.length > 0 && (
                        <EvidencePill evidence={skillEvidence} size="sm" className="ml-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Missing Skills */}
        {match.score_breakdown?.missing_skills && match.score_breakdown.missing_skills.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-muted-foreground">Missing Skills</h4>
            <div className="flex flex-wrap gap-1.5">
              {match.score_breakdown.missing_skills.map((skill, i) => (
                <Badge key={i} variant="outline" className="text-muted-foreground">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* SIGNALS SECTION - Collapsed by default */}
        {signals.length > 0 && (
          <SignalsSection
            signals={signals}
            title="Signals"
            defaultOpen={false}
          />
        )}

        {/* QUESTIONS SECTION - Collapsed by default, max 5 */}
        <QuestionsSection
          questions={displayQuestions}
          title="Questions to Ask"
          defaultOpen={false}
          isLoading={questionsLoading}
          onGenerate={(force) => onGenerateQuestions(force)}
          isGenerating={isGenerating}
          cachedAt={cachedAt ?? undefined}
        />

        {/* Match Reasoning */}
        {match.match_reasoning && (
          <>
            <Separator />
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex items-center justify-between w-full group">
                <h4 className="font-medium">Analysis Summary</h4>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <p className="text-sm text-muted-foreground">
                  {match.match_reasoning}
                </p>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          {onShortlist && (
            <Button className="flex-1" onClick={() => onShortlist(match)}>
              Add to Shortlist
            </Button>
          )}
        </div>
      </div>
    </SheetContent>
  );
}

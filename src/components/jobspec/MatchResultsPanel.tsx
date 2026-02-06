import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  MapPin,
  Building2,
  Briefcase,
  Star,
  TrendingUp,
  Clock,
  Target,
  Quote,
} from 'lucide-react';
import type { JobSpecMatch } from '@/lib/job-match-types';
import type { ClaimWithEvidence, EvidenceSnippet } from '@/lib/evidence-types';
import { SnippetHighlight } from './SnippetHighlight';
import { EvidencePill } from '@/components/evidence/EvidencePill';
import { SignalBadge } from '@/components/signals/SignalBadge';
import { SignalsSection } from '@/components/signals/SignalsSection';
import { extractMatchSignals } from '@/hooks/use-signals';

interface MatchResultsPanelProps {
  matches: JobSpecMatch[];
  loading: boolean;
  onShortlist?: (match: JobSpecMatch) => void;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const getColor = () => {
    if (score >= 80) return 'bg-green-500/10 text-green-700 border-green-200';
    if (score >= 60) return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
    if (score >= 40) return 'bg-orange-500/10 text-orange-700 border-orange-200';
    return 'bg-red-500/10 text-red-700 border-red-200';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`${getColor()} text-xs`}>
            {score}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}: {score}/100</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreBar({ score, label, icon: Icon }: { score: number; label: string; icon: React.ElementType }) {
  const getColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
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

export function MatchResultsPanel({ matches, loading, onShortlist }: MatchResultsPanelProps) {
  const [selectedMatch, setSelectedMatch] = useState<JobSpecMatch | null>(null);
  const [sortBy, setSortBy] = useState<'overall' | 'skills' | 'recency'>('overall');

  const sortedMatches = [...matches].sort((a, b) => {
    switch (sortBy) {
      case 'skills':
        return b.skill_match_score - a.skill_match_score;
      case 'recency':
        return b.recency_score - a.recency_score;
      default:
        return b.overall_score - a.overall_score;
    }
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
          <p className="text-muted-foreground">Analyzing candidates...</p>
          <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
        </CardContent>
      </Card>
    );
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-1">No matches yet</h3>
          <p className="text-sm text-muted-foreground">
            Click "Run Match" to find candidates that fit this job spec
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              Match Results ({matches.length} candidates)
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <div className="flex gap-1">
                <Button
                  variant={sortBy === 'overall' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('overall')}
                >
                  Overall
                </Button>
                <Button
                  variant={sortBy === 'skills' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('skills')}
                >
                  Skills
                </Button>
                <Button
                  variant={sortBy === 'recency' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy('recency')}
                >
                  Recency
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead className="text-center">Overall</TableHead>
                  <TableHead className="text-center">Skills</TableHead>
                  <TableHead className="text-center">Sector</TableHead>
                  <TableHead className="text-center">Tenure</TableHead>
                  <TableHead className="text-center">Recency</TableHead>
                  <TableHead className="text-center">Flags</TableHead>
                  <TableHead>Top Match</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMatches.map((match, index) => (
                  <TableRow
                    key={match.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedMatch(match)}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{match.candidate?.name || 'Unknown'}</span>
                        <span className="text-sm text-muted-foreground">
                          {match.candidate?.current_title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          match.overall_score >= 80
                            ? 'bg-green-500/10 text-green-700 border-green-200'
                            : match.overall_score >= 60
                            ? 'bg-yellow-500/10 text-yellow-700 border-yellow-200'
                            : 'bg-muted'
                        }
                      >
                        {match.overall_score}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={match.skill_match_score} label="Skill Match" />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={match.sector_company_score} label="Sector/Company" />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={match.tenure_score} label="Tenure" />
                    </TableCell>
                    <TableCell className="text-center">
                      <ScoreBadge score={match.recency_score} label="Recency" />
                    </TableCell>
                    <TableCell className="text-center">
                      {match.risk_flags.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {match.risk_flags.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <ul className="text-sm space-y-1">
                                {match.risk_flags.map((flag, i) => (
                                  <li key={i}>• {flag}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {match.top_evidence_snippets.length > 0 ? (
                        <SnippetHighlight 
                          snippet={match.top_evidence_snippets[0]} 
                          maxLines={1}
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">No snippets</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Sheet open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <SheetContent className="w-[450px] sm:w-[540px] overflow-y-auto">
          {selectedMatch && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Match Details
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Candidate Info */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{selectedMatch.candidate?.name}</h3>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {selectedMatch.candidate?.current_title && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {selectedMatch.candidate.current_title}
                      </span>
                    )}
                    {selectedMatch.candidate?.current_company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {selectedMatch.candidate.current_company}
                      </span>
                    )}
                    {selectedMatch.candidate?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedMatch.candidate.location}
                      </span>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Overall Score */}
                <div className="text-center py-4 bg-muted/50 rounded-lg">
                  <div className="text-4xl font-bold">{selectedMatch.overall_score}</div>
                  <div className="text-sm text-muted-foreground">Overall Match Score</div>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-4">
                  <h4 className="font-medium">Score Breakdown</h4>
                  <ScoreBar score={selectedMatch.skill_match_score} label="Skills" icon={Target} />
                  <ScoreBar score={selectedMatch.sector_company_score} label="Sector/Company" icon={Building2} />
                  <ScoreBar score={selectedMatch.tenure_score} label="Tenure" icon={TrendingUp} />
                  <ScoreBar score={selectedMatch.recency_score} label="Recency" icon={Clock} />
                </div>

                <Separator />

                {/* AI Claims with Evidence */}
                {selectedMatch.score_breakdown?.evidence?.claims && selectedMatch.score_breakdown.evidence.claims.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Quote className="h-4 w-4 text-primary" />
                        AI Analysis
                        <Badge variant="secondary" className="text-[10px]">Evidence-linked</Badge>
                      </h4>
                      <div className="space-y-2">
                        {selectedMatch.score_breakdown.evidence.claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="flex items-start justify-between gap-2 text-sm p-2 rounded bg-muted/50"
                          >
                            <div className="flex items-start gap-2 flex-1">
                              {claim.category === 'skill_match' && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
                              {claim.category === 'sector' && <Building2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                              {claim.category === 'tenure' && <TrendingUp className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />}
                              {claim.category === 'recency' && <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                              {claim.category === 'risk' && <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />}
                              <span className="text-muted-foreground">{claim.text}</span>
                            </div>
                            {claim.evidence && claim.evidence.length > 0 && (
                              <EvidencePill
                                evidence={claim.evidence}
                                size="sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Matched Skills */}
                {selectedMatch.score_breakdown?.matched_skills && selectedMatch.score_breakdown.matched_skills.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Matched Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMatch.score_breakdown.matched_skills.map((skill, i) => {
                        // Find evidence for this skill
                        const skillClaim = selectedMatch.score_breakdown?.evidence?.claims?.find(
                          c => c.category === 'skill_match'
                        );
                        const skillEvidence = skillClaim?.evidence?.filter(
                          e => e.claimText.toLowerCase().includes(skill.replace(' (partial)', '').toLowerCase())
                        );
                        
                        return (
                          <div key={i} className="inline-flex items-center gap-0.5">
                            <Badge variant="secondary" className="bg-green-500/10">
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
                )}

                {/* Missing Skills */}
                {selectedMatch.score_breakdown?.missing_skills && selectedMatch.score_breakdown.missing_skills.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2 text-muted-foreground">
                      Missing Skills
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMatch.score_breakdown.missing_skills.map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-muted-foreground">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signals Section - replaces old Risk Flags */}
                {selectedMatch.risk_flags.length > 0 && (
                  <>
                    <Separator />
                    <SignalsSection
                      signals={extractMatchSignals(selectedMatch.score_breakdown as unknown as Record<string, unknown>)}
                      title="Signals"
                      defaultOpen={true}
                    />
                  </>
                )}

                {/* Suggested Questions */}
                {selectedMatch.suggested_questions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                      Questions to Ask
                    </h4>
                    <ul className="space-y-2">
                      {selectedMatch.suggested_questions.map((q, i) => (
                        <li key={i} className="text-sm text-muted-foreground bg-blue-500/5 p-2 rounded">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Top Matches / Evidence Snippets - Legacy display */}
                {selectedMatch.top_evidence_snippets.length > 0 && !selectedMatch.score_breakdown?.evidence?.claims?.length && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Top Matches
                      </h4>
                      <div className="space-y-2">
                        {selectedMatch.top_evidence_snippets.map((snippet, i) => (
                          <SnippetHighlight 
                            key={i}
                            snippet={snippet}
                            maxLines={2}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Match Reasoning */}
                {selectedMatch.match_reasoning && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium">Analysis Summary</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedMatch.match_reasoning}
                      </p>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedMatch(null)}
                  >
                    Close
                  </Button>
                  {onShortlist && (
                    <Button
                      className="flex-1"
                      onClick={() => onShortlist(selectedMatch)}
                    >
                      Add to Shortlist
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet } from '@/components/ui/sheet';
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
  Target,
} from 'lucide-react';
import type { JobSpecMatch } from '@/lib/job-match-types';
import { SnippetHighlight } from './SnippetHighlight';
import { MatchDetailPanel } from './MatchDetailPanel';
import { useGeneratedQuestions } from '@/hooks/use-generated-questions';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface MatchResultsPanelProps {
  matches: JobSpecMatch[];
  loading: boolean;
  onShortlist?: (match: JobSpecMatch) => void;
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const getColor = () => {
    if (score >= 80) return 'bg-primary/10 text-primary border-primary/20';
    if (score >= 60) return 'bg-amber-500/10 text-amber-700 border-amber-200';
    if (score >= 40) return 'bg-orange-500/10 text-orange-700 border-orange-200';
    return 'bg-destructive/10 text-destructive border-destructive/20';
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

export function MatchResultsPanel({ matches, loading, onShortlist }: MatchResultsPanelProps) {
  const [selectedMatch, setSelectedMatch] = useState<JobSpecMatch | null>(null);
  const [sortBy, setSortBy] = useState<'overall' | 'skills' | 'recency'>('overall');

  // Get workspace for question generation
  const { currentWorkspace } = useWorkspace();

  // Get generated questions for selected match (only fetches cached data, no CV loaded)
  const {
    questions,
    isLoading: questionsLoading,
    generate: generateQuestions,
    isGenerating,
    cachedAt,
  } = useGeneratedQuestions({
    talentId: selectedMatch?.talent_id,
    jobSpecId: selectedMatch?.job_spec_id,
    workspaceId: currentWorkspace?.id,
    enabled: !!selectedMatch && !!currentWorkspace,
  });

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
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : match.overall_score >= 60
                            ? 'bg-amber-500/10 text-amber-700 border-amber-200'
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
                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
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

      {/* Detail Panel - Uses new focused component */}
      <Sheet open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        {selectedMatch && (
          <MatchDetailPanel
            match={selectedMatch}
            questions={questions}
            questionsLoading={questionsLoading}
            onGenerateQuestions={(force) => generateQuestions({ forceRegenerate: force })}
            isGenerating={isGenerating}
            cachedAt={cachedAt}
            onShortlist={onShortlist}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </Sheet>
    </>
  );
}

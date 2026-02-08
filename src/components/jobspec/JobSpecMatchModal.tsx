import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Briefcase, 
  MapPin, 
  Building2, 
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import type { JobSpec } from '@/lib/job-spec-types';
import { MatchResultsPanel } from './MatchResultsPanel';
import { useJobMatch } from '@/hooks/use-job-match';

interface JobSpecMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobSpec: JobSpec | null;
}

export function JobSpecMatchModal({ 
  open, 
  onOpenChange, 
  jobSpec,
}: JobSpecMatchModalProps) {
  const { loading, matches, runMatch, fetchMatches, clearMatches } = useJobMatch();

  useEffect(() => {
    if (open && jobSpec) {
      // Fetch existing matches when modal opens
      fetchMatches(jobSpec.id);
    } else if (!open) {
      clearMatches();
    }
  }, [open, jobSpec?.id, fetchMatches, clearMatches]);

  if (!jobSpec) return null;

  const handleRunMatch = () => {
    runMatch(jobSpec.id);
  };

  const handleShortlist = (match: any) => {
    // TODO: Implement shortlist functionality
    console.log('Shortlist candidate:', match.talent_id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Match Candidates
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Finding the best candidates for: <strong>{jobSpec.title}</strong>
              </p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Job Spec Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={jobSpec.type === 'contract' ? 'secondary' : 'default'}>
                  {jobSpec.type === 'contract' ? 'Contract' : 'Permanent'}
                </Badge>
                
                {jobSpec.location && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {jobSpec.location}
                  </span>
                )}
                
                {jobSpec.sector && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" />
                    {jobSpec.sector}
                  </span>
                )}

                {jobSpec.key_skills && jobSpec.key_skills.length > 0 && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    {jobSpec.key_skills.length} key skills
                  </span>
                )}
              </div>

              {jobSpec.key_skills && jobSpec.key_skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {jobSpec.key_skills.slice(0, 10).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {jobSpec.key_skills.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{jobSpec.key_skills.length - 10} more
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {matches.length > 0 
                  ? `${matches.length} candidates scored and ranked`
                  : 'Click "Run Match" to analyze candidates'}
              </p>
              <Button 
                onClick={handleRunMatch} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {matches.length > 0 ? 'Re-run Match' : 'Run Match'}
                  </>
                )}
              </Button>
            </div>

            <Separator />

            {/* Match Results */}
            <MatchResultsPanel 
              matches={matches} 
              loading={loading}
              onShortlist={handleShortlist}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

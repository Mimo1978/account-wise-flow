import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Briefcase, 
  MapPin, 
  Building2, 
  Calendar,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import type { JobSpec } from '@/lib/job-spec-types';
import { format } from 'date-fns';

interface JobSpecViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobSpec: JobSpec | null;
  onRunMatch?: (jobSpec: JobSpec) => void;
}

export function JobSpecViewModal({ 
  open, 
  onOpenChange, 
  jobSpec,
  onRunMatch,
}: JobSpecViewModalProps) {
  if (!jobSpec) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            {jobSpec.title}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Meta info row */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Badge variant={jobSpec.type === 'contract' ? 'secondary' : 'default'}>
                {jobSpec.type === 'contract' ? 'Contract' : 'Permanent'}
              </Badge>
              
              {jobSpec.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {jobSpec.location}
                </span>
              )}
              
              {jobSpec.sector && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  {jobSpec.sector}
                </span>
              )}
              
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Created {format(new Date(jobSpec.created_at), 'dd MMM yyyy')}
              </span>
            </div>
            
            {/* Compensation */}
            {(jobSpec.salary_range || jobSpec.day_rate_range) && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {jobSpec.type === 'contract' 
                    ? `Day Rate: ${jobSpec.day_rate_range}`
                    : `Salary: ${jobSpec.salary_range}`
                  }
                </span>
              </div>
            )}
            
            {/* Key Skills */}
            {jobSpec.key_skills && jobSpec.key_skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Key Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {jobSpec.key_skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Description */}
            {jobSpec.description_text && (
              <div>
                <h4 className="text-sm font-medium mb-2">Job Description</h4>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                    {jobSpec.description_text}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Fixed Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onRunMatch && (
            <Button onClick={() => onRunMatch(jobSpec)} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Run Match
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

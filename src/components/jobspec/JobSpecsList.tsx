import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  MoreHorizontal, 
  Eye, 
  Trash2, 
  Briefcase,
  MapPin,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useJobSpecs } from '@/hooks/use-job-specs';
import { CreateJobSpecModal } from './CreateJobSpecModal';
import { JobSpecViewModal } from './JobSpecViewModal';
import type { JobSpec } from '@/lib/job-spec-types';
import { format } from 'date-fns';

interface JobSpecsListProps {
  onRunMatch?: (jobSpec: JobSpec) => void;
}

export function JobSpecsList({ onRunMatch }: JobSpecsListProps) {
  const { jobSpecs, loading, deleteJobSpec } = useJobSpecs();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<JobSpec | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [specToDelete, setSpecToDelete] = useState<JobSpec | null>(null);

  const handleView = (spec: JobSpec) => {
    setSelectedSpec(spec);
    setViewModalOpen(true);
  };

  const handleDeleteClick = (spec: JobSpec) => {
    setSpecToDelete(spec);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (specToDelete) {
      await deleteJobSpec(specToDelete.id);
      setDeleteDialogOpen(false);
      setSpecToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Job Specifications
        </h2>
        <Button onClick={() => setCreateModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Job Spec
        </Button>
      </div>

      {jobSpecs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium mb-1">No job specifications yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first job spec to start matching candidates
            </p>
            <Button onClick={() => setCreateModalOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Job Spec
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobSpecs.map((spec) => (
            <Card key={spec.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 
                        className="font-medium truncate cursor-pointer hover:text-primary"
                        onClick={() => handleView(spec)}
                      >
                        {spec.title}
                      </h3>
                      <Badge variant={spec.type === 'contract' ? 'secondary' : 'default'} className="shrink-0">
                        {spec.type === 'contract' ? 'Contract' : 'Perm'}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {spec.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {spec.location}
                        </span>
                      )}
                      {spec.sector && (
                        <span>{spec.sector}</span>
                      )}
                      <span>
                        {format(new Date(spec.created_at), 'dd MMM yyyy')}
                      </span>
                    </div>
                    
                    {spec.key_skills && spec.key_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {spec.key_skills.slice(0, 5).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {spec.key_skills.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{spec.key_skills.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {onRunMatch && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => onRunMatch(spec)}
                        className="gap-1"
                      >
                        <Sparkles className="h-3 w-3" />
                        Match
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(spec)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(spec)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateJobSpecModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <JobSpecViewModal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        jobSpec={selectedSpec}
        onRunMatch={onRunMatch}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Specification?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{specToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

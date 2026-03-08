import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCrmProjects } from '@/hooks/use-crm-projects';
import { useJobProjects, useLinkJobToProject, useUnlinkJobFromProject } from '@/hooks/use-job-projects';
import { Link2, ExternalLink, Plus, X, Loader2, FolderOpen } from 'lucide-react';

interface ProjectLinkerProps {
  jobId: string;
  jobTitle: string;
  onProjectLinked?: (projectId: string) => void;
}

export function ProjectLinker({ jobId, jobTitle, onProjectLinked }: ProjectLinkerProps) {
  const navigate = useNavigate();
  const { data: links = [], isLoading } = useJobProjects(jobId);
  const { data: projects = [] } = useCrmProjects();
  const linkMutation = useLinkJobToProject();
  const unlinkMutation = useUnlinkJobFromProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const linkedProjectIds = new Set(links.map(l => l.project_id));
  const filtered = projects.filter(
    p => !linkedProjectIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = (projectId: string) => {
    linkMutation.mutate({ jobId, projectId }, {
      onSuccess: () => onProjectLinked?.(projectId),
    });
    setOpen(false);
    setSearch('');
  };

  const handleCreateNew = () => {
    // Navigate to projects page with pre-fill params
    navigate(`/crm/projects?new=true&name=${encodeURIComponent(jobTitle)}&job_id=${encodeURIComponent(jobId)}`);
  };

  if (isLoading) return <span className="text-xs text-muted-foreground">Loading…</span>;

  const linkedProject = links[0]?.project;

  return (
    <span className="inline-flex items-center gap-1.5">
      <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
      {linkedProject ? (
        <span className="inline-flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/crm/projects/${linkedProject.id}`)}
            className="text-sm text-primary hover:underline underline-offset-2 cursor-pointer font-medium"
          >
            {linkedProject.name}
          </button>
          <button
            onClick={() => links[0] && unlinkMutation.mutate(links[0].id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Unlink project"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer">
              <Link2 className="w-3 h-3" />
              No project assigned
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="h-8 text-sm mb-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No projects found</p>
              )}
              {filtered.slice(0, 10).map(p => (
                <button
                  key={p.id}
                  onClick={() => handleLink(p.id)}
                  className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{p.name}</span>
                  <Badge variant="outline" className="text-[10px] ml-2 flex-shrink-0">{p.status}</Badge>
                </button>
              ))}
            </div>
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={handleCreateNew}
                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-1.5 text-primary"
              >
                <Plus className="w-3.5 h-3.5" /> Create new project
              </button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

// --- Prompt banners for gentle project linking ---

interface ProjectLinkPromptProps {
  jobId: string;
  jobTitle: string;
  variant: 'spec-approved' | 'advert-published' | 'shortlist' | 'filled';
  onDismiss?: () => void;
  onProjectLinked?: (projectId: string) => void;
}

export function ProjectLinkPrompt({ jobId, jobTitle, variant, onDismiss }: ProjectLinkPromptProps) {
  const { data: links = [] } = useJobProjects(jobId);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already linked or dismissed
  if (links.length > 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (variant === 'spec-approved') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm">
        <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground flex-1">
          Want to track this role in a project? Linking to a project connects it to your pipeline and Command Centre.
        </span>
        <ProjectLinkerInline jobId={jobId} jobTitle={jobTitle} onLinked={dismiss} />
        <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs">
          Maybe Later
        </Button>
      </div>
    );
  }

  if (variant === 'shortlist') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm mb-4">
        <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-muted-foreground flex-1">
          You have candidates in progress. Assign this job to a project to see it in your pipeline.
        </span>
        <ProjectLinkerInline jobId={jobId} jobTitle={jobTitle} onLinked={dismiss} />
        <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs">
          Dismiss
        </Button>
      </div>
    );
  }

  if (variant === 'filled') {
    // This is rendered as a dialog externally
    return null;
  }

  return null;
}

// Inline mini-linker for banners
function ProjectLinkerInline({ jobId, jobTitle, onLinked }: { jobId: string; jobTitle: string; onLinked: () => void }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useCrmProjects();
  const linkMutation = useLinkJobToProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleLink = (projectId: string) => {
    linkMutation.mutate({ jobId, projectId });
    setOpen(false);
    onLinked();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs gap-1">
          <Link2 className="w-3 h-3" /> Link to Project
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {projects
            .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 8)
            .map(p => (
              <button
                key={p.id}
                onClick={() => handleLink(p.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors truncate"
              >
                {p.name}
              </button>
            ))}
        </div>
        <div className="border-t border-border mt-1 pt-1">
          <button
            onClick={() => navigate(`/crm/projects?new=true&name=${encodeURIComponent(jobTitle)}&job_id=${encodeURIComponent(jobId)}`)}
            className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-1.5 text-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Create new project
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Modal version for the "Filled" celebration modal
export function FilledModalLinker({ jobId, jobTitle, onLinked }: { jobId: string; jobTitle: string; onLinked: () => void }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useCrmProjects();
  const linkMutation = useLinkJobToProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleLink = (projectId: string) => {
    linkMutation.mutate({ jobId, projectId });
    setOpen(false);
    onLinked();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="gap-1.5">
          <Link2 className="w-4 h-4" /> Link to Project
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {projects
            .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
            .slice(0, 10)
            .map(p => (
              <button
                key={p.id}
                onClick={() => handleLink(p.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors truncate"
              >
                {p.name}
              </button>
            ))}
        </div>
        <div className="border-t border-border mt-1 pt-1">
          <button
            onClick={() => navigate(`/crm/projects?new=true&name=${encodeURIComponent(jobTitle)}&job_id=${encodeURIComponent(jobId)}`)}
            className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors flex items-center gap-1.5 text-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Create new project
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useJobSpecs } from '@/hooks/use-job-specs';
import type { CreateJobSpecInput, JobSpecType } from '@/lib/job-spec-types';

interface CreateJobSpecModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateJobSpecModal({ open, onOpenChange, onCreated }: CreateJobSpecModalProps) {
  const { createJobSpec } = useJobSpecs();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<CreateJobSpecInput>({
    title: '',
    type: 'permanent',
    sector: '',
    location: '',
    day_rate_range: '',
    salary_range: '',
    description_text: '',
    key_skills: [],
  });
  
  const [skillInput, setSkillInput] = useState('');

  const handleAddSkill = () => {
    const skill = skillInput.trim();
    if (skill && !formData.key_skills?.includes(skill)) {
      setFormData(prev => ({
        ...prev,
        key_skills: [...(prev.key_skills || []), skill],
      }));
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      key_skills: (prev.key_skills || []).filter(s => s !== skillToRemove),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;
    
    setIsSubmitting(true);
    try {
      const result = await createJobSpec(formData);
      if (result) {
        onOpenChange(false);
        onCreated?.(result.id);
        // Reset form
        setFormData({
          title: '',
          type: 'permanent',
          sector: '',
          location: '',
          day_rate_range: '',
          salary_range: '',
          description_text: '',
          key_skills: [],
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Job Specification</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Senior Software Engineer"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: JobSpecType) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="sector">Sector</Label>
                  <Input
                    id="sector"
                    value={formData.sector || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, sector: e.target.value }))}
                    placeholder="e.g. Technology, Finance"
                  />
                </div>
                
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. London, Remote"
                  />
                </div>
                
                {formData.type === 'contract' ? (
                  <div>
                    <Label htmlFor="day_rate">Day Rate Range</Label>
                    <Input
                      id="day_rate"
                      value={formData.day_rate_range || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, day_rate_range: e.target.value }))}
                      placeholder="e.g. £500-£700"
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="salary">Salary Range</Label>
                    <Input
                      id="salary"
                      value={formData.salary_range || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, salary_range: e.target.value }))}
                      placeholder="e.g. £80k-£100k"
                    />
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="skills">Key Skills</Label>
                <div className="flex gap-2">
                  <Input
                    id="skills"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a skill and press Enter"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddSkill}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {(formData.key_skills?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.key_skills?.map((skill) => (
                      <Badge key={skill} variant="secondary" className="gap-1">
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <Label htmlFor="description">Job Description</Label>
                <Textarea
                  id="description"
                  value={formData.description_text || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description_text: e.target.value }))}
                  placeholder="Paste or type the full job specification here..."
                  rows={10}
                />
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Job Spec'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

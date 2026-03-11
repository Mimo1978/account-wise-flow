import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

export interface SpecConfig {
  seniority: string;
  sectors: string[];
  workType: string;
  workLocation: string;
  mustHaveSkills: string[];
}

const SENIORITY_OPTIONS = ['Junior', 'Mid-Level', 'Senior', 'Lead/Principal', 'Director/VP'];
const SECTOR_OPTIONS = ['Financial Services', 'Technology', 'Legal', 'Healthcare', 'Consulting', 'Energy', 'Public Sector'];
const WORK_TYPE_OPTIONS = ['Permanent', 'Contract', 'Interim', 'Fixed-Term'];
const WORK_LOCATION_OPTIONS = ['On-site', 'Hybrid', 'Remote', 'Flexible'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: SpecConfig) => void;
}

export function SpecQuickConfigModal({ open, onOpenChange, onGenerate }: Props) {
  const [seniority, setSeniority] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [otherSector, setOtherSector] = useState('');
  const [showOtherSector, setShowOtherSector] = useState(false);
  const [workType, setWorkType] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [skills, setSkills] = useState(['', '', '']);

  const toggleSector = (s: string) => {
    if (s === 'Other') {
      setShowOtherSector(!showOtherSector);
      return;
    }
    setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleGenerate = () => {
    const allSectors = [...sectors];
    if (showOtherSector && otherSector.trim()) allSectors.push(otherSector.trim());
    onGenerate({
      seniority,
      sectors: allSectors,
      workType,
      workLocation,
      mustHaveSkills: skills.filter(s => s.trim()),
    });
    onOpenChange(false);
  };

  const chipClass = (selected: boolean) =>
    `cursor-pointer transition-all text-xs px-3 py-1.5 rounded-full border ${
      selected
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-muted/50 text-foreground border-border hover:border-primary/50'
    }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Help AI write a better spec</DialogTitle>
          <DialogDescription>Quick answers mean a sharper spec — takes 30 seconds</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Q1: Seniority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">1. Seniority</label>
            <div className="flex flex-wrap gap-2">
              {SENIORITY_OPTIONS.map(s => (
                <button key={s} type="button" className={chipClass(seniority === s)} onClick={() => setSeniority(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Q2: Sector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">2. Sector <span className="text-muted-foreground font-normal">(multi-select)</span></label>
            <div className="flex flex-wrap gap-2">
              {SECTOR_OPTIONS.map(s => (
                <button key={s} type="button" className={chipClass(sectors.includes(s))} onClick={() => toggleSector(s)}>
                  {s}
                </button>
              ))}
              <button type="button" className={chipClass(showOtherSector)} onClick={() => toggleSector('Other')}>
                Other
              </button>
            </div>
            {showOtherSector && (
              <Input
                value={otherSector}
                onChange={e => setOtherSector(e.target.value)}
                placeholder="e.g. Retail, Manufacturing…"
                className="mt-1 text-sm h-8"
              />
            )}
          </div>

          {/* Q3: Work Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">3. Work Type</label>
            <div className="flex flex-wrap gap-2">
              {WORK_TYPE_OPTIONS.map(s => (
                <button key={s} type="button" className={chipClass(workType === s)} onClick={() => setWorkType(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Q4: Work Location */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">4. Work Location</label>
            <div className="flex flex-wrap gap-2">
              {WORK_LOCATION_OPTIONS.map(s => (
                <button key={s} type="button" className={chipClass(workLocation === s)} onClick={() => setWorkLocation(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Q5: Must-Have Skills */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">5. Must-Have Skills <span className="text-muted-foreground font-normal">(up to 3)</span></label>
            <p className="text-xs text-muted-foreground">These will be weighted highest in the shortlist search</p>
            <div className="grid grid-cols-3 gap-2">
              {skills.map((s, i) => (
                <Input
                  key={i}
                  value={s}
                  onChange={e => {
                    const next = [...skills];
                    next[i] = e.target.value;
                    setSkills(next);
                  }}
                  placeholder={`Skill ${i + 1}`}
                  className="text-sm h-8"
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Generate Spec →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

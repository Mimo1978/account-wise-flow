import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BOARD_DEFINITIONS, useSaveBoardFormat, type BoardFormat } from '@/hooks/use-job-adverts';

interface Props {
  board: string;
  existingFormat?: BoardFormat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BoardFormatModal({ board, existingFormat, open, onOpenChange }: Props) {
  const def = BOARD_DEFINITIONS[board];
  const saveMutation = useSaveBoardFormat();

  const [maxWords, setMaxWords] = useState<string>(
    (existingFormat?.max_words ?? def?.maxWords ?? '').toString()
  );
  const [maxChars, setMaxChars] = useState<string>(
    (existingFormat?.max_characters ?? def?.maxChars ?? '').toString()
  );
  const [sections, setSections] = useState<string>(
    (existingFormat?.required_sections ?? []).join(', ')
  );
  const [template, setTemplate] = useState(existingFormat?.template ?? '');
  const [notes, setNotes] = useState(existingFormat?.notes ?? '');

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      board,
      max_words: maxWords ? parseInt(maxWords, 10) || null : null,
      max_characters: maxChars ? parseInt(maxChars, 10) || null : null,
      required_sections: sections ? sections.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      template: template || undefined,
      notes: notes || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Format Settings — {def?.label || board}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{def?.description}</p>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Max Words</Label>
              <Input type="number" value={maxWords} onChange={e => setMaxWords(e.target.value)} placeholder="No limit" />
            </div>
            <div className="space-y-1.5">
              <Label>Max Characters</Label>
              <Input type="number" value={maxChars} onChange={e => setMaxChars(e.target.value)} placeholder="No limit" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Required Sections (comma-separated)</Label>
            <Input value={sections} onChange={e => setSections(e.target.value)} placeholder="e.g. title, salary, description, requirements" />
          </div>
          <div className="space-y-1.5">
            <Label>Template / Format Notes</Label>
            <Textarea rows={4} value={template} onChange={e => setTemplate(e.target.value)} placeholder="Paste your preferred template or describe the format..." />
          </div>
          <div className="space-y-1.5">
            <Label>Tone / Style Notes</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. formal tone, benefits-led opening..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Format'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

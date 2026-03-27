import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Palette,
  Layout,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCVExport } from '@/hooks/use-cv-export';
import { useWorkspaceBranding } from '@/hooks/use-workspace-branding';
import { useJobSpecs } from '@/hooks/use-job-specs';
import { CVTemplatePreview } from './CVTemplatePreview';
import type { Talent } from '@/lib/types';
import type { JobSpec } from '@/lib/job-spec-types';
import { 
  TEMPLATE_STYLES, 
  DEFAULT_SECTIONS,
  type TemplateStyle,
  type CVPreviewData,
} from '@/lib/cv-export-types';

interface CVExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Talent;
  preselectedJobSpec?: JobSpec;
}

export function CVExportModal({
  open,
  onOpenChange,
  candidate,
  preselectedJobSpec,
}: CVExportModalProps) {
  const navigate = useNavigate();
  const { 
    loading, 
    generatingSummary, 
    generateExecutiveSummary, 
    exportCV 
  } = useCVExport();
  const { branding, getLogoUrl } = useWorkspaceBranding();
  const { jobSpecs } = useJobSpecs();

  // Form state
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>('classic');
  const [selectedJobSpecId, setSelectedJobSpecId] = useState<string | null>(
    preselectedJobSpec?.id || null
  );
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [step, setStep] = useState<'configure' | 'review'>('configure');
  const [exportResult, setExportResult] = useState<{ storage_path: string } | null>(null);

  const selectedJobSpec = jobSpecs.find(js => js.id === selectedJobSpecId);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep('configure');
      setTemplateStyle('classic');
      setSelectedJobSpecId(preselectedJobSpec?.id || null);
      setSections(DEFAULT_SECTIONS);
      setExecutiveSummary('');
      setSummaryGenerated(false);
      setExportResult(null);
    }
  }, [open, preselectedJobSpec]);

  const handleGenerateSummary = async () => {
    const summary = await generateExecutiveSummary(candidate, selectedJobSpec);
    setExecutiveSummary(summary);
    setSummaryGenerated(true);
  };

  const handleProceedToReview = async () => {
    if (!summaryGenerated) {
      await handleGenerateSummary();
    }
    setStep('review');
  };

  const buildPreviewData = (): CVPreviewData => {
    return {
      candidate: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone || null,
        location: candidate.location || null,
        currentTitle: candidate.roleType,
        headline: candidate.aiOverview || null,
        skills: candidate.skills,
        experience: candidate.experience?.map(exp => ({
          company: exp.company,
          title: exp.title,
          startDate: exp.startDate,
          endDate: exp.endDate,
          current: exp.current,
          description: exp.description,
        })) || [],
        education: [], // Would come from parsed CV
        certifications: [],
      },
      executiveSummary,
      branding,
      templateStyle,
      jobSpec: selectedJobSpec ? {
        title: selectedJobSpec.title,
        company: undefined,
      } : undefined,
    };
  };

  const triggerDownload = useCallback(async (storagePath: string) => {
    try {
      const { data: urlData } = await supabase.storage
        .from('generated-exports')
        .createSignedUrl(storagePath, 3600);

      if (urlData?.signedUrl) {
        const link = document.createElement('a');
        link.href = urlData.signedUrl;
        link.download = candidate.name.replace(/\s+/g, '_') + '_CV.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('CV downloaded successfully');
      }
    } catch (e) {
      console.error('Download error:', e);
      toast.error('Export saved but download failed — check browser downloads');
    }
  }, [candidate.name]);

  const handleExport = async () => {
    const includedSections = Object.entries(sections)
      .filter(([_, included]) => included)
      .map(([section]) => section);

    const previewData = buildPreviewData();
    
    const result = await exportCV({
      candidateId: candidate.id,
      jobSpecId: selectedJobSpecId || undefined,
      templateStyle,
      includeSections: includedSections,
      executiveSummary,
    }, previewData);

    if (result) {
      setExportResult(result);
      await triggerDownload(result.storage_path);
      onOpenChange(false);
    }
  };

  const toggleSection = (section: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Client-Ready CV
          </DialogTitle>
          <DialogDescription>
            Generate a branded, spec-aligned CV for {candidate.name}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {step === 'configure' ? (
            <div className="space-y-6 py-4">
              {/* Logo missing banner */}
              {!branding?.logo_path && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-500">
                      No company logo set
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add your logo to appear on all exported CVs — makes them look professional and branded.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 flex-shrink-0"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/admin/branding');
                    }}
                  >
                    Add Logo →
                  </Button>
                </div>
              )}

              {/* Template Selection */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Template Style
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATE_STYLES.map((style) => (
                    <button
                      key={style.value}
                      type="button"
                      onClick={() => setTemplateStyle(style.value)}
                      className={cn(
                        'p-4 rounded-lg border-2 text-left transition-all',
                        templateStyle === style.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium">{style.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {style.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Job Spec Selection */}
              <div className="space-y-3">
                <Label>Target Job Spec (Optional)</Label>
                <Select
                  value={selectedJobSpecId || 'none'}
                  onValueChange={(v) => setSelectedJobSpecId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job spec to align summary" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific job spec</SelectItem>
                    {jobSpecs.map((spec) => (
                      <SelectItem key={spec.id} value={spec.id}>
                        {spec.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting a job spec will tailor the executive summary to highlight relevant experience.
                </p>
              </div>

              <Separator />

              {/* Section Toggles */}
              <div className="space-y-3">
                <Label>Include Sections</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(sections).map(([section, included]) => (
                    <div key={section} className="flex items-center space-x-2">
                      <Checkbox
                        id={section}
                        checked={included}
                        onCheckedChange={() => toggleSection(section as keyof typeof sections)}
                      />
                      <label
                        htmlFor={section}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                      >
                        {section}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Branding Preview */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Workspace Branding
                </Label>
                <div className="p-4 rounded-lg border bg-muted/30">
                  {branding ? (
                    <div className="flex items-center gap-4">
                      {getLogoUrl() && (
                        <img 
                          src={getLogoUrl()!} 
                          alt="Company logo" 
                          className="h-10 w-auto"
                        />
                      )}
                      <div>
                        <div className="font-medium">
                          {branding.company_name || 'Your Company'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div 
                            className="h-4 w-4 rounded" 
                            style={{ backgroundColor: branding.primary_color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            Primary color
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">
                        No branding configured. CV will use default styling.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Page Limit Note */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-700">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <strong>4-page maximum:</strong> Content will be automatically trimmed to the most relevant roles and achievements.
                </div>
              </div>
            </div>
          ) : (
            /* Review Step */
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Summary Editor */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Executive Summary
                  </Label>
                  <Textarea
                    value={executiveSummary}
                    onChange={(e) => setExecutiveSummary(e.target.value)}
                    className="min-h-[200px] resize-none"
                    placeholder="AI-generated summary will appear here..."
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Review and edit before generating. This summary is based strictly on CV evidence.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateSummary}
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Selected Options Summary */}
                  <div className="mt-4 p-3 rounded-lg border bg-muted/30 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Template:</span>
                      <Badge variant="secondary">{templateStyle}</Badge>
                    </div>
                    {selectedJobSpec && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Job Spec:</span>
                        <Badge variant="outline">{selectedJobSpec.title}</Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sections:</span>
                      <span className="text-xs">
                        {Object.entries(sections)
                          .filter(([_, v]) => v)
                          .map(([k]) => k)
                          .join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Template Preview */}
                <div className="space-y-3">
                  <Label>Preview</Label>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    {/* Logo / placeholder in preview header */}
                    <div className="flex items-center justify-between px-4 pt-4">
                      <div className="text-sm font-semibold text-gray-800">
                        {candidate.name}
                      </div>
                      {getLogoUrl() ? (
                        <img src={getLogoUrl()!} alt="Logo" className="h-8 w-auto" />
                      ) : (
                        <div className="h-8 px-3 flex items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50">
                          <span className="text-[10px] text-gray-400">Add logo in Settings</span>
                        </div>
                      )}
                    </div>
                    <CVTemplatePreview 
                      data={buildPreviewData()}
                      style={templateStyle}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          {step === 'configure' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleProceedToReview} disabled={generatingSummary}>
                {generatingSummary ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    Continue to Review
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              {exportResult && (
                <Button
                  variant="outline"
                  onClick={() => triggerDownload(exportResult.storage_path)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Now
                </Button>
              )}
              <Button onClick={handleExport} disabled={loading || !executiveSummary}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

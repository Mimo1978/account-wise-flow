import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/sonner';
import {
  Sparkles, Paperclip, CheckCircle2, Loader2, ChevronRight,
  MessageSquare, FileText, Edit3, AlertTriangle,
} from 'lucide-react';
import { ProjectLinkPrompt } from './ProjectLinker';
import { VoiceBriefInput } from './VoiceBriefInput';
import { SpecQuickConfigModal, type SpecConfig } from './SpecQuickConfigModal';

interface QA { question: string; answer: string; hint?: string }
interface AIQuestion { id: string; question: string; hint: string }

interface JobBriefSectionProps {
  job: {
    id: string;
    raw_brief: string | null;
    full_spec: string | null;
    title: string;
    spec_approved?: boolean;
  };
  onProjectLinked?: (projectId: string) => void;
}

export function JobBriefSection({ job, onProjectLinked }: JobBriefSectionProps) {
  const qc = useQueryClient();
  const [brief, setBrief] = useState(job.raw_brief || '');
  const [spec, setSpec] = useState(job.full_spec || '');
  const [approved, setApproved] = useState(!!job.full_spec && (job as any).spec_approved);

  // Quick config modal
  const [showQuickConfig, setShowQuickConfig] = useState(false);
  const [specConfig, setSpecConfig] = useState<SpecConfig | null>(null);

  // AI Assist state
  const [showAssist, setShowAssist] = useState(false);
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [conversation, setConversation] = useState<QA[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);

  // Voice transcript handler
  const handleVoiceTranscript = useCallback((text: string) => {
    setBrief(prev => prev ? `${prev}\n\n${text}` : text);
  }, []);

  // When user wants to generate spec, show quick config first
  const handleGenerateClick = () => {
    if (brief.trim().length < 20) {
      toast.error('Please enter at least 20 characters before generating a spec');
      return;
    }
    setShowQuickConfig(true);
  };

  // After quick config answers, run AI generation with structured context
  const handleConfigGenerate = useCallback(async (config: SpecConfig) => {
    setSpecConfig(config);
    setRefining(true);

    // Save config to job
    await supabase
      .from('jobs')
      .update({
        spec_seniority: config.seniority || null,
        spec_sectors: config.sectors.length > 0 ? config.sectors : null,
        spec_work_location: config.workLocation || null,
        spec_must_have_skills: config.mustHaveSkills.length > 0 ? config.mustHaveSkills : null,
      } as any)
      .eq('id', job.id);

    try {
      const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
        body: {
          brief: brief.trim(),
          action: 'refine',
          conversation: [],
          spec_config: config,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSpec(data.spec || '');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate spec');
    } finally {
      setRefining(false);
    }
  }, [brief, job.id]);

  const startAIAssist = useCallback(async () => {
    if (brief.trim().length < 20) {
      toast.error('Please enter at least 20 characters before using AI Assist');
      return;
    }
    setShowAssist(true);
    setLoadingQuestions(true);
    setConversation([]);
    setCurrentQIdx(0);
    setQuestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
        body: { brief: brief.trim(), action: 'questions' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuestions(data.questions || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate questions');
      setShowAssist(false);
    } finally {
      setLoadingQuestions(false);
    }
  }, [brief]);

  const submitAnswer = useCallback(async () => {
    if (!answer.trim()) return;
    const q = questions[currentQIdx];
    const newConv = [...conversation, { question: q.question, answer: answer.trim(), hint: q.hint }];
    setConversation(newConv);
    setAnswer('');

    const nextIdx = currentQIdx + 1;
    if (nextIdx >= questions.length) {
      setRefining(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
          body: { brief: brief.trim(), conversation: newConv, action: 'refine', spec_config: specConfig },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setSpec(data.spec || '');
      } catch (e: any) {
        toast.error(e.message || 'Failed to generate spec');
      } finally {
        setRefining(false);
      }
    } else {
      setCurrentQIdx(nextIdx);
    }
  }, [answer, currentQIdx, questions, conversation, brief, specConfig]);

  const skipRemaining = useCallback(async () => {
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
        body: { brief: brief.trim(), conversation, action: 'refine', spec_config: specConfig },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSpec(data.spec || '');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate spec');
    } finally {
      setRefining(false);
    }
  }, [brief, conversation, specConfig]);

  const approveSpec = useCallback(async () => {
    if (!spec.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ full_spec: spec.trim(), raw_brief: brief.trim(), spec_approved: true } as any)
        .eq('id', job.id);
      if (error) throw error;
      setApproved(true);
      qc.invalidateQueries({ queryKey: ['jobs', job.id] });
      toast.success('Spec approved and saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save spec');
    } finally {
      setSaving(false);
    }
  }, [spec, brief, job.id, qc]);

  const resetSpec = () => {
    setApproved(false);
    setShowAssist(false);
    setQuestions([]);
    setConversation([]);
    setCurrentQIdx(0);
  };

  // Approved state
  if (approved && spec) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Spec approved. Ready to generate adverts and run shortlist.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={resetSpec}>
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
        </div>
        
        <ProjectLinkPrompt jobId={job.id} jobTitle={job.title} variant="spec-approved" onProjectLinked={onProjectLinked} />
        
        <Card>
          <CardHeader><CardTitle className="text-sm">Job Specification</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{spec}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${showAssist ? 'lg:grid-cols-5' : ''}`}>
      {/* Left: Brief + Spec preview */}
      <div className={`space-y-4 ${showAssist ? 'lg:col-span-3' : ''}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> Job Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Paste a job description, type a rough brief, or use voice input. AI Assist will help you finish it."
              className="min-h-[160px] text-sm leading-relaxed resize-y"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleGenerateClick}
                disabled={brief.trim().length < 20 || refining}
                className="gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate Spec →
              </Button>
              <Button
                onClick={startAIAssist}
                variant="outline"
                disabled={brief.trim().length < 20 || loadingQuestions}
                className="gap-1.5"
              >
                {loadingQuestions ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5" />
                )}
                AI Assist (Q&A) →
              </Button>
              <VoiceBriefInput onTranscript={handleVoiceTranscript} />
              <Button variant="outline" size="sm" disabled>
                <Paperclip className="w-3.5 h-3.5 mr-1.5" /> Attach from CRM Files
              </Button>
              {brief.trim().length > 0 && brief.trim().length < 20 && (
                <span className="text-xs text-muted-foreground">
                  {20 - brief.trim().length} more characters needed
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI Approval Banner */}
        {spec && !approved && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                AI specs can miss nuance. Review carefully before shortlisting or posting. Errors are your responsibility.
              </p>
            </div>
          </div>
        )}

        {/* Live spec preview */}
        {spec && (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Generated Specification</CardTitle>
              <Badge variant="outline" className="text-xs">Editable</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                className="min-h-[300px] text-sm leading-relaxed resize-y font-mono"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={approveSpec}
                  disabled={saving || !spec.trim()}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Approve Spec
                </Button>
                <Button variant="outline" onClick={resetSpec}>
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit & Revise
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {refining && (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating specification from your brief…</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right: AI Assist Panel */}
      {showAssist && (
        <div className="lg:col-span-2 space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> AI Assist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingQuestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analysing your brief…
                </div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No questions generated.</p>
              ) : (
                <>
                  {conversation.map((qa, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Q{i + 1}</p>
                      <p className="text-sm font-medium">{qa.question}</p>
                      <p className="text-sm text-primary bg-primary/5 rounded-md px-3 py-2">{qa.answer}</p>
                    </div>
                  ))}

                  {currentQIdx < questions.length && !refining && (
                    <div className="space-y-3">
                      <Separator />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">
                            Question {currentQIdx + 1} of {questions.length}
                          </p>
                          <Button variant="ghost" size="sm" className="text-xs h-auto py-1" onClick={skipRemaining}>
                            Skip & Generate
                          </Button>
                        </div>
                        <p className="text-sm font-medium">{questions[currentQIdx].question}</p>
                        {questions[currentQIdx].hint && (
                          <p className="text-xs text-muted-foreground italic">{questions[currentQIdx].hint}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Your answer…"
                          className="text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                        />
                        <Button size="sm" onClick={submitAnswer} disabled={!answer.trim()}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {refining && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Building your specification…
                    </div>
                  )}

                  {!refining && currentQIdx >= questions.length && spec && (
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium pt-2">
                      ✓ Spec generated! Review and edit on the left, then approve.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Config Modal */}
      <SpecQuickConfigModal
        open={showQuickConfig}
        onOpenChange={setShowQuickConfig}
        onGenerate={handleConfigGenerate}
      />
    </div>
  );
}

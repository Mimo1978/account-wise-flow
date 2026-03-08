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
  MessageSquare, FileText, Edit3,
} from 'lucide-react';
import { ProjectLinkPrompt } from './ProjectLinker';

interface QA { question: string; answer: string; hint?: string }
interface AIQuestion { id: string; question: string; hint: string }

interface JobBriefSectionProps {
  job: {
    id: string;
    raw_brief: string | null;
    full_spec: string | null;
    title: string;
  };
}

export function JobBriefSection({ job }: JobBriefSectionProps) {
  const qc = useQueryClient();
  const [brief, setBrief] = useState(job.raw_brief || '');
  const [spec, setSpec] = useState(job.full_spec || '');
  const [approved, setApproved] = useState(!!job.full_spec);

  // AI Assist state
  const [showAssist, setShowAssist] = useState(false);
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [conversation, setConversation] = useState<QA[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);

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
      // All questions answered — refine spec
      setRefining(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
          body: { brief: brief.trim(), conversation: newConv, action: 'refine' },
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
  }, [answer, currentQIdx, questions, conversation, brief]);

  const skipRemaining = useCallback(async () => {
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-refine-spec', {
        body: { brief: brief.trim(), conversation, action: 'refine' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSpec(data.spec || '');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate spec');
    } finally {
      setRefining(false);
    }
  }, [brief, conversation]);

  const approveSpec = useCallback(async () => {
    if (!spec.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ full_spec: spec.trim(), raw_brief: brief.trim() } as any)
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
            Spec approved. Ready to generate adverts.
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={resetSpec}>
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
        </div>
        
        {/* Pause point 1: Suggest linking to a project after spec approval */}
        <ProjectLinkPrompt jobId={job.id} jobTitle={job.title} variant="spec-approved" />
        
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
              placeholder="Paste a job description, type a rough brief, or describe the role in a few sentences. AI Assist will help you finish it."
              className="min-h-[160px] text-sm leading-relaxed resize-y"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={startAIAssist}
                disabled={brief.trim().length < 20 || loadingQuestions}
                className="gap-1.5"
              >
                {loadingQuestions ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                AI Assist →
              </Button>
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
                  {/* Answered questions */}
                  {conversation.map((qa, i) => (
                    <div key={i} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Q{i + 1}</p>
                      <p className="text-sm font-medium">{qa.question}</p>
                      <p className="text-sm text-primary bg-primary/5 rounded-md px-3 py-2">{qa.answer}</p>
                    </div>
                  ))}

                  {/* Current question */}
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

                  {/* Refining state */}
                  {refining && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Building your specification…
                    </div>
                  )}

                  {/* Done state */}
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
    </div>
  );
}

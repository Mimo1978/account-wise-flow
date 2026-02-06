import React, { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronDown,
  HelpCircle,
  Copy,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { EvidencePill } from '@/components/evidence/EvidencePill';
import { cn } from '@/lib/utils';
import type { GeneratedQuestion } from '@/lib/question-types';
import { QUESTION_CATEGORY_LABELS, QUESTION_CATEGORY_COLORS } from '@/lib/question-types';
import { toast } from 'sonner';

interface QuestionsSectionProps {
  /** Generated questions */
  questions: GeneratedQuestion[];
  /** Section title */
  title?: string;
  /** Whether questions are loading */
  isLoading?: boolean;
  /** Whether to start open */
  defaultOpen?: boolean;
  /** Handler to generate questions */
  onGenerate?: (forceRegenerate?: boolean) => void;
  /** Whether currently generating */
  isGenerating?: boolean;
  /** When questions were last cached */
  cachedAt?: string;
  /** Handler for opening CV viewer */
  onOpenCV?: (documentId: string, position: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Collapsible section showing AI-generated interview questions.
 */
export function QuestionsSection({
  questions = [],
  title = 'Questions to Ask',
  isLoading = false,
  defaultOpen = false,
  onGenerate,
  isGenerating = false,
  cachedAt,
  onOpenCV,
  className,
}: QuestionsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (question: GeneratedQuestion) => {
    try {
      await navigator.clipboard.writeText(question.question);
      setCopiedId(question.id);
      toast.success('Question copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy question');
    }
  };

  const handleCopyAll = async () => {
    try {
      const allQuestions = questions.map((q, i) => `${i + 1}. ${q.question}`).join('\n\n');
      await navigator.clipboard.writeText(allQuestions);
      toast.success('All questions copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy questions');
    }
  };

  // Show generate button state
  const showGenerateButton = !questions.length && onGenerate;
  const showRegenerateButton = questions.length > 0 && onGenerate;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('rounded-lg border border-purple-200 bg-purple-50/50', className)}
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 h-auto hover:bg-transparent"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600">
              <HelpCircle className="h-4 w-4" />
            </div>
            <span className="font-medium">{title}</span>
            {questions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {questions.length}
              </Badge>
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          {/* Empty state with generate button */}
          {showGenerateButton && !isLoading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm text-muted-foreground text-center">
                Generate tailored interview questions based on signals and job requirements.
              </p>
              <Button
                onClick={() => onGenerate()}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Questions
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading questions...</span>
            </div>
          )}

          {/* Questions list */}
          {questions.length > 0 && (
            <>
              {/* Header with actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span>
                    {cachedAt
                      ? `Generated ${new Date(cachedAt).toLocaleDateString()}`
                      : 'AI-generated questions'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {showRegenerateButton && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onGenerate(true)}
                            disabled={isGenerating}
                            className="h-7 gap-1 text-xs"
                          >
                            <RefreshCw className={cn('h-3 w-3', isGenerating && 'animate-spin')} />
                            Regenerate
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Regenerate all questions</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyAll}
                          className="h-7 gap-1 text-xs"
                        >
                          <Copy className="h-3 w-3" />
                          Copy All
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy all questions</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Question items */}
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <QuestionItem
                    key={question.id}
                    question={question}
                    index={index}
                    isCopied={copiedId === question.id}
                    onCopy={() => handleCopy(question)}
                    onOpenCV={onOpenCV}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface QuestionItemProps {
  question: GeneratedQuestion;
  index: number;
  isCopied: boolean;
  onCopy: () => void;
  onOpenCV?: (documentId: string, position: number) => void;
}

function QuestionItem({ question, index, isCopied, onCopy, onOpenCV }: QuestionItemProps) {
  const [showReason, setShowReason] = useState(false);

  return (
    <div className="bg-background rounded-lg border p-3 space-y-2">
      {/* Question text with number */}
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/10 text-purple-600 text-xs flex items-center justify-center font-medium">
          {index + 1}
        </span>
        <p className="text-sm flex-1">{question.question}</p>
        
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {question.evidenceRefs.length > 0 && (
            <EvidencePill
              evidence={question.evidenceRefs}
              onOpenCV={onOpenCV}
              size="sm"
            />
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onCopy}
                >
                  {isCopied ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy question</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Category badge + Why toggle */}
      <div className="flex items-center gap-2 ml-8">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0', QUESTION_CATEGORY_COLORS[question.category])}
        >
          {QUESTION_CATEGORY_LABELS[question.category]}
        </Badge>
        <button
          onClick={() => setShowReason(!showReason)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          {showReason ? 'Hide why' : 'Why?'}
        </button>
      </div>

      {/* Reason (collapsible) */}
      {showReason && (
        <p className="text-xs text-muted-foreground ml-8 bg-muted/50 p-2 rounded">
          {question.reason}
        </p>
      )}
    </div>
  );
}

export default QuestionsSection;

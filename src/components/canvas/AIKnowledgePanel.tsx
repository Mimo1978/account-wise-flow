import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  Brain, 
  Send, 
  X, 
  Sparkles, 
  User,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  RotateCcw,
  Lightbulb,
  TrendingDown,
  Users,
  Building2,
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Account, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/use-draggable";
import { SafeAIText } from "./SafeAIText";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  highlightedContacts?: string[];
}

interface AIKnowledgePanelProps {
  account: Account;
  isOpen: boolean;
  onToggle: () => void;
  onHighlightContacts: (contactIds: string[]) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-knowledge-chat`;

const EXAMPLE_QUESTIONS = [
  "Who owns the technical evaluation process?",
  "What themes appear repeatedly in our notes?",
  "Where are the engagement gaps?",
  "Who are our champions and how engaged are they?",
  "Which contacts haven't been reached recently?",
];

const INSIGHTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-insights-analysis`;

interface InsightTheme { theme: string; description: string; evidence: string[]; contactIds: string[]; }
interface MissingStakeholder { gap: string; reason: string; recommendation: string; relatedContactIds: string[]; }
interface DepartmentGap { department: string; issue: string; contactIds: string[]; recommendation: string; }
interface UnbalancedBlocker { blockerName: string; blockerId: string; concern: string; recommendation: string; }
interface EngagementGap { area: string; contactIds: string[]; recommendation: string; }
interface AIInsights {
  repeatedThemes: InsightTheme[];
  missingStakeholders: MissingStakeholder[];
  departmentsWithoutOwners: DepartmentGap[];
  unbalancedBlockers: UnbalancedBlocker[];
  engagementGaps: EngagementGap[];
  summary: string;
}

export function AIKnowledgePanel({ 
  account, 
  isOpen, 
  onToggle,
  onHighlightContacts 
}: AIKnowledgePanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "analysis">("chat");
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate initial position based on whether panel is open
  const getInitialPosition = (forPanel = false) => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };

    // Minimap container is bottom-4 right-4 with border-2.
    // Canvas is 200x150, but the visible container is +4px in both directions.
    const rightOffset = 16;
    const bottomOffset = 16;
    const minimapCanvasWidth = 200;
    const minimapCanvasHeight = 150;
    const minimapBorder = 2;
    const minimapOuterWidth = minimapCanvasWidth + minimapBorder * 2;
    const minimapOuterHeight = minimapCanvasHeight + minimapBorder * 2;

    const buttonHeight = 48; // matches h-12
    const gapAboveMinimap = 56; // moved down a tiny bit more
    const leftNudge = 17; // one pixel right

    if (forPanel) {
      // Panel position: centered vertically with padding from top, right-aligned
      const panelWidth = 384; // w-96
      const panelHeight = 500;
      const topPadding = 100;

      return {
        x: window.innerWidth - panelWidth - rightOffset,
        y: Math.max(topPadding, (window.innerHeight - panelHeight) / 2),
      };
    }

    // Button position: above minimap (no touching) and roughly aligned with its left edge
    const minimapLeft = window.innerWidth - rightOffset - minimapOuterWidth;
    const minimapTop = window.innerHeight - bottomOffset - minimapOuterHeight;

    return {
      x: minimapLeft - leftNudge,
      y: minimapTop - gapAboveMinimap - buttonHeight,
    };
  };

  const { position, setPosition, dragRef, dragHandleProps, isDragging } = useDraggable({
    initialPosition: getInitialPosition(isOpen),
    bounds: "viewport",
  });

  const handleResetPosition = () => {
    setPosition(getInitialPosition(isOpen));
  };

  // Update position when panel opens/closes
  useEffect(() => {
    setPosition(getInitialPosition(isOpen));
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const extractHighlightedContacts = (text: string): string[] => {
    const regex = /\[HIGHLIGHT:([^\]]+)\]/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return [...new Set(matches)];
  };

  const formatResponseText = (text: string, contacts: Contact[]): string => {
    // Replace [HIGHLIGHT:id] with contact names styled differently
    return text.replace(/\[HIGHLIGHT:([^\]]+)\]/g, (_, id) => {
      const contact = contacts.find(c => c.id === id);
      return contact ? `**${contact.name}**` : `[Unknown Contact]`;
    });
  };

  const buildAccountContext = useCallback(() => {
    return {
      accountName: account.name,
      accountId: account.id,
      industry: account.industry,
      contacts: account.contacts.map(c => ({
        id: c.id,
        name: c.name,
        title: c.title,
        department: c.department,
        seniority: c.seniority,
        email: c.email,
        status: c.status,
        engagementScore: c.engagementScore,
        role: c.role,
        contactOwner: c.contactOwner,
        lastContact: c.lastContact,
        notes: c.notes?.map(n => ({ content: n.content, date: n.date, author: n.author })),
        activities: c.activities?.map(a => ({ type: a.type, date: a.date, description: a.description })),
      })),
      importantNote: account.importantNote,
    };
  }, [account]);

  const fetchInsights = useCallback(async () => {
    setIsAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const response = await fetch(INSIGHTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ accountContext: buildAccountContext() }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setInsights(data);
    } catch (err) {
      console.error("AI insights error:", err);
      setAnalysisError(err instanceof Error ? err.message : "Failed to fetch insights");
    } finally {
      setIsAnalysisLoading(false);
    }
  }, [buildAccountContext]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const getTotalInsightsCount = () => {
    if (!insights) return 0;
    return insights.repeatedThemes.length + insights.missingStakeholders.length +
      insights.departmentsWithoutOwners.length + insights.unbalancedBlockers.length +
      insights.engagementGaps.length;
  };

  const handleRunAnalysis = () => {
    setActiveTab("analysis");
    fetchInsights();
  };

  const sendMessage = async (questionText: string) => {
    if (!questionText.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: questionText.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    onHighlightContacts([]);

    let assistantContent = "";
    
    try {
      // Get the user's actual session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("Not authenticated - please sign in again");
      }

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          question: questionText.trim(),
          accountContext: buildAccountContext(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const updateAssistantMessage = (content: string) => {
        assistantContent = content;
        const highlighted = extractHighlightedContacts(content);
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => 
              i === prev.length - 1 
                ? { ...m, content, highlightedContacts: highlighted }
                : m
            );
          }
          return [...prev, { 
            id: crypto.randomUUID(), 
            role: "assistant", 
            content,
            highlightedContacts: highlighted
          }];
        });

        // Update highlighted contacts on canvas
        if (highlighted.length > 0) {
          onHighlightContacts(highlighted);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              updateAssistantMessage(assistantContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

    } catch (err) {
      console.error("AI chat error:", err);
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleExampleClick = (question: string) => {
    sendMessage(question);
  };

  // Always render a single consistent structure to avoid React reconciliation issues
  return (
    <>
      {/* Closed state - Draggable button aligned above minimap */}
      {!isOpen && (
        <div
          ref={dragRef}
          className="fixed z-40"
          style={{
            left: position.x,
            top: position.y,
            transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
          }}
        >
          <div
            className={cn(
              "flex items-center gap-2 bg-primary text-primary-foreground rounded-lg shadow-lg w-[204px] h-12",
              isDragging ? "cursor-grabbing" : ""
            )}
          >
            {/* Drag handle */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-12 w-10 flex items-center justify-center rounded-l-lg hover:bg-primary-foreground/10 transition-colors",
                      isDragging ? "cursor-grabbing" : "cursor-grab"
                    )}
                    {...dragHandleProps}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Drag to reposition
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Button content */}
            <button
              onClick={onToggle}
              className="h-12 flex items-center gap-2 flex-1"
            >
              <Brain className="w-4 h-4" />
              <span className="font-medium text-sm">AI Assistant</span>
            </button>
          </div>
        </div>
      )}

      {/* Open state - Full panel */}
      {isOpen && (
        <div 
          ref={dragRef}
          className={cn(
            "fixed bg-background border border-border rounded-xl shadow-2xl z-50",
            isMinimized ? "w-80 h-14" : "w-96 h-[500px]",
            isDragging ? "cursor-grabbing" : ""
          )}
          style={{
            left: position.x,
            top: position.y,
            transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
          }}
        >
          {/* Header - Draggable */}
          <div 
            className={cn(
              "flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 rounded-t-xl select-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            {...dragHandleProps}
          >
            <div className="flex items-center gap-2">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-1 rounded hover:bg-muted/50 transition-colors">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Drag to reposition
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Brain className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Assistant</h3>
                {!isMinimized && (
                  <p className="text-xs text-muted-foreground">{account.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetPosition();
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Reset position
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
              >
                {isMinimized ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Tab Toggle */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                    activeTab === "chat"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Brain className="w-3.5 h-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => { setActiveTab("analysis"); if (!insights && !isAnalysisLoading) fetchInsights(); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                    activeTab === "analysis"
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Analysis
                  {insights && <Badge variant="secondary" className="text-[10px] px-1 py-0">{getTotalInsightsCount()}</Badge>}
                </button>
              </div>

              {activeTab === "chat" ? (
                <>
                  {/* Messages Area */}
                  <ScrollArea className="h-[320px] p-4" ref={scrollRef}>
                    {messages.length === 0 ? (
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-3">
                            <Sparkles className="w-6 h-6 text-primary" />
                          </div>
                          <h4 className="font-medium mb-1">Ask about your account</h4>
                          <p className="text-xs text-muted-foreground">
                            I can analyze contacts, notes, and engagement patterns
                          </p>
                        </div>

                        {/* Run Full Analysis CTA */}
                        <button
                          onClick={handleRunAnalysis}
                          disabled={isAnalysisLoading}
                          className="w-full flex items-center gap-3 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-colors text-left"
                        >
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Run Full Analysis</p>
                            <p className="text-xs text-muted-foreground">Gaps, themes, missing stakeholders & more</p>
                          </div>
                        </button>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Or ask a question:
                          </p>
                          {EXAMPLE_QUESTIONS.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => handleExampleClick(q)}
                              className="w-full text-left text-sm p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex gap-2",
                              msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                            {msg.role === "assistant" && (
                              <div className="p-1.5 bg-primary/10 rounded-lg h-fit mt-0.5">
                                <Brain className="w-3 h-3 text-primary" />
                              </div>
                            )}
                            <div
                              className={cn(
                                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )}
                            >
                              {msg.role === "assistant" ? (
                                <SafeAIText
                                  content={msg.content}
                                  formatText={(text) => formatResponseText(text, account.contacts)}
                                  renderBold={true}
                                />
                              ) : (
                                <SafeAIText
                                  content={msg.content}
                                  renderBold={false}
                                />
                              )}
                              {msg.highlightedContacts && msg.highlightedContacts.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-xs text-muted-foreground">
                                    📍 {msg.highlightedContacts.length} contact(s) highlighted on canvas
                                  </p>
                                </div>
                              )}
                            </div>
                            {msg.role === "user" && (
                              <div className="p-1.5 bg-primary rounded-lg h-fit mt-0.5">
                                <User className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && (
                          <div className="flex gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-lg h-fit">
                              <Brain className="w-3 h-3 text-primary" />
                            </div>
                            <div className="bg-muted rounded-lg px-3 py-2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg mt-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                      </div>
                    )}
                  </ScrollArea>

                  {/* Input Area */}
                  <form onSubmit={handleSubmit} className="p-3 border-t border-border">
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about contacts, themes, gaps..."
                        className="flex-1"
                        disabled={isLoading}
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        disabled={!input.trim() || isLoading}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </form>
                </>
              ) : (
                /* Analysis Tab */
                <ScrollArea className="h-[360px]">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Full account analysis</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={fetchInsights}
                        disabled={isAnalysisLoading}
                      >
                        <RefreshCw className={cn("w-3 h-3", isAnalysisLoading && "animate-spin")} />
                        Refresh
                      </Button>
                    </div>

                    {isAnalysisLoading && (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Analyzing account...</p>
                      </div>
                    )}

                    {analysisError && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-sm">{analysisError}</p>
                      </div>
                    )}

                    {insights && !isAnalysisLoading && (
                      <>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-sm text-amber-900 dark:text-amber-100">{insights.summary}</p>
                        </div>

                        {insights.repeatedThemes.length > 0 && (
                          <InlineInsightSection title="Repeated Themes" icon={<TrendingDown className="w-4 h-4" />} count={insights.repeatedThemes.length} isExpanded={expandedSections.has('themes')} onToggle={() => toggleSection('themes')} variant="info">
                            {insights.repeatedThemes.map((theme, i) => (
                              <InlineInsightCard key={i} title={theme.theme} description={theme.description} details={theme.evidence} contactIds={theme.contactIds} onHighlight={onHighlightContacts} />
                            ))}
                          </InlineInsightSection>
                        )}

                        {insights.missingStakeholders.length > 0 && (
                          <InlineInsightSection title="Missing Stakeholders" icon={<Users className="w-4 h-4" />} count={insights.missingStakeholders.length} isExpanded={expandedSections.has('stakeholders')} onToggle={() => toggleSection('stakeholders')} variant="warning">
                            {insights.missingStakeholders.map((gap, i) => (
                              <InlineInsightCard key={i} title={gap.gap} description={gap.reason} recommendation={gap.recommendation} contactIds={gap.relatedContactIds} onHighlight={onHighlightContacts} />
                            ))}
                          </InlineInsightSection>
                        )}

                        {insights.departmentsWithoutOwners.length > 0 && (
                          <InlineInsightSection title="Departments Without Owners" icon={<Building2 className="w-4 h-4" />} count={insights.departmentsWithoutOwners.length} isExpanded={expandedSections.has('departments')} onToggle={() => toggleSection('departments')} variant="warning">
                            {insights.departmentsWithoutOwners.map((dept, i) => (
                              <InlineInsightCard key={i} title={dept.department} description={dept.issue} recommendation={dept.recommendation} contactIds={dept.contactIds} onHighlight={onHighlightContacts} />
                            ))}
                          </InlineInsightSection>
                        )}

                        {insights.unbalancedBlockers.length > 0 && (
                          <InlineInsightSection title="Blockers Without Counterbalance" icon={<ShieldAlert className="w-4 h-4" />} count={insights.unbalancedBlockers.length} isExpanded={expandedSections.has('blockers')} onToggle={() => toggleSection('blockers')} variant="danger">
                            {insights.unbalancedBlockers.map((blocker, i) => (
                              <InlineInsightCard key={i} title={blocker.blockerName} description={blocker.concern} recommendation={blocker.recommendation} contactIds={[blocker.blockerId]} onHighlight={onHighlightContacts} />
                            ))}
                          </InlineInsightSection>
                        )}

                        {insights.engagementGaps.length > 0 && (
                          <InlineInsightSection title="Engagement Gaps" icon={<AlertTriangle className="w-4 h-4" />} count={insights.engagementGaps.length} isExpanded={expandedSections.has('engagement')} onToggle={() => toggleSection('engagement')} variant="warning">
                            {insights.engagementGaps.map((gap, i) => (
                              <InlineInsightCard key={i} title={gap.area} recommendation={gap.recommendation} contactIds={gap.contactIds} onHighlight={onHighlightContacts} />
                            ))}
                          </InlineInsightSection>
                        )}

                        {getTotalInsightsCount() === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No significant gaps detected</p>
                            <p className="text-xs">Account coverage looks healthy</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Inline Insight Components ──

interface InlineInsightSectionProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'info' | 'warning' | 'danger';
  children: React.ReactNode;
}

function InlineInsightSection({ title, icon, count, isExpanded, onToggle, variant, children }: InlineInsightSectionProps) {
  const variantStyles = {
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border transition-colors",
          variantStyles[variant]
        )}>
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium text-sm">{title}</span>
            <Badge variant="secondary" className="text-xs">{count}</Badge>
          </div>
          <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface InlineInsightCardProps {
  title: string;
  description?: string;
  details?: string[];
  recommendation?: string;
  contactIds: string[];
  onHighlight: (contactIds: string[]) => void;
}

function InlineInsightCard({ title, description, details, recommendation, contactIds, onHighlight }: InlineInsightCardProps) {
  return (
    <div className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-sm">{title}</h4>
        {contactIds.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-xs" onClick={() => onHighlight(contactIds)}>
            <Eye className="w-3 h-3" />
            View
          </Button>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {details && details.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {details.map((detail, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-primary">•</span>
              {detail}
            </li>
          ))}
        </ul>
      )}
      {recommendation && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs">
            <span className="font-medium text-primary">Recommendation:</span>{' '}
            <span className="text-muted-foreground">{recommendation}</span>
          </p>
        </div>
      )}
    </div>
  );
}

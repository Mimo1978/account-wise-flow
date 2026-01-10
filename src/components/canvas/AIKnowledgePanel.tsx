import { useState, useRef, useEffect, useCallback } from "react";
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
  MessageSquare,
  User,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  GripVertical,
  RotateCcw
} from "lucide-react";
import { Account, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/use-draggable";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate initial position based on whether panel is open
  const getInitialPosition = (forPanel = false) => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    
    // Minimap is positioned at bottom-4 right-4 (16px each), size 200x150
    const rightOffset = 16;
    const bottomOffset = 16;
    const minimapWidth = 200;
    const minimapHeight = 150;
    const buttonWidth = 200;
    const buttonHeight = 44;
    const gapAboveMinimap = 8;
    
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
    
    // Button position: just above minimap, left-aligned with minimap's left edge
    // Minimap left edge = window.innerWidth - rightOffset - minimapWidth
    // Minimap top = window.innerHeight - bottomOffset - minimapHeight
    const minimapLeft = window.innerWidth - rightOffset - minimapWidth;
    const minimapTop = window.innerHeight - bottomOffset - minimapHeight;
    
    return {
      x: minimapLeft,
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
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
              "flex items-center gap-2 bg-primary text-primary-foreground rounded-lg shadow-lg w-[200px]",
              isDragging ? "cursor-grabbing" : ""
            )}
          >
            {/* Drag handle */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "p-2 rounded-l-lg hover:bg-primary-foreground/10 transition-colors",
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
              className="flex items-center gap-2 py-2 pr-3 flex-1"
            >
              <Brain className="w-4 h-4" />
              <span className="font-medium text-sm">AI Knowledge</span>
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
                <h3 className="font-semibold text-sm">AI Knowledge</h3>
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
              {/* Messages Area */}
              <ScrollArea className="h-[360px] p-4" ref={scrollRef}>
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
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Try asking:
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
                          <div 
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: msg.role === "assistant" 
                                ? formatResponseText(msg.content, account.contacts)
                                    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-primary">$1</strong>')
                                : msg.content
                            }}
                          />
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
          )}
        </div>
      )}
    </>
  );
}

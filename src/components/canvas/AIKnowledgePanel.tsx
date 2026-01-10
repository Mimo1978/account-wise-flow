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
  Info
} from "lucide-react";
import { Account, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  if (!isOpen) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggle}
              className="fixed bottom-44 right-4 gap-2 shadow-lg z-40"
              size="default"
            >
              <Brain className="w-4 h-4" />
              AI Knowledge
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <p className="font-medium">AI Knowledge Assistant</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask questions about your contacts, find engagement gaps, discover patterns in notes, and get insights about your account relationships.
                </p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div 
      className={cn(
        "fixed bottom-44 right-4 bg-background border border-border rounded-xl shadow-2xl transition-all duration-300 z-50",
        isMinimized ? "w-80 h-14" : "w-96 h-[500px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 rounded-t-xl">
        <div className="flex items-center gap-2">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
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
            onClick={onToggle}
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
  );
}

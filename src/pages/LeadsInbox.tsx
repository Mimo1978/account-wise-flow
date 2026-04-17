import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Globe, Mail, Linkedin, Users, Phone, MessageSquare,
  Zap, Copy, Plus, Sparkles, Reply, X,
  UserPlus, Briefcase, PhoneCall, FileText, Search,
  Calendar, Send, Ban, HelpCircle, Loader2,
} from "lucide-react";
import AddLeadModal from "@/components/leads/AddLeadModal";

interface Lead {
  id: string;
  title: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  message: string | null;
  source_channel: string | null;
  status: string;
  ai_intent: string | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  ai_draft_reply: string | null;
  created_at: string;
  responded_at: string | null;
}

const SOURCE_ICONS: Record<string, any> = {
  website: Globe,
  email: Mail,
  linkedin: Linkedin,
  referral: Users,
  phone: Phone,
};

const INTENT_PILL: Record<string, string> = {
  client_brief: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  candidate_application: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  urgent: "bg-red-500/15 text-red-700 border-red-500/30",
  unclassified: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  general_enquiry: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  referral: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  partnership: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  spam: "bg-gray-500/15 text-gray-600 border-gray-500/30",
};

const INTENT_LABELS: Record<string, string> = {
  candidate_application: "Candidate",
  client_brief: "Client brief",
  urgent: "Urgent brief",
  unclassified: "Unclassified",
  general_enquiry: "Enquiry",
  referral: "Referral",
  partnership: "Partnership",
  spam: "Spam",
};

const JARVIS_GRADIENT: Record<string, string> = {
  client_brief: "bg-gradient-to-br from-[#0C447C] to-[#185FA5]",
  candidate_application: "bg-gradient-to-br from-[#4A2A00] to-[#854F0B]",
  urgent: "bg-gradient-to-br from-[#501313] to-[#A32D2D]",
  unclassified: "bg-gradient-to-br from-[#26215C] to-[#534AB7]",
};

const getInitials = (name?: string | null, email?: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
};

export default function LeadsInbox() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    const { data } = await supabase
      .from("leads" as any)
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLeads(data as unknown as Lead[]);
    setIsLoading(false);
  }, [currentWorkspace?.id]);

  const fetchApiKey = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    const { data } = await supabase
      .from("teams")
      .select("inbound_api_key" as any)
      .eq("id", currentWorkspace.id)
      .single();
    if ((data as any)?.inbound_api_key) setApiKey((data as any).inbound_api_key);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchLeads();
    fetchApiKey();
  }, [fetchLeads, fetchApiKey]);

  useEffect(() => {
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  const markStatus = async (leadId: string, status: string) => {
    await supabase.from("leads" as any).update({ status }).eq("id", leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (selected?.id === leadId) setSelected(prev => prev ? { ...prev, status } : null);
    toast.success("Lead updated");
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-lead`;

  const filtered = useMemo(() => leads.filter(l => {
    if (filter === "new") return l.status === "new";
    if (filter === "candidates") return l.ai_intent === "candidate_application";
    if (filter === "briefs") return l.ai_intent === "client_brief" || l.ai_intent === "urgent";
    return true;
  }), [leads, filter]);

  const newCount = leads.filter(l => l.status === "new").length;
  const weekStart = startOfWeek(new Date());
  const weekCount = leads.filter(l => new Date(l.created_at) >= weekStart).length;
  const convertedCount = leads.filter(l => l.status === "converted").length;
  const conversionRate = leads.length ? Math.round((convertedCount / leads.length) * 100) : 0;

  const examplePayload = `{
  "name": "John Smith",
  "email": "john@company.com",
  "phone": "+44 7700 900000",
  "message": "We need a senior BA for a 6 month contract",
  "source": "website"
}`;

  const renderActions = (lead: Lead) => {
    const intent = lead.ai_intent || "unclassified";
    const cls = "h-auto py-3 flex flex-col items-center gap-1.5 text-xs font-medium";

    if (intent === "client_brief") {
      return (
        <>
          <Button className={cls} onClick={() => { navigate("/crm/deals"); toast.info("Create a deal for this brief"); }}>
            <Briefcase className="h-4 w-4" /> Create deal
          </Button>
          <Button variant="outline" className={cls} onClick={() => navigate("/contacts")}>
            <UserPlus className="h-4 w-4" /> Add as contact
          </Button>
          <Button variant="outline" className={cls} onClick={() => toast.info("Call logged")}>
            <PhoneCall className="h-4 w-4" /> Log a call
          </Button>
          <Button variant="outline" className={cls} onClick={() => toast.info("Ask Jarvis coming soon")}>
            <Sparkles className="h-4 w-4" /> Ask Jarvis
          </Button>
        </>
      );
    }
    if (intent === "candidate_application") {
      return (
        <>
          <Button className={cls} onClick={() => { navigate("/talent"); toast.info("Add as a candidate in Talent"); }}>
            <UserPlus className="h-4 w-4" /> Add to Talent
          </Button>
          <Button variant="outline" className={cls} onClick={() => toast.info("Screening booked")}>
            <Calendar className="h-4 w-4" /> Book screening
          </Button>
          <Button variant="outline" className={cls} onClick={() => toast.info("CV requested")}>
            <FileText className="h-4 w-4" /> Request CV
          </Button>
          <Button variant="outline" className={cls} onClick={() => markStatus(lead.id, "closed")}>
            <Ban className="h-4 w-4" /> Reject
          </Button>
        </>
      );
    }
    if (intent === "urgent") {
      return (
        <>
          <Button className={cn(cls, "bg-red-600 hover:bg-red-700 text-white")} onClick={() => lead.sender_phone && (window.location.href = `tel:${lead.sender_phone}`)}>
            <PhoneCall className="h-4 w-4" /> Call now {lead.sender_phone ? `· ${lead.sender_phone}` : ""}
          </Button>
          <Button variant="outline" className={cls} onClick={() => navigate("/crm/deals")}>
            <Briefcase className="h-4 w-4" /> Create deal
          </Button>
          <Button variant="outline" className={cls} onClick={() => { navigator.clipboard.writeText(lead.ai_draft_reply || ""); toast.success("Holding reply copied"); }}>
            <Send className="h-4 w-4" /> Send holding reply
          </Button>
          <Button variant="outline" className={cls} onClick={() => navigate("/talent")}>
            <Search className="h-4 w-4" /> Search candidates
          </Button>
        </>
      );
    }
    return (
      <>
        <Button variant="outline" className={cls} onClick={() => toast.success("Classified as client brief")}>
          <Briefcase className="h-4 w-4" /> Client brief
        </Button>
        <Button variant="outline" className={cls} onClick={() => toast.success("Classified as candidate")}>
          <UserPlus className="h-4 w-4" /> Candidate
        </Button>
        <Button className={cls} onClick={() => toast.info("Asking Jarvis to clarify…")}>
          <Sparkles className="h-4 w-4" /> Ask Jarvis to clarify
        </Button>
        <Button variant="outline" className={cls} onClick={() => markStatus(lead.id, "closed")}>
          <Ban className="h-4 w-4" /> Mark spam
        </Button>
      </>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-secondary/30">
      {/* LEFT PANEL */}
      <aside className="w-[280px] flex-shrink-0 bg-background border-r border-border flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h1 className="text-base font-semibold tracking-tight">Leads Inbox</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {newCount} unread {newCount === 1 ? "lead" : "leads"}
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 bg-secondary/50 border-b border-border">
          {[
            { label: "This week", value: weekCount },
            { label: "Converted", value: convertedCount },
            { label: "Rate", value: `${conversionRate}%` },
          ].map(s => (
            <div key={s.label} className="px-2 py-2.5 text-center border-r border-border last:border-r-0">
              <div className="text-sm font-semibold">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2.5 border-b border-border">
          {[
            { key: "all", label: "All" },
            { key: "new", label: "New" },
            { key: "briefs", label: "Briefs" },
            { key: "candidates", label: "Candidates" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex-1 px-2 py-1 text-[11px] font-medium rounded-full transition-colors",
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:bg-muted"
              )}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No leads yet</p>
            </div>
          ) : (
            filtered.map(lead => {
              const isSelected = selected?.id === lead.id;
              const isUnread = lead.status === "new";
              const intent = lead.ai_intent || "unclassified";
              return (
                <button
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-border/60 transition-colors",
                    "hover:bg-muted/50",
                    isSelected && "bg-blue-50 dark:bg-blue-950/30 border-l-[3px] border-l-blue-600",
                  )}>
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                      <span className="text-[13px] font-semibold truncate">
                        {lead.sender_name || lead.sender_email || "Unknown"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {lead.title || "—"}
                  </div>
                  <div className="text-[12px] text-muted-foreground/80 truncate mt-0.5">
                    {lead.ai_summary || lead.message || "No message"}
                  </div>
                  <div className="mt-1.5">
                    <span className={cn(
                      "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border",
                      INTENT_PILL[intent] || INTENT_PILL.unclassified
                    )}>
                      {INTENT_LABELS[intent] || "Unclassified"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          /* Setup card centered */
          <div className="min-h-full flex items-center justify-center p-8">
            <div className="w-full max-w-2xl bg-background rounded-xl border border-border shadow-sm p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Connect your inbound channels</h2>
                  <p className="text-xs text-muted-foreground">Auto-classified by Jarvis within 90 seconds</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-6 mt-4">
                Add this webhook to your website contact form or email forwarding rule.
              </p>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Webhook URL</p>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono break-all">{webhookUrl}</code>
                    <Button size="icon" variant="outline" onClick={() => copyText(webhookUrl, "Webhook URL")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                    Workspace API key (x-workspace-key header)
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono break-all">
                      {apiKey || "Loading…"}
                    </code>
                    <Button size="icon" variant="outline" onClick={() => copyText(apiKey, "API key")} disabled={!apiKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Example POST body</p>
                  <pre className="px-3 py-2 bg-muted rounded-md text-xs font-mono overflow-x-auto">{examplePayload}</pre>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Sources supported</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Globe, label: "Website form" },
                      { icon: Mail, label: "Email forwarding" },
                      { icon: Linkedin, label: "LinkedIn (manual)" },
                      { icon: Phone, label: "Phone referral" },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-xs">
                        <s.icon className="h-3.5 w-3.5 text-muted-foreground" /> {s.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4 max-w-4xl mx-auto">
            {/* TOP BAR */}
            <div className="flex items-center justify-between gap-4 bg-background rounded-xl border border-border p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                  {getInitials(selected.sender_name, selected.sender_email)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold truncate">{selected.sender_name || "Unknown sender"}</h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {selected.title || "—"}
                    {selected.sender_email && <> · {selected.sender_email}</>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => markStatus(selected.id, "converted")}>
                  Convert
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  navigator.clipboard.writeText(selected.ai_draft_reply || "");
                  toast.success("Reply copied");
                }}>
                  <Reply className="h-3.5 w-3.5 mr-1" /> Reply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => markStatus(selected.id, "closed")}>
                  <X className="h-3.5 w-3.5 mr-1" /> Close
                </Button>
              </div>
            </div>

            {/* JARVIS ANALYSIS */}
            <div className={cn(
              "rounded-xl p-5 text-white shadow-lg",
              JARVIS_GRADIENT[selected.ai_intent || "unclassified"] || JARVIS_GRADIENT.unclassified
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-3.5 w-3.5 text-white/80" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                  Jarvis analysis
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/95">
                {selected.ai_summary || "Jarvis is analysing this lead…"}
              </p>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/15">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/15 text-white">
                  {INTENT_LABELS[selected.ai_intent || "unclassified"] || "Unclassified"}
                </span>
                {selected.ai_sentiment && (
                  <span className="text-[11px] text-white/70 capitalize">
                    {selected.ai_sentiment} sentiment
                  </span>
                )}
              </div>
            </div>

            {/* LEAD DETAILS */}
            <div className="bg-background rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Lead details</h3>
              </div>
              <dl className="divide-y divide-border">
                {[
                  { label: "Source", value: selected.source_channel || "—" },
                  { label: "Received", value: format(new Date(selected.created_at), "dd MMM yyyy 'at' HH:mm") },
                  { label: "Phone", value: selected.sender_phone || "—" },
                  { label: "Email", value: selected.sender_email || "—" },
                  { label: "Message", value: selected.message || "—" },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-3 text-sm">
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{row.label}</dt>
                    <dd className="text-foreground whitespace-pre-wrap break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* ACTIONS */}
            <div className="bg-background rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">What would you like to do?</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {renderActions(selected)}
              </div>
            </div>
          </div>
        )}
      </main>
      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} onCreated={fetchLeads} />
    </div>
  );
}

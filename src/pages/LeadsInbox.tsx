import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CMOrbital } from "@/components/ui/CMLoader";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Globe, Mail, Linkedin, Users, Phone, MessageSquare,
  CheckCircle2, Clock, AlertTriangle, Zap, Copy,
  RefreshCw, Plus, Send, UserPlus, Briefcase
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  title: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  message: string | null;
  source_channel: string;
  status: string;
  ai_intent: string | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  ai_draft_reply: string | null;
  notes: string | null;
  created_at: string;
  responded_at: string | null;
}

const SOURCE_ICONS: Record<string, any> = {
  website: Globe,
  email: Mail,
  linkedin: Linkedin,
  referral: Users,
  phone: Phone,
  manual: MessageSquare,
};

const INTENT_COLORS: Record<string, string> = {
  candidate_application: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  client_brief: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  general_enquiry: "bg-muted text-muted-foreground border-border",
  referral: "bg-green-500/15 text-green-700 border-green-500/30",
  partnership: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  spam: "bg-destructive/15 text-destructive border-destructive/30",
};

const INTENT_LABELS: Record<string, string> = {
  candidate_application: "Candidate",
  client_brief: "Client brief",
  general_enquiry: "Enquiry",
  referral: "Referral",
  partnership: "Partnership",
  spam: "Spam",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "New", color: "bg-amber-500/20 text-amber-700", icon: Zap },
  acknowledged: { label: "Acknowledged", color: "bg-blue-500/20 text-blue-700", icon: Send },
  in_progress: { label: "In progress", color: "bg-primary/20 text-primary", icon: Clock },
  converted: { label: "Converted", color: "bg-green-500/20 text-green-700", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
};

export default function LeadsInbox() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [filter, setFilter] = useState<"all" | "new" | "candidate_application" | "client_brief">("all");

  const fetchLeads = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    const { data } = await supabase
      .from("leads")
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
      .select("inbound_api_key")
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
    await supabase.from("leads").update({ status }).eq("id", leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
    if (selected?.id === leadId) setSelected(prev => prev ? { ...prev, status } : null);
    toast.success("Lead updated");
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied");
  };

  const copyWebhookUrl = () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-lead`;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied");
  };

  const filtered = leads.filter(l => {
    if (filter === "new") return l.status === "new";
    if (filter === "candidate_application") return l.ai_intent === "candidate_application";
    if (filter === "client_brief") return l.ai_intent === "client_brief";
    return true;
  });

  const newCount = leads.filter(l => l.status === "new").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <CMOrbital size={64} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">Leads Inbox</h1>
              {newCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                  {newCount} new
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inbound enquiries from your website, email, and other sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLeads} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-3">
          {[
            { key: "all", label: `All (${leads.length})` },
            { key: "new", label: `New (${newCount})` },
            { key: "candidate_application", label: "Candidates" },
            { key: "client_brief", label: "Client briefs" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Webhook setup banner */}
      {leads.length === 0 && (
        <div className="mx-6 mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/15 p-2">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Connect your inbound channels</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add this webhook to your website contact form, email forwarding rule, or LinkedIn. Every enquiry arrives here and Jarvis responds within 90 seconds.
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 font-mono truncate">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/inbound-lead
                  </code>
                  <Button size="sm" variant="outline" onClick={copyWebhookUrl} className="gap-1.5">
                    <Copy className="h-3 w-3" /> Copy URL
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 font-mono truncate">
                    x-workspace-key: {apiKey ? apiKey.slice(0, 8) + "••••••••••••••••••••••••" : "loading..."}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyApiKey} className="gap-1.5">
                    <Copy className="h-3 w-3" /> Copy key
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main split view */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] overflow-hidden">
        {/* Lead list */}
        <div className="border-r border-border overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No leads yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your website or email to start receiving inbound leads
              </p>
            </div>
          ) : (
            filtered.map(lead => {
              const SourceIcon = SOURCE_ICONS[lead.source_channel] || MessageSquare;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className={cn(
                    "px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/40 transition-colors",
                    selected?.id === lead.id && "bg-primary/5 border-l-2 border-l-primary",
                    lead.status === "new" && "bg-amber-500/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2 mt-0.5">
                      <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {lead.sender_name || lead.sender_email || "Unknown"}
                        </p>
                        {lead.status === "new" && (
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      {lead.ai_summary ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{lead.ai_summary}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{lead.message?.slice(0, 80)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {lead.ai_intent && (
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", INTENT_COLORS[lead.ai_intent])}>
                            {INTENT_LABELS[lead.ai_intent] || lead.ai_intent}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Lead detail */}
        <div className="overflow-y-auto bg-background">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Select a lead to view details</p>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-3xl">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-foreground">
                    {selected.sender_name || "Unknown sender"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {selected.sender_email && <span>{selected.sender_email}</span>}
                    {selected.sender_phone && <span>{selected.sender_phone}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Received {format(new Date(selected.created_at), "dd MMM yyyy 'at' HH:mm")}
                    {" · "}via {selected.source_channel}
                  </div>
                </div>
                <Badge className={STATUS_CONFIG[selected.status]?.color}>
                  {STATUS_CONFIG[selected.status]?.label || selected.status}
                </Badge>
              </div>

              {/* AI classification */}
              {selected.ai_intent && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium text-foreground">Jarvis analysis</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={INTENT_COLORS[selected.ai_intent]}>
                      {INTENT_LABELS[selected.ai_intent] || selected.ai_intent}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">
                      {selected.ai_sentiment} sentiment
                    </Badge>
                  </div>
                  {selected.ai_summary && (
                    <p className="text-sm text-foreground">{selected.ai_summary}</p>
                  )}
                </div>
              )}

              {/* Original message */}
              {selected.message && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-medium text-foreground mb-2">Original message</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.message}</p>
                </div>
              )}

              {/* Draft reply */}
              {selected.ai_draft_reply && selected.ai_intent !== "spam" && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <h3 className="text-sm font-medium text-foreground mb-2">Jarvis draft reply</h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selected.ai_draft_reply}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(selected.ai_draft_reply || "");
                      toast.success("Draft copied to clipboard");
                    }} className="gap-1.5">
                      <Copy className="h-3 w-3" /> Copy reply
                    </Button>
                    {selected.responded_at && (
                      <span className="text-xs text-green-600">
                        ✓ Auto-acknowledged {formatDistanceToNow(new Date(selected.responded_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Actions</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.ai_intent === "candidate_application" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      navigate("/talent");
                      toast.info("Add this person as a candidate in Talent");
                    }} className="gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" /> Add as candidate
                    </Button>
                  )}
                  {selected.ai_intent === "client_brief" && (
                    <Button size="sm" variant="outline" onClick={() => {
                      navigate("/crm/deals");
                      toast.info("Create a deal for this client brief");
                    }} className="gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" /> Create deal
                    </Button>
                  )}
                  {selected.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => markStatus(selected.id, "in_progress")} className="gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Mark in progress
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => markStatus(selected.id, "converted")} className="gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark converted
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => markStatus(selected.id, "closed")}>
                    Close lead
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

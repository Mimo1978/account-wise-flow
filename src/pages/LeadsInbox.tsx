import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Globe, Mail, Linkedin, Users, Phone, MessageSquare,
  CheckCircle2, Clock, Zap, Copy,
  RefreshCw, UserPlus, Briefcase, Loader2
} from "lucide-react";

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

const INTENT_COLORS: Record<string, string> = {
  candidate_application: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  client_brief: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  general_enquiry: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  referral: "bg-green-500/15 text-green-700 border-green-500/30",
  partnership: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  spam: "bg-red-500/15 text-red-600 border-red-500/30",
};

const INTENT_LABELS: Record<string, string> = {
  candidate_application: "Candidate",
  client_brief: "Client brief",
  general_enquiry: "Enquiry",
  referral: "Referral",
  partnership: "Partnership",
  spam: "Spam",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-amber-500/20 text-amber-700" },
  acknowledged: { label: "Acknowledged", color: "bg-blue-500/20 text-blue-700" },
  in_progress: { label: "In progress", color: "bg-primary/20 text-primary" },
  converted: { label: "Converted", color: "bg-green-500/20 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-500/20 text-gray-600" },
};

export default function LeadsInbox() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [filter, setFilter] = useState<string>("all");

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

  const filtered = leads.filter(l => {
    if (filter === "new") return l.status === "new";
    if (filter === "candidates") return l.ai_intent === "candidate_application";
    if (filter === "clients") return l.ai_intent === "client_brief";
    return true;
  });

  const newCount = leads.filter(l => l.status === "new").length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Leads Inbox</h1>
            {newCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">
                {newCount} new
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchLeads} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="flex items-center gap-1 mt-4">
          {[
            { key: "all", label: `All (${leads.length})` },
            { key: "new", label: `New (${newCount})` },
            { key: "candidates", label: "Candidates" },
            { key: "clients", label: "Client briefs" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md font-medium transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-[380px] border-r border-border overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">No leads yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect your website or email to start receiving inbound leads automatically
              </p>
            </div>
          ) : (
            filtered.map(lead => {
              const SourceIcon = SOURCE_ICONS[lead.source_channel || ""] || MessageSquare;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className={cn(
                    "px-4 py-3 border-b border-border cursor-pointer hover:bg-muted/40 transition-colors",
                    selected?.id === lead.id && "bg-primary/5 border-l-2 border-l-primary",
                    lead.status === "new" && "bg-amber-500/5"
                  )}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {lead.sender_name || lead.sender_email || "Unknown"}
                        </p>
                        {lead.status === "new" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {lead.ai_summary || lead.message?.slice(0, 70) || lead.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {lead.ai_intent && (
                          <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded border", INTENT_COLORS[lead.ai_intent] || INTENT_COLORS.general_enquiry)}>
                            {INTENT_LABELS[lead.ai_intent] || lead.ai_intent}
                          </span>
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

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="p-8 max-w-2xl">
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Connect your inbound channels</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Add this webhook to your website contact form or email forwarding rule.
                  Every enquiry is classified by Jarvis and a reply drafted within 90 seconds.
                </p>

                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Webhook URL</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md font-mono truncate">
                        {webhookUrl}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyText(webhookUrl, "Webhook URL")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Your workspace API key (x-workspace-key header)</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md font-mono truncate">
                        {apiKey || "Loading..."}
                      </code>
                      <Button variant="outline" size="sm" onClick={() => copyText(apiKey, "API key")} disabled={!apiKey}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Example POST body</p>
                    <pre className="px-3 py-2 text-xs bg-muted rounded-md font-mono overflow-x-auto">{`{
  "name": "John Smith",
  "email": "john@company.com",
  "phone": "+44 7700 900000",
  "message": "We need a senior BA for a 6 month contract",
  "source": "website"
}`}</pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Sources supported</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: Globe, label: "Website form" },
                        { icon: Mail, label: "Email forwarding" },
                        { icon: Linkedin, label: "LinkedIn (manual)" },
                        { icon: Phone, label: "Phone referral" },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs">
                          <s.icon className="h-3.5 w-3.5 text-muted-foreground" /> {s.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-6">
                Select a lead from the list to view details and Jarvis analysis
              </p>
            </div>
          ) : (
            <div className="p-6 max-w-3xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {selected.sender_name || "Unknown sender"}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    {selected.sender_email && <span>{selected.sender_email}</span>}
                    {selected.sender_phone && <span>{selected.sender_phone}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(selected.created_at), "dd MMM yyyy 'at' HH:mm")}
                    {selected.source_channel && ` · via ${selected.source_channel}`}
                  </p>
                </div>
                <span className={cn("px-2 py-1 text-xs font-medium rounded-md shrink-0", STATUS_CONFIG[selected.status]?.color || "bg-muted text-muted-foreground")}>
                  {STATUS_CONFIG[selected.status]?.label || selected.status}
                </span>
              </div>

              {selected.ai_summary && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-sm font-semibold">Jarvis analysis</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {selected.ai_intent && (
                      <span className={cn("px-2 py-0.5 text-xs font-medium rounded border", INTENT_COLORS[selected.ai_intent] || INTENT_COLORS.general_enquiry)}>
                        {INTENT_LABELS[selected.ai_intent] || selected.ai_intent}
                      </span>
                    )}
                    {selected.ai_sentiment && (
                      <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground capitalize">
                        {selected.ai_sentiment} sentiment
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/90">{selected.ai_summary}</p>
                </div>
              )}

              {selected.message && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Message</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
                </div>
              )}

              {selected.ai_draft_reply && selected.ai_intent !== "spam" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-medium text-primary mb-2">Jarvis draft reply</p>
                  <p className="text-sm whitespace-pre-wrap mb-3">{selected.ai_draft_reply}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(selected.ai_draft_reply || "");
                      toast.success("Reply copied");
                    }}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy reply
                    </Button>
                    {selected.responded_at && (
                      <span className="text-xs text-green-700">
                        ✓ Auto-sent {formatDistanceToNow(new Date(selected.responded_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selected.ai_intent === "candidate_application" && (
                    <Button size="sm" variant="outline" onClick={() => { navigate("/talent"); toast.info("Add as a candidate in Talent"); }}>
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add as candidate
                    </Button>
                  )}
                  {selected.ai_intent === "client_brief" && (
                    <Button size="sm" variant="outline" onClick={() => { navigate("/crm/deals"); toast.info("Create a deal for this brief"); }}>
                      <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Create deal
                    </Button>
                  )}
                  {selected.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => markStatus(selected.id, "in_progress")}>
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> Mark in progress
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => markStatus(selected.id, "converted")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark converted
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => markStatus(selected.id, "closed")}>
                    Close
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

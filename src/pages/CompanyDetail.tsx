import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft, Building2, Globe, MapPin, Phone, Users, Network,
  Pencil, Plus, TrendingUp, User, Mail, Clock, FileText, Activity,
  ChevronDown, ExternalLink, DollarSign, Calendar, StickyNote,
  AlertTriangle, CheckCircle2, AlertCircle, Star, Info,
  Loader2,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/* ─── helpers ─── */
const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
};

const STATUS_OPTIONS = [
  { value: "cold", label: "Cold", color: "bg-muted text-muted-foreground" },
  { value: "warm", label: "Warm", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "hot", label: "Hot", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "client", label: "Client", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "prospect", label: "Prospect", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "dormant", label: "Dormant", color: "bg-muted text-muted-foreground italic" },
  // Legacy mapping
  { value: "active", label: "Active", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "cooling", label: "Cooling", color: "bg-muted text-muted-foreground" },
];

const getStatusConfig = (s?: string) => STATUS_OPTIONS.find(o => o.value === s) || STATUS_OPTIONS[0];

const INDUSTRY_OPTIONS = [
  "Technology", "Financial Services", "Healthcare", "Manufacturing",
  "Retail", "Professional Services", "Consulting", "Energy",
  "Telecommunications", "Education", "Real Estate", "Media", "Other",
];

/* ─── page ─── */
export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [logActivityType, setLogActivityType] = useState<string>("call");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);

  // ── Fetch raw company from `companies` table ──
  const { data: rawCompany, isLoading } = useQuery({
    queryKey: ["companies", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  // ── Fetch contacts ──
  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id)
        .is("deleted_at", null)
        .order("name");
      if (error) return [];
      return (data || []).map((c: any): Contact => ({
        id: c.id,
        name: c.name,
        title: c.title || "",
        department: c.department || "",
        seniority: c.seniority || "mid",
        email: c.email || "",
        phone: c.phone || "",
        status: (c.status as Contact["status"]) || "new",
        engagementScore: 50,
        location: c.location,
        lastContact: c.updated_at,
      }));
    },
    enabled: !!id,
  });

  // ── Fetch workspace users for owner assignment ──
  const { data: workspaceUsers = [] } = useQuery({
    queryKey: ["workspace-users", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return [];
      const { data, error } = await supabase
        .from("user_roles" as any)
        .select("user_id, role")
        .eq("team_id", currentWorkspace.id);
      if (error) return [];
      const userIds = (data || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles" as any)
        .select("id, first_name, last_name")
        .in("id", userIds);
      return (profiles || []).map((p: any) => ({
        id: p.id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "User",
      }));
    },
    enabled: !!currentWorkspace?.id,
  });

  // ── Fetch deals (crm_deals where company_id matches) ──
  const { data: deals = [] } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("crm_deals" as any)
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  // ── Fetch projects ──
  const { data: projects = [] } = useQuery({
    queryKey: ["company-projects", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("crm_projects" as any)
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  // ── Fetch invoices ──
  const { data: invoices = [] } = useQuery({
    queryKey: ["company-invoices", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("crm_invoices" as any)
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  // ── Fetch activities ──
  const { data: activities = [] } = useQuery({
    queryKey: ["company-activities", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("crm_activities" as any)
        .select("*")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return data || [];
    },
    enabled: !!id,
  });

  // ── Mutations ──
  const updateCompany = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (!id) throw new Error("No company id");
      const { error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", id] });
    },
  });

  // ── Inline field edit ──
  const handleInlineUpdate = useCallback(async (field: string, value: string) => {
    try {
      await updateCompany.mutateAsync({ [field]: value || null });
      toast({ title: "Updated", description: `${field} saved.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [updateCompany]);

  // ── Status change ──
  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCompany.mutateAsync({ relationship_status: newStatus });
      setStatusPopoverOpen(false);
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Owner assignment ──
  const handleOwnerAssign = async (userId: string, userName: string) => {
    try {
      await updateCompany.mutateAsync({ account_manager: userName, owner_id: userId });
      setOwnerPopoverOpen(false);
      toast({ title: "Account owner assigned", description: userName });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading company…</div>;
  }
  if (!rawCompany) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Company not found</div>;
  }

  const company = rawCompany;
  const statusConfig = getStatusConfig(company.relationship_status);
  const ownerName = company.account_manager || null;
  const openDealsValue = (deals as any[])
    .filter((d: any) => d.status === "active")
    .reduce((sum: number, d: any) => sum + (d.value || 0), 0);

  // ── Coverage score ──
  const departmentMap = new Map<string, { count: number; hasExec: boolean }>();
  contacts.forEach(c => {
    const dept = c.department || "Other";
    const existing = departmentMap.get(dept) || { count: 0, hasExec: false };
    existing.count += 1;
    if (c.seniority === "executive" || c.seniority === "director") existing.hasExec = true;
    departmentMap.set(dept, existing);
  });
  const departments = Array.from(departmentMap.entries());
  const executiveCount = contacts.filter(c => c.seniority === "executive" || c.seniority === "director").length;
  const championCount = contacts.filter(c => c.status === "champion").length;
  const coverageScore = Math.min(100, Math.max(0,
    (departments.length * 15) + (executiveCount * 20) + (championCount * 25)
  ));
  const coverageColor = coverageScore >= 70 ? "text-green-600" : coverageScore >= 40 ? "text-amber-600" : "text-red-600";
  const coverageStroke = coverageScore >= 70 ? "stroke-green-500" : coverageScore >= 40 ? "stroke-amber-500" : "stroke-red-500";

  // ── AI insights ──
  const insights: { type: "success" | "warning" | "info"; text: string }[] = [];
  if (executiveCount === 0) insights.push({ type: "warning", text: "No executive sponsor identified" });
  else insights.push({ type: "success", text: `${executiveCount} executive-level relationship${executiveCount > 1 ? "s" : ""} established` });
  if (departments.length >= 3) {
    const topDept = departments.sort((a, b) => b[1].count - a[1].count)[0];
    insights.push({ type: "info", text: `${topDept[0]} has ${topDept[1].count} contacts — strong coverage` });
  }
  if (departments.length < 2) insights.push({ type: "warning", text: "Limited departmental coverage — expand across functions" });
  if (championCount > 0) insights.push({ type: "success", text: `${championCount} identified champion${championCount > 1 ? "s" : ""}` });

  return (
    <div className="bg-background min-h-screen">
      {/* ─── HEADER BAR ─── */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 space-y-4">
          {/* Row 1: back + name + status + edit */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
              <ChevronLeft className="h-4 w-4" /> Companies
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">{company.name}</h1>
                {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                {/* FIX 7 — clickable status badge */}
                <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      data-jarvis-id="company-status-badge"
                      className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors hover:opacity-80", statusConfig.color)}
                    >
                      {statusConfig.label}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="start">
                    {STATUS_OPTIONS.filter(o => !["active", "cooling"].includes(o.value)).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(opt.value)}
                        className={cn("w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2", opt.value === company.relationship_status && "bg-muted")}
                      >
                        <span className={cn("w-2 h-2 rounded-full", opt.color.split(" ")[0])} />
                        {opt.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
              {company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <Globe className="h-3 w-3" />{company.website}
                </a>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-jarvis-id="company-edit-button">
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          </div>

          {/* Row 2: quick-stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <QuickStat icon={TrendingUp} label="Engagement Score" value={`${company.engagement_score || 50}%`} />
            <QuickStat icon={Users} label="Total Contacts" value={String(contacts.length)} />
            <QuickStat icon={Clock} label="Last Activity" value={fmtDate(company.updated_at)} />
            {/* Account Lead — assignable */}
            <Card className="cursor-pointer" onClick={() => setOwnerPopoverOpen(true)} data-jarvis-id="company-assign-owner">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {ownerName ? (
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{ownerName.split(" ").map(n => n[0]).join("").slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ownerName || "Unassigned"}</p>
                  <p className="text-xs text-muted-foreground">Account Lead</p>
                </div>
              </CardContent>
            </Card>
            {/* Open Deals pipeline */}
            <QuickStat icon={DollarSign} label="Pipeline" value={openDealsValue > 0 ? `£${openDealsValue.toLocaleString()}` : "£0"} />
          </div>

          {/* Owner assignment popover */}
          <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
            <PopoverTrigger asChild><span /></PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground">Assign Account Owner</p>
              {workspaceUsers.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => handleOwnerAssign(u.id, u.name)}
                  className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[10px]">{u.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {u.name}
                </button>
              ))}
              {workspaceUsers.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No workspace users found</p>}
            </PopoverContent>
          </Popover>

          {/* FIX 3 — ACTION BAR (replaces three-dots menu) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)} data-jarvis-id="company-add-contact-button">
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
            <Button size="sm" onClick={() => navigate(`/crm/deals?company=${id}`)} data-jarvis-id="company-add-deal-button">
              <Plus className="h-4 w-4 mr-1" /> Add Deal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-jarvis-id="company-log-activity-button">
                  <Plus className="h-4 w-4 mr-1" /> Log Activity <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => { setLogActivityType("call"); setLogActivityOpen(true); }}>
                  <Phone className="h-4 w-4 mr-2" /> Log Call
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("email"); setLogActivityOpen(true); }}>
                  <Mail className="h-4 w-4 mr-2" /> Send Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("meeting"); setLogActivityOpen(true); }}>
                  <Calendar className="h-4 w-4 mr-2" /> Schedule Meeting
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setLogActivityType("note"); setLogActivityOpen(true); }}>
                  <StickyNote className="h-4 w-4 mr-2" /> Add Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => navigate(`/canvas?company=${id}`)} data-jarvis-id="company-open-canvas-button">
              <Network className="h-4 w-4 mr-1" /> Open on Canvas
            </Button>
          </div>
        </div>
      </div>

      {/* ─── BODY: full-width tabs ─── */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="overview" data-jarvis-id="company-tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts" data-jarvis-id="company-tab-contacts">Contacts ({contacts.length})</TabsTrigger>
            <TabsTrigger value="deals" data-jarvis-id="company-tab-deals">Deals ({(deals as any[]).length})</TabsTrigger>
            <TabsTrigger value="projects" data-jarvis-id="company-tab-projects">Projects ({(projects as any[]).length})</TabsTrigger>
            <TabsTrigger value="documents" data-jarvis-id="company-tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="activity" data-jarvis-id="company-tab-activity">Activity</TabsTrigger>
            <TabsTrigger value="canvas" data-jarvis-id="company-tab-canvas">Canvas</TabsTrigger>
            <TabsTrigger value="invoices" data-jarvis-id="company-tab-invoices">Invoices ({(invoices as any[]).length})</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview">
            <div className="flex gap-6 items-start">
              {/* Zone A — Company Intelligence (65%) */}
              <div className="flex-1 min-w-0 space-y-5" style={{ flex: "0 0 65%" }}>
                {/* Coverage Score — arc gauge */}
                <Card data-jarvis-id="company-coverage-score">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-5">
                      <div className="relative h-20 w-20 shrink-0">
                        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none" strokeWidth="3" strokeDasharray={`${coverageScore}, 100`}
                            strokeLinecap="round" className={coverageStroke}
                          />
                        </svg>
                        <span className={cn("absolute inset-0 flex items-center justify-center text-lg font-bold", coverageColor)}>
                          {coverageScore}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">Coverage Score</p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                Coverage improves by adding contacts across departments, logging calls, and assigning an executive sponsor.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {/* Department tags */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {departments.map(([name, data]) => (
                            <Badge key={name} variant="secondary" className={cn("text-xs", data.hasExec && "bg-primary/10 text-primary")}>
                              {name} ({data.count})
                            </Badge>
                          ))}
                          {departments.length === 0 && <span className="text-xs text-muted-foreground">No departments mapped</span>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Insights */}
                <div className="space-y-2" data-jarvis-id="company-ai-insights">
                  <p className="text-sm font-semibold">AI Insights</p>
                  {insights.map((ins, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-start gap-2.5 p-3 rounded-lg text-sm bg-card border-l-[3px]",
                        ins.type === "warning" && "border-l-amber-500",
                        ins.type === "info" && "border-l-blue-500",
                        ins.type === "success" && "border-l-green-500",
                      )}
                    >
                      {ins.type === "success" && <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />}
                      {ins.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                      {ins.type === "info" && <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />}
                      <span className="text-foreground">{ins.text}</span>
                    </div>
                  ))}
                </div>

                {/* Active Engagements */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Active Engagements</p>
                  {(deals as any[]).length === 0 && (projects as any[]).length === 0 ? (
                    <div className="border border-dashed border-border rounded-lg p-4 text-center max-h-[120px] flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">No active engagements. Add a deal or project to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {(deals as any[]).slice(0, 3).map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-sm">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{d.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">£{(d.value || 0).toLocaleString()}</span>
                            <Badge variant="secondary" className="text-xs capitalize">{d.status}</Badge>
                          </div>
                        </div>
                      ))}
                      {(projects as any[]).slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{p.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Zone B — Company Details (35%) */}
              <div className="w-80 shrink-0 hidden lg:block">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-3">
                    <InlineField label="Website" value={company.website} field="website" onSave={handleInlineUpdate} isLink />
                    <InlineField label="Switchboard" value={company.switchboard} field="switchboard" onSave={handleInlineUpdate} />
                    <InlineField label="HQ Location" value={company.headquarters} field="headquarters" onSave={handleInlineUpdate} />
                    <InlineField label="Industry" value={company.industry} field="industry" onSave={handleInlineUpdate} />
                    <InlineField label="Company Size" value={company.size} field="size" onSave={handleInlineUpdate} />
                    <InlineField label="LinkedIn" value={(company as any).linkedin_url} field="linkedin_url" onSave={handleInlineUpdate} isLink />
                    <div className="flex items-start gap-2 py-1">
                      <span className="text-muted-foreground w-24 shrink-0">Account Owner</span>
                      <button onClick={() => setOwnerPopoverOpen(true)} className="text-foreground hover:underline text-left">
                        {ownerName || <span className="text-muted-foreground">Unassigned</span>}
                      </button>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Created: {fmtDate(company.created_at)}</p>
                      <p>Updated: {fmtDate(company.updated_at)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ─── CONTACTS TAB ─── */}
          <TabsContent value="contacts">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{contacts.length} contacts at {company.name}</p>
                <Button size="sm" variant="outline" onClick={() => setAddContactOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Contact
                </Button>
              </div>
              {contacts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-3">No contacts yet. Add the first contact at {company.name}.</p>
                    <Button size="sm" onClick={() => setAddContactOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Contact
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Name</th>
                          <th className="p-3 font-medium">Title</th>
                          <th className="p-3 font-medium">Department</th>
                          <th className="p-3 font-medium">Email</th>
                          <th className="p-3 font-medium">Phone</th>
                          <th className="p-3 font-medium">Last Activity</th>
                          <th className="p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map(c => (
                          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                            <td className="p-3 font-medium">{c.name}</td>
                            <td className="p-3 text-muted-foreground">{c.title || "—"}</td>
                            <td className="p-3 text-muted-foreground">{c.department || "—"}</td>
                            <td className="p-3 text-muted-foreground truncate max-w-[180px]">{c.email || "—"}</td>
                            <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                            <td className="p-3 text-muted-foreground">{fmtDate(c.lastContact)}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLogActivityType("call"); setLogActivityOpen(true); }}>Call</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLogActivityType("email"); setLogActivityOpen(true); }}>Email</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/contacts?highlight=${c.id}`)}>View</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ─── DEALS TAB ─── */}
          <TabsContent value="deals">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(deals as any[]).length} deals</p>
                <Button size="sm" onClick={() => navigate(`/crm/deals`)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Deal
                </Button>
              </div>
              {(deals as any[]).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <DollarSign className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground mb-3">No deals yet.</p>
                    <Button size="sm" onClick={() => navigate(`/crm/deals`)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Deal
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Deal Name</th>
                          <th className="p-3 font-medium">Value</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Start Date</th>
                          <th className="p-3 font-medium">Days Open</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(deals as any[]).map((d: any) => (
                          <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/crm/deals/${d.id}`)}>
                            <td className="p-3 font-medium">{d.title}</td>
                            <td className="p-3">£{(d.value || 0).toLocaleString()}</td>
                            <td className="p-3">
                              <Badge variant="secondary" className={cn("text-xs capitalize",
                                d.status === "active" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                                d.status === "complete" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                                d.status === "cancelled" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                              )}>
                                {d.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">{fmtDate(d.start_date)}</td>
                            <td className="p-3 text-muted-foreground">
                              {d.created_at ? differenceInDays(new Date(), parseISO(d.created_at)) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ─── PROJECTS TAB ─── */}
          <TabsContent value="projects">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(projects as any[]).length} projects</p>
                <Button size="sm" variant="outline" onClick={() => navigate(`/crm/projects`)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Project
                </Button>
              </div>
              {(projects as any[]).length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No projects linked yet.</CardContent></Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Project Name</th>
                          <th className="p-3 font-medium">Type</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Budget</th>
                          <th className="p-3 font-medium">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(projects as any[]).map((p: any) => (
                          <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/crm/projects/${p.id}`)}>
                            <td className="p-3 font-medium">{p.name}</td>
                            <td className="p-3 text-muted-foreground">{p.project_type || "—"}</td>
                            <td className="p-3"><Badge variant="secondary" className="text-xs capitalize">{p.status}</Badge></td>
                            <td className="p-3 text-muted-foreground">{p.budget ? `£${p.budget.toLocaleString()}` : "—"}</td>
                            <td className="p-3 text-muted-foreground">{fmtDate(p.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ─── DOCUMENTS TAB ─── */}
          <TabsContent value="documents">
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground mb-3">No documents uploaded yet. SOWs, contracts and proposals will appear here.</p>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Upload Document
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── ACTIVITY TAB ─── */}
          <TabsContent value="activity">
            <ActivityTimeline activities={activities as any[]} />
          </TabsContent>

          {/* ─── CANVAS TAB ─── */}
          <TabsContent value="canvas">
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Network className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">View {company.name}'s org chart and relationship map on the Canvas.</p>
                <Button onClick={() => navigate(`/canvas?company=${id}`)} className="gap-2">
                  <Network className="h-4 w-4" /> Open on Canvas
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── INVOICES TAB ─── */}
          <TabsContent value="invoices">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{(invoices as any[]).length} invoices</p>
                <Button size="sm" variant="outline" onClick={() => navigate(`/crm/invoices`)}>
                  <Plus className="h-4 w-4 mr-1" /> Create Invoice
                </Button>
              </div>
              {(invoices as any[]).length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No invoices linked yet.</CardContent></Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Invoice #</th>
                          <th className="p-3 font-medium">Amount</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium">Due Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoices as any[]).map((inv: any) => (
                          <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/crm/invoices/${inv.id}`)}>
                            <td className="p-3 font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</td>
                            <td className="p-3">£{(inv.total || 0).toLocaleString()}</td>
                            <td className="p-3">
                              <Badge variant="secondary" className={cn("text-xs capitalize",
                                inv.status === "paid" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                                inv.status === "overdue" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                                inv.status === "sent" && "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                              )}>
                                {inv.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── EDIT COMPANY PANEL (FIX 1) ─── */}
      <EditCompanyPanel
        open={editOpen}
        onOpenChange={setEditOpen}
        company={rawCompany}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["companies", id] });
          setEditOpen(false);
        }}
      />

      {/* Add Contact — simple dialog */}
      {addContactOpen && (
        <AddContactDialog
          open={addContactOpen}
          onOpenChange={setAddContactOpen}
          companyId={id!}
          companyName={company.name}
          onAdded={() => {
            queryClient.invalidateQueries({ queryKey: ["company-contacts", id] });
            setAddContactOpen(false);
          }}
        />
      )}

      {/* Log Activity — simple dialog */}
      {logActivityOpen && (
        <LogActivityDialog
          open={logActivityOpen}
          onOpenChange={setLogActivityOpen}
          companyId={id!}
          defaultType={logActivityType}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function QuickStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Inline editable field ─── */
function InlineField({ label, value, field, onSave, isLink }: {
  label: string;
  value?: string | null;
  field: string;
  onSave: (field: string, value: string) => void;
  isLink?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setEditVal(value || "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing]);

  const save = () => {
    if (editVal !== (value || "")) onSave(field, editVal);
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-muted-foreground w-24 shrink-0 text-xs pt-0.5">{label}</span>
      {editing ? (
        <Input
          ref={inputRef}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 text-sm"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="text-left text-foreground hover:underline min-h-[20px]">
          {value ? (
            isLink ? (
              <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
                onClick={e => e.stopPropagation()}>
                {value.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
              </a>
            ) : value
          ) : (
            <span className="text-muted-foreground italic">—</span>
          )}
        </button>
      )}
    </div>
  );
}

/* ─── Activity Timeline ─── */
function ActivityTimeline({ activities }: { activities: any[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? activities : activities.filter((a: any) => a.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case "call": return <Phone className="h-3.5 w-3.5" />;
      case "email": return <Mail className="h-3.5 w-3.5" />;
      case "meeting": return <Calendar className="h-3.5 w-3.5" />;
      case "note": return <StickyNote className="h-3.5 w-3.5" />;
      default: return <Activity className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "call", "email", "meeting", "note"].map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="text-xs capitalize" onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f + "s"}
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            No activity recorded yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card text-sm">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                {getIcon(a.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{a.subject || `${a.type} logged`}</p>
                {a.body && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{a.body}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Edit Company Panel (FIX 1 — slide-in, pre-filled) ─── */
function EditCompanyPanel({ open, onOpenChange, company, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: any;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    headquarters: "",
    switchboard: "",
    industry: "",
    size: "",
    website: "",
    notes: "",
    relationship_status: "warm",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && company) {
      setForm({
        name: company.name || "",
        headquarters: company.headquarters || "",
        switchboard: company.switchboard || "",
        industry: company.industry || "",
        size: company.size || "",
        website: company.website || "",
        notes: company.notes || "",
        relationship_status: company.relationship_status || "warm",
      });
    }
  }, [open, company]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name,
          headquarters: form.headquarters || null,
          switchboard: form.switchboard || null,
          industry: form.industry || null,
          size: form.size || null,
          website: form.website || null,
          notes: form.notes || null,
          relationship_status: form.relationship_status,
        })
        .eq("id", company.id);
      if (error) throw error;
      toast({ title: "Company updated" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit {company?.name || "Company"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Website</Label>
            <Input placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => setForm(f => ({ ...f, industry: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent className="bg-popover z-[9999]">
                  {INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="e.g. 500+" />
            </div>
          </div>
          <div>
            <Label>HQ Location</Label>
            <Input value={form.headquarters} onChange={e => setForm(f => ({ ...f, headquarters: e.target.value }))} placeholder="e.g. London, UK" />
          </div>
          <div>
            <Label>Switchboard</Label>
            <Input value={form.switchboard} onChange={e => setForm(f => ({ ...f, switchboard: e.target.value }))} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.relationship_status} onValueChange={v => setForm(f => ({ ...f, relationship_status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-[9999]">
                {STATUS_OPTIONS.filter(o => !["active", "cooling"].includes(o.value)).map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

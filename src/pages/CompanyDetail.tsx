import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Account, Contact, DataQuality } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, Building2, Globe, MapPin, Phone, Users, Network,
  Pencil, Plus, MoreHorizontal, Calendar, TrendingUp, User,
  Mail, Clock, StickyNote, FileText, Activity,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { CompanySnapshotCard } from "@/components/company/CompanySnapshotCard";
import { CompanyRelationshipIntel } from "@/components/company/CompanyRelationshipIntel";
import { CompanyContactsList } from "@/components/company/CompanyContactsList";
import { CompanyEngagementContext } from "@/components/company/CompanyEngagementContext";
import { CompanyLocationsSection } from "@/components/company/CompanyLocationsSection";
import { CreateCompanyModal } from "@/components/company/CreateCompanyModal";

/* ─── helpers ─── */
const fmtDate = (d?: string) => {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
};

const statusStyle = (s?: string) => {
  switch (s) {
    case "active": return "bg-accent text-accent-foreground";
    case "warm": return "bg-primary/10 text-primary";
    case "cooling": return "bg-secondary text-secondary-foreground";
    case "dormant": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

/* ─── page ─── */
export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch company from `companies` table
  const { data: company, isLoading } = useQuery({
    queryKey: ["companies", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      const c = data as any;
      return {
        id: c.id,
        name: c.name,
        industry: c.industry || "Other",
        headquarters: c.headquarters,
        switchboard: c.switchboard,
        regions: c.regions || [],
        website: c.website,
        size: c.size,
        relationshipStatus: c.relationship_status || "warm",
        accountManager: c.account_manager ? { name: c.account_manager, title: "Account Manager" } : undefined,
        contacts: [],
        lastUpdated: c.updated_at,
        lastInteraction: c.updated_at,
        engagementScore: 50,
        dataQuality: (c.data_quality as DataQuality) || "partial",
        aiSummary: c.notes,
      } as Account;
    },
    enabled: !!id,
  });

  // Fetch contacts from `contacts` table
  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id)
        .order("name");
      if (error) return [];
      return (data || []).map((c: any): Contact => ({
        id: c.id,
        name: c.name,
        title: c.title || "",
        department: c.department || "",
        seniority: "mid",
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

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading company…</div>;
  }
  if (!company) {
    return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Company not found</div>;
  }

  const companyWithContacts = { ...company, contacts };

  return (
    <div className="bg-background min-h-screen">
      {/* ─── HEADER BAR ─── */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 space-y-4">
          {/* Row 1: back + name + actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => navigate("/companies")} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
              <ChevronLeft className="h-4 w-4" /> Back to Companies
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">{company.name}</h1>
                {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
                <Badge className={cn("font-normal capitalize", statusStyle(company.relationshipStatus))}>
                  {company.relationshipStatus || "—"}
                </Badge>
              </div>
              {company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
                  <Globe className="h-3 w-3" />{company.website}
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-jarvis-id="company-edit-button">
                <Pencil className="h-4 w-4 mr-1" /> Edit Company
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate(`/contacts?company=${id}`)} data-jarvis-id="company-add-contact-button">
                <Plus className="h-4 w-4 mr-1" /> Add Contact
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(`/canvas?company=${id}`)} data-jarvis-id="company-open-canvas-button">
                    <Network className="h-4 w-4 mr-2" /> Open on Canvas
                  </DropdownMenuItem>
                  <DropdownMenuItem data-jarvis-id="company-send-email-button">
                    <Mail className="h-4 w-4 mr-2" /> Send Email
                  </DropdownMenuItem>
                  <DropdownMenuItem data-jarvis-id="company-log-call-button">
                    <Phone className="h-4 w-4 mr-2" /> Log Call
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Calendar className="h-4 w-4 mr-2" /> Schedule Meeting
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <StickyNote className="h-4 w-4 mr-2" /> Add Note
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Row 2: quick-stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickStat icon={TrendingUp} label="Engagement Score" value={`${company.engagementScore}%`} />
            <QuickStat icon={Users} label="Total Contacts" value={String(contacts.length)} />
            <QuickStat icon={Clock} label="Last Activity" value={fmtDate(company.lastInteraction)} />
            <QuickStat icon={User} label="Account Lead" value={company.accountManager?.name || "Unassigned"} />
          </div>
        </div>
      </div>

      {/* ─── BODY: two-column ─── */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* LEFT — 70% */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="overview">
              <TabsList className="mb-4 flex-wrap">
                <TabsTrigger value="overview" data-jarvis-id="company-tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts" data-jarvis-id="company-tab-contacts">Contacts ({contacts.length})</TabsTrigger>
                <TabsTrigger value="deals" data-jarvis-id="company-tab-deals">Deals</TabsTrigger>
                <TabsTrigger value="projects" data-jarvis-id="company-tab-projects">Projects</TabsTrigger>
                <TabsTrigger value="documents" data-jarvis-id="company-tab-documents">Documents</TabsTrigger>
                <TabsTrigger value="activities" data-jarvis-id="company-tab-activities">Activities</TabsTrigger>
                <TabsTrigger value="canvas" data-jarvis-id="company-tab-canvas">Canvas</TabsTrigger>
                <TabsTrigger value="invoices" data-jarvis-id="company-tab-invoices">Invoices</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="space-y-4">
                <CompanySnapshotCard company={companyWithContacts} />
                <CompanyRelationshipIntel company={companyWithContacts} />
                <CompanyEngagementContext company={companyWithContacts} />
              </TabsContent>

              {/* CONTACTS */}
              <TabsContent value="contacts" className="space-y-4">
                <CompanyContactsList
                  contacts={contacts}
                  onContactClick={(c) => navigate(`/contacts?highlight=${c.id}`)}
                />
              </TabsContent>

              {/* DEALS */}
              <TabsContent value="deals">
                <Card><CardContent className="py-12 text-center text-muted-foreground">No deals linked yet. Create a deal from the CRM module to associate it.</CardContent></Card>
              </TabsContent>

              {/* PROJECTS */}
              <TabsContent value="projects">
                <Card><CardContent className="py-12 text-center text-muted-foreground">No projects linked yet.</CardContent></Card>
              </TabsContent>

              {/* DOCUMENTS */}
              <TabsContent value="documents">
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  No documents uploaded. SOWs, contracts and proposals will appear here.
                </CardContent></Card>
              </TabsContent>

              {/* ACTIVITIES */}
              <TabsContent value="activities">
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  Activity log — calls, emails, meetings and notes will appear here chronologically.
                </CardContent></Card>
              </TabsContent>

              {/* CANVAS */}
              <TabsContent value="canvas">
                <Card>
                  <CardContent className="py-12 text-center space-y-4">
                    <Network className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">View {company.name}'s org chart and relationship map on the Canvas.</p>
                    <Button onClick={() => navigate(`/canvas?company=${id}`)} className="gap-2">
                      <Network className="h-4 w-4" />
                      Open on Canvas
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* INVOICES */}
              <TabsContent value="invoices">
                <Card><CardContent className="py-12 text-center text-muted-foreground">No invoices linked yet.</CardContent></Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT — sidebar */}
          <div className="w-80 shrink-0 space-y-4 hidden lg:block">
            {/* Company details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Company Details</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <SidebarRow icon={Globe} label="Website" value={company.website} link />
                <SidebarRow icon={Phone} label="Switchboard" value={company.switchboard} />
                <SidebarRow icon={MapPin} label="HQ" value={company.headquarters} />
                <SidebarRow icon={Building2} label="Industry" value={company.industry} />
                <SidebarRow icon={Users} label="Size" value={company.size} />
              </CardContent>
            </Card>

            {/* Account owner */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Account Owner</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {company.accountManager ? (
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {company.accountManager.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{company.accountManager.name}</p>
                      <p className="text-muted-foreground text-xs">{company.accountManager.title}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Unassigned</p>
                )}
              </CardContent>
            </Card>

            {/* Regions / Tags */}
            {company.regions && company.regions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Regions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {company.regions.map(r => (
                      <Badge key={r} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timestamps */}
            <Card>
              <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
                <p>Created: {fmtDate(company.lastUpdated)}</p>
                <p>Last updated: {fmtDate(company.lastUpdated)}</p>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> Log Call
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> Send Email
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Schedule Meeting
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                  <StickyNote className="h-4 w-4" /> Add Note
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <CreateCompanyModal
        open={editOpen}
        onOpenChange={setEditOpen}
        onCompanyCreated={() => setEditOpen(false)}
      />
    </div>
  );
}

/* ─── sub-components ─── */
function QuickStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SidebarRow({ icon: Icon, label, value, link }: { icon: any; label: string; value?: string | null; link?: boolean }) {
  if (!value) return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}: —</span>
    </div>
  );
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="text-muted-foreground text-xs">{label}</span>
        {link ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer"
            className="block text-primary hover:underline truncate">{value}</a>
        ) : (
          <p className="text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Pencil, Mail, Phone, MessageSquare, CalendarPlus, Target, Globe, Shield, ShieldCheck, FileText, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCrmContact } from "@/hooks/use-crm-contacts";
import { AddEditContactPanel } from "@/components/crm/AddEditContactPanel";
import { IntegrationGuard } from "@/components/integrations/IntegrationGuard";
import { EmailComposeModal } from "@/components/communications/EmailComposeModal";
import { SMSComposeModal } from "@/components/communications/SMSComposeModal";
import { AICallModal } from "@/components/communications/AICallModal";
import { LogActivityModal } from "@/components/communications/LogActivityModal";
import { ContactActivityTab } from "@/components/communications/ContactActivityTab";
import { GdprDataRightsTab } from "@/components/crm/GdprDataRightsTab";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export default function CrmContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: contact, isLoading } = useCrmContact(id);
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const backFrom = (location.state as any)?.from as string | undefined;
  const backLabel = (location.state as any)?.fromLabel as string | undefined;
  const handleBack = () => navigate(backFrom || "/contacts");

  useEffect(() => {
    if (isLoading || contact || !id) return;
    let cancelled = false;
    supabase
      .from("contacts")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.id) {
          navigate(`/contacts/${id}`, { replace: true, state: location.state });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contact, id, isLoading, location.state, navigate]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!contact) return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground px-2 py-1 -ml-2 mb-6 rounded-md transition-all duration-150 hover:bg-accent border-l-2 border-transparent hover:border-primary group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {backLabel || "Back to Contacts"}
        </button>
        <div className="text-center text-muted-foreground py-16">
          <p className="text-lg font-medium text-foreground">CRM contact not found</p>
          <p className="text-sm mt-2">This record may be a standard contact. Return and open the Contact profile instead.</p>
        </div>
      </div>
    </div>
  );

  const fullName = `${contact.first_name} ${contact.last_name}`;

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="
            inline-flex items-center gap-1.5
            text-sm font-medium
            text-foreground
            px-2 py-1 -ml-2 rounded-md
            transition-all duration-150
            hover:bg-accent
            border-l-2 border-transparent
            hover:border-primary
            group
          "
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          {backLabel || "Back to Contacts"}
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {contact.job_title && <span>{contact.job_title}</span>}
            {contact.crm_companies && (
              <>
                <span>at</span>
                <span
                  className="text-primary hover:underline cursor-pointer"
                  onClick={() => navigate(`/companies/${contact.crm_companies!.id}`)}
                >
                  {contact.crm_companies.name}
                </span>
              </>
            )}
          </div>
        </div>
        <Badge variant={contact.gdpr_consent ? "default" : "outline"} className={contact.gdpr_consent ? "bg-success text-success-foreground" : ""}>
          {contact.gdpr_consent ? "GDPR Consented" : "Consent Pending"}
        </Badge>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => setEmailOpen(true)}
          className="gap-1.5 bg-sky-500/15 text-sky-300 border border-sky-500/50 hover:bg-sky-500/25 hover:text-sky-200 hover:border-sky-400/70 shadow-[0_0_12px_-2px_hsl(199_89%_55%/0.45)]"
        >
          <Mail className="h-4 w-4" /> Email
        </Button>
        <Button
          size="sm"
          onClick={() => setCallOpen(true)}
          className="gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/25 hover:text-emerald-200 hover:border-emerald-400/70 shadow-[0_0_12px_-2px_hsl(152_76%_45%/0.45)]"
        >
          <Phone className="h-4 w-4" /> AI Call
        </Button>
        <Button
          size="sm"
          onClick={() => setSmsOpen(true)}
          className="gap-1.5 bg-violet-500/15 text-violet-300 border border-violet-500/50 hover:bg-violet-500/25 hover:text-violet-200 hover:border-violet-400/70 shadow-[0_0_12px_-2px_hsl(262_83%_65%/0.45)]"
        >
          <MessageSquare className="h-4 w-4" /> SMS
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLogOpen(true)}><CalendarPlus className="h-4 w-4 mr-1" /> Log Activity</Button>
        <Button variant="outline" size="sm"><Target className="h-4 w-4 mr-1" /> Add to Opportunity</Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="gdpr">Data & Rights</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Details</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <DetailRow label="Email" value={contact.email} />
                <DetailRow label="Phone" value={contact.phone} />
                <DetailRow label="Mobile" value={contact.mobile} />
                {contact.linkedin_url && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28">LinkedIn</span>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <Globe className="h-3 w-3" /> Profile
                    </a>
                  </div>
                )}
                <DetailRow label="Preferred" value={contact.preferred_contact} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {contact.gdpr_consent ? <ShieldCheck className="h-4 w-4 text-success" /> : <Shield className="h-4 w-4" />}
                  Data & Consent
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <DetailRow label="Consent" value={contact.gdpr_consent ? "Yes" : "No"} />
                <DetailRow label="Method" value={contact.gdpr_consent_method} />
                <DetailRow label="Date" value={contact.gdpr_consent_date ? format(new Date(contact.gdpr_consent_date), "dd MMM yyyy") : null} />
              </CardContent>
            </Card>
          </div>

          {contact.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{contact.notes}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ContactActivityTab contactId={contact.id} companyId={contact.company_id} />
        </TabsContent>

        <TabsContent value="gdpr" className="mt-4">
          <GdprDataRightsTab contact={contact} />
        </TabsContent>

        {["opportunities", "documents"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tab.charAt(0).toUpperCase() + tab.slice(1)} module coming soon.
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AddEditContactPanel open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      
      <EmailComposeModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        contactId={contact.id}
        contactEmail={contact.email}
        contactFirstName={contact.first_name}
        companyId={contact.company_id}
        companyName={contact.crm_companies?.name}
      />

      <SMSComposeModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        contactId={contact.id}
        contactMobile={contact.mobile}
        contactFirstName={contact.first_name}
        companyId={contact.company_id}
        gdprConsent={contact.gdpr_consent}
      />

      <AICallModal
        open={callOpen}
        onOpenChange={setCallOpen}
        contactId={contact.id}
        contactFirstName={contact.first_name}
        contactLastName={contact.last_name}
        companyName={contact.crm_companies?.name}
        contactMobile={contact.mobile}
      />

      <LogActivityModal
        open={logOpen}
        onOpenChange={setLogOpen}
        contactId={contact.id}
        companyId={contact.company_id}
      />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

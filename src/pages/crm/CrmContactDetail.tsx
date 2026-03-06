import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

export default function CrmContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useCrmContact(id);
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!contact) return <div className="p-6 text-muted-foreground">Contact not found</div>;

  const fullName = `${contact.first_name} ${contact.last_name}`;

  return (
    <div className="space-y-6 p-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
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
        <Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}><Mail className="h-4 w-4 mr-1" /> Email</Button>
        <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}><Phone className="h-4 w-4 mr-1" /> AI Call</Button>
        <Button variant="outline" size="sm" onClick={() => setSmsOpen(true)}><MessageSquare className="h-4 w-4 mr-1" /> SMS</Button>
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

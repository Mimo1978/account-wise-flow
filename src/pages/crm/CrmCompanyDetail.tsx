import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Globe, Building2, MapPin, Phone, StickyNote, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrmCompany } from "@/hooks/use-crm-companies";
import { useContactsForCompany } from "@/hooks/use-crm-contacts";
import { AddEditCompanyPanel } from "@/components/crm/AddEditCompanyPanel";
import { AddEditContactPanel } from "@/components/crm/AddEditContactPanel";
import { Plus } from "lucide-react";

export default function CrmCompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading } = useCrmCompany(id);
  const { data: contacts = [] } = useContactsForCompany(id);
  const [editOpen, setEditOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!company) return <div className="p-6 text-muted-foreground">Company not found</div>;

  return (
    <div className="space-y-6 p-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
            {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
          </div>
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
              <Globe className="h-3 w-3" />{company.website}
            </a>
          )}
        </div>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="deals">Deals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Address
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {company.address_line1 && <p>{company.address_line1}</p>}
                {company.address_line2 && <p>{company.address_line2}</p>}
                <p>{[company.city, company.postcode, company.country].filter(Boolean).join(", ") || "No address"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>Size: {company.size || "—"}</p>
                {company.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone}</p>}
              </CardContent>
            </Card>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Contacts", value: contacts.length },
              { label: "Open Opportunities", value: "—" },
              { label: "Pipeline Value", value: "—" },
              { label: "Deals Won", value: "—" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {company.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StickyNote className="h-4 w-4" /> Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{company.notes}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setContactPanelOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </div>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GDPR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No contacts yet</TableCell></TableRow>
                ) : contacts.map(c => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/contacts/${c.id}`)}>
                    <TableCell className="font-medium text-primary">{c.first_name} {c.last_name}</TableCell>
                    <TableCell>{c.job_title || "—"}</TableCell>
                    <TableCell>{c.email || "—"}</TableCell>
                    <TableCell>{c.phone || c.mobile || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.gdpr_consent ? "default" : "outline"} className={c.gdpr_consent ? "bg-success text-success-foreground" : ""}>
                        {c.gdpr_consent ? "Consented" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {["projects", "opportunities", "deals", "documents", "activity"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {tab.charAt(0).toUpperCase() + tab.slice(1)} module coming soon.
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AddEditCompanyPanel open={editOpen} onOpenChange={setEditOpen} company={company} />
      <AddEditContactPanel open={contactPanelOpen} onOpenChange={setContactPanelOpen} prefillCompanyId={id} />
    </div>
  );
}

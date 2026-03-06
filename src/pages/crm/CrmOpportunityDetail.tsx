import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCrmOpportunity, useUpdateCrmOpportunity, STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from "@/hooks/use-crm-opportunities";
import { useCreateCrmDeal } from "@/hooks/use-crm-deals";
import { useCreateCrmActivity } from "@/hooks/use-crm-activities";
import { AddEditOpportunityPanel } from "@/components/crm/AddEditOpportunityPanel";
import { toast } from "@/hooks/use-toast";
import { Pencil, ArrowLeft, Loader2, ExternalLink, Handshake, ChevronLeft } from "lucide-react";
import { format } from "date-fns";

export default function CrmOpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: opp, isLoading } = useCrmOpportunity(id);
  const updateOpp = useUpdateCrmOpportunity();
  const createDeal = useCreateCrmDeal();
  const createActivity = useCreateCrmActivity();
  const [editOpen, setEditOpen] = useState(false);
  const [dealModal, setDealModal] = useState(false);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!opp) return <div className="p-6 text-muted-foreground">Opportunity not found</div>;

  const currencySymbol = opp.currency === "GBP" ? "£" : opp.currency === "USD" ? "$" : "€";
  const stageIndex = STAGE_ORDER.indexOf(opp.stage);
  const progressPercent = ((stageIndex + 1) / STAGE_ORDER.length) * 100;

  const handleConvertDeal = async () => {
    try {
      await createDeal.mutateAsync({
        title: opp.title,
        opportunity_id: opp.id,
        company_id: opp.company_id,
        value: opp.value,
        currency: opp.currency,
        status: "active",
        signed_date: new Date().toISOString().split("T")[0],
      });
      await createActivity.mutateAsync({
        type: "note",
        subject: "Deal created from opportunity",
        opportunity_id: opp.id,
        company_id: opp.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: "Deal created!" });
      setDealModal(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 text-muted-foreground hover:text-foreground -ml-2">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{opp.title}</h1>
            <Badge className={STAGE_COLORS[opp.stage]} variant="secondary">{STAGE_LABELS[opp.stage]}</Badge>
            <span className="text-lg font-semibold text-foreground">{currencySymbol}{opp.value.toLocaleString()}</span>
          </div>
          {opp.crm_companies && (
            <span className="text-sm text-primary cursor-pointer hover:underline" onClick={() => navigate(`/companies/${opp.crm_companies!.id}`)}>
              {opp.crm_companies.name} <ExternalLink className="inline h-3 w-3" />
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {opp.stage === "closed_won" && (
            <Button size="sm" onClick={() => setDealModal(true)}>
              <Handshake className="h-4 w-4 mr-1" /> Convert to Deal
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      {/* Stage progress */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            {STAGE_ORDER.map((s, i) => (
              <span key={s} className={i <= stageIndex ? "text-primary font-medium" : ""}>{STAGE_LABELS[s]}</span>
            ))}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="py-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-muted-foreground">Probability</span>
                  <p className="font-medium">{opp.probability}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected Close</span>
                  <p className="font-medium">{opp.expected_close_date ? format(new Date(opp.expected_close_date), "dd MMM yyyy") : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Weighted Value</span>
                  <p className="font-medium">{currencySymbol}{(opp.value * opp.probability / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contact</span>
                  <p className="font-medium">{opp.crm_contacts ? `${opp.crm_contacts.first_name} ${opp.crm_contacts.last_name}` : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Project</span>
                  <p className="font-medium">
                    {opp.crm_projects ? (
                      <span className="text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/projects/${opp.crm_projects!.id}`)}>
                        {opp.crm_projects.name}
                      </span>
                    ) : "—"}
                  </p>
                </div>
              </div>
              {opp.notes && (
                <div>
                  <span className="text-muted-foreground">Notes</span>
                  <p className="mt-1 whitespace-pre-wrap">{opp.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="py-8 text-center text-muted-foreground">Activity log coming soon</CardContent></Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card><CardContent className="py-8 text-center text-muted-foreground">Documents coming soon</CardContent></Card>
        </TabsContent>
      </Tabs>

      <AddEditOpportunityPanel open={editOpen} onOpenChange={setEditOpen} opportunity={opp} />

      <Dialog open={dealModal} onOpenChange={setDealModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert to Deal?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Create a deal from <strong>{opp.title}</strong> for {currencySymbol}{opp.value.toLocaleString()}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDealModal(false)}>Cancel</Button>
            <Button onClick={handleConvertDeal}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

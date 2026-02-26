import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCrmOpportunities, useUpdateCrmOpportunity, STAGE_ORDER, STAGE_LABELS, STAGE_COLORS } from "@/hooks/use-crm-opportunities";
import { useCreateCrmDeal } from "@/hooks/use-crm-deals";
import { useCreateCrmActivity } from "@/hooks/use-crm-activities";
import { useCrmCompanies } from "@/hooks/use-crm-companies";
import { AddEditOpportunityPanel } from "@/components/crm/AddEditOpportunityPanel";
import { toast } from "@/hooks/use-toast";
import type { CrmOpportunityStage } from "@/types/crm";
import type { CrmOpportunityWithRelations } from "@/hooks/use-crm-opportunities";
import { format, differenceInDays } from "date-fns";

export default function CrmPipelinePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: allOpps = [] } = useCrmOpportunities({ search: search || undefined, company_id: companyFilter || undefined });
  const { data: companies = [] } = useCrmCompanies();
  const updateOpp = useUpdateCrmOpportunity();
  const createDeal = useCreateCrmDeal();
  const createActivity = useCreateCrmActivity();

  // DnD state
  const [dragId, setDragId] = useState<string | null>(null);

  // Modal states
  const [dealModal, setDealModal] = useState<CrmOpportunityWithRelations | null>(null);
  const [lostModal, setLostModal] = useState<CrmOpportunityWithRelations | null>(null);
  const [lostReason, setLostReason] = useState("");

  const byStage = useMemo(() => {
    const map: Record<CrmOpportunityStage, CrmOpportunityWithRelations[]> = {
      lead: [], qualified: [], proposal: [], negotiation: [], closed_won: [], closed_lost: [],
    };
    allOpps.forEach(o => {
      if (map[o.stage]) map[o.stage].push(o);
    });
    return map;
  }, [allOpps]);

  const totalPipeline = allOpps.reduce((s, o) => s + o.value, 0);
  const weightedPipeline = allOpps.reduce((s, o) => s + o.value * (o.probability / 100), 0);

  const currencySymbol = (c: string) => c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  const handleDrop = useCallback(async (stage: CrmOpportunityStage) => {
    if (!dragId) return;
    const opp = allOpps.find(o => o.id === dragId);
    if (!opp || opp.stage === stage) { setDragId(null); return; }

    if (stage === "closed_won") {
      setDealModal(opp);
      // Stage update happens after deal confirmation
      setDragId(null);
      return;
    }

    if (stage === "closed_lost") {
      setLostModal(opp);
      setDragId(null);
      return;
    }

    try {
      const prob = stage === "lead" ? 10 : stage === "qualified" ? 25 : stage === "proposal" ? 50 : 75;
      await updateOpp.mutateAsync({ id: opp.id, stage, probability: prob });
      await createActivity.mutateAsync({
        type: "note",
        subject: `Stage changed to ${STAGE_LABELS[stage]}`,
        body: `Opportunity moved from ${STAGE_LABELS[opp.stage]} to ${STAGE_LABELS[stage]}`,
        opportunity_id: opp.id,
        company_id: opp.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: `Moved to ${STAGE_LABELS[stage]}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDragId(null);
  }, [dragId, allOpps, updateOpp, createActivity]);

  const handleDealConfirm = async () => {
    if (!dealModal) return;
    try {
      await updateOpp.mutateAsync({ id: dealModal.id, stage: "closed_won", probability: 100 });
      await createDeal.mutateAsync({
        title: dealModal.title,
        opportunity_id: dealModal.id,
        company_id: dealModal.company_id,
        value: dealModal.value,
        currency: dealModal.currency,
        status: "active",
        signed_date: new Date().toISOString().split("T")[0],
      });
      await createActivity.mutateAsync({
        type: "note",
        subject: "Stage changed to Closed Won — Deal created",
        opportunity_id: dealModal.id,
        company_id: dealModal.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: "Deal created!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setDealModal(null);
  };

  const handleLostConfirm = async () => {
    if (!lostModal || !lostReason.trim()) return;
    try {
      await updateOpp.mutateAsync({ id: lostModal.id, stage: "closed_lost", probability: 0, notes: `${lostModal.notes ? lostModal.notes + "\n" : ""}Lost reason: ${lostReason}` });
      await createActivity.mutateAsync({
        type: "note",
        subject: "Stage changed to Closed Lost",
        body: `Reason: ${lostReason}`,
        opportunity_id: lostModal.id,
        company_id: lostModal.company_id,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: "Opportunity closed as lost" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setLostModal(null);
    setLostReason("");
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
        </div>
        <Button onClick={() => setPanelOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Opportunity
        </Button>
      </div>

      {/* Top bar stats */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Pipeline</p>
            <p className="text-lg font-bold text-foreground">£{totalPipeline.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[180px]">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Weighted Pipeline</p>
            <p className="text-lg font-bold text-foreground">£{weightedPipeline.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={companyFilter} onValueChange={v => setCompanyFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Companies" /></SelectTrigger>
          <SelectContent className="bg-popover z-[9999]">
            <SelectItem value="_all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map(stage => {
          const cards = byStage[stage];
          const stageTotal = cards.reduce((s, o) => s + o.value, 0);
          return (
            <div
              key={stage}
              className="flex-shrink-0 w-[280px] bg-muted/40 rounded-lg p-3 space-y-3"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{STAGE_LABELS[stage]}</h3>
                  <p className="text-xs text-muted-foreground">{cards.length} · £{stageTotal.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-2 min-h-[80px]">
                {cards.map(opp => {
                  const daysInStage = differenceInDays(new Date(), new Date(opp.updated_at));
                  return (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={() => setDragId(opp.id)}
                      className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                    >
                      <p className="font-medium text-sm text-foreground truncate">{opp.title}</p>
                      {opp.crm_companies && (
                        <p className="text-xs text-muted-foreground mt-0.5">{opp.crm_companies.name}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-foreground">
                          {currencySymbol(opp.currency)}{opp.value.toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{opp.probability}%</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
                        {opp.crm_contacts && (
                          <span>{opp.crm_contacts.first_name} {opp.crm_contacts.last_name}</span>
                        )}
                        <span>{daysInStage}d in stage</span>
                      </div>
                      {opp.expected_close_date && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Close: {format(new Date(opp.expected_close_date), "dd MMM")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add opp panel */}
      <AddEditOpportunityPanel open={panelOpen} onOpenChange={setPanelOpen} />

      {/* Create Deal Modal */}
      <Dialog open={!!dealModal} onOpenChange={() => setDealModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Deal?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Moving <strong>{dealModal?.title}</strong> to Closed Won will create a deal for {currencySymbol(dealModal?.currency || "GBP")}{dealModal?.value.toLocaleString()}.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDealModal(null)}>Cancel</Button>
            <Button onClick={handleDealConfirm}>Create Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closed Lost reason Modal */}
      <Dialog open={!!lostModal} onOpenChange={() => { setLostModal(null); setLostReason(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Loss Reason</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Why was this opportunity lost? *</Label>
            <Textarea value={lostReason} onChange={e => setLostReason(e.target.value)} rows={3} placeholder="Reason for loss…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLostModal(null); setLostReason(""); }}>Cancel</Button>
            <Button onClick={handleLostConfirm} disabled={!lostReason.trim()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

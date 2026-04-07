import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Clock, FileText, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TYPE_COLORS: Record<string, string> = {
  contractor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  permanent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  consulting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function WeeklyTimesheet({ placementId, ratePerDay, currency }: { placementId: string; ratePerDay: number; currency: string }) {
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["time-entries", placementId, weekStart.toISOString()],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("time_entries")
        .select("*")
        .eq("placement_id", placementId)
        .eq("week_start", weekStart.toISOString().split("T")[0]);
      return data || [];
    },
  });

  const totalDays = entries.reduce((s: number, e: any) => s + (e.days || 0), 0);

  const toggleDay = async (date: Date, currentDays: number) => {
    const dateStr = date.toISOString().split("T")[0];
    const weekStr = weekStart.toISOString().split("T")[0];
    const existing = entries.find((e: any) => e.work_date === dateStr);

    let nextDays = 0;
    if (currentDays === 0) nextDays = 1;
    else if (currentDays === 1) nextDays = 0.5;
    else nextDays = 0;

    if (existing) {
      if (nextDays === 0) {
        await (supabase.from as any)("time_entries").delete().eq("id", existing.id);
      } else {
        await (supabase.from as any)("time_entries").update({ days: nextDays }).eq("id", existing.id);
      }
    } else if (nextDays > 0) {
      await (supabase.from as any)("time_entries").insert({
        placement_id: placementId,
        work_date: dateStr,
        week_start: weekStr,
        days: nextDays,
        status: "draft",
      });
    }
    refetch();
    qc.invalidateQueries({ queryKey: ["time-entries", placementId] });
  };

  const submitWeek = async () => {
    const ids = entries.filter((e: any) => e.status === "draft").map((e: any) => e.id);
    if (ids.length === 0) { toast.error("No draft entries to submit"); return; }
    await (supabase.from as any)("time_entries").update({ status: "submitted" }).in("id", ids);
    refetch();
    toast.success("Week submitted for approval");
  };

  const approveWeek = async () => {
    const ids = entries.filter((e: any) => e.status === "submitted").map((e: any) => e.id);
    if (ids.length === 0) { toast.error("No submitted entries to approve"); return; }
    await (supabase.from as any)("time_entries").update({ status: "approved", approved_at: new Date().toISOString() }).in("id", ids);
    refetch();
    toast.success("Week approved");
  };

  const allSubmitted = entries.length > 0 && entries.every((e: any) => e.status !== "draft");
  const anySubmitted = entries.some((e: any) => e.status === "submitted");
  const allApproved = entries.length > 0 && entries.every((e: any) => e.status === "approved");

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w - 1)}>‹</Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              Week of {format(weekStart, "dd MMM yyyy")}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w + 1)}>›</Button>
            {weekOffset !== 0 && <Button variant="link" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>This week</Button>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{totalDays} day{totalDays !== 1 ? "s" : ""} · {currency} {(totalDays * ratePerDay).toLocaleString()}</span>
            {!allSubmitted && totalDays > 0 && (
              <Button size="sm" onClick={submitWeek}>Submit week</Button>
            )}
            {anySubmitted && !allApproved && (
              <Button size="sm" variant="outline" onClick={approveWeek}>Approve</Button>
            )}
            {allApproved && <Badge variant="outline" className="border-green-500/30 text-green-400">✓ Approved</Badge>}
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0 pb-4">
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map(day => {
            const dateStr = day.toISOString().split("T")[0];
            const entry = entries.find((e: any) => e.work_date === dateStr);
            const days = entry?.days || 0;
            const status = entry?.status || "none";
            const isApproved = status === "approved";
            return (
              <button
                key={dateStr}
                onClick={() => !isApproved && toggleDay(day, days)}
                disabled={isApproved}
                className={`rounded-xl border-2 p-3 text-center transition-all ${
                  days === 1 ? "border-green-500 bg-green-500/10" :
                  days === 0.5 ? "border-amber-500 bg-amber-500/10" :
                  "border-border bg-card hover:border-primary/40"
                } ${isApproved ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}>
                <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                <p className="text-lg font-bold">{format(day, "d")}</p>
                <p className={`text-xs font-medium mt-1 ${days === 1 ? "text-green-400" : days === 0.5 ? "text-amber-400" : "text-muted-foreground"}`}>
                  {days === 1 ? "Full" : days === 0.5 ? "Half" : "—"}
                </p>
                {status !== "none" && (
                  <p className={`text-[10px] mt-1 ${status === "approved" ? "text-green-400" : status === "submitted" ? "text-blue-400" : "text-muted-foreground"}`}>
                    {status}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">Click to toggle: — → Full day → Half day → —</p>
      </CardContent>
    </Card>
  );
}

export default function PlacementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: placement, isLoading } = useQuery({
    queryKey: ["placement-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase.from as any)("placements")
        .select("*, candidates(name, current_title, email), companies(name), contacts(name), deals:deal_id(title)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!placement) return <div className="p-6 text-muted-foreground">Placement not found</div>;

  const daysLeft = placement.end_date ? Math.ceil((new Date(placement.end_date).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {placement.candidates?.name || "Unknown Candidate"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {placement.candidates?.current_title} at {placement.companies?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={TYPE_COLORS[placement.placement_type] || ""}>
            {placement.placement_type}
          </Badge>
          <Badge variant="secondary">{placement.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Rate</p>
            <p className="text-lg font-bold">
              {placement.rate_per_day ? `${placement.currency} ${placement.rate_per_day}/day` : placement.placement_fee ? `${placement.currency} ${Number(placement.placement_fee).toLocaleString()}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Start date</p>
            <p className="text-lg font-bold">
              {placement.start_date ? format(new Date(placement.start_date), "dd MMM yyyy") : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">End date</p>
            <p className="text-lg font-bold">
              {placement.end_date ? format(new Date(placement.end_date), "dd MMM yyyy") : "Open ended"}
            </p>
            {daysLeft !== null && daysLeft < 30 && <p className="text-xs text-amber-400 mt-1">{daysLeft} days left</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Invoice frequency</p>
            <p className="text-lg font-bold">{placement.invoice_frequency || "Monthly"}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timesheet">
        <TabsList>
          <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="timesheet">
          <WeeklyTimesheet placementId={placement.id} ratePerDay={placement.rate_per_day || 0} currency={placement.currency || "GBP"} />
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Invoices coming in next build</p>
              <p className="text-xs text-muted-foreground mt-1">Generate monthly invoices from approved timesheet entries</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardContent className="py-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Candidate email</p><p className="font-medium">{placement.candidates?.email || "—"}</p></div>
                <div><p className="text-muted-foreground">Billing email</p><p className="font-medium">{placement.billing_contact_email || "—"}</p></div>
                <div><p className="text-muted-foreground">PO number</p><p className="font-medium">{placement.po_number || "—"}</p></div>
                <div><p className="text-muted-foreground">Currency</p><p className="font-medium">{placement.currency}</p></div>
                {placement.deals && <div><p className="text-muted-foreground">Linked deal</p><p className="font-medium text-primary cursor-pointer hover:underline" onClick={() => navigate(`/crm/deals/${placement.deal_id}`)}>{placement.deals.title}</p></div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

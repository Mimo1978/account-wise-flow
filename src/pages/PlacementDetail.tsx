import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Calendar, Clock, FileText, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";

const TYPE_COLORS: Record<string, string> = {
  contractor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  permanent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  consulting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

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
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Timesheet coming in next build</p>
              <p className="text-xs text-muted-foreground mt-1">Log days worked by week — approved days generate invoices automatically</p>
            </CardContent>
          </Card>
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

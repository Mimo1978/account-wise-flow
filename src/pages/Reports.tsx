import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import {
  useSalesPipelineReport,
  useRevenueReport,
  useActivityReport,
  useCompanyReport,
} from "@/hooks/use-reports-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { exportToCsv } from "@/lib/csv-export";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fmt = (v: number) =>
  v >= 1000000
    ? `£${(v / 1000000).toFixed(1)}M`
    : v >= 1000
    ? `£${(v / 1000).toFixed(0)}K`
    : `£${v.toFixed(0)}`;

export default function Reports() {
  const [tab, setTab] = useState("pipeline");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Detailed reporting across your CRM data
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Sales Pipeline</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineReport />
        </TabsContent>
        <TabsContent value="revenue">
          <RevenueReport />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityReport />
        </TabsContent>
        <TabsContent value="company">
          <CompanyReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──── Sales Pipeline Report ────
function PipelineReport() {
  const { data: stages, isLoading } = useSalesPipelineReport();

  const handleExport = () => {
    if (!stages) return;
    exportToCsv("sales-pipeline-report.csv", stages.map((s) => ({
      Stage: s.label,
      Count: s.count,
      "Total Value": s.totalValue,
      "Avg Deal Size": Math.round(s.avgDealSize),
      "Conversion Rate %": s.conversionRate ?? "N/A",
    })));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Stage Breakdown</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead className="text-right">Avg Deal Size</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stages ?? []).map((s) => (
              <TableRow key={s.stage}>
                <TableCell className="font-medium">{s.label}</TableCell>
                <TableCell className="text-right">{s.count}</TableCell>
                <TableCell className="text-right">{fmt(s.totalValue)}</TableCell>
                <TableCell className="text-right">{fmt(s.avgDealSize)}</TableCell>
                <TableCell className="text-right">
                  {s.conversionRate !== null ? `${s.conversionRate}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──── Revenue Report ────
function RevenueReport() {
  const { data: months } = useRevenueReport();

  const handleExport = () => {
    if (!months) return;
    exportToCsv("revenue-report.csv", months.map((m) => ({
      Month: m.month,
      "Invoices Sent": m.invoicesSent,
      "Invoices Paid": m.invoicesPaid,
      "Total Value": m.totalValue,
      "Avg Invoice Value": Math.round(m.avgInvoiceValue),
    })));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly Revenue (12 Months)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => fmt(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="totalValue" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Monthly Breakdown</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="text-right">Avg Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(months ?? []).map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.month}</TableCell>
                  <TableCell className="text-right">{m.invoicesSent}</TableCell>
                  <TableCell className="text-right">{m.invoicesPaid}</TableCell>
                  <TableCell className="text-right">{fmt(m.totalValue)}</TableCell>
                  <TableCell className="text-right">{fmt(m.avgInvoiceValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ──── Activity Report ────
function ActivityReport() {
  const { data: users } = useActivityReport();

  const handleExport = () => {
    if (!users) return;
    exportToCsv("activity-report.csv", users.map((u) => ({
      User: u.userId,
      Calls: u.calls,
      Emails: u.emails,
      SMS: u.sms,
      Meetings: u.meetings,
      Total: u.total,
    })));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Activity per User</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Emails</TableHead>
              <TableHead className="text-right">SMS</TableHead>
              <TableHead className="text-right">Meetings</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users ?? []).map((u) => (
              <TableRow key={u.userId}>
                <TableCell className="font-mono text-xs">{u.userId.slice(0, 8)}…</TableCell>
                <TableCell className="text-right">{u.calls}</TableCell>
                <TableCell className="text-right">{u.emails}</TableCell>
                <TableCell className="text-right">{u.sms}</TableCell>
                <TableCell className="text-right">{u.meetings}</TableCell>
                <TableCell className="text-right font-medium">{u.total}</TableCell>
              </TableRow>
            ))}
            {(users ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No activity data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ──── Company Report ────
function CompanyReport() {
  const { data: companies } = useCompanyReport();
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = [...(companies ?? [])].sort((a: any, b: any) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? (av ?? 0) - (bv ?? 0) : (bv ?? 0) - (av ?? 0);
  });

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleExport = () => {
    if (!sorted.length) return;
    exportToCsv("company-report.csv", sorted.map((c) => ({
      Company: c.name,
      "Pipeline Value": c.pipelineValue,
      "Total Invoiced": c.totalInvoiced,
      "Total Paid": c.totalPaid,
      Contacts: c.contactCount,
      "Active Projects": c.activeProjects,
      "Last Activity": c.lastActivityDate ? format(new Date(c.lastActivityDate), "yyyy-MM-dd") : "",
    })));
  };

  const sortIcon = (key: string) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Company Overview</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                Company{sortIcon("name")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("pipelineValue")}>
                Pipeline{sortIcon("pipelineValue")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("totalInvoiced")}>
                Invoiced{sortIcon("totalInvoiced")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("totalPaid")}>
                Paid{sortIcon("totalPaid")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("contactCount")}>
                Contacts{sortIcon("contactCount")}
              </TableHead>
              <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("activeProjects")}>
                Projects{sortIcon("activeProjects")}
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("lastActivityDate")}>
                Last Activity{sortIcon("lastActivityDate")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-right">{fmt(c.pipelineValue)}</TableCell>
                <TableCell className="text-right">{fmt(c.totalInvoiced)}</TableCell>
                <TableCell className="text-right">{fmt(c.totalPaid)}</TableCell>
                <TableCell className="text-right">{c.contactCount}</TableCell>
                <TableCell className="text-right">{c.activeProjects}</TableCell>
                <TableCell>
                  {c.lastActivityDate
                    ? format(new Date(c.lastActivityDate), "dd MMM yyyy")
                    : "—"}
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No company data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  BarChart3,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  ArrowRight,
} from "lucide-react";
import {
  useDashboardKpis,
  usePipelineByStage,
  useRevenueTrend,
  useWinRate,
  useActivityByType,
  useRecentActivities,
  useUpcomingTasks,
  useDealsClosingThisMonth,
} from "@/hooks/use-dashboard-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const fmt = (v: number) =>
  v >= 1000000
    ? `£${(v / 1000000).toFixed(1)}M`
    : v >= 1000
    ? `£${(v / 1000).toFixed(0)}K`
    : `£${v.toFixed(0)}`;

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(199, 89%, 48%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(270, 60%, 55%)",
];

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpisLoading } = useDashboardKpis();
  const { data: pipeline } = usePipelineByStage();
  const { data: revenue } = useRevenueTrend();
  const { data: winRate } = useWinRate();
  const { data: activityByType } = useActivityByType();
  const { data: recentActivities } = useRecentActivities();
  const { data: upcomingTasks } = useUpcomingTasks();
  const { data: closingDeals } = useDealsClosingThisMonth();

  const winRateData = winRate
    ? [
        { name: "Won", value: winRate.won },
        { name: "Lost", value: winRate.lost },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your CRM performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Open Pipeline"
          value={kpis ? fmt(kpis.openPipeline) : undefined}
          loading={kpisLoading}
          icon={<Target className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Weighted Pipeline"
          value={kpis ? fmt(kpis.weightedPipeline) : undefined}
          loading={kpisLoading}
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
        />
        <KpiCard
          title="Revenue This Month"
          value={kpis ? fmt(kpis.revenueThisMonth) : undefined}
          loading={kpisLoading}
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          change={kpis?.revenueChange}
        />
        <KpiCard
          title="Overdue Invoices"
          value={
            kpis ? `${kpis.overdueCount} (${fmt(kpis.overdueValue)})` : undefined
          }
          loading={kpisLoading}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          variant="destructive"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pipeline || []}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="stage" width={90} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="hsl(221, 83%, 53%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Win Rate (Last 90 Days)
              {winRate && (
                <Badge variant="outline" className="ml-2 font-mono">
                  {winRate.rate}%
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex items-center justify-center">
            {winRate && winRate.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={winRateData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="hsl(142, 71%, 45%)" />
                    <Cell fill="hsl(0, 84%, 60%)" />
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                No closed opportunities in the last 90 days
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Activity by Type (30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityByType || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="type" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-80 overflow-y-auto">
            {(recentActivities ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activities</p>
            )}
            {(recentActivities ?? []).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">
                  {ACTIVITY_ICONS[a.type] || <Mail className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.subject || a.type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.crm_contacts
                      ? `${a.crm_contacts.first_name} ${a.crm_contacts.last_name}`
                      : a.crm_companies?.name || ""}
                    {a.created_at &&
                      ` · ${formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}`}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0"
                >
                  {a.direction === "inbound" ? "IN" : "OUT"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-80 overflow-y-auto">
            {(upcomingTasks ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming tasks this week</p>
            )}
            {(upcomingTasks ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.subject || t.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.scheduled_at && format(new Date(t.scheduled_at), "EEE, dd MMM HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Deals Closing This Month */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Closing This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-80 overflow-y-auto">
            {(closingDeals ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No deals closing this month</p>
            )}
            {(closingDeals ?? []).map((d: any) => (
              <div
                key={d.id}
                className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded p-1 -m-1"
                onClick={() => navigate(`/crm/opportunities/${d.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.crm_companies?.name} · {d.expected_close_date && format(new Date(d.expected_close_date), "dd MMM")}
                  </p>
                </div>
                <span className="text-sm font-mono font-medium text-foreground shrink-0">
                  {fmt(d.value || 0)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  loading,
  icon,
  change,
  variant,
}: {
  title: string;
  value?: string;
  loading?: boolean;
  icon: React.ReactNode;
  change?: number;
  variant?: "destructive";
}) {
  return (
    <Card className={variant === "destructive" ? "border-destructive/30" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-foreground">{value}</span>
            {change !== undefined && (
              <span
                className={`text-xs font-medium flex items-center gap-0.5 ${
                  change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {change >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(change).toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

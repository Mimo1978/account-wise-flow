import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Download, Eye, FileBarChart } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { exportToCsv } from '@/lib/csv-export';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter } from 'date-fns';
import { toast } from 'sonner';

export type ReportType = 'pipeline' | 'projects' | 'recruitment' | 'billing' | 'outreach';

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { value: 'pipeline', label: 'Pipeline Report', description: 'All deals by stage with values and close dates' },
  { value: 'projects', label: 'Projects Report', description: 'Active projects with health, forecast, open tasks' },
  { value: 'recruitment', label: 'Recruitment Report', description: 'Active jobs, shortlist counts, placement stats' },
  { value: 'billing', label: 'Billing Report', description: 'Outstanding, overdue, paid invoices for date range' },
  { value: 'outreach', label: 'Outreach Report', description: 'Queued, sent, response rates, booking rates' },
];

type DateRange = 'this_month' | 'last_month' | 'this_quarter' | 'custom';
type OutputFormat = 'screen' | 'csv';

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  switch (range) {
    case 'this_month':
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
    case 'last_month': {
      const prev = subMonths(now, 1);
      return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(endOfMonth(prev), 'yyyy-MM-dd') };
    }
    case 'this_quarter':
      return { from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd') };
    default:
      return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') };
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedType?: ReportType;
  autoDownload?: boolean;
}

export function ReportBuilderPanel({ open, onOpenChange, preselectedType, autoDownload }: Props) {
  const { currentWorkspace } = useWorkspace();
  const [reportType, setReportType] = useState<ReportType>(preselectedType ?? 'pipeline');
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('screen');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any>[] | null>(null);
  const [resultColumns, setResultColumns] = useState<string[]>([]);

  // Sync preselectedType when it changes
  useMemo(() => {
    if (preselectedType) setReportType(preselectedType);
  }, [preselectedType]);

  const wsId = currentWorkspace?.id;

  const generateReport = async () => {
    if (!wsId) { toast.error('No workspace selected'); return; }
    setLoading(true);
    setResults(null);

    try {
      const { from, to } = getDateRange(dateRange);
      let rows: Record<string, any>[] = [];

      switch (reportType) {
        case 'pipeline': {
          const { data } = await supabase
            .from('crm_deals')
            .select('title, stage, value, currency, probability, expected_close_date')
            .eq('workspace_id', wsId)
            .order('stage') as { data: any[] | null };
          rows = (data ?? []).map((d) => ({
            Deal: d.title,
            Stage: d.stage,
            Value: `${d.currency} ${Number(d.value).toLocaleString()}`,
            Probability: `${d.probability}%`,
            'Close Date': d.expected_close_date ? format(new Date(d.expected_close_date), 'dd MMM yyyy') : '—',
          }));
          break;
        }
        case 'projects': {
          const query = supabase
            .from('engagements')
            .select('id, name, status, health, forecast_value, forecast_currency')
            .eq('workspace_id', wsId);
          const { data } = await (query as any).eq('status', 'active');
          rows = ((data as any[]) ?? []).map((d) => ({
            Project: d.name,
            Health: d.health ?? '—',
            'Forecast Value': d.forecast_value ? `${d.forecast_currency ?? 'GBP'} ${Number(d.forecast_value).toLocaleString()}` : '—',
            Status: d.status,
          }));
          break;
        }
        case 'recruitment': {
          const { data } = await supabase
            .from('jobs')
            .select('id, title, status, company, location')
            .eq('workspace_id', wsId)
            .eq('status', 'active') as { data: any[] | null };
          rows = (data ?? []).map((d) => ({
            'Job Title': d.title,
            Company: d.company ?? '—',
            Location: d.location ?? '—',
            Status: d.status,
          }));
          break;
        }
        case 'billing': {
          const { data } = await supabase
            .from('invoices')
            .select('invoice_number, company_name, total, currency, status, due_date, paid_date')
            .eq('workspace_id', wsId)
            .gte('due_date', from)
            .lte('due_date', to)
            .order('due_date') as { data: any[] | null };
          rows = (data ?? []).map((d) => ({
            Invoice: d.invoice_number ?? '—',
            Company: d.company_name ?? '—',
            Total: `${d.currency ?? 'GBP'} ${Number(d.total ?? 0).toLocaleString()}`,
            Status: d.status,
            'Due Date': d.due_date ? format(new Date(d.due_date), 'dd MMM yyyy') : '—',
            'Paid Date': d.paid_date ? format(new Date(d.paid_date), 'dd MMM yyyy') : '—',
          }));
          break;
        }
        case 'outreach': {
          const { data } = await supabase
            .from('outreach_targets')
            .select('id, name, status, channel')
            .eq('workspace_id', wsId) as { data: any[] | null };
          const targets = data ?? [];
          const queued = targets.filter((t) => t.status === 'draft').length;
          const contacted = targets.filter((t: any) => t.status === 'sent').length;
          const responded = targets.filter((t: any) => ['replied', 'interested', 'not_interested'].includes(t.status)).length;
          const responseRate = contacted > 0 ? ((responded / contacted) * 100).toFixed(1) : '0';
          rows = [
            { Metric: 'Queued', Count: queued },
            { Metric: 'Contacted', Count: contacted },
            { Metric: 'Responded', Count: responded },
            { Metric: 'Response Rate', Count: `${responseRate}%` },
          ];
          break;
        }
      }

      if (rows.length === 0) {
        toast.info('No data found for the selected criteria');
        setResults([]);
        setResultColumns([]);
      } else {
        setResultColumns(Object.keys(rows[0]));
        setResults(rows);
      }

      // Handle output
      if (outputFormat === 'csv' || autoDownload) {
        const filename = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        exportToCsv(filename, rows);
        toast.success(`Downloaded ${filename}`);
      }
    } catch (err) {
      console.error('Report generation failed:', err);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-primary" />
            Report Builder
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Report Type */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">Report Type</Label>
              <RadioGroup value={reportType} onValueChange={(v) => setReportType(v as ReportType)} className="space-y-2">
                {REPORT_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={opt.value} id={`report-${opt.value}`} className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor={`report-${opt.value}`} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Output Format */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Output Format</Label>
              <RadioGroup value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="screen" id="out-screen" />
                  <Label htmlFor="out-screen" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> View on Screen
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="out-csv" />
                  <Label htmlFor="out-csv" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download CSV
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Generate Button */}
            <Button onClick={generateReport} disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
              Generate Report
            </Button>

            {/* Results Table */}
            {results !== null && results.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {resultColumns.map((col) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((row, i) => (
                        <TableRow key={i}>
                          {resultColumns.map((col) => (
                            <TableCell key={col} className="text-xs whitespace-nowrap">{row[col]}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {outputFormat === 'screen' && (
                  <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{results.length} rows</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        exportToCsv(`${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`, results);
                        toast.success('CSV downloaded');
                      }}
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </Button>
                  </div>
                )}
              </div>
            )}

            {results !== null && results.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">No data found for the selected criteria.</div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

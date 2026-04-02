import { useState, useEffect } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Copy, Check, RefreshCw, Loader2, ShieldAlert, ArrowLeft, Database } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

interface ForeignKey {
  column: string;
  references_table: string;
  references_column: string;
  constraint_name: string;
}

interface UniqueConstraint {
  constraint_name: string;
  columns: string[];
}

interface IndexInfo {
  index_name: string;
  index_def: string;
}

interface TableSchema {
  table_name: string;
  columns: ColumnInfo[];
  primary_keys: string[] | null;
  foreign_keys: ForeignKey[] | null;
  unique_constraints: UniqueConstraint[] | null;
  indexes: IndexInfo[] | null;
}

interface SchemaData {
  tables: TableSchema[];
}

function AdminNav() {
  const { isAdmin } = usePermissions();
  const location = useLocation();

  if (!isAdmin) return null;

  const tabs = [
    { label: 'Top Tier Companies', path: '/workspace-settings' },
    { label: 'Schema Inventory', path: '/admin/schema', icon: Database },
  ];

  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function SchemaInventory() {
  const { isAdmin, isLoading: permLoading } = usePermissions();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTables, setOpenTables] = useState<Set<string>>(new Set());
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  useEffect(() => {
    if (!permLoading && !isAdmin) {
      toast.error("Admin access required");
      navigate("/workspace-settings", { replace: true });
    }
  }, [permLoading, isAdmin, navigate]);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error: rpcError } = await supabase.rpc("execute_schema_inventory" as any);
      if (rpcError) throw rpcError;
      setSchema(data as unknown as SchemaData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch schema");
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (name: string) => {
    setOpenTables((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const copyTableJson = (table: TableSchema) => {
    navigator.clipboard.writeText(JSON.stringify(table, null, 2));
    setCopiedTable(table.table_name);
    toast.success(`Copied ${table.table_name} schema`);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <AdminNav />

        <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schema Inventory</h1>
          <p className="text-sm text-muted-foreground">Dev-only database schema reference</p>
        </div>
        <Button onClick={fetchSchema} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {schema ? "Refresh" : "Load Schema"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4 text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {schema?.tables?.map((table) => (
        <Card key={table.table_name}>
          <Collapsible open={openTables.has(table.table_name)} onOpenChange={() => toggleTable(table.table_name)}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
                  {openTables.has(table.table_name) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base font-mono">{table.table_name}</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {table.columns?.length || 0} cols
                  </Badge>
                </CollapsibleTrigger>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); copyTableJson(table); }}
                >
                  {copiedTable === table.table_name ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Columns */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1.5 pr-3">#</th>
                        <th className="py-1.5 pr-3">Column</th>
                        <th className="py-1.5 pr-3">Type</th>
                        <th className="py-1.5 pr-3">Nullable</th>
                        <th className="py-1.5">Default</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {table.columns?.map((col) => (
                        <tr key={col.column_name} className="border-b border-border/50">
                          <td className="py-1 pr-3 text-muted-foreground">{col.ordinal_position}</td>
                          <td className="py-1 pr-3 font-medium">
                            {col.column_name}
                            {table.primary_keys?.includes(col.column_name) && (
                              <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">PK</Badge>
                            )}
                            {table.foreign_keys?.some((fk) => fk.column === col.column_name) && (
                              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">FK</Badge>
                            )}
                          </td>
                          <td className="py-1 pr-3 text-muted-foreground">{col.data_type}</td>
                          <td className="py-1 pr-3">{col.is_nullable === "YES" ? "✓" : "✗"}</td>
                          <td className="py-1 text-muted-foreground truncate max-w-[200px]">
                            {col.column_default || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Foreign Keys */}
                {table.foreign_keys && table.foreign_keys.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Foreign Keys</p>
                    <div className="space-y-0.5 text-xs font-mono">
                      {table.foreign_keys.map((fk) => (
                        <div key={fk.constraint_name}>
                          {fk.column} → {fk.references_table}.{fk.references_column}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unique Constraints */}
                {table.unique_constraints && table.unique_constraints.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Unique Constraints</p>
                    <div className="space-y-0.5 text-xs font-mono">
                      {table.unique_constraints.map((uc) => (
                        <div key={uc.constraint_name}>
                          {uc.constraint_name}: ({uc.columns?.join(", ")})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Indexes */}
                {table.indexes && table.indexes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Indexes</p>
                    <div className="space-y-0.5 text-xs font-mono text-muted-foreground">
                      {table.indexes.map((idx) => (
                        <div key={idx.index_name} className="truncate" title={idx.index_def}>
                          {idx.index_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {schema && (!schema.tables || schema.tables.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">No tables found.</p>
      )}
     </div>
      </div>
    </div>
  );
}

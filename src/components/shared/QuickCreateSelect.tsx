import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Search, Loader2, Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export interface QuickCreateField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email" | "tel";
}

interface QuickCreateSelectProps {
  table: "crm_companies" | "crm_contacts";
  value: string | null;
  onChange: (id: string, record: any) => void;
  companyId?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
  quickCreateFields: QuickCreateField[];
  quickCreateHint?: string;
  disabled?: boolean;
  error?: string;
  "data-jarvis-id"?: string;
}

interface OptionItem {
  id: string;
  label: string;
  sublabel?: string;
}

export function QuickCreateSelect({
  table,
  value,
  onChange,
  companyId,
  placeholder = "Search…",
  label,
  required,
  quickCreateFields,
  quickCreateHint,
  disabled,
  error,
  ...props
}: QuickCreateSelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickForm, setQuickForm] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Resolve selected label
  useEffect(() => {
    if (!value) { setSelectedLabel(""); return; }
    const resolveLabel = async () => {
      if (table === "crm_companies") {
        const { data } = await supabase.from("crm_companies" as any).select("id, name").eq("id", value).single();
        if (data) setSelectedLabel((data as any).name);
      } else {
        const { data } = await supabase.from("crm_contacts" as any).select("id, first_name, last_name").eq("id", value).single();
        if (data) setSelectedLabel(`${(data as any).first_name} ${(data as any).last_name}`);
      }
    };
    resolveLabel();
  }, [value, table]);

  // Search with debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (table === "crm_companies") {
          let q = supabase.from("crm_companies" as any)
            .select("id, name, industry")
            .is("deleted_at", null)
            .order("name", { ascending: true })
            .limit(20);
          if (search) q = q.ilike("name", `%${search}%`);
          const { data } = await q;
          setOptions((data ?? []).map((c: any) => ({
            id: c.id, label: c.name, sublabel: c.industry
          })));
        } else {
          let q = supabase.from("crm_contacts" as any)
            .select("id, first_name, last_name, job_title, company_id")
            .is("deleted_at", null)
            .order("last_name", { ascending: true })
            .limit(20);
          if (companyId) q = q.eq("company_id", companyId);
          if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
          const { data } = await q;
          setOptions((data ?? []).map((c: any) => ({
            id: c.id, label: `${c.first_name} ${c.last_name}`, sublabel: c.job_title
          })));
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [search, isOpen, table, companyId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    return options.some(o => o.label.toLowerCase() === search.toLowerCase());
  }, [options, search]);

  const handleSelect = (opt: OptionItem) => {
    onChange(opt.id, opt);
    setSelectedLabel(opt.label);
    setSearch("");
    setIsOpen(false);
    setShowQuickCreate(false);
  };

  const handleClear = () => {
    onChange("", null);
    setSelectedLabel("");
    setSearch("");
  };

  const handleQuickCreate = async () => {
    setCreating(true);
    try {
      if (table === "crm_companies") {
        const nameField = quickCreateFields.find(f => f.key === "name");
        const payload: any = {
          name: quickForm.name || search,
          industry: quickForm.industry || null,
          website: quickForm.website || null,
        };
        const { data, error: err } = await supabase.from("crm_companies" as any).insert(payload).select().single();
        if (err) throw err;
        const record = data as any;
        onChange(record.id, record);
        setSelectedLabel(record.name);
        setSuccessMsg(`✓ ${record.name} added — complete details in Companies later`);
        qc.invalidateQueries({ queryKey: ["crm_companies"] });
      } else {
        const nameParts = (quickForm.name || search).trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const payload: any = {
          first_name: firstName,
          last_name: lastName || firstName,
          job_title: quickForm.job_title || null,
          email: quickForm.email || null,
          phone: quickForm.phone || null,
          company_id: companyId || null,
        };
        const { data, error: err } = await supabase.from("crm_contacts" as any).insert(payload).select().single();
        if (err) throw err;
        const record = data as any;
        onChange(record.id, record);
        setSelectedLabel(`${record.first_name} ${record.last_name}`);
        setSuccessMsg(`✓ ${record.first_name} ${record.last_name} added`);
        qc.invalidateQueries({ queryKey: ["crm_contacts"] });
      }
      setShowQuickCreate(false);
      setIsOpen(false);
      setQuickForm({});
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Quick create error:", err);
    } finally {
      setCreating(false);
    }
  };

  const openQuickCreate = () => {
    const nameKey = table === "crm_companies" ? "name" : "name";
    setQuickForm({ [nameKey]: search });
    setShowQuickCreate(true);
  };

  const isCompany = table === "crm_companies";
  const Icon = isCompany ? Building2 : User;

  return (
    <div ref={containerRef} className="relative" data-jarvis-id={props["data-jarvis-id"]}>
      {label && (
        <Label className="mb-1.5 block">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}

      {/* Selected state */}
      {value && selectedLabel && !isOpen ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="flex-1 truncate">{selectedLabel}</span>
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="pl-8"
            disabled={disabled}
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !showQuickCreate && (
        <div className="absolute z-[9999] mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                value === opt.id && "bg-accent"
              )}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{opt.label}</p>
                {opt.sublabel && <p className="text-xs text-muted-foreground truncate">{opt.sublabel}</p>}
              </div>
              {value === opt.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>
          ))}
          {!loading && options.length === 0 && search.trim() && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No results for "{search}"
            </div>
          )}
          {!loading && search.trim() && !hasExactMatch && (
            <>
              <div className="border-t border-border" />
              <button
                type="button"
                onClick={openQuickCreate}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create "{search}" as a new {isCompany ? "company" : "contact"} →</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Inline quick-create form */}
      {showQuickCreate && (
        <div className="mt-2 rounded-lg border border-primary/30 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Plus className="h-4 w-4 text-primary" />
            Quick-add {isCompany ? "company" : "contact"}
          </div>
          {quickCreateFields.map(field => (
            <div key={field.key}>
              <Label className="text-xs">{field.label} {field.required && "*"}</Label>
              <Input
                type={field.type || "text"}
                placeholder={field.placeholder}
                value={quickForm[field.key] || ""}
                onChange={e => setQuickForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
          ))}
          {quickCreateHint && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span>💡</span>
              <span>{quickCreateHint}</span>
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              onClick={handleQuickCreate}
              disabled={creating || !(quickForm.name?.trim())}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Add {isCompany ? "company" : "contact"} & continue
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowQuickCreate(false); setQuickForm({}); }}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <Badge variant="outline" className="mt-1.5 text-xs border-green-500/30 text-green-600 dark:text-green-400 bg-green-500/10">
          {successMsg}
        </Badge>
      )}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Pre-configured field sets
export const COMPANY_QUICK_FIELDS: QuickCreateField[] = [
  { key: "name", label: "Company name", placeholder: "e.g. HSBC", required: true },
  { key: "industry", label: "Industry", placeholder: "e.g. Financial Services" },
  { key: "website", label: "Website", placeholder: "e.g. hsbc.com" },
];

export const CONTACT_QUICK_FIELDS: QuickCreateField[] = [
  { key: "name", label: "Full name", placeholder: "e.g. Mike Hodges", required: true },
  { key: "job_title", label: "Job title", placeholder: "e.g. Head of Technology" },
  { key: "email", label: "Email", placeholder: "e.g. mike@company.com", type: "email" },
  { key: "phone", label: "Phone", placeholder: "e.g. +44 20 7123 4567", type: "tel" },
];

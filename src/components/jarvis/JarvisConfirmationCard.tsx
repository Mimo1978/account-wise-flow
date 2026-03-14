import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmCardData {
  cardType: "company" | "contact" | "deal" | "project" | "opportunity";
  fields: Record<string, string>;
  /** Pre-resolved IDs from the AI (e.g. company_id for a contact card) */
  resolvedIds?: Record<string, string>;
}

interface Props {
  card: ConfirmCardData;
  onSave: (finalFields: Record<string, string>, resolvedIds?: Record<string, string>) => void;
  onCancel: () => void;
}

const COMPANY_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "industry", label: "Industry" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "website", label: "Website" },
];

const CONTACT_FIELDS = [
  { key: "first_name", label: "First name", required: true },
  { key: "last_name", label: "Last name", required: true },
  { key: "job_title", label: "Job title" },
  { key: "company_name", label: "Company", isCompanySearch: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

const DEAL_FIELDS = [
  { key: "title", label: "Deal name", required: true },
  { key: "company_name", label: "Company", isCompanySearch: true },
  { key: "value", label: "Value" },
  { key: "currency", label: "Currency" },
  { key: "stage", label: "Stage" },
];

const PROJECT_FIELDS = [
  { key: "name", label: "Project name", required: true },
  { key: "company_name", label: "Company", isCompanySearch: true },
  { key: "project_type", label: "Type" },
  { key: "description", label: "Description" },
];

const OPPORTUNITY_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "company_name", label: "Company", isCompanySearch: true },
  { key: "value", label: "Value" },
  { key: "stage", label: "Stage" },
];

function getFieldConfig(cardType: string) {
  switch (cardType) {
    case "company": return COMPANY_FIELDS;
    case "contact": return CONTACT_FIELDS;
    case "deal": return DEAL_FIELDS;
    case "project": return PROJECT_FIELDS;
    case "opportunity": return OPPORTUNITY_FIELDS;
    default: return [];
  }
}

function getCardTitle(cardType: string) {
  const titles: Record<string, string> = {
    company: "New company",
    contact: "New contact",
    deal: "New deal",
    project: "New project",
    opportunity: "New opportunity",
  };
  return titles[cardType] || "New record";
}

/* ---- Company search dropdown ---- */
function CompanySearchInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (id: string, name: string) => void;
}) {
  const [results, setResults] = useState<{ id: string; name: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("companies" as any)
      .select("id, name")
      .ilike("name", `%${query}%`)
      .is("deleted_at", null)
      .limit(5);
    setResults((data as any[]) ?? []);
    setSearching(false);
    setShowDropdown(true);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, doSearch]);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 2 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="h-8 text-xs bg-[#0F1117] border-[#2D3748] text-white pr-7"
        />
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 rounded-md bg-[#1A1F2E] border border-[#2D3748] shadow-lg max-h-32 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-primary/20 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(r.id, r.name);
                setShowDropdown(false);
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      {searching && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function JarvisConfirmationCard({ card, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<Record<string, string>>(card.fields);
  const [resolvedIds, setResolvedIds] = useState<Record<string, string>>(card.resolvedIds || {});
  const [saving, setSaving] = useState(false);

  const fieldConfig = getFieldConfig(card.cardType);

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompanySelect = (id: string, name: string) => {
    setFields((prev) => ({ ...prev, company_name: name }));
    setResolvedIds((prev) => ({ ...prev, company_id: id }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(fields, resolvedIds);
    } finally {
      setSaving(false);
    }
  };

  const hasRequiredFields = fieldConfig
    .filter((f) => f.required)
    .every((f) => fields[f.key]?.trim());

  return (
    <div className="rounded-[10px] border border-[#2D3748] bg-[#1A1F2E] p-4 w-full max-w-[340px]">
      <p className="text-xs font-semibold text-white mb-3">
        {getCardTitle(card.cardType)}
      </p>
      <div className="h-px bg-[#2D3748] mb-3" />

      <div className="space-y-2">
        {fieldConfig.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground w-20 shrink-0 text-right">
              {f.label}:
            </label>
            {(f as any).isCompanySearch ? (
              <CompanySearchInput
                value={fields[f.key] || ""}
                onChange={(v) => updateField(f.key, v)}
                onSelect={handleCompanySelect}
              />
            ) : (
              <Input
                value={fields[f.key] || ""}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="h-8 text-xs bg-[#0F1117] border-[#2D3748] text-white"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-white"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={saving || !hasRequiredFields}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Check className="h-3 w-3 mr-1" />
          )}
          Save →
        </Button>
      </div>
    </div>
  );
}

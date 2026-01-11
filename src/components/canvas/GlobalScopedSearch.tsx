import { useState, useMemo, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Account, Contact, Talent } from "@/lib/types";
import { mockAccounts } from "@/lib/mock-data";
import { mockTalents } from "@/lib/mock-talent";
import {
  Search,
  User,
  Building2,
  Briefcase,
  Users,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchScope = "contacts" | "companies" | "candidates" | "contractors" | "everything";

interface SearchResult {
  type: "contact" | "company" | "candidate" | "contractor";
  id: string;
  title: string;
  subtitle: string;
  company?: string;
  data: Contact | Account | Talent;
}

interface GlobalScopedSearchProps {
  currentAccount?: Account;
  allAccounts?: Account[];
  onSelectContact?: (contact: Contact, companyId?: string) => void;
  onSelectCompany?: (company: Account) => void;
  onSelectTalent?: (talent: Talent) => void;
  onScopeChange?: (scope: SearchScope) => void;
  onQueryChange?: (query: string) => void;
  externalQuery?: string;
  className?: string;
}

const scopeLabels: Record<SearchScope, string> = {
  contacts: "Contacts",
  companies: "Companies",
  candidates: "Candidates",
  contractors: "Contractors",
  everything: "Everything",
};

const scopeIcons: Record<SearchScope, React.ReactNode> = {
  contacts: <User className="h-3.5 w-3.5" />,
  companies: <Building2 className="h-3.5 w-3.5" />,
  candidates: <Briefcase className="h-3.5 w-3.5" />,
  contractors: <Users className="h-3.5 w-3.5" />,
  everything: <Layers className="h-3.5 w-3.5" />,
};

const resultTypeColors: Record<string, string> = {
  contact: "bg-blue-500/20 text-blue-400",
  company: "bg-green-500/20 text-green-400",
  candidate: "bg-purple-500/20 text-purple-400",
  contractor: "bg-orange-500/20 text-orange-400",
};

export const GlobalScopedSearch = ({
  currentAccount,
  allAccounts = mockAccounts,
  onSelectContact,
  onSelectCompany,
  onSelectTalent,
  onScopeChange,
  onQueryChange,
  externalQuery,
  className,
}: GlobalScopedSearchProps) => {
  const [scope, setScope] = useState<SearchScope>("contacts");
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = (newQuery: string) => {
    setInternalQuery(newQuery);
    onQueryChange?.(newQuery);
  };
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search across all datasets
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const searchLower = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search contacts
    if (scope === "contacts" || scope === "everything") {
      allAccounts.forEach((account) => {
        account.contacts.forEach((contact) => {
          if (
            contact.name.toLowerCase().includes(searchLower) ||
            contact.title.toLowerCase().includes(searchLower) ||
            contact.department.toLowerCase().includes(searchLower) ||
            (contact.email?.toLowerCase().includes(searchLower) ?? false)
          ) {
            results.push({
              type: "contact",
              id: contact.id,
              title: contact.name,
              subtitle: `${contact.title} • ${contact.department}`,
              company: account.name,
              data: contact,
            });
          }
        });
      });
    }

    // Search companies
    if (scope === "companies" || scope === "everything") {
      allAccounts.forEach((account) => {
        if (
          account.name.toLowerCase().includes(searchLower) ||
          account.industry.toLowerCase().includes(searchLower)
        ) {
          results.push({
            type: "company",
            id: account.id,
            title: account.name,
            subtitle: `${account.industry} • ${account.contacts.length} contacts`,
            data: account,
          });
        }
      });
    }

    // Search candidates (talents with specific availability)
    if (scope === "candidates" || scope === "everything") {
      mockTalents
        .filter((t) => t.availability !== "deployed")
        .forEach((talent) => {
          if (
            talent.name.toLowerCase().includes(searchLower) ||
            talent.roleType.toLowerCase().includes(searchLower) ||
            talent.skills.some((s) => s.toLowerCase().includes(searchLower))
          ) {
            results.push({
              type: "candidate",
              id: talent.id,
              title: talent.name,
              subtitle: `${talent.roleType} • ${talent.availability}`,
              data: talent,
            });
          }
        });
    }

    // Search contractors (deployed talents)
    if (scope === "contractors" || scope === "everything") {
      mockTalents
        .filter((t) => t.availability === "deployed")
        .forEach((talent) => {
          if (
            talent.name.toLowerCase().includes(searchLower) ||
            talent.roleType.toLowerCase().includes(searchLower) ||
            talent.skills.some((s) => s.toLowerCase().includes(searchLower))
          ) {
            results.push({
              type: "contractor",
              id: talent.id,
              title: talent.name,
              subtitle: `${talent.roleType} • Deployed`,
              data: talent,
            });
          }
        });
    }

    return results.slice(0, 20); // Limit results
  }, [query, scope, allAccounts]);

  // Group results by type for "Everything" scope
  const groupedResults = useMemo(() => {
    if (scope !== "everything") return null;

    const groups: Record<string, SearchResult[]> = {};
    searchResults.forEach((result) => {
      if (!groups[result.type]) {
        groups[result.type] = [];
      }
      groups[result.type].push(result);
    });
    return groups;
  }, [searchResults, scope]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        handleSelect(searchResults[selectedIndex]);
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    switch (result.type) {
      case "contact":
        const account = allAccounts.find((a) =>
          a.contacts.some((c) => c.id === result.id)
        );
        onSelectContact?.(result.data as Contact, account?.id);
        break;
      case "company":
        onSelectCompany?.(result.data as Account);
        break;
      case "candidate":
      case "contractor":
        onSelectTalent?.(result.data as Talent);
        break;
    }
    setIsOpen(false);
    setQuery("");
  };

  const handleScopeChange = (newScope: SearchScope) => {
    setScope(newScope);
    onScopeChange?.(newScope);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const getPlaceholder = () => {
    switch (scope) {
      case "contacts":
        return "Search contacts...";
      case "companies":
        return "Search companies...";
      case "candidates":
        return "Search candidates...";
      case "contractors":
        return "Search contractors...";
      case "everything":
        return "Search contacts, companies, candidates, contractors…";
    }
  };

  const renderResults = () => {
    if (scope === "everything" && groupedResults) {
      const typeLabels: Record<string, string> = {
        contact: "Contacts",
        company: "Companies",
        candidate: "Candidates",
        contractor: "Contractors",
      };

      return Object.entries(groupedResults).map(([type, items]) => (
        <div key={type}>
          <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
            {typeLabels[type]}
          </div>
          {items.map((result, idx) => {
            const globalIndex = searchResults.findIndex((r) => r.id === result.id && r.type === result.type);
            return renderResultItem(result, globalIndex);
          })}
        </div>
      ));
    }

    return searchResults.map((result, idx) => renderResultItem(result, idx));
  };

  const renderResultItem = (result: SearchResult, index: number) => (
    <div
      key={`${result.type}-${result.id}`}
      className={cn(
        "px-3 py-2 cursor-pointer transition-colors flex items-center gap-3",
        index === selectedIndex ? "bg-accent" : "hover:bg-muted/50"
      )}
      onClick={() => handleSelect(result)}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <Badge
        variant="secondary"
        className={cn("text-xs capitalize shrink-0", resultTypeColors[result.type])}
      >
        {result.type}
      </Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{result.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {result.subtitle}
          {result.company && ` • ${result.company}`}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-0 border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        {/* Scope Selector */}
        <Select value={scope} onValueChange={(v) => handleScopeChange(v as SearchScope)}>
          <SelectTrigger className="w-auto min-w-[130px] border-0 rounded-r-none bg-muted/50 focus:ring-0 focus:ring-offset-0 gap-1.5 text-xs">
            {scopeIcons[scope]}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(scopeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-sm">
                <span className="flex items-center gap-2">
                  {scopeIcons[value as SearchScope]}
                  {label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={getPlaceholder()}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setSelectedIndex(0);
            }}
            onFocus={() => query && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="border-0 pl-10 pr-8 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {isOpen && query && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <ScrollArea className="max-h-[350px]">
            {renderResults()}
          </ScrollArea>
        </div>
      )}

      {/* No Results */}
      {isOpen && query && searchResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
          No results found for "{query}" in {scopeLabels[scope].toLowerCase()}
        </div>
      )}
    </div>
  );
};

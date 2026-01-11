import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, Building2, User, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { mockAccounts } from "@/lib/mock-data";
import { Account, Contact } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: "company" | "contact" | "note";
  id: string;
  title: string;
  subtitle: string;
  company?: Account;
  contact?: Contact;
  companyId?: string;
}

interface GlobalSearchProps {
  onSelectCompany: (account: Account) => void;
  onSelectContact: (contact: Contact, account: Account) => void;
}

export const GlobalSearch = ({ onSelectCompany, onSelectContact }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const searchAll = useCallback((searchQuery: string): SearchResult[] => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    mockAccounts.forEach((account) => {
      // Search companies
      if (
        account.name.toLowerCase().includes(query) ||
        account.industry.toLowerCase().includes(query)
      ) {
        results.push({
          type: "company",
          id: account.id,
          title: account.name,
          subtitle: account.industry,
          company: account,
        });
      }

      // Search contacts
      account.contacts.forEach((contact) => {
        const matchesName = contact.name.toLowerCase().includes(query);
        const matchesTitle = contact.title.toLowerCase().includes(query);
        const matchesDepartment = contact.department.toLowerCase().includes(query);
        const matchesEmail = contact.email.toLowerCase().includes(query);
        const matchesTags = contact.tags?.some((tag) =>
          tag.toLowerCase().includes(query)
        );

        if (matchesName || matchesTitle || matchesDepartment || matchesEmail || matchesTags) {
          results.push({
            type: "contact",
            id: contact.id,
            title: contact.name,
            subtitle: `${contact.title} at ${account.name}`,
            contact: contact,
            company: account,
            companyId: account.id,
          });
        }

        // Search notes within contacts
        contact.notes?.forEach((note) => {
          if (note.content.toLowerCase().includes(query)) {
            results.push({
              type: "note",
              id: note.id,
              title: `Note on ${contact.name}`,
              subtitle: note.content.slice(0, 60) + (note.content.length > 60 ? "..." : ""),
              contact: contact,
              company: account,
              companyId: account.id,
            });
          }
        });

        // Search activities within contacts
        contact.activities?.forEach((activity) => {
          if (activity.description.toLowerCase().includes(query)) {
            results.push({
              type: "note",
              id: activity.id,
              title: `Activity: ${contact.name}`,
              subtitle: activity.description.slice(0, 60) + (activity.description.length > 60 ? "..." : ""),
              contact: contact,
              company: account,
              companyId: account.id,
            });
          }
        });
      });
    });

    return results.slice(0, 10); // Limit to 10 results
  }, []);

  useEffect(() => {
    const searchResults = searchAll(query);
    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, searchAll]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case "Enter":
        e.preventDefault();
        handleSelect(results[selectedIndex]);
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    if (result.type === "company" && result.company) {
      onSelectCompany(result.company);
    } else if ((result.type === "contact" || result.type === "note") && result.contact && result.company) {
      onSelectContact(result.contact, result.company);
    }
    setQuery("");
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "company":
        return <Building2 className="w-4 h-4 text-muted-foreground" />;
      case "contact":
        return <User className="w-4 h-4 text-muted-foreground" />;
      case "note":
        return <StickyNote className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const groupedResults = {
    company: results.filter((r) => r.type === "company"),
    contact: results.filter((r) => r.type === "contact"),
    note: results.filter((r) => r.type === "note"),
  };

  const getResultIndex = (type: SearchResult["type"], indexInGroup: number): number => {
    let offset = 0;
    if (type === "contact") offset = groupedResults.company.length;
    if (type === "note") offset = groupedResults.company.length + groupedResults.contact.length;
    return offset + indexInGroup;
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search everything…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-8 w-64 h-9 text-sm bg-muted/50 border-border/50 focus:bg-background"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto"
        >
          {groupedResults.company.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border/50">
                Companies
              </div>
              {groupedResults.company.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(getResultIndex("company", index))}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/80 transition-colors",
                    selectedIndex === getResultIndex("company", index) && "bg-muted"
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {groupedResults.contact.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border/50">
                Contacts
              </div>
              {groupedResults.contact.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(getResultIndex("contact", index))}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/80 transition-colors",
                    selectedIndex === getResultIndex("contact", index) && "bg-muted"
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {groupedResults.note.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border/50">
                Notes & Activities
              </div>
              {groupedResults.note.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(getResultIndex("note", index))}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/80 transition-colors",
                    selectedIndex === getResultIndex("note", index) && "bg-muted"
                  )}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{result.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No results found for "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

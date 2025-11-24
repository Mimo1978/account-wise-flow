import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Company {
  id: string;
  name: string;
  industry: string;
}

interface CompanySwitcherProps {
  currentCompany: string;
  onCompanySelect: (company: Company) => void;
}

// Mock companies for demonstration
const mockCompanies: Company[] = [
  { id: "1", name: "ACME Corp", industry: "Technology" },
  { id: "2", name: "TechStart Inc", industry: "Software" },
  { id: "3", name: "Global Solutions", industry: "Consulting" },
  { id: "4", name: "Innovation Labs", industry: "R&D" },
  { id: "5", name: "Enterprise Systems", industry: "IT Services" },
];

export const CompanySwitcher = ({ currentCompany, onCompanySelect }: CompanySwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>(mockCompanies);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        setFilteredCompanies(
          mockCompanies.filter((company) =>
            company.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      } else {
        setFilteredCompanies(mockCompanies);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Switch company...</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search companies..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No companies found.</CommandEmpty>
            <CommandGroup>
              {filteredCompanies.map((company) => (
                <CommandItem
                  key={company.id}
                  onSelect={() => {
                    onCompanySelect(company);
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{company.name}</span>
                    <span className="text-xs text-muted-foreground">{company.industry}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

import { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
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
import { mockAccounts } from "@/lib/mock-data";
import { Account } from "@/lib/types";

interface CompanySwitcherProps {
  currentCompany: string;
  onCompanySelect: (account: Account) => void;
}

export const CompanySwitcher = ({ currentCompany, onCompanySelect }: CompanySwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter out current company and apply search
  const filteredCompanies = useMemo(() => {
    const otherCompanies = mockAccounts.filter(
      (acc) => acc.name.toLowerCase() !== currentCompany.toLowerCase()
    );
    
    if (!searchQuery.trim()) {
      return otherCompanies;
    }
    
    return otherCompanies.filter((acc) =>
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.industry.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, currentCompany]);

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
              {filteredCompanies.map((account) => (
                <CommandItem
                  key={account.id}
                  onSelect={() => {
                    onCompanySelect(account);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">{account.industry}</span>
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

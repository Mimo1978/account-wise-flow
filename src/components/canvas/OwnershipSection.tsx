import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePermissions, getPermissionTooltip } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, 
  Users, 
  ChevronDown, 
  ChevronRight,
  Lock,
  Check,
  X,
  Plus,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface OwnershipSectionProps {
  entityType: "contact" | "company";
  entityId: string;
  ownerId?: string | null;
  teamMembers?: TeamMember[];
  onOwnerChange?: (ownerId: string | null) => void;
  onTeamChange?: (teamMembers: TeamMember[]) => void;
}

// Mock users for demonstration (in real app, fetch from database)
const mockUsers: Owner[] = [
  { id: "user-1", name: "Sarah Williams", email: "sarah@company.com" },
  { id: "user-2", name: "Michael Chen", email: "michael@company.com" },
  { id: "user-3", name: "Emily Johnson", email: "emily@company.com" },
  { id: "user-4", name: "David Rodriguez", email: "david@company.com" },
  { id: "user-5", name: "Lisa Thompson", email: "lisa@company.com" },
];

export const OwnershipSection = ({
  entityType,
  entityId,
  ownerId,
  teamMembers = [],
  onOwnerChange,
  onTeamChange,
}: OwnershipSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [teamPopoverOpen, setTeamPopoverOpen] = useState(false);
  const [localOwnerId, setLocalOwnerId] = useState<string | null>(ownerId || null);
  const [localTeamMembers, setLocalTeamMembers] = useState<TeamMember[]>(teamMembers);

  const { role, isAdmin, isManager, canEdit } = usePermissions();
  
  // Only admins and managers can edit ownership
  const canEditOwnership = isAdmin || isManager;
  const ownershipTooltip = !canEditOwnership 
    ? `Only Admins and Managers can assign ownership (Your role: ${role || 'Not signed in'})`
    : null;

  useEffect(() => {
    setLocalOwnerId(ownerId || null);
  }, [ownerId]);

  useEffect(() => {
    setLocalTeamMembers(teamMembers);
  }, [teamMembers]);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const currentOwner = mockUsers.find(u => u.id === localOwnerId);

  const handleOwnerSelect = (userId: string) => {
    const newOwnerId = userId === localOwnerId ? null : userId;
    setLocalOwnerId(newOwnerId);
    onOwnerChange?.(newOwnerId);
    setOwnerPopoverOpen(false);
    toast.success(newOwnerId ? "Owner assigned" : "Owner removed");
  };

  const handleAddTeamMember = (user: Owner) => {
    if (localTeamMembers.some(m => m.userId === user.id)) {
      return; // Already a team member
    }
    const newMember: TeamMember = {
      id: crypto.randomUUID(),
      userId: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    };
    const newTeam = [...localTeamMembers, newMember];
    setLocalTeamMembers(newTeam);
    onTeamChange?.(newTeam);
    toast.success(`${user.name} added to team`);
  };

  const handleRemoveTeamMember = (memberId: string) => {
    const member = localTeamMembers.find(m => m.id === memberId);
    const newTeam = localTeamMembers.filter(m => m.id !== memberId);
    setLocalTeamMembers(newTeam);
    onTeamChange?.(newTeam);
    toast.success(`${member?.name || 'Member'} removed from team`);
  };

  const availableTeamMembers = mockUsers.filter(
    u => !localTeamMembers.some(m => m.userId === u.id)
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              isOpen ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className={cn("font-medium text-sm", isOpen && "text-primary")}>
                Ownership
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentOwner ? currentOwner.name : "Unassigned"} 
                {localTeamMembers.length > 0 && ` • ${localTeamMembers.length} team member${localTeamMembers.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3 space-y-4 animate-in slide-in-from-top-2">
        {/* Owner Section */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Owner</span>
            {!canEditOwnership && (
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{ownershipTooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {canEditOwnership ? (
            <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={ownerPopoverOpen}
                  className="w-full justify-between h-auto py-2"
                >
                  {currentOwner ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={currentOwner.avatar} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(currentOwner.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{currentOwner.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Select owner...</span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {mockUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => handleOwnerSelect(user.id)}
                          className="flex items-center gap-2"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {localOwnerId === user.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              {currentOwner ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={currentOwner.avatar} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(currentOwner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{currentOwner.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>
          )}
        </div>

        {/* Team Section */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Team Members</span>
            {!canEditOwnership && (
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="w-3 h-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{ownershipTooltip}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Team Member List */}
          <div className="space-y-2 mb-2">
            {localTeamMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No team members assigned</p>
            ) : (
              localTeamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{member.name}</span>
                  </div>
                  {canEditOwnership && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveTeamMember(member.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Team Member */}
          {canEditOwnership && availableTeamMembers.length > 0 && (
            <Popover open={teamPopoverOpen} onOpenChange={setTeamPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 h-8 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Add team member
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {availableTeamMembers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.name}
                          onSelect={() => {
                            handleAddTeamMember(user);
                            setTeamPopoverOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

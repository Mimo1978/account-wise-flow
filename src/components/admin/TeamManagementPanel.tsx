import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Settings, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface Team {
  id: string;
  name: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  team_id: string | null;
}

interface Company {
  id: string;
  name: string;
  team_id: string | null;
}

export function TeamManagementPanel() {
  const { isAdmin, isLoading: permissionsLoading } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [teamsExpanded, setTeamsExpanded] = useState(true);
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [companiesExpanded, setCompaniesExpanded] = useState(false);

  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchData();
    }
  }, [isOpen, isAdmin]);

  const fetchData = async () => {
    // Fetch teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .order('name');
    if (teamsData) setTeams(teamsData);

    // Fetch user roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('*')
      .order('user_id');
    if (rolesData) setUserRoles(rolesData);

    // Fetch companies
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name, team_id')
      .order('name');
    if (companiesData) setCompanies(companiesData);
  };

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    
    const { error } = await supabase
      .from('teams')
      .insert({ name: newTeamName.trim() });

    if (error) {
      toast.error('Failed to create team');
      console.error(error);
    } else {
      toast.success('Team created');
      setNewTeamName('');
      setIsAddingTeam(false);
      fetchData();
    }
  };

  const handleUpdateUserTeam = async (userRoleId: string, teamId: string | null) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ team_id: teamId === 'none' ? null : teamId })
      .eq('id', userRoleId);

    if (error) {
      toast.error('Failed to update user team');
      console.error(error);
    } else {
      toast.success('User team updated');
      fetchData();
    }
  };

  const handleUpdateCompanyTeam = async (companyId: string, teamId: string | null) => {
    const { error } = await supabase
      .from('companies')
      .update({ team_id: teamId === 'none' ? null : teamId })
      .eq('id', companyId);

    if (error) {
      toast.error('Failed to update company team');
      console.error(error);
    } else {
      toast.success('Company team updated');
      fetchData();
    }
  };

  if (permissionsLoading || !isAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Team Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Team Management (Admin Only)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Teams Section */}
          <Collapsible open={teamsExpanded} onOpenChange={setTeamsExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md">
              {teamsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Users className="h-4 w-4" />
              <span className="font-medium">Teams ({teams.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                  <span className="text-sm">{team.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{team.id.slice(0, 8)}...</span>
                </div>
              ))}
              
              {isAddingTeam ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()}
                    className="h-8"
                  />
                  <Button size="sm" onClick={handleAddTeam}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingTeam(false)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setIsAddingTeam(true)}
                >
                  <Plus className="h-3 w-3" />
                  Add Team
                </Button>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* User Roles Section */}
          <Collapsible open={usersExpanded} onOpenChange={setUsersExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md">
              {usersExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Users className="h-4 w-4" />
              <span className="font-medium">User Team Assignments ({userRoles.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              {userRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No user roles configured</p>
              ) : (
                userRoles.map((ur) => (
                  <div key={ur.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ur.user_id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground capitalize">{ur.role}</p>
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground">Team</Label>
                      <Select
                        value={ur.team_id || 'none'}
                        onValueChange={(value) => handleUpdateUserTeam(ur.id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="No team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Companies Section */}
          <Collapsible open={companiesExpanded} onOpenChange={setCompaniesExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-md">
              {companiesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Building2 className="h-4 w-4" />
              <span className="font-medium">Company Team Assignments ({companies.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 pt-2 space-y-2">
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies found</p>
              ) : (
                companies.map((company) => (
                  <div key={company.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{company.name}</p>
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground">Team</Label>
                      <Select
                        value={company.team_id || 'none'}
                        onValueChange={(value) => handleUpdateCompanyTeam(company.id, value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="No team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team (Global)</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}

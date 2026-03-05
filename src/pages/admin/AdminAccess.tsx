import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, AlertCircle, ShieldCheck, Shield, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  team_id: string | null;
  created_at: string;
}

const ALL_ROLES = ['viewer', 'contributor', 'manager', 'admin'] as const;

const ROLE_META: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  viewer: { icon: Eye, label: 'Viewer', color: 'text-muted-foreground' },
  contributor: { icon: Pencil, label: 'Contributor', color: 'text-green-600 dark:text-green-400' },
  manager: { icon: Shield, label: 'Manager', color: 'text-blue-600 dark:text-blue-400' },
  admin: { icon: ShieldCheck, label: 'Admin', color: 'text-red-600 dark:text-red-400' },
};

export default function AdminAccess() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, isManager, role: currentRole, userId: currentUserId, isLoading: permLoading } = usePermissions();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<string>('viewer');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const isReadOnly = !isAdmin;

  // Redirect viewers
  useEffect(() => {
    if (!permLoading && currentRole && currentRole !== 'admin' && currentRole !== 'manager') {
      navigate('/admin/overview', { replace: true });
    }
  }, [permLoading, currentRole, navigate]);

  const fetchRoles = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('user_roles')
      .select('*')
      .eq('team_id', currentWorkspace.id)
      .order('created_at', { ascending: true });

    if (err) setError(err.message);
    else setRoles(data || []);
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  // Group roles by user_id
  const userMatrix = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const roleMap = new Map<string, Map<string, string>>(); // user_id -> role -> role_record_id
    for (const r of roles) {
      if (!map.has(r.user_id)) {
        map.set(r.user_id, new Set());
        roleMap.set(r.user_id, new Map());
      }
      map.get(r.user_id)!.add(r.role);
      roleMap.get(r.user_id)!.set(r.role, r.id);
    }
    return { users: Array.from(map.keys()), roleSet: map, roleIds: roleMap };
  }, [roles]);

  const adminCount = useMemo(() => {
    let count = 0;
    for (const [, set] of userMatrix.roleSet) {
      if (set.has('admin')) count++;
    }
    return count;
  }, [userMatrix]);

  const writeAuditLog = async (action: string, entityId: string, diff: Record<string, unknown>) => {
    if (!currentWorkspace?.id) return;
    // audit_log INSERT is denied via RLS for users, so we use an RPC or skip gracefully
    // Since audit_log_insert_denied_to_users policy exists, we'll log client-side and rely on triggers
    console.log('[Audit]', action, entityId, diff);
  };

  const handleToggleRole = async (userId: string, role: string, currentlyHas: boolean) => {
    if (isReadOnly) return;
    if (!currentWorkspace?.id) return;

    // Prevent removing last admin
    if (currentlyHas && role === 'admin' && adminCount <= 1) {
      toast.error('Cannot remove the last admin from this workspace.');
      return;
    }

    const key = `${userId}-${role}`;
    setToggling(key);

    if (currentlyHas) {
      // Remove role
      const roleId = userMatrix.roleIds.get(userId)?.get(role);
      if (!roleId) { setToggling(null); return; }
      const { error: delErr } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (delErr) {
        toast.error('Failed to remove role: ' + delErr.message);
      } else {
        toast.success(`Removed ${role} from user`);
        await writeAuditLog('role_removed', userId, { role, removed_by: currentUserId });
      }
    } else {
      // Add role
      const { error: insErr } = await supabase.from('user_roles').insert([{
        user_id: userId,
        role: role as 'admin' | 'manager' | 'contributor' | 'viewer',
        team_id: currentWorkspace.id,
      }]);
      if (insErr) {
        if (insErr.message.includes('duplicate') || insErr.message.includes('unique')) {
          toast.error('User already has this role.');
        } else {
          toast.error('Failed to add role: ' + insErr.message);
        }
      } else {
        toast.success(`Added ${role} to user`);
        await writeAuditLog('role_added', userId, { role, added_by: currentUserId });
      }
    }

    setToggling(null);
    fetchRoles();
  };

  const handleAddUser = async () => {
    if (!currentWorkspace?.id || !newUserId.trim()) return;
    setSaving(true);

    let resolvedUserId = newUserId.trim();

    // If input looks like an email, look up the user ID
    if (resolvedUserId.includes('@')) {
      const { data: foundId, error: lookupErr } = await supabase.rpc('lookup_user_id_by_email', {
        _email: resolvedUserId
      });
      if (lookupErr || !foundId) {
        toast.error('No account found with that email. The user must sign up first.');
        setSaving(false);
        return;
      }
      resolvedUserId = foundId;
    }

    const { error: insertErr } = await supabase.from('user_roles').insert([{
      user_id: resolvedUserId,
      role: newRole as 'admin' | 'manager' | 'contributor' | 'viewer',
      team_id: currentWorkspace.id,
    }]);
    if (insertErr) {
      if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
        toast.error('This user already has that role in this workspace.');
      } else {
        toast.error('Failed to add user: ' + insertErr.message);
      }
    } else {
      toast.success('User added with role: ' + newRole);
      await writeAuditLog('role_added', resolvedUserId, { role: newRole, added_by: currentUserId });
      setShowAdd(false);
      setNewUserId('');
      setNewRole('viewer');
      fetchRoles();
    }
    setSaving(false);
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Access</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? 'Manage workspace member roles. Toggle checkboxes to assign or remove roles.'
              : 'View workspace member roles (read-only).'}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add User
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Role Matrix</CardTitle>
          <CardDescription>
            Each row is a user. Check the roles they should have in this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : userMatrix.users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No users found in this workspace.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">User</TableHead>
                  {ALL_ROLES.map((r) => {
                    const meta = ROLE_META[r];
                    const Icon = meta.icon;
                    return (
                      <TableHead key={r} className="text-center w-28">
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                          <span className="text-xs">{meta.label}</span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {userMatrix.users.map((userId) => {
                  const userRoles = userMatrix.roleSet.get(userId)!;
                  const isYou = userId === currentUserId;
                  return (
                    <TableRow key={userId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-muted-foreground">
                            {userId.slice(0, 8)}…{userId.slice(-4)}
                          </code>
                          {isYou && (
                            <Badge variant="outline" className="text-[10px] h-4">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      {ALL_ROLES.map((role) => {
                        const has = userRoles.has(role);
                        const isLastAdminCheck = role === 'admin' && has && adminCount <= 1;
                        const isTogglingThis = toggling === `${userId}-${role}`;
                        return (
                          <TableCell key={role} className="text-center">
                            {isTogglingThis ? (
                              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={has}
                                disabled={isReadOnly || isLastAdminCheck}
                                onCheckedChange={() => handleToggleRole(userId, role, has)}
                                aria-label={`${has ? 'Remove' : 'Add'} ${role} for user ${userId.slice(0, 8)}`}
                              />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_META[r];
          const Icon = meta.icon;
          return (
            <div key={r} className="flex items-center gap-1.5">
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              <span className="font-medium">{meta.label}</span>
              <span>—</span>
              <span>
                {r === 'viewer' && 'Read-only access'}
                {r === 'contributor' && 'Can create & edit own records'}
                {r === 'manager' && 'Team-scoped management'}
                {r === 'admin' && 'Full access, can manage roles'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User to Workspace</DialogTitle>
            <DialogDescription>Enter the user's email address and assign their initial role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input
                type="email"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="colleague@company.com"
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">The user must have an existing account.</p>
            </div>
            <div>
              <Label>Initial Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={saving || !newUserId.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

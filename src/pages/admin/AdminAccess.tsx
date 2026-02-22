import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  team_id: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  contributor: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  viewer: 'bg-muted text-muted-foreground',
};

export default function AdminAccess() {
  const { currentWorkspace } = useWorkspace();
  const { isAdmin, role: currentRole } = usePermissions();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [saving, setSaving] = useState(false);

  const fetchRoles = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('team_id', currentWorkspace.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching roles:', error);
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRoles(); }, [currentWorkspace?.id]);

  const handleAddRole = async () => {
    if (!currentWorkspace?.id || !newUserId.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('user_roles').insert([{
      user_id: newUserId.trim(),
      role: newRole as 'admin' | 'manager' | 'contributor' | 'viewer',
      team_id: currentWorkspace.id,
    }]);
    if (error) {
      toast.error('Failed to add role: ' + error.message);
    } else {
      toast.success('Role added');
      setShowAdd(false);
      setNewUserId('');
      setNewRole('viewer');
      fetchRoles();
    }
    setSaving(false);
  };

  const handleDeleteRole = async (id: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove role: ' + error.message);
    } else {
      toast.success('Role removed');
      fetchRoles();
    }
  };

  const handleChangeRole = async (id: string, newRoleVal: string) => {
    const { error } = await supabase.from('user_roles').update({ role: newRoleVal as 'admin' | 'manager' | 'contributor' | 'viewer' }).eq('id', id);
    if (error) {
      toast.error('Failed to update role: ' + error.message);
    } else {
      toast.success('Role updated');
      fetchRoles();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access & Roles</h1>
          <p className="text-muted-foreground text-sm">Manage workspace member roles.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Role
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : roles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No roles found for this workspace.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.user_id}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={r.role} onValueChange={(v) => handleChangeRole(r.id, v)}>
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="contributor">Contributor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={ROLE_COLORS[r.role] || ''} variant="secondary">{r.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRole(r.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID (UUID)</Label>
              <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="e.g. abc-123-..." />
            </div>
            <div>
              <Label>Role</Label>
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
            <Button onClick={handleAddRole} disabled={saving || !newUserId.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

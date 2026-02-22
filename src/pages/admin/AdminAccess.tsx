import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePermissions } from '@/hooks/use-permissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const { isAdmin, role: currentRole, userId: currentUserId } = usePermissions();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRole | null>(null);
  const [deleting, setDeleting] = useState(false);

  const adminCount = roles.filter(r => r.role === 'admin').length;

  const fetchRoles = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('user_roles')
      .select('*')
      .eq('team_id', currentWorkspace.id)
      .order('created_at', { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  }, [currentWorkspace?.id]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const isLastAdmin = (r: UserRole) => r.role === 'admin' && adminCount <= 1;

  const handleAddRole = async () => {
    if (!currentWorkspace?.id || !newUserId.trim()) return;
    setSaving(true);
    const { error: insertErr } = await supabase.from('user_roles').insert([{
      user_id: newUserId.trim(),
      role: newRole as 'admin' | 'manager' | 'contributor' | 'viewer',
      team_id: currentWorkspace.id,
    }]);
    if (insertErr) {
      if (insertErr.message.includes('duplicate') || insertErr.message.includes('unique')) {
        toast.error('This user already has that role in this workspace.');
      } else {
        toast.error('Failed to add role: ' + insertErr.message);
      }
    } else {
      toast.success('Role added');
      setShowAdd(false);
      setNewUserId('');
      setNewRole('viewer');
      fetchRoles();
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (isLastAdmin(deleteTarget)) {
      toast.error('Cannot remove the last admin from this workspace.');
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    const { error: delErr } = await supabase.from('user_roles').delete().eq('id', deleteTarget.id);
    if (delErr) {
      toast.error('Failed to remove role: ' + delErr.message);
    } else {
      toast.success('Role removed');
      fetchRoles();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleChangeRole = async (id: string, newRoleVal: string) => {
    const target = roles.find(r => r.id === id);
    if (target && isLastAdmin(target) && newRoleVal !== 'admin') {
      toast.error('Cannot demote the last admin in this workspace.');
      return;
    }
    const { error: updateErr } = await supabase.from('user_roles').update({
      role: newRoleVal as 'admin' | 'manager' | 'contributor' | 'viewer',
    }).eq('id', id);
    if (updateErr) {
      toast.error('Failed to update role: ' + updateErr.message);
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
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'Manage workspace member roles.' : 'View workspace member roles (read-only).'}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Role
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
                  <TableHead>Team ID</TableHead>
                  <TableHead>Added</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      {r.user_id}
                      {r.user_id === currentUserId && (
                        <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>
                      )}
                    </TableCell>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.team_id ? r.team_id.slice(0, 8) + '…' : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={isLastAdmin(r)}
                          title={isLastAdmin(r) ? 'Cannot remove last admin' : 'Remove role'}
                          onClick={() => setDeleteTarget(r)}
                        >
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
            <DialogDescription>Assign a role to a user in this workspace.</DialogDescription>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> Remove Role
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <strong>{deleteTarget?.role}</strong> role from user{' '}
              <code className="text-xs">{deleteTarget?.user_id?.slice(0, 12)}…</code>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
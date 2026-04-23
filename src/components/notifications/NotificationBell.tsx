import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-deletion";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationBell() {
  const { user } = useAuth();
  const { data: items = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Realtime subscription so the badge updates the moment a webhook fires.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc]);

  const count = items.length;

  const handleOpen = (notif: any) => {
    markRead.mutate(notif.id);
    if (notif.link) navigate(notif.link);
    setOpen(false);
  };

  const markAll = async () => {
    if (!items.length) return;
    await supabase
      .from("notifications" as any)
      .update({ read: true } as any)
      .in("id", items.map((n: any) => n.id));
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
        >
          <Bell className="h-[18px] w-[18px] text-muted-foreground" />
          {count > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center px-1 leading-none">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {count === 0 ? "You're all caught up" : `${count} unread`}
            </p>
          </div>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} className="h-7 px-2 text-xs gap-1">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {count === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              No new activity. New AI call summaries, meeting bookings and access requests will appear here.
            </div>
          ) : (
            items.map((n: any) => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className="w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-accent/40 transition-colors"
              >
                <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
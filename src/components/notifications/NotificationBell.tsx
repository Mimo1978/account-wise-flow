import { Bell, CheckCheck, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-deletion";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function NotificationBell() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data: items = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [briefing, setBriefing] = useState<null | {
    headline: string;
    counts: Record<string, number | Record<string, number>>;
    details: any;
  }>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  const fetchBriefing = async () => {
    if (!currentWorkspace?.id) return;
    setBriefingLoading(true);
    setBriefing(null);
    try {
      const { data, error } = await supabase.functions.invoke("get-catchup-briefing", {
        body: { workspace_id: currentWorkspace.id },
      });
      if (error) throw error;
      setBriefing(data);
    } catch (e: any) {
      console.error("catchup briefing failed:", e);
      setBriefing({ headline: `Couldn't load briefing: ${e?.message || "unknown error"}`, counts: {}, details: {} });
    } finally {
      setBriefingLoading(false);
    }
  };

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
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {count === 0 ? "You're all caught up" : `${count} unread`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBriefing}
              disabled={briefingLoading}
              className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
              title="What did I miss? — last 24 hours"
            >
              {briefingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Catch me up
            </Button>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={markAll} className="h-7 px-2 text-xs gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all
              </Button>
            )}
          </div>
        </div>
        {briefing && (
          <div className="px-3 py-3 border-b border-border bg-primary/5">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-foreground leading-relaxed">{briefing.headline}</p>
                {briefing.counts && Object.keys(briefing.counts).length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                    {[
                      ["📞 AI calls", briefing.counts.calls_completed as number],
                      ["📅 Meetings booked", briefing.counts.meetings_booked as number],
                      ["✉️ Pending follow-ups", briefing.counts.followup_emails_pending as number],
                      ["✅ Auto-emails sent", briefing.counts.followup_emails_sent as number],
                      ["💬 Responses to action", briefing.counts.responses_awaiting as number],
                      ["🗓️ Diary next 24h", briefing.counts.diary_next_24h as number],
                      ["📆 Diary next 7d", briefing.counts.diary_next_7d as number],
                      ["🔔 Unread alerts", briefing.counts.unread_notifications as number],
                    ].filter(([_, v]) => (v as number) > 0).map(([label, v]) => (
                      <div key={label as string} className="flex items-center justify-between px-2 py-1 rounded bg-card border border-border/50">
                        <span className="text-muted-foreground truncate">{label}</span>
                        <span className="font-semibold text-foreground tabular-nums">{v as number}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setBriefing(null)}
                  className="mt-2 text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Dismiss briefing
                </button>
              </div>
            </div>
          </div>
        )}
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
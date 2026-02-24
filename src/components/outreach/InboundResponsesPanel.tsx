import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, XCircle, Mail, MessageSquare, Phone, Bot } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  useInboundResponses,
  useScheduledActions,
  useApproveScheduledAction,
  useCancelScheduledAction,
} from "@/hooks/use-outreach-automation";

interface Props {
  campaignId: string;
}

const INTENT_BADGE: Record<string, string> = {
  interested: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  meeting_request: "bg-primary/10 text-primary",
  callback_request: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  not_interested: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  opt_out: "bg-destructive/10 text-destructive",
  out_of_office: "bg-muted text-muted-foreground",
  info_request: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  unclassified: "bg-muted text-muted-foreground",
};

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="w-3.5 h-3.5" />,
  sms: <MessageSquare className="w-3.5 h-3.5" />,
  voicemail: <Phone className="w-3.5 h-3.5" />,
  other: <Bot className="w-3.5 h-3.5" />,
};

export function InboundResponsesPanel({ campaignId }: Props) {
  const { data: responses = [], isLoading: responsesLoading } = useInboundResponses(campaignId);
  const { data: actions = [], isLoading: actionsLoading } = useScheduledActions(campaignId);
  const { mutate: approve } = useApproveScheduledAction();
  const { mutate: cancel } = useCancelScheduledAction();

  const pendingActions = actions.filter((a) => a.status === "pending" && a.requires_approval);

  return (
    <div className="space-y-6">
      {/* Pending Actions Queue */}
      {pendingActions.length > 0 && (
        <div className="rounded-lg border-2 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Pending Approvals ({pendingActions.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between gap-3 bg-background rounded-md p-3 border border-border/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {action.meeting_title || action.action_type}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {action.action_type} • {format(parseISO(action.scheduled_for), "d MMM yyyy HH:mm")}
                    {action.meeting_duration_minutes && ` • ${action.meeting_duration_minutes}min`}
                  </p>
                  {action.meeting_notes && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {action.meeting_notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => cancel(action.id)}
                  >
                    <XCircle className="w-3 h-3" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => approve(action.id)}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inbound Responses Feed */}
      <div>
        <h3 className="text-sm font-semibold mb-3">AI-Processed Responses</h3>
        {responsesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : responses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
            <Bot className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No inbound responses yet. Responses will appear here when targets reply.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs w-8">Ch</TableHead>
                  <TableHead className="text-xs">Intent</TableHead>
                  <TableHead className="text-xs">Summary</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">Confidence</TableHead>
                  <TableHead className="text-xs hidden lg:table-cell">Follow-up</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell className="py-2">
                      <span className="text-muted-foreground">
                        {CHANNEL_ICON[r.channel] || CHANNEL_ICON.other}
                      </span>
                    </TableCell>
                    <TableCell className="py-2">
                      {r.ai_intent ? (
                        <Badge
                          className={`text-[10px] capitalize ${INTENT_BADGE[r.ai_intent] || INTENT_BADGE.unclassified}`}
                        >
                          {r.ai_intent.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {r.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <p className="text-xs text-foreground line-clamp-1 max-w-xs">
                        {r.ai_summary || r.raw_content.slice(0, 100)}
                      </p>
                    </TableCell>
                    <TableCell className="py-2 hidden md:table-cell">
                      {r.ai_confidence != null && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(r.ai_confidence * 100)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 hidden lg:table-cell">
                      {r.follow_up_type && r.follow_up_type !== "none" && (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {r.follow_up_type} • {r.follow_up_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(r.received_at), "d MMM HH:mm")}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

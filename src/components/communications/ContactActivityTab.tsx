import { useCrmActivities } from "@/hooks/use-crm-activities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Phone, Calendar, PencilLine, ExternalLink } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CrmActivity } from "@/types/crm";

const TYPE_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  call: Phone,
  meeting: Calendar,
  note: PencilLine,
  task: PencilLine,
};

interface Props {
  contactId: string;
  companyId?: string | null;
}

export function ContactActivityTab({ contactId, companyId }: Props) {
  const { data: activities = [], isLoading } = useCrmActivities({ contact_id: contactId });

  if (isLoading) return <div className="text-muted-foreground text-sm py-4">Loading activities…</div>;

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No activities recorded yet. Use the action buttons above to send an email, SMS, or log an activity.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity: CrmActivity) => {
        const Icon = TYPE_ICONS[activity.type] || PencilLine;
        const callSid = activity.type === "call" && activity.body?.match(/Call SID: (CA[a-z0-9]+)/)?.[1];

        return (
          <Card key={activity.id}>
            <CardContent className="py-3 px-4 flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-muted p-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {activity.direction && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${activity.direction === "outbound" ? "border-primary/30 text-primary" : "border-emerald-500/30 text-emerald-600"}`}>
                      {activity.direction === "outbound" ? "OUT" : "IN"}
                    </Badge>
                  )}
                  <span className="font-medium text-sm text-foreground">{activity.subject || activity.type}</span>
                </div>
                {activity.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[500px]">
                    {activity.body.substring(0, 100)}{activity.body.length > 100 ? "…" : ""}
                  </p>
                )}
                {callSid && (
                  <a
                    href={`https://www.twilio.com/console/voice/calls/${callSid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> View Recording
                  </a>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {format(new Date(activity.created_at), "PPp")}
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { Activity } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, Mail, RefreshCw, User as UserIcon, TrendingUp } from "lucide-react";

interface ActivityTimelineProps {
  activities: Activity[];
}

const activityIcons = {
  meeting: Calendar,
  call: Phone,
  email: Mail,
  update: RefreshCw,
  "owner-change": UserIcon,
  "score-change": TrendingUp,
};

const activityColors = {
  meeting: "text-blue-500",
  call: "text-green-500",
  email: "text-purple-500",
  update: "text-orange-500",
  "owner-change": "text-pink-500",
  "score-change": "text-yellow-500",
};

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No activities yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, idx) => {
        const Icon = activityIcons[activity.type];
        const colorClass = activityColors[activity.type];
        
        return (
          <div key={activity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              {idx < activities.length - 1 && (
                <div className="w-px h-full bg-border mt-1" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs capitalize">
                  {activity.type.replace("-", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">{activity.date}</span>
              </div>
              <p className="text-sm text-foreground">{activity.description}</p>
              {activity.metadata && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

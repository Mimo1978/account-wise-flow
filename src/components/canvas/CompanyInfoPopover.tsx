import { Account } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, AlertCircle, FileText, Newspaper } from "lucide-react";

interface CompanyInfoPopoverProps {
  account: Account;
  position: { x: number; y: number };
  onNewsClick?: () => void;
  onNoteClick?: () => void;
}

export const CompanyInfoPopover = ({ 
  account, 
  position,
  onNewsClick,
  onNoteClick 
}: CompanyInfoPopoverProps) => {
  return (
    <div 
      className="absolute z-50 w-96 p-4 bg-background border border-border rounded-lg shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="space-y-4">
        {/* Executive Account Manager */}
        {account.accountManager && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Users className="w-3 h-3" />
              Executive Account Manager
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={account.accountManager.photo} />
                <AvatarFallback>
                  {account.accountManager.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {account.accountManager.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {account.accountManager.title}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Engagement Metrics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <TrendingUp className="w-3 h-3" />
            Key Metrics
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Engagement Score</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-foreground">{account.engagementScore}</p>
                <Badge variant={account.engagementScore >= 70 ? "default" : "secondary"} className="text-xs">
                  {account.engagementScore >= 70 ? "High" : "Medium"}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Interaction</p>
              <p className="text-sm font-semibold text-foreground">{account.lastInteraction}</p>
            </div>
          </div>
          {account.primaryChampion && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">Primary Champion</p>
              <p className="text-sm font-semibold text-foreground">
                {account.primaryChampion.name} — {account.primaryChampion.title}
              </p>
            </div>
          )}
          {account.knownBlockers && account.knownBlockers.length > 0 && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-destructive" />
                Known Blockers
              </p>
              <p className="text-sm font-semibold text-destructive">
                {account.knownBlockers.join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Important Notes */}
        {account.importantNote && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <FileText className="w-3 h-3" />
              Important Notes
            </div>
            <p 
              className="text-xs text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors"
              onClick={onNoteClick}
            >
              {account.importantNote}
            </p>
          </div>
        )}

        {/* Latest News Highlights */}
        {account.recentNews && account.recentNews.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <Newspaper className="w-3 h-3" />
              Latest News (Past 7 Days)
            </div>
            <div className="space-y-2">
              {account.recentNews.slice(0, 2).map((news) => (
                <div 
                  key={news.id}
                  className="flex items-start gap-2 cursor-pointer hover:bg-accent/50 p-2 rounded-md transition-colors"
                  onClick={onNewsClick}
                >
                  <span className="text-primary text-xs mt-0.5">🔹</span>
                  <p className="text-xs text-foreground flex-1">
                    {news.headline}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

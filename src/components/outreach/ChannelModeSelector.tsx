import { Mail, MessageSquare, Phone, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export type ChannelKey = "email" | "sms" | "call";

interface Props {
  active: ChannelKey[];
  primary: ChannelKey;
  onChange: (next: { active: ChannelKey[]; primary: ChannelKey }) => void;
}

const CHANNELS: { key: ChannelKey; label: string; icon: React.ComponentType<{ className?: string }>; blurb: string }[] = [
  { key: "email", label: "Email", icon: Mail, blurb: "Drip or one-shot email sequences." },
  { key: "sms",   label: "SMS",   icon: MessageSquare, blurb: "Short text nudges, high open rate." },
  { key: "call",  label: "AI Call", icon: Phone, blurb: "Autonomous voice agent calls." },
];

export function ChannelModeSelector({ active, primary, onChange }: Props) {
  const isMixed = active.length > 1;

  const toggle = (key: ChannelKey) => {
    const has = active.includes(key);
    let next = has ? active.filter((k) => k !== key) : [...active, key];
    if (next.length === 0) next = [key]; // never empty
    const nextPrimary = next.includes(primary) ? primary : next[0];
    onChange({ active: next, primary: nextPrimary });
  };

  const setPrimary = (key: ChannelKey) => {
    const next = active.includes(key) ? active : [...active, key];
    onChange({ active: next, primary: key });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 mb-4" data-jarvis-id="channel-mode-selector">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold">Outreach Channels</h3>
          <p className="text-[11px] text-muted-foreground">
            Pick one for single-channel, or several for a multi-touch sequence. The <span className="text-foreground font-medium">primary</span> channel runs first on Launch.
          </p>
        </div>
        <span className={cn(
          "text-[10px] font-medium px-2 py-1 rounded-full border",
          isMixed ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"
        )}>
          {isMixed ? `Mixed-mode · ${active.length} channels` : "Single channel"}
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {CHANNELS.map(({ key, label, icon: Icon, blurb }) => {
          const isActive = active.includes(key);
          const isPrimary = primary === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                "relative text-left rounded-lg border p-3 transition-colors group",
                isActive
                  ? "border-primary/50 bg-primary/[0.06] hover:bg-primary/[0.10]"
                  : "border-border/60 bg-background hover:bg-muted/40"
              )}
              data-jarvis-id={`channel-toggle-${key}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-medium flex-1">{label}</span>
                {isActive && (
                  <Check className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{blurb}</p>

              {isActive && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setPrimary(key); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setPrimary(key); } }}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border cursor-pointer",
                    isPrimary
                      ? "border-primary/50 bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isPrimary ? "Primary" : "Set as primary"}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
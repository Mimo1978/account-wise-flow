import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CMLoaderProps {
  messages?: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Scanning profiles...",
  "Weighing company prestige...",
  "Analysing tenure patterns...",
  "Checking skill alignment...",
  "Ranking top matches...",
];

export function CMLoader({ messages = DEFAULT_MESSAGES, size = "md", className }: CMLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  const radarSize = size === "sm" ? 32 : size === "lg" ? 64 : 48;
  const fontSize = size === "sm" ? "10px" : size === "lg" ? "13px" : "11px";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Radar sweep */}
      <div className="relative" style={{ width: radarSize, height: radarSize }}>
        <svg width={radarSize} height={radarSize} viewBox="0 0 48 48" className="absolute inset-0">
          {/* Sweep line */}
          <line
            x1="24"
            y1="24"
            x2="24"
            y2="4"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="origin-center"
            style={{ animation: "cmRadarSweep 2s linear infinite" }}
          />

          {/* Ping dots */}
          <circle
            cx="24"
            cy="14"
            r="2"
            fill="hsl(var(--primary))"
            className="opacity-80"
            style={{ animation: "cmRadarFade 2s ease-in-out infinite" }}
          />

          <circle
            cx="34"
            cy="24"
            r="1.5"
            fill="hsl(var(--primary))"
            className="opacity-60"
            style={{ animation: "cmRadarFade 2s ease-in-out 0.5s infinite" }}
          />

          <circle
            cx="18"
            cy="32"
            r="1.5"
            fill="hsl(var(--primary))"
            className="opacity-60"
            style={{ animation: "cmRadarFade 2s ease-in-out 1s infinite" }}
          />

          {/* Centre dot */}
          <circle cx="24" cy="24" r="1.5" fill="hsl(var(--primary))" className="opacity-100" />
        </svg>
      </div>

      {/* Rotating message */}
      {messages.length > 0 && (
        <div className="text-center min-h-[14px] transition-opacity duration-300" style={{ fontSize }}>
          <span className="text-muted-foreground font-medium animate-fade-in">
            {messages[msgIndex]}
          </span>
        </div>
      )}

      <style>{`
        @keyframes cmRadarSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cmRadarFade {
          0%   { opacity: 0; }
          10%  { opacity: 1; }
          60%  { opacity: 0.3; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function CMLoaderPage({ messages, title = "Processing..." }: { messages?: string[]; title?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <CMLoader messages={messages} size="lg" />
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
    </div>
  );
}

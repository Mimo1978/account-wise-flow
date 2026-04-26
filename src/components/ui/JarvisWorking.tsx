import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/**
 * JarvisWorking — a unique, modern "wheel" loader used for any Jarvis-driven
 * background work (AI enhance, AI call, navigation, form-filling).
 *
 * The wheel: a conic-gradient ring rotates around a soft pulsing core, with
 * three orbiting nodes representing thought / action / response.
 */
export function JarvisWorking({
  size = 64,
  label,
  sublabel,
  className,
  inline = false,
}: {
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  inline?: boolean;
}) {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDot((d) => (d + 1) % 4), 450);
    return () => clearInterval(t);
  }, []);

  const c = size / 2;
  const ringR = size * 0.42;

  return (
    <div
      className={cn(
        inline ? "inline-flex items-center gap-3" : "flex flex-col items-center gap-3",
        className
      )}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer conic ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, hsl(var(--primary) / 0) 0deg, hsl(var(--primary) / 0.9) 90deg, hsl(var(--primary) / 0) 270deg, hsl(var(--primary) / 0) 360deg)`,
            mask: `radial-gradient(circle, transparent ${size * 0.36}px, black ${size * 0.38}px, black ${size * 0.46}px, transparent ${size * 0.48}px)`,
            WebkitMask: `radial-gradient(circle, transparent ${size * 0.36}px, black ${size * 0.38}px, black ${size * 0.46}px, transparent ${size * 0.48}px)`,
            animation: "jvSpin 1.4s linear infinite",
          }}
        />

        {/* Counter-rotating thinner ring */}
        <div
          className="absolute inset-0 rounded-full opacity-60"
          style={{
            background: `conic-gradient(from 180deg, hsl(var(--primary) / 0) 0deg, hsl(var(--primary) / 0.5) 60deg, hsl(var(--primary) / 0) 180deg)`,
            mask: `radial-gradient(circle, transparent ${size * 0.28}px, black ${size * 0.30}px, black ${size * 0.34}px, transparent ${size * 0.36}px)`,
            WebkitMask: `radial-gradient(circle, transparent ${size * 0.28}px, black ${size * 0.30}px, black ${size * 0.34}px, transparent ${size * 0.36}px)`,
            animation: "jvSpinRev 2.2s linear infinite",
          }}
        />

        {/* Orbiting nodes */}
        <div className="absolute inset-0" style={{ animation: "jvSpin 2.8s linear infinite" }}>
          <div
            className="absolute rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
            style={{ width: 5, height: 5, top: c - ringR - 2.5, left: c - 2.5 }}
          />
        </div>
        <div className="absolute inset-0" style={{ animation: "jvSpinRev 3.6s linear infinite" }}>
          <div
            className="absolute rounded-full bg-primary/70"
            style={{ width: 4, height: 4, top: c + ringR - 2, left: c - 2 }}
          />
        </div>

        {/* Pulsing core */}
        <div
          className="absolute rounded-full bg-primary"
          style={{
            width: size * 0.18,
            height: size * 0.18,
            top: c - size * 0.09,
            left: c - size * 0.09,
            animation: "jvCorePulse 1.2s ease-in-out infinite",
            boxShadow: "0 0 12px hsl(var(--primary) / 0.6)",
          }}
        />
      </div>

      {(label || sublabel) && (
        <div className={cn(inline ? "text-left" : "text-center")}>
          {label && (
            <p className="text-sm font-medium text-foreground">
              {label}
              <span className="inline-block w-4 text-left text-primary">
                {".".repeat(dot)}
              </span>
            </p>
          )}
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
          )}
        </div>
      )}

      <style>{`
        @keyframes jvSpin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes jvSpinRev { from { transform: rotate(360deg);} to { transform: rotate(0deg);} }
        @keyframes jvCorePulse {
          0%,100% { transform: scale(0.85); opacity: 0.85; }
          50%     { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** Full-screen overlay variant for heavier processes. */
export function JarvisWorkingOverlay({
  visible,
  label = "Jarvis is working",
  sublabel = "Hold tight — preparing your request",
}: {
  visible: boolean;
  label?: string;
  sublabel?: string;
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in">
      <JarvisWorking size={96} label={label} sublabel={sublabel} />
    </div>
  );
}
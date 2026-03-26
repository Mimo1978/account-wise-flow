import { useEffect, useState } from "react";
import { CheckCircle2, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { JarvisAction } from "@/hooks/use-jarvis";

const ACTION_LABELS: Record<string, string> = {
  create_company: "Company Created",
  create_contact: "Contact Added",
  create_deal: "Deal Created",
  create_invoice: "Invoice Created",
  create_project: "Project Created",
  generate_and_send_invoice: "Invoice Sent",
  initiate_ai_call: "AI Call Initiated",
  mark_invoice_paid: "Invoice Paid",
  create_candidate: "Candidate Added",
  create_sow: "SOW Created",
  create_outreach_campaign: "Campaign Created",
  add_to_outreach: "Added to Outreach",
  update_record: "Record Updated",
  delete_record: "Record Deleted",
  send_email: "Email Sent",
  send_sms: "SMS Sent",
};

function getActionLabel(tool: string): string {
  return ACTION_LABELS[tool] || tool.replace(/_/g, " ");
}

function extractEntityName(content: string, tool: string): string {
  // Try to extract a name from the assistant's response
  // Common patterns: "X has been added", "Created X", etc.
  const patterns = [
    /[—–-]\s*(.+?)(?:\s+has been|\s+linked|\s+emailed|\s+created|\s+updated|\s+deleted|\s+sent|\s+marked|\.|$)/i,
    /(?:created|added|saved|sent|updated|deleted|linked)\s+(.+?)(?:\s+to|\s+on|\s+in|\.|$)/i,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m?.[1] && m[1].length < 60) return m[1].trim();
  }
  return "";
}

export interface BannerData {
  label: string;
  detail: string;
  navigateTo?: string;
}

export function buildBannerData(
  actions: JarvisAction[],
  responseContent: string,
  navigateTo?: string
): BannerData | null {
  const successAction = actions.find((a) => a.success);
  if (!successAction) return null;

  const label = getActionLabel(successAction.tool);
  const detail = extractEntityName(responseContent, successAction.tool);

  return { label, detail, navigateTo };
}

interface JarvisSuccessBannerProps {
  data: BannerData;
  onDismiss: () => void;
}

export function JarvisSuccessBanner({ data, onDismiss }: JarvisSuccessBannerProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    requestAnimationFrame(() => setPhase("visible"));
    const timer = setTimeout(() => setPhase("exit"), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase === "exit") {
      const t = setTimeout(onDismiss, 300);
      return () => clearTimeout(t);
    }
  }, [phase, onDismiss]);

  const isVisible = phase === "visible";

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        top: 80,
        left: "50%",
        transform: `translateX(-50%) translateY(${isVisible ? 0 : phase === "enter" ? -20 : 0}px)`,
        opacity: phase === "exit" ? 0 : isVisible ? 1 : 0,
        transition:
          phase === "exit"
            ? "opacity 300ms ease-out"
            : "all 200ms ease-out",
      }}
    >
      <div
        style={{
          minWidth: 400,
          maxWidth: 600,
          background: "hsl(var(--card))",
          border: "1px solid rgba(52,211,153,0.4)",
          borderLeft: "4px solid #34d399",
          borderRadius: 10,
          padding: "16px 20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
        className="flex items-center gap-3"
      >
        <CheckCircle2
          className="shrink-0"
          style={{ width: 24, height: 24, color: "#34d399" }}
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            ✓ {data.label}
            {data.detail && (
              <span className="font-normal text-muted-foreground">
                {" — "}
                {data.detail}
              </span>
            )}
          </p>
        </div>

        {data.navigateTo && (
          <button
            onClick={() => {
              navigate(data.navigateTo!);
              setPhase("exit");
            }}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            View Record
            <ArrowRight className="h-3 w-3" />
          </button>
        )}

        <button
          onClick={() => setPhase("exit")}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useIsServiceConfigured } from "@/hooks/use-integration-settings";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const SERVICE_LABELS: Record<string, { name: string; description: string }> = {
  resend: { name: "Email (Resend)", description: "Connect Resend to send emails directly from the CRM." },
  twilio: { name: "SMS & Voice (Twilio)", description: "Connect Twilio to send SMS messages and make AI-powered calls." },
  elevenlabs: { name: "AI Voice (ElevenLabs)", description: "Connect ElevenLabs for natural-sounding AI voice calls." },
  anthropic: { name: "Jarvis AI (Anthropic)", description: "Connect Anthropic to power the Jarvis AI assistant." },
};

interface Props {
  service: "resend" | "twilio" | "elevenlabs" | "anthropic";
  children: ReactNode;
}

export function IntegrationGuard({ service, children }: Props) {
  const { isConfigured, isLoading } = useIsServiceConfigured(service);
  const navigate = useNavigate();

  if (isLoading) return null;

  if (!isConfigured) {
    const label = SERVICE_LABELS[service] || { name: service, description: "" };
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="font-semibold text-foreground">{label.name} is not connected</p>
        <p className="text-sm text-muted-foreground max-w-sm">{label.description}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/settings/integrations")}>
          Go to Integrations Settings
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

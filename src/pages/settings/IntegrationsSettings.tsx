import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSaveIntegrationKeys, useIntegrationSettings, useIntegrationStatus } from "@/hooks/use-integration-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Mic, Bot, CheckCircle2, Eye, EyeOff, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KeyField {
  key_name: string;
  label: string;
  type: "password" | "text";
  helper: string;
  validate?: (v: string) => string | null;
}

interface ServiceCard {
  service: string;
  label: string;
  icon: React.ElementType;
  description: string;
  signupUrl: string;
  optional?: boolean;
  fields: KeyField[];
}

const SERVICE_CARDS: ServiceCard[] = [
  {
    service: "resend",
    label: "Email via Resend",
    icon: Mail,
    description: "Send emails directly from the CRM using your own Resend account. Free tier includes 3,000 emails per month.",
    signupUrl: "https://resend.com",
    fields: [
      { key_name: "RESEND_API_KEY", label: "Resend API Key", type: "password", helper: "Must start with re_", validate: v => v && !v.startsWith("re_") ? "Must start with re_" : null },
      { key_name: "FROM_EMAIL_ADDRESS", label: "From Email", type: "text", helper: "Must be a verified sender in your Resend account e.g. hello@yourcompany.com" },
    ],
  },
  {
    service: "twilio",
    label: "SMS and Voice via Twilio",
    icon: Phone,
    description: "Send SMS messages and make AI-powered outbound calls using your own Twilio account.",
    signupUrl: "https://twilio.com",
    fields: [
      { key_name: "TWILIO_ACCOUNT_SID", label: "Account SID", type: "password", helper: "Found in Twilio Console > Account Info. Starts with AC", validate: v => v && !v.startsWith("AC") ? "Must start with AC" : null },
      { key_name: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "password", helper: "Found in Twilio Console > Account Info" },
      { key_name: "TWILIO_PHONE_NUMBER", label: "Phone Number", type: "text", helper: "Your Twilio number in E.164 format e.g. +441234567890. Must have SMS and Voice capabilities." },
    ],
  },
  {
    service: "elevenlabs",
    label: "AI Voice via ElevenLabs",
    icon: Mic,
    description: "Adds a natural-sounding AI voice to outbound calls. Requires Twilio to be configured first. If not configured, calls will use Twilio's standard text-to-speech.",
    signupUrl: "https://elevenlabs.io",
    optional: true,
    fields: [
      { key_name: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", type: "password", helper: "" },
    ],
  },
  {
    service: "anthropic",
    label: "Jarvis AI Assistant via Anthropic",
    icon: Bot,
    description: "Powers the Jarvis AI assistant built into your CRM. Your data is never used to train AI models. All API calls are made server-side only.",
    signupUrl: "https://console.anthropic.com",
    fields: [
      { key_name: "ANTHROPIC_API_KEY", label: "Anthropic API Key", type: "password", helper: "Starts with sk-ant-", validate: v => v && !v.startsWith("sk-ant-") ? "Must start with sk-ant-" : null },
    ],
  },
];

function ServiceCardComponent({ card }: { card: ServiceCard }) {
  const { user } = useAuth();
  const { data: settings } = useIntegrationSettings(card.service);
  const { data: statuses } = useIntegrationStatus(card.service);
  const saveMutation = useSaveIntegrationKeys();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  const status = statuses?.find(s => s.service === card.service);
  const isConfigured = status?.is_fully_configured ?? false;

  const lastUpdated = settings && settings.length > 0
    ? settings.reduce((latest, s) => (s.updated_at > latest ? s.updated_at : latest), settings[0].updated_at)
    : null;

  const hasExistingKey = (keyName: string) => {
    return settings?.some(s => s.key_name === keyName && s.is_configured);
  };

  const handleBlur = (field: KeyField) => {
    const val = values[field.key_name] || "";
    if (val && field.validate) {
      const err = field.validate(val);
      setErrors(prev => ({ ...prev, [field.key_name]: err || "" }));
    } else {
      setErrors(prev => ({ ...prev, [field.key_name]: "" }));
    }
  };

  const handleSave = async () => {
    // Check for validation errors
    const newErrors: Record<string, string> = {};
    card.fields.forEach(f => {
      const val = values[f.key_name] || "";
      if (val && f.validate) {
        const err = f.validate(val);
        if (err) newErrors[f.key_name] = err;
      }
    });
    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return;
    }

    try {
      await saveMutation.mutateAsync(
        card.fields
          .filter(f => (values[f.key_name] || "").trim() !== "")
          .map(f => ({ service: card.service, key_name: f.key_name, key_value: values[f.key_name] }))
      );
      setValues({});
      toast.success("Keys saved securely");
    } catch (err: any) {
      toast.error(err.message || "Failed to save keys");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-integration", {
        body: { service: card.service },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${card.label} test successful!`);
      } else {
        toast.warning(data?.error || "Test failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <card.icon className="w-5 h-5" />
            {card.label}
            {card.optional && <Badge variant="outline" className="text-xs">Optional</Badge>}
          </CardTitle>
          <Badge variant={isConfigured ? "default" : "secondary"} className={isConfigured ? "bg-emerald-600 text-white" : ""}>
            {isConfigured ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</> : "Not configured"}
          </Badge>
        </div>
        <CardDescription>{card.description}</CardDescription>
        <a href={card.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
          Sign up at {card.signupUrl} <ExternalLink className="w-3 h-3" />
        </a>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible>
          <AccordionItem value="configure" className="border-none">
            <AccordionTrigger className="text-sm py-2">Configure</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {card.fields.map(field => (
                <div key={field.key_name} className="space-y-1.5">
                  <Label htmlFor={field.key_name} className="text-sm">{field.label}</Label>
                  <div className="relative">
                    <Input
                      id={field.key_name}
                      type={field.type === "password" && !visible[field.key_name] ? "password" : "text"}
                      placeholder={hasExistingKey(field.key_name) ? "••••••••" : ""}
                      value={values[field.key_name] || ""}
                      onChange={e => setValues(prev => ({ ...prev, [field.key_name]: e.target.value }))}
                      onBlur={() => handleBlur(field)}
                      className="pr-10"
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setVisible(prev => ({ ...prev, [field.key_name]: !prev[field.key_name] }))}
                      >
                        {visible[field.key_name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  {field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
                  {errors[field.key_name] && <p className="text-xs text-destructive">{errors[field.key_name]}</p>}
                </div>
              ))}

              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
                {isConfigured && (
                  <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Test Connection
                  </Button>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsSettings() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations & API Keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your own service accounts to enable email, SMS and AI calling. Your keys are stored securely, used only on the server, and never visible in the browser.
        </p>
      </div>

      {SERVICE_CARDS.map(card => (
        <ServiceCardComponent key={card.service} card={card} />
      ))}
    </div>
  );
}

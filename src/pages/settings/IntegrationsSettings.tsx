import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Mail, Phone, Mic, Bot, CheckCircle2, Eye, EyeOff, ExternalLink, Loader2, ChevronRight, ChevronLeft, Info, Shield, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KeyField {
  key_name: string;
  label: string;
  type: "password" | "text";
  helper: string;
  validate?: (v: string) => string | null;
}

interface SetupStep {
  step: number;
  title: string;
  description: string;
}

interface ServiceCard {
  service: string;
  label: string;
  icon: React.ElementType;
  description: string;
  signupUrl: string;
  optional?: boolean;
  fields: KeyField[];
  setupSteps: SetupStep[];
  whatYouGet: string[];
  pricing: string;
}

const SERVICE_CARDS: ServiceCard[] = [
  {
    service: "resend",
    label: "Email via Resend",
    icon: Mail,
    description: "Send emails directly from the CRM — outreach sequences, follow-ups and templated communications from your own domain.",
    signupUrl: "https://resend.com",
    pricing: "Free tier: 3,000 emails/month • 100 emails/day",
    whatYouGet: [
      "Send personalised emails from contact records",
      "Use email templates with merge tags ({{first_name}}, {{company_name}})",
      "Track outreach campaigns with delivery status",
      "Send from your own domain for better deliverability",
    ],
    setupSteps: [
      { step: 1, title: "Create a Resend account", description: "Go to resend.com and sign up for a free account. No credit card required." },
      { step: 2, title: "Verify your sending domain", description: "In Resend dashboard → Domains → Add Domain. Add the DNS records they provide to your domain registrar. Wait for verification (usually 5–10 minutes)." },
      { step: 3, title: "Generate an API key", description: "In Resend dashboard → API Keys → Create API Key. Name it 'CRM Integration'. Copy the key — it starts with re_" },
      { step: 4, title: "Paste your credentials below", description: "Enter the API key and the email address you verified (e.g. hello@yourcompany.com). Click Save." },
    ],
    fields: [
      { key_name: "RESEND_API_KEY", label: "Resend API Key", type: "password", helper: "Starts with re_ — found in Resend Dashboard → API Keys", validate: v => v && !v.startsWith("re_") ? "Must start with re_" : null },
      { key_name: "FROM_EMAIL_ADDRESS", label: "From Email Address", type: "text", helper: "Must be a verified sender in your Resend account, e.g. hello@yourcompany.com" },
    ],
  },
  {
    service: "twilio",
    label: "SMS & Voice via Twilio",
    icon: Phone,
    description: "Send SMS messages to contacts and power AI-driven outbound voice calls — all logged automatically in the CRM.",
    signupUrl: "https://twilio.com",
    pricing: "Pay-as-you-go • SMS from $0.0079/msg • Voice from $0.013/min",
    whatYouGet: [
      "Send SMS directly from contact and outreach views",
      "GDPR-aware SMS gate — consent checked before sending",
      "AI-powered outbound calls with script support",
      "All communications logged as activities automatically",
    ],
    setupSteps: [
      { step: 1, title: "Create a Twilio account", description: "Go to twilio.com and sign up. You'll get a free trial with credit to test." },
      { step: 2, title: "Find your Account SID and Auth Token", description: "In Twilio Console → Account Info (top of dashboard). Your Account SID starts with AC. Click 'Show' to reveal the Auth Token." },
      { step: 3, title: "Get a phone number", description: "In Twilio Console → Phone Numbers → Buy a Number. Select one with SMS and Voice capabilities. Note it in E.164 format (e.g. +441234567890)." },
      { step: 4, title: "Paste your credentials below", description: "Enter all three values: Account SID, Auth Token, and your Twilio phone number. Click Save." },
    ],
    fields: [
      { key_name: "TWILIO_ACCOUNT_SID", label: "Account SID", type: "password", helper: "Starts with AC — found in Twilio Console → Account Info", validate: v => v && !v.startsWith("AC") ? "Must start with AC" : null },
      { key_name: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "password", helper: "Found in Twilio Console → Account Info (click 'Show')" },
      { key_name: "TWILIO_PHONE_NUMBER", label: "Twilio Phone Number", type: "text", helper: "E.164 format, e.g. +441234567890 — must have SMS + Voice capabilities" },
    ],
  },
  {
    service: "elevenlabs",
    label: "AI Voice via ElevenLabs",
    icon: Mic,
    description: "Add natural-sounding AI voices to your outbound calls. Makes automated calls sound human and professional.",
    signupUrl: "https://elevenlabs.io",
    optional: true,
    pricing: "Free tier: 10,000 characters/month • Paid from $5/month",
    whatYouGet: [
      "Natural AI voice on outbound calls (instead of robotic TTS)",
      "Multiple voice options and accents",
      "Professional-sounding automated outreach",
    ],
    setupSteps: [
      { step: 1, title: "Ensure Twilio is configured first", description: "ElevenLabs enhances Twilio calls — you need Twilio set up before this will work." },
      { step: 2, title: "Create an ElevenLabs account", description: "Go to elevenlabs.io and sign up. The free tier gives you enough to test." },
      { step: 3, title: "Generate an API key", description: "Click your profile icon → Profile + API Key → Generate. Copy the key." },
      { step: 4, title: "Paste your API key below", description: "Enter the key and click Save. AI voice will be used automatically on outbound calls." },
    ],
    fields: [
      { key_name: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key", type: "password", helper: "Found in ElevenLabs → Profile → API Key" },
    ],
  },
  {
    service: "anthropic",
    label: "Jarvis AI Assistant",
    icon: Bot,
    description: "Powers the Jarvis AI assistant — your intelligent CRM copilot that can search, create records, manage pipeline and draft communications using natural language.",
    signupUrl: "https://console.anthropic.com",
    pricing: "Pay-per-use • ~$3 per 1M input tokens • ~$15 per 1M output tokens",
    whatYouGet: [
      "Natural language CRM commands (\"Find contacts at Acme Corp\")",
      "AI-powered contact and company creation from conversation",
      "Pipeline management through chat",
      "Draft emails and communications with AI assistance",
      "All actions are audit-logged — your data is never used for training",
    ],
    setupSteps: [
      { step: 1, title: "Create an Anthropic account", description: "Go to console.anthropic.com and sign up. You'll need to add a payment method." },
      { step: 2, title: "Add billing credits", description: "In the Anthropic Console → Billing → Add credits. $5 is enough for thousands of queries." },
      { step: 3, title: "Generate an API key", description: "Go to API Keys → Create Key. Name it 'CRM Jarvis'. Copy the key — it starts with sk-ant-" },
      { step: 4, title: "Paste your API key below", description: "Enter the key and click Save. The Jarvis sparkle button will appear in the bottom-right of your CRM." },
    ],
    fields: [
      { key_name: "ANTHROPIC_API_KEY", label: "Anthropic API Key", type: "password", helper: "Starts with sk-ant- — found in Anthropic Console → API Keys", validate: v => v && !v.startsWith("sk-ant-") ? "Must start with sk-ant-" : null },
    ],
  },
];

function SetupGuide({ steps, signupUrl }: { steps: SetupStep[]; signupUrl: string }) {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Info className="w-4 h-4 text-primary" />
        Step-by-step setup
      </div>
      <ol className="space-y-2">
        {steps.map(s => (
          <li key={s.step} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
              {s.step}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href={signupUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-1"
      >
        Open {new URL(signupUrl).hostname} <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

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
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className={`p-2 rounded-lg ${isConfigured ? 'bg-emerald-500/10' : 'bg-muted'}`}>
              <card.icon className={`w-5 h-5 ${isConfigured ? 'text-emerald-600' : 'text-muted-foreground'}`} />
            </div>
            {card.label}
            {card.optional && <Badge variant="outline" className="text-xs">Optional</Badge>}
          </CardTitle>
          <Badge variant={isConfigured ? "default" : "secondary"} className={isConfigured ? "bg-emerald-600 text-white" : ""}>
            {isConfigured ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</> : "Not configured"}
          </Badge>
        </div>
        <CardDescription className="mt-2">{card.description}</CardDescription>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Zap className="w-3 h-3" /> {card.pricing}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {/* What you get */}
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs font-semibold text-foreground mb-2">What this enables:</p>
          <ul className="space-y-1">
            {card.whatYouGet.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="configure" className="border-none">
            <AccordionTrigger className="text-sm py-2 font-medium">
              {isConfigured ? "Update configuration" : "Set up now"}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Setup guide */}
              <SetupGuide steps={card.setupSteps} signupUrl={card.signupUrl} />

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Fields */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-foreground">Your credentials</p>
                {card.fields.map(field => (
                  <div key={field.key_name} className="space-y-1.5">
                    <Label htmlFor={field.key_name} className="text-sm flex items-center gap-2">
                      {field.label}
                      {hasExistingKey(field.key_name) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-300">Saved</Badge>
                      )}
                    </Label>
                    <div className="relative">
                      <Input
                        id={field.key_name}
                        type={field.type === "password" && !visible[field.key_name] ? "password" : "text"}
                        placeholder={hasExistingKey(field.key_name) ? "••••••••  (enter new value to update)" : "Paste here…"}
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
              </div>

              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save Keys
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
  const navigate = useNavigate();
  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="
            inline-flex items-center gap-1.5
            text-sm font-medium
            text-foreground
            px-2 py-1 -ml-2 rounded-md
            transition-all duration-150
            hover:bg-accent
            border-l-2 border-transparent
            hover:border-primary
            group
          "
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
          Back
        </button>
        <h1 className="text-2xl font-bold">Integrations & API Keys</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your own service accounts to enable email, SMS, AI calling and the Jarvis assistant. Follow the step-by-step guides below for each service.
        </p>
        <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Security:</strong> All API keys are encrypted at rest, stored per-user, and only used on the server. They are never exposed to the browser or shared with other users.
          </p>
        </div>
      </div>

      {SERVICE_CARDS.map(card => (
        <ServiceCardComponent key={card.service} card={card} />
      ))}
    </div>
  );
}

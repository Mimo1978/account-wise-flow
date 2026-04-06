import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, Linkedin, MapPin, Calendar, User, Briefcase, MessageSquare, Network } from "lucide-react";
import { CallActionModal } from "@/components/canvas/CallActionModal";
import { ScheduleActionModal } from "@/components/canvas/ScheduleActionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  contact: any;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarGradient(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    "from-blue-500 to-cyan-400",
    "from-violet-500 to-purple-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-orange-400",
    "from-rose-500 to-pink-400",
    "from-indigo-500 to-blue-400",
  ];
  return gradients[hash % gradients.length];
}

const STATUS_OPTIONS = [
  { value: "champion", label: "Champion", color: "bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30" },
  { value: "engaged", label: "Engaged", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" },
  { value: "warm", label: "Warm", color: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30" },
  { value: "unknown", label: "Unknown", color: "bg-muted text-muted-foreground border-border hover:bg-muted/80" },
  { value: "blocker", label: "Blocker", color: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" },
];

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  engaged: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  champion: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  blocker: "bg-red-500/20 text-red-400 border-red-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function ContactIdentityCard({ contact }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const initials = getInitials(contact.name);
  const gradient = getAvatarGradient(contact.name);
  const status = contact.status || "unknown";
  const company = contact.companies;

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("contacts")
        .update({ status: newStatus })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-detail", contact.id] });
      qc.invalidateQueries({ queryKey: ["canvas-company"], exact: false });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  return (
    <div className="rounded-xl border border-border bg-card border-l-4 border-l-primary p-5 space-y-5">
      {/* Avatar + Name */}
      <div className="flex flex-col items-center text-center gap-3">
        <div
          className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
        >
          {initials}
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">{contact.name}</h1>
          {contact.title && (
            <p className="text-sm text-muted-foreground mt-0.5">{contact.title}</p>
          )}
          {company && (
            <button
              onClick={() => navigate(`/companies/${company.id}`)}
              className="text-sm text-[#378ADD] hover:underline mt-0.5"
            >
              {company.name}
            </button>
          )}
        </div>
        <Badge variant="outline" className={`text-xs ${statusColors[status]}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </div>

      <Separator className="bg-border" />

      {/* Relationship Status Selector */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Relationship Status
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateStatus.mutate(opt.value)}
              disabled={updateStatus.isPending}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                opt.color,
                status === opt.value && "ring-2 ring-offset-1 ring-offset-card ring-current font-bold"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-border" />

      {/* Contact Details */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Contact Details
        </h3>
        <DetailRow icon={Mail} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
        <DetailRow icon={Phone} label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
        {contact.linkedin_url && (
          <DetailRow icon={Linkedin} label="LinkedIn" value="Profile" href={contact.linkedin_url} external />
        )}
        <DetailRow icon={MapPin} label="Location" value={contact.location} />
      </div>

      <Separator className="bg-border" />

      {/* Relationship */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Relationship
        </h3>
        <DetailRow icon={Briefcase} label="Seniority" value={contact.seniority} />
        <DetailRow icon={User} label="Department" value={contact.department} />
        <DetailRow icon={User} label="Owner" value={contact.owner_id ? "Assigned" : "Unassigned"} />
        <DetailRow icon={Calendar} label="Last Contacted" value={contact.updated_at ? new Date(contact.updated_at).toLocaleDateString() : "—"} />
      </div>

      <Separator className="bg-border" />

      {/* Quick Actions */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="justify-start gap-2"
            onClick={() => contact.email && window.open(`mailto:${contact.email}`)}
            disabled={!contact.email}
          >
            <Mail className="h-4 w-4" /> Email
          </Button>
          <CallActionModal phone={contact.phone} email={contact.email} contactName={contact.name}>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Phone className="h-4 w-4" /> Call
            </Button>
          </CallActionModal>
          <ScheduleActionModal email={contact.email} contactName={contact.name}>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Calendar className="h-4 w-4" /> Schedule
            </Button>
          </ScheduleActionModal>
          <Button variant="outline" size="sm" className="justify-start gap-2"
            onClick={() => navigate(`/canvas?company=${contact.company_id}`)}
            disabled={!contact.company_id}
          >
            <Network className="h-4 w-4" /> Canvas
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2"
          onClick={() => {
            const tab = document.querySelector('[data-value="notes"]') as HTMLElement;
            tab?.click();
            setTimeout(() => document.getElementById("note-composer")?.focus(), 120);
          }}
        >
          <MessageSquare className="h-4 w-4" /> Add Note
        </Button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: any;
  label: string;
  value?: string | null;
  href?: string;
  external?: boolean;
}) {
  const display = value || "—";
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      {href && value ? (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          className="text-[#378ADD] hover:underline truncate"
        >
          {display}
        </a>
      ) : (
        <span className="text-foreground truncate">{display}</span>
      )}
    </div>
  );
}

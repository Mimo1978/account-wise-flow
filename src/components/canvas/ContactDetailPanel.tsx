import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ContactDetailTabs } from "@/components/contact-detail/ContactDetailTabs";
import { ContactIdentityCard } from "@/components/contact-detail/ContactIdentityCard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactDetailPanelProps {
  contact: Contact | null;
  onClose: () => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  readOnly?: boolean;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  champion: { label: "Champion", color: "bg-violet-500/20 text-violet-400" },
  engaged: { label: "Engaged", color: "bg-emerald-500/20 text-emerald-400" },
  warm: { label: "Warm", color: "bg-amber-500/20 text-amber-400" },
  new: { label: "New", color: "bg-blue-500/20 text-blue-400" },
  blocker: { label: "Blocker", color: "bg-red-500/20 text-red-400" },
  unknown: { label: "Unknown", color: "bg-muted text-muted-foreground" },
};

export const ContactDetailPanel = ({
  contact,
  onClose,
  isExpanded = false,
  onExpandToggle,
  onUnsavedChanges,
  readOnly = false,
}: ContactDetailPanelProps) => {
  const navigate = useNavigate();

  // Fetch the full contact record from DB so ContactDetailTabs has all fields
  const { data: fullContact } = useQuery({
    queryKey: ["contact-detail-panel", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies!contacts_company_id_fkey(id, name, industry)")
        .eq("id", contact.id)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!contact?.id,
  });

  if (!contact) return null;

  const statusInfo = statusConfig[contact.status as string] || statusConfig.unknown;
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const displayContact = fullContact || contact;

  return (
    <>
      {/* Backdrop for full-screen mode */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[9998] bg-black/40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-[9999] flex flex-col bg-background border-l border-border shadow-2xl transition-all duration-300 ease-out",
          isExpanded
            ? "inset-4 rounded-2xl border shadow-2xl"
            : "w-[50vw] h-full"
        )}
        style={isExpanded ? undefined : { maxWidth: "800px", minWidth: "480px" }}
      >
        {/* Compact header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <Avatar className="w-8 h-8 shrink-0 ring-1 ring-primary/20">
            <AvatarImage src={(contact as any).profilePhoto} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold truncate">{contact.name}</h2>
              <Badge className={cn(statusInfo.color, "text-[10px] px-1.5 py-0 h-4 shrink-0 border-0")}>
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {contact.title}
              {(contact as any).companies?.name && ` · ${(contact as any).companies.name}`}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(`/contacts/${contact.id}`)}
              title="Open full contact page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open</span>
            </Button>
            {onExpandToggle && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onExpandToggle}
                className="h-7 w-7"
                title={isExpanded ? "Exit full screen" : "Full screen"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Body — reuses the main contact page layout */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn(
            "flex flex-col gap-6 p-4",
            isExpanded && "lg:flex-row"
          )}>
            {/* Identity card — only shown in expanded/full-screen mode */}
            {isExpanded && (
              <div className="w-full lg:w-[35%] lg:sticky lg:top-0 lg:self-start shrink-0">
                <ContactIdentityCard contact={displayContact} />
              </div>
            )}

            {/* Notes, Deals, Projects — always shown */}
            <div className={cn("flex-1 min-w-0", isExpanded && "lg:w-[65%]")}>
              <ContactDetailTabs contact={displayContact} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

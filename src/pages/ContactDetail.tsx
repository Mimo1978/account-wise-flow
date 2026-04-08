import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minimize2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactDetailHeader } from "@/components/contact-detail/ContactDetailHeader";
import { ContactIdentityCard } from "@/components/contact-detail/ContactIdentityCard";
import { ContactDetailTabs } from "@/components/contact-detail/ContactDetailTabs";
import { cn } from "@/lib/utils";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCompact, setIsCompact] = useState(false);

  const { data: contact, isLoading, error } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("*, companies!contacts_company_id_fkey(id, name, industry)")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleClose = () => {
    navigate(location.state?.from || "/contacts");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-lg font-medium">Contact not found</p>
        <button
          onClick={() => navigate("/contacts")}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
    <div className={cn(
      "container mx-auto px-6 py-8 max-w-7xl space-y-6 transition-all duration-300",
      isCompact && "max-w-2xl ml-auto"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <ContactDetailHeader contact={contact} />
        </div>
        <div className="flex items-center gap-1 ml-4 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsCompact(c => !c)}
            title={isCompact ? "Expand to full width" : "Shrink to half width"}
          >
            {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClose}
            title="Close contact"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className={cn(
        "flex flex-col lg:flex-row gap-6",
        isCompact && "lg:flex-col"
      )}>
        {/* Left Column — Identity Card (sticky) */}
        <div className={cn(
          "w-full lg:sticky lg:top-6 lg:self-start",
          isCompact ? "lg:w-full" : "lg:w-[35%]"
        )}>
          <ContactIdentityCard contact={contact} />
        </div>

        {/* Right Column — Tabs */}
        <div className={cn(
          "w-full min-w-0",
          isCompact ? "lg:w-full" : "lg:w-[65%]"
        )}>
          <ContactDetailTabs contact={contact} />
        </div>
      </div>
    </div>
  );
}

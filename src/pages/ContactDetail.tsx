import { CMSectionLoader } from "@/components/ui/CMLoader";
import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Minimize2, Maximize2, X, ChevronLeft } from "lucide-react";
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

  const backFrom = (location.state as any)?.from as string | undefined;
  const backLabel = (location.state as any)?.fromLabel as string | undefined;
  const handleBack = () => navigate(backFrom || "/contacts");

  if (isLoading) {
    return (
      <CMSectionLoader />
    );
  }

  if (error || !contact) {
    return (
      <div className="h-full overflow-y-auto bg-background">
        <div className="container mx-auto px-6 py-6 max-w-7xl">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 -ml-2 mb-6">
            <ChevronLeft className="h-4 w-4" /> {backLabel || "Back to Contacts"}
          </Button>
          <div className="text-center text-muted-foreground py-16">
            <p className="text-lg font-medium text-foreground">Contact not found</p>
            <p className="text-sm mt-2">This contact may have been deleted or you don't have access.</p>
          </div>
      </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-background">
    <div className={cn(
      "container mx-auto px-6 py-8 max-w-7xl space-y-6 transition-all duration-300",
      isCompact && "max-w-2xl ml-auto"
    )}>
      <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 -ml-2">
        <ChevronLeft className="h-4 w-4" /> {backLabel || "Back to Contacts"}
      </Button>
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
    </div>
  );
}

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ContactDetailHeader } from "@/components/contact-detail/ContactDetailHeader";
import { ContactIdentityCard } from "@/components/contact-detail/ContactIdentityCard";
import { ContactDetailTabs } from "@/components/contact-detail/ContactDetailTabs";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
    <div className="h-full overflow-y-auto space-y-4 p-6">
      <ContactDetailHeader contact={contact} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column — Identity Card (sticky) */}
        <div className="w-full lg:w-[35%] lg:sticky lg:top-6 lg:self-start">
          <ContactIdentityCard contact={contact} />
        </div>

        {/* Right Column — Tabs */}
        <div className="w-full lg:w-[65%] min-w-0">
          <ContactDetailTabs contact={contact} />
        </div>
      </div>
    </div>
  );
}

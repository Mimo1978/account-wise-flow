import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2, AlertTriangle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { DeletionRequestBanner } from "@/components/deletion/DeletionRequestBanner";
import { useDeletionPermission } from "@/hooks/use-deletion";
import { EditContactModal } from "./EditContactModal";
import { AICallModal } from "@/components/communications/AICallModal";
import { AddToCampaignButton } from "@/components/outreach/AddToCampaignButton";

interface Props {
  contact: any;
}

export function ContactDetailHeader({ contact }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const perm = useDeletionPermission();

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(location.state?.from || "/contacts")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground px-2 py-1 -ml-2 rounded-md transition-all duration-150 hover:bg-accent border-l-2 border-transparent hover:border-primary group"
          >
            <ChevronLeft className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5" />
            {location.state?.fromLabel || "Back to Contacts"}
          </button>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium text-foreground">{contact.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {contact.phone && (
            <Button variant="outline" size="sm" onClick={() => setCallOpen(true)} className="gap-1.5">
              <Phone className="h-4 w-4" />
              AI Call
            </Button>
          )}
          <AddToCampaignButton
            entityType="contact"
            entityId={contact.id}
            entityName={contact.name}
            entityEmail={contact.email}
            entityPhone={contact.phone || contact.mobile}
            entityTitle={contact.title || contact.job_title}
            entityCompany={contact.companies?.name}
          />
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
          {perm.canSeeDeleteOption && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {perm.canDeleteDirectly ? "Delete" : "Request Deletion"}
            </Button>
          )}
        </div>
      </div>

      <DeletionRequestBanner recordType="contacts" recordId={contact.id} />

      <DeleteRecordModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        recordType="contacts"
        recordId={contact.id}
        recordName={contact.name}
        onDeleted={() => navigate(location.state?.from || "/contacts")}
      />
      <EditContactModal open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <AICallModal
        open={callOpen}
        onOpenChange={setCallOpen}
        contactId={contact.id}
        contactFirstName={contact.first_name || contact.name?.split(" ")[0] || ""}
        contactLastName={contact.last_name || contact.name?.split(" ").slice(1).join(" ") || ""}
        contactMobile={contact.phone || contact.mobile}
      />
    </>
  );
}

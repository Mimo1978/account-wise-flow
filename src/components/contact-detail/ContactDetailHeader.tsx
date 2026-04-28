import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2, AlertTriangle, Phone, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteRecordModal } from "@/components/deletion/DeleteRecordModal";
import { DeletionRequestBanner } from "@/components/deletion/DeletionRequestBanner";
import { useDeletionPermission } from "@/hooks/use-deletion";
import { EditContactModal } from "./EditContactModal";
import { AICallModal } from "@/components/communications/AICallModal";
import { EmailComposeModal } from "@/components/communications/EmailComposeModal";
import { SMSComposeModal } from "@/components/communications/SMSComposeModal";
import { ScheduleCallbackPopover } from "@/components/outreach/ScheduleCallbackPopover";
import { AddToCampaignButton } from "@/components/outreach/AddToCampaignButton";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Props {
  contact: any;
}

export function ContactDetailHeader({ contact }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
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

        <div className="flex flex-wrap items-center gap-1.5">
          {contact.phone && (
            <Button
              size="sm"
              onClick={() => setCallOpen(true)}
              className="gap-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/25 hover:text-emerald-200 hover:border-emerald-400/70 shadow-[0_0_12px_-2px_hsl(152_76%_45%/0.45)]"
            >
              <Phone className="h-4 w-4" />
              AI Call
            </Button>
          )}
          {contact.email && (
            <Button
              size="sm"
              onClick={() => setEmailOpen(true)}
              className="gap-1.5 bg-sky-500/15 text-sky-300 border border-sky-500/50 hover:bg-sky-500/25 hover:text-sky-200 hover:border-sky-400/70 shadow-[0_0_12px_-2px_hsl(199_89%_55%/0.45)]"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          )}
          {(contact.phone || contact.mobile) && (
            <Button
              size="sm"
              onClick={() => setSmsOpen(true)}
              className="gap-1.5 bg-violet-500/15 text-violet-300 border border-violet-500/50 hover:bg-violet-500/25 hover:text-violet-200 hover:border-violet-400/70 shadow-[0_0_12px_-2px_hsl(262_83%_65%/0.45)]"
            >
              <MessageSquare className="h-4 w-4" />
              SMS
            </Button>
          )}
          <ScheduleCallbackPopover
            workspaceId={currentWorkspace?.id || ""}
            entityName={contact.name}
            contactId={contact.id}
            bright
          />
          <AddToCampaignButton
            entityType="contact"
            entityId={contact.id}
            entityName={contact.name}
            entityEmail={contact.email}
            entityPhone={contact.phone || contact.mobile}
            entityTitle={contact.title || contact.job_title}
            entityCompany={contact.companies?.name}
            bright
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
      <EmailComposeModal
        open={emailOpen}
        onOpenChange={setEmailOpen}
        contactId={contact.id}
        contactEmail={contact.email}
        contactFirstName={contact.first_name || contact.name?.split(" ")[0] || ""}
        companyId={contact.company_id}
        companyName={contact.companies?.name}
        entityType="contact"
      />
      <SMSComposeModal
        open={smsOpen}
        onOpenChange={setSmsOpen}
        contactId={contact.id}
        contactMobile={contact.phone || contact.mobile}
        contactFirstName={contact.first_name || contact.name?.split(" ")[0] || ""}
        companyId={contact.company_id}
        entityType="contact"
        gdprConsent={contact.gdpr_consent ?? contact.marketing_consent ?? false}
      />
    </>
  );
}

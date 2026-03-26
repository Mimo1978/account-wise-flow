import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, Bot } from "lucide-react";
import { EmailComposeModal } from "@/components/outreach/EmailComposeModal";
import { SMSComposeModal } from "@/components/outreach/SMSComposeModal";
import { AICallAgentModal } from "@/components/outreach/AICallAgentModal";
import { AddToOutreachPopover } from "@/components/outreach/AddToOutreachPopover";
import { ScheduleCallbackPopover } from "@/components/outreach/ScheduleCallbackPopover";
import type { OutreachTarget } from "@/hooks/use-outreach";

interface RowInlineActionsProps {
  workspaceId: string;
  entityName: string;
  entityEmail?: string;
  entityPhone?: string;
  entityTitle?: string;
  entityCompany?: string;
  contactId?: string;
  candidateId?: string;
  /** Extra className for the wrapper */
  className?: string;
}

/**
 * Inline action buttons (Email, SMS, AI Call, Add to Outreach) for table rows.
 * Designed to appear on hover via parent group class.
 */
export function RowInlineActions({
  workspaceId,
  entityName,
  entityEmail,
  entityPhone,
  entityTitle,
  entityCompany,
  contactId,
  candidateId,
  className,
}: RowInlineActionsProps) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [aiCallOpen, setAiCallOpen] = useState(false);

  // Build a minimal OutreachTarget-like object for the existing modal components
  const fakeTarget: OutreachTarget = {
    id: contactId || candidateId || "",
    workspace_id: workspaceId,
    campaign_id: "",
    contact_id: contactId,
    candidate_id: candidateId,
    entity_type: candidateId ? "candidate" : "contact",
    entity_name: entityName,
    entity_email: entityEmail,
    entity_phone: entityPhone,
    entity_title: entityTitle,
    entity_company: entityCompany,
    state: "queued",
    priority: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <>
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {entityEmail && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={`Email ${entityName}`}
            onClick={(e) => { e.stopPropagation(); setEmailOpen(true); }}
          >
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        {entityPhone && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title={`SMS ${entityName}`}
            onClick={(e) => { e.stopPropagation(); setSmsOpen(true); }}
          >
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          title={`AI Call ${entityName}`}
          onClick={(e) => { e.stopPropagation(); setAiCallOpen(true); }}
        >
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <AddToOutreachPopover
          workspaceId={workspaceId}
          entityName={entityName}
          entityEmail={entityEmail}
          entityPhone={entityPhone}
          entityTitle={entityTitle}
          entityCompany={entityCompany}
          contactId={contactId}
          candidateId={candidateId}
        />
      </div>

      {/* Modals rendered outside the hover container */}
      <EmailComposeModal target={fakeTarget} open={emailOpen} onOpenChange={setEmailOpen} />
      <SMSComposeModal target={fakeTarget} open={smsOpen} onOpenChange={setSmsOpen} />
      <AICallAgentModal target={fakeTarget} open={aiCallOpen} onOpenChange={setAiCallOpen} />
    </>
  );
}

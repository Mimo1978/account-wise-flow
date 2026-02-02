import { Contact } from "@/lib/types";
import { DocumentList } from "@/components/documents";
import { usePermissions } from "@/hooks/use-permissions";

interface ContactDocumentsTabProps {
  contact: Contact;
}

export function ContactDocumentsTab({ contact }: ContactDocumentsTabProps) {
  const { canEdit } = usePermissions();

  return (
    <DocumentList
      entityType="contact"
      entityId={contact.id}
      entityName={contact.name}
      canEdit={canEdit}
      showCategoryBreakdown={true}
    />
  );
}

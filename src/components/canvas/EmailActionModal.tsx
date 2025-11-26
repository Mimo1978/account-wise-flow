import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Mail, 
  Building2, 
  User, 
  Copy, 
  MessageCircle, 
  Check,
  ChevronRight,
  Sparkles,
  FileText,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EmailAddress {
  type: "work" | "personal" | "alternate" | "other";
  email: string;
  label?: string;
  primary?: boolean;
}

interface EmailActionModalProps {
  email?: string;
  phone?: string;
  contactName: string;
  children: React.ReactNode;
  onOpenComposer?: (email: string, template?: string) => void;
}

// Parse a single email into multiple addresses (simulated for demo)
const parseEmailAddresses = (email?: string): EmailAddress[] => {
  if (!email) return [];
  
  const emails: EmailAddress[] = [
    { type: "work", email: email, label: "Work Email", primary: true },
  ];
  
  // Simulate additional emails for demo
  if (email.length > 0) {
    const domain = email.split("@")[1] || "gmail.com";
    const name = email.split("@")[0];
    emails.push({ 
      type: "personal", 
      email: `${name}.personal@gmail.com`, 
      label: "Personal Email" 
    });
  }
  
  return emails;
};

const getEmailIcon = (type: string) => {
  switch (type) {
    case "work":
      return <Building2 className="w-4 h-4" />;
    case "personal":
      return <User className="w-4 h-4" />;
    default:
      return <Mail className="w-4 h-4" />;
  }
};

const emailTemplates = [
  { id: "followup", label: "Follow Up", icon: Clock },
  { id: "intro", label: "Introduction", icon: User },
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "bump", label: "Bump", icon: Sparkles },
];

export const EmailActionModal = ({ 
  email, 
  phone, 
  contactName, 
  children,
  onOpenComposer 
}: EmailActionModalProps) => {
  const [open, setOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailAddress | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const emailAddresses = parseEmailAddresses(email);

  const handleCopyEmail = (emailAddr: string) => {
    navigator.clipboard.writeText(emailAddr);
    setCopiedEmail(emailAddr);
    toast.success("Email address copied to clipboard");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleOpenOutlook = (emailAddr: string) => {
    window.open(`ms-outlook://compose?to=${encodeURIComponent(emailAddr)}`, "_self");
    setOpen(false);
  };

  const handleOpenGmail = (emailAddr: string) => {
    window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailAddr)}`, "_blank");
    setOpen(false);
  };

  const handleOpenAppleMail = (emailAddr: string) => {
    window.open(`mailto:${emailAddr}`, "_self");
    setOpen(false);
  };

  const handleWhatsApp = () => {
    if (phone) {
      const formattedNumber = phone.replace(/[^\d+]/g, "");
      window.open(`https://wa.me/${formattedNumber}`, "_blank");
      setOpen(false);
    }
  };

  const handleOpenCRMComposer = (emailAddr: string, template?: string) => {
    if (onOpenComposer) {
      onOpenComposer(emailAddr, template);
    } else {
      toast.info("CRM Email Composer - Coming soon!", {
        description: template ? `Template: ${template}` : "AI-powered email composition"
      });
    }
    setOpen(false);
  };

  const handleSelectEmail = (emailAddr: EmailAddress) => {
    setSelectedEmail(emailAddr);
    setShowTemplates(false);
  };

  const handleBack = () => {
    if (showTemplates) {
      setShowTemplates(false);
    } else {
      setSelectedEmail(null);
    }
  };

  if (emailAddresses.length === 0) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {children}
        </PopoverTrigger>
        <PopoverContent 
          align="start" 
          className="w-64 p-3 z-[10000] bg-popover border border-border shadow-lg"
          sideOffset={8}
        >
          <div className="text-center py-4 text-muted-foreground">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No email address available</p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setSelectedEmail(null);
        setShowTemplates(false);
      }
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        align="start" 
        className="w-72 p-0 z-[10000] bg-popover border border-border shadow-lg overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-medium">
            {showTemplates ? "Choose Template" : selectedEmail ? "Choose Action" : `Email ${contactName}`}
          </p>
          {(selectedEmail || showTemplates) && (
            <button 
              onClick={handleBack}
              className="text-xs text-primary hover:underline mt-1"
            >
              ← {showTemplates ? "Back to actions" : "Back to emails"}
            </button>
          )}
        </div>

        <div className="p-2">
          {!selectedEmail ? (
            // Email Addresses List
            <div className="space-y-1">
              {emailAddresses.map((emailAddr, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectEmail(emailAddr)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-full bg-primary/10">
                      {getEmailIcon(emailAddr.type)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{emailAddr.label || emailAddr.type}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{emailAddr.email}</p>
                    </div>
                  </div>
                  {emailAddr.primary && (
                    <span className="text-xs text-primary font-medium mr-2">Primary</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : showTemplates ? (
            // Template Selection
            <div className="space-y-1">
              {emailTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleOpenCRMComposer(selectedEmail.email, template.label)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                >
                  <span className="p-1.5 rounded-full bg-primary/10">
                    <template.icon className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-sm">{template.label}</span>
                </button>
              ))}
            </div>
          ) : (
            // Action Buttons for Selected Email
            <div className="space-y-1">
              {/* Selected Email Display */}
              <div className="px-3 py-2 mb-2 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">{selectedEmail.label}</p>
                <p className="text-sm font-medium truncate">{selectedEmail.email}</p>
              </div>

              {/* CRM Email Composer with AI */}
              <button
                onClick={() => setShowTemplates(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1.5 rounded-full bg-primary/10">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </span>
                  <div>
                    <span className="text-sm">CRM Email Composer</span>
                    <p className="text-xs text-muted-foreground">AI suggestions & templates</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Divider */}
              <div className="h-px bg-border my-2" />

              {/* Open in Outlook */}
              <button
                onClick={() => handleOpenOutlook(selectedEmail.email)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-[#0078D4]/10">
                  <Mail className="w-4 h-4 text-[#0078D4]" />
                </span>
                <span className="text-sm">Open in Outlook</span>
              </button>

              {/* Open in Gmail */}
              <button
                onClick={() => handleOpenGmail(selectedEmail.email)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-[#EA4335]/10">
                  <Mail className="w-4 h-4 text-[#EA4335]" />
                </span>
                <span className="text-sm">Open in Gmail</span>
              </button>

              {/* Open in Apple Mail */}
              <button
                onClick={() => handleOpenAppleMail(selectedEmail.email)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-[#007AFF]/10">
                  <Mail className="w-4 h-4 text-[#007AFF]" />
                </span>
                <span className="text-sm">Open in Apple Mail</span>
              </button>

              {/* WhatsApp (if phone exists) */}
              {phone && (
                <button
                  onClick={handleWhatsApp}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                >
                  <span className="p-1.5 rounded-full bg-[#25D366]/10">
                    <MessageCircle className="w-4 h-4 text-[#25D366]" />
                  </span>
                  <span className="text-sm">WhatsApp Message</span>
                </button>
              )}

              {/* Divider */}
              <div className="h-px bg-border my-2" />

              {/* Copy Email */}
              <button
                onClick={() => handleCopyEmail(selectedEmail.email)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-muted">
                  {copiedEmail === selectedEmail.email ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </span>
                <span className="text-sm">
                  {copiedEmail === selectedEmail.email ? "Copied!" : "Copy Email Address"}
                </span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

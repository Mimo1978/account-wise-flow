import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Phone, 
  Smartphone, 
  Building2, 
  Copy, 
  MessageCircle, 
  Video,
  Users,
  Ban,
  Check,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhoneNumber {
  type: "mobile" | "work" | "office" | "other";
  number: string;
  label?: string;
  doNotCall?: boolean;
}

interface CallActionModalProps {
  phone?: string;
  email?: string;
  contactName: string;
  children: React.ReactNode;
}

// Parse a single phone into multiple numbers (simulated for demo)
const parsePhoneNumbers = (phone?: string): PhoneNumber[] => {
  if (!phone) return [];
  
  // For demo purposes, create mobile from the provided phone
  // In a real app, the Contact type would have multiple phone fields
  const numbers: PhoneNumber[] = [
    { type: "mobile", number: phone, label: "Mobile" },
  ];
  
  // Simulate additional numbers for demo
  if (phone.length > 0) {
    numbers.push({ type: "work", number: phone.replace(/\d$/, "0"), label: "Work" });
  }
  
  return numbers;
};

const getPhoneIcon = (type: string) => {
  switch (type) {
    case "mobile":
      return <Smartphone className="w-4 h-4" />;
    case "work":
    case "office":
      return <Building2 className="w-4 h-4" />;
    default:
      return <Phone className="w-4 h-4" />;
  }
};

const formatPhoneForUrl = (phone: string) => {
  return phone.replace(/[^\d+]/g, "");
};

export const CallActionModal = ({ phone, email, contactName, children }: CallActionModalProps) => {
  const [open, setOpen] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);
  const [isAppleDevice, setIsAppleDevice] = useState(false);
  
  const phoneNumbers = parsePhoneNumbers(phone);

  useEffect(() => {
    // Detect Apple device for FaceTime
    const ua = navigator.userAgent;
    setIsAppleDevice(/iPad|iPhone|iPod|Macintosh/.test(ua));
  }, []);

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success("Phone number copied to clipboard");
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const handleCall = (number: string) => {
    window.open(`tel:${formatPhoneForUrl(number)}`, "_self");
    setOpen(false);
  };

  const handleWhatsApp = (number: string) => {
    const formattedNumber = formatPhoneForUrl(number);
    window.open(`https://wa.me/${formattedNumber}`, "_blank");
    setOpen(false);
  };

  const handleFaceTime = (number: string) => {
    window.open(`facetime:${formatPhoneForUrl(number)}`, "_self");
    setOpen(false);
  };

  const handleTeamsCall = () => {
    if (email) {
      window.open(`msteams://teams.microsoft.com/l/call/0/0?users=${email}`, "_self");
      setOpen(false);
    }
  };

  const handleSelectNumber = (phoneNum: PhoneNumber) => {
    if (phoneNum.doNotCall) {
      toast.error("This number is marked as Do Not Call");
      return;
    }
    setSelectedNumber(phoneNum);
  };

  const handleBack = () => {
    setSelectedNumber(null);
  };

  if (phoneNumbers.length === 0) {
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
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No phone number available</p>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) setSelectedNumber(null);
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
            {selectedNumber ? "Choose Action" : `Contact ${contactName}`}
          </p>
          {selectedNumber && (
            <button 
              onClick={handleBack}
              className="text-xs text-primary hover:underline mt-1"
            >
              ← Back to numbers
            </button>
          )}
        </div>

        <div className="p-2">
          {!selectedNumber ? (
            // Phone Numbers List
            <div className="space-y-1">
              {phoneNumbers.map((phoneNum, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectNumber(phoneNum)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-colors",
                    phoneNum.doNotCall 
                      ? "bg-destructive/10 text-muted-foreground cursor-not-allowed" 
                      : "hover:bg-accent"
                  )}
                  disabled={phoneNum.doNotCall}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "p-1.5 rounded-full",
                      phoneNum.doNotCall ? "bg-destructive/20" : "bg-primary/10"
                    )}>
                      {phoneNum.doNotCall ? (
                        <Ban className="w-4 h-4 text-destructive" />
                      ) : (
                        getPhoneIcon(phoneNum.type)
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{phoneNum.label || phoneNum.type}</p>
                      <p className="text-xs text-muted-foreground">{phoneNum.number}</p>
                    </div>
                  </div>
                  {phoneNum.doNotCall ? (
                    <span className="text-xs text-destructive font-medium">Do Not Call</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            // Action Buttons for Selected Number
            <div className="space-y-1">
              {/* Selected Number Display */}
              <div className="px-3 py-2 mb-2 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground">{selectedNumber.label}</p>
                <p className="text-sm font-medium">{selectedNumber.number}</p>
              </div>

              {/* Call via Device Dialer */}
              <button
                onClick={() => handleCall(selectedNumber.number)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-success/10">
                  <Phone className="w-4 h-4 text-success" />
                </span>
                <span className="text-sm">Call via Phone</span>
              </button>

              {/* WhatsApp */}
              <button
                onClick={() => handleWhatsApp(selectedNumber.number)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-[#25D366]/10">
                  <MessageCircle className="w-4 h-4 text-[#25D366]" />
                </span>
                <span className="text-sm">WhatsApp</span>
              </button>

              {/* FaceTime (Apple only) */}
              {isAppleDevice && (
                <button
                  onClick={() => handleFaceTime(selectedNumber.number)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                >
                  <span className="p-1.5 rounded-full bg-[#32CD32]/10">
                    <Video className="w-4 h-4 text-[#32CD32]" />
                  </span>
                  <span className="text-sm">FaceTime</span>
                </button>
              )}

              {/* Teams Call */}
              {email && (
                <button
                  onClick={handleTeamsCall}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
                >
                  <span className="p-1.5 rounded-full bg-[#6264A7]/10">
                    <Users className="w-4 h-4 text-[#6264A7]" />
                  </span>
                  <span className="text-sm">Microsoft Teams</span>
                </button>
              )}

              {/* Divider */}
              <div className="h-px bg-border my-2" />

              {/* Copy Number */}
              <button
                onClick={() => handleCopyNumber(selectedNumber.number)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <span className="p-1.5 rounded-full bg-muted">
                  {copiedNumber === selectedNumber.number ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </span>
                <span className="text-sm">
                  {copiedNumber === selectedNumber.number ? "Copied!" : "Copy Number"}
                </span>
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
import { useState } from "react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeButtonProps {
  accountId: string;
  accountName: string;
}

export const QRCodeButton = ({ accountId, accountName }: QRCodeButtonProps) => {
  const [open, setOpen] = useState(false);
  
  // Generate URL for mobile app or web view
  const qrUrl = `${window.location.origin}/canvas?account=${accountId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <QrCode className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mobile Access</DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to view {accountName} on mobile
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center p-6">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={qrUrl}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Use your phone to capture contacts, add voice notes, and sync instantly
        </p>
      </DialogContent>
    </Dialog>
  );
};

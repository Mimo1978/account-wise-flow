import { useState, useRef } from "react";
import { Camera, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PhotoCaptureProps {
  onDataExtracted: (data: any) => void;
}

export const PhotoCapture = ({ onDataExtracted }: PhotoCaptureProps) => {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        
        // In a real implementation, this would call an AI service to extract data
        // For now, simulate the extraction
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Mock extracted data
        const extractedData = {
          name: "John Smith",
          email: "john.smith@example.com",
          title: "Director of Engineering",
          phone: "+1 (555) 123-4567",
          company: "Tech Corp",
          note: "Met at Tech Conference 2025 - interested in our platform"
        };
        
        onDataExtracted(extractedData);
        toast.success("Contact data extracted successfully");
        setOpen(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Camera className="w-4 h-4" />
          Capture Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture Contact Information</DialogTitle>
          <DialogDescription>
            Upload a business card, LinkedIn screenshot, or handwritten note. AI will extract the contact details.
          </DialogDescription>
        </DialogHeader>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-3">
          <Button
            onClick={triggerFileInput}
            disabled={isProcessing}
            className="w-full gap-2"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Choose Photo
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Supports: Business cards, LinkedIn profiles, handwritten notes, whiteboards
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

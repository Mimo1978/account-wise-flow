import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Palette, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceBranding } from '@/hooks/use-workspace-branding';

interface BrandingSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrandingSettingsModal({ open, onOpenChange }: BrandingSettingsModalProps) {
  const { branding, uploadLogo, updateBranding, loading } = useWorkspaceBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [companyName, setCompanyName] = useState(branding?.company_name || '');
  const [primaryColor, setPrimaryColor] = useState(branding?.primary_color || '#2563eb');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(branding?.logo_path || null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (open && branding) {
      setCompanyName(branding.company_name || '');
      setPrimaryColor(branding.primary_color || '#2563eb');
      setPreviewLogo(branding.logo_path || null);
    }
  }, [open, branding]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadLogo(file);
      if (url) {
        setPreviewLogo(url);
        toast.success('Logo uploaded');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateBranding({
        company_name: companyName || null,
        primary_color: primaryColor,
        logo_path: previewLogo,
      });

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Workspace Branding
          </DialogTitle>
          <DialogDescription>
            Configure branding for exported CVs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label>Company Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                {previewLogo ? (
                  <img 
                    src={previewLogo} 
                    alt="Logo preview" 
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG or JPG, max 2MB
                </p>
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">
              <Building2 className="h-4 w-4 inline mr-1" />
              Company Name
            </Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your Company Name"
            />
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primaryColor">
              <Palette className="h-4 w-4 inline mr-1" />
              Primary Color
            </Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-20 rounded border cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 font-mono"
                placeholder="#2563eb"
              />
              <div 
                className="h-10 flex-1 rounded border flex items-center justify-center text-sm font-medium"
                style={{ 
                  backgroundColor: primaryColor,
                  color: '#fff',
                }}
              >
                Preview
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Branding'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

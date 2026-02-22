import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Upload, Save, Image as ImageIcon } from 'lucide-react';
import { useWorkspaceBranding } from '@/hooks/use-workspace-branding';
import { toast } from 'sonner';

export default function AdminBranding() {
  const { branding, loading, updateBranding, uploadLogo, getLogoUrl } = useWorkspaceBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [appName, setAppName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [emailSignature, setEmailSignature] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (branding) {
      setLogoUrl(branding.logo_path ?? '');
      setPrimaryColor(branding.primary_color ?? '#2563eb');
      setSecondaryColor(branding.secondary_color ?? '#64748b');
      setCompanyName(branding.company_name ?? '');
      setAppName((branding as any).app_name ?? '');
      setEmailSignature((branding as any).email_signature_footer ?? '');
    }
  }, [branding]);

  const handleSave = async () => {
    setSaving(true);
    await updateBranding({
      logo_path: logoUrl || null,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      company_name: companyName || null,
      app_name: appName || null,
      email_signature_footer: emailSignature || null,
    } as any);
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File must be under 2MB');
      return;
    }
    setUploading(true);
    const url = await uploadLogo(file);
    if (url) {
      setLogoUrl(url);
      toast.success('Logo uploaded');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentLogoUrl = getLogoUrl() || logoUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Branding</h1>
          <p className="text-muted-foreground text-sm">Customize your workspace appearance and branding assets.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </Button>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>Upload a logo or provide a URL. Used in exports and admin UI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-lg border border-border flex items-center justify-center overflow-hidden bg-muted shrink-0">
              {currentLogoUrl ? (
                <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Upload Logo
                </Button>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG. Max 2MB.</p>
              </div>
              <div>
                <Label htmlFor="logo-url" className="text-xs">Or enter a URL</Label>
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Colors</CardTitle>
          <CardDescription>Define primary and secondary brand colors.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="primary-color-picker"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  id="primary-color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#2563eb"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="secondary-color-picker"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  id="secondary-color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#64748b"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          {/* Preview */}
          <div className="mt-4 flex gap-3">
            <div className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
              Primary
            </div>
            <div className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>
              Secondary
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* App Name & Company Name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Naming</CardTitle>
          <CardDescription>Override the display name shown in the admin UI and exports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app-name">App Name Override</Label>
              <Input
                id="app-name"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="e.g. TalentHub"
              />
              <p className="text-xs text-muted-foreground">Display label used in UI headers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
              <p className="text-xs text-muted-foreground">Used in CV exports and branding.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Signature Footer</CardTitle>
          <CardDescription>Text appended to outbound emails and notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={emailSignature}
            onChange={(e) => setEmailSignature(e.target.value)}
            placeholder="e.g. Sent via Acme Talent — acmetalent.com | +44 20 1234 5678"
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}

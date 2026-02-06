import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useWorkspaceSettings } from '@/hooks/use-workspace-settings';
import { toast } from 'sonner';
import { X, Plus, Loader2 } from 'lucide-react';

const SECTORS = ['banking', 'fintech', 'consulting', 'technology', 'asset_management'];

export function CompanyTierSettingsPanel() {
  const { settings, isLoading, isUpdating, updateSettings } = useWorkspaceSettings();
  const [tiers, setTiers] = useState<Record<string, string[]>>({});
  const [newCompany, setNewCompany] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings?.top_tier_companies) {
      setTiers(settings.top_tier_companies);
    }
  }, [settings?.top_tier_companies]);

  const addCompany = (sector: string) => {
    const company = newCompany[sector]?.trim();
    if (!company) {
      toast.error('Company name cannot be empty');
      return;
    }

    setTiers(prev => ({
      ...prev,
      [sector]: [...(prev[sector] || []), company],
    }));
    setNewCompany(prev => ({ ...prev, [sector]: '' }));
  };

  const removeCompany = (sector: string, company: string) => {
    setTiers(prev => ({
      ...prev,
      [sector]: prev[sector].filter(c => c !== company),
    }));
  };

  const handleSave = () => {
    updateSettings({ top_tier_companies: tiers });
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading settings...</div>;
  }

  return (
    <Card className="border-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top Tier Company List</CardTitle>
        <CardDescription>
          Define premium companies per sector. Used for scoring candidate background.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {SECTORS.map(sector => (
          <div key={sector} className="space-y-3">
            <Label className="text-sm font-medium capitalize">{sector.replace(/_/g, ' ')}</Label>
            
            {/* Display existing companies */}
            <div className="flex flex-wrap gap-2 min-h-8">
              {tiers[sector]?.map(company => (
                <div
                  key={company}
                  className="flex items-center gap-2 bg-secondary text-secondary-foreground px-3 py-1 rounded text-sm"
                >
                  <span>{company}</span>
                  <button
                    onClick={() => removeCompany(sector, company)}
                    className="text-muted-foreground hover:text-foreground transition"
                    aria-label="Remove company"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new company */}
            <div className="flex gap-2">
              <Input
                placeholder={`Add ${sector} company...`}
                value={newCompany[sector] || ''}
                onChange={(e) => setNewCompany(prev => ({ ...prev, [sector]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCompany(sector);
                  }
                }}
                className="max-w-xs"
              />
              <Button
                size="sm"
                onClick={() => addCompany(sector)}
                variant="outline"
                className="px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-4 border-t border-secondary">
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="bg-primary text-primary-foreground"
          >
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

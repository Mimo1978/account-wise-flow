import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useWorkspaceSettings } from '@/hooks/use-workspace-settings';
import { Loader2 } from 'lucide-react';

export function SignalSettingsPanel() {
  const { settings, isLoading, isUpdating, updateSettings } = useWorkspaceSettings();
  const [formData, setFormData] = useState(() => ({
    short_tenure_threshold_months: settings?.short_tenure_threshold_months ?? 9,
    gap_threshold_months: settings?.gap_threshold_months ?? 6,
    contract_hop_min_stints: settings?.contract_hop_min_stints ?? 3,
    contract_hop_lookback_months: settings?.contract_hop_lookback_months ?? 24,
  }));

  const handleChange = (field: string, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateSettings(formData);
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading settings...</div>;
  }

  return (
    <Card className="border-secondary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Signal Detection Thresholds</CardTitle>
        <CardDescription>
          Configure how talent signals are detected. Changes apply to all new matches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-5">
          {/* Short Tenure Threshold */}
          <div className="space-y-2">
            <Label htmlFor="tenure-threshold" className="text-sm font-medium">
              Short Tenure Threshold (months)
            </Label>
            <p className="text-xs text-muted-foreground">
              Flags Project/Programme/Delivery Manager roles with tenure below this threshold.
            </p>
            <Input
              id="tenure-threshold"
              type="number"
              min={1}
              value={formData.short_tenure_threshold_months}
              onChange={(e) => handleChange('short_tenure_threshold_months', parseInt(e.target.value))}
              className="max-w-xs"
            />
          </div>

          {/* Gap Threshold */}
          <div className="space-y-2">
            <Label htmlFor="gap-threshold" className="text-sm font-medium">
              Employment Gap Threshold (months)
            </Label>
            <p className="text-xs text-muted-foreground">
              Flags unexplained gaps between roles exceeding this duration.
            </p>
            <Input
              id="gap-threshold"
              type="number"
              min={1}
              value={formData.gap_threshold_months}
              onChange={(e) => handleChange('gap_threshold_months', parseInt(e.target.value))}
              className="max-w-xs"
            />
          </div>

          {/* Contract Hopping */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="contract-hop-stints" className="text-sm font-medium">
                Contract Hopping Min Stints
              </Label>
              <p className="text-xs text-muted-foreground">
                Minimum roles under 6 months to trigger flag.
              </p>
              <Input
                id="contract-hop-stints"
                type="number"
                min={1}
                value={formData.contract_hop_min_stints}
                onChange={(e) => handleChange('contract_hop_min_stints', parseInt(e.target.value))}
                className="max-w-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-hop-window" className="text-sm font-medium">
                Contract Hopping Lookback Window (months)
              </Label>
              <p className="text-xs text-muted-foreground">
                Time period to analyze for hopping patterns.
              </p>
              <Input
                id="contract-hop-window"
                type="number"
                min={1}
                value={formData.contract_hop_lookback_months}
                onChange={(e) => handleChange('contract_hop_lookback_months', parseInt(e.target.value))}
                className="max-w-xs"
              />
            </div>
          </div>
        </div>

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

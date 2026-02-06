import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { SignalSettingsPanel } from './SignalSettingsPanel';
import { CompanyTierSettingsPanel } from './CompanyTierSettingsPanel';

export function AdminSettingsPanel() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Admin Settings</h2>
        <p className="text-muted-foreground">
          Configure signal detection and company tiers for your workspace.
        </p>
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="pt-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Settings apply to new matches</p>
            <p className="text-muted-foreground">
              Changes to thresholds only affect newly generated matches and signals. Previously generated data is not recalculated.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Signal Settings */}
      <SignalSettingsPanel />

      {/* Company Tier Settings */}
      <CompanyTierSettingsPanel />
    </div>
  );
}

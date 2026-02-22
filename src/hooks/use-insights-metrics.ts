import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InsightsMetrics {
  accountsMonitored: number;
  atRiskSignals: number;
  expansionOpportunities: number;
  avgCoverage: number; // 0-100
}

const SENIOR_TITLES = ['ceo', 'cfo', 'cto', 'coo', 'vp', 'director', 'head', 'president', 'chief', 'managing partner', 'partner'];
const EXPECTED_MIN_CONTACTS = 5;

function isSenior(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return SENIOR_TITLES.some(s => lower.includes(s));
}

export function useInsightsMetrics(companyId: string | null) {
  return useQuery({
    queryKey: ['insights-metrics', companyId],
    queryFn: async (): Promise<InsightsMetrics> => {
      // Fetch companies with contacts (just id + title is enough)
      let query = supabase
        .from('companies')
        .select('id, contacts:contacts(id, title, updated_at)');

      if (companyId) {
        query = query.eq('id', companyId);
      }

      const { data: companies, error } = await query;
      if (error) throw error;
      if (!companies || companies.length === 0) {
        return { accountsMonitored: 0, atRiskSignals: 0, expansionOpportunities: 0, avgCoverage: 0 };
      }

      let atRisk = 0;
      let expansion = 0;
      let totalContactsMapped = 0;
      const now = Date.now();
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

      for (const company of companies) {
        const contacts = Array.isArray(company.contacts) ? company.contacts : [];
        totalContactsMapped += contacts.length;

        const seniorContacts = contacts.filter(c => isSenior(c.title));

        // At-risk: last contact update > 60 days OR only 1 contact OR no senior contact
        const lastUpdate = contacts.length > 0
          ? Math.max(...contacts.map(c => new Date(c.updated_at).getTime()))
          : 0;
        const stale = contacts.length > 0 && (now - lastUpdate) > sixtyDaysMs;

        if (stale || contacts.length <= 1 || seniorContacts.length === 0) {
          atRisk++;
        }

        // Expansion: coverage < 40% AND at least 3 contacts
        const coveragePct = Math.min(100, Math.round((contacts.length / EXPECTED_MIN_CONTACTS) * 100));
        if (coveragePct < 40 && contacts.length >= 3) {
          expansion++;
        }
      }

      // Avg coverage = total contacts / (companies * expected_min) capped at 100
      const rawAvg = companies.length > 0
        ? Math.round((totalContactsMapped / (companies.length * EXPECTED_MIN_CONTACTS)) * 100)
        : 0;
      const avgCoverage = Math.min(100, rawAvg);

      return {
        accountsMonitored: companies.length,
        atRiskSignals: atRisk,
        expansionOpportunities: expansion,
        avgCoverage,
      };
    },
  });
}

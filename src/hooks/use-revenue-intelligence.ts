import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

const SENIOR_TITLES = ['ceo', 'cfo', 'cto', 'coo', 'vp', 'director', 'head', 'president', 'chief', 'managing partner', 'partner'];

function isSenior(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return SENIOR_TITLES.some(s => lower.includes(s));
}

export interface CompanyRiskProfile {
  id: string;
  name: string;
  industry: string | null;
  totalContacts: number;
  seniorContacts: number;
  departments: string[];
  lastActivityDate: Date | null;
  daysSinceActivity: number | null;
  isDormant: boolean;
  isSingleThreaded: boolean;
  isAtRisk: boolean;
  rsiScore: number; // 0-100
  rsiTier: 'high' | 'medium' | 'low';
  coveragePercent: number;
}

export interface PipelineSignals {
  respondedTargets: number;
  bookedTargets: number;
  interestedOutcomes: number;
  meetingBookedOutcomes: number;
  highResponseCampaigns: { id: string; name: string; responseRate: number }[];
}

export interface RevenueIntelligenceData {
  companies: CompanyRiskProfile[];
  atRiskCount: number;
  singleThreadedCount: number;
  dormantCount: number;
  avgRsi: number;
  rsiDistribution: { high: number; medium: number; low: number };
  pipeline: PipelineSignals;
}

// ── RSI Calculation ──

function computeRSI(
  contactCount: number,
  seniorCount: number,
  departmentCount: number,
  daysSinceActivity: number | null
): number {
  // Contact breadth: max 25 at 5+ contacts
  const contactScore = Math.min(contactCount / 5, 1) * 25;
  // Senior depth: max 25 at 3+ senior
  const seniorScore = Math.min(seniorCount / 3, 1) * 25;
  // Department diversity: max 25 at 4+ departments
  const deptScore = Math.min(departmentCount / 4, 1) * 25;
  // Recency: max 25 based on days since last activity
  let recencyScore = 0;
  if (daysSinceActivity === null) {
    recencyScore = 0;
  } else if (daysSinceActivity <= 7) {
    recencyScore = 25;
  } else if (daysSinceActivity <= 30) {
    recencyScore = 20;
  } else if (daysSinceActivity <= 60) {
    recencyScore = 10;
  } else {
    recencyScore = 0;
  }
  return Math.round(contactScore + seniorScore + deptScore + recencyScore);
}

function rsiTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ── Main Hook ──

export function useRevenueIntelligence() {
  // 1. Companies + contacts data
  const companiesQuery = useQuery({
    queryKey: ['revenue-intel-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, industry, contacts:contacts(id, title, department, updated_at)')
        .order('name');
      if (error) throw error;

      const now = Date.now();
      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

      const profiles: CompanyRiskProfile[] = (data || []).map(company => {
        const contacts = Array.isArray(company.contacts) ? company.contacts : [];
        const seniorContacts = contacts.filter(c => isSenior(c.title));
        const departments = [...new Set(contacts.map(c => c.department).filter(Boolean))] as string[];

        const lastUpdate = contacts.length > 0
          ? Math.max(...contacts.map(c => new Date(c.updated_at).getTime()))
          : null;
        const daysSinceActivity = lastUpdate ? Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24)) : null;
        const isDormant = daysSinceActivity !== null && daysSinceActivity > 60;
        const isSingleThreaded = seniorContacts.length <= 1 && contacts.length > 0;
        const isAtRisk = isDormant || contacts.length <= 1 || seniorContacts.length === 0;

        const score = computeRSI(contacts.length, seniorContacts.length, departments.length, daysSinceActivity);

        const expectedMin = 5;
        const coveragePercent = Math.min(100, Math.round((contacts.length / expectedMin) * 100));

        return {
          id: company.id,
          name: company.name,
          industry: company.industry,
          totalContacts: contacts.length,
          seniorContacts: seniorContacts.length,
          departments,
          lastActivityDate: lastUpdate ? new Date(lastUpdate) : null,
          daysSinceActivity,
          isDormant,
          isSingleThreaded,
          isAtRisk,
          rsiScore: score,
          rsiTier: rsiTier(score),
          coveragePercent,
        };
      });

      return profiles;
    },
  });

  // 2. Pipeline signals from outreach tables
  const pipelineQuery = useQuery({
    queryKey: ['revenue-intel-pipeline'],
    queryFn: async () => {
      // Targets by state
      const [targetsRes, campaignsRes, outcomesRes] = await Promise.all([
        supabase
          .from('outreach_targets')
          .select('id, state')
          .in('state', ['responded', 'booked']),
        supabase
          .from('outreach_campaigns')
          .select('id, name, target_count, response_count, contacted_count'),
        supabase
          .from('call_outcomes')
          .select('id, outcome')
          .in('outcome', ['interested', 'meeting_booked']),
      ]);

      const targets = targetsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const outcomes = outcomesRes.data || [];

      const respondedTargets = targets.filter(t => t.state === 'responded').length;
      const bookedTargets = targets.filter(t => t.state === 'booked').length;
      const interestedOutcomes = outcomes.filter(o => o.outcome === 'interested').length;
      const meetingBookedOutcomes = outcomes.filter(o => o.outcome === 'meeting_booked').length;

      const highResponseCampaigns = campaigns
        .filter(c => c.target_count > 0 && c.contacted_count > 0)
        .map(c => ({
          id: c.id,
          name: c.name,
          responseRate: Math.round((c.response_count / c.contacted_count) * 100),
        }))
        .filter(c => c.responseRate >= 20)
        .sort((a, b) => b.responseRate - a.responseRate);

      return {
        respondedTargets,
        bookedTargets,
        interestedOutcomes,
        meetingBookedOutcomes,
        highResponseCampaigns,
      } satisfies PipelineSignals;
    },
  });

  // Derived aggregates
  const companies = companiesQuery.data || [];
  const atRiskCount = companies.filter(c => c.isAtRisk).length;
  const singleThreadedCount = companies.filter(c => c.isSingleThreaded).length;
  const dormantCount = companies.filter(c => c.isDormant).length;

  const avgRsi = companies.length > 0
    ? Math.round(companies.reduce((s, c) => s + c.rsiScore, 0) / companies.length)
    : 0;

  const rsiDistribution = {
    high: companies.filter(c => c.rsiTier === 'high').length,
    medium: companies.filter(c => c.rsiTier === 'medium').length,
    low: companies.filter(c => c.rsiTier === 'low').length,
  };

  const data: RevenueIntelligenceData = {
    companies,
    atRiskCount,
    singleThreadedCount,
    dormantCount,
    avgRsi,
    rsiDistribution,
    pipeline: pipelineQuery.data || {
      respondedTargets: 0,
      bookedTargets: 0,
      interestedOutcomes: 0,
      meetingBookedOutcomes: 0,
      highResponseCampaigns: [],
    },
  };

  return {
    data,
    isLoading: companiesQuery.isLoading || pipelineQuery.isLoading,
    error: companiesQuery.error || pipelineQuery.error,
  };
}

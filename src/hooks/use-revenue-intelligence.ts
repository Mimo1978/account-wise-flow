import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Risk Engine Types (mirror edge function output) ──

export type RiskBand = 'healthy' | 'medium_risk' | 'high_risk';

export interface CompanyRisk {
  company_id: string;
  company_name: string;
  risk_score: number;
  risk_band: RiskBand;
  reasons: string[];
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
  rsiScore: number;
  rsiTier: 'high' | 'medium' | 'low';
  coveragePercent: number;
  // From risk engine
  riskScore: number;
  riskBand: RiskBand;
  riskReasons: string[];
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
  riskSummary: {
    healthy: number;
    medium_risk: number;
    high_risk: number;
  };
}

// ── Constants ──

const SENIOR_TITLES = ['ceo', 'cfo', 'cto', 'coo', 'vp', 'director', 'head', 'president', 'chief', 'managing partner', 'partner'];
const EXPECTED_MIN_CONTACTS = 5;

function isSenior(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return SENIOR_TITLES.some(s => lower.includes(s));
}

// ── RSI Calculation ──

function computeRSI(contactCount: number, seniorCount: number, departmentCount: number, daysSinceActivity: number | null): number {
  const contactScore = Math.min(contactCount / 5, 1) * 25;
  const seniorScore = Math.min(seniorCount / 3, 1) * 25;
  const deptScore = Math.min(departmentCount / 4, 1) * 25;
  let recencyScore = 0;
  if (daysSinceActivity === null) {
    recencyScore = 0;
  } else if (daysSinceActivity <= 7) {
    recencyScore = 25;
  } else if (daysSinceActivity <= 30) {
    recencyScore = 20;
  } else if (daysSinceActivity <= 60) {
    recencyScore = 10;
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
  // 1. Risk engine (edge function)
  const riskQuery = useQuery({
    queryKey: ['company-risk-summary'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('company-risk-summary', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (error) throw error;
      return (data?.data || []) as CompanyRisk[];
    },
  });

  // 2. Companies + contacts for RSI / org penetration
  const companiesQuery = useQuery({
    queryKey: ['revenue-intel-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, industry, contacts:contacts(id, title, department, updated_at)')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Pipeline signals
  const pipelineQuery = useQuery({
    queryKey: ['revenue-intel-pipeline'],
    queryFn: async () => {
      const [targetsRes, campaignsRes, outcomesRes] = await Promise.all([
        supabase.from('outreach_targets').select('id, state').in('state', ['responded', 'booked']),
        supabase.from('outreach_campaigns').select('id, name, target_count, response_count, contacted_count'),
        supabase.from('call_outcomes').select('id, outcome').in('outcome', ['interested', 'meeting_booked']),
      ]);

      const targets = targetsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const outcomes = outcomesRes.data || [];

      return {
        respondedTargets: targets.filter(t => t.state === 'responded').length,
        bookedTargets: targets.filter(t => t.state === 'booked').length,
        interestedOutcomes: outcomes.filter(o => o.outcome === 'interested').length,
        meetingBookedOutcomes: outcomes.filter(o => o.outcome === 'meeting_booked').length,
        highResponseCampaigns: campaigns
          .filter(c => c.target_count > 0 && c.contacted_count > 0)
          .map(c => ({ id: c.id, name: c.name, responseRate: Math.round((c.response_count / c.contacted_count) * 100) }))
          .filter(c => c.responseRate >= 20)
          .sort((a, b) => b.responseRate - a.responseRate),
      } satisfies PipelineSignals;
    },
  });

  // ── Merge risk engine results with company data ──
  const riskMap = new Map<string, CompanyRisk>();
  (riskQuery.data || []).forEach(r => riskMap.set(r.company_id, r));

  const now = Date.now();
  const rawCompanies = companiesQuery.data || [];

  const companies: CompanyRiskProfile[] = rawCompanies.map(company => {
    const contacts = Array.isArray(company.contacts) ? company.contacts : [];
    const seniorContacts = contacts.filter(c => isSenior(c.title));
    const departments = [...new Set(contacts.map(c => c.department).filter(Boolean))] as string[];

    const lastUpdate = contacts.length > 0
      ? Math.max(...contacts.map(c => new Date(c.updated_at).getTime()))
      : null;
    const daysSinceActivity = lastUpdate ? Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24)) : null;
    const isDormant = daysSinceActivity !== null && daysSinceActivity > 60;
    const isSingleThreaded = seniorContacts.length <= 1 && contacts.length > 0;

    const rsi = computeRSI(contacts.length, seniorContacts.length, departments.length, daysSinceActivity);
    const coveragePercent = Math.min(100, Math.round((contacts.length / EXPECTED_MIN_CONTACTS) * 100));

    const risk = riskMap.get(company.id);

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
      isAtRisk: risk ? risk.risk_band !== 'healthy' : isDormant || contacts.length <= 1 || seniorContacts.length === 0,
      rsiScore: rsi,
      rsiTier: rsiTier(rsi),
      coveragePercent,
      riskScore: risk?.risk_score ?? 0,
      riskBand: risk?.risk_band ?? 'healthy',
      riskReasons: risk?.reasons ?? [],
    };
  });

  const atRiskCount = companies.filter(c => c.riskBand !== 'healthy').length;
  const singleThreadedCount = companies.filter(c => c.isSingleThreaded).length;
  const dormantCount = companies.filter(c => c.isDormant).length;
  const avgRsi = companies.length > 0 ? Math.round(companies.reduce((s, c) => s + c.rsiScore, 0) / companies.length) : 0;

  const rsiDistribution = {
    high: companies.filter(c => c.rsiTier === 'high').length,
    medium: companies.filter(c => c.rsiTier === 'medium').length,
    low: companies.filter(c => c.rsiTier === 'low').length,
  };

  const riskSummary = {
    healthy: companies.filter(c => c.riskBand === 'healthy').length,
    medium_risk: companies.filter(c => c.riskBand === 'medium_risk').length,
    high_risk: companies.filter(c => c.riskBand === 'high_risk').length,
  };

  const data: RevenueIntelligenceData = {
    companies,
    atRiskCount,
    singleThreadedCount,
    dormantCount,
    avgRsi,
    rsiDistribution,
    pipeline: pipelineQuery.data || {
      respondedTargets: 0, bookedTargets: 0,
      interestedOutcomes: 0, meetingBookedOutcomes: 0,
      highResponseCampaigns: [],
    },
    riskSummary,
  };

  return {
    data,
    isLoading: companiesQuery.isLoading || pipelineQuery.isLoading || riskQuery.isLoading,
    error: companiesQuery.error || pipelineQuery.error || riskQuery.error,
  };
}

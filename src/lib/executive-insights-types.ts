// Executive Insights Layer - TypeScript Types
// For future dashboard integration

export type InsightType = 
  | 'relationship_coverage'
  | 'renewal_risk'
  | 'contract_expiry'
  | 'missing_roles'
  | 'activity_summary'
  | 'growth_opportunity'
  | 'engagement_gap';

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export type RiskType = 
  | 'renewal_risk'
  | 'contract_expiry'
  | 'champion_departure'
  | 'engagement_decline'
  | 'blocker_escalation'
  | 'coverage_gap'
  | 'activity_stall';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export type QueryType = 
  | 'exposure_analysis'
  | 'next_action'
  | 'contract_review'
  | 'coverage_check'
  | 'risk_assessment'
  | 'general';

// Executive Insight record from database
export interface ExecutiveInsight {
  id: string;
  workspace_id: string;
  company_id?: string;
  insight_type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  data: Record<string, unknown>;
  related_contact_ids: string[];
  related_entity_ids: string[];
  is_dismissed: boolean;
  dismissed_by?: string;
  dismissed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// Relationship coverage tracking
export interface RelationshipCoverage {
  id: string;
  workspace_id: string;
  company_id: string;
  department?: string;
  coverage_score: number; // 0-100
  executive_coverage: boolean;
  champion_count: number;
  blocker_count: number;
  total_contacts: number;
  engaged_contacts: number;
  last_engagement_date?: string;
  gap_analysis: {
    missing_roles?: string[];
    underrepresented_departments?: string[];
    stale_relationships?: string[];
  };
  calculated_at: string;
  created_at: string;
  updated_at: string;
}

// Risk signals from the system
export interface RiskSignal {
  id: string;
  workspace_id: string;
  company_id: string;
  contact_id?: string;
  risk_type: RiskType;
  risk_level: RiskLevel;
  title: string;
  description: string;
  trigger_data: {
    trigger_reason?: string;
    detected_at?: string;
    threshold_value?: number;
    current_value?: number;
  };
  recommended_actions: string[];
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

// Activity summary for a period
export interface ActivitySummary {
  id: string;
  workspace_id: string;
  company_id?: string;
  period_start: string;
  period_end: string;
  summary_type: 'daily' | 'weekly' | 'monthly';
  metrics: {
    meetings_count?: number;
    calls_count?: number;
    emails_count?: number;
    notes_added?: number;
    contacts_added?: number;
    contacts_updated?: number;
    engagement_changes?: number;
    top_topics?: string[];
    active_users?: string[];
  };
  ai_summary?: string;
  highlights: string[];
  concerns: string[];
  created_at: string;
}

// Executive query log
export interface ExecutiveQuery {
  id: string;
  workspace_id: string;
  user_id: string;
  query_text: string;
  query_type?: QueryType;
  response_summary?: string;
  response_data?: ExecutiveQueryResponse;
  feedback_rating?: number;
  created_at: string;
}

// AI response structure for executive queries
export interface ExecutiveQueryResponse {
  summary: string;
  insights: ExecutiveQueryInsight[];
  recommendations: ExecutiveRecommendation[];
  metrics?: {
    companiesAtRisk?: number;
    coverageGaps?: number;
    upcomingRenewals?: number;
    missingRoles?: number;
  };
  dataContext?: {
    companiesAnalyzed: number;
    contactsAnalyzed: number;
    notesAnalyzed: number;
  };
}

export interface ExecutiveQueryInsight {
  type: 'risk' | 'opportunity' | 'gap' | 'action' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  companyName?: string;
  companyId?: string;
  contactNames?: string[];
  recommendedAction?: string;
}

export interface ExecutiveRecommendation {
  action: string;
  priority: 'immediate' | 'this_week' | 'this_month';
  context?: string;
}

// Hook return types for future UI integration
export interface UseExecutiveInsightsResult {
  insights: ExecutiveInsight[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  dismissInsight: (id: string) => Promise<void>;
}

export interface UseRiskSignalsResult {
  signals: RiskSignal[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  resolveSignal: (id: string, notes?: string) => Promise<void>;
}

export interface UseCoverageResult {
  coverage: RelationshipCoverage[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getCompanyCoverage: (companyId: string) => RelationshipCoverage | undefined;
}

export interface UseExecutiveQueryResult {
  query: (question: string, options?: { companyId?: string; includeAllCompanies?: boolean }) => Promise<ExecutiveQueryResponse>;
  loading: boolean;
  error: Error | null;
  history: ExecutiveQuery[];
  rateQuery: (queryId: string, rating: number) => Promise<void>;
}

// Dashboard widget types for future UI
export interface RiskDashboardData {
  criticalRisks: RiskSignal[];
  highRisks: RiskSignal[];
  upcomingExpirations: RiskSignal[];
  recentlyResolved: RiskSignal[];
}

export interface CoverageDashboardData {
  overallScore: number;
  byCompany: { companyId: string; companyName: string; score: number }[];
  byDepartment: { department: string; avgScore: number; count: number }[];
  gaps: { type: string; count: number; examples: string[] }[];
}

export interface ExecutiveDashboardData {
  risks: RiskDashboardData;
  coverage: CoverageDashboardData;
  recentInsights: ExecutiveInsight[];
  activitySummary: ActivitySummary | null;
}

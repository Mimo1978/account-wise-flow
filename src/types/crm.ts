// CRM Database Types — mirrors crm_* tables in Supabase

export interface CrmCompany {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CrmContact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  preferred_contact: string | null;
  gdpr_consent: boolean;
  gdpr_consent_date: string | null;
  gdpr_consent_method: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CrmProjectStatus = "active" | "completed" | "paused" | "cancelled";

export interface CrmProject {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  status: CrmProjectStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string;
  project_type: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CrmOpportunityStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface CrmOpportunity {
  id: string;
  project_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  title: string;
  value: number;
  currency: string;
  stage: CrmOpportunityStage;
  probability: number;
  expected_close_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CrmDealStatus = "active" | "complete" | "cancelled";

export interface CrmDeal {
  id: string;
  opportunity_id: string | null;
  company_id: string | null;
  title: string;
  value: number;
  currency: string;
  signed_date: string | null;
  start_date: string | null;
  end_date: string | null;
  payment_terms: string | null;
  status: CrmDealStatus;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CrmDocumentType = "sow" | "contract" | "proposal" | "nda" | "invoice" | "other";
export type CrmDocumentStatus = "draft" | "sent" | "signed" | "rejected";

export interface CrmDocument {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  type: CrmDocumentType;
  title: string;
  file_url: string | null;
  version: number;
  status: CrmDocumentStatus;
  sent_at: string | null;
  signed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type CrmInvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface CrmInvoice {
  id: string;
  deal_id: string | null;
  company_id: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  status: CrmInvoiceStatus;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmInvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
}

export type CrmActivityType = "call" | "email" | "sms" | "meeting" | "note" | "task";
export type CrmActivityDirection = "inbound" | "outbound";
export type CrmActivityStatus = "scheduled" | "completed" | "failed";

export interface CrmActivity {
  id: string;
  type: CrmActivityType;
  contact_id: string | null;
  company_id: string | null;
  opportunity_id: string | null;
  subject: string | null;
  body: string | null;
  direction: CrmActivityDirection | null;
  status: CrmActivityStatus;
  scheduled_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface CrmAiAuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  input_summary: string | null;
  output_summary: string | null;
  ip_address: string | null;
  created_at: string;
}

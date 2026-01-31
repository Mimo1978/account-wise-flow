export type PhoneLabel = "Work" | "Mobile" | "Desk" | "Home" | "Private" | "Other";

export interface PhoneNumber {
  value: string;
  label: PhoneLabel;
  preferred: boolean;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  seniority: "executive" | "director" | "manager" | "senior" | "mid" | "junior";
  email: string;
  phone: string; // legacy single phone field
  phoneNumbers?: PhoneNumber[]; // new multi-phone support
  privateEmail?: string; // new private email field
  status: "unknown" | "new" | "warm" | "engaged" | "champion" | "blocker";
  engagementScore?: number;
  lastContact?: string;
  role?: "economic-buyer" | "technical-evaluator" | "champion" | "blocker" | "influencer";
  reportsTo?: string;
  linkedIn?: string;
  contactOwner?: string;
  profilePhoto?: string;
  location?: string;
  nextFollowUp?: string;
  tags?: string[];
  notes?: Note[];
  activities?: Activity[];
}

export type NoteVisibility = "public" | "team" | "private";

export interface Note {
  id: string;
  date: string;
  author: string;
  content: string;
  pinned?: boolean;
  visibility?: NoteVisibility;
  ownerId?: string;
  teamId?: string;
  source?: "ui" | "ai_import" | "api" | "voice";
  isRedacted?: boolean; // For UI display when user can't see content
}

export interface Activity {
  id: string;
  type: "meeting" | "call" | "email" | "update" | "owner-change" | "score-change";
  date: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface AccountManager {
  name: string;
  title: string;
  photo?: string;
}

export interface NewsItem {
  id: string;
  date: string;
  headline: string;
  summary?: string;
}

export interface CompanyLocation {
  id: string;
  country: string;
  city: string;
  type: "headquarters" | "regional" | "branch" | "satellite";
  switchboard?: string;
  address?: string;
  employeeCount?: number;
}

export type RelationshipStatus = "active" | "warm" | "cooling" | "dormant";
export type DataQuality = "complete" | "partial" | "minimal";

export interface Account {
  id: string;
  name: string;
  industry: string;
  size?: string;
  contacts: Contact[];
  lastUpdated: string;
  engagementScore: number;
  accountManager?: AccountManager;
  lastInteraction?: string;
  primaryChampion?: { name: string; title: string };
  knownBlockers?: string[];
  importantNote?: string;
  recentNews?: NewsItem[];
  // New company-level fields for company-first architecture
  headquarters?: string;
  switchboard?: string;
  regions?: string[];
  locations?: CompanyLocation[];
  website?: string;
  relationshipStatus?: RelationshipStatus;
  dataQuality?: DataQuality;
  aiSummary?: string;
  logo?: string;
}

export interface Department {
  name: string;
  contacts: Contact[];
}

export type TalentAvailability = "available" | "interviewing" | "deployed";

export type TalentDataQuality = "parsed" | "needs-review";
export type TalentStatus = "active" | "on-hold" | "archived" | "new";

export interface TalentExperience {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export type TalentCvSource = "upload" | "image" | "linkedin" | "manual";

export interface Talent {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneNumbers?: PhoneNumber[];
  skills: string[];
  roleType: string;
  seniority: "executive" | "director" | "manager" | "senior" | "mid" | "junior";
  availability: TalentAvailability;
  rate?: string;
  notes?: string;
  aiOverview?: string;
  experience?: TalentExperience[];
  cvUrl?: string;
  linkedIn?: string;
  location?: string;
  lastUpdated?: string;
  dataQuality: TalentDataQuality;
  status: TalentStatus;
  cvSource?: TalentCvSource;
}

export type EngagementStatus = "proposed" | "interviewing" | "deployed";

export interface TalentEngagement {
  id: string;
  talentId: string;
  companyId: string;
  status: EngagementStatus;
  roleType: string;
  department?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

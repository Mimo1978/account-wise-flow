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

export interface Note {
  id: string;
  date: string;
  author: string;
  content: string;
  pinned?: boolean;
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
}

export interface Department {
  name: string;
  contacts: Contact[];
}

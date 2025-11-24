export interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  seniority: "executive" | "director" | "manager" | "senior" | "mid" | "junior";
  email: string;
  phone: string;
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

export interface Account {
  id: string;
  name: string;
  industry: string;
  size?: string;
  contacts: Contact[];
  lastUpdated: string;
  engagementScore: number;
}

export interface Department {
  name: string;
  contacts: Contact[];
}

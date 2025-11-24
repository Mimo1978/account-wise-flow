export interface Contact {
  id: string;
  name: string;
  title: string;
  department: string;
  email?: string;
  phone?: string;
  status: "unknown" | "new" | "warm" | "engaged" | "champion" | "blocker";
  engagementScore?: number;
  lastContact?: string;
  role?: "economic-buyer" | "technical-evaluator" | "champion" | "blocker" | "influencer";
  reportsTo?: string;
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

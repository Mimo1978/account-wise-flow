/**
 * Web Research Provider Types
 * 
 * Provider-agnostic abstraction layer for internet-assisted org chart discovery.
 * Designed to support multiple web search providers without UI changes.
 */

// Search configuration options
export interface WebResearchConfig {
  companyName: string;
  companyId?: string;
  
  // Geographic focus
  regions: string[];
  
  // Department focus (optional filtering)
  focusAreas: WebResearchFocusArea[];
  
  // Depth of search
  depth: WebResearchDepth;
  
  // Optional seed person (e.g., known CEO)
  seedPerson?: {
    name: string;
    title: string;
  };
}

export type WebResearchFocusArea = 
  | "executive"
  | "technology"
  | "finance"
  | "operations"
  | "sales"
  | "marketing"
  | "hr"
  | "legal"
  | "all";

export type WebResearchDepth = 
  | "leadership_only"
  | "leadership_plus_1"
  | "leadership_plus_2";

// Source types for discovered data
export type WebResearchSourceType = 
  | "company_website"
  | "press_release"
  | "news_article"
  | "regulatory_filing"
  | "conference_bio"
  | "blog_author"
  | "public_profile"
  | "ai_analysis"
  | "unknown";

// Individual source evidence
export interface WebResearchSource {
  url: string;
  title: string;
  sourceType: WebResearchSourceType;
  publishedDate?: string; // ISO date string
  excerpt?: string; // Relevant excerpt from source
  accessedAt: string; // ISO date string
}

// Confidence levels
export type WebResearchConfidence = "high" | "medium" | "low";

// A single discovered person
export interface WebResearchPerson {
  id: string; // UUID for tracking
  
  // Core fields
  name: string;
  title: string;
  department?: string;
  
  // Location if discovered
  location?: string;
  
  // Evidence
  sources: WebResearchSource[];
  confidence: WebResearchConfidence;
  
  // Inferred relationships (optional)
  reportsTo?: string; // Name of likely manager
  reportsToConfidence?: WebResearchConfidence;
  
  // Metadata
  discoveredAt: string; // ISO date string
  verified: boolean; // Always starts false
  placeholder: boolean; // Always starts true
}

// Complete research results
export interface WebResearchResult {
  success: boolean;
  companyName: string;
  
  // Discovered people
  people: WebResearchPerson[];
  
  // Summary stats
  stats: {
    totalFound: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    sourcesChecked: number;
  };
  
  // Any warnings or notes
  warnings?: string[];
  
  // Error if failed
  error?: string;
  
  // Timestamp
  completedAt: string;
}

// Provider interface - future implementations will conform to this
export interface WebResearchProvider {
  id: string;
  name: string;
  description: string;
  
  // Whether provider is currently available
  available: boolean;
  
  // Reason if not available
  unavailableReason?: string;
  
  // Execute research
  search: (config: WebResearchConfig) => Promise<WebResearchResult>;
}

// Provider registry for future extensibility
export interface WebResearchProviderRegistry {
  providers: WebResearchProvider[];
  activeProvider: string | null;
}

// Human-readable labels for source types
export const SOURCE_TYPE_LABELS: Record<WebResearchSourceType, string> = {
  company_website: "Company Website",
  press_release: "Press Release",
  news_article: "News Article",
  regulatory_filing: "Regulatory Filing",
  conference_bio: "Conference Bio",
  blog_author: "Blog Author",
  public_profile: "Public Profile",
  ai_analysis: "AI Analysis",
  unknown: "Unknown",
};

// Human-readable labels for focus areas
export const FOCUS_AREA_LABELS: Record<WebResearchFocusArea, string> = {
  executive: "Executive / C-Suite",
  technology: "Technology",
  finance: "Finance",
  operations: "Operations",
  sales: "Sales",
  marketing: "Marketing",
  hr: "Human Resources",
  legal: "Legal",
  all: "All Departments",
};

// Human-readable labels for depth options
export const DEPTH_LABELS: Record<WebResearchDepth, { label: string; description: string }> = {
  leadership_only: {
    label: "Leadership Only",
    description: "CEO, C-Suite, and Board members",
  },
  leadership_plus_1: {
    label: "Leadership + 1 Level",
    description: "Includes VPs and Department Heads",
  },
  leadership_plus_2: {
    label: "Leadership + 2 Levels",
    description: "Includes Directors and Senior Managers",
  },
};

// Confidence thresholds and styling
export const CONFIDENCE_CONFIG: Record<WebResearchConfidence, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  high: {
    label: "High Confidence",
    description: "Multiple sources confirm this information",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
  },
  medium: {
    label: "Medium Confidence",
    description: "Single reliable source, or partial corroboration",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  low: {
    label: "Low Confidence",
    description: "Limited or dated source, requires verification",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
  },
};

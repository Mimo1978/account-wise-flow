/**
 * Phone number utilities for normalization and classification
 */

export type PhoneType = "work" | "mobile" | "desk" | "home" | "private" | "other";

export interface LabeledPhone {
  number: string;
  type: PhoneType;
  confidence: "high" | "medium" | "low";
}

/**
 * Normalize a phone number by stripping spaces and formatting consistently
 * Handles UK (+44), US (+1), and international formats
 */
export function normalizePhone(phone: string): string {
  if (!phone?.trim()) return "";
  
  // Remove all whitespace and common separators
  let normalized = phone.replace(/[\s\-\.\(\)]/g, "");
  
  // Handle UK formats
  // Convert 07xxx to +447xxx
  if (/^07\d{9}$/.test(normalized)) {
    normalized = "+44" + normalized.slice(1);
  }
  // Convert 0044xxx to +44xxx
  if (/^0044\d+$/.test(normalized)) {
    normalized = "+" + normalized.slice(2);
  }
  
  // Handle US formats
  // Convert 1xxxxxxxxxx to +1xxxxxxxxxx
  if (/^1\d{10}$/.test(normalized)) {
    normalized = "+" + normalized;
  }
  
  // Ensure + prefix for international numbers if missing
  if (/^44\d{10}$/.test(normalized)) {
    normalized = "+" + normalized;
  }
  
  return normalized;
}

/**
 * Format a phone number for display (after normalization)
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone?.trim()) return "";
  
  const normalized = normalizePhone(phone);
  
  // UK format: +44 7xxx xxx xxx
  if (/^\+44\d{10}$/.test(normalized)) {
    return normalized.replace(/^\+44(\d{4})(\d{3})(\d{3})$/, "+44 $1 $2 $3");
  }
  
  // US format: +1 (xxx) xxx-xxxx
  if (/^\+1\d{10}$/.test(normalized)) {
    return normalized.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 ($1) $2-$3");
  }
  
  return normalized;
}

/**
 * Infer phone type from context clues
 */
export function inferPhoneType(phone: string, context?: string): PhoneType {
  const lowerContext = (context || "").toLowerCase();
  
  // Check context for explicit labels
  if (lowerContext.includes("mobile") || lowerContext.includes("cell")) return "mobile";
  if (lowerContext.includes("work") || lowerContext.includes("office")) return "work";
  if (lowerContext.includes("desk") || lowerContext.includes("direct")) return "desk";
  if (lowerContext.includes("home") || lowerContext.includes("residence")) return "home";
  if (lowerContext.includes("private") || lowerContext.includes("personal")) return "private";
  
  const normalized = normalizePhone(phone);
  
  // UK mobile numbers start with +447 (mobile range)
  if (/^\+447\d{9}$/.test(normalized)) return "mobile";
  
  // UK landline numbers start with +441 or +442 (geographic)
  if (/^\+44[12]\d{9}$/.test(normalized)) return "desk";
  
  // US mobile patterns (not reliable, but common)
  // Area codes like 646, 917, etc. are often mobile in NYC
  
  return "other";
}

/**
 * Parse multiple phone numbers from a string
 * Returns array of labeled phones
 */
export function parseMultiplePhones(input: string): LabeledPhone[] {
  if (!input?.trim()) return [];
  
  const phones: LabeledPhone[] = [];
  
  // Split by common delimiters
  const parts = input.split(/[,;|\/]/).map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Extract label if present (e.g., "Mobile: +44 7xxx" or "Work - 020 xxx")
    const labelMatch = part.match(/^(mobile|work|desk|home|office|cell|private|direct|personal)[\s:\-]+(.+)$/i);
    
    let phoneStr: string;
    let explicitType: PhoneType | null = null;
    
    if (labelMatch) {
      explicitType = inferPhoneType("", labelMatch[1]);
      phoneStr = labelMatch[2];
    } else {
      phoneStr = part;
    }
    
    const normalized = normalizePhone(phoneStr);
    if (!normalized) continue;
    
    // Validate it looks like a phone number
    if (!/^\+?\d{7,15}$/.test(normalized)) continue;
    
    const inferredType = explicitType || inferPhoneType(normalized, part);
    
    // Determine confidence based on quality of extraction
    let confidence: "high" | "medium" | "low" = "medium";
    if (explicitType) {
      confidence = "high"; // Explicit label means high confidence
    } else if (/^\+\d{10,15}$/.test(normalized)) {
      confidence = "high"; // Well-formatted international number
    } else if (normalized.length < 8) {
      confidence = "low"; // Suspiciously short
    }
    
    phones.push({
      number: normalized,
      type: inferredType,
      confidence,
    });
  }
  
  return phones;
}

/**
 * Serialize labeled phones to a compact string for storage
 */
export function serializePhones(phones: LabeledPhone[]): string {
  return phones.map(p => `${p.type}:${p.number}`).join("|");
}

/**
 * Deserialize phones from storage format
 */
export function deserializePhones(stored: string): LabeledPhone[] {
  if (!stored?.trim()) return [];
  
  return stored.split("|").map(part => {
    const [type, number] = part.split(":");
    return {
      number: number || part, // Fallback for old format
      type: (type as PhoneType) || "other",
      confidence: "high" as const,
    };
  }).filter(p => p.number);
}

/**
 * Get the primary/preferred phone from a list
 */
export function getPrimaryPhone(phones: LabeledPhone[]): string | null {
  if (!phones.length) return null;
  
  // Priority: mobile > work > desk > other types
  const priority: PhoneType[] = ["mobile", "work", "desk", "home", "private", "other"];
  
  for (const type of priority) {
    const phone = phones.find(p => p.type === type);
    if (phone) return phone.number;
  }
  
  return phones[0]?.number || null;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email?.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email?.trim().toLowerCase() || "";
}

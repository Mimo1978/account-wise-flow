/**
 * Boolean Search Query Parser
 * 
 * Converts human-readable Boolean search syntax into PostgreSQL tsquery format.
 * 
 * Supported syntax:
 * - AND: java AND kafka → java & kafka
 * - OR: aws OR gcp → aws | gcp
 * - NOT: NOT contractor → !contractor
 * - Quoted phrases: "project manager" → 'project' <-> 'manager'
 * - Parentheses: (aws OR gcp) AND cloud → (aws | gcp) & cloud
 * 
 * Examples:
 * - java AND (kafka OR "event driven") AND NOT contractor
 * - "project manager" AND (mifid OR emir) AND (london OR remote)
 * - (aws OR gcp) AND "data migration" AND NOT (intern OR junior)
 */

export interface ParsedQuery {
  tsquery: string;
  terms: string[];
  isValid: boolean;
  error?: string;
}

interface Token {
  type: "TERM" | "PHRASE" | "AND" | "OR" | "NOT" | "LPAREN" | "RPAREN";
  value: string;
}

/**
 * Tokenize the input query string
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const str = input.trim();

  while (i < str.length) {
    // Skip whitespace
    if (/\s/.test(str[i])) {
      i++;
      continue;
    }

    // Quoted phrase
    if (str[i] === '"') {
      let phrase = "";
      i++; // skip opening quote
      while (i < str.length && str[i] !== '"') {
        phrase += str[i];
        i++;
      }
      i++; // skip closing quote
      if (phrase.trim()) {
        tokens.push({ type: "PHRASE", value: phrase.trim() });
      }
      continue;
    }

    // Parentheses
    if (str[i] === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (str[i] === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    // Word (term or operator)
    let word = "";
    while (i < str.length && !/[\s"()]/.test(str[i])) {
      word += str[i];
      i++;
    }

    if (word) {
      const upper = word.toUpperCase();
      if (upper === "AND") {
        tokens.push({ type: "AND", value: "AND" });
      } else if (upper === "OR") {
        tokens.push({ type: "OR", value: "OR" });
      } else if (upper === "NOT") {
        tokens.push({ type: "NOT", value: "NOT" });
      } else {
        tokens.push({ type: "TERM", value: word.toLowerCase() });
      }
    }
  }

  return tokens;
}

/**
 * Convert a phrase to PostgreSQL phrase search syntax
 * "project manager" → 'project' <-> 'manager'
 */
function phraseToTsquery(phrase: string): string {
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => sanitizeTerm(w));

  if (words.length === 0) return "";
  if (words.length === 1) return `'${words[0]}'`;

  // Use <-> for phrase matching (adjacent words)
  return words.map((w) => `'${w}'`).join(" <-> ");
}

/**
 * Sanitize a term for tsquery (remove special characters)
 */
function sanitizeTerm(term: string): string {
  // Remove characters that could break tsquery
  return term.replace(/[^a-z0-9_]/gi, "").toLowerCase();
}

/**
 * Parse tokens into a tsquery string using recursive descent
 */
function parseExpression(tokens: Token[], pos: { i: number }): string {
  let left = parseOrExpression(tokens, pos);
  return left;
}

function parseOrExpression(tokens: Token[], pos: { i: number }): string {
  let left = parseAndExpression(tokens, pos);

  while (pos.i < tokens.length && tokens[pos.i].type === "OR") {
    pos.i++; // consume OR
    const right = parseAndExpression(tokens, pos);
    if (left && right) {
      left = `(${left} | ${right})`;
    } else if (right) {
      left = right;
    }
  }

  return left;
}

function parseAndExpression(tokens: Token[], pos: { i: number }): string {
  let left = parseNotExpression(tokens, pos);

  while (pos.i < tokens.length) {
    const token = tokens[pos.i];
    
    // Explicit AND
    if (token.type === "AND") {
      pos.i++; // consume AND
      const right = parseNotExpression(tokens, pos);
      if (left && right) {
        left = `(${left} & ${right})`;
      } else if (right) {
        left = right;
      }
      continue;
    }
    
    // Implicit AND (term following term without operator)
    if (token.type === "TERM" || token.type === "PHRASE" || token.type === "NOT" || token.type === "LPAREN") {
      const right = parseNotExpression(tokens, pos);
      if (left && right) {
        left = `(${left} & ${right})`;
      } else if (right) {
        left = right;
      }
      continue;
    }

    break;
  }

  return left;
}

function parseNotExpression(tokens: Token[], pos: { i: number }): string {
  if (pos.i < tokens.length && tokens[pos.i].type === "NOT") {
    pos.i++; // consume NOT
    const operand = parsePrimary(tokens, pos);
    if (operand) {
      return `!${operand}`;
    }
    return "";
  }
  return parsePrimary(tokens, pos);
}

function parsePrimary(tokens: Token[], pos: { i: number }): string {
  if (pos.i >= tokens.length) return "";

  const token = tokens[pos.i];

  if (token.type === "LPAREN") {
    pos.i++; // consume (
    const expr = parseExpression(tokens, pos);
    if (pos.i < tokens.length && tokens[pos.i].type === "RPAREN") {
      pos.i++; // consume )
    }
    return expr ? `(${expr})` : "";
  }

  if (token.type === "TERM") {
    pos.i++;
    const term = sanitizeTerm(token.value);
    // Use prefix matching for better UX
    return term ? `'${term}':*` : "";
  }

  if (token.type === "PHRASE") {
    pos.i++;
    return phraseToTsquery(token.value);
  }

  return "";
}

/**
 * Extract all searchable terms from the query for highlighting
 */
function extractTerms(tokens: Token[]): string[] {
  const terms: string[] = [];
  
  for (const token of tokens) {
    if (token.type === "TERM") {
      const sanitized = sanitizeTerm(token.value);
      if (sanitized) terms.push(sanitized);
    } else if (token.type === "PHRASE") {
      const words = token.value.toLowerCase().split(/\s+/).filter(w => w.length > 0);
      terms.push(...words.map(sanitizeTerm).filter(Boolean));
    }
  }
  
  return [...new Set(terms)]; // dedupe
}

/**
 * Main parser function
 * 
 * @param query - Human-readable Boolean search query
 * @returns ParsedQuery with PostgreSQL tsquery string and extracted terms
 */
export function parseBooleanQuery(query: string): ParsedQuery {
  const trimmed = query.trim();
  
  if (!trimmed) {
    return { tsquery: "", terms: [], isValid: true };
  }

  try {
    const tokens = tokenize(trimmed);
    
    if (tokens.length === 0) {
      return { tsquery: "", terms: [], isValid: true };
    }

    const pos = { i: 0 };
    const tsquery = parseExpression(tokens, pos);
    const terms = extractTerms(tokens);

    if (!tsquery) {
      return { tsquery: "", terms, isValid: false, error: "Invalid query syntax" };
    }

    return { tsquery, terms, isValid: true };
  } catch (e) {
    return {
      tsquery: "",
      terms: [],
      isValid: false,
      error: e instanceof Error ? e.message : "Parse error",
    };
  }
}

/**
 * Convert a simple text query to tsquery (for basic searches)
 */
export function simpleQueryToTsquery(query: string): string {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => sanitizeTerm(w))
    .filter(Boolean);

  if (words.length === 0) return "";

  // Use & (AND) between words, with prefix matching
  return words.map((w) => `'${w}':*`).join(" & ");
}

/**
 * Highlight matching terms in text
 */
export function highlightMatches(text: string, terms: string[]): string {
  if (!text || terms.length === 0) return text;

  let result = text;
  
  // Sort terms by length (longest first) to avoid partial replacements
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length);
  
  for (const term of sortedTerms) {
    if (!term) continue;
    // Case-insensitive word boundary match
    const regex = new RegExp(`\\b(${term}\\w*)`, "gi");
    result = result.replace(regex, "<mark>$1</mark>");
  }
  
  return result;
}

/**
 * Get query suggestions/examples
 */
export const BOOLEAN_SEARCH_EXAMPLES = [
  { query: 'java AND kafka', description: 'Both terms required' },
  { query: 'aws OR gcp', description: 'Either term matches' },
  { query: '"project manager"', description: 'Exact phrase' },
  { query: 'python AND NOT junior', description: 'Exclude term' },
  { query: '(aws OR gcp) AND kubernetes', description: 'Grouped conditions' },
  { query: 'react AND (frontend OR "full stack")', description: 'Complex query' },
];

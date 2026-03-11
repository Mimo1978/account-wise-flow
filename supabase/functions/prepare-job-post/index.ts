import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrepareRequest {
  advert_content: string;
  board: string;
  job_title: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  job_type?: string;
  sectors?: string[];
  skills?: string[];
  agency_name?: string;
}

/* ── SANITISE ── */
function sanitise(content: string): string {
  let text = content;

  // Replace "Our client [Company Name]" patterns
  text = text.replace(/our\s+client\s*,?\s*([A-Z][A-Za-z\s&.]+?)(?=[,.\s])/gi, 'Our client, a leading business');
  text = text.replace(/(?:working\s+(?:with|for)\s+)([A-Z][A-Za-z\s&.]{3,30}?)(?=[,.\s])/gi, 'working with a leading organisation');

  // Remove internal rate/budget lines
  text = text.replace(/^(?:Rate|Budget|Internal|Fee|Margin|Day\s*Rate)\s*:.*$/gim, '');

  // Remove internal reference numbers
  text = text.replace(/(?:REF|Ref|ref)\s*:\s*[A-Z0-9-]+/g, '');

  // Remove email addresses (company emails only — keep generic)
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email on request]');

  // Remove phone numbers
  text = text.replace(/(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g, '');

  // Clean up multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/* ── BOARD FORMATTERS ── */
function formatForReed(content: string, req: PrepareRequest): { formatted: string; warnings: string[] } {
  const warnings: string[] = [];
  if (!req.location) warnings.push('Location is required for Reed');
  if (!req.salary_min && !req.salary_max) warnings.push('Salary range is required for Reed — jobs without salary get 3x less views');

  // Structure into sections
  const sections = content.split(/\n{2,}/);
  const intro = sections[0] || '';
  const body = sections.slice(1).join('\n\n');

  let formatted = `${intro}\n\n`;
  if (!content.toLowerCase().includes('key responsibilities')) {
    formatted += `Key Responsibilities\n${body}\n\n`;
  } else {
    formatted += body + '\n\n';
  }

  // Truncate to ~500 words
  const words = formatted.split(/\s+/);
  if (words.length > 500) {
    const truncated = words.slice(0, 497);
    const lastSentenceEnd = truncated.join(' ').lastIndexOf('.');
    formatted = truncated.join(' ').substring(0, lastSentenceEnd + 1);
    warnings.push(`Truncated from ${words.length} to ~500 words`);
  }

  return { formatted, warnings };
}

function formatForLinkedin(content: string, req: PrepareRequest): { formatted: string; warnings: string[] } {
  const warnings: string[] = [];
  let formatted = content;

  // Add emoji bullets
  formatted = formatted.replace(/^[-•]\s*/gm, '✅ ');
  formatted = formatted.replace(/^(\d+\.)\s*/gm, '🎯 ');

  // Add CTA
  formatted += '\n\nApply now or message us directly.';

  // Add hashtags from sectors/skills
  const tags: string[] = [];
  if (req.sectors?.length) tags.push(`#${req.sectors[0].replace(/\s+/g, '')}`);
  if (req.skills?.length) tags.push(`#${req.skills[0].replace(/\s+/g, '')}`);
  if (req.job_type) tags.push(`#${req.job_type.replace(/\s+/g, '')}`);
  if (tags.length) formatted += '\n\n' + tags.slice(0, 3).join(' ');

  // Truncate to 2000 chars
  if (formatted.length > 2000) {
    formatted = formatted.substring(0, 1997) + '...';
    warnings.push('Truncated to 2000 characters for LinkedIn');
  }

  return { formatted, warnings };
}

function formatForJobserve(content: string, _req: PrepareRequest): { formatted: string; warnings: string[] } {
  const warnings: string[] = [];
  let formatted = content;

  // Replace bullets with numbered lists
  let counter = 1;
  formatted = formatted.replace(/^[-•✅🎯]\s*/gm, () => `${counter++}. `);

  // Truncate to 500 words
  const words = formatted.split(/\s+/);
  if (words.length > 500) {
    formatted = words.slice(0, 497).join(' ') + '...';
    warnings.push('Truncated to 500 words for Jobserve');
  }

  return { formatted, warnings };
}

function formatForIndeed(content: string, req: PrepareRequest): { formatted: string; warnings: string[] } {
  const warnings: string[] = [];

  if (!req.salary_min && !req.salary_max) {
    warnings.push('Indeed ranks jobs with salary 3x higher. Add a salary range for better visibility.');
  }

  // Add H2 section headers
  let formatted = content;
  formatted = formatted.replace(/^(Key Responsibilities|Requirements|What We Offer|About|Benefits|The Role)/gim, '## $1');

  // Ensure keyword-dense first paragraph
  const words = formatted.split(/\s+/);
  if (words.length > 700) {
    formatted = words.slice(0, 697).join(' ') + '...';
    warnings.push('Truncated to 700 words for Indeed');
  }

  return { formatted, warnings };
}

function formatForOwnSite(content: string, req: PrepareRequest): { formatted: string; warnings: string[] } {
  let formatted = content;
  if (req.agency_name) {
    formatted += `\n\n---\nPosted by ${req.agency_name}`;
  }
  return { formatted, warnings: [] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PrepareRequest = await req.json();
    const { advert_content, board } = body;

    if (!advert_content || !board) {
      throw new Error("advert_content and board are required");
    }

    // Step 1: Sanitise
    const sanitised = sanitise(advert_content);

    // Step 2: Format for board
    let result: { formatted: string; warnings: string[] };
    switch (board.toLowerCase()) {
      case 'reed': result = formatForReed(sanitised, body); break;
      case 'linkedin': result = formatForLinkedin(sanitised, body); break;
      case 'jobserve': result = formatForJobserve(sanitised, body); break;
      case 'indeed': result = formatForIndeed(sanitised, body); break;
      case 'own_site': case 'internal': result = formatForOwnSite(sanitised, body); break;
      default: result = { formatted: sanitised, warnings: [`Unknown board: ${board}`] };
    }

    // Word/char count
    const wordCount = result.formatted.split(/\s+/).filter(Boolean).length;
    const charCount = result.formatted.length;

    // Board limits
    const limits: Record<string, { words?: number; chars?: number }> = {
      reed: { words: 500 },
      linkedin: { chars: 2000 },
      jobserve: { words: 500 },
      indeed: { words: 700 },
    };
    const limit = limits[board.toLowerCase()];
    const withinLimit = !limit ||
      (limit.words ? wordCount <= limit.words : true) &&
      (limit.chars ? charCount <= limit.chars : true);

    // Required fields check
    const requiredChecks: { field: string; present: boolean; blocking: boolean }[] = [
      { field: 'Title', present: !!body.job_title, blocking: true },
      { field: 'Location', present: !!body.location, blocking: board.toLowerCase() === 'reed' },
      { field: 'Salary', present: !!(body.salary_min || body.salary_max), blocking: board.toLowerCase() === 'reed' },
    ];

    return new Response(JSON.stringify({
      sanitised_content: sanitised,
      formatted_content: result.formatted,
      warnings: result.warnings,
      word_count: wordCount,
      char_count: charCount,
      within_limit: withinLimit,
      limit_label: limit?.words ? `${wordCount} / ${limit.words} words` : limit?.chars ? `${charCount} / ${limit.chars} chars` : `${wordCount} words`,
      required_checks: requiredChecks,
      board,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

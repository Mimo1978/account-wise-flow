import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebResearchConfig {
  companyName: string;
  companyId?: string;
  regions: string[];
  focusAreas: string[];
  depth: string;
  seedPerson?: {
    name: string;
    title: string;
  };
}

interface WebResearchSource {
  url: string;
  title: string;
  sourceType: string;
  publishedDate?: string;
  excerpt?: string;
  accessedAt: string;
}

interface WebResearchPerson {
  id: string;
  name: string;
  title: string;
  department?: string;
  location?: string;
  sources: WebResearchSource[];
  confidence: "high" | "medium" | "low";
  reportsTo?: string;
  reportsToConfidence?: "high" | "medium" | "low";
  discoveredAt: string;
  verified: boolean;
  placeholder: boolean;
}

interface WebResearchResult {
  success: boolean;
  companyName: string;
  people: WebResearchPerson[];
  stats: {
    totalFound: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    sourcesChecked: number;
  };
  warnings?: string[];
  error?: string;
  completedAt: string;
}

/**
 * Generate mock research results for UI testing.
 * 
 * In future, this will be replaced with actual web research
 * using connected providers (Perplexity, Firecrawl, etc.)
 */
function generateMockResults(config: WebResearchConfig): WebResearchResult {
  const now = new Date().toISOString();
  const companyName = config.companyName;
  
  // Generate realistic mock data based on company name
  const mockPeople: WebResearchPerson[] = [];
  
  // Always include executive team for any depth
  const executives = [
    {
      name: "Sarah Chen",
      title: "Chief Executive Officer",
      department: "Executive",
      confidence: "high" as const,
      sources: [
        {
          url: `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com/about/leadership`,
          title: `${companyName} Leadership Team`,
          sourceType: "company_website",
          publishedDate: "2024-01-15",
          excerpt: `Sarah Chen serves as Chief Executive Officer at ${companyName}...`,
          accessedAt: now,
        },
        {
          url: "https://www.businesswire.com/example-press-release",
          title: `${companyName} Announces Strategic Expansion`,
          sourceType: "press_release",
          publishedDate: "2024-03-10",
          excerpt: "CEO Sarah Chen commented on the company's growth strategy...",
          accessedAt: now,
        },
      ],
    },
    {
      name: "Michael Torres",
      title: "Chief Financial Officer",
      department: "Finance",
      confidence: "high" as const,
      reportsTo: "Sarah Chen",
      reportsToConfidence: "high" as const,
      sources: [
        {
          url: `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com/about/leadership`,
          title: `${companyName} Leadership Team`,
          sourceType: "company_website",
          publishedDate: "2024-01-15",
          excerpt: `Michael Torres is the Chief Financial Officer...`,
          accessedAt: now,
        },
      ],
    },
    {
      name: "Dr. Emily Watson",
      title: "Chief Technology Officer",
      department: "Technology",
      confidence: "high" as const,
      reportsTo: "Sarah Chen",
      reportsToConfidence: "high" as const,
      sources: [
        {
          url: `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com/about/leadership`,
          title: `${companyName} Leadership Team`,
          sourceType: "company_website",
          publishedDate: "2024-01-15",
          excerpt: `Dr. Emily Watson leads our technology organization...`,
          accessedAt: now,
        },
        {
          url: "https://techconference.example.com/speakers/emily-watson",
          title: "Tech Summit 2024 Speaker Bio",
          sourceType: "conference_bio",
          publishedDate: "2024-06-01",
          excerpt: `Dr. Emily Watson, CTO at ${companyName}, will present on...`,
          accessedAt: now,
        },
      ],
    },
  ];

  // Add executives
  executives.forEach((exec, idx) => {
    mockPeople.push({
      id: crypto.randomUUID(),
      name: exec.name,
      title: exec.title,
      department: exec.department,
      location: config.regions?.[0] || "United Kingdom",
      sources: exec.sources,
      confidence: exec.confidence,
      reportsTo: exec.reportsTo,
      reportsToConfidence: exec.reportsToConfidence,
      discoveredAt: now,
      verified: false,
      placeholder: true,
    });
  });

  // Add VP level if depth includes +1
  if (config.depth === "leadership_plus_1" || config.depth === "leadership_plus_2") {
    const vpLevel = [
      {
        name: "James Harrison",
        title: "VP of Engineering",
        department: "Technology",
        confidence: "medium" as const,
        reportsTo: "Dr. Emily Watson",
        sources: [
          {
            url: "https://www.linkedin.com/in/jamesharrison-example",
            title: "LinkedIn Profile (Public)",
            sourceType: "public_profile",
            excerpt: "VP of Engineering at " + companyName,
            accessedAt: now,
          },
        ],
      },
      {
        name: "Lisa Park",
        title: "VP of Sales",
        department: "Sales",
        confidence: "medium" as const,
        reportsTo: "Sarah Chen",
        sources: [
          {
            url: "https://news.example.com/industry-awards-2024",
            title: "Industry Awards Ceremony 2024",
            sourceType: "news_article",
            publishedDate: "2024-02-20",
            excerpt: `Lisa Park, VP of Sales at ${companyName}, was recognized...`,
            accessedAt: now,
          },
        ],
      },
      {
        name: "Robert Kim",
        title: "Head of Finance",
        department: "Finance",
        confidence: "low" as const,
        reportsTo: "Michael Torres",
        sources: [
          {
            url: "https://blog.example.com/finance-trends-2024",
            title: "Finance Trends Blog",
            sourceType: "blog_author",
            publishedDate: "2023-11-15",
            excerpt: "Robert Kim, Head of Finance at " + companyName + "...",
            accessedAt: now,
          },
        ],
      },
    ];

    vpLevel.forEach((vp) => {
      // Filter by focus areas if specified
      if (config.focusAreas?.length > 0 && !config.focusAreas.includes("all")) {
        const deptLower = vp.department?.toLowerCase() || "";
        if (!config.focusAreas.some((area) => deptLower.includes(area.toLowerCase()))) {
          return; // Skip this person
        }
      }

      mockPeople.push({
        id: crypto.randomUUID(),
        name: vp.name,
        title: vp.title,
        department: vp.department,
        location: config.regions?.[0] || "United Kingdom",
        sources: vp.sources,
        confidence: vp.confidence,
        reportsTo: vp.reportsTo,
        reportsToConfidence: "medium",
        discoveredAt: now,
        verified: false,
        placeholder: true,
      });
    });
  }

  // Add Director level if depth includes +2
  if (config.depth === "leadership_plus_2") {
    const directorLevel = [
      {
        name: "Anna Schmidt",
        title: "Director of Product",
        department: "Technology",
        confidence: "low" as const,
        reportsTo: "Dr. Emily Watson",
        sources: [
          {
            url: "https://productconf.example.com/speakers",
            title: "ProductConf 2024",
            sourceType: "conference_bio",
            publishedDate: "2024-04-10",
            excerpt: "Anna Schmidt is Director of Product at " + companyName,
            accessedAt: now,
          },
        ],
      },
      {
        name: "David Okonkwo",
        title: "Director of Marketing",
        department: "Marketing",
        confidence: "low" as const,
        reportsTo: "Sarah Chen",
        sources: [
          {
            url: "https://marketingweek.example.com/article-12345",
            title: "Marketing Week Feature",
            sourceType: "news_article",
            publishedDate: "2023-09-22",
            excerpt: `${companyName}'s marketing efforts, led by David Okonkwo...`,
            accessedAt: now,
          },
        ],
      },
    ];

    directorLevel.forEach((dir) => {
      if (config.focusAreas?.length > 0 && !config.focusAreas.includes("all")) {
        const deptLower = dir.department?.toLowerCase() || "";
        if (!config.focusAreas.some((area) => deptLower.includes(area.toLowerCase()))) {
          return;
        }
      }

      mockPeople.push({
        id: crypto.randomUUID(),
        name: dir.name,
        title: dir.title,
        department: dir.department,
        location: config.regions?.[0] || "United Kingdom",
        sources: dir.sources,
        confidence: dir.confidence,
        reportsTo: dir.reportsTo,
        reportsToConfidence: "low",
        discoveredAt: now,
        verified: false,
        placeholder: true,
      });
    });
  }

  // Calculate stats
  const stats = {
    totalFound: mockPeople.length,
    highConfidence: mockPeople.filter((p) => p.confidence === "high").length,
    mediumConfidence: mockPeople.filter((p) => p.confidence === "medium").length,
    lowConfidence: mockPeople.filter((p) => p.confidence === "low").length,
    sourcesChecked: 12, // Mock value
  };

  return {
    success: true,
    companyName,
    people: mockPeople,
    stats,
    warnings: [
      "Results are based on publicly available information only.",
      "All contacts require manual verification before saving.",
    ],
    completedAt: now,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request
    const config = (await req.json()) as WebResearchConfig;

    if (!config.companyName) {
      return new Response(
        JSON.stringify({ error: "companyName is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[orgchart-web-research] Starting research for: ${config.companyName}`);
    console.log(`[orgchart-web-research] Config:`, JSON.stringify(config));

    // TODO: Check for connected providers and use them
    // For now, return mock data for UI testing
    
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const result = generateMockResults(config);

    console.log(`[orgchart-web-research] Found ${result.stats.totalFound} people`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[orgchart-web-research] Error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        people: [],
        stats: {
          totalFound: 0,
          highConfidence: 0,
          mediumConfidence: 0,
          lowConfidence: 0,
          sourcesChecked: 0,
        },
        companyName: "",
        completedAt: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

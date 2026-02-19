/**
 * Alumni Discovery Data Source
 *
 * Uses Serper.dev (Google Search API) to discover University of Melbourne alumni
 * who are founders, CEOs, or co-founders — focused on Computer Science and
 * Engineering graduates from 2015-2025.
 *
 * Search strategy:
 *   1. LinkedIn profile searches for alumni with founder/CEO titles
 *   2. News searches for UniMelb alumni startup announcements
 *   3. Google searches for alumni at accelerators (YC, Antler, Startmate, etc.)
 *
 * Each discovered person is parsed from Google/LinkedIn snippets and returned
 * as a candidate for import into the dashboard.
 *
 * Requires: SERPER_API_KEY
 */

const name = 'Alumni Discovery';
const description = 'Discover UniMelb CS/Engineering alumni founders via Google search (Serper.dev)';
const requiredEnv = ['SERPER_API_KEY'];

function isConfigured() {
  return !!process.env.SERPER_API_KEY;
}

// ── Search queries targeting UniMelb CS/Engineering alumni founders ──────────

const DEGREE_KEYWORDS = [
  'computer science',
  'software engineering',
  'information technology',
  'information systems',
  'electrical engineering',
  'mechatronics',
  'data science',
  'artificial intelligence',
  'computing',
  'IT',
];

const TITLE_KEYWORDS = [
  'founder',
  'co-founder',
  'cofounder',
  'CEO',
  'CTO',
  'chief executive',
  'chief technology',
];

/**
 * Build a set of search queries to find alumni founders
 */
function buildSearchQueries() {
  const queries = [];

  // Strategy 1: LinkedIn profile searches — high signal
  for (const degree of ['computer science', 'software engineering', 'information technology', 'data science']) {
    queries.push({
      q: `site:linkedin.com/in "University of Melbourne" "${degree}" founder OR co-founder OR CEO`,
      type: 'linkedin',
    });
  }

  // Strategy 2: LinkedIn with engineering faculty broadly
  queries.push({
    q: `site:linkedin.com/in "University of Melbourne" engineering founder OR co-founder OR CTO startup`,
    type: 'linkedin',
  });

  // Strategy 3: News about UniMelb alumni startups
  queries.push({
    q: `"University of Melbourne" alumni founder startup raised funding 2024 OR 2025 OR 2026`,
    type: 'news',
  });
  queries.push({
    q: `"University of Melbourne" graduate computer science startup CEO`,
    type: 'news',
  });

  // Strategy 4: Accelerator mentions
  queries.push({
    q: `"University of Melbourne" "Y Combinator" OR "Startmate" OR "Antler" OR "Techstars" founder`,
    type: 'news',
  });

  // Strategy 5: Melbourne-specific tech ecosystem
  queries.push({
    q: `site:linkedin.com/in "University of Melbourne" "computer science" OR "software engineering" startup Melbourne OR "San Francisco" OR Singapore`,
    type: 'linkedin',
  });

  return queries;
}

/**
 * Run a Google search via Serper.dev
 */
async function searchSerper(query, num = 10) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Serper API error: ${res.status} - ${text}`);
  }
  return res.json();
}

/**
 * Parse a LinkedIn search result snippet to extract person info
 */
function parseLinkedInResult(result) {
  const { title, snippet, link } = result;
  if (!link || !link.includes('linkedin.com/in/')) return null;

  // Extract name from title: "FirstName LastName - Title - Company | LinkedIn"
  const nameMatch = title.match(/^([^-–|]+)/);
  const rawName = nameMatch ? nameMatch[1].replace(/\s*\|\s*LinkedIn.*$/i, '').trim() : null;
  if (!rawName || rawName.length < 3) return null;

  // Split into first/last
  const nameParts = rawName.split(/\s+/);
  if (nameParts.length < 2) return null;
  const first_name = nameParts[0];
  const last_name = nameParts.slice(1).join(' ');

  // Extract title and company from the rest of the title
  const titleParts = title.split(/\s*[-–]\s*/);
  let current_title = null;
  let current_company = null;
  if (titleParts.length >= 3) {
    current_title = titleParts[1]?.trim() || null;
    current_company = titleParts[2]?.replace(/\s*\|?\s*LinkedIn.*$/i, '').trim() || null;
  } else if (titleParts.length === 2) {
    current_title = titleParts[1]?.replace(/\s*\|?\s*LinkedIn.*$/i, '').trim() || null;
  }

  // Extract location from snippet
  let location_city = null;
  let location_country = null;
  const locationPatterns = [
    /(?:^|\.\s*)([\w\s]+),\s*([\w\s]+)\s*(?:·|[-–]|\.|$)/,
    /(?:Location|Based in|Located in)[:\s]*([\w\s]+),\s*([\w\s]+)/i,
  ];
  for (const pattern of locationPatterns) {
    const match = (snippet || '').match(pattern);
    if (match) {
      location_city = match[1].trim();
      location_country = match[2].trim();
      break;
    }
  }

  // Verify University of Melbourne affiliation appears in the result
  const fullText = `${title} ${snippet}`.toLowerCase();
  const unimelb = fullText.includes('university of melbourne') || fullText.includes('unimelb')
    || fullText.includes('melb uni') || fullText.includes('melbourne university');
  if (!unimelb) return null;

  // Detect if founder/CEO from title or snippet
  const isFounder = TITLE_KEYWORDS.some(k => fullText.includes(k.toLowerCase()));
  const hasDegreeMatch = DEGREE_KEYWORDS.some(k => fullText.includes(k.toLowerCase()));

  // Detect degree info from snippet
  let degree = null;
  let faculty = null;
  for (const d of DEGREE_KEYWORDS) {
    if (fullText.includes(d.toLowerCase())) {
      degree = d.charAt(0).toUpperCase() + d.slice(1);
      faculty = d.includes('engineering') || d.includes('mechatronics') || d.includes('electrical')
        ? 'Engineering' : 'Computing & Information Systems';
      break;
    }
  }

  // Try to extract graduation year from snippet
  let graduation_year = null;
  const yearMatches = (snippet || '').match(/(?:20[12]\d)/g);
  if (yearMatches) {
    const years = yearMatches.map(Number).filter(y => y >= 2015 && y <= 2025);
    if (years.length > 0) graduation_year = Math.min(...years);
  }

  // Determine category
  let category = 'watching';
  if (isFounder) category = 'founder';
  else if (/\b(?:vp|vice president|c-suite|cto|cfo|coo|chief)\b/i.test(fullText)) category = 'leader';

  return {
    first_name,
    last_name,
    current_title,
    current_company,
    linkedin_url: link.split('?')[0], // Clean tracking params
    location_city,
    location_country,
    graduation_year,
    degree,
    faculty,
    category,
    snippet: snippet || '',
    is_founder: isFounder,
    has_degree_match: hasDegreeMatch,
    source_query: null, // Set by caller
  };
}

/**
 * Parse a news/general search result for alumni info
 */
function parseNewsResult(result) {
  const { title, snippet, link } = result;
  return {
    title,
    snippet: snippet || '',
    url: link,
    source: result.source || new URL(link).hostname,
    date: result.date || null,
  };
}

/**
 * Run discovery — returns candidate alumni and news mentions
 */
async function discover(options = {}) {
  const {
    maxQueries = null, // Limit number of queries (to save API credits)
    verbose = false,
  } = options;

  const log = verbose ? console.log : () => {};
  const candidates = new Map(); // Keyed by linkedin_url to deduplicate
  const newsMentions = [];
  const queries = buildSearchQueries();
  const queriesToRun = maxQueries ? queries.slice(0, maxQueries) : queries;

  log(`Running ${queriesToRun.length} discovery queries...`);

  for (let i = 0; i < queriesToRun.length; i++) {
    const { q, type } = queriesToRun[i];
    log(`  [${i + 1}/${queriesToRun.length}] ${q.slice(0, 80)}...`);

    try {
      const data = await searchSerper(q, 10);
      const results = data.organic || [];
      log(`    Found ${results.length} results`);

      for (const result of results) {
        if (type === 'linkedin') {
          const person = parseLinkedInResult(result);
          if (person && !candidates.has(person.linkedin_url)) {
            person.source_query = q;
            candidates.set(person.linkedin_url, person);
          }
        } else {
          const news = parseNewsResult(result);
          newsMentions.push({ ...news, source_query: q });
        }
      }
    } catch (err) {
      log(`    Error: ${err.message}`);
    }

    // Rate limit: 1 request per second
    if (i < queriesToRun.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Sort candidates: founders first, then by degree match, then by name
  const sortedCandidates = [...candidates.values()].sort((a, b) => {
    if (a.is_founder !== b.is_founder) return b.is_founder - a.is_founder;
    if (a.has_degree_match !== b.has_degree_match) return b.has_degree_match - a.has_degree_match;
    return (a.last_name || '').localeCompare(b.last_name || '');
  });

  return {
    candidates: sortedCandidates,
    news_mentions: newsMentions,
    queries_run: queriesToRun.length,
    total_candidates: sortedCandidates.length,
    total_news: newsMentions.length,
  };
}

/**
 * Convert discovery candidates into alumni import format
 */
function candidatesToImportData(candidates) {
  return candidates.map(c => ({
    first_name: c.first_name,
    last_name: c.last_name,
    email: null,
    linkedin_url: c.linkedin_url,
    location_city: c.location_city,
    location_country: c.location_country,
    graduation_year: c.graduation_year,
    degree: c.degree,
    faculty: c.faculty,
    current_company: c.current_company,
    current_title: c.current_title,
    category: c.category,
    notes: `Discovered via Google search. Snippet: ${c.snippet.slice(0, 200)}`,
    tags: JSON.stringify(['discovered', 'unimelb', c.category]),
  }));
}

/**
 * Convert news mentions into signals for existing alumni
 */
function newsToSignals(newsMentions, alumni) {
  const signals = [];
  for (const news of newsMentions) {
    const text = `${news.title} ${news.snippet}`.toLowerCase();

    // Try to match against existing alumni
    for (const a of alumni) {
      const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
      if (text.includes(fullName) || (a.current_company && text.includes(a.current_company.toLowerCase()))) {
        const isFunding = /rais|fund|invest|seed|series/i.test(text);
        const isLaunch = /launch|announc|debut|unveil/i.test(text);
        const isAccelerator = /y combinator|startmate|antler|techstars|accelerator/i.test(text);

        let type = 'press_mention';
        let weight = 2.0;
        if (isFunding) { type = 'funding_round'; weight = 5.0; }
        else if (isAccelerator) { type = 'accelerator'; weight = 4.0; }
        else if (isLaunch) { type = 'product_launch'; weight = 3.0; }

        signals.push({
          alumni_id: a.id,
          type,
          title: news.title,
          description: news.snippet,
          source: 'serper_discovery',
          source_url: news.url,
          weight,
        });
        break; // One signal per news item
      }
    }
  }
  return signals;
}

// ── Standard source interface for pipeline integration ───────────────────────

async function scan(alumni) {
  // Discovery doesn't scan individual alumni — it finds new ones
  return [];
}

async function scanAll(alumniList) {
  // When run as part of the pipeline, search for news about existing alumni
  if (!isConfigured()) return [];

  const results = await discover({ maxQueries: 4, verbose: false });
  return newsToSignals(results.news_mentions, alumniList);
}

module.exports = {
  name,
  description,
  requiredEnv,
  isConfigured,
  scan,
  scanAll,
  // Extended API for standalone discovery
  discover,
  candidatesToImportData,
  newsToSignals,
  buildSearchQueries,
};

/**
 * Google News RSS Data Source
 *
 * Monitors Google News via RSS feeds — completely free, no auth needed.
 * This supplements the Serper-based news source to save API credits.
 *
 * How it works:
 * - Google News exposes RSS feeds at news.google.com/rss/search?q=...
 * - We parse the XML RSS feed to extract news articles
 * - No API key, no rate limit, no auth required
 *
 * Signals detected:
 * - Funding rounds
 * - Product launches
 * - Accelerator mentions
 * - Hiring activity
 * - General press mentions
 */

const name = 'Google News RSS';
const description = 'Free news monitoring via Google News RSS feeds — no API key needed';
const requiredEnv = [];

function isConfigured() {
  return true; // Always available — no API key needed
}

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

/**
 * Fetch and parse Google News RSS feed
 */
async function searchGoogleNewsRSS(query, maxResults = 10) {
  const params = new URLSearchParams({
    q: query,
    hl: 'en-AU',
    gl: 'AU',
    ceid: 'AU:en',
  });

  const res = await fetch(`${GOOGLE_NEWS_RSS}?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AlumniDashboard/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!res.ok) {
    throw new Error(`Google News RSS error: ${res.status}`);
  }

  const xml = await res.text();
  return parseRSSItems(xml, maxResults);
}

/**
 * Parse RSS XML into structured items
 * Simple regex-based parsing — no XML library needed
 */
function parseRSSItems(xml, maxResults) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxResults) {
    const itemXml = match[1];

    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const source = extractTag(itemXml, 'source');
    const description = extractTag(itemXml, 'description');

    if (title) {
      items.push({
        title: decodeHTMLEntities(title),
        url: link || null,
        date: pubDate || null,
        source: source ? decodeHTMLEntities(source) : null,
        snippet: description ? decodeHTMLEntities(stripHTML(description)).slice(0, 300) : null,
      });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function stripHTML(html) {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Classify a news article into signal types
 */
function classifyArticle(article) {
  const text = `${article.title} ${article.snippet || ''}`.toLowerCase();

  const fundingKeywords = ['raises', 'raised', 'funding', 'investment', 'series a', 'series b', 'series c', 'seed round', 'pre-seed', 'venture capital', 'million', 'valuation', 'backed by'];
  const launchKeywords = ['launches', 'launched', 'announces', 'announced', 'unveils', 'introduces', 'debuts', 'new product', 'release'];
  const hiringKeywords = ['hiring', 'hires', 'recruits', 'team growth', 'expands team', 'new hire', 'headcount'];
  const acceleratorKeywords = ['y combinator', 'techstars', 'accelerator', 'incubator', 'batch', 'cohort', 'antler', 'startmate', 'blackbird'];
  const acquisitionKeywords = ['acquires', 'acquired', 'acquisition', 'merger', 'merges with', 'buyout'];

  if (fundingKeywords.some(k => text.includes(k))) {
    return {
      type: 'funding_round',
      weight: 5.0,
    };
  }

  if (acquisitionKeywords.some(k => text.includes(k))) {
    return {
      type: 'company_acquired',
      weight: 4.5,
    };
  }

  if (acceleratorKeywords.some(k => text.includes(k))) {
    return {
      type: 'accelerator',
      weight: 4.0,
    };
  }

  if (launchKeywords.some(k => text.includes(k))) {
    return {
      type: 'product_launch',
      weight: 3.0,
    };
  }

  if (hiringKeywords.some(k => text.includes(k))) {
    return {
      type: 'hiring_activity',
      weight: 2.0,
    };
  }

  return {
    type: 'press_mention',
    weight: 2.0,
  };
}

/**
 * Scan a single alumni for news
 */
async function scan(alumni) {
  const signals = [];

  try {
    const queries = [];

    // Search by company name for founders
    if (alumni.current_company && alumni.category === 'founder') {
      queries.push(`"${alumni.current_company}" startup OR funding OR launch`);
    }

    // Search by name for founders and leaders
    if (alumni.category === 'founder' || alumni.category === 'leader') {
      queries.push(`"${alumni.first_name} ${alumni.last_name}" ${alumni.current_company || ''}`);
    }

    for (const query of queries) {
      const articles = await searchGoogleNewsRSS(query, 5);
      for (const article of articles) {
        const classification = classifyArticle(article);
        signals.push({
          type: classification.type,
          title: article.title,
          description: article.snippet || '',
          source: 'google_news_rss',
          source_url: article.url,
          weight: classification.weight,
          detected_at: article.date ? new Date(article.date).toISOString() : null,
        });
      }
    }
  } catch (err) {
    console.error(`Google News RSS scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

/**
 * Scan all alumni
 */
async function scanAll(alumniList) {
  const allSignals = [];
  const relevant = alumniList.filter(a => a.category === 'founder' || a.category === 'leader');

  for (let i = 0; i < relevant.length; i++) {
    const signals = await scan(relevant[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: relevant[i].id });
    }
    // Small delay between requests to be polite
    if (i < relevant.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

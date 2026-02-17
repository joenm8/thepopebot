/**
 * News Monitoring Data Source
 *
 * Monitors news and press mentions for alumni and their companies.
 * Detects funding announcements, product launches, and media coverage.
 *
 * Supported APIs:
 * 1. Google Custom Search API (GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID)
 * 2. NewsAPI.org (NEWS_API_KEY) - 100 free requests/day
 * 3. Serper.dev (SERPER_API_KEY) - Google search API, 2500 free/month
 *
 * The module tries each in order and uses the first configured one.
 */

const name = 'News & Press';
const description = 'Monitor news for funding announcements, product launches, and media coverage';
const requiredEnv = []; // Flexible - uses whichever API is configured

function isConfigured() {
  return !!(
    process.env.SERPER_API_KEY ||
    process.env.NEWS_API_KEY ||
    (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID)
  );
}

/**
 * Search news using Serper.dev (recommended - cheapest for this use case)
 */
async function searchSerper(query, numResults = 10) {
  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: numResults }),
  });

  if (!res.ok) throw new Error(`Serper API error: ${res.status}`);
  const data = await res.json();
  return (data.news || []).map(item => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    date: item.date,
    source: item.source,
  }));
}

/**
 * Search news using NewsAPI.org
 */
async function searchNewsAPI(query, daysBack = 30) {
  const from = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const params = new URLSearchParams({
    q: query,
    from,
    sortBy: 'relevancy',
    pageSize: '10',
    apiKey: process.env.NEWS_API_KEY,
  });

  const res = await fetch(`https://newsapi.org/v2/everything?${params}`);
  if (!res.ok) throw new Error(`NewsAPI error: ${res.status}`);
  const data = await res.json();
  return (data.articles || []).map(item => ({
    title: item.title,
    snippet: item.description,
    url: item.url,
    date: item.publishedAt,
    source: item.source?.name,
  }));
}

/**
 * Search using Google Custom Search API
 */
async function searchGoogle(query, numResults = 10) {
  const params = new URLSearchParams({
    key: process.env.GOOGLE_API_KEY,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
    q: query,
    num: String(Math.min(numResults, 10)),
    sort: 'date',
  });

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) throw new Error(`Google Search API error: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(item => ({
    title: item.title,
    snippet: item.snippet,
    url: item.link,
    date: null,
    source: new URL(item.link).hostname,
  }));
}

/**
 * Search news using the best available API
 */
async function searchNews(query, daysBack = 30) {
  if (process.env.SERPER_API_KEY) return searchSerper(query);
  if (process.env.NEWS_API_KEY) return searchNewsAPI(query, daysBack);
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) return searchGoogle(query);
  throw new Error('No news API configured');
}

/**
 * Classify a news article into signal types
 */
function classifyArticle(article, alumni) {
  const text = `${article.title} ${article.snippet}`.toLowerCase();

  const fundingKeywords = ['raises', 'raised', 'funding', 'investment', 'series a', 'series b', 'seed round', 'pre-seed', 'venture capital', 'million', 'valuation'];
  const launchKeywords = ['launches', 'launched', 'announces', 'announced', 'unveils', 'introduces', 'debuts', 'release'];
  const hiringKeywords = ['hiring', 'hires', 'recruits', 'team growth', 'expands team', 'new hire'];
  const acceleratorKeywords = ['y combinator', 'techstars', 'accelerator', 'incubator', 'batch', 'cohort', 'antler', 'startmate'];

  if (fundingKeywords.some(k => text.includes(k))) {
    return {
      type: 'funding_round',
      title: `Funding news: ${article.title}`,
      description: article.snippet,
      source: 'news',
      source_url: article.url,
      weight: 5.0,
    };
  }

  if (acceleratorKeywords.some(k => text.includes(k))) {
    return {
      type: 'accelerator',
      title: `Accelerator mention: ${article.title}`,
      description: article.snippet,
      source: 'news',
      source_url: article.url,
      weight: 4.0,
    };
  }

  if (launchKeywords.some(k => text.includes(k))) {
    return {
      type: 'product_launch',
      title: `Launch/announcement: ${article.title}`,
      description: article.snippet,
      source: 'news',
      source_url: article.url,
      weight: 3.0,
    };
  }

  if (hiringKeywords.some(k => text.includes(k))) {
    return {
      type: 'hiring_activity',
      title: `Hiring news: ${article.title}`,
      description: article.snippet,
      source: 'news',
      source_url: article.url,
      weight: 2.0,
    };
  }

  // Generic press mention
  return {
    type: 'press_mention',
    title: article.title,
    description: article.snippet,
    source: 'news',
    source_url: article.url,
    weight: 2.0,
  };
}

async function scan(alumni) {
  const signals = [];

  try {
    // Search for alumni by name + company
    const searchQueries = [];
    if (alumni.current_company && alumni.category === 'founder') {
      searchQueries.push(`"${alumni.current_company}" startup OR funding OR launch`);
    }
    if (alumni.category === 'founder' || alumni.category === 'leader') {
      searchQueries.push(`"${alumni.first_name} ${alumni.last_name}" ${alumni.current_company || ''} startup OR founder OR CEO`);
    }

    for (const query of searchQueries) {
      const articles = await searchNews(query);
      for (const article of articles) {
        const signal = classifyArticle(article, alumni);
        signals.push(signal);
      }
    }
  } catch (err) {
    console.error(`News scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

async function scanAll(alumniList) {
  const allSignals = [];
  // Only scan founders and leaders — watching list doesn't need news monitoring
  const relevant = alumniList.filter(a => a.category === 'founder' || a.category === 'leader');

  for (let i = 0; i < relevant.length; i++) {
    const signals = await scan(relevant[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: relevant[i].id });
    }
    // Rate limit between searches
    if (i < relevant.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

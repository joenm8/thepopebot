/**
 * Hacker News Data Source
 *
 * Monitors Hacker News for mentions of alumni, their companies, or their products.
 * Completely free API, no authentication required.
 *
 * API docs: https://github.com/HackerNews/API
 * Algolia HN Search: https://hn.algolia.com/api
 *
 * Signals detected:
 * - Company/product mentions on HN front page
 * - Show HN posts by alumni
 * - Launch posts getting traction
 * - Hiring posts ("Company X is hiring")
 */

const name = 'Hacker News';
const description = 'Monitor Hacker News for alumni company mentions, Show HN posts, and hiring signals';
const requiredEnv = []; // Completely free, no auth needed

function isConfigured() {
  return true; // Always available
}

const HN_ALGOLIA_API = 'https://hn.algolia.com/api/v1';

/**
 * Search HN via the Algolia API
 */
async function searchHN(query, tags = null, numericFilters = null) {
  const params = new URLSearchParams({ query, hitsPerPage: '20' });
  if (tags) params.set('tags', tags);
  if (numericFilters) params.set('numericFilters', numericFilters);

  const res = await fetch(`${HN_ALGOLIA_API}/search?${params}`);
  if (!res.ok) throw new Error(`HN Algolia API error: ${res.status}`);
  const data = await res.json();
  return data.hits || [];
}

/**
 * Search recent HN items (last N days)
 */
async function searchRecent(query, daysBack = 30, tags = null) {
  const since = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000);
  return searchHN(query, tags, `created_at_i>${since}`);
}

/**
 * Classify an HN item into a signal type
 */
function classifyItem(item, alumni) {
  const title = (item.title || '').toLowerCase();
  const text = `${item.title || ''} ${item.story_text || ''}`.toLowerCase();

  // Show HN — strong product launch signal
  if (title.startsWith('show hn:') || title.startsWith('show hn –')) {
    return {
      type: 'product_launch',
      title: `Show HN: ${item.title}`,
      description: `Posted on Hacker News with ${item.points || 0} points and ${item.num_comments || 0} comments`,
      weight: item.points >= 100 ? 4.0 : item.points >= 30 ? 3.0 : 2.0,
    };
  }

  // Hiring post
  if (title.includes('hiring') || title.includes('is hiring') || title.includes('we\'re hiring')) {
    return {
      type: 'hiring_activity',
      title: `HN Hiring: ${item.title}`,
      description: `Hiring post on Hacker News, ${item.points || 0} points`,
      weight: 2.0,
    };
  }

  // Funding mention
  if (/rais|fund|series [abc]|seed round|pre-seed|valuation/i.test(text)) {
    return {
      type: 'funding_round',
      title: `HN Funding mention: ${item.title}`,
      description: `Funding-related discussion on HN, ${item.points || 0} points`,
      weight: 3.0,
    };
  }

  // Launch / announcement
  if (/launch|announc|releas|introducing|we built/i.test(text)) {
    return {
      type: 'product_launch',
      title: `HN mention: ${item.title}`,
      description: `Product/launch mention on HN, ${item.points || 0} points, ${item.num_comments || 0} comments`,
      weight: item.points >= 50 ? 3.0 : 2.0,
    };
  }

  // YC / accelerator mention
  if (/y combinator|yc [wsf]\d|ycombinator|startmate|antler|techstars/i.test(text)) {
    return {
      type: 'accelerator',
      title: `HN accelerator mention: ${item.title}`,
      description: `Accelerator-related discussion on HN`,
      weight: 3.0,
    };
  }

  // General press mention
  return {
    type: 'press_mention',
    title: `Mentioned on HN: ${item.title}`,
    description: `${item.points || 0} points, ${item.num_comments || 0} comments on Hacker News`,
    weight: item.points >= 100 ? 3.0 : item.points >= 30 ? 2.0 : 1.0,
  };
}

/**
 * Scan a single alumni
 */
async function scan(alumni) {
  const signals = [];

  try {
    const searchTerms = [];

    // Search by company name (for founders)
    if (alumni.current_company && alumni.category === 'founder') {
      searchTerms.push(alumni.current_company);
    }

    // Search by full name (for all categories)
    if (alumni.category === 'founder' || alumni.category === 'leader') {
      searchTerms.push(`"${alumni.first_name} ${alumni.last_name}"`);
    }

    for (const term of searchTerms) {
      const hits = await searchRecent(term, 30, 'story');
      for (const hit of hits) {
        // Filter: must have some traction (at least 5 points)
        if ((hit.points || 0) < 5) continue;

        // Verify the hit actually mentions our search term
        const fullText = `${hit.title || ''} ${hit.url || ''} ${hit.story_text || ''}`.toLowerCase();
        if (!fullText.includes(term.toLowerCase().replace(/"/g, ''))) continue;

        const signal = classifyItem(hit, alumni);
        signals.push({
          ...signal,
          source: 'hackernews',
          source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          detected_at: hit.created_at || new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error(`HN scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
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
    // Rate limit between searches (be nice to Algolia)
    if (i < relevant.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

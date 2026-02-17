/**
 * Product Hunt Data Source
 *
 * Monitors Product Hunt for product launches by alumni.
 * Uses the public Product Hunt API v2 (GraphQL).
 *
 * Free tier: 500 requests/day with Developer Token
 * Auth: Bearer token from https://www.producthunt.com/v2/oauth/applications
 *
 * Signals detected:
 * - Alumni launching products on PH
 * - Products in categories relevant to alumni companies
 * - High-vote launches (trending)
 */

const name = 'Product Hunt';
const description = 'Monitor Product Hunt for alumni product launches and trending startups';
const requiredEnv = ['PRODUCTHUNT_TOKEN'];

function isConfigured() {
  return !!process.env.PRODUCTHUNT_TOKEN;
}

const PH_API = 'https://api.producthunt.com/v2/api/graphql';

/**
 * Execute a Product Hunt GraphQL query
 */
async function phQuery(query, variables = {}) {
  const res = await fetch(PH_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PRODUCTHUNT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Product Hunt API error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`PH GraphQL error: ${data.errors[0].message}`);
  }
  return data.data;
}

/**
 * Search Product Hunt for a topic/product
 */
async function searchPosts(query) {
  const graphql = `
    query SearchPosts($query: String!) {
      posts(order: RANKING, first: 10, postedAfter: "${getDateDaysAgo(30)}") {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            commentsCount
            website
            createdAt
            makers {
              name
              headline
            }
            topics {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  // PH API doesn't have a direct text search on posts via GraphQL,
  // so we fetch recent posts and filter client-side
  const data = await phQuery(graphql, { query });
  return (data.posts?.edges || [])
    .map(e => e.node)
    .filter(post => {
      const searchText = `${post.name} ${post.tagline} ${post.description || ''} ${post.makers?.map(m => m.name).join(' ') || ''}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });
}

/**
 * Get trending posts from the last N days
 */
async function getTrending(daysBack = 7) {
  const graphql = `
    query TrendingPosts {
      posts(order: RANKING, first: 20, postedAfter: "${getDateDaysAgo(daysBack)}") {
        edges {
          node {
            id
            name
            tagline
            votesCount
            commentsCount
            url
            website
            createdAt
            makers {
              name
              headline
            }
          }
        }
      }
    }
  `;

  const data = await phQuery(graphql);
  return (data.posts?.edges || []).map(e => e.node);
}

function getDateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Scan a single alumni for PH launches
 */
async function scan(alumni) {
  const signals = [];

  try {
    const searchTerms = [];

    // Search by company name for founders
    if (alumni.current_company && alumni.category === 'founder') {
      searchTerms.push(alumni.current_company);
    }

    // Search by full name
    searchTerms.push(`${alumni.first_name} ${alumni.last_name}`);

    for (const term of searchTerms) {
      const posts = await searchPosts(term);
      for (const post of posts) {
        signals.push({
          type: 'product_launch',
          title: `Product Hunt: ${post.name} - ${post.tagline}`,
          description: `${post.votesCount} upvotes, ${post.commentsCount} comments. Makers: ${(post.makers || []).map(m => m.name).join(', ')}`,
          source: 'producthunt',
          source_url: post.url,
          weight: post.votesCount >= 500 ? 5.0 : post.votesCount >= 100 ? 4.0 : post.votesCount >= 30 ? 3.0 : 2.0,
          detected_at: post.createdAt,
        });
      }
    }
  } catch (err) {
    console.error(`PH scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

/**
 * Scan all alumni
 */
async function scanAll(alumniList) {
  const allSignals = [];
  const founders = alumniList.filter(a => a.category === 'founder');

  for (let i = 0; i < founders.length; i++) {
    const signals = await scan(founders[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: founders[i].id });
    }
    // Rate limit: PH allows 500/day, be conservative
    if (i < founders.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

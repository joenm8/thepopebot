/**
 * Web Monitor Data Source
 *
 * Monitors company websites for changes that signal
 * fundraising activity or growth:
 *
 * - New website launched (domain first seen)
 * - Careers page added or updated (hiring signal)
 * - Team page changes (new hires, advisors)
 * - Product page updates (launches)
 * - Pricing page changes (monetization)
 *
 * Uses simple HTTP HEAD/GET checks. For more sophisticated
 * monitoring, consider Subsignal (github.com/wizenheimer/subsignal).
 */

const name = 'Web Monitor';
const description = 'Monitor company websites for new launches, career pages, and content changes';
const requiredEnv = []; // No API key needed

function isConfigured() {
  return true; // Always available
}

/**
 * Check if a website exists and get basic info
 */
async function checkWebsite(url) {
  if (!url) return null;

  // Ensure URL has protocol
  if (!url.startsWith('http')) url = 'https://' + url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TinAlleyBot/1.0)',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const html = await res.text();

    return {
      status: res.status,
      url: res.url, // Final URL after redirects
      title: extractTitle(html),
      hasCareerPage: /careers|jobs|hiring|join.{0,10}team|open.{0,10}positions/i.test(html),
      hasTeamPage: /team|about.{0,10}us|leadership|founders/i.test(html),
      hasPricingPage: /pricing|plans|subscribe/i.test(html),
      hasBlogPage: /blog|news|updates|press/i.test(html),
      contentLength: html.length,
      keywords: extractMetaKeywords(html),
      description: extractMetaDescription(html),
    };
  } catch (err) {
    if (err.name === 'AbortError') return { status: 'timeout', url };
    return { status: 'error', url, error: err.message };
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
  return match ? match[1].trim() : null;
}

function extractMetaKeywords(html) {
  const match = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i);
  return match ? match[1].trim() : null;
}

/**
 * Check common career page URLs for a company website
 */
async function checkCareerPages(baseUrl) {
  if (!baseUrl) return null;
  if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

  const careerPaths = ['/careers', '/jobs', '/join', '/hiring', '/open-positions', '/team'];
  const found = [];

  for (const path of careerPaths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(baseUrl + path, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (res.ok) {
        found.push({ path, url: res.url });
      }
    } catch {
      // Ignore errors for career page checks
    }
  }

  return found.length > 0 ? found : null;
}

async function scan(alumni) {
  const signals = [];
  if (!alumni.current_company) return signals;

  // We'd need the company website URL from the companies table
  // For now, try to detect signals from known company data
  // In production, this would check the company's stored website URL

  return signals;
}

/**
 * Scan company websites (not individual alumni)
 * Takes a list of companies with their URLs
 */
async function scanCompanies(companies) {
  const signals = [];

  for (const company of companies) {
    if (!company.website) continue;

    try {
      const info = await checkWebsite(company.website);
      if (!info || info.status === 'error') continue;

      // Check for career pages (hiring signal)
      if (info.hasCareerPage) {
        const careerPages = await checkCareerPages(company.website);
        if (careerPages) {
          signals.push({
            type: 'hiring_activity',
            title: `${company.name} has active career pages`,
            description: `Found career content at: ${careerPages.map(p => p.path).join(', ')}`,
            source: 'web_monitor',
            source_url: careerPages[0]?.url,
            weight: 2.0,
            company_id: company.id,
          });
        }
      }

      // Website exists and is active — for pre-seed companies this is notable
      if (company.stage === 'idea' || company.stage === 'pre_seed') {
        signals.push({
          type: 'website_launched',
          title: `${company.name} website is live`,
          description: `${info.title || 'Active website'} — ${info.description || 'No description'}`,
          source: 'web_monitor',
          source_url: info.url,
          weight: 2.0,
          company_id: company.id,
        });
      }
    } catch (err) {
      console.error(`Web monitor failed for ${company.name}:`, err.message);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }

  return signals;
}

async function scanAll(alumniList) {
  // Web monitor primarily works with companies, not individual alumni
  // Return empty — use scanCompanies() directly for company monitoring
  return [];
}

module.exports = {
  name, description, requiredEnv, isConfigured,
  scan, scanAll, scanCompanies, checkWebsite, checkCareerPages,
};

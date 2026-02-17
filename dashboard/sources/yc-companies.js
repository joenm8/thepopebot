/**
 * Y Combinator Companies Data Source
 *
 * Checks if alumni companies appear in the Y Combinator directory.
 * Uses the free, public YC company API — no auth needed.
 *
 * API: https://yc-oss.github.io/api/batches/all.json (all YC companies)
 * Also: Per-batch JSONs and company detail JSONs
 *
 * Signals detected:
 * - Alumni company in YC (major signal — accelerator acceptance)
 * - Alumni working at a YC company
 */

const name = 'Y Combinator Companies';
const description = 'Check if alumni companies are Y Combinator-backed (free, public API)';
const requiredEnv = [];

function isConfigured() {
  return true; // Always available — free public API
}

const YC_API_BASE = 'https://yc-oss.github.io/api';

// Cache YC companies for the session (the list doesn't change frequently)
let ycCompaniesCache = null;
let ycCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all YC companies (cached)
 */
async function getYCCompanies() {
  if (ycCompaniesCache && (Date.now() - ycCacheTime) < CACHE_TTL) {
    return ycCompaniesCache;
  }

  const res = await fetch(`${YC_API_BASE}/batches/all.json`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AlumniDashboard/1.0)',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`YC API error: ${res.status}`);
  }

  const companies = await res.json();
  ycCompaniesCache = companies;
  ycCacheTime = Date.now();

  return companies;
}

/**
 * Normalize company name for matching
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim();
}

/**
 * Search YC companies for a match
 */
function findYCMatch(companyName, ycCompanies) {
  if (!companyName) return null;

  const normalized = normalizeName(companyName);
  if (!normalized || normalized.length < 2) return null;

  // Exact match first
  const exact = ycCompanies.find(yc =>
    normalizeName(yc.name) === normalized
  );
  if (exact) return exact;

  // Partial match — company name contains YC company or vice versa
  const partial = ycCompanies.find(yc => {
    const ycNorm = normalizeName(yc.name);
    return ycNorm.length > 3 && (ycNorm.includes(normalized) || normalized.includes(ycNorm));
  });

  return partial || null;
}

/**
 * Scan a single alumni
 */
async function scan(alumni) {
  const signals = [];

  try {
    const ycCompanies = await getYCCompanies();

    // Check if their current company is a YC company
    if (alumni.current_company) {
      const match = findYCMatch(alumni.current_company, ycCompanies);
      if (match) {
        const isFounder = alumni.category === 'founder';
        signals.push({
          type: isFounder ? 'accelerator' : 'profile_update',
          title: isFounder
            ? `${alumni.current_company} is Y Combinator ${match.batch || 'alumni'}`
            : `Working at YC company: ${match.name} (${match.batch || 'YC'})`,
          description: [
            match.one_liner,
            match.batch ? `YC Batch: ${match.batch}` : null,
            match.team_size ? `Team size: ${match.team_size}` : null,
            match.website ? `Website: ${match.website}` : null,
          ].filter(Boolean).join('. '),
          source: 'yc_companies',
          source_url: match.website || null,
          weight: isFounder ? 5.0 : 2.0,
        });
      }
    }
  } catch (err) {
    console.error(`YC companies scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

/**
 * Scan all alumni — efficient because we fetch YC list once
 */
async function scanAll(alumniList) {
  const allSignals = [];

  try {
    // Fetch YC companies once
    const ycCompanies = await getYCCompanies();
    console.log(`Loaded ${ycCompanies.length} YC companies for matching`);

    // Check each alumni's company against the YC list
    for (const alumni of alumniList) {
      if (!alumni.current_company) continue;

      const match = findYCMatch(alumni.current_company, ycCompanies);
      if (match) {
        const isFounder = alumni.category === 'founder';
        allSignals.push({
          alumni_id: alumni.id,
          type: isFounder ? 'accelerator' : 'profile_update',
          title: isFounder
            ? `${alumni.current_company} is Y Combinator ${match.batch || 'alumni'}`
            : `Working at YC company: ${match.name} (${match.batch || 'YC'})`,
          description: [
            match.one_liner,
            match.batch ? `YC Batch: ${match.batch}` : null,
            match.team_size ? `Team size: ${match.team_size}` : null,
          ].filter(Boolean).join('. '),
          source: 'yc_companies',
          source_url: match.website || null,
          weight: isFounder ? 5.0 : 2.0,
        });
      }
    }
  } catch (err) {
    console.error('YC companies scan failed:', err.message);
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

/**
 * OpenCorporates Data Source
 *
 * Monitors company registrations globally via OpenCorporates API.
 * Free tier: 200 API calls/month, no auth needed for basic search.
 * Also includes free ASIC data search for Australian companies.
 *
 * API: https://api.opencorporates.com/v0.4/companies/search
 * Docs: https://api.opencorporates.com/documentation
 *
 * The unauthenticated API returns basic company data:
 * - Company name, number, jurisdiction
 * - Incorporation date, status (active/inactive)
 * - Registered address
 *
 * Signals detected:
 * - New company incorporations by alumni
 * - Active company registrations matching alumni companies
 * - Australian ASIC registrations (jurisdiction_code: au)
 */

const name = 'OpenCorporates';
const description = 'Search global company registrations (200 free/month, no auth for basic search)';
const requiredEnv = [];

function isConfigured() {
  // Works without API key (200 calls/month unauthenticated)
  return true;
}

const OC_API = 'https://api.opencorporates.com/v0.4';

/**
 * Search OpenCorporates for companies
 */
async function searchCompanies(query, jurisdictionCode = null) {
  const params = new URLSearchParams({
    q: query,
    per_page: '10',
    order: 'score',
  });

  if (jurisdictionCode) {
    params.set('jurisdiction_code', jurisdictionCode);
  }

  // Add API token if available (increases rate limit)
  if (process.env.OPENCORPORATES_API_KEY) {
    params.set('api_token', process.env.OPENCORPORATES_API_KEY);
  }

  const res = await fetch(`${OC_API}/companies/search?${params}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; AlumniDashboard/1.0)',
    },
  });

  if (res.status === 429) {
    console.warn('OpenCorporates rate limit reached');
    return [];
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCorporates API error: ${res.status} - ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const companies = data.results?.companies || [];

  return companies.map(c => ({
    name: c.company?.name,
    company_number: c.company?.company_number,
    jurisdiction: c.company?.jurisdiction_code,
    incorporation_date: c.company?.incorporation_date,
    company_type: c.company?.company_type,
    status: c.company?.current_status,
    registered_address: c.company?.registered_address_in_full,
    opencorporates_url: c.company?.opencorporates_url,
  }));
}

/**
 * Check if a company incorporation is recent (within last 2 years)
 */
function isRecentIncorporation(incDate) {
  if (!incDate) return false;
  const date = new Date(incDate);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return date > twoYearsAgo;
}

/**
 * Scan a single alumni for company registrations
 */
async function scan(alumni) {
  const signals = [];
  const fullName = `${alumni.first_name} ${alumni.last_name}`;

  try {
    // Strategy 1: Search for their company name
    if (alumni.current_company && alumni.category === 'founder') {
      const results = await searchCompanies(alumni.current_company, 'au');
      for (const company of results) {
        if (!company.name) continue;

        // Fuzzy name match
        const companyLower = company.name.toLowerCase();
        const alumniCompanyLower = alumni.current_company.toLowerCase();
        if (!companyLower.includes(alumniCompanyLower) && !alumniCompanyLower.includes(companyLower)) continue;

        if (company.status && company.status.toLowerCase() === 'active') {
          const isRecent = isRecentIncorporation(company.incorporation_date);
          signals.push({
            type: isRecent ? 'incorporation' : 'profile_update',
            title: `${company.name} registered in ${(company.jurisdiction || 'unknown').toUpperCase()}`,
            description: [
              company.company_number ? `Company #${company.company_number}` : null,
              company.incorporation_date ? `Incorporated: ${company.incorporation_date}` : null,
              company.company_type || null,
              company.registered_address || null,
            ].filter(Boolean).join('. '),
            source: 'opencorporates',
            source_url: company.opencorporates_url,
            weight: isRecent ? 4.0 : 2.0,
          });
        }
      }
    }

    // Strategy 2: Search by alumni name (to find new company registrations)
    if (alumni.category === 'founder' || alumni.category === 'leader') {
      // Search globally by name - this finds companies where the name appears as director
      const nameResults = await searchCompanies(fullName);
      for (const company of nameResults) {
        if (!company.name) continue;

        // Skip if it's their known company
        if (alumni.current_company) {
          const companyLower = company.name.toLowerCase();
          const alumniCompanyLower = alumni.current_company.toLowerCase();
          if (companyLower.includes(alumniCompanyLower) || alumniCompanyLower.includes(companyLower)) continue;
        }

        if (isRecentIncorporation(company.incorporation_date) && company.status?.toLowerCase() === 'active') {
          signals.push({
            type: 'incorporation',
            title: `Possible new company: "${company.name}" (${(company.jurisdiction || '??').toUpperCase()})`,
            description: [
              `Incorporated: ${company.incorporation_date}`,
              company.company_type || null,
              'Found via OpenCorporates name search — verify manually',
            ].filter(Boolean).join('. '),
            source: 'opencorporates',
            source_url: company.opencorporates_url,
            weight: 3.0,
          });
        }
      }
    }
  } catch (err) {
    console.error(`OpenCorporates scan failed for ${fullName}:`, err.message);
  }

  return signals;
}

/**
 * Scan all alumni — be conservative with the free tier (200/month)
 */
async function scanAll(alumniList) {
  const allSignals = [];

  // Only scan founders (most likely to have new registrations)
  // Cap at 30 per run to stay within free tier limits
  const founders = alumniList
    .filter(a => a.category === 'founder')
    .slice(0, 30);

  for (let i = 0; i < founders.length; i++) {
    const signals = await scan(founders[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: founders[i].id });
    }
    // Rate limit: be polite with the free API
    if (i < founders.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

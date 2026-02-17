/**
 * Apollo.io People Search Data Source
 *
 * Searches for alumni and potential founders using Apollo.io's People API.
 * Free tier: 600 people searches per day (no credits consumed for basic search).
 *
 * API: POST https://api.apollo.io/v1/mixed_people/search
 * Docs: https://apolloio.github.io/apollo-api-docs/
 *
 * Free tier includes:
 * - Name, title, company, LinkedIn URL
 * - Education history (school, degree, field)
 * - Location (city, state, country)
 * - Employment history
 *
 * Free tier excludes:
 * - Email addresses (require credits)
 * - Phone numbers (require credits)
 *
 * Signals detected:
 * - Title changes (new founder/CEO role)
 * - Company changes (left employer)
 * - New company founded
 * - Education data enrichment
 */

const name = 'Apollo.io People Search';
const description = 'Search for alumni and detect career changes via Apollo.io (600 free/day)';
const requiredEnv = ['APOLLO_API_KEY'];

function isConfigured() {
  return !!process.env.APOLLO_API_KEY;
}

const APOLLO_API = 'https://api.apollo.io/v1';

/**
 * Search people on Apollo.io
 */
async function searchPeople(params) {
  const res = await fetch(`${APOLLO_API}/mixed_people/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({
      api_key: process.env.APOLLO_API_KEY,
      ...params,
    }),
  });

  if (res.status === 429) {
    console.warn('Apollo.io rate limit reached');
    return { people: [] };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API error: ${res.status} - ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Search for UniMelb alumni who are founders
 */
async function discoverFounders(page = 1) {
  return searchPeople({
    page,
    per_page: 25,
    person_titles: ['founder', 'co-founder', 'ceo', 'cto'],
    person_seniorities: ['founder', 'c_suite'],
    q_organization_keyword_tags: ['startup', 'technology'],
    // Filter by University of Melbourne education
    organization_ids: [], // Empty — we use school filter below
    person_past_schools: ['University of Melbourne'],
  });
}

/**
 * Search for a specific person by name and company
 */
async function findPerson(firstName, lastName, company = null) {
  const params = {
    page: 1,
    per_page: 5,
    q_keywords: `${firstName} ${lastName}`,
  };

  if (company) {
    params.q_organization_name = company;
  }

  return searchPeople(params);
}

/**
 * Compare Apollo data with our records to detect changes
 */
function detectChanges(alumni, apolloPerson) {
  const signals = [];

  if (!apolloPerson) return signals;

  const apolloTitle = (apolloPerson.title || '').toLowerCase();
  const apolloCompany = (apolloPerson.organization?.name || '').toLowerCase();
  const currentTitle = (alumni.current_title || '').toLowerCase();
  const currentCompany = (alumni.current_company || '').toLowerCase();

  // Detect company change
  if (currentCompany && apolloCompany &&
      !apolloCompany.includes(currentCompany) &&
      !currentCompany.includes(apolloCompany)) {

    const founderTitles = ['founder', 'co-founder', 'cofounder', 'ceo', 'cto', 'chief'];
    const isNowFounder = founderTitles.some(t => apolloTitle.includes(t));

    if (isNowFounder) {
      signals.push({
        type: 'company_founded',
        title: `Now ${apolloPerson.title} at ${apolloPerson.organization?.name}`,
        description: `Previously at ${alumni.current_company}. Detected via Apollo.io.`,
        source: 'apollo',
        source_url: apolloPerson.linkedin_url || null,
        weight: 5.0,
        _update: {
          current_title: apolloPerson.title,
          current_company: apolloPerson.organization?.name,
          category: 'founder',
        },
      });
    } else {
      signals.push({
        type: 'left_employer',
        title: `Now at ${apolloPerson.organization?.name}`,
        description: `Title: ${apolloPerson.title}. Previously at ${alumni.current_company}.`,
        source: 'apollo',
        source_url: apolloPerson.linkedin_url || null,
        weight: 3.0,
        _update: {
          current_title: apolloPerson.title,
          current_company: apolloPerson.organization?.name,
        },
      });
    }
  }

  // Detect title change at same company
  if (currentCompany && apolloCompany &&
      apolloCompany.includes(currentCompany) &&
      currentTitle && apolloTitle !== currentTitle) {

    const seniorTitles = ['ceo', 'cto', 'cfo', 'coo', 'chief', 'vp', 'vice president', 'head of', 'director', 'partner'];
    const isSenior = seniorTitles.some(k => apolloTitle.includes(k));

    if (isSenior) {
      signals.push({
        type: 'title_change_csuite',
        title: `Promoted to ${apolloPerson.title} at ${apolloPerson.organization?.name}`,
        description: `Previously: ${alumni.current_title}`,
        source: 'apollo',
        weight: 4.0,
        _update: { current_title: apolloPerson.title },
      });
    }
  }

  // Discover LinkedIn URL
  if (apolloPerson.linkedin_url && !alumni.linkedin_url) {
    signals.push({
      type: 'profile_update',
      title: `LinkedIn profile found`,
      description: `LinkedIn URL discovered via Apollo.io`,
      source: 'apollo',
      source_url: apolloPerson.linkedin_url,
      weight: 1.0,
      _update: { linkedin_url: apolloPerson.linkedin_url },
    });
  }

  // Location change
  if (apolloPerson.city && alumni.location_city) {
    const apolloCity = apolloPerson.city.toLowerCase();
    const ourCity = alumni.location_city.toLowerCase();
    if (!apolloCity.includes(ourCity) && !ourCity.includes(apolloCity)) {
      const newLocation = [apolloPerson.city, apolloPerson.state, apolloPerson.country].filter(Boolean).join(', ');
      signals.push({
        type: 'profile_update',
        title: `Relocated to ${newLocation}`,
        description: `Previously in ${alumni.location_city}, ${alumni.location_country || ''}`,
        source: 'apollo',
        weight: 1.5,
        _update: {
          location_city: apolloPerson.city,
          location_country: apolloPerson.country,
        },
      });
    }
  }

  return signals;
}

/**
 * Find the best matching person from Apollo results
 */
function findBestMatch(alumni, people) {
  if (!people || people.length === 0) return null;

  const firstName = alumni.first_name.toLowerCase();
  const lastName = alumni.last_name.toLowerCase();

  // Exact name match
  const exact = people.find(p =>
    (p.first_name || '').toLowerCase() === firstName &&
    (p.last_name || '').toLowerCase() === lastName
  );

  return exact || null;
}

/**
 * Scan a single alumni
 */
async function scan(alumni) {
  try {
    const result = await findPerson(
      alumni.first_name,
      alumni.last_name,
      alumni.current_company
    );

    const match = findBestMatch(alumni, result.people);
    if (!match) return [];

    return detectChanges(alumni, match);
  } catch (err) {
    console.error(`Apollo scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
    return [];
  }
}

/**
 * Scan all alumni — conservative with 600/day limit
 * Prioritizes founders, then leaders
 */
async function scanAll(alumniList) {
  const allSignals = [];

  const prioritized = [
    ...alumniList.filter(a => a.category === 'founder'),
    ...alumniList.filter(a => a.category === 'leader'),
    ...alumniList.filter(a => a.category === 'watching'),
  ].slice(0, 100); // Cap at 100 per run

  for (let i = 0; i < prioritized.length; i++) {
    const signals = await scan(prioritized[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: prioritized[i].id });
    }
    // Rate limit: 600/day = ~25/hour, be conservative
    if (i < prioritized.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll, discoverFounders };

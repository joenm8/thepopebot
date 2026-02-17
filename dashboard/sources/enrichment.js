/**
 * People Data Labs (PDL) Enrichment Source
 *
 * Enriches alumni profiles with career history, education, skills, and social
 * profiles using the People Data Labs Person Enrichment API.
 *
 * Free tier: 100 person lookups/month (basic fields only)
 * Auth: API key from https://www.peopledatalabs.com/signup
 *
 * Signals detected:
 * - Title changes (promotions, new jobs)
 * - Company changes (left employer, joined new company)
 * - Location changes
 * - Education data enrichment
 * - Social profile discovery (GitHub, Twitter)
 *
 * Note: Free tier excludes contact data (emails, phones).
 * We use it for career tracking and profile enrichment.
 */

const name = 'Profile Enrichment (PDL)';
const description = 'Enrich alumni profiles with career history, education, and social profiles via People Data Labs';
const requiredEnv = ['PDL_API_KEY'];

function isConfigured() {
  return !!process.env.PDL_API_KEY;
}

const PDL_API = 'https://api.peopledatalabs.com/v5';

/**
 * Enrich a person profile using PDL
 */
async function enrichPerson(params) {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) queryParams.set(key, value);
  }

  const res = await fetch(`${PDL_API}/person/enrich?${queryParams}`, {
    headers: {
      'X-Api-Key': process.env.PDL_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (res.status === 404) return null; // No match
  if (res.status === 402) throw new Error('PDL credits exhausted');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PDL API error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Build enrichment params from alumni data
 */
function buildParams(alumni) {
  const params = {};

  // LinkedIn URL is the strongest identifier
  if (alumni.linkedin_url) {
    params.profile = alumni.linkedin_url;
  }

  // Fall back to name + company + location
  if (alumni.first_name) params.first_name = alumni.first_name;
  if (alumni.last_name) params.last_name = alumni.last_name;
  if (alumni.current_company) params.company = alumni.current_company;
  if (alumni.location_country) params.country = alumni.location_country;

  // Only include school for better matching
  params.school = 'University of Melbourne';

  // Request minimum confidence
  params.min_likelihood = '5';

  return params;
}

/**
 * Compare PDL data with our records to generate signals
 */
function detectChanges(alumni, pdlData) {
  const signals = [];

  if (!pdlData || !pdlData.data) return signals;
  const person = pdlData.data;

  // Check for title/company changes
  if (person.job_title && person.job_company_name) {
    const currentTitle = (alumni.current_title || '').toLowerCase();
    const currentCompany = (alumni.current_company || '').toLowerCase();
    const pdlTitle = (person.job_title || '').toLowerCase();
    const pdlCompany = (person.job_company_name || '').toLowerCase();

    // Company change
    if (currentCompany && pdlCompany && !pdlCompany.includes(currentCompany) && !currentCompany.includes(pdlCompany)) {
      // Detect if they became a founder
      const founderTitles = ['founder', 'co-founder', 'cofounder', 'ceo', 'cto'];
      const isNowFounder = founderTitles.some(t => pdlTitle.includes(t));

      if (isNowFounder) {
        signals.push({
          type: 'company_founded',
          title: `Now ${person.job_title} at ${person.job_company_name}`,
          description: `Previously at ${alumni.current_company}. PDL shows new founder role.`,
          source: 'pdl_enrichment',
          weight: 5.0,
          _update: {
            current_title: person.job_title,
            current_company: person.job_company_name,
            category: 'founder',
          },
        });
      } else {
        signals.push({
          type: 'left_employer',
          title: `Now at ${person.job_company_name}`,
          description: `Title: ${person.job_title}. Previously at ${alumni.current_company}.`,
          source: 'pdl_enrichment',
          weight: 3.0,
          _update: {
            current_title: person.job_title,
            current_company: person.job_company_name,
          },
        });
      }
    }

    // Title change at same company
    if (currentCompany && pdlCompany && pdlCompany.includes(currentCompany) && currentTitle && pdlTitle !== currentTitle) {
      const cSuiteKeywords = ['ceo', 'cto', 'cfo', 'coo', 'chief', 'vp', 'vice president', 'head of', 'director'];
      const isCSuite = cSuiteKeywords.some(k => pdlTitle.includes(k));

      if (isCSuite) {
        signals.push({
          type: 'title_change_csuite',
          title: `Promoted to ${person.job_title} at ${person.job_company_name}`,
          description: `Previously: ${alumni.current_title}`,
          source: 'pdl_enrichment',
          weight: 4.0,
          _update: { current_title: person.job_title },
        });
      }
    }
  }

  // Discover GitHub URL
  if (person.github_url && !alumni.github_url) {
    signals.push({
      type: 'profile_update',
      title: `GitHub profile found: ${person.github_url}`,
      description: 'GitHub URL discovered via PDL enrichment',
      source: 'pdl_enrichment',
      weight: 1.0,
      _update: { github_url: person.github_url },
    });
  }

  // Location change
  if (person.location_name) {
    const pdlCity = (person.location_locality || '').toLowerCase();
    const ourCity = (alumni.location_city || '').toLowerCase();
    if (ourCity && pdlCity && !pdlCity.includes(ourCity) && !ourCity.includes(pdlCity)) {
      signals.push({
        type: 'profile_update',
        title: `Relocated to ${person.location_name}`,
        description: `Previously in ${alumni.location_city}, ${alumni.location_country}`,
        source: 'pdl_enrichment',
        weight: 1.5,
        _update: {
          location_city: person.location_locality || person.location_name,
          location_country: person.location_country,
        },
      });
    }
  }

  // Education enrichment (fill in missing data)
  if (!alumni.degree && person.education && person.education.length > 0) {
    const uomEdu = person.education.find(e =>
      (e.school?.name || '').toLowerCase().includes('melbourne')
    );
    if (uomEdu) {
      signals.push({
        type: 'profile_update',
        title: `Education enriched: ${uomEdu.degrees?.join(', ') || 'degree found'}`,
        description: `${uomEdu.school?.name} - ${uomEdu.majors?.join(', ') || ''}`,
        source: 'pdl_enrichment',
        weight: 0.5,
        _update: {
          degree: uomEdu.degrees?.[0] || null,
          faculty: uomEdu.majors?.[0] || null,
          graduation_year: uomEdu.end_date ? parseInt(uomEdu.end_date.slice(0, 4)) : null,
        },
      });
    }
  }

  return signals;
}

/**
 * Scan a single alumni
 */
async function scan(alumni) {
  try {
    const params = buildParams(alumni);
    // Need at least a LinkedIn URL or name to search
    if (!params.profile && !params.first_name) return [];

    const result = await enrichPerson(params);
    if (!result) return [];

    return detectChanges(alumni, result);
  } catch (err) {
    console.error(`PDL enrichment failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
    return [];
  }
}

/**
 * Scan all alumni — be conservative with the free tier (100/month)
 */
async function scanAll(alumniList) {
  const allSignals = [];

  // Prioritize: founders first, then leaders, then watching
  // Only enrich up to 50 per pipeline run to conserve credits
  const prioritized = [
    ...alumniList.filter(a => a.category === 'founder'),
    ...alumniList.filter(a => a.category === 'leader'),
    ...alumniList.filter(a => a.category === 'watching'),
  ].slice(0, 50);

  for (let i = 0; i < prioritized.length; i++) {
    const signals = await scan(prioritized[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: prioritized[i].id });
    }
    // Rate limit: PDL free tier is 100/min, but be conservative
    if (i < prioritized.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

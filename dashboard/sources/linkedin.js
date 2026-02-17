/**
 * LinkedIn Data Source
 *
 * Approaches for LinkedIn data collection:
 *
 * 1. PROXYCURL API (recommended for production)
 *    - https://nubela.co/proxycurl - paid API ($0.01/profile)
 *    - Full profile data, job changes, company data
 *    - No scraping required, TOS-compliant
 *    - Set PROXYCURL_API_KEY env var
 *
 * 2. LINKEDIN SCRAPING (via Playwright/Puppeteer)
 *    - Requires LinkedIn credentials (LINKEDIN_EMAIL, LINKEDIN_PASSWORD)
 *    - Rate-limited, fragile, violates LinkedIn TOS
 *    - Use at your own risk
 *
 * 3. MANUAL CSV IMPORT
 *    - Export alumni data from LinkedIn Alumni page
 *    - Use the dashboard CSV import feature
 *
 * This module supports Proxycurl API and falls back to a stub
 * for manual tracking.
 */

const PROXYCURL_BASE = 'https://nubela.co/proxycurl/api/v2';

const name = 'LinkedIn';
const description = 'Monitor LinkedIn profiles for job changes, title updates, and activity signals via Proxycurl API';
const requiredEnv = ['PROXYCURL_API_KEY'];

function isConfigured() {
  return !!process.env.PROXYCURL_API_KEY;
}

/**
 * Fetch a LinkedIn profile via Proxycurl
 */
async function fetchProfile(linkedinUrl) {
  const apiKey = process.env.PROXYCURL_API_KEY;
  const url = `${PROXYCURL_BASE}/linkedin?url=${encodeURIComponent(linkedinUrl)}&skills=exclude&inferred_salary=exclude&personal_email=exclude&personal_contact_number=exclude`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Proxycurl API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * Compare current alumni data with fresh LinkedIn data to detect changes
 */
function detectChanges(alumni, profile) {
  const signals = [];

  if (!profile) return signals;

  // Check for job/title changes
  const currentExperience = (profile.experiences || []).find(e => !e.ends_at);
  if (currentExperience) {
    const currentTitle = currentExperience.title || '';
    const currentCompany = currentExperience.company || '';

    // Detect company change
    if (alumni.current_company && currentCompany &&
        currentCompany.toLowerCase() !== alumni.current_company.toLowerCase()) {

      // Check if they became a founder
      const founderTitles = ['founder', 'co-founder', 'cofounder', 'ceo', 'chief executive'];
      const isFounder = founderTitles.some(t => currentTitle.toLowerCase().includes(t));

      if (isFounder) {
        signals.push({
          type: 'company_founded',
          title: `Now ${currentTitle} at ${currentCompany}`,
          description: `Previously at ${alumni.current_company}. LinkedIn shows new founder/CEO role.`,
          source: 'linkedin',
          source_url: alumni.linkedin_url,
          _update: { current_company: currentCompany, current_title: currentTitle, category: 'founder' },
        });
      } else {
        // Check for C-suite/VP moves
        const leaderTitles = ['chief', 'cto', 'cfo', 'coo', 'cmo', 'cpo', 'cro', 'vp', 'vice president', 'svp', 'evp'];
        const isLeader = leaderTitles.some(t => currentTitle.toLowerCase().includes(t));

        signals.push({
          type: isLeader ? 'title_change_csuite' : 'left_employer',
          title: `Moved to ${currentCompany} as ${currentTitle}`,
          description: `Left ${alumni.current_company}. ${isLeader ? 'New leadership role detected.' : ''}`,
          source: 'linkedin',
          source_url: alumni.linkedin_url,
          _update: {
            current_company: currentCompany,
            current_title: currentTitle,
            ...(isLeader ? { category: 'leader' } : {}),
          },
        });
      }
    }

    // Detect title change at same company
    if (alumni.current_company && currentCompany &&
        currentCompany.toLowerCase() === alumni.current_company.toLowerCase() &&
        alumni.current_title && currentTitle &&
        currentTitle.toLowerCase() !== alumni.current_title.toLowerCase()) {
      signals.push({
        type: 'title_change_csuite',
        title: `Title changed to ${currentTitle} at ${currentCompany}`,
        description: `Previously ${alumni.current_title}`,
        source: 'linkedin',
        source_url: alumni.linkedin_url,
        _update: { current_title: currentTitle },
      });
    }
  }

  // Detect "no current role" (left company without joining another)
  if (alumni.current_company && !currentExperience) {
    signals.push({
      type: 'left_employer',
      title: `Left ${alumni.current_company}`,
      description: 'LinkedIn shows no current position. May be in stealth mode or between roles.',
      source: 'linkedin',
      source_url: alumni.linkedin_url,
    });
  }

  // Check headline for founder/startup signals
  const headline = (profile.headline || '').toLowerCase();
  const stealthKeywords = ['building', 'stealth', 'working on something', 'starting', 'creating', 'exploring'];
  if (stealthKeywords.some(k => headline.includes(k)) && alumni.category === 'watching') {
    signals.push({
      type: 'profile_update',
      title: `Headline suggests new venture: "${profile.headline}"`,
      description: 'LinkedIn headline contains startup-related keywords',
      source: 'linkedin',
      source_url: alumni.linkedin_url,
    });
  }

  // Check for location changes
  if (profile.city && alumni.location_city &&
      profile.city.toLowerCase() !== alumni.location_city.toLowerCase()) {
    signals.push({
      type: 'profile_update',
      title: `Relocated to ${profile.city}`,
      description: `Previously in ${alumni.location_city}`,
      source: 'linkedin',
      source_url: alumni.linkedin_url,
      weight: 0.5,
      _update: { location_city: profile.city, location_country: profile.country_full_name || alumni.location_country },
    });
  }

  return signals;
}

/**
 * Scan a single alumni's LinkedIn profile for changes
 */
async function scan(alumni) {
  if (!alumni.linkedin_url) return [];

  try {
    const profile = await fetchProfile(alumni.linkedin_url);
    return detectChanges(alumni, profile);
  } catch (err) {
    console.error(`LinkedIn scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
    return [];
  }
}

/**
 * Scan all alumni (with rate limiting)
 */
async function scanAll(alumniList) {
  const allSignals = [];
  const withLinkedin = alumniList.filter(a => a.linkedin_url);

  for (let i = 0; i < withLinkedin.length; i++) {
    const signals = await scan(withLinkedin[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: withLinkedin[i].id });
    }

    // Rate limit: 1 request per second for Proxycurl
    if (i < withLinkedin.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll, fetchProfile, detectChanges };

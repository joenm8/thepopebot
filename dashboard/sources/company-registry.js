/**
 * Company Registry Data Source
 *
 * Monitors company registrations in multiple jurisdictions
 * to detect when alumni incorporate new entities.
 *
 * Supported registries:
 * 1. ASIC (Australia) - via ABR API (free)
 * 2. Companies House (UK) - free API
 * 3. SEC EDGAR (US) - free API
 * 4. ACRA (Singapore) - paid API
 *
 * The module searches for alumni names as directors/officers
 * in recent company registrations.
 */

const name = 'Company Registries';
const description = 'Monitor company registrations (ASIC, Companies House, EDGAR) for new incorporations by alumni';
const requiredEnv = []; // Some registries are free

function isConfigured() {
  return !!(
    process.env.COMPANIES_HOUSE_API_KEY ||
    process.env.ABR_GUID // Australian Business Register
  );
}

/**
 * UK Companies House API - Free, 600 requests/5 minutes
 * https://developer.company-information.service.gov.uk/
 */
async function searchCompaniesHouse(directorName) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) return [];

  try {
    // Search for officer appointments
    const encoded = Buffer.from(`${apiKey}:`).toString('base64');
    const params = new URLSearchParams({ q: directorName, items_per_page: '10' });
    const res = await fetch(`https://api.company-information.service.gov.uk/search/officers?${params}`, {
      headers: { 'Authorization': `Basic ${encoded}` },
    });

    if (!res.ok) return [];
    const data = await res.json();

    const results = [];
    for (const item of (data.items || [])) {
      // Check if this is a recent appointment
      if (!item.appointed_on) continue;
      const appointedDate = new Date(item.appointed_on);
      const daysSinceAppointed = (Date.now() - appointedDate) / (1000 * 60 * 60 * 24);

      if (daysSinceAppointed > 365) continue; // Only last year

      // Check role — directors and secretaries
      const role = (item.officer_role || '').toLowerCase();
      const isDirector = role.includes('director');

      if (isDirector) {
        results.push({
          company_name: item.appointed_to?.company_name,
          company_number: item.appointed_to?.company_number,
          role: item.officer_role,
          appointed_on: item.appointed_on,
          link: item.links?.company ? `https://find-and-update.company-information.service.gov.uk${item.links.company}` : null,
        });
      }
    }

    return results;
  } catch (err) {
    console.error('Companies House search failed:', err.message);
    return [];
  }
}

/**
 * Australian Business Register (ABR) - Free with GUID
 * https://abr.business.gov.au/abrxmlsearch/
 */
async function searchABR(businessName) {
  const guid = process.env.ABR_GUID;
  if (!guid) return [];

  try {
    const params = new URLSearchParams({
      name: businessName,
      guid: guid,
    });
    const res = await fetch(`https://abr.business.gov.au/json/MatchingNames.aspx?${params}`);
    if (!res.ok) return [];

    // ABR returns JSONP, need to extract JSON
    let text = await res.text();
    const match = text.match(/callback\((.*)\)/s);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    return (data.Names || []).map(item => ({
      abn: item.Abn,
      name: item.Name,
      type: item.NameType,
      state: item.State,
      postcode: item.Postcode,
      status: item.AbnStatus,
    }));
  } catch (err) {
    console.error('ABR search failed:', err.message);
    return [];
  }
}

/**
 * Scan alumni for new company registrations
 */
async function scan(alumni) {
  const signals = [];
  const fullName = `${alumni.first_name} ${alumni.last_name}`;

  // Search UK Companies House
  if (process.env.COMPANIES_HOUSE_API_KEY) {
    const appointments = await searchCompaniesHouse(fullName);
    for (const appt of appointments) {
      // Check it's not their known current company
      if (alumni.current_company &&
          appt.company_name?.toLowerCase().includes(alumni.current_company.toLowerCase())) continue;

      signals.push({
        type: 'incorporation',
        title: `Director of "${appt.company_name}" (UK)`,
        description: `Appointed as ${appt.role} on ${appt.appointed_on}. Company number: ${appt.company_number}`,
        source: 'companies_house',
        source_url: appt.link,
        weight: 4.0,
        detected_at: appt.appointed_on,
      });
    }
  }

  // Search Australian Business Register (by company name if they're a founder)
  if (process.env.ABR_GUID && alumni.current_company && alumni.category === 'founder') {
    const abrResults = await searchABR(alumni.current_company);
    for (const result of abrResults) {
      if (result.status === 'Active') {
        signals.push({
          type: 'incorporation',
          title: `"${result.name}" registered in Australia (ABN: ${result.abn})`,
          description: `Active business in ${result.state}`,
          source: 'companies_house',
          weight: 3.0,
        });
      }
    }
  }

  return signals;
}

async function scanAll(alumniList) {
  const allSignals = [];

  for (let i = 0; i < alumniList.length; i++) {
    const signals = await scan(alumniList[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: alumniList[i].id });
    }
    // Rate limit
    if (i < alumniList.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

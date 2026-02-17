/**
 * Crunchbase / Private Market Data Source
 *
 * Monitors funding rounds, company stages, and investor activity.
 *
 * Options:
 * 1. Crunchbase Basic API (CRUNCHBASE_API_KEY) - $29/month for basic
 * 2. PitchBook API - Enterprise only
 * 3. Dealroom API - Enterprise only
 * 4. OpenVC.app - Free, limited data
 * 5. Tracxn API - Enterprise
 *
 * For MVP, this module supports:
 * - Crunchbase Basic API for company/funding lookups
 * - Manual data entry via dashboard
 * - CSV import of funding data
 */

const name = 'Crunchbase / Market Data';
const description = 'Track funding rounds, company stages, and investor activity from private market databases';
const requiredEnv = ['CRUNCHBASE_API_KEY'];

function isConfigured() {
  return !!process.env.CRUNCHBASE_API_KEY;
}

const CB_BASE = 'https://api.crunchbase.com/api/v4';

async function cbFetch(endpoint, params = {}) {
  const apiKey = process.env.CRUNCHBASE_API_KEY;
  const queryParams = new URLSearchParams({ ...params, user_key: apiKey });
  const url = `${CB_BASE}${endpoint}?${queryParams}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Crunchbase API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Search for a company on Crunchbase
 */
async function searchCompany(companyName) {
  try {
    const data = await cbFetch('/autocompletes', {
      query: companyName,
      collection_ids: 'organizations',
      limit: '5',
    });

    if (!data || !data.entities || data.entities.length === 0) return null;

    // Find best match
    const match = data.entities.find(e =>
      e.identifier?.value?.toLowerCase() === companyName.toLowerCase()
    ) || data.entities[0];

    return match;
  } catch (err) {
    console.error(`Crunchbase search failed for ${companyName}:`, err.message);
    return null;
  }
}

/**
 * Get company details including funding rounds
 */
async function getCompanyDetails(permalink) {
  try {
    const data = await cbFetch(`/entities/organizations/${permalink}`, {
      field_ids: 'short_description,funding_total,last_funding_type,last_funding_at,num_funding_rounds,num_employees_enum,founded_on,categories,location_identifiers',
    });
    return data;
  } catch (err) {
    console.error(`Crunchbase details failed for ${permalink}:`, err.message);
    return null;
  }
}

/**
 * Get recent funding rounds for a company
 */
async function getFundingRounds(permalink) {
  try {
    const data = await cbFetch(`/entities/organizations/${permalink}/funding_rounds`, {
      field_ids: 'announced_on,money_raised,funded_organization_identifier,investment_type,investor_identifiers',
      limit: '5',
    });
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Analyze company data for fundraising signals
 */
function analyzeCompany(companyData, fundingRounds) {
  const signals = [];
  if (!companyData?.properties) return signals;

  const props = companyData.properties;

  // Recent funding round
  if (props.last_funding_at) {
    const lastFunding = new Date(props.last_funding_at);
    const monthsSinceLastRound = (Date.now() - lastFunding) / (1000 * 60 * 60 * 24 * 30);

    // If last round was 12-24 months ago, they might be raising again
    if (monthsSinceLastRound >= 12 && monthsSinceLastRound <= 24) {
      signals.push({
        type: 'funding_round',
        title: `Last funding was ${Math.floor(monthsSinceLastRound)} months ago`,
        description: `${props.last_funding_type || 'Unknown type'} round. May be preparing for next round.`,
        source: 'crunchbase',
        weight: 3.0,
      });
    }

    // Very recent funding
    if (monthsSinceLastRound < 3) {
      signals.push({
        type: 'funding_round',
        title: `Recent ${props.last_funding_type || 'funding'} round`,
        description: `Funded ${Math.floor(monthsSinceLastRound)} months ago. ${props.funding_total?.value_usd ? '$' + formatMoney(props.funding_total.value_usd) + ' total raised' : ''}`,
        source: 'crunchbase',
        weight: 5.0,
      });
    }
  }

  // Employee growth signals
  if (props.num_employees_enum) {
    const empRanges = {
      'c_00001_00010': '1-10',
      'c_00011_00050': '11-50',
      'c_00051_00100': '51-100',
      'c_00101_00250': '101-250',
    };
    if (empRanges[props.num_employees_enum]) {
      signals.push({
        type: 'hiring_activity',
        title: `Company size: ${empRanges[props.num_employees_enum]} employees`,
        description: 'From Crunchbase employee data',
        source: 'crunchbase',
        weight: 1.0,
      });
    }
  }

  return signals;
}

function formatMoney(amount) {
  if (amount >= 1e9) return (amount / 1e9).toFixed(1) + 'B';
  if (amount >= 1e6) return (amount / 1e6).toFixed(1) + 'M';
  if (amount >= 1e3) return (amount / 1e3).toFixed(0) + 'K';
  return String(amount);
}

async function scan(alumni) {
  if (!alumni.current_company) return [];
  // Only scan founders and leaders at startups
  if (alumni.category === 'watching') return [];

  const signals = [];
  try {
    const match = await searchCompany(alumni.current_company);
    if (!match) return [];

    const permalink = match.identifier?.permalink;
    if (!permalink) return [];

    const [details, rounds] = await Promise.all([
      getCompanyDetails(permalink),
      getFundingRounds(permalink),
    ]);

    const companySignals = analyzeCompany(details, rounds);
    for (const s of companySignals) {
      signals.push({
        ...s,
        source_url: `https://www.crunchbase.com/organization/${permalink}`,
      });
    }
  } catch (err) {
    console.error(`Crunchbase scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

async function scanAll(alumniList) {
  const allSignals = [];
  const relevant = alumniList.filter(a => a.current_company && (a.category === 'founder' || a.category === 'leader'));

  for (let i = 0; i < relevant.length; i++) {
    const signals = await scan(relevant[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: relevant[i].id });
    }
    // Rate limit
    if (i < relevant.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

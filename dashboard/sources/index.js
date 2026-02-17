/**
 * Data Sources Registry
 *
 * Each source module exports:
 *   - name: string
 *   - description: string
 *   - requiredEnv: string[]     - env vars needed to use this source
 *   - isConfigured(): boolean   - whether all required env vars are set
 *   - scan(alumni): Signal[]    - scan a single alumni record and return new signals
 *   - scanAll(alumniList): Signal[] - scan all alumni (batch mode)
 */

const linkedin = require('./linkedin');
const github = require('./github');
const news = require('./news');
const crunchbase = require('./crunchbase');
const companyRegistry = require('./company-registry');
const webMonitor = require('./web-monitor');
const alumniDiscovery = require('./alumni-discovery');

const sources = {
  linkedin,
  github,
  news,
  crunchbase,
  company_registry: companyRegistry,
  web_monitor: webMonitor,
  alumni_discovery: alumniDiscovery,
};

/**
 * Get status of all data sources (configured, missing env vars, etc.)
 */
function getSourceStatus() {
  return Object.entries(sources).map(([key, source]) => ({
    key,
    name: source.name,
    description: source.description,
    requiredEnv: source.requiredEnv,
    configured: source.isConfigured(),
    missingEnv: source.requiredEnv.filter(v => !process.env[v]),
  }));
}

/**
 * Run a specific data source against alumni
 */
async function runSource(sourceKey, alumni) {
  const source = sources[sourceKey];
  if (!source) throw new Error(`Unknown source: ${sourceKey}`);
  if (!source.isConfigured()) throw new Error(`Source ${sourceKey} is not configured. Missing: ${source.requiredEnv.filter(v => !process.env[v]).join(', ')}`);
  return source.scanAll(alumni);
}

/**
 * Run all configured sources against alumni
 */
async function runAllSources(alumni) {
  const results = {};
  for (const [key, source] of Object.entries(sources)) {
    if (!source.isConfigured()) {
      results[key] = { status: 'skipped', reason: 'not configured' };
      continue;
    }
    try {
      const signals = await source.scanAll(alumni);
      results[key] = { status: 'ok', signals_found: signals.length, signals };
    } catch (err) {
      results[key] = { status: 'error', error: err.message };
    }
  }
  return results;
}

module.exports = { sources, getSourceStatus, runSource, runAllSources };

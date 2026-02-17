/**
 * Data Collection Pipeline
 *
 * Orchestrates all data sources to:
 * 1. Scan alumni profiles for changes (LinkedIn, GitHub)
 * 2. Monitor companies for fundraising signals (Crunchbase, news, web)
 * 3. Check company registries for new incorporations
 * 4. Generate daily digest of findings
 *
 * Can be run:
 * - On demand via API endpoint
 * - On a schedule via cron (node-cron or system cron)
 * - As a standalone script: node pipeline.js
 */

const { db, queries } = require('./db');
const { addSignal, recalculateAllScores, generateDigest, checkTenureMilestones } = require('./signals');
const { getSourceStatus, runSource, runAllSources } = require('./sources');

/**
 * Run the full pipeline
 */
async function runPipeline(options = {}) {
  const {
    sources: sourceFilter = null,  // Array of source keys to run, or null for all
    dryRun = false,                // If true, don't save signals
    verbose = false,
  } = options;

  const startTime = Date.now();
  const log = verbose ? console.log : () => {};
  const results = {
    started_at: new Date().toISOString(),
    sources: {},
    signals_found: 0,
    signals_saved: 0,
    scores_updated: 0,
    errors: [],
  };

  log('Starting pipeline run...');

  // Get all non-archived alumni
  const alumni = queries.getAllAlumni.all();
  log(`Found ${alumni.length} alumni to scan`);

  // 1. Check tenure milestones (always runs, no external API needed)
  log('Checking tenure milestones...');
  try {
    const milestones = checkTenureMilestones();
    results.sources.tenure_milestones = {
      status: 'ok',
      signals_found: milestones.length,
    };
    results.signals_found += milestones.length;
    results.signals_saved += milestones.length;
    log(`  Found ${milestones.length} tenure milestones`);
  } catch (err) {
    results.sources.tenure_milestones = { status: 'error', error: err.message };
    results.errors.push(`tenure_milestones: ${err.message}`);
  }

  // 2. Run configured data sources
  const sourceStatuses = getSourceStatus();
  log('Data source status:');
  for (const s of sourceStatuses) {
    log(`  ${s.name}: ${s.configured ? 'configured' : 'NOT configured (' + s.missingEnv.join(', ') + ')'}`);
  }

  for (const sourceStatus of sourceStatuses) {
    // Skip if source filter is set and this source isn't in it
    if (sourceFilter && !sourceFilter.includes(sourceStatus.key)) continue;
    if (!sourceStatus.configured) continue;

    log(`Running ${sourceStatus.name}...`);
    try {
      const signals = await runSource(sourceStatus.key, alumni);
      results.sources[sourceStatus.key] = {
        status: 'ok',
        signals_found: signals.length,
      };
      results.signals_found += signals.length;

      // Save signals (unless dry run)
      if (!dryRun) {
        for (const signal of signals) {
          try {
            // Check for duplicate signals (same alumni + type + title in last 7 days)
            const duplicate = db.prepare(`
              SELECT id FROM signals
              WHERE alumni_id = ? AND type = ? AND title = ?
              AND detected_at > datetime('now', '-7 days')
            `).get(signal.alumni_id, signal.type, signal.title);

            if (!duplicate) {
              addSignal(signal.alumni_id, signal);
              results.signals_saved++;

              // Apply any alumni updates from the signal
              if (signal._update) {
                const alumni = queries.getAlumniById.get(signal.alumni_id);
                if (alumni) {
                  queries.updateAlumni.run({ ...alumni, ...signal._update, id: signal.alumni_id });
                }
              }
            }
          } catch (err) {
            results.errors.push(`Signal save error: ${err.message}`);
          }
        }
      }

      log(`  Found ${signals.length} signals`);
    } catch (err) {
      results.sources[sourceStatus.key] = { status: 'error', error: err.message };
      results.errors.push(`${sourceStatus.key}: ${err.message}`);
      log(`  Error: ${err.message}`);
    }
  }

  // 3. Recalculate all scores
  if (!dryRun) {
    log('Recalculating scores...');
    const scoreResults = recalculateAllScores();
    results.scores_updated = scoreResults.length;
  }

  // 4. Generate digest
  if (!dryRun) {
    log('Generating digest...');
    try {
      generateDigest(1);
    } catch (err) {
      results.errors.push(`Digest generation: ${err.message}`);
    }
  }

  results.duration_ms = Date.now() - startTime;
  results.completed_at = new Date().toISOString();

  log(`Pipeline complete in ${results.duration_ms}ms`);
  log(`  Signals found: ${results.signals_found}`);
  log(`  Signals saved: ${results.signals_saved}`);
  log(`  Scores updated: ${results.scores_updated}`);
  if (results.errors.length > 0) {
    log(`  Errors: ${results.errors.length}`);
  }

  // Save pipeline run to database
  if (!dryRun) {
    savePipelineRun(results);
  }

  return results;
}

/**
 * Save pipeline run results for history
 */
function savePipelineRun(results) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      signals_found INTEGER,
      signals_saved INTEGER,
      scores_updated INTEGER,
      sources TEXT,
      errors TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.prepare(`
    INSERT INTO pipeline_runs (started_at, completed_at, duration_ms, signals_found, signals_saved, scores_updated, sources, errors)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    results.started_at,
    results.completed_at,
    results.duration_ms,
    results.signals_found,
    results.signals_saved,
    results.scores_updated,
    JSON.stringify(results.sources),
    JSON.stringify(results.errors),
  );
}

/**
 * Get recent pipeline runs
 */
function getPipelineRuns(limit = 20) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT,
      completed_at TEXT,
      duration_ms INTEGER,
      signals_found INTEGER,
      signals_saved INTEGER,
      scores_updated INTEGER,
      sources TEXT,
      errors TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db.prepare('SELECT * FROM pipeline_runs ORDER BY id DESC LIMIT ?').all(limit).map(r => ({
    ...r,
    sources: JSON.parse(r.sources || '{}'),
    errors: JSON.parse(r.errors || '[]'),
  }));
}

module.exports = { runPipeline, getPipelineRuns };

// ── CLI Mode ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = true;

  console.log('=== Tin Alley Ventures - Data Pipeline ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  runPipeline({ dryRun, verbose }).then(results => {
    console.log('\n=== Results ===');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}

const { db, queries } = require('./db');

// ── Signal weights (configurable) ──────────────────────────────────────────
// These determine how much each signal type contributes to the fundraising score.
// Signals decay over time — a signal from 6 months ago counts less than one from today.

const DECAY_HALF_LIFE_DAYS = 60; // Signal relevance halves every 60 days
const SCORE_THRESHOLDS = { high: 8, medium: 4, low: 1 };

/**
 * Calculate the decay multiplier for a signal based on age
 */
function decayMultiplier(detectedAt) {
  const ageMs = Date.now() - new Date(detectedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
}

/**
 * Recalculate fundraising score for a single alumni
 */
function recalculateScore(alumniId) {
  const signals = queries.getSignalsByAlumni.all(alumniId);
  let score = 0;

  for (const signal of signals) {
    // Skip expired signals
    if (signal.expires_at && new Date(signal.expires_at) < new Date()) continue;

    const decay = decayMultiplier(signal.detected_at);
    score += signal.weight * decay;
  }

  // Round to 1 decimal
  score = Math.round(score * 10) / 10;

  let level = 'none';
  if (score >= SCORE_THRESHOLDS.high) level = 'high';
  else if (score >= SCORE_THRESHOLDS.medium) level = 'medium';
  else if (score >= SCORE_THRESHOLDS.low) level = 'low';

  queries.updateAlumniScore.run(score, level, alumniId);
  return { score, level };
}

/**
 * Recalculate scores for all alumni
 */
function recalculateAllScores() {
  const alumni = queries.getAllAlumni.all();
  const results = [];
  for (const a of alumni) {
    const result = recalculateScore(a.id);
    results.push({ id: a.id, name: `${a.first_name} ${a.last_name}`, ...result });
  }
  return results;
}

/**
 * Add a signal for an alumni and recalculate their score
 */
function addSignal(alumniId, signalData) {
  // Get default weight from signal type if not specified
  if (!signalData.weight) {
    const signalType = db.prepare('SELECT default_weight FROM signal_types WHERE type = ?').get(signalData.type);
    signalData.weight = signalType ? signalType.default_weight : 1.0;
  }

  const result = queries.insertSignal.run({
    alumni_id: alumniId,
    company_id: signalData.company_id || null,
    type: signalData.type,
    title: signalData.title,
    description: signalData.description || null,
    source: signalData.source || 'manual',
    source_url: signalData.source_url || null,
    weight: signalData.weight,
    detected_at: signalData.detected_at || new Date().toISOString(),
    expires_at: signalData.expires_at || null,
  });

  // Auto-upgrade category based on signal type
  const alumni = queries.getAlumniById.get(alumniId);
  if (alumni) {
    const founderSignals = ['company_founded', 'title_change_founder', 'incorporation'];
    const leaderSignals = ['title_change_csuite'];
    const leftSignals = ['left_top_company', 'left_employer'];

    if (founderSignals.includes(signalData.type) && alumni.category === 'watching') {
      db.prepare('UPDATE alumni SET category = ? WHERE id = ?').run('founder', alumniId);
    } else if (leaderSignals.includes(signalData.type) && alumni.category === 'watching') {
      db.prepare('UPDATE alumni SET category = ? WHERE id = ?').run('leader', alumniId);
    } else if (leftSignals.includes(signalData.type) && alumni.category === 'watching') {
      // Move from watching to founder if they left and started something
      // Keep as watching otherwise — they might join another company
    }
  }

  recalculateScore(alumniId);
  return result;
}

/**
 * Generate a daily digest of notable signals and alumni updates
 */
function generateDigest(daysBack = 1) {
  const signals = queries.getRecentSignals.all(daysBack);
  const today = new Date().toISOString().split('T')[0];

  // Group signals by alumni
  const byAlumni = {};
  for (const s of signals) {
    const key = s.alumni_id;
    if (!byAlumni[key]) {
      byAlumni[key] = {
        alumni_id: s.alumni_id,
        name: `${s.first_name} ${s.last_name}`,
        company: s.current_company,
        category: s.alumni_category,
        location: [s.location_city, s.location_country].filter(Boolean).join(', '),
        signals: [],
      };
    }
    byAlumni[key].signals.push({
      type: s.type,
      label: s.type_label,
      icon: s.icon,
      title: s.title,
      description: s.description,
      detected_at: s.detected_at,
    });
  }

  // Sort by signal importance (total weight)
  const items = Object.values(byAlumni).sort((a, b) => {
    const aWeight = a.signals.reduce((sum, s) => sum + (s.weight || 1), 0);
    const bWeight = b.signals.reduce((sum, s) => sum + (s.weight || 1), 0);
    return bWeight - aWeight;
  });

  // Categorize digest items
  const digest = {
    date: today,
    high_priority: items.filter(i => {
      const alumni = queries.getAlumniById.get(i.alumni_id);
      return alumni && alumni.fundraising_level === 'high';
    }),
    notable: items.filter(i => {
      const alumni = queries.getAlumniById.get(i.alumni_id);
      return alumni && alumni.fundraising_level === 'medium';
    }),
    watching: items.filter(i => {
      const alumni = queries.getAlumniById.get(i.alumni_id);
      return alumni && (alumni.fundraising_level === 'low' || alumni.fundraising_level === 'none');
    }),
    total_signals: signals.length,
    total_alumni: items.length,
  };

  // Save digest
  queries.insertDigest.run({
    date: today,
    content: JSON.stringify(digest),
    alumni_count: items.length,
    signal_count: signals.length,
  });

  return digest;
}

/**
 * Check watching list for tenure milestones
 * Alumni at top companies approaching 2-3 year mark
 */
function checkTenureMilestones() {
  const watchingAlumni = queries.getAlumniByCategory.all('watching');
  const newSignals = [];

  for (const alumni of watchingAlumni) {
    const positions = queries.getAlumniCompanies.all(alumni.id);
    for (const pos of positions) {
      if (!pos.is_current || !pos.is_top_company || !pos.start_date) continue;

      const startDate = new Date(pos.start_date);
      const now = new Date();
      const monthsAtCompany = (now - startDate) / (1000 * 60 * 60 * 24 * 30);

      // Check if approaching 2-year or 3-year milestone (within 2 months)
      if ((monthsAtCompany >= 22 && monthsAtCompany <= 26) || (monthsAtCompany >= 34 && monthsAtCompany <= 38)) {
        const years = Math.round(monthsAtCompany / 12);
        // Check if we already have a recent tenure milestone signal
        const existing = db.prepare(`
          SELECT id FROM signals
          WHERE alumni_id = ? AND type = 'tenure_milestone'
          AND detected_at > datetime('now', '-60 days')
        `).get(alumni.id);

        if (!existing) {
          const signal = {
            type: 'tenure_milestone',
            title: `${years}-year mark at ${pos.company_name}`,
            description: `${alumni.first_name} ${alumni.last_name} has been at ${pos.company_name} for ~${years} years. Vesting cliff approaching.`,
            source: 'system',
          };
          addSignal(alumni.id, signal);
          newSignals.push({ alumni, signal });
        }
      }
    }
  }

  return newSignals;
}

module.exports = {
  recalculateScore,
  recalculateAllScores,
  addSignal,
  generateDigest,
  checkTenureMilestones,
  SCORE_THRESHOLDS,
};

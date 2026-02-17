const express = require('express');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

const { db, queries } = require('./db');
const { addSignal, recalculateAllScores, generateDigest, checkTenureMilestones } = require('./signals');
const { getSourceStatus } = require('./sources');
const { runPipeline, getPipelineRuns } = require('./pipeline');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── API Routes ──────────────────────────────────────────────────────────────

// Dashboard stats
app.get('/api/stats', (req, res) => {
  const stats = queries.getStats.get();
  const countries = queries.getCountryBreakdown.all();
  const breakdown = queries.getCategoryBreakdown.all();
  res.json({ stats, countries, breakdown });
});

// ── Alumni CRUD ─────────────────────────────────────────────────────────────

app.get('/api/alumni', (req, res) => {
  const { category, search, level } = req.query;
  let alumni;

  if (search) {
    alumni = queries.searchAlumni.all(search);
  } else if (category) {
    alumni = queries.getAlumniByCategory.all(category);
  } else {
    alumni = queries.getAllAlumni.all();
  }

  if (level) {
    alumni = alumni.filter(a => a.fundraising_level === level);
  }

  res.json(alumni);
});

app.get('/api/alumni/:id', (req, res) => {
  const alumni = queries.getAlumniById.get(req.params.id);
  if (!alumni) return res.status(404).json({ error: 'Not found' });

  const companies = queries.getAlumniCompanies.all(req.params.id);
  const signals = queries.getSignalsByAlumni.all(req.params.id);
  res.json({ alumni, companies, signals });
});

app.post('/api/alumni', (req, res) => {
  const data = {
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email || null,
    linkedin_url: req.body.linkedin_url || null,
    location_city: req.body.location_city || null,
    location_country: req.body.location_country || null,
    graduation_year: req.body.graduation_year || null,
    degree: req.body.degree || null,
    faculty: req.body.faculty || null,
    current_company: req.body.current_company || null,
    current_title: req.body.current_title || null,
    category: req.body.category || 'watching',
    notes: req.body.notes || null,
    tags: req.body.tags ? JSON.stringify(req.body.tags) : null,
  };

  const result = queries.insertAlumni.run(data);
  res.json({ id: result.lastInsertRowid, ...data });
});

app.put('/api/alumni/:id', (req, res) => {
  const existing = queries.getAlumniById.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const data = {
    id: parseInt(req.params.id),
    first_name: req.body.first_name ?? existing.first_name,
    last_name: req.body.last_name ?? existing.last_name,
    email: req.body.email ?? existing.email,
    linkedin_url: req.body.linkedin_url ?? existing.linkedin_url,
    location_city: req.body.location_city ?? existing.location_city,
    location_country: req.body.location_country ?? existing.location_country,
    graduation_year: req.body.graduation_year ?? existing.graduation_year,
    degree: req.body.degree ?? existing.degree,
    faculty: req.body.faculty ?? existing.faculty,
    current_company: req.body.current_company ?? existing.current_company,
    current_title: req.body.current_title ?? existing.current_title,
    category: req.body.category ?? existing.category,
    notes: req.body.notes ?? existing.notes,
    tags: req.body.tags ? JSON.stringify(req.body.tags) : existing.tags,
  };

  queries.updateAlumni.run(data);
  res.json(data);
});

app.post('/api/alumni/:id/star', (req, res) => {
  queries.toggleStarAlumni.run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/alumni/:id/archive', (req, res) => {
  queries.archiveAlumni.run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/alumni/:id', (req, res) => {
  queries.deleteAlumni.run(req.params.id);
  res.json({ ok: true });
});

// ── Companies ───────────────────────────────────────────────────────────────

app.get('/api/companies', (req, res) => {
  const { top } = req.query;
  res.json(top ? queries.getTopCompanies.all() : queries.getAllCompanies.all());
});

app.post('/api/companies', (req, res) => {
  const data = {
    name: req.body.name,
    website: req.body.website || null,
    industry: req.body.industry || null,
    stage: req.body.stage || null,
    founded_date: req.body.founded_date || null,
    location_city: req.body.location_city || null,
    location_country: req.body.location_country || null,
    employee_count: req.body.employee_count || null,
    description: req.body.description || null,
    crunchbase_url: req.body.crunchbase_url || null,
    is_top_company: req.body.is_top_company ? 1 : 0,
  };

  const result = queries.insertCompany.run(data);
  res.json({ id: result.lastInsertRowid, ...data });
});

// ── Alumni-Company Links ────────────────────────────────────────────────────

app.post('/api/alumni/:id/companies', (req, res) => {
  const data = {
    alumni_id: parseInt(req.params.id),
    company_id: req.body.company_id,
    title: req.body.title || null,
    role_level: req.body.role_level || null,
    start_date: req.body.start_date || null,
    end_date: req.body.end_date || null,
    is_current: req.body.is_current !== undefined ? (req.body.is_current ? 1 : 0) : 1,
  };

  const result = queries.insertAlumniCompany.run(data);
  res.json({ id: result.lastInsertRowid });
});

// ── Signals ─────────────────────────────────────────────────────────────────

app.get('/api/signals', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const signals = queries.getRecentSignals.all(days);
  res.json(signals);
});

app.get('/api/signals/unread', (req, res) => {
  res.json(queries.getUnreadSignals.all());
});

app.get('/api/signals/types', (req, res) => {
  res.json(queries.getSignalTypes.all());
});

app.post('/api/alumni/:id/signals', (req, res) => {
  const alumniId = parseInt(req.params.id);
  const alumni = queries.getAlumniById.get(alumniId);
  if (!alumni) return res.status(404).json({ error: 'Alumni not found' });

  addSignal(alumniId, req.body);
  res.json({ ok: true });
});

app.post('/api/signals/:id/read', (req, res) => {
  queries.markSignalRead.run(req.params.id);
  res.json({ ok: true });
});

// ── Digest ──────────────────────────────────────────────────────────────────

app.get('/api/digest', (req, res) => {
  const { date } = req.query;
  if (date) {
    const digest = queries.getDigestByDate.get(date);
    if (!digest) return res.status(404).json({ error: 'No digest for that date' });
    res.json({ ...digest, content: JSON.parse(digest.content) });
  } else {
    const digest = queries.getLatestDigest.get();
    if (!digest) return res.json(null);
    res.json({ ...digest, content: JSON.parse(digest.content) });
  }
});

app.post('/api/digest/generate', (req, res) => {
  const days = parseInt(req.body.days) || 1;
  const digest = generateDigest(days);
  res.json(digest);
});

app.get('/api/digests', (req, res) => {
  const digests = queries.getRecentDigests.all();
  res.json(digests.map(d => ({ ...d, content: JSON.parse(d.content) })));
});

// ── Bulk Operations ─────────────────────────────────────────────────────────

app.post('/api/recalculate', (req, res) => {
  const results = recalculateAllScores();
  res.json({ updated: results.length, results });
});

app.post('/api/check-milestones', (req, res) => {
  const milestones = checkTenureMilestones();
  res.json({ found: milestones.length, milestones });
});

// ── CSV Import ──────────────────────────────────────────────────────────────

app.post('/api/import/alumni', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const insertTransaction = db.transaction((records) => {
      for (const record of records) {
        try {
          // Map CSV columns (flexible naming)
          const data = {
            first_name: record.first_name || record.firstName || record['First Name'] || '',
            last_name: record.last_name || record.lastName || record['Last Name'] || '',
            email: record.email || record.Email || null,
            linkedin_url: record.linkedin_url || record.linkedin || record.LinkedIn || record['LinkedIn URL'] || null,
            location_city: record.location_city || record.city || record.City || null,
            location_country: record.location_country || record.country || record.Country || null,
            graduation_year: parseInt(record.graduation_year || record.grad_year || record['Graduation Year']) || null,
            degree: record.degree || record.Degree || null,
            faculty: record.faculty || record.Faculty || record.department || record.Department || null,
            current_company: record.current_company || record.company || record.Company || null,
            current_title: record.current_title || record.title || record.Title || null,
            category: record.category || 'watching',
            notes: record.notes || record.Notes || null,
            tags: record.tags ? record.tags : null,
          };

          if (!data.first_name || !data.last_name) {
            skipped++;
            errors.push(`Row missing name: ${JSON.stringify(record).slice(0, 100)}`);
            continue;
          }

          queries.insertAlumni.run(data);
          imported++;
        } catch (err) {
          skipped++;
          errors.push(`Row error: ${err.message}`);
        }
      }
    });

    insertTransaction(records);

    res.json({ imported, skipped, total: records.length, errors: errors.slice(0, 10) });
  } catch (err) {
    res.status(400).json({ error: `Failed to parse CSV: ${err.message}` });
  }
});

// ── Data Sources & Pipeline ─────────────────────────────────────────────────

app.get('/api/sources', (req, res) => {
  res.json(getSourceStatus());
});

app.get('/api/pipeline/runs', (req, res) => {
  res.json(getPipelineRuns());
});

app.post('/api/pipeline/run', async (req, res) => {
  const { sources, dryRun } = req.body;
  try {
    const results = await runPipeline({ sources, dryRun, verbose: true });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve dashboard ─────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Tin Alley Dashboard running on http://${HOST}:${PORT}`);
});

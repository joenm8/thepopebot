/**
 * Import alumni from LinkedIn PDF profile data.
 *
 * Run with: node seed-linkedin.js
 *
 * This adds alumni extracted from LinkedIn PDF exports.
 * Skips any alumni who already exist (matched by LinkedIn URL or full name).
 */
const { db, queries } = require('./db');
const { addSignal, recalculateAllScores } = require('./signals');

console.log('Importing LinkedIn PDF alumni data...\n');

// ── Companies ────────────────────────────────────────────────────────────────

const companies = [
  { name: 'Dakara Ventures', industry: 'other', stage: 'growth', description: 'Venture capital and advisory firm.' },
  { name: 'Next Chapter', industry: 'tech', stage: 'pre_seed', description: 'Founded by ex-Canva engineer Jackson Huang.' },
  { name: 'Employment Hero', website: 'https://employmenthero.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 800, description: 'HR, payroll, and benefits platform for SMEs.' },
  { name: 'Sportsbet', website: 'https://sportsbet.com.au', industry: 'tech', stage: 'growth', location_city: 'Melbourne', location_country: 'Australia', description: 'Online sports betting platform (Flutter Entertainment).' },
  { name: 'SiftHub', website: 'https://sifthub.io', industry: 'tech', stage: 'seed', description: 'AI-powered product marketing and sales enablement platform.' },
  { name: 'Actuals.com', website: 'https://actuals.com', industry: 'fintech', stage: 'pre_seed', description: 'Finance platform. Founded by ex-Meta, Twitter, Intuit finance leader.' },
  { name: 'Polarbear AI', industry: 'tech', stage: 'pre_seed', description: 'AI startup co-founded by Percy Ding.' },
  { name: 'VXT', website: 'https://vxt.co.nz', industry: 'tech', stage: 'growth', location_city: 'Auckland', location_country: 'New Zealand', description: 'Cloud phone system and CRM integration for professional services.' },
  { name: 'SafetyCulture', website: 'https://safetyculture.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 800, description: 'Workplace operations platform. Valued at $2.1B.' },
  { name: 'RACV', website: 'https://racv.com.au', industry: 'other', stage: 'public', location_city: 'Melbourne', location_country: 'Australia', description: 'Royal Automobile Club of Victoria — insurance, roadside, travel.' },
  { name: 'Lyrebird Health', website: 'https://lyrebirdhealth.com', industry: 'tech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', description: 'AI-powered clinical documentation platform for healthcare.' },
  { name: 'McKinsey & Company', website: 'https://mckinsey.com', industry: 'other', stage: 'public', description: 'Global management consulting firm.', is_top_company: 1 },
  { name: 'Airwallex', website: 'https://airwallex.com', industry: 'fintech', stage: 'growth', location_city: 'Singapore', location_country: 'Singapore', employee_count: 1500, description: 'Global payments and financial infrastructure platform. Valued at US$8B.', is_top_company: 1 },
  { name: 'Canva', website: 'https://canva.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 4000, description: 'Online design platform.', is_top_company: 1 },
  { name: 'Atlassian', website: 'https://atlassian.com', industry: 'tech', stage: 'public', location_city: 'Sydney', location_country: 'Australia', employee_count: 12000, description: 'Collaboration and project management software.', is_top_company: 1 },
  { name: 'Blackbird Ventures', website: 'https://blackbird.vc', industry: 'other', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', description: 'Leading Australian VC fund.' },
];

// Insert companies (skip if already exist)
const companyIds = {};
for (const c of companies) {
  const existing = queries.findCompanyByName.get(c.name);
  if (existing) {
    companyIds[c.name] = existing.id;
  } else {
    const result = queries.insertCompany.run({
      name: c.name,
      website: c.website || null,
      industry: c.industry || null,
      stage: c.stage || null,
      founded_date: c.founded_date || null,
      location_city: c.location_city || null,
      location_country: c.location_country || null,
      employee_count: c.employee_count || null,
      description: c.description || null,
      crunchbase_url: c.crunchbase_url || null,
      is_top_company: c.is_top_company || 0,
    });
    companyIds[c.name] = result.lastInsertRowid;
  }
}

// ── Alumni from LinkedIn PDFs ────────────────────────────────────────────────

const alumni = [
  // ── Founders ──────────────────────────────────────────────────────────────
  {
    first_name: 'David', last_name: 'Bicknell',
    linkedin_url: 'https://www.linkedin.com/in/dbicknell1',
    current_title: 'Co-Founder and CEO', current_company: 'Actuals.com',
    category: 'founder',
    notes: 'Co-Founder & CEO @ Actuals.com. NED. Previously finance roles at Meta, Twitter, and Intuit.',
    companies: [
      { company: 'Actuals.com', title: 'Co-Founder and CEO', role_level: 'founder', start_date: '2025-07', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Actuals.com', description: 'Finance platform founded by ex-Meta, Twitter, Intuit finance leader.', source: 'linkedin', detected_at: '2025-07-01' },
    ],
  },
  {
    first_name: 'Percy', last_name: 'Ding',
    linkedin_url: 'https://www.linkedin.com/in/percy-ding-',
    current_title: 'Co-Founder & CTO', current_company: 'Polarbear AI',
    category: 'founder',
    notes: 'Co-founder & CTO @ Polarbear AI. Building the next generation of AI.',
    companies: [
      { company: 'Polarbear AI', title: 'Co-Founder & CTO', role_level: 'founder', start_date: '2025-08', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Polarbear AI', description: 'AI startup building next-generation AI technology.', source: 'linkedin', detected_at: '2025-08-01' },
    ],
  },
  {
    first_name: 'Jackson', last_name: 'Huang',
    linkedin_url: 'https://www.linkedin.com/in/jyzhuang',
    current_title: 'Founder', current_company: 'Next Chapter',
    category: 'founder',
    notes: 'Founder of Next Chapter. Ex-Canva Software Engineer.',
    companies: [
      { company: 'Next Chapter', title: 'Founder', role_level: 'founder', start_date: '2024-09', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded Next Chapter', description: 'Left Canva to start Next Chapter.', source: 'linkedin', detected_at: '2024-09-01' },
      { type: 'left_employer', title: 'Left Canva', description: 'Departed Canva (Software Engineer) to become a founder.', source: 'linkedin', detected_at: '2024-09-01' },
    ],
  },

  // ── Leaders ───────────────────────────────────────────────────────────────
  {
    first_name: 'Joshua', last_name: 'Chew',
    linkedin_url: 'https://www.linkedin.com/in/joshuachew',
    current_title: 'Growth Advisor & Investor', current_company: 'Dakara Ventures',
    category: 'leader',
    notes: 'Building AI Agents. Previously at McKinsey and Airwallex. Now Growth Advisor & Investor at Dakara Ventures.',
    companies: [
      { company: 'Dakara Ventures', title: 'Growth Advisor & Investor', role_level: 'director', start_date: '2024-05', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Naman', last_name: 'Chaudhry',
    linkedin_url: 'https://www.linkedin.com/in/naman-',
    current_title: 'Head of Finance', current_company: 'VXT',
    category: 'leader',
    notes: 'Head of Finance @ VXT. Previously at Airwallex and Blackbird Ventures.',
    companies: [
      { company: 'VXT', title: 'Head of Finance', role_level: 'director', start_date: '2025-03', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Amanda', last_name: 'Ralph',
    linkedin_url: 'https://www.linkedin.com/in/ralphamanda',
    current_title: 'Digital Product Lead', current_company: 'RACV',
    category: 'leader',
    notes: 'Co-Founder of Product Women community. CX Product Leader. Currently Digital Product Lead at RACV.',
    companies: [
      { company: 'RACV', title: 'Digital Product Lead', role_level: 'manager', start_date: '2025-06', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Matthew', last_name: 'S.',
    linkedin_url: 'https://www.linkedin.com/in/matthewsek',
    current_title: 'Building & Leading GTM', current_company: 'Lyrebird Health',
    category: 'leader',
    notes: 'Building the future of clinical documentation. Leading GTM at Lyrebird Health.',
    companies: [
      { company: 'Lyrebird Health', title: 'Building & Leading GTM', role_level: 'director', start_date: '2025-09', is_current: 1 },
    ],
    signals: [],
  },

  // ── Watching ──────────────────────────────────────────────────────────────
  {
    first_name: 'Daniel', last_name: 'Sutherland',
    linkedin_url: 'https://www.linkedin.com/in/daniel-',
    current_title: 'Building', current_company: 'TBA',
    category: 'watching',
    notes: 'Exploring chronic pain space. Building something — company TBA.',
    companies: [],
    signals: [],
  },
  {
    first_name: 'Dave', last_name: 'Tan',
    linkedin_url: 'https://www.linkedin.com/in/digitaldavetan',
    current_title: 'Senior Partnerships Manager', current_company: 'Employment Hero',
    category: 'watching',
    notes: 'Senior Partnerships Manager at Employment Hero.',
    companies: [
      { company: 'Employment Hero', title: 'Senior Partnerships Manager', role_level: 'manager', start_date: '2025-09', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Chris', last_name: 'Gardiner-Bill',
    linkedin_url: 'https://www.linkedin.com/in/chris-',
    current_title: 'Technical Writer / Communications Specialist', current_company: 'Sportsbet',
    category: 'watching',
    notes: 'Technical Writer, Developer, DevOps. Ex-Canva. Currently at Sportsbet.',
    companies: [
      { company: 'Sportsbet', title: 'Technical Writer / Communications Specialist', role_level: 'ic', start_date: '2025-08', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Sanjana', last_name: 'Balaraman',
    linkedin_url: 'https://www.linkedin.com/in/sanjana-',
    current_title: 'Marketing Manager', current_company: 'SiftHub',
    category: 'watching',
    notes: 'Marketing Manager at SiftHub. Product Marketing background.',
    companies: [
      { company: 'SiftHub', title: 'Marketing Manager', role_level: 'manager', start_date: '2023-12', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Sally', last_name: 'Sun',
    linkedin_url: 'https://www.linkedin.com/in/xiaoran-sally-',
    current_title: null, current_company: null,
    category: 'watching',
    notes: 'Public Affairs Officer. Cultural Diplomacy background.',
    companies: [],
    signals: [],
  },
  {
    first_name: 'Stephen', last_name: 'S.',
    linkedin_url: 'https://www.linkedin.com/in/stephen-shi',
    current_title: 'Senior Software Engineer', current_company: 'SafetyCulture',
    category: 'watching',
    notes: 'Senior Software Engineer at SafetyCulture.',
    companies: [
      { company: 'SafetyCulture', title: 'Senior Software Engineer', role_level: 'ic', start_date: '2025-04', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Zhen', last_name: 'L.',
    linkedin_url: null,
    current_title: 'Full-Stack Developer', current_company: null,
    category: 'watching',
    notes: 'Full-Stack Developer at UniMelb.',
    companies: [],
    signals: [],
  },
  {
    first_name: 'Wei', last_name: 'Chao',
    linkedin_url: 'https://www.linkedin.com/in/rebecca-wei-',
    current_title: 'Software Engineer Intern', current_company: 'Atlassian',
    category: 'watching',
    notes: 'SWE Intern at Atlassian. CS at UniMelb. Previously at Airwallex.',
    companies: [
      { company: 'Atlassian', title: 'Software Engineer Intern', role_level: 'ic', start_date: '2025-11', is_current: 1 },
    ],
    signals: [],
  },
];

// ── Insert data ──────────────────────────────────────────────────────────────

// Check for existing alumni by LinkedIn URL or full name
const findByLinkedin = db.prepare('SELECT id FROM alumni WHERE linkedin_url = ?');
const findByName = db.prepare('SELECT id FROM alumni WHERE first_name = ? AND last_name = ?');

let inserted = 0;
let skipped = 0;

const insertAll = db.transaction(() => {
  for (const a of alumni) {
    // Skip if already exists
    if (a.linkedin_url) {
      const existing = findByLinkedin.get(a.linkedin_url);
      if (existing) {
        console.log(`  SKIP: ${a.first_name} ${a.last_name} (already exists by LinkedIn URL)`);
        skipped++;
        continue;
      }
    }
    const existingByName = findByName.get(a.first_name, a.last_name);
    if (existingByName) {
      console.log(`  SKIP: ${a.first_name} ${a.last_name} (already exists by name)`);
      skipped++;
      continue;
    }

    const result = queries.insertAlumni.run({
      first_name: a.first_name,
      last_name: a.last_name,
      email: null,
      linkedin_url: a.linkedin_url || null,
      location_city: null,
      location_country: null,
      graduation_year: null,
      degree: null,
      faculty: null,
      current_company: a.current_company || null,
      current_title: a.current_title || null,
      category: a.category,
      notes: a.notes || null,
      tags: JSON.stringify(['linkedin-import']),
    });
    const alumniId = result.lastInsertRowid;
    inserted++;
    console.log(`  ADD: ${a.first_name} ${a.last_name} → ${a.category} (${a.current_company || 'no company'})`);

    // Insert company links
    for (const c of (a.companies || [])) {
      const companyId = companyIds[c.company];
      if (companyId) {
        queries.insertAlumniCompany.run({
          alumni_id: alumniId,
          company_id: companyId,
          title: c.title,
          role_level: c.role_level,
          start_date: c.start_date || null,
          end_date: c.end_date || null,
          is_current: c.is_current ? 1 : 0,
        });
      }
    }

    // Insert signals
    for (const s of (a.signals || [])) {
      addSignal(alumniId, {
        type: s.type,
        title: s.title,
        description: s.description || null,
        source: s.source || 'linkedin',
        source_url: s.source_url || null,
        detected_at: s.detected_at || new Date().toISOString(),
      });
    }
  }
});

insertAll();
recalculateAllScores();

// ── Summary ──────────────────────────────────────────────────────────────────

const founders = alumni.filter(a => a.category === 'founder');
const leaders = alumni.filter(a => a.category === 'leader');
const watching = alumni.filter(a => a.category === 'watching');

console.log('\n--- Import complete ---');
console.log(`  Inserted: ${inserted}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Total:    ${alumni.length}`);
console.log('');
console.log(`  Founders (${founders.length}):`);
founders.forEach(f => console.log(`    - ${f.first_name} ${f.last_name} (${f.current_company})`));
console.log(`  Leaders (${leaders.length}):`);
leaders.forEach(l => console.log(`    - ${l.first_name} ${l.last_name} (${l.current_company})`));
console.log(`  Watching (${watching.length}):`);
watching.forEach(w => console.log(`    - ${w.first_name} ${w.last_name} (${w.current_company || '—'})`));
console.log('');
console.log('Source: LinkedIn PDF exports');

/**
 * Seed the database with realistic sample data for demonstration.
 * Run with: node seed.js
 */
const { db, queries } = require('./db');
const { addSignal, recalculateAllScores } = require('./signals');

console.log('Seeding database...');

// ── Top Companies (Mag7 + top tech) ─────────────────────────────────────────

const topCompanies = [
  { name: 'Google', website: 'https://google.com', industry: 'tech', stage: 'public', location_city: 'Mountain View', location_country: 'United States', employee_count: 180000, is_top_company: 1 },
  { name: 'Meta', website: 'https://meta.com', industry: 'tech', stage: 'public', location_city: 'Menlo Park', location_country: 'United States', employee_count: 67000, is_top_company: 1 },
  { name: 'Apple', website: 'https://apple.com', industry: 'tech', stage: 'public', location_city: 'Cupertino', location_country: 'United States', employee_count: 164000, is_top_company: 1 },
  { name: 'Amazon', website: 'https://amazon.com', industry: 'tech', stage: 'public', location_city: 'Seattle', location_country: 'United States', employee_count: 1500000, is_top_company: 1 },
  { name: 'Microsoft', website: 'https://microsoft.com', industry: 'tech', stage: 'public', location_city: 'Redmond', location_country: 'United States', employee_count: 221000, is_top_company: 1 },
  { name: 'NVIDIA', website: 'https://nvidia.com', industry: 'tech', stage: 'public', location_city: 'Santa Clara', location_country: 'United States', employee_count: 29600, is_top_company: 1 },
  { name: 'Tesla', website: 'https://tesla.com', industry: 'tech', stage: 'public', location_city: 'Austin', location_country: 'United States', employee_count: 140000, is_top_company: 1 },
  { name: 'Stripe', website: 'https://stripe.com', industry: 'fintech', stage: 'growth', location_city: 'San Francisco', location_country: 'United States', employee_count: 8000, is_top_company: 1 },
  { name: 'Canva', website: 'https://canva.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 4000, is_top_company: 1 },
  { name: 'Atlassian', website: 'https://atlassian.com', industry: 'tech', stage: 'public', location_city: 'Sydney', location_country: 'Australia', employee_count: 12000, is_top_company: 1 },
];

const startupCompanies = [
  { name: 'NeuralPath AI', website: 'https://neuralpath.ai', industry: 'tech', stage: 'seed', location_city: 'San Francisco', location_country: 'United States', employee_count: 8, is_top_company: 0 },
  { name: 'BioGenesis Labs', website: 'https://biogenesislabs.com', industry: 'life_science', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 4, is_top_company: 0 },
  { name: 'QuantumSecure', website: 'https://quantumsecure.io', industry: 'tech', stage: 'seed', location_city: 'Singapore', location_country: 'Singapore', employee_count: 12, is_top_company: 0 },
  { name: 'MediTrack Health', website: 'https://meditrack.health', industry: 'life_science', stage: 'series_a', location_city: 'London', location_country: 'United Kingdom', employee_count: 25, is_top_company: 0 },
  { name: 'AgriSense', website: 'https://agrisense.tech', industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 3, is_top_company: 0 },
  { name: 'FinLedger', website: 'https://finledger.com', industry: 'fintech', stage: 'seed', location_city: 'Sydney', location_country: 'Australia', employee_count: 15, is_top_company: 0 },
  { name: 'CellVista Therapeutics', website: null, industry: 'life_science', stage: 'idea', location_city: 'Boston', location_country: 'United States', employee_count: 2, is_top_company: 0 },
  { name: 'CloudMesh', website: 'https://cloudmesh.dev', industry: 'tech', stage: 'seed', location_city: 'Bangalore', location_country: 'India', employee_count: 20, is_top_company: 0 },
];

// Insert companies
const companyIds = {};
for (const c of [...topCompanies, ...startupCompanies]) {
  const existing = queries.findCompanyByName.get(c.name);
  if (existing) {
    companyIds[c.name] = existing.id;
  } else {
    const result = queries.insertCompany.run({
      ...c,
      description: null,
      crunchbase_url: null,
      founded_date: null,
    });
    companyIds[c.name] = result.lastInsertRowid;
  }
}

// ── Alumni ───────────────────────────────────────────────────────────────────

const alumni = [
  // Founders (actively building)
  {
    first_name: 'James', last_name: 'Chen', location_city: 'San Francisco', location_country: 'United States',
    graduation_year: 2012, degree: 'Master of Engineering', faculty: 'Engineering',
    current_company: 'NeuralPath AI', current_title: 'CEO & Co-founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/jameschen',
    companies: [
      { company: 'Google', title: 'Senior ML Engineer', role_level: 'ic', start_date: '2012-06', end_date: '2018-03', is_current: 0 },
      { company: 'NeuralPath AI', title: 'CEO & Co-founder', role_level: 'founder', start_date: '2018-04', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded NeuralPath AI', description: 'Left Google to co-found AI infrastructure startup', source: 'linkedin', detected_at: '2025-11-15' },
      { type: 'hiring_activity', title: 'NeuralPath AI hiring 3 engineers', description: 'Posted ML Engineer, Backend Engineer, and DevOps roles', source: 'linkedin', detected_at: '2026-01-20' },
      { type: 'accelerator', title: 'Accepted into Y Combinator W26', description: 'NeuralPath AI accepted into YC Winter 2026 batch', source: 'news', detected_at: '2026-01-05' },
      { type: 'press_mention', title: 'Featured in TechCrunch', description: 'Article about AI infrastructure startups to watch', source: 'news', detected_at: '2026-02-10' },
    ],
  },
  {
    first_name: 'Priya', last_name: 'Sharma', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2014, degree: 'PhD Biomedical Engineering', faculty: 'Medicine',
    current_company: 'BioGenesis Labs', current_title: 'Founder & CSO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/priyasharma',
    companies: [
      { company: 'BioGenesis Labs', title: 'Founder & CSO', role_level: 'founder', start_date: '2025-06', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded BioGenesis Labs', description: 'Spun out research from UoM Biomedical dept into startup', source: 'manual', detected_at: '2025-06-01' },
      { type: 'incorporation', title: 'BioGenesis Labs Pty Ltd registered', description: 'Registered with ASIC as Australian Pty Ltd', source: 'companies_house', detected_at: '2025-06-10' },
      { type: 'patent_filed', title: 'Patent filed for gene therapy delivery', description: 'AU Patent Application 2025/XXXXX', source: 'manual', detected_at: '2025-09-15' },
      { type: 'product_launch', title: 'Published pre-clinical trial results', description: 'Results published in Nature Biotechnology showing 3x improvement', source: 'news', detected_at: '2026-02-01' },
    ],
  },
  {
    first_name: 'Wei', last_name: 'Zhang', location_city: 'Singapore', location_country: 'Singapore',
    graduation_year: 2013, degree: 'Master of IT', faculty: 'Engineering',
    current_company: 'QuantumSecure', current_title: 'Co-founder & CTO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/weizhang',
    companies: [
      { company: 'Amazon', title: 'Principal Engineer', role_level: 'ic', start_date: '2013-08', end_date: '2024-12', is_current: 0 },
      { company: 'QuantumSecure', title: 'Co-founder & CTO', role_level: 'founder', start_date: '2025-01', is_current: 1 },
    ],
    signals: [
      { type: 'left_employer', title: 'Left Amazon after 11 years', description: 'Departed Principal Engineer role at AWS', source: 'linkedin', detected_at: '2024-12-20' },
      { type: 'company_founded', title: 'Co-founded QuantumSecure', description: 'Post-quantum cryptography startup', source: 'linkedin', detected_at: '2025-01-15' },
      { type: 'hiring_activity', title: 'QuantumSecure hiring cryptography researchers', description: 'Posted 4 research positions', source: 'linkedin', detected_at: '2026-01-10' },
      { type: 'website_launched', title: 'quantumsecure.io launched', description: 'New company website went live', source: 'manual', detected_at: '2025-02-01' },
    ],
  },
  {
    first_name: 'Tom', last_name: 'Anderson', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2016, degree: 'Bachelor of Science', faculty: 'Science',
    current_company: 'AgriSense', current_title: 'Founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/tomanderson',
    companies: [
      { company: 'AgriSense', title: 'Founder', role_level: 'founder', start_date: '2025-09', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded AgriSense', description: 'AgTech startup using satellite imagery and ML for crop monitoring', source: 'linkedin', detected_at: '2025-09-01' },
      { type: 'incorporation', title: 'AgriSense Pty Ltd registered', source: 'companies_house', detected_at: '2025-09-05' },
    ],
  },

  // Leaders (C-Suite/VP at companies that may raise)
  {
    first_name: 'Sarah', last_name: 'Williams', location_city: 'London', location_country: 'United Kingdom',
    graduation_year: 2011, degree: 'PhD Biomedical Science', faculty: 'Medicine',
    current_company: 'MediTrack Health', current_title: 'VP Research & Development', category: 'leader',
    linkedin_url: 'https://linkedin.com/in/sarahwilliams',
    companies: [
      { company: 'MediTrack Health', title: 'VP Research & Development', role_level: 'vp', start_date: '2023-03', is_current: 1 },
    ],
    signals: [
      { type: 'title_change_csuite', title: 'Promoted to VP R&D at MediTrack', description: 'Previously Director of Research', source: 'linkedin', detected_at: '2025-08-01' },
      { type: 'hiring_activity', title: 'MediTrack hiring clinical trial team', description: 'Posting for 5 clinical research roles', source: 'linkedin', detected_at: '2026-01-28' },
      { type: 'funding_round', title: 'MediTrack raised Series A ($12M)', description: 'Led by Sequoia, looking to raise Series B in 2026', source: 'crunchbase', detected_at: '2025-04-01' },
    ],
  },
  {
    first_name: 'Alex', last_name: 'Nguyen', location_city: 'Sydney', location_country: 'Australia',
    graduation_year: 2010, degree: 'Master of Finance', faculty: 'Business',
    current_company: 'FinLedger', current_title: 'CFO', category: 'leader',
    linkedin_url: 'https://linkedin.com/in/alexnguyen',
    companies: [
      { company: 'FinLedger', title: 'CFO', role_level: 'c_suite', start_date: '2024-06', is_current: 1 },
    ],
    signals: [
      { type: 'title_change_csuite', title: 'Joined FinLedger as CFO', description: 'Previously at McKinsey. Joining as CFO signals fundraising prep.', source: 'linkedin', detected_at: '2024-06-15' },
      { type: 'advisor_added', title: 'FinLedger added former CBA exec as advisor', source: 'linkedin', detected_at: '2025-11-01' },
    ],
  },
  {
    first_name: 'Rachel', last_name: 'Kim', location_city: 'Boston', location_country: 'United States',
    graduation_year: 2009, degree: 'PhD Molecular Biology', faculty: 'Science',
    current_company: 'CellVista Therapeutics', current_title: 'CEO & Co-founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/rachelkim',
    companies: [
      { company: 'CellVista Therapeutics', title: 'CEO & Co-founder', role_level: 'founder', start_date: '2025-10', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded CellVista Therapeutics', description: 'Cell therapy startup spun out of MIT collaboration', source: 'linkedin', detected_at: '2025-10-01' },
      { type: 'patent_filed', title: 'Patent filed for CAR-T cell engineering', source: 'manual', detected_at: '2025-11-20' },
    ],
  },

  // Watching (at big tech, potential future founders)
  {
    first_name: 'Michelle', last_name: 'Yu', location_city: 'Singapore', location_country: 'Singapore',
    graduation_year: 2010, degree: 'Bachelor of Commerce', faculty: 'Business',
    current_company: 'Meta', current_title: 'Senior Product Manager', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/michelleyu',
    companies: [
      { company: 'Meta', title: 'Senior Product Manager', role_level: 'ic', start_date: '2023-03', is_current: 1 },
    ],
    signals: [
      { type: 'tenure_milestone', title: 'Approaching 3 years at Meta', description: 'Joined March 2023, approaching vesting cliff', source: 'system', detected_at: '2026-01-01' },
      { type: 'profile_update', title: 'Updated LinkedIn headline', description: 'Added "AI & Product Strategy" to headline', source: 'linkedin', detected_at: '2026-02-05' },
      { type: 'speaking_events', title: 'Speaking at SaaStr APAC', description: 'Panel on "Building AI-first products"', source: 'manual', detected_at: '2026-02-15' },
    ],
  },
  {
    first_name: 'David', last_name: 'Park', location_city: 'Mountain View', location_country: 'United States',
    graduation_year: 2019, degree: 'Master of Computer Science', faculty: 'Engineering',
    current_company: 'Google', current_title: 'Software Engineer L5', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/davidpark',
    companies: [
      { company: 'Google', title: 'Software Engineer L5', role_level: 'ic', start_date: '2019-07', is_current: 1 },
    ],
    signals: [
      { type: 'side_project', title: 'Active GitHub project with 2k stars', description: 'Open source ML framework gaining traction', source: 'github', detected_at: '2026-01-15' },
      { type: 'networking_vcs', title: 'Connected with 3 VC partners on LinkedIn', description: 'Recent connections with Sequoia, a16z, and Accel partners', source: 'linkedin', detected_at: '2026-02-01' },
    ],
  },
  {
    first_name: 'Emma', last_name: 'Thompson', location_city: 'New York', location_country: 'United States',
    graduation_year: 2017, degree: 'MBA', faculty: 'Business',
    current_company: 'Stripe', current_title: 'Head of Enterprise Sales, APAC', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/emmathompson',
    companies: [
      { company: 'Stripe', title: 'Head of Enterprise Sales, APAC', role_level: 'director', start_date: '2022-01', is_current: 1 },
    ],
    signals: [
      { type: 'profile_update', title: 'Updated LinkedIn about section', description: 'Mentions "exploring what\'s next" and "passionate about fintech innovation"', source: 'linkedin', detected_at: '2026-02-10' },
    ],
  },
  {
    first_name: 'Raj', last_name: 'Patel', location_city: 'Bangalore', location_country: 'India',
    graduation_year: 2018, degree: 'Bachelor of Science', faculty: 'Computer Science',
    current_company: 'Microsoft', current_title: 'Senior Software Engineer', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/rajpatel',
    companies: [
      { company: 'Microsoft', title: 'Senior Software Engineer', role_level: 'ic', start_date: '2021-03', is_current: 1 },
    ],
    signals: [
      { type: 'side_project', title: 'CloudMesh open source project', description: 'Building cloud infrastructure tool, 500+ GitHub stars', source: 'github', detected_at: '2025-12-01' },
      { type: 'tenure_milestone', title: 'Approaching 3 years at Microsoft', source: 'system', detected_at: '2026-01-01' },
    ],
  },
  {
    first_name: 'Lina', last_name: 'Okafor', location_city: 'San Francisco', location_country: 'United States',
    graduation_year: 2020, degree: 'Master of Data Science', faculty: 'Engineering',
    current_company: 'Apple', current_title: 'ML Engineer', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/linaokafor',
    companies: [
      { company: 'Apple', title: 'ML Engineer', role_level: 'ic', start_date: '2020-09', is_current: 1 },
    ],
    signals: [],
  },
  {
    first_name: 'Marcus', last_name: 'Brown', location_city: 'Seattle', location_country: 'United States',
    graduation_year: 2015, degree: 'Bachelor of Engineering', faculty: 'Engineering',
    current_company: 'Amazon', current_title: 'Principal PM, AWS', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/marcusbrown',
    companies: [
      { company: 'Amazon', title: 'Principal PM, AWS', role_level: 'ic', start_date: '2022-06', is_current: 1 },
    ],
    signals: [
      { type: 'speaking_events', title: 'Keynote at re:Invent on serverless', source: 'manual', detected_at: '2025-12-05' },
    ],
  },
  {
    first_name: 'Sophie', last_name: 'Laurent', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2016, degree: 'Bachelor of Biomedicine', faculty: 'Medicine',
    current_company: 'CSL', current_title: 'Research Scientist', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/sophielaurent',
    companies: [],
    signals: [
      { type: 'open_to_work', title: 'Open to Work flag detected', description: 'LinkedIn shows open to opportunities in biotech startups', source: 'linkedin', detected_at: '2026-02-12' },
    ],
  },
];

// ── Insert data ──────────────────────────────────────────────────────────────

const insertAll = db.transaction(() => {
  for (const a of alumni) {
    // Insert alumni
    const result = queries.insertAlumni.run({
      first_name: a.first_name,
      last_name: a.last_name,
      email: null,
      linkedin_url: a.linkedin_url || null,
      location_city: a.location_city || null,
      location_country: a.location_country || null,
      graduation_year: a.graduation_year || null,
      degree: a.degree || null,
      faculty: a.faculty || null,
      current_company: a.current_company || null,
      current_title: a.current_title || null,
      category: a.category,
      notes: null,
      tags: null,
    });
    const alumniId = result.lastInsertRowid;

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
        source: s.source || 'manual',
        source_url: s.source_url || null,
        detected_at: s.detected_at || new Date().toISOString(),
      });
    }
  }
});

insertAll();
recalculateAllScores();

console.log('Seed complete!');
console.log(`  Companies: ${topCompanies.length + startupCompanies.length}`);
console.log(`  Alumni: ${alumni.length}`);
console.log(`  Signals: ${alumni.reduce((sum, a) => sum + (a.signals || []).length, 0)}`);

/**
 * Seed the database with sample data focused on University of Melbourne
 * CS/Engineering alumni (2015-2025) for demonstration.
 * Run with: node seed.js
 */
const { db, queries } = require('./db');
const { addSignal, recalculateAllScores } = require('./signals');

console.log('Seeding database...');

// ── Top Companies (Mag7 + AU tech) ──────────────────────────────────────────

const topCompanies = [
  { name: 'Google', website: 'https://google.com', industry: 'tech', stage: 'public', location_city: 'Mountain View', location_country: 'United States', employee_count: 180000, is_top_company: 1 },
  { name: 'Meta', website: 'https://meta.com', industry: 'tech', stage: 'public', location_city: 'Menlo Park', location_country: 'United States', employee_count: 67000, is_top_company: 1 },
  { name: 'Apple', website: 'https://apple.com', industry: 'tech', stage: 'public', location_city: 'Cupertino', location_country: 'United States', employee_count: 164000, is_top_company: 1 },
  { name: 'Amazon', website: 'https://amazon.com', industry: 'tech', stage: 'public', location_city: 'Seattle', location_country: 'United States', employee_count: 1500000, is_top_company: 1 },
  { name: 'Microsoft', website: 'https://microsoft.com', industry: 'tech', stage: 'public', location_city: 'Redmond', location_country: 'United States', employee_count: 221000, is_top_company: 1 },
  { name: 'NVIDIA', website: 'https://nvidia.com', industry: 'tech', stage: 'public', location_city: 'Santa Clara', location_country: 'United States', employee_count: 29600, is_top_company: 1 },
  { name: 'Canva', website: 'https://canva.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 4000, is_top_company: 1 },
  { name: 'Atlassian', website: 'https://atlassian.com', industry: 'tech', stage: 'public', location_city: 'Sydney', location_country: 'Australia', employee_count: 12000, is_top_company: 1 },
  { name: 'Stripe', website: 'https://stripe.com', industry: 'fintech', stage: 'growth', location_city: 'San Francisco', location_country: 'United States', employee_count: 8000, is_top_company: 1 },
  { name: 'REA Group', website: 'https://rea-group.com', industry: 'tech', stage: 'public', location_city: 'Melbourne', location_country: 'Australia', employee_count: 3500, is_top_company: 1 },
];

const startupCompanies = [
  { name: 'Cortex Labs', website: 'https://cortexlabs.ai', industry: 'tech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 6, is_top_company: 0 },
  { name: 'AgriVision AI', website: 'https://agrivision.ai', industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 4, is_top_company: 0 },
  { name: 'SecureMesh', website: 'https://securemesh.io', industry: 'tech', stage: 'seed', location_city: 'Singapore', location_country: 'Singapore', employee_count: 10, is_top_company: 0 },
  { name: 'HealthPipe', website: 'https://healthpipe.com.au', industry: 'tech', stage: 'series_a', location_city: 'Melbourne', location_country: 'Australia', employee_count: 22, is_top_company: 0 },
  { name: 'QuantumBridge', website: 'https://quantumbridge.tech', industry: 'tech', stage: 'seed', location_city: 'Sydney', location_country: 'Australia', employee_count: 8, is_top_company: 0 },
  { name: 'DataForge', website: 'https://dataforge.dev', industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 3, is_top_company: 0 },
  { name: 'CloudNative Systems', website: 'https://cloudnativesys.com', industry: 'tech', stage: 'seed', location_city: 'San Francisco', location_country: 'United States', employee_count: 12, is_top_company: 0 },
  { name: 'FinSight Analytics', website: 'https://finsight.com.au', industry: 'fintech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 9, is_top_company: 0 },
  { name: 'RoboFlow Automation', website: null, industry: 'tech', stage: 'idea', location_city: 'Melbourne', location_country: 'Australia', employee_count: 2, is_top_company: 0 },
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

// ── Alumni (UniMelb CS/Engineering 2015-2025) ───────────────────────────────

const alumni = [
  // ── Founders ──────────────────────────────────────────────────────────────
  {
    first_name: 'Arjun', last_name: 'Mehta', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2018, degree: 'Master of Software Engineering', faculty: 'Computing & Information Systems',
    current_company: 'Cortex Labs', current_title: 'CEO & Co-founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/arjunmehta-ml',
    companies: [
      { company: 'Google', title: 'Software Engineer', role_level: 'ic', start_date: '2018-02', end_date: '2022-06', is_current: 0 },
      { company: 'Cortex Labs', title: 'CEO & Co-founder', role_level: 'founder', start_date: '2022-07', is_current: 1 },
    ],
    signals: [
      { type: 'left_employer', title: 'Left Google after 4 years', description: 'Departed SWE role at Google Melbourne', source: 'linkedin', detected_at: '2022-06-15' },
      { type: 'company_founded', title: 'Founded Cortex Labs', description: 'AI-powered developer tools startup, automating code review with LLMs', source: 'linkedin', detected_at: '2022-07-20' },
      { type: 'accelerator', title: 'Accepted into Startmate S23', description: 'Cortex Labs accepted into Startmate Summer 2023 cohort', source: 'news', detected_at: '2023-01-10' },
      { type: 'funding_round', title: 'Cortex Labs raised $1.5M seed', description: 'Seed round led by Blackbird Ventures', source: 'news', detected_at: '2024-03-01' },
      { type: 'hiring_activity', title: 'Hiring 3 ML engineers', description: 'Posted ML Engineer roles on LinkedIn', source: 'linkedin', detected_at: '2026-01-15' },
    ],
  },
  {
    first_name: 'Emily', last_name: 'Tran', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2019, degree: 'Bachelor of Science (Computer Science)', faculty: 'Computing & Information Systems',
    current_company: 'AgriVision AI', current_title: 'Founder & CTO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/emilytran-cs',
    companies: [
      { company: 'Atlassian', title: 'Software Developer', role_level: 'ic', start_date: '2019-03', end_date: '2023-08', is_current: 0 },
      { company: 'AgriVision AI', title: 'Founder & CTO', role_level: 'founder', start_date: '2023-09', is_current: 1 },
    ],
    signals: [
      { type: 'left_employer', title: 'Left Atlassian after 4.5 years', source: 'linkedin', detected_at: '2023-08-20' },
      { type: 'company_founded', title: 'Founded AgriVision AI', description: 'Computer vision for crop disease detection. Working with Victorian farmers.', source: 'linkedin', detected_at: '2023-09-15' },
      { type: 'incorporation', title: 'AgriVision AI Pty Ltd registered', source: 'companies_house', detected_at: '2023-09-20' },
      { type: 'press_mention', title: 'Featured in SmartCompany', description: 'Article: "Melbourne startup uses AI to save Australian crops"', source: 'news', detected_at: '2025-11-10' },
    ],
  },
  {
    first_name: 'Liang', last_name: 'Chen', location_city: 'Singapore', location_country: 'Singapore',
    graduation_year: 2017, degree: 'Master of Information Technology', faculty: 'Computing & Information Systems',
    current_company: 'SecureMesh', current_title: 'Co-founder & CEO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/liangchen-sec',
    companies: [
      { company: 'Amazon', title: 'Security Engineer', role_level: 'ic', start_date: '2017-07', end_date: '2021-12', is_current: 0 },
      { company: 'SecureMesh', title: 'Co-founder & CEO', role_level: 'founder', start_date: '2022-01', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded SecureMesh', description: 'Zero-trust networking for cloud-native apps', source: 'linkedin', detected_at: '2022-01-20' },
      { type: 'funding_round', title: 'SecureMesh raised $2.8M seed', description: 'Led by Sequoia Southeast Asia', source: 'crunchbase', detected_at: '2023-06-01' },
      { type: 'hiring_activity', title: 'SecureMesh hiring across APAC', description: '5 engineering roles posted', source: 'linkedin', detected_at: '2025-12-10' },
      { type: 'press_mention', title: 'Named in "Top 10 APAC Security Startups"', source: 'news', detected_at: '2026-01-25' },
    ],
  },
  {
    first_name: 'Sophie', last_name: 'Nguyen', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2020, degree: 'Master of Data Science', faculty: 'Computing & Information Systems',
    current_company: 'HealthPipe', current_title: 'Co-founder & CEO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/sophienguyen-ds',
    companies: [
      { company: 'HealthPipe', title: 'Co-founder & CEO', role_level: 'founder', start_date: '2021-03', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded HealthPipe', description: 'Healthcare data interoperability platform. FHIR-based data pipelines for hospitals.', source: 'linkedin', detected_at: '2021-03-10' },
      { type: 'accelerator', title: 'Accepted into ANDHealth+', description: 'Selected for Australia\'s leading healthtech accelerator', source: 'news', detected_at: '2022-02-01' },
      { type: 'funding_round', title: 'HealthPipe raised $4M Series A', description: 'Led by Brandon Capital with participation from CSIRO', source: 'crunchbase', detected_at: '2024-08-15' },
      { type: 'hiring_activity', title: 'HealthPipe hiring product team', description: 'Posted PM and UX Designer roles', source: 'linkedin', detected_at: '2026-02-01' },
    ],
  },
  {
    first_name: 'James', last_name: 'O\'Brien', location_city: 'San Francisco', location_country: 'United States',
    graduation_year: 2016, degree: 'Bachelor of Engineering (Software)', faculty: 'Engineering',
    current_company: 'CloudNative Systems', current_title: 'CEO & Co-founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/jamesobrien-eng',
    companies: [
      { company: 'Stripe', title: 'Senior Backend Engineer', role_level: 'ic', start_date: '2016-09', end_date: '2023-04', is_current: 0 },
      { company: 'CloudNative Systems', title: 'CEO & Co-founder', role_level: 'founder', start_date: '2023-05', is_current: 1 },
    ],
    signals: [
      { type: 'left_employer', title: 'Left Stripe after 7 years', description: 'Departed Senior Backend Engineer role', source: 'linkedin', detected_at: '2023-04-20' },
      { type: 'company_founded', title: 'Founded CloudNative Systems', description: 'Infrastructure-as-code platform for multi-cloud deployments', source: 'linkedin', detected_at: '2023-05-15' },
      { type: 'accelerator', title: 'YC W24 batch', description: 'Accepted into Y Combinator Winter 2024', source: 'news', detected_at: '2024-01-10' },
      { type: 'funding_round', title: 'CloudNative raised $3.5M', description: 'Post-YC seed from a16z and YC', source: 'crunchbase', detected_at: '2024-06-01' },
    ],
  },
  {
    first_name: 'Priya', last_name: 'Patel', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2021, degree: 'Master of Computer Science', faculty: 'Computing & Information Systems',
    current_company: 'DataForge', current_title: 'Founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/priyapatel-cs',
    companies: [
      { company: 'DataForge', title: 'Founder', role_level: 'founder', start_date: '2025-03', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded DataForge', description: 'Real-time data pipeline platform for ML teams. Pre-product, building in public.', source: 'linkedin', detected_at: '2025-03-01' },
      { type: 'incorporation', title: 'DataForge Pty Ltd registered', source: 'companies_house', detected_at: '2025-03-10' },
      { type: 'side_project', title: 'Open-source data connector library', description: 'Published DataForge connectors on GitHub, 300+ stars', source: 'github', detected_at: '2025-11-01' },
    ],
  },
  {
    first_name: 'Tom', last_name: 'Murphy', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2015, degree: 'Bachelor of Engineering (Mechatronics)', faculty: 'Engineering',
    current_company: 'RoboFlow Automation', current_title: 'Founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/tommurphy-mech',
    companies: [
      { company: 'RoboFlow Automation', title: 'Founder', role_level: 'founder', start_date: '2025-11', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded RoboFlow Automation', description: 'Warehouse robotics automation using reinforcement learning. Still stealth.', source: 'linkedin', detected_at: '2025-11-15' },
    ],
  },

  // ── Leaders ───────────────────────────────────────────────────────────────
  {
    first_name: 'Michael', last_name: 'Zhang', location_city: 'Sydney', location_country: 'Australia',
    graduation_year: 2016, degree: 'Master of Information Systems', faculty: 'Computing & Information Systems',
    current_company: 'FinSight Analytics', current_title: 'CTO', category: 'leader',
    linkedin_url: 'https://linkedin.com/in/michaelzhang-is',
    companies: [
      { company: 'FinSight Analytics', title: 'CTO', role_level: 'c_suite', start_date: '2024-01', is_current: 1 },
    ],
    signals: [
      { type: 'title_change_csuite', title: 'Joined FinSight as CTO', description: 'Previously Staff Engineer at Canva. CTO appointment signals engineering investment.', source: 'linkedin', detected_at: '2024-01-15' },
      { type: 'hiring_activity', title: 'FinSight building engineering team', description: 'Posting for 4 senior engineers', source: 'linkedin', detected_at: '2026-01-20' },
    ],
  },
  {
    first_name: 'Aisha', last_name: 'Rahman', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2017, degree: 'Bachelor of Science (Computing)', faculty: 'Computing & Information Systems',
    current_company: 'QuantumBridge', current_title: 'VP Engineering', category: 'leader',
    linkedin_url: 'https://linkedin.com/in/aisharahman-eng',
    companies: [
      { company: 'QuantumBridge', title: 'VP Engineering', role_level: 'vp', start_date: '2023-06', is_current: 1 },
    ],
    signals: [
      { type: 'title_change_csuite', title: 'Promoted to VP Engineering', description: 'Leading quantum computing middleware team', source: 'linkedin', detected_at: '2023-06-01' },
      { type: 'funding_round', title: 'QuantumBridge raised $5M seed', description: 'Led by Main Sequence Ventures', source: 'crunchbase', detected_at: '2024-11-01' },
    ],
  },

  // ── Watching (at big tech, potential future founders) ──────────────────────
  {
    first_name: 'Daniel', last_name: 'Kim', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2020, degree: 'Bachelor of Science (Software Engineering)', faculty: 'Engineering',
    current_company: 'Google', current_title: 'Software Engineer L4', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/danielkim-swe',
    companies: [
      { company: 'Google', title: 'Software Engineer L4', role_level: 'ic', start_date: '2020-02', is_current: 1 },
    ],
    signals: [
      { type: 'side_project', title: 'Active open-source ML project', description: 'Building a lightweight inference framework, 1.2k GitHub stars', source: 'github', detected_at: '2025-12-15' },
      { type: 'networking_vcs', title: 'Connected with 3 Melbourne VC partners', description: 'Recent LinkedIn connections with Square Peg, Blackbird, and Airtree partners', source: 'linkedin', detected_at: '2026-01-20' },
      { type: 'speaking_events', title: 'Speaking at Melbourne AI Meetup', description: 'Talk: "From side project to startup"', source: 'manual', detected_at: '2026-02-10' },
    ],
  },
  {
    first_name: 'Ava', last_name: 'Wilson', location_city: 'San Francisco', location_country: 'United States',
    graduation_year: 2019, degree: 'Master of Computer Science', faculty: 'Computing & Information Systems',
    current_company: 'Meta', current_title: 'Senior ML Engineer', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/avawilson-ml',
    companies: [
      { company: 'Meta', title: 'Senior ML Engineer', role_level: 'ic', start_date: '2019-08', is_current: 1 },
    ],
    signals: [
      { type: 'tenure_milestone', title: 'Approaching 7 years at Meta', description: 'Well past vesting cliffs, senior enough to leave', source: 'system', detected_at: '2026-01-01' },
      { type: 'profile_update', title: 'Updated LinkedIn headline', description: 'Added "Interested in AI x Healthcare"', source: 'linkedin', detected_at: '2026-02-05' },
    ],
  },
  {
    first_name: 'Ryan', last_name: 'Santos', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2021, degree: 'Bachelor of Engineering (Electrical)', faculty: 'Engineering',
    current_company: 'Apple', current_title: 'Hardware Engineer', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/ryansantos-hw',
    companies: [
      { company: 'Apple', title: 'Hardware Engineer', role_level: 'ic', start_date: '2021-07', is_current: 1 },
    ],
    signals: [
      { type: 'patent_filed', title: 'Patent filed for sensor technology', description: 'Co-inventor on Apple patent for novel motion sensing', source: 'manual', detected_at: '2025-09-01' },
      { type: 'side_project', title: 'Building IoT dev kit', description: 'Weekend project building low-power IoT boards, selling on Tindie', source: 'github', detected_at: '2025-12-01' },
    ],
  },
  {
    first_name: 'Mei', last_name: 'Lin', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2022, degree: 'Master of Data Science', faculty: 'Computing & Information Systems',
    current_company: 'REA Group', current_title: 'Data Scientist', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/meilin-ds',
    companies: [
      { company: 'REA Group', title: 'Data Scientist', role_level: 'ic', start_date: '2022-03', is_current: 1 },
    ],
    signals: [
      { type: 'tenure_milestone', title: 'Approaching 4 years at REA Group', source: 'system', detected_at: '2026-01-01' },
    ],
  },
  {
    first_name: 'Hassan', last_name: 'Ali', location_city: 'London', location_country: 'United Kingdom',
    graduation_year: 2018, degree: 'Bachelor of Science (Computer Science)', faculty: 'Computing & Information Systems',
    current_company: 'Amazon', current_title: 'SDE III', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/hassanali-cs',
    companies: [
      { company: 'Amazon', title: 'SDE III', role_level: 'ic', start_date: '2022-01', is_current: 1 },
    ],
    signals: [
      { type: 'open_to_work', title: 'Open to Work flag detected', description: 'LinkedIn shows open to startup opportunities', source: 'linkedin', detected_at: '2026-02-12' },
    ],
  },
  {
    first_name: 'Olivia', last_name: 'Brown', location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2023, degree: 'Bachelor of Science (Computing & Software Systems)', faculty: 'Computing & Information Systems',
    current_company: 'Canva', current_title: 'Frontend Engineer', category: 'watching',
    linkedin_url: 'https://linkedin.com/in/oliviabrown-fe',
    companies: [
      { company: 'Canva', title: 'Frontend Engineer', role_level: 'ic', start_date: '2023-02', is_current: 1 },
    ],
    signals: [
      { type: 'tenure_milestone', title: 'Approaching 3 years at Canva', source: 'system', detected_at: '2026-01-01' },
      { type: 'side_project', title: 'Built a design tool SaaS', description: 'Weekend project - collaborative wireframing tool, 200 beta users', source: 'github', detected_at: '2025-10-20' },
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
      tags: JSON.stringify(['unimelb', a.faculty === 'Engineering' ? 'engineering' : 'cs']),
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
console.log('');
console.log('  Focus: University of Melbourne CS/Engineering alumni (2015-2025)');
console.log(`  Founders: ${alumni.filter(a => a.category === 'founder').length}`);
console.log(`  Leaders: ${alumni.filter(a => a.category === 'leader').length}`);
console.log(`  Watching: ${alumni.filter(a => a.category === 'watching').length}`);

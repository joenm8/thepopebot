/**
 * Populate the database with real University of Melbourne alumni data.
 * Sources: web search, Crunchbase, university announcements, news articles.
 *
 * Run with: node seed-real.js
 */
const { db, queries } = require('./db');
const { addSignal, recalculateAllScores } = require('./signals');

console.log('Populating database with real UniMelb alumni data...\n');

// ── Top Companies ────────────────────────────────────────────────────────────

const topCompanies = [
  { name: 'Google', website: 'https://google.com', industry: 'tech', stage: 'public', location_city: 'Mountain View', location_country: 'United States', employee_count: 180000, is_top_company: 1 },
  { name: 'Meta', website: 'https://meta.com', industry: 'tech', stage: 'public', location_city: 'Menlo Park', location_country: 'United States', employee_count: 67000, is_top_company: 1 },
  { name: 'Apple', website: 'https://apple.com', industry: 'tech', stage: 'public', location_city: 'Cupertino', location_country: 'United States', employee_count: 164000, is_top_company: 1 },
  { name: 'Amazon', website: 'https://amazon.com', industry: 'tech', stage: 'public', location_city: 'Seattle', location_country: 'United States', employee_count: 1500000, is_top_company: 1 },
  { name: 'Microsoft', website: 'https://microsoft.com', industry: 'tech', stage: 'public', location_city: 'Redmond', location_country: 'United States', employee_count: 221000, is_top_company: 1 },
  { name: 'Canva', website: 'https://canva.com', industry: 'tech', stage: 'growth', location_city: 'Sydney', location_country: 'Australia', employee_count: 4000, is_top_company: 1 },
  { name: 'Atlassian', website: 'https://atlassian.com', industry: 'tech', stage: 'public', location_city: 'Sydney', location_country: 'Australia', employee_count: 12000, is_top_company: 1 },
  { name: 'NAB', website: 'https://nab.com.au', industry: 'fintech', stage: 'public', location_city: 'Melbourne', location_country: 'Australia', employee_count: 36000, is_top_company: 1 },
  { name: 'ANZ', website: 'https://anz.com.au', industry: 'fintech', stage: 'public', location_city: 'Melbourne', location_country: 'Australia', employee_count: 40000, is_top_company: 1 },
];

const startupCompanies = [
  { name: 'Airwallex', website: 'https://airwallex.com', industry: 'fintech', stage: 'growth', location_city: 'Singapore', location_country: 'Singapore', employee_count: 1500, is_top_company: 0, description: 'Global payments and financial infrastructure platform. Valued at US$8B.' },
  { name: 'Phonely', website: 'https://phonely.ai', industry: 'tech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 12, is_top_company: 0, description: 'AI-powered virtual receptionist. YC S24. First UniMelb founders in Y Combinator.' },
  { name: 'Stelect', website: 'https://stelect.com', industry: 'life_science', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 8, is_top_company: 0, description: 'Medical device startup improving cardiac stent selection using ultrasound sensors on catheter balloons.' },
  { name: 'Navi Medical Technologies', website: 'https://navitechnologies.com', industry: 'life_science', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 15, is_top_company: 0, description: 'Medical device helping doctors insert central venous catheters into newborns in intensive care.' },
  { name: 'Aubot', website: 'https://aubot.com', industry: 'tech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 10, is_top_company: 0, description: 'Telepresence robots for kids with cancer, people with disabilities, and elderly care.' },
  { name: 'Aipoly', website: null, industry: 'tech', stage: 'seed', location_city: 'San Francisco', location_country: 'United States', employee_count: 5, is_top_company: 0, description: 'AI accessibility app for blind/visually impaired users. 500K+ downloads, 23 languages.' },
  { name: 'CliniScribe AI', website: 'https://cliniscribe.ai', industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 5, is_top_company: 0, description: 'AI tools to simplify clinical paperwork and streamline healthcare workflows. MAP25 backed.' },
  { name: 'Tiny Bright Things', website: 'https://tinybrightthings.com', industry: 'tech', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 10, is_top_company: 0, description: 'Disruptive imaging technology — real-time, non-destructive imaging for biotech, pharma, and materials science.' },
  { name: 'Robogals', website: 'https://robogals.org', industry: 'other', stage: 'growth', location_city: 'Melbourne', location_country: 'Australia', employee_count: 20, is_top_company: 0, description: 'Global STEM initiative teaching 120,000+ girls robotics across 32 chapters in 11 countries.' },
  { name: 'Kali Healthcare', website: null, industry: 'life_science', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 5, is_top_company: 0, description: 'Healthcare startup backed by UniMelb Genesis Pre-Seed Fund.' },
  { name: 'Carbon Cybernetics', website: null, industry: 'life_science', stage: 'seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 8, is_top_company: 0, description: 'Brain-computer interface technology for neurological and psychiatric disorders. UniMelb spin-out.' },
  { name: 'Doodel', website: null, industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 3, is_top_company: 0, description: 'Tech startup founded by UniMelb CS graduate.' },
  { name: 'Phoebe Solutions', website: null, industry: 'tech', stage: 'pre_seed', location_city: 'Melbourne', location_country: 'Australia', employee_count: 3, is_top_company: 0, description: 'Startup co-founded by UniMelb CS alumni.' },
];

// Insert companies
const companyIds = {};
for (const c of [...topCompanies, ...startupCompanies]) {
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

// ── Real Alumni ──────────────────────────────────────────────────────────────

const alumni = [
  // ── Founders ──────────────────────────────────────────────────────────────
  {
    first_name: 'Jack', last_name: 'Zhang',
    location_city: 'Singapore', location_country: 'Singapore',
    graduation_year: 2007, degree: 'Bachelor of Engineering (Computer Science)', faculty: 'Engineering',
    current_company: 'Airwallex', current_title: 'Co-founder & CEO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/jack-zhang-05200222',
    notes: 'Built Airwallex from a Melbourne coffee shop payment pain point into an $8B fintech. Three of four co-founders are also UniMelb alumni. Awarded UniMelb Kernot Memorial Medal 2021.',
    companies: [
      { company: 'NAB', title: 'Technical Lead', role_level: 'ic', start_date: '2008-01', end_date: '2014-12', is_current: 0 },
      { company: 'ANZ', title: 'Technical Lead', role_level: 'ic', start_date: '2015-01', end_date: '2015-06', is_current: 0 },
      { company: 'Airwallex', title: 'Co-founder & CEO', role_level: 'founder', start_date: '2015-06', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Airwallex', description: 'Global payments platform born from cross-border payment frustrations running a Melbourne coffee shop', source: 'crunchbase', detected_at: '2015-06-01' },
      { type: 'funding_round', title: 'Airwallex raised $300M Series F', description: 'Valuation reached US$6.2B. Led by major global investors.', source: 'crunchbase', detected_at: '2025-05-01' },
      { type: 'funding_round', title: 'Airwallex Series G — $8B valuation', description: 'Company now valued at US$8B. $1.2B total funding raised. Processing $100B+ annually.', source: 'news', detected_at: '2025-11-01' },
      { type: 'press_mention', title: 'CNBC feature on Jack Zhang', description: 'Profile: "From Blue-Collar Worker to $8 Billion Fintech Founder"', source: 'news', source_url: 'https://www.cnbc.com/2026/01/19/jack-zhang-helped-build-a-8-billion-fintech-startup-called-airwallex.html', detected_at: '2026-01-19' },
      { type: 'hiring_activity', title: 'Airwallex hiring across 19+ offices globally', description: 'Major engineering hiring push across Singapore, San Francisco, Melbourne, London', source: 'linkedin', detected_at: '2026-01-15' },
    ],
  },
  {
    first_name: 'Cameron', last_name: 'Adams',
    location_city: 'Sydney', location_country: 'Australia',
    graduation_year: 2002, degree: 'Bachelor of Law / Bachelor of Science (Computer Science)', faculty: 'Computing & Information Systems',
    current_company: 'Canva', current_title: 'Co-founder & CPO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/themaninblue',
    notes: 'Technical co-founder of Canva. Former Google engineer (Google Wave). Net worth ~$2.9B. Forbes #1265 richest people globally. Known as "The Man in Blue" web technologist.',
    companies: [
      { company: 'Google', title: 'Software Engineer', role_level: 'ic', start_date: '2007-01', end_date: '2012-05', is_current: 0 },
      { company: 'Canva', title: 'Co-founder & CPO', role_level: 'founder', start_date: '2012-06', is_current: 1 },
    ],
    signals: [
      { type: 'left_employer', title: 'Left Google to join Canva', description: 'Departed Google (worked on Google Wave) to become Canva technical co-founder', source: 'linkedin', detected_at: '2012-06-01' },
      { type: 'company_founded', title: 'Co-founded Canva', description: 'Joined Melanie Perkins and Cliff Obrecht as third co-founder and CPO', source: 'crunchbase', detected_at: '2012-06-01' },
      { type: 'press_mention', title: 'Forbes billionaire list', description: 'Net worth ~$2.9B. Ranked #1265 in Forbes world richest list, top 20 in Australia.', source: 'news', detected_at: '2025-05-01' },
    ],
  },
  {
    first_name: 'Will', last_name: 'Bodewes',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2024, degree: 'PhD (Applied AI)', faculty: 'Engineering',
    current_company: 'Phonely', current_title: 'Co-founder & CEO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/willbodewes',
    notes: 'First-ever UniMelb founder accepted into Y Combinator (S24). PhD researcher in Prof Saman Halgamuge\'s AI lab. Also previously founded an audio-tech startup with celebrity engagement from Chance the Rapper. Former NCAA XC skier and top ultra-endurance cyclist.',
    companies: [
      { company: 'Phonely', title: 'Co-founder & CEO', role_level: 'founder', start_date: '2024-01', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Phonely', description: 'AI-powered virtual receptionist that can handle 1M+ calls simultaneously. Born from father\'s vet clinic staffing challenges.', source: 'linkedin', detected_at: '2024-01-15' },
      { type: 'accelerator', title: 'Accepted into Y Combinator S24', description: 'First-ever UniMelb founders in YC. One of the most viewed/shared launches in YC history within 3 days.', source: 'news', source_url: 'https://www.businessnewsaustralia.com/articles/melbourne-ai-receptionist-startup-phonely-receives-y-combinator-funding-with-record-breaking-launch.html', detected_at: '2024-05-01' },
      { type: 'funding_round', title: 'Phonely raised US$500K from YC', description: 'Y Combinator investment. First UniMelb founders in the program.', source: 'crunchbase', detected_at: '2024-05-01' },
      { type: 'funding_round', title: 'Phonely raised US$2.2M post-YC', description: 'Raised additional $2.2M ($3.4M AUD). Grew to 12 staff.', source: 'news', source_url: 'https://www.startupdaily.net/topic/funding/y-combinator-backs-ai-based-virtual-receptionist-startup-phonely-with-750000/', detected_at: '2025-03-01' },
      { type: 'press_mention', title: 'Phonely partners with TSA Group', description: 'Perth-based contact centre consulting group TSA reportedly saving 12,000 hours/year using Phonely.', source: 'news', source_url: 'https://www.businessnewsaustralia.com/articles/melbourne-founded-voice-ai-startup-phonely-removes-annoying-pauses--sees-revenue-dial-up.html', detected_at: '2025-09-01' },
      { type: 'hiring_activity', title: 'Phonely scaling team', description: 'Growing from founding team to 12 employees across Melbourne and US', source: 'linkedin', detected_at: '2025-12-01' },
    ],
  },
  {
    first_name: 'Nisal', last_name: 'Ranasinghe',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2024, degree: 'PhD (Explainable AI & AI for Healthcare)', faculty: 'Engineering',
    current_company: 'Phonely', current_title: 'Co-founder & CTO', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/nisalr',
    notes: 'Co-founded Phonely with Will Bodewes. Background in Electronic and Telecommunications Engineering. Previously senior engineer on AI team at a major telco. PhD focused on explainable AI and AI for healthcare.',
    companies: [
      { company: 'Phonely', title: 'Co-founder & CTO', role_level: 'founder', start_date: '2024-01', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Phonely', description: 'Built custom low-latency speech-to-text system. Reduced transcription latency well below the 300-700ms industry standard.', source: 'linkedin', detected_at: '2024-01-15' },
      { type: 'accelerator', title: 'Y Combinator S24 — first UniMelb founders', description: 'Accepted into YC alongside Will Bodewes. Interviewed at 3am, hours after winning Startup Victoria AI pitch event.', source: 'news', detected_at: '2024-05-01' },
    ],
  },
  {
    first_name: 'Elise', last_name: 'Sutherland',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2017, degree: 'Master of Engineering (Biomedical Engineering with Business)', faculty: 'Engineering',
    current_company: 'Stelect', current_title: 'Founder & CEO', category: 'founder',
    linkedin_url: null,
    notes: 'Founded Stelect from UniMelb BioDesign Innovation course. Forbes 30 Under 30 Asia 2020. Luminary Tech Visionary Award 2022. Patented 64-sensor catheter technology (1mm diameter). Also Honorary Research Fellow at UniMelb School of Biomedical Engineering.',
    companies: [
      { company: 'Stelect', title: 'Founder & CEO', role_level: 'founder', start_date: '2017-06', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded Stelect', description: 'Born from UniMelb BioDesign course after observing coronary stenting procedure. 64 ultrasound sensors on 1mm catheter for accurate stent selection.', source: 'linkedin', detected_at: '2017-06-01' },
      { type: 'accelerator', title: 'Accepted into MedTech Actuator', description: 'Asia-Pacific MedTech accelerator with support from VC firm Artesian', source: 'news', detected_at: '2018-06-01' },
      { type: 'patent_filed', title: 'Patent for catheter sensor technology', description: 'Patented ultrasound imaging sensors on balloon catheter for real-time artery imaging', source: 'manual', detected_at: '2018-09-01' },
      { type: 'press_mention', title: 'Forbes 30 Under 30 Asia 2020', description: 'Named to Forbes 30 Under 30 Asia list for healthcare innovation', source: 'news', detected_at: '2020-04-01' },
      { type: 'funding_round', title: 'Stelect raised close to $1M', description: 'Funding for medical device development via grants and VC', source: 'crunchbase', detected_at: '2020-06-01' },
      { type: 'press_mention', title: 'Luminary Tech Visionary Award 2022', description: 'Recognized for harnessing technology to lead the way with groundbreaking ideas', source: 'news', detected_at: '2022-11-01' },
    ],
  },
  {
    first_name: 'Shing Yue', last_name: 'Sheung',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2017, degree: 'Master of Biomedical Engineering', faculty: 'Engineering',
    current_company: 'Navi Medical Technologies', current_title: 'COO & Co-founder', category: 'founder',
    linkedin_url: 'https://au.linkedin.com/in/shingyuesheung',
    notes: 'Co-founded Navi Medical Technologies from UniMelb BioDesign course. Forbes 30 Under 30 Asia. FDA Breakthrough Device designation. Over $8M in total funding. Top 5% of UniMelb Engineering Master\'s.',
    companies: [
      { company: 'Navi Medical Technologies', title: 'COO & Co-founder', role_level: 'founder', start_date: '2016-06', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Navi Medical Technologies', description: 'Real-time catheter tip location tracking for critically-ill newborns. Born from UniMelb BioDesign Innovation course.', source: 'linkedin', detected_at: '2016-06-01' },
      { type: 'press_mention', title: 'Forbes 30 Under 30 Asia', description: 'Listed within two years of Navi launch for entrepreneurial innovation', source: 'news', detected_at: '2018-04-01' },
      { type: 'patent_filed', title: 'Neonav device patent', description: 'Medical device for tracking catheter tip location in newborns without X-ray', source: 'manual', detected_at: '2019-01-01' },
      { type: 'funding_round', title: 'Navi received $8M+ total funding', description: 'Investment plus grants including $2.3M NHMRC grant as part of $6.28M project with UniMelb and Royal Women\'s Hospital', source: 'crunchbase', detected_at: '2023-06-01' },
      { type: 'press_mention', title: 'FDA Breakthrough Device designation', description: 'US FDA designated Neonav as a Breakthrough innovation', source: 'news', detected_at: '2022-01-01' },
    ],
  },
  {
    first_name: 'Marita', last_name: 'Cheng',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2012, degree: 'Bachelor of Engineering (Mechatronics) / Bachelor of Computer Science', faculty: 'Engineering',
    current_company: 'Aubot', current_title: 'Founder & CEO', category: 'founder',
    linkedin_url: null,
    notes: '2012 Young Australian of the Year. Founded Robogals (120K+ girls taught robotics in 11 countries). Founded Aubot (telepresence robots). Co-founded Aipoly at Singularity University/NASA Ames (500K+ downloads). Forbes 30 Under 30 2016. Forbes Top 50 Women In Tech 2018. Member of Order of Australia (AM) — youngest ever. Google $40K scholarship. Met Prince Harry via Teleport robot.',
    companies: [
      { company: 'Robogals', title: 'Founder & Executive Director', role_level: 'founder', start_date: '2008-01', end_date: '2014-12', is_current: 0 },
      { company: 'Aubot', title: 'Founder & CEO', role_level: 'founder', start_date: '2013-04', is_current: 1 },
      { company: 'Aipoly', title: 'Co-founder', role_level: 'founder', start_date: '2015-07', end_date: '2018-12', is_current: 0 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded Robogals', description: 'Global STEM initiative — 120K+ girls taught robotics across 32 chapters in 11 countries', source: 'news', detected_at: '2008-01-01' },
      { type: 'company_founded', title: 'Founded Aubot', description: 'Telepresence robots for kids with cancer in hospital, people with disabilities, and elderly care. MAP accelerator initial grant.', source: 'news', detected_at: '2013-04-01' },
      { type: 'press_mention', title: '2012 Young Australian of the Year', description: 'National recognition for founding Robogals and STEM advocacy', source: 'news', detected_at: '2012-01-26' },
      { type: 'company_founded', title: 'Co-founded Aipoly at NASA/Singularity University', description: 'AI app for blind/visually impaired. Launched at CES 2016. 500K+ downloads, 23 languages. Google $40K scholarship.', source: 'news', detected_at: '2015-07-01' },
      { type: 'press_mention', title: 'Forbes 30 Under 30 (2016) & Top 50 Women In Tech (2018)', description: 'Serial recognition by Forbes for tech innovation', source: 'news', detected_at: '2018-01-01' },
      { type: 'press_mention', title: 'Youngest Member of Order of Australia (AM)', description: 'Inducted as youngest-ever AM in 2019 for services to STEM education and technology', source: 'news', detected_at: '2019-01-26' },
    ],
  },
  {
    first_name: 'Richard', last_name: 'Phoon',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2023, degree: 'Bachelor of Science (Computer Science)', faculty: 'Computing & Information Systems',
    current_company: 'Doodel', current_title: 'Founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/richard-phoon-83714b171',
    notes: 'Recent UniMelb CS graduate building Doodel.',
    companies: [
      { company: 'Doodel', title: 'Founder', role_level: 'founder', start_date: '2023-01', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Founded Doodel', description: 'Tech startup by recent UniMelb Computer Science graduate', source: 'linkedin', detected_at: '2023-01-01' },
    ],
  },
  {
    first_name: 'Dong', last_name: 'Li',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: 2023, degree: 'Computer Science', faculty: 'Computing & Information Systems',
    current_company: 'Phoebe Solutions', current_title: 'Co-founder', category: 'founder',
    linkedin_url: 'https://linkedin.com/in/dong-chi-li',
    notes: 'UniMelb CS graduate co-founding Phoebe Solutions with Linus Talacko. Mission: "make work better for everyone".',
    companies: [
      { company: 'Phoebe Solutions', title: 'Co-founder', role_level: 'founder', start_date: '2023-06', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Phoebe Solutions', description: 'Starting a company with co-founder Linus Talacko to "make work better for everyone"', source: 'linkedin', detected_at: '2023-06-01' },
    ],
  },

  // ── Leaders ────────────────────────────────────────────────────────────────
  {
    first_name: 'Raymond', last_name: 'Dagastine',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: null, degree: null, faculty: 'Engineering',
    current_company: 'Tiny Bright Things', current_title: 'Co-founder & CTO', category: 'leader',
    linkedin_url: null,
    notes: 'Professor and Co-founder/CTO of Tiny Bright Things (UniMelb spin-out). HaloElement imaging technology for biotech, pharma, and materials science. 2025 Engineering Honour Roll. Major mentor in UniMelb entrepreneurship ecosystem.',
    companies: [
      { company: 'Tiny Bright Things', title: 'Co-founder & CTO', role_level: 'founder', start_date: '2020-01', is_current: 1 },
    ],
    signals: [
      { type: 'company_founded', title: 'Co-founded Tiny Bright Things', description: 'UniMelb spin-out delivering disruptive HaloElement imaging — real-time, non-destructive imaging of materials and cells', source: 'news', detected_at: '2020-01-01' },
      { type: 'press_mention', title: '2025 Engineering Honour Roll', description: 'Recognized as key leader in UniMelb entrepreneurship ecosystem and mentor to researchers', source: 'news', source_url: 'https://eng.unimelb.edu.au/about/feit-excellence-awards/honour-roll/2025-honour-roll', detected_at: '2025-06-01' },
      { type: 'product_launch', title: 'HaloElement in use by researchers', description: 'Technology now in use by researchers publishing results, demonstrating scientific and commercial impact', source: 'news', detected_at: '2025-09-01' },
    ],
  },

  // ── Watching (at big tech or early-stage signals) ──────────────────────────
  {
    first_name: 'Tung Khanh', last_name: 'Ho',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: null, degree: null, faculty: 'Computing & Information Systems',
    current_company: 'RecordPoint', current_title: null, category: 'watching',
    linkedin_url: 'https://linkedin.com/in/tung-khanh-ho',
    notes: 'UniMelb educated. Currently at RecordPoint in Melbourne. 500+ LinkedIn connections.',
    companies: [],
    signals: [],
  },
  {
    first_name: 'Luan', last_name: 'Pham',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: null, degree: null, faculty: 'Computing & Information Systems',
    current_company: 'NOFire AI', current_title: null, category: 'watching',
    linkedin_url: 'https://linkedin.com/in/phamquiluan',
    notes: 'UniMelb alumni. Working on NOFire AI — appears to be building AI for fire prevention/detection.',
    companies: [],
    signals: [],
  },
  {
    first_name: 'Adam', last_name: 'Poulton',
    location_city: 'Melbourne', location_country: 'Australia',
    graduation_year: null, degree: null, faculty: 'Computing & Information Systems',
    current_company: 'Seventh Beam', current_title: null, category: 'watching',
    linkedin_url: 'https://linkedin.com/in/adam-poulton-4183b4154',
    notes: 'UniMelb educated. Associated with Seventh Beam.',
    companies: [],
    signals: [],
  },
];

// ── Insert data ──────────────────────────────────────────────────────────────

const insertAll = db.transaction(() => {
  for (const a of alumni) {
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
      notes: a.notes || null,
      tags: JSON.stringify(['unimelb', 'discovered', a.faculty === 'Engineering' ? 'engineering' : 'cs']),
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

// ── Summary ──────────────────────────────────────────────────────────────────

const founders = alumni.filter(a => a.category === 'founder');
const leaders = alumni.filter(a => a.category === 'leader');
const watching = alumni.filter(a => a.category === 'watching');
const totalSignals = alumni.reduce((sum, a) => sum + (a.signals || []).length, 0);

console.log('Population complete!');
console.log(`  Companies: ${topCompanies.length + startupCompanies.length}`);
console.log(`  Alumni: ${alumni.length}`);
console.log(`  Signals: ${totalSignals}`);
console.log('');
console.log(`  Founders: ${founders.length}`);
founders.forEach(f => console.log(`    - ${f.first_name} ${f.last_name} (${f.current_company})`));
console.log(`  Leaders: ${leaders.length}`);
leaders.forEach(l => console.log(`    - ${l.first_name} ${l.last_name} (${l.current_company})`));
console.log(`  Watching: ${watching.length}`);
watching.forEach(w => console.log(`    - ${w.first_name} ${w.last_name} (${w.current_company || 'unknown'})`));
console.log('');
console.log('Sources: web search, Crunchbase, UniMelb news, Forbes, CNBC, Business News Australia');

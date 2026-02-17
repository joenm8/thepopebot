const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'dashboard.sqlite');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS alumni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    linkedin_url TEXT,
    location_city TEXT,
    location_country TEXT,
    graduation_year INTEGER,
    degree TEXT,
    faculty TEXT,
    current_company TEXT,
    current_title TEXT,
    category TEXT NOT NULL DEFAULT 'watching',  -- 'founder', 'leader', 'watching'
    fundraising_score REAL DEFAULT 0,
    fundraising_level TEXT DEFAULT 'none',       -- 'high', 'medium', 'low', 'none'
    notes TEXT,
    tags TEXT,                                   -- JSON array of tags
    starred INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    website TEXT,
    industry TEXT,                               -- 'tech', 'life_science', 'fintech', 'other'
    stage TEXT,                                   -- 'idea', 'pre_seed', 'seed', 'series_a', 'series_b', 'growth', 'public'
    founded_date TEXT,
    location_city TEXT,
    location_country TEXT,
    employee_count INTEGER,
    description TEXT,
    crunchbase_url TEXT,
    is_top_company INTEGER DEFAULT 0,            -- for watchlist: FAANG/Mag7/top-tier
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS alumni_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumni_id INTEGER NOT NULL,
    company_id INTEGER NOT NULL,
    title TEXT,
    role_level TEXT,                              -- 'founder', 'c_suite', 'vp', 'director', 'manager', 'ic'
    start_date TEXT,
    end_date TEXT,                                -- NULL = current
    is_current INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumni_id INTEGER NOT NULL,
    company_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    source TEXT,                                  -- 'linkedin', 'news', 'manual', 'crunchbase', 'github', 'companies_house'
    source_url TEXT,
    weight REAL DEFAULT 1.0,
    detected_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,                              -- signal relevance decay
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,                        -- JSON array of digest items
    alumni_count INTEGER DEFAULT 0,
    signal_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signal_types (
    type TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT,
    default_weight REAL DEFAULT 1.0,
    category TEXT NOT NULL,                       -- 'fundraising', 'watching', 'general'
    icon TEXT
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_alumni_category ON alumni(category);
  CREATE INDEX IF NOT EXISTS idx_alumni_fundraising ON alumni(fundraising_level);
  CREATE INDEX IF NOT EXISTS idx_alumni_country ON alumni(location_country);
  CREATE INDEX IF NOT EXISTS idx_signals_alumni ON signals(alumni_id);
  CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
  CREATE INDEX IF NOT EXISTS idx_signals_detected ON signals(detected_at);
  CREATE INDEX IF NOT EXISTS idx_alumni_companies_alumni ON alumni_companies(alumni_id);
  CREATE INDEX IF NOT EXISTS idx_alumni_companies_company ON alumni_companies(company_id);
  CREATE INDEX IF NOT EXISTS idx_alumni_companies_current ON alumni_companies(is_current);
`);

// ── Seed signal types ───────────────────────────────────────────────────────

const signalTypes = [
  // Fundraising signals
  { type: 'company_founded', label: 'Company Founded', description: 'Alumni started a new company', default_weight: 5.0, category: 'fundraising', icon: '🏢' },
  { type: 'title_change_founder', label: 'Became Founder/CEO', description: 'Title changed to Founder, CEO, or Co-founder', default_weight: 5.0, category: 'fundraising', icon: '👔' },
  { type: 'title_change_csuite', label: 'C-Suite Appointment', description: 'Appointed to C-Suite or VP role', default_weight: 3.0, category: 'fundraising', icon: '📈' },
  { type: 'left_employer', label: 'Left Employer', description: 'Left a major company (potential founder signal)', default_weight: 3.0, category: 'fundraising', icon: '🚪' },
  { type: 'hiring_activity', label: 'Hiring Activity', description: 'Company posting new job openings', default_weight: 2.0, category: 'fundraising', icon: '📋' },
  { type: 'website_launched', label: 'Website Launched', description: 'New company website detected', default_weight: 2.0, category: 'fundraising', icon: '🌐' },
  { type: 'incorporation', label: 'Company Incorporated', description: 'New company entity registered', default_weight: 4.0, category: 'fundraising', icon: '📄' },
  { type: 'accelerator', label: 'Accelerator Program', description: 'Joined an accelerator or incubator', default_weight: 4.0, category: 'fundraising', icon: '🚀' },
  { type: 'press_mention', label: 'Press Mention', description: 'Featured in media or news', default_weight: 2.0, category: 'fundraising', icon: '📰' },
  { type: 'funding_round', label: 'Funding Round', description: 'Announced a funding round', default_weight: 5.0, category: 'fundraising', icon: '💰' },
  { type: 'advisor_added', label: 'Advisor Added', description: 'Added a notable advisor or board member', default_weight: 2.0, category: 'fundraising', icon: '🤝' },
  { type: 'patent_filed', label: 'Patent Filed', description: 'Filed a patent application', default_weight: 2.0, category: 'fundraising', icon: '📜' },
  { type: 'product_launch', label: 'Product Launch', description: 'Launched or announced a product', default_weight: 3.0, category: 'fundraising', icon: '🎯' },

  // Watching signals (alumni at big tech)
  { type: 'tenure_milestone', label: 'Tenure Milestone', description: 'Approaching 2-3 year vesting cliff at top company', default_weight: 2.0, category: 'watching', icon: '⏰' },
  { type: 'profile_update', label: 'Profile Update', description: 'LinkedIn profile recently updated', default_weight: 1.0, category: 'watching', icon: '✏️' },
  { type: 'side_project', label: 'Side Project', description: 'Active on GitHub or personal projects', default_weight: 2.0, category: 'watching', icon: '💻' },
  { type: 'open_to_work', label: 'Open to Work', description: 'LinkedIn "Open to Work" flag detected', default_weight: 4.0, category: 'watching', icon: '🟢' },
  { type: 'left_top_company', label: 'Left Top Company', description: 'Left a FAANG/Mag7/top-tier company', default_weight: 5.0, category: 'watching', icon: '🔔' },
  { type: 'networking_vcs', label: 'Networking with VCs', description: 'Connecting with VC/startup community', default_weight: 3.0, category: 'watching', icon: '🔗' },
  { type: 'speaking_events', label: 'Speaking at Events', description: 'Speaking at startup or industry events', default_weight: 1.5, category: 'watching', icon: '🎤' },

  // General
  { type: 'manual_note', label: 'Manual Note', description: 'Manually added note or observation', default_weight: 0, category: 'general', icon: '📝' },
];

const insertSignalType = db.prepare(`
  INSERT OR IGNORE INTO signal_types (type, label, description, default_weight, category, icon)
  VALUES (@type, @label, @description, @default_weight, @category, @icon)
`);

for (const st of signalTypes) {
  insertSignalType.run(st);
}

// ── Query helpers ───────────────────────────────────────────────────────────

const queries = {
  // Alumni
  getAllAlumni: db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM signals s WHERE s.alumni_id = a.id AND s.detected_at > datetime('now', '-30 days')) as recent_signals
    FROM alumni a
    WHERE a.archived = 0
    ORDER BY a.fundraising_score DESC
  `),

  getAlumniByCategory: db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM signals s WHERE s.alumni_id = a.id AND s.detected_at > datetime('now', '-30 days')) as recent_signals
    FROM alumni a
    WHERE a.category = ? AND a.archived = 0
    ORDER BY a.fundraising_score DESC
  `),

  getAlumniById: db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM signals s WHERE s.alumni_id = a.id AND s.detected_at > datetime('now', '-30 days')) as recent_signals
    FROM alumni a
    WHERE a.id = ?
  `),

  searchAlumni: db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM signals s WHERE s.alumni_id = a.id AND s.detected_at > datetime('now', '-30 days')) as recent_signals
    FROM alumni a
    WHERE a.archived = 0
      AND (a.first_name || ' ' || a.last_name LIKE '%' || ?1 || '%'
        OR a.current_company LIKE '%' || ?1 || '%'
        OR a.location_city LIKE '%' || ?1 || '%'
        OR a.location_country LIKE '%' || ?1 || '%')
    ORDER BY a.fundraising_score DESC
  `),

  insertAlumni: db.prepare(`
    INSERT INTO alumni (first_name, last_name, email, linkedin_url, location_city, location_country,
      graduation_year, degree, faculty, current_company, current_title, category, notes, tags)
    VALUES (@first_name, @last_name, @email, @linkedin_url, @location_city, @location_country,
      @graduation_year, @degree, @faculty, @current_company, @current_title, @category, @notes, @tags)
  `),

  updateAlumni: db.prepare(`
    UPDATE alumni SET
      first_name = @first_name, last_name = @last_name, email = @email, linkedin_url = @linkedin_url,
      location_city = @location_city, location_country = @location_country,
      graduation_year = @graduation_year, degree = @degree, faculty = @faculty,
      current_company = @current_company, current_title = @current_title,
      category = @category, notes = @notes, tags = @tags,
      updated_at = datetime('now')
    WHERE id = @id
  `),

  updateAlumniScore: db.prepare(`
    UPDATE alumni SET fundraising_score = ?, fundraising_level = ?, updated_at = datetime('now') WHERE id = ?
  `),

  toggleStarAlumni: db.prepare(`UPDATE alumni SET starred = NOT starred, updated_at = datetime('now') WHERE id = ?`),
  archiveAlumni: db.prepare(`UPDATE alumni SET archived = 1, updated_at = datetime('now') WHERE id = ?`),
  deleteAlumni: db.prepare(`DELETE FROM alumni WHERE id = ?`),

  // Companies
  getAllCompanies: db.prepare(`SELECT * FROM companies ORDER BY name`),
  getCompanyById: db.prepare(`SELECT * FROM companies WHERE id = ?`),
  getTopCompanies: db.prepare(`SELECT * FROM companies WHERE is_top_company = 1 ORDER BY name`),

  insertCompany: db.prepare(`
    INSERT INTO companies (name, website, industry, stage, founded_date, location_city, location_country,
      employee_count, description, crunchbase_url, is_top_company)
    VALUES (@name, @website, @industry, @stage, @founded_date, @location_city, @location_country,
      @employee_count, @description, @crunchbase_url, @is_top_company)
  `),

  findCompanyByName: db.prepare(`SELECT * FROM companies WHERE LOWER(name) = LOWER(?)`),

  // Alumni-Company relationships
  getAlumniCompanies: db.prepare(`
    SELECT ac.*, c.name as company_name, c.industry, c.is_top_company
    FROM alumni_companies ac
    JOIN companies c ON ac.company_id = c.id
    WHERE ac.alumni_id = ?
    ORDER BY ac.is_current DESC, ac.start_date DESC
  `),

  insertAlumniCompany: db.prepare(`
    INSERT INTO alumni_companies (alumni_id, company_id, title, role_level, start_date, end_date, is_current)
    VALUES (@alumni_id, @company_id, @title, @role_level, @start_date, @end_date, @is_current)
  `),

  // Signals
  getSignalsByAlumni: db.prepare(`
    SELECT s.*, st.label as type_label, st.icon, st.category as signal_category
    FROM signals s
    JOIN signal_types st ON s.type = st.type
    WHERE s.alumni_id = ?
    ORDER BY s.detected_at DESC
  `),

  getRecentSignals: db.prepare(`
    SELECT s.*, st.label as type_label, st.icon, st.category as signal_category,
      a.first_name, a.last_name, a.current_company, a.category as alumni_category,
      a.location_city, a.location_country
    FROM signals s
    JOIN signal_types st ON s.type = st.type
    JOIN alumni a ON s.alumni_id = a.id
    WHERE s.detected_at > datetime('now', '-' || ? || ' days')
    ORDER BY s.detected_at DESC
  `),

  getUnreadSignals: db.prepare(`
    SELECT s.*, st.label as type_label, st.icon, st.category as signal_category,
      a.first_name, a.last_name, a.current_company, a.category as alumni_category
    FROM signals s
    JOIN signal_types st ON s.type = st.type
    JOIN alumni a ON s.alumni_id = a.id
    WHERE s.is_read = 0
    ORDER BY s.detected_at DESC
  `),

  insertSignal: db.prepare(`
    INSERT INTO signals (alumni_id, company_id, type, title, description, source, source_url, weight, detected_at, expires_at)
    VALUES (@alumni_id, @company_id, @type, @title, @description, @source, @source_url, @weight, @detected_at, @expires_at)
  `),

  markSignalRead: db.prepare(`UPDATE signals SET is_read = 1 WHERE id = ?`),
  markAllSignalsRead: db.prepare(`UPDATE signals SET is_read = 1 WHERE alumni_id = ?`),

  getSignalTypes: db.prepare(`SELECT * FROM signal_types ORDER BY category, default_weight DESC`),

  // Stats
  getStats: db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM alumni WHERE archived = 0) as total_alumni,
      (SELECT COUNT(*) FROM alumni WHERE category = 'founder' AND archived = 0) as founders,
      (SELECT COUNT(*) FROM alumni WHERE category = 'leader' AND archived = 0) as leaders,
      (SELECT COUNT(*) FROM alumni WHERE category = 'watching' AND archived = 0) as watching,
      (SELECT COUNT(*) FROM alumni WHERE fundraising_level = 'high' AND archived = 0) as high_score,
      (SELECT COUNT(*) FROM alumni WHERE starred = 1 AND archived = 0) as starred,
      (SELECT COUNT(*) FROM signals WHERE detected_at > datetime('now', '-7 days')) as signals_this_week,
      (SELECT COUNT(*) FROM signals WHERE is_read = 0) as unread_signals,
      (SELECT COUNT(DISTINCT location_country) FROM alumni WHERE archived = 0) as countries
  `),

  getCountryBreakdown: db.prepare(`
    SELECT location_country, COUNT(*) as count
    FROM alumni WHERE archived = 0 AND location_country IS NOT NULL
    GROUP BY location_country
    ORDER BY count DESC
    LIMIT 20
  `),

  getCategoryBreakdown: db.prepare(`
    SELECT category, fundraising_level, COUNT(*) as count
    FROM alumni WHERE archived = 0
    GROUP BY category, fundraising_level
  `),

  // Digests
  getLatestDigest: db.prepare(`SELECT * FROM digests ORDER BY date DESC LIMIT 1`),
  getDigestByDate: db.prepare(`SELECT * FROM digests WHERE date = ?`),
  insertDigest: db.prepare(`
    INSERT OR REPLACE INTO digests (date, content, alumni_count, signal_count)
    VALUES (@date, @content, @alumni_count, @signal_count)
  `),
  getRecentDigests: db.prepare(`SELECT * FROM digests ORDER BY date DESC LIMIT 30`),
};

module.exports = { db, queries };

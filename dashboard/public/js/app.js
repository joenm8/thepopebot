// ── State ────────────────────────────────────────────────────────────────────

let currentPage = 'overview';
let stats = null;
let signalTypes = [];

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    signalTypes = await API.getSignalTypes();
  } catch (e) { console.error('Failed to load signal types:', e); }
  navigate('overview');
  updateSidebarCounts();
});

// ── Navigation ───────────────────────────────────────────────────────────────

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  const main = document.getElementById('main-content');
  main.innerHTML = '<div style="display:flex;justify-content:center;padding:48px"><div class="spinner"></div></div>';

  switch (page) {
    case 'overview': renderOverview(); break;
    case 'signals': renderSignals(); break;
    case 'digest': renderDigest(); break;
    case 'founders': renderAlumniList('founder'); break;
    case 'leaders': renderAlumniList('leader'); break;
    case 'watching': renderAlumniList('watching'); break;
    case 'all-alumni': renderAlumniList(null); break;
    case 'discover': renderDiscover(); break;
    case 'import': renderImport(); break;
    case 'sources': renderSources(); break;
    default: renderOverview();
  }
}

async function updateSidebarCounts() {
  try {
    const data = await API.getStats();
    stats = data.stats;
    setText('founders-count', stats.founders);
    setText('leaders-count', stats.leaders);
    setText('watching-count', stats.watching);

    const badge = document.getElementById('unread-badge');
    if (stats.unread_signals > 0) {
      badge.textContent = stats.unread_signals;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) { console.error(e); }
}

// ── Overview Page ────────────────────────────────────────────────────────────

async function renderOverview() {
  const main = document.getElementById('main-content');
  try {
    const [statsData, signals, alumni] = await Promise.all([
      API.getStats(),
      API.getSignals(7),
      API.getAlumni({ level: 'high' }),
    ]);
    stats = statsData.stats;

    main.innerHTML = `
      <div class="page-header">
        <h2>Dashboard</h2>
        <div class="actions">
          <button class="btn" onclick="API.checkMilestones().then(r => { toast(r.found + ' milestone(s) checked', 'info'); navigate('overview'); })">Check Milestones</button>
          <button class="btn" onclick="API.recalculate().then(r => { toast(r.updated + ' scores updated', 'info'); navigate('overview'); })">Recalculate Scores</button>
          <button class="btn btn-primary" onclick="openAddAlumniModal()">+ Add Alumni</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card highlight">
          <div class="label">High Priority</div>
          <div class="value" style="color:var(--red)">${stats.high_score}</div>
          <div class="change text-muted">Likely raising soon</div>
        </div>
        <div class="stat-card">
          <div class="label">Founders</div>
          <div class="value" style="color:var(--green)">${stats.founders}</div>
        </div>
        <div class="stat-card">
          <div class="label">Leaders</div>
          <div class="value" style="color:var(--blue)">${stats.leaders}</div>
        </div>
        <div class="stat-card">
          <div class="label">Watching</div>
          <div class="value" style="color:var(--cyan)">${stats.watching}</div>
        </div>
        <div class="stat-card">
          <div class="label">Total Alumni</div>
          <div class="value">${stats.total_alumni}</div>
        </div>
        <div class="stat-card">
          <div class="label">Countries</div>
          <div class="value">${stats.countries}</div>
        </div>
        <div class="stat-card">
          <div class="label">Signals (7d)</div>
          <div class="value">${stats.signals_this_week}</div>
        </div>
        <div class="stat-card">
          <div class="label">Unread</div>
          <div class="value" style="color:var(--orange)">${stats.unread_signals}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div class="table-container">
            <div class="table-header">
              <h3>High Priority Alumni</h3>
              <span class="text-sm text-muted">Likely to raise funding</span>
            </div>
            ${alumni.length > 0 ? `
              <table>
                <thead><tr>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Location</th>
                </tr></thead>
                <tbody>
                  ${alumni.slice(0, 10).map(a => `
                    <tr onclick="openProfile(${a.id})" class="cursor-pointer">
                      <td>
                        <div class="alumni-name">
                          <div class="avatar ${a.category}">${initials(a)}</div>
                          <div class="name-info">
                            <div class="name">${esc(a.first_name)} ${esc(a.last_name)}</div>
                            <div class="company">${esc(a.current_title || '')}${a.current_company ? ' at ' + esc(a.current_company) : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>${scoreBar(a)}</td>
                      <td class="text-sm text-muted">${locationStr(a)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="empty-state"><p>No high-priority alumni yet. Add signals to track fundraising likelihood.</p></div>'}
          </div>

          ${statsData.countries.length > 0 ? `
            <div class="table-container" style="margin-top:20px">
              <div class="table-header"><h3>Alumni by Country</h3></div>
              <table>
                <thead><tr><th>Country</th><th>Count</th></tr></thead>
                <tbody>${statsData.countries.map(c => `
                  <tr><td>${esc(c.location_country)}</td><td class="font-mono">${c.count}</td></tr>
                `).join('')}</tbody>
              </table>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="table-container">
            <div class="table-header">
              <h3>Recent Signals</h3>
              <button class="btn btn-sm" onclick="navigate('signals')">View All</button>
            </div>
            <div class="signal-feed">
              ${signals.length > 0 ? signals.slice(0, 12).map(s => signalItem(s)).join('') :
                '<div class="empty-state"><p>No recent signals. Add signals to alumni profiles to start tracking.</p></div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    updateSidebarCounts();
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><div class="icon">!</div><h3>Error loading dashboard</h3><p>${esc(e.message)}</p></div>`;
  }
}

// ── Alumni List Page ─────────────────────────────────────────────────────────

async function renderAlumniList(category) {
  const main = document.getElementById('main-content');
  const titles = { founder: 'Founders', leader: 'Leaders', watching: 'Watching List' };
  const title = category ? titles[category] : 'All Alumni';
  const descriptions = {
    founder: 'Alumni who are founding or co-founding companies',
    leader: 'Alumni in C-Suite or VP+ roles at companies',
    watching: 'Alumni at top tech companies who may leave to start something',
  };

  try {
    const params = category ? { category } : {};
    const alumni = await API.getAlumni(params);

    main.innerHTML = `
      <div class="page-header">
        <div>
          <h2>${title}</h2>
          ${category ? `<p class="text-sm text-muted" style="margin-top:4px">${descriptions[category]}</p>` : ''}
        </div>
        <div class="actions">
          <div class="search-bar">
            <span class="search-icon">&#128269;</span>
            <input type="text" placeholder="Search alumni..." id="alumni-search"
              oninput="searchAlumni(this.value, '${category || ''}')">
          </div>
          <button class="btn btn-primary" onclick="openAddAlumniModal('${category || 'watching'}')">+ Add Alumni</button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead><tr>
            <th></th>
            <th>Name</th>
            <th>Category</th>
            <th>Fundraising Score</th>
            <th>Location</th>
            <th>Graduation</th>
            <th>Signals (30d)</th>
            <th></th>
          </tr></thead>
          <tbody id="alumni-table-body">
            ${alumni.length > 0 ? alumni.map(a => alumniRow(a)).join('') :
              `<tr><td colspan="8"><div class="empty-state">
                <div class="icon">${category === 'watching' ? '&#9737;' : '&#9782;'}</div>
                <h3>No ${title.toLowerCase()} yet</h3>
                <p>Add alumni or import a CSV to get started.</p>
                <button class="btn btn-primary" onclick="openAddAlumniModal('${category || 'watching'}')">+ Add Alumni</button>
              </div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
}

function alumniRow(a) {
  return `
    <tr>
      <td>
        <button class="btn-icon" onclick="event.stopPropagation();toggleStar(${a.id})" title="Star">
          ${a.starred ? '<span style="color:var(--yellow)">&#9733;</span>' : '<span style="color:var(--text-dim)">&#9734;</span>'}
        </button>
      </td>
      <td onclick="openProfile(${a.id})" class="cursor-pointer">
        <div class="alumni-name">
          <div class="avatar ${a.category}">${initials(a)}</div>
          <div class="name-info">
            <div class="name">${esc(a.first_name)} ${esc(a.last_name)}</div>
            <div class="company">${esc(a.current_title || '')}${a.current_company ? ' at ' + esc(a.current_company) : ''}</div>
          </div>
        </div>
      </td>
      <td><span class="tag tag-${a.category}">${capitalize(a.category)}</span></td>
      <td>${scoreBar(a)}</td>
      <td class="text-sm text-muted">${locationStr(a)}</td>
      <td class="text-sm text-muted">${a.graduation_year || '-'}</td>
      <td class="text-sm font-mono">${a.recent_signals || 0}</td>
      <td>
        <button class="btn-icon" onclick="event.stopPropagation();openProfile(${a.id})" title="View profile">&#8594;</button>
      </td>
    </tr>
  `;
}

let searchTimeout;
async function searchAlumni(query, category) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const params = query ? { search: query } : (category ? { category } : {});
    const alumni = await API.getAlumni(params);
    const tbody = document.getElementById('alumni-table-body');
    tbody.innerHTML = alumni.map(a => alumniRow(a)).join('') ||
      '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:24px">No results</td></tr>';
  }, 200);
}

// ── Signals Page ─────────────────────────────────────────────────────────────

async function renderSignals() {
  const main = document.getElementById('main-content');
  try {
    const signals = await API.getSignals(30);

    main.innerHTML = `
      <div class="page-header">
        <h2>Signal Feed</h2>
        <div class="actions">
          <select class="btn" id="signal-days" onchange="filterSignals(this.value)">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      <div class="table-container">
        <div class="signal-feed" id="signal-feed-container">
          ${signals.length > 0 ? signals.map(s => signalItem(s, true)).join('') :
            '<div class="empty-state"><div class="icon">&#9889;</div><h3>No signals yet</h3><p>Signals appear here as you track alumni activity.</p></div>'}
        </div>
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function filterSignals(days) {
  const container = document.getElementById('signal-feed-container');
  container.innerHTML = '<div style="display:flex;justify-content:center;padding:24px"><div class="spinner"></div></div>';
  const signals = await API.getSignals(parseInt(days));
  container.innerHTML = signals.length > 0 ? signals.map(s => signalItem(s, true)).join('') :
    '<div class="empty-state"><p>No signals in this period.</p></div>';
}

// ── Digest Page ──────────────────────────────────────────────────────────────

async function renderDigest() {
  const main = document.getElementById('main-content');
  try {
    let digest = await API.getDigest();

    main.innerHTML = `
      <div class="page-header">
        <h2>Daily Digest</h2>
        <div class="actions">
          <select class="btn" id="digest-days" onchange="regenerateDigest(this.value)">
            <option value="1">Last 24 hours</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
          </select>
          <button class="btn btn-primary" onclick="regenerateDigest(document.getElementById('digest-days').value)">Generate Digest</button>
        </div>
      </div>

      <div id="digest-content">
        ${digest ? renderDigestContent(digest.content || digest) : `
          <div class="empty-state">
            <div class="icon">&#9993;</div>
            <h3>No digest generated yet</h3>
            <p>Click "Generate Digest" to create a summary of recent alumni signals.</p>
          </div>
        `}
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function regenerateDigest(days) {
  const container = document.getElementById('digest-content');
  container.innerHTML = '<div style="display:flex;justify-content:center;padding:48px"><div class="spinner"></div></div>';
  const digest = await API.generateDigest(parseInt(days));
  container.innerHTML = renderDigestContent(digest);
  toast('Digest generated', 'success');
}

function renderDigestContent(digest) {
  if (!digest) return '<div class="empty-state"><p>No data for digest.</p></div>';

  const sections = [
    { key: 'high_priority', title: 'High Priority - Likely Raising', color: 'var(--red)', bgColor: 'var(--red-bg)' },
    { key: 'notable', title: 'Notable Activity', color: 'var(--orange)', bgColor: 'var(--orange-bg)' },
    { key: 'watching', title: 'Watching', color: 'var(--cyan)', bgColor: 'var(--cyan-bg)' },
  ];

  let html = `
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px">
      <div class="stat-card"><div class="label">Date</div><div class="value text-sm">${digest.date || 'Today'}</div></div>
      <div class="stat-card"><div class="label">Alumni with Activity</div><div class="value">${digest.total_alumni || 0}</div></div>
      <div class="stat-card"><div class="label">Total Signals</div><div class="value">${digest.total_signals || 0}</div></div>
    </div>
  `;

  for (const section of sections) {
    const items = digest[section.key] || [];
    if (items.length === 0) continue;

    html += `
      <div class="digest-section">
        <div class="digest-section-header">
          <h4 style="color:${section.color}">${section.title}</h4>
          <span class="count" style="background:${section.bgColor};color:${section.color}">${items.length}</span>
        </div>
        ${items.map(item => `
          <div class="digest-card" onclick="openProfile(${item.alumni_id})" style="cursor:pointer">
            <div class="digest-alumni-name">${esc(item.name)}</div>
            <div class="digest-alumni-meta">${esc(item.company || 'Unknown')} &middot; ${esc(item.location || 'Unknown')}</div>
            <div class="digest-signals">
              ${item.signals.map(s => `
                <div class="digest-signal">
                  <span>${s.icon || ''}</span>
                  <span style="font-weight:500">${esc(s.label)}</span>
                  <span>&mdash;</span>
                  <span>${esc(s.title)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (!html.includes('digest-section')) {
    html += '<div class="empty-state"><p>No signals in this period. Try a longer time range.</p></div>';
  }

  return html;
}

// ── Discover Page ────────────────────────────────────────────────────────────

let discoveryResults = null;

async function renderDiscover() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Discover Alumni</h2>
        <p class="text-sm text-muted" style="margin-top:4px">Search Google for UniMelb CS/Engineering alumni who are founders (via Serper.dev)</p>
      </div>
      <div class="actions">
        <select class="btn" id="discover-queries">
          <option value="">All queries (~10 searches)</option>
          <option value="3">Quick (3 searches)</option>
          <option value="5">Medium (5 searches)</option>
        </select>
        <button class="btn btn-primary" onclick="runDiscovery()">Search Google</button>
      </div>
    </div>

    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card">
        <div class="label">Target University</div>
        <div class="value text-sm">University of Melbourne</div>
      </div>
      <div class="stat-card">
        <div class="label">Graduation Years</div>
        <div class="value text-sm">2015 - 2025</div>
      </div>
      <div class="stat-card">
        <div class="label">Fields</div>
        <div class="value text-sm">CS / Engineering / IT</div>
      </div>
      <div class="stat-card">
        <div class="label">Looking For</div>
        <div class="value text-sm">Founders / CEOs / CTOs</div>
      </div>
    </div>

    <div id="discover-results">
      <div class="table-container" style="padding:24px">
        <div style="text-align:center;padding:32px">
          <div style="font-size:48px;margin-bottom:16px">&#128270;</div>
          <h3>Ready to Discover</h3>
          <p class="text-sm text-muted" style="max-width:480px;margin:8px auto 0">
            Click "Search Google" to find UniMelb Computer Science and Engineering alumni
            who are founders, CEOs, or CTOs. Results are parsed from LinkedIn profiles
            and news articles via the Serper.dev API.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function runDiscovery() {
  const container = document.getElementById('discover-results');
  const maxQ = document.getElementById('discover-queries').value;
  container.innerHTML = `
    <div class="table-container" style="padding:48px;text-align:center">
      <div class="spinner"></div>
      <p class="text-muted" style="margin-top:16px">Searching Google for UniMelb alumni founders...</p>
      <p class="text-sm text-muted">This may take 10-30 seconds depending on the number of queries.</p>
    </div>
  `;

  try {
    const results = await API.runDiscovery(maxQ ? parseInt(maxQ) : null);
    discoveryResults = results;
    renderDiscoveryResults(results);
    toast(`Found ${results.total_candidates} candidates from ${results.queries_run} searches`, 'success');
  } catch (e) {
    container.innerHTML = `
      <div class="table-container" style="padding:24px">
        <div style="color:var(--red);padding:16px;background:var(--red-bg);border-radius:var(--radius)">
          <strong>Discovery failed</strong>
          <p class="text-sm" style="margin-top:4px">${esc(e.message)}</p>
          <p class="text-sm text-muted" style="margin-top:8px">Make sure SERPER_API_KEY is set as an environment variable.</p>
        </div>
      </div>
    `;
    toast('Discovery failed: ' + e.message, 'error');
  }
}

function renderDiscoveryResults(results) {
  const container = document.getElementById('discover-results');
  const { candidates, news_mentions } = results;

  container.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="stat-card">
        <div class="label">People Found</div>
        <div class="value" style="color:var(--green)">${candidates.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Founders / CEOs</div>
        <div class="value" style="color:var(--accent)">${candidates.filter(c => c.is_founder).length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Degree Match</div>
        <div class="value" style="color:var(--cyan)">${candidates.filter(c => c.has_degree_match).length}</div>
      </div>
      <div class="stat-card">
        <div class="label">News Mentions</div>
        <div class="value">${news_mentions.length}</div>
      </div>
    </div>

    ${candidates.length > 0 ? `
      <div class="table-container" style="margin-bottom:20px">
        <div class="table-header">
          <h3>Discovered Candidates</h3>
          <div class="actions">
            <button class="btn" onclick="selectAllCandidates()">Select All</button>
            <button class="btn" onclick="deselectAllCandidates()">Deselect All</button>
            <button class="btn btn-primary" onclick="importSelectedCandidates()">Import Selected</button>
          </div>
        </div>
        <table>
          <thead><tr>
            <th><input type="checkbox" id="select-all-cb" onchange="toggleAllCandidates(this.checked)"></th>
            <th>Name</th>
            <th>Title</th>
            <th>Company</th>
            <th>Location</th>
            <th>Degree</th>
            <th>Category</th>
            <th>LinkedIn</th>
          </tr></thead>
          <tbody>
            ${candidates.map((c, i) => `
              <tr>
                <td><input type="checkbox" class="candidate-cb" data-idx="${i}" ${c.is_founder ? 'checked' : ''}></td>
                <td>
                  <div class="alumni-name">
                    <div class="avatar ${c.category}">${(c.first_name[0] || '') + (c.last_name[0] || '')}</div>
                    <div class="name-info">
                      <div class="name">${esc(c.first_name)} ${esc(c.last_name)}</div>
                      <div class="company text-sm text-muted">${esc(c.snippet.slice(0, 100))}${c.snippet.length > 100 ? '...' : ''}</div>
                    </div>
                  </div>
                </td>
                <td class="text-sm">${esc(c.current_title || '-')}</td>
                <td class="text-sm">${esc(c.current_company || '-')}</td>
                <td class="text-sm text-muted">${[c.location_city, c.location_country].filter(Boolean).join(', ') || '-'}</td>
                <td class="text-sm">${esc(c.degree || '-')}</td>
                <td><span class="tag tag-${c.category}">${capitalize(c.category)}</span></td>
                <td class="text-sm">
                  ${c.linkedin_url ? `<a href="${esc(c.linkedin_url)}" target="_blank" style="color:var(--accent)">Profile</a>` : '-'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${news_mentions.length > 0 ? `
      <div class="table-container">
        <div class="table-header">
          <h3>Related News & Articles</h3>
        </div>
        <div class="signal-feed">
          ${news_mentions.slice(0, 20).map(n => `
            <div class="signal-item">
              <div class="signal-icon">&#128240;</div>
              <div class="signal-content">
                <div class="signal-title">
                  <a href="${esc(n.url)}" target="_blank" style="color:var(--text)">${esc(n.title)}</a>
                </div>
                ${n.snippet ? `<div class="signal-desc">${esc(n.snippet)}</div>` : ''}
                <div class="signal-meta">
                  ${n.source ? `<span class="source">${esc(n.source)}</span>` : ''}
                  ${n.date ? `<span class="time">${esc(n.date)}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function toggleAllCandidates(checked) {
  document.querySelectorAll('.candidate-cb').forEach(cb => cb.checked = checked);
}

function selectAllCandidates() {
  toggleAllCandidates(true);
  const selectAll = document.getElementById('select-all-cb');
  if (selectAll) selectAll.checked = true;
}

function deselectAllCandidates() {
  toggleAllCandidates(false);
  const selectAll = document.getElementById('select-all-cb');
  if (selectAll) selectAll.checked = false;
}

async function importSelectedCandidates() {
  if (!discoveryResults) return;

  const checkboxes = document.querySelectorAll('.candidate-cb:checked');
  const indices = [...checkboxes].map(cb => parseInt(cb.dataset.idx));
  const selected = indices.map(i => discoveryResults.candidates[i]);

  if (selected.length === 0) {
    toast('No candidates selected', 'error');
    return;
  }

  try {
    const result = await API.importDiscovered(selected);
    toast(`Imported ${result.imported} alumni (${result.skipped} skipped/duplicates)`, 'success');
    updateSidebarCounts();
  } catch (e) {
    toast('Import failed: ' + e.message, 'error');
  }
}

// ── Import Page ──────────────────────────────────────────────────────────────

function renderImport() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="page-header">
      <h2>Import Alumni Data</h2>
    </div>

    <div class="table-container" style="padding:24px">
      <h3 style="margin-bottom:16px">Upload CSV File</h3>
      <div class="drop-zone" id="drop-zone"
        ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')"
        ondrop="handleDrop(event)"
        onclick="document.getElementById('file-input').click()">
        <div class="icon">&#8657;</div>
        <p>Drop a CSV file here or click to browse</p>
        <p class="hint">Supports: first_name, last_name, email, linkedin_url, city, country, graduation_year, degree, faculty, company, title, category</p>
      </div>
      <input type="file" id="file-input" accept=".csv" style="display:none" onchange="handleFileSelect(this.files[0])">
      <div id="import-result"></div>
    </div>

    <div class="table-container" style="padding:24px;margin-top:20px">
      <h3 style="margin-bottom:16px">CSV Format Guide</h3>
      <p class="text-sm text-muted" style="margin-bottom:12px">Your CSV should include headers matching these column names (flexible naming supported):</p>
      <table>
        <thead><tr><th>Column</th><th>Aliases</th><th>Required</th></tr></thead>
        <tbody>
          <tr><td>first_name</td><td class="text-muted text-sm">firstName, First Name</td><td><span class="tag tag-high">Yes</span></td></tr>
          <tr><td>last_name</td><td class="text-muted text-sm">lastName, Last Name</td><td><span class="tag tag-high">Yes</span></td></tr>
          <tr><td>email</td><td class="text-muted text-sm">Email</td><td class="text-muted">No</td></tr>
          <tr><td>linkedin_url</td><td class="text-muted text-sm">linkedin, LinkedIn, LinkedIn URL</td><td class="text-muted">No</td></tr>
          <tr><td>location_city</td><td class="text-muted text-sm">city, City</td><td class="text-muted">No</td></tr>
          <tr><td>location_country</td><td class="text-muted text-sm">country, Country</td><td class="text-muted">No</td></tr>
          <tr><td>graduation_year</td><td class="text-muted text-sm">grad_year, Graduation Year</td><td class="text-muted">No</td></tr>
          <tr><td>degree</td><td class="text-muted text-sm">Degree</td><td class="text-muted">No</td></tr>
          <tr><td>faculty</td><td class="text-muted text-sm">Faculty, department, Department</td><td class="text-muted">No</td></tr>
          <tr><td>current_company</td><td class="text-muted text-sm">company, Company</td><td class="text-muted">No</td></tr>
          <tr><td>current_title</td><td class="text-muted text-sm">title, Title</td><td class="text-muted">No</td></tr>
          <tr><td>category</td><td class="text-muted text-sm">-</td><td class="text-muted">No (default: watching)</td></tr>
        </tbody>
      </table>
    </div>

    <div class="table-container" style="padding:24px;margin-top:20px">
      <h3 style="margin-bottom:16px">Sample CSV</h3>
      <pre style="background:var(--bg-input);padding:16px;border-radius:var(--radius);font-size:12px;overflow-x:auto;color:var(--text-muted);font-family:var(--font-mono)">first_name,last_name,email,linkedin_url,city,country,graduation_year,degree,faculty,company,title,category
Michelle,Yu,,https://linkedin.com/in/michelleyu,Singapore,Singapore,2010,Bachelor of Commerce,Business,Meta,Senior Product Manager,watching
James,Chen,,https://linkedin.com/in/jameschen,San Francisco,United States,2012,Master of Engineering,Engineering,,CEO & Co-founder,founder
Sarah,Williams,,https://linkedin.com/in/sarahwilliams,London,United Kingdom,2015,PhD Biomedical Science,Medicine,GSK,VP Research,leader</pre>
      <button class="btn" style="margin-top:12px" onclick="downloadSampleCSV()">Download Sample CSV</button>
    </div>
  `;
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelect(file);
}

async function handleFileSelect(file) {
  if (!file || !file.name.endsWith('.csv')) {
    toast('Please upload a CSV file', 'error');
    return;
  }

  const resultDiv = document.getElementById('import-result');
  resultDiv.innerHTML = '<div class="flex items-center gap-8"><div class="spinner"></div> Importing...</div>';

  try {
    const result = await API.importAlumni(file);
    resultDiv.innerHTML = `
      <div style="padding:16px;background:var(--green-bg);border-radius:var(--radius);margin-top:16px">
        <strong style="color:var(--green)">Import Complete</strong>
        <p class="text-sm" style="margin-top:4px">Imported: ${result.imported} | Skipped: ${result.skipped} | Total rows: ${result.total}</p>
        ${result.errors.length > 0 ? `<p class="text-sm text-muted" style="margin-top:4px">Errors: ${result.errors.join('; ')}</p>` : ''}
      </div>
    `;
    toast(`Imported ${result.imported} alumni`, 'success');
    updateSidebarCounts();
  } catch (e) {
    resultDiv.innerHTML = `<div style="padding:16px;background:var(--red-bg);border-radius:var(--radius);margin-top:16px;color:var(--red)">Import failed: ${esc(e.message)}</div>`;
    toast('Import failed', 'error');
  }
}

function downloadSampleCSV() {
  const csv = `first_name,last_name,email,linkedin_url,city,country,graduation_year,degree,faculty,company,title,category
Michelle,Yu,michelle.yu@email.com,https://linkedin.com/in/michelleyu,Singapore,Singapore,2010,Bachelor of Commerce,Business,Meta,Senior Product Manager,watching
James,Chen,james.chen@email.com,https://linkedin.com/in/jameschen,San Francisco,United States,2012,Master of Engineering,Engineering,NeuralPath AI,CEO & Co-founder,founder
Sarah,Williams,sarah.w@email.com,https://linkedin.com/in/sarahwilliams,London,United Kingdom,2015,PhD Biomedical Science,Medicine,GSK,VP Research,leader
Raj,Patel,,https://linkedin.com/in/rajpatel,Melbourne,Australia,2018,Bachelor of Science,Computer Science,Google,Software Engineer,watching
Emma,Thompson,,https://linkedin.com/in/emmathompson,New York,United States,2014,MBA,Business,Stripe,Chief Revenue Officer,leader`;

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alumni_sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Profile Panel ────────────────────────────────────────────────────────────

async function openProfile(id) {
  const panel = document.getElementById('profile-panel');
  panel.classList.add('open');

  try {
    const data = await API.getAlumniDetail(id);
    const { alumni: a, companies, signals } = data;

    document.getElementById('profile-avatar').className = `avatar profile-avatar ${a.category}`;
    document.getElementById('profile-avatar').textContent = initials(a);
    document.getElementById('profile-name').textContent = `${a.first_name} ${a.last_name}`;
    document.getElementById('profile-meta').textContent = `${a.current_title || ''}${a.current_company ? ' at ' + a.current_company : ''}`;

    document.getElementById('profile-tags').innerHTML = `
      <span class="tag tag-${a.category}">${capitalize(a.category)}</span>
      <span class="tag tag-${a.fundraising_level}">${capitalize(a.fundraising_level)} (${a.fundraising_score})</span>
      ${a.starred ? '<span class="tag" style="background:var(--yellow-bg);color:var(--yellow)">Starred</span>' : ''}
    `;

    document.getElementById('profile-details').innerHTML = `
      ${detailRow('Location', locationStr(a))}
      ${detailRow('Graduation', a.graduation_year || '-')}
      ${detailRow('Degree', a.degree || '-')}
      ${detailRow('Faculty', a.faculty || '-')}
      ${detailRow('Email', a.email || '-')}
      ${a.linkedin_url ? detailRow('LinkedIn', `<a href="${esc(a.linkedin_url)}" target="_blank" style="color:var(--accent)">${esc(a.linkedin_url)}</a>`) : ''}
      ${a.notes ? detailRow('Notes', esc(a.notes)) : ''}
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-sm" onclick="openEditAlumniModal(${a.id})">Edit</button>
        <button class="btn btn-sm" onclick="toggleStar(${a.id})">
          ${a.starred ? 'Unstar' : 'Star'}
        </button>
        <button class="btn btn-sm" onclick="if(confirm('Archive this alumni?')){API.archiveAlumni(${a.id}).then(()=>{closeProfile();navigate(currentPage);toast('Archived','info');})}">Archive</button>
      </div>
    `;

    document.getElementById('profile-companies').innerHTML = companies.length > 0 ?
      companies.map(c => `
        <div style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-weight:500;font-size:13px">${esc(c.title || 'Unknown role')} at ${esc(c.company_name)}</div>
          <div class="text-sm text-muted">${c.start_date || '?'} - ${c.is_current ? 'Present' : (c.end_date || '?')}
            ${c.is_top_company ? ' <span class="tag" style="background:var(--purple-bg);color:var(--purple);font-size:10px">Top Company</span>' : ''}
          </div>
        </div>
      `).join('') :
      '<p class="text-sm text-muted">No career history recorded.</p>';

    document.getElementById('profile-signals').innerHTML = signals.length > 0 ?
      signals.map(s => `
        <div class="signal-item ${s.is_read ? '' : 'signal-unread'}" style="padding:8px 0">
          <span style="font-size:16px">${s.icon || ''}</span>
          <div class="signal-content">
            <div class="signal-title">${esc(s.title)}</div>
            ${s.description ? `<div class="signal-desc">${esc(s.description)}</div>` : ''}
            <div class="signal-meta">
              <span class="time">${timeAgo(s.detected_at)}</span>
              <span class="source">${esc(s.source || 'manual')}</span>
            </div>
          </div>
        </div>
      `).join('') :
      '<p class="text-sm text-muted">No signals recorded.</p>';

    // Add signal form
    const typeOptions = signalTypes.map(t => `<option value="${t.type}">${t.icon} ${t.label} (${t.category})</option>`).join('');
    document.getElementById('profile-add-signal').innerHTML = `
      <div class="form-group">
        <label>Signal Type</label>
        <select id="new-signal-type">${typeOptions}</select>
      </div>
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="new-signal-title" placeholder="Brief description...">
      </div>
      <div class="form-group">
        <label>Details (optional)</label>
        <textarea id="new-signal-desc" placeholder="Additional context..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Source</label>
          <select id="new-signal-source">
            <option value="manual">Manual</option>
            <option value="linkedin">LinkedIn</option>
            <option value="news">News</option>
            <option value="crunchbase">Crunchbase</option>
            <option value="github">GitHub</option>
            <option value="companies_house">Companies House</option>
          </select>
        </div>
        <div class="form-group">
          <label>Source URL (optional)</label>
          <input type="text" id="new-signal-url" placeholder="https://...">
        </div>
      </div>
      <button class="btn btn-primary" onclick="submitSignal(${a.id})">Add Signal</button>
    `;
  } catch (e) {
    console.error(e);
    toast('Failed to load profile', 'error');
  }
}

function closeProfile() {
  document.getElementById('profile-panel').classList.remove('open');
}

async function submitSignal(alumniId) {
  const type = document.getElementById('new-signal-type').value;
  const title = document.getElementById('new-signal-title').value;
  const description = document.getElementById('new-signal-desc').value;
  const source = document.getElementById('new-signal-source').value;
  const source_url = document.getElementById('new-signal-url').value;

  if (!title) { toast('Title is required', 'error'); return; }

  try {
    await API.addSignal(alumniId, { type, title, description, source, source_url });
    toast('Signal added', 'success');
    openProfile(alumniId); // Refresh
    updateSidebarCounts();
  } catch (e) {
    toast('Failed to add signal: ' + e.message, 'error');
  }
}

// ── Modals ───────────────────────────────────────────────────────────────────

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml || '';
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

function openAddAlumniModal(defaultCategory = 'watching') {
  const body = `
    <div class="form-row">
      <div class="form-group"><label>First Name *</label><input type="text" id="add-first-name"></div>
      <div class="form-group"><label>Last Name *</label><input type="text" id="add-last-name"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" id="add-email"></div>
    <div class="form-group"><label>LinkedIn URL</label><input type="text" id="add-linkedin" placeholder="https://linkedin.com/in/..."></div>
    <div class="form-row">
      <div class="form-group"><label>City</label><input type="text" id="add-city"></div>
      <div class="form-group"><label>Country</label><input type="text" id="add-country"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Graduation Year</label><input type="number" id="add-grad-year" min="1950" max="2030"></div>
      <div class="form-group">
        <label>Category</label>
        <select id="add-category">
          <option value="watching" ${defaultCategory === 'watching' ? 'selected' : ''}>Watching</option>
          <option value="founder" ${defaultCategory === 'founder' ? 'selected' : ''}>Founder</option>
          <option value="leader" ${defaultCategory === 'leader' ? 'selected' : ''}>Leader</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Degree</label><input type="text" id="add-degree"></div>
      <div class="form-group"><label>Faculty</label><input type="text" id="add-faculty"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Current Company</label><input type="text" id="add-company"></div>
      <div class="form-group"><label>Current Title</label><input type="text" id="add-title"></div>
    </div>
    <div class="form-group"><label>Notes</label><textarea id="add-notes" rows="2"></textarea></div>
  `;

  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitAddAlumni()">Add Alumni</button>
  `;

  openModal('Add Alumni', body, footer);
}

async function submitAddAlumni() {
  const firstName = document.getElementById('add-first-name').value.trim();
  const lastName = document.getElementById('add-last-name').value.trim();
  if (!firstName || !lastName) { toast('Name is required', 'error'); return; }

  try {
    await API.createAlumni({
      first_name: firstName,
      last_name: lastName,
      email: document.getElementById('add-email').value.trim() || null,
      linkedin_url: document.getElementById('add-linkedin').value.trim() || null,
      location_city: document.getElementById('add-city').value.trim() || null,
      location_country: document.getElementById('add-country').value.trim() || null,
      graduation_year: parseInt(document.getElementById('add-grad-year').value) || null,
      degree: document.getElementById('add-degree').value.trim() || null,
      faculty: document.getElementById('add-faculty').value.trim() || null,
      current_company: document.getElementById('add-company').value.trim() || null,
      current_title: document.getElementById('add-title').value.trim() || null,
      category: document.getElementById('add-category').value,
      notes: document.getElementById('add-notes').value.trim() || null,
    });

    closeModal();
    toast('Alumni added', 'success');
    navigate(currentPage);
    updateSidebarCounts();
  } catch (e) {
    toast('Failed to add: ' + e.message, 'error');
  }
}

async function openEditAlumniModal(id) {
  const data = await API.getAlumniDetail(id);
  const a = data.alumni;

  const body = `
    <div class="form-row">
      <div class="form-group"><label>First Name *</label><input type="text" id="edit-first-name" value="${esc(a.first_name)}"></div>
      <div class="form-group"><label>Last Name *</label><input type="text" id="edit-last-name" value="${esc(a.last_name)}"></div>
    </div>
    <div class="form-group"><label>Email</label><input type="email" id="edit-email" value="${esc(a.email || '')}"></div>
    <div class="form-group"><label>LinkedIn URL</label><input type="text" id="edit-linkedin" value="${esc(a.linkedin_url || '')}"></div>
    <div class="form-row">
      <div class="form-group"><label>City</label><input type="text" id="edit-city" value="${esc(a.location_city || '')}"></div>
      <div class="form-group"><label>Country</label><input type="text" id="edit-country" value="${esc(a.location_country || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Graduation Year</label><input type="number" id="edit-grad-year" value="${a.graduation_year || ''}" min="1950" max="2030"></div>
      <div class="form-group">
        <label>Category</label>
        <select id="edit-category">
          <option value="watching" ${a.category === 'watching' ? 'selected' : ''}>Watching</option>
          <option value="founder" ${a.category === 'founder' ? 'selected' : ''}>Founder</option>
          <option value="leader" ${a.category === 'leader' ? 'selected' : ''}>Leader</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Degree</label><input type="text" id="edit-degree" value="${esc(a.degree || '')}"></div>
      <div class="form-group"><label>Faculty</label><input type="text" id="edit-faculty" value="${esc(a.faculty || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Current Company</label><input type="text" id="edit-company" value="${esc(a.current_company || '')}"></div>
      <div class="form-group"><label>Current Title</label><input type="text" id="edit-title" value="${esc(a.current_title || '')}"></div>
    </div>
    <div class="form-group"><label>Notes</label><textarea id="edit-notes" rows="2">${esc(a.notes || '')}</textarea></div>
  `;

  const footer = `
    <button class="btn" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary" onclick="submitEditAlumni(${id})">Save Changes</button>
  `;

  openModal('Edit Alumni', body, footer);
}

async function submitEditAlumni(id) {
  try {
    await API.updateAlumni(id, {
      first_name: document.getElementById('edit-first-name').value.trim(),
      last_name: document.getElementById('edit-last-name').value.trim(),
      email: document.getElementById('edit-email').value.trim() || null,
      linkedin_url: document.getElementById('edit-linkedin').value.trim() || null,
      location_city: document.getElementById('edit-city').value.trim() || null,
      location_country: document.getElementById('edit-country').value.trim() || null,
      graduation_year: parseInt(document.getElementById('edit-grad-year').value) || null,
      degree: document.getElementById('edit-degree').value.trim() || null,
      faculty: document.getElementById('edit-faculty').value.trim() || null,
      current_company: document.getElementById('edit-company').value.trim() || null,
      current_title: document.getElementById('edit-title').value.trim() || null,
      category: document.getElementById('edit-category').value,
      notes: document.getElementById('edit-notes').value.trim() || null,
    });

    closeModal();
    toast('Alumni updated', 'success');
    openProfile(id);
    navigate(currentPage);
  } catch (e) {
    toast('Failed to update: ' + e.message, 'error');
  }
}

// ── Star toggle ──────────────────────────────────────────────────────────────

async function toggleStar(id) {
  await API.starAlumni(id);
  navigate(currentPage);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(a) {
  return ((a.first_name || '')[0] || '') + ((a.last_name || '')[0] || '');
}

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function locationStr(a) {
  return [a.location_city, a.location_country].filter(Boolean).join(', ') || '-';
}

function scoreBar(a) {
  const maxScore = 20;
  const pct = Math.min(100, (a.fundraising_score / maxScore) * 100);
  const level = a.fundraising_level || 'none';
  return `
    <div class="score-bar">
      <div class="score-fill">
        <div class="score-fill-inner ${level}" style="width:${pct}%"></div>
      </div>
      <span class="score-value" style="color:var(--${level === 'high' ? 'red' : level === 'medium' ? 'orange' : level === 'low' ? 'yellow' : 'text-dim'})">${a.fundraising_score}</span>
      <span class="tag tag-${level}" style="font-size:10px">${capitalize(level)}</span>
    </div>
  `;
}

function signalItem(s, showAlumni = false) {
  return `
    <div class="signal-item ${s.is_read ? '' : 'signal-unread'}" ${showAlumni ? `onclick="openProfile(${s.alumni_id})" style="cursor:pointer"` : ''}>
      <div class="signal-icon">${s.icon || '?'}</div>
      <div class="signal-content">
        <div class="signal-title">
          ${showAlumni ? `<span style="font-weight:600">${esc(s.first_name)} ${esc(s.last_name)}</span> &mdash; ` : ''}
          ${esc(s.title)}
        </div>
        ${s.description ? `<div class="signal-desc">${esc(s.description)}</div>` : ''}
        <div class="signal-meta">
          <span class="time">${timeAgo(s.detected_at)}</span>
          <span class="source">${esc(s.source || 'manual')}</span>
          ${s.type_label ? `<span class="tag tag-${s.signal_category === 'fundraising' ? 'medium' : 'watching'}" style="font-size:10px">${esc(s.type_label)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function detailRow(label, value) {
  return `<div class="profile-detail"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Toast ────────────────────────────────────────────────────────────────────

// ── Data Sources Page ────────────────────────────────────────────────────────

async function renderSources() {
  const main = document.getElementById('main-content');
  try {
    const [sources, runs] = await Promise.all([API.getSources(), API.getPipelineRuns()]);

    main.innerHTML = `
      <div class="page-header">
        <h2>Data Sources & Pipeline</h2>
        <div class="actions">
          <button class="btn" onclick="runPipelineDry()">Dry Run</button>
          <button class="btn btn-primary" onclick="runPipelineLive()">Run Pipeline</button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card">
          <div class="label">Data Sources</div>
          <div class="value">${sources.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Configured</div>
          <div class="value" style="color:var(--green)">${sources.filter(s => s.configured).length}</div>
        </div>
        <div class="stat-card">
          <div class="label">Pipeline Runs</div>
          <div class="value">${runs.length}</div>
        </div>
      </div>

      <div class="table-container" style="margin-bottom:20px">
        <div class="table-header">
          <h3>Data Sources</h3>
          <span class="text-sm text-muted">Configure via environment variables</span>
        </div>
        <table>
          <thead><tr>
            <th>Source</th>
            <th>Description</th>
            <th>Status</th>
            <th>Required Environment Variables</th>
          </tr></thead>
          <tbody>
            ${sources.map(s => `
              <tr>
                <td style="font-weight:600">${esc(s.name)}</td>
                <td class="text-sm text-muted">${esc(s.description)}</td>
                <td>
                  ${s.configured
                    ? '<span class="tag tag-founder">Configured</span>'
                    : '<span class="tag tag-none">Not Configured</span>'}
                </td>
                <td class="text-sm font-mono">
                  ${s.requiredEnv.length > 0
                    ? s.requiredEnv.map(v => `<span class="tag ${s.missingEnv.includes(v) ? 'tag-high' : 'tag-founder'}" style="margin:2px">${v}</span>`).join('')
                    : '<span class="text-muted">None required</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="table-container" style="margin-bottom:20px">
        <div class="table-header">
          <h3>Data Source Setup Guide</h3>
        </div>
        <div style="padding:20px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">LinkedIn (via Proxycurl)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Best option for LinkedIn data. $0.01 per profile lookup.</p>
              <p class="text-sm font-mono">PROXYCURL_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get key: nubela.co/proxycurl</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">News (via Serper.dev)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">2,500 free searches/month. Google News results.</p>
              <p class="text-sm font-mono">SERPER_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get key: serper.dev</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">Crunchbase</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Funding rounds, company data. From $29/month.</p>
              <p class="text-sm font-mono">CRUNCHBASE_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get key: crunchbase.com/platform</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">Companies House (UK)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Free API. Company registrations in UK.</p>
              <p class="text-sm font-mono">COMPANIES_HOUSE_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get key: developer.company-information.service.gov.uk</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">Australian Business Register</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Free API. ABN lookups for Australian businesses.</p>
              <p class="text-sm font-mono">ABR_GUID=your_guid</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get GUID: abr.business.gov.au</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">GitHub</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Free (60 req/hr) or with token (5000 req/hr).</p>
              <p class="text-sm font-mono">GITHUB_TOKEN=ghp_xxx (optional)</p>
              <p class="text-sm text-muted" style="margin-top:4px">Create: github.com/settings/tokens</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--green);margin-bottom:8px;font-size:14px">Hacker News (Free)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Completely free. No auth needed. Monitors HN for company mentions.</p>
              <p class="text-sm font-mono" style="color:var(--green)">No env vars needed</p>
              <p class="text-sm text-muted" style="margin-top:4px">Uses hn.algolia.com/api</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">Product Hunt</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">500 free requests/day. Detects product launches.</p>
              <p class="text-sm font-mono">PRODUCTHUNT_TOKEN=your_token</p>
              <p class="text-sm text-muted" style="margin-top:4px">Get token: producthunt.com/v2/oauth/applications</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--green);margin-bottom:8px;font-size:14px">Alumni Discovery (Serper)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Uses your Serper key to find UniMelb alumni founders via Google.</p>
              <p class="text-sm font-mono">SERPER_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Go to Discover Alumni page to run searches</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">People Data Labs (Enrichment)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">100 free lookups/month. Enriches profiles with career history &amp; education.</p>
              <p class="text-sm font-mono">PDL_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Sign up: peopledatalabs.com/signup</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--green);margin-bottom:8px;font-size:14px">Google News RSS (Free)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Unlimited free news monitoring. No auth needed. Supplements Serper for news.</p>
              <p class="text-sm font-mono" style="color:var(--green)">No env vars needed</p>
              <p class="text-sm text-muted" style="margin-top:4px">Uses news.google.com/rss</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--green);margin-bottom:8px;font-size:14px">Y Combinator Companies (Free)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">Check if alumni companies are YC-backed. Free public API.</p>
              <p class="text-sm font-mono" style="color:var(--green)">No env vars needed</p>
              <p class="text-sm text-muted" style="margin-top:4px">Uses yc-oss.github.io/api</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--green);margin-bottom:8px;font-size:14px">OpenCorporates (Free)</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">200 free searches/month. Global company registration data incl. ASIC.</p>
              <p class="text-sm font-mono" style="color:var(--green)">No env vars needed (optional key for higher limits)</p>
              <p class="text-sm text-muted" style="margin-top:4px">API: opencorporates.com</p>
            </div>
            <div style="background:var(--bg-input);padding:16px;border-radius:var(--radius)">
              <h4 style="color:var(--accent);margin-bottom:8px;font-size:14px">Apollo.io People Search</h4>
              <p class="text-sm text-muted" style="margin-bottom:8px">600 free people searches/day. Detect career changes &amp; discover founders.</p>
              <p class="text-sm font-mono">APOLLO_API_KEY=your_key</p>
              <p class="text-sm text-muted" style="margin-top:4px">Sign up: apollo.io</p>
            </div>
          </div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <h3>Pipeline Run History</h3>
        </div>
        ${runs.length > 0 ? `
          <table>
            <thead><tr>
              <th>Date</th>
              <th>Duration</th>
              <th>Signals Found</th>
              <th>Signals Saved</th>
              <th>Sources</th>
              <th>Errors</th>
            </tr></thead>
            <tbody>
              ${runs.map(r => `
                <tr>
                  <td class="text-sm">${timeAgo(r.started_at)}</td>
                  <td class="text-sm font-mono">${r.duration_ms}ms</td>
                  <td class="text-sm font-mono">${r.signals_found}</td>
                  <td class="text-sm font-mono">${r.signals_saved}</td>
                  <td class="text-sm">${Object.entries(r.sources).map(([k,v]) =>
                    '<span class="tag ' + (v.status === 'ok' ? 'tag-founder' : v.status === 'error' ? 'tag-high' : 'tag-none') + '" style="margin:2px">' + esc(k) + '</span>'
                  ).join('')}</td>
                  <td class="text-sm">${r.errors.length > 0 ? '<span class="tag tag-high">' + r.errors.length + ' errors</span>' : '<span class="text-muted">None</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state"><p>No pipeline runs yet. Click "Run Pipeline" to start collecting data.</p></div>'}
      </div>
    `;
  } catch (e) {
    main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
}

async function runPipelineLive() {
  toast('Starting pipeline run...', 'info');
  try {
    const result = await API.runPipeline(null, false);
    toast(`Pipeline complete: ${result.signals_found} signals found, ${result.signals_saved} saved`, 'success');
    navigate('sources');
    updateSidebarCounts();
  } catch (e) {
    toast('Pipeline failed: ' + e.message, 'error');
  }
}

async function runPipelineDry() {
  toast('Starting dry run...', 'info');
  try {
    const result = await API.runPipeline(null, true);
    toast(`Dry run complete: ${result.signals_found} signals would be found`, 'info');
  } catch (e) {
    toast('Dry run failed: ' + e.message, 'error');
  }
}

// ── Toast ────────────────────────────────────────────────────────────────────

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 3000);
}

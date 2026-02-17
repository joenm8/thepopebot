/**
 * GitHub Data Source
 *
 * Monitors alumni GitHub activity for side projects,
 * open source traction, and startup-related development.
 *
 * Signals detected:
 * - Side projects gaining traction (stars, forks)
 * - New repositories with startup-related names
 * - Active development on non-employer projects
 * - README mentions of company names or product launches
 *
 * Uses the public GitHub API (or authenticated for higher rate limits).
 * Set GITHUB_TOKEN for 5000 req/hour instead of 60 req/hour.
 */

const name = 'GitHub';
const description = 'Monitor GitHub for side projects, open source traction, and development activity';
const requiredEnv = []; // Works without auth (lower rate limits)

function isConfigured() {
  return true; // Always available, auth is optional
}

const GITHUB_API = 'https://api.github.com';

async function githubFetch(endpoint) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TinAlleyDashboard/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`${GITHUB_API}${endpoint}`, { headers });
  if (!res.ok) {
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      throw new Error('GitHub API rate limit exceeded');
    }
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

/**
 * Extract GitHub username from various URL formats
 */
function extractUsername(url) {
  if (!url) return null;
  const match = url.match(/github\.com\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Scan a single alumni's GitHub activity
 */
async function scan(alumni) {
  // Try to find GitHub URL from alumni data
  // In practice, this would come from LinkedIn profile data or manual entry
  const githubUrl = alumni.github_url;
  const username = extractUsername(githubUrl);
  if (!username) return [];

  const signals = [];

  try {
    // Get user's repos sorted by stars
    const repos = await githubFetch(`/users/${username}/repos?sort=stars&per_page=30`);
    if (!repos) return [];

    // Check for high-traction repos
    for (const repo of repos) {
      // Skip forks and archived repos
      if (repo.fork || repo.archived) continue;

      // Check if repo was created or updated recently (last 90 days)
      const updatedAt = new Date(repo.pushed_at);
      const daysSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 90) continue;

      // High-traction project
      if (repo.stargazers_count >= 100) {
        signals.push({
          type: 'side_project',
          title: `GitHub project "${repo.name}" has ${repo.stargazers_count} stars`,
          description: `${repo.description || 'No description'}. ${repo.forks_count} forks, actively maintained.`,
          source: 'github',
          source_url: repo.html_url,
          weight: repo.stargazers_count >= 1000 ? 4.0 : repo.stargazers_count >= 500 ? 3.0 : 2.0,
        });
      }

      // New repo with startup-related name/description
      const createdAt = new Date(repo.created_at);
      const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 90) {
        const desc = (repo.description || '').toLowerCase();
        const repoName = repo.name.toLowerCase();
        const startupKeywords = ['startup', 'saas', 'platform', 'api', 'sdk', 'framework', 'app', 'ai', 'ml', 'health', 'bio', 'med', 'fin', 'pay', 'cloud'];
        const hasStartupSignal = startupKeywords.some(k => desc.includes(k) || repoName.includes(k));

        if (hasStartupSignal && !repo.fork) {
          signals.push({
            type: 'side_project',
            title: `New GitHub repo: ${repo.name}`,
            description: `Created ${Math.floor(daysSinceCreation)} days ago. ${repo.description || ''}`,
            source: 'github',
            source_url: repo.html_url,
            weight: 1.5,
          });
        }
      }
    }

    // Check recent activity (commits in last 30 days)
    const events = await githubFetch(`/users/${username}/events?per_page=30`);
    if (events) {
      const recentPushes = events.filter(e =>
        e.type === 'PushEvent' &&
        new Date(e.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      // If they're pushing to non-employer repos frequently, it's a side project signal
      const nonEmployerRepos = new Set();
      const employerLower = (alumni.current_company || '').toLowerCase();
      for (const push of recentPushes) {
        const repoName = (push.repo?.name || '').toLowerCase();
        if (!repoName.includes(employerLower) && employerLower && !repoName.includes(employerLower.replace(/\s+/g, ''))) {
          nonEmployerRepos.add(push.repo?.name);
        }
      }

      if (nonEmployerRepos.size >= 3) {
        signals.push({
          type: 'side_project',
          title: `Active on ${nonEmployerRepos.size} non-employer GitHub repos`,
          description: `Pushing code to personal/side projects while employed at ${alumni.current_company}`,
          source: 'github',
          weight: 2.0,
        });
      }
    }
  } catch (err) {
    console.error(`GitHub scan failed for ${alumni.first_name} ${alumni.last_name}:`, err.message);
  }

  return signals;
}

async function scanAll(alumniList) {
  const allSignals = [];
  const withGithub = alumniList.filter(a => a.github_url);

  for (let i = 0; i < withGithub.length; i++) {
    const signals = await scan(withGithub[i]);
    for (const s of signals) {
      allSignals.push({ ...s, alumni_id: withGithub[i].id });
    }
    // Rate limit: 0.5s between requests
    if (i < withGithub.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allSignals;
}

module.exports = { name, description, requiredEnv, isConfigured, scan, scanAll };

/**
 * Dashboard script for Bluesky Universe
 */

import {
  getAllProfiles,
  countPosts,
  countInteractions,
  countEngagements,
  getFollowing,
  getFollowers,
  getMutuals,
} from '../db/index.js';

console.log('[Universe] Dashboard loaded');

// DOM elements
const dateRangeSelect = document.getElementById('date-range') as HTMLSelectElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;

const totalFollowing = document.getElementById('total-following') as HTMLSpanElement;
const totalFollowers = document.getElementById('total-followers') as HTMLSpanElement;
const totalMutuals = document.getElementById('total-mutuals') as HTMLSpanElement;
const totalPosts = document.getElementById('total-posts') as HTMLSpanElement;
const yourInteractions = document.getElementById('your-interactions') as HTMLSpanElement;
const receivedEngagements = document.getElementById('received-engagements') as HTMLSpanElement;

const noiseInsight = document.getElementById('noise-insight')?.querySelector('.insight-content') as HTMLParagraphElement;
const engagementInsight = document.getElementById('engagement-insight')?.querySelector('.insight-content') as HTMLParagraphElement;
const reciprocityInsight = document.getElementById('reciprocity-insight')?.querySelector('.insight-content') as HTMLParagraphElement;

const userTableBody = document.getElementById('user-table-body') as HTMLTableSectionElement;
const unfollowCandidates = document.getElementById('unfollow-candidates') as HTMLDivElement;

const lastUpdated = document.getElementById('last-updated') as HTMLSpanElement;
const exportCsvBtn = document.getElementById('export-csv') as HTMLButtonElement;

// State
let currentPage = 1;
const pageSize = 20;

// Initialize
async function init() {
  await loadStats();
  await loadInsights();
  await loadUserTable();
  setupEventListeners();
}

// Load overview statistics
async function loadStats() {
  try {
    const [following, followers, mutuals, posts, interactions, engagements] = await Promise.all([
      getFollowing(),
      getFollowers(),
      getMutuals(),
      countPosts(),
      countInteractions(),
      countEngagements(),
    ]);

    totalFollowing.textContent = String(following.length);
    totalFollowers.textContent = String(followers.length);
    totalMutuals.textContent = String(mutuals.length);
    totalPosts.textContent = String(posts);
    yourInteractions.textContent = String(interactions);
    receivedEngagements.textContent = String(engagements);

    lastUpdated.textContent = new Date().toLocaleString();
  } catch (error) {
    console.error('[Universe] Failed to load stats:', error);
  }
}

// Load insights
async function loadInsights() {
  try {
    const profiles = await getAllProfiles();

    if (profiles.length === 0) {
      noiseInsight.textContent = 'No data yet. Run a sync to see insights.';
      engagementInsight.textContent = 'No data yet. Run a sync to see insights.';
      reciprocityInsight.textContent = 'No data yet. Run a sync to see insights.';
      return;
    }

    // Placeholder insights (will be computed from actual data later)
    const mutuals = profiles.filter((p) => p.isMutual);
    const mutualPercent = Math.round((mutuals.length / profiles.length) * 100);

    noiseInsight.textContent = `Sync to identify noisy accounts in your feed.`;
    engagementInsight.textContent = `You're following ${profiles.filter((p) => p.youFollow).length} accounts.`;
    reciprocityInsight.textContent = `${mutualPercent}% of your follows are mutual.`;
  } catch (error) {
    console.error('[Universe] Failed to load insights:', error);
  }
}

// Load user table
async function loadUserTable() {
  try {
    const profiles = await getAllProfiles();

    if (profiles.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="placeholder">No users synced yet. Click Refresh to sync.</td>
        </tr>
      `;
      return;
    }

    // Sort by handle for now (will be replaced with actual sorting)
    const sorted = profiles.slice().sort((a, b) => a.handle.localeCompare(b.handle));
    const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    userTableBody.innerHTML = paginated
      .map(
        (profile) => `
      <tr>
        <td>
          <div class="user-info">
            <div class="user-avatar" style="background-image: url(${profile.avatar || ''})"></div>
            <div>
              <div class="user-handle">@${profile.handle}</div>
              <div class="user-name">${profile.displayName || ''}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${profile.isMutual ? 'badge-mutual' : profile.youFollow ? 'badge-following' : 'badge-follower'}">
            ${profile.isMutual ? 'Mutual' : profile.youFollow ? 'Following' : 'Follower'}
          </span>
        </td>
        <td>--</td>
        <td>--</td>
        <td>--</td>
        <td><span class="score">--</span></td>
        <td><span class="score">--</span></td>
      </tr>
    `
      )
      .join('');

    // Update pagination
    const totalPages = Math.ceil(profiles.length / pageSize);
    (document.getElementById('page-info') as HTMLSpanElement).textContent = `Page ${currentPage} of ${totalPages}`;
    (document.getElementById('prev-page') as HTMLButtonElement).disabled = currentPage === 1;
    (document.getElementById('next-page') as HTMLButtonElement).disabled = currentPage === totalPages;
  } catch (error) {
    console.error('[Universe] Failed to load user table:', error);
  }
}

// Load unfollow candidates
async function loadUnfollowCandidates() {
  // Placeholder - will compute from noise scores
  unfollowCandidates.innerHTML = `
    <p class="placeholder">Sync more data to generate recommendations...</p>
  `;
}

// Setup event listeners
function setupEventListeners() {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '⏳ Loading...';

    await loadStats();
    await loadInsights();
    await loadUserTable();
    await loadUnfollowCandidates();

    refreshBtn.disabled = false;
    refreshBtn.textContent = '🔄 Refresh';
  });

  dateRangeSelect.addEventListener('change', async () => {
    await loadStats();
    await loadUserTable();
  });

  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadUserTable();
    }
  });

  document.getElementById('next-page')?.addEventListener('click', () => {
    currentPage++;
    loadUserTable();
  });

  exportCsvBtn.addEventListener('click', exportToCsv);
}

// Export to CSV
async function exportToCsv() {
  try {
    const profiles = await getAllProfiles();

    const headers = ['Handle', 'Display Name', 'DID', 'Follows You', 'You Follow', 'Mutual'];
    const rows = profiles.map((p) => [
      p.handle,
      p.displayName || '',
      p.did,
      p.followsYou ? 'Yes' : 'No',
      p.youFollow ? 'Yes' : 'No',
      p.isMutual ? 'Yes' : 'No',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
      '\n'
    );

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bluesky-universe-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Universe] Export failed:', error);
    alert('Export failed. Check console for details.');
  }
}

// Start
init();

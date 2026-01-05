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
import { getAnalytics, getNoiseOutliers } from '../analytics/index.js';

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
    const [profiles, analytics, noiseAccounts] = await Promise.all([
      getAllProfiles(),
      getAnalytics(),
      getNoiseOutliers(0.7),
    ]);

    if (profiles.length === 0) {
      noiseInsight.textContent = 'No data yet. Run a sync to see insights.';
      engagementInsight.textContent = 'No data yet. Run a sync to see insights.';
      reciprocityInsight.textContent = 'No data yet. Run a sync to see insights.';
      return;
    }

    const mutuals = profiles.filter((p) => p.isMutual);
    const mutualPercent = Math.round((mutuals.length / profiles.length) * 100);
    const followingCount = profiles.filter((p) => p.youFollow).length;

    let noiseMsg = `You have ${noiseAccounts.length} potential noise account${noiseAccounts.length !== 1 ? 's' : ''}.`;
    if (noiseAccounts.length === 0) {
      noiseMsg = 'Your feed looks clean! No high-noise accounts detected.';
    } else if (noiseAccounts.length === 1) {
      noiseMsg = `1 account posts frequently but you rarely engage with it.`;
    } else {
      const topNoise = noiseAccounts[0];
      noiseMsg = `${topNoise.handle} is your noisiest account (${(topNoise.score * 100).toFixed(0)}% noise score).`;
    }

    noiseInsight.textContent = noiseMsg;
    engagementInsight.textContent = `You're following ${followingCount} accounts. You engage with ~${((analytics.noiseScores.reduce((sum, s) => sum + s.engagementRate, 0) / analytics.noiseScores.length) * 100).toFixed(0)}% of posts on average.`;
    reciprocityInsight.textContent = `${mutualPercent}% of your follows are mutual. Out of ${analytics.totalContributors} contributors, ${mutuals.length} are mutual follows.`;
  } catch (error) {
    console.error('[Universe] Failed to load insights:', error);
  }
}

// Load user table
async function loadUserTable() {
  try {
    const [profiles, analytics] = await Promise.all([
      getAllProfiles(),
      getAnalytics(),
    ]);

    if (profiles.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="placeholder">No users synced yet. Click Refresh to sync.</td>
        </tr>
      `;
      return;
    }

    // Create lookup maps for scores
    const noiseScoreMap = new Map(analytics.noiseScores.map((s) => [s.did, s]));
    const reciprocityMap = new Map(analytics.reciprocityScores.map((s) => [s.did, s]));

    // Sort by posts descending (top contributors first)
    const sorted = profiles.slice().sort((a, b) => {
      const aScore = noiseScoreMap.get(a.did)?.postCount || 0;
      const bScore = noiseScoreMap.get(b.did)?.postCount || 0;
      return bScore - aScore;
    });
    const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    userTableBody.innerHTML = paginated
      .map((profile) => {
        const noise = noiseScoreMap.get(profile.did);
        const reciprocity = reciprocityMap.get(profile.did);

        return `
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
        <td>${noise?.postCount || 0}</td>
        <td>${(noise?.engagementRate ? (noise.engagementRate * 100).toFixed(0) : 0)}%</td>
        <td>${reciprocity?.yourEngagement || 0}</td>
        <td><span class="score ${getNoiseScoreClass(noise?.score || 0)}">${noise ? (noise.score * 100).toFixed(0) : '--'}%</span></td>
        <td><span class="score">${reciprocity ? (reciprocity.score * 100).toFixed(0) : '--'}%</span></td>
      </tr>
    `;
      })
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

function getNoiseScoreClass(score: number): string {
  if (score > 0.7) return 'score-high';
  if (score > 0.4) return 'score-medium';
  return 'score-low';
}

// Load unfollow candidates
async function loadUnfollowCandidates() {
  try {
    const outliers = await getNoiseOutliers(0.7);
    if (outliers.length === 0) {
      unfollowCandidates.innerHTML = `<p class="placeholder">No unfollow candidates. Your feed looks good!</p>`;
      return;
    }

    const candidates = outliers
      .filter((s) => !s.isMutual) // Don't unfollow mutuals
      .slice(0, 5);

    let html = '<div class="candidate-list">';
    for (const candidate of candidates) {
      html += `
        <div class="candidate-card">
          <div class="candidate-handle">@${candidate.handle}</div>
          <div class="candidate-reason">
            <span>${candidate.postCount} posts</span>
            <span>${(candidate.engagementRate * 100).toFixed(0)}% engagement</span>
            <span>Noise: ${(candidate.score * 100).toFixed(0)}%</span>
          </div>
        </div>
      `;
    }
    html += '</div>';
    unfollowCandidates.innerHTML = html;
  } catch (error) {
    console.error('[Universe] Failed to load unfollow candidates:', error);
    unfollowCandidates.innerHTML = `<p class="placeholder">Error loading recommendations. Try refreshing.</p>`;
  }
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

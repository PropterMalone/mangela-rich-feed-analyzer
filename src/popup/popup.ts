/**
 * Popup script for Bluesky Universe
 */

import { countProfiles, countPosts, getMutuals, getFollowing, getFollowers } from '../db/index.js';

console.log('[Universe] Popup loaded');

// DOM elements
const statusValue = document.getElementById('status-value') as HTMLSpanElement;
const lastSyncEl = document.getElementById('last-sync') as HTMLSpanElement;
const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const dashboardBtn = document.getElementById('dashboard-btn') as HTMLButtonElement;

const followingCount = document.getElementById('following-count') as HTMLSpanElement;
const followersCount = document.getElementById('followers-count') as HTMLSpanElement;
const mutualsCount = document.getElementById('mutuals-count') as HTMLSpanElement;
const postsCount = document.getElementById('posts-count') as HTMLSpanElement;

const tabButtons = document.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
const tabContent = document.getElementById('tab-content') as HTMLDivElement;

// State
let currentTab = 'contributors';

// Initialize
async function init() {
  try {
    await loadStats();
    await checkStatus();
    setupEventListeners();
  } catch (error) {
    console.error('[Universe] Init error:', error);
    statusValue.textContent = 'Error';
  }
}

// Load statistics from database
async function loadStats() {
  try {
    const [following, followers, mutuals, posts] = await Promise.all([
      getFollowing(),
      getFollowers(),
      getMutuals(),
      countPosts(),
    ]);

    followingCount.textContent = String(following.length);
    followersCount.textContent = String(followers.length);
    mutualsCount.textContent = String(mutuals.length);
    postsCount.textContent = String(posts);
  } catch (error) {
    console.error('[Universe] Failed to load stats:', error);
    // Show placeholder values
    followingCount.textContent = '--';
    followersCount.textContent = '--';
    mutualsCount.textContent = '--';
    postsCount.textContent = '--';
  }
}

// Check extension status
async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (response.status === 'ok') {
      statusValue.textContent = 'Ready';
    }
  } catch (error) {
    console.error('[Universe] Status check failed:', error);
    statusValue.textContent = 'Error';
  }
}

// Setup event listeners
function setupEventListeners() {
  // Sync button
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ Syncing...';
    statusValue.textContent = 'Syncing...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_SYNC' });
      console.log('[Universe] Sync response:', response);

      // Reload stats after sync
      await loadStats();

      statusValue.textContent = 'Ready';
      lastSyncEl.textContent = 'Just now';
    } catch (error) {
      console.error('[Universe] Sync failed:', error);
      statusValue.textContent = 'Error';
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = '🔄 Sync Now';
    }
  });

  // Settings button
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Dashboard button
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard/dashboard.html'),
    });
  });

  // Tab buttons
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) {
        switchTab(tab);
      }
    });
  });
}

// Switch between tabs
function switchTab(tab: string) {
  currentTab = tab;

  // Update button states
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update content
  renderTabContent(tab);
}

// Render tab content
function renderTabContent(tab: string) {
  switch (tab) {
    case 'contributors':
      tabContent.innerHTML = '<p class="placeholder">Top contributors will appear here after syncing...</p>';
      break;
    case 'noise':
      tabContent.innerHTML = '<p class="placeholder">High-volume, low-engagement accounts will appear here...</p>';
      break;
    case 'engagement':
      tabContent.innerHTML = '<p class="placeholder">Your most engaged-with accounts will appear here...</p>';
      break;
    default:
      tabContent.innerHTML = '<p class="placeholder">Unknown tab</p>';
  }
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Start
init();

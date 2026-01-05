/**
 * Background service worker entry point
 * Handles syncing, alarms, and message passing
 */

import { openDatabase } from '../db/index.js';
import { runFullSync, runIncrementalSync } from './sync-manager.js';

console.log('[Universe] Background service worker starting...');

// Initialize database on startup
openDatabase()
  .then(() => {
    console.log('[Universe] Database initialized');
    setupAlarms();
  })
  .catch((error) => {
    console.error('[Universe] Failed to initialize database:', error);
  });

function setupAlarms(): void {
  chrome.alarms.clearAll();
  chrome.alarms.create('universe-full-sync', { periodInMinutes: 60 });
  chrome.alarms.create('universe-incremental-sync', { periodInMinutes: 15 });
  chrome.alarms.create('universe-cleanup', { periodInMinutes: 1440 }); // Daily
  console.log('[Universe] Alarms configured');
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Universe] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - set up initial state
    console.log('[Universe] First install, setting up...');
  }
});

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Universe] Received message:', message);

  switch (message.type) {
    case 'GET_STATUS':
      sendResponse({ status: 'ok', version: chrome.runtime.getManifest().version });
      break;

    case 'START_SYNC':
      runFullSync()
        .then(() => {
          sendResponse({ status: 'sync_complete' });
        })
        .catch((error) => {
          sendResponse({ status: 'sync_error', error: String(error) });
        });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('[Universe] Alarm fired:', alarm.name);

  switch (alarm.name) {
    case 'universe-full-sync':
      runFullSync().catch((error) => {
        console.error('[Universe] Full sync failed:', error);
      });
      break;

    case 'universe-incremental-sync':
      runIncrementalSync().catch((error) => {
        console.error('[Universe] Incremental sync failed:', error);
      });
      break;

    case 'universe-cleanup':
      cleanupOldData().catch((error) => {
        console.error('[Universe] Cleanup failed:', error);
      });
      break;
  }
});

async function cleanupOldData(): Promise<void> {
  console.log('[Universe] Starting data cleanup...');
  const db = await openDatabase();
  // Clean up posts older than 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const postsStore = db.transaction('posts', 'readwrite').objectStore('posts');
  const index = postsStore.index('by-created-at');
  const range = IDBKeyRange.upperBound(thirtyDaysAgo);
  const request = index.getAll(range);
  request.onsuccess = () => {
    const posts = request.result;
    posts.forEach((post) => {
      postsStore.delete(post.uri);
    });
    console.log(`[Universe] Cleaned up ${posts.length} old posts`);
  };
}

export {};

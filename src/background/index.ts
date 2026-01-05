/**
 * Background service worker entry point
 * Handles syncing, alarms, and message passing
 */

import { openDatabase } from '../db/index.js';

console.log('[Universe] Background service worker starting...');

// Initialize database on startup
openDatabase()
  .then(() => {
    console.log('[Universe] Database initialized');
  })
  .catch((error) => {
    console.error('[Universe] Failed to initialize database:', error);
  });

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
      // TODO: Implement sync
      sendResponse({ status: 'sync_started' });
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
      // TODO: Run full sync
      break;

    case 'universe-incremental-sync':
      // TODO: Run incremental sync
      break;

    case 'universe-cleanup':
      // TODO: Clean up old data
      break;
  }
});

export {};

/**
 * Options page script for Bluesky Universe
 */

import { deleteDatabase } from '../db/index.js';

console.log('[Universe] Options loaded');

// Default options
const DEFAULT_OPTIONS = {
  fullSyncInterval: 1, // hours
  incrementalInterval: 15, // minutes
  postsRetention: 30, // days
  engagementsRetention: 90, // days
  notifySync: false,
  notifyErrors: true,
};

type Options = typeof DEFAULT_OPTIONS;

// DOM elements
const form = document.getElementById('options-form') as HTMLFormElement;
const saveStatus = document.getElementById('save-status') as HTMLSpanElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

// Load options
async function loadOptions(): Promise<Options> {
  try {
    const result = await chrome.storage.sync.get('options');
    return { ...DEFAULT_OPTIONS, ...result.options };
  } catch (error) {
    console.error('[Universe] Failed to load options:', error);
    return DEFAULT_OPTIONS;
  }
}

// Save options
async function saveOptions(options: Options): Promise<void> {
  await chrome.storage.sync.set({ options });
}

// Populate form with current options
async function populateForm() {
  const options = await loadOptions();

  // Set select values
  (document.getElementById('full-sync-interval') as HTMLSelectElement).value = String(
    options.fullSyncInterval
  );
  (document.getElementById('incremental-interval') as HTMLSelectElement).value = String(
    options.incrementalInterval
  );
  (document.getElementById('posts-retention') as HTMLSelectElement).value = String(
    options.postsRetention
  );
  (document.getElementById('engagements-retention') as HTMLSelectElement).value = String(
    options.engagementsRetention
  );

  // Set checkboxes
  (document.getElementById('notify-sync') as HTMLInputElement).checked = options.notifySync;
  (document.getElementById('notify-errors') as HTMLInputElement).checked = options.notifyErrors;
}

// Get options from form
function getFormOptions(): Options {
  return {
    fullSyncInterval: parseInt(
      (document.getElementById('full-sync-interval') as HTMLSelectElement).value
    ),
    incrementalInterval: parseInt(
      (document.getElementById('incremental-interval') as HTMLSelectElement).value
    ),
    postsRetention: parseInt(
      (document.getElementById('posts-retention') as HTMLSelectElement).value
    ),
    engagementsRetention: parseInt(
      (document.getElementById('engagements-retention') as HTMLSelectElement).value
    ),
    notifySync: (document.getElementById('notify-sync') as HTMLInputElement).checked,
    notifyErrors: (document.getElementById('notify-errors') as HTMLInputElement).checked,
  };
}

// Show save status
function showStatus(message: string, isError = false) {
  saveStatus.textContent = message;
  saveStatus.className = isError ? 'save-status error' : 'save-status';

  // Clear after 3 seconds
  setTimeout(() => {
    saveStatus.textContent = '';
  }, 3000);
}

// Export data
async function exportData() {
  try {
    // Get all data from storage
    const data = {
      exportedAt: new Date().toISOString(),
      options: await loadOptions(),
      // TODO: Add IndexedDB export
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bluesky-universe-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus('Data exported!');
  } catch (error) {
    console.error('[Universe] Export failed:', error);
    showStatus('Export failed', true);
  }
}

// Clear all data
async function clearAllData() {
  const confirmed = confirm(
    'Are you sure you want to delete all Bluesky Universe data?\n\nThis will delete all synced profiles, posts, and analytics. This action cannot be undone.'
  );

  if (!confirmed) return;

  try {
    // Clear IndexedDB
    await deleteDatabase();

    // Clear storage
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();

    showStatus('All data cleared!');

    // Reload options
    await populateForm();
  } catch (error) {
    console.error('[Universe] Clear data failed:', error);
    showStatus('Failed to clear data', true);
  }
}

// Event listeners
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const options = getFormOptions();
    await saveOptions(options);
    showStatus('Options saved!');

    // Notify background to update alarms
    chrome.runtime.sendMessage({ type: 'OPTIONS_UPDATED', options });
  } catch (error) {
    console.error('[Universe] Save failed:', error);
    showStatus('Failed to save options', true);
  }
});

exportBtn.addEventListener('click', exportData);
clearBtn.addEventListener('click', clearAllData);

// Initialize
populateForm();

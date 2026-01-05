/**
 * Sync state store operations
 * Tracks sync progress and cursors for incremental syncing
 */

import { getByKey, put, getAll, clearStore } from './database.js';
import { SyncState, SyncStatus, STORE_NAMES } from './schema.js';

const STORE = STORE_NAMES.SYNC_STATE;

/**
 * Sync state keys
 */
export const SYNC_KEYS = {
  FOLLOWS: 'follows',
  FOLLOWERS: 'followers',
  TIMELINE: 'timeline',
  MY_POSTS: 'my-posts',
  MY_LIKES: 'my-likes',
} as const;

export type SyncKey = (typeof SYNC_KEYS)[keyof typeof SYNC_KEYS];

/**
 * Get sync state for a key
 */
export async function getSyncState(key: SyncKey): Promise<SyncState | undefined> {
  return getByKey<SyncState>(STORE, key);
}

/**
 * Get all sync states
 */
export async function getAllSyncStates(): Promise<SyncState[]> {
  return getAll<SyncState>(STORE);
}

/**
 * Save sync state
 */
export async function saveSyncState(state: SyncState): Promise<void> {
  return put(STORE, state);
}

/**
 * Update sync state with partial data
 */
export async function updateSyncState(
  key: SyncKey,
  update: Partial<Omit<SyncState, 'key'>>
): Promise<void> {
  const existing = await getSyncState(key);
  const updated: SyncState = {
    key,
    lastCursor: update.lastCursor ?? existing?.lastCursor,
    lastSyncAt: update.lastSyncAt ?? existing?.lastSyncAt ?? 0,
    itemsProcessed: update.itemsProcessed ?? existing?.itemsProcessed ?? 0,
    status: update.status ?? existing?.status ?? 'idle',
    error: update.error,
  };
  return saveSyncState(updated);
}

/**
 * Mark sync as started
 */
export async function startSync(key: SyncKey): Promise<void> {
  return updateSyncState(key, { status: 'syncing' });
}

/**
 * Mark sync as completed successfully
 */
export async function completeSync(
  key: SyncKey,
  cursor?: string,
  itemsProcessed?: number
): Promise<void> {
  const existing = await getSyncState(key);
  return updateSyncState(key, {
    status: 'idle',
    lastSyncAt: Date.now(),
    lastCursor: cursor ?? existing?.lastCursor,
    itemsProcessed: itemsProcessed ?? existing?.itemsProcessed,
    error: undefined,
  });
}

/**
 * Mark sync as failed
 */
export async function failSync(key: SyncKey, error: string): Promise<void> {
  return updateSyncState(key, {
    status: 'error',
    error,
  });
}

/**
 * Get last sync time for a key
 */
export async function getLastSyncTime(key: SyncKey): Promise<number | undefined> {
  const state = await getSyncState(key);
  return state?.lastSyncAt;
}

/**
 * Get cursor for incremental sync
 */
export async function getSyncCursor(key: SyncKey): Promise<string | undefined> {
  const state = await getSyncState(key);
  return state?.lastCursor;
}

/**
 * Check if a sync is currently in progress
 */
export async function isSyncing(key: SyncKey): Promise<boolean> {
  const state = await getSyncState(key);
  return state?.status === 'syncing';
}

/**
 * Check if any sync is in progress
 */
export async function isAnySyncing(): Promise<boolean> {
  const states = await getAllSyncStates();
  return states.some((s) => s.status === 'syncing');
}

/**
 * Get overall sync status summary
 */
export async function getSyncSummary(): Promise<{
  lastFullSync: number | undefined;
  isAnyRunning: boolean;
  hasErrors: boolean;
  states: Record<SyncKey, SyncStatus>;
}> {
  const states = await getAllSyncStates();

  const stateMap: Record<string, SyncStatus> = {};
  let lastFullSync: number | undefined;
  let isAnyRunning = false;
  let hasErrors = false;

  for (const state of states) {
    stateMap[state.key] = state.status;

    if (state.status === 'syncing') {
      isAnyRunning = true;
    }
    if (state.status === 'error') {
      hasErrors = true;
    }

    // Track oldest successful sync as "last full sync"
    if (state.lastSyncAt && (!lastFullSync || state.lastSyncAt < lastFullSync)) {
      lastFullSync = state.lastSyncAt;
    }
  }

  return {
    lastFullSync,
    isAnyRunning,
    hasErrors,
    states: stateMap as Record<SyncKey, SyncStatus>,
  };
}

/**
 * Clear all sync states
 */
export async function clearSyncStates(): Promise<void> {
  return clearStore(STORE);
}

/**
 * Reset a sync state (clear cursor, mark as idle)
 */
export async function resetSyncState(key: SyncKey): Promise<void> {
  return saveSyncState({
    key,
    lastCursor: undefined,
    lastSyncAt: 0,
    itemsProcessed: 0,
    status: 'idle',
    error: undefined,
  });
}

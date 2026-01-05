/**
 * Profile store operations
 */

import { getByKey, put, putBatch, getAll, getByIndex, count, clearStore } from './database.js';
import { StoredProfile, STORE_NAMES } from './schema.js';

const STORE = STORE_NAMES.PROFILES;

/**
 * Get a profile by DID
 */
export async function getProfile(did: string): Promise<StoredProfile | undefined> {
  return getByKey<StoredProfile>(STORE, did);
}

/**
 * Get a profile by handle
 */
export async function getProfileByHandle(handle: string): Promise<StoredProfile | undefined> {
  const profiles = await getByIndex<StoredProfile>(STORE, 'by-handle', handle);
  return profiles[0];
}

/**
 * Save or update a profile
 */
export async function saveProfile(profile: StoredProfile): Promise<void> {
  return put(STORE, profile);
}

/**
 * Save multiple profiles
 */
export async function saveProfiles(profiles: StoredProfile[]): Promise<void> {
  return putBatch(STORE, profiles);
}

/**
 * Get all profiles
 */
export async function getAllProfiles(): Promise<StoredProfile[]> {
  return getAll<StoredProfile>(STORE);
}

/**
 * Get all profiles you follow
 * Note: We use getAll + filter because IndexedDB boolean indexes
 * have inconsistent behavior across implementations
 */
export async function getFollowing(): Promise<StoredProfile[]> {
  const all = await getAll<StoredProfile>(STORE);
  return all.filter((p) => p.youFollow);
}

/**
 * Get all profiles that follow you
 */
export async function getFollowers(): Promise<StoredProfile[]> {
  const all = await getAll<StoredProfile>(STORE);
  return all.filter((p) => p.followsYou);
}

/**
 * Get all mutual follows
 */
export async function getMutuals(): Promise<StoredProfile[]> {
  const all = await getAll<StoredProfile>(STORE);
  return all.filter((p) => p.isMutual);
}

/**
 * Count total profiles
 */
export async function countProfiles(): Promise<number> {
  return count(STORE);
}

/**
 * Clear all profiles
 */
export async function clearProfiles(): Promise<void> {
  return clearStore(STORE);
}

/**
 * Create or update profile from API data
 */
export function createProfile(
  did: string,
  handle: string,
  displayName?: string,
  avatar?: string,
  followsYou = false,
  youFollow = false
): StoredProfile {
  return {
    did,
    handle,
    displayName,
    avatar,
    followsYou,
    youFollow,
    isMutual: followsYou && youFollow,
    lastUpdated: Date.now(),
  };
}

/**
 * Merge new profile data with existing profile
 */
export function mergeProfile(
  existing: StoredProfile | undefined,
  update: Partial<StoredProfile>
): StoredProfile {
  const now = Date.now();

  if (!existing) {
    return {
      did: update.did || '',
      handle: update.handle || '',
      displayName: update.displayName,
      avatar: update.avatar,
      followsYou: update.followsYou ?? false,
      youFollow: update.youFollow ?? false,
      isMutual: (update.followsYou ?? false) && (update.youFollow ?? false),
      lastUpdated: now,
    };
  }

  const merged = {
    ...existing,
    ...update,
    lastUpdated: now,
  };

  // Recompute isMutual
  merged.isMutual = merged.followsYou && merged.youFollow;

  return merged;
}

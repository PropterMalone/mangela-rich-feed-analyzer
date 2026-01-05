/**
 * Sync follows and followers
 */

import { getAllFollows, getAllFollowers, getCurrentDid } from '../api/index.js';
import { saveProfiles, mergeProfile, getProfile } from '../db/index.js';
import { startSync, completeSync, failSync, SYNC_KEYS } from '../db/sync-state.js';

export async function syncFollows(): Promise<number> {
  const myDid = getCurrentDid();
  if (!myDid) throw new Error('Not authenticated');

  await startSync(SYNC_KEYS.FOLLOWS);

  try {
    console.log('[MangeLa] Syncing follows...');
    const follows = await getAllFollows(myDid, (count) => {
      console.log(`[MangeLa] Fetched ${count} follows`);
    });

    const followProfiles = follows.map((profile) => ({
      did: profile.did,
      handle: profile.handle,
      displayName: profile.displayName,
      avatar: profile.avatar,
      youFollow: true,
      followsYou: false,
      isMutual: false,
      lastUpdated: Date.now(),
    }));

    await saveProfiles(followProfiles);
    await completeSync(SYNC_KEYS.FOLLOWS, undefined, follows.length);

    console.log(`[MangeLa] Synced ${follows.length} follows`);
    return follows.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failSync(SYNC_KEYS.FOLLOWS, message);
    throw error;
  }
}

export async function syncFollowers(): Promise<number> {
  const myDid = getCurrentDid();
  if (!myDid) throw new Error('Not authenticated');

  await startSync(SYNC_KEYS.FOLLOWERS);

  try {
    console.log('[MangeLa] Syncing followers...');
    const followers = await getAllFollowers(myDid, (count) => {
      console.log(`[MangeLa] Fetched ${count} followers`);
    });

    // Merge with existing profiles
    const followerProfiles = await Promise.all(
      followers.map(async (profile) => {
        const existing = await getProfile(profile.did);
        return mergeProfile(existing, {
          did: profile.did,
          handle: profile.handle,
          displayName: profile.displayName,
          avatar: profile.avatar,
          followsYou: true,
        });
      })
    );

    await saveProfiles(followerProfiles);
    await completeSync(SYNC_KEYS.FOLLOWERS, undefined, followers.length);

    console.log(`[MangeLa] Synced ${followers.length} followers`);
    return followers.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failSync(SYNC_KEYS.FOLLOWERS, message);
    throw error;
  }
}

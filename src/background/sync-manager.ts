/**
 * Orchestrate all sync jobs
 */

import { syncFollows, syncFollowers } from './sync-follows.js';
import { syncPosts } from './sync-posts.js';
import { syncEngagements } from './sync-engagements.js';
import { getRateLimiter } from '../api/index.js';

export interface SyncOptions {
  includeFollows?: boolean;
  includeFollowers?: boolean;
  includePosts?: boolean;
  includeEngagements?: boolean;
  postsWindow?: number; // days back
  engagementsWindow?: number; // days back
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  includeFollows: true,
  includeFollowers: true,
  includePosts: true,
  includeEngagements: true,
  postsWindow: 7,
  engagementsWindow: 7,
};

export async function runFullSync(options: SyncOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

  const limiter = getRateLimiter();
  const startStats = limiter.getStats();

  console.log('[MangeLa] Starting full sync...');
  console.log('[MangeLa] Rate limit stats:', startStats);

  try {
    // Sync follows first (needs to populate profiles)
    if (opts.includeFollows) {
      console.log('[MangeLa] → Syncing follows...');
      const count = await syncFollows();
      console.log(`[MangeLa] ✓ Synced ${count} follows`);
    }

    if (opts.includeFollowers) {
      console.log('[MangeLa] → Syncing followers...');
      const count = await syncFollowers();
      console.log(`[MangeLa] ✓ Synced ${count} followers`);
    }

    // Then sync posts from followed accounts
    if (opts.includePosts) {
      console.log('[MangeLa] → Syncing posts...');
      const count = await syncPosts(opts.postsWindow);
      console.log(`[MangeLa] ✓ Synced ${count} posts`);
    }

    // Finally sync engagements on your posts
    if (opts.includeEngagements) {
      console.log('[MangeLa] → Syncing engagements...');
      const count = await syncEngagements(opts.engagementsWindow);
      console.log(`[MangeLa] ✓ Synced ${count} engagements`);
    }

    const endStats = limiter.getStats();
    console.log('[MangeLa] Full sync complete!');
    console.log('[MangeLa] Final rate limit stats:', endStats);
  } catch (error) {
    console.error('[MangeLa] Sync failed:', error);
    throw error;
  }
}

export async function runIncrementalSync(): Promise<void> {
  console.log('[MangeLa] Starting incremental sync...');

  try {
    // Just get new posts and engagements
    const postsCount = await syncPosts(1); // Last 24 hours
    const engagementsCount = await syncEngagements(1);

    console.log('[MangeLa] Incremental sync complete!');
    console.log(`[MangeLa] Synced ${postsCount} posts and ${engagementsCount} engagements`);
  } catch (error) {
    console.error('[MangeLa] Incremental sync failed:', error);
    throw error;
  }
}

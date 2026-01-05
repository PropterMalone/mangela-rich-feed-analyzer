/**
 * Sync posts from followed accounts
 */

import { getAuthorFeed } from '../api/index.js';
import { getAllProfiles, savePosts, createPost } from '../db/index.js';
import { startSync, completeSync, failSync, SYNC_KEYS } from '../db/sync-state.js';

const BATCH_SIZE = 10; // Concurrent requests

export async function syncPosts(daysBack = 7): Promise<number> {
  await startSync(SYNC_KEYS.TIMELINE);

  try {
    console.log('[MangeLa] Syncing posts...');

    // Get all profiles we follow
    const profiles = await getAllProfiles();
    const following = profiles.filter((p) => p.youFollow);

    let totalPosts = 0;
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Sync in batches to avoid overwhelming the API
    for (let i = 0; i < following.length; i += BATCH_SIZE) {
      const batch = following.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((profile) =>
          syncAuthorFeed(profile.did, profile.handle, cutoffTime)
        )
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalPosts += result.value;
        } else {
          console.error('[MangeLa] Error syncing posts:', result.reason);
        }
      }

      console.log(`[MangeLa] Processed ${Math.min(i + BATCH_SIZE, following.length)}/${following.length} accounts`);
    }

    await completeSync(SYNC_KEYS.TIMELINE, undefined, totalPosts);
    console.log(`[MangeLa] Synced ${totalPosts} posts`);
    return totalPosts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failSync(SYNC_KEYS.TIMELINE, message);
    throw error;
  }
}

async function syncAuthorFeed(did: string, handle: string, cutoffTime: number): Promise<number> {
  let cursor: string | undefined;
  let postsCount = 0;

  // Paginate through author's feed
  while (true) {
    const response = await getAuthorFeed(did, 100, cursor);

    for (const feedPost of response.feed) {
      const post = feedPost.post;

      // Stop if post is older than cutoff
      const createdAt = new Date(post.record.createdAt).getTime();
      if (createdAt < cutoffTime) {
        return postsCount;
      }

      // Create StoredPost
      const storedPost = createPost(
        post.uri,
        post.cid,
        post.author.did,
        post.author.handle,
        post.record.createdAt,
        'post',
        {
          textPreview: post.record.text,
          likeCount: post.likeCount ?? 0,
          repostCount: post.repostCount ?? 0,
          replyCount: post.replyCount ?? 0,
          quoteCount: post.quoteCount ?? 0,
          indexedAt: post.indexedAt,
        }
      );

      // Handle reposts
      if (feedPost.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
        storedPost.postType = 'repost';
        storedPost.repostedByDid = did;
        storedPost.repostedByHandle = handle;
      }

      // Handle quotes
      if (post.record.embed?.$type === 'app.bsky.embed.record' && post.record.embed.record) {
        storedPost.postType = 'quote';
        storedPost.quotedUri = post.record.embed.record.uri;
      }

      await savePosts([storedPost]);
      postsCount++;
    }

    // Continue with next page or stop
    if (!response.cursor) {
      return postsCount;
    }
    cursor = response.cursor;
  }
}

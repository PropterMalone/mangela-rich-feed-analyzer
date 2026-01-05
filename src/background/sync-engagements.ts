/**
 * Sync engagements on your posts (likes, replies, quotes)
 */

import { getAuthorFeed, getAllLikes, getQuotes, getPostThread } from '../api/index.js';
import { getCurrentDid } from '../api/index.js';
import { recordLikeReceived, recordReplyReceived, recordQuoteReceived } from '../db/index.js';
import { startSync, completeSync, failSync, SYNC_KEYS } from '../db/sync-state.js';

export async function syncEngagements(daysBack = 7): Promise<number> {
  const myDid = getCurrentDid();
  if (!myDid) throw new Error('Not authenticated');

  await startSync(SYNC_KEYS.MY_POSTS);

  try {
    console.log('[MangeLa] Syncing engagements on your posts...');

    let cursor: string | undefined;
    let engagementCount = 0;
    const cutoffTime = Date.now() - daysBack * 24 * 60 * 60 * 1000;

    // Paginate through your posts
    while (true) {
      const response = await getAuthorFeed(myDid, 100, cursor);

      for (const feedPost of response.feed) {
        const post = feedPost.post;

        // Stop if post is older than cutoff
        const createdAt = new Date(post.record.createdAt).getTime();
        if (createdAt < cutoffTime) {
          await completeSync(SYNC_KEYS.MY_POSTS, undefined, engagementCount);
          console.log(`[MangeLa] Synced ${engagementCount} engagements`);
          return engagementCount;
        }

        // Sync likes
        try {
          const likes = await getAllLikes(post.uri);
          for (const like of likes) {
            await recordLikeReceived(post.uri, like.actor.did, like.actor.handle);
            engagementCount++;
          }
        } catch (error) {
          console.error('[MangeLa] Error syncing likes:', error);
        }

        // Sync quotes
        try {
          const quotes = await getQuotes(post.uri);
          for (const quote of quotes.posts) {
            await recordQuoteReceived(post.uri, quote.author.did, quote.author.handle, quote.uri);
            engagementCount++;
          }
        } catch (error) {
          console.error('[MangeLa] Error syncing quotes:', error);
        }

        // Sync replies via thread
        try {
          const thread = await getPostThread(post.uri, 6, 0);
          const replies = thread.thread.replies ?? [];
          for (const reply of replies) {
            if (reply.$type === 'app.bsky.feed.defs#threadViewPost') {
              const replyPost = reply.post;
              await recordReplyReceived(
                post.uri,
                replyPost.author.did,
                replyPost.author.handle,
                replyPost.uri
              );
              engagementCount++;
            }
          }
        } catch (error) {
          console.error('[MangeLa] Error syncing replies:', error);
        }
      }

      // Continue with next page or stop
      if (!response.cursor) {
        await completeSync(SYNC_KEYS.MY_POSTS, undefined, engagementCount);
        console.log(`[MangeLa] Synced ${engagementCount} engagements`);
        return engagementCount;
      }
      cursor = response.cursor;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failSync(SYNC_KEYS.MY_POSTS, message);
    throw error;
  }
}

/**
 * Posts store operations
 */

import {
  getByKey,
  put,
  putBatch,
  getAll,
  getByIndex,
  getByIndexRange,
  count,
  clearStore,
  deleteOlderThan,
} from './database.js';
import { StoredPost, PostType, STORE_NAMES } from './schema.js';

const STORE = STORE_NAMES.POSTS;

/**
 * Get a post by URI
 */
export async function getPost(uri: string): Promise<StoredPost | undefined> {
  return getByKey<StoredPost>(STORE, uri);
}

/**
 * Save or update a post
 */
export async function savePost(post: StoredPost): Promise<void> {
  return put(STORE, post);
}

/**
 * Save multiple posts
 */
export async function savePosts(posts: StoredPost[]): Promise<void> {
  return putBatch(STORE, posts);
}

/**
 * Get all posts
 */
export async function getAllPosts(): Promise<StoredPost[]> {
  return getAll<StoredPost>(STORE);
}

/**
 * Get posts by author DID
 */
export async function getPostsByAuthor(authorDid: string): Promise<StoredPost[]> {
  return getByIndex<StoredPost>(STORE, 'by-author', authorDid);
}

/**
 * Get posts by type
 */
export async function getPostsByType(postType: PostType): Promise<StoredPost[]> {
  return getByIndex<StoredPost>(STORE, 'by-type', postType);
}

/**
 * Get posts created within a date range
 */
export async function getPostsInDateRange(startMs: number, endMs: number): Promise<StoredPost[]> {
  const range = IDBKeyRange.bound(startMs, endMs);
  return getByIndexRange<StoredPost>(STORE, 'by-created', range);
}

/**
 * Get posts fetched since a given time
 */
export async function getPostsFetchedSince(timestampMs: number): Promise<StoredPost[]> {
  const range = IDBKeyRange.lowerBound(timestampMs);
  return getByIndexRange<StoredPost>(STORE, 'by-fetched', range);
}

/**
 * Count total posts
 */
export async function countPosts(): Promise<number> {
  return count(STORE);
}

/**
 * Clear all posts
 */
export async function clearPosts(): Promise<void> {
  return clearStore(STORE);
}

/**
 * Delete posts older than given timestamp (by createdAt)
 */
export async function deletePostsOlderThan(timestampMs: number): Promise<number> {
  return deleteOlderThan(STORE, 'by-created', timestampMs);
}

/**
 * Delete posts fetched before given timestamp
 */
export async function deletePostsFetchedBefore(timestampMs: number): Promise<number> {
  return deleteOlderThan(STORE, 'by-fetched', timestampMs);
}

/**
 * Create a StoredPost from API response data
 */
export function createPost(
  uri: string,
  cid: string,
  authorDid: string,
  authorHandle: string,
  createdAt: Date | string,
  postType: PostType,
  options: {
    indexedAt?: Date | string;
    repostedByDid?: string;
    repostedByHandle?: string;
    replyParentUri?: string;
    replyRootUri?: string;
    quotedUri?: string;
    textPreview?: string;
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
    quoteCount?: number;
  } = {}
): StoredPost {
  const createdAtMs =
    typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime();
  const indexedAtMs = options.indexedAt
    ? typeof options.indexedAt === 'string'
      ? new Date(options.indexedAt).getTime()
      : options.indexedAt.getTime()
    : createdAtMs;

  return {
    uri,
    cid,
    authorDid,
    authorHandle,
    createdAt: createdAtMs,
    indexedAt: indexedAtMs,
    postType,
    repostedByDid: options.repostedByDid,
    repostedByHandle: options.repostedByHandle,
    replyParentUri: options.replyParentUri,
    replyRootUri: options.replyRootUri,
    quotedUri: options.quotedUri,
    textPreview: options.textPreview?.slice(0, 200),
    likeCount: options.likeCount ?? 0,
    repostCount: options.repostCount ?? 0,
    replyCount: options.replyCount ?? 0,
    quoteCount: options.quoteCount ?? 0,
    fetchedAt: Date.now(),
  };
}

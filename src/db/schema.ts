/**
 * IndexedDB Schema for Bluesky Universe
 */

export const DB_NAME = 'bluesky-universe-db';
export const DB_VERSION = 1;

/**
 * Profile of a user you follow or who follows you
 */
export interface StoredProfile {
  did: string; // Primary key
  handle: string;
  displayName?: string;
  avatar?: string;
  followsYou: boolean; // They follow you
  youFollow: boolean; // You follow them
  isMutual: boolean; // Computed: both ways
  lastUpdated: number; // Timestamp
}

/**
 * Post type classification
 */
export type PostType = 'post' | 'repost' | 'reply' | 'quote';

/**
 * A post from your universe
 */
export interface StoredPost {
  uri: string; // Primary key (at:// URI)
  cid: string;
  authorDid: string; // Index
  authorHandle: string;
  createdAt: number; // Timestamp, Index
  indexedAt: number; // When Bluesky indexed it
  postType: PostType;

  // For reposts: who reposted it (the person you follow)
  repostedByDid?: string;
  repostedByHandle?: string;

  // For replies: what post it's replying to
  replyParentUri?: string;
  replyRootUri?: string;

  // For quotes: what post is being quoted
  quotedUri?: string;

  // Text preview (first 200 chars for search/display)
  textPreview?: string;

  // Engagement counts at time of fetch
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quoteCount: number;

  // Sync metadata
  fetchedAt: number; // When we fetched this
}

/**
 * Interaction type
 */
export type InteractionType = 'like' | 'reply' | 'quote' | 'repost';

/**
 * Your interactions with posts (likes, replies, quotes you made)
 */
export interface StoredInteraction {
  id: string; // Composite: `${type}:${targetUri}`
  type: InteractionType;
  targetUri: string; // The post you interacted with
  targetAuthorDid: string; // Index
  createdAt: number; // When you did it

  // For replies/quotes: URI of your post
  yourPostUri?: string;
}

/**
 * Engagement received on YOUR posts
 */
export interface StoredEngagement {
  id: string; // Composite: `${type}:${fromDid}:${targetUri}`
  type: InteractionType;
  targetUri: string; // Your post that received engagement
  fromDid: string; // Index - who engaged
  fromHandle: string;
  createdAt: number;

  // For replies/quotes: their post URI
  theirPostUri?: string;
}

/**
 * Sync status
 */
export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * Sync state tracking
 */
export interface SyncState {
  key: string; // 'follows' | 'followers' | 'timeline' | 'my-posts' etc
  lastCursor?: string; // Pagination cursor for incremental sync
  lastSyncAt: number;
  itemsProcessed: number;
  status: SyncStatus;
  error?: string;
}

/**
 * Pre-computed analytics (cached for performance)
 */
export interface CachedAnalytics {
  id: string; // 'user-stats' | 'engagement-summary' | etc
  computedAt: number;
  validUntil: number;
  data: unknown; // Typed per analytics type
}

/**
 * Store names for IndexedDB
 */
export const STORE_NAMES = {
  PROFILES: 'profiles',
  POSTS: 'posts',
  INTERACTIONS: 'interactions',
  ENGAGEMENTS: 'engagements',
  SYNC_STATE: 'syncState',
  CACHED_ANALYTICS: 'cachedAnalytics',
} as const;

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

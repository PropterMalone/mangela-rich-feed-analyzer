/**
 * Database module exports
 */

// Core database operations
export {
  openDatabase,
  closeDatabase,
  deleteDatabase,
  getByKey,
  put,
  putBatch,
  deleteByKey,
  getAll,
  getByIndex,
  getByIndexRange,
  count,
  clearStore,
  deleteOlderThan,
} from './database.js';

// Schema and types
export {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  type StoreName,
  type StoredProfile,
  type StoredPost,
  type PostType,
  type StoredInteraction,
  type StoredEngagement,
  type InteractionType,
  type SyncState,
  type SyncStatus,
  type CachedAnalytics,
} from './schema.js';

// Profiles
export {
  getProfile,
  getProfileByHandle,
  saveProfile,
  saveProfiles,
  getAllProfiles,
  getFollowing,
  getFollowers,
  getMutuals,
  countProfiles,
  clearProfiles,
  createProfile,
  mergeProfile,
} from './profiles.js';

// Posts
export {
  getPost,
  savePost,
  savePosts,
  getAllPosts,
  getPostsByAuthor,
  getPostsByType,
  getPostsInDateRange,
  getPostsFetchedSince,
  countPosts,
  clearPosts,
  deletePostsOlderThan,
  deletePostsFetchedBefore,
  createPost,
} from './posts.js';

// Interactions
export {
  makeInteractionId,
  getInteraction,
  hasInteraction,
  saveInteraction,
  saveInteractions,
  deleteInteraction,
  getAllInteractions,
  getInteractionsByType,
  getInteractionsWithAuthor,
  getInteractionsInDateRange,
  countInteractions,
  clearInteractions,
  createInteraction,
  recordLike,
  recordReply,
  recordQuote,
  recordRepost,
} from './interactions.js';

// Engagements
export {
  makeEngagementId,
  getEngagement,
  saveEngagement,
  saveEngagements,
  getAllEngagements,
  getEngagementsByType,
  getEngagementsFromUser,
  getEngagementsInDateRange,
  countEngagements,
  clearEngagements,
  createEngagement,
  recordLikeReceived,
  recordReplyReceived,
  recordQuoteReceived,
  recordRepostReceived,
} from './engagements.js';

// Sync state
export {
  SYNC_KEYS,
  type SyncKey,
  getSyncState,
  getAllSyncStates,
  saveSyncState,
  updateSyncState,
  startSync,
  completeSync,
  failSync,
  getLastSyncTime,
  getSyncCursor,
  isSyncing,
  isAnySyncing,
  getSyncSummary,
  clearSyncStates,
  resetSyncState,
} from './sync-state.js';

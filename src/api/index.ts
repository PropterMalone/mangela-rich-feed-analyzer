/**
 * API module exports
 */

// Types
export type {
  BskySession,
  BskyAccount,
  BskyStorageStructure,
  ProfileView,
  PostView,
  FeedViewPost,
  GetFollowsResponse,
  GetFollowersResponse,
  GetTimelineResponse,
  GetAuthorFeedResponse,
  GetLikesResponse,
  GetRepostedByResponse,
  GetQuotesResponse,
  GetPostThreadResponse,
  ThreadViewPost,
  BskyApiError,
} from './types.js';

// Session
export { getSession, hasSession, getCurrentDid, getCurrentHandle } from './session.js';

// Rate limiter
export {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter,
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimiterConfig,
} from './rate-limiter.js';

// Client
export {
  ApiError,
  AuthError,
  getProfile,
  getFollows,
  getAllFollows,
  getFollowers,
  getAllFollowers,
  getTimeline,
  getAuthorFeed,
  getLikes,
  getAllLikes,
  getRepostedBy,
  getQuotes,
  getPostThread,
} from './client.js';

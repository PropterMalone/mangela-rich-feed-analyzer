/**
 * Bluesky API client
 */

import { getSession } from './session.js';
import { getRateLimiter } from './rate-limiter.js';
import type {
  BskySession,
  BskyApiError,
  ProfileView,
  GetFollowsResponse,
  GetFollowersResponse,
  GetTimelineResponse,
  GetAuthorFeedResponse,
  GetLikesResponse,
  GetRepostedByResponse,
  GetQuotesResponse,
  GetPostThreadResponse,
} from './types.js';

// Public Bluesky API endpoint (AppView)
const BSKY_PUBLIC_API = 'https://public.api.bsky.app';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public error?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthError extends ApiError {
  constructor(message: string) {
    super(message, 401, 'AuthRequired');
    this.name = 'AuthError';
  }
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  method = 'GET',
  body: unknown = null,
  baseUrl: string | null = null,
  session: BskySession | null = null
): Promise<T> {
  const actualSession = session ?? getSession();
  if (!actualSession) {
    throw new AuthError('Not logged in to Bluesky');
  }

  // Wait for rate limit slot
  const rateLimiter = getRateLimiter();
  await rateLimiter.waitForSlot();

  // Determine correct base URL
  let base = baseUrl;
  if (!base) {
    if (endpoint.startsWith('com.atproto.repo.')) {
      base = actualSession.pdsUrl;
    } else {
      base = BSKY_PUBLIC_API;
    }
  }

  base = base.replace(/\/+$/, '');
  const url = `${base}/xrpc/${endpoint}`;

  console.log('[Universe] API request:', method, url);

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${actualSession.accessJwt}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as BskyApiError;
    console.error('[Universe] API error:', response.status, errorData);

    if (response.status === 401) {
      throw new AuthError(errorData.message || 'Authentication failed');
    }

    throw new ApiError(
      errorData.message || `API error: ${response.status}`,
      response.status,
      errorData.error
    );
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Make an unauthenticated public API request
 */
async function publicApiRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const rateLimiter = getRateLimiter();
  await rateLimiter.waitForSlot();

  const queryString = new URLSearchParams(params).toString();
  const url = `${BSKY_PUBLIC_API}/xrpc/${endpoint}${queryString ? '?' + queryString : ''}`;

  console.log('[Universe] Public API request:', url);

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as BskyApiError;
    throw new ApiError(
      errorData.message || `API error: ${response.status}`,
      response.status,
      errorData.error
    );
  }

  return response.json() as Promise<T>;
}

// ============ Profile APIs ============

/**
 * Get a user's profile
 */
export async function getProfile(actor: string): Promise<ProfileView> {
  return publicApiRequest<ProfileView>('app.bsky.actor.getProfile', { actor });
}

/**
 * Get accounts that a user follows
 */
export async function getFollows(
  actor: string,
  limit = 100,
  cursor?: string
): Promise<GetFollowsResponse> {
  const params: Record<string, string> = { actor, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetFollowsResponse>('app.bsky.graph.getFollows', params);
}

/**
 * Get all follows for a user (handles pagination)
 */
export async function getAllFollows(
  actor: string,
  onProgress?: (count: number) => void
): Promise<ProfileView[]> {
  const allFollows: ProfileView[] = [];
  let cursor: string | undefined;

  do {
    const response = await getFollows(actor, 100, cursor);
    allFollows.push(...response.follows);
    cursor = response.cursor;
    onProgress?.(allFollows.length);
  } while (cursor);

  return allFollows;
}

/**
 * Get accounts that follow a user
 */
export async function getFollowers(
  actor: string,
  limit = 100,
  cursor?: string
): Promise<GetFollowersResponse> {
  const params: Record<string, string> = { actor, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetFollowersResponse>('app.bsky.graph.getFollowers', params);
}

/**
 * Get all followers for a user (handles pagination)
 */
export async function getAllFollowers(
  actor: string,
  onProgress?: (count: number) => void
): Promise<ProfileView[]> {
  const allFollowers: ProfileView[] = [];
  let cursor: string | undefined;

  do {
    const response = await getFollowers(actor, 100, cursor);
    allFollowers.push(...response.followers);
    cursor = response.cursor;
    onProgress?.(allFollowers.length);
  } while (cursor);

  return allFollowers;
}

// ============ Feed APIs ============

/**
 * Get the authenticated user's timeline
 */
export async function getTimeline(limit = 100, cursor?: string): Promise<GetTimelineResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return apiRequest<GetTimelineResponse>(`app.bsky.feed.getTimeline?${params}`);
}

/**
 * Get posts from a specific author
 */
export async function getAuthorFeed(
  actor: string,
  limit = 100,
  cursor?: string,
  filter: 'posts_with_replies' | 'posts_no_replies' | 'posts_and_author_threads' = 'posts_with_replies'
): Promise<GetAuthorFeedResponse> {
  const params: Record<string, string> = { actor, limit: String(limit), filter };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetAuthorFeedResponse>('app.bsky.feed.getAuthorFeed', params);
}

// ============ Engagement APIs ============

/**
 * Get users who liked a post
 */
export async function getLikes(
  uri: string,
  limit = 100,
  cursor?: string
): Promise<GetLikesResponse> {
  const params: Record<string, string> = { uri, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetLikesResponse>('app.bsky.feed.getLikes', params);
}

/**
 * Get all likes for a post (handles pagination)
 */
export async function getAllLikes(
  uri: string,
  onProgress?: (count: number) => void
): Promise<GetLikesResponse['likes']> {
  const allLikes: GetLikesResponse['likes'] = [];
  let cursor: string | undefined;

  do {
    const response = await getLikes(uri, 100, cursor);
    allLikes.push(...response.likes);
    cursor = response.cursor;
    onProgress?.(allLikes.length);
  } while (cursor);

  return allLikes;
}

/**
 * Get users who reposted a post
 */
export async function getRepostedBy(
  uri: string,
  limit = 100,
  cursor?: string
): Promise<GetRepostedByResponse> {
  const params: Record<string, string> = { uri, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetRepostedByResponse>('app.bsky.feed.getRepostedBy', params);
}

/**
 * Get posts that quote a specific post
 */
export async function getQuotes(
  uri: string,
  limit = 100,
  cursor?: string
): Promise<GetQuotesResponse> {
  const params: Record<string, string> = { uri, limit: String(limit) };
  if (cursor) params.cursor = cursor;
  return publicApiRequest<GetQuotesResponse>('app.bsky.feed.getQuotes', params);
}

/**
 * Get a post thread (includes replies)
 */
export async function getPostThread(
  uri: string,
  depth = 6,
  parentHeight = 0
): Promise<GetPostThreadResponse> {
  const params: Record<string, string> = {
    uri,
    depth: String(depth),
    parentHeight: String(parentHeight),
  };
  return publicApiRequest<GetPostThreadResponse>('app.bsky.feed.getPostThread', params);
}

/**
 * Engagements store operations
 * Tracks OTHER people's engagement with YOUR posts
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
} from './database.js';
import { StoredEngagement, InteractionType, STORE_NAMES } from './schema.js';

const STORE = STORE_NAMES.ENGAGEMENTS;

/**
 * Generate engagement ID
 */
export function makeEngagementId(
  type: InteractionType,
  fromDid: string,
  targetUri: string
): string {
  return `${type}:${fromDid}:${targetUri}`;
}

/**
 * Get an engagement by ID
 */
export async function getEngagement(id: string): Promise<StoredEngagement | undefined> {
  return getByKey<StoredEngagement>(STORE, id);
}

/**
 * Save an engagement
 */
export async function saveEngagement(engagement: StoredEngagement): Promise<void> {
  return put(STORE, engagement);
}

/**
 * Save multiple engagements
 */
export async function saveEngagements(engagements: StoredEngagement[]): Promise<void> {
  return putBatch(STORE, engagements);
}

/**
 * Get all engagements
 */
export async function getAllEngagements(): Promise<StoredEngagement[]> {
  return getAll<StoredEngagement>(STORE);
}

/**
 * Get engagements by type
 */
export async function getEngagementsByType(type: InteractionType): Promise<StoredEngagement[]> {
  return getByIndex<StoredEngagement>(STORE, 'by-type', type);
}

/**
 * Get engagements from a specific user
 */
export async function getEngagementsFromUser(fromDid: string): Promise<StoredEngagement[]> {
  return getByIndex<StoredEngagement>(STORE, 'by-from', fromDid);
}

/**
 * Get engagements within a date range
 */
export async function getEngagementsInDateRange(
  startMs: number,
  endMs: number
): Promise<StoredEngagement[]> {
  const range = IDBKeyRange.bound(startMs, endMs);
  return getByIndexRange<StoredEngagement>(STORE, 'by-created', range);
}

/**
 * Count total engagements
 */
export async function countEngagements(): Promise<number> {
  return count(STORE);
}

/**
 * Clear all engagements
 */
export async function clearEngagements(): Promise<void> {
  return clearStore(STORE);
}

/**
 * Create an engagement record
 */
export function createEngagement(
  type: InteractionType,
  targetUri: string,
  fromDid: string,
  fromHandle: string,
  theirPostUri?: string
): StoredEngagement {
  return {
    id: makeEngagementId(type, fromDid, targetUri),
    type,
    targetUri,
    fromDid,
    fromHandle,
    createdAt: Date.now(),
    theirPostUri,
  };
}

/**
 * Record a like on your post
 */
export async function recordLikeReceived(
  targetUri: string,
  fromDid: string,
  fromHandle: string
): Promise<void> {
  const engagement = createEngagement('like', targetUri, fromDid, fromHandle);
  return saveEngagement(engagement);
}

/**
 * Record a reply to your post
 */
export async function recordReplyReceived(
  targetUri: string,
  fromDid: string,
  fromHandle: string,
  theirReplyUri: string
): Promise<void> {
  const engagement = createEngagement('reply', targetUri, fromDid, fromHandle, theirReplyUri);
  return saveEngagement(engagement);
}

/**
 * Record a quote of your post
 */
export async function recordQuoteReceived(
  targetUri: string,
  fromDid: string,
  fromHandle: string,
  theirQuoteUri: string
): Promise<void> {
  const engagement = createEngagement('quote', targetUri, fromDid, fromHandle, theirQuoteUri);
  return saveEngagement(engagement);
}

/**
 * Record a repost of your post
 */
export async function recordRepostReceived(
  targetUri: string,
  fromDid: string,
  fromHandle: string
): Promise<void> {
  const engagement = createEngagement('repost', targetUri, fromDid, fromHandle);
  return saveEngagement(engagement);
}

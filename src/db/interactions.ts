/**
 * Interactions store operations
 * Tracks YOUR interactions with other people's posts
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
  deleteByKey,
} from './database.js';
import { StoredInteraction, InteractionType, STORE_NAMES } from './schema.js';

const STORE = STORE_NAMES.INTERACTIONS;

/**
 * Generate interaction ID
 */
export function makeInteractionId(type: InteractionType, targetUri: string): string {
  return `${type}:${targetUri}`;
}

/**
 * Get an interaction by ID
 */
export async function getInteraction(id: string): Promise<StoredInteraction | undefined> {
  return getByKey<StoredInteraction>(STORE, id);
}

/**
 * Check if you interacted with a post
 */
export async function hasInteraction(
  type: InteractionType,
  targetUri: string
): Promise<boolean> {
  const id = makeInteractionId(type, targetUri);
  const interaction = await getInteraction(id);
  return interaction !== undefined;
}

/**
 * Save an interaction
 */
export async function saveInteraction(interaction: StoredInteraction): Promise<void> {
  return put(STORE, interaction);
}

/**
 * Save multiple interactions
 */
export async function saveInteractions(interactions: StoredInteraction[]): Promise<void> {
  return putBatch(STORE, interactions);
}

/**
 * Delete an interaction
 */
export async function deleteInteraction(type: InteractionType, targetUri: string): Promise<void> {
  const id = makeInteractionId(type, targetUri);
  return deleteByKey(STORE, id);
}

/**
 * Get all interactions
 */
export async function getAllInteractions(): Promise<StoredInteraction[]> {
  return getAll<StoredInteraction>(STORE);
}

/**
 * Get interactions by type
 */
export async function getInteractionsByType(type: InteractionType): Promise<StoredInteraction[]> {
  return getByIndex<StoredInteraction>(STORE, 'by-type', type);
}

/**
 * Get interactions with a specific author's posts
 */
export async function getInteractionsWithAuthor(authorDid: string): Promise<StoredInteraction[]> {
  return getByIndex<StoredInteraction>(STORE, 'by-target-author', authorDid);
}

/**
 * Get interactions within a date range
 */
export async function getInteractionsInDateRange(
  startMs: number,
  endMs: number
): Promise<StoredInteraction[]> {
  const range = IDBKeyRange.bound(startMs, endMs);
  return getByIndexRange<StoredInteraction>(STORE, 'by-created', range);
}

/**
 * Count total interactions
 */
export async function countInteractions(): Promise<number> {
  return count(STORE);
}

/**
 * Clear all interactions
 */
export async function clearInteractions(): Promise<void> {
  return clearStore(STORE);
}

/**
 * Create an interaction record
 */
export function createInteraction(
  type: InteractionType,
  targetUri: string,
  targetAuthorDid: string,
  yourPostUri?: string
): StoredInteraction {
  return {
    id: makeInteractionId(type, targetUri),
    type,
    targetUri,
    targetAuthorDid,
    createdAt: Date.now(),
    yourPostUri,
  };
}

/**
 * Record a like interaction
 */
export async function recordLike(targetUri: string, targetAuthorDid: string): Promise<void> {
  const interaction = createInteraction('like', targetUri, targetAuthorDid);
  return saveInteraction(interaction);
}

/**
 * Record a reply interaction
 */
export async function recordReply(
  targetUri: string,
  targetAuthorDid: string,
  yourReplyUri: string
): Promise<void> {
  const interaction = createInteraction('reply', targetUri, targetAuthorDid, yourReplyUri);
  return saveInteraction(interaction);
}

/**
 * Record a quote interaction
 */
export async function recordQuote(
  targetUri: string,
  targetAuthorDid: string,
  yourQuoteUri: string
): Promise<void> {
  const interaction = createInteraction('quote', targetUri, targetAuthorDid, yourQuoteUri);
  return saveInteraction(interaction);
}

/**
 * Record a repost interaction
 */
export async function recordRepost(targetUri: string, targetAuthorDid: string): Promise<void> {
  const interaction = createInteraction('repost', targetUri, targetAuthorDid);
  return saveInteraction(interaction);
}

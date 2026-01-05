/**
 * Analytics computation
 * Compute noise scores, reciprocity scores, and aggregations
 */

import { StoredProfile, StoredPost, StoredInteraction, StoredEngagement } from '../db/schema.js';
import { getAllProfiles, getAllPosts, getAllInteractions, getAllEngagements } from '../db/index.js';

export interface UserContribution {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  postCount: number;
  repostCount: number;
  quoteCount: number;
  replyCount: number;
  totalCount: number;
}

export interface UserEngagement {
  did: string;
  handle: string;
  yourLikesOfTheir: number;
  yourRepliesTo: number;
  yourQuotesOf: number;
  theirLikesOfYours: number;
  theirRepliesToYours: number;
  theirQuotesOfYours: number;
  yourTotal: number;
  theirTotal: number;
}

export interface NoiseScore {
  did: string;
  handle: string;
  score: number; // 0.0 to 1.0, higher = more noise
  volumePercentile: number; // Where they rank in volume (0-100)
  engagementRate: number; // % of their posts you engage with
  isMutual: boolean;
  postCount: number;
}

export interface ReciprocityScore {
  did: string;
  handle: string;
  score: number; // 0.0 to 1.0 (or beyond)
  yourEngagement: number; // Total engagement you show them
  theirEngagement: number; // Total engagement they show you
  balanced: boolean; // True if roughly equal (within 20%)
}

/**
 * Get all user contributions aggregated by author
 */
export async function aggregateUserContributions(): Promise<Map<string, UserContribution>> {
  const posts = await getAllPosts();
  const contributions = new Map<string, UserContribution>();

  for (const post of posts) {
    const existing = contributions.get(post.authorDid) || {
      did: post.authorDid,
      handle: post.authorHandle,
      displayName: post.displayName,
      avatar: post.avatar,
      postCount: 0,
      repostCount: 0,
      quoteCount: 0,
      replyCount: 0,
      totalCount: 0,
    };

    if (post.postType === 'post') {
      existing.postCount++;
    } else if (post.postType === 'repost') {
      existing.repostCount++;
    } else if (post.postType === 'quote') {
      existing.quoteCount++;
    } else if (post.postType === 'reply') {
      existing.replyCount++;
    }

    existing.totalCount = existing.postCount + existing.repostCount + existing.quoteCount + existing.replyCount;
    contributions.set(post.authorDid, existing);
  }

  return contributions;
}

/**
 * Get engagement between you and a specific user
 */
export async function getUserEngagement(targetDid: string, targetHandle: string): Promise<UserEngagement> {
  const interactions = await getAllInteractions();
  const engagements = await getAllEngagements();

  // Interactions: your engagement with their posts
  let yourLikesOfTheir = 0;
  let yourRepliesTo = 0;
  let yourQuotesOf = 0;

  for (const interaction of interactions) {
    if (interaction.targetDid === targetDid) {
      if (interaction.interactionType === 'like') yourLikesOfTheir++;
      else if (interaction.interactionType === 'reply') yourRepliesTo++;
      else if (interaction.interactionType === 'quote') yourQuotesOf++;
    }
  }

  // Engagements: their engagement with your posts
  let theirLikesOfYours = 0;
  let theirRepliesToYours = 0;
  let theirQuotesOfYours = 0;

  for (const engagement of engagements) {
    if (engagement.actorDid === targetDid) {
      if (engagement.engagementType === 'like') theirLikesOfYours++;
      else if (engagement.engagementType === 'reply') theirRepliesToYours++;
      else if (engagement.engagementType === 'quote') theirQuotesOfYours++;
    }
  }

  return {
    did: targetDid,
    handle: targetHandle,
    yourLikesOfTheir,
    yourRepliesTo,
    yourQuotesOf,
    theirLikesOfYours,
    theirRepliesToYours,
    theirQuotesOfYours,
    yourTotal: yourLikesOfTheir + yourRepliesTo + yourQuotesOf,
    theirTotal: theirLikesOfYours + theirRepliesToYours + theirQuotesOfYours,
  };
}

/**
 * Compute noise score for a user
 * Noise = high volume + low engagement from you
 * Formula: volumePercentile × (1 - engagementRate)
 */
export async function computeNoiseScore(targetDid: string, targetHandle: string): Promise<NoiseScore> {
  const contributions = await aggregateUserContributions();
  const userContribution = contributions.get(targetDid);
  const profile = (await getAllProfiles()).find((p) => p.did === targetDid);

  if (!userContribution) {
    return {
      did: targetDid,
      handle: targetHandle,
      score: 0,
      volumePercentile: 0,
      engagementRate: 0,
      isMutual: profile?.isMutual || false,
      postCount: 0,
    };
  }

  // Calculate volume percentile
  const allCounts = Array.from(contributions.values()).map((c) => c.totalCount);
  const sortedCounts = allCounts.sort((a, b) => b - a);
  const rank = sortedCounts.findIndex((c) => c <= userContribution.totalCount);
  const volumePercentile = rank >= 0 ? ((sortedCounts.length - rank) / sortedCounts.length) * 100 : 0;

  // Calculate engagement rate
  const engagement = await getUserEngagement(targetDid, targetHandle);
  const engagementRate = userContribution.totalCount > 0 ? engagement.yourTotal / userContribution.totalCount : 0;

  // Base score
  let score = (volumePercentile / 100) * (1 - engagementRate);

  // Boost score if not mutual (you follow but they don't follow you)
  if (profile && !profile.isMutual && profile.youFollow && !profile.followsYou) {
    score = Math.min(1, score * 1.2);
  }

  return {
    did: targetDid,
    handle: targetHandle,
    score,
    volumePercentile: volumePercentile / 100,
    engagementRate,
    isMutual: profile?.isMutual || false,
    postCount: userContribution.totalCount,
  };
}

/**
 * Compute reciprocity score for mutual engagement
 * 0.0 = you engage, they don't
 * 0.5 = balanced
 * 1.0+ = they engage more than you
 */
export async function computeReciprocityScore(targetDid: string, targetHandle: string): Promise<ReciprocityScore> {
  const engagement = await getUserEngagement(targetDid, targetHandle);

  const yourTotal = engagement.yourTotal;
  const theirTotal = engagement.theirTotal;
  const combined = yourTotal + theirTotal;

  let score = 0;
  if (combined > 0) {
    // Score represents their proportion of mutual engagement
    score = theirTotal / combined;
  }

  // Check if balanced (within 20% of equal)
  const min = Math.min(yourTotal, theirTotal);
  const max = Math.max(yourTotal, theirTotal);
  const balanced = max === 0 || (min / max) >= 0.8;

  return {
    did: targetDid,
    handle: targetHandle,
    score,
    yourEngagement: yourTotal,
    theirEngagement: theirTotal,
    balanced,
  };
}

/**
 * Compute noise scores for all contributors
 */
export async function computeAllNoiseScores(): Promise<NoiseScore[]> {
  const contributions = await aggregateUserContributions();
  const scores: NoiseScore[] = [];

  for (const [did, contribution] of contributions) {
    const score = await computeNoiseScore(did, contribution.handle);
    scores.push(score);
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Compute reciprocity scores for all contributors
 */
export async function computeAllReciprocityScores(): Promise<ReciprocityScore[]> {
  const contributions = await aggregateUserContributions();
  const scores: ReciprocityScore[] = [];

  for (const [did, contribution] of contributions) {
    const score = await computeReciprocityScore(did, contribution.handle);
    scores.push(score);
  }

  return scores.sort((a, b) => b.score - a.score);
}

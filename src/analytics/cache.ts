/**
 * Analytics caching
 * Cache computed scores to avoid recomputation
 */

import { openDatabase } from '../db/index.js';
import {
  computeAllNoiseScores,
  computeAllReciprocityScores,
  NoiseScore,
  ReciprocityScore,
  aggregateUserContributions,
} from './compute.js';

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export interface CachedAnalytics {
  noiseScoringTime: number;
  reciprocityScoringTime: number;
  noiseScores: NoiseScore[];
  reciprocityScores: ReciprocityScore[];
  totalContributors: number;
  totalPosts: number;
}

/**
 * Get cached analytics or compute if stale
 */
export async function getAnalytics(): Promise<CachedAnalytics> {
  const db = await openDatabase();
  const tx = db.transaction('cachedAnalytics', 'readonly');
  const store = tx.objectStore('cachedAnalytics');
  const cached = await new Promise<any>((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const now = Date.now();
  if (cached && now - cached.noiseScoringTime < CACHE_DURATION) {
    console.log('[MangeLa] Using cached analytics');
    return cached;
  }

  console.log('[MangeLa] Computing analytics...');
  return computeAndCacheAnalytics();
}

/**
 * Compute all analytics and cache them
 */
export async function computeAndCacheAnalytics(): Promise<CachedAnalytics> {
  const now = Date.now();

  const [noiseScores, reciprocityScores, contributions] = await Promise.all([
    computeAllNoiseScores(),
    computeAllReciprocityScores(),
    aggregateUserContributions(),
  ]);

  const totalPosts = Array.from(contributions.values()).reduce((sum, c) => sum + c.totalCount, 0);

  const analytics: CachedAnalytics = {
    noiseScoringTime: now,
    reciprocityScoringTime: now,
    noiseScores,
    reciprocityScores,
    totalContributors: contributions.size,
    totalPosts,
  };

  // Cache it
  const db = await openDatabase();
  const tx = db.transaction('cachedAnalytics', 'readwrite');
  const store = tx.objectStore('cachedAnalytics');
  await new Promise<void>((resolve, reject) => {
    const request = store.put({ id: 'current', ...analytics });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  console.log('[MangeLa] Analytics cached');
  return analytics;
}

/**
 * Invalidate analytics cache (call after sync)
 */
export async function invalidateAnalyticsCache(): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction('cachedAnalytics', 'readwrite');
  const store = tx.objectStore('cachedAnalytics');
  await new Promise<void>((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  console.log('[MangeLa] Analytics cache invalidated');
}

/**
 * Get high-noise users (candidates for unfollowing)
 */
export async function getNoiseOutliers(threshold = 0.7): Promise<NoiseScore[]> {
  const analytics = await getAnalytics();
  return analytics.noiseScores.filter((s) => s.score > threshold);
}

/**
 * Get non-reciprocal relationships
 */
export async function getNonReciprocal(threshold = 0.3): Promise<ReciprocityScore[]> {
  const analytics = await getAnalytics();
  return analytics.reciprocityScores.filter((s) => s.yourEngagement > 0 && s.score < threshold);
}

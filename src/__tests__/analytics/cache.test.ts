import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNoiseOutliers, getNonReciprocal, invalidateAnalyticsCache } from '../../analytics/cache.js';
import * as compute from '../../analytics/compute.js';

// Mock modules
vi.mock('../../analytics/compute.js', () => ({
  computeAllNoiseScores: vi.fn(),
  computeAllReciprocityScores: vi.fn(),
  aggregateUserContributions: vi.fn(),
}));

// Since IndexedDB testing is complex with async callbacks, we test the
// filtering logic only. Full caching is integration-tested.
describe('Analytics Cache - getNoiseOutliers', () => {
  beforeEach(async () => {
    await invalidateAnalyticsCache();
    vi.clearAllMocks();
  });
  it('should filter noise scores by threshold', async () => {
    const mockNoiseScores = [
      { did: 'did:alice', handle: 'alice.bsky.social', score: 0.8, volumePercentile: 0.9, engagementRate: 0.1, isMutual: false, postCount: 100 },
      { did: 'did:bob', handle: 'bob.bsky.social', score: 0.3, volumePercentile: 0.5, engagementRate: 0.4, isMutual: true, postCount: 50 },
      { did: 'did:charlie', handle: 'charlie.bsky.social', score: 0.75, volumePercentile: 0.8, engagementRate: 0.05, isMutual: false, postCount: 80 },
    ];

    const mockContributions = new Map([
      ['did:alice', { did: 'did:alice', handle: 'alice.bsky.social', displayName: 'Alice', avatar: undefined, postCount: 100, repostCount: 0, quoteCount: 0, replyCount: 0, totalCount: 100 }],
      ['did:bob', { did: 'did:bob', handle: 'bob.bsky.social', displayName: 'Bob', avatar: undefined, postCount: 50, repostCount: 0, quoteCount: 0, replyCount: 0, totalCount: 50 }],
      ['did:charlie', { did: 'did:charlie', handle: 'charlie.bsky.social', displayName: 'Charlie', avatar: undefined, postCount: 80, repostCount: 0, quoteCount: 0, replyCount: 0, totalCount: 80 }],
    ]);

    vi.mocked(compute.computeAllNoiseScores).mockResolvedValue(mockNoiseScores);
    vi.mocked(compute.computeAllReciprocityScores).mockResolvedValue([]);
    vi.mocked(compute.aggregateUserContributions).mockResolvedValue(mockContributions);

    const result = await getNoiseOutliers(0.7);

    expect(result.length).toBe(2);
    expect(result.map((r) => r.did)).toContain('did:alice');
    expect(result.map((r) => r.did)).toContain('did:charlie');
    expect(result.map((r) => r.did)).not.toContain('did:bob');
  });

  it('should return all high-noise users', async () => {
    const mockNoiseScores = [
      { did: 'did:alice', handle: 'alice.bsky.social', score: 0.95, volumePercentile: 0.99, engagementRate: 0.01, isMutual: false, postCount: 200 },
      { did: 'did:bob', handle: 'bob.bsky.social', score: 0.85, volumePercentile: 0.95, engagementRate: 0.05, isMutual: false, postCount: 150 },
    ];

    const mockContributions = new Map([
      ['did:alice', { did: 'did:alice', handle: 'alice.bsky.social', displayName: 'Alice', avatar: undefined, postCount: 200, repostCount: 0, quoteCount: 0, replyCount: 0, totalCount: 200 }],
      ['did:bob', { did: 'did:bob', handle: 'bob.bsky.social', displayName: 'Bob', avatar: undefined, postCount: 150, repostCount: 0, quoteCount: 0, replyCount: 0, totalCount: 150 }],
    ]);

    vi.mocked(compute.computeAllNoiseScores).mockResolvedValue(mockNoiseScores);
    vi.mocked(compute.computeAllReciprocityScores).mockResolvedValue([]);
    vi.mocked(compute.aggregateUserContributions).mockResolvedValue(mockContributions);

    const result = await getNoiseOutliers(0.8);

    expect(result.length).toBe(2);
  });
});

describe('Analytics Cache - getNonReciprocal', () => {
  beforeEach(async () => {
    await invalidateAnalyticsCache();
    vi.clearAllMocks();
  });

  it('should return users you engage with more than they engage with you', async () => {
    const mockReciprocityScores = [
      { did: 'did:alice', handle: 'alice.bsky.social', score: 0.2, yourEngagement: 10, theirEngagement: 2, balanced: false },
      { did: 'did:bob', handle: 'bob.bsky.social', score: 0.5, yourEngagement: 5, theirEngagement: 5, balanced: true },
      { did: 'did:charlie', handle: 'charlie.bsky.social', score: 0.1, yourEngagement: 20, theirEngagement: 2, balanced: false },
    ];

    const mockContributions = new Map();

    vi.mocked(compute.computeAllNoiseScores).mockResolvedValue([]);
    vi.mocked(compute.computeAllReciprocityScores).mockResolvedValue(mockReciprocityScores);
    vi.mocked(compute.aggregateUserContributions).mockResolvedValue(mockContributions);

    const result = await getNonReciprocal(0.3);

    expect(result.length).toBe(2);
    expect(result.map((r) => r.did)).toContain('did:alice');
    expect(result.map((r) => r.did)).toContain('did:charlie');
  });

  it('should exclude users you have zero engagement with', async () => {
    const mockReciprocityScores = [
      { did: 'did:alice', handle: 'alice.bsky.social', score: 0.2, yourEngagement: 0, theirEngagement: 5, balanced: false },
      { did: 'did:bob', handle: 'bob.bsky.social', score: 0.2, yourEngagement: 10, theirEngagement: 2, balanced: false },
    ];

    const mockContributions = new Map();

    vi.mocked(compute.computeAllNoiseScores).mockResolvedValue([]);
    vi.mocked(compute.computeAllReciprocityScores).mockResolvedValue(mockReciprocityScores);
    vi.mocked(compute.aggregateUserContributions).mockResolvedValue(mockContributions);

    const result = await getNonReciprocal(0.3);

    expect(result.length).toBe(1);
    expect(result[0].did).toBe('did:bob');
  });

  it('should return empty list if no non-reciprocal users', async () => {
    const mockReciprocityScores = [
      { did: 'did:alice', handle: 'alice.bsky.social', score: 0.5, yourEngagement: 5, theirEngagement: 5, balanced: true },
      { did: 'did:bob', handle: 'bob.bsky.social', score: 0.6, yourEngagement: 3, theirEngagement: 5, balanced: true },
    ];

    const mockContributions = new Map();

    vi.mocked(compute.computeAllNoiseScores).mockResolvedValue([]);
    vi.mocked(compute.computeAllReciprocityScores).mockResolvedValue(mockReciprocityScores);
    vi.mocked(compute.aggregateUserContributions).mockResolvedValue(mockContributions);

    const result = await getNonReciprocal(0.3);

    expect(result.length).toBe(0);
  });
});

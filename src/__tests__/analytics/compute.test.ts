import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  aggregateUserContributions,
  getUserEngagement,
  computeNoiseScore,
  computeReciprocityScore,
  computeAllNoiseScores,
  computeAllReciprocityScores,
} from '../../analytics/compute.js';
import * as db from '../../db/index.js';

// Mock the database
vi.mock('../../db/index.js', () => ({
  getAllProfiles: vi.fn(),
  getAllPosts: vi.fn(),
  getAllInteractions: vi.fn(),
  getAllEngagements: vi.fn(),
}));

describe('Analytics - aggregateUserContributions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate posts by author', async () => {
    const posts = [
      {
        uri: 'at://1',
        cid: 'cid1',
        authorDid: 'did:alice',
        authorHandle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: 'https://example.com/alice.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'post' as const,
        metadata: {},
      },
      {
        uri: 'at://2',
        cid: 'cid2',
        authorDid: 'did:alice',
        authorHandle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: 'https://example.com/alice.jpg',
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'repost' as const,
        metadata: {},
      },
      {
        uri: 'at://3',
        cid: 'cid3',
        authorDid: 'did:bob',
        authorHandle: 'bob.bsky.social',
        displayName: 'Bob',
        avatar: undefined,
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'post' as const,
        metadata: {},
      },
    ];

    vi.mocked(db.getAllPosts).mockResolvedValue(posts);

    const result = await aggregateUserContributions();

    expect(result.size).toBe(2);
    expect(result.get('did:alice')).toEqual({
      did: 'did:alice',
      handle: 'alice.bsky.social',
      displayName: 'Alice',
      avatar: 'https://example.com/alice.jpg',
      postCount: 1,
      repostCount: 1,
      quoteCount: 0,
      replyCount: 0,
      totalCount: 2,
    });
    expect(result.get('did:bob')).toEqual({
      did: 'did:bob',
      handle: 'bob.bsky.social',
      displayName: 'Bob',
      avatar: undefined,
      postCount: 1,
      repostCount: 0,
      quoteCount: 0,
      replyCount: 0,
      totalCount: 1,
    });
  });

  it('should handle empty posts', async () => {
    vi.mocked(db.getAllPosts).mockResolvedValue([]);

    const result = await aggregateUserContributions();

    expect(result.size).toBe(0);
  });
});

describe('Analytics - getUserEngagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sum your interactions with target user', async () => {
    const interactions = [
      {
        uri: 'at://1',
        targetDid: 'did:alice',
        targetHandle: 'alice.bsky.social',
        interactionType: 'like' as const,
        timestamp: Date.now(),
      },
      {
        uri: 'at://2',
        targetDid: 'did:alice',
        targetHandle: 'alice.bsky.social',
        interactionType: 'like' as const,
        timestamp: Date.now(),
      },
      {
        uri: 'at://3',
        targetDid: 'did:alice',
        targetHandle: 'alice.bsky.social',
        interactionType: 'reply' as const,
        timestamp: Date.now(),
      },
      {
        uri: 'at://4',
        targetDid: 'did:bob',
        targetHandle: 'bob.bsky.social',
        interactionType: 'like' as const,
        timestamp: Date.now(),
      },
    ];

    const engagements = [
      {
        postUri: 'at://my-post',
        actorDid: 'did:alice',
        actorHandle: 'alice.bsky.social',
        engagementType: 'like' as const,
        timestamp: Date.now(),
      },
      {
        postUri: 'at://my-post-2',
        actorDid: 'did:alice',
        actorHandle: 'alice.bsky.social',
        engagementType: 'quote' as const,
        timestamp: Date.now(),
      },
    ];

    vi.mocked(db.getAllInteractions).mockResolvedValue(interactions);
    vi.mocked(db.getAllEngagements).mockResolvedValue(engagements);

    const result = await getUserEngagement('did:alice', 'alice.bsky.social');

    expect(result).toEqual({
      did: 'did:alice',
      handle: 'alice.bsky.social',
      yourLikesOfTheir: 2,
      yourRepliesTo: 1,
      yourQuotesOf: 0,
      theirLikesOfYours: 1,
      theirRepliesToYours: 0,
      theirQuotesOfYours: 1,
      yourTotal: 3,
      theirTotal: 2,
    });
  });

  it('should return zero engagement for unengaged users', async () => {
    vi.mocked(db.getAllInteractions).mockResolvedValue([]);
    vi.mocked(db.getAllEngagements).mockResolvedValue([]);

    const result = await getUserEngagement('did:alice', 'alice.bsky.social');

    expect(result.yourTotal).toBe(0);
    expect(result.theirTotal).toBe(0);
  });
});

describe('Analytics - computeNoiseScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute noise score based on volume and engagement', async () => {
    const posts = [
      {
        uri: 'at://1',
        cid: 'cid1',
        authorDid: 'did:alice',
        authorHandle: 'alice.bsky.social',
        displayName: 'Alice',
        avatar: undefined,
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'post' as const,
        metadata: {},
      },
      // Alice with 1 post
      {
        uri: 'at://2',
        cid: 'cid2',
        authorDid: 'did:bob',
        authorHandle: 'bob.bsky.social',
        displayName: 'Bob',
        avatar: undefined,
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'post' as const,
        metadata: {},
      },
      // Bob with 10 posts (1 shown)
      ...Array.from({ length: 9 }, (_, i) => ({
        uri: `at://${i + 3}`,
        cid: `cid${i + 3}`,
        authorDid: 'did:bob',
        authorHandle: 'bob.bsky.social',
        displayName: 'Bob',
        avatar: undefined,
        createdAt: '2025-01-01T00:00:00Z',
        postType: 'post' as const,
        metadata: {},
      })),
    ];

    const interactions = [
      // You like 5 of bob's 10 posts
      ...Array.from({ length: 5 }, (_, i) => ({
        uri: `at://${i + 2}`,
        targetDid: 'did:bob',
        targetHandle: 'bob.bsky.social',
        interactionType: 'like' as const,
        timestamp: Date.now(),
      })),
    ];

    const profiles = [
      {
        did: 'did:bob',
        handle: 'bob.bsky.social',
        displayName: 'Bob',
        avatar: undefined,
        youFollow: true,
        followsYou: true,
        isMutual: true,
        lastUpdated: Date.now(),
      },
    ];

    vi.mocked(db.getAllPosts).mockResolvedValue(posts);
    vi.mocked(db.getAllInteractions).mockResolvedValue(interactions);
    vi.mocked(db.getAllEngagements).mockResolvedValue([]);
    vi.mocked(db.getAllProfiles).mockResolvedValue(profiles);

    const result = await computeNoiseScore('did:bob', 'bob.bsky.social');

    expect(result.did).toBe('did:bob');
    expect(result.handle).toBe('bob.bsky.social');
    expect(result.postCount).toBe(10);
    expect(result.engagementRate).toBe(0.5); // 5/10
    expect(result.score).toBeLessThan(1); // 50% volume percentile * 50% engagement = 0.25
  });

  it('should return zero score for user with no posts', async () => {
    vi.mocked(db.getAllPosts).mockResolvedValue([]);
    vi.mocked(db.getAllInteractions).mockResolvedValue([]);
    vi.mocked(db.getAllEngagements).mockResolvedValue([]);
    vi.mocked(db.getAllProfiles).mockResolvedValue([]);

    const result = await computeNoiseScore('did:alice', 'alice.bsky.social');

    expect(result.score).toBe(0);
    expect(result.postCount).toBe(0);
  });
});

describe('Analytics - computeReciprocityScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute balanced reciprocity', async () => {
    const interactions = [
      { uri: 'at://1', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
      { uri: 'at://2', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
    ];

    const engagements = [
      { postUri: 'at://my1', actorDid: 'did:alice', actorHandle: 'alice.bsky.social', engagementType: 'like' as const, timestamp: Date.now() },
      { postUri: 'at://my2', actorDid: 'did:alice', actorHandle: 'alice.bsky.social', engagementType: 'like' as const, timestamp: Date.now() },
    ];

    vi.mocked(db.getAllInteractions).mockResolvedValue(interactions);
    vi.mocked(db.getAllEngagements).mockResolvedValue(engagements);

    const result = await computeReciprocityScore('did:alice', 'alice.bsky.social');

    expect(result.yourEngagement).toBe(2);
    expect(result.theirEngagement).toBe(2);
    expect(result.score).toBe(0.5); // 2 / (2 + 2)
    expect(result.balanced).toBe(true);
  });

  it('should mark unbalanced relationships', async () => {
    const interactions = [
      { uri: 'at://1', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
      { uri: 'at://2', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
      { uri: 'at://3', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
      { uri: 'at://4', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
      { uri: 'at://5', targetDid: 'did:alice', targetHandle: 'alice.bsky.social', interactionType: 'like' as const, timestamp: Date.now() },
    ];

    const engagements = [
      { postUri: 'at://my1', actorDid: 'did:alice', actorHandle: 'alice.bsky.social', engagementType: 'like' as const, timestamp: Date.now() },
    ];

    vi.mocked(db.getAllInteractions).mockResolvedValue(interactions);
    vi.mocked(db.getAllEngagements).mockResolvedValue(engagements);

    const result = await computeReciprocityScore('did:alice', 'alice.bsky.social');

    expect(result.yourEngagement).toBe(5);
    expect(result.theirEngagement).toBe(1);
    expect(result.score).toBeLessThan(0.5);
    expect(result.balanced).toBe(false);
  });
});

describe('Analytics - computeAllNoiseScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute noise scores for all users sorted by score', async () => {
    const posts = [
      { uri: 'at://1', cid: 'cid1', authorDid: 'did:alice', authorHandle: 'alice.bsky.social', displayName: 'Alice', avatar: undefined, createdAt: '2025-01-01T00:00:00Z', postType: 'post' as const, metadata: {} },
      { uri: 'at://2', cid: 'cid2', authorDid: 'did:bob', authorHandle: 'bob.bsky.social', displayName: 'Bob', avatar: undefined, createdAt: '2025-01-01T00:00:00Z', postType: 'post' as const, metadata: {} },
    ];

    vi.mocked(db.getAllPosts).mockResolvedValue(posts);
    vi.mocked(db.getAllInteractions).mockResolvedValue([]);
    vi.mocked(db.getAllEngagements).mockResolvedValue([]);
    vi.mocked(db.getAllProfiles).mockResolvedValue([]);

    const result = await computeAllNoiseScores();

    expect(result.length).toBe(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });
});

describe('Analytics - computeAllReciprocityScores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute reciprocity scores for all users sorted by score', async () => {
    const posts = [
      { uri: 'at://1', cid: 'cid1', authorDid: 'did:alice', authorHandle: 'alice.bsky.social', displayName: 'Alice', avatar: undefined, createdAt: '2025-01-01T00:00:00Z', postType: 'post' as const, metadata: {} },
      { uri: 'at://2', cid: 'cid2', authorDid: 'did:bob', authorHandle: 'bob.bsky.social', displayName: 'Bob', avatar: undefined, createdAt: '2025-01-01T00:00:00Z', postType: 'post' as const, metadata: {} },
    ];

    vi.mocked(db.getAllPosts).mockResolvedValue(posts);
    vi.mocked(db.getAllInteractions).mockResolvedValue([]);
    vi.mocked(db.getAllEngagements).mockResolvedValue([]);

    const result = await computeAllReciprocityScores();

    expect(result.length).toBe(2);
  });
});

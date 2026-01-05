import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { closeDatabase, deleteDatabase } from '../../db/database.js';
import {
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
  type StoredProfile,
} from '../../db/index.js';

describe('Profiles', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    closeDatabase();
  });

  describe('getProfile / saveProfile', () => {
    it('should save and retrieve a profile by DID', async () => {
      const profile = createProfile(
        'did:plc:test123',
        'test.bsky.social',
        'Test User',
        'https://avatar.url',
        true,
        true
      );

      await saveProfile(profile);
      const retrieved = await getProfile('did:plc:test123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.did).toBe('did:plc:test123');
      expect(retrieved?.handle).toBe('test.bsky.social');
      expect(retrieved?.displayName).toBe('Test User');
      expect(retrieved?.isMutual).toBe(true);
    });

    it('should return undefined for non-existent DID', async () => {
      const retrieved = await getProfile('did:plc:nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getProfileByHandle', () => {
    it('should retrieve a profile by handle', async () => {
      const profile = createProfile('did:plc:abc', 'unique.handle.social');
      await saveProfile(profile);

      const retrieved = await getProfileByHandle('unique.handle.social');
      expect(retrieved?.did).toBe('did:plc:abc');
    });

    it('should return undefined for non-existent handle', async () => {
      const retrieved = await getProfileByHandle('nonexistent.bsky.social');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('saveProfiles', () => {
    it('should save multiple profiles', async () => {
      const profiles = [
        createProfile('did:plc:1', 'user1.bsky.social'),
        createProfile('did:plc:2', 'user2.bsky.social'),
        createProfile('did:plc:3', 'user3.bsky.social'),
      ];

      await saveProfiles(profiles);
      const allProfiles = await getAllProfiles();

      expect(allProfiles).toHaveLength(3);
    });
  });

  describe('getFollowing / getFollowers / getMutuals', () => {
    beforeEach(async () => {
      // Set up test data with different relationship types
      const profiles: StoredProfile[] = [
        // Mutual follow
        {
          did: 'did:plc:mutual1',
          handle: 'mutual1.bsky.social',
          followsYou: true,
          youFollow: true,
          isMutual: true,
          lastUpdated: Date.now(),
        },
        // You follow, they don't follow back
        {
          did: 'did:plc:following',
          handle: 'following.bsky.social',
          followsYou: false,
          youFollow: true,
          isMutual: false,
          lastUpdated: Date.now(),
        },
        // They follow you, you don't follow back
        {
          did: 'did:plc:follower',
          handle: 'follower.bsky.social',
          followsYou: true,
          youFollow: false,
          isMutual: false,
          lastUpdated: Date.now(),
        },
        // Another mutual
        {
          did: 'did:plc:mutual2',
          handle: 'mutual2.bsky.social',
          followsYou: true,
          youFollow: true,
          isMutual: true,
          lastUpdated: Date.now(),
        },
      ];

      await saveProfiles(profiles);
    });

    it('should get profiles you follow', async () => {
      const following = await getFollowing();
      // mutual1, following, mutual2
      expect(following).toHaveLength(3);
      expect(following.every((p) => p.youFollow)).toBe(true);
    });

    it('should get profiles that follow you', async () => {
      const followers = await getFollowers();
      // mutual1, follower, mutual2
      expect(followers).toHaveLength(3);
      expect(followers.every((p) => p.followsYou)).toBe(true);
    });

    it('should get mutual follows', async () => {
      const mutuals = await getMutuals();
      // mutual1, mutual2
      expect(mutuals).toHaveLength(2);
      expect(mutuals.every((p) => p.isMutual)).toBe(true);
    });
  });

  describe('countProfiles', () => {
    it('should return correct count', async () => {
      expect(await countProfiles()).toBe(0);

      await saveProfile(createProfile('did:plc:1', 'user1.bsky.social'));
      expect(await countProfiles()).toBe(1);

      await saveProfile(createProfile('did:plc:2', 'user2.bsky.social'));
      expect(await countProfiles()).toBe(2);
    });
  });

  describe('clearProfiles', () => {
    it('should remove all profiles', async () => {
      await saveProfiles([
        createProfile('did:plc:1', 'user1.bsky.social'),
        createProfile('did:plc:2', 'user2.bsky.social'),
      ]);

      expect(await countProfiles()).toBe(2);
      await clearProfiles();
      expect(await countProfiles()).toBe(0);
    });
  });

  describe('createProfile', () => {
    it('should create a profile with default values', async () => {
      const profile = createProfile('did:plc:test', 'test.bsky.social');

      expect(profile.did).toBe('did:plc:test');
      expect(profile.handle).toBe('test.bsky.social');
      expect(profile.followsYou).toBe(false);
      expect(profile.youFollow).toBe(false);
      expect(profile.isMutual).toBe(false);
      expect(profile.lastUpdated).toBeDefined();
    });

    it('should compute isMutual correctly', async () => {
      const mutual = createProfile('did:plc:m', 'mutual.bsky.social', undefined, undefined, true, true);
      expect(mutual.isMutual).toBe(true);

      const notMutual = createProfile('did:plc:nm', 'notmutual.bsky.social', undefined, undefined, true, false);
      expect(notMutual.isMutual).toBe(false);
    });
  });

  describe('mergeProfile', () => {
    it('should merge updates into existing profile', async () => {
      const existing: StoredProfile = {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Original Name',
        followsYou: false,
        youFollow: true,
        isMutual: false,
        lastUpdated: 1000,
      };

      const merged = mergeProfile(existing, {
        displayName: 'New Name',
        followsYou: true,
      });

      expect(merged.displayName).toBe('New Name');
      expect(merged.followsYou).toBe(true);
      expect(merged.youFollow).toBe(true); // Preserved
      expect(merged.isMutual).toBe(true); // Recomputed
      expect(merged.lastUpdated).toBeGreaterThan(1000);
    });

    it('should create new profile when existing is undefined', async () => {
      const merged = mergeProfile(undefined, {
        did: 'did:plc:new',
        handle: 'new.bsky.social',
        youFollow: true,
      });

      expect(merged.did).toBe('did:plc:new');
      expect(merged.handle).toBe('new.bsky.social');
      expect(merged.youFollow).toBe(true);
      expect(merged.followsYou).toBe(false);
      expect(merged.isMutual).toBe(false);
    });
  });
});
